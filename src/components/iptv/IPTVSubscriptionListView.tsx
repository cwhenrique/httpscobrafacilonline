import { useMemo } from 'react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tv, Check, Trash2, AlertTriangle, Clock, CheckCircle, Phone, MessageCircle, History, Server, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MonthlyFee, MonthlyFeePayment } from '@/hooks/useMonthlyFees';

interface IPTVSubscriptionListViewProps {
  subscriptions: MonthlyFee[];
  payments: MonthlyFeePayment[];
  getSubscriptionStatus: (fee: MonthlyFee) => 'overdue' | 'due_today' | 'pending' | 'paid' | 'no_charge' | 'inactive';
  getNextPendingPayment: (feeId: string) => MonthlyFeePayment | undefined;
  calculateWithInterest: (payment: MonthlyFeePayment, interestRate: number) => number;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onOpenPaymentDialog: (paymentId: string, amount: number, feeId: string) => void;
  onOpenHistory: (fee: MonthlyFee) => void;
  formatCurrency: (value: number) => string;
}

const getClientInitials = (name: string) => {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
};

export default function IPTVSubscriptionListView({
  subscriptions,
  payments,
  getSubscriptionStatus,
  getNextPendingPayment,
  calculateWithInterest,
  onToggleActive,
  onDelete,
  onOpenPaymentDialog,
  onOpenHistory,
  formatCurrency,
}: IPTVSubscriptionListViewProps) {
  // Get active months count for a subscription
  const getActiveMonths = (feeId: string) => {
    return payments.filter(p => p.monthly_fee_id === feeId && p.status === 'paid').length;
  };

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Tv className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma assinatura encontrada</h3>
          <p className="text-muted-foreground">Cadastre sua primeira assinatura IPTV ou mensalidade.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Tv className="w-4 h-4 text-primary" />
          Assinaturas ({subscriptions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Vencimento</TableHead>
                <TableHead className="text-center hidden md:table-cell">Meses</TableHead>
                <TableHead className="text-center hidden lg:table-cell">Servidor</TableHead>
                <TableHead className="text-center">Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((fee) => {
                const status = getSubscriptionStatus(fee);
                const currentPayment = getNextPendingPayment(fee.id);
                const amountWithInterest = currentPayment && fee.interest_rate 
                  ? calculateWithInterest(currentPayment, fee.interest_rate)
                  : currentPayment?.amount || fee.amount;
                const activeMonths = getActiveMonths(fee.id);

                return (
                    <TableRow 
                    key={fee.id}
                    className={cn(
                      "transition-colors h-14",
                      !fee.is_active && "opacity-60",
                      status === 'overdue' && "bg-destructive/5 hover:bg-destructive/10",
                      status === 'due_today' && "bg-yellow-500/5 hover:bg-yellow-500/10",
                      status === 'paid' && "bg-green-500/5 hover:bg-green-500/10"
                    )}
                    style={fee.card_color ? { borderLeftWidth: '4px', borderLeftColor: fee.card_color } : undefined}
                  >
                    {/* Status */}
                    <TableCell>
                      <div className="flex justify-center">
                        {status === 'overdue' && (
                          <div className="bg-destructive text-destructive-foreground rounded-full p-1.5">
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                        )}
                        {status === 'due_today' && (
                          <div className="bg-yellow-500 text-white rounded-full p-1.5">
                            <Clock className="w-3 h-3" />
                          </div>
                        )}
                        {status === 'paid' && (
                          <div className="bg-green-500 text-white rounded-full p-1.5">
                            <CheckCircle className="w-3 h-3" />
                          </div>
                        )}
                        {(status === 'pending' || status === 'no_charge') && (
                          <div className="bg-muted text-muted-foreground rounded-full p-1.5">
                            <Clock className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Cliente */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-purple-500/20 text-purple-500 text-xs font-medium">
                            {fee.client ? getClientInitials(fee.client.full_name) : '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{fee.client?.full_name || 'Cliente'}</p>
                            {fee.client?.phone && (
                              <a 
                                href={`https://wa.me/55${fee.client.phone.replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-500 shrink-0"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{fee.description || 'Assinatura'}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Valor */}
                    <TableCell className="text-right">
                      <div>
                        <p className="font-bold text-primary">{formatCurrency(fee.amount)}</p>
                        {status === 'overdue' && amountWithInterest > fee.amount && (
                          <p className="text-xs text-destructive">
                            c/ juros: {formatCurrency(amountWithInterest)}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Vencimento */}
                    <TableCell className="text-center hidden sm:table-cell">
                      <div>
                        <p className="font-medium text-sm">
                          {currentPayment 
                            ? format(parseISO(currentPayment.due_date), 'dd/MM', { locale: ptBR }) 
                            : `Dia ${fee.due_day}`}
                        </p>
                        {status === 'overdue' && currentPayment && (
                          <p className="text-xs text-destructive">
                            {Math.floor((new Date().getTime() - new Date(currentPayment.due_date).getTime()) / (1000 * 60 * 60 * 24))}d atraso
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Meses Ativos */}
                    <TableCell className="text-center hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {activeMonths} {activeMonths === 1 ? 'mês' : 'meses'}
                      </Badge>
                    </TableCell>

                    {/* Servidor */}
                    <TableCell className="text-center hidden lg:table-cell">
                      {fee.iptv_server_name ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs text-muted-foreground">{fee.iptv_server_name}</span>
                          {fee.iptv_server_url && (
                            <a 
                              href={fee.iptv_server_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Toggle Ativa */}
                    <TableCell className="text-center">
                      <Switch
                        checked={fee.is_active}
                        onCheckedChange={(checked) => onToggleActive(fee.id, checked)}
                      />
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {status !== 'paid' && currentPayment && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => onOpenPaymentDialog(currentPayment.id, amountWithInterest, fee.id)}
                          >
                            <Check className="w-3 h-3" />
                            Pagar
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0"
                          onClick={() => onOpenHistory(fee)}
                        >
                          <History className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive" 
                          onClick={() => onDelete(fee.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
