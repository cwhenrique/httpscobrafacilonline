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
    const { userEmail, slotsToAdd } = await req.json();

    if (!userEmail || slotsToAdd === undefined) {
      throw new Error('userEmail e slotsToAdd são obrigatórios');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find user by email
    const { data: profile, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, max_employees, employees_feature_enabled')
      .eq('email', userEmail)
      .single();

    if (findError || !profile) {
      throw new Error(`Usuário não encontrado: ${userEmail}`);
    }

    const currentMax = profile.max_employees || 0;
    const newMax = currentMax + slotsToAdd;

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        max_employees: newMax,
        employees_feature_enabled: true
      })
      .eq('id', profile.id);

    if (updateError) {
      throw updateError;
    }

    console.log(`Updated ${userEmail}: max_employees ${currentMax} -> ${newMax}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        email: userEmail,
        previousSlots: currentMax,
        newSlots: newMax
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
