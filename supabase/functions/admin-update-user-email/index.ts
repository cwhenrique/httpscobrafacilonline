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
    const { userId, newEmail, deleteConflictingUser } = await req.json();

    console.log('Recebido:', { userId, newEmail, deleteConflictingUser });

    if (!userId || !newEmail) {
      throw new Error('userId e newEmail são obrigatórios');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Se solicitado, excluir usuário conflitante primeiro
    if (deleteConflictingUser) {
      console.log(`Excluindo usuário conflitante: ${deleteConflictingUser}`);
      
      // Primeiro excluir da tabela profiles
      const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', deleteConflictingUser);
      
      if (profileDeleteError) {
        console.error('Erro ao excluir profile:', profileDeleteError);
      } else {
        console.log('Profile do usuário conflitante excluído');
      }
      
      // Depois excluir do auth
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(deleteConflictingUser);
      if (deleteError) {
        console.error('Erro ao excluir usuário do auth:', deleteError);
        throw new Error(`Falha ao excluir usuário conflitante: ${deleteError.message}`);
      }
      
      console.log('Usuário conflitante excluído com sucesso do auth');
    }

    // Atualizar email no auth.users
    console.log(`Atualizando email do usuário ${userId} para ${newEmail}`);
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true
    });

    if (authError) {
      console.error('Erro ao atualizar auth:', authError);
      throw new Error(`Falha ao atualizar email no auth: ${authError.message}`);
    }

    console.log('Email atualizado no auth.users');

    // Atualizar email na tabela profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', userId);

    if (profileError) {
      console.error('Erro ao atualizar profile:', profileError);
      throw new Error(`Falha ao atualizar email no profile: ${profileError.message}`);
    }

    console.log('Email atualizado na tabela profiles');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email atualizado com sucesso para ${newEmail}`,
        userId,
        newEmail,
        deletedConflictingUser: deleteConflictingUser || null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
