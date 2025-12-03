import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calculateScoreLabel, getScoreIcon } from '@/hooks/useClientScore';
import { formatCurrency } from '@/lib/calculations';

interface ClientScoreBadgeProps {
  score: number;
  totalLoans?: number;
  totalPaid?: number;
  onTimePayments?: number;
  latePayments?: number;
  showDetails?: boolean;
}

export function ClientScoreBadge({ 
  score, 
  totalLoans = 0, 
  totalPaid = 0, 
  onTimePayments = 0, 
  latePayments = 0,
  showDetails = false 
}: ClientScoreBadgeProps) {
  const { label, color } = calculateScoreLabel(score);
  const icon = getScoreIcon(score);

  const getTrendIcon = () => {
    if (score >= 100) return <TrendingUp className="w-3 h-3" />;
    if (score >= 70) return <Minus className="w-3 h-3" />;
    return <TrendingDown className="w-3 h-3" />;
  };

  if (showDetails) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge className={`${color} gap-1 font-semibold`}>
            <span>{icon}</span>
            <span>{score}</span>
            {getTrendIcon()}
          </Badge>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Empréstimos: {totalLoans}</div>
          <div>Total pago: {formatCurrency(totalPaid)}</div>
          <div className="text-green-600">Em dia: {onTimePayments}</div>
          <div className="text-red-600">Atrasados: {latePayments}</div>
        </div>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`${color} gap-1 cursor-help`}>
          <span>{icon}</span>
          <span>{score}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-semibold">{label}</p>
          <p className="text-xs">Empréstimos: {totalLoans}</p>
          <p className="text-xs text-green-400">Em dia: {onTimePayments}</p>
          <p className="text-xs text-red-400">Atrasados: {latePayments}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
