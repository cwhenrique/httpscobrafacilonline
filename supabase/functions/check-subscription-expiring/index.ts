import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cleanApiUrl(url: string): string {
  let cleaned = url.trim();
  if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
  cleaned = cleaned.replace(/\/message\/sendText$/, '');
  cleaned = cleaned.replace(/\/manager$/, '');
  return cleaned;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const apiUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    // Usar instância fixa "notificacao" para notificações do sistema
    const instanceName = "notificacao";

    if (!apiUrl || !apiKey || !instanceName) {
      console.log('Evolution API not configured');
      return false;
    }

    const cleanedUrl = cleanApiUrl(apiUrl);
    const formattedPhone = formatPhoneNumber(phone);
    const endpoint = `${cleanedUrl}/message/sendText/${instanceName}`;

    console.log(`Sending expiration warning to: ${formattedPhone}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WhatsApp API error: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`WhatsApp sent successfully to ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const now = new Date();
    
    // Calculate 2 days from now (window of 2 days to 1 day 23 hours)
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const almostTwoDaysFromNow = new Date(now.getTime() + (2 * 24 - 1) * 60 * 60 * 1000);

    console.log(`Checking for subscriptions expiring between ${almostTwoDaysFromNow.toISOString()} and ${twoDaysFromNow.toISOString()}`);

    // Find users whose subscription expires in ~2 days
    // Exclude trial users (they have their own notification)
    const { data: expiringUsers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, email, subscription_plan, subscription_expires_at')
      .eq('is_active', true)
      .not('subscription_plan', 'eq', 'trial')
      .not('subscription_plan', 'eq', 'lifetime') // Lifetime never expires
      .not('subscription_expires_at', 'is', null)
      .gte('subscription_expires_at', almostTwoDaysFromNow.toISOString())
      .lte('subscription_expires_at', twoDaysFromNow.toISOString());

    if (fetchError) {
      console.error('Error fetching expiring users:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiringUsers?.length || 0} users with subscriptions expiring in 2 days`);

    const results = {
      total: expiringUsers?.length || 0,
      whatsappSent: 0,
      notificationsCreated: 0,
      noPhone: 0,
      errors: 0,
    };

    for (const user of expiringUsers || []) {
      const userName = user.full_name || 'Cliente';
      const planLabel = user.subscription_plan === 'monthly' ? 'mensal' : 
                        user.subscription_plan === 'annual' ? 'anual' : user.subscription_plan;
      
      const expirationDate = new Date(user.subscription_expires_at);
      const formattedDate = expirationDate.toLocaleDateString('pt-BR');

      // Create system notification
      const notificationTitle = '⚠️ Assinatura expirando em breve';
      const notificationMessage = `Sua assinatura ${planLabel} expira em ${formattedDate}. Renove agora para continuar usando o CobraFácil sem interrupções.`;

      const { error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: user.id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'warning',
        });

      if (notifError) {
        console.error(`Error creating notification for user ${user.id}:`, notifError);
        results.errors++;
      } else {
        results.notificationsCreated++;
        console.log(`Notification created for user ${user.id}`);
      }

      // Send WhatsApp if phone is available
      if (user.phone) {
        const whatsappMessage = `⚠️ *Aviso Importante - CobraFácil*\n\n` +
          `Olá, ${userName}!\n\n` +
          `Sua assinatura *${planLabel}* do CobraFácil expira em *${formattedDate}* (2 dias).\n\n` +
          `🔄 Renove agora para continuar aproveitando:\n` +
          `✅ Controle completo de empréstimos\n` +
          `✅ Notificações automáticas de cobrança\n` +
          `✅ Relatórios diários\n` +
          `✅ E muito mais!\n\n` +
          `Não perca o acesso às suas ferramentas de gestão. Renove sua assinatura hoje mesmo!\n\n` +
          `Acesse: https://cobrafacil.app`;

        const sent = await sendWhatsApp(user.phone, whatsappMessage);
        if (sent) {
          results.whatsappSent++;
        } else {
          results.errors++;
        }
      } else {
        results.noPhone++;
        console.log(`User ${user.id} has no phone number`);
      }
    }

    console.log('Results:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
