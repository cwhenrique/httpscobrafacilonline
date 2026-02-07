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

  // Card border/background styles based on status
  const getCardStyles = () => {
    if (isPaid) {
      return 'border-green-500/50 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-900/10';
    }
    if (isOverdue || isReturned) {
      return 'border-destructive/50 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-900/10';
    }
    if (isInCollection) {
      return 'border-orange-500/50 bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-900/10';
    }
    if (isDueSoon) {
      return 'border-yellow-500/50 bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/10';
    }
    return '';
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
    <Card className={`transition-all hover:shadow-md ${getCardStyles()}`}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header Row: Status + Check Number + Bank */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge()}
              <span className="font-mono font-bold text-lg">#{check.check_number}</span>
              <span className="flex items-center gap-1 text-muted-foreground text-sm">
                <Building2 className="h-4 w-4" />
                {check.bank_name}
              </span>
            </div>
            
            {/* Due Date */}
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className={isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                {format(new Date(check.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
              </span>
            </div>
          </div>

          {/* Client / Issuer Info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {check.clients && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {check.clients.full_name}
              </span>
            )}
            {check.issuer_name && (
              <span className="flex items-center gap-1">
                <CreditCard className="h-4 w-4" />
                {check.issuer_name}
                {check.issuer_document && ` (${formatCPFCNPJ(check.issuer_document)})`}
              </span>
            )}
            {check.seller_name && (
              <span className="flex items-center gap-1 text-primary/80">
                Vendedor: {check.seller_name}
              </span>
            )}
          </div>

          {/* Values Row */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Nominal Value */}
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Valor do Cheque</span>
              <span className="text-lg font-bold">{formatCurrency(check.nominal_value)}</span>
            </div>

            {/* Purchase Value */}
            {check.purchase_value && check.purchase_value > 0 && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Comprado por</span>
                <span className="text-lg font-medium">{formatCurrency(check.purchase_value)}</span>
              </div>
            )}

            {/* Profit */}
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Lucro
              </span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(profit)}
                {profitRate > 0 && (
                  <span className="text-xs ml-1 font-normal">({profitRate.toFixed(1)}%)</span>
                )}
              </span>
            </div>
          </div>

          {/* Debt info for returned/in_collection checks */}
          {(isReturned || isInCollection) && check.total_debt && check.total_debt > 0 && (
            <div className="flex items-center gap-4 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg flex-wrap">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Dívida Total</span>
                <span className="font-medium text-destructive">{formatCurrency(check.total_debt)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Pago</span>
                <span className="font-medium text-green-600">{formatCurrency(check.total_paid_debt || 0)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Restante</span>
                <span className="font-medium text-orange-600">
                  {formatCurrency((check.total_debt || 0) - (check.total_paid_debt || 0))}
                </span>
              </div>
              {check.installments_count > 1 && (
                <Badge variant="outline">{check.installments_count}x</Badge>
              )}
            </div>
          )}

          {/* Actions Row */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50 flex-wrap">
            {check.status === 'in_wallet' && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onCompensate(check)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Compensar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={() => onReturn(check)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Devolver
                </Button>
              </>
            )}
            {check.status === 'in_collection' && (
              <Button
                size="sm"
                className="bg-primary"
                onClick={() => onPayment(check)}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Receber
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(check)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(check)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
