import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Percent, Hash } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';

interface PaymentsSummary {
  totalReceived: number;
  totalInterest: number;
  totalPrincipal: number;
  count: number;
}

interface PaymentsSummaryCardsProps {
  summary: PaymentsSummary;
  isLoading: boolean;
  compact?: boolean;
}

export function PaymentsSummaryCards({ summary, isLoading, compact }: PaymentsSummaryCardsProps) {
  const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = compact ? 'text-sm sm:text-base' : 'text-lg sm:text-xl';
  const padding = compact ? 'p-2 sm:p-3' : 'p-3 sm:p-4';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      <Card className="shadow-soft">
        <CardContent className={padding}>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className={iconSize} />
            <span className="text-xs font-medium">Total Recebido</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className={`${textSize} font-bold text-green-600 dark:text-green-400`}>
              {formatCurrency(summary.totalReceived)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className={padding}>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className={iconSize} />
            <span className="text-xs font-medium">Juros Recebido</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className={`${textSize} font-bold text-purple-600 dark:text-purple-400`}>
              {formatCurrency(summary.totalInterest)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className={padding}>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Percent className={iconSize} />
            <span className="text-xs font-medium">Principal Pago</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className={`${textSize} font-bold text-blue-600 dark:text-blue-400`}>
              {formatCurrency(summary.totalPrincipal)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className={padding}>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Hash className={iconSize} />
            <span className="text-xs font-medium">Qtd. Pagamentos</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <p className={`${textSize} font-bold`}>
              {summary.count}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
