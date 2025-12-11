import { InterestType } from '@/types/database';

export function calculateSimpleInterest(
  principal: number,
  rate: number,
  days: number
): number {
  // Rate is monthly, convert to daily
  const dailyRate = rate / 30;
  return principal * (dailyRate / 100) * days;
}

export function calculateCompoundInterest(
  principal: number,
  rate: number,
  days: number
): number {
  // Rate is monthly, convert to daily
  const dailyRate = rate / 30 / 100;
  const amount = principal * Math.pow(1 + dailyRate, days);
  return amount - principal;
}

export function calculateInterest(
  principal: number,
  rate: number,
  days: number,
  type: InterestType
): number {
  if (type === 'simple') {
    return calculateSimpleInterest(principal, rate, days);
  }
  return calculateCompoundInterest(principal, rate, days);
}

export function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function calculateAccumulatedInterest(
  principal: number,
  rate: number,
  startDate: string,
  type: InterestType
): number {
  const today = new Date().toISOString().split('T')[0];
  const days = calculateDaysBetween(startDate, today);
  return calculateInterest(principal, rate, days, type);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string): string {
  // Add T12:00:00 to avoid timezone issues when parsing date-only strings
  const dateObj = date.includes('T') ? new Date(date) : new Date(date + 'T12:00:00');
  return dateObj.toLocaleDateString('pt-BR');
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'paid':
      return 'bg-success/10 text-success border-success/20';
    case 'pending':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'overdue':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Pago';
    case 'pending':
      return 'Pendente';
    case 'overdue':
      return 'Atrasado';
    default:
      return status;
  }
}

export function calculateOverduePenalty(
  remainingBalance: number,
  monthlyRate: number,
  dueDate: string
): { daysOverdue: number; penaltyAmount: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  if (today <= due) {
    return { daysOverdue: 0, penaltyAmount: 0 };
  }
  
  const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  // Daily rate = monthly rate / 30
  const dailyRate = monthlyRate / 30 / 100;
  const penaltyAmount = remainingBalance * dailyRate * daysOverdue;
  
  return { daysOverdue, penaltyAmount };
}

export function getClientTypeLabel(type: string): string {
  switch (type) {
    case 'loan':
      return 'Empréstimo';
    case 'monthly':
      return 'Mensalidade';
    case 'both':
      return 'Ambos';
    default:
      return type;
  }
}
