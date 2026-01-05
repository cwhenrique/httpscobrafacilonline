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

// Helper to send list with specific format
const trySendList = async (
  url: string,
  apiKey: string,
  phone: string,
  listData: ListData,
  useValuesFormat: boolean
): Promise<{ ok: boolean; data: any }> => {
  const formatName = useValuesFormat ? 'values' : 'sections';
  console.log(`Trying sendList with ${formatName} format...`);
  
  let body: any = {
    number: phone,
    title: truncate(listData.title, 60),
    description: truncate(listData.description, 1024),
    buttonText: truncate(listData.buttonText, 20),
    footerText: truncate(listData.footerText || '', 60),
  };

  const mappedSections = listData.sections.map(section => ({
    title: truncate(section.title, 24),
    rows: section.rows.map(row => ({
      title: truncate(row.title, 24),
      description: truncate(row.description, 72),
      rowId: row.rowId,
    })),
  }));

  // Evolution API v2 uses "values", older versions use "sections"
  if (useValuesFormat) {
    body.values = mappedSections;
  } else {
    body.sections = mappedSections;
  }

  console.log(`List payload (${formatName}): sections=${mappedSections.length}, rows=${mappedSections.reduce((acc, s) => acc + s.rows.length, 0)}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  console.log(`sendList (${formatName}) response:`, response.status, JSON.stringify(data).substring(0, 200));
  
  return { ok: response.ok, data };
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-whatsapp function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrlRaw = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = "notficacao";

    console.log("Raw EVOLUTION_API_URL:", evolutionApiUrlRaw);
    console.log("Using fixed system instance: notficacao");

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
    const isListMessage = !!listData && !message;

    // For regular text messages
    if (!isListMessage) {
      const textUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
      console.log(`Sending WhatsApp TEXT to: ${formattedPhone}`);
      
      const response = await fetch(textUrl, {
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
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // For list messages - try multiple formats
    const listUrl = `${evolutionApiUrl}/message/sendList/${instanceName}`;
    console.log(`Sending WhatsApp LIST to: ${formattedPhone}`);
    console.log(`Full API URL: ${listUrl}`);

    // Try 1: Evolution API v2 format with "values"
    const result1 = await trySendList(listUrl, evolutionApiKey, formattedPhone, listData, true);
    if (result1.ok) {
      console.log("SUCCESS: List sent with 'values' format");
      return new Response(
        JSON.stringify({ success: true, data: result1.data, format: 'values' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Try 2: Legacy format with "sections"
    console.log("'values' format failed, trying 'sections' format...");
    const result2 = await trySendList(listUrl, evolutionApiKey, formattedPhone, listData, false);
    if (result2.ok) {
      console.log("SUCCESS: List sent with 'sections' format");
      return new Response(
        JSON.stringify({ success: true, data: result2.data, format: 'sections' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Try 3: Fallback to plain text
    console.log("Both list formats failed, falling back to text...");
    const fallbackUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
    const fallbackMessage = `${listData.title}\n\n${listData.description}\n\n${listData.footerText || ''}`;
    
    const fallbackResponse = await fetch(fallbackUrl, {
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
    
    const fallbackData = await fallbackResponse.json();
    console.log("Fallback text response:", fallbackData);
    
    if (!fallbackResponse.ok) {
      throw new Error(`Evolution API error: ${JSON.stringify(fallbackData)}`);
    }
    
    return new Response(
      JSON.stringify({ success: true, data: fallbackData, fallback: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

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
