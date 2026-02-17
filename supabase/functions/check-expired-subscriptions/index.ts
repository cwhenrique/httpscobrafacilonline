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

    const now = new Date().toISOString();
    
    const { data: expiredUsers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, subscription_plan, subscription_expires_at, trial_expires_at')
      .eq('is_active', true)
      .or(`and(subscription_expires_at.lt.${now},subscription_plan.neq.lifetime),and(trial_expires_at.lt.${now},subscription_plan.eq.trial)`);

    if (fetchError) {
      console.error('Error fetching expired users:', fetchError);
      throw fetchError;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('No expired subscriptions found');
      return new Response(
        JSON.stringify({ message: 'No expired subscriptions', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredUsers.length} expired subscriptions`);

    let deactivatedCount = 0;

    for (const user of expiredUsers) {
      if (user.subscription_plan === 'lifetime') {
        console.log(`Skipping lifetime user: ${user.email}`);
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ is_active: false })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Error deactivating user ${user.id}:`, updateError);
        continue;
      }

      console.log(`Deactivated user: ${user.email} (plan: ${user.subscription_plan})`);
      deactivatedCount++;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deactivated_count: deactivatedCount,
        total_checked: expiredUsers.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
