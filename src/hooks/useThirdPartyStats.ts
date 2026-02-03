import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { isLoanOverdue, getTotalDailyPenalties, getDaysOverdue, calculateDynamicOverdueInterest } from '@/lib/calculations';

export interface ThirdPartyStats {
  activeLoansCount: number;
  totalOnStreet: number;
  pendingAmount: number;
  pendingInterest: number;
  totalReceivedAllTime: number;
  realizedProfit: number;
  overdueCount: number;
  overdueAmount: number;
  paidLoansCount: number;
  loading: boolean;
  totalLent: number;
  totalReceived: number;
  activeLoans: any[];
  overdueLoans: any[];
  allLoans: any[];
}

const defaultStats: ThirdPartyStats = {
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
  totalLent: 0,
  totalReceived: 0,
  activeLoans: [],
  overdueLoans: [],
  allLoans: [],
};

async function fetchThirdPartyStats() {
  const { data: loans } = await supabase
    .from('loans')
    .select(`
      id, user_id, client_id, principal_amount, interest_rate, interest_type,
      interest_mode, payment_type, installments, installment_dates, contract_date, start_date,
      due_date, total_interest, total_paid, remaining_balance, status, notes,
      created_at, updated_at, is_third_party, third_party_name,
      client:clients(full_name, phone),
      payments:loan_payments(id, amount, interest_paid, principal_paid, payment_date)
    `)
    .eq('is_third_party', true)
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
  let totalLent = 0;

  const activeLoans: any[] = [];
  const overdueLoans: any[] = [];

  loans.forEach((loan: any) => {
    const principal = Number(loan.principal_amount);
    const totalPaid = Number(loan.total_paid || 0);
    const remainingBalance = Number(loan.remaining_balance);
    const rate = Number(loan.interest_rate);
    const installments = Number(loan.installments) || 1;
    const interestMode = loan.interest_mode || 'per_installment';
    const isDaily = loan.payment_type === 'daily';
    
    totalLent += principal;
    
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
      } else if (loan.total_interest && Number(loan.total_interest) > 0) {
        totalInterest = Number(loan.total_interest);
      } else if (interestMode === 'per_installment') {
        totalInterest = principal * (rate / 100) * installments;
      } else if (interestMode === 'compound') {
        totalInterest = principal * Math.pow(1 + (rate / 100), installments) - principal;
      } else {
        totalInterest = principal * (rate / 100);
      }
      const interestPending = Math.max(0, totalInterest - totalInterestReceived);
      pendingInterest += interestPending;
      
      activeLoans.push(loan);

      if (isLoanOverdue(loan)) {
        overdueCount++;
        const daysOver = getDaysOverdue(loan);
        const dynamicInterest = calculateDynamicOverdueInterest(loan, daysOver);
        overdueAmount += remainingBalance + dynamicInterest;
        overdueLoans.push(loan);
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
      totalLent,
      totalReceived: totalReceivedAllTime,
      activeLoans,
      overdueLoans,
      allLoans: loans,
    }
  };
}

export function useThirdPartyStats() {
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['third-party-stats', effectiveUserId],
    queryFn: fetchThirdPartyStats,
    enabled: !!user && !employeeLoading && !!effectiveUserId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const stats: ThirdPartyStats = data?.stats 
    ? { ...data.stats, loading: isLoading }
    : { ...defaultStats, loading: isLoading };

  return { stats, refetch };
}
