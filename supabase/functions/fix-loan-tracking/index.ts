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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, loan_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fix-loan-tracking] Iniciando correção para user_id: ${user_id}, loan_id: ${loan_id || 'todos'}`);

    // Buscar empréstimos do usuário
    let loansQuery = supabase
      .from('loans')
      .select('*')
      .eq('user_id', user_id);

    if (loan_id) {
      loansQuery = loansQuery.eq('id', loan_id);
    }

    const { data: loans, error: loansError } = await loansQuery;

    if (loansError) {
      console.error('[fix-loan-tracking] Erro ao buscar empréstimos:', loansError);
      throw loansError;
    }

    if (!loans || loans.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum empréstimo encontrado', fixed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { loan_id: string; status: string; details: string }[] = [];

    for (const loan of loans) {
      // Verificar se já tem tags [PARTIAL_PAID]
      const hasPartialPaidTags = (loan.notes || '').includes('[PARTIAL_PAID:');
      
      if (hasPartialPaidTags) {
        results.push({
          loan_id: loan.id,
          status: 'skipped',
          details: 'Já possui tags de tracking'
        });
        continue;
      }

      // Verificar se tem pagamentos
      if (!loan.total_paid || loan.total_paid <= 0) {
        results.push({
          loan_id: loan.id,
          status: 'skipped',
          details: 'Sem pagamentos registrados'
        });
        continue;
      }

      // Buscar pagamentos deste empréstimo
      const { data: payments, error: paymentsError } = await supabase
        .from('loan_payments')
        .select('*')
        .eq('loan_id', loan.id)
        .order('payment_date', { ascending: true });

      if (paymentsError) {
        console.error(`[fix-loan-tracking] Erro ao buscar pagamentos do empréstimo ${loan.id}:`, paymentsError);
        results.push({
          loan_id: loan.id,
          status: 'error',
          details: `Erro ao buscar pagamentos: ${paymentsError.message}`
        });
        continue;
      }

      // Calcular valor por parcela
      const installments = loan.installments || 1;
      const totalAmount = loan.principal_amount + (loan.total_interest || 0);
      const installmentValue = totalAmount / installments;

      // Calcular tags baseado no total_paid
      const newTags: string[] = [];
      let remainingPaid = loan.total_paid;

      for (let i = 0; i < installments && remainingPaid > 0; i++) {
        const paidForThisInstallment = Math.min(remainingPaid, installmentValue);
        newTags.push(`[PARTIAL_PAID:${i}:${paidForThisInstallment.toFixed(2)}]`);
        remainingPaid -= paidForThisInstallment;
      }

      if (newTags.length === 0) {
        results.push({
          loan_id: loan.id,
          status: 'skipped',
          details: 'Nenhuma tag a adicionar'
        });
        continue;
      }

      // Atualizar notes do empréstimo
      const currentNotes = loan.notes || '';
      const updatedNotes = currentNotes + (currentNotes ? '\n' : '') + newTags.join('\n');

      const { error: updateError } = await supabase
        .from('loans')
        .update({ notes: updatedNotes })
        .eq('id', loan.id);

      if (updateError) {
        console.error(`[fix-loan-tracking] Erro ao atualizar empréstimo ${loan.id}:`, updateError);
        results.push({
          loan_id: loan.id,
          status: 'error',
          details: `Erro ao atualizar: ${updateError.message}`
        });
        continue;
      }

      console.log(`[fix-loan-tracking] Empréstimo ${loan.id} corrigido com ${newTags.length} tags`);
      results.push({
        loan_id: loan.id,
        status: 'fixed',
        details: `Adicionadas ${newTags.length} tags de tracking`
      });
    }

    const fixed = results.filter(r => r.status === 'fixed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`[fix-loan-tracking] Concluído: ${fixed} corrigidos, ${skipped} ignorados, ${errors} erros`);

    return new Response(
      JSON.stringify({
        message: `Correção concluída: ${fixed} empréstimos corrigidos`,
        fixed,
        skipped,
        errors,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[fix-loan-tracking] Erro:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
