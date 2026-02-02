import { useMemo } from 'react';
import { useOperationalStats } from './useOperationalStats';
import { useProductSales } from './useProductSales';
import { useVehicles } from './useVehicles';
import { isBefore, startOfDay, addDays, subDays } from 'date-fns';

interface HealthData {
  score: number;
  receiptRate: number;
  delinquencyRate: number;
  totalReceived: number;
  totalOverdue: number;
  profitMargin: number;
}

interface AlertsData {
  dueThisWeek: { count: number; amount: number };
  overdueMoreThan30Days: { count: number; amount: number };
  vehiclesOverdue: { count: number; amount: number };
  productsOverdue: { count: number; amount: number };
}

export function useDashboardHealth() {
  const { stats: opStats } = useOperationalStats();
  const { sales, isLoading: salesLoading } = useProductSales();
  const { vehicles, isLoading: vehiclesLoading } = useVehicles();

  const healthData = useMemo<HealthData>(() => {
    const totalExpected = opStats.totalReceivedAllTime + opStats.pendingAmount;
    const receiptRate = totalExpected > 0 
      ? (opStats.totalReceivedAllTime / totalExpected) * 100 
      : 100;
    
    const totalActive = opStats.activeLoansCount + opStats.paidLoansCount;
    const delinquencyRate = totalActive > 0 
      ? (opStats.overdueCount / totalActive) * 100 
      : 0;
    
    // Margem de lucro = juros recebidos / capital emprestado
    const totalCapital = opStats.totalOnStreet + opStats.totalReceivedAllTime;
    const profitMargin = totalCapital > 0 
      ? (opStats.realizedProfit / totalCapital) * 100 
      : 0;
    
    // Score: 40% taxa recebimento + 40% inadimplência inversa + 20% margem
    const receiptScore = Math.min(100, receiptRate) * 0.4;
    const delinquencyScore = Math.max(0, 100 - delinquencyRate * 2) * 0.4;
    const marginScore = Math.min(100, profitMargin * 2) * 0.2;
    const score = Math.round(receiptScore + delinquencyScore + marginScore);
    
    return {
      score,
      receiptRate,
      delinquencyRate,
      totalReceived: opStats.totalReceivedAllTime,
      totalOverdue: opStats.overdueAmount,
      profitMargin,
    };
  }, [opStats]);

  const alertsData = useMemo<AlertsData>(() => {
    const today = startOfDay(new Date());
    const nextWeek = addDays(today, 7);
    const thirtyDaysAgo = subDays(today, 30);

    // Empréstimos que vencem esta semana
    let dueThisWeekCount = 0;
    let dueThisWeekAmount = 0;

    // Empréstimos atrasados há mais de 30 dias
    let overdueMoreThan30DaysCount = 0;
    let overdueMoreThan30DaysAmount = 0;

    const activeLoans = opStats.activeLoans || [];
    activeLoans.forEach((loan) => {
      const dates = (loan.installment_dates as string[]) || [];
      const installmentValue = (loan.principal_amount + (loan.total_interest || 0)) / (dates.length || 1);
      const paidCount = installmentValue > 0 
        ? Math.floor((loan.total_paid || 0) / installmentValue) 
        : 0;

      dates.forEach((dateStr, index) => {
        if (index < paidCount) return;
        const dueDate = new Date(dateStr);
        
        // Vence esta semana
        if (dueDate >= today && dueDate <= nextWeek) {
          dueThisWeekCount++;
          dueThisWeekAmount += installmentValue;
        }
        
        // Atrasado há mais de 30 dias
        if (isBefore(dueDate, thirtyDaysAgo)) {
          overdueMoreThan30DaysCount++;
          overdueMoreThan30DaysAmount += installmentValue;
        }
      });

      // Para empréstimos de parcela única
      if (dates.length === 0) {
        const dueDate = new Date(loan.due_date);
        if (dueDate >= today && dueDate <= nextWeek) {
          dueThisWeekCount++;
          dueThisWeekAmount += loan.remaining_balance || 0;
        }
        if (isBefore(dueDate, thirtyDaysAgo)) {
          overdueMoreThan30DaysCount++;
          overdueMoreThan30DaysAmount += loan.remaining_balance || 0;
        }
      }
    });

    // Veículos em atraso
    let vehiclesOverdueCount = 0;
    let vehiclesOverdueAmount = 0;
    const vehiclesList = vehicles || [];
    vehiclesList.forEach((vehicle) => {
      if (vehicle.status === 'overdue') {
        vehiclesOverdueCount++;
        vehiclesOverdueAmount += vehicle.remaining_balance || 0;
      }
    });

    // Produtos em atraso
    let productsOverdueCount = 0;
    let productsOverdueAmount = 0;
    const salesList = sales || [];
    salesList.forEach((sale) => {
      if (sale.status === 'overdue') {
        productsOverdueCount++;
        productsOverdueAmount += sale.remaining_balance || 0;
      }
    });

    return {
      dueThisWeek: { count: dueThisWeekCount, amount: dueThisWeekAmount },
      overdueMoreThan30Days: { count: overdueMoreThan30DaysCount, amount: overdueMoreThan30DaysAmount },
      vehiclesOverdue: { count: vehiclesOverdueCount, amount: vehiclesOverdueAmount },
      productsOverdue: { count: productsOverdueCount, amount: productsOverdueAmount },
    };
  }, [opStats.activeLoans, vehicles, sales]);

  return {
    healthData,
    alertsData,
    loading: opStats.loading || salesLoading || vehiclesLoading,
  };
}
