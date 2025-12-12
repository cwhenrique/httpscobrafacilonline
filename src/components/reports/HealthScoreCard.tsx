import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, DollarSign, Percent } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface HealthScoreCardProps {
  score: number;
  receiptRate: number;
  delinquencyRate: number;
  totalReceived: number;
  totalOverdue: number;
  profitMargin: number;
}

export function HealthScoreCard({
  score,
  receiptRate,
  delinquencyRate,
  totalReceived,
  totalOverdue,
  profitMargin,
}: HealthScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excelente';
    if (score >= 70) return 'Saudável';
    if (score >= 50) return 'Atenção';
    return 'Crítico';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-destructive';
  };

  const indicators = [
    {
      label: 'Taxa de Recebimento',
      value: `${receiptRate.toFixed(1)}%`,
      status: receiptRate >= 80 ? 'success' : receiptRate >= 60 ? 'warning' : 'error',
      icon: TrendingUp,
    },
    {
      label: 'Inadimplência',
      value: `${delinquencyRate.toFixed(1)}%`,
      status: delinquencyRate <= 10 ? 'success' : delinquencyRate <= 20 ? 'warning' : 'error',
      icon: AlertTriangle,
    },
    {
      label: 'Recebido',
      value: formatCurrency(totalReceived),
      status: 'success',
      icon: CheckCircle,
    },
    {
      label: 'Em Atraso',
      value: formatCurrency(totalOverdue),
      status: totalOverdue === 0 ? 'success' : 'error',
      icon: DollarSign,
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '🔴';
      default:
        return '•';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-emerald-500';
      case 'warning':
        return 'text-amber-500';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="shadow-soft border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          {/* Score Circle */}
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative">
              <div className={cn(
                "w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border-4",
                score >= 70 ? 'border-emerald-500/30 bg-emerald-500/10' : 
                score >= 50 ? 'border-amber-500/30 bg-amber-500/10' : 
                'border-destructive/30 bg-destructive/10'
              )}>
                <div className="text-center">
                  <span className={cn("text-2xl sm:text-3xl font-bold", getScoreColor(score))}>
                    {score}
                  </span>
                  <p className="text-[10px] text-muted-foreground">/100</p>
                </div>
              </div>
              <Activity className={cn(
                "absolute -top-1 -right-1 w-5 h-5",
                getScoreColor(score)
              )} />
            </div>
            
            <div className="flex-1 sm:hidden">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span>Saúde da Operação</span>
              </h3>
              <p className={cn("text-sm font-medium", getScoreColor(score))}>
                {getScoreLabel(score)}
              </p>
              <Progress 
                value={score} 
                className="h-2 mt-2" 
              />
            </div>
          </div>

          {/* Desktop Title + Progress */}
          <div className="hidden sm:block flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold">Saúde da Operação</h3>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium",
                score >= 70 ? 'bg-emerald-500/20 text-emerald-500' : 
                score >= 50 ? 'bg-amber-500/20 text-amber-500' : 
                'bg-destructive/20 text-destructive'
              )}>
                {getScoreLabel(score)}
              </span>
            </div>
            <Progress value={score} className="h-3 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Baseado em taxa de recebimento, inadimplência e margem de lucro
            </p>
          </div>
        </div>

        {/* Indicators Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {indicators.map((indicator) => (
            <div 
              key={indicator.label}
              className={cn(
                "p-3 rounded-lg border",
                indicator.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                indicator.status === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                'bg-destructive/5 border-destructive/20'
              )}
            >
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm">{getStatusIcon(indicator.status)}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {indicator.label}
                </span>
              </div>
              <p className={cn("text-sm sm:text-base font-bold", getStatusColor(indicator.status))}>
                {indicator.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
