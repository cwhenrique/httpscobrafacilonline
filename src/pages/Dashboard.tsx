import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useOperationalStats } from '@/hooks/useOperationalStats';
import { useLoans } from '@/hooks/useLoans';
import { useAllPayments } from '@/hooks/useAllPayments';
import { useDashboardHealth } from '@/hooks/useDashboardHealth';
import { useProfile } from '@/hooks/useProfile';
import { HealthScoreCard } from '@/components/reports/HealthScoreCard';
import { AlertsCard } from '@/components/reports/AlertsCard';

import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { formatCurrency } from '@/lib/calculations';
import { Skeleton } from '@/components/ui/skeleton';
import { FinancialChart, InterestChart } from '@/components/dashboard/FinancialChart';
import {
  DollarSign,
  TrendingUp,
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
  FileCheck,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';

export default function Dashboard() {
  const { stats, loading: statsLoading, refetch: refetchDashboard } = useDashboardStats();
  const { stats: opStats, refetch: refetchOpStats } = useOperationalStats();
  const { loans, loading: loansLoading } = useLoans();
  const { payments, loading: paymentsLoading } = useAllPayments();
  const { isEmployee, isOwner, hasPermission, loading: employeeLoading } = useEmployeeContext();
  const { healthData, alertsData, loading: healthLoading } = useDashboardHealth();
  const { profile } = useProfile();
  
  const [showEmployeeBanner, setShowEmployeeBanner] = useState(() => {
    return sessionStorage.getItem('hideEmployeeBanner') !== 'true';
  });
  const [showReportsBanner, setShowReportsBanner] = useState(() => {
    return sessionStorage.getItem('hideReportsBanner') !== 'true';
  });
  const [activeBanner, setActiveBanner] = useState<'employee' | 'reports'>('employee');
  
  // Forçar refresh ao montar o Dashboard para garantir dados atualizados
  useEffect(() => {
    refetchOpStats();
    refetchDashboard();
  }, []);

  // Alternar banners a cada 6 segundos
  useEffect(() => {
    const hasBoth = showEmployeeBanner && showReportsBanner;
    if (!hasBoth) return;
    const timer = setInterval(() => {
      setActiveBanner(prev => prev === 'employee' ? 'reports' : 'employee');
    }, 6000);
    return () => clearInterval(timer);
  }, [showEmployeeBanner, showReportsBanner]);
  
  const handleCloseEmployeeBanner = () => {
    sessionStorage.setItem('hideEmployeeBanner', 'true');
    setShowEmployeeBanner(false);
  };

  const handleCloseReportsBanner = () => {
    sessionStorage.setItem('hideReportsBanner', 'true');
    setShowReportsBanner(false);
  };
  

  // Calculate average ticket for active loans
  const averageTicket = (() => {
    const activeLoans = loans.filter(l => l.status !== 'paid');
    if (activeLoans.length === 0) return 0;
    const total = activeLoans.reduce((sum, l) => sum + l.principal_amount, 0);
    return total / activeLoans.length;
  })();

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

  // Usar useOperationalStats para métricas financeiras (mesma fonte que ReportsLoans)
  const financialCards = [
    {
      title: 'Total a Receber',
      value: formatCurrency(opStats.pendingAmount),
      subtitle: 'incluindo multas e juros',
      icon: TrendingUp,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Recebido',
      value: formatCurrency(opStats.totalReceivedAllTime),
      subtitle: 'total histórico',
      icon: Receipt,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      title: 'Capital na Rua',
      value: formatCurrency(opStats.totalOnStreet),
      subtitle: 'principal emprestado',
      icon: DollarSign,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      title: 'Juros a Receber',
      value: formatCurrency(opStats.pendingInterest),
      subtitle: 'juros pendentes',
      icon: Clock,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'Clientes',
      value: stats.totalClients.toString(),
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


        {/* Alternating Banners - Employee & Reports Promo */}
        {!isEmployee && isOwner && (
          <>
            {/* Employee Banner */}
            {showEmployeeBanner && (activeBanner === 'employee' || !showReportsBanner) && (
              <Card className="shadow-soft border-blue-500/50 bg-gradient-to-r from-blue-900 to-blue-800 relative">
                <button 
                  onClick={handleCloseEmployeeBanner}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-blue-500/20 transition-colors z-10"
                  aria-label="Fechar banner"
                >
                  <X className="w-4 h-4 text-blue-200" />
                </button>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-blue-500/30">
                        <UserPlus className="w-6 h-6 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-xl text-white drop-shadow-md">Expanda seu Negócio!</h3>
                        <p className="text-sm text-blue-100 mt-1 font-medium">
                          Adicione funcionários para ajudar no dia a dia. A partir de R$ 35,90/mês.
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-blue-100 font-medium">
                          <span className="flex items-center gap-1">✓ Controle total de permissões</span>
                          <span className="flex items-center gap-1">✓ Acompanhamento de produtividade</span>
                          <span className="flex items-center gap-1">✓ Notificações via WhatsApp</span>
                          <span className="flex items-center gap-1">✓ Relatórios por funcionário</span>
                        </div>
                      </div>
                    </div>
                    <Link to="/employees">
                      <Button className="gap-2 bg-green-500 hover:bg-green-400 text-white font-semibold">
                        Ver Funcionários
                        <ArrowUpRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reports Banner */}
            {showReportsBanner && (activeBanner === 'reports' || !showEmployeeBanner) && (
              <Card className="shadow-soft border-emerald-500/50 bg-gradient-to-r from-emerald-900 to-green-800 relative">
                <button 
                  onClick={handleCloseReportsBanner}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-emerald-500/20 transition-colors z-10"
                  aria-label="Fechar banner"
                >
                  <X className="w-4 h-4 text-emerald-200" />
                </button>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-emerald-500/30">
                        <FileCheck className="w-6 h-6 text-emerald-300" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-xl text-white drop-shadow-md">
                          {profile?.relatorio_ativo ? 'Relatórios Ativos ✓' : 'Relatórios Automáticos via WhatsApp'}
                        </h3>
                        <p className="text-sm text-emerald-100 mt-1 font-medium">
                          {profile?.relatorio_ativo
                            ? 'Seus relatórios estão sendo enviados automaticamente. Gerencie suas preferências.'
                            : 'Receba relatórios de empréstimos, produtos, contratos e IPTV. Por apenas R$ 19,90/mês.'}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-emerald-100 font-medium">
                          <span className="flex items-center gap-1">✓ Diário, semanal, quinzenal</span>
                          <span className="flex items-center gap-1">✓ Empréstimos e produtos</span>
                          <span className="flex items-center gap-1">✓ Contratos e IPTV</span>
                          <span className="flex items-center gap-1">✓ Direto no WhatsApp</span>
                        </div>
                      </div>
                    </div>
                    {profile?.relatorio_ativo ? (
                      <Link to="/auto-reports">
                        <Button className="gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold">
                          Gerenciar
                          <ArrowUpRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        onClick={() => window.open('https://pay.cakto.com.br/DKbJ3gL', '_blank')}
                        className="gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
                      >
                        Assinar Agora
                        <ArrowUpRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Banner dots indicator */}
            {showEmployeeBanner && showReportsBanner && (
              <div className="flex justify-center gap-2 -mt-4">
                <button
                  onClick={() => setActiveBanner('employee')}
                  className={`w-2 h-2 rounded-full transition-all ${
                    activeBanner === 'employee' ? 'bg-blue-500 w-4' : 'bg-muted-foreground/30'
                  }`}
                />
                <button
                  onClick={() => setActiveBanner('reports')}
                  className={`w-2 h-2 rounded-full transition-all ${
                    activeBanner === 'reports' ? 'bg-emerald-500 w-4' : 'bg-muted-foreground/30'
                  }`}
                />
              </div>
            )}
          </>
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
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

        {/* Health Score and Alerts */}
        {!healthLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HealthScoreCard
              score={healthData.score}
              receiptRate={healthData.receiptRate}
              delinquencyRate={healthData.delinquencyRate}
              totalReceived={healthData.totalReceived}
              totalOverdue={healthData.totalOverdue}
              profitMargin={healthData.profitMargin}
            />
            <AlertsCard
              dueThisWeek={alertsData.dueThisWeek}
              overdueMoreThan30Days={alertsData.overdueMoreThan30Days}
              vehiclesOverdue={alertsData.vehiclesOverdue}
              productsOverdue={alertsData.productsOverdue}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
