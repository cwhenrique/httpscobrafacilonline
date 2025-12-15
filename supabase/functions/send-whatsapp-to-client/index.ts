import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { userId, clientPhone, message } = await req.json();

    if (!userId) {
      console.error('Missing userId');
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!clientPhone) {
      console.error('Missing clientPhone');
      return new Response(JSON.stringify({ error: 'clientPhone é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!message) {
      console.error('Missing message');
      return new Response(JSON.stringify({ error: 'message é obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get central Evolution API credentials from environment
    const rawEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!rawEvolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API not configured in environment');
      return new Response(JSON.stringify({ error: 'Evolution API não configurada no servidor' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean the URL - extract just the base URL (protocol + host)
    const urlMatch = rawEvolutionApiUrl.match(/^(https?:\/\/[^\/]+)/);
    const evolutionApiUrl = urlMatch ? urlMatch[1] : rawEvolutionApiUrl;
    console.log('Using Evolution API base URL:', evolutionApiUrl);

    // Create Supabase client to fetch user's instance
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user's WhatsApp instance from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_to_clients_enabled, whatsapp_connected_phone, company_name')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar configuração do perfil' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile) {
      console.error('Profile not found for userId:', userId);
      return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if WhatsApp to clients is enabled
    if (!profile.whatsapp_to_clients_enabled) {
      console.log('WhatsApp to clients disabled for user:', userId);
      return new Response(JSON.stringify({ error: 'Envio de WhatsApp para clientes está desativado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has a WhatsApp instance connected
    if (!profile.whatsapp_instance_id) {
      console.error('WhatsApp instance not configured for user:', userId);
      return new Response(JSON.stringify({ error: 'Conecte seu WhatsApp nas configurações para enviar mensagens aos clientes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format phone number (remove non-digits)
    const formattedPhone = clientPhone.replace(/\D/g, '');
    
    // Add country code if not present
    const phoneWithCountryCode = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

    console.log(`Sending WhatsApp to client via user's instance`);
    console.log(`Instance: ${profile.whatsapp_instance_id}`);
    console.log(`Phone: ${phoneWithCountryCode}`);

    // Send message via central Evolution API using user's instance
    const apiUrl = `${evolutionApiUrl}/message/sendText/${profile.whatsapp_instance_id}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        number: phoneWithCountryCode,
        text: message,
      }),
    });

    const responseText = await response.text();
    console.log('Evolution API response status:', response.status);
    console.log('Evolution API response:', responseText);

    if (!response.ok) {
      console.error('Evolution API error:', responseText);
      return new Response(JSON.stringify({ 
        error: 'Erro ao enviar mensagem pelo WhatsApp',
        details: responseText 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log('WhatsApp message sent successfully to client:', phoneWithCountryCode);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Mensagem enviada com sucesso para o cliente',
      result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in send-whatsapp-to-client function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
