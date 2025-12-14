import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, Banknote, Calendar, DollarSign, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductSale, ProductSalePayment } from '@/hooks/useProductSales';

interface ProductInstallmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: ProductSale | null;
  payments: ProductSalePayment[];
  onPaymentClick: (payment: ProductSalePayment) => void;
  isPending?: boolean;
}

const formatCurrency = (value: number) => {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

const getStatusBadge = (status: string, dueDate?: string) => {
  if (status === 'paid') {
    return <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Pago</Badge>;
  }
  if (dueDate) {
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) {
      return <Badge variant="destructive" className="text-xs">Atrasado</Badge>;
    }
    if (isToday(date)) {
      return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs">Hoje</Badge>;
    }
  }
  return <Badge variant="secondary" className="text-xs">Pendente</Badge>;
};

export default function ProductInstallmentsDialog({
  open,
  onOpenChange,
  sale,
  payments,
  onPaymentClick,
  isPending,
}: ProductInstallmentsDialogProps) {
  if (!sale) return null;

  const paidCount = payments.filter(p => p.status === 'paid').length;
  const overdueCount = payments.filter(p => 
    p.status !== 'paid' && isPast(parseISO(p.due_date)) && !isToday(parseISO(p.due_date))
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 border-b bg-muted/30">
          <DialogTitle className="text-lg">{sale.product_name}</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-3.5 h-3.5" />
            <span>{sale.client_name}</span>
          </div>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 p-4 border-b">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-bold text-sm">{formatCurrency(sale.total_amount)}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/10">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="font-bold text-sm text-primary">{formatCurrency(sale.total_paid || 0)}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-orange-500/10">
            <p className="text-xs text-muted-foreground">Falta</p>
            <p className="font-bold text-sm text-orange-500">{formatCurrency(sale.remaining_balance)}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 py-2 border-b">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{paidCount} de {sale.installments} parcelas pagas</span>
            {overdueCount > 0 && (
              <span className="text-destructive">{overdueCount} em atraso</span>
            )}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(paidCount / sale.installments) * 100}%` }}
            />
          </div>
        </div>

        {/* Payments List */}
        <div className="max-h-[350px] overflow-y-auto p-4 space-y-2">
          {payments.map((payment) => {
            const isPaid = payment.status === 'paid';
            const isOverdue = !isPaid && isPast(parseISO(payment.due_date)) && !isToday(parseISO(payment.due_date));
            const isDueToday = !isPaid && isToday(parseISO(payment.due_date));

            return (
              <div
                key={payment.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  isPaid && "bg-primary/5 border-primary/20",
                  isOverdue && "bg-destructive/5 border-destructive/30",
                  isDueToday && "bg-yellow-500/5 border-yellow-500/30",
                  !isPaid && !isOverdue && !isDueToday && "bg-muted/30 border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                    isPaid && "bg-primary/20 text-primary",
                    isOverdue && "bg-destructive/20 text-destructive",
                    isDueToday && "bg-yellow-500/20 text-yellow-600",
                    !isPaid && !isOverdue && !isDueToday && "bg-muted text-muted-foreground"
                  )}>
                    {payment.installment_number}
                  </div>
                  <div>
                    <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{format(parseISO(payment.due_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isPaid ? (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      {payment.paid_date && (
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(payment.paid_date), 'dd/MM', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      className="h-8 gap-1.5"
                      onClick={() => onPaymentClick(payment)}
                      disabled={isPending}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Pagar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
