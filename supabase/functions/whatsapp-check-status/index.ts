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
    const { userId, attemptReconnect } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uazapiUrl = Deno.env.get('UAZAPI_URL');

    if (!uazapiUrl) {
      return new Response(JSON.stringify({ error: 'UAZAPI não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_instance_token, whatsapp_connected_phone, whatsapp_connected_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar perfil' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile?.whatsapp_instance_token) {
      return new Response(JSON.stringify({
        connected: false,
        status: 'not_configured',
        message: 'WhatsApp não configurado',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceName = profile.whatsapp_instance_id;
    const instanceToken = profile.whatsapp_instance_token;
    console.log(`Checking UAZAPI status for instance: ${instanceName}`);

    // Check status via UAZAPI
    let state = 'unknown';
    let phoneNumber = profile.whatsapp_connected_phone;
    let statusData: any = null;

    try {
      const statusResp = await fetch(`${uazapiUrl}/instance/status`, {
        method: 'GET',
        headers: { 'token': instanceToken },
      });
      statusData = await statusResp.json().catch(() => null);
      // UAZAPI returns status inside instance object or at top level
      state = statusData?.instance?.status || statusData?.status || statusData?.state || 'unknown';

      // Extract phone number if available
      const inst = statusData?.instance || statusData;
      if (inst?.owner || inst?.phone || inst?.ownerJid) {
        const rawPhone = inst.owner?.split('@')[0] || inst.phone || inst.ownerJid?.split('@')[0];
        if (rawPhone) phoneNumber = rawPhone.replace(/\D/g, '');
      }

      console.log(`Instance state: ${state}, phone: ${phoneNumber}`);
    } catch (e) {
      console.error('Error checking status:', e);
    }

    // Map UAZAPI states
    const isConnected = state === 'connected' || state === 'open';
    const isConnecting = state === 'connecting';
    const isDisconnected = state === 'disconnected' || state === 'close' || state === 'unknown';

    if (isConnecting) {
      return new Response(JSON.stringify({
        connected: false,
        status: 'connecting',
        instanceName,
        needsNewQR: false,
        waitingForScan: true,
        message: 'Aguardando leitura do QR Code...',
        canAttemptReconnect: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Passive check mode
    if (!attemptReconnect) {
      return new Response(JSON.stringify({
        connected: isConnected,
        status: state,
        instanceName,
        phoneNumber: phoneNumber || null,
        connectedAt: profile.whatsapp_connected_at,
        needsNewQR: isDisconnected,
        canAttemptReconnect: isDisconnected,
        message: isDisconnected ? 'Desconectado. Clique em Reconectar ou gere um novo QR Code.' : undefined,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Active reconnect attempt
    let reconnected = false;
    let needsNewQR = false;
    let statusMessage = '';

    if (isDisconnected && attemptReconnect) {
      console.log('Attempting reconnect via UAZAPI...');

      try {
        const connectResp = await fetch(`${uazapiUrl}/instance/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instanceToken },
          body: JSON.stringify({}),
        });
        const connectData = await connectResp.json().catch(() => null);

        // Check if we got a QR code
        const qr = connectData?.qrcode || connectData?.qr || connectData?.base64;
        if (qr) {
          needsNewQR = true;
          statusMessage = 'QR Code disponível para reconexão.';
        } else {
          // Wait and recheck
          await new Promise(r => setTimeout(r, 3000));
          const recheckResp = await fetch(`${uazapiUrl}/instance/status`, {
            method: 'GET',
            headers: { 'token': instanceToken },
          });
          const recheckData = await recheckResp.json().catch(() => null);
          const newState = recheckData?.status || recheckData?.state || 'unknown';

          if (newState === 'connected' || newState === 'open') {
            reconnected = true;
            statusMessage = 'Conexão restaurada!';
          } else {
            needsNewQR = true;
            statusMessage = 'Não foi possível reconectar. Gere um novo QR Code.';
          }
        }
      } catch (e) {
        console.error('Reconnect error:', e);
        needsNewQR = true;
        statusMessage = 'Erro ao tentar reconectar.';
      }
    }

    const finalConnected = isConnected || reconnected;

    // Update profile if connected
    if (finalConnected) {
      const updateData: Record<string, unknown> = {
        whatsapp_connected_at: profile.whatsapp_connected_at || new Date().toISOString(),
        whatsapp_to_clients_enabled: true,
      };
      if (phoneNumber) updateData.whatsapp_connected_phone = phoneNumber;

      await supabase.from('profiles').update(updateData).eq('id', userId);
    }

    return new Response(JSON.stringify({
      connected: finalConnected,
      status: finalConnected ? 'connected' : state,
      instanceName,
      phoneNumber: phoneNumber || null,
      connectedAt: profile.whatsapp_connected_at,
      reconnected,
      needsNewQR,
      message: statusMessage || undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in whatsapp-check-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
