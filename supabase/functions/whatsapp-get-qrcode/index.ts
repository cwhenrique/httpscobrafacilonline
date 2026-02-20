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
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!rawEvolutionApiUrl || !evolutionApiKey) {
      return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const urlMatch = rawEvolutionApiUrl.match(/^(https?:\/\/[^\/]+)/);
    const evolutionApiUrl = urlMatch ? urlMatch[1] : rawEvolutionApiUrl;
    console.log('Using Evolution API base URL:', evolutionApiUrl);

    // Evolution API request helper with auth fallback
    const evolutionFetch = async (
      url: string,
      init: RequestInit & { headers?: Record<string, string> } = {}
    ) => {
      const baseHeaders = (init.headers ?? {}) as Record<string, string>;

      let resp = await fetch(url, {
        ...init,
        headers: { ...baseHeaders, apikey: evolutionApiKey },
      });

      if (resp.status === 401) {
        resp = await fetch(url, {
          ...init,
          headers: { ...baseHeaders, Authorization: `Bearer ${evolutionApiKey}` },
        });
      }

      if (resp.status === 401) {
        const u = new URL(url);
        if (!u.searchParams.get('apikey')) u.searchParams.set('apikey', evolutionApiKey);
        resp = await fetch(u.toString(), { ...init, headers: baseHeaders });
      }

      return resp;
    };

    // Safe JSON parse helper
    const safeJsonParse = async (resp: Response): Promise<{ ok: boolean; data?: any; text?: string }> => {
      const contentType = resp.headers.get('content-type') || '';
      const text = await resp.text();
      
      if (!contentType.includes('application/json') && (text.trim().startsWith('<!') || text.includes('<html'))) {
        console.error('API returned HTML instead of JSON. Status:', resp.status, 'Preview:', text.substring(0, 200));
        return { ok: false, text };
      }
      
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch {
        console.error('Failed to parse JSON:', text.substring(0, 200));
        return { ok: false, text };
      }
    };

    // Extract QR code from response data
    const extractQR = (data: any): string | null => {
      if (data?.base64) return data.base64;
      if (data?.qrcode?.base64) return data.qrcode.base64;
      if (data?.qr) return data.qr;
      return null;
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.whatsapp_instance_id) {
      return new Response(JSON.stringify({ error: 'Instância WhatsApp não encontrada. Conecte primeiro.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceName = profile.whatsapp_instance_id;
    console.log(`Getting QR code for instance: ${instanceName}, forceReset: ${forceReset}`);

    // Helper: try to connect and get QR
    const tryConnect = async (name: string): Promise<string | null> => {
      const resp = await evolutionFetch(`${evolutionApiUrl}/instance/connect/${name}`, { method: 'GET' });
      if (!resp.ok) {
        console.log('Connect failed with status:', resp.status);
        return null;
      }
      const parsed = await safeJsonParse(resp);
      if (!parsed.ok) return null;
      
      const qr = extractQR(parsed.data);
      if (qr) return qr;
      
      // Check if already connected
      if (parsed.data?.instance?.state === 'open') return 'ALREADY_CONNECTED';
      
      console.log('Connect response had no QR:', JSON.stringify(parsed.data).substring(0, 200));
      return null;
    };

    // Helper: delete and recreate instance, then get QR
    const recreateInstance = async (name: string): Promise<string | null> => {
      console.log(`Recreating instance: ${name}`);
      
      // Delete existing instance
      try {
        const delResp = await evolutionFetch(`${evolutionApiUrl}/instance/delete/${name}`, { method: 'DELETE' });
        console.log('Delete response:', delResp.status);
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.log('Delete error (continuing):', e);
      }

      // Recreate instance
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-connection-webhook`;
      const createResp = await evolutionFetch(`${evolutionApiUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: name,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: {
            url: webhookUrl,
            byEvents: true,
            base64: true,
            events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED'],
          },
        }),
      });

      if (!createResp.ok) {
        console.error('Create instance failed:', createResp.status);
        const text = await createResp.text();
        console.error('Create response:', text.substring(0, 300));
        return null;
      }

      const parsed = await safeJsonParse(createResp);
      if (!parsed.ok) return null;

      const qr = extractQR(parsed.data);
      if (qr) {
        console.log('Got QR from create response');
        return qr;
      }

      // If create didn't return QR, try connect
      await new Promise(r => setTimeout(r, 1500));
      return await tryConnect(name);
    };

    // Step 1: Check current state
    const stateResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, { method: 'GET' });

    let currentState = 'unknown';
    if (stateResponse.ok) {
      const parsed = await safeJsonParse(stateResponse);
      if (parsed.ok) {
        currentState = parsed.data?.instance?.state || parsed.data?.state || 'unknown';
      }
    }
    console.log('Current state:', currentState);

    // Already connected
    if (currentState === 'open') {
      return new Response(JSON.stringify({ 
        success: true, alreadyConnected: true, message: 'WhatsApp já está conectado'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 2: If connecting or forceReset, do logout first
    if (currentState === 'connecting' || forceReset) {
      console.log('Doing logout first...');
      try {
        const logoutResp = await evolutionFetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, { method: 'DELETE' });
        console.log('Logout response:', logoutResp.status);
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.log('Logout error (continuing):', e);
      }
    }

    // Step 3: Try connect
    let qrCode = await tryConnect(instanceName);

    if (qrCode === 'ALREADY_CONNECTED') {
      return new Response(JSON.stringify({ 
        success: true, alreadyConnected: true, message: 'WhatsApp já está conectado'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 4: If no QR, try restart then connect
    if (!qrCode) {
      console.log('No QR from connect, trying restart...');
      try {
        const restartResp = await evolutionFetch(`${evolutionApiUrl}/instance/restart/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        console.log('Restart response:', restartResp.status);
        
        if (restartResp.ok) {
          await new Promise(r => setTimeout(r, 2000));
          qrCode = await tryConnect(instanceName);
          if (qrCode === 'ALREADY_CONNECTED') {
            return new Response(JSON.stringify({ 
              success: true, alreadyConnected: true, message: 'WhatsApp já está conectado'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      } catch (e) {
        console.error('Restart error:', e);
      }
    }

    // Step 5: If still no QR, recreate the instance entirely
    if (!qrCode) {
      console.log('Still no QR after restart, recreating instance...');
      qrCode = await recreateInstance(instanceName);
      if (qrCode === 'ALREADY_CONNECTED') {
        return new Response(JSON.stringify({ 
          success: true, alreadyConnected: true, message: 'WhatsApp já está conectado'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (qrCode) {
      return new Response(JSON.stringify({ 
        success: true, qrCode, instanceName
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'QR Code não disponível. Tente novamente em alguns segundos.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in whatsapp-get-qrcode:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
