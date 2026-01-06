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

interface ProfileWithWhatsApp {
  id: string;
  phone: string;
  full_name: string | null;
  subscription_plan: string | null;
  whatsapp_instance_id: string | null;
  whatsapp_connected_phone: string | null;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
}

// Send WhatsApp message to user's own instance (self-message)
const sendWhatsAppToSelf = async (profile: ProfileWithWhatsApp, message: string): Promise<boolean> => {
  // Check if user has WhatsApp connected
  if (!profile.whatsapp_instance_id || !profile.whatsapp_connected_phone) {
    console.log(`User ${profile.id} has no WhatsApp connected, skipping`);
    return false;
  }

  // Use user's credentials or fallback to global
  const evolutionApiUrlRaw = profile.evolution_api_url || Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = profile.evolution_api_key || Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = profile.whatsapp_instance_id;

  if (!evolutionApiUrlRaw || !evolutionApiKey) {
    console.error(`Missing Evolution API configuration for user ${profile.id}`);
    return false;
  }

  console.log(`Using user's own instance: ${instanceName}`);

  const evolutionApiUrl = cleanApiUrl(evolutionApiUrlRaw);

  // Clean the connected phone number
  let cleaned = profile.whatsapp_connected_phone.replace(/\D/g, '');
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
    let testPhone: string | null = null;
    try {
      const body = await req.json();
      testPhone = body.testPhone || null;
    } catch {
      // No body or invalid JSON
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log("Generating morning greeting for:", todayStr);
    if (testPhone) {
      console.log("TEST MODE - sending only to:", testPhone);
    }

    let profilesQuery = supabase
      .from('profiles')
      .select('id, phone, full_name, subscription_plan, whatsapp_instance_id, whatsapp_connected_phone, evolution_api_url, evolution_api_key')
      .eq('is_active', true)
      .not('phone', 'is', null)
      .not('whatsapp_instance_id', 'is', null) // Only users with WhatsApp connected
      .not('whatsapp_connected_phone', 'is', null)
      .not('subscription_plan', 'eq', 'trial');
    
    console.log("Querying PAYING users with WhatsApp connected only");

    if (testPhone) {
      let cleanTestPhone = testPhone.replace(/\D/g, '');
      if (!cleanTestPhone.startsWith('55')) cleanTestPhone = '55' + cleanTestPhone;
      profilesQuery = profilesQuery.ilike('phone', `%${cleanTestPhone.slice(-9)}%`);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    let sentCount = 0;

    for (const profile of (profiles || []) as ProfileWithWhatsApp[]) {
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

        if (loan.payment_type === 'daily' && installmentDates.length > 0) {
          const dailyAmount = loan.total_interest || totalPerInstallment;
          
          for (let i = paidInstallments; i < installmentDates.length; i++) {
            const installmentDate = installmentDates[i];
            const dueDate = new Date(installmentDate);
            dueDate.setHours(0, 0, 0, 0);
            
            if (installmentDate === todayStr) {
              totalDueToday += dailyAmount;
            } else if (dueDate < today) {
              totalOverdue += dailyAmount;
            }
          }
        } else {
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

      // Build text message
      let messageText = `☀️ *Bom dia${profile.full_name ? `, ${profile.full_name}` : ''}!*\n\n`;
      messageText += `📅 ${formatDate(today)}\n`;
      messageText += `━━━━━━━━━━━━━━━━\n\n`;
      
      if (totalDueToday > 0) {
        messageText += `⏰ *Vence Hoje:* ${formatCurrency(totalDueToday)}\n`;
      }
      if (totalOverdue > 0) {
        messageText += `🚨 *Em Atraso:* ${formatCurrency(totalOverdue)}\n`;
      }
      messageText += `📋 *Contratos Ativos:* ${totalContracts}\n\n`;
      
      const grandTotal = totalDueToday + totalOverdue;
      if (grandTotal > 0) {
        messageText += `💰 *Total Pendente:* ${formatCurrency(grandTotal)}\n\n`;
      }
      
      messageText += `━━━━━━━━━━━━━━━━\n`;
      messageText += `Relatório detalhado às 8h.\n`;
      messageText += `CobraFácil - 7h`;

      console.log(`Sending morning greeting to user ${profile.id}`);
      
      const sent = await sendWhatsAppToSelf(profile, messageText);
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
