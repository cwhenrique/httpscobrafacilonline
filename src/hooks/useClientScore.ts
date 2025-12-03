import { useMemo } from 'react';
import { Loan } from '@/types/database';

export interface ClientScoreData {
  score: number;
  totalLoans: number;
  totalPaid: number;
  onTimePayments: number;
  latePayments: number;
  scoreLabel: string;
  scoreColor: string;
}

export function calculateScoreLabel(score: number): { label: string; color: string } {
  if (score >= 120) return { label: 'Excelente', color: 'text-green-600 bg-green-100' };
  if (score >= 100) return { label: 'Bom', color: 'text-blue-600 bg-blue-100' };
  if (score >= 70) return { label: 'Regular', color: 'text-yellow-600 bg-yellow-100' };
  if (score >= 40) return { label: 'Ruim', color: 'text-orange-600 bg-orange-100' };
  return { label: 'Crítico', color: 'text-red-600 bg-red-100' };
}

export function useClientScore(clientId: string, loans: Loan[]): ClientScoreData {
  return useMemo(() => {
    const clientLoans = loans.filter(loan => loan.client_id === clientId);
    
    let onTimePayments = 0;
    let latePayments = 0;
    let totalPaid = 0;

    clientLoans.forEach(loan => {
      totalPaid += loan.total_paid || 0;
      
      if (loan.status === 'paid') {
        // Check if it was paid on time based on due_date
        const dueDate = new Date(loan.due_date);
        const now = new Date();
        if (dueDate >= now || loan.status === 'paid') {
          onTimePayments++;
        }
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
      if (clientLoans.length >= 3 && onTimeRatio >= 0.8) {
        score += 10;
      }
    }

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
    };
  }, [clientId, loans]);
}

export function getScoreIcon(score: number): string {
  if (score >= 120) return '⭐';
  if (score >= 100) return '👍';
  if (score >= 70) return '👌';
  if (score >= 40) return '⚠️';
  return '🚨';
}
