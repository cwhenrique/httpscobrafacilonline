import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ListRow {
  title: string;
  description: string;
  rowId: string;
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

interface ListData {
  title: string;
  description: string;
  buttonText: string;
  footerText: string;
  sections: ListSection[];
}

// Helper to truncate strings for API limits
const truncate = (str: string, max: number): string => 
  str.length > max ? str.substring(0, max - 3) + '...' : str;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, clientPhone, message, listData } = await req.json();

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

    if (!message && !listData) {
      console.error('Missing message and listData');
      return new Response(JSON.stringify({ error: 'message ou listData é obrigatório' }), {
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

    const instanceName = profile.whatsapp_instance_id;
    
    // CRITICAL: Check real-time connection state before attempting to send
    console.log(`Checking real-time connection state for instance: ${instanceName}`);
    
    try {
      const stateResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': evolutionApiKey,
        },
      });
      
      const stateText = await stateResponse.text();
      console.log('Connection state check:', stateResponse.status, stateText);
      
      if (!stateResponse.ok) {
        console.error('Instance not found or error checking state');
        return new Response(JSON.stringify({ 
          error: 'WhatsApp desconectado. Reconecte nas configurações escaneando o QR Code.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const stateData = JSON.parse(stateText);
      const instanceState = stateData?.instance?.state || stateData?.state;
      console.log(`Real-time instance state: ${instanceState}`);
      
      if (instanceState !== 'open') {
        console.error(`Instance not connected. State: ${instanceState}`);
        
        let errorMessage = 'WhatsApp não conectado.';
        if (instanceState === 'connecting') {
          errorMessage = 'WhatsApp aguardando leitura do QR Code. Acesse as configurações para escanear.';
        } else if (instanceState === 'close' || instanceState === 'disconnected') {
          errorMessage = 'WhatsApp desconectado. Reconecte nas configurações escaneando o QR Code.';
        }
        
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Also update the profile if we detect it's connected but phone is missing
      if (instanceState === 'open' && !profile.whatsapp_connected_phone) {
        console.log('Instance is open but phone is missing in profile, attempting to update...');
        
        try {
          const fetchResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
            method: 'GET',
            headers: { 'apikey': evolutionApiKey },
          });
          
          if (fetchResponse.ok) {
            const instances = await fetchResponse.json();
            const inst = Array.isArray(instances) ? instances[0] : instances;
            
            // Extract phone from ownerJid
            const ownerJid = inst?.ownerJid || inst?.owner || inst?.instance?.ownerJid || inst?.instance?.owner;
            if (typeof ownerJid === 'string' && ownerJid.includes('@')) {
              const phoneNumber = ownerJid.split('@')[0].replace(/\D/g, '');
              if (phoneNumber.length >= 10) {
                console.log('Found and updating phone number:', phoneNumber);
                await supabase
                  .from('profiles')
                  .update({
                    whatsapp_connected_phone: phoneNumber,
                    whatsapp_connected_at: new Date().toISOString(),
                    whatsapp_to_clients_enabled: true,
                  })
                  .eq('id', userId);
              }
            }
          }
        } catch (e) {
          console.log('Could not update missing phone:', e);
        }
      }
      
    } catch (stateError) {
      console.error('Error checking connection state:', stateError);
      return new Response(JSON.stringify({ 
        error: 'Erro ao verificar conexão do WhatsApp. Tente novamente.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format phone number (remove non-digits)
    const formattedPhone = clientPhone.replace(/\D/g, '');
    
    // Validate phone has actual digits (not just empty or whitespace)
    if (!formattedPhone || formattedPhone.length < 8) {
      console.error('Invalid phone number after formatting:', formattedPhone);
      return new Response(JSON.stringify({ error: 'Número de telefone do cliente inválido ou não cadastrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Add country code if not present
    const phoneWithCountryCode = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

    console.log(`Sending WhatsApp to client via user's instance`);
    console.log(`Instance: ${instanceName}`);
    console.log(`Phone: ${phoneWithCountryCode}`);

    // Decide which endpoint to use based on listData presence
    if (listData) {
      // Use sendList endpoint for interactive list messages
      const apiUrl = `${evolutionApiUrl}/message/sendList/${instanceName}`;
      
      console.log('Sending interactive LIST message');

      // Prepare sections with truncated values
      const preparedSections = (listData as ListData).sections.slice(0, 10).map((section: ListSection) => ({
        title: truncate(section.title, 24),
        rows: section.rows.slice(0, 10).map((row: ListRow) => ({
          title: truncate(row.title, 24),
          description: truncate(row.description, 72),
          rowId: row.rowId,
        })),
      }));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
          number: phoneWithCountryCode,
          title: truncate((listData as ListData).title, 60),
          description: truncate((listData as ListData).description, 1024),
          buttonText: truncate((listData as ListData).buttonText, 20),
          footerText: truncate((listData as ListData).footerText, 60),
          sections: preparedSections,
        }),
      });

      const responseText = await response.text();
      console.log('Evolution API (sendList) response status:', response.status);
      console.log('Evolution API (sendList) response:', responseText);

      if (!response.ok) {
        console.error('Evolution API sendList error, falling back to text message');
        // Fallback to text message if list fails
        const fallbackMessage = `${(listData as ListData).title}\n\n${(listData as ListData).description}\n\n${(listData as ListData).footerText}`;
        
        const textUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
        const textResponse = await fetch(textUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: phoneWithCountryCode,
            text: fallbackMessage,
          }),
        });
        
        const textData = await textResponse.text();
        console.log('Fallback text response:', textData);
        
        let result;
        try {
          result = JSON.parse(textData);
        } catch {
          result = { raw: textData };
        }

        if (!textResponse.ok) {
          return new Response(JSON.stringify({ 
            error: 'Erro ao enviar mensagem pelo WhatsApp',
            details: textData 
          }), {
            status: textResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Mensagem enviada com sucesso para o cliente (fallback)',
          result,
          fallback: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { raw: responseText };
      }

      console.log('WhatsApp LIST message sent successfully to client:', phoneWithCountryCode);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso para o cliente',
        result 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Use standard sendText endpoint
      const apiUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
      
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
        
        // Try to parse error for better message
        let errorDetail = 'Erro ao enviar mensagem pelo WhatsApp';
        let errorCode = 'UNKNOWN_ERROR';
        
        try {
          const errorData = JSON.parse(responseText);
          
          // Detect "number does not exist on WhatsApp" error
          const messageInfo = errorData?.response?.message;
          if (Array.isArray(messageInfo) && messageInfo[0]?.exists === false) {
            const invalidNumber = messageInfo[0]?.number || phoneWithCountryCode;
            errorDetail = `O número ${invalidNumber} não possui WhatsApp ou está inválido. Verifique o cadastro do cliente.`;
            errorCode = 'NUMBER_NOT_ON_WHATSAPP';
            console.error('Number not on WhatsApp:', invalidNumber);
          } else if (errorData?.message) {
            errorDetail = errorData.message;
          }
        } catch {
          // Use default error message
        }
        
        return new Response(JSON.stringify({ 
          error: errorDetail,
          errorCode: errorCode,
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
    }

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
