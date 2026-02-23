import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
};

const sendWhatsApp = async (phone: string, message: string, instanceToken: string): Promise<boolean> => {
  const uazapiUrl = Deno.env.get("UAZAPI_URL");
  if (!uazapiUrl || !instanceToken) {
    console.error("Missing UAZAPI config or instance token");
    return false;
  }

  const formattedPhone = formatPhoneNumber(phone);
  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": instanceToken },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });
    const data = await response.json().catch(() => null);
    console.log(`WhatsApp sent to ${formattedPhone}:`, response.status);
    return response.ok;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${formattedPhone}:`, error);
    return false;
  }
};

// Send push notification
const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> => {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ userId, title, body, url }),
      }
    );
    if (response.ok) {
      console.log(`Push notification sent to user ${userId}`);
    }
  } catch (e) {
    console.error(`Failed to send push to user ${userId}:`, e);
  }
};

const getContractId = (id: string): string => {
  return `EMP-${id.substring(0, 4).toUpperCase()}`;
};

const getPartialPaymentsFromNotes = (notes: string | null): Record<number, number> => {
  const payments: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    payments[parseInt(match[1])] = parseFloat(match[2]);
  }
  return payments;
};

const getOverdueConfigFromNotes = (notes: string | null): { type: 'percentage' | 'fixed' | 'percentage_total'; value: number } | null => {
  const match = (notes || '').match(/\[OVERDUE_CONFIG:(percentage_total|percentage|fixed):([0-9.]+)\]/);
  if (!match) return null;
  return { type: match[1] as 'percentage' | 'fixed' | 'percentage_total', value: parseFloat(match[2]) };
};

const getDailyPenaltiesFromNotes = (notes: string | null): Record<number, number> => {
  const penalties: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[DAILY_PENALTY:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    penalties[parseInt(match[1])] = parseFloat(match[2]);
  }
  return penalties;
};

const getLastPenaltyDateFromNotes = (notes: string | null): string | null => {
  const match = (notes || '').match(/\[PENALTY_LAST_APPLIED:([0-9-]+)\]/);
  return match ? match[1] : null;
};

const ALERT_DAYS = [1, 7, 15, 30];

const getAlertEmoji = (daysOverdue: number): string => {
  if (daysOverdue === 1) return '⚠️';
  if (daysOverdue === 7) return '🚨';
  if (daysOverdue === 15) return '🔴';
  return '🆘';
};

const getAlertTitle = (daysOverdue: number): string => {
  if (daysOverdue === 1) return '1 dia de atraso';
  if (daysOverdue === 7) return '1 Semana de Atraso';
  if (daysOverdue === 15) return '15 Dias de Atraso';
  return '30+ Dias de Atraso';
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

    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select(`*, clients!inner(full_name, phone)`)
      .in('status', ['pending', 'overdue']);

    if (loansError) {
      console.error("Error fetching loans:", loansError);
      throw loansError;
    }

    console.log(`Found ${loans?.length || 0} loans to check`);

    const userAlertMap: Map<string, Map<number, any[]>> = new Map();
    const overdueUpdates: string[] = [];
    let penaltiesApplied = 0;

    for (const loan of loans || []) {
      if (loan.notes?.includes('[HISTORICAL_CONTRACT]')) continue;

      const client = loan.clients as { full_name: string; phone: string | null };
      const installmentDates = (loan.installment_dates as string[]) || [];
      const numInstallments = loan.installments || 1;
      
      let totalInterest = loan.total_interest || 0;
      if (totalInterest === 0) {
        if (loan.interest_mode === 'on_total') {
          totalInterest = loan.principal_amount * (loan.interest_rate / 100);
        } else if (loan.interest_mode === 'compound') {
          const i = loan.interest_rate / 100;
          if (i === 0 || !isFinite(i)) { totalInterest = 0; }
          else {
            const factor = Math.pow(1 + i, numInstallments);
            const pmt = loan.principal_amount * (i * factor) / (factor - 1);
            totalInterest = (pmt * numInstallments) - loan.principal_amount;
          }
        } else {
          totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
        }
      }
      
      const remainingBalance = loan.remaining_balance;
      const totalToReceive = remainingBalance + (loan.total_paid || 0);
      const totalPerInstallment = totalToReceive / numInstallments;
      const partialPayments = getPartialPaymentsFromNotes(loan.notes);
      const installmentValue = loan.payment_type === 'daily' 
        ? (loan.total_interest || totalPerInstallment)
        : totalPerInstallment;

      let nextDueDate: string | null = null;
      let foundUnpaidOverdue = false;
      let overdueInstallmentIndex: number | null = null;

      if (installmentDates.length > 0) {
        for (let i = 0; i < installmentDates.length; i++) {
          const paidAmount = partialPayments[i] || 0;
          const isPaid = paidAmount >= installmentValue * 0.99;
          if (!isPaid) {
            const installmentDate = new Date(installmentDates[i]);
            installmentDate.setHours(0, 0, 0, 0);
            if (installmentDate < today) {
              nextDueDate = installmentDates[i];
              overdueInstallmentIndex = i;
              foundUnpaidOverdue = true;
              break;
            }
          }
        }
      }

      if (!foundUnpaidOverdue) {
        if (loan.remaining_balance > 0) {
          const mainDueDate = new Date(loan.due_date);
          mainDueDate.setHours(0, 0, 0, 0);
          if (mainDueDate < today) {
            nextDueDate = loan.due_date;
            overdueInstallmentIndex = 0;
          }
        }
      }

      if (!nextDueDate) continue;

      const dueDate = new Date(nextDueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const isFirstOverdueDetection = loan.status !== 'overdue';
        if (isFirstOverdueDetection) overdueUpdates.push(loan.id);

        // Apply daily penalty
        const overdueConfig = getOverdueConfigFromNotes(loan.notes);
        if (overdueConfig && overdueInstallmentIndex !== null) {
          const lastPenaltyDate = getLastPenaltyDateFromNotes(loan.notes);
          const existingPenalties = getDailyPenaltiesFromNotes(loan.notes);
          if (lastPenaltyDate !== todayStr) {
            let daysToApply = !lastPenaltyDate ? daysOverdue : 1;
            let dailyPenalty = overdueConfig.type === 'percentage'
              ? totalToReceive * (overdueConfig.value / 100)
              : overdueConfig.type === 'percentage_total'
                ? totalToReceive * (overdueConfig.value / 100) / 30
                : overdueConfig.value;
            const penaltyToAdd = dailyPenalty * daysToApply;
            const currentPenalty = existingPenalties[overdueInstallmentIndex] || 0;
            const newTotalPenalty = currentPenalty + penaltyToAdd;
            let updatedNotes = loan.notes || '';
            updatedNotes = updatedNotes.replace(new RegExp(`\\[DAILY_PENALTY:${overdueInstallmentIndex}:[0-9.]+\\]`, 'g'), '');
            updatedNotes = updatedNotes.replace(/\[PENALTY_LAST_APPLIED:[0-9-]+\]/g, '');
            updatedNotes = `[DAILY_PENALTY:${overdueInstallmentIndex}:${newTotalPenalty.toFixed(2)}] [PENALTY_LAST_APPLIED:${todayStr}] ${updatedNotes}`.trim();
            const newBalance = loan.remaining_balance + penaltyToAdd;
            const { error: updateError } = await supabase
              .from('loans')
              .update({ notes: updatedNotes, remaining_balance: newBalance })
              .eq('id', loan.id);
            if (!updateError) {
              console.log(`Applied penalty of ${formatCurrency(penaltyToAdd)} to loan ${loan.id}`);
              penaltiesApplied++;
            }
          }
        }

        if (!isFirstOverdueDetection && !ALERT_DAYS.includes(daysOverdue)) continue;

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

        if (!userAlertMap.has(loan.user_id)) userAlertMap.set(loan.user_id, new Map());
        const userAlerts = userAlertMap.get(loan.user_id)!;
        if (!userAlerts.has(daysOverdue)) userAlerts.set(daysOverdue, []);
        userAlerts.get(daysOverdue)!.push(loanInfo);
      }
    }

    // Update overdue statuses
    if (overdueUpdates.length > 0) {
      await supabase.from('loans').update({ status: 'overdue' }).in('id', overdueUpdates);
      console.log(`Updated ${overdueUpdates.length} loans to overdue status`);
    }

    let sentCount = 0;

    for (const [userId, alertDaysMap] of userAlertMap) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, full_name, is_active, whatsapp_instance_token')
        .eq('id', userId)
        .single();

      if (!profile?.phone || profile.is_active === false || !profile.whatsapp_instance_token) {
        console.log(`User ${userId} skipped (inactive/no phone/no token)`);
        continue;
      }

      for (const [alertDay, overdueLoans] of alertDaysMap) {
        const emoji = getAlertEmoji(alertDay);
        const title = getAlertTitle(alertDay);

        for (const loan of overdueLoans) {
          const contractId = getContractId(loan.id);
          const progressPercent = Math.round((loan.paidInstallments / loan.totalInstallments) * 100);

          const existingPenalties = getDailyPenaltiesFromNotes(loan.notes);
          const totalPenalty = Object.values(existingPenalties).reduce((sum, v) => sum + v, 0);
          const overdueConfig = getOverdueConfigFromNotes(loan.notes);
          const originalBalance = loan.remainingBalance - totalPenalty;

          let message = `${emoji} *${title.toUpperCase()}*\n\n`;
          message += `👤 *Cliente:* ${loan.clientName}\n`;
          message += `📋 *Contrato:* ${contractId}\n`;
          message += `━━━━━━━━━━━━━━━━\n\n`;
          message += `📅 *Venceu em:* ${formatDate(new Date(loan.dueDate))}\n`;
          message += `💸 *Saldo Original:* ${formatCurrency(originalBalance)}\n`;
          if (totalPenalty > 0) message += `⚠️ *Multa Aplicada:* +${formatCurrency(totalPenalty)}\n`;
          if (overdueConfig) {
            const taxaInfo = overdueConfig.type === 'percentage' 
              ? `${overdueConfig.value}% ao dia`
              : `${formatCurrency(overdueConfig.value)}/dia`;
            message += `📈 *Taxa por Atraso:* ${taxaInfo}\n`;
          }
          message += `💵 *TOTAL A RECEBER:* ${formatCurrency(loan.remainingBalance)}\n\n`;
          message += `💰 *Emprestado:* ${formatCurrency(loan.principal_amount)}\n`;
          message += `📈 *Juros:* ${loan.interest_rate}%\n`;
          message += `💵 *Total Contrato:* ${formatCurrency(loan.totalToReceive)}\n\n`;
          message += `✅ *Já Pago:* ${formatCurrency(loan.totalPaid)} (${progressPercent}%)\n`;
          message += `📊 *Parcelas:* ${loan.paidInstallments}/${loan.totalInstallments} pagas\n\n`;
          message += `━━━━━━━━━━━━━━━━\n`;
          message += `⚠️ AÇÃO URGENTE NECESSÁRIA`;

          const sent = await sendWhatsApp(profile.phone, message, profile.whatsapp_instance_token);
          if (sent) {
            sentCount++;
            await sendPushNotification(
              userId,
              `🚨 ${alertDay} dia${alertDay > 1 ? 's' : ''} em atraso - ${loan.clientName}`,
              `Saldo devedor: ${formatCurrency(loan.remainingBalance)}`,
              '/loans'
            );
          }
        }
      }
    }

    console.log(`Sent ${sentCount} overdue alerts, applied ${penaltiesApplied} penalties`);

    return new Response(
      JSON.stringify({ success: true, sentCount, overdueLoans: overdueUpdates.length, penaltiesApplied, checkedLoans: loans?.length || 0 }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-overdue-loans:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
