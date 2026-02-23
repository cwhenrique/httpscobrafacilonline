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

async function sendWhatsAppMessage(phone: string, message: string, instanceToken: string): Promise<{ success: boolean; error?: string }> {
  const uazapiUrl = Deno.env.get('UAZAPI_URL');
  if (!uazapiUrl || !instanceToken) return { success: false, error: 'UAZAPI not configured' };
  const formattedPhone = formatPhoneNumber(phone);
  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': instanceToken },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API error: ${response.status} - ${errorText}` };
    }
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

const UPDATE_MESSAGE = `🚀 *MEGA ATUALIZAÇÃO COBRAFÁCIL* 🚀

Olá! Trabalhamos intensamente para trazer novidades que vão transformar sua experiência de cobrança. Confira tudo que chegou:

━━━━━━━━━━━━━━━━━━━━━━

🎯 *SISTEMA INTELIGENTE DE AJUDA*
Agora você tem dicas visuais em TODA a plataforma!

📚 *TUTORIAL GUIADO APRIMORADO*
Tutorial completo e passo-a-passo.

📄 *COMPROVANTES PDF PROFISSIONAIS*
Sistema completo de geração de PDFs.

💰 *SISTEMA DE JUROS EXTRA (RENOVAÇÃO)*
Aplique juros adicionais em parcelas específicas.

💳 *CONTROLE DE PAGAMENTOS PARCIAIS*
Acompanhe pagamentos incompletos.

📲 *NOTIFICAÇÕES OTIMIZADAS*
Mensagens consolidadas, menos spam.

📅 *CALENDÁRIO UNIFICADO*
Todas as cobranças em um só lugar.

📊 *RELATÓRIOS AVANÇADOS*
Filtro por período, comparativos e gráficos.

━━━━━━━━━━━━━━━━━━━━━━

💚 Obrigado por fazer parte do CobraFácil!
Acesse agora: https://cobrafacil.online`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    const expectedSecret = Deno.env.get('CAKTO_WEBHOOK_SECRET');
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone, whatsapp_instance_token')
      .not('phone', 'is', null)
      .not('whatsapp_instance_token', 'is', null)
      .neq('phone', '');

    const results: { phone: string; name: string; success: boolean; error?: string }[] = [];

    for (const profile of profiles || []) {
      if (!profile.phone || !profile.whatsapp_instance_token) continue;
      const result = await sendWhatsAppMessage(profile.phone, UPDATE_MESSAGE, profile.whatsapp_instance_token);
      results.push({ phone: profile.phone, name: profile.full_name || 'Unknown', ...result });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successCount = results.filter(r => r.success).length;
    return new Response(JSON.stringify({
      message: 'Broadcast complete', total: results.length, success: successCount, failed: results.length - successCount, details: results,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
