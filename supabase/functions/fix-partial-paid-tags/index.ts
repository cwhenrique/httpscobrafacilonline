import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { user_id, loan_id, dry_run = true } = body;

    console.log(`[FIX_PARTIAL_PAID] Starting - user_id: ${user_id}, loan_id: ${loan_id}, dry_run: ${dry_run}`);

    // Buscar empréstimos diários com possíveis inconsistências
    let query = supabase
      .from('loans')
      .select(`
        id,
        user_id,
        client_id,
        payment_type,
        installments,
        principal_amount,
        interest_rate,
        interest_mode,
        total_interest,
        remaining_balance,
        total_paid,
        status,
        notes,
        installment_dates,
        clients!inner(full_name)
      `)
      .eq('payment_type', 'daily');

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (loan_id) {
      query = query.eq('id', loan_id);
    }

    const { data: loans, error: loansError } = await query;

    if (loansError) {
      console.error('[FIX_PARTIAL_PAID] Error fetching loans:', loansError);
      return new Response(JSON.stringify({ error: loansError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results: any[] = [];
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const loan of loans || []) {
      const clientName = (loan as any).clients?.full_name || 'Unknown';
      
      // Contar tags PARTIAL_PAID no notes
      const notes = loan.notes || '';
      const partialPaidMatches = notes.match(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g) || [];
      const partialPaidCount = partialPaidMatches.length;

      // Buscar pagamentos reais
      const { data: payments, error: paymentsError } = await supabase
        .from('loan_payments')
        .select('id, amount, created_at, notes')
        .eq('loan_id', loan.id)
        .order('created_at', { ascending: true });

      if (paymentsError) {
        console.error(`[FIX_PARTIAL_PAID] Error fetching payments for loan ${loan.id}:`, paymentsError);
        errorCount++;
        results.push({
          loan_id: loan.id,
          client_name: clientName,
          status: 'error',
          error: paymentsError.message
        });
        continue;
      }

      const paymentCount = payments?.length || 0;
      const sumPayments = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // Se não há inconsistência, pular
      if (partialPaidCount <= paymentCount) {
        skippedCount++;
        continue;
      }

      // Calcular valores esperados
      const numInstallments = loan.installments || 1;
      const totalExpected = loan.principal_amount + (loan.total_interest || 0);
      const installmentValue = totalExpected / numInstallments;

      // Reconstruir tags PARTIAL_PAID baseado nos pagamentos reais
      let newNotes = notes;
      
      // Remover todas as tags PARTIAL_PAID existentes
      newNotes = newNotes.replace(/\[PARTIAL_PAID:\d+:[0-9.]+\]/g, '');
      
      // Reconstruir baseado nos pagamentos reais
      let accumulatedPayment = 0;
      let currentInstallment = 0;
      
      for (const payment of payments || []) {
        accumulatedPayment += payment.amount;
        
        // Quantas parcelas foram completamente pagas
        const fullInstallmentsPaid = Math.floor(accumulatedPayment / installmentValue);
        
        // Se pagou mais parcelas do que já registramos
        while (currentInstallment < fullInstallmentsPaid && currentInstallment < numInstallments) {
          newNotes += `[PARTIAL_PAID:${currentInstallment}:${installmentValue.toFixed(2)}]`;
          currentInstallment++;
        }
        
        // Valor parcial da próxima parcela
        const partialValue = accumulatedPayment - (currentInstallment * installmentValue);
        if (partialValue > 0.01 && currentInstallment < numInstallments) {
          // Remover tag parcial anterior se existir
          newNotes = newNotes.replace(new RegExp(`\\[PARTIAL_PAID:${currentInstallment}:[0-9.]+\\]`, 'g'), '');
          newNotes += `[PARTIAL_PAID:${currentInstallment}:${partialValue.toFixed(2)}]`;
        }
      }

      // Limpar notas
      newNotes = newNotes.replace(/\n{3,}/g, '\n\n').trim();

      // Calcular remaining_balance correto
      const correctRemainingBalance = Math.max(0, totalExpected - sumPayments);
      const correctStatus = correctRemainingBalance <= 0.01 ? 'paid' : loan.status;

      const result: any = {
        loan_id: loan.id,
        client_name: clientName,
        installments: numInstallments,
        payments_count: paymentCount,
        old_partial_paid_count: partialPaidCount,
        new_partial_paid_count: (newNotes.match(/\[PARTIAL_PAID:/g) || []).length,
        old_remaining_balance: loan.remaining_balance,
        new_remaining_balance: correctRemainingBalance,
        old_status: loan.status,
        new_status: correctStatus,
        total_paid: sumPayments,
        changes: []
      };

      if (newNotes !== notes) {
        result.changes.push('notes_updated');
      }
      if (Math.abs(correctRemainingBalance - loan.remaining_balance) > 0.01) {
        result.changes.push('remaining_balance_updated');
      }
      if (correctStatus !== loan.status) {
        result.changes.push('status_updated');
      }

      if (!dry_run && result.changes.length > 0) {
        const { error: updateError } = await supabase
          .from('loans')
          .update({
            notes: newNotes,
            remaining_balance: correctRemainingBalance,
            total_paid: sumPayments,
            status: correctStatus
          })
          .eq('id', loan.id);

        if (updateError) {
          console.error(`[FIX_PARTIAL_PAID] Error updating loan ${loan.id}:`, updateError);
          result.status = 'error';
          result.error = updateError.message;
          errorCount++;
        } else {
          result.status = 'fixed';
          fixedCount++;
          console.log(`[FIX_PARTIAL_PAID] Fixed loan ${loan.id} (${clientName}): ${result.changes.join(', ')}`);
        }
      } else if (result.changes.length > 0) {
        result.status = 'would_fix';
        fixedCount++;
      } else {
        result.status = 'no_changes';
        skippedCount++;
      }

      results.push(result);
    }

    const summary = {
      total_analyzed: loans?.length || 0,
      fixed: fixedCount,
      skipped: skippedCount,
      errors: errorCount,
      dry_run: dry_run,
      message: dry_run 
        ? `Modo simulação: ${fixedCount} empréstimos seriam corrigidos. Execute com dry_run=false para aplicar.`
        : `${fixedCount} empréstimos corrigidos com sucesso.`
    };

    console.log('[FIX_PARTIAL_PAID] Summary:', summary);

    return new Response(JSON.stringify({ summary, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[FIX_PARTIAL_PAID] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
