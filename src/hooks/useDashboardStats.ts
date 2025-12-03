import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardStats } from '@/types/database';

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLoaned: 0,
    totalReceived: 0,
    totalPending: 0,
    overdueCount: 0,
    upcomingDue: 0,
    activeClients: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchStats = async () => {
    if (!user) return;

    setLoading(true);

    // Fetch loans
    const { data: loans } = await supabase
      .from('loans')
      .select('principal_amount, total_paid, remaining_balance, status, due_date');

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
    let totalPending = 0;
    let overdueCount = 0;
    let upcomingDue = 0;

    if (loans) {
      loans.forEach(loan => {
        totalLoaned += Number(loan.principal_amount);
        totalReceived += Number(loan.total_paid);
        totalPending += Number(loan.remaining_balance);
        
        if (loan.status === 'overdue') {
          overdueCount++;
        }

        const dueDate = new Date(loan.due_date);
        if (dueDate >= today && dueDate <= nextWeek && loan.status !== 'paid') {
          upcomingDue++;
        }
      });
    }

    if (monthlyPayments) {
      monthlyPayments.forEach(payment => {
        if (payment.status === 'paid') {
          totalReceived += Number(payment.amount);
        } else {
          totalPending += Number(payment.amount);
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
      totalPending,
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
