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

    const rawEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!rawEvolutionApiUrl || !evolutionApiKey) {
      return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = (rawEvolutionApiUrl.match(/^(https?:\/\/[^\/]+)/) || [])[1] || rawEvolutionApiUrl;

    const evoFetch = async (url: string, init: RequestInit = {}) => {
      const h = ((init as any).headers ?? {}) as Record<string, string>;
      let r = await fetch(url, { ...init, headers: { ...h, apikey: evolutionApiKey } });
      if (r.status === 401) r = await fetch(url, { ...init, headers: { ...h, Authorization: `Bearer ${evolutionApiKey}` } });
      return r;
    };

    const respond = (body: any, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Extract QR from any response shape
    const findQR = (d: any): string | null => {
      if (!d || typeof d !== 'object') return null;
      for (const k of ['base64', 'qr']) {
        if (typeof d[k] === 'string' && d[k].length > 100) return d[k];
      }
      if (d.qrcode && typeof d.qrcode === 'object') {
        if (typeof d.qrcode.base64 === 'string' && d.qrcode.base64.length > 100) return d.qrcode.base64;
        if (typeof d.qrcode.code === 'string' && d.qrcode.code.length > 10) return d.qrcode.code;
        if (typeof d.qrcode.qr === 'string' && d.qrcode.qr.length > 10) return d.qrcode.qr;
      }
      if (typeof d.qrcode === 'string' && d.qrcode.length > 20) return d.qrcode;
      if (typeof d.code === 'string' && d.code.length > 10 && !d.code.includes('{')) return d.code;
      return null;
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: profile } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id')
      .eq('id', userId)
      .single();

    if (!profile?.whatsapp_instance_id) {
      return respond({ error: 'Instância WhatsApp não encontrada. Conecte primeiro.' }, 404);
    }

    const instanceName = profile.whatsapp_instance_id;
    console.log(`[QR] Instance: ${instanceName}, forceReset: ${forceReset}`);

    // ── Step 1: Check webhook QR table (fastest path) ──
    const { data: qrRow } = await supabase
      .from('whatsapp_qr_codes')
      .select('qr_code')
      .eq('instance_name', instanceName)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (qrRow?.qr_code) {
      console.log('[QR] Found QR from webhook table');
      return respond({ success: true, qrCode: qrRow.qr_code, instanceName });
    }

    // ── Step 2: Check instance state ──
    let state = 'unknown';
    try {
      const r = await evoFetch(`${baseUrl}/instance/connectionState/${instanceName}`);
      if (r.status === 404) {
        await r.text();
        state = 'not_found';
      } else {
        const d = await r.json().catch(() => null);
        state = d?.instance?.state || d?.state || 'unknown';
      }
    } catch { /* ignore */ }

    console.log(`[QR] State: ${state}`);

    if (state === 'open' || state === 'connected') {
      return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
    }

    // ── Step 3: If forceReset, do logout first ──
    if (forceReset && state !== 'not_found') {
      try {
        await evoFetch(`${baseUrl}/instance/logout/${instanceName}`, { method: 'DELETE' }).then(r => r.text());
        await new Promise(r => setTimeout(r, 1000));
      } catch { /* ignore */ }
    }

    // ── Step 4: If instance not found, create it ──
    if (state === 'not_found') {
      console.log('[QR] Creating instance...');
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-connection-webhook`;
      try {
        const r = await evoFetch(`${baseUrl}/instance/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
            webhook: {
              enabled: true,
              url: webhookUrl,
              byEvents: false,
              base64: true,
              events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED', 'MESSAGES_UPSERT',
                       'connection.update', 'qrcode.updated', 'messages.upsert']
            },
          }),
        });
        const d = await r.json().catch(() => null);
        console.log(`[QR] Create status: ${r.status}`);
        const qr = findQR(d);
        if (qr) return respond({ success: true, qrCode: qr, instanceName });
      } catch (e) {
        console.error('[QR] Create error:', e);
      }

      // Wait briefly for async QR generation then check webhook table
      await new Promise(r => setTimeout(r, 3000));
      const { data: qr2 } = await supabase
        .from('whatsapp_qr_codes')
        .select('qr_code')
        .eq('instance_name', instanceName)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (qr2?.qr_code) return respond({ success: true, qrCode: qr2.qr_code, instanceName });
    }

    // ── Step 5: Call connect endpoint (main QR source) ──
    try {
      const r = await evoFetch(`${baseUrl}/instance/connect/${instanceName}`);
      const d = await r.json().catch(() => null);
      console.log(`[QR] Connect status: ${r.status}, keys: ${d ? Object.keys(d) : 'null'}`);

      if (d?.instance?.state === 'open') {
        return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
      }

      const qr = findQR(d);
      if (qr) return respond({ success: true, qrCode: qr, instanceName });
    } catch (e) {
      console.error('[QR] Connect error:', e);
    }

    // ── Step 6: Try fetchInstances as alternative QR source ──
    try {
      const r = await evoFetch(`${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`);
      if (r.ok) {
        const d = await r.json().catch(() => null);
        const instances = Array.isArray(d) ? d : [d];
        for (const inst of instances) {
          if (inst?.instance?.state === 'open') {
            return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
          }
          const qr = findQR(inst);
          if (qr) return respond({ success: true, qrCode: qr, instanceName });
        }
      }
    } catch { /* ignore */ }

    // ── QR not ready yet - tell frontend to keep polling ──
    console.log('[QR] QR not available yet, returning pending');
    return respond({ success: true, pendingQr: true, instanceName, message: 'QR Code sendo gerado, aguarde...' }, 202);

  } catch (error: unknown) {
    console.error('[QR] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
