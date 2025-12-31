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
  // Usar instância fixa "VendaApp" para notificações do sistema
  const instanceName = "VendaApp";

  if (!evolutionApiUrlRaw || !evolutionApiKey) {
    console.error("Missing Evolution API configuration");
    return false;
  }
  
  console.log("Using fixed system instance: VendaApp");

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

// Helper para extrair pagamentos parciais do notes do loan
const getPartialPaymentsFromNotes = (notes: string | null): Record<number, number> => {
  const payments: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    payments[parseInt(match[1])] = parseFloat(match[2]);
  }
  return payments;
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
      // Skip historical contracts - they should not trigger overdue alerts
      if (loan.notes?.includes('[HISTORICAL_CONTRACT]')) {
        console.log(`Skipping historical contract ${loan.id} - marked as old contract`);
        continue;
      }

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
        } else if (loan.interest_mode === 'compound') {
          // Usar fórmula PMT de amortização (Sistema Price)
          const i = loan.interest_rate / 100;
          if (i === 0 || !isFinite(i)) {
            totalInterest = 0;
          } else {
            const factor = Math.pow(1 + i, numInstallments);
            const pmt = loan.principal_amount * (i * factor) / (factor - 1);
            totalInterest = (pmt * numInstallments) - loan.principal_amount;
          }
        } else {
          totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
        }
      }
      
      // remaining_balance from DB is the source of truth
      const remainingBalance = loan.remaining_balance;
      const totalToReceive = remainingBalance + (loan.total_paid || 0);
      
      const totalPerInstallment = totalToReceive / numInstallments;
      
      // Ler tags PARTIAL_PAID das notas para saber quais parcelas específicas foram pagas
      const partialPayments = getPartialPaymentsFromNotes(loan.notes);
      
      // Para diários, total_interest armazena o valor da parcela diária
      const installmentValue = loan.payment_type === 'daily' 
        ? (loan.total_interest || totalPerInstallment)
        : totalPerInstallment;

      // Encontrar a primeira parcela NÃO PAGA que está atrasada
      let nextDueDate: string | null = null;
      let foundUnpaidOverdue = false;

      if (installmentDates.length > 0) {
        for (let i = 0; i < installmentDates.length; i++) {
          const paidAmount = partialPayments[i] || 0;
          const isPaid = paidAmount >= installmentValue * 0.99;
          
          if (!isPaid) {
            // Encontrou parcela não paga, verificar se está atrasada
            const installmentDate = new Date(installmentDates[i]);
            installmentDate.setHours(0, 0, 0, 0);
            
            if (installmentDate < today) {
              nextDueDate = installmentDates[i];
              foundUnpaidOverdue = true;
              break;
            }
          }
        }
      }

      // Se não encontrou parcela atrasada no array, verificar due_date geral
      if (!foundUnpaidOverdue) {
        // Verificar se remaining_balance > 0 e due_date passou
        if (loan.remaining_balance > 0) {
          const mainDueDate = new Date(loan.due_date);
          mainDueDate.setHours(0, 0, 0, 0);
          if (mainDueDate < today) {
            nextDueDate = loan.due_date;
          }
        }
      }

      if (!nextDueDate) continue;

      const dueDate = new Date(nextDueDate);
      dueDate.setHours(0, 0, 0, 0);

      // Check if overdue
      if (dueDate < today) {
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if this is the first time detecting overdue (status still pending)
        const isFirstOverdueDetection = loan.status !== 'overdue';
        
        // Update loan status to overdue
        if (isFirstOverdueDetection) {
          overdueUpdates.push(loan.id);
        }

        // Send alerts on first overdue detection OR on specific days (1, 7, 15, 30)
        if (!isFirstOverdueDetection && !ALERT_DAYS.includes(daysOverdue)) continue;

        // Calcular quantas parcelas foram pagas baseado nas tags PARTIAL_PAID
        const paidInstallmentsCount = Object.keys(partialPayments).filter(k => {
          const idx = parseInt(k);
          return partialPayments[idx] >= installmentValue * 0.99;
        }).length;

        const loanInfo = {
          ...loan,
          clientName: client.full_name,
          clientPhone: client.phone,
          paidInstallments: paidInstallmentsCount,
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
        .select('phone, full_name, is_active')
        .eq('id', userId)
        .single();

      // Skip inactive users
      if (profileError || !profile?.phone || profile.is_active === false) {
        console.log(`User ${userId} is inactive or has no phone, skipping`);
        continue;
      }

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