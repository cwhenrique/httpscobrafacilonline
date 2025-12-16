import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('📥 Voice webhook received:', JSON.stringify(body, null, 2));

    // Evolution API sends MESSAGES_UPSERT events
    const event = body.event || body.type;
    
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      console.log('⏭️ Ignoring non-message event:', event);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not a message event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the message data
    const messageData = body.data || body;
    const message = messageData.message || messageData;
    const key = message.key || messageData.key;
    
    // Only process incoming messages (not sent by us)
    if (key?.fromMe === true) {
      console.log('⏭️ Ignoring outgoing message');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'outgoing message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if it's an audio message
    const audioMessage = message.audioMessage || message.message?.audioMessage;
    if (!audioMessage) {
      console.log('⏭️ Ignoring non-audio message');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not audio' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get sender's phone number
    const remoteJid = key?.remoteJid || messageData.key?.remoteJid;
    if (!remoteJid) {
      console.log('❌ No remoteJid found');
      return new Response(JSON.stringify({ error: 'No sender phone found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract phone number from JID (format: 5517991050811@s.whatsapp.net)
    const senderPhone = remoteJid.split('@')[0];
    console.log('📞 Sender phone:', senderPhone);

    // Get instance name from webhook
    const instanceName = body.instance || messageData.instance;
    if (!instanceName) {
      console.log('❌ No instance name found');
      return new Response(JSON.stringify({ error: 'No instance name found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔊 Instance:', instanceName);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by instance name (cf_<userId>)
    const userId = instanceName.replace('cf_', '');
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, voice_assistant_enabled, is_active, whatsapp_connected_phone')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.log('❌ User not found for instance:', instanceName);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has voice assistant enabled
    if (!profile.voice_assistant_enabled) {
      console.log('⏭️ Voice assistant not enabled for user:', userId);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'voice assistant disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is active
    if (!profile.is_active) {
      console.log('⏭️ User account inactive:', userId);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'inactive account' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the sender is the connected phone (security check)
    const connectedPhone = profile.whatsapp_connected_phone?.replace(/\D/g, '');
    if (connectedPhone && senderPhone !== connectedPhone) {
      console.log('⏭️ Message not from connected phone:', senderPhone, 'vs', connectedPhone);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not from connected phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get audio in base64 from Evolution API
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const messageId = key?.id || messageData.key?.id;
    if (!messageId) {
      console.log('❌ No message ID found');
      return new Response(JSON.stringify({ error: 'No message ID found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔄 Fetching audio from Evolution API...');
    
    // Get base64 audio from Evolution API
    const mediaResponse = await fetch(
      `${evolutionApiUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            key: {
              remoteJid: remoteJid,
              id: messageId,
            },
          },
          convertToMp4: false,
        }),
      }
    );

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error('❌ Error getting audio from Evolution API:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to get audio' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mediaData = await mediaResponse.json();
    const audioBase64 = mediaData.base64;
    const mimeType = mediaData.mimetype || audioMessage.mimetype || 'audio/ogg';

    if (!audioBase64) {
      console.error('❌ No audio data received');
      return new Response(JSON.stringify({ error: 'No audio data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Audio received, size:', audioBase64.length, 'mimetype:', mimeType);

    // Check audio duration (if available) - skip if > 30 seconds
    const seconds = audioMessage.seconds || 0;
    if (seconds > 30) {
      console.log('⏭️ Audio too long:', seconds, 'seconds');
      
      // Send message back saying audio is too long
      await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: senderPhone,
          text: '⚠️ *Áudio muito longo*\n\nPor favor, envie áudios de até 30 segundos para o assistente de voz.',
        }),
      });

      return new Response(JSON.stringify({ status: 'ignored', reason: 'audio too long' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call process-voice-query function
    console.log('🚀 Calling process-voice-query...');
    
    const { data: queryResult, error: queryError } = await supabase.functions.invoke('process-voice-query', {
      body: {
        userId: userId,
        audioBase64: audioBase64,
        mimeType: mimeType,
        senderPhone: senderPhone,
        instanceName: instanceName,
      },
    });

    if (queryError) {
      console.error('❌ Error processing voice query:', queryError);
      return new Response(JSON.stringify({ error: 'Failed to process voice query' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Voice query processed successfully');
    return new Response(JSON.stringify({ success: true, result: queryResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in voice webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
