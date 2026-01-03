import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useLoans } from '@/hooks/useLoans';
import { useAllPayments } from '@/hooks/useAllPayments';
import { useOverdueNotifications } from '@/hooks/useOverdueNotifications';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel, isLoanOverdue, getDaysOverdue } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FinancialChart, InterestChart } from '@/components/dashboard/FinancialChart';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  Clock,
  ArrowUpRight,
  Calendar,
  FileText,
  Package,
  Car,
  CalendarCheck,
  Receipt,
  Lock,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';

export default function Dashboard() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { loans, loading: loansLoading } = useLoans();
  const { payments, loading: paymentsLoading } = useAllPayments();
  const { isEmployee, isOwner, hasPermission, loading: employeeLoading } = useEmployeeContext();
  
  // Enable browser notifications for overdue loans
  useOverdueNotifications(loans, loansLoading);

  const recentLoans = loans.slice(0, 5);
  
  // Filter overdue loans using centralized function
  const overdueLoans = loans.filter((loan) => isLoanOverdue(loan));

  const businessTypeCards = [
    {
      title: 'Empréstimos',
      total: stats.loanCount,
      thisWeek: stats.loansThisWeek,
      icon: DollarSign,
      color: 'text-primary',
      bg: 'bg-primary/10',
      href: '/loans',
    },
    {
      title: 'Produtos',
      total: stats.productSalesCount,
      thisWeek: stats.productSalesThisWeek,
      icon: Package,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      href: '/product-sales',
    },
    {
      title: 'Veículos',
      total: stats.vehiclesCount,
      thisWeek: stats.vehiclesThisWeek,
      icon: Car,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      href: '/vehicles',
    },
    {
      title: 'Contratos',
      total: stats.contractsCount,
      thisWeek: stats.contractsThisWeekCount,
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      href: '/bills',
    },
  ];

  const financialCards = [
    {
      title: 'A Receber',
      value: formatCurrency(stats.totalToReceive),
      subtitle: 'com juros',
      icon: TrendingUp,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Recebido',
      value: formatCurrency(stats.totalReceived),
      subtitle: 'total histórico',
      icon: Receipt,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      title: 'Pendente',
      value: formatCurrency(stats.totalPending),
      subtitle: 'falta receber',
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      title: 'Atrasados',
      value: stats.overdueCount.toString(),
      subtitle: 'contratos',
      icon: AlertTriangle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      title: 'Clientes',
      value: stats.activeClients.toString(),
      subtitle: 'cadastrados',
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ];

  // Check if employee has permission to view dashboard
  const canViewDashboard = !isEmployee || hasPermission('view_dashboard');

  // Show restricted view for employees without permission
  if (!employeeLoading && !canViewDashboard) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          <div>
            <h1 className="text-2xl font-display font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Acesso restrito</p>
          </div>
          
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Você não tem permissão para visualizar o resumo financeiro. 
                Entre em contato com o administrador para solicitar acesso.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link to="/loans">
                  <Button>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Ir para Empréstimos
                  </Button>
                </Link>
                <Link to="/clients">
                  <Button variant="outline">
                    <Users className="w-4 h-4 mr-2" />
                    Ir para Clientes
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu sistema financeiro</p>
        </div>

        {/* PWA Install Banner */}
        <PWAInstallBanner variant="card" />

        {/* Employee Feature Promo - Only for owners */}
        {!isEmployee && isOwner && (
          <Card className="shadow-soft border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/10">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10">
                    <UserPlus className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg">Expanda seu Negócio!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Adicione funcionários para ajudar no dia a dia. Você controla o que cada um pode ver.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">✓ Visibilidade controlada</span>
                      <span className="flex items-center gap-1">✓ Dashboard protegido</span>
                      <span className="flex items-center gap-1">✓ A partir de R$ 35,90</span>
                    </div>
                  </div>
                </div>
                <Link to="/employees">
                  <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
                    Ver Funcionários
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Summary - Hero Card */}
        <Card className="shadow-soft border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-6">
            {statsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h2 className="font-display font-semibold text-lg">Resumo da Semana</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-background/60 rounded-lg p-3 sm:p-4 border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Contratos</span>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-primary">{stats.contractsThisWeek}</p>
                    <p className="text-xs text-muted-foreground">esta semana</p>
                  </div>
                  <div className="bg-background/60 rounded-lg p-3 sm:p-4 border border-success/20">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-success" />
                      <span className="text-xs text-muted-foreground">Recebido</span>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-success truncate">{formatCurrency(stats.receivedThisWeek)}</p>
                    <p className="text-xs text-muted-foreground">esta semana</p>
                  </div>
                  <div className="bg-background/60 rounded-lg p-3 sm:p-4 border border-warning/20">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarCheck className="w-4 h-4 text-warning" />
                      <span className="text-xs text-muted-foreground">Vence Hoje</span>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-warning">{stats.dueToday}</p>
                    <p className="text-xs text-muted-foreground">cobranças</p>
                  </div>
                  <div className="bg-background/60 rounded-lg p-3 sm:p-4 border border-destructive/20">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-xs text-muted-foreground">Em Atraso</span>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-destructive">{stats.overdueCount}</p>
                    <p className="text-xs text-muted-foreground">total</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Business Type Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {businessTypeCards.map((card, index) => (
            <Link key={index} to={card.href}>
              <Card className="shadow-soft hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4">
                  {statsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-2 rounded-lg ${card.bg}`}>
                          <card.icon className={`w-4 h-4 ${card.color}`} />
                        </div>
                        <span className="text-sm font-medium">{card.title}</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold">{card.total}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="text-primary font-medium">+{card.thisWeek}</span> esta semana
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Financial Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {financialCards.map((stat, index) => (
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
                    <p className="text-sm sm:text-lg font-semibold truncate">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Financial Evolution Chart */}
        {!loansLoading && !paymentsLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FinancialChart loans={loans} payments={payments} />
            <InterestChart payments={payments} />
          </div>
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
                  Em Atraso ({overdueLoans.length})
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
                  const totalInterest = loan.total_interest || 0;
                  const totalToReceive = loan.principal_amount + totalInterest;
                  const remainingToReceive = totalToReceive - (loan.total_paid || 0);
                  
                  // Usar função centralizada para calcular dias em atraso
                  const daysOverdueCount = getDaysOverdue(loan);
                  
                  return (
                    <div
                      key={loan.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                    >
                      <div>
                        <p className="font-medium">{loan.client?.full_name}</p>
                        <p className="text-sm text-destructive">
                          {daysOverdueCount} {daysOverdueCount === 1 ? 'dia' : 'dias'} em atraso
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
