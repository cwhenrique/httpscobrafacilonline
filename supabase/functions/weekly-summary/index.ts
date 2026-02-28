import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
};

const sendWhatsApp = async (phone: string, message: string, instanceToken: string): Promise<boolean> => {
  const uazapiUrl = Deno.env.get("UAZAPI_URL");
  if (!uazapiUrl || !instanceToken) return false;
  const formattedPhone = formatPhoneNumber(phone);
  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": instanceToken },
      body: JSON.stringify({ number: formattedPhone, text: message }),
    });
    return response.ok;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${formattedPhone}:`, error);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("weekly-summary function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
    const thisWeekEndStr = thisWeekEnd.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone, full_name, whatsapp_instance_token')
      .eq('is_active', true)
      .not('phone', 'is', null)
      .not('whatsapp_instance_token', 'is', null);

    if (profilesError) throw profilesError;

    let sentCount = 0;

    for (const profile of profiles || []) {
      if (!profile.phone || !profile.whatsapp_instance_token) continue;

      const { data: payments } = await supabase
        .from('loan_payments')
        .select('amount, payment_date')
        .eq('user_id', profile.id)
        .gte('payment_date', lastWeekStartStr)
        .lte('payment_date', todayStr);

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
          if (loan.interest_mode === 'on_total') totalInterest = loan.principal_amount * (loan.interest_rate / 100);
          else if (loan.interest_mode === 'compound') {
            const i = loan.interest_rate / 100;
            if (i > 0 && isFinite(i)) {
              const factor = Math.pow(1 + i, numInstallments);
              const pmt = loan.principal_amount * (i * factor) / (factor - 1);
              totalInterest = (pmt * numInstallments) - loan.principal_amount;
            }
          } else totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
        }
        const remainingBalance = loan.remaining_balance;
        const totalToReceive = remainingBalance + (loan.total_paid || 0);
        const totalPerInstallment = totalToReceive / numInstallments;
        const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);
        let nextDueDate = installmentDates.length > 0 && paidInstallments < installmentDates.length
          ? installmentDates[paidInstallments] : loan.due_date;
        let installmentAmount = loan.payment_type === 'single' ? remainingBalance : totalPerInstallment;
        if (!nextDueDate) continue;
        const dueDate = new Date(nextDueDate);
        dueDate.setHours(0, 0, 0, 0);
        const loanInfo = { clientName: client.full_name, amount: installmentAmount, dueDate: nextDueDate };
        if (nextDueDate >= todayStr && nextDueDate <= thisWeekEndStr) {
          dueThisWeek.push(loanInfo);
          totalDueThisWeek += installmentAmount;
        } else if (dueDate < today) {
          overdueLoans.push({ ...loanInfo, daysOverdue: Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) });
          totalOverdue += installmentAmount;
        }
      }

      let message = `📅 *RESUMO SEMANAL*\n\n`;
      message += `Olá${profile.full_name ? `, ${profile.full_name}` : ''}!\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
      message += `📊 *SEMANA PASSADA*\n`;
      message += `✅ Pagamentos: ${paymentsCount}\n`;
      message += `💵 Recebido: ${formatCurrency(totalReceivedLastWeek)}\n\n`;
      message += `🔮 *ESTA SEMANA*\n`;
      message += `📋 Vencimentos: ${dueThisWeek.length} parcela${dueThisWeek.length !== 1 ? 's' : ''}\n`;
      message += `💰 A Receber: ${formatCurrency(totalDueThisWeek)}\n`;
      if (overdueLoans.length > 0) message += `🚨 Em Atraso: ${overdueLoans.length} - ${formatCurrency(totalOverdue)}\n`;
      message += `\n`;
      if (dueThisWeek.length > 0) {
        message += `📋 *Próximos vencimentos:*\n`;
        dueThisWeek.slice(0, 3).forEach(loan => { message += `• ${loan.clientName}: ${formatCurrency(loan.amount)}\n`; });
        if (dueThisWeek.length > 3) message += `  (+${dueThisWeek.length - 3} mais)\n`;
      }
      message += `\n━━━━━━━━━━━━━━━━\nCobraFácil - Semanal`;

      const sent = await sendWhatsApp(profile.phone, message, profile.whatsapp_instance_token);
      if (sent) sentCount++;
    }

    return new Response(
      JSON.stringify({ success: true, sentCount, usersChecked: profiles?.length || 0 }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in weekly-summary:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
