import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cleanApiUrl(url: string): string {
  return url
    .replace(/\/+$/, '')
    .replace(/\/message\/sendText$/, '')
    .replace(/\/message$/, '');
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstanceName) {
      console.error('Missing Evolution API configuration');
      return false;
    }

    const formattedPhone = formatPhoneNumber(phone);
    const cleanedUrl = cleanApiUrl(evolutionApiUrl);
    const endpoint = `${cleanedUrl}/message/sendText/${evolutionInstanceName}`;

    console.log(`Sending WhatsApp to ${formattedPhone}`);

    const response = await fetch(endpoint, {
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
      const errorText = await response.text();
      console.error(`Failed to send WhatsApp: ${errorText}`);
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
    const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    console.log(`Checking for trial users expiring between ${twoHoursFromNow.toISOString()} and ${threeHoursFromNow.toISOString()}`);

    // Find trial users whose trial expires in approximately 3 hours (between 2-3 hours from now)
    const { data: expiringUsers, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, phone, full_name, trial_expires_at')
      .eq('subscription_plan', 'trial')
      .eq('is_active', true)
      .gte('trial_expires_at', twoHoursFromNow.toISOString())
      .lte('trial_expires_at', threeHoursFromNow.toISOString());

    if (error) {
      console.error('Error fetching expiring trial users:', error);
      throw error;
    }

    console.log(`Found ${expiringUsers?.length || 0} trial users expiring in ~3 hours`);

    const results = {
      total: expiringUsers?.length || 0,
      sent: 0,
      failed: 0,
      noPhone: 0,
      details: [] as { email: string; status: string }[],
    };

    for (const user of expiringUsers || []) {
      if (!user.phone) {
        console.log(`User ${user.email} has no phone number`);
        results.noPhone++;
        results.details.push({ email: user.email || 'unknown', status: 'no_phone' });
        continue;
      }

      const userName = user.full_name || 'Cliente';
      
      const message = `⚠️ *AVISO IMPORTANTE - CobraFácil*

Olá, ${userName}!

Seu período de teste *expira em 3 horas*! ⏰

📢 *ATENÇÃO:* Todos os contratos, empréstimos e dados cadastrados durante o período de teste serão *PERDIDOS* caso você não realize a assinatura.

Não perca seu trabalho! Entre em contato agora mesmo para assinar e garantir que seus dados sejam preservados:

📱 *WhatsApp:* (17) 99105-0811

Estamos à disposição para ajudá-lo!

_Equipe CobraFácil_`;

      const sent = await sendWhatsApp(user.phone, message);
      
      if (sent) {
        results.sent++;
        results.details.push({ email: user.email || 'unknown', status: 'sent' });
      } else {
        results.failed++;
        results.details.push({ email: user.email || 'unknown', status: 'failed' });
      }
    }

    console.log(`Results: ${results.sent} sent, ${results.failed} failed, ${results.noPhone} no phone`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${results.total} expiring trial users`,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in check-trial-expiring:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
