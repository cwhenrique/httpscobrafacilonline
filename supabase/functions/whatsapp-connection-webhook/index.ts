import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // Evolution API webhook events
    const event = body.event || body.type;
    const instance = body.instance || body.instanceName;
    const data = body.data || body;

    console.log(`Event: ${event}, Instance: ${instance}`);

    // Only process CONNECTION_UPDATE events
    if (event !== 'CONNECTION_UPDATE' && event !== 'connection.update') {
      console.log('Ignoring non-connection event:', event);
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get connection state from the event
    const state = data?.state || data?.connection?.state || data?.statusReason;
    console.log(`Connection state: ${state}`);

    // Get Evolution API credentials
    const rawEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!rawEvolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API not configured');
      return new Response(JSON.stringify({ error: 'Evolution API not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean the URL
    const urlMatch = rawEvolutionApiUrl.match(/^(https?:\/\/[^\/]+)/);
    const evolutionApiUrl = urlMatch ? urlMatch[1] : rawEvolutionApiUrl;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by instance name
    const instanceName = instance?.instanceName || instance;
    if (!instanceName) {
      console.log('No instance name in webhook');
      return new Response(JSON.stringify({ received: true, noInstance: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, whatsapp_instance_id, whatsapp_connected_phone')
      .eq('whatsapp_instance_id', instanceName)
      .single();

    if (profileError || !profile) {
      console.log('Profile not found for instance:', instanceName);
      return new Response(JSON.stringify({ received: true, profileNotFound: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found user ${profile.id} for instance ${instanceName}`);

    // Handle disconnection - try to reconnect automatically
    if (state === 'close' || state === 'disconnected' || state === 'DISCONNECTED') {
      console.log(`Instance ${instanceName} disconnected - attempting auto-reconnect...`);

      // Wait a moment before trying to reconnect
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Try to restart the instance
        const restartResponse = await fetch(`${evolutionApiUrl}/instance/restart/${instanceName}`, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
        });

        const restartText = await restartResponse.text();
        console.log('Restart response:', restartResponse.status, restartText);

        if (restartResponse.ok) {
          // Wait for restart to take effect
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Check if reconnected
          const stateResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: {
              'apikey': evolutionApiKey,
            },
          });

          if (stateResponse.ok) {
            const stateData = await stateResponse.json();
            const newState = stateData?.instance?.state || stateData?.state;
            console.log('State after restart:', newState);

            if (newState === 'open') {
              console.log('Auto-reconnect successful!');
              
              // Update profile with reconnection time
              await supabase
                .from('profiles')
                .update({
                  whatsapp_connected_at: new Date().toISOString(),
                })
                .eq('id', profile.id);

              return new Response(JSON.stringify({ 
                received: true, 
                reconnected: true,
                state: newState 
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        }

        // If restart didn't work, try connect endpoint
        console.log('Restart did not reconnect, trying connect endpoint...');
        
        const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': evolutionApiKey,
          },
        });

        const connectText = await connectResponse.text();
        console.log('Connect response:', connectResponse.status, connectText);

        if (connectResponse.ok) {
          try {
            const connectData = JSON.parse(connectText);
            
            // If we got a QR code, the session was lost and needs re-scan
            if (connectData.base64 || connectData.code) {
              console.log('Session lost - QR code needed for reconnection');
              
              // Clear connected phone since session is lost
              await supabase
                .from('profiles')
                .update({
                  whatsapp_connected_phone: null,
                  whatsapp_connected_at: null,
                })
                .eq('id', profile.id);

              return new Response(JSON.stringify({ 
                received: true, 
                reconnected: false,
                needsQR: true 
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          } catch (e) {
            console.log('Could not parse connect response:', e);
          }
        }
      } catch (reconnectError) {
        console.error('Error during auto-reconnect:', reconnectError);
      }

      console.log('Auto-reconnect failed');
      return new Response(JSON.stringify({ 
        received: true, 
        reconnected: false,
        state: 'disconnected' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle successful connection
    if (state === 'open' || state === 'connected' || state === 'CONNECTED') {
      console.log(`Instance ${instanceName} connected`);

      // Try to get phone number
      let phoneNumber = profile.whatsapp_connected_phone;

      try {
        const fetchResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': evolutionApiKey,
          },
        });

        if (fetchResponse.ok) {
          const instances = await fetchResponse.json();
          const inst = Array.isArray(instances) ? instances[0] : instances;
          const owner = inst?.instance?.owner || inst?.owner;
          
          if (owner) {
            phoneNumber = owner.replace('@s.whatsapp.net', '').replace(/\D/g, '');
            console.log('Found phone number:', phoneNumber);
          }
        }
      } catch (e) {
        console.log('Could not fetch phone number:', e);
      }

      // Update profile
      await supabase
        .from('profiles')
        .update({
          whatsapp_connected_at: new Date().toISOString(),
          whatsapp_to_clients_enabled: true,
          ...(phoneNumber ? { whatsapp_connected_phone: phoneNumber } : {}),
        })
        .eq('id', profile.id);

      return new Response(JSON.stringify({ 
        received: true, 
        connected: true,
        phoneNumber 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For other states, just acknowledge
    console.log('Unhandled state:', state);
    return new Response(JSON.stringify({ received: true, state }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in whatsapp-connection-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
