import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DuplicateGroup {
  loan_id: string;
  amount: number;
  notes: string | null;
  payment_ids: string[];
  created_at_timestamps: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, loan_id, dry_run = true } = await req.json().catch(() => ({}));

    console.log(`[FIX-DUPLICATES] Starting analysis... user_id=${user_id}, loan_id=${loan_id}, dry_run=${dry_run}`);

    // Build query to find all payments
    let query = supabase
      .from('loan_payments')
      .select('id, loan_id, amount, notes, created_at, payment_date, user_id')
      .order('created_at', { ascending: true });
    
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (loan_id) {
      query = query.eq('loan_id', loan_id);
    }

    const { data: payments, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('[FIX-DUPLICATES] Error fetching payments:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!payments || payments.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No payments found',
        duplicates_found: 0,
        duplicates_deleted: 0,
        loans_affected: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[FIX-DUPLICATES] Found ${payments.length} total payments`);

    // Group payments by loan_id, amount, and notes to find duplicates
    // Payments are considered duplicates if they have the same loan_id, amount, notes,
    // and were created within 5 seconds of each other
    const duplicateGroups: DuplicateGroup[] = [];
    const processedIds = new Set<string>();

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      if (processedIds.has(payment.id)) continue;

      const duplicates = [payment];
      const paymentTime = new Date(payment.created_at).getTime();

      for (let j = i + 1; j < payments.length; j++) {
        const other = payments[j];
        if (processedIds.has(other.id)) continue;

        const otherTime = new Date(other.created_at).getTime();
        const timeDiff = Math.abs(paymentTime - otherTime);

        // Same loan, same amount, same notes, within 5 seconds = duplicate
        if (
          payment.loan_id === other.loan_id &&
          Math.abs(payment.amount - other.amount) < 0.01 &&
          payment.notes === other.notes &&
          timeDiff < 5000
        ) {
          duplicates.push(other);
          processedIds.add(other.id);
        }
      }

      processedIds.add(payment.id);

      if (duplicates.length > 1) {
        duplicateGroups.push({
          loan_id: payment.loan_id,
          amount: payment.amount,
          notes: payment.notes,
          payment_ids: duplicates.map(d => d.id),
          created_at_timestamps: duplicates.map(d => d.created_at),
        });
      }
    }

    console.log(`[FIX-DUPLICATES] Found ${duplicateGroups.length} duplicate groups`);

    const affectedLoanIds = new Set(duplicateGroups.map(g => g.loan_id));
    const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.payment_ids.length - 1, 0);

    if (dry_run) {
      return new Response(JSON.stringify({
        message: 'Dry run complete - no changes made',
        dry_run: true,
        duplicates_found: totalDuplicates,
        duplicate_groups: duplicateGroups.length,
        loans_affected: affectedLoanIds.size,
        details: duplicateGroups.map(g => ({
          loan_id: g.loan_id,
          amount: g.amount,
          notes: g.notes?.substring(0, 50),
          duplicate_count: g.payment_ids.length,
          payment_ids: g.payment_ids,
          timestamps: g.created_at_timestamps,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete duplicates (keep the first one in each group)
    let deletedCount = 0;
    const errors: string[] = [];

    for (const group of duplicateGroups) {
      // Keep the first payment, delete the rest
      const idsToDelete = group.payment_ids.slice(1);
      
      console.log(`[FIX-DUPLICATES] Deleting ${idsToDelete.length} duplicates for loan ${group.loan_id}`);

      const { error: deleteError } = await supabase
        .from('loan_payments')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error(`[FIX-DUPLICATES] Error deleting duplicates:`, deleteError);
        errors.push(`Loan ${group.loan_id}: ${deleteError.message}`);
      } else {
        deletedCount += idsToDelete.length;
      }
    }

    // Recalculate total_paid and remaining_balance for affected loans
    const loansToRecalculate = Array.from(affectedLoanIds);
    const recalculatedLoans: string[] = [];

    for (const loanId of loansToRecalculate) {
      // Get sum of remaining payments
      const { data: remainingPayments, error: sumError } = await supabase
        .from('loan_payments')
        .select('amount')
        .eq('loan_id', loanId);

      if (sumError) {
        console.error(`[FIX-DUPLICATES] Error fetching payments for recalc:`, sumError);
        errors.push(`Recalc ${loanId}: ${sumError.message}`);
        continue;
      }

      const newTotalPaid = remainingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      // Get loan details
      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select('principal_amount, total_interest, payment_type, installments, due_date')
        .eq('id', loanId)
        .single();

      if (loanError || !loan) {
        console.error(`[FIX-DUPLICATES] Error fetching loan:`, loanError);
        errors.push(`Loan fetch ${loanId}: ${loanError?.message}`);
        continue;
      }

      // Calculate expected total
      let expectedTotal: number;
      if (loan.payment_type === 'daily') {
        expectedTotal = (loan.total_interest || 0) * (loan.installments || 1);
      } else {
        expectedTotal = loan.principal_amount + (loan.total_interest || 0);
      }

      const newRemainingBalance = Math.max(0, expectedTotal - newTotalPaid);
      const today = new Date().toISOString().split('T')[0];
      const newStatus = newRemainingBalance <= 0.01 
        ? 'paid' 
        : (loan.due_date < today ? 'overdue' : 'pending');

      // Update loan
      const { error: updateError } = await supabase
        .from('loans')
        .update({
          total_paid: newTotalPaid,
          remaining_balance: newRemainingBalance,
          status: newStatus,
        })
        .eq('id', loanId);

      if (updateError) {
        console.error(`[FIX-DUPLICATES] Error updating loan:`, updateError);
        errors.push(`Update ${loanId}: ${updateError.message}`);
      } else {
        recalculatedLoans.push(loanId);
        console.log(`[FIX-DUPLICATES] Recalculated loan ${loanId}: total_paid=${newTotalPaid}, remaining=${newRemainingBalance}, status=${newStatus}`);
      }
    }

    return new Response(JSON.stringify({
      message: 'Duplicate cleanup complete',
      dry_run: false,
      duplicates_found: totalDuplicates,
      duplicates_deleted: deletedCount,
      loans_affected: affectedLoanIds.size,
      loans_recalculated: recalculatedLoans.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FIX-DUPLICATES] Unexpected error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
