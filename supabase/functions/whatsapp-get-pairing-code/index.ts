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
    const { userId, phoneNumber } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!phoneNumber) {
      return new Response(JSON.stringify({ error: 'Número de telefone é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean phone number - remove all non-digits
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Validate phone number format (should have at least 10 digits with country code)
    if (cleanPhone.length < 10) {
      return new Response(JSON.stringify({ error: 'Número de telefone inválido. Use o formato: 5511999999999' }), {
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

    // Get user's instance name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_instance_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.whatsapp_instance_id) {
      // If no instance exists, we need to create one first
      console.log('No instance found, creating new instance first...');
      
      // Generate instance name
      const instanceName = `cf_${userId.substring(0, 8)}`;
      
      // Create the instance
      const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: false, // We don't need QR code for pairing code method
          integration: 'WHATSAPP-BAILEYS',
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Error creating instance:', errorText);
        
        // Instance might already exist, try to continue
        if (!errorText.includes('already exists')) {
          return new Response(JSON.stringify({ error: 'Erro ao criar instância WhatsApp' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Update user profile with instance ID
      await supabase
        .from('profiles')
        .update({ whatsapp_instance_id: instanceName })
        .eq('id', userId);
    }

    const instanceName = profile?.whatsapp_instance_id || `cf_${userId.substring(0, 8)}`;
    console.log(`Getting pairing code for instance: ${instanceName}, phone: ${cleanPhone}`);

    // First, check current state
    const stateResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
      },
    });

    if (stateResponse.ok) {
      const stateData = await stateResponse.json();
      const state = stateData?.instance?.state || stateData?.state;
      console.log('Current state:', state);

      // If already connected, no need for pairing code
      if (state === 'open') {
        return new Response(JSON.stringify({ 
          success: true, 
          alreadyConnected: true,
          message: 'WhatsApp já está conectado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If stuck in connecting state, do a logout first
      if (state === 'connecting') {
        console.log('Instance is in connecting state, doing logout first...');
        
        try {
          await fetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: {
              'apikey': evolutionApiKey,
            },
          });
          
          // Wait for logout
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) {
          console.log('Logout attempt error (continuing anyway):', e);
        }
      }
    }

    // Request pairing code by calling connect with the phone number in the body
    console.log('Requesting pairing code...');
    const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: cleanPhone,
      }),
    });

    const connectText = await connectResponse.text();
    console.log('Connect response:', connectResponse.status, connectText.substring(0, 500));

    if (!connectResponse.ok) {
      console.error('Error getting pairing code:', connectText);
      
      // Try restart and retry
      try {
        await fetch(`${evolutionApiUrl}/instance/restart/${instanceName}`, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const retryResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: cleanPhone,
          }),
        });
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          
          if (retryData.pairingCode) {
            // Format pairing code with hyphen for readability (e.g., WZYEH1YY -> WZYE-H1YY)
            const code = retryData.pairingCode;
            const formattedCode = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
            
            return new Response(JSON.stringify({ 
              success: true, 
              pairingCode: formattedCode,
              instanceName,
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (retryError) {
        console.error('Retry error:', retryError);
      }

      return new Response(JSON.stringify({ error: 'Erro ao obter código de pareamento. Tente novamente.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const connectData = JSON.parse(connectText);
      
      if (connectData.pairingCode) {
        console.log('Successfully got pairing code');
        
        // Format pairing code with hyphen for readability (e.g., WZYEH1YY -> WZYE-H1YY)
        const code = connectData.pairingCode;
        const formattedCode = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
        
        return new Response(JSON.stringify({ 
          success: true, 
          pairingCode: formattedCode,
          instanceName,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (connectData.instance?.state === 'open') {
        return new Response(JSON.stringify({ 
          success: true, 
          alreadyConnected: true,
          message: 'WhatsApp já está conectado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If we got a QR code instead of pairing code, that's an error
      if (connectData.base64) {
        return new Response(JSON.stringify({ 
          error: 'O servidor retornou um QR Code ao invés do código de pareamento. Tente novamente.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('No pairing code in response:', connectData);
      return new Response(JSON.stringify({ error: 'Código de pareamento não disponível. Verifique o número e tente novamente.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (e) {
      console.error('Error parsing response:', e);
      return new Response(JSON.stringify({ error: 'Erro ao processar resposta' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Error in whatsapp-get-pairing-code:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
