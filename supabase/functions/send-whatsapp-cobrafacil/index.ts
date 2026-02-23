import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppRequest {
  phone: string;
  message: string;
  userId?: string;
}

const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-whatsapp-cobrafacil function called (UAZAPI)");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const uazapiUrl = Deno.env.get("UAZAPI_URL");
    if (!uazapiUrl) {
      throw new Error("UAZAPI not configured");
    }

    const { phone, message, userId }: WhatsAppRequest = await req.json();

    if (!phone || !message) {
      throw new Error("Phone and message are required");
    }

    // Get instance token from user's profile
    let instanceToken: string | null = null;

    if (userId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: profile } = await supabase
        .from('profiles')
        .select('whatsapp_instance_token')
        .eq('id', userId)
        .single();
      instanceToken = profile?.whatsapp_instance_token || null;
    }

    if (!instanceToken) {
      console.error("No instance token available");
      throw new Error("No WhatsApp instance token available");
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`Sending WhatsApp via UAZAPI (cobrafacil) to: ${formattedPhone}`);

    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": instanceToken,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const responseData = await response.json();
    console.log("UAZAPI response:", responseData);

    if (!response.ok) {
      throw new Error(`UAZAPI error: ${JSON.stringify(responseData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending WhatsApp via cobrafacil:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
