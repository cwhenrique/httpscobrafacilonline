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

    // Get sender's phone number - check senderPn first (real phone when remoteJid is LID)
    const remoteJid = key?.remoteJid || messageData.key?.remoteJid;
    const senderPn = key?.senderPn || messageData.key?.senderPn;
    
    let senderPhone = '';
    
    // Try senderPn first (contains real phone number when remoteJid is LID format)
    if (senderPn && senderPn.includes('@s.whatsapp.net')) {
      senderPhone = senderPn.split('@')[0];
      console.log('📞 Using senderPn:', senderPhone);
    } else if (remoteJid && remoteJid.includes('@s.whatsapp.net')) {
      // Fallback to remoteJid if it's a real phone (not LID)
      senderPhone = remoteJid.split('@')[0];
      console.log('📞 Using remoteJid:', senderPhone);
    } else {
      // If both are LID or invalid, cannot identify user
      console.log('⏭️ Cannot extract phone number - remoteJid:', remoteJid, 'senderPn:', senderPn);
      return new Response(JSON.stringify({ 
        status: 'ignored', 
        reason: 'LID format without senderPn not supported' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('📞 Sender phone:', senderPhone);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by phone number (match last 8-9 digits to handle country code variations)
    const phoneDigits = senderPhone.replace(/\D/g, '');
    const last9 = phoneDigits.slice(-9);
    const last8 = phoneDigits.slice(-8);
    
    console.log('🔍 Searching for user with phone ending in:', last9, 'or', last8);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone, voice_assistant_enabled, is_active')
      .eq('is_active', true)
      .eq('voice_assistant_enabled', true)
      .or(`phone.ilike.%${last9}%,phone.ilike.%${last8}%`)
      .maybeSingle();

    if (profileError) {
      console.error('❌ Error searching for user:', profileError);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'database error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no profile found, silently ignore - sender is not a registered user
    if (!profile) {
      console.log('⏭️ Sender not a registered user or voice assistant disabled. Phone:', senderPhone);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not a registered user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Found user:', profile.id, 'phone:', profile.phone);

    // Get global Evolution API credentials
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME')!;

    const messageId = key?.id || messageData.key?.id;
    if (!messageId) {
      console.log('❌ No message ID found');
      return new Response(JSON.stringify({ error: 'No message ID found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔄 Fetching audio from Evolution API using instance:', instanceName);
    
    // Get base64 audio from Evolution API using central instance
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
    console.log('🚀 Calling process-voice-query for user:', profile.id);
    
    const { data: queryResult, error: queryError } = await supabase.functions.invoke('process-voice-query', {
      body: {
        userId: profile.id,
        audioBase64: audioBase64,
        mimeType: mimeType,
        senderPhone: senderPhone,
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
