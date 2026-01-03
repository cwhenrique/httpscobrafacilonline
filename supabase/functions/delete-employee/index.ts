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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const { employeeId, disableLogin } = await req.json();
    
    console.log('Deleting employee:', { employeeId, disableLogin });

    if (!employeeId) {
      throw new Error('employeeId é obrigatório');
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create authenticated client to verify ownership
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Get employee data and verify ownership
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, employee_user_id, owner_id, name, email')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      throw new Error('Funcionário não encontrado');
    }

    if (employee.owner_id !== user.id) {
      throw new Error('Você não tem permissão para excluir este funcionário');
    }

    const employeeUserId = employee.employee_user_id;

    // 1. Delete employee permissions first (foreign key constraint)
    const { error: permDeleteError } = await supabaseAdmin
      .from('employee_permissions')
      .delete()
      .eq('employee_id', employeeId);

    if (permDeleteError) {
      console.error('Error deleting permissions:', permDeleteError);
      // Continue anyway, might not have permissions
    }

    // 2. Delete employee record
    const { error: empDeleteError } = await supabaseAdmin
      .from('employees')
      .delete()
      .eq('id', employeeId);

    if (empDeleteError) {
      console.error('Error deleting employee:', empDeleteError);
      throw new Error('Erro ao excluir funcionário');
    }

    // 3. If disableLogin is true, disable the user account
    if (disableLogin && employeeUserId) {
      console.log('Disabling user login:', employeeUserId);
      
      // Check if this user is an employee for any other owner
      const { data: otherEmployments } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('employee_user_id', employeeUserId)
        .limit(1);

      // Only disable if not employed elsewhere
      if (!otherEmployments || otherEmployments.length === 0) {
        // Disable the user account using admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          employeeUserId,
          { 
            ban_duration: 'none', // Permanent ban
            user_metadata: { disabled_by_owner: user.id, disabled_at: new Date().toISOString() }
          }
        );

        if (updateError) {
          console.error('Error disabling user:', updateError);
          // Don't throw - employee is already deleted, just log the issue
        } else {
          console.log('User account disabled successfully');
        }

        // Also mark profile as inactive
        await supabaseAdmin
          .from('profiles')
          .update({ is_active: false })
          .eq('id', employeeUserId);
      } else {
        console.log('User has other employments, not disabling account');
      }
    }

    console.log('Employee deleted successfully:', { employeeId, employeeUserId, disableLogin });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: disableLogin 
          ? 'Funcionário removido e acesso desativado' 
          : 'Funcionário removido (acesso mantido)'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in delete-employee:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
