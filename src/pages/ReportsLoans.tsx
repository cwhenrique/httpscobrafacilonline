import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useOperationalStats } from '@/hooks/useOperationalStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

// Stat Card Component
const StatCard = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  bgColor = 'bg-primary/10',
  subtitle,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor?: string;
  bgColor?: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="border-primary/30 bg-card shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-3 rounded-xl shrink-0", bgColor)}>
              <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", iconColor)} />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">{label}</p>
              <p className="text-lg sm:text-2xl font-bold mt-1">{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
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
    <CardContent className="p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function ReportsLoans() {
  const { stats, refetch } = useOperationalStats();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Monthly evolution data
  const monthlyEvolution = useMemo(() => {
    const months: { month: string; naRua: number; recebido: number; lucro: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, 'MMM', { locale: ptBR });

      let monthNaRua = 0;
      let monthRecebido = 0;
      let monthPrincipal = 0;

      stats.allLoans.forEach(loan => {
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
  }, [stats.allLoans]);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">Relatório Operacional</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe seus empréstimos em tempo real
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Última atualização: {format(lastUpdated, "HH:mm", { locale: ptBR })}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
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
                label="💵 Na Rua (Ativo)"
                value={formatCurrency(stats.totalOnStreet)}
                icon={Wallet}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle={`Capital emprestado • ${stats.activeLoansCount} contratos`}
              />
              <StatCard
                label="✅ Total Recebido"
                value={formatCurrency(stats.totalReceivedAllTime)}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                subtitle="Histórico completo"
              />
              <StatCard
                label="📈 A Receber (Ativos)"
                value={formatCurrency(stats.totalToReceiveActive)}
                icon={TrendingUp}
                iconColor="text-primary"
                bgColor="bg-primary/10"
                subtitle="Principal + Juros"
              />
              <StatCard
                label="⏳ Pendente"
                value={formatCurrency(stats.pendingAmount)}
                icon={Clock}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/10"
                subtitle="Falta cobrar"
              />
              <StatCard
                label="🚨 Em Atraso"
                value={formatCurrency(stats.overdueAmount)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                subtitle={`${stats.overdueCount} contratos`}
              />
              <StatCard
                label="📊 Lucro Realizado"
                value={formatCurrency(stats.realizedProfit)}
                icon={Percent}
                iconColor="text-purple-500"
                bgColor="bg-purple-500/10"
                subtitle="Juros já recebidos"
              />
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Evolution Chart */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Evolução Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="naRua" 
                      name="Na Rua" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-1))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="recebido" 
                      name="Recebido" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lucro" 
                      name="Lucro" 
                      stroke="hsl(var(--chart-4))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-4))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats Chart */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" />
                Distribuição de Contratos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Na Rua', value: stats.totalOnStreet, fill: 'hsl(var(--chart-1))' },
                    { name: 'Recebido', value: stats.totalReceivedAllTime, fill: 'hsl(var(--chart-2))' },
                    { name: 'Pendente', value: stats.pendingAmount, fill: 'hsl(var(--chart-3))' },
                    { name: 'Em Atraso', value: stats.overdueAmount, fill: 'hsl(var(--destructive))' },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
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

        {/* Active Loans Table */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Contratos Ativos (Na Rua)
              </CardTitle>
              <Badge variant="outline" className="text-primary border-primary">
                {stats.activeLoansCount} contratos
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Emprestado</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Falta</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Vencimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.activeLoans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum contrato ativo encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.activeLoans.slice(0, 10).map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium">
                          {loan.client?.full_name || 'Cliente não encontrado'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(loan.principal_amount)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-500">
                          {formatCurrency(loan.total_paid || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(loan.remaining_balance)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(loan.status)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(loan.due_date)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {stats.activeLoans.length > 10 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Mostrando 10 de {stats.activeLoans.length} contratos ativos
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overdue Loans Table */}
        {stats.overdueLoans.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Contratos em Atraso
                </CardTitle>
                <Badge className="bg-destructive text-destructive-foreground">
                  {stats.overdueCount} contratos
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor em Atraso</TableHead>
                      <TableHead className="text-right">Total Emprestado</TableHead>
                      <TableHead className="text-right">Vencimento</TableHead>
                      <TableHead>Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.overdueLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium">
                          {loan.client?.full_name || 'Cliente não encontrado'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-destructive">
                          {formatCurrency(loan.remaining_balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(loan.principal_amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(loan.due_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
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
