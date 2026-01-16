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
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[whatsapp-force-reset] Starting force reset for user: ${userId}`);

    // Get Evolution API credentials from environment
    const rawEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!rawEvolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API not configured in environment');
      return new Response(JSON.stringify({ error: 'Evolution API não configurada no servidor' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean the URL
    const urlMatch = rawEvolutionApiUrl.match(/^(https?:\/\/[^\/]+)/);
    const evolutionApiUrl = urlMatch ? urlMatch[1] : rawEvolutionApiUrl;
    console.log(`[whatsapp-force-reset] Using Evolution API URL: ${evolutionApiUrl}`);

    // Evolution API request helper with auth fallback
    const evolutionFetch = async (
      url: string,
      init: RequestInit & { headers?: Record<string, string> } = {}
    ) => {
      const baseHeaders = (init.headers ?? {}) as Record<string, string>;

      let resp = await fetch(url, {
        ...init,
        headers: {
          ...baseHeaders,
          apikey: evolutionApiKey,
        },
      });

      if (resp.status === 401) {
        resp = await fetch(url, {
          ...init,
          headers: {
            ...baseHeaders,
            Authorization: `Bearer ${evolutionApiKey}`,
          },
        });
      }

      if (resp.status === 401) {
        const u = new URL(url);
        if (!u.searchParams.get('apikey')) u.searchParams.set('apikey', evolutionApiKey);
        resp = await fetch(u.toString(), {
          ...init,
          headers: baseHeaders,
        });
      }

      return resp;
    };

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile to find instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_connected_phone, whatsapp_connected_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[whatsapp-force-reset] Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar perfil' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceName = profile?.whatsapp_instance_id;
    console.log(`[whatsapp-force-reset] Current instance: ${instanceName}`);

    // Step 1: Try to delete the old instance if it exists
    if (instanceName) {
      console.log(`[whatsapp-force-reset] Attempting to delete instance: ${instanceName}`);
      
      try {
        // First try logout
        const logoutResponse = await evolutionFetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
        });
        console.log(`[whatsapp-force-reset] Logout response: ${logoutResponse.status}`);
      } catch (e) {
        console.log(`[whatsapp-force-reset] Logout failed (may not exist):`, e);
      }

      // Wait a bit for logout to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        // Then try delete
        const deleteResponse = await evolutionFetch(`${evolutionApiUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
        });
        console.log(`[whatsapp-force-reset] Delete response: ${deleteResponse.status}`);
        const deleteText = await deleteResponse.text();
        console.log(`[whatsapp-force-reset] Delete body:`, deleteText);
      } catch (e) {
        console.log(`[whatsapp-force-reset] Delete failed (may not exist):`, e);
      }

      // Wait for deletion to process
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Step 2: Clear the user's WhatsApp data in the profile
    console.log(`[whatsapp-force-reset] Clearing profile WhatsApp data`);
    const { error: clearError } = await supabase
      .from('profiles')
      .update({
        whatsapp_instance_id: null,
        whatsapp_connected_phone: null,
        whatsapp_connected_at: null,
        whatsapp_to_clients_enabled: false,
      })
      .eq('id', userId);

    if (clearError) {
      console.error('[whatsapp-force-reset] Error clearing profile:', clearError);
      return new Response(JSON.stringify({ error: 'Erro ao limpar dados do perfil' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Create a new instance with a new name
    const shortUserId = userId.substring(0, 8);
    const timestamp = Date.now().toString(36).substring(-4);
    const newInstanceName = `cf_${shortUserId}_${timestamp}`;
    console.log(`[whatsapp-force-reset] Creating new instance: ${newInstanceName}`);

    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-connection-webhook`;
    
    const createResponse = await evolutionFetch(`${evolutionApiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceName: newInstanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        rejectCall: false,
        readMessages: false,
        readStatus: false,
        alwaysOnline: true,
        syncFullHistory: false,
        webhook: {
          url: webhookUrl,
          byEvents: true,
          base64: false,
          events: [
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "MESSAGES_UPSERT"
          ]
        }
      }),
    });

    const createText = await createResponse.text();
    console.log(`[whatsapp-force-reset] Create response: ${createResponse.status}`, createText);

    if (!createResponse.ok && createResponse.status !== 403) {
      return new Response(JSON.stringify({ 
        error: 'Erro ao criar nova instância',
        details: createText 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Get QR code for the new instance
    console.log(`[whatsapp-force-reset] Getting QR code for new instance`);
    const connectResponse = await evolutionFetch(`${evolutionApiUrl}/instance/connect/${newInstanceName}`, {
      method: 'GET',
    });

    const connectText = await connectResponse.text();
    console.log(`[whatsapp-force-reset] Connect response: ${connectResponse.status}`);

    let qrCodeBase64 = null;
    if (connectResponse.ok) {
      try {
        const connectData = JSON.parse(connectText);
        if (connectData.base64) {
          qrCodeBase64 = connectData.base64;
        }
      } catch (e) {
        console.error('[whatsapp-force-reset] Error parsing connect response:', e);
      }
    }

    // Step 5: Save new instance ID to profile
    console.log(`[whatsapp-force-reset] Saving new instance ID to profile`);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        whatsapp_instance_id: newInstanceName,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[whatsapp-force-reset] Error updating profile with new instance:', updateError);
    }

    console.log(`[whatsapp-force-reset] Force reset completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        instanceName: newInstanceName,
        qrCode: qrCodeBase64,
        message: 'Instância recriada com sucesso! Escaneie o novo QR Code.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('[whatsapp-force-reset] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
