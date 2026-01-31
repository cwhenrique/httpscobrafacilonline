import { useMemo } from 'react';
import { Loan, LoanPayment } from '@/types/database';

export interface ClientScoreData {
  score: number;
  totalLoans: number;
  totalPaid: number;
  onTimePayments: number;
  latePayments: number;
  scoreLabel: string;
  scoreColor: string;
  recoveryBonus: number;
  extraProfit: number;
}

export function calculateScoreLabel(score: number): { label: string; color: string } {
  if (score >= 120) return { label: 'Excelente', color: 'text-green-600 bg-green-100' };
  if (score >= 100) return { label: 'Bom', color: 'text-blue-600 bg-blue-100' };
  if (score >= 70) return { label: 'Regular', color: 'text-yellow-600 bg-yellow-100' };
  if (score >= 40) return { label: 'Ruim', color: 'text-orange-600 bg-orange-100' };
  return { label: 'Crítico', color: 'text-red-600 bg-red-100' };
}

export function calculateRecoveryBonus(extraProfit: number): number {
  // +2 pontos para cada R$50 pagos em multas, máximo +10 pontos
  return Math.min(10, Math.floor(extraProfit / 50) * 2);
}

export function useClientScore(
  clientId: string, 
  loans: Loan[], 
  payments: Array<{ loan_id: string; interest_paid: number | null }> = []
): ClientScoreData {
  return useMemo(() => {
    const clientLoans = loans.filter(loan => loan.client_id === clientId);
    
    // Calculate interest received per loan
    const interestByLoan = new Map<string, number>();
    payments.forEach(payment => {
      const current = interestByLoan.get(payment.loan_id) || 0;
      interestByLoan.set(payment.loan_id, current + (payment.interest_paid || 0));
    });
    
    let onTimePayments = 0;
    let latePayments = 0;
    let criticalLatePayments = 0;
    let totalPaid = 0;
    let totalExtraProfit = 0;

    const now = new Date();

    clientLoans.forEach(loan => {
      totalPaid += loan.total_paid || 0;
      
      // Calculate extra profit
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

    // Calculate score
    const totalPayments = onTimePayments + latePayments;
    let score = 100;
    
    if (totalPayments > 0) {
      score = 100 + (onTimePayments * 3) - (latePayments * 20) - (criticalLatePayments * 10);
      
      // Bônus de fidelidade
      const onTimeRatio = onTimePayments / totalPayments;
      if (clientLoans.length >= 3 && onTimeRatio >= 0.8) {
        score += 15;
      }
    }

    // Bônus de recuperação
    const recoveryBonus = calculateRecoveryBonus(totalExtraProfit);
    score += recoveryBonus;

    // Clamp score between 0 and 150
    score = Math.max(0, Math.min(150, score));
    
    const { label, color } = calculateScoreLabel(score);

    return {
      score,
      totalLoans: clientLoans.length,
      totalPaid,
      onTimePayments,
      latePayments,
      scoreLabel: label,
      scoreColor: color,
      recoveryBonus,
      extraProfit: totalExtraProfit,
    };
  }, [clientId, loans, payments]);
}

export function getScoreIcon(score: number): string {
  if (score >= 120) return '⭐';
  if (score >= 100) return '👍';
  if (score >= 70) return '👌';
  if (score >= 40) return '⚠️';
  return '🚨';
}
