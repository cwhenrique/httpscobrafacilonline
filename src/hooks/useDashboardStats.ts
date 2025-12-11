import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DashboardStats {
  totalLoaned: number;
  totalReceived: number;
  totalPending: number;
  totalToReceive: number;
  overdueCount: number;
  upcomingDue: number;
  activeClients: number;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLoaned: 0,
    totalReceived: 0,
    totalPending: 0,
    totalToReceive: 0,
    overdueCount: 0,
    upcomingDue: 0,
    activeClients: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchStats = async () => {
    if (!user) return;

    setLoading(true);

    // Fetch loans with all necessary fields for calculation
    const { data: loans } = await supabase
      .from('loans')
      .select('principal_amount, total_paid, remaining_balance, status, due_date, interest_rate, installments, interest_mode, payment_type, total_interest');

    // Fetch monthly fee payments
    const { data: monthlyPayments } = await supabase
      .from('monthly_fee_payments')
      .select('amount, status, due_date');

    // Fetch clients count
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });

    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    let totalLoaned = 0;
    let totalReceived = 0;
    let totalToReceive = 0;
    let overdueCount = 0;
    let upcomingDue = 0;

    if (loans) {
      loans.forEach(loan => {
        // Total emprestado = soma dos principais
        totalLoaned += Number(loan.principal_amount);
        
        // Total recebido = soma dos pagamentos
        totalReceived += Number(loan.total_paid || 0);
        
        // Calcular total a receber (principal + juros) para cada empréstimo
        let loanTotalToReceive = 0;
        
        if (loan.payment_type === 'daily') {
          // Para empréstimos diários, remaining_balance armazena o total a receber inicial
          // e total_interest armazena o valor da parcela diária
          loanTotalToReceive = Number(loan.remaining_balance) + Number(loan.total_paid || 0);
        } else {
          // Para empréstimos regulares, calcular baseado em juros
          const principal = Number(loan.principal_amount);
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
        
        totalToReceive += loanTotalToReceive;
        
        if (loan.status === 'overdue') {
          overdueCount++;
        }

        const dueDate = new Date(loan.due_date);
        if (dueDate >= today && dueDate <= nextWeek && loan.status !== 'paid') {
          upcomingDue++;
        }
      });
    }

    // Calcular total pendente = total a receber - total recebido
    const totalPending = totalToReceive - totalReceived;

    if (monthlyPayments) {
      monthlyPayments.forEach(payment => {
        if (payment.status === 'paid') {
          totalReceived += Number(payment.amount);
        } else {
          // Adicionar ao pendente os pagamentos mensais não pagos
          if (payment.status === 'overdue') {
            overdueCount++;
          }
        }

        const dueDate = new Date(payment.due_date);
        if (dueDate >= today && dueDate <= nextWeek && payment.status !== 'paid') {
          upcomingDue++;
        }
      });
    }

    setStats({
      totalLoaned,
      totalReceived,
      totalPending: Math.max(0, totalPending),
      totalToReceive,
      overdueCount,
      upcomingDue,
      activeClients: clientsCount || 0,
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  return { stats, loading, refetch: fetchStats };
}
