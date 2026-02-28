import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
}

async function sendWhatsApp(phone: string, message: string, instanceToken: string): Promise<boolean> {
  const uazapiUrl = Deno.env.get('UAZAPI_URL');
  if (!uazapiUrl || !instanceToken) return false;
  const formattedPhone = formatPhoneNumber(phone);
  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': instanceToken },
      body: JSON.stringify({ number: formattedPhone, text: message }),
    });
    console.log(`WhatsApp sent to ${formattedPhone}: ${response.status}`);
    return response.ok;
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
    );

    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const almostTwoDaysFromNow = new Date(now.getTime() + (2 * 24 - 1) * 60 * 60 * 1000);

    const { data: expiringUsers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, email, subscription_plan, subscription_expires_at, whatsapp_instance_token')
      .eq('is_active', true)
      .not('subscription_plan', 'eq', 'trial')
      .not('subscription_plan', 'eq', 'lifetime')
      .not('subscription_expires_at', 'is', null)
      .gte('subscription_expires_at', almostTwoDaysFromNow.toISOString())
      .lte('subscription_expires_at', twoDaysFromNow.toISOString());

    if (fetchError) throw fetchError;

    console.log(`Found ${expiringUsers?.length || 0} users with subscriptions expiring in 2 days`);

    const results = { total: expiringUsers?.length || 0, whatsappSent: 0, noPhone: 0, errors: 0 };

    for (const user of expiringUsers || []) {
      if (!user.phone || !user.whatsapp_instance_token) {
        results.noPhone++;
        continue;
      }

      const userName = user.full_name || 'Cliente';
      const planLabel = user.subscription_plan === 'monthly' ? 'mensal' : 
                        user.subscription_plan === 'annual' ? 'anual' : user.subscription_plan;
      const formattedDate = new Date(user.subscription_expires_at).toLocaleDateString('pt-BR');

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

      const sent = await sendWhatsApp(user.phone, whatsappMessage, user.whatsapp_instance_token);
      if (sent) results.whatsappSent++;
      else results.errors++;
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
