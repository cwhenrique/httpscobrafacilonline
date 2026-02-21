import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    // Fetch all users using pagination to bypass 1000 row limit
    const PAGE_SIZE = 1000;
    let allUsers: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, phone, temp_password, trial_expires_at, is_active, subscription_plan, subscription_expires_at, created_at, affiliate_email, relatorio_ativo, check_discount_enabled')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allUsers = [...allUsers, ...data];
        offset += PAGE_SIZE;
        // If we got less than PAGE_SIZE, we've reached the end
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allUsers.length} users (fetched in ${Math.ceil(offset / PAGE_SIZE)} batches)`);

    return new Response(
      JSON.stringify({ success: true, users: allUsers }),
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
