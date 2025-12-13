import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loan } from '@/types/database';

export interface OperationalStats {
  // Empréstimos Ativos (Na Rua)
  activeLoansCount: number;
  totalOnStreet: number;           // Principal em contratos ativos
  totalToReceiveActive: number;    // Principal + Juros de ativos
  pendingAmount: number;           // Falta cobrar de ativos
  
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
    totalToReceiveActive: 0,
    pendingAmount: 0,
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

    // Fetch all loans with client info
    const { data: loans } = await supabase
      .from('loans')
      .select(`
        *,
        client:clients(full_name, phone)
      `)
      .order('created_at', { ascending: false });

    if (!loans) {
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }

    // Calculate stats
    let activeLoansCount = 0;
    let totalOnStreet = 0;
    let totalToReceiveActive = 0;
    let totalReceivedAllTime = 0;
    let totalPrincipalReceived = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let paidLoansCount = 0;

    const activeLoans: LoanWithClient[] = [];
    const overdueLoans: LoanWithClient[] = [];

    loans.forEach((loan: any) => {
      const principal = Number(loan.principal_amount);
      const totalPaid = Number(loan.total_paid || 0);
      const remainingBalance = Number(loan.remaining_balance);
      const isDaily = loan.payment_type === 'daily';
      
      // Calcular total a receber do empréstimo
      let loanTotalToReceive = 0;
      
      if (isDaily) {
        // Para diários: remaining_balance + total_paid = total a receber original
        loanTotalToReceive = remainingBalance + totalPaid;
      } else {
        const rate = Number(loan.interest_rate);
        const numInstallments = Number(loan.installments) || 1;
        const interestMode = loan.interest_mode || 'per_installment';
        
        let totalInterest = 0;
        if (interestMode === 'per_installment') {
          totalInterest = principal * (rate / 100) * numInstallments;
        } else {
          totalInterest = principal * (rate / 100);
        }
        
        loanTotalToReceive = principal + totalInterest;
      }

      // Total recebido de TODOS empréstimos (histórico)
      totalReceivedAllTime += totalPaid;

      if (loan.status === 'paid') {
        paidLoansCount++;
        // Principal recebido dos empréstimos pagos
        totalPrincipalReceived += principal;
      } else {
        // Empréstimo ativo (não quitado)
        activeLoansCount++;
        totalOnStreet += principal;
        totalToReceiveActive += loanTotalToReceive;
        
        const loanWithClient = loan as LoanWithClient;
        activeLoans.push(loanWithClient);

        if (loan.status === 'overdue') {
          overdueCount++;
          overdueAmount += remainingBalance;
          overdueLoans.push(loanWithClient);
        }
      }
    });

    // Pendente = total a receber de ativos - total já pago desses ativos
    const totalPaidFromActive = activeLoans.reduce((sum, l) => sum + Number(l.total_paid || 0), 0);
    const pendingAmount = totalToReceiveActive - totalPaidFromActive;

    // Lucro realizado = Total recebido - Principal dos empréstimos pagos
    // (juros já recebidos)
    const realizedProfit = totalReceivedAllTime - totalPrincipalReceived;

    setStats({
      activeLoansCount,
      totalOnStreet,
      totalToReceiveActive,
      pendingAmount,
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
