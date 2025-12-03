import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

const cleanApiUrl = (url: string): string => {
  let cleaned = url.replace(/\/+$/, '');
  const pathPatterns = [
    /\/message\/sendText\/[^\/]+$/i,
    /\/message\/sendText$/i,
    /\/message$/i,
  ];
  for (const pattern of pathPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned;
};

const sendWhatsApp = async (phone: string, message: string): Promise<boolean> => {
  const evolutionApiUrlRaw = Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionApiUrlRaw || !evolutionApiKey || !instanceName) {
    console.error("Missing Evolution API configuration");
    return false;
  }

  const evolutionApiUrl = cleanApiUrl(evolutionApiUrlRaw);

  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  try {
    const response = await fetch(
      `${evolutionApiUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify({
          number: cleaned,
          text: message,
        }),
      }
    );

    const data = await response.json();
    console.log(`WhatsApp sent to ${cleaned}:`, data);
    return response.ok;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${cleaned}:`, error);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("weekly-summary function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate last week dates
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];

    // Calculate this week end
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
    const thisWeekEndStr = thisWeekEnd.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    console.log("Generating weekly summary for:", todayStr);

    // Get all users with phone configured
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone, full_name')
      .not('phone', 'is', null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    let sentCount = 0;

    for (const profile of profiles || []) {
      if (!profile.phone) continue;

      // Fetch payments from last week
      const { data: payments, error: paymentsError } = await supabase
        .from('loan_payments')
        .select('amount, payment_date')
        .eq('user_id', profile.id)
        .gte('payment_date', lastWeekStartStr)
        .lte('payment_date', todayStr);

      if (paymentsError) {
        console.error(`Error fetching payments for user ${profile.id}:`, paymentsError);
      }

      // Fetch all loans for this user
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select(`
          *,
          clients!inner(full_name)
        `)
        .eq('user_id', profile.id);

      if (loansError) {
        console.error(`Error fetching loans for user ${profile.id}:`, loansError);
        continue;
      }

      if (!loans || loans.length === 0) {
        console.log(`User ${profile.id} has no loans, skipping`);
        continue;
      }

      // Calculate statistics
      const totalReceivedLastWeek = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const paymentsCount = payments?.length || 0;

      // Categorize loans for this week
      const dueThisWeek: any[] = [];
      const overdueLoans: any[] = [];
      let totalDueThisWeek = 0;
      let totalOverdue = 0;
      let totalPending = 0;

      for (const loan of loans) {
        if (loan.status === 'paid') continue;

        const client = loan.clients as { full_name: string };
        
        const installmentDates = (loan.installment_dates as string[]) || [];
        const numInstallments = loan.installments || 1;
        const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
        const principalPerInstallment = loan.principal_amount / numInstallments;
        const totalPerInstallment = principalPerInstallment + interestPerInstallment;
        const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);

        let nextDueDate: string | null = null;
        let installmentAmount = totalPerInstallment;

        if (installmentDates.length > 0 && paidInstallments < installmentDates.length) {
          nextDueDate = installmentDates[paidInstallments];
        } else {
          nextDueDate = loan.due_date;
          if (loan.payment_type === 'single') {
            installmentAmount = loan.remaining_balance + (loan.principal_amount * (loan.interest_rate / 100));
          }
        }

        if (!nextDueDate) continue;

        const dueDate = new Date(nextDueDate);
        dueDate.setHours(0, 0, 0, 0);

        const loanInfo = {
          clientName: client.full_name,
          amount: installmentAmount,
          dueDate: nextDueDate,
        };

        // Check if due this week
        if (nextDueDate >= todayStr && nextDueDate <= thisWeekEndStr) {
          dueThisWeek.push(loanInfo);
          totalDueThisWeek += installmentAmount;
        } else if (dueDate < today) {
          overdueLoans.push({
            ...loanInfo,
            daysOverdue: Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
          });
          totalOverdue += installmentAmount;
        }

        if (loan.status !== 'paid') {
          totalPending += loan.remaining_balance;
        }
      }

      // Build message
      let message = `📅 *Resumo Semanal*\n\nOlá${profile.full_name ? `, ${profile.full_name}` : ''}!\n\n`;
      
      // Last week stats
      message += `📊 *Semana anterior:*\n`;
      message += `• Pagamentos recebidos: *${paymentsCount}*\n`;
      message += `• Total recebido: *${formatCurrency(totalReceivedLastWeek)}*\n\n`;

      // This week preview
      message += `🔮 *Esta semana:*\n`;
      message += `• Vencimentos: *${dueThisWeek.length}*\n`;
      message += `• A receber: *${formatCurrency(totalDueThisWeek)}*\n\n`;

      if (dueThisWeek.length > 0) {
        message += `📋 *Próximos vencimentos:*\n`;
        message += dueThisWeek.slice(0, 5).map(l => 
          `• ${l.clientName}: ${formatCurrency(l.amount)} (${formatDate(new Date(l.dueDate))})`
        ).join('\n');
        if (dueThisWeek.length > 5) {
          message += `\n_... e mais ${dueThisWeek.length - 5}_`;
        }
        message += `\n\n`;
      }

      if (overdueLoans.length > 0) {
        message += `🚨 *Em atraso: ${overdueLoans.length}* (${formatCurrency(totalOverdue)})\n\n`;
      }

      message += `💰 *Total pendente: ${formatCurrency(totalPending)}*\n\n`;
      message += `Bons negócios esta semana! 💪\n\n`;
      message += `_CobraFácil - Resumo semanal_`;

      console.log(`Sending weekly summary to user ${profile.id}`);
      
      const sent = await sendWhatsApp(profile.phone, message);
      if (sent) {
        sentCount++;
      }
    }

    console.log(`Sent ${sentCount} weekly summaries`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        usersChecked: profiles?.length || 0 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in weekly-summary:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
