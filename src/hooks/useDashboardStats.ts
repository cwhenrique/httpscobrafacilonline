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
  // New metrics
  contractsThisWeek: number;
  receivedThisWeek: number;
  dueToday: number;
  // Per business type
  loanCount: number;
  loansThisWeek: number;
  productSalesCount: number;
  productSalesThisWeek: number;
  vehiclesCount: number;
  vehiclesThisWeek: number;
  contractsCount: number;
  contractsThisWeekCount: number;
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
    contractsThisWeek: 0,
    receivedThisWeek: 0,
    dueToday: 0,
    loanCount: 0,
    loansThisWeek: 0,
    productSalesCount: 0,
    productSalesThisWeek: 0,
    vehiclesCount: 0,
    vehiclesThisWeek: 0,
    contractsCount: 0,
    contractsThisWeekCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchStats = async () => {
    if (!user) return;

    setLoading(true);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch all data in parallel
    const [
      { data: loans },
      { data: loansThisWeek },
      { data: monthlyPayments },
      { count: clientsCount },
      { data: productSales },
      { data: productSalesThisWeek },
      { data: vehicles },
      { data: vehiclesThisWeek },
      { data: contracts },
      { data: contractsThisWeek },
      { data: loanPaymentsThisWeek },
      { data: productPaymentsThisWeek },
      { data: vehiclePaymentsThisWeek },
      { data: contractPaymentsThisWeek },
    ] = await Promise.all([
      supabase.from('loans').select('principal_amount, total_paid, remaining_balance, status, due_date, interest_rate, installments, interest_mode, payment_type, total_interest, installment_dates'),
      supabase.from('loans').select('id').gte('created_at', weekAgoStr),
      supabase.from('monthly_fee_payments').select('amount, status, due_date'),
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('product_sales').select('id, status'),
      supabase.from('product_sales').select('id').gte('created_at', weekAgoStr),
      supabase.from('vehicles').select('id, status'),
      supabase.from('vehicles').select('id').gte('created_at', weekAgoStr),
      supabase.from('contracts').select('id, status'),
      supabase.from('contracts').select('id').gte('created_at', weekAgoStr),
      supabase.from('loan_payments').select('amount, payment_date').gte('payment_date', weekAgoStr),
      supabase.from('product_sale_payments').select('amount, paid_date').eq('status', 'paid').gte('paid_date', weekAgoStr),
      supabase.from('vehicle_payments').select('amount, paid_date').eq('status', 'paid').gte('paid_date', weekAgoStr),
      supabase.from('contract_payments').select('amount, paid_date').eq('status', 'paid').gte('paid_date', weekAgoStr),
    ]);

    let totalLoaned = 0;
    let totalReceived = 0;
    let totalToReceive = 0;
    let overdueCount = 0;
    let upcomingDue = 0;
    let dueToday = 0;

    if (loans) {
      loans.forEach(loan => {
        totalLoaned += Number(loan.principal_amount);
        totalReceived += Number(loan.total_paid || 0);
        
        let loanTotalToReceive = 0;
        
        if (loan.payment_type === 'daily') {
          loanTotalToReceive = Number(loan.remaining_balance) + Number(loan.total_paid || 0);
        } else {
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

        // Check due dates
        const installmentDates = (loan.installment_dates as string[]) || [];
        if (installmentDates.length > 0) {
          installmentDates.forEach(dateStr => {
            const dueDate = new Date(dateStr);
            if (dueDate.toISOString().split('T')[0] === todayStr && loan.status !== 'paid') {
              dueToday++;
            }
            if (dueDate >= today && dueDate <= nextWeek && loan.status !== 'paid') {
              upcomingDue++;
            }
          });
        } else {
          const dueDate = new Date(loan.due_date);
          if (dueDate.toISOString().split('T')[0] === todayStr && loan.status !== 'paid') {
            dueToday++;
          }
          if (dueDate >= today && dueDate <= nextWeek && loan.status !== 'paid') {
            upcomingDue++;
          }
        }
      });
    }

    const totalPending = totalToReceive - totalReceived;

    if (monthlyPayments) {
      monthlyPayments.forEach(payment => {
        if (payment.status === 'paid') {
          totalReceived += Number(payment.amount);
        } else {
          if (payment.status === 'overdue') {
            overdueCount++;
          }
        }

        const dueDate = new Date(payment.due_date);
        if (dueDate.toISOString().split('T')[0] === todayStr && payment.status !== 'paid') {
          dueToday++;
        }
        if (dueDate >= today && dueDate <= nextWeek && payment.status !== 'paid') {
          upcomingDue++;
        }
      });
    }

    // Calculate received this week
    let receivedThisWeek = 0;
    if (loanPaymentsThisWeek) {
      receivedThisWeek += loanPaymentsThisWeek.reduce((sum, p) => sum + Number(p.amount), 0);
    }
    if (productPaymentsThisWeek) {
      receivedThisWeek += productPaymentsThisWeek.reduce((sum, p) => sum + Number(p.amount), 0);
    }
    if (vehiclePaymentsThisWeek) {
      receivedThisWeek += vehiclePaymentsThisWeek.reduce((sum, p) => sum + Number(p.amount), 0);
    }
    if (contractPaymentsThisWeek) {
      receivedThisWeek += contractPaymentsThisWeek.reduce((sum, p) => sum + Number(p.amount), 0);
    }

    // Total contracts this week
    const contractsThisWeekTotal = 
      (loansThisWeek?.length || 0) + 
      (productSalesThisWeek?.length || 0) + 
      (vehiclesThisWeek?.length || 0) + 
      (contractsThisWeek?.length || 0);

    setStats({
      totalLoaned,
      totalReceived,
      totalPending: Math.max(0, totalPending),
      totalToReceive,
      overdueCount,
      upcomingDue,
      activeClients: clientsCount || 0,
      contractsThisWeek: contractsThisWeekTotal,
      receivedThisWeek,
      dueToday,
      loanCount: loans?.length || 0,
      loansThisWeek: loansThisWeek?.length || 0,
      productSalesCount: productSales?.length || 0,
      productSalesThisWeek: productSalesThisWeek?.length || 0,
      vehiclesCount: vehicles?.length || 0,
      vehiclesThisWeek: vehiclesThisWeek?.length || 0,
      contractsCount: contracts?.length || 0,
      contractsThisWeekCount: contractsThisWeek?.length || 0,
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  return { stats, loading, refetch: fetchStats };
}
