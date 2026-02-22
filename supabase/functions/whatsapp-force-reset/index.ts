import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Helper to detect HTML responses from Evolution API (Easypanel "Service is not reachable")
const isHtmlResponse = (text: string) =>
  text.trim().startsWith('<!') || text.includes('<html');

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

    const rawEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!rawEvolutionApiUrl || !evolutionApiKey) {
      return new Response(JSON.stringify({ error: 'Evolution API não configurada no servidor' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedUrl = rawEvolutionApiUrl.match(/^https?:\/\//) ? rawEvolutionApiUrl : `https://${rawEvolutionApiUrl}`;
    const urlMatch = normalizedUrl.match(/^(https?:\/\/[^\/]+)/);
    const evolutionApiUrl = urlMatch ? urlMatch[1] : normalizedUrl;

    const evolutionFetch = async (url: string, init: RequestInit & { headers?: Record<string, string> } = {}) => {
      const baseHeaders = (init.headers ?? {}) as Record<string, string>;
      let resp = await fetch(url, { ...init, headers: { ...baseHeaders, apikey: evolutionApiKey } });
      if (resp.status === 401) {
        resp = await fetch(url, { ...init, headers: { ...baseHeaders, Authorization: `Bearer ${evolutionApiKey}` } });
      }
      return resp;
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_connected_phone, whatsapp_connected_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar perfil' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const oldInstanceName = profile?.whatsapp_instance_id;
    console.log(`[whatsapp-force-reset] Old instance: ${oldInstanceName}`);

    // Step 1: Try to delete old instance (best-effort, don't fail if server is down)
    if (oldInstanceName) {
      try {
        const logoutResp = await evolutionFetch(`${evolutionApiUrl}/instance/logout/${oldInstanceName}`, { method: 'DELETE' });
        const logoutText = await logoutResp.text();
        console.log(`[whatsapp-force-reset] Logout: ${logoutResp.status}, html=${isHtmlResponse(logoutText)}`);
      } catch (e) {
        console.log(`[whatsapp-force-reset] Logout failed:`, e);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const delResp = await evolutionFetch(`${evolutionApiUrl}/instance/delete/${oldInstanceName}`, { method: 'DELETE' });
        const delText = await delResp.text();
        console.log(`[whatsapp-force-reset] Delete: ${delResp.status}, html=${isHtmlResponse(delText)}`);
      } catch (e) {
        console.log(`[whatsapp-force-reset] Delete failed:`, e);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Step 2: Create new instance
    const shortUserId = userId.substring(0, 8);
    const timestamp = Date.now().toString(36).substring(-4);
    const newInstanceName = `cf_${shortUserId}_${timestamp}`;
    console.log(`[whatsapp-force-reset] Creating new instance: ${newInstanceName}`);

    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-connection-webhook`;

    const createResponse = await evolutionFetch(`${evolutionApiUrl}/instance/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceName: newInstanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        rejectCall: false,
        readMessages: false,
        readStatus: false,
        alwaysOnline: true,
        syncFullHistory: false,
        webhook: {
          url: webhookUrl,
          byEvents: true,
          base64: false,
          events: ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"]
        }
      }),
    });

    const createText = await createResponse.text();
    console.log(`[whatsapp-force-reset] Create status: ${createResponse.status}`);

    // CRITICAL: Check if server is offline (HTML response or 502/503)
    if (isHtmlResponse(createText) || createResponse.status === 502 || createResponse.status === 503) {
      console.error('[whatsapp-force-reset] Evolution API server is offline/unreachable');
      // DO NOT clear profile data - the server is offline, keep old instance reference
      return new Response(JSON.stringify({
        error: 'Servidor WhatsApp temporariamente indisponível. Tente novamente em alguns minutos.',
        serverOffline: true,
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!createResponse.ok && createResponse.status !== 403) {
      return new Response(JSON.stringify({
        error: 'Erro ao criar nova instância. Tente novamente.',
        details: createText.substring(0, 200),
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Instance created successfully - NOW clear old data and save new instance
    console.log(`[whatsapp-force-reset] Instance created OK, updating profile`);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        whatsapp_instance_id: newInstanceName,
        whatsapp_connected_phone: null,
        whatsapp_connected_at: null,
        whatsapp_to_clients_enabled: false,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[whatsapp-force-reset] Error updating profile:', updateError);
    }

    // Step 4: Get QR code
    let qrCodeBase64 = null;
    try {
      const connectResp = await evolutionFetch(`${evolutionApiUrl}/instance/connect/${newInstanceName}`);
      const connectText = await connectResp.text();
      if (connectResp.ok && !isHtmlResponse(connectText)) {
        try {
          const data = JSON.parse(connectText);
          qrCodeBase64 = data.base64 || data.qrcode?.base64 || data.code || null;
        } catch { /* ignore */ }
      }
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
