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
    const body = await req.json();
    console.log('Received WhatsApp status webhook:', JSON.stringify(body, null, 2));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Accept flexible payload: { messageId, phone, status, userId?, raw? }
    // Status values: sent, delivered, read, failed
    const messageId = body.messageId || body.message_id || body.id;
    const phone = body.phone || body.remoteJid || body.number || '';
    const status = body.status || 'unknown';
    const userId = body.userId || body.user_id || null;
    const timestamp = body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString();

    if (!messageId) {
      console.log('No messageId provided');
      return new Response(JSON.stringify({ error: 'messageId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');

    const { error } = await supabase
      .from('whatsapp_message_status')
      .insert({
        message_id: String(messageId),
        phone: cleanPhone,
        status: status,
        timestamp: timestamp,
        user_id: userId,
        raw_data: body,
      });

    if (error) {
      console.error('Error inserting status:', error);
      throw error;
    }

    console.log(`Status "${status}" saved for message ${messageId}`);

    return new Response(
      JSON.stringify({ success: true, status, messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in whatsapp-status-webhook:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
