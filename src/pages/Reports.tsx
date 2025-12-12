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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, AlertTriangle, Banknote, Package, FileText, Car, ChevronDown, Filter, Users, CheckCircle, Clock, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, subMonths, format, isWithinInterval, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

// Import new report components
import { HealthScoreCard } from '@/components/reports/HealthScoreCard';
import { PeriodFilter, PeriodType } from '@/components/reports/PeriodFilter';
import { ConsolidatedSummary } from '@/components/reports/ConsolidatedSummary';
import { AlertsCard } from '@/components/reports/AlertsCard';
import { EvolutionChart } from '@/components/reports/EvolutionChart';
import { CategoryBreakdown } from '@/components/reports/CategoryBreakdown';

// Helper component for metric cards
const MetricCard = ({ 
  label, 
  value, 
  icon: Icon, 
  iconColor = 'text-primary', 
  bgColor = 'bg-primary/10',
  valueColor = '',
  subtitle = ''
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  iconColor?: string; 
  bgColor?: string;
  valueColor?: string;
  subtitle?: string;
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
  const { contracts } = useContracts();
  const { vehicles } = useVehicles();
  const { payments: vehiclePayments } = useVehiclePayments();

  // Period filter state
  const [period, setPeriod] = useState<PeriodType>('thisMonth');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [lastUpdated] = useState<Date>(new Date());

  // Expand/collapse states for each tab
  const [showMoreLoans, setShowMoreLoans] = useState(false);
  const [showMoreProducts, setShowMoreProducts] = useState(false);
  const [showMoreContracts, setShowMoreContracts] = useState(false);
  const [showMoreVehicles, setShowMoreVehicles] = useState(false);

  // Chart filter states
  const [loanChartFilters, setLoanChartFilters] = useState({
    emprestado: true,
    juros: true,
    recebido: true,
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
  const safeVehicles = vehicles || [];
  const safeVehiclePayments = vehiclePayments || [];

  // CONSOLIDATED STATS
  const consolidatedStats = useMemo(() => {
    // Loans
    const totalLoaned = safeLoans.reduce((sum, l) => sum + l.principal_amount, 0);
    const totalLoanReceived = safeLoans.reduce((sum, l) => sum + (l.total_paid || 0), 0);
    const overdueLoansFiltered = safeLoans.filter(l => l.status === 'overdue');
    const totalLoanOverdue = overdueLoansFiltered.reduce((sum, l) => sum + l.remaining_balance, 0);

    let totalLoanInterest = 0;
    safeLoans.forEach(loan => {
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

    // Products
    const totalProductSold = safeSales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalProductCost = safeSales.reduce((sum, s) => sum + ((s as any).cost_value || 0), 0);
    const totalProductReceived = safeSales.reduce((sum, s) => sum + (s.total_paid || 0), 0);
    const overdueProducts = safeSales.filter(s => {
      return safeProductPayments.some(p => 
        p.product_sale_id === s.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
    });
    const totalProductOverdue = overdueProducts.reduce((sum, s) => sum + s.remaining_balance, 0);
    const totalProductProfit = totalProductSold - totalProductCost;

    // Contracts (receivable only for "to receive")
    const receivableContracts = safeContracts.filter(c => c.bill_type === 'receivable');
    const totalContractReceivable = receivableContracts.reduce((sum, c) => sum + c.amount_to_receive, 0);
    const totalContractReceived = receivableContracts.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount_to_receive, 0);
    const overdueContractsReceivable = receivableContracts.filter(c => c.status === 'overdue' || (c.status === 'active' && new Date(c.first_payment_date) < new Date()));
    const totalContractOverdue = overdueContractsReceivable.reduce((sum, c) => sum + c.amount_to_receive, 0);

    // Vehicles
    const totalVehicleSold = safeVehicles.reduce((sum, v) => sum + v.purchase_value, 0);
    const totalVehicleCost = safeVehicles.reduce((sum, v) => sum + ((v as any).cost_value || 0), 0);
    const totalVehicleReceived = safeVehicles.reduce((sum, v) => sum + (v.total_paid || 0), 0);
    const overdueVehiclesList = safeVehicles.filter(v => {
      return safeVehiclePayments.some(p => 
        p.vehicle_id === v.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
    });
    const totalVehicleOverdue = overdueVehiclesList.reduce((sum, v) => sum + v.remaining_balance, 0);
    const totalVehicleProfit = totalVehicleSold - totalVehicleCost;

    // Grand totals
    const totalToReceive = (totalLoaned + totalLoanInterest) + totalProductSold + totalContractReceivable + totalVehicleSold;
    const totalReceived = totalLoanReceived + totalProductReceived + totalContractReceived + totalVehicleReceived;
    const totalProfit = (totalLoanReceived - totalLoaned) + totalProductProfit + totalVehicleProfit;
    const totalOverdue = totalLoanOverdue + totalProductOverdue + totalContractOverdue + totalVehicleOverdue;

    // Health score calculation
    const receiptRate = totalToReceive > 0 ? (totalReceived / totalToReceive) * 100 : 100;
    const delinquencyRate = safeLoans.length > 0 ? (overdueLoansFiltered.length / safeLoans.length) * 100 : 0;
    const profitMargin = totalToReceive > 0 ? (totalProfit / totalToReceive) * 100 : 0;
    
    let healthScore = 100;
    healthScore -= Math.max(0, (100 - receiptRate) * 0.4);
    healthScore -= Math.min(30, delinquencyRate * 0.3);
    if (totalProfit < 0) healthScore -= 10;
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    // Alerts data
    const today = new Date();
    const nextWeek = addDays(today, 7);
    
    const dueThisWeek = {
      count: safeLoans.filter(l => {
        const dueDate = new Date(l.due_date);
        return l.status !== 'paid' && dueDate >= today && dueDate <= nextWeek;
      }).length,
      amount: safeLoans.filter(l => {
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
      paidLoansCount: safeLoans.filter(l => l.status === 'paid').length,
      totalLoansCount: safeLoans.length,
    };
  }, [safeLoans, safeSales, safeProductPayments, safeContracts, safeVehicles, safeVehiclePayments]);

  // Monthly evolution data
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
        }
        // Approximate received by checking payments
        monthReceived += (loan.total_paid || 0) / 6; // Distribute across months (approximation)
      });

      // Adjust overdue for the month
      monthOverdue = consolidatedStats.totalOverdue / 6;

      months.push({
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        received: Math.round(monthReceived),
        loaned: Math.round(monthLoaned),
        profit: Math.round(monthReceived - monthLoaned),
        overdue: Math.round(monthOverdue),
      });
    }

    return months;
  }, [safeLoans, consolidatedStats]);

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

  const overdueLoansDisplay = safeLoans.filter(l => l.status === 'overdue');
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
            {/* Health Score Card */}
            <HealthScoreCard
              score={consolidatedStats.healthScore}
              receiptRate={consolidatedStats.receiptRate}
              delinquencyRate={consolidatedStats.delinquencyRate}
              totalReceived={consolidatedStats.totalReceived}
              totalOverdue={consolidatedStats.totalOverdue}
              profitMargin={consolidatedStats.profitMargin}
            />

            {/* Consolidated Summary */}
            <ConsolidatedSummary
              totalToReceive={consolidatedStats.totalToReceive}
              totalReceived={consolidatedStats.totalReceived}
              totalProfit={consolidatedStats.totalProfit}
              totalOverdue={consolidatedStats.totalOverdue}
            />

            {/* Alerts and Category Breakdown */}
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

            {/* Evolution Chart */}
            <EvolutionChart data={monthlyEvolutionData} />
          </TabsContent>

          {/* LOANS TAB */}
          <TabsContent value="loans" className="space-y-4 mt-4">
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Emprestado"
                value={formatCurrency(consolidatedStats.totalLoaned)}
                icon={DollarSign}
                iconColor="text-primary"
                bgColor="bg-primary/10"
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

            {/* Toggle Button for More Metrics */}
            <Button
              variant="outline"
              onClick={() => setShowMoreLoans(!showMoreLoans)}
              className="w-full flex items-center justify-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showMoreLoans ? 'Ver Menos Métricas' : 'Ver Mais Métricas'}
              <ChevronDown className={cn("w-4 h-4 transition-transform", showMoreLoans && "rotate-180")} />
            </Button>

            {/* Expandable Metrics */}
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

            {/* Charts */}
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
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Distribuição</CardTitle></CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie 
                        data={[
                          { name: 'Recebido', value: consolidatedStats.totalLoanReceived },
                          { name: 'Juros Pendentes', value: Math.max(0, consolidatedStats.totalLoanInterest - (consolidatedStats.totalLoanReceived - consolidatedStats.totalLoaned)) },
                          { name: 'Em Atraso', value: consolidatedStats.totalLoanOverdue },
                        ]} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={40} 
                        outerRadius={70} 
                        paddingAngle={5} 
                        dataKey="value" 
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {[0, 1, 2].map((index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Table */}
            <Card className="shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Inadimplentes</CardTitle></CardHeader>
              <CardContent className="p-2 sm:p-6">
                {overdueLoansDisplay.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Nenhum cliente inadimplente</p>
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
                        {overdueLoansDisplay.slice(0, 10).map((loan) => (
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
                value={formatCurrency(safeSales.reduce((sum, s) => sum + s.total_amount, 0))}
                icon={Package}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
              <MetricCard
                label="Total Recebido"
                value={formatCurrency(safeSales.reduce((sum, s) => sum + (s.total_paid || 0), 0))}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <MetricCard
                label="Pendente"
                value={formatCurrency(safeSales.reduce((sum, s) => sum + s.remaining_balance, 0))}
                icon={Clock}
                iconColor="text-amber-500"
                bgColor="bg-amber-500/10"
              />
              <MetricCard
                label="Em Atraso"
                value={formatCurrency(consolidatedStats.productsOverdue.amount)}
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
                    value={formatCurrency(safeSales.reduce((sum, s) => sum + ((s as any).cost_value || 0), 0))}
                    icon={DollarSign}
                    iconColor="text-blue-500"
                    bgColor="bg-blue-500/10"
                  />
                  <MetricCard
                    label="Lucro Bruto"
                    value={formatCurrency(consolidatedStats.products.total - safeSales.reduce((sum, s) => sum + ((s as any).cost_value || 0), 0))}
                    icon={TrendingUp}
                    iconColor="text-emerald-500"
                    bgColor="bg-emerald-500/10"
                    valueColor="text-emerald-500"
                  />
                  <MetricCard
                    label="Vendas Quitadas"
                    value={safeSales.filter(s => s.status === 'paid').length}
                    icon={CheckCircle}
                    iconColor="text-success"
                    bgColor="bg-success/10"
                    subtitle={`de ${safeSales.length} total`}
                  />
                  <MetricCard
                    label="Total Vendas"
                    value={safeSales.length}
                    icon={Package}
                    iconColor="text-primary"
                    bgColor="bg-primary/10"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* VEHICLES TAB */}
          <TabsContent value="vehicles" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Vendido"
                value={formatCurrency(safeVehicles.reduce((sum, v) => sum + v.purchase_value, 0))}
                icon={Car}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
              <MetricCard
                label="Total Recebido"
                value={formatCurrency(safeVehicles.reduce((sum, v) => sum + (v.total_paid || 0), 0))}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <MetricCard
                label="Pendente"
                value={formatCurrency(safeVehicles.reduce((sum, v) => sum + v.remaining_balance, 0))}
                icon={Clock}
                iconColor="text-amber-500"
                bgColor="bg-amber-500/10"
              />
              <MetricCard
                label="Em Atraso"
                value={formatCurrency(consolidatedStats.vehiclesOverdue.amount)}
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
                    value={formatCurrency(safeVehicles.reduce((sum, v) => sum + ((v as any).cost_value || 0), 0))}
                    icon={DollarSign}
                    iconColor="text-blue-500"
                    bgColor="bg-blue-500/10"
                  />
                  <MetricCard
                    label="Lucro Bruto"
                    value={formatCurrency(consolidatedStats.vehicles.total - safeVehicles.reduce((sum, v) => sum + ((v as any).cost_value || 0), 0))}
                    icon={TrendingUp}
                    iconColor="text-emerald-500"
                    bgColor="bg-emerald-500/10"
                    valueColor="text-emerald-500"
                  />
                  <MetricCard
                    label="Veículos Quitados"
                    value={safeVehicles.filter(v => v.status === 'paid').length}
                    icon={CheckCircle}
                    iconColor="text-success"
                    bgColor="bg-success/10"
                    subtitle={`de ${safeVehicles.length} total`}
                  />
                  <MetricCard
                    label="Total Veículos"
                    value={safeVehicles.length}
                    icon={Car}
                    iconColor="text-primary"
                    bgColor="bg-primary/10"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
