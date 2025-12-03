export type ClientType = 'loan' | 'monthly' | 'both';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';
export type InterestType = 'simple' | 'compound';
export type LoanPaymentType = 'single' | 'installment';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  client_type: ClientType;
  created_at: string;
  updated_at: string;
}

export type InterestMode = 'per_installment' | 'on_total';

export interface Loan {
  id: string;
  user_id: string;
  client_id: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: InterestType;
  interest_mode: InterestMode;
  payment_type: LoanPaymentType;
  installments: number;
  installment_dates: string[];
  start_date: string;
  due_date: string;
  total_interest: number;
  total_paid: number;
  remaining_balance: number;
  status: PaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  user_id: string;
  amount: number;
  principal_paid: number;
  interest_paid: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface MonthlyFee {
  id: string;
  user_id: string;
  client_id: string;
  amount: number;
  description: string | null;
  due_day: number;
  interest_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface MonthlyFeePayment {
  id: string;
  monthly_fee_id: string;
  user_id: string;
  reference_month: string;
  amount: number;
  status: PaymentStatus;
  payment_date: string | null;
  due_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  monthly_fee?: MonthlyFee;
}

export interface DashboardStats {
  totalLoaned: number;
  totalReceived: number;
  totalPending: number;
  overdueCount: number;
  upcomingDue: number;
  activeClients: number;
}
