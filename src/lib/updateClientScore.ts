import { supabase } from '@/integrations/supabase/client';

export async function updateClientScore(clientId: string): Promise<void> {
  try {
    // Fetch all loans for this client
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('id, status, total_paid, due_date, total_interest')
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

    // Fetch all payments for this client's loans to calculate extra profit
    const loanIds = loans.map(l => l.id);
    const { data: payments } = await supabase
      .from('loan_payments')
      .select('loan_id, interest_paid')
      .in('loan_id', loanIds);

    // Calculate interest received per loan
    const interestByLoan = new Map<string, number>();
    (payments || []).forEach(payment => {
      const current = interestByLoan.get(payment.loan_id) || 0;
      interestByLoan.set(payment.loan_id, current + (payment.interest_paid || 0));
    });

    // Calculate metrics
    let onTimePayments = 0;
    let latePayments = 0;
    let criticalLatePayments = 0;
    let totalPaid = 0;
    let totalExtraProfit = 0;

    const now = new Date();
    
    loans.forEach(loan => {
      totalPaid += loan.total_paid || 0;
      
      // Calculate extra profit (interest paid above expected)
      const expectedInterest = loan.total_interest || 0;
      const actualInterest = interestByLoan.get(loan.id) || 0;
      if (actualInterest > expectedInterest) {
        totalExtraProfit += actualInterest - expectedInterest;
      }
      
      if (loan.status === 'paid') {
        onTimePayments++;
      } else if (loan.status === 'overdue') {
        latePayments++;
        // Verificar se é atraso crítico (>30 dias)
        const dueDate = new Date(loan.due_date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue > 30) {
          criticalLatePayments++;
        }
      }
    });

    // Calculate score - NOVAS PENALIDADES MAIS SEVERAS
    const totalPayments = onTimePayments + latePayments;
    let score = 100;
    
    if (totalPayments > 0) {
      // +3 pontos por pagamento em dia
      // -20 pontos por atraso
      // -10 pontos adicional para atrasos críticos (+30 dias)
      score = 100 + (onTimePayments * 3) - (latePayments * 20) - (criticalLatePayments * 10);
      
      // Bônus de fidelidade: +15 pontos
      const onTimeRatio = onTimePayments / totalPayments;
      if (loans.length >= 3 && onTimeRatio >= 0.8) {
        score += 15;
      }
    }

    // NOVO: Bônus de recuperação baseado em lucro extra (multas/juros pagos)
    // +2 pontos para cada R$50 pagos em multas, máximo +10 pontos
    const recoveryBonus = Math.min(10, Math.floor(totalExtraProfit / 50) * 2);
    score += recoveryBonus;

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
