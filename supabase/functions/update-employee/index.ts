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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autorização não fornecido');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar usuário autenticado
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Erro de autenticação:', userError?.message);
      throw new Error('Usuário não autenticado');
    }

    const ownerId = user.id;
    const { employeeId, permissions } = await req.json();

    console.log('Atualizando funcionário:', { ownerId, employeeId, permissions });

    if (!employeeId) {
      throw new Error('ID do funcionário é obrigatório');
    }

    // Verificar se o funcionário pertence ao dono
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, owner_id')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      throw new Error('Funcionário não encontrado');
    }

    if (employee.owner_id !== ownerId) {
      throw new Error('Você não tem permissão para editar este funcionário');
    }

    // Remover permissões antigas
    const { error: deleteError } = await supabaseAdmin
      .from('employee_permissions')
      .delete()
      .eq('employee_id', employeeId);

    if (deleteError) {
      console.error('Erro ao remover permissões antigas:', deleteError);
    }

    // Adicionar novas permissões
    if (permissions && permissions.length > 0) {
      const permissionRecords = permissions.map((permission: string) => ({
        employee_id: employeeId,
        permission,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('employee_permissions')
        .insert(permissionRecords);

      if (insertError) {
        console.error('Erro ao adicionar permissões:', insertError);
        throw new Error(`Falha ao atualizar permissões: ${insertError.message}`);
      }
    }

    console.log('Permissões atualizadas com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Permissões atualizadas com sucesso',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro desconhecido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
