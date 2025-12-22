import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLoans } from '@/hooks/useLoans';
import { useProductSales, useProductSalePayments } from '@/hooks/useProductSales';
import { useContracts } from '@/hooks/useContracts';
import { useVehicles, useVehiclePayments } from '@/hooks/useVehicles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/calculations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, AlertTriangle, Banknote, Package, Car, ChevronDown, Filter, Users, CheckCircle, Clock, Percent, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, subMonths, format, isWithinInterval, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { HealthScoreCard } from '@/components/reports/HealthScoreCard';
import { PeriodFilter, PeriodType } from '@/components/reports/PeriodFilter';
import { ConsolidatedSummary } from '@/components/reports/ConsolidatedSummary';
import { AlertsCard } from '@/components/reports/AlertsCard';
import { EvolutionChart } from '@/components/reports/EvolutionChart';
import { CategoryBreakdown } from '@/components/reports/CategoryBreakdown';

// Helper component for metric cards with variation
const MetricCard = ({ 
  label, 
  value, 
  icon: Icon, 
  iconColor = 'text-primary', 
  bgColor = 'bg-primary/10',
  valueColor = '',
  subtitle = '',
  variation,
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  iconColor?: string; 
  bgColor?: string;
  valueColor?: string;
  subtitle?: string;
  variation?: number;
}) => (
  <Card className="shadow-soft">
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={`p-2 sm:p-3 rounded-xl ${bgColor} shrink-0`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{label}</p>
          <p className={`text-sm sm:text-lg font-bold truncate ${valueColor}`}>{value}</p>
          {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>}
          {variation !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-[10px]",
              variation >= 0 ? "text-emerald-500" : "text-destructive"
            )}>
              {variation >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{variation >= 0 ? '+' : ''}{variation.toFixed(1)}% vs anterior</span>
            </div>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

// Chart filter button component
const ChartFilterButton = ({ 
  label, 
  active, 
  onClick, 
  color 
}: { 
  label: string; 
  active: boolean; 
  onClick: () => void; 
  color: string;
}) => (
  <Button
    variant={active ? "default" : "outline"}
    size="sm"
    onClick={onClick}
    className={cn(
      "text-xs h-7 px-2",
      active && color
    )}
  >
    {label}
  </Button>
);

export default function Reports() {
  const [activeTab, setActiveTab] = useState('overview');
  const { loans } = useLoans();
  const { sales } = useProductSales();
  const { payments: productPayments } = useProductSalePayments();
  const { contracts, allContractPayments } = useContracts();
  const { vehicles } = useVehicles();
  const { payments: vehiclePayments } = useVehiclePayments();

  // Period filter state
  const [period, setPeriod] = useState<PeriodType>('custom');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [lastUpdated] = useState<Date>(new Date());

  // Expand/collapse states for each tab
  const [showMoreLoans, setShowMoreLoans] = useState(false);
  const [showMoreProducts, setShowMoreProducts] = useState(false);
  const [showMoreVehicles, setShowMoreVehicles] = useState(false);

  // Chart filter states
  const [loanChartFilters, setLoanChartFilters] = useState({
    emprestado: true,
    juros: true,
    recebido: true,
    atraso: true
  });
  const [productChartFilters, setProductChartFilters] = useState({
    vendido: true,
    custo: true,
    lucro: true,
    atraso: true
  });
  const [vehicleChartFilters, setVehicleChartFilters] = useState({
    vendido: true,
    custo: true,
    lucro: true,
    atraso: true
  });

  const handlePeriodChange = (newPeriod: PeriodType, newStartDate: Date, newEndDate: Date) => {
    setPeriod(newPeriod);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const handleExport = () => {
    toast.info('Exportação em desenvolvimento', {
      description: 'Esta funcionalidade estará disponível em breve.'
    });
  };

  // Safe arrays with fallbacks for initial loading
  const safeLoans = loans || [];
  const safeSales = sales || [];
  const safeProductPayments = productPayments || [];
  const safeContracts = contracts || [];
  const safeContractPayments = allContractPayments || [];
  const safeVehicles = vehicles || [];
  const safeVehiclePayments = vehiclePayments || [];

  // Calculate previous period dates for comparison
  const periodDuration = differenceInDays(endDate, startDate);
  const prevEndDate = subMonths(startDate, 0);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevStartDate = new Date(prevEndDate);
  prevStartDate.setDate(prevStartDate.getDate() - periodDuration);

  // FILTERED DATA BY PERIOD
  const filteredLoans = useMemo(() => {
    return safeLoans.filter(loan => {
      const loanDate = new Date(loan.start_date);
      return isWithinInterval(loanDate, { start: startDate, end: endDate });
    });
  }, [safeLoans, startDate, endDate]);

  const prevPeriodLoans = useMemo(() => {
    return safeLoans.filter(loan => {
      const loanDate = new Date(loan.start_date);
      return isWithinInterval(loanDate, { start: prevStartDate, end: prevEndDate });
    });
  }, [safeLoans, prevStartDate, prevEndDate]);

  const filteredSales = useMemo(() => {
    return safeSales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      return isWithinInterval(saleDate, { start: startDate, end: endDate });
    });
  }, [safeSales, startDate, endDate]);

  const prevPeriodSales = useMemo(() => {
    return safeSales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      return isWithinInterval(saleDate, { start: prevStartDate, end: prevEndDate });
    });
  }, [safeSales, prevStartDate, prevEndDate]);

  const filteredVehicles = useMemo(() => {
    return safeVehicles.filter(vehicle => {
      const vehicleDate = new Date(vehicle.created_at);
      return isWithinInterval(vehicleDate, { start: startDate, end: endDate });
    });
  }, [safeVehicles, startDate, endDate]);

  const prevPeriodVehicles = useMemo(() => {
    return safeVehicles.filter(vehicle => {
      const vehicleDate = new Date(vehicle.created_at);
      return isWithinInterval(vehicleDate, { start: prevStartDate, end: prevEndDate });
    });
  }, [safeVehicles, prevStartDate, prevEndDate]);

  const filteredContracts = useMemo(() => {
    return safeContracts.filter(contract => {
      const contractDate = new Date(contract.created_at);
      return isWithinInterval(contractDate, { start: startDate, end: endDate });
    });
  }, [safeContracts, startDate, endDate]);

  // CONSOLIDATED STATS (using filtered data)
  const consolidatedStats = useMemo(() => {
    // Loans
    const totalLoaned = filteredLoans.reduce((sum, l) => sum + l.principal_amount, 0);
    const totalLoanReceived = filteredLoans.reduce((sum, l) => sum + (l.total_paid || 0), 0);
    const overdueLoansFiltered = filteredLoans.filter(l => l.status === 'overdue');
    const totalLoanOverdue = overdueLoansFiltered.reduce((sum, l) => sum + l.remaining_balance, 0);

    let totalLoanInterest = 0;
    filteredLoans.forEach(loan => {
      const isDaily = loan.payment_type === 'daily';
      if (isDaily) {
        totalLoanInterest += loan.interest_rate || 0;
      } else {
        if (loan.interest_mode === 'on_total') {
          totalLoanInterest += loan.principal_amount * (loan.interest_rate / 100);
        } else {
          totalLoanInterest += loan.principal_amount * (loan.interest_rate / 100) * (loan.installments || 1);
        }
      }
    });

    // Previous period loans for comparison
    const prevTotalLoaned = prevPeriodLoans.reduce((sum, l) => sum + l.principal_amount, 0);
    const loanedVariation = prevTotalLoaned > 0 ? ((totalLoaned - prevTotalLoaned) / prevTotalLoaned) * 100 : 0;

    // Products
    const totalProductSold = filteredSales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalProductCost = filteredSales.reduce((sum, s) => sum + ((s as any).cost_value || 0), 0);
    const totalProductReceived = filteredSales.reduce((sum, s) => sum + (s.total_paid || 0), 0);
    const overdueProducts = filteredSales.filter(s => {
      return safeProductPayments.some(p => 
        p.product_sale_id === s.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
    });
    const totalProductOverdue = overdueProducts.reduce((sum, s) => sum + s.remaining_balance, 0);
    const totalProductProfit = totalProductSold - totalProductCost;

    // Previous period products
    const prevTotalProductSold = prevPeriodSales.reduce((sum, s) => sum + s.total_amount, 0);
    const productSoldVariation = prevTotalProductSold > 0 ? ((totalProductSold - prevTotalProductSold) / prevTotalProductSold) * 100 : 0;

    // Contracts (receivable only for "to receive") - Agora calculando com base nos pagamentos reais
    const receivableContracts = filteredContracts.filter(c => c.bill_type === 'receivable');
    const receivableContractIds = new Set(receivableContracts.map(c => c.id));
    
    // Filtrar pagamentos apenas dos contratos a receber
    const receivableContractPayments = safeContractPayments.filter(p => receivableContractIds.has(p.contract_id));
    
    // Total a receber = soma de todos os pagamentos pendentes + pagos
    const totalContractReceivable = receivableContractPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Total recebido = soma apenas dos pagamentos com status 'paid'
    const totalContractReceived = receivableContractPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Total em atraso = soma dos pagamentos pendentes com data de vencimento no passado
    const today = new Date();
    const overdueContractPayments = receivableContractPayments.filter(p => 
      p.status === 'pending' && new Date(p.due_date) < today
    );
    const totalContractOverdue = overdueContractPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Contratos com parcelas em atraso (para contagem)
    const contractsWithOverdue = new Set(overdueContractPayments.map(p => p.contract_id));
    const overdueContractsReceivable = receivableContracts.filter(c => contractsWithOverdue.has(c.id));

    // Vehicles
    const totalVehicleSold = filteredVehicles.reduce((sum, v) => sum + v.purchase_value, 0);
    const totalVehicleCost = filteredVehicles.reduce((sum, v) => sum + ((v as any).cost_value || 0), 0);
    const totalVehicleReceived = filteredVehicles.reduce((sum, v) => sum + (v.total_paid || 0), 0);
    const overdueVehiclesList = filteredVehicles.filter(v => {
      return safeVehiclePayments.some(p => 
        p.vehicle_id === v.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
    });
    const totalVehicleOverdue = overdueVehiclesList.reduce((sum, v) => sum + v.remaining_balance, 0);
    const totalVehicleProfit = totalVehicleSold - totalVehicleCost;

    // Previous period vehicles
    const prevTotalVehicleSold = prevPeriodVehicles.reduce((sum, v) => sum + v.purchase_value, 0);
    const vehicleSoldVariation = prevTotalVehicleSold > 0 ? ((totalVehicleSold - prevTotalVehicleSold) / prevTotalVehicleSold) * 100 : 0;

    // Grand totals
    const totalToReceive = (totalLoaned + totalLoanInterest) + totalProductSold + totalContractReceivable + totalVehicleSold;
    const totalReceived = totalLoanReceived + totalProductReceived + totalContractReceived + totalVehicleReceived;
    const totalProfit = (totalLoanReceived - totalLoaned) + totalProductProfit + totalVehicleProfit;
    const totalOverdue = totalLoanOverdue + totalProductOverdue + totalContractOverdue + totalVehicleOverdue;

    // Health score calculation
    const receiptRate = totalToReceive > 0 ? (totalReceived / totalToReceive) * 100 : 100;
    const delinquencyRate = filteredLoans.length > 0 ? (overdueLoansFiltered.length / filteredLoans.length) * 100 : 0;
    const profitMargin = totalToReceive > 0 ? (totalProfit / totalToReceive) * 100 : 0;
    
    let healthScore = 100;
    healthScore -= Math.max(0, (100 - receiptRate) * 0.4);
    healthScore -= Math.min(30, delinquencyRate * 0.3);
    if (totalProfit < 0) healthScore -= 10;
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    // Alerts data
    const nextWeek = addDays(today, 7);
    
    const dueThisWeek = {
      count: filteredLoans.filter(l => {
        const dueDate = new Date(l.due_date);
        return l.status !== 'paid' && dueDate >= today && dueDate <= nextWeek;
      }).length,
      amount: filteredLoans.filter(l => {
        const dueDate = new Date(l.due_date);
        return l.status !== 'paid' && dueDate >= today && dueDate <= nextWeek;
      }).reduce((sum, l) => sum + l.remaining_balance, 0)
    };

    const overdueMoreThan30Days = {
      count: overdueLoansFiltered.filter(l => differenceInDays(today, new Date(l.due_date)) > 30).length,
      amount: overdueLoansFiltered.filter(l => differenceInDays(today, new Date(l.due_date)) > 30)
        .reduce((sum, l) => sum + l.remaining_balance, 0)
    };

    return {
      totalToReceive,
      totalReceived,
      totalProfit,
      totalOverdue,
      receiptRate,
      delinquencyRate,
      profitMargin,
      healthScore,
      dueThisWeek,
      overdueMoreThan30Days,
      vehiclesOverdue: { count: overdueVehiclesList.length, amount: totalVehicleOverdue },
      productsOverdue: { count: overdueProducts.length, amount: totalProductOverdue },
      // Category breakdown
      loans: { total: totalLoaned + totalLoanInterest, received: totalLoanReceived, overdue: totalLoanOverdue },
      products: { total: totalProductSold, received: totalProductReceived, overdue: totalProductOverdue },
      contracts: { total: totalContractReceivable, received: totalContractReceived, overdue: totalContractOverdue },
      vehicles: { total: totalVehicleSold, received: totalVehicleReceived, overdue: totalVehicleOverdue },
      // Loan specific
      totalLoaned,
      totalLoanReceived,
      totalLoanInterest,
      totalLoanOverdue,
      overdueLoansCount: overdueLoansFiltered.length,
      paidLoansCount: filteredLoans.filter(l => l.status === 'paid').length,
      totalLoansCount: filteredLoans.length,
      loanedVariation,
      // Product specific
      totalProductSold,
      totalProductCost,
      totalProductReceived,
      totalProductOverdue,
      totalProductProfit,
      productSoldVariation,
      overdueProductsCount: overdueProducts.length,
      paidProductsCount: filteredSales.filter(s => s.status === 'paid').length,
      totalProductsCount: filteredSales.length,
      // Vehicle specific
      totalVehicleSold,
      totalVehicleCost,
      totalVehicleReceived,
      totalVehicleOverdue,
      totalVehicleProfit,
      vehicleSoldVariation,
      overdueVehiclesCount: overdueVehiclesList.length,
      paidVehiclesCount: filteredVehicles.filter(v => v.status === 'paid').length,
      totalVehiclesCount: filteredVehicles.length,
      // Overdue lists for tables
      overdueLoansFiltered,
      overdueProducts,
      overdueVehiclesList,
    };
  }, [filteredLoans, filteredSales, filteredVehicles, filteredContracts, safeProductPayments, safeVehiclePayments, prevPeriodLoans, prevPeriodSales, prevPeriodVehicles]);

  // Monthly evolution data for charts
  const monthlyEvolutionData = useMemo(() => {
    const months: { month: string; received: number; loaned: number; profit: number; overdue: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, 'MMM', { locale: ptBR });

      let monthReceived = 0;
      let monthLoaned = 0;
      let monthOverdue = 0;

      safeLoans.forEach(loan => {
        const loanDate = new Date(loan.start_date);
        if (isWithinInterval(loanDate, { start: monthStart, end: monthEnd })) {
          monthLoaned += loan.principal_amount;
          monthReceived += loan.total_paid || 0;
          if (loan.status === 'overdue') {
            monthOverdue += loan.remaining_balance;
          }
        }
      });

      months.push({
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        received: Math.round(monthReceived),
        loaned: Math.round(monthLoaned),
        profit: Math.round(monthReceived - monthLoaned),
        overdue: Math.round(monthOverdue),
      });
    }

    return months;
  }, [safeLoans]);

  // Loan chart data
  const loanChartData = useMemo(() => {
    const allData = [
      { name: 'Emprestado', value: consolidatedStats.totalLoaned, fill: 'hsl(var(--chart-1))', key: 'emprestado' },
      { name: 'Juros', value: consolidatedStats.totalLoanInterest, fill: 'hsl(var(--chart-4))', key: 'juros' },
      { name: 'Recebido', value: consolidatedStats.totalLoanReceived, fill: 'hsl(var(--chart-2))', key: 'recebido' },
      { name: 'Em Atraso', value: consolidatedStats.totalLoanOverdue, fill: 'hsl(var(--chart-3))', key: 'atraso' },
    ];
    return allData.filter(item => loanChartFilters[item.key as keyof typeof loanChartFilters]);
  }, [consolidatedStats, loanChartFilters]);

  // Product chart data
  const productChartData = useMemo(() => {
    const allData = [
      { name: 'Vendido', value: consolidatedStats.totalProductSold, fill: 'hsl(var(--chart-1))', key: 'vendido' },
      { name: 'Custo', value: consolidatedStats.totalProductCost, fill: 'hsl(var(--chart-4))', key: 'custo' },
      { name: 'Lucro', value: consolidatedStats.totalProductProfit, fill: 'hsl(var(--chart-2))', key: 'lucro' },
      { name: 'Em Atraso', value: consolidatedStats.totalProductOverdue, fill: 'hsl(var(--chart-3))', key: 'atraso' },
    ];
    return allData.filter(item => productChartFilters[item.key as keyof typeof productChartFilters]);
  }, [consolidatedStats, productChartFilters]);

  // Vehicle chart data
  const vehicleChartData = useMemo(() => {
    const allData = [
      { name: 'Vendido', value: consolidatedStats.totalVehicleSold, fill: 'hsl(var(--chart-1))', key: 'vendido' },
      { name: 'Custo', value: consolidatedStats.totalVehicleCost, fill: 'hsl(var(--chart-4))', key: 'custo' },
      { name: 'Lucro', value: consolidatedStats.totalVehicleProfit, fill: 'hsl(var(--chart-2))', key: 'lucro' },
      { name: 'Em Atraso', value: consolidatedStats.totalVehicleOverdue, fill: 'hsl(var(--chart-3))', key: 'atraso' },
    ];
    return allData.filter(item => vehicleChartFilters[item.key as keyof typeof vehicleChartFilters]);
  }, [consolidatedStats, vehicleChartFilters]);

  // Monthly product evolution data
  const monthlyProductData = useMemo(() => {
    const months: { month: string; vendido: number; custo: number; lucro: number; atraso: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, 'MMM', { locale: ptBR });

      let monthSold = 0;
      let monthCost = 0;
      let monthOverdue = 0;

      safeSales.forEach(sale => {
        const saleDate = new Date(sale.created_at);
        if (isWithinInterval(saleDate, { start: monthStart, end: monthEnd })) {
          monthSold += sale.total_amount;
          monthCost += (sale as any).cost_value || 0;
          if (sale.status === 'overdue') {
            monthOverdue += sale.remaining_balance;
          }
        }
      });

      months.push({
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        vendido: Math.round(monthSold),
        custo: Math.round(monthCost),
        lucro: Math.round(monthSold - monthCost),
        atraso: Math.round(monthOverdue),
      });
    }

    return months;
  }, [safeSales]);

  // Monthly vehicle evolution data
  const monthlyVehicleData = useMemo(() => {
    const months: { month: string; vendido: number; custo: number; lucro: number; atraso: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, 'MMM', { locale: ptBR });

      let monthSold = 0;
      let monthCost = 0;
      let monthOverdue = 0;

      safeVehicles.forEach(vehicle => {
        const vehicleDate = new Date(vehicle.created_at);
        if (isWithinInterval(vehicleDate, { start: monthStart, end: monthEnd })) {
          monthSold += vehicle.purchase_value;
          monthCost += (vehicle as any).cost_value || 0;
          if (vehicle.status === 'overdue') {
            monthOverdue += vehicle.remaining_balance;
          }
        }
      });

      months.push({
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        vendido: Math.round(monthSold),
        custo: Math.round(monthCost),
        lucro: Math.round(monthSold - monthCost),
        atraso: Math.round(monthOverdue),
      });
    }

    return months;
  }, [safeVehicles]);

  const COLORS = ['hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-3))'];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise financeira e saúde da sua operação</p>
        </div>

        {/* Period Filter */}
        <PeriodFilter
          period={period}
          startDate={startDate}
          endDate={endDate}
          onPeriodChange={handlePeriodChange}
          onExport={handleExport}
          lastUpdated={lastUpdated}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto flex flex-wrap w-full gap-1 p-1">
            <TabsTrigger value="overview" className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span className="truncate">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="loans" className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Banknote className="w-4 h-4 shrink-0" />
              <span className="truncate">Empréstimos</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Package className="w-4 h-4 shrink-0" />
              <span className="truncate">Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Car className="w-4 h-4 shrink-0" />
              <span className="truncate">Veículos</span>
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <HealthScoreCard
              score={consolidatedStats.healthScore}
              receiptRate={consolidatedStats.receiptRate}
              delinquencyRate={consolidatedStats.delinquencyRate}
              totalReceived={consolidatedStats.totalReceived}
              totalOverdue={consolidatedStats.totalOverdue}
              profitMargin={consolidatedStats.profitMargin}
            />

            <ConsolidatedSummary
              totalToReceive={consolidatedStats.totalToReceive}
              totalReceived={consolidatedStats.totalReceived}
              totalProfit={consolidatedStats.totalProfit}
              totalOverdue={consolidatedStats.totalOverdue}
            />

            <div className="grid lg:grid-cols-2 gap-4">
              <AlertsCard
                dueThisWeek={consolidatedStats.dueThisWeek}
                overdueMoreThan30Days={consolidatedStats.overdueMoreThan30Days}
                vehiclesOverdue={consolidatedStats.vehiclesOverdue}
                productsOverdue={consolidatedStats.productsOverdue}
              />
              <CategoryBreakdown
                loans={consolidatedStats.loans}
                products={consolidatedStats.products}
                contracts={consolidatedStats.contracts}
                vehicles={consolidatedStats.vehicles}
              />
            </div>

            <EvolutionChart data={monthlyEvolutionData} />
          </TabsContent>

          {/* LOANS TAB */}
          <TabsContent value="loans" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Emprestado"
                value={formatCurrency(consolidatedStats.totalLoaned)}
                icon={DollarSign}
                iconColor="text-primary"
                bgColor="bg-primary/10"
                variation={consolidatedStats.loanedVariation}
              />
              <MetricCard
                label="Total Recebido"
                value={formatCurrency(consolidatedStats.totalLoanReceived)}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <MetricCard
                label="Total em Atraso"
                value={formatCurrency(consolidatedStats.totalLoanOverdue)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                valueColor="text-destructive"
              />
              <MetricCard
                label="Juros a Receber"
                value={formatCurrency(consolidatedStats.totalLoanInterest)}
                icon={TrendingUp}
                iconColor="text-amber-500"
                bgColor="bg-amber-500/10"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setShowMoreLoans(!showMoreLoans)}
              className="w-full flex items-center justify-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showMoreLoans ? 'Ver Menos Métricas' : 'Ver Mais Métricas'}
              <ChevronDown className={cn("w-4 h-4 transition-transform", showMoreLoans && "rotate-180")} />
            </Button>

            <AnimatePresence>
              {showMoreLoans && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 overflow-hidden"
                >
                  <MetricCard
                    label="Inadimplentes"
                    value={consolidatedStats.overdueLoansCount}
                    icon={Users}
                    iconColor="text-destructive"
                    bgColor="bg-destructive/10"
                    valueColor="text-destructive"
                  />
                  <MetricCard
                    label="Quitados"
                    value={consolidatedStats.paidLoansCount}
                    icon={CheckCircle}
                    iconColor="text-success"
                    bgColor="bg-success/10"
                    subtitle={`de ${consolidatedStats.totalLoansCount} total`}
                  />
                  <MetricCard
                    label="% Inadimplência"
                    value={`${consolidatedStats.delinquencyRate.toFixed(1)}%`}
                    icon={Percent}
                    iconColor={consolidatedStats.delinquencyRate > 20 ? 'text-destructive' : 'text-amber-500'}
                    bgColor={consolidatedStats.delinquencyRate > 20 ? 'bg-destructive/10' : 'bg-amber-500/10'}
                  />
                  <MetricCard
                    label="Total Empréstimos"
                    value={consolidatedStats.totalLoansCount}
                    icon={Banknote}
                    iconColor="text-primary"
                    bgColor="bg-primary/10"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg">Resumo Financeiro</CardTitle>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <ChartFilterButton label="Emprestado" active={loanChartFilters.emprestado} onClick={() => setLoanChartFilters(f => ({ ...f, emprestado: !f.emprestado }))} color="bg-chart-1" />
                    <ChartFilterButton label="Juros" active={loanChartFilters.juros} onClick={() => setLoanChartFilters(f => ({ ...f, juros: !f.juros }))} color="bg-chart-4" />
                    <ChartFilterButton label="Recebido" active={loanChartFilters.recebido} onClick={() => setLoanChartFilters(f => ({ ...f, recebido: !f.recebido }))} color="bg-chart-2" />
                    <ChartFilterButton label="Atraso" active={loanChartFilters.atraso} onClick={() => setLoanChartFilters(f => ({ ...f, atraso: !f.atraso }))} color="bg-chart-3" />
                  </div>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={loanChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg">Evolução Mensal</CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={monthlyEvolutionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend />
                      <Line type="monotone" dataKey="loaned" name="Emprestado" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                      <Line type="monotone" dataKey="received" name="Recebido" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Inadimplentes no Período</CardTitle></CardHeader>
              <CardContent className="p-2 sm:p-6">
                {consolidatedStats.overdueLoansFiltered.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Nenhum cliente inadimplente no período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Valor</TableHead>
                          <TableHead className="text-xs">Saldo</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Venc.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consolidatedStats.overdueLoansFiltered.slice(0, 10).map((loan) => (
                          <TableRow key={loan.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{loan.client?.full_name}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{formatCurrency(loan.principal_amount)}</TableCell>
                            <TableCell className="font-semibold text-destructive text-xs sm:text-sm">{formatCurrency(loan.remaining_balance)}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{formatDate(loan.due_date)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRODUCTS TAB */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Vendido"
                value={formatCurrency(consolidatedStats.totalProductSold)}
                icon={Package}
                iconColor="text-primary"
                bgColor="bg-primary/10"
                variation={consolidatedStats.productSoldVariation}
              />
              <MetricCard
                label="Total Recebido"
                value={formatCurrency(consolidatedStats.totalProductReceived)}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <MetricCard
                label="Lucro Bruto"
                value={formatCurrency(consolidatedStats.totalProductProfit)}
                icon={TrendingUp}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                valueColor="text-emerald-500"
              />
              <MetricCard
                label="Em Atraso"
                value={formatCurrency(consolidatedStats.totalProductOverdue)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                valueColor="text-destructive"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setShowMoreProducts(!showMoreProducts)}
              className="w-full flex items-center justify-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showMoreProducts ? 'Ver Menos Métricas' : 'Ver Mais Métricas'}
              <ChevronDown className={cn("w-4 h-4 transition-transform", showMoreProducts && "rotate-180")} />
            </Button>

            <AnimatePresence>
              {showMoreProducts && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 overflow-hidden"
                >
                  <MetricCard
                    label="Custo Total"
                    value={formatCurrency(consolidatedStats.totalProductCost)}
                    icon={DollarSign}
                    iconColor="text-blue-500"
                    bgColor="bg-blue-500/10"
                  />
                  <MetricCard
                    label="Pendente"
                    value={formatCurrency(filteredSales.reduce((sum, s) => sum + s.remaining_balance, 0))}
                    icon={Clock}
                    iconColor="text-amber-500"
                    bgColor="bg-amber-500/10"
                  />
                  <MetricCard
                    label="Vendas Quitadas"
                    value={consolidatedStats.paidProductsCount}
                    icon={CheckCircle}
                    iconColor="text-success"
                    bgColor="bg-success/10"
                    subtitle={`de ${consolidatedStats.totalProductsCount} total`}
                  />
                  <MetricCard
                    label="Total Vendas"
                    value={consolidatedStats.totalProductsCount}
                    icon={Package}
                    iconColor="text-primary"
                    bgColor="bg-primary/10"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg">Resumo Financeiro</CardTitle>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <ChartFilterButton label="Vendido" active={productChartFilters.vendido} onClick={() => setProductChartFilters(f => ({ ...f, vendido: !f.vendido }))} color="bg-chart-1" />
                    <ChartFilterButton label="Custo" active={productChartFilters.custo} onClick={() => setProductChartFilters(f => ({ ...f, custo: !f.custo }))} color="bg-chart-4" />
                    <ChartFilterButton label="Lucro" active={productChartFilters.lucro} onClick={() => setProductChartFilters(f => ({ ...f, lucro: !f.lucro }))} color="bg-chart-2" />
                    <ChartFilterButton label="Atraso" active={productChartFilters.atraso} onClick={() => setProductChartFilters(f => ({ ...f, atraso: !f.atraso }))} color="bg-chart-3" />
                  </div>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={productChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg">Evolução Mensal</CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={monthlyProductData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend />
                      <Line type="monotone" dataKey="vendido" name="Vendido" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                      <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Vendas em Atraso no Período</CardTitle></CardHeader>
              <CardContent className="p-2 sm:p-6">
                {consolidatedStats.overdueProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Nenhuma venda em atraso no período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs">Produto</TableHead>
                          <TableHead className="text-xs">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consolidatedStats.overdueProducts.slice(0, 10).map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{sale.client_name}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{sale.product_name}</TableCell>
                            <TableCell className="font-semibold text-destructive text-xs sm:text-sm">{formatCurrency(sale.remaining_balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VEHICLES TAB */}
          <TabsContent value="vehicles" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Vendido"
                value={formatCurrency(consolidatedStats.totalVehicleSold)}
                icon={Car}
                iconColor="text-primary"
                bgColor="bg-primary/10"
                variation={consolidatedStats.vehicleSoldVariation}
              />
              <MetricCard
                label="Total Recebido"
                value={formatCurrency(consolidatedStats.totalVehicleReceived)}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <MetricCard
                label="Lucro Bruto"
                value={formatCurrency(consolidatedStats.totalVehicleProfit)}
                icon={TrendingUp}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                valueColor="text-emerald-500"
              />
              <MetricCard
                label="Em Atraso"
                value={formatCurrency(consolidatedStats.totalVehicleOverdue)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                valueColor="text-destructive"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setShowMoreVehicles(!showMoreVehicles)}
              className="w-full flex items-center justify-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showMoreVehicles ? 'Ver Menos Métricas' : 'Ver Mais Métricas'}
              <ChevronDown className={cn("w-4 h-4 transition-transform", showMoreVehicles && "rotate-180")} />
            </Button>

            <AnimatePresence>
              {showMoreVehicles && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 overflow-hidden"
                >
                  <MetricCard
                    label="Custo Total"
                    value={formatCurrency(consolidatedStats.totalVehicleCost)}
                    icon={DollarSign}
                    iconColor="text-blue-500"
                    bgColor="bg-blue-500/10"
                  />
                  <MetricCard
                    label="Pendente"
                    value={formatCurrency(filteredVehicles.reduce((sum, v) => sum + v.remaining_balance, 0))}
                    icon={Clock}
                    iconColor="text-amber-500"
                    bgColor="bg-amber-500/10"
                  />
                  <MetricCard
                    label="Veículos Quitados"
                    value={consolidatedStats.paidVehiclesCount}
                    icon={CheckCircle}
                    iconColor="text-success"
                    bgColor="bg-success/10"
                    subtitle={`de ${consolidatedStats.totalVehiclesCount} total`}
                  />
                  <MetricCard
                    label="Total Veículos"
                    value={consolidatedStats.totalVehiclesCount}
                    icon={Car}
                    iconColor="text-primary"
                    bgColor="bg-primary/10"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg">Resumo Financeiro</CardTitle>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <ChartFilterButton label="Vendido" active={vehicleChartFilters.vendido} onClick={() => setVehicleChartFilters(f => ({ ...f, vendido: !f.vendido }))} color="bg-chart-1" />
                    <ChartFilterButton label="Custo" active={vehicleChartFilters.custo} onClick={() => setVehicleChartFilters(f => ({ ...f, custo: !f.custo }))} color="bg-chart-4" />
                    <ChartFilterButton label="Lucro" active={vehicleChartFilters.lucro} onClick={() => setVehicleChartFilters(f => ({ ...f, lucro: !f.lucro }))} color="bg-chart-2" />
                    <ChartFilterButton label="Atraso" active={vehicleChartFilters.atraso} onClick={() => setVehicleChartFilters(f => ({ ...f, atraso: !f.atraso }))} color="bg-chart-3" />
                  </div>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={vehicleChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg">Evolução Mensal</CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={monthlyVehicleData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend />
                      <Line type="monotone" dataKey="vendido" name="Vendido" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                      <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Veículos em Atraso no Período</CardTitle></CardHeader>
              <CardContent className="p-2 sm:p-6">
                {consolidatedStats.overdueVehiclesList.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Nenhum veículo em atraso no período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Comprador</TableHead>
                          <TableHead className="text-xs">Veículo</TableHead>
                          <TableHead className="text-xs">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consolidatedStats.overdueVehiclesList.slice(0, 10).map((vehicle) => (
                          <TableRow key={vehicle.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{vehicle.buyer_name || 'Sem comprador'}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{vehicle.brand} {vehicle.model}</TableCell>
                            <TableCell className="font-semibold text-destructive text-xs sm:text-sm">{formatCurrency(vehicle.remaining_balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
