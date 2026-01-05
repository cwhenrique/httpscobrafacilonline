import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookConfig {
  instanceName: string;
  webhookUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("whatsapp-configure-webhook function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrlRaw = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!evolutionApiUrlRaw || !evolutionApiKey) {
      throw new Error("Evolution API not configured");
    }

    if (!supabaseUrl) {
      throw new Error("Supabase URL not configured");
    }

    // Clean the API URL
    let evolutionApiUrl = evolutionApiUrlRaw.replace(/\/+$/, '');
    const pathPatterns = [
      /\/message\/sendText\/[^\/]+$/i,
      /\/message\/sendList\/[^\/]+$/i,
      /\/message\/sendText$/i,
      /\/message\/sendList$/i,
      /\/message$/i,
    ];
    for (const pattern of pathPatterns) {
      evolutionApiUrl = evolutionApiUrl.replace(pattern, '');
    }

    const { instanceName, webhookUrl }: WebhookConfig = await req.json();

    if (!instanceName) {
      throw new Error("instanceName is required");
    }

    // Default webhook URL points to our message webhook
    const finalWebhookUrl = webhookUrl || `${supabaseUrl}/functions/v1/whatsapp-message-webhook`;

    console.log(`Configuring webhook for instance: ${instanceName}`);
    console.log(`Webhook URL: ${finalWebhookUrl}`);

    // Configure the webhook in Evolution API
    const webhookSetUrl = `${evolutionApiUrl}/webhook/set/${instanceName}`;
    console.log(`Calling: ${webhookSetUrl}`);

    const response = await fetch(webhookSetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey,
      },
      body: JSON.stringify({
        enabled: true,
        url: finalWebhookUrl,
        webhookByEvents: true,
        webhookBase64: false,
        events: [
          "MESSAGES_UPSERT",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED"
        ],
      }),
    });

    const responseData = await response.json();
    console.log("Webhook configuration response:", JSON.stringify(responseData));

    if (!response.ok) {
      throw new Error(`Failed to configure webhook: ${JSON.stringify(responseData)}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Webhook configured for instance ${instanceName}`,
        data: responseData 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error configuring webhook:", error);
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
