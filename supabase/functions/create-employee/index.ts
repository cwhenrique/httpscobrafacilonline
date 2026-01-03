import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Removido - senha agora é definida pelo dono

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
    const { name, email, phone, password, permissions } = await req.json();

    console.log('Criando funcionário:', { ownerId, name, email, phone: phone ? '***' : null, permissions });

    if (!name || !email) {
      throw new Error('Nome e email são obrigatórios');
    }

    if (!password || password.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres');
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

    if (existingUser) {
      // Usuário já existe - não podemos alterar a senha dele
      throw new Error('Este email já possui uma conta. O funcionário deve usar a senha existente ou criar uma nova conta.');
    } else {
      // Criar novo usuário com a senha definida pelo dono
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (createError) {
        console.error('Erro ao criar usuário:', createError);
        throw new Error(`Falha ao criar conta: ${createError.message}`);
      }

      employeeUserId = newUser.user.id;
      console.log('Novo usuário criado:', employeeUserId);

      // Calcular data de expiração (1 mês)
      const subscriptionExpiresAt = new Date();
      subscriptionExpiresAt.setMonth(subscriptionExpiresAt.getMonth() + 1);

      // Criar/Atualizar perfil do funcionário com assinatura de 1 mês
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: employeeUserId,
          email: email.toLowerCase(),
          full_name: name,
          phone: phone || null,
          subscription_plan: 'employee',
          subscription_expires_at: subscriptionExpiresAt.toISOString(),
          is_active: true,
        });

      if (profileError) {
        console.error('Erro ao criar perfil:', profileError);
        // Não falhar por causa do perfil, o trigger pode ter criado
      }
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
        message: 'Funcionário criado com sucesso!',
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
