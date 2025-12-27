import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
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

  const getStatusBadge = () => {
    if (group.allPaid) {
      return (
        <Badge className="bg-primary text-primary-foreground gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Quitado
        </Badge>
      );
    }
    if (group.hasOverdue) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          Atrasado
        </Badge>
      );
    }
    if (group.hasPending) {
      return (
        <Badge className="bg-blue-500 text-white gap-1">
          <Clock className="w-3 h-3" />
          Em Dia
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card className={`overflow-hidden transition-all ${
      group.hasOverdue ? 'border-destructive/50' : 
      group.allPaid ? 'border-primary/50 bg-primary/5' : 
      'border-border'
    }`}>
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-border">
            <AvatarImage src={avatarUrl} alt={group.client.full_name} />
            <AvatarFallback className="text-sm font-semibold bg-muted">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
              <h3 className="font-semibold text-sm sm:text-base truncate">
                {group.client.full_name}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {group.loans.length} {group.loans.length === 1 ? 'contrato' : 'contratos'}
              </Badge>
              {getStatusBadge()}
            </div>
            
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground mt-1.5">
              <span>
                <span className="text-muted-foreground/70">Emprestado:</span>{' '}
                <span className="font-medium text-foreground">{formatCurrency(group.totalPrincipal)}</span>
              </span>
              <span>
                <span className="text-muted-foreground/70">A Receber:</span>{' '}
                <span className={`font-medium ${group.remainingBalance > 0 ? 'text-amber-500' : 'text-primary'}`}>
                  {formatCurrency(group.remainingBalance)}
                </span>
              </span>
              <span>
                <span className="text-muted-foreground/70">Recebido:</span>{' '}
                <span className="font-medium text-primary">{formatCurrency(group.totalPaid)}</span>
              </span>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" className="shrink-0">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <CardContent className="border-t bg-muted/20 pt-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
