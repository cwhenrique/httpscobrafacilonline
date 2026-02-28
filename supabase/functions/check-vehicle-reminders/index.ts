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

const sendWhatsApp = async (phone: string, message: string, instanceToken: string): Promise<boolean> => {
  const uazapiUrl = Deno.env.get("UAZAPI_URL");
  if (!uazapiUrl || !instanceToken) {
    console.error("Missing UAZAPI URL or instance token");
    return false;
  }

  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": instanceToken },
      body: JSON.stringify({ number: cleaned, text: message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send WhatsApp to ${cleaned}: ${errorText}`);
      return false;
    }

    console.log(`WhatsApp sent to ${cleaned} via UAZAPI`);
    return true;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${cleaned}:`, error);
    return false;
  }
};

const getContractId = (id: string): string => {
  return `VEI-${id.substring(0, 4).toUpperCase()}`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("check-vehicle-reminders function called at", new Date().toISOString());
  
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

    console.log("Checking vehicle payments due today:", todayStr);

    // Fetch pending vehicle payments due today
    const { data: payments, error: paymentsError } = await supabase
      .from('vehicle_payments')
      .select(`
        *,
        vehicles!inner(id, brand, model, year, plate, buyer_name, seller_name, user_id, purchase_value, cost_value, total_paid, remaining_balance, installments, down_payment, first_due_date)
      `)
      .eq('status', 'pending')
      .eq('due_date', todayStr);

    if (paymentsError) {
      console.error("Error fetching vehicle payments:", paymentsError);
      throw paymentsError;
    }

    console.log(`Found ${payments?.length || 0} vehicle payments due today`);

    // Group payments by user_id
    const userPaymentsMap: Map<string, any[]> = new Map();

    for (const payment of payments || []) {
      const vehicle = payment.vehicles as any;

      if (!userPaymentsMap.has(vehicle.user_id)) {
        userPaymentsMap.set(vehicle.user_id, []);
      }
      
      // Count paid installments
      const { count } = await supabase
        .from('vehicle_payments')
        .select('*', { count: 'exact', head: true })
        .eq('vehicle_id', vehicle.id)
        .eq('status', 'paid');

      const paidInstallments = count || 0;
      const totalPaid = vehicle.total_paid || 0;
      const remainingBalance = vehicle.remaining_balance || 0;
      const profit = vehicle.purchase_value - (vehicle.cost_value || 0);
      const profitPercent = vehicle.cost_value > 0 ? (profit / vehicle.cost_value * 100) : 0;

      userPaymentsMap.get(vehicle.user_id)!.push({
        ...payment,
        vehicle,
        paidInstallments,
        totalPaid,
        remainingBalance,
        profit,
        profitPercent,
      });
    }

    let sentCount = 0;

    for (const [userId, userPayments] of userPaymentsMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name, is_active, whatsapp_instance_token')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone || profile.is_active === false || !profile?.whatsapp_instance_token) {
        console.log(`User ${userId} is inactive, has no phone, or no instance token, skipping`);
        continue;
      }

      for (const payment of userPayments) {
        const vehicle = payment.vehicle;
        const contractId = getContractId(vehicle.id);
        const vehicleName = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
        const clientName = vehicle.buyer_name || vehicle.seller_name;
        const progressPercent = Math.round((payment.paidInstallments / vehicle.installments) * 100);

        let message = `🚗 *Resumo do Veículo - ${contractId}*\n\n`;
        message += `👤 Cliente: ${clientName}\n\n`;
        message += `💰 *Informações do Veículo:*\n`;
        message += `• Veículo: ${vehicleName}\n`;
        if (vehicle.plate) message += `• Placa: ${vehicle.plate}\n`;
        message += `• Valor do Veículo: ${formatCurrency(vehicle.purchase_value)}\n`;
        if (vehicle.cost_value > 0) {
          message += `• Custo Aquisição: ${formatCurrency(vehicle.cost_value)}\n`;
          message += `• Lucro Estimado: ${formatCurrency(payment.profit)} (${payment.profitPercent.toFixed(1)}%)\n`;
        }
        message += `• Data Início: ${formatDate(new Date(vehicle.first_due_date))}\n`;
        message += `• Modalidade: Parcelado\n\n`;
        
        message += `📊 *Status das Parcelas:*\n`;
        message += `✅ Pagas: ${payment.paidInstallments} de ${vehicle.installments} parcelas (${formatCurrency(payment.totalPaid)})\n`;
        message += `⏰ Pendentes: ${vehicle.installments - payment.paidInstallments} parcelas (${formatCurrency(payment.remainingBalance)})\n`;
        message += `📈 Progresso: ${progressPercent}% concluído\n\n`;
        
        message += `📅 *PARCELA DE HOJE:*\n`;
        message += `• Vencimento: ${formatDate(new Date(payment.due_date))} ⚠️\n`;
        message += `• Parcela: ${payment.installment_number}/${vehicle.installments}\n`;
        message += `• Valor: ${formatCurrency(payment.amount)}\n\n`;
        
        message += `💰 Saldo Devedor: ${formatCurrency(payment.remainingBalance)}\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `_CobraFácil - Não deixe de cobrar!_`;

        console.log(`Sending detailed vehicle reminder to user ${userId}`);
        
        const sent = await sendWhatsApp(profile.phone, message, profile.whatsapp_instance_token);
        if (sent) {
          sentCount++;
        }
      }
    }

    console.log(`Sent ${sentCount} vehicle reminder messages`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        checkedPayments: payments?.length || 0 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-vehicle-reminders:", error);
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