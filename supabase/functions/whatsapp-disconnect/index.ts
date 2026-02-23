import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uazapiUrl = Deno.env.get('UAZAPI_URL');

    if (!uazapiUrl) {
      return new Response(JSON.stringify({ error: 'UAZAPI não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_instance_token')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.whatsapp_instance_token) {
      return new Response(JSON.stringify({ error: 'Instância WhatsApp não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Disconnecting UAZAPI instance: ${profile.whatsapp_instance_id}`);

    // Disconnect via UAZAPI
    try {
      const disconnectResp = await fetch(`${uazapiUrl}/instance/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': profile.whatsapp_instance_token,
        },
        body: JSON.stringify({}),
      });
      console.log('Disconnect response:', disconnectResp.status);
    } catch (e) {
      console.error('Error disconnecting:', e);
    }

    // Clear connection info
    await supabase
      .from('profiles')
      .update({
        whatsapp_connected_phone: null,
        whatsapp_connected_at: null,
        whatsapp_to_clients_enabled: false,
      })
      .eq('id', userId);

    return new Response(JSON.stringify({
      success: true,
      message: 'WhatsApp desconectado com sucesso',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in whatsapp-disconnect:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
