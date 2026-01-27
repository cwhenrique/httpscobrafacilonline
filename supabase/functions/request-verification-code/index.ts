import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fields that require verification code
const VERIFICATION_REQUIRED_FIELDS = ['pix_key', 'pix_key_type', 'payment_link'];

// Generate secure 6-digit code
function generateCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => (b % 10).toString()).join('');
}

// Hash code with user ID for storage
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

// Get friendly field name for message
function getFieldDisplayName(fieldName: string): string {
  const names: Record<string, string> = {
    'pix_key': 'Chave PIX',
    'pix_key_type': 'Tipo da Chave PIX',
    'payment_link': 'Link de Pagamento',
  };
  return names[fieldName] || fieldName;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { updates, userAgent } = await req.json();

    if (!updates || typeof updates !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'Updates object is required' }),
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
    console.log(`Request verification code for user: ${userId}`);

    // Check if any field requires verification
    const sensitiveFieldsChanged = Object.keys(updates).filter(
      field => VERIFICATION_REQUIRED_FIELDS.includes(field)
    );

    if (sensitiveFieldsChanged.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          requiresVerification: false,
          message: 'No sensitive fields require verification'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting: check recent codes (max 5 per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from('verification_codes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    if ((recentCount || 0) >= 5) {
      console.log(`Rate limit exceeded for user ${userId}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'rate_limit_exceeded',
          message: 'Muitas solicitações. Aguarde 1 hora.'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for phone and WhatsApp info
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('phone, whatsapp_instance_id, whatsapp_connected_phone, full_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate and hash code
    const code = generateCode();
    const hashedCode = await hashCode(code, userId);
    
    const clientIp = getClientIp(req);
    const primaryField = sensitiveFieldsChanged[0];

    // Store verification code
    const { data: verificationData, error: insertError } = await supabaseAdmin
      .from('verification_codes')
      .insert({
        user_id: userId,
        code: hashedCode,
        field_name: primaryField,
        pending_updates: updates,
        ip_address: clientIp,
        user_agent: userAgent || null,
      })
      .select('id, expires_at')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build WhatsApp message
    const fieldDisplayNames = sensitiveFieldsChanged.map(getFieldDisplayName).join(', ');
    const message = `🔐 *Código de Verificação CobraFácil*

Olá ${profile.full_name || ''}!

Seu código para alterar ${fieldDisplayNames} é:

*${code}*

Este código expira em 5 minutos.

⚠️ Se você não solicitou esta alteração, ignore esta mensagem e altere sua senha imediatamente.`;

    // Send via WhatsApp
    let whatsappSent = false;
    let whatsappError = null;

    // Try user's connected WhatsApp first
    if (profile.whatsapp_instance_id && profile.whatsapp_connected_phone) {
      console.log('Sending code via user WhatsApp instance');
      const { data: sendResult, error: sendError } = await supabaseAdmin.functions.invoke('send-whatsapp-to-self', {
        body: { userId, message }
      });

      if (sendError) {
        console.error('send-whatsapp-to-self error:', sendError);
        whatsappError = sendError.message;
      } else if (sendResult?.success) {
        whatsappSent = true;
        console.log('Code sent via user WhatsApp');
      } else {
        whatsappError = sendResult?.error || 'Unknown error';
      }
    }

    // Fallback to global instance if user WhatsApp failed
    if (!whatsappSent && profile.phone) {
      console.log('Falling back to global WhatsApp instance');
      const { data: sendResult, error: sendError } = await supabaseAdmin.functions.invoke('send-whatsapp', {
        body: { phone: profile.phone, message }
      });

      if (sendError) {
        console.error('send-whatsapp error:', sendError);
        whatsappError = sendError.message;
      } else if (sendResult?.success) {
        whatsappSent = true;
        console.log('Code sent via global WhatsApp');
      } else {
        whatsappError = sendResult?.error || 'Unknown error';
      }
    }

    if (!whatsappSent) {
      console.error('Failed to send WhatsApp:', whatsappError);
      // Still return success - user can resend
      return new Response(
        JSON.stringify({ 
          success: true,
          requiresVerification: true,
          verificationId: verificationData.id,
          expiresAt: verificationData.expires_at,
          whatsappSent: false,
          whatsappError: whatsappError || 'WhatsApp não conectado',
          message: 'Código gerado, mas não foi possível enviar via WhatsApp. Tente reconectar.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verification code sent successfully');
    return new Response(
      JSON.stringify({ 
        success: true,
        requiresVerification: true,
        verificationId: verificationData.id,
        expiresAt: verificationData.expires_at,
        whatsappSent: true,
        message: 'Código enviado para seu WhatsApp'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in request-verification-code:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
