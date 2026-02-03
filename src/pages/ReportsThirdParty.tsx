import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useThirdPartyStats } from '@/hooks/useThirdPartyStats';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate, isLoanOverdue, getDaysOverdue } from '@/lib/calculations';
import { toast } from 'sonner';
import { 
  Building2,
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
  Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Stat Card Component
const StatCard = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-teal-500',
  bgColor = 'bg-teal-500/10',
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
    <Card className="border-teal-500/30 bg-card shadow-lg hover:shadow-xl transition-shadow h-full">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={cn("p-2 sm:p-3 rounded-xl shrink-0", bgColor)}>
              <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{label}</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold mt-0.5">{value}</p>
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

const StatCardSkeleton = () => (
  <Card className="border-teal-500/30">
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

export default function ReportsThirdParty() {
  const { stats, refetch } = useThirdPartyStats();
  const { profile } = useProfile();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast.success('Dados atualizados!');
  };

  // Group loans by third party
  const loansByThirdParty = useMemo(() => {
    const groups: Record<string, {
      name: string;
      loans: any[];
      totalPending: number;
      totalReceived: number;
      overdueCount: number;
    }> = {};

    stats.allLoans.forEach((loan: any) => {
      const name = loan.third_party_name || 'Sem Nome';
      if (!groups[name]) {
        groups[name] = {
          name,
          loans: [],
          totalPending: 0,
          totalReceived: 0,
          overdueCount: 0,
        };
      }
      groups[name].loans.push(loan);
      if (loan.status !== 'paid') {
        groups[name].totalPending += Number(loan.remaining_balance);
        if (isLoanOverdue(loan)) {
          groups[name].overdueCount++;
        }
      }
      groups[name].totalReceived += Number(loan.total_paid || 0);
    });

    return Object.values(groups).sort((a, b) => b.totalPending - a.totalPending);
  }, [stats.allLoans]);

  if (stats.loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-teal-500" />
            <h1 className="text-2xl font-bold">Relatório de Terceiros</h1>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 rounded-xl">
              <Building2 className="w-6 h-6 text-teal-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Relatório de Terceiros</h1>
              <p className="text-sm text-muted-foreground">
                Visão consolidada dos empréstimos que você administra para outras pessoas/empresas
              </p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-teal-500/50 hover:bg-teal-500/10"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>
        
        {/* Main Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Emprestado"
            value={formatCurrency(stats.totalLent)}
            icon={Banknote}
            iconColor="text-teal-500"
            bgColor="bg-teal-500/10"
            subtitle={`${stats.allLoans.length} contratos`}
          />
          
          <StatCard
            label="Total Recebido"
            value={formatCurrency(stats.totalReceived)}
            icon={DollarSign}
            iconColor="text-emerald-500"
            bgColor="bg-emerald-500/10"
            subtitle={`${stats.paidLoansCount} quitados`}
            trend="up"
          />
          
          <StatCard
            label="A Receber"
            value={formatCurrency(stats.pendingAmount)}
            icon={Wallet}
            iconColor="text-amber-500"
            bgColor="bg-amber-500/10"
            subtitle={`${stats.activeLoansCount} ativos`}
          />
          
          <StatCard
            label="Em Atraso"
            value={formatCurrency(stats.overdueAmount)}
            icon={AlertTriangle}
            iconColor="text-red-500"
            bgColor="bg-red-500/10"
            subtitle={`${stats.overdueCount} contratos`}
            trend={stats.overdueCount > 0 ? 'down' : 'neutral'}
          />
        </div>
        
        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Capital na Rua"
            value={formatCurrency(stats.totalOnStreet)}
            icon={TrendingUp}
            iconColor="text-blue-500"
            bgColor="bg-blue-500/10"
            subtitle="Principal em aberto"
          />
          
          <StatCard
            label="Juros a Receber"
            value={formatCurrency(stats.pendingInterest)}
            icon={Percent}
            iconColor="text-purple-500"
            bgColor="bg-purple-500/10"
            subtitle="Lucro pendente"
          />
          
          <StatCard
            label="Lucro Realizado"
            value={formatCurrency(stats.realizedProfit)}
            icon={CheckCircle}
            iconColor="text-emerald-500"
            bgColor="bg-emerald-500/10"
            subtitle="Juros já recebidos"
            trend="up"
          />
        </div>
        
        {/* Breakdown by Third Party */}
        <Card className="border-teal-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-500" />
              Por Terceiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loansByThirdParty.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum empréstimo de terceiro cadastrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {loansByThirdParty.map((group) => (
                  <div 
                    key={group.name} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-teal-500/5 border border-teal-500/20 gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-teal-500/20">
                        <Building2 className="w-5 h-5 text-teal-500" />
                      </div>
                      <div>
                        <p className="font-semibold">{group.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {group.loans.length} {group.loans.length === 1 ? 'contrato' : 'contratos'}
                          {group.overdueCount > 0 && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              {group.overdueCount} em atraso
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">A Receber</p>
                        <p className="font-bold text-amber-500">{formatCurrency(group.totalPending)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Recebido</p>
                        <p className="font-bold text-emerald-500">{formatCurrency(group.totalReceived)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Recent Loans */}
        <Card className="border-teal-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-500" />
              Últimos Empréstimos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.allLoans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum empréstimo de terceiro cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.allLoans.slice(0, 10).map((loan: any) => {
                  const isOverdue = loan.status !== 'paid' && isLoanOverdue(loan);
                  const daysOver = isOverdue ? getDaysOverdue(loan) : 0;
                  
                  return (
                    <div 
                      key={loan.id} 
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-3",
                        loan.status === 'paid' 
                          ? "bg-emerald-500/10 border-emerald-500/30" 
                          : isOverdue 
                            ? "bg-red-500/10 border-red-500/30"
                            : "bg-teal-500/5 border-teal-500/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{loan.client?.full_name || 'Cliente'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] bg-teal-500/20 text-teal-600 border-teal-400/50">
                              <Building2 className="w-2.5 h-2.5 mr-1" />
                              {loan.third_party_name || 'Terceiro'}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-[10px]">
                                {daysOver}d atraso
                              </Badge>
                            )}
                            {loan.status === 'paid' && (
                              <Badge className="text-[10px] bg-emerald-500">Quitado</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-4 text-sm">
                        <div className="text-right">
                          <p className="text-muted-foreground text-xs">Principal</p>
                          <p className="font-medium">{formatCurrency(Number(loan.principal_amount))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground text-xs">Restante</p>
                          <p className={cn(
                            "font-medium",
                            loan.status === 'paid' ? "text-emerald-500" : isOverdue ? "text-red-500" : ""
                          )}>
                            {formatCurrency(Number(loan.remaining_balance))}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
