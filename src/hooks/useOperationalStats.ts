import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loan } from '@/types/database';
import { isLoanOverdue, getTotalDailyPenalties } from '@/lib/calculations';

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
  
  // Lista de contratos ativos
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

export function useOperationalStats() {
  const [stats, setStats] = useState<OperationalStats>({
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
  });
  const { user } = useAuth();

  const fetchStats = async () => {
    if (!user) return;

    // Fetch all loans with client info AND their payments
    const { data: loans } = await supabase
      .from('loans')
      .select(`
        *,
        client:clients(full_name, phone),
        payments:loan_payments(amount, interest_paid, principal_paid, payment_date)
      `)
      .order('created_at', { ascending: false });

    if (!loans) {
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }

    // Calculate stats
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
      
      // Calcular lucro realizado usando os pagamentos individuais
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
        // Empréstimo ativo (não quitado)
        activeLoansCount++;
        
        // Calcular principal já recebido a partir dos pagamentos
        const totalPrincipalReceived = payments.reduce(
          (sum: number, p: any) => sum + Number(p.principal_paid || 0), 
          0
        );
        
        // Capital na rua = principal original - principal já pago
        const principalPending = principal - totalPrincipalReceived;
        totalOnStreet += principalPending;
        
        // Calcular juros pendentes para contratos ativos
        let totalInterest = 0;
        if (isDaily) {
          // Para diários, juros está embutido no remaining_balance inicial
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

        // Usar função centralizada para verificar atraso
        // Considera installment_dates para empréstimos diários/semanais/quinzenais
        if (isLoanOverdue(loan)) {
          overdueCount++;
          overdueAmount += remainingBalance;
          overdueLoans.push(loanWithClient);
        }
      }
    });

    // Pendente = soma de remaining_balance + multas aplicadas dos ativos
    const pendingAmount = activeLoans.reduce((sum, loan) => {
      const penalties = getTotalDailyPenalties(loan.notes);
      return sum + Number(loan.remaining_balance) + penalties;
    }, 0);

    // Lucro realizado = juros proporcionalmente recebidos
    const realizedProfit = totalProfitRealized;

    setStats({
      activeLoansCount,
      totalOnStreet,
      pendingAmount,
      pendingInterest,
      totalReceivedAllTime,
      realizedProfit,
      overdueCount,
      overdueAmount,
      paidLoansCount,
      loading: false,
      activeLoans,
      overdueLoans,
      allLoans: loans as LoanWithClient[],
    });
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  return { stats, refetch: fetchStats };
}
