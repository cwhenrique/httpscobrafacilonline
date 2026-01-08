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

    const { user_id, loan_id, dry_run = true } = await req.json();

    console.log('=== FIX RENEGOTIATED LOANS ===');
    console.log('User ID:', user_id);
    console.log('Loan ID:', loan_id || 'all');
    console.log('Dry run:', dry_run);

    // Find renegotiated loans (contain [RENEGOTIATED] or "Valor prometido" in notes)
    let query = supabase
      .from('loans')
      .select('id, user_id, notes, principal_amount, total_interest, total_paid, remaining_balance, status, created_at, payment_type, installments, due_date')
      .or('notes.ilike.%[RENEGOTIATED]%,notes.ilike.%Valor prometido%,notes.ilike.%[RENEGOTIATION_DATE:%');

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (loan_id) {
      query = query.eq('id', loan_id);
    }

    const { data: loans, error: loansError } = await query;

    if (loansError) {
      console.error('Error fetching loans:', loansError);
      throw loansError;
    }

    console.log(`Found ${loans?.length || 0} renegotiated loans to analyze`);

    const results: Array<{
      loan_id: string;
      action: string;
      payments_marked: number;
      new_remaining_balance?: number;
      new_total_paid?: number;
      details?: string;
    }> = [];

    let fixedCount = 0;
    let skippedCount = 0;

    for (const loan of loans || []) {
      console.log(`\n--- Processing loan ${loan.id} ---`);
      
      // Get all payments for this loan
      const { data: payments, error: paymentsError } = await supabase
        .from('loan_payments')
        .select('id, amount, notes, created_at, payment_date')
        .eq('loan_id', loan.id)
        .order('created_at', { ascending: true });

      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
        results.push({
          loan_id: loan.id,
          action: 'error',
          payments_marked: 0,
          details: `Error: ${paymentsError.message}`
        });
        continue;
      }

      if (!payments || payments.length === 0) {
        console.log('No payments found, skipping');
        skippedCount++;
        results.push({
          loan_id: loan.id,
          action: 'skipped',
          payments_marked: 0,
          details: 'No payments to analyze'
        });
        continue;
      }

      // Extract renegotiation date from notes if available
      let renegotiationDateStr: string | null = null;
      
      // Try to extract from [RENEGOTIATION_DATE:...] tag (primary format)
      const renegotiationDateMatch = loan.notes?.match(/\[RENEGOTIATION_DATE:([^\]]+)\]/);
      if (renegotiationDateMatch) {
        renegotiationDateStr = renegotiationDateMatch[1];
      }
      
      // Fallback: Try to extract from [RENEGOTIATED_FROM:...] tag
      if (!renegotiationDateStr) {
        const renegotiatedFromMatch = loan.notes?.match(/\[RENEGOTIATED_FROM:([^\]]+)\]/);
        if (renegotiatedFromMatch) {
          renegotiationDateStr = renegotiatedFromMatch[1];
        }
      }
      
      // Note: [HISTORICAL_CONTRACT] loans are NOT processed by this function
      // They should only be processed if they also have [RENEGOTIATION_DATE:] tag

      // If no explicit date, use loan created_at as reference
      const renegotiationDate = renegotiationDateStr 
        ? new Date(renegotiationDateStr) 
        : new Date(loan.created_at);

      console.log('Renegotiation reference date:', renegotiationDate.toISOString());

      // Find payments that might be pre-renegotiation
      // These are payments that were made BEFORE the current contract configuration
      // and are NOT already marked as PRE_RENEGOTIATION
      const paymentsToMark = payments.filter(p => {
        // Skip already marked
        if (p.notes?.includes('[PRE_RENEGOTIATION]')) {
          return false;
        }
        
        // Check if payment was made before the renegotiation date
        const paymentDate = new Date(p.payment_date || p.created_at);
        return paymentDate < renegotiationDate;
      });

      console.log(`Found ${paymentsToMark.length} payments to mark as PRE_RENEGOTIATION`);

      if (paymentsToMark.length === 0) {
        // Check if there are already marked payments but saldo still wrong
        const alreadyMarkedPayments = payments.filter(p => p.notes?.includes('[PRE_RENEGOTIATION]'));
        const postRenegotiationPayments = payments.filter(p => !p.notes?.includes('[PRE_RENEGOTIATION]'));
        
        // Calculate what the balance SHOULD be
        const postRenegotiationTotal = postRenegotiationPayments.reduce((sum, p) => {
          // Don't count interest-only payments toward balance reduction
          if (p.notes?.includes('[INTEREST_ONLY_PAYMENT]')) {
            return sum;
          }
          return sum + p.amount;
        }, 0);

        // For daily loans: parcela × numero_parcelas
        // For others: principal + total_interest
        let expectedTotal: number;
        if (loan.payment_type === 'daily') {
          expectedTotal = (loan.total_interest || 0) * (loan.installments || 1);
        } else {
          expectedTotal = loan.principal_amount + (loan.total_interest || 0);
        }

        const correctRemaining = Math.max(0, expectedTotal - postRenegotiationTotal);
        const correctTotalPaid = postRenegotiationTotal;

        // Check if current values are wrong
        const remainingDiff = Math.abs((loan.remaining_balance || 0) - correctRemaining);
        const paidDiff = Math.abs((loan.total_paid || 0) - correctTotalPaid);

        if (remainingDiff > 0.01 || paidDiff > 0.01) {
          console.log('Saldo incorreto detectado!');
          console.log(`Current remaining: ${loan.remaining_balance}, Should be: ${correctRemaining}`);
          console.log(`Current total_paid: ${loan.total_paid}, Should be: ${correctTotalPaid}`);

          if (!dry_run) {
            // Fix the balance
            const { error: updateError } = await supabase
              .from('loans')
              .update({
                remaining_balance: correctRemaining,
                total_paid: correctTotalPaid,
                status: correctRemaining <= 0.01 ? 'paid' : (new Date(loan.due_date) < new Date() ? 'overdue' : 'pending')
              })
              .eq('id', loan.id);

            if (updateError) {
              console.error('Error updating loan:', updateError);
              results.push({
                loan_id: loan.id,
                action: 'error',
                payments_marked: 0,
                details: `Error updating balance: ${updateError.message}`
              });
              continue;
            }

            fixedCount++;
            results.push({
              loan_id: loan.id,
              action: 'balance_fixed',
              payments_marked: 0,
              new_remaining_balance: correctRemaining,
              new_total_paid: correctTotalPaid,
              details: `Fixed balance without marking payments (already marked: ${alreadyMarkedPayments.length})`
            });
          } else {
            results.push({
              loan_id: loan.id,
              action: 'would_fix_balance',
              payments_marked: 0,
              new_remaining_balance: correctRemaining,
              new_total_paid: correctTotalPaid,
              details: `[DRY RUN] Would fix balance from ${loan.remaining_balance} to ${correctRemaining}`
            });
          }
        } else {
          skippedCount++;
          results.push({
            loan_id: loan.id,
            action: 'skipped',
            payments_marked: 0,
            details: 'Balances already correct'
          });
        }
        continue;
      }

      if (!dry_run) {
        // Mark payments as PRE_RENEGOTIATION
        for (const payment of paymentsToMark) {
          const { error: updateError } = await supabase
            .from('loan_payments')
            .update({
              notes: (payment.notes || '') + ' [PRE_RENEGOTIATION]'
            })
            .eq('id', payment.id);

          if (updateError) {
            console.error('Error marking payment:', updateError);
          }
        }

        // Now recalculate the balance
        const { data: updatedPayments } = await supabase
          .from('loan_payments')
          .select('id, amount, notes')
          .eq('loan_id', loan.id);

        // Sum only non-PRE_RENEGOTIATION and non-INTEREST_ONLY payments
        const validTotal = (updatedPayments || [])
          .filter(p => !p.notes?.includes('[PRE_RENEGOTIATION]') && !p.notes?.includes('[INTEREST_ONLY_PAYMENT]'))
          .reduce((sum, p) => sum + p.amount, 0);

        let expectedTotal: number;
        if (loan.payment_type === 'daily') {
          expectedTotal = (loan.total_interest || 0) * (loan.installments || 1);
        } else {
          expectedTotal = loan.principal_amount + (loan.total_interest || 0);
        }

        const newRemaining = Math.max(0, expectedTotal - validTotal);
        const newTotalPaid = (updatedPayments || [])
          .filter(p => !p.notes?.includes('[PRE_RENEGOTIATION]'))
          .reduce((sum, p) => sum + p.amount, 0);

        const { error: loanUpdateError } = await supabase
          .from('loans')
          .update({
            remaining_balance: newRemaining,
            total_paid: newTotalPaid,
            status: newRemaining <= 0.01 ? 'paid' : 'pending'
          })
          .eq('id', loan.id);

        if (loanUpdateError) {
          console.error('Error updating loan balance:', loanUpdateError);
        }

        fixedCount++;
        results.push({
          loan_id: loan.id,
          action: 'fixed',
          payments_marked: paymentsToMark.length,
          new_remaining_balance: newRemaining,
          new_total_paid: newTotalPaid,
          details: `Marked ${paymentsToMark.length} payments and recalculated balance`
        });
      } else {
        results.push({
          loan_id: loan.id,
          action: 'would_fix',
          payments_marked: paymentsToMark.length,
          details: `[DRY RUN] Would mark ${paymentsToMark.length} payments as PRE_RENEGOTIATION`
        });
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total analyzed: ${loans?.length || 0}`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Skipped: ${skippedCount}`);

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      summary: {
        total_analyzed: loans?.length || 0,
        fixed: fixedCount,
        skipped: skippedCount,
      },
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in fix-renegotiated-loans:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
