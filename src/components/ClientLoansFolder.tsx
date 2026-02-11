import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, FolderClosed, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
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
  isExpanded: boolean;
  onToggle: () => void;
  renderLoanCard: (loan: Loan, index: number) => React.ReactNode;
}

export function ClientLoansFolder({ group, isExpanded, onToggle, renderLoanCard }: ClientLoansFolderProps) {
  const initials = getInitials(group.client.full_name);
  const avatarUrl = getAvatarUrl(group.client.avatar_url, group.client.full_name, 64);

  const getBorderColor = () => {
    if (group.allPaid) return 'border-primary/50 bg-primary/5';
    if (group.hasOverdue) return 'border-destructive/50 bg-destructive/5';
    if (group.hasDueToday) return 'border-amber-500/50 bg-amber-500/5';
    return 'border-border';
  };

  const getStatusBadge = () => {
    if (group.allPaid) {
      return (
        <Badge className="bg-primary text-primary-foreground gap-1 text-[10px] px-1.5 py-0">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Quitado
        </Badge>
      );
    }
    if (group.hasOverdue) {
      return (
        <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0">
          <AlertTriangle className="w-2.5 h-2.5" />
          Atrasado
        </Badge>
      );
    }
    if (group.hasDueToday) {
      return (
        <Badge className="bg-amber-500 text-white gap-1 text-[10px] px-1.5 py-0">
          <Clock className="w-2.5 h-2.5" />
          Vence Hoje
        </Badge>
      );
    }
    if (group.hasPending) {
      return (
        <Badge className="bg-blue-500 text-white gap-1 text-[10px] px-1.5 py-0">
          <Clock className="w-2.5 h-2.5" />
          Em Dia
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card className={`overflow-hidden transition-all cursor-pointer ${getBorderColor()}`} onClick={onToggle}>
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9 border-2 border-border shrink-0">
            <AvatarImage src={avatarUrl} alt={group.client.full_name} />
            <AvatarFallback className="text-xs font-semibold bg-muted">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <FolderClosed className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-semibold truncate">
                {group.loans.length} empréstimos
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              de {group.client.full_name}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {getStatusBadge()}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
      
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="border-t bg-muted/20 pt-3 pb-3 px-3">
              <div className="grid grid-cols-1 gap-3">
                {group.loans.map((loan, index) => renderLoanCard(loan, index))}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export type { ClientGroup };
