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

    const { email, password, full_name, phone, subscription_plan = 'trial' } = await req.json();

    if (!email || !password || !full_name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Todos os campos são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiration based on plan
    let expiresAt: Date | null = new Date();
    let planDescription = '';

    switch (subscription_plan) {
      case 'monthly':
        expiresAt.setDate(expiresAt.getDate() + 30);
        planDescription = '30 dias (Mensal)';
        break;
      case 'annual':
        expiresAt.setDate(expiresAt.getDate() + 365);
        planDescription = '1 ano (Anual)';
        break;
      case 'lifetime':
        expiresAt = null; // Lifetime never expires
        planDescription = 'VITALÍCIO';
        break;
      default: // trial
        expiresAt.setHours(expiresAt.getHours() + 24);
        planDescription = '24 horas (Trial)';
    }

    // Create user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (userError) {
      console.error('Error creating user:', userError);
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile with plan-specific fields
    const profileUpdate: Record<string, any> = {
      full_name,
      phone,
      temp_password: password,
      subscription_plan: subscription_plan,
    };

    // Set expiration dates based on plan type
    if (subscription_plan === 'trial') {
      profileUpdate.trial_expires_at = expiresAt?.toISOString();
      profileUpdate.subscription_expires_at = null;
    } else if (subscription_plan === 'lifetime') {
      profileUpdate.trial_expires_at = null;
      profileUpdate.subscription_expires_at = null;
    } else {
      // monthly or annual
      profileUpdate.trial_expires_at = null;
      profileUpdate.subscription_expires_at = expiresAt?.toISOString();
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    console.log('User created:', email, 'plan:', subscription_plan, 'expires:', expiresAt?.toISOString() || 'never');

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userData.user.id,
        subscription_plan,
        expires_at: expiresAt?.toISOString() || null
      }),
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
