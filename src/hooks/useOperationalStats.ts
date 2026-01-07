import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Loan } from '@/types/database';
import { isLoanOverdue, getTotalDailyPenalties, getDaysOverdue, calculateDynamicOverdueInterest } from '@/lib/calculations';

export interface OperationalStats {
  // Empréstimos Ativos (Na Rua)
  activeLoansCount: number;
  totalOnStreet: number;           // Principal em contratos ativos
  pendingAmount: number;           // Falta cobrar de ativos (remaining_balance)
  pendingInterest: number;         // Juros pendentes a receber
  
  // Histórico Total
  totalReceivedAllTime: number;    // Σ total_paid de TODOS empréstimos
  realizedProfit: number;          // Juros já recebidos (recebido - principal recebido)
  
  // Alertas
  overdueCount: number;
  overdueAmount: number;
  
  // Pagos
  paidLoansCount: number;
  
  // Loading state
  loading: boolean;
  
  // Lista de contratos ativos (limitados para performance)
  activeLoans: LoanWithClient[];
  overdueLoans: LoanWithClient[];
  allLoans: LoanWithClient[];
}

interface LoanWithClient {
  id: string;
  user_id: string;
  client_id: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: string;
  interest_mode: string | null;
  payment_type: string;
  installments: number;
  installment_dates: string[];
  start_date: string;
  due_date: string;
  total_interest: number;
  total_paid: number;
  remaining_balance: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    full_name: string;
    phone: string | null;
  };
}

const defaultStats: OperationalStats = {
  activeLoansCount: 0,
  totalOnStreet: 0,
  pendingAmount: 0,
  pendingInterest: 0,
  totalReceivedAllTime: 0,
  realizedProfit: 0,
  overdueCount: 0,
  overdueAmount: 0,
  paidLoansCount: 0,
  loading: true,
  activeLoans: [],
  overdueLoans: [],
  allLoans: [],
};

interface StatsData {
  stats: Omit<OperationalStats, 'loading'>;
}

async function fetchOperationalStats(): Promise<StatsData> {
  // Buscar apenas empréstimos ativos e com campos necessários
  // Limita a 500 para performance mas inclui todos os ativos
  const { data: loans } = await supabase
    .from('loans')
    .select(`
      id, user_id, client_id, principal_amount, interest_rate, interest_type,
      interest_mode, payment_type, installments, installment_dates, start_date,
      due_date, total_interest, total_paid, remaining_balance, status, notes,
      created_at, updated_at,
      client:clients(full_name, phone),
      payments:loan_payments(id, amount, interest_paid, principal_paid, payment_date)
    `)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (!loans) {
    const { loading: _, ...restDefault } = defaultStats;
    return { stats: restDefault };
  }

  let activeLoansCount = 0;
  let totalOnStreet = 0;
  let pendingInterest = 0;
  let totalReceivedAllTime = 0;
  let totalProfitRealized = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let paidLoansCount = 0;

  const activeLoans: LoanWithClient[] = [];
  const overdueLoans: LoanWithClient[] = [];

  loans.forEach((loan: any) => {
    const principal = Number(loan.principal_amount);
    const totalPaid = Number(loan.total_paid || 0);
    const remainingBalance = Number(loan.remaining_balance);
    const rate = Number(loan.interest_rate);
    const installments = Number(loan.installments) || 1;
    const interestMode = loan.interest_mode || 'per_installment';
    const isDaily = loan.payment_type === 'daily';
    
    const payments = loan.payments || [];
    const totalInterestReceived = payments.reduce(
      (sum: number, p: any) => sum + Number(p.interest_paid || 0), 
      0
    );
    
    totalProfitRealized += totalInterestReceived;
    totalReceivedAllTime += totalPaid;

    if (loan.status === 'paid') {
      paidLoansCount++;
    } else {
      activeLoansCount++;
      
      const totalPrincipalReceived = payments.reduce(
        (sum: number, p: any) => sum + Number(p.principal_paid || 0), 
        0
      );
      
      const principalPending = principal - totalPrincipalReceived;
      totalOnStreet += principalPending;
      
      let totalInterest = 0;
      if (isDaily) {
        totalInterest = remainingBalance + totalPaid - principal;
      } else {
        totalInterest = interestMode === 'per_installment' 
          ? principal * (rate / 100) * installments 
          : principal * (rate / 100);
      }
      const interestPending = Math.max(0, totalInterest - totalInterestReceived);
      pendingInterest += interestPending;
      
      const loanWithClient = loan as LoanWithClient;
      activeLoans.push(loanWithClient);

      if (isLoanOverdue(loan)) {
        overdueCount++;
        const daysOver = getDaysOverdue(loan);
        const dynamicInterest = calculateDynamicOverdueInterest(loan, daysOver);
        overdueAmount += remainingBalance + dynamicInterest;
        overdueLoans.push(loanWithClient);
      }
    }
  });

  const pendingAmount = activeLoans.reduce((sum, loan) => {
    const penalties = getTotalDailyPenalties(loan.notes);
    const daysOver = getDaysOverdue(loan);
    const dynamicInterest = calculateDynamicOverdueInterest(loan, daysOver);
    return sum + Number(loan.remaining_balance) + penalties + dynamicInterest;
  }, 0);

  return {
    stats: {
      activeLoansCount,
      totalOnStreet,
      pendingAmount,
      pendingInterest,
      totalReceivedAllTime,
      realizedProfit: totalProfitRealized,
      overdueCount,
      overdueAmount,
      paidLoansCount,
      activeLoans,
      overdueLoans,
      allLoans: loans as LoanWithClient[],
    }
  };
}

export function useOperationalStats() {
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['operational-stats', effectiveUserId],
    queryFn: fetchOperationalStats,
    enabled: !!user && !employeeLoading && !!effectiveUserId,
    staleTime: 1000 * 60 * 2, // 2 minutos
    gcTime: 1000 * 60 * 5, // 5 minutos
  });

  const stats: OperationalStats = data?.stats 
    ? { ...data.stats, loading: isLoading }
    : { ...defaultStats, loading: isLoading };

  return { stats, refetch };
}
