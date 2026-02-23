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
    const body = await req.json();
    console.log('UAZAPI Webhook received:', JSON.stringify(body, null, 2));

    const event = body.event || body.type;
    const instanceToken = body.token || body.instanceToken;

    console.log(`Event: ${event}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Route message events to message webhook
    if (event === 'message' || event === 'messages') {
      console.log('Routing message event to whatsapp-message-webhook...');
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-message-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify(body),
        });
        const result = await response.text();
        console.log('Message webhook response:', result);
        return new Response(result, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (routeError) {
        console.error('Error routing to message webhook:', routeError);
        return new Response(JSON.stringify({ error: 'Failed to route message' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Handle QR code events
    if (event === 'qrcode' || event === 'qr') {
      const qrCode = body.qrcode || body.qr || body.base64 || body.data?.qrcode;
      if (!qrCode) {
        return new Response(JSON.stringify({ received: true, noQrFound: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Find user by token - look up in profiles
      // UAZAPI sends token in webhook, match it to whatsapp_instance_token
      if (instanceToken) {
        const { data: qrProfile } = await supabase
          .from('profiles')
          .select('id, whatsapp_instance_id')
          .eq('whatsapp_instance_token', instanceToken)
          .single();
        
        if (qrProfile) {
          await supabase.from('whatsapp_qr_codes').delete().eq('instance_name', qrProfile.whatsapp_instance_id || '');
          await supabase.from('whatsapp_qr_codes').insert({
            instance_name: qrProfile.whatsapp_instance_id || 'unknown',
            user_id: qrProfile.id,
            qr_code: qrCode,
          });
          return new Response(JSON.stringify({ received: true, qrSaved: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      return new Response(JSON.stringify({ received: true, profileNotFound: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle connection status events
    if (event === 'connection' || event === 'status') {
      const state = body.status || body.state || body.data?.status;
      console.log(`Connection state: ${state}`);

      // Find profile by token
      let profile = null;
      if (instanceToken) {
        const { data } = await supabase
          .from('profiles')
          .select('id, whatsapp_instance_id, whatsapp_connected_phone')
          .eq('whatsapp_instance_token', instanceToken)
          .single();
        profile = data;
      }

      if (!profile) {
        return new Response(JSON.stringify({ received: true, profileNotFound: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Handle disconnection
      if (state === 'close' || state === 'disconnected') {
        await supabase.from('profiles').update({
          whatsapp_connected_phone: null,
          whatsapp_connected_at: null,
          whatsapp_to_clients_enabled: false,
        }).eq('id', profile.id);
        
        return new Response(JSON.stringify({ received: true, reconnected: false, needsQR: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Handle connection
      if (state === 'open' || state === 'connected') {
        const phoneNumber = body.phone || body.ownerJid?.split('@')[0]?.replace(/\D/g, '') || null;
        const updateData: Record<string, unknown> = {
          whatsapp_connected_at: new Date().toISOString(),
          whatsapp_to_clients_enabled: true,
        };
        if (phoneNumber) updateData.whatsapp_connected_phone = phoneNumber;
        await supabase.from('profiles').update(updateData).eq('id', profile.id);
        return new Response(JSON.stringify({ received: true, connected: true, phoneNumber }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    console.log('Unhandled event:', event);
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('Error in whatsapp-connection-webhook:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
