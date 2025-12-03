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
  console.log("check-bills-due function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log("Checking bills due on:", todayStr);

    // Fetch all pending bills due today
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .eq('status', 'pending')
      .eq('due_date', todayStr);

    if (billsError) {
      console.error("Error fetching bills:", billsError);
      throw billsError;
    }

    console.log(`Found ${bills?.length || 0} bills due today`);

    if (!bills || bills.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          sentCount: 0,
          message: "No bills due today" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Group bills by user_id
    const userBillsMap: Map<string, any[]> = new Map();
    
    for (const bill of bills) {
      if (!userBillsMap.has(bill.user_id)) {
        userBillsMap.set(bill.user_id, []);
      }
      userBillsMap.get(bill.user_id)!.push(bill);
    }

    let sentCount = 0;
    const notifications: any[] = [];

    // Send notifications to each user
    for (const [userId, userBills] of userBillsMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone) {
        console.log(`User ${userId} has no phone configured, skipping WhatsApp`);
        
        // Still create in-app notification even without phone
        for (const bill of userBills) {
          notifications.push({
            user_id: userId,
            title: '💸 Conta vence hoje!',
            message: `${bill.payee_name}: ${formatCurrency(bill.amount)} - ${bill.description}`,
            type: 'warning',
          });
        }
        continue;
      }

      // Build the message
      const billsList = userBills.map(b => 
        `• *${b.payee_name}*: ${formatCurrency(b.amount)}\n  ${b.description}`
      ).join('\n\n');

      const totalAmount = userBills.reduce((sum, b) => sum + b.amount, 0);

      const message = `💸 *CONTAS A PAGAR HOJE!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${userBills.length} conta${userBills.length > 1 ? 's' : ''}* que vence${userBills.length > 1 ? 'm' : ''} *HOJE* (${formatDate(today)}):\n\n${billsList}\n\n💰 *Total a pagar: ${formatCurrency(totalAmount)}*\n\nNão esqueça de realizar o${userBills.length > 1 ? 's' : ''} pagamento${userBills.length > 1 ? 's' : ''}!\n\n_CobraFácil - Alerta automático_`;

      console.log(`Sending bills reminder to user ${userId}`);
      
      const sent = await sendWhatsApp(profile.phone, message);
      if (sent) {
        sentCount++;
      }

      // Create in-app notifications for each bill
      for (const bill of userBills) {
        notifications.push({
          user_id: userId,
          title: '💸 Conta vence hoje!',
          message: `${bill.payee_name}: ${formatCurrency(bill.amount)} - ${bill.description}`,
          type: 'warning',
        });
      }
    }

    // Create in-app notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (notifError) {
        console.error("Error creating notifications:", notifError);
      } else {
        console.log(`Created ${notifications.length} in-app notifications`);
      }
    }

    console.log(`Sent ${sentCount} WhatsApp messages for bills`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        billsChecked: bills.length,
        notificationsCreated: notifications.length
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-bills-due:", error);
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
