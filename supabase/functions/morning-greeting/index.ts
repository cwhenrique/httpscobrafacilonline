import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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

interface ProfileWithWhatsApp {
  id: string;
  phone: string;
  full_name: string | null;
  subscription_plan: string | null;
  whatsapp_instance_token: string | null;
  whatsapp_connected_phone: string | null;
}

const sendWhatsAppToSelf = async (profile: ProfileWithWhatsApp, message: string): Promise<boolean> => {
  if (!profile.whatsapp_instance_token || !profile.whatsapp_connected_phone) return false;
  const uazapiUrl = Deno.env.get("UAZAPI_URL");
  if (!uazapiUrl) return false;

  const formattedPhone = formatPhoneNumber(profile.whatsapp_connected_phone);
  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": profile.whatsapp_instance_token },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });
    console.log(`WhatsApp sent to ${formattedPhone}: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${formattedPhone}:`, error);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("morning-greeting function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let testPhone: string | null = null;
    try { const body = await req.json(); testPhone = body.testPhone || null; } catch { /* no body */ }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let profilesQuery = supabase
      .from('profiles')
      .select('id, phone, full_name, subscription_plan, whatsapp_instance_token, whatsapp_connected_phone')
      .eq('is_active', true)
      .not('phone', 'is', null)
      .not('whatsapp_instance_token', 'is', null)
      .not('whatsapp_connected_phone', 'is', null)
      .not('subscription_plan', 'eq', 'trial');

    if (testPhone) {
      let cleanTestPhone = testPhone.replace(/\D/g, '');
      if (!cleanTestPhone.startsWith('55')) cleanTestPhone = '55' + cleanTestPhone;
      profilesQuery = profilesQuery.ilike('phone', `%${cleanTestPhone.slice(-9)}%`);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;
    if (profilesError) throw profilesError;

    let sentCount = 0;

    for (const profile of (profiles || []) as ProfileWithWhatsApp[]) {
      if (!profile.phone) continue;

      const { count: loansCount } = await supabase.from('loans').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).in('status', ['pending', 'overdue']);
      const { count: vehiclesCount } = await supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).in('status', ['pending', 'overdue']);
      const { count: productsCount } = await supabase.from('product_sales').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).in('status', ['pending', 'overdue']);
      const totalContracts = (loansCount || 0) + (vehiclesCount || 0) + (productsCount || 0);

      const { data: loans } = await supabase
        .from('loans')
        .select('id, installment_dates, due_date, remaining_balance, total_paid, installments, principal_amount, interest_rate, interest_mode, payment_type, total_interest')
        .eq('user_id', profile.id)
        .in('status', ['pending', 'overdue']);

      let totalDueToday = 0;
      let totalOverdue = 0;

      for (const loan of loans || []) {
        const installmentDates = (loan.installment_dates as string[]) || [];
        const numInstallments = loan.installments || 1;
        let totalInterest = loan.total_interest || 0;
        if (totalInterest === 0) {
          if (loan.interest_mode === 'on_total') totalInterest = loan.principal_amount * (loan.interest_rate / 100);
          else if (loan.interest_mode === 'compound') totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
          else totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
        }
        const remainingBalance = loan.remaining_balance;
        const totalToReceive = remainingBalance + (loan.total_paid || 0);
        const totalPerInstallment = totalToReceive / numInstallments;
        const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);

        if (loan.payment_type === 'daily' && installmentDates.length > 0) {
          const dailyAmount = loan.total_interest || totalPerInstallment;
          for (let i = paidInstallments; i < installmentDates.length; i++) {
            const dueDate = new Date(installmentDates[i]);
            dueDate.setHours(0, 0, 0, 0);
            if (installmentDates[i] === todayStr) totalDueToday += dailyAmount;
            else if (dueDate < today) totalOverdue += dailyAmount;
          }
        } else {
          let nextDueDate = installmentDates.length > 0 && paidInstallments < installmentDates.length
            ? installmentDates[paidInstallments] : loan.due_date;
          let installmentAmount = loan.payment_type === 'single' ? remainingBalance : totalPerInstallment;
          if (!nextDueDate) continue;
          const dueDate = new Date(nextDueDate);
          dueDate.setHours(0, 0, 0, 0);
          if (nextDueDate === todayStr) totalDueToday += installmentAmount;
          else if (dueDate < today) totalOverdue += installmentAmount;
        }
      }

      if (totalDueToday === 0 && totalOverdue === 0 && totalContracts === 0) continue;

      let messageText = `☀️ *Bom dia${profile.full_name ? `, ${profile.full_name}` : ''}!*\n\n`;
      messageText += `📅 ${formatDate(today)}\n`;
      messageText += `━━━━━━━━━━━━━━━━\n\n`;
      if (totalDueToday > 0) messageText += `⏰ *Vence Hoje:* ${formatCurrency(totalDueToday)}\n`;
      if (totalOverdue > 0) messageText += `🚨 *Em Atraso:* ${formatCurrency(totalOverdue)}\n`;
      messageText += `📋 *Contratos Ativos:* ${totalContracts}\n\n`;
      const grandTotal = totalDueToday + totalOverdue;
      if (grandTotal > 0) messageText += `💰 *Total Pendente:* ${formatCurrency(grandTotal)}\n\n`;
      messageText += `━━━━━━━━━━━━━━━━\n`;
      messageText += `Relatório detalhado às 8h.\nCobraFácil - 7h`;

      const sent = await sendWhatsAppToSelf(profile, messageText);
      if (sent) sentCount++;
    }

    return new Response(
      JSON.stringify({ success: true, sentCount, usersChecked: profiles?.length || 0 }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in morning-greeting:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
