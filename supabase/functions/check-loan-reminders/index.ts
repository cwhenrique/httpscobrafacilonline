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
      body: JSON.stringify({ phone: formattedPhone, message }),
    });
    console.log(`WhatsApp sent to ${formattedPhone}: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${formattedPhone}:`, error);
    return false;
  }
};

const getContractId = (id: string): string => `EMP-${id.substring(0, 4).toUpperCase()}`;

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
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select(`*, clients!inner(full_name, phone)`)
      .eq('status', 'pending');

    if (loansError) throw loansError;

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
          if (i === 0 || !isFinite(i)) totalInterest = 0;
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
      const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);

      let nextDueDate: string | null = null;
      let installmentAmount = totalPerInstallment;
      let currentInstallment = paidInstallments + 1;

      if (installmentDates.length > 0 && paidInstallments < installmentDates.length) {
        nextDueDate = installmentDates[paidInstallments];
      } else {
        nextDueDate = loan.due_date;
        if (loan.payment_type === 'single') installmentAmount = remainingBalance;
      }

      if (!nextDueDate || nextDueDate !== todayStr) continue;

      const loanInfo = {
        ...loan,
        clientName: client.full_name,
        installmentAmount,
        currentInstallment,
        totalInstallments: numInstallments,
        paidInstallments,
        totalPaid: loan.total_paid || 0,
        remainingBalance,
        totalToReceive,
      };

      if (!userLoansMap.has(loan.user_id)) userLoansMap.set(loan.user_id, []);
      userLoansMap.get(loan.user_id)!.push(loanInfo);
    }

    let sentCount = 0;

    for (const [userId, userLoans] of userLoansMap) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, full_name, is_active, whatsapp_instance_token')
        .eq('id', userId)
        .single();

      if (!profile?.phone || profile.is_active === false || !profile.whatsapp_instance_token) continue;

      for (const loan of userLoans) {
        const contractId = getContractId(loan.id);
        const progressPercent = Math.round((loan.paidInstallments / loan.totalInstallments) * 100);

        let message = `⏰ *VENCIMENTO HOJE - ${contractId}*\n\n`;
        message += `👤 *Cliente:* ${loan.clientName}\n`;
        message += `━━━━━━━━━━━━━━━━\n\n`;
        message += `📋 *Tipo:* ${getPaymentTypeLabel(loan.payment_type)}\n`;
        message += `💵 *Valor da Parcela:* ${formatCurrency(loan.installmentAmount)}\n`;
        message += `📊 *Parcela:* ${loan.currentInstallment}/${loan.totalInstallments}\n\n`;
        message += `💰 *Emprestado:* ${formatCurrency(loan.principal_amount)}\n`;
        message += `📈 *Juros:* ${loan.interest_rate}%\n`;
        message += `💵 *Total Contrato:* ${formatCurrency(loan.totalToReceive)}\n\n`;
        message += `✅ *Já Pago:* ${formatCurrency(loan.totalPaid)} (${progressPercent}%)\n`;
        message += `📊 *Saldo Devedor:* ${formatCurrency(loan.remainingBalance)}\n\n`;
        message += `━━━━━━━━━━━━━━━━\n`;
        message += `CobraFácil`;

        const sent = await sendWhatsApp(profile.phone, message, profile.whatsapp_instance_token);
        if (sent) sentCount++;
      }
    }

    console.log(`Sent ${sentCount} loan reminder messages`);
    return new Response(
      JSON.stringify({ success: true, sentCount, checkedLoans: loans?.length || 0 }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-loan-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
