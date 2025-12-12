import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, CheckCircle, AlertTriangle, PiggyBank } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  label: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  positive?: boolean;
  color: 'primary' | 'success' | 'warning' | 'destructive';
}

function SummaryCard({ label, value, change, icon: Icon, positive = true, color }: SummaryCardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-emerald-500 bg-emerald-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    destructive: 'text-destructive bg-destructive/10',
  };

  const valueColors = {
    primary: 'text-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    destructive: 'text-destructive',
  };

  return (
    <Card className="shadow-soft hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate mb-1">{label}</p>
            <p className={cn("text-lg sm:text-xl font-bold truncate", valueColors[color])}>
              {formatCurrency(value)}
            </p>
            {change !== undefined && (
              <div className={cn(
                "flex items-center gap-1 mt-1",
                positive ? (change >= 0 ? 'text-emerald-500' : 'text-destructive') : 
                         (change <= 0 ? 'text-emerald-500' : 'text-destructive')
              )}>
                {(positive ? change >= 0 : change <= 0) ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span className="text-[10px] sm:text-xs font-medium">
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className={cn("p-2 rounded-lg shrink-0", colorClasses[color])}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ConsolidatedSummaryProps {
  totalToReceive: number;
  totalReceived: number;
  totalProfit: number;
  totalOverdue: number;
  receivedChange?: number;
  overdueChange?: number;
}

export function ConsolidatedSummary({
  totalToReceive,
  totalReceived,
  totalProfit,
  totalOverdue,
  receivedChange = 0,
  overdueChange = 0,
}: ConsolidatedSummaryProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <SummaryCard
        label="Total a Receber"
        value={totalToReceive}
        icon={DollarSign}
        color="primary"
      />
      <SummaryCard
        label="Total Recebido"
        value={totalReceived}
        change={receivedChange}
        icon={CheckCircle}
        color="success"
        positive={true}
      />
      <SummaryCard
        label="Lucro Total"
        value={totalProfit}
        icon={PiggyBank}
        color={totalProfit >= 0 ? 'success' : 'destructive'}
      />
      <SummaryCard
        label="Em Atraso"
        value={totalOverdue}
        change={overdueChange}
        icon={AlertTriangle}
        color="destructive"
        positive={false}
      />
    </div>
  );
}
