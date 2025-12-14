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

const getContractId = (id: string): string => {
  return `EMP-${id.substring(0, 4).toUpperCase()}`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("check-loan-reminders function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Check for loans due TODAY only (removed 1, 3, 7 day reminders - consolidated in daily summary)
    console.log("Checking loans due today:", todayStr);

    // Fetch all pending loans with client data
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select(`
        *,
        clients!inner(full_name, phone)
      `)
      .eq('status', 'pending');

    if (loansError) {
      console.error("Error fetching loans:", loansError);
      throw loansError;
    }

    console.log(`Found ${loans?.length || 0} pending loans`);

    // Group loans by user_id
    const userLoansMap: Map<string, any[]> = new Map();

    for (const loan of loans || []) {
      const client = loan.clients as { full_name: string; phone: string | null };
      
      const installmentDates = (loan.installment_dates as string[]) || [];
      const numInstallments = loan.installments || 1;
      
      // USE DATABASE VALUES AS SOURCE OF TRUTH
      // total_interest from DB already includes user adjustments (rounding, renewal fees)
      let totalInterest = loan.total_interest || 0;
      if (totalInterest === 0) {
        // Fallback: calculate only if not stored
        if (loan.interest_mode === 'on_total') {
          totalInterest = loan.principal_amount * (loan.interest_rate / 100);
        } else {
          totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
        }
      }
      
      // remaining_balance from DB is the source of truth
      const remainingBalance = loan.remaining_balance;
      const totalToReceive = remainingBalance + (loan.total_paid || 0);
      
      const totalPerInstallment = totalToReceive / numInstallments;
      const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);

      let nextDueDate: string | null = null;
      let installmentAmount = totalPerInstallment;
      let currentInstallment = paidInstallments + 1;

      if (installmentDates.length > 0 && paidInstallments < installmentDates.length) {
        nextDueDate = installmentDates[paidInstallments];
      } else {
        nextDueDate = loan.due_date;
        if (loan.payment_type === 'single') {
          installmentAmount = remainingBalance;
        }
      }

      if (!nextDueDate || nextDueDate !== todayStr) continue;

      const loanInfo = {
        ...loan,
        clientName: client.full_name,
        clientPhone: client.phone,
        installmentAmount,
        currentInstallment,
        totalInstallments: numInstallments,
        paidInstallments,
        totalPaid: loan.total_paid || 0,
        remainingBalance,
        totalToReceive,
      };

      if (!userLoansMap.has(loan.user_id)) {
        userLoansMap.set(loan.user_id, []);
      }
      userLoansMap.get(loan.user_id)!.push(loanInfo);
    }

    let sentCount = 0;
    const notifications: any[] = [];

    // Send individual detailed messages for each loan due today
    for (const [userId, userLoans] of userLoansMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone) {
        console.log(`User ${userId} has no phone configured, skipping`);
        continue;
      }

      for (const loan of userLoans) {
        const contractId = getContractId(loan.id);
        const progressPercent = Math.round((loan.paidInstallments / loan.totalInstallments) * 100);
        
        let message = `🏦 *Resumo do Empréstimo - ${contractId}*\n\n`;
        message += `👤 Cliente: ${loan.clientName}\n\n`;
        message += `💰 *Informações do Empréstimo:*\n`;
        message += `• Valor Emprestado: ${formatCurrency(loan.principal_amount)}\n`;
        message += `• Total a Receber: ${formatCurrency(loan.totalToReceive)}\n`;
        message += `• Taxa de Juros: ${loan.interest_rate}%\n`;
        message += `• Data Início: ${formatDate(new Date(loan.start_date))}\n`;
        message += `• Modalidade: ${loan.payment_type === 'daily' ? 'Diário' : loan.payment_type === 'weekly' ? 'Semanal' : loan.payment_type === 'installment' ? 'Parcelado' : 'Único'}\n\n`;
        
        message += `📊 *Status das Parcelas:*\n`;
        message += `✅ Pagas: ${loan.paidInstallments} de ${loan.totalInstallments} parcelas (${formatCurrency(loan.totalPaid)})\n`;
        message += `⏰ Pendentes: ${loan.totalInstallments - loan.paidInstallments} parcelas (${formatCurrency(loan.remainingBalance)})\n`;
        message += `📈 Progresso: ${progressPercent}% concluído\n\n`;
        
        message += `📅 *PARCELA DE HOJE:*\n`;
        message += `• Vencimento: ${formatDate(new Date(loan.due_date))} ⚠️\n`;
        message += `• Valor: ${formatCurrency(loan.installmentAmount)}\n\n`;
        
        message += `💰 Saldo Devedor: ${formatCurrency(loan.remainingBalance)}\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `_CobraFácil - Não deixe de cobrar!_`;

        console.log(`Sending detailed loan reminder to user ${userId} for loan ${loan.id}`);
        
        const sent = await sendWhatsApp(profile.phone, message);
        if (sent) {
          sentCount++;
          notifications.push({
            user_id: userId,
            title: `⏰ Vencimento Hoje - ${contractId}`,
            message: `${loan.clientName}: ${formatCurrency(loan.installmentAmount)}`,
            type: 'info',
            loan_id: loan.id,
            client_id: loan.client_id,
          });
        }
      }
    }

    // Create in-app notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (notifError) {
        console.error("Error creating notifications:", notifError);
      }
    }

    console.log(`Sent ${sentCount} loan reminder messages`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        checkedLoans: loans?.length || 0 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-loan-reminders:", error);
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