import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        console.log(`Extracted phone ${phone} from source: ${source}`);
        return phone;
      }
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, attemptReconnect } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id, whatsapp_connected_phone, whatsapp_connected_at')
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
      return new Response(JSON.stringify({ 
        connected: false,
        status: 'not_configured',
        message: 'WhatsApp não configurado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceName = profile.whatsapp_instance_id;
    console.log(`Checking status for instance: ${instanceName}`);

    // Check connection state
    const stateResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
      },
    });

    const stateText = await stateResponse.text();
    console.log('Connection state response:', stateResponse.status, stateText);

    if (!stateResponse.ok) {
      // Instance might not exist - try to recreate it
      console.log('Instance not found, may need recreation');
      
      // Try to restart/create the instance
      if (attemptReconnect) {
        try {
          const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
            method: 'POST',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              instanceName: instanceName,
              qrcode: true,
              integration: 'WHATSAPP-BAILEYS',
              alwaysOnline: true,
            }),
          });
          
          console.log('Recreate instance response:', createResponse.status);
          
          if (createResponse.ok) {
            return new Response(JSON.stringify({ 
              connected: false,
              status: 'recreated',
              instanceName,
              needsNewQR: true,
              message: 'Instância recriada. Escaneie o QR Code para conectar.'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          console.error('Error recreating instance:', e);
        }
      }
      
      return new Response(JSON.stringify({ 
        connected: false,
        status: 'disconnected',
        instanceName,
        needsNewQR: true,
        message: 'Instância não encontrada. Gere um novo QR Code.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const stateData = JSON.parse(stateText);
      let state = stateData?.instance?.state || stateData?.state;
      let isConnected = state === 'open';
      let reconnected = false;
      let needsNewQR = false;
      let statusMessage = '';

      console.log(`Instance state: ${state}, isConnected: ${isConnected}`);

      // Handle "connecting" state - this means QR was shown but not scanned or connection is stuck
      if (state === 'connecting') {
        console.log('Instance is in "connecting" state - waiting for QR scan or stuck');
        
        // Don't try to reconnect, just report the status
        // The user needs to scan the QR code
        return new Response(JSON.stringify({ 
          connected: false,
          status: 'connecting',
          instanceName,
          needsNewQR: false, // Don't suggest new QR yet, user might be scanning
          waitingForScan: true,
          message: 'Aguardando leitura do QR Code...'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If disconnected (close state) and attemptReconnect is true, try to restart
      if (!isConnected && attemptReconnect && (state === 'close' || state === 'disconnected')) {
        console.log(`Attempting to restart instance: ${instanceName}`);
        
        try {
          // Method 1: Try restart endpoint
          const restartResponse = await fetch(`${evolutionApiUrl}/instance/restart/${instanceName}`, {
            method: 'POST',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json',
            },
          });
          
          console.log('Restart response:', restartResponse.status);
          
          if (restartResponse.ok) {
            // Wait a bit for the restart to take effect
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check status again
            const recheckResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
              method: 'GET',
              headers: {
                'apikey': evolutionApiKey,
              },
            });
            
            if (recheckResponse.ok) {
              const recheckData = await recheckResponse.json();
              const newState = recheckData?.instance?.state || recheckData?.state;
              console.log('State after restart:', newState);
              
              if (newState === 'open') {
                state = newState;
                isConnected = true;
                reconnected = true;
                statusMessage = 'Conexão restaurada automaticamente!';
              } else if (newState === 'connecting') {
                // Restart triggered QR code - needs scan
                needsNewQR = true;
                statusMessage = 'Escaneie o QR Code para reconectar.';
              }
            }
          }
        } catch (restartError) {
          console.error('Error restarting instance:', restartError);
        }

        // Method 2: If restart didn't fully connect, try connect endpoint
        if (!isConnected && !needsNewQR) {
          try {
            const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
              method: 'GET',
              headers: {
                'apikey': evolutionApiKey,
              },
            });
            
            console.log('Connect response:', connectResponse.status);
            
            if (connectResponse.ok) {
              const connectData = await connectResponse.json();
              
              // Check if we got a QR code (meaning it needs scanning)
              if (connectData.base64 || connectData.code) {
                needsNewQR = true;
                statusMessage = 'QR Code disponível para reconexão.';
              } else {
                // Wait a bit and check status
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const recheckResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
                  method: 'GET',
                  headers: {
                    'apikey': evolutionApiKey,
                  },
                });
                
                if (recheckResponse.ok) {
                  const recheckData = await recheckResponse.json();
                  const newState = recheckData?.instance?.state || recheckData?.state;
                  console.log('State after connect:', newState);
                  
                  if (newState === 'open') {
                    state = newState;
                    isConnected = true;
                    reconnected = true;
                    statusMessage = 'Conexão restaurada!';
                  }
                }
              }
            }
          } catch (connectError) {
            console.error('Error connecting instance:', connectError);
          }
        }

        // If still not connected after attempts, mark as needing new QR
        if (!isConnected && !needsNewQR) {
          needsNewQR = true;
          statusMessage = 'Não foi possível reconectar. Gere um novo QR Code.';
        }
      }

      // If disconnected without attemptReconnect
      if (!isConnected && !attemptReconnect && (state === 'close' || state === 'disconnected')) {
        needsNewQR = true;
        statusMessage = 'Conexão perdida. Gere um novo QR Code para reconectar.';
      }

      // If connected, try to get the phone number
      let phoneNumber = profile.whatsapp_connected_phone;
      
      if (isConnected) {
        // Always try to fetch the phone number if connected (even if we have one stored)
        try {
          // Method 1: Try fetchInstances - this has ownerJid
          const fetchResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
            method: 'GET',
            headers: {
              'apikey': evolutionApiKey,
            },
          });
          
          if (fetchResponse.ok) {
            const instances = await fetchResponse.json();
            console.log('Fetch instances response:', JSON.stringify(instances));
            const instance = Array.isArray(instances) ? instances[0] : instances;
            
            // Use the helper function to extract phone from ownerJid or owner
            const extractedPhone = extractPhoneNumber(instance);
            if (extractedPhone) {
              phoneNumber = extractedPhone;
              console.log('Found phone number from fetchInstances:', phoneNumber);
            }
          }
        } catch (e) {
          console.log('Could not fetch phone number from fetchInstances:', e);
        }

        // Method 2: Try to get from connection state if not found
        if (!phoneNumber) {
          try {
            const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
              method: 'GET',
              headers: {
                'apikey': evolutionApiKey,
              },
            });
            
            if (connectResponse.ok) {
              const connectData = await connectResponse.json();
              console.log('Connect response for phone:', JSON.stringify(connectData));
              const extractedPhone = extractPhoneNumber(connectData);
              if (extractedPhone) {
                phoneNumber = extractedPhone;
                console.log('Found phone number from connect:', phoneNumber);
              }
            }
          } catch (e) {
            console.log('Could not fetch phone number from connect:', e);
          }
        }

        // Update profile with connection info
        const updateData: Record<string, unknown> = {
          whatsapp_connected_at: profile.whatsapp_connected_at || new Date().toISOString(),
          whatsapp_to_clients_enabled: true,
        };
        
        // Only update phone if we found one
        if (phoneNumber) {
          updateData.whatsapp_connected_phone = phoneNumber;
        }
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId);
          
        if (updateError) {
          console.error('Error updating profile:', updateError);
        } else {
          console.log('Profile updated with:', updateData);
        }
      }

      return new Response(JSON.stringify({ 
        connected: isConnected,
        status: state,
        instanceName,
        phoneNumber: phoneNumber || null,
        connectedAt: profile.whatsapp_connected_at,
        reconnected,
        needsNewQR,
        message: statusMessage || undefined,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (e) {
      console.error('Error parsing state response:', e);
      return new Response(JSON.stringify({ 
        connected: false,
        status: 'error',
        instanceName,
        needsNewQR: true,
        message: 'Erro ao verificar conexão. Tente gerar um novo QR Code.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Error in whatsapp-check-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
