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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, loan_id, dry_run = true } = await req.json();

    console.log('=== FIX DAILY LOAN BALANCES ===');
    console.log('Params:', { user_id, loan_id, dry_run });

    // Build query to find daily loans with potential issues
    let query = supabase
      .from('loans')
      .select(`
        id,
        user_id,
        client_id,
        principal_amount,
        interest_rate,
        installments,
        total_interest,
        total_paid,
        remaining_balance,
        payment_type,
        status,
        notes,
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
      console.error('Erro ao buscar empréstimos:', loansError);
      throw loansError;
    }

    console.log(`Encontrados ${loans?.length || 0} empréstimos diários para analisar`);

    const results: any[] = [];
    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const loan of loans || []) {
      try {
        const clientName = (loan.clients as any)?.full_name || 'Desconhecido';
        
        // Fetch actual payments for this loan
        const { data: payments, error: paymentsError } = await supabase
          .from('loan_payments')
          .select('id, amount, payment_date')
          .eq('loan_id', loan.id)
          .order('payment_date', { ascending: true });

        if (paymentsError) {
          console.error(`Erro ao buscar pagamentos do empréstimo ${loan.id}:`, paymentsError);
          errors++;
          continue;
        }

        const paymentCount = payments?.length || 0;
        const actualTotalPaid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        // Calculate expected values for daily loans
        // For daily loans: installment_value = principal * (1 + interest_rate/100) / installments
        // But we need to derive installment_value from interest_rate
        const installments = loan.installments || 1;
        const interestRate = loan.interest_rate || 0;
        
        // total_to_receive = principal * (1 + interest_rate/100)
        const totalToReceive = loan.principal_amount * (1 + interestRate / 100);
        const expectedTotalInterest = totalToReceive - loan.principal_amount;
        const installmentValue = totalToReceive / installments;
        
        // Calculate correct remaining_balance
        const correctRemainingBalance = Math.max(0, totalToReceive - actualTotalPaid);
        
        // Count PARTIAL_PAID tags in notes
        const partialPaidMatches = (loan.notes || '').match(/\[PARTIAL_PAID:\d+:\d+(\.\d+)?\]/g) || [];
        const partialPaidCount = partialPaidMatches.length;

        // Check for issues
        const issues: string[] = [];

        // Issue 1: total_interest is wrong
        if (Math.abs((loan.total_interest || 0) - expectedTotalInterest) > 0.01) {
          issues.push(`total_interest incorreto: ${loan.total_interest} vs esperado ${expectedTotalInterest.toFixed(2)}`);
        }

        // Issue 2: remaining_balance doesn't match
        if (Math.abs((loan.remaining_balance || 0) - correctRemainingBalance) > 0.01) {
          issues.push(`remaining_balance incorreto: ${loan.remaining_balance} vs esperado ${correctRemainingBalance.toFixed(2)}`);
        }

        // Issue 3: total_paid doesn't match actual payments
        if (Math.abs((loan.total_paid || 0) - actualTotalPaid) > 0.01) {
          issues.push(`total_paid incorreto: ${loan.total_paid} vs soma pagamentos ${actualTotalPaid.toFixed(2)}`);
        }

        // Issue 4: PARTIAL_PAID tags count doesn't match payment count
        if (partialPaidCount !== paymentCount) {
          issues.push(`tags PARTIAL_PAID (${partialPaidCount}) não correspondem a pagamentos (${paymentCount})`);
        }

        // Issue 5: Status should be 'paid' if remaining_balance is 0
        if (correctRemainingBalance <= 0.01 && loan.status !== 'paid') {
          issues.push(`status deveria ser 'paid' mas é '${loan.status}'`);
        }

        // Issue 6: Status should NOT be 'paid' if remaining_balance > 0
        if (correctRemainingBalance > 0.01 && loan.status === 'paid') {
          issues.push(`status é 'paid' mas remaining_balance = ${correctRemainingBalance.toFixed(2)}`);
        }

        if (issues.length === 0) {
          skipped++;
          continue;
        }

        console.log(`\n--- Empréstimo ${loan.id} (${clientName}) ---`);
        console.log('Problemas encontrados:', issues);

        // Generate corrected PARTIAL_PAID tags based on actual payments
        let correctedNotes = loan.notes || '';
        
        // Remove all existing PARTIAL_PAID tags
        correctedNotes = correctedNotes.replace(/\[PARTIAL_PAID:\d+:\d+(\.\d+)?\]/g, '');
        
        // Add correct PARTIAL_PAID tags based on actual payments
        payments?.forEach((payment, index) => {
          correctedNotes += `[PARTIAL_PAID:${index}:${payment.amount}]`;
        });

        // Determine correct status
        let correctStatus = loan.status;
        if (correctRemainingBalance <= 0.01) {
          correctStatus = 'paid';
        } else {
          // Check if overdue based on due_date
          correctStatus = 'pending'; // Could be overdue, but we'd need to check dates
        }

        const result: any = {
          loan_id: loan.id,
          client: clientName,
          issues,
          before: {
            total_interest: loan.total_interest,
            remaining_balance: loan.remaining_balance,
            total_paid: loan.total_paid,
            partial_paid_tags: partialPaidCount,
            status: loan.status
          },
          after: {
            total_interest: expectedTotalInterest,
            remaining_balance: correctRemainingBalance,
            total_paid: actualTotalPaid,
            partial_paid_tags: paymentCount,
            status: correctStatus
          }
        };

        if (!dry_run) {
          const { error: updateError } = await supabase
            .from('loans')
            .update({
              total_interest: expectedTotalInterest,
              remaining_balance: correctRemainingBalance,
              total_paid: actualTotalPaid,
              status: correctStatus,
              notes: correctedNotes.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', loan.id);

          if (updateError) {
            console.error(`Erro ao atualizar empréstimo ${loan.id}:`, updateError);
            result.error = updateError.message;
            errors++;
          } else {
            result.updated = true;
            fixed++;
          }
        } else {
          result.dry_run = true;
          fixed++;
        }

        results.push(result);

      } catch (loanError) {
        console.error(`Erro processando empréstimo ${loan.id}:`, loanError);
        errors++;
      }
    }

    const summary = {
      total_analyzed: loans?.length || 0,
      fixed: fixed,
      skipped: skipped,
      errors: errors,
      dry_run: dry_run,
      results: results
    };

    console.log('\n=== RESUMO ===');
    console.log(JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
