import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tv, DollarSign, Calendar, AlertTriangle, TrendingUp, Clock, Users } from 'lucide-react';
import { MonthlyFee, MonthlyFeePayment } from '@/hooks/useMonthlyFees';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface IPTVDashboardProps {
  fees: MonthlyFee[];
  payments: MonthlyFeePayment[];
  serverCost?: number;
}

const formatCurrency = (value: number) => {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

export default function IPTVDashboard({ fees, payments, serverCost = 0 }: IPTVDashboardProps) {
  const stats = useMemo(() => {
    const activeFees = fees.filter(f => f.is_active);
    const mrr = activeFees.reduce((acc, f) => acc + f.amount, 0);
    
    const currentMonth = format(new Date(), 'yyyy-MM-01');
    const currentMonthPayments = payments.filter(p => p.reference_month === currentMonth);
    
    const pending = currentMonthPayments.filter(p => {
      if (p.status === 'paid') return false;
      const dueDate = parseISO(p.due_date);
      return !isPast(dueDate) || isToday(dueDate);
    }).length;
    
    const overdue = currentMonthPayments.filter(p => {
      if (p.status === 'paid') return false;
      const dueDate = parseISO(p.due_date);
      return isPast(dueDate) && !isToday(dueDate);
    }).length;
    
    // Credit expiring soon (in 3 days or less)
    const today = new Date();
    const expiringSoon = activeFees.filter(f => {
      if (!f.credit_expires_at) return false;
      const expiryDate = parseISO(f.credit_expires_at);
      const daysUntil = differenceInDays(expiryDate, today);
      return daysUntil >= 0 && daysUntil <= 3;
    }).length;
    
    // Demo accounts expiring
    const demoExpiring = activeFees.filter(f => {
      if (!f.is_demo || !f.demo_expires_at) return false;
      const expiryDate = parseISO(f.demo_expires_at);
      const daysUntil = differenceInDays(expiryDate, today);
      return daysUntil >= 0 && daysUntil <= 3;
    }).length;
    
    return {
      active: activeFees.length,
      inactive: fees.length - activeFees.length,
      mrr,
      pending,
      overdue,
      expiringSoon,
      demoExpiring,
      total: fees.length,
    };
  }, [fees, payments]);

  // Plan type distribution
  const planDistribution = useMemo(() => {
    const activeFees = fees.filter(f => f.is_active);
    const planCounts: Record<string, { count: number; revenue: number }> = {};
    
    activeFees.forEach(fee => {
      const planType = fee.plan_type || 'basic';
      if (!planCounts[planType]) {
        planCounts[planType] = { count: 0, revenue: 0 };
      }
      planCounts[planType].count++;
      planCounts[planType].revenue += fee.amount;
    });
    
    return Object.entries(planCounts).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: data.count,
      revenue: data.revenue,
    }));
  }, [fees]);

  // Monthly revenue data (last 6 months)
  const monthlyRevenue = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = format(date, 'yyyy-MM');
      months[key] = 0;
    }
    
    // Sum paid amounts
    payments.forEach(p => {
      if (p.status === 'paid' && p.payment_date) {
        const monthKey = format(parseISO(p.payment_date), 'yyyy-MM');
        if (months[monthKey] !== undefined) {
          months[monthKey] += p.amount;
        }
      }
    });
    
    return Object.entries(months).map(([month, amount]) => ({
      month: format(parseISO(`${month}-01`), 'MMM', { locale: ptBR }),
      amount,
    }));
  }, [payments]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const profit = stats.mrr - serverCost;

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Tv className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary truncate">{formatCurrency(stats.mrr)}</p>
                <p className="text-xs text-muted-foreground">MRR</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit Card */}
        <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-500 truncate">{formatCurrency(profit)}</p>
                <p className="text-xs text-muted-foreground">Lucro</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-500">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Atrasados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-orange-500">{stats.expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Expirando</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-blue-500">{stats.demoExpiring}</p>
                <p className="text-xs text-muted-foreground">Demos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Revenue Chart */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Receita Mensal
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Recebido']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution Chart */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Tv className="w-4 h-4 text-primary" />
              Distribuição por Plano
            </h3>
            <div className="h-[200px] flex items-center">
              {planDistribution.length > 0 ? (
                <div className="flex w-full items-center gap-4">
                  <div className="w-1/2">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={planDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {planDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string, entry: any) => [
                            `${value} assinaturas (${formatCurrency(entry.payload.revenue)})`,
                            entry.payload.name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-2">
                    {planDistribution.map((plan, index) => (
                      <div key={plan.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span>{plan.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{plan.value}</span>
                          <span className="text-muted-foreground text-xs ml-1">
                            ({Math.round((plan.value / stats.active) * 100)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Sem dados de planos
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
