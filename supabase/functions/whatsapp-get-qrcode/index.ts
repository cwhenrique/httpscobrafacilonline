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

    // Clean the URL - extract just the base URL (protocol + host)
    const urlMatch = rawEvolutionApiUrl.match(/^(https?:\/\/[^\/]+)/);
    const evolutionApiUrl = urlMatch ? urlMatch[1] : rawEvolutionApiUrl;
    console.log('Using Evolution API base URL:', evolutionApiUrl);
    console.log('API Key prefix:', evolutionApiKey.substring(0, 8) + '...');

    // Evolution API request helper with auth fallback
    const evolutionFetch = async (
      url: string,
      init: RequestInit & { headers?: Record<string, string> } = {}
    ) => {
      const baseHeaders = (init.headers ?? {}) as Record<string, string>;

      // Try 1: apikey header
      let resp = await fetch(url, {
        ...init,
        headers: {
          ...baseHeaders,
          apikey: evolutionApiKey,
        },
      });

      if (resp.status === 401) {
        console.log('Auth failed with apikey header, trying Bearer token...');
        // Try 2: Authorization Bearer header
        resp = await fetch(url, {
          ...init,
          headers: {
            ...baseHeaders,
            Authorization: `Bearer ${evolutionApiKey}`,
          },
        });
      }

      if (resp.status === 401) {
        console.log('Auth failed with Bearer, trying query param...');
        // Try 3: apikey as query parameter
        const u = new URL(url);
        if (!u.searchParams.get('apikey')) u.searchParams.set('apikey', evolutionApiKey);
        resp = await fetch(u.toString(), {
          ...init,
          headers: baseHeaders,
        });
      }

      return resp;
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's instance name
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

    // First, check current state
    const stateResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
    });

    if (stateResponse.ok) {
      const stateData = await stateResponse.json();
      const state = stateData?.instance?.state || stateData?.state;
      console.log('Current state:', state);

      // If already connected, no need for QR
      if (state === 'open') {
        return new Response(JSON.stringify({ 
          success: true, 
          alreadyConnected: true,
          message: 'WhatsApp já está conectado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If stuck in connecting state or force reset requested, do a logout first
      if (state === 'connecting' || forceReset) {
        console.log('Instance is stuck in connecting state or reset requested, doing logout first...');
        
        try {
          const logoutResponse = await evolutionFetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
            method: 'DELETE',
          });
          console.log('Logout response:', logoutResponse.status);
          
          // Wait a bit for logout to take effect
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) {
          console.log('Logout attempt error (continuing anyway):', e);
        }
      }
    }

    // Get new QR code by connecting
    console.log('Requesting new QR code...');
    const connectResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
    });

    const connectText = await connectResponse.text();
    console.log('Connect response:', connectResponse.status, connectText.substring(0, 200));

    if (!connectResponse.ok) {
      // If connect fails, try to restart the instance first
      console.log('Connect failed, trying restart...');
      
      try {
        const restartResponse = await evolutionFetch(`${evolutionApiUrl}/instance/restart/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        console.log('Restart response:', restartResponse.status);
        
        if (restartResponse.ok) {
          // Wait for restart
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try connect again
          const retryConnectResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
          });
          
          if (retryConnectResponse.ok) {
            const retryData = await retryConnectResponse.json();
            
            if (retryData.base64) {
              return new Response(JSON.stringify({ 
                success: true, 
                qrCode: retryData.base64,
                instanceName,
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        }
      } catch (restartError) {
        console.error('Restart error:', restartError);
      }

      return new Response(JSON.stringify({ error: 'Erro ao obter QR Code. Tente novamente.' }), {
        status: connectResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const connectData = JSON.parse(connectText);
      
      if (connectData.base64) {
        console.log('Successfully got QR code');
        return new Response(JSON.stringify({ 
          success: true, 
          qrCode: connectData.base64,
          instanceName,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (connectData.instance?.state === 'open') {
        return new Response(JSON.stringify({ 
          success: true, 
          alreadyConnected: true,
          message: 'WhatsApp já está conectado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If we got here but no QR, the instance might need a restart
      console.log('No QR code in response, attempting restart...');
      
      try {
        await evolutionFetch(`${evolutionApiUrl}/instance/restart/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const retryResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
        });
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.base64) {
            return new Response(JSON.stringify({ 
              success: true, 
              qrCode: retryData.base64,
              instanceName,
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (e) {
        console.error('Retry error:', e);
      }

      return new Response(JSON.stringify({ error: 'QR Code não disponível. Tente novamente em alguns segundos.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (e) {
      console.error('Error parsing response:', e);
      return new Response(JSON.stringify({ error: 'Erro ao processar resposta' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Error in whatsapp-get-qrcode:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
