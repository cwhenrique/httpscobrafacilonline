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
    const { userId, forceReset } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uazapiUrl = Deno.env.get('UAZAPI_URL');
    const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN');

    if (!uazapiUrl) {
      return new Response(JSON.stringify({ error: 'UAZAPI não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const respond = (body: any, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: profile } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_instance_token, email')
      .eq('id', userId)
      .single();

    // Restrict to authorized email only
    const allowedEmails = ['cw@gmail.com', 'contatodiegoreiis@gmail.com', 'renatochave89@gmail.com', 'kaique-lima98@outlook.com', 'clau_pogian@hotmail.com'];
    if (!allowedEmails.includes((profile?.email || '').toLowerCase())) {
      return respond({ error: 'Função temporariamente restrita.' }, 403);
    }

    // If no instance exists, create one automatically
    if (!profile?.whatsapp_instance_token) {
      console.log('[QR] No instance found, creating one automatically...');

      if (!adminToken) {
        return respond({ error: 'UAZAPI admin token não configurado' }, 500);
      }

      const shortUserId = userId.substring(0, 8);
      const newInstanceName = `cf_${shortUserId}`;

      try {
        const createResp = await fetch(`${uazapiUrl}/instance/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'admintoken': adminToken },
          body: JSON.stringify({ name: newInstanceName }),
        });
        const createData = await createResp.json().catch(() => null);

        if (createResp.status === 502 || createResp.status === 503) {
          return respond({ error: 'Servidor WhatsApp temporariamente indisponível.', serverOffline: true }, 503);
        }

        const instanceToken = createData?.token || createData?.data?.token;
        if (!instanceToken) {
          return respond({ error: 'Não foi possível criar instância WhatsApp.' }, 500);
        }

        // Save to profile
        await supabase.from('profiles').update({
          whatsapp_instance_id: newInstanceName,
          whatsapp_instance_token: instanceToken,
        }).eq('id', userId);

        // Connect to get QR
        const connectResp = await fetch(`${uazapiUrl}/instance/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instanceToken },
          body: JSON.stringify({}),
        });
        const connectData = await connectResp.json().catch(() => null);
        const qr = connectData?.instance?.qrcode || connectData?.qrcode || connectData?.qr || connectData?.base64 || null;

        if (qr) return respond({ success: true, qrCode: qr, instanceName: newInstanceName });
        return respond({ success: true, pendingQr: true, instanceName: newInstanceName, message: 'Instância criada, QR sendo gerado...' }, 202);
      } catch (e) {
        console.error('[QR] Auto-create failed:', e);
        return respond({ error: 'Não foi possível criar instância WhatsApp. Tente novamente.' }, 500);
      }
    }

    const instanceName = profile.whatsapp_instance_id;
    const instanceToken = profile.whatsapp_instance_token;
    console.log(`[QR] Instance: ${instanceName}, forceReset: ${forceReset}`);

    // Check instance status
    let state = 'unknown';
    try {
      const statusResp = await fetch(`${uazapiUrl}/instance/status`, {
        method: 'GET',
        headers: { 'token': instanceToken },
      });
      const statusData = await statusResp.json().catch(() => null);
      console.log(`[QR] Raw status:`, JSON.stringify(statusData).substring(0, 300));
      // UAZAPI returns status inside instance object or at top level
      state = statusData?.instance?.status || statusData?.status || statusData?.state || 'unknown';
      console.log(`[QR] Parsed state: ${state}`);
    } catch { /* ignore */ }

    if (state === 'connected') {
      return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
    }

    // If forceReset, disconnect first
    if (forceReset) {
      try {
        await fetch(`${uazapiUrl}/instance/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instanceToken },
          body: JSON.stringify({}),
        });
        await new Promise(r => setTimeout(r, 1000));
      } catch { /* ignore */ }
    }

    // Connect to get QR code
    try {
      const connectResp = await fetch(`${uazapiUrl}/instance/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instanceToken },
        body: JSON.stringify({}),
      });
      const connectData = await connectResp.json().catch(() => null);
      console.log(`[QR] Connect response keys: ${connectData ? Object.keys(connectData) : 'null'}`);
      console.log(`[QR] Instance keys: ${connectData?.instance ? Object.keys(connectData.instance) : 'none'}`);

      // UAZAPI returns QR inside instance.qrcode or at top level
      const qr = connectData?.instance?.qrcode || connectData?.qrcode || connectData?.qr || connectData?.base64 || null;
      if (qr) return respond({ success: true, qrCode: qr, instanceName });
    } catch (e) {
      console.error('[QR] Connect error:', e);
    }

    // QR not ready yet
    console.log('[QR] QR not available yet, returning pending');
    return respond({ success: true, pendingQr: true, instanceName, message: 'QR Code sendo gerado, aguarde...' }, 202);

  } catch (error: unknown) {
    console.error('[QR] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
