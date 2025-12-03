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

// Progressive alert days - only send on these specific days
const ALERT_DAYS = [1, 7, 15, 30];

const getAlertMessage = (daysOverdue: number, loansCount: number, loansList: string, totalAmount: number, userName: string): string => {
  const greeting = userName ? ` ${userName}` : '';
  const plural = loansCount > 1;
  
  if (daysOverdue === 1) {
    return `⚠️ *Atenção: Atraso de 1 dia*\n\nOlá${greeting}!\n\nVocê tem *${loansCount} cobrança${plural ? 's' : ''}* com *1 dia de atraso*:\n\n${loansList}\n\n💰 *Total pendente: ${formatCurrency(totalAmount)}*\n\nEntre em contato com seu${plural ? 's' : ''} cliente${plural ? 's' : ''} o quanto antes!\n\n_CobraFácil - Alerta automático_`;
  } else if (daysOverdue === 7) {
    return `🚨 *Alerta: 1 Semana de Atraso*\n\nOlá${greeting}!\n\nVocê tem *${loansCount} cobrança${plural ? 's' : ''}* com *7 dias de atraso*:\n\n${loansList}\n\n💰 *Total pendente: ${formatCurrency(totalAmount)}*\n\nÉ importante cobrar esses valores!\n\n_CobraFácil - Alerta automático_`;
  } else if (daysOverdue === 15) {
    return `🔴 *Urgente: 15 Dias de Atraso*\n\nOlá${greeting}!\n\nVocê tem *${loansCount} cobrança${plural ? 's' : ''}* com *15 dias de atraso*:\n\n${loansList}\n\n💰 *Total pendente: ${formatCurrency(totalAmount)}*\n\nConsidere tomar medidas mais firmes!\n\n_CobraFácil - Alerta automático_`;
  } else if (daysOverdue === 30) {
    return `🆘 *CRÍTICO: 30 Dias de Atraso*\n\nOlá${greeting}!\n\nVocê tem *${loansCount} cobrança${plural ? 's' : ''}* com *30 dias de atraso*:\n\n${loansList}\n\n💰 *Total pendente: ${formatCurrency(totalAmount)}*\n\nRecomendamos renegociar ou tomar medidas legais!\n\n_CobraFácil - Alerta automático_`;
  }
  return '';
};

const handler = async (req: Request): Promise<Response> => {
  console.log("check-overdue-loans function called at", new Date().toISOString());
  
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

    console.log("Checking for overdue loans as of:", todayStr);

    // Fetch all pending/overdue loans with client data
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select(`
        *,
        clients!inner(full_name, phone)
      `)
      .in('status', ['pending', 'overdue']);

    if (loansError) {
      console.error("Error fetching loans:", loansError);
      throw loansError;
    }

    console.log(`Found ${loans?.length || 0} loans to check`);

    // Group overdue loans by user AND by alert day
    const userAlertMap: Map<string, Map<number, any[]>> = new Map();
    const overdueUpdates: string[] = [];

    for (const loan of loans || []) {
      const client = loan.clients as { full_name: string; phone: string | null };
      
      // Calculate next due date
      const installmentDates = (loan.installment_dates as string[]) || [];
      const numInstallments = loan.installments || 1;
      const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
      const principalPerInstallment = loan.principal_amount / numInstallments;
      const totalPerInstallment = principalPerInstallment + interestPerInstallment;
      const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);

      let nextDueDate: string | null = null;
      let remainingAmount = 0;

      if (installmentDates.length > 0 && paidInstallments < installmentDates.length) {
        nextDueDate = installmentDates[paidInstallments];
        remainingAmount = totalPerInstallment * (numInstallments - paidInstallments);
      } else {
        nextDueDate = loan.due_date;
        remainingAmount = loan.remaining_balance + (loan.principal_amount * (loan.interest_rate / 100)) - (loan.total_paid || 0);
      }

      if (!nextDueDate) continue;

      const dueDate = new Date(nextDueDate);
      dueDate.setHours(0, 0, 0, 0);

      // Check if overdue
      if (dueDate < today) {
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Update loan status to overdue
        if (loan.status !== 'overdue') {
          overdueUpdates.push(loan.id);
        }

        // Only send alert on specific days (1, 7, 15, 30)
        if (!ALERT_DAYS.includes(daysOverdue)) continue;

        const loanInfo = {
          ...loan,
          clientName: client.full_name,
          clientPhone: client.phone,
          remainingAmount: remainingAmount > 0 ? remainingAmount : totalPerInstallment,
          dueDate: nextDueDate,
          daysOverdue,
        };

        if (!userAlertMap.has(loan.user_id)) {
          userAlertMap.set(loan.user_id, new Map());
        }
        
        const userAlerts = userAlertMap.get(loan.user_id)!;
        if (!userAlerts.has(daysOverdue)) {
          userAlerts.set(daysOverdue, []);
        }
        userAlerts.get(daysOverdue)!.push(loanInfo);
      }
    }

    // Update overdue loan statuses
    if (overdueUpdates.length > 0) {
      const { error: updateError } = await supabase
        .from('loans')
        .update({ status: 'overdue' })
        .in('id', overdueUpdates);
      
      if (updateError) {
        console.error("Error updating overdue statuses:", updateError);
      } else {
        console.log(`Updated ${overdueUpdates.length} loans to overdue status`);
      }
    }

    let sentCount = 0;
    const notifications: any[] = [];

    // Send alerts for each user and each alert day
    for (const [userId, alertDaysMap] of userAlertMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone) {
        console.log(`User ${userId} has no phone configured, skipping`);
        continue;
      }

      for (const [alertDay, overdueLoans] of alertDaysMap) {
        const loansList = overdueLoans.slice(0, 10).map(l => 
          `• *${l.clientName}*: ${formatCurrency(l.remainingAmount)}`
        ).join('\n');

        const totalAmount = overdueLoans.reduce((sum, l) => sum + l.remainingAmount, 0);
        const moreLoans = overdueLoans.length > 10 ? `\n_... e mais ${overdueLoans.length - 10} empréstimo(s)_` : '';

        const message = getAlertMessage(alertDay, overdueLoans.length, loansList + moreLoans, totalAmount, profile.full_name || '');

        if (message) {
          console.log(`Sending ${alertDay}-day overdue alert to user ${userId} (${overdueLoans.length} loans)`);
          
          const sent = await sendWhatsApp(profile.phone, message);
          if (sent) {
            sentCount++;
            notifications.push({
              user_id: userId,
              title: `🚨 Atraso de ${alertDay} dia${alertDay > 1 ? 's' : ''}`,
              message: `${overdueLoans.length} empréstimo(s) - Total: ${formatCurrency(totalAmount)}`,
              type: 'warning',
            });
          }
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

    console.log(`Sent ${sentCount} overdue alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        overdueLoans: overdueUpdates.length,
        checkedLoans: loans?.length || 0 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-overdue-loans:", error);
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
