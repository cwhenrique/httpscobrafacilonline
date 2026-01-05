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
  const instanceName = "notficacao";

  if (!evolutionApiUrlRaw || !evolutionApiKey) {
    console.error("Missing Evolution API configuration");
    return false;
  }
  
  console.log("Using fixed system instance: notficacao");

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

const getPaymentTypeLabel = (type: string): string => {
  switch (type) {
    case 'daily': return 'Diário';
    case 'weekly': return 'Semanal';
    case 'biweekly': return 'Quinzenal';
    case 'installment': return 'Parcelado';
    case 'single': return 'Único';
    default: return type;
  }
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

    console.log("Checking loans due today:", todayStr);

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

    const userLoansMap: Map<string, any[]> = new Map();

    for (const loan of loans || []) {
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

    for (const [userId, userLoans] of userLoansMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name, is_active')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone || profile.is_active === false) {
        console.log(`User ${userId} is inactive or has no phone, skipping`);
        continue;
      }

      for (const loan of userLoans) {
        const contractId = getContractId(loan.id);
        const progressPercent = Math.round((loan.paidInstallments / loan.totalInstallments) * 100);
        
        // Build interactive list message
        const sections: ListSection[] = [];

        // Loan details section
        sections.push({
          title: "💰 Valores",
          rows: [
            {
              title: "Emprestado",
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
          title: "📊 Parcelas",
          rows: [
            {
              title: `✅ Pagas`,
              description: `${loan.paidInstallments}/${loan.totalInstallments} - ${formatCurrency(loan.totalPaid)}`,
              rowId: "paid",
            },
            {
              title: `⏰ Pendentes`,
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

        // Today's installment section
        sections.push({
          title: "📅 Vence Hoje",
          rows: [
            {
              title: `Parcela ${loan.currentInstallment}`,
              description: formatCurrency(loan.installmentAmount),
              rowId: "today",
            },
            {
              title: `Saldo Devedor`,
              description: formatCurrency(loan.remainingBalance),
              rowId: "balance",
            },
          ],
        });

        // Build rich description with all loan details
        let loanDescription = `👤 *Cliente:* ${loan.clientName}\n`;
        loanDescription += `━━━━━━━━━━━━━━━━\n\n`;
        loanDescription += `📋 *Tipo:* ${getPaymentTypeLabel(loan.payment_type)}\n`;
        loanDescription += `💵 *Valor da Parcela:* ${formatCurrency(loan.installmentAmount)}\n`;
        loanDescription += `📊 *Parcela:* ${loan.currentInstallment}/${loan.totalInstallments}\n\n`;
        loanDescription += `💰 *Emprestado:* ${formatCurrency(loan.principal_amount)}\n`;
        loanDescription += `📈 *Juros:* ${loan.interest_rate}%\n`;
        loanDescription += `💵 *Total Contrato:* ${formatCurrency(loan.totalToReceive)}\n\n`;
        loanDescription += `✅ *Já Pago:* ${formatCurrency(loan.totalPaid)} (${progressPercent}%)\n`;
        loanDescription += `📊 *Saldo Devedor:* ${formatCurrency(loan.remainingBalance)}\n\n`;
        loanDescription += `━━━━━━━━━━━━━━━━\n`;
        loanDescription += `Clique para ver mais detalhes.`;

        const listData: ListData = {
          title: `⏰ Vencimento Hoje - ${contractId}`,
          description: loanDescription,
          buttonText: "📋 Ver Detalhes",
          footerText: "CobraFácil",
          sections: sections,
        };

        console.log(`Sending loan reminder LIST to user ${userId} for loan ${loan.id}`);
        
        const sent = await sendWhatsAppList(profile.phone, listData);
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
