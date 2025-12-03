import { supabase } from '@/integrations/supabase/client';

export async function updateClientScore(clientId: string): Promise<void> {
  try {
    // Fetch all loans for this client
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('id, status, total_paid, due_date')
      .eq('client_id', clientId);

    if (loansError) {
      console.error('Error fetching loans for score:', loansError);
      return;
    }

    if (!loans || loans.length === 0) {
      // No loans, reset to default score
      await supabase
        .from('clients')
        .update({
          score: 100,
          total_loans: 0,
          total_paid: 0,
          on_time_payments: 0,
          late_payments: 0,
          score_updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);
      return;
    }

    // Calculate metrics
    let onTimePayments = 0;
    let latePayments = 0;
    let totalPaid = 0;

    loans.forEach(loan => {
      totalPaid += loan.total_paid || 0;
      
      if (loan.status === 'paid') {
        onTimePayments++;
      } else if (loan.status === 'overdue') {
        latePayments++;
      }
    });

    // Calculate score
    const totalPayments = onTimePayments + latePayments;
    let score = 100;
    
    if (totalPayments > 0) {
      score = 100 + (onTimePayments * 2) - (latePayments * 10);
      
      // Bonus for loyal customers with good history
      const onTimeRatio = onTimePayments / totalPayments;
      if (loans.length >= 3 && onTimeRatio >= 0.8) {
        score += 10;
      }
    }

    // Clamp score between 0 and 150
    score = Math.max(0, Math.min(150, score));

    // Update client
    await supabase
      .from('clients')
      .update({
        score,
        total_loans: loans.length,
        total_paid: totalPaid,
        on_time_payments: onTimePayments,
        late_payments: latePayments,
        score_updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);
  } catch (error) {
    console.error('Error updating client score:', error);
  }
}
