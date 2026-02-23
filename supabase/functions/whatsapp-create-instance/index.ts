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

    const uazapiUrl = Deno.env.get('UAZAPI_URL');
    const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN');

    if (!uazapiUrl || !adminToken) {
      console.error('UAZAPI not configured');
      return new Response(JSON.stringify({ error: 'UAZAPI não configurada no servidor' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Check if user already has an instance with token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_instance_token, email')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar perfil' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Restrict to authorized email only
    const allowedEmails = ['cw@gmail.com', 'contatodiegoreiis@gmail.com'];
    if (!allowedEmails.includes(profile?.email)) {
      return new Response(JSON.stringify({ error: 'Função temporariamente restrita.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar perfil' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If user already has a token, check if instance is already connected
    if (profile?.whatsapp_instance_token) {
      try {
        const statusResp = await fetch(`${uazapiUrl}/instance/status`, {
          method: 'GET',
          headers: { 'token': profile.whatsapp_instance_token },
        });
        const statusData = await statusResp.json().catch(() => null);
        console.log('Existing instance status:', statusData);
        const instanceState = statusData?.instance?.status || statusData?.status || statusData?.state;

        if (instanceState === 'connected') {
          return new Response(JSON.stringify({
            success: true,
            alreadyConnected: true,
            message: 'WhatsApp já está conectado',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Instance exists but not connected - try to connect and get QR
        const connectResp = await fetch(`${uazapiUrl}/instance/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': profile.whatsapp_instance_token,
          },
          body: JSON.stringify({}),
        });
        const connectData = await connectResp.json().catch(() => null);
        console.log('Connect response:', connectData);

        const qrCode = connectData?.instance?.qrcode || connectData?.qrcode || connectData?.qr || connectData?.base64 || null;
        if (qrCode) {
          return new Response(JSON.stringify({
            success: true,
            instanceName: profile.whatsapp_instance_id,
            qrCode,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Return pending if no QR yet
        return new Response(JSON.stringify({
          success: true,
          instanceName: profile.whatsapp_instance_id,
          pendingQr: true,
          message: 'QR Code sendo gerado, aguarde...',
        }), {
          status: 202,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.log('Error checking existing instance, will create new:', e);
      }
    }

    // Create new instance via UAZAPI
    const shortUserId = userId.substring(0, 8);
    const instanceName = `cf_${shortUserId}`;
    console.log(`Creating UAZAPI instance: ${instanceName}`);

    const createResponse = await fetch(`${uazapiUrl}/instance/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'admintoken': adminToken,
      },
      body: JSON.stringify({ name: instanceName }),
    });

    const createText = await createResponse.text();
    console.log('Create instance response:', createResponse.status, createText.substring(0, 300));

    // Detect server offline
    const isHtml = createText.trim().startsWith('<!') || createText.includes('<html');
    if (createResponse.status === 502 || createResponse.status === 503 || isHtml) {
      return new Response(JSON.stringify({
        error: 'Servidor WhatsApp temporariamente indisponível. Tente novamente em alguns minutos.',
        serverOffline: true,
        instanceName,
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let createData: any = null;
    try {
      createData = JSON.parse(createText);
    } catch {
      console.error('Failed to parse create response');
      return new Response(JSON.stringify({ error: 'Resposta inválida do servidor UAZAPI' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract token from response
    const instanceToken = createData?.token || createData?.data?.token;
    if (!instanceToken) {
      console.error('No token in create response:', createData);
      return new Response(JSON.stringify({ error: 'Token da instância não retornado pela UAZAPI' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Instance created, token received');

    // Save instance info to profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        whatsapp_instance_id: instanceName,
        whatsapp_instance_token: instanceToken,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
    }

    // Now connect to get QR code
    let qrCodeBase64 = null;
    try {
      const connectResp = await fetch(`${uazapiUrl}/instance/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': instanceToken,
        },
        body: JSON.stringify({}),
      });
      const connectData = await connectResp.json().catch(() => null);
      console.log('Connect response:', JSON.stringify(connectData).substring(0, 200));

      qrCodeBase64 = connectData?.instance?.qrcode || connectData?.qrcode || connectData?.qr || connectData?.base64 || null;
    } catch (e) {
      console.error('Error connecting instance:', e);
    }

    if (qrCodeBase64) {
      return new Response(JSON.stringify({
        success: true,
        instanceName,
        qrCode: qrCodeBase64,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // QR not ready yet
    return new Response(JSON.stringify({
      success: true,
      instanceName,
      pendingQr: true,
      message: 'Instância criada. QR Code sendo gerado...',
    }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in whatsapp-create-instance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
