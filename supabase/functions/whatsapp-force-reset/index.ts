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

    console.log(`[whatsapp-force-reset] Starting force reset for user: ${userId}`);

    const uazapiUrl = Deno.env.get('UAZAPI_URL');
    const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN');

    if (!uazapiUrl || !adminToken) {
      return new Response(JSON.stringify({ error: 'UAZAPI não configurada no servidor' }), {
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

    if (profileError) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar perfil' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Try to disconnect and delete old instance
    if (profile?.whatsapp_instance_token) {
      try {
        await fetch(`${uazapiUrl}/instance/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': profile.whatsapp_instance_token },
          body: JSON.stringify({}),
        });
        console.log('[whatsapp-force-reset] Disconnected old instance');
      } catch (e) {
        console.log('[whatsapp-force-reset] Disconnect failed:', e);
      }

      await new Promise(r => setTimeout(r, 1000));

      try {
        await fetch(`${uazapiUrl}/instance/delete`, {
          method: 'DELETE',
          headers: { 'admintoken': adminToken },
        });
        console.log('[whatsapp-force-reset] Deleted old instance');
      } catch (e) {
        console.log('[whatsapp-force-reset] Delete failed:', e);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    // Step 2: Create new instance
    const shortUserId = userId.substring(0, 8);
    const timestamp = Date.now().toString(36).slice(-4);
    const newInstanceName = `cf_${shortUserId}_${timestamp}`;
    console.log(`[whatsapp-force-reset] Creating new instance: ${newInstanceName}`);

    const createResponse = await fetch(`${uazapiUrl}/instance/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'admintoken': adminToken,
      },
      body: JSON.stringify({ name: newInstanceName }),
    });

    const createText = await createResponse.text();
    console.log(`[whatsapp-force-reset] Create status: ${createResponse.status}`);

    const isHtml = createText.trim().startsWith('<!') || createText.includes('<html');
    if (isHtml || createResponse.status === 502 || createResponse.status === 503) {
      console.error('[whatsapp-force-reset] UAZAPI server is offline');
      await supabase.from('profiles').update({
        whatsapp_instance_id: null,
        whatsapp_instance_token: null,
        whatsapp_connected_phone: null,
        whatsapp_connected_at: null,
        whatsapp_to_clients_enabled: false,
      }).eq('id', userId);

      return new Response(JSON.stringify({
        error: 'Servidor WhatsApp temporariamente indisponível. Dados limpos. Tente novamente em alguns minutos.',
        serverOffline: true,
        cleared: true,
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let createData: any = null;
    try {
      createData = JSON.parse(createText);
    } catch {
      return new Response(JSON.stringify({ error: 'Resposta inválida do servidor' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newToken = createData?.token || createData?.data?.token;
    if (!newToken) {
      return new Response(JSON.stringify({ error: 'Token não retornado pela UAZAPI' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Update profile with new instance
    await supabase.from('profiles').update({
      whatsapp_instance_id: newInstanceName,
      whatsapp_instance_token: newToken,
      whatsapp_connected_phone: null,
      whatsapp_connected_at: null,
      whatsapp_to_clients_enabled: false,
    }).eq('id', userId);

    // Step 4: Get QR code
    let qrCodeBase64 = null;
    try {
      const connectResp = await fetch(`${uazapiUrl}/instance/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': newToken },
        body: JSON.stringify({}),
      });
      const connectData = await connectResp.json().catch(() => null);
      qrCodeBase64 = connectData?.qrcode || connectData?.qr || connectData?.base64 || null;
    } catch (e) {
      console.error('[whatsapp-force-reset] Connect error:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      instanceName: newInstanceName,
      qrCode: qrCodeBase64,
      message: 'Instância recriada com sucesso! Escaneie o novo QR Code.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[whatsapp-force-reset] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
