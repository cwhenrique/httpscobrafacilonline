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

    // Check for overdue milestones: 1, 3, 7, 15, 30 days
    const overdueMilestones = [1, 3, 7, 15, 30];
    const milestoneDates = overdueMilestones.map(days => {
      const date = new Date(today);
      date.setDate(date.getDate() - days);
      return { days, date: date.toISOString().split('T')[0] };
    });

    console.log("Checking overdue vehicles for dates:", milestoneDates);

    // Fetch overdue vehicle payments
    const { data: payments, error: paymentsError } = await supabase
      .from('vehicle_payments')
      .select(`
        *,
        vehicles!inner(brand, model, year, plate, buyer_name, seller_name, user_id)
      `)
      .eq('status', 'pending')
      .lt('due_date', todayStr);

    if (paymentsError) {
      console.error("Error fetching overdue vehicle payments:", paymentsError);
      throw paymentsError;
    }

    console.log(`Found ${payments?.length || 0} overdue vehicle payments`);

    // Group payments by user_id and milestone
    const userPaymentsMap: Map<string, { 
      payments: any[], 
      daysOverdue: number 
    }[]> = new Map();

    for (const payment of payments || []) {
      const vehicle = payment.vehicles as { 
        brand: string; 
        model: string; 
        year: number; 
        plate: string | null;
        buyer_name: string | null;
        seller_name: string;
        user_id: string;
      };
      
      // Calculate days overdue
      const dueDate = new Date(payment.due_date);
      const diffTime = today.getTime() - dueDate.getTime();
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Check if today is a milestone day
      if (!overdueMilestones.includes(daysOverdue)) continue;

      const paymentInfo = {
        ...payment,
        vehicleName: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
        plate: vehicle.plate,
        buyerName: vehicle.buyer_name || vehicle.seller_name,
        daysOverdue,
      };

      if (!userPaymentsMap.has(vehicle.user_id)) {
        userPaymentsMap.set(vehicle.user_id, []);
      }
      
      const existingMilestone = userPaymentsMap.get(vehicle.user_id)!.find(m => m.daysOverdue === daysOverdue);
      if (existingMilestone) {
        existingMilestone.payments.push(paymentInfo);
      } else {
        userPaymentsMap.get(vehicle.user_id)!.push({ payments: [paymentInfo], daysOverdue });
      }
    }

    let sentCount = 0;
    const notifications: any[] = [];

    // Get user profiles to get their phone numbers
    for (const [userId, milestones] of userPaymentsMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone) {
        console.log(`User ${userId} has no phone configured, skipping`);
        continue;
      }

      for (const milestone of milestones) {
        const paymentsList = milestone.payments.map(p => 
          `• *${p.vehicleName}*${p.plate ? ` (${p.plate})` : ''}\n   Cliente: ${p.buyerName}\n   Parcela ${p.installment_number}: ${formatCurrency(p.amount)}`
        ).join('\n\n');

        const totalAmount = milestone.payments.reduce((sum, p) => sum + p.amount, 0);

        const message = `🚨 *PARCELA DE VEÍCULO EM ATRASO!*\n\n⚠️ *${milestone.daysOverdue} dia${milestone.daysOverdue > 1 ? 's' : ''} de atraso*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${milestone.payments.length} parcela${milestone.payments.length > 1 ? 's' : ''}* de veículo em atraso:\n\n${paymentsList}\n\n💰 *Total em atraso: ${formatCurrency(totalAmount)}*\n\nEntre em contato com o cliente!\n\n_CobraFácil - Alerta de atraso_`;

        console.log(`Sending ${milestone.daysOverdue}-day overdue vehicle alert to user ${userId}`);
        
        const sent = await sendWhatsApp(profile.phone, message);
        if (sent) {
          sentCount++;
          notifications.push({
            user_id: userId,
            title: `🚨 Veículo - ${milestone.daysOverdue} dias em atraso`,
            message: `${milestone.payments.length} parcela(s) em atraso - Total: ${formatCurrency(totalAmount)}`,
            type: 'warning',
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
