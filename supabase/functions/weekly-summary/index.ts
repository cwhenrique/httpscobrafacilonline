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

const getContractTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'aluguel_casa': 'Aluguel Casa',
    'aluguel_kitnet': 'Aluguel Kitnet',
    'aluguel_apartamento': 'Aluguel Apartamento',
    'aluguel_sala': 'Aluguel Sala',
    'mensalidade': 'Mensalidade',
    'servico_mensal': 'Serviço Mensal',
    'parcelado': 'Parcelado',
    'avista': 'À Vista',
  };
  return labels[type] || type;
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

    // Get all ACTIVE users with phone configured
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

      // ========== LOANS SECTION ==========
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
      }

      // Calculate loan statistics
      const totalReceivedLastWeek = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const paymentsCount = payments?.length || 0;

      // Categorize loans for this week
      const dueThisWeek: any[] = [];
      const overdueLoans: any[] = [];
      let totalDueThisWeek = 0;
      let totalOverdue = 0;
      let totalPending = 0;

      for (const loan of loans || []) {
        if (loan.status === 'paid') continue;

        const client = loan.clients as { full_name: string };
        
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
            // Juros compostos: M = P(1+i)^n - P
            totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
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

      // ========== CONTRACTS SECTION ==========
      // Fetch contract payments from last week (paid)
      const { data: contractPaymentsLastWeek, error: cpLastWeekError } = await supabase
        .from('contract_payments')
        .select(`
          *,
          contracts!inner(client_name, contract_type, bill_type)
        `)
        .eq('user_id', profile.id)
        .eq('status', 'paid')
        .gte('paid_date', lastWeekStartStr)
        .lte('paid_date', todayStr);

      if (cpLastWeekError) {
        console.error(`Error fetching contract payments for user ${profile.id}:`, cpLastWeekError);
      }

      // Fetch contract payments due this week
      const { data: contractPaymentsThisWeek, error: cpThisWeekError } = await supabase
        .from('contract_payments')
        .select(`
          *,
          contracts!inner(client_name, contract_type, bill_type)
        `)
        .eq('user_id', profile.id)
        .neq('status', 'paid')
        .gte('due_date', todayStr)
        .lte('due_date', thisWeekEndStr);

      if (cpThisWeekError) {
        console.error(`Error fetching contract payments this week for user ${profile.id}:`, cpThisWeekError);
      }

      // Fetch overdue contract payments
      const { data: overdueContractPayments, error: cpOverdueError } = await supabase
        .from('contract_payments')
        .select(`
          *,
          contracts!inner(client_name, contract_type, bill_type)
        `)
        .eq('user_id', profile.id)
        .neq('status', 'paid')
        .lt('due_date', todayStr);

      if (cpOverdueError) {
        console.error(`Error fetching overdue contract payments for user ${profile.id}:`, cpOverdueError);
      }

      // ========== BILLS SECTION ==========
      // Fetch bills paid last week
      const { data: billsLastWeek, error: billsLastWeekError } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'paid')
        .gte('paid_date', lastWeekStartStr)
        .lte('paid_date', todayStr);

      if (billsLastWeekError) {
        console.error(`Error fetching bills last week for user ${profile.id}:`, billsLastWeekError);
      }

      // Fetch bills due this week
      const { data: billsThisWeek, error: billsThisWeekError } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', profile.id)
        .neq('status', 'paid')
        .gte('due_date', todayStr)
        .lte('due_date', thisWeekEndStr);

      if (billsThisWeekError) {
        console.error(`Error fetching bills this week for user ${profile.id}:`, billsThisWeekError);
      }

      // Fetch overdue bills
      const { data: overdueBills, error: overdueBillsError } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', profile.id)
        .neq('status', 'paid')
        .lt('due_date', todayStr);

      if (overdueBillsError) {
        console.error(`Error fetching overdue bills for user ${profile.id}:`, overdueBillsError);
      }

      // Calculate contract statistics
      const receivablesLastWeek = (contractPaymentsLastWeek || []).filter(cp => 
        (cp.contracts as any).bill_type === 'receivable'
      );
      const payablesLastWeek = (contractPaymentsLastWeek || []).filter(cp => 
        (cp.contracts as any).bill_type === 'payable'
      );

      const receivablesThisWeek = (contractPaymentsThisWeek || []).filter(cp => 
        (cp.contracts as any).bill_type === 'receivable'
      );
      const payablesThisWeek = (contractPaymentsThisWeek || []).filter(cp => 
        (cp.contracts as any).bill_type === 'payable'
      );

      const overdueReceivables = (overdueContractPayments || []).filter(cp => 
        (cp.contracts as any).bill_type === 'receivable'
      );
      const overduePayables = (overdueContractPayments || []).filter(cp => 
        (cp.contracts as any).bill_type === 'payable'
      );

      const totalReceivablesLastWeek = receivablesLastWeek.reduce((sum, cp) => sum + Number(cp.amount), 0);
      const totalPayablesLastWeek = payablesLastWeek.reduce((sum, cp) => sum + Number(cp.amount), 0) + 
        (billsLastWeek || []).reduce((sum, b) => sum + Number(b.amount), 0);

      const totalReceivablesThisWeek = receivablesThisWeek.reduce((sum, cp) => sum + Number(cp.amount), 0);
      const totalPayablesThisWeek = payablesThisWeek.reduce((sum, cp) => sum + Number(cp.amount), 0) + 
        (billsThisWeek || []).reduce((sum, b) => sum + Number(b.amount), 0);

      const totalOverdueReceivables = overdueReceivables.reduce((sum, cp) => sum + Number(cp.amount), 0);
      const totalOverduePayables = overduePayables.reduce((sum, cp) => sum + Number(cp.amount), 0) + 
        (overdueBills || []).reduce((sum, b) => sum + Number(b.amount), 0);

      // Build message
      let message = `📅 *RESUMO SEMANAL*\n\nOlá${profile.full_name ? `, ${profile.full_name}` : ''}!\n\n`;
      
      // ========== EMPRÉSTIMOS ==========
      if ((loans || []).length > 0) {
        message += `💰 *EMPRÉSTIMOS*\n`;
        message += `━━━━━━━━━━━━━━━━\n`;
        message += `📊 *Semana anterior:*\n`;
        message += `• Pagamentos: *${paymentsCount}*\n`;
        message += `• Recebido: *${formatCurrency(totalReceivedLastWeek)}*\n\n`;

        message += `🔮 *Esta semana:*\n`;
        message += `• Vencimentos: *${dueThisWeek.length}*\n`;
        message += `• A receber: *${formatCurrency(totalDueThisWeek)}*\n`;

        if (overdueLoans.length > 0) {
          message += `• 🚨 Atrasados: *${overdueLoans.length}* (${formatCurrency(totalOverdue)})\n`;
        }
        message += `\n`;
      }

      // ========== CONTAS A RECEBER ==========
      if (receivablesLastWeek.length > 0 || receivablesThisWeek.length > 0 || overdueReceivables.length > 0) {
        message += `📦 *CONTAS A RECEBER*\n`;
        message += `━━━━━━━━━━━━━━━━\n`;
        message += `📊 *Semana anterior:*\n`;
        message += `• Recebido: *${receivablesLastWeek.length}* (${formatCurrency(totalReceivablesLastWeek)})\n\n`;

        message += `🔮 *Esta semana:*\n`;
        message += `• Vencimentos: *${receivablesThisWeek.length}*\n`;
        message += `• A receber: *${formatCurrency(totalReceivablesThisWeek)}*\n`;

        if (overdueReceivables.length > 0) {
          message += `• 🚨 Atrasados: *${overdueReceivables.length}* (${formatCurrency(totalOverdueReceivables)})\n`;
        }
        message += `\n`;
      }

      // ========== CONTAS A PAGAR ==========
      const totalPayablesCount = payablesLastWeek.length + (billsLastWeek || []).length;
      const totalPayablesThisWeekCount = payablesThisWeek.length + (billsThisWeek || []).length;
      const totalOverduePayablesCount = overduePayables.length + (overdueBills || []).length;

      if (totalPayablesCount > 0 || totalPayablesThisWeekCount > 0 || totalOverduePayablesCount > 0) {
        message += `💳 *CONTAS A PAGAR*\n`;
        message += `━━━━━━━━━━━━━━━━\n`;
        message += `📊 *Semana anterior:*\n`;
        message += `• Pago: *${totalPayablesCount}* (${formatCurrency(totalPayablesLastWeek)})\n\n`;

        message += `🔮 *Esta semana:*\n`;
        message += `• Vencimentos: *${totalPayablesThisWeekCount}*\n`;
        message += `• A pagar: *${formatCurrency(totalPayablesThisWeek)}*\n`;

        if (totalOverduePayablesCount > 0) {
          message += `• ⚠️ Atrasadas: *${totalOverduePayablesCount}* (${formatCurrency(totalOverduePayables)})\n`;
        }
        message += `\n`;
      }

      // ========== RESUMO GERAL ==========
      message += `📈 *RESUMO GERAL*\n`;
      message += `━━━━━━━━━━━━━━━━\n`;
      const totalToReceive = totalDueThisWeek + totalReceivablesThisWeek;
      const totalToPay = totalPayablesThisWeek;
      const balance = totalToReceive - totalToPay;

      message += `• A receber: *${formatCurrency(totalToReceive)}*\n`;
      message += `• A pagar: *${formatCurrency(totalToPay)}*\n`;
      message += `• Saldo previsto: *${formatCurrency(balance)}*\n\n`;

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
