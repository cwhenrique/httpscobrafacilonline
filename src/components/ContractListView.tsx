import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSignature, Check, Trash2, AlertTriangle, Clock, CheckCircle, Calendar, Car, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contract, ContractPayment } from '@/hooks/useContracts';

interface ContractListViewProps {
  contracts: Contract[];
  allContractPayments: ContractPayment[];
  getContractStatus: (contract: Contract) => string;
  formatCurrency: (value: number) => string;
  onOpenPaymentDialog: (payment: ContractPayment, contract: Contract) => void;
  onDelete: (id: string) => void;
  onEdit: (contract: Contract) => void;
}

export default function ContractListView({
  contracts,
  allContractPayments,
  getContractStatus,
  formatCurrency,
  onOpenPaymentDialog,
  onDelete,
  onEdit,
}: ContractListViewProps) {

  const getNextPendingPayment = (contractId: string) => {
    return allContractPayments
      .filter(p => p.contract_id === contractId && p.status !== 'paid')
      .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime())[0];
  };

  const getPaidCount = (contractId: string) => {
    return allContractPayments.filter(p => p.contract_id === contractId && p.status === 'paid').length;
  };

  if (contracts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileSignature className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum contrato encontrado</h3>
          <p className="text-muted-foreground">Crie contratos de aluguel ou mensalidades.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-primary" />
          Contratos ({contracts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Parcela</TableHead>
                <TableHead className="text-center hidden md:table-cell">Progresso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => {
                const status = getContractStatus(contract);
                const nextPayment = getNextPendingPayment(contract.id);
                const paidCount = getPaidCount(contract.id);
                const isOverdue = status === 'overdue';
                const isDueToday = status === 'due_today';
                const isDueThisMonth = status === 'due_this_month';

                return (
                  <TableRow
                    key={contract.id}
                    className={cn(
                      "transition-colors h-14",
                      isOverdue && "bg-destructive/10 hover:bg-destructive/15",
                      isDueToday && "bg-orange-500/15 hover:bg-orange-500/20",
                      isDueThisMonth && "bg-yellow-400/10 hover:bg-yellow-400/15",
                      status === 'paid' && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    {/* Status */}
                    <TableCell>
                      <div className="flex justify-center">
                        {isOverdue && (
                          <div className="bg-destructive text-destructive-foreground rounded-full p-1.5">
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                        )}
                        {isDueToday && (
                          <div className="bg-orange-500 text-white rounded-full p-1.5">
                            <Clock className="w-3 h-3" />
                          </div>
                        )}
                        {isDueThisMonth && (
                          <div className="bg-yellow-400 text-white rounded-full p-1.5">
                            <Calendar className="w-3 h-3" />
                          </div>
                        )}
                        {status === 'paid' && (
                          <div className="bg-primary text-primary-foreground rounded-full p-1.5">
                            <CheckCircle className="w-3 h-3" />
                          </div>
                        )}
                        {status === 'pending' && (
                          <div className="bg-muted text-muted-foreground rounded-full p-1.5">
                            <Clock className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Cliente */}
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          {contract.contract_type === 'aluguel_veiculo' ? (
                            <Car className="w-4 h-4 text-primary" />
                          ) : (
                            <FileSignature className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{contract.client_name}</p>
                            {contract.client_phone && (
                              <a
                                href={`https://wa.me/55${contract.client_phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-500 shrink-0"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {contract.contract_type === 'aluguel_veiculo' ? 'Aluguel de Veículo' : 
                             contract.contract_type === 'aluguel' ? 'Aluguel' : 
                             contract.contract_type === 'servico' ? 'Serviço' : 'Outro'}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Tipo */}
                    <TableCell className="text-center hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {formatCurrency(contract.total_amount)}/mês
                      </Badge>
                    </TableCell>

                    {/* Valor Total */}
                    <TableCell className="text-right">
                      <p className="font-bold text-primary">{formatCurrency(contract.amount_to_receive)}</p>
                    </TableCell>

                    {/* Parcela Atual */}
                    <TableCell className="text-center hidden sm:table-cell">
                      {nextPayment ? (
                        <div>
                          <p className="font-medium text-sm">
                            {nextPayment.installment_number}ª - {format(parseISO(nextPayment.due_date), 'dd/MM', { locale: ptBR })}
                          </p>
                          {isOverdue && nextPayment && (
                            <p className="text-xs text-destructive">
                              {Math.floor((new Date().getTime() - parseISO(nextPayment.due_date).getTime()) / (1000 * 60 * 60 * 24))}d atraso
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Quitado</Badge>
                      )}
                    </TableCell>

                    {/* Progresso */}
                    <TableCell className="text-center hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {paidCount}/{contract.installments}
                      </Badge>
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {status !== 'paid' && nextPayment && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => onOpenPaymentDialog(nextPayment, contract)}
                          >
                            <Check className="w-3 h-3" />
                            Pagar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onEdit(contract)}
                        >
                          <FileSignature className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => onDelete(contract.id)}
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
