import { format, differenceInDays, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  User,
  CreditCard,
  Calendar,
  TrendingUp,
  CheckCircle2,
  RotateCcw,
  DollarSign,
  Edit,
  Trash2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  CheckDiscount,
  getStatusLabel,
} from '@/types/checkDiscount';
import {
  SendCheckOverdueNotification,
  SendCheckDueTodayNotification,
  SendCheckEarlyNotification,
} from './CheckDiscountNotifications';

interface CheckDiscountCardProps {
  check: CheckDiscount;
  onCompensate: (check: CheckDiscount) => void;
  onReturn: (check: CheckDiscount) => void;
  onPayment: (check: CheckDiscount) => void;
  onEdit: (check: CheckDiscount) => void;
  onDelete: (check: CheckDiscount) => void;
  formatCurrency: (value: number) => string;
  formatCPFCNPJ: (value: string) => string;
}

// Helper to parse date string locally (avoiding timezone issues)
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function CheckDiscountCard({
  check,
  onCompensate,
  onReturn,
  onPayment,
  onEdit,
  onDelete,
  formatCurrency,
  formatCPFCNPJ,
}: CheckDiscountCardProps) {
  // Calculate days difference properly (can be negative for overdue)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseLocalDate(check.due_date);
  const daysUntilDue = differenceInDays(dueDate, today);
  const isOverdue = daysUntilDue < 0 && check.status === 'in_wallet';
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7 && check.status === 'in_wallet';
  const isPaid = check.status === 'compensated';
  const isReturned = check.status === 'returned';
  const isInCollection = check.status === 'in_collection';

  // Calculate profit
  const profit = check.purchase_value && check.purchase_value > 0
    ? check.nominal_value - check.purchase_value
    : check.discount_amount;

  const profitRate = check.purchase_value && check.purchase_value > 0
    ? (profit / check.purchase_value) * 100
    : 0;

  // Card border/background styles based on status - more visible colors
  const getCardStyles = () => {
    if (isPaid) {
      return 'border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10';
    }
    if (isOverdue || isReturned) {
      return 'border-red-500 bg-red-500/5 hover:bg-red-500/10';
    }
    if (isInCollection) {
      return 'border-orange-500 bg-orange-500/5 hover:bg-orange-500/10';
    }
    if (isDueSoon) {
      return 'border-amber-500 bg-amber-500/5 hover:bg-amber-500/10';
    }
    return 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10';
  };

  // Status badge styles
  const getStatusBadge = () => {
    if (isPaid) {
      return (
        <Badge className="bg-green-600 hover:bg-green-600 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Quitado
        </Badge>
      );
    }
    if (isOverdue) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Atrasado ({Math.abs(daysUntilDue)}d)
        </Badge>
      );
    }
    if (isReturned) {
      return (
        <Badge variant="destructive">
          <RotateCcw className="h-3 w-3 mr-1" />
          Devolvido
        </Badge>
      );
    }
    if (isInCollection) {
      return (
        <Badge className="bg-orange-600 hover:bg-orange-600 text-white">
          <Clock className="h-3 w-3 mr-1" />
          Em Cobrança
        </Badge>
      );
    }
    if (isDueSoon) {
      return (
        <Badge className="bg-yellow-600 hover:bg-yellow-600 text-white">
          <Clock className="h-3 w-3 mr-1" />
          Vence em {daysUntilDue}d
        </Badge>
      );
    }
    return (
      <Badge className="bg-primary/80 hover:bg-primary/80">
        Em Carteira
      </Badge>
    );
  };

  return (
    <Card className={`transition-all ${getCardStyles()}`}>
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {/* Header Row: Status + Check Number + Bank - Compact */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <span className="font-mono font-bold text-sm">#{check.check_number}</span>
            </div>
            
            {/* Due Date */}
            <div className="flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                {format(new Date(check.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
              </span>
            </div>
          </div>
          
          {/* Bank */}
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Building2 className="h-3 w-3" />
            {check.bank_name}
          </div>

          {/* Client / Issuer Info - Compact */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {check.clients && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {check.clients.full_name}
              </span>
            )}
            {check.issuer_name && (
              <span className="flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                {check.issuer_name}
              </span>
            )}
          </div>

          {/* Values Row - Compact Grid for Mobile */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* Nominal Value */}
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground">Valor</span>
              <span className="text-sm font-bold">{formatCurrency(check.nominal_value)}</span>
            </div>

            {/* Purchase Value */}
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground">Compra</span>
              <span className="text-sm font-medium">
                {check.purchase_value && check.purchase_value > 0 
                  ? formatCurrency(check.purchase_value) 
                  : '-'}
              </span>
            </div>

            {/* Profit */}
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <TrendingUp className="h-2.5 w-2.5" />
                Lucro
              </span>
              <span className="text-sm font-bold text-emerald-600">
                {formatCurrency(profit)}
                {profitRate > 0 && (
                  <span className="text-[9px] ml-0.5 font-normal">({profitRate.toFixed(0)}%)</span>
                )}
              </span>
            </div>
          </div>

          {/* Debt info for returned/in_collection checks - Compact */}
          {(isReturned || isInCollection) && check.total_debt && check.total_debt > 0 && (
            <div className="grid grid-cols-3 gap-2 text-xs bg-red-500/10 p-2 rounded-md">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">Dívida</span>
                <span className="font-medium text-red-600">{formatCurrency(check.total_debt)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">Pago</span>
                <span className="font-medium text-emerald-600">{formatCurrency(check.total_paid_debt || 0)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">Restante</span>
                <span className="font-medium text-orange-600">
                  {formatCurrency((check.total_debt || 0) - (check.total_paid_debt || 0))}
                </span>
              </div>
            </div>
          )}

          {/* WhatsApp Notification Buttons */}
          {check.status === 'in_wallet' && check.clients?.phone && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {isOverdue && (
                <SendCheckOverdueNotification check={check} daysUntilDue={daysUntilDue} />
              )}
              {daysUntilDue === 0 && !isOverdue && (
                <SendCheckDueTodayNotification check={check} daysUntilDue={daysUntilDue} />
              )}
              {daysUntilDue > 0 && daysUntilDue <= 7 && (
                <SendCheckEarlyNotification check={check} daysUntilDue={daysUntilDue} />
              )}
            </div>
          )}

          {/* Actions Row - Compact */}
          <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/30">
            <div className="flex items-center gap-1">
              {check.status === 'in_wallet' && (
                <>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2"
                    onClick={() => onCompensate(check)}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Compensar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50 h-7 text-xs px-2"
                    onClick={() => onReturn(check)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Devolver
                  </Button>
                </>
              )}
              {check.status === 'in_collection' && (
                <Button
                  size="sm"
                  className="bg-primary h-7 text-xs px-2"
                  onClick={() => onPayment(check)}
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Receber
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => onEdit(check)}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                onClick={() => onDelete(check)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
