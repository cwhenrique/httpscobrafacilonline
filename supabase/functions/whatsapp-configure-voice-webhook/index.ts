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
    const { userId, enabled } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!rawEvolutionApiUrl || !evolutionApiKey) {
      return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean the URL - extract just the base URL (protocol + host)
    const urlMatch = rawEvolutionApiUrl.match(/^(https?:\/\/[^\/]+)/);
    const evolutionApiUrl = urlMatch ? urlMatch[1] : rawEvolutionApiUrl;
    console.log('Using Evolution API base URL:', evolutionApiUrl);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's WhatsApp instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar perfil' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile?.whatsapp_instance_id) {
      return new Response(JSON.stringify({ error: 'WhatsApp não está conectado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceName = profile.whatsapp_instance_id;
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-voice-webhook`;
    const webhookName = `voice_webhook_${userId.substring(0, 8)}`;

    console.log(`${enabled ? 'Configuring' : 'Removing'} webhook for instance: ${instanceName}`);
    console.log('Webhook URL:', webhookUrl);

    if (enabled) {
      // Configure webhook on Evolution API
      const webhookConfig = {
        url: webhookUrl,
        webhook_by_events: true,
        webhook_base64: false,
        events: ['MESSAGES_UPSERT'],
      };

      console.log('Webhook config:', JSON.stringify(webhookConfig));

      const response = await fetch(`${evolutionApiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookConfig),
      });

      const responseText = await response.text();
      console.log('Evolution API response:', response.status, responseText);

      if (!response.ok) {
        console.error('Failed to configure webhook:', responseText);
        return new Response(JSON.stringify({ 
          error: 'Falha ao configurar webhook',
          details: responseText 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Webhook configured successfully');

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Webhook configurado com sucesso',
        webhookUrl
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // Remove webhook from Evolution API
      const webhookConfig = {
        url: '',
        webhook_by_events: false,
        webhook_base64: false,
        events: [],
      };

      const response = await fetch(`${evolutionApiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookConfig),
      });

      const responseText = await response.text();
      console.log('Evolution API response:', response.status, responseText);

      if (!response.ok) {
        console.error('Failed to remove webhook:', responseText);
        // Don't fail if we can't remove - might already be gone
      }

      console.log('Webhook removed successfully');

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Webhook removido com sucesso'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Error in whatsapp-configure-voice-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
