import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keywords de confirmação
const CONFIRMATION_KEYWORDS = [
  'ok', 'sim', 'confirmo', 'receber', 'quero', 'aceito', '1', 'yes', 'si',
  'pode', 'manda', 'enviar', 'blz', 'beleza', 'tá', 'ta', 'certo', 'positivo',
  'receber relatorio', 'receber relatório'
];

// Keywords de recusa
const DECLINE_KEYWORDS = [
  'nao', 'não', '2', 'no', 'nope', 'recuso', 'cancelar', 'cancela', 'para', 'parar', 'sair'
];

const matchesKeywords = (text: string, keywords: string[]): boolean => {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return keywords.some(keyword => {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalized === normalizedKeyword || 
           normalized.startsWith(normalizedKeyword + ' ') || 
           normalized.endsWith(' ' + normalizedKeyword);
  });
};

const formatPhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

// Extract message from Meta Cloud API format (Um Clique Digital / Meta partner)
const extractMetaMessage = (body: any): { from: string; text: string } | null => {
  try {
    // Standard Meta Cloud API format
    if (body?.object === 'whatsapp_business_account' && body?.entry) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const messages = change?.value?.messages;
          if (messages && messages.length > 0) {
            const msg = messages[0];
            // Support text, button, interactive, and list reply types
            const text = 
              msg.text?.body ||
              msg.button?.text ||
              msg.button?.payload ||
              msg.interactive?.button_reply?.title ||
              msg.interactive?.list_reply?.title ||
              null;
            if (text && msg.from) {
              return { from: msg.from, text };
            }
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
};

// Extract from simplified/alternative format
const extractSimpleMessage = (body: any): { from: string; text: string } | null => {
  try {
    // Format: { from: "5517...", text: "sim" } or { phone: "5517...", message: "sim" }
    const from = body?.from || body?.phone || body?.sender || body?.numero || body?.remoteJid;
    const text = body?.text || body?.message || body?.body || body?.mensagem || body?.msg;
    
    if (from && text) {
      return { from: String(from), text: String(text) };
    }

    // Try nested data
    const data = body?.data || body?.message_data;
    if (data) {
      const nestedFrom = data?.from || data?.phone || data?.sender;
      const nestedText = data?.text || data?.body || data?.message;
      if (nestedFrom && nestedText) {
        return { from: String(nestedFrom), text: String(nestedText) };
      }
    }

    return null;
  } catch {
    return null;
  }
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET: Meta webhook verification challenge
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Webhook verification request:', { mode, token, challenge });

    const verifyToken = Deno.env.get('UMCLIQUE_VERIFY_TOKEN');

    if (mode === 'subscribe') {
      // If we have a verify token configured, validate it
      if (verifyToken && token !== verifyToken) {
        console.error('Verify token mismatch');
        return new Response('Forbidden', { status: 403 });
      }
      console.log('Webhook verified successfully');
      return new Response(challenge || '', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

  // POST: Process incoming message
  try {
    const body = await req.json();
    console.log('Um Clique Digital webhook received:', JSON.stringify(body, null, 2));

    // Try Meta format first, then simple format
    const extracted = extractMetaMessage(body) || extractSimpleMessage(body);

    if (!extracted) {
      console.log('Could not extract message from payload');
      return new Response(JSON.stringify({ ignored: true, reason: 'unrecognized_format' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senderPhone = formatPhone(extracted.from);
    const messageText = extracted.text;

    console.log(`Message from ${senderPhone}: "${messageText}"`);

    if (!senderPhone || !messageText) {
      console.log('Missing phone or text');
      return new Response(JSON.stringify({ ignored: true, reason: 'missing_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isConfirm = matchesKeywords(messageText, CONFIRMATION_KEYWORDS);
    const isDecline = matchesKeywords(messageText, DECLINE_KEYWORDS);

    if (!isConfirm && !isDecline) {
      console.log('Message is neither confirmation nor decline');
      return new Response(JSON.stringify({ ignored: true, reason: 'not_actionable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Search for pending message with phone variants
    const phoneVariants = [
      senderPhone,
      senderPhone.replace(/^55/, ''),
      `55${senderPhone}`,
    ];

    console.log('Searching pending_messages for phones:', phoneVariants);

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
    console.log(`Found pending message: ${pending.id} for client: ${pending.client_name}`);

    // Check if the owner has relatorio_ativo enabled
    const { data: ownerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('relatorio_ativo, full_name')
      .eq('id', pending.user_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error checking owner profile:', profileError);
    }

    if (!ownerProfile?.relatorio_ativo) {
      console.log('Owner does not have relatorio_ativo enabled, ignoring');
      return new Response(JSON.stringify({ ignored: true, reason: 'relatorio_not_active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DECLINE FLOW ===
    if (isDecline) {
      console.log('Client DECLINED the report');
      
      const { error: updateError } = await supabase
        .from('pending_messages')
        .update({
          status: 'declined',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', pending.id);

      if (updateError) {
        console.error('Error updating to declined:', updateError);
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'declined',
        clientName: pending.client_name,
        message: 'Client declined the report',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === CONFIRM FLOW ===
    console.log('Client CONFIRMED the report, sending via Um Clique Digital API...');

    // Send report via Um Clique Digital API (2-step: template + text)
    const umcliqueApiKey = Deno.env.get('UMCLIQUE_API_KEY');
    if (!umcliqueApiKey) {
      console.error('UMCLIQUE_API_KEY not configured');
      throw new Error('UMCLIQUE_API_KEY not configured');
    }

    // Format phone for the API (needs country code)
    let apiPhone = pending.client_phone.replace(/\D/g, '');
    if (!apiPhone.startsWith('55')) {
      apiPhone = '55' + apiPhone;
    }

    const apiUrl = 'https://cslsnijdeayzfpmwjtmw.supabase.co/functions/v1/public-send-message';
    const apiHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': umcliqueApiKey,
    };

    // Step 1: Send template to open conversation window
    console.log('Step 1: Sending template to open conversation window for', apiPhone);
    const templateResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        channel_id: '1060061327180048',
        to: apiPhone,
        type: 'template',
        template_name: 'relatorio',
        template_language: 'pt_BR',
        template_variables: [
          { type: 'text', text: pending.client_name }
        ],
      }),
    });

    const templateResult = await templateResponse.text();
    console.log('Template response:', templateResponse.status, templateResult);

    if (!templateResponse.ok) {
      console.error('Error sending template:', templateResult);
      await supabase
        .from('pending_messages')
        .update({ status: 'failed' })
        .eq('id', pending.id);
      throw new Error(`Template send error: ${templateResponse.status} - ${templateResult}`);
    }

    // Step 2: Wait for conversation window to open
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Send actual report content as text message
    console.log('Step 3: Sending report text content to', apiPhone);
    const textResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        channel_id: '1060061327180048',
        to: apiPhone,
        type: 'text',
        content: pending.message_content,
      }),
    });

    const textResult = await textResponse.text();
    console.log('Text response:', textResponse.status, textResult);

    if (!textResponse.ok) {
      console.error('Error sending report text:', textResult);
      await supabase
        .from('pending_messages')
        .update({ status: 'failed' })
        .eq('id', pending.id);
      throw new Error(`Text send error: ${textResponse.status} - ${textResult}`);
    }

    // Update to confirmed + sent
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

    // Register in whatsapp_messages
    await supabase.from('whatsapp_messages').insert({
      user_id: pending.user_id,
      loan_id: pending.contract_id,
      contract_type: pending.contract_type || 'loan',
      message_type: pending.message_type,
      client_phone: pending.client_phone,
      client_name: pending.client_name,
    });

    console.log('Successfully sent confirmed report to:', pending.client_name);

    return new Response(JSON.stringify({
      success: true,
      action: 'confirmed',
      clientName: pending.client_name,
      message: 'Report sent successfully via Um Clique Digital',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in umclique-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
