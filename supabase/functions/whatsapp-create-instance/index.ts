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
        // Configurações para manter conexão PERSISTENTE
        rejectCall: false,
        readMessages: false,  // Não marcar mensagens como lidas automaticamente
        readStatus: false,    // Não marcar status como lido
        alwaysOnline: true,   // ✅ MANTER SEMPRE ONLINE - conexão persistente
        syncFullHistory: false,
        // ✅ Webhook para notificação de mudanças de conexão e mensagens recebidas
        webhook: {
          url: webhookUrl,
          byEvents: true,
          base64: false,
          events: [
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "MESSAGES_UPSERT"
          ]
        }
      }),
    });

    const createText = await createResponse.text();
    console.log('Create instance response:', createResponse.status, createText);

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

    // If instance was created or already exists, try to get QR code
    if (createResponse.ok || createResponse.status === 403) {
      const connectResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
      });

      const connectText = await connectResponse.text();
      console.log('Connect instance response:', connectResponse.status, connectText);

      if (connectResponse.ok) {
        try {
          const connectData = JSON.parse(connectText);
          if (connectData.base64) {
            qrCodeBase64 = connectData.base64;
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

    return new Response(
      JSON.stringify({
        error: 'Não foi possível gerar o QR Code. Tente novamente.',
        instanceName,
      }),
      {
        status: 500,
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
