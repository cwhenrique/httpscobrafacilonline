import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash code with user ID for comparison
async function hashCode(code: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code + userId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get client IP from headers
function getClientIp(req: Request): string | null {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { verificationId, code, userAgent } = await req.json();

    if (!verificationId || !code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Verification ID and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Código deve ter 6 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // User client for auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabaseUser.auth.getUser(token);
    
    if (claimsError || !claims?.user) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claims.user.id;
    console.log(`Verify code for user: ${userId}, verificationId: ${verificationId}`);

    // Service client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get verification code record
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('id', verificationId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !verification) {
      console.error('Verification not found:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Código de verificação não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    if (verification.verified_at) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este código já foi utilizado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Código expirado. Solicite um novo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempts
    if (verification.attempts >= 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Máximo de tentativas excedido. Solicite um novo código.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment attempts
    await supabaseAdmin
      .from('verification_codes')
      .update({ attempts: verification.attempts + 1 })
      .eq('id', verificationId);

    // Verify code
    const hashedInput = await hashCode(code, userId);
    if (hashedInput !== verification.code) {
      const remainingAttempts = 2 - verification.attempts;
      console.log(`Invalid code. Remaining attempts: ${remainingAttempts}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: remainingAttempts > 0 
            ? `Código incorreto. ${remainingAttempts} tentativa(s) restante(s).`
            : 'Código incorreto. Máximo de tentativas excedido.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Code is valid! Get pending updates
    const pendingUpdates = verification.pending_updates as Record<string, unknown>;
    
    // Get current profile for audit log
    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar perfil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientIp = getClientIp(req);

    // Log each changed field to audit
    const auditEntries = [];
    for (const [fieldName, newValue] of Object.entries(pendingUpdates)) {
      const oldValue = currentProfile[fieldName];
      if (oldValue !== newValue) {
        auditEntries.push({
          user_id: userId,
          field_name: fieldName,
          old_value: oldValue?.toString() || null,
          new_value: newValue?.toString() || null,
          ip_address: clientIp,
          user_agent: userAgent || null,
          changed_by: userId,
          verification_id: verificationId,
        });
      }
    }

    // Insert audit entries
    if (auditEntries.length > 0) {
      const { error: auditError } = await supabaseAdmin
        .from('profile_audit_log')
        .insert(auditEntries);

      if (auditError) {
        console.error('Audit log error:', auditError);
        // Continue anyway - don't block the update
      }
    }

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        ...pendingUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar perfil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark verification as used
    await supabaseAdmin
      .from('verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verificationId);

    console.log('Profile updated successfully with verification');
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Perfil atualizado com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in verify-and-update-profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
