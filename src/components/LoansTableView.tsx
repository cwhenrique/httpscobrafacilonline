import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MoreHorizontal, CreditCard, Pencil, RefreshCw, Trash2, History, DollarSign, ChevronDown, ChevronUp, Download, TrendingUp, Wallet, PiggyBank } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/calculations';
import { getAvatarUrl } from '@/lib/avatarUtils';
import { Loan } from '@/types/database';
import { toast } from '@/hooks/use-toast';

interface LoansTableViewProps {
  loans: Loan[];
  onPayment: (loanId: string) => void;
  onPayInterest: (loanId: string) => void;
  onEdit: (loanId: string) => void;
  onRenegotiate: (loanId: string) => void;
  onDelete: (loanId: string) => void;
  onViewHistory: (loanId: string) => void;
  getPaidInstallmentsCount: (loan: Loan) => number;
}

export function LoansTableView({
  loans,
  onPayment,
  onPayInterest,
  onEdit,
  onRenegotiate,
  onDelete,
  onViewHistory,
  getPaidInstallmentsCount,
}: LoansTableViewProps) {
  const [sortField, setSortField] = useState<'client' | 'status' | 'amount' | 'remaining' | 'dueDate'>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getNextDueDate = (loan: Loan): string | null => {
    const dates = (loan.installment_dates as string[]) || [];
    const paidCount = getPaidInstallmentsCount(loan);
    if (paidCount < dates.length) {
      return dates[paidCount];
    }
    return loan.due_date;
  };

  const getLoanStatus = (loan: Loan): { status: 'paid' | 'overdue' | 'due_today' | 'pending'; label: string; color: string } => {
    if (loan.status === 'paid' || loan.remaining_balance <= 0) {
      return { status: 'paid', label: 'Pago', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextDueDate = getNextDueDate(loan);
    if (nextDueDate) {
      const dueDate = new Date(nextDueDate + 'T12:00:00');
      dueDate.setHours(0, 0, 0, 0);
      
      if (dueDate < today) {
        return { status: 'overdue', label: 'Atraso', color: 'bg-red-500/10 text-red-600 border-red-500/20' };
      }
      if (dueDate.getTime() === today.getTime()) {
        return { status: 'due_today', label: 'Vence Hoje', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      }
    }

    return { status: 'pending', label: 'Em Dia', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
  };

  const sortedLoans = [...loans].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'client':
        return multiplier * (a.client?.full_name || '').localeCompare(b.client?.full_name || '');
      case 'status': {
        const statusOrder = { overdue: 0, due_today: 1, pending: 2, paid: 3 };
        const statusA = getLoanStatus(a).status;
        const statusB = getLoanStatus(b).status;
        return multiplier * (statusOrder[statusA] - statusOrder[statusB]);
      }
      case 'amount':
        return multiplier * (a.principal_amount - b.principal_amount);
      case 'remaining':
        return multiplier * (a.remaining_balance - b.remaining_balance);
      case 'dueDate': {
        const dateA = getNextDueDate(a) || '';
        const dateB = getNextDueDate(b) || '';
        return multiplier * dateA.localeCompare(dateB);
      }
      default:
        return 0;
    }
  });

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const getPaymentTypeLabel = (type: string | null): string => {
    const types: Record<string, string> = {
      single: 'Único',
      installment: 'Parcelado',
      daily: 'Diário',
      weekly: 'Semanal',
      biweekly: 'Quinzenal',
    };
    return types[type || ''] || type || 'N/A';
  };

  const handleExportCSV = () => {
    const headers = [
      'Cliente',
      'Telefone',
      'Status',
      'Valor Emprestado',
      'Total a Receber',
      'Valor Restante',
      'Parcelas Pagas',
      'Total Parcelas',
      'Próximo Vencimento',
      'Taxa de Juros (%)',
      'Tipo de Pagamento',
      'Data de Início',
      'Notas'
    ];

    const rows = sortedLoans.map(loan => {
      const status = getLoanStatus(loan);
      const paidCount = getPaidInstallmentsCount(loan);
      const nextDue = getNextDueDate(loan);
      const totalAmount = loan.principal_amount * (1 + loan.interest_rate / 100);
      
      return [
        loan.client?.full_name || 'N/A',
        loan.client?.phone || 'N/A',
        status.label,
        loan.principal_amount.toFixed(2).replace('.', ','),
        totalAmount.toFixed(2).replace('.', ','),
        loan.remaining_balance.toFixed(2).replace('.', ','),
        paidCount.toString(),
        (loan.installments || 1).toString(),
        nextDue ? formatDate(nextDue) : 'N/A',
        loan.interest_rate.toString().replace('.', ','),
        getPaymentTypeLabel(loan.payment_type),
        loan.start_date ? formatDate(loan.start_date) : 'N/A',
        (loan.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `emprestimos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportação concluída",
      description: `${loans.length} empréstimo(s) exportado(s) para CSV.`,
    });
  };

  // Calculate totals for the filtered loans
  const totals = useMemo(() => {
    return loans.reduce((acc, loan) => {
      const totalInterest = loan.total_interest || 0;
      const totalToReceive = loan.principal_amount + totalInterest;
      return {
        totalPrincipal: acc.totalPrincipal + loan.principal_amount,
        totalRemaining: acc.totalRemaining + loan.remaining_balance,
        totalPaid: acc.totalPaid + (loan.total_paid || 0),
        totalProfit: acc.totalProfit + totalInterest,
      };
    }, { totalPrincipal: 0, totalRemaining: 0, totalPaid: 0, totalProfit: 0 });
  }, [loans]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Summary Section */}
      {loans.length > 0 && (
        <div className="p-4 border-b bg-muted/20">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Emprestado</p>
                <p className="text-sm font-semibold">{formatCurrency(totals.totalPrincipal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Wallet className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total a Receber</p>
                <p className="text-sm font-semibold">{formatCurrency(totals.totalRemaining)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <span className="text-sm text-muted-foreground">
          {loans.length} empréstimo{loans.length !== 1 ? 's' : ''}
        </span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExportCSV}
          className="gap-2"
          disabled={loans.length === 0}
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead 
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort('client')}
            >
              <div className="flex items-center gap-1">
                Cliente
                <SortIcon field="client" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center gap-1">
                Status
                <SortIcon field="status" />
              </div>
            </TableHead>
            <TableHead 
              className="hidden sm:table-cell cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort('amount')}
            >
              <div className="flex items-center gap-1">
                Emprestado
                <SortIcon field="amount" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort('remaining')}
            >
              <div className="flex items-center gap-1">
                Restante
                <SortIcon field="remaining" />
              </div>
            </TableHead>
            <TableHead className="hidden md:table-cell">Parcelas</TableHead>
            <TableHead 
              className="hidden sm:table-cell cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort('dueDate')}
            >
              <div className="flex items-center gap-1">
                Vencimento
                <SortIcon field="dueDate" />
              </div>
            </TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLoans.map((loan) => {
            const status = getLoanStatus(loan);
            const isPaid = status.status === 'paid';
            const isOverdue = status.status === 'overdue';
            const isDueToday = status.status === 'due_today';
            const numInstallments = loan.installments || 1;
            const paidCount = getPaidInstallmentsCount(loan);
            const nextDueDate = getNextDueDate(loan);
            const initials = loan.client?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';

            return (
              <TableRow 
                key={loan.id}
                className={cn(
                  'transition-colors',
                  isOverdue && 'bg-red-500/5 hover:bg-red-500/10',
                  isDueToday && 'bg-amber-500/5 hover:bg-amber-500/10',
                  isPaid && 'bg-emerald-500/5 hover:bg-emerald-500/10'
                )}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={getAvatarUrl(loan.client?.avatar_url, loan.client?.full_name || 'Cliente')} />
                      <AvatarFallback className="text-xs bg-primary/10">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-[160px]">
                      {loan.client?.full_name || 'Cliente'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('text-xs', status.color)}>
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell font-medium">
                  {formatCurrency(loan.principal_amount)}
                </TableCell>
                <TableCell className={cn('font-semibold', isPaid ? 'text-emerald-600' : isOverdue ? 'text-red-600' : '')}>
                  {formatCurrency(loan.remaining_balance)}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm">
                    {paidCount}/{numInstallments}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">
                  {isPaid ? (
                    <span className="text-muted-foreground">-</span>
                  ) : nextDueDate ? (
                    <span className={cn(isOverdue && 'text-red-600 font-medium', isDueToday && 'text-amber-600 font-medium')}>
                      {formatDate(nextDueDate)}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <TooltipProvider delayDuration={200}>
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p>Ações</p>
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="w-48 bg-popover border">
                        {!isPaid && (
                          <>
                            <DropdownMenuItem onClick={() => onPayment(loan.id)}>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Pagar Parcela
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onPayInterest(loan.id)}>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Pagar Juros
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => onViewHistory(loan.id)}>
                          <History className="w-4 h-4 mr-2" />
                          Histórico
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(loan.id)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {!isPaid && (
                          <DropdownMenuItem onClick={() => onRenegotiate(loan.id)}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Renegociar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(loan.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      {loans.length === 0 && (
        <div className="text-center py-8">
          <DollarSign className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum empréstimo encontrado</p>
        </div>
      )}
    </div>
  );
}
