import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory lock to prevent concurrent reconnection attempts (per instance)
// Note: Edge functions are stateless, so this only prevents concurrent calls within same execution
const processingInstances = new Set<string>();

// Helper to extract phone number from ownerJid or owner field
function extractPhoneNumber(instance: Record<string, unknown>): string | null {
  // Try multiple paths where the phone might be
  const possibleSources = [
    instance?.ownerJid,
    instance?.owner,
    (instance?.instance as Record<string, unknown>)?.ownerJid,
    (instance?.instance as Record<string, unknown>)?.owner,
  ];
  
  for (const source of possibleSources) {
    if (typeof source === 'string' && source.includes('@')) {
      // Format: "5517992415708@s.whatsapp.net" -> "5517992415708"
      const phone = source.split('@')[0].replace(/\D/g, '');
      if (phone.length >= 10) {
        return phone;
      }
    }
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // Evolution API webhook events
    const event = body.event || body.type;
    const instance = body.instance || body.instanceName;
    const data = body.data || body;

    console.log(`Event: ${event}, Instance: ${instance}`);

    // Route MESSAGES_UPSERT to the message webhook
    if (event === 'MESSAGES_UPSERT' || event === 'messages.upsert') {
      console.log('Routing message event to whatsapp-message-webhook...');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-message-webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(body),
        });
        
        const result = await response.text();
        console.log('Message webhook response:', result);
        
        return new Response(result, {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (routeError) {
        console.error('Error routing to message webhook:', routeError);
        return new Response(JSON.stringify({ error: 'Failed to route message' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle QRCODE_UPDATED events - save QR code for polling
    if (event === 'QRCODE_UPDATED' || event === 'qrcode.updated') {
      console.log('Processing QR code update event');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const instanceName = instance?.instanceName || instance;
      if (!instanceName) {
        return new Response(JSON.stringify({ received: true, noInstance: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Find user by instance name
      const { data: qrProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_instance_id', instanceName)
        .single();
      
      if (!qrProfile) {
        console.log('No profile found for QR code instance:', instanceName);
        return new Response(JSON.stringify({ received: true, profileNotFound: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Extract QR code from data
      const qrData = data?.qrcode || data;
      let qrCode = null;
      
      if (typeof qrData?.base64 === 'string' && qrData.base64.length > 100) {
        qrCode = qrData.base64;
      } else if (typeof qrData?.code === 'string' && qrData.code.length > 10) {
        qrCode = qrData.code;
      } else if (typeof qrData === 'string' && qrData.length > 100) {
        qrCode = qrData;
      }
      
      if (qrCode) {
        console.log(`Saving QR code for user ${qrProfile.id}, instance ${instanceName} (${qrCode.substring(0, 50)}...)`);
        
        // Delete old QR codes for this instance, then insert new one
        await supabase
          .from('whatsapp_qr_codes')
          .delete()
          .eq('instance_name', instanceName);
        
        await supabase
          .from('whatsapp_qr_codes')
          .insert({
            instance_name: instanceName,
            user_id: qrProfile.id,
            qr_code: qrCode,
          });
        
        return new Response(JSON.stringify({ received: true, qrSaved: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('No valid QR code found in event data');
      return new Response(JSON.stringify({ received: true, noQrFound: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      // Check statusReason - 440 means session needs re-auth via QR
      const statusReason = data?.statusReason;
      console.log(`Instance ${instanceName} disconnected with statusReason: ${statusReason}`);
      
      // If statusReason is 440, session is invalid and needs new QR scan
      // Don't try to reconnect automatically - it won't work without user scanning QR again
      if (statusReason === 440 || statusReason === 401) {
        console.log('Session expired (440/401) - user needs to scan QR code again');
        
        // Clear connection status immediately
        await supabase
          .from('profiles')
          .update({
            whatsapp_connected_phone: null,
            whatsapp_connected_at: null,
            whatsapp_to_clients_enabled: false,
          })
          .eq('id', profile.id);
        
        return new Response(JSON.stringify({ 
          received: true, 
          reconnected: false,
          needsQR: true,
          reason: 'Session expired - QR code needed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // For other disconnect reasons (network issues), attempt ONE auto-reconnect
      console.log(`Instance ${instanceName} disconnected - attempting ONE auto-reconnect...`);

      // Wait a moment before trying to reconnect
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Try to restart the instance ONCE
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
              
              // Update profile to maintain connection
              await supabase
                .from('profiles')
                .update({
                  whatsapp_connected_at: new Date().toISOString(),
                  whatsapp_to_clients_enabled: true,
                })
                .eq('id', profile.id);

              return new Response(JSON.stringify({ 
                received: true, 
                reconnected: true,
                state: newState,
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        }
      } catch (reconnectError) {
        console.error('Error during auto-reconnect:', reconnectError);
      }

      console.log('Auto-reconnect failed - clearing connection status');
      
      // Clear connection status on failed reconnect
      await supabase
        .from('profiles')
        .update({
          whatsapp_connected_phone: null,
          whatsapp_connected_at: null,
          whatsapp_to_clients_enabled: false,
        })
        .eq('id', profile.id);
      
      return new Response(JSON.stringify({ 
        received: true, 
        reconnected: false,
        state: 'disconnected',
        needsQR: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle successful connection
    if (state === 'open' || state === 'connected' || state === 'CONNECTED') {
      console.log(`Instance ${instanceName} connected - fetching phone number...`);

      // Try to get phone number from fetchInstances
      let phoneNumber: string | null = null;

      try {
        const fetchResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': evolutionApiKey,
          },
        });

        if (fetchResponse.ok) {
          const instances = await fetchResponse.json();
          console.log('Fetch instances response:', JSON.stringify(instances));
          
          const inst = Array.isArray(instances) ? instances[0] : instances;
          phoneNumber = extractPhoneNumber(inst);
          console.log('Extracted phone number:', phoneNumber);
        }
      } catch (e) {
        console.log('Could not fetch phone number:', e);
      }

      // Update profile - always set connected_at and enabled, phone if found
      const updateData: Record<string, unknown> = {
        whatsapp_connected_at: new Date().toISOString(),
        whatsapp_to_clients_enabled: true,
      };
      
      if (phoneNumber) {
        updateData.whatsapp_connected_phone = phoneNumber;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);
        
      if (updateError) {
        console.error('Error updating profile:', updateError);
      } else {
        console.log('Profile updated successfully:', updateData);
      }

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
