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
    const { userId, newPlan } = await req.json();

    if (!userId || !newPlan) {
      throw new Error('userId e newPlan são obrigatórios');
    }

    const validPlans = ['trial', 'monthly', 'quarterly', 'annual', 'lifetime'];
    if (!validPlans.includes(newPlan)) {
      throw new Error('Plano inválido');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Calculate new expiration date based on plan
    let subscriptionExpiresAt: string | null = null;
    let trialExpiresAt: string | null = null;

    const now = new Date();

    if (newPlan === 'trial') {
      trialExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      subscriptionExpiresAt = null;
    } else if (newPlan === 'monthly') {
      subscriptionExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      trialExpiresAt = null;
    } else if (newPlan === 'quarterly') {
      subscriptionExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      trialExpiresAt = null;
    } else if (newPlan === 'annual') {
      subscriptionExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      trialExpiresAt = null;
    } else if (newPlan === 'lifetime') {
      subscriptionExpiresAt = null;
      trialExpiresAt = null;
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan: newPlan,
        subscription_expires_at: subscriptionExpiresAt,
        trial_expires_at: trialExpiresAt,
        is_active: true,
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user plan:', error);
      throw error;
    }

    console.log(`User ${userId} plan updated to ${newPlan}`);

    return new Response(
      JSON.stringify({ success: true }),
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
