import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch all profiles with trial_expires_at set
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, phone, temp_password, trial_expires_at, is_active')
      .not('trial_expires_at', 'is', null)
      .order('trial_expires_at', { ascending: false });

    if (error) {
      console.error('Error fetching trial users:', error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} trial users`);

    return new Response(
      JSON.stringify({ success: true, users: data || [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
