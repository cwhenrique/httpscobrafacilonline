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

    // Calculate dates for TODAY (0), 1, 3, and 7 days ahead
    const reminderDays = [0, 1, 3, 7];
    const reminderDates = reminderDays.map(days => {
      const date = new Date(today);
      date.setDate(date.getDate() + days);
      return { days, date: date.toISOString().split('T')[0] };
    });

    console.log("Checking vehicle reminders for dates:", reminderDates);

    // Fetch pending vehicle payments
    const { data: payments, error: paymentsError } = await supabase
      .from('vehicle_payments')
      .select(`
        *,
        vehicles!inner(brand, model, year, plate, buyer_name, seller_name, user_id)
      `)
      .eq('status', 'pending')
      .in('due_date', reminderDates.map(r => r.date));

    if (paymentsError) {
      console.error("Error fetching vehicle payments:", paymentsError);
      throw paymentsError;
    }

    console.log(`Found ${payments?.length || 0} pending vehicle payments`);

    // Group payments by user_id and reminder day
    const userPaymentsMap: Map<string, { 
      payments: any[], 
      reminderDay: number 
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
      
      const reminderDay = reminderDates.find(r => r.date === payment.due_date)?.days;
      if (reminderDay === undefined) continue;

      const paymentInfo = {
        ...payment,
        vehicleName: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
        plate: vehicle.plate,
        buyerName: vehicle.buyer_name || vehicle.seller_name,
        dueDate: payment.due_date,
      };

      if (!userPaymentsMap.has(vehicle.user_id)) {
        userPaymentsMap.set(vehicle.user_id, []);
      }
      
      const existingReminder = userPaymentsMap.get(vehicle.user_id)!.find(r => r.reminderDay === reminderDay);
      if (existingReminder) {
        existingReminder.payments.push(paymentInfo);
      } else {
        userPaymentsMap.get(vehicle.user_id)!.push({ payments: [paymentInfo], reminderDay });
      }
    }

    let sentCount = 0;
    const notifications: any[] = [];

    // Get user profiles to get their phone numbers
    for (const [userId, reminders] of userPaymentsMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone) {
        console.log(`User ${userId} has no phone configured, skipping`);
        continue;
      }

      for (const reminder of reminders) {
        const paymentsList = reminder.payments.map(p => 
          `• *${p.vehicleName}*${p.plate ? ` (${p.plate})` : ''}\n   Cliente: ${p.buyerName}\n   Parcela ${p.installment_number}: ${formatCurrency(p.amount)}`
        ).join('\n\n');

        const totalAmount = reminder.payments.reduce((sum, p) => sum + p.amount, 0);

        let message: string;
        let notifTitle: string;
        
        if (reminder.reminderDay === 0) {
          message = `🚗 *PARCELA DE VEÍCULO VENCE HOJE!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${reminder.payments.length} parcela${reminder.payments.length > 1 ? 's' : ''}* de veículo que vence${reminder.payments.length > 1 ? 'm' : ''} *HOJE*:\n\n${paymentsList}\n\n💰 *Total a receber: ${formatCurrency(totalAmount)}*\n\nNão deixe de cobrar!\n\n_CobraFácil - Alerta automático_`;
          notifTitle = `🚗 Veículo - Vencimento Hoje`;
        } else if (reminder.reminderDay === 1) {
          message = `🚗 *Parcela de Veículo Vence Amanhã*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${reminder.payments.length} parcela${reminder.payments.length > 1 ? 's' : ''}* de veículo que vence${reminder.payments.length > 1 ? 'm' : ''} *amanhã*:\n\n${paymentsList}\n\n💰 *Total a receber: ${formatCurrency(totalAmount)}*\n\nPrepare-se para cobrar!\n\n_CobraFácil - Lembrete automático_`;
          notifTitle = `🚗 Veículo - Vencimento Amanhã`;
        } else {
          message = `🚗 *Lembrete de Parcelas de Veículo*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${reminder.payments.length} parcela${reminder.payments.length > 1 ? 's' : ''}* de veículo para os próximos *${reminder.reminderDay} dias*:\n\n${paymentsList}\n\n💰 *Total a receber: ${formatCurrency(totalAmount)}*\n\n_CobraFácil - Lembrete automático_`;
          notifTitle = `🚗 Veículo - Lembrete ${reminder.reminderDay} dias`;
        }

        console.log(`Sending ${reminder.reminderDay}-day vehicle reminder to user ${userId}`);
        
        const sent = await sendWhatsApp(profile.phone, message);
        if (sent) {
          sentCount++;
          notifications.push({
            user_id: userId,
            title: notifTitle,
            message: `${reminder.payments.length} parcela(s) de veículo - Total: ${formatCurrency(totalAmount)}`,
            type: 'info',
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
