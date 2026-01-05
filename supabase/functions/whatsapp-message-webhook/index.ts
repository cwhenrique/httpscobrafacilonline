import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keywords that confirm the client wants to receive the message
const CONFIRMATION_KEYWORDS = [
  'ok', 'sim', 'confirmo', 'receber', 'quero', 'aceito', '1', 'yes', 'si',
  'pode', 'manda', 'enviar', 'blz', 'beleza', 'tá', 'ta', 'certo', 'positivo'
];

const isConfirmation = (text: string): boolean => {
  const normalized = text.toLowerCase().trim();
  return CONFIRMATION_KEYWORDS.some(keyword => 
    normalized === keyword || normalized.startsWith(keyword + ' ') || normalized.endsWith(' ' + keyword)
  );
};

const formatPhone = (phone: string): string => {
  // Remove @s.whatsapp.net, @c.us, and any non-numeric characters
  return phone
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .replace(/\D/g, '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Received webhook event:', JSON.stringify(body, null, 2));

    // Evolution API v2 message structure
    const event = body.event || body.type;
    
    // Only process incoming messages
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      console.log('Ignoring non-message event:', event);
      return new Response(JSON.stringify({ ignored: true, reason: 'not_message_event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract message data
    const data = body.data || body;
    const key = data?.key || {};
    const messageContent = data?.message || {};
    
    // Ignore messages we sent (fromMe: true)
    if (key.fromMe) {
      console.log('Ignoring message sent by us');
      return new Response(JSON.stringify({ ignored: true, reason: 'from_me' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract phone number
    const remoteJid = key.remoteJid || '';
    const senderPhone = formatPhone(remoteJid);
    
    if (!senderPhone) {
      console.log('No sender phone found');
      return new Response(JSON.stringify({ ignored: true, reason: 'no_phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract message text (supports various message types)
    const text = 
      messageContent.conversation ||
      messageContent.extendedTextMessage?.text ||
      messageContent.buttonsResponseMessage?.selectedButtonId ||
      messageContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
      '';

    if (!text) {
      console.log('No text content in message');
      return new Response(JSON.stringify({ ignored: true, reason: 'no_text' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing message from ${senderPhone}: "${text}"`);

    // Check if this is a confirmation
    if (!isConfirmation(text)) {
      console.log('Message is not a confirmation keyword');
      return new Response(JSON.stringify({ ignored: true, reason: 'not_confirmation' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to find pending message for this phone
    // We need to normalize phone comparison (sender might be 5511999999999 or 11999999999)
    const phoneVariants = [
      senderPhone,
      senderPhone.replace(/^55/, ''), // Remove country code
      `55${senderPhone}`, // Add country code
    ];

    console.log('Searching for pending messages with phone variants:', phoneVariants);

    const { data: pendingMessages, error: searchError } = await supabase
      .from('pending_messages')
      .select('*')
      .in('client_phone', phoneVariants)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (searchError) {
      console.error('Error searching pending messages:', searchError);
      throw searchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('No pending messages found for phone:', senderPhone);
      return new Response(JSON.stringify({ ignored: true, reason: 'no_pending_message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pending = pendingMessages[0];
    console.log('Found pending message:', pending.id, 'for client:', pending.client_name);

    // Send the full message content
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-whatsapp-to-client', {
      body: {
        userId: pending.user_id,
        clientPhone: pending.client_phone,
        message: pending.message_content,
      },
    });

    if (sendError) {
      console.error('Error sending message:', sendError);
      
      // Update status to failed
      await supabase
        .from('pending_messages')
        .update({ 
          status: 'failed',
        })
        .eq('id', pending.id);
      
      throw sendError;
    }

    // Update pending message status
    const { error: updateError } = await supabase
      .from('pending_messages')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      })
      .eq('id', pending.id);

    if (updateError) {
      console.error('Error updating pending message:', updateError);
    }

    // Register the message in whatsapp_messages table
    await supabase.from('whatsapp_messages').insert({
      user_id: pending.user_id,
      loan_id: pending.contract_id,
      contract_type: pending.contract_type || 'loan',
      message_type: pending.message_type,
      client_phone: pending.client_phone,
      client_name: pending.client_name,
    });

    console.log('Successfully sent confirmed message to:', pending.client_name);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Confirmation processed and message sent',
        clientName: pending.client_name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    console.error('Error in whatsapp-message-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
