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

/**
 * Calcula o PMT (prestação fixa) usando a fórmula de amortização Price
 * PMT = PV × [ i × (1 + i)^n ] / [ (1 + i)^n − 1 ]
 * 
 * @param principal - Valor emprestado (PV)
 * @param monthlyRate - Taxa de juros mensal em percentual (ex: 10 para 10%)
 * @param installments - Número de parcelas (n)
 * @returns Valor da prestação fixa (PMT)
 */
export function calculatePMT(
  principal: number,
  monthlyRate: number,
  installments: number
): number {
  const i = monthlyRate / 100; // Converter para decimal
  
  // Caso especial: taxa zero
  if (i === 0 || !isFinite(i)) {
    return principal / installments;
  }
  
  const factor = Math.pow(1 + i, installments);
  const pmt = principal * (i * factor) / (factor - 1);
  
  return isFinite(pmt) ? pmt : principal / installments;
}

/**
 * Calcula o total de juros para empréstimo com PMT (juros compostos amortizados)
 * 
 * @param principal - Valor emprestado
 * @param monthlyRate - Taxa de juros mensal em percentual
 * @param installments - Número de parcelas
 * @returns Total de juros
 */
export function calculateCompoundInterestPMT(
  principal: number,
  monthlyRate: number,
  installments: number
): number {
  const pmt = calculatePMT(principal, monthlyRate, installments);
  const totalPaid = pmt * installments;
  return totalPaid - principal;
}

/**
 * Calcula a taxa de juros a partir do PMT usando Newton-Raphson
 * Dado PMT, PV e n, encontra a taxa i
 * 
 * @param pmt - Valor da prestação
 * @param principal - Valor emprestado
 * @param installments - Número de parcelas
 * @returns Taxa mensal em percentual
 */
export function calculateRateFromPMT(
  pmt: number,
  principal: number,
  installments: number
): number {
  // Se PMT é igual a principal/n, taxa é 0
  if (Math.abs(pmt - principal / installments) < 0.01) {
    return 0;
  }
  
  // Chute inicial
  let rate = 0.1; // 10%
  const maxIterations = 100;
  const tolerance = 0.0000001;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const factor = Math.pow(1 + rate, installments);
    const calculatedPMT = principal * (rate * factor) / (factor - 1);
    const f = calculatedPMT - pmt;
    
    // Derivada numérica
    const h = 0.0001;
    const factorH = Math.pow(1 + rate + h, installments);
    const pmtH = principal * ((rate + h) * factorH) / (factorH - 1);
    const df = (pmtH - calculatedPMT) / h;
    
    if (Math.abs(df) < tolerance) break;
    
    const newRate = rate - f / df;
    
    if (Math.abs(newRate - rate) < tolerance) {
      rate = newRate;
      break;
    }
    
    // Manter taxa positiva
    rate = Math.max(0.0001, newRate);
  }
  
  return rate * 100; // Retornar em percentual
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
