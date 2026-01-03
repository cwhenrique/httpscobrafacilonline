import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const ownerId = user.id;
    const { name, email, permissions } = await req.json();

    console.log('Criando funcionário:', { ownerId, name, email, permissions });

    if (!name || !email) {
      throw new Error('Nome e email são obrigatórios');
    }

    // Verificar se o recurso está habilitado
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('employees_feature_enabled, max_employees')
      .eq('id', ownerId)
      .single();

    if (!profile?.employees_feature_enabled) {
      throw new Error('Recurso de funcionários não está habilitado');
    }

    // Verificar limite de funcionários
    const { count } = await supabaseAdmin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId);

    if ((count || 0) >= (profile.max_employees || 3)) {
      throw new Error(`Limite de ${profile.max_employees || 3} funcionários atingido`);
    }

    // Verificar se email já está vinculado como funcionário
    const { data: existingEmployee } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingEmployee) {
      throw new Error('Este email já está cadastrado como funcionário');
    }

    // Verificar se usuário já existe no auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    let employeeUserId: string;
    let tempPassword: string | null = null;

    if (existingUser) {
      // Usuário já existe, apenas vincular
      employeeUserId = existingUser.id;
      console.log('Usuário existente encontrado:', employeeUserId);

      // Verificar se já é funcionário de outro dono
      const { data: otherOwner } = await supabaseAdmin
        .from('employees')
        .select('owner_id')
        .eq('employee_user_id', employeeUserId)
        .maybeSingle();

      if (otherOwner) {
        throw new Error('Este usuário já é funcionário de outra conta');
      }
    } else {
      // Criar novo usuário
      tempPassword = generateTempPassword();
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (createError) {
        console.error('Erro ao criar usuário:', createError);
        throw new Error(`Falha ao criar conta: ${createError.message}`);
      }

      employeeUserId = newUser.user.id;
      console.log('Novo usuário criado:', employeeUserId);
    }

    // Criar registro de funcionário
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert({
        owner_id: ownerId,
        employee_user_id: employeeUserId,
        name,
        email: email.toLowerCase(),
        is_active: true,
      })
      .select('id')
      .single();

    if (employeeError) {
      console.error('Erro ao criar funcionário:', employeeError);
      throw new Error(`Falha ao criar funcionário: ${employeeError.message}`);
    }

    console.log('Funcionário criado:', employee.id);

    // Adicionar permissões
    if (permissions && permissions.length > 0) {
      const permissionRecords = permissions.map((permission: string) => ({
        employee_id: employee.id,
        permission,
      }));

      const { error: permError } = await supabaseAdmin
        .from('employee_permissions')
        .insert(permissionRecords);

      if (permError) {
        console.error('Erro ao adicionar permissões:', permError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        employeeId: employee.id,
        tempPassword,
        message: tempPassword 
          ? `Funcionário criado! Senha temporária: ${tempPassword}`
          : 'Funcionário vinculado com sucesso',
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
