import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useLoans } from '@/hooks/useLoans';
import { useAllPayments } from '@/hooks/useAllPayments';
import { useOverdueNotifications } from '@/hooks/useOverdueNotifications';
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FinancialChart } from '@/components/dashboard/FinancialChart';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { loans, loading: loansLoading } = useLoans();
  const { payments, loading: paymentsLoading } = useAllPayments();
  
  // Enable browser notifications for overdue loans
  useOverdueNotifications(loans, loansLoading);

  const recentLoans = loans.slice(0, 5);
  
  // Filter overdue loans
  const overdueLoans = loans.filter((loan) => {
    if (loan.status === 'paid') return false;
    
    const numInstallments = loan.installments || 1;
    const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
    const totalToReceive = loan.principal_amount + (interestPerInstallment * numInstallments);
    const remainingToReceive = totalToReceive - (loan.total_paid || 0);
    
    if (remainingToReceive <= 0) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const principalPerInstallment = loan.principal_amount / numInstallments;
    const totalPerInstallment = principalPerInstallment + interestPerInstallment;
    const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);
    const dates = (loan.installment_dates as string[]) || [];
    
    if (dates.length > 0 && paidInstallments < dates.length) {
      const nextDueDate = new Date(dates[paidInstallments]);
      nextDueDate.setHours(0, 0, 0, 0);
      return today > nextDueDate;
    } else {
      const dueDate = new Date(loan.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return today > dueDate;
    }
  });

  const statCards = [
    {
      title: 'Total Emprestado',
      value: formatCurrency(stats.totalLoaned),
      icon: DollarSign,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Total Recebido',
      value: formatCurrency(stats.totalReceived),
      icon: TrendingUp,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      title: 'Total Pendente',
      value: formatCurrency(stats.totalPending),
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      title: 'Atrasados',
      value: stats.overdueCount.toString(),
      icon: AlertTriangle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      title: 'Vencendo em 7 dias',
      value: stats.upcomingDue.toString(),
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      title: 'Clientes Ativos',
      value: stats.activeClients.toString(),
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu sistema financeiro</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="shadow-soft">
              <CardContent className="p-4">
                {statsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-2 rounded-lg ${stat.bg}`}>
                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                    <p className="text-lg font-semibold">{stat.value}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Financial Evolution Chart */}
        {!loansLoading && !paymentsLoading && (
          <FinancialChart loans={loans} payments={payments} />
        )}

        {/* Overdue Loans Alert */}
        {!loansLoading && overdueLoans.length > 0 && (
          <Card className="shadow-soft border-destructive bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <CardTitle className="text-lg font-display text-destructive">
                  Empréstimos em Atraso ({overdueLoans.length})
                </CardTitle>
              </div>
              <Link to="/loans">
                <Button variant="outline" size="sm" className="gap-1 border-destructive text-destructive hover:bg-destructive/10">
                  Ver todos
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueLoans.slice(0, 5).map((loan) => {
                  const numInstallments = loan.installments || 1;
                  const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
                  const totalToReceive = loan.principal_amount + (interestPerInstallment * numInstallments);
                  const remainingToReceive = totalToReceive - (loan.total_paid || 0);
                  
                  const dueDate = new Date(loan.due_date);
                  const today = new Date();
                  const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div
                      key={loan.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                    >
                      <div>
                        <p className="font-medium">{loan.client?.full_name}</p>
                        <p className="text-sm text-destructive">
                          {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'} em atraso
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-destructive">{formatCurrency(remainingToReceive)}</p>
                        <Badge className="bg-destructive text-white">
                          Em Atraso
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Loans */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-display">Empréstimos Recentes</CardTitle>
            <Link to="/loans">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todos
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loansLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentLoans.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum empréstimo registrado
              </p>
            ) : (
              <div className="space-y-3">
                {recentLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{loan.client?.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Vence em {formatDate(loan.due_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(loan.remaining_balance)}</p>
                      <Badge className={getPaymentStatusColor(loan.status)}>
                        {getPaymentStatusLabel(loan.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
