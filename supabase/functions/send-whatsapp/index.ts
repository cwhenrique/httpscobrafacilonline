import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

interface WhatsAppRequest {
  phone: string;
  message?: string;
  listData?: ListData;
}

const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
};

const cleanApiUrl = (url: string): string => {
  let cleaned = url.replace(/\/+$/, '');
  const pathPatterns = [
    /\/message\/sendText\/[^\/]+$/i,
    /\/message\/sendList\/[^\/]+$/i,
    /\/message\/sendText$/i,
    /\/message\/sendList$/i,
    /\/message$/i,
  ];
  for (const pattern of pathPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned;
};

// Helper to truncate strings for API limits
const truncate = (str: string, max: number): string => 
  str.length > max ? str.substring(0, max - 3) + '...' : str;

const handler = async (req: Request): Promise<Response> => {
  console.log("send-whatsapp function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrlRaw = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = "VendaApp";

    console.log("Raw EVOLUTION_API_URL:", evolutionApiUrlRaw);
    console.log("Using fixed system instance: VendaApp");

    if (!evolutionApiUrlRaw || !evolutionApiKey) {
      console.error("Missing Evolution API configuration");
      throw new Error("Evolution API not configured");
    }

    const evolutionApiUrl = cleanApiUrl(evolutionApiUrlRaw);
    console.log("Cleaned EVOLUTION_API_URL:", evolutionApiUrl);

    const { phone, message, listData }: WhatsAppRequest = await req.json();
    
    if (!phone) {
      throw new Error("Phone is required");
    }

    if (!message && !listData) {
      throw new Error("Either message or listData is required");
    }

    const formattedPhone = formatPhoneNumber(phone);
    
    // Decide which endpoint to use based on listData presence
    if (listData) {
      // Use sendList endpoint for interactive list messages
      const fullUrl = `${evolutionApiUrl}/message/sendList/${instanceName}`;
      
      console.log(`Sending WhatsApp LIST to: ${formattedPhone}`);
      console.log(`Full API URL: ${fullUrl}`);

      // Prepare sections with truncated values
      const preparedSections = listData.sections.slice(0, 10).map(section => ({
        title: truncate(section.title, 24),
        rows: section.rows.slice(0, 10).map(row => ({
          title: truncate(row.title, 24),
          description: truncate(row.description, 72),
          rowId: row.rowId,
        })),
      }));

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
          title: truncate(listData.title, 60),
          description: truncate(listData.description, 1024),
          buttonText: truncate(listData.buttonText, 20),
          footerText: truncate(listData.footerText, 60),
          sections: preparedSections,
        }),
      });

      const responseData = await response.json();
      console.log("Evolution API (sendList) response:", responseData);

      if (!response.ok) {
        console.error("Evolution API sendList error, falling back to text message");
        // Fallback to text message if list fails
        const fallbackMessage = `${listData.title}\n\n${listData.description}\n\n${listData.footerText}`;
        const textUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
        
        const textResponse = await fetch(textUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionApiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: fallbackMessage,
          }),
        });
        
        const textData = await textResponse.json();
        console.log("Fallback text response:", textData);
        
        return new Response(
          JSON.stringify({ success: textResponse.ok, data: textData, fallback: true }),
          {
            status: textResponse.ok ? 200 : 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: responseData }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      // Use standard sendText endpoint
      const fullUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
      
      console.log(`Sending WhatsApp TEXT to: ${formattedPhone}`);
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
    }
  } catch (error: any) {
    console.error("Error sending WhatsApp:", error);
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
