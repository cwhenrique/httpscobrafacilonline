import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';

export interface PaymentRecord {
  id: string;
  loan_id: string;
  amount: number;
  principal_paid: number;
  interest_paid: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
  client_name: string;
  created_by: string;
  payment_type: 'normal' | 'interest_only' | 'partial_interest' | 'amortization' | 'installment' | 'historical';
  loan_payment_type?: string;
}

export const getPaymentType = (notes: string | null): PaymentRecord['payment_type'] => {
  if (!notes) return 'normal';
  if (notes.includes('[INTEREST_ONLY_PAYMENT]')) return 'interest_only';
  if (notes.includes('[PARTIAL_INTEREST_PAYMENT]')) return 'partial_interest';
  if (notes.includes('[AMORTIZATION]')) return 'amortization';
  if (notes.includes('[HISTORICAL_INTEREST]')) return 'historical';
  if (notes.match(/Parcela \d+ de \d+/)) return 'installment';
  return 'normal';
};

const getPaymentTypeLabel = (type: PaymentRecord['payment_type']): string => {
  switch (type) {
    case 'interest_only': return 'Só Juros';
    case 'partial_interest': return 'Juros Parcial';
    case 'amortization': return 'Amortização';
    case 'installment': return 'Parcela';
    case 'historical': return 'Juros Histórico';
    default: return 'Pagamento';
  }
};

const getPaymentTypeBadgeClass = (type: PaymentRecord['payment_type']): string => {
  switch (type) {
    case 'interest_only': return 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30';
    case 'partial_interest': return 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30';
    case 'amortization': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30';
    case 'installment': return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30';
    case 'historical': return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30';
    default: return 'bg-muted text-muted-foreground border-muted';
  }
};

const extractInstallmentNumber = (notes: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/Parcela (\d+ de \d+)/);
  return match ? match[1] : null;
};

interface PaymentsTableProps {
  payments: PaymentRecord[];
  maxHeight?: string;
  emptyMessage?: string;
}

export function PaymentsTable({ payments, maxHeight = '500px', emptyMessage }: PaymentsTableProps) {
  if (payments.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">{emptyMessage || 'Nenhum pagamento registrado neste período.'}</p>
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">Data</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="hidden sm:table-cell">Tipo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => {
            const installmentNum = extractInstallmentNumber(payment.notes);
            return (
              <TableRow key={payment.id}>
                <TableCell className="text-sm whitespace-nowrap">
                  {format(parseISO(payment.payment_date), 'dd/MM', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm truncate max-w-[150px] sm:max-w-none">
                      {payment.client_name}
                    </span>
                    {installmentNum && (
                      <span className="text-xs text-muted-foreground">
                        Parcela {installmentNum}
                      </span>
                    )}
                    <div className="sm:hidden mt-1">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0", getPaymentTypeBadgeClass(payment.payment_type))}
                      >
                        {getPaymentTypeLabel(payment.payment_type)}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(payment.amount)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getPaymentTypeBadgeClass(payment.payment_type))}
                  >
                    {getPaymentTypeLabel(payment.payment_type)}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
