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

    console.log(`[fix-historical-loans] Starting fix for user_id: ${user_id}, loan_id: ${loan_id}, dry_run: ${dry_run}`);

    // Build query for loans with PARTIAL_PAID tags
    let query = supabase
      .from('loans')
      .select('id, user_id, notes, payment_type, total_interest, installments, principal_amount, start_date, installment_dates, remaining_balance, total_paid')
      .like('notes', '%[PARTIAL_PAID:%');

    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (loan_id) {
      query = query.eq('id', loan_id);
    }

    const { data: loans, error: loansError } = await query;

    if (loansError) {
      console.error('[fix-historical-loans] Error fetching loans:', loansError);
      throw loansError;
    }

    console.log(`[fix-historical-loans] Found ${loans?.length || 0} loans with PARTIAL_PAID tags`);

    const results: any[] = [];
    let fixedCount = 0;
    let skippedCount = 0;

    for (const loan of loans || []) {
      // Extract PARTIAL_PAID tags from notes
      const partialPaidMatches = [...(loan.notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g)];
      const tagCount = partialPaidMatches.length;

      if (tagCount === 0) {
        skippedCount++;
        continue;
      }

      // Count actual payments in loan_payments (excluding amortizations and interest-only)
      const { count: paymentCount, error: countError } = await supabase
        .from('loan_payments')
        .select('*', { count: 'exact', head: true })
        .eq('loan_id', loan.id)
        .not('notes', 'like', '%[AMORTIZATION]%')
        .not('notes', 'like', '%[INTEREST_ONLY_PAYMENT]%');

      if (countError) {
        console.error(`[fix-historical-loans] Error counting payments for loan ${loan.id}:`, countError);
        results.push({ loan_id: loan.id, error: countError.message });
        continue;
      }

      const actualPaymentCount = paymentCount || 0;

      // Check if there's an inconsistency
      if (actualPaymentCount >= tagCount) {
        skippedCount++;
        results.push({
          loan_id: loan.id,
          status: 'consistent',
          tags: tagCount,
          payments: actualPaymentCount
        });
        continue;
      }

      console.log(`[fix-historical-loans] Loan ${loan.id}: ${tagCount} tags, ${actualPaymentCount} payments - INCONSISTENT`);

      // Get existing payment indices to avoid duplicates
      const { data: existingPayments } = await supabase
        .from('loan_payments')
        .select('notes')
        .eq('loan_id', loan.id);

      const existingIndices = new Set<number>();
      for (const payment of existingPayments || []) {
        const match = payment.notes?.match(/Parcela (\d+)/);
        if (match) {
          existingIndices.add(parseInt(match[1]) - 1); // Convert to 0-indexed
        }
      }

      // Prepare payments to insert based on PARTIAL_PAID tags
      const paymentsToInsert: any[] = [];
      const installmentDates = loan.installment_dates as string[] || [];

      for (const match of partialPaidMatches) {
        const idx = parseInt(match[1]);
        const amount = parseFloat(match[2]);

        // Skip if payment already exists for this index
        if (existingIndices.has(idx)) {
          continue;
        }

        // Determine payment date
        let paymentDate = installmentDates[idx] || loan.start_date;
        
        // Calculate principal and interest per installment
        let principalPaid = 0;
        let interestPaid = 0;

        if (loan.payment_type === 'daily') {
          const dailyAmount = loan.total_interest || 0;
          const principalPerDay = loan.principal_amount / (loan.installments || 1);
          principalPaid = principalPerDay;
          interestPaid = dailyAmount - principalPerDay;
        } else {
          const totalAmount = loan.principal_amount + (loan.total_interest || 0);
          const installmentValue = totalAmount / (loan.installments || 1);
          principalPaid = loan.principal_amount / (loan.installments || 1);
          interestPaid = installmentValue - principalPaid;
        }

        paymentsToInsert.push({
          loan_id: loan.id,
          user_id: loan.user_id,
          amount: amount,
          principal_paid: principalPaid,
          interest_paid: interestPaid,
          payment_date: paymentDate,
          notes: `[CONTRATO_ANTIGO] Parcela ${idx + 1} - Recuperado automaticamente`,
        });
      }

      if (paymentsToInsert.length === 0) {
        skippedCount++;
        results.push({
          loan_id: loan.id,
          status: 'no_missing_payments',
          tags: tagCount,
          payments: actualPaymentCount
        });
        continue;
      }

      if (dry_run) {
        results.push({
          loan_id: loan.id,
          status: 'would_fix',
          tags: tagCount,
          payments: actualPaymentCount,
          missing: paymentsToInsert.length,
          payments_to_insert: paymentsToInsert
        });
        fixedCount++;
      } else {
        // Actually insert the missing payments
        const { error: insertError } = await supabase
          .from('loan_payments')
          .insert(paymentsToInsert);

        if (insertError) {
          console.error(`[fix-historical-loans] Error inserting payments for loan ${loan.id}:`, insertError);
          results.push({
            loan_id: loan.id,
            status: 'error',
            error: insertError.message
          });
        } else {
          // Recalculate totals
          const totalInserted = paymentsToInsert.reduce((sum, p) => sum + p.amount, 0);
          const newTotalPaid = (loan.total_paid || 0) + totalInserted;
          const newRemainingBalance = Math.max(0, (loan.remaining_balance || 0) - totalInserted);

          await supabase
            .from('loans')
            .update({
              total_paid: newTotalPaid,
              remaining_balance: newRemainingBalance,
              status: newRemainingBalance <= 0 ? 'paid' : 'pending'
            })
            .eq('id', loan.id);

          results.push({
            loan_id: loan.id,
            status: 'fixed',
            tags: tagCount,
            payments_before: actualPaymentCount,
            payments_inserted: paymentsToInsert.length,
            new_total_paid: newTotalPaid,
            new_remaining_balance: newRemainingBalance
          });
          fixedCount++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      total_loans_analyzed: loans?.length || 0,
      fixed_count: fixedCount,
      skipped_count: skippedCount,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fix-historical-loans] Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
