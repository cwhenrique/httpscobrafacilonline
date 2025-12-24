import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppRequest {
  phone: string;
  message: string;
}

const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // If doesn't have country code, add Brazil's
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
};

const cleanApiUrl = (url: string): string => {
  // Remove trailing slashes
  let cleaned = url.replace(/\/+$/, '');
  
  // Remove any path that might have been accidentally included
  const pathPatterns = [
    /\/message\/sendText\/[^\/]+$/i,
    /\/message\/sendText$/i,
    /\/message$/i,
  ];
  
  for (const pattern of pathPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  return cleaned;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-whatsapp-cobrafacil function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrlRaw = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    // Usar instância fixa "VendaApp" para notificações do sistema
    const instanceName = "VendaApp";

    console.log("Raw EVOLUTION_API_URL:", evolutionApiUrlRaw);
    console.log("Using fixed system instance: VendaApp");

    if (!evolutionApiUrlRaw || !evolutionApiKey) {
      console.error("Missing Evolution API configuration");
      throw new Error("Evolution API not configured");
    }

    // Clean the API URL to remove any accidentally included paths
    const evolutionApiUrl = cleanApiUrl(evolutionApiUrlRaw);
    console.log("Cleaned EVOLUTION_API_URL:", evolutionApiUrl);

    const { phone, message }: WhatsAppRequest = await req.json();
    
    if (!phone || !message) {
      throw new Error("Phone and message are required");
    }

    const formattedPhone = formatPhoneNumber(phone);
    const fullUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
    
    console.log(`Sending WhatsApp via Cobrafacilapp to: ${formattedPhone}`);
    console.log(`Full API URL: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const responseData = await response.json();
    console.log("Evolution API response:", responseData);

    if (!response.ok) {
      throw new Error(`Evolution API error: ${JSON.stringify(responseData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending WhatsApp via Cobrafacilapp:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
