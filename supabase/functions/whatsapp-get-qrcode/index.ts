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
      if (!data || typeof data !== 'object') return null;
      // Skip empty/error responses
      if (data.count === 0) return null;
      if (data.error === true) return null;
      if (data.base64) return data.base64;
      if (data.qrcode?.base64) return data.qrcode.base64;
      if (data.qrcode?.pairingCode) return null; // pairing code, not QR image
      if (data.qr) return data.qr;
      if (typeof data.qrcode === 'string' && data.qrcode.length > 100) return data.qrcode;
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

    const jsonHeaders = { 'Content-Type': 'application/json' };
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-connection-webhook`;

    // Helper: try to connect and get QR
    const tryConnect = async (name: string): Promise<string | null> => {
      try {
        const resp = await evolutionFetch(`${evolutionApiUrl}/instance/connect/${name}`, { method: 'GET' });
        console.log(`Connect status for ${name}: ${resp.status}`);
        if (!resp.ok) return null;
        const parsed = await safeJsonParse(resp);
        if (!parsed.ok) return null;
        
        const qr = extractQR(parsed.data);
        if (qr) return qr;
        
        // Check if already connected
        if (parsed.data?.instance?.state === 'open') return 'ALREADY_CONNECTED';
        
        console.log('Connect response had no QR:', JSON.stringify(parsed.data).substring(0, 300));
        return null;
      } catch (e) {
        console.error('Connect error:', e);
        return null;
      }
    };

    // Helper: logout instance safely
    const doLogout = async (name: string) => {
      try {
        const resp = await evolutionFetch(`${evolutionApiUrl}/instance/logout/${name}`, { method: 'DELETE' });
        console.log(`Logout ${name}: ${resp.status}`);
        await resp.text(); // consume body
      } catch (e) {
        console.log('Logout error (continuing):', e);
      }
    };

    // Helper: delete instance with retries
    const doDelete = async (name: string) => {
      try {
        // First logout to clean session
        await doLogout(name);
        await new Promise(r => setTimeout(r, 500));
        
        const resp = await evolutionFetch(`${evolutionApiUrl}/instance/delete/${name}`, { method: 'DELETE' });
        console.log(`Delete ${name}: ${resp.status}`);
        await resp.text(); // consume body
        
        // Wait for deletion to propagate
        await new Promise(r => setTimeout(r, 2000));
        
        // Verify deletion by checking if instance still exists
        const checkResp = await evolutionFetch(`${evolutionApiUrl}/instance/connectionState/${name}`, { method: 'GET' });
        if (checkResp.status === 404) {
          console.log(`Instance ${name} confirmed deleted`);
        } else {
          console.log(`Instance ${name} may still exist (status ${checkResp.status}), trying delete again`);
          await checkResp.text();
          const resp2 = await evolutionFetch(`${evolutionApiUrl}/instance/delete/${name}`, { method: 'DELETE' });
          console.log(`Second delete attempt: ${resp2.status}`);
          await resp2.text();
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {
        console.log('Delete error (continuing):', e);
      }
    };

    // Helper: create a fresh instance and get QR
    const createAndConnect = async (name: string): Promise<string | null> => {
      console.log(`Creating instance: ${name}`);
      const createResp = await evolutionFetch(`${evolutionApiUrl}/instance/create`, {
        method: 'POST',
        headers: jsonHeaders,
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

      console.log(`Create instance status: ${createResp.status}`);
      
      if (createResp.status === 403) {
        // Instance name already exists - try to just connect to it
        const body = await createResp.text();
        console.log('Create 403 (already exists):', body.substring(0, 200));
        // Instance exists but we couldn't delete it - try connect directly
        await new Promise(r => setTimeout(r, 1000));
        return await tryConnect(name);
      }
      
      if (!createResp.ok) {
        const text = await createResp.text();
        console.error('Create instance failed:', createResp.status, text.substring(0, 300));
        return null;
      }

      const parsed = await safeJsonParse(createResp);
      if (!parsed.ok) return null;

      const qr = extractQR(parsed.data);
      if (qr) {
        console.log('Got QR from create response');
        return qr;
      }

      // If create didn't return QR, wait and try connect
      await new Promise(r => setTimeout(r, 2000));
      return await tryConnect(name);
    };

    // Helper: full recreate (delete + create)
    const recreateInstance = async (name: string): Promise<string | null> => {
      console.log(`Full recreate for: ${name}`);
      await doDelete(name);
      return await createAndConnect(name);
    };

    // ===== MAIN FLOW =====

    // Step 1: Check current state
    let currentState = 'unknown';
    try {
      const stateResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, { method: 'GET' });
      if (stateResponse.ok) {
        const parsed = await safeJsonParse(stateResponse);
        if (parsed.ok) {
          currentState = parsed.data?.instance?.state || parsed.data?.state || 'unknown';
        }
      } else {
        // 404 means instance doesn't exist - we'll create it
        const text = await stateResponse.text();
        if (stateResponse.status === 404) currentState = 'not_found';
        console.log(`State check status ${stateResponse.status}: ${text.substring(0, 100)}`);
      }
    } catch (e) {
      console.log('State check error:', e);
    }
    console.log('Current state:', currentState);

    // Already connected
    if (currentState === 'open') {
      return new Response(JSON.stringify({ 
        success: true, alreadyConnected: true, message: 'WhatsApp já está conectado'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 2: Instance doesn't exist - create fresh
    if (currentState === 'not_found') {
      console.log('Instance not found, creating fresh...');
      const qrCode = await createAndConnect(instanceName);
      if (qrCode === 'ALREADY_CONNECTED') {
        return new Response(JSON.stringify({ 
          success: true, alreadyConnected: true, message: 'WhatsApp já está conectado'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (qrCode) {
        return new Response(JSON.stringify({ 
          success: true, qrCode, instanceName
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Step 3: If connecting, close, or forceReset - logout first then try connect
    if (currentState === 'connecting' || currentState === 'close' || forceReset) {
      console.log(`State is ${currentState}, doing logout first...`);
      await doLogout(instanceName);
      await new Promise(r => setTimeout(r, 1500));
    }

    // Step 4: Try simple connect
    let qrCode = await tryConnect(instanceName);
    if (qrCode === 'ALREADY_CONNECTED') {
      return new Response(JSON.stringify({ 
        success: true, alreadyConnected: true, message: 'WhatsApp já está conectado'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 5: If no QR, try restart then connect
    if (!qrCode) {
      console.log('No QR from connect, trying restart...');
      try {
        const restartResp = await evolutionFetch(`${evolutionApiUrl}/instance/restart/${instanceName}`, {
          method: 'POST',
          headers: jsonHeaders,
        });
        console.log('Restart response:', restartResp.status);
        await restartResp.text(); // consume body
        
        if (restartResp.ok) {
          await new Promise(r => setTimeout(r, 3000));
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

    // Step 6: If still no QR, full recreate
    if (!qrCode) {
      console.log('Still no QR after restart, doing full recreate...');
      qrCode = await recreateInstance(instanceName);
      if (qrCode === 'ALREADY_CONNECTED') {
        return new Response(JSON.stringify({ 
          success: true, alreadyConnected: true, message: 'WhatsApp já está conectado'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Step 7: Last resort - create with a new unique name
    if (!qrCode) {
      const newName = `${instanceName.split('_').slice(0, 2).join('_')}_${Date.now().toString(36)}`;
      console.log(`Last resort: creating new instance with name ${newName}`);
      qrCode = await createAndConnect(newName);
      
      if (qrCode && qrCode !== 'ALREADY_CONNECTED') {
        // Update profile with new instance name
        await supabase
          .from('profiles')
          .update({ whatsapp_instance_id: newName })
          .eq('id', userId);
        console.log(`Updated profile with new instance name: ${newName}`);
      }
      
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
