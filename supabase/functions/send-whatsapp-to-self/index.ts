import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, message } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'userId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!message) {
      return new Response(JSON.stringify({ success: false, error: 'message is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uazapiUrl = Deno.env.get('UAZAPI_URL');
    if (!uazapiUrl) {
      return new Response(JSON.stringify({ success: false, error: 'UAZAPI não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_instance_token, whatsapp_connected_phone, phone')
      .eq('id', userId)
      .single();

    if (profileError) {
      return new Response(JSON.stringify({ success: false, error: 'Error fetching user profile' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile?.whatsapp_instance_token || !profile?.whatsapp_connected_phone) {
      return new Response(JSON.stringify({ success: false, error: 'whatsapp_not_connected' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const phoneNumber = profile.whatsapp_connected_phone.replace(/\D/g, '');
    console.log(`Sending self-message to ${phoneNumber} via UAZAPI`);

    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': profile.whatsapp_instance_token,
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('UAZAPI error:', result);
      return new Response(JSON.stringify({ success: false, error: result.message || 'Failed to send message' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Self-message sent successfully');

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in send-whatsapp-to-self:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
