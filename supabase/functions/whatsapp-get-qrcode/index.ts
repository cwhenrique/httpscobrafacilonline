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
    console.log('Base URL:', baseUrl);

    const evoFetch = async (url: string, init: RequestInit = {}) => {
      const h = ((init as any).headers ?? {}) as Record<string, string>;
      let r = await fetch(url, { ...init, headers: { ...h, apikey: evolutionApiKey } });
      if (r.status === 401) r = await fetch(url, { ...init, headers: { ...h, Authorization: `Bearer ${evolutionApiKey}` } });
      return r;
    };

    const json = async (r: Response) => {
      const t = await r.text();
      try { return JSON.parse(t); } catch { return null; }
    };

    // Deep extract QR from any response shape (base64 image OR raw QR string)
    const findQR = (d: any): string | null => {
      if (!d || typeof d !== 'object') return null;
      // Direct base64 fields (long strings = base64 image)
      for (const k of ['base64', 'qr']) {
        if (typeof d[k] === 'string' && d[k].length > 100) return d[k];
      }
      // Nested qrcode object
      if (d.qrcode && typeof d.qrcode === 'object') {
        if (typeof d.qrcode.base64 === 'string' && d.qrcode.base64.length > 100) return d.qrcode.base64;
        // Raw QR code string (e.g. "2@abc..." typically 20-300 chars) - accept shorter strings
        if (typeof d.qrcode.code === 'string' && d.qrcode.code.length > 10) return d.qrcode.code;
        if (typeof d.qrcode.qr === 'string' && d.qrcode.qr.length > 10) return d.qrcode.qr;
      }
      if (typeof d.qrcode === 'string' && d.qrcode.length > 20) return d.qrcode;
      // Check code at top level
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
      return new Response(JSON.stringify({ error: 'Instância WhatsApp não encontrada. Conecte primeiro.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceName = profile.whatsapp_instance_id;
    console.log(`Instance: ${instanceName}, forceReset: ${forceReset}`);

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const respond = (body: any, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-connection-webhook`;

    // ─── Get state ───
    const getState = async (name: string): Promise<string> => {
      try {
        const r = await evoFetch(`${baseUrl}/instance/connectionState/${name}`);
        if (r.status === 404) { await r.text(); return 'not_found'; }
        const d = await json(r);
        return d?.instance?.state || d?.state || 'unknown';
      } catch { return 'unknown'; }
    };

    // ─── Try connect endpoint ───
    const tryConnect = async (name: string): Promise<string | null> => {
      try {
        const r = await evoFetch(`${baseUrl}/instance/connect/${name}`);
        if (!r.ok) { await r.text(); return null; }
        const d = await json(r);
        if (!d) return null;
        if (d.instance?.state === 'open') return 'CONNECTED';
        const qr = findQR(d);
        if (qr) return qr;
        console.log(`Connect returned: ${JSON.stringify(d).substring(0, 200)}`);
        return null;
      } catch { return null; }
    };

    // ─── Fetch instance info (alternative QR source) ───
    const fetchInstanceQR = async (name: string): Promise<string | null> => {
      try {
        const r = await evoFetch(`${baseUrl}/instance/fetchInstances?instanceName=${name}`);
        if (!r.ok) { await r.text(); return null; }
        const d = await json(r);
        if (!d) return null;
        
        // fetchInstances can return array or object
        const instances = Array.isArray(d) ? d : [d];
        for (const inst of instances) {
          console.log(`fetchInstances state: ${inst?.instance?.state}, has qrcode: ${!!inst?.qrcode}`);
          if (inst?.instance?.state === 'open') return 'CONNECTED';
          
          // Log qrcode field details
          if (inst?.qrcode) {
            const qrType = typeof inst.qrcode;
            const qrPreview = qrType === 'string' ? inst.qrcode.substring(0, 100) : JSON.stringify(inst.qrcode).substring(0, 300);
            console.log(`fetchInstances qrcode type: ${qrType}, preview: ${qrPreview}`);
          }
          
          const qr = findQR(inst);
          if (qr) return qr;
        }
        return null;
      } catch (e) { console.error('fetchInstances error:', e); return null; }
    };

    // ─── Create instance ───
    const createInstance = async (name: string): Promise<string | null> => {
      console.log(`Creating: ${name}`);
      const r = await evoFetch(`${baseUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: name,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: { url: webhookUrl, byEvents: true, base64: true, events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED'] },
        }),
      });
      console.log(`Create status: ${r.status}`);
      if (r.status === 403) { await r.text(); return null; }
      if (!r.ok) { await r.text(); return null; }
      const d = await json(r);
      if (!d) return null;
      
      // Log the qrcode field from create response
      if (d.qrcode !== undefined) {
        const preview = typeof d.qrcode === 'string' ? d.qrcode.substring(0, 200) : JSON.stringify(d.qrcode).substring(0, 500);
        console.log(`Create qrcode type: ${typeof d.qrcode}, preview: ${preview}`);
      }
      
      return findQR(d);
    };

    // ─── Delete instance ───
    const deleteInstance = async (name: string) => {
      try {
        await evoFetch(`${baseUrl}/instance/logout/${name}`, { method: 'DELETE' }).then(r => r.text()).catch(() => {});
        await delay(500);
        const r = await evoFetch(`${baseUrl}/instance/delete/${name}`, { method: 'DELETE' });
        console.log(`Delete ${name}: ${r.status}`);
        await r.text();
        await delay(2000);
      } catch {}
    };

    // ═══════════════════ MAIN FLOW ═══════════════════

    const state = await getState(instanceName);
    console.log('State:', state);

    if (state === 'open') {
      return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
    }

    // If forceReset or stuck, cleanup
    if (forceReset || state === 'connecting' || state === 'close') {
      await evoFetch(`${baseUrl}/instance/logout/${instanceName}`, { method: 'DELETE' }).then(r => r.text()).catch(() => {});
      await delay(1500);
    }

    // ─── Strategy 1: Simple connect ───
    if (state !== 'not_found') {
      let qr = await tryConnect(instanceName);
      if (qr === 'CONNECTED') return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
      if (qr) return respond({ success: true, qrCode: qr, instanceName });

      // Try fetchInstances as alternative QR source
      await delay(2000);
      qr = await fetchInstanceQR(instanceName);
      if (qr === 'CONNECTED') return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
      if (qr) return respond({ success: true, qrCode: qr, instanceName });
    }

    // ─── Strategy 2: Restart + connect ───
    if (state !== 'not_found') {
      console.log('Restarting...');
      const rr = await evoFetch(`${baseUrl}/instance/restart/${instanceName}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      console.log('Restart:', rr.status);
      await rr.text();
      
      if (rr.ok) {
        await delay(3000);
        let qr = await tryConnect(instanceName);
        if (qr === 'CONNECTED') return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
        if (qr) return respond({ success: true, qrCode: qr, instanceName });

        // Try fetchInstances after restart
        await delay(2000);
        qr = await fetchInstanceQR(instanceName);
        if (qr === 'CONNECTED') return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
        if (qr) return respond({ success: true, qrCode: qr, instanceName });
      }
    }

    // ─── Strategy 3: Delete + recreate ───
    console.log('Recreating...');
    await deleteInstance(instanceName);
    
    let qr = await createInstance(instanceName);
    if (qr) return respond({ success: true, qrCode: qr, instanceName });

    // Wait for QR to generate, then try connect + fetchInstances
    await delay(3000);
    qr = await tryConnect(instanceName);
    if (qr === 'CONNECTED') return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
    if (qr) return respond({ success: true, qrCode: qr, instanceName });

    await delay(2000);
    qr = await fetchInstanceQR(instanceName);
    if (qr === 'CONNECTED') return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
    if (qr) return respond({ success: true, qrCode: qr, instanceName });

    // ─── Strategy 4: Brand new name ───
    const newName = `cf_${userId.substring(0, 8)}_${Date.now().toString(36)}`;
    console.log(`New name: ${newName}`);
    
    qr = await createInstance(newName);
    if (qr) {
      await supabase.from('profiles').update({ whatsapp_instance_id: newName }).eq('id', userId);
      return respond({ success: true, qrCode: qr, instanceName: newName });
    }

    await delay(3000);
    qr = await tryConnect(newName);
    if (!qr) { await delay(2000); qr = await fetchInstanceQR(newName); }
    
    if (qr && qr !== 'CONNECTED') {
      await supabase.from('profiles').update({ whatsapp_instance_id: newName }).eq('id', userId);
      return respond({ success: true, qrCode: qr, instanceName: newName });
    }
    if (qr === 'CONNECTED') {
      await supabase.from('profiles').update({ whatsapp_instance_id: newName }).eq('id', userId);
      return respond({ success: true, alreadyConnected: true, message: 'WhatsApp já está conectado' });
    }

    return respond({ error: 'QR Code não disponível. Tente novamente em alguns segundos.' }, 500);

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
