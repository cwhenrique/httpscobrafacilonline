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

const handler = async (req: Request): Promise<Response> => {
  console.log("morning-greeting function called at", new Date().toISOString());
  
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

    console.log("Generating morning greeting for:", todayStr);

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

      // Count active contracts
      const { count: loansCount } = await supabase
        .from('loans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .in('status', ['pending', 'overdue']);

      const { count: vehiclesCount } = await supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .in('status', ['pending', 'overdue']);

      const { count: productsCount } = await supabase
        .from('product_sales')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .in('status', ['pending', 'overdue']);

      const totalContracts = (loansCount || 0) + (vehiclesCount || 0) + (productsCount || 0);

      // Get total due today
      const { data: loans } = await supabase
        .from('loans')
        .select('id, installment_dates, due_date, remaining_balance, total_paid, installments, principal_amount, interest_rate, interest_mode, payment_type, total_interest')
        .eq('user_id', profile.id)
        .in('status', ['pending', 'overdue']);

      const { data: vehiclePayments } = await supabase
        .from('vehicle_payments')
        .select('amount, due_date, vehicles!inner(user_id)')
        .eq('status', 'pending')
        .eq('due_date', todayStr);

      const { data: productPayments } = await supabase
        .from('product_sale_payments')
        .select('amount, due_date, productSale:product_sales!inner(user_id)')
        .eq('status', 'pending')
        .eq('due_date', todayStr);

      let totalDueToday = 0;
      let totalOverdue = 0;

      // Calculate loans due today and overdue
      for (const loan of loans || []) {
        const installmentDates = (loan.installment_dates as string[]) || [];
        const numInstallments = loan.installments || 1;
        
        let totalInterest = loan.total_interest || 0;
        if (totalInterest === 0) {
          if (loan.interest_mode === 'on_total') {
            totalInterest = loan.principal_amount * (loan.interest_rate / 100);
          } else if (loan.interest_mode === 'compound') {
            totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
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

        if (nextDueDate === todayStr) {
          totalDueToday += installmentAmount;
        } else if (dueDate < today) {
          totalOverdue += installmentAmount;
        }
      }

      // Add vehicle payments due today
      const userVehiclePayments = (vehiclePayments || []).filter(p => (p.vehicles as any).user_id === profile.id);
      for (const p of userVehiclePayments) {
        totalDueToday += p.amount;
      }

      // Add product payments due today  
      const userProductPayments = (productPayments || []).filter(p => (p.productSale as any).user_id === profile.id);
      for (const p of userProductPayments) {
        totalDueToday += p.amount;
      }

      // Get overdue vehicles
      const { data: overdueVehiclePayments } = await supabase
        .from('vehicle_payments')
        .select('amount, due_date, vehicles!inner(user_id)')
        .eq('status', 'pending')
        .lt('due_date', todayStr);

      const userOverdueVehicles = (overdueVehiclePayments || []).filter(p => (p.vehicles as any).user_id === profile.id);
      for (const p of userOverdueVehicles) {
        totalOverdue += p.amount;
      }

      // Get overdue products
      const { data: overdueProductPayments } = await supabase
        .from('product_sale_payments')
        .select('amount, due_date, productSale:product_sales!inner(user_id)')
        .eq('status', 'pending')
        .lt('due_date', todayStr);

      const userOverdueProducts = (overdueProductPayments || []).filter(p => (p.productSale as any).user_id === profile.id);
      for (const p of userOverdueProducts) {
        totalOverdue += p.amount;
      }

      // Skip if nothing to report
      if (totalDueToday === 0 && totalOverdue === 0 && totalContracts === 0) {
        console.log(`User ${profile.id} has no data, skipping morning greeting`);
        continue;
      }

      // Build message
      let message = `☀️ *Bom dia${profile.full_name ? `, ${profile.full_name}` : ''}!*\n\n`;
      message += `📊 *Resumo do Dia - ${formatDate(today)}*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      if (totalDueToday > 0) {
        message += `💵 Total a receber hoje: ${formatCurrency(totalDueToday)}\n`;
      }
      
      if (totalOverdue > 0) {
        message += `⚠️ Total em atraso: ${formatCurrency(totalOverdue)}\n`;
      }
      
      message += `📋 Contratos ativos: ${totalContracts}\n\n`;

      message += `⏰ _Às 8h você receberá o relatório completo de cobranças e atrasados._\n\n`;

      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `_CobraFácil - Resumo às 7h_`;

      console.log(`Sending morning greeting to user ${profile.id}`);
      
      const sent = await sendWhatsApp(profile.phone, message);
      if (sent) {
        sentCount++;
      }
    }

    console.log(`Sent ${sentCount} morning greetings`);

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
    console.error("Error in morning-greeting:", error);
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
