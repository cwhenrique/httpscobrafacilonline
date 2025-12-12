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

// Progressive alert days - only send on these specific days
const ALERT_DAYS = [1, 7, 15, 30];

const getAlertEmoji = (daysOverdue: number): string => {
  if (daysOverdue === 1) return '⚠️';
  if (daysOverdue === 7) return '🚨';
  if (daysOverdue === 15) return '🔴';
  return '🆘';
};

const getAlertTitle = (daysOverdue: number): string => {
  if (daysOverdue === 1) return 'Atenção: 1 dia de atraso';
  if (daysOverdue === 7) return 'Alerta: 1 Semana de Atraso';
  if (daysOverdue === 15) return 'Urgente: 15 Dias de Atraso';
  return 'CRÍTICO: 30+ Dias de Atraso';
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
      
      const installmentDates = (loan.installment_dates as string[]) || [];
      const numInstallments = loan.installments || 1;
      
      // Calculate interest based on mode
      let totalInterest = 0;
      if (loan.interest_mode === 'on_total') {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100);
      } else {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
      }
      
      const interestPerInstallment = totalInterest / numInstallments;
      const principalPerInstallment = loan.principal_amount / numInstallments;
      const totalPerInstallment = principalPerInstallment + interestPerInstallment;
      const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);

      let nextDueDate: string | null = null;

      if (installmentDates.length > 0 && paidInstallments < installmentDates.length) {
        nextDueDate = installmentDates[paidInstallments];
      } else {
        nextDueDate = loan.due_date;
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

        const totalToReceive = loan.principal_amount + totalInterest;
        const remainingBalance = totalToReceive - (loan.total_paid || 0);

        const loanInfo = {
          ...loan,
          clientName: client.full_name,
          clientPhone: client.phone,
          paidInstallments,
          totalInstallments: numInstallments,
          totalPaid: loan.total_paid || 0,
          remainingBalance,
          totalToReceive,
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
        const emoji = getAlertEmoji(alertDay);
        const title = getAlertTitle(alertDay);

        for (const loan of overdueLoans) {
          const contractId = getContractId(loan.id);
          const progressPercent = Math.round((loan.paidInstallments / loan.totalInstallments) * 100);

          let message = `${emoji} *${title}*\n\n`;
          message += `🏦 *Empréstimo - ${contractId}*\n\n`;
          message += `👤 Cliente: ${loan.clientName}\n\n`;
          message += `💰 *Informações do Empréstimo:*\n`;
          message += `• Valor Emprestado: ${formatCurrency(loan.principal_amount)}\n`;
          message += `• Total a Receber: ${formatCurrency(loan.totalToReceive)}\n`;
          message += `• Taxa de Juros: ${loan.interest_rate}%\n\n`;
          
          message += `📊 *Status das Parcelas:*\n`;
          message += `✅ Pagas: ${loan.paidInstallments} de ${loan.totalInstallments} (${formatCurrency(loan.totalPaid)})\n`;
          message += `❌ Pendentes: ${loan.totalInstallments - loan.paidInstallments} (${formatCurrency(loan.remainingBalance)})\n`;
          message += `📈 Progresso: ${progressPercent}% concluído\n\n`;
          
          message += `⚠️ *PARCELA EM ATRASO:*\n`;
          message += `• Venceu em: ${formatDate(new Date(loan.dueDate))}\n`;
          message += `• Dias de atraso: *${alertDay}*\n\n`;
          
          message += `💰 Saldo Devedor: ${formatCurrency(loan.remainingBalance)}\n\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━\n`;
          message += `_CobraFácil - Entre em contato urgente!_`;

          console.log(`Sending ${alertDay}-day overdue alert to user ${userId} for loan ${loan.id}`);
          
          const sent = await sendWhatsApp(profile.phone, message);
          if (sent) {
            sentCount++;
            notifications.push({
              user_id: userId,
              title: `${emoji} Atraso ${alertDay}d - ${contractId}`,
              message: `${loan.clientName}: ${formatCurrency(loan.remainingBalance)}`,
              type: 'warning',
              loan_id: loan.id,
              client_id: loan.client_id,
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