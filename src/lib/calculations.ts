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

/**
 * Interface para empréstimos usados nas funções de cálculo
 */
interface LoanForCalculation {
  principal_amount: number;
  interest_rate: number;
  interest_mode?: string | null;
  total_interest?: number | null;
  payment_type?: string;
  installments?: number | null;
  installment_dates?: unknown;
  due_date: string;
  total_paid?: number | null;
  status?: string;
  notes?: string | null;
}

/**
 * Extrai pagamentos parciais registrados no campo notes
 */
function getPartialPaymentsFromNotes(notes: string | null): Record<number, number> {
  const payments: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    payments[parseInt(match[1])] = parseFloat(match[2]);
  }
  return payments;
}

/**
 * Extrai sub-parcelas de adiantamento pendentes do campo notes
 */
function getAdvanceSubparcelasFromNotes(notes: string | null): Array<{ originalIndex: number }> {
  const subparcelas: Array<{ originalIndex: number }> = [];
  const matches = (notes || '').matchAll(/\[ADVANCE_SUBPARCELA:(\d+):([0-9.]+):([^:\]]+)(?::(\d+))?\]/g);
  for (const match of matches) {
    subparcelas.push({ originalIndex: parseInt(match[1]) });
  }
  return subparcelas;
}

/**
 * Calcula quantas parcelas foram pagas de um empréstimo
 * Considera parcelas pagas, pagamentos parciais e sub-parcelas de adiantamento
 */
export function calculatePaidInstallments(loan: LoanForCalculation): number {
  const numInstallments = loan.installments || 1;
  const isDaily = loan.payment_type === 'daily';
  
  // Calcular juros totais do contrato
  let totalInterest = 0;
  if (isDaily) {
    const dailyAmount = loan.total_interest || 0;
    totalInterest = (dailyAmount * numInstallments) - loan.principal_amount;
  } else if (loan.total_interest !== undefined && loan.total_interest !== null && loan.total_interest > 0) {
    totalInterest = loan.total_interest;
  } else if (loan.interest_mode === 'on_total') {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100);
  } else if (loan.interest_mode === 'compound') {
    totalInterest = calculateCompoundInterestPMT(loan.principal_amount, loan.interest_rate, numInstallments);
  } else {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
  }
  
  const principalPerInstallment = loan.principal_amount / numInstallments;
  const interestPerInstallment = totalInterest / numInstallments;
  const baseInstallmentValue = principalPerInstallment + interestPerInstallment;
  
  // Verificar taxa de renovação
  const renewalFeeMatch = (loan.notes || '').match(/\[RENEWAL_FEE_INSTALLMENT:(\d+):([0-9.]+)(?::[0-9.]+)?\]/);
  const renewalFeeInstallmentIndex = renewalFeeMatch ? parseInt(renewalFeeMatch[1]) : null;
  const renewalFeeValue = renewalFeeMatch ? parseFloat(renewalFeeMatch[2]) : 0;
  
  const getInstallmentValue = (index: number) => {
    if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
      return renewalFeeValue;
    }
    return baseInstallmentValue;
  };
  
  const partialPayments = getPartialPaymentsFromNotes(loan.notes || null);
  
  // Fallback se não há tags de tracking
  const hasTrackingTags = Object.keys(partialPayments).length > 0;
  const hasInterestOnlyTags = (loan.notes || '').includes('[INTEREST_ONLY_PAID:');
  const totalPaid = loan.total_paid || 0;
  
  if (!hasTrackingTags && !hasInterestOnlyTags && totalPaid > 0 && baseInstallmentValue > 0) {
    const paidByValue = Math.floor(totalPaid / baseInstallmentValue);
    return Math.min(paidByValue, numInstallments);
  }
  
  // Verificar sub-parcelas pendentes
  const advanceSubparcelas = getAdvanceSubparcelasFromNotes(loan.notes || null);
  const hasSubparcelaForIndex = (index: number) => 
    advanceSubparcelas.some(s => s.originalIndex === index);
  
  let paidCount = 0;
  for (let i = 0; i < numInstallments; i++) {
    const installmentValue = getInstallmentValue(i);
    const paidAmount = partialPayments[i] || 0;
    if (paidAmount >= installmentValue * 0.99 && !hasSubparcelaForIndex(i)) {
      paidCount++;
    } else {
      break;
    }
  }
  
  return paidCount;
}

/**
 * Obtém a data da próxima parcela não paga de um empréstimo
 * Retorna null se todas as parcelas estiverem pagas
 */
export function getNextUnpaidInstallmentDate(loan: LoanForCalculation): Date | null {
  const dates = (loan.installment_dates as string[]) || [];
  const paidCount = calculatePaidInstallments(loan);
  
  if (dates.length > 0 && paidCount < dates.length) {
    // Usar T12:00:00 para evitar problemas de timezone
    return new Date(dates[paidCount] + 'T12:00:00');
  }
  
  // Fallback para due_date
  return new Date(loan.due_date + 'T12:00:00');
}

/**
 * Verifica se um empréstimo está em atraso
 * Considera installment_dates para empréstimos parcelados (diário/semanal/quinzenal)
 * Usa a lógica correta baseada em parcelas individuais
 */
export function isLoanOverdue(loan: LoanForCalculation): boolean {
  // Se já está marcado como pago, não está em atraso
  if (loan.status === 'paid') return false;
  
  // Se o status já é overdue, confirmar
  if (loan.status === 'overdue') return true;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dates = (loan.installment_dates as string[]) || [];
  
  // Para empréstimos com parcelas (diário, semanal, quinzenal, mensal parcelado)
  if (dates.length > 0) {
    const paidInstallments = calculatePaidInstallments(loan);
    
    // Se ainda há parcelas não pagas
    if (paidInstallments < dates.length) {
      const nextDueDate = new Date(dates[paidInstallments] + 'T12:00:00');
      nextDueDate.setHours(0, 0, 0, 0);
      return today > nextDueDate;
    }
  }
  
  // Fallback para due_date (empréstimos sem installment_dates ou já pagos)
  const loanDueDate = new Date(loan.due_date + 'T12:00:00');
  loanDueDate.setHours(0, 0, 0, 0);
  return today > loanDueDate;
}

/**
 * Calcula quantos dias de atraso um empréstimo tem
 * Retorna 0 se não estiver em atraso
 */
export function getDaysOverdue(loan: LoanForCalculation): number {
  if (!isLoanOverdue(loan)) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const nextDueDate = getNextUnpaidInstallmentDate(loan);
  if (!nextDueDate) return 0;
  
  nextDueDate.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - nextDueDate.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Interface para uma linha da Tabela Price (Sistema de Amortização Francês)
 */
export interface PriceTableRow {
  installmentNumber: number;  // Número da parcela
  payment: number;            // Valor da parcela (fixo - PMT)
  amortization: number;       // Amortização do principal (crescente)
  interest: number;           // Juros sobre saldo devedor (decrescente)
  balance: number;            // Saldo Devedor após a parcela
}

/**
 * Gera a Tabela Price completa (Sistema de Amortização Francês)
 * 
 * Na Tabela Price:
 * - A parcela (PMT) é FIXA em todas as prestações
 * - Os juros são calculados sobre o saldo devedor (decrescentes)
 * - A amortização é a diferença entre PMT e juros (crescente)
 * 
 * @param principal - Valor emprestado (capital)
 * @param monthlyRate - Taxa de juros mensal em percentual (ex: 20 para 20%)
 * @param installments - Número de parcelas
 * @returns Objeto com as linhas da tabela, PMT, total a pagar e total de juros
 */
export function generatePriceTable(
  principal: number,
  monthlyRate: number,
  installments: number
): { rows: PriceTableRow[]; pmt: number; totalPayment: number; totalInterest: number } {
  const pmt = calculatePMT(principal, monthlyRate, installments);
  const rate = monthlyRate / 100;
  
  const rows: PriceTableRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  
  for (let i = 1; i <= installments; i++) {
    // Juros do mês = saldo devedor × taxa mensal
    const interest = balance * rate;
    totalInterest += interest;
    
    // Amortização = PMT - Juros
    const amortization = pmt - interest;
    
    // Novo saldo = saldo anterior - amortização
    balance = Math.max(0, balance - amortization);
    
    // Para a última parcela, ajustar para zerar o saldo (evitar erros de arredondamento)
    const finalBalance = i === installments ? 0 : balance;
    
    rows.push({
      installmentNumber: i,
      payment: pmt,
      amortization: amortization,
      interest: interest,
      balance: finalBalance,
    });
  }
  
  const totalPayment = pmt * installments;
  
  return {
    rows,
    pmt,
    totalPayment,
    totalInterest,
  };
}
