import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, clientPhone, message } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!clientPhone) {
      return new Response(JSON.stringify({ error: 'clientPhone é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!message) {
      return new Response(JSON.stringify({ error: 'message é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uazapiUrl = Deno.env.get('UAZAPI_URL');
    if (!uazapiUrl) {
      return new Response(JSON.stringify({ error: 'UAZAPI não configurada no servidor' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch user's WhatsApp instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_instance_token, whatsapp_to_clients_enabled, whatsapp_connected_phone, company_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar configuração do perfil' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile.whatsapp_to_clients_enabled) {
      return new Response(JSON.stringify({ error: 'Envio de WhatsApp para clientes está desativado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile.whatsapp_instance_token) {
      return new Response(JSON.stringify({ error: 'Conecte seu WhatsApp nas configurações para enviar mensagens aos clientes' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceToken = profile.whatsapp_instance_token;

    // Check real-time connection status via UAZAPI
    try {
      const statusResp = await fetch(`${uazapiUrl}/instance/status`, {
        method: 'GET',
        headers: { 'token': instanceToken },
      });
      const statusData = await statusResp.json().catch(() => null);
      const state = statusData?.instance?.status || statusData?.status || statusData?.state || 'unknown';
      console.log(`Instance state: ${state}`);

      if (state !== 'connected' && state !== 'open') {
        let errorMessage = 'WhatsApp não conectado.';
        if (state === 'connecting') {
          errorMessage = 'WhatsApp aguardando leitura do QR Code. Acesse as configurações para escanear.';
        } else {
          errorMessage = 'WhatsApp desconectado. Reconecte nas configurações escaneando o QR Code.';
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (e) {
      console.error('Error checking connection state:', e);
      return new Response(JSON.stringify({ error: 'Erro ao verificar conexão do WhatsApp. Tente novamente.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format phone number
    let formattedPhone = clientPhone.replace(/\D/g, '');
    if (!formattedPhone || formattedPhone.length < 8) {
      return new Response(JSON.stringify({ error: 'Número de telefone do cliente inválido ou não cadastrado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!formattedPhone.startsWith('55')) formattedPhone = `55${formattedPhone}`;

    console.log(`Sending WhatsApp via UAZAPI to: ${formattedPhone}`);

    // Send via UAZAPI
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceToken,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const responseText = await response.text();
    console.log('UAZAPI response:', response.status, responseText);

    if (!response.ok) {
      let errorDetail = 'Erro ao enviar mensagem pelo WhatsApp';
      let errorCode = 'UNKNOWN_ERROR';
      try {
        const errorData = JSON.parse(responseText);
        if (errorData?.message) errorDetail = errorData.message;
      } catch { /* use default */ }

      return new Response(JSON.stringify({ error: errorDetail, errorCode, details: responseText }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;
    try { result = JSON.parse(responseText); } catch { result = { raw: responseText }; }

    return new Response(JSON.stringify({ success: true, message: 'Mensagem enviada com sucesso para o cliente', result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in send-whatsapp-to-client:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
