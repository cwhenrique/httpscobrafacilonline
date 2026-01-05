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
    /\/message\/sendList\/[^\/]+$/i,
    /\/message\/sendText$/i,
    /\/message\/sendList$/i,
    /\/message$/i,
  ];
  for (const pattern of pathPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned;
};

interface ListRow {
  title: string;
  description: string;
  rowId: string;
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

interface ListData {
  title: string;
  description: string;
  buttonText: string;
  footerText: string;
  sections: ListSection[];
}

const truncate = (str: string, max: number): string => 
  str.length > max ? str.substring(0, max - 3) + '...' : str;

const sendWhatsAppList = async (phone: string, listData: ListData): Promise<boolean> => {
  const evolutionApiUrlRaw = Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = "notificacao";

  if (!evolutionApiUrlRaw || !evolutionApiKey) {
    console.error("Missing Evolution API configuration");
    return false;
  }
  
  console.log("Using fixed system instance: notificacao");

  const evolutionApiUrl = cleanApiUrl(evolutionApiUrlRaw);

  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  const preparedSections = listData.sections.slice(0, 10).map(section => ({
    title: truncate(section.title, 24),
    rows: section.rows.slice(0, 10).map(row => ({
      title: truncate(row.title, 24),
      description: truncate(row.description, 72),
      rowId: row.rowId,
    })),
  }));

  try {
    const response = await fetch(
      `${evolutionApiUrl}/message/sendList/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify({
          number: cleaned,
          title: truncate(listData.title, 60),
          description: truncate(listData.description, 1024),
          buttonText: truncate(listData.buttonText, 20),
          footerText: truncate(listData.footerText, 60),
          sections: preparedSections,
        }),
      }
    );

    const data = await response.json();
    console.log(`WhatsApp LIST sent to ${cleaned}:`, data);
    
    if (!response.ok) {
      console.error("sendList failed, trying fallback text");
      const fallbackMessage = `${listData.title}\n\n${listData.description}\n\n${listData.footerText}`;
      const textResponse = await fetch(
        `${evolutionApiUrl}/message/sendText/${instanceName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionApiKey,
          },
          body: JSON.stringify({
            number: cleaned,
            text: fallbackMessage,
          }),
        }
      );
      return textResponse.ok;
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${cleaned}:`, error);
    return false;
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

    const userAlertMap: Map<string, Map<number, any[]>> = new Map();
    const overdueUpdates: string[] = [];

    for (const loan of loans || []) {
      if (loan.notes?.includes('[HISTORICAL_CONTRACT]')) {
        console.log(`Skipping historical contract ${loan.id}`);
        continue;
      }

      const client = loan.clients as { full_name: string; phone: string | null };
      
      const installmentDates = (loan.installment_dates as string[]) || [];
      const numInstallments = loan.installments || 1;
      
      let totalInterest = loan.total_interest || 0;
      if (totalInterest === 0) {
        if (loan.interest_mode === 'on_total') {
          totalInterest = loan.principal_amount * (loan.interest_rate / 100);
        } else if (loan.interest_mode === 'compound') {
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
      
      const remainingBalance = loan.remaining_balance;
      const totalToReceive = remainingBalance + (loan.total_paid || 0);
      
      const totalPerInstallment = totalToReceive / numInstallments;
      
      const partialPayments = getPartialPaymentsFromNotes(loan.notes);
      
      const installmentValue = loan.payment_type === 'daily' 
        ? (loan.total_interest || totalPerInstallment)
        : totalPerInstallment;

      let nextDueDate: string | null = null;
      let foundUnpaidOverdue = false;

      if (installmentDates.length > 0) {
        for (let i = 0; i < installmentDates.length; i++) {
          const paidAmount = partialPayments[i] || 0;
          const isPaid = paidAmount >= installmentValue * 0.99;
          
          if (!isPaid) {
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

      if (!foundUnpaidOverdue) {
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

      if (dueDate < today) {
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const isFirstOverdueDetection = loan.status !== 'overdue';
        
        if (isFirstOverdueDetection) {
          overdueUpdates.push(loan.id);
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

    for (const [userId, alertDaysMap] of userAlertMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name, is_active')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone || profile.is_active === false) {
        console.log(`User ${userId} is inactive or has no phone, skipping`);
        continue;
      }

      for (const [alertDay, overdueLoans] of alertDaysMap) {
        const emoji = getAlertEmoji(alertDay);
        const title = getAlertTitle(alertDay);

        for (const loan of overdueLoans) {
          const contractId = getContractId(loan.id);
          const progressPercent = Math.round((loan.paidInstallments / loan.totalInstallments) * 100);

          // Build interactive list message
          const sections: ListSection[] = [];

          // Loan info section
          sections.push({
            title: "💰 Valores",
            rows: [
              {
                title: "Valor Emprestado",
                description: formatCurrency(loan.principal_amount),
                rowId: "principal",
              },
              {
                title: "Total a Receber",
                description: formatCurrency(loan.totalToReceive),
                rowId: "total",
              },
              {
                title: "Taxa de Juros",
                description: `${loan.interest_rate}%`,
                rowId: "rate",
              },
            ],
          });

          // Installment status section
          sections.push({
            title: "📊 Situação",
            rows: [
              {
                title: `✅ Parcelas Pagas`,
                description: `${loan.paidInstallments}/${loan.totalInstallments} - ${formatCurrency(loan.totalPaid)}`,
                rowId: "paid",
              },
              {
                title: `❌ Pendentes`,
                description: `${loan.totalInstallments - loan.paidInstallments} - ${formatCurrency(loan.remainingBalance)}`,
                rowId: "pending",
              },
              {
                title: `📈 Progresso`,
                description: `${progressPercent}% concluído`,
                rowId: "progress",
              },
            ],
          });

          // Overdue info section
          sections.push({
            title: `${emoji} Atraso`,
            rows: [
              {
                title: "Venceu em",
                description: formatDate(new Date(loan.dueDate)),
                rowId: "due_date",
              },
              {
                title: "Dias em Atraso",
                description: `${alertDay} dia${alertDay > 1 ? 's' : ''}`,
                rowId: "days",
              },
              {
                title: "Saldo Devedor",
                description: formatCurrency(loan.remainingBalance),
                rowId: "balance",
              },
            ],
          });

          // Build rich description with overdue details
          let overdueDescription = `👤 *Cliente:* ${loan.clientName}\n`;
          overdueDescription += `📋 *Contrato:* ${contractId}\n`;
          overdueDescription += `━━━━━━━━━━━━━━━━\n\n`;
          overdueDescription += `🚨 *${alertDay} DIA${alertDay > 1 ? 'S' : ''} EM ATRASO*\n\n`;
          overdueDescription += `📅 *Venceu em:* ${formatDate(new Date(loan.dueDate))}\n`;
          overdueDescription += `💸 *Saldo Devedor:* ${formatCurrency(loan.remainingBalance)}\n\n`;
          overdueDescription += `💰 *Emprestado:* ${formatCurrency(loan.principal_amount)}\n`;
          overdueDescription += `📈 *Juros:* ${loan.interest_rate}%\n`;
          overdueDescription += `💵 *Total Contrato:* ${formatCurrency(loan.totalToReceive)}\n\n`;
          overdueDescription += `✅ *Já Pago:* ${formatCurrency(loan.totalPaid)} (${progressPercent}%)\n`;
          overdueDescription += `📊 *Parcelas:* ${loan.paidInstallments}/${loan.totalInstallments} pagas\n\n`;
          overdueDescription += `━━━━━━━━━━━━━━━━\n`;
          overdueDescription += `⚠️ AÇÃO URGENTE NECESSÁRIA`;

          const listData: ListData = {
            title: `${emoji} ${title}`,
            description: overdueDescription,
            buttonText: "📋 Ver Detalhes",
            footerText: "CobraFácil - Urgente",
            sections: sections,
          };

          console.log(`Sending ${alertDay}-day overdue LIST to user ${userId} for loan ${loan.id}`);
          
          const sent = await sendWhatsAppList(profile.phone, listData);
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
