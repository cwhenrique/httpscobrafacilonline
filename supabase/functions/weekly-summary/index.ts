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

    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];

    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
    const thisWeekEndStr = thisWeekEnd.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    console.log("Generating weekly summary for:", todayStr);

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone, full_name')
      .eq('is_active', true)
      .not('phone', 'is', null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    let sentCount = 0;

    for (const profile of profiles || []) {
      if (!profile.phone) continue;

      // Fetch payments from last week
      const { data: payments } = await supabase
        .from('loan_payments')
        .select('amount, payment_date')
        .eq('user_id', profile.id)
        .gte('payment_date', lastWeekStartStr)
        .lte('payment_date', todayStr);

      // Fetch all loans for this user
      const { data: loans } = await supabase
        .from('loans')
        .select(`*, clients!inner(full_name)`)
        .eq('user_id', profile.id);

      const totalReceivedLastWeek = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const paymentsCount = payments?.length || 0;

      const dueThisWeek: any[] = [];
      const overdueLoans: any[] = [];
      let totalDueThisWeek = 0;
      let totalOverdue = 0;

      for (const loan of loans || []) {
        if (loan.status === 'paid') continue;

        const client = loan.clients as { full_name: string };
        
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

        if (installmentDates.length > 0 && paidInstallments < installmentDates.length) {
          nextDueDate = installmentDates[paidInstallments];
        } else {
          nextDueDate = loan.due_date;
          if (loan.payment_type === 'single') {
            installmentAmount = remainingBalance;
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
      }

      // Build list sections
      const sections: ListSection[] = [];

      // Last week section
      sections.push({
        title: "📊 Semana Passada",
        rows: [
          {
            title: "Pagamentos",
            description: `${paymentsCount} recebido${paymentsCount !== 1 ? 's' : ''}`,
            rowId: "payments_count",
          },
          {
            title: "Total Recebido",
            description: formatCurrency(totalReceivedLastWeek),
            rowId: "received",
          },
        ],
      });

      // This week section
      const thisWeekRows: ListRow[] = [
        {
          title: "Vencimentos",
          description: `${dueThisWeek.length} parcela${dueThisWeek.length !== 1 ? 's' : ''}`,
          rowId: "due_count",
        },
        {
          title: "A Receber",
          description: formatCurrency(totalDueThisWeek),
          rowId: "to_receive",
        },
      ];

      if (overdueLoans.length > 0) {
        thisWeekRows.push({
          title: "🚨 Em Atraso",
          description: `${overdueLoans.length} - ${formatCurrency(totalOverdue)}`,
          rowId: "overdue",
        });
      }

      sections.push({
        title: "🔮 Esta Semana",
        rows: thisWeekRows,
      });

      // Summary section
      const balance = totalDueThisWeek - 0; // No payables in this simplified version
      sections.push({
        title: "📈 Resumo",
        rows: [
          {
            title: "A Receber",
            description: formatCurrency(totalDueThisWeek),
            rowId: "total_receive",
          },
          {
            title: "Saldo Previsto",
            description: formatCurrency(balance),
            rowId: "balance",
          },
        ],
      });

      // Build rich weekly summary description
      let weeklyDescription = `Olá${profile.full_name ? `, ${profile.full_name}` : ''}!\n`;
      weeklyDescription += `━━━━━━━━━━━━━━━━\n\n`;
      weeklyDescription += `📊 *SEMANA PASSADA*\n`;
      weeklyDescription += `✅ Pagamentos: ${paymentsCount}\n`;
      weeklyDescription += `💵 Recebido: ${formatCurrency(totalReceivedLastWeek)}\n\n`;
      weeklyDescription += `🔮 *ESTA SEMANA*\n`;
      weeklyDescription += `📋 Vencimentos: ${dueThisWeek.length} parcela${dueThisWeek.length !== 1 ? 's' : ''}\n`;
      weeklyDescription += `💰 A Receber: ${formatCurrency(totalDueThisWeek)}\n`;
      if (overdueLoans.length > 0) {
        weeklyDescription += `🚨 Em Atraso: ${overdueLoans.length} - ${formatCurrency(totalOverdue)}\n`;
      }
      weeklyDescription += `\n`;
      // Top 3 due this week
      if (dueThisWeek.length > 0) {
        weeklyDescription += `📋 *Próximos vencimentos:*\n`;
        dueThisWeek.slice(0, 3).forEach(loan => {
          weeklyDescription += `• ${loan.clientName}: ${formatCurrency(loan.amount)}\n`;
        });
        if (dueThisWeek.length > 3) {
          weeklyDescription += `  (+${dueThisWeek.length - 3} mais)\n`;
        }
      }
      weeklyDescription += `\n━━━━━━━━━━━━━━━━\n`;
      weeklyDescription += `Clique para ver detalhes.`;

      const listData: ListData = {
        title: `📅 Resumo Semanal`,
        description: weeklyDescription,
        buttonText: "📋 Ver Detalhes",
        footerText: "CobraFácil - Semanal",
        sections: sections,
      };

      console.log(`Sending weekly summary LIST to user ${profile.id}`);
      
      const sent = await sendWhatsAppList(profile.phone, listData);
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
