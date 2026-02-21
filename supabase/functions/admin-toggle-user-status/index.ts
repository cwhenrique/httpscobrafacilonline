import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, newStatus, featureUpdate } = await req.json();
    
    console.log('Toggling user status:', { userId, newStatus, featureUpdate });

    if (!userId) {
      throw new Error('userId é obrigatório');
    }

    // Create admin client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Build update object
    const updateData: Record<string, any> = {};
    
    if (typeof newStatus === 'boolean') {
      updateData.is_active = newStatus;
    }
    
    // Handle feature toggles (relatorio_ativo, check_discount_enabled)
    if (featureUpdate && typeof featureUpdate === 'object') {
      Object.assign(updateData, featureUpdate);
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('Nenhuma alteração fornecida');
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    console.log('User status updated successfully:', { userId, newStatus });

    return new Response(
      JSON.stringify({ success: true, is_active: newStatus }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in admin-toggle-user-status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
