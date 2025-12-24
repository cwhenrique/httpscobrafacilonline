import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cleanApiUrl(url: string): string {
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
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
  // Usar instância fixa "VendaApp" para notificações do sistema
  const evolutionInstance = "VendaApp";

  if (!evolutionApiUrl || !evolutionApiKey) {
    console.log('Evolution API not configured');
    return false;
  }
  
  console.log("Using fixed system instance: VendaApp");

  let formattedPhone = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  const cleanUrl = cleanApiUrl(evolutionApiUrl);
  const apiUrl = `${cleanUrl}/message/sendText/${evolutionInstance}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      console.error('WhatsApp send error:', await response.text());
      return false;
    }
    
    console.log('WhatsApp sent to:', formattedPhone);
    return true;
  } catch (error) {
    console.error('WhatsApp error:', error);
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

    const now = new Date().toISOString();
    
    // Find expired subscriptions (NOT lifetime plans)
    // Check both:
    // 1. subscription_expires_at < now (new system)
    // 2. trial_expires_at < now (legacy trial system)
    const { data: expiredUsers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, email, subscription_plan, subscription_expires_at, trial_expires_at')
      .eq('is_active', true)
      .or(`and(subscription_expires_at.lt.${now},subscription_plan.neq.lifetime),and(trial_expires_at.lt.${now},subscription_plan.eq.trial)`);

    if (fetchError) {
      console.error('Error fetching expired users:', fetchError);
      throw fetchError;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('No expired subscriptions found');
      return new Response(
        JSON.stringify({ message: 'No expired subscriptions', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredUsers.length} expired subscriptions`);

    let deactivatedCount = 0;

    for (const user of expiredUsers) {
      // Skip lifetime plans (safety check)
      if (user.subscription_plan === 'lifetime') {
        console.log(`Skipping lifetime user: ${user.email}`);
        continue;
      }

      // Deactivate user
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ is_active: false })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Error deactivating user ${user.id}:`, updateError);
        continue;
      }

      console.log(`Deactivated user: ${user.email} (plan: ${user.subscription_plan})`);
      deactivatedCount++;

      // Send WhatsApp notification
      if (user.phone) {
        const planNames: Record<string, string> = {
          'trial': 'Trial',
          'monthly': 'Mensal',
          'annual': 'Anual',
        };

        const message = `⏰ *Sua assinatura expirou!*

Olá ${user.full_name || 'Cliente'}!

Seu plano *${planNames[user.subscription_plan] || user.subscription_plan}* do *CobraFácil* expirou.

Para continuar usando o sistema:

✅ Gestão de Clientes
✅ Cálculo Automático de Juros
✅ Alertas WhatsApp
✅ Calendário de Cobranças
✅ Score de Clientes

💰 *Para renovar, entre em contato:*
📱 WhatsApp: (17) 99105-0811

Dúvidas? Responda esta mensagem!`;

        await sendWhatsApp(user.phone, message);
      }

      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deactivated_count: deactivatedCount,
        total_checked: expiredUsers.length
      }),
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
