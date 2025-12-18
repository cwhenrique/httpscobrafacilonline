import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useOperationalStats } from '@/hooks/useOperationalStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency, formatDate } from '@/lib/calculations';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Banknote, 
  CheckCircle, 
  Clock,
  RefreshCw,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CalendarIcon,
  PiggyBank,
  Calendar as CalendarDays,
  CalendarRange,
  CalendarCheck
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from 'react-day-picker';

// Stat Card Component
const StatCard = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  bgColor = 'bg-primary/10',
  subtitle,
  trend,
  compact = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor?: string;
  bgColor?: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  compact?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="border-primary/30 bg-card shadow-lg hover:shadow-xl transition-shadow h-full">
      <CardContent className={cn("p-3 sm:p-4", compact && "p-2 sm:p-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={cn("p-2 sm:p-3 rounded-xl shrink-0", bgColor)}>
              <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{label}</p>
              <p className={cn("text-sm sm:text-lg lg:text-xl font-bold mt-0.5", compact && "text-xs sm:text-base")}>{value}</p>
              {subtitle && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
              trend === 'up' && "bg-emerald-500/10 text-emerald-500",
              trend === 'down' && "bg-destructive/10 text-destructive",
              trend === 'neutral' && "bg-muted text-muted-foreground"
            )}>
              {trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
              {trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

// Loading skeleton
const StatCardSkeleton = () => (
  <Card className="border-primary/30">
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16 sm:w-20" />
          <Skeleton className="h-5 w-20 sm:w-24" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function ReportsLoans() {
  const { stats, refetch } = useOperationalStats();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 6),
    to: new Date(),
  });
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');

  // Payment type labels
  const paymentTypeLabels: Record<string, string> = {
    all: 'Todos',
    daily: 'Diário',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    installment: 'Mensal',
    single: 'Único',
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Filter loans by date range and payment type
  const filteredLoans = useMemo(() => {
    let loans = stats.allLoans;
    
    // Filter by date range
    if (dateRange?.from && dateRange?.to) {
      loans = loans.filter(loan => {
        const loanDate = new Date(loan.start_date);
        return isWithinInterval(loanDate, { start: dateRange.from!, end: dateRange.to! });
      });
    }
    
    // Filter by payment type
    if (paymentTypeFilter !== 'all') {
      loans = loans.filter(loan => loan.payment_type === paymentTypeFilter);
    }
    
    return loans;
  }, [stats.allLoans, dateRange, paymentTypeFilter]);

  // Stats by payment type (for the type cards)
  const statsByPaymentType = useMemo(() => {
    const types = ['daily', 'weekly', 'biweekly', 'installment', 'single'];
    
    return types.map(type => {
      const typeLoans = stats.allLoans.filter(loan => loan.payment_type === type);
      const activeLoans = typeLoans.filter(loan => loan.status !== 'paid');
      const totalOnStreet = activeLoans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
      const totalReceived = typeLoans.reduce((sum, loan) => sum + Number(loan.total_paid || 0), 0);
      
      // Calculate realized profit from payments
      let realizedProfit = 0;
      typeLoans.forEach(loan => {
        const payments = (loan as any).payments || [];
        realizedProfit += payments.reduce((sum: number, p: any) => sum + Number(p.interest_paid || 0), 0);
      });
      
      return {
        type,
        label: paymentTypeLabels[type],
        count: activeLoans.length,
        totalCount: typeLoans.length,
        totalOnStreet,
        totalReceived,
        realizedProfit,
      };
    });
  }, [stats.allLoans]);

  // Calculate comprehensive filtered stats
  const filteredStats = useMemo(() => {
    const activeLoans = filteredLoans.filter(loan => loan.status !== 'paid');
    
    // Corrigido: considera em atraso se status é overdue OU (status é pending E due_date < hoje)
    const overdueLoans = filteredLoans.filter(loan => {
      if (loan.status === 'overdue') return true;
      if (loan.status === 'pending') {
        const dueDate = new Date(loan.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
      }
      return false;
    });
    
    // Capital na Rua (soma do principal dos empréstimos ativos)
    const totalOnStreet = activeLoans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
    
    // Juros a Receber (pendentes) - com tratamento especial para diários
    const pendingInterest = activeLoans.reduce((sum, loan) => {
      const principal = Number(loan.principal_amount);
      const remainingBalance = Number(loan.remaining_balance || 0);
      const totalPaid = Number(loan.total_paid || 0);
      const rate = Number(loan.interest_rate);
      const installments = Number(loan.installments) || 1;
      const interestMode = loan.interest_mode || 'per_installment';
      const isDaily = loan.payment_type === 'daily';
      
      // Calcular juros já recebidos dos pagamentos
      const payments = (loan as any).payments || [];
      const interestPaid = payments.reduce((s: number, p: any) => 
        s + Number(p.interest_paid || 0), 0);
      
      // Calcular total de juros do contrato
      let totalInterest = 0;
      if (isDaily) {
        // Para diários, juros está embutido no remaining_balance inicial
        totalInterest = remainingBalance + totalPaid - principal;
      } else {
        totalInterest = interestMode === 'per_installment' 
          ? principal * (rate / 100) * installments 
          : principal * (rate / 100);
      }
      
      return sum + Math.max(0, totalInterest - interestPaid);
    }, 0);
    
    // Total Recebido (histórico)
    const totalReceivedAllTime = filteredLoans.reduce((sum, loan) => sum + Number(loan.total_paid || 0), 0);
    
    // Falta Receber
    const pendingAmount = activeLoans.reduce((sum, loan) => sum + Number(loan.remaining_balance || 0), 0);
    
    // Em Atraso
    const overdueAmount = overdueLoans.reduce((sum, loan) => sum + Number(loan.remaining_balance || 0), 0);
    
    // Lucro Realizado (juros já recebidos)
    const realizedProfit = filteredLoans.reduce((sum, loan) => {
      const payments = (loan as any).payments || [];
      return sum + payments.reduce((s: number, p: any) => s + Number(p.interest_paid || 0), 0);
    }, 0);

    // Total emprestado no período
    const totalLent = filteredLoans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
    
    return {
      totalOnStreet,
      pendingInterest,
      totalReceivedAllTime,
      pendingAmount,
      overdueAmount,
      realizedProfit,
      activeLoansCount: activeLoans.length,
      overdueCount: overdueLoans.length,
      activeLoans,
      overdueLoans,
      totalLent,
      totalProfit: realizedProfit,
      totalReceived: totalReceivedAllTime,
    };
  }, [filteredLoans]);

  // Monthly evolution data - filtered by payment type
  const monthlyEvolution = useMemo(() => {
    const months: { month: string; naRua: number; recebido: number; lucro: number }[] = [];
    
    // Get base loans filtered by payment type only (not date range for evolution)
    const baseLoans = paymentTypeFilter !== 'all' 
      ? stats.allLoans.filter(loan => loan.payment_type === paymentTypeFilter)
      : stats.allLoans;
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, 'MMM', { locale: ptBR });

      let monthNaRua = 0;
      let monthRecebido = 0;
      let monthPrincipal = 0;

      baseLoans.forEach(loan => {
        const loanDate = new Date(loan.start_date);
        if (isWithinInterval(loanDate, { start: monthStart, end: monthEnd })) {
          if (loan.status !== 'paid') {
            monthNaRua += Number(loan.principal_amount);
          }
          monthRecebido += Number(loan.total_paid || 0);
          if (loan.status === 'paid') {
            monthPrincipal += Number(loan.principal_amount);
          }
        }
      });

      months.push({
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        naRua: Math.round(monthNaRua),
        recebido: Math.round(monthRecebido),
        lucro: Math.round(monthRecebido - monthPrincipal),
      });
    }

    return months;
  }, [stats.allLoans, paymentTypeFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Quitado</Badge>;
      case 'overdue':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Em Atraso</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Em Dia</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display">Relatório Operacional</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Acompanhe seus empréstimos em tempo real
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                Atualizado: {format(lastUpdated, "HH:mm", { locale: ptBR })}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>

          {/* Period Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    "Selecionar período"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {dateRange?.from && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setDateRange({ from: subMonths(new Date(), 6), to: new Date() })}
                className="text-xs text-muted-foreground"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Payment Type Filter Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Filtrar por Tipo de Pagamento</h3>
            {paymentTypeFilter !== 'all' && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setPaymentTypeFilter('all')}
                className="text-xs text-muted-foreground h-7"
              >
                Ver todos
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            {statsByPaymentType.map((typeStat) => {
              const isActive = paymentTypeFilter === typeStat.type;
              const typeIcons: Record<string, React.ElementType> = {
                daily: CalendarDays,
                weekly: CalendarRange,
                biweekly: CalendarCheck,
                installment: CalendarIcon,
                single: DollarSign,
              };
              const TypeIcon = typeIcons[typeStat.type] || CalendarIcon;
              
              return (
                <motion.div
                  key={typeStat.type}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all border-2",
                      isActive 
                        ? "border-primary bg-primary/10 shadow-lg" 
                        : "border-border hover:border-primary/50 hover:bg-primary/5"
                    )}
                    onClick={() => setPaymentTypeFilter(isActive ? 'all' : typeStat.type)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn(
                          "p-1.5 rounded-lg",
                          isActive ? "bg-primary/20" : "bg-muted"
                        )}>
                          <TypeIcon className={cn(
                            "w-3.5 h-3.5",
                            isActive ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>
                        <span className={cn(
                          "text-xs font-medium",
                          isActive ? "text-primary" : "text-foreground"
                        )}>
                          {typeStat.label}
                        </span>
                        {isActive && (
                          <Badge className="ml-auto bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                            Ativo
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-muted-foreground">Na Rua</span>
                          <span className="text-xs font-bold text-blue-500">
                            {formatCurrency(typeStat.totalOnStreet)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-muted-foreground">Lucro</span>
                          <span className="text-xs font-bold text-emerald-500">
                            {formatCurrency(typeStat.realizedProfit)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-border/50">
                          <span className="text-[10px] text-muted-foreground">Contratos</span>
                          <span className="text-xs font-medium">
                            {typeStat.count} ativos
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Period Stats - Filtered - Compact */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-2 sm:p-3">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <CalendarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">
                {dateRange?.from && dateRange?.to ? (
                  `${format(dateRange.from, "dd/MM", { locale: ptBR })} - ${format(dateRange.to, "dd/MM", { locale: ptBR })}`
                ) : 'Todo o período'}
              </p>
              {paymentTypeFilter !== 'all' && (
                <Badge variant="outline" className="text-[10px] border-primary/50 text-primary ml-1">
                  {paymentTypeLabels[paymentTypeFilter]}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-[9px] sm:text-[10px] text-muted-foreground">Emprestado</p>
                <p className="text-xs sm:text-sm font-bold text-blue-500">{formatCurrency(filteredStats.totalLent)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] sm:text-[10px] text-muted-foreground">Recebido</p>
                <p className="text-xs sm:text-sm font-bold text-emerald-500">{formatCurrency(filteredStats.totalReceived)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] sm:text-[10px] text-muted-foreground">Lucro</p>
                <p className="text-xs sm:text-sm font-bold text-purple-500">{formatCurrency(filteredStats.totalProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Stats Grid - Filtered */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {stats.loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="💵 Capital na Rua"
                value={formatCurrency(filteredStats.totalOnStreet)}
                icon={Wallet}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle={`${filteredStats.activeLoansCount} contratos ativos`}
                compact
              />
              <StatCard
                label="💰 Juros a Receber"
                value={formatCurrency(filteredStats.pendingInterest)}
                icon={TrendingUp}
                iconColor="text-primary"
                bgColor="bg-primary/10"
                subtitle="Lucro pendente"
                compact
              />
              <StatCard
                label="✅ Total Recebido"
                value={formatCurrency(filteredStats.totalReceivedAllTime)}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                subtitle="Histórico"
                compact
              />
              <StatCard
                label="⏳ Falta Receber"
                value={formatCurrency(filteredStats.pendingAmount)}
                icon={Clock}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/10"
                subtitle="Saldo restante"
                compact
              />
              <StatCard
                label="🚨 Em Atraso"
                value={formatCurrency(filteredStats.overdueAmount)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                subtitle={`${filteredStats.overdueCount} contratos`}
                compact
              />
              <StatCard
                label="📊 Lucro Realizado"
                value={formatCurrency(filteredStats.realizedProfit)}
                icon={Percent}
                iconColor="text-purple-500"
                bgColor="bg-purple-500/10"
                subtitle="Juros já recebidos"
                compact
              />
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Evolution Chart */}
          <Card className="border-primary/30">
            <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Evolução Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 pt-0">
              <div className="h-[200px] sm:h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fontSize: 10 }} />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={10}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}
                      width={35}
                      className="hidden sm:block"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="naRua" 
                      name="Na Rua" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-1))', r: 2 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="recebido" 
                      name="Recebido" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))', r: 2 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lucro" 
                      name="Lucro" 
                      stroke="hsl(var(--chart-4))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-4))', r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats Chart */}
          <Card className="border-primary/30">
            <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Distribuição
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 pt-0">
              <div className="h-[200px] sm:h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Na Rua', value: filteredStats.totalOnStreet, fill: 'hsl(var(--chart-1))' },
                    { name: 'Recebido', value: filteredStats.totalReceivedAllTime, fill: 'hsl(var(--chart-2))' },
                    { name: 'Pendente', value: filteredStats.pendingAmount, fill: 'hsl(var(--chart-3))' },
                    { name: 'Atraso', value: filteredStats.overdueAmount, fill: 'hsl(var(--destructive))' },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fontSize: 9 }} />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={10}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}
                      width={35}
                      className="hidden sm:block"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Loans Table - Filtered */}
        <Card className="border-primary/30">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <span className="hidden sm:inline">Contratos Ativos (Na Rua)</span>
                <span className="sm:hidden">Ativos</span>
                {paymentTypeFilter !== 'all' && (
                  <Badge variant="outline" className="text-[10px] border-primary/50 text-primary ml-1">
                    {paymentTypeLabels[paymentTypeFilter]}
                  </Badge>
                )}
              </CardTitle>
              <Badge variant="outline" className="text-primary border-primary text-[10px] sm:text-xs">
                {filteredStats.activeLoansCount}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-right text-xs hidden sm:table-cell">Emprestado</TableHead>
                    <TableHead className="text-right text-xs hidden md:table-cell">Pago</TableHead>
                    <TableHead className="text-right text-xs">Falta</TableHead>
                    <TableHead className="text-center text-xs">Status</TableHead>
                    <TableHead className="text-right text-xs hidden lg:table-cell">Vencimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStats.activeLoans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs sm:text-sm">
                        Nenhum contrato ativo {paymentTypeFilter !== 'all' && `(${paymentTypeLabels[paymentTypeFilter]})`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStats.activeLoans.slice(0, 10).map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium text-xs sm:text-sm max-w-[100px] sm:max-w-none truncate">
                          {loan.client?.full_name || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                          {formatCurrency(loan.principal_amount)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-500 text-xs sm:text-sm hidden md:table-cell">
                          {formatCurrency(loan.total_paid || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs sm:text-sm">
                          {formatCurrency(loan.remaining_balance)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(loan.status)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs sm:text-sm hidden lg:table-cell">
                          {formatDate(loan.due_date)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredStats.activeLoans.length > 10 && (
                <p className="text-center text-[10px] sm:text-sm text-muted-foreground py-3">
                  +{filteredStats.activeLoans.length - 10} contratos
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overdue Loans Table - Filtered */}
        {filteredStats.overdueLoans.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-lg flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Contratos em Atraso</span>
                  <span className="sm:hidden">Em Atraso</span>
                  {paymentTypeFilter !== 'all' && (
                    <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive ml-1">
                      {paymentTypeLabels[paymentTypeFilter]}
                    </Badge>
                  )}
                </CardTitle>
                <Badge className="bg-destructive text-destructive-foreground text-[10px] sm:text-xs">
                  {filteredStats.overdueCount}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 pt-0">
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-right text-xs">Atraso</TableHead>
                      <TableHead className="text-right text-xs hidden sm:table-cell">Emprestado</TableHead>
                      <TableHead className="text-right text-xs hidden md:table-cell">Vencimento</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStats.overdueLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium text-xs sm:text-sm max-w-[100px] sm:max-w-none truncate">
                          {loan.client?.full_name || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-destructive text-xs sm:text-sm">
                          {formatCurrency(loan.remaining_balance)}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                          {formatCurrency(loan.principal_amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs sm:text-sm hidden md:table-cell">
                          {formatDate(loan.due_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs sm:text-sm hidden lg:table-cell">
                          {loan.client?.phone || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
