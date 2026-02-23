import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// UAZAPI webhook configuration is done via the UAZAPI admin panel, not via API calls.
// This function is kept as a stub for backward compatibility.
const handler = async (req: Request): Promise<Response> => {
  console.log("whatsapp-configure-webhook - UAZAPI webhooks are configured via admin panel");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'UAZAPI webhooks are configured via the admin panel. No API call needed.',
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
};

serve(handler);
