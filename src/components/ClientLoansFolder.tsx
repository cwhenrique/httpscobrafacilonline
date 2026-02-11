import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, AlertTriangle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
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

  const getBorderColor = () => {
    if (group.allPaid) return 'border-primary/40';
    if (group.hasOverdue) return 'border-destructive/40';
    if (group.hasDueToday) return 'border-amber-500/40';
    return 'border-border';
  };

  const getAccentBar = () => {
    if (group.allPaid) return 'bg-primary';
    if (group.hasOverdue) return 'bg-destructive';
    if (group.hasDueToday) return 'bg-amber-500';
    return 'bg-muted-foreground/30';
  };

  const getStatusBadge = () => {
    if (group.allPaid) {
      return (
        <Badge className="bg-primary/15 text-primary border-primary/30 gap-1 text-[10px] px-2 py-0.5">
          <CheckCircle2 className="w-3 h-3" />
          Quitado
        </Badge>
      );
    }
    if (group.hasOverdue) {
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 text-[10px] px-2 py-0.5">
          <AlertTriangle className="w-3 h-3" />
          Atrasado
        </Badge>
      );
    }
    if (group.hasDueToday) {
      return (
        <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 gap-1 text-[10px] px-2 py-0.5">
          <Clock className="w-3 h-3" />
          Vence Hoje
        </Badge>
      );
    }
    if (group.hasPending) {
      return (
        <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 gap-1 text-[10px] px-2 py-0.5">
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

  return (
    <Card 
      className={`overflow-hidden transition-all cursor-pointer hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] relative ${getBorderColor()}`} 
      onClick={onOpen}
    >
      {/* Accent bar on left */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${getAccentBar()} rounded-l-lg`} />
      
      <CardContent className="p-4 pl-5">
        {/* Header: Avatar + Name + Status */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-border shrink-0 shadow-sm">
            <AvatarImage src={avatarUrl} alt={group.client.full_name} />
            <AvatarFallback className="text-xs font-bold bg-muted">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">
              {group.client.full_name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground font-medium">
                {group.loans.length} empréstimo{group.loans.length > 1 ? 's' : ''} nesta pasta
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {getStatusBadge()}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/60 my-3" />

        {/* Financial Summary */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <p className="text-muted-foreground text-[11px]">Emprestado</p>
            <p className="font-semibold">{formatCurrency(group.totalPrincipal)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px]">A Receber</p>
            <p className="font-semibold">{formatCurrency(group.totalToReceive)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px]">Recebido</p>
            <p className="font-semibold text-primary">{formatCurrency(group.totalPaid)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px]">Restante</p>
            <p className="font-semibold">{formatCurrency(group.remainingBalance)}</p>
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-muted/50 text-[11px] text-muted-foreground font-medium">
          <FolderOpen className="w-3 h-3" />
          Toque para abrir a pasta
        </div>
      </CardContent>
    </Card>
  );
}

export type { ClientGroup };
