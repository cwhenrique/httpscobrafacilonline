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

    // Get Evolution API credentials from environment
    const rawEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!rawEvolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API not configured in environment');
      return new Response(JSON.stringify({ error: 'Evolution API não configurada no servidor' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Evolution API request helper with auth fallback (some deployments use different auth header)
    const evolutionFetch = async (
      url: string,
      init: RequestInit & { headers?: Record<string, string> } = {}
    ) => {
      const baseHeaders = (init.headers ?? {}) as Record<string, string>;

      // 1) Default: apikey header (official docs)
      let resp = await fetch(url, {
        ...init,
        headers: {
          ...baseHeaders,
          apikey: evolutionApiKey,
        },
      });

      // 2) Fallback: Authorization Bearer
      if (resp.status === 401) {
        resp = await fetch(url, {
          ...init,
          headers: {
            ...baseHeaders,
            Authorization: `Bearer ${evolutionApiKey}`,
          },
        });
      }

      // 3) Fallback: apikey as query param
      if (resp.status === 401) {
        const u = new URL(url);
        if (!u.searchParams.get('apikey')) u.searchParams.set('apikey', evolutionApiKey);
        resp = await fetch(u.toString(), {
          ...init,
          headers: {
            ...baseHeaders,
          },
        });
      }

      return resp;
    };

    // Clean the URL - extract just the base URL (protocol + host)
    const urlMatch = rawEvolutionApiUrl.match(/^(https?:\/\/[^\/]+)/);
    const evolutionApiUrl = urlMatch ? urlMatch[1] : rawEvolutionApiUrl;
    console.log('Raw EVOLUTION_API_URL:', rawEvolutionApiUrl);
    console.log('Cleaned base URL:', evolutionApiUrl);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user already has an instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar perfil' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique instance name using short userId
    const shortUserId = userId.substring(0, 8);
    const instanceName = profile?.whatsapp_instance_id || `cf_${shortUserId}`;

    console.log(`Creating/fetching instance: ${instanceName}`);

    // First, try to create the instance (if it already exists, Evolution API will return it)
    // Configure webhook URL for automatic reconnection
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-connection-webhook`;
    console.log('Configuring webhook URL:', webhookUrl);
    
    const createResponse = await evolutionFetch(`${evolutionApiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceName: instanceName,
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
          base64: true,
          events: [
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "MESSAGES_UPSERT",
            "connection.update",
            "qrcode.updated",
            "messages.upsert"
          ]
        }
      }),
    });

    const createText = await createResponse.text();
    console.log('Create instance response:', createResponse.status, createText);

    // Detect server offline (502/503 = service unreachable)
    if (createResponse.status === 502 || createResponse.status === 503) {
      console.error('Evolution API server is offline:', createText);
      return new Response(
        JSON.stringify({
          error: 'Servidor WhatsApp temporariamente indisponível. Tente novamente em alguns minutos.',
          serverOffline: true,
          instanceName,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (createResponse.status === 401) {
      return new Response(
        JSON.stringify({
          error:
            'Não autorizado na Evolution API ao criar instância. Verifique se a chave (EVOLUTION_API_KEY) tem permissão para criar instâncias.',
          instanceName,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let qrCodeBase64 = null;

    // If instance was created or already exists, try to get QR code (fast-path)
    if (createResponse.ok || createResponse.status === 403) {
      // First, check instance state
      const stateResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
        method: 'GET',
      });

      const stateText = await stateResponse.text();
      console.log('State check response:', stateResponse.status, stateText);

      let instanceState = null;
      try {
        const stateData = JSON.parse(stateText);
        instanceState = stateData.instance?.state || stateData.state;
        console.log('Instance state:', instanceState);
        
        // If already connected, return success
        if (instanceState === 'open' || instanceState === 'connected') {
          return new Response(
            JSON.stringify({
              success: true,
              alreadyConnected: true,
              message: 'WhatsApp já está conectado',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (e) {
        console.error('Error parsing state response:', e);
      }

      // If instance is 'close' or undefined, we need to do logout first to reset
      if (instanceState === 'close' || !instanceState) {
        console.log('Instance is closed or undefined, doing logout first...');
        try {
          const logoutResponse = await evolutionFetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
            method: 'DELETE',
          });
          console.log('Logout response:', logoutResponse.status);
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) {
          console.log('Logout attempt error (continuing anyway):', e);
        }
      }

      // Try to connect and get QR code
      const connectResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
      });

      const connectText = await connectResponse.text();
      console.log('Connect instance response:', connectResponse.status, connectText);

      if (connectResponse.ok) {
        try {
          const connectData = JSON.parse(connectText);
          
          // Check for error in response body
          if (connectData.error === true) {
            console.log('Connect returned error, trying restart...');
          } else if (connectData.base64) {
            qrCodeBase64 = connectData.base64;
          } else if (connectData.code) {
            qrCodeBase64 = connectData.code;
          } else if (connectData.qrcode?.base64) {
            qrCodeBase64 = connectData.qrcode.base64;
          } else if (connectData.instance?.state === 'open') {
            return new Response(
              JSON.stringify({
                success: true,
                alreadyConnected: true,
                message: 'WhatsApp já está conectado',
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        } catch (e) {
          console.error('Error parsing connect response:', e);
        }
      }

      // IMPORTANT: não tente loops longos de restart/delete aqui.
      // Se o QR ainda não estiver pronto, o frontend fará polling via whatsapp-get-qrcode.
    }

    // Save instance ID to profile if new
    if (!profile?.whatsapp_instance_id) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          whatsapp_instance_id: instanceName,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile with instance:', updateError);
      }
    }

    // Check if webhook delivered a QR code
    if (!qrCodeBase64) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const { data: qrRow } = await supabase
        .from('whatsapp_qr_codes')
        .select('qr_code')
        .eq('instance_name', instanceName)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (qrRow?.qr_code) {
        console.log('Found QR code from webhook!');
        qrCodeBase64 = qrRow.qr_code;
      }
    }

    if (qrCodeBase64) {
      return new Response(
        JSON.stringify({
          success: true,
          instanceName,
          qrCode: qrCodeBase64,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // QR ainda não disponível: responda rápido para não estourar timeout.
    return new Response(
      JSON.stringify({
        success: true,
        instanceName,
        pendingQr: true,
        message: 'QR Code ainda está sendo gerado. Aguarde alguns segundos...',
      }),
      {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error in whatsapp-create-instance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
