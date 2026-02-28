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

// Helper para extrair configuração de multa por atraso das notas
// Formato: [OVERDUE_CONFIG:percentage:1] ou [OVERDUE_CONFIG:fixed:5.00]
const getOverdueConfigFromNotes = (notes: string | null): { type: 'percentage' | 'fixed' | 'percentage_total'; value: number } | null => {
  const match = (notes || '').match(/\[OVERDUE_CONFIG:(percentage_total|percentage|fixed):([0-9.]+)\]/);
  if (!match) return null;
  return {
    type: match[1] as 'percentage' | 'fixed' | 'percentage_total',
    value: parseFloat(match[2])
  };
};

// Helper para extrair multas já aplicadas
// Formato: [DAILY_PENALTY:índice:valor]
const getDailyPenaltiesFromNotes = (notes: string | null): Record<number, number> => {
  const penalties: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[DAILY_PENALTY:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    penalties[parseInt(match[1])] = parseFloat(match[2]);
  }
  return penalties;
};

// Progressive alert days
const ALERT_DAYS = [1, 3, 7, 15, 30];

const getAlertEmoji = (daysOverdue: number): string => {
  if (daysOverdue === 1) return '⚠️';
  if (daysOverdue === 3) return '🚨';
  if (daysOverdue === 7) return '🔴';
  if (daysOverdue === 15) return '🔴';
  return '🆘';
};

const getAlertTitle = (daysOverdue: number): string => {
  if (daysOverdue === 1) return 'Atenção: 1 dia de atraso';
  if (daysOverdue === 3) return 'Alerta: 3 dias de atraso';
  if (daysOverdue === 7) return 'Alerta: 1 Semana de Atraso';
  if (daysOverdue === 15) return 'Urgente: 15 Dias de Atraso';
  return 'CRÍTICO: 30+ Dias de Atraso';
};

const handler = async (req: Request): Promise<Response> => {
  console.log("check-overdue-vehicles function called at", new Date().toISOString());
  
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

    console.log("Checking overdue vehicles as of:", todayStr);

    // Fetch overdue vehicle payments
    const { data: payments, error: paymentsError } = await supabase
      .from('vehicle_payments')
      .select(`
        *,
        vehicles!inner(id, brand, model, year, plate, buyer_name, seller_name, user_id, purchase_value, cost_value, total_paid, remaining_balance, installments)
      `)
      .eq('status', 'pending')
      .lt('due_date', todayStr);

    if (paymentsError) {
      console.error("Error fetching overdue vehicle payments:", paymentsError);
      throw paymentsError;
    }

    console.log(`Found ${payments?.length || 0} overdue vehicle payments`);

    // Group payments by user_id and milestone
    const userPaymentsMap: Map<string, Map<number, any[]>> = new Map();

    for (const payment of payments || []) {
      const vehicle = payment.vehicles as any;
      
      // Calculate days overdue
      const dueDate = new Date(payment.due_date);
      const diffTime = today.getTime() - dueDate.getTime();
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Only send on milestone days
      if (!ALERT_DAYS.includes(daysOverdue)) continue;

      // Count paid installments
      const { count } = await supabase
        .from('vehicle_payments')
        .select('*', { count: 'exact', head: true })
        .eq('vehicle_id', vehicle.id)
        .eq('status', 'paid');

      const paidInstallments = count || 0;
      const profit = vehicle.purchase_value - (vehicle.cost_value || 0);
      const profitPercent = vehicle.cost_value > 0 ? (profit / vehicle.cost_value * 100) : 0;

      const paymentInfo = {
        ...payment,
        vehicle,
        paidInstallments,
        profit,
        profitPercent,
        daysOverdue,
      };

      if (!userPaymentsMap.has(vehicle.user_id)) {
        userPaymentsMap.set(vehicle.user_id, new Map());
      }
      
      const userAlerts = userPaymentsMap.get(vehicle.user_id)!;
      if (!userAlerts.has(daysOverdue)) {
        userAlerts.set(daysOverdue, []);
      }
      userAlerts.get(daysOverdue)!.push(paymentInfo);
    }

    let sentCount = 0;

    for (const [userId, alertDaysMap] of userPaymentsMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name, is_active, whatsapp_instance_token')
        .eq('id', userId)
        .single();

      // Skip inactive users
      if (profileError || !profile?.phone || profile.is_active === false || !profile?.whatsapp_instance_token) {
        console.log(`User ${userId} is inactive, has no phone, or no instance token, skipping`);
        continue;
      }

      for (const [alertDay, overduePayments] of alertDaysMap) {
        const emoji = getAlertEmoji(alertDay);
        const title = getAlertTitle(alertDay);

        for (const payment of overduePayments) {
          const vehicle = payment.vehicle;
          const contractId = getContractId(vehicle.id);
          const vehicleName = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
          const clientName = vehicle.buyer_name || vehicle.seller_name;
          const progressPercent = Math.round((payment.paidInstallments / vehicle.installments) * 100);

          // Extrair multas e juros das notas do veículo
          const existingPenalties = getDailyPenaltiesFromNotes(vehicle.notes);
          const totalPenalty = Object.values(existingPenalties).reduce((sum, v) => sum + v, 0);
          const overdueConfig = getOverdueConfigFromNotes(vehicle.notes);
          const originalBalance = (vehicle.remaining_balance || 0) - totalPenalty;

          let message = `${emoji} *${title}*\n\n`;
          message += `🚗 *Veículo - ${contractId}*\n\n`;
          message += `👤 Cliente: ${clientName}\n\n`;
          message += `💰 *Informações do Veículo:*\n`;
          message += `• Veículo: ${vehicleName}\n`;
          if (vehicle.plate) message += `• Placa: ${vehicle.plate}\n`;
          message += `• Valor do Veículo: ${formatCurrency(vehicle.purchase_value)}\n`;
          if (vehicle.cost_value > 0) {
            message += `• Custo Aquisição: ${formatCurrency(vehicle.cost_value)}\n`;
            message += `• Lucro Estimado: ${formatCurrency(payment.profit)} (${payment.profitPercent.toFixed(1)}%)\n`;
          }
          
          message += `\n📊 *Status das Parcelas:*\n`;
          message += `✅ Pagas: ${payment.paidInstallments} de ${vehicle.installments} (${formatCurrency(vehicle.total_paid || 0)})\n`;
          message += `❌ Pendentes: ${vehicle.installments - payment.paidInstallments} (${formatCurrency(originalBalance)})\n`;
          message += `📈 Progresso: ${progressPercent}% concluído\n\n`;
          
          message += `⚠️ *PARCELA EM ATRASO:*\n`;
          message += `• Venceu em: ${formatDate(new Date(payment.due_date))}\n`;
          message += `• Parcela: ${payment.installment_number}/${vehicle.installments}\n`;
          message += `• Dias de atraso: *${alertDay}*\n`;
          message += `• Valor Original: ${formatCurrency(payment.amount)}\n`;
          
          // Mostrar multa aplicada se houver
          if (totalPenalty > 0) {
            message += `• ⚠️ Multa Aplicada: +${formatCurrency(totalPenalty)}\n`;
          }
          
          // Mostrar taxa de juros por atraso se configurada
          if (overdueConfig) {
          const taxaInfo = overdueConfig.type === 'percentage' 
              ? `${overdueConfig.value}% ao dia`
              : overdueConfig.type === 'percentage_total'
                ? `${overdueConfig.value}% do total/30 dias`
                : `${formatCurrency(overdueConfig.value)}/dia`;
            message += `• 📈 Taxa por Atraso: ${taxaInfo}\n`;
          }
          
          message += `\n💵 *TOTAL A RECEBER:* ${formatCurrency(vehicle.remaining_balance || 0)}\n\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━\n`;
          message += `_CobraFácil - Entre em contato urgente!_`;

          console.log(`Sending ${alertDay}-day overdue alert to user ${userId}`);
          
          const sent = await sendWhatsApp(profile.phone, message, profile.whatsapp_instance_token);
          if (sent) {
            sentCount++;
          }
        }
      }
    }

    console.log(`Sent ${sentCount} overdue vehicle messages`);

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
    console.error("Error in check-overdue-vehicles:", error);
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