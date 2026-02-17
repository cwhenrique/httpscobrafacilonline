import { format } from 'date-fns';
import { safeDates } from '@/lib/dateUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, AlertTriangle, CheckCircle2, Clock, ChevronRight, DollarSign } from 'lucide-react';
import { getAvatarUrl, getInitials } from '@/lib/avatarUtils';
import { Client, Loan } from '@/types/database';

interface ClientGroup {
  client: Client;
  loans: Loan[];
  totalPrincipal: number;
  totalToReceive: number;
  totalPaid: number;
  remainingBalance: number;
  hasOverdue: boolean;
  hasPending: boolean;
  hasDueToday: boolean;
  allPaid: boolean;
}

interface ClientLoansFolderProps {
  group: ClientGroup;
  onOpen: () => void;
}

export function ClientLoansFolder({ group, onOpen }: ClientLoansFolderProps) {
  const initials = getInitials(group.client.full_name);
  const avatarUrl = getAvatarUrl(group.client.avatar_url, group.client.full_name, 64);

  const getAccentBar = () => {
    if (group.allPaid) return 'bg-primary';
    if (group.hasOverdue) return 'bg-destructive';
    if (group.hasDueToday) return 'bg-amber-500';
    return 'bg-muted-foreground/30';
  };

  const getBorderColor = () => {
    if (group.allPaid) return 'border-primary/30';
    if (group.hasOverdue) return 'border-destructive/30';
    if (group.hasDueToday) return 'border-amber-500/30';
    return 'border-border';
  };

  const getStatusBadge = () => {
    if (group.allPaid) {
      return (
        <Badge className="bg-primary/15 text-primary border-primary/30 gap-1 text-[11px] px-2 py-0.5">
          <CheckCircle2 className="w-3 h-3" />
          Quitado
        </Badge>
      );
    }
    if (group.hasOverdue) {
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 text-[11px] px-2 py-0.5">
          <AlertTriangle className="w-3 h-3" />
          Atrasado
        </Badge>
      );
    }
    if (group.hasDueToday) {
      return (
        <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 gap-1 text-[11px] px-2 py-0.5">
          <Clock className="w-3 h-3" />
          Vence Hoje
        </Badge>
      );
    }
    if (group.hasPending) {
      return (
        <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 gap-1 text-[11px] px-2 py-0.5">
          <Clock className="w-3 h-3" />
          Em Dia
        </Badge>
      );
    }
    return null;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const lucroEstimado = group.totalToReceive - group.totalPrincipal;

  // Get mini summaries for each loan
  const loanSummaries = group.loans.map(loan => {
    const isPaid = loan.remaining_balance <= 0.01;
    const dates = safeDates(loan.installment_dates);
    let nextDue: string | null = null;
    
    if (!isPaid && dates.length > 0) {
      // Find first unpaid date (approximate)
      const paidCount = Math.floor(((loan.total_paid || 0) / ((loan.principal_amount + (loan.total_interest || 0)) / (loan.installments || 1))) + 0.01);
      const idx = Math.min(paidCount, dates.length - 1);
      if (idx < dates.length) {
        nextDue = dates[idx];
      }
    }

    return {
      id: loan.id,
      principal: loan.principal_amount,
      remaining: loan.remaining_balance,
      isPaid,
      nextDue,
      interestRate: loan.interest_rate,
      paymentType: loan.payment_type,
    };
  });

  return (
    <Card 
      className={`overflow-hidden transition-all cursor-pointer hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] relative ${getBorderColor()}`} 
      onClick={onOpen}
    >
      {/* Accent bar on left */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${getAccentBar()} rounded-l-lg`} />
      
      <CardContent className="p-0">
        {/* Header section */}
        <div className="p-4 pb-3 pl-5">
          {/* Nome do cliente - linha 1, centralizado, fonte maior */}
          <p className="text-base sm:text-lg font-bold text-center w-full break-words leading-tight bg-accent/60 border border-border rounded-lg py-1.5 px-3">
            {group.client.full_name}
          </p>

          {/* Avatar + Badges - linha 2 */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <Avatar className="h-11 w-11 border-2 border-border shrink-0 shadow-sm">
              <AvatarImage src={avatarUrl} alt={group.client.full_name} />
              <AvatarFallback className="text-sm font-bold bg-muted">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Badge variant="outline" className="gap-1 text-[11px] px-2 py-0.5 bg-accent/50 border-border">
              <FolderOpen className="w-3 h-3" />
              📂 {group.loans.length} empréstimo{group.loans.length > 1 ? 's' : ''}
            </Badge>
            {getStatusBadge()}
          </div>

          {/* Main amount */}
          <div className="mt-3 text-center">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">
              {formatCurrency(group.remainingBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">restante a receber</p>
          </div>
        </div>

        {/* Financial details */}
        <div className="bg-muted/30 border-t border-border/50 px-5 py-3">
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <p className="text-[11px] text-muted-foreground">Emprestado</p>
              <p className="text-sm font-semibold">{formatCurrency(group.totalPrincipal)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Total a Receber</p>
              <p className="text-sm font-semibold">{formatCurrency(group.totalToReceive)}</p>
            </div>
          </div>
        </div>

        {/* Profit row */}
        <div className="border-t border-border/50 px-5 py-3">
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <p className="text-[11px] text-muted-foreground">💰 Lucro Previsto</p>
              <p className="text-sm font-semibold">{formatCurrency(lucroEstimado)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">✅ Recebido</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(group.totalPaid)}</p>
            </div>
          </div>
        </div>

        {/* Mini loan list */}
        <div className="border-t border-border/50 px-5 py-3">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Empréstimos na pasta</p>
          <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {loanSummaries.map((loan) => (
              <div key={loan.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded-md bg-muted/30">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-medium">
                      {formatCurrency(loan.principal)}
                    </span>
                    {loan.nextDue && !loan.isPaid && (
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        • Venc: {format(new Date(loan.nextDue + 'T12:00:00'), 'dd/MM/yy')}
                      </span>
                    )}
                  </div>
                  <Badge 
                    variant={loan.isPaid ? 'default' : 'outline'} 
                    className={`text-[9px] px-1.5 py-0 shrink-0 ${
                      loan.isPaid 
                        ? 'bg-primary/15 text-primary border-primary/30' 
                        : loan.remaining === loan.principal 
                          ? 'text-muted-foreground' 
                          : 'text-foreground'
                    }`}
                  >
                    {loan.isPaid ? 'Quitado' : formatCurrency(loan.remaining)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open folder CTA */}
        <div className="border-t border-border/50 px-5 py-3.5 flex items-center justify-center rounded-b-lg">
          <div className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 px-4 rounded-lg shadow-md hover:bg-primary/90 transition-colors">
            <FolderOpen className="w-4 h-4" />
            <span>Abrir Pasta</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { ClientGroup };
