export type CheckDiscountStatus = 'in_wallet' | 'compensated' | 'returned' | 'in_collection';
export type DiscountType = 'percentage' | 'proportional';
export type PaymentMethod = 'cash' | 'pix' | 'transfer';

export interface CheckDiscount {
  id: string;
  user_id: string;
  client_id: string | null;
  bank_name: string;
  check_number: string;
  issuer_document: string | null;
  issuer_name: string | null;
  nominal_value: number;
  due_date: string;
  discount_date: string;
  discount_type: DiscountType;
  discount_rate: number;
  discount_amount: number;
  net_value: number;
  payment_method: PaymentMethod;
  status: CheckDiscountStatus;
  return_date: string | null;
  return_reason: string | null;
  penalty_amount: number;
  penalty_rate: number;
  total_debt: number;
  total_paid_debt: number;
  installments_count: number;
  notes: string | null;
  purchase_value: number | null;
  seller_name: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  clients?: {
    id: string;
    full_name: string;
    phone: string | null;
    score: number | null;
  } | null;
}

export interface CheckDiscountPayment {
  id: string;
  check_discount_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  installment_number: number;
  notes: string | null;
  created_at: string;
}

export interface CheckDiscountFormData {
  client_id: string | null;
  bank_name: string;
  check_number: string;
  issuer_document: string;
  issuer_name: string;
  nominal_value: number;
  due_date: string;
  discount_date: string;
  discount_type: DiscountType;
  discount_rate: number;
  payment_method: PaymentMethod;
  notes: string;
  purchase_value: number;
  seller_name: string;
}

export interface ReturnFormData {
  return_date: string;
  return_reason: string;
  apply_penalty: boolean;
  penalty_rate: number;
  apply_interest: boolean;
  interest_rate: number;
  installments_count: number;
  send_whatsapp: boolean;
}

export interface CheckDiscountStats {
  inWalletCount: number;
  inWalletValue: number;
  dueSoonCount: number;
  compensatedCount: number;
  compensatedValue: number;
  returnedCount: number;
  returnedValue: number;
  inCollectionCount: number;
  expectedProfit: number;
  realizedProfit: number;
}

// Helper functions for discount calculations
export function calculateDiscountAmount(
  nominalValue: number,
  discountRate: number,
  discountType: DiscountType,
  daysUntilDue: number
): number {
  if (discountType === 'percentage') {
    // Fixed percentage regardless of days
    return nominalValue * (discountRate / 100);
  } else {
    // Proportional: rate is monthly (30 days)
    const proportionalRate = (discountRate / 30) * daysUntilDue;
    return nominalValue * (proportionalRate / 100);
  }
}

export function calculateNetValue(nominalValue: number, discountAmount: number): number {
  return nominalValue - discountAmount;
}

export function getDaysUntilDue(discountDate: string, dueDate: string): number {
  const discount = new Date(discountDate);
  const due = new Date(dueDate);
  const diffTime = due.getTime() - discount.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.abs(diffDays));
}

export function getStatusLabel(status: CheckDiscountStatus): string {
  const labels: Record<CheckDiscountStatus, string> = {
    in_wallet: 'Em Carteira',
    compensated: 'Compensado',
    returned: 'Devolvido',
    in_collection: 'Em Cobrança',
  };
  return labels[status];
}

export function getStatusColor(status: CheckDiscountStatus): string {
  const colors: Record<CheckDiscountStatus, string> = {
    in_wallet: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    compensated: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    returned: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    in_collection: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  };
  return colors[status];
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    cash: 'Dinheiro',
    pix: 'PIX',
    transfer: 'Transferência',
  };
  return labels[method];
}

export const RETURN_REASONS = [
  'Sem Fundos',
  'Conta Encerrada',
  'Cheque Sustado',
  'Assinatura Divergente',
  'Cheque Extraviado',
  'Conta Bloqueada',
  'Outro Motivo',
] as const;

export const BANKS = [
  'Banco do Brasil',
  'Bradesco',
  'Caixa Econômica',
  'Itaú',
  'Santander',
  'Sicredi',
  'Sicoob',
  'Banrisul',
  'Nubank',
  'Inter',
  'C6 Bank',
  'Original',
  'Safra',
  'BTG Pactual',
  'Outro',
] as const;
