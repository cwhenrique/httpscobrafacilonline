import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Campos sensíveis que serão auditados
const SENSITIVE_FIELDS = [
  'pix_key',
  'pix_key_type',
  'phone',
  'email',
  'full_name',
  'billing_signature_name',
  'payment_link'
];

// Extrai o IP real do cliente dos headers
function getClientIP(req: Request): string | null {
  // Ordem de prioridade para capturar o IP
  const headers = [
    'cf-connecting-ip',     // Cloudflare
    'x-real-ip',            // Nginx proxy
    'x-forwarded-for',      // Standard proxy header
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      // x-forwarded-for pode ter múltiplos IPs, pegamos o primeiro
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com o token do usuário para validar
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validar o token e obter o usuário
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Erro ao validar token:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Usuário não identificado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse do body
    const { updates, userAgent } = await req.json();

    if (!updates || typeof updates !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Dados de atualização inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Capturar IP do cliente
    const clientIP = getClientIP(req);
    console.log('IP do cliente:', clientIP);
    console.log('User Agent:', userAgent);
    console.log('User ID:', userId);
    console.log('Updates recebidos:', Object.keys(updates));

    // Criar cliente admin para operações privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Buscar valores atuais do perfil
    const { data: currentProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Erro ao buscar perfil:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar perfil atual' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!currentProfile) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Identificar campos sensíveis que foram alterados
    const auditLogs: Array<{
      user_id: string;
      field_name: string;
      old_value: string | null;
      new_value: string | null;
      ip_address: string | null;
      user_agent: string | null;
      changed_by: string;
    }> = [];

    for (const field of SENSITIVE_FIELDS) {
      if (field in updates) {
        const oldValue = currentProfile[field];
        const newValue = updates[field];

        // Só registrar se houve alteração real
        if (oldValue !== newValue) {
          auditLogs.push({
            user_id: userId,
            field_name: field,
            old_value: oldValue ? String(oldValue) : null,
            new_value: newValue ? String(newValue) : null,
            ip_address: clientIP,
            user_agent: userAgent || null,
            changed_by: userId,
          });
        }
      }
    }

    console.log('Alterações detectadas:', auditLogs.length);

    // Registrar logs de auditoria (se houver alterações)
    if (auditLogs.length > 0) {
      const { error: auditError } = await supabaseAdmin
        .from('profile_audit_log')
        .insert(auditLogs);

      if (auditError) {
        console.error('Erro ao registrar auditoria:', auditError);
        // Não bloquear a atualização, apenas logar o erro
      } else {
        console.log('Auditoria registrada com sucesso');
      }
    }

    // Aplicar as atualizações no perfil
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar perfil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Perfil atualizado com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Perfil atualizado com sucesso',
        auditedFields: auditLogs.map(log => log.field_name)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
