import { useState, useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useThirdPartyLoans } from '@/hooks/useThirdPartyLoans';
import { useClients } from '@/hooks/useClients';
import { InterestType, LoanPaymentType, Loan } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, isLoanOverdue, getDaysOverdue } from '@/lib/calculations';
import { format as formatDateFns } from 'date-fns';
import { ClientSelector } from '@/components/ClientSelector';
import { Plus, Search, Trash2, DollarSign, User, Calendar as CalendarIcon, Percent, Building2, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getAvatarUrl } from '@/lib/avatarUtils';

export default function ThirdPartyLoans() {
  const { loans, loading, createLoan, registerPayment, deleteLoan } = useThirdPartyLoans();
  const { clients } = useClients();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'simple' as InterestType,
    interest_mode: 'on_total' as 'per_installment' | 'on_total' | 'compound',
    payment_type: 'installment' as LoanPaymentType,
    installments: '1',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
    notes: '',
    third_party_name: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  // Filter loans
  const filteredLoans = useMemo(() => {
    let filtered = loans;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(loan => 
        loan.client?.full_name?.toLowerCase().includes(search) ||
        (loan as any).third_party_name?.toLowerCase().includes(search)
      );
    }
    
    if (statusFilter !== 'all') {
      if (statusFilter === 'overdue') {
        filtered = filtered.filter(loan => loan.status !== 'paid' && isLoanOverdue(loan));
      } else {
        filtered = filtered.filter(loan => loan.status === statusFilter);
      }
    }
    
    return filtered;
  }, [loans, searchTerm, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const active = loans.filter(l => l.status !== 'paid');
    const overdue = active.filter(l => isLoanOverdue(l));
    const totalPending = active.reduce((sum, l) => sum + Number(l.remaining_balance), 0);
    const totalReceived = loans.reduce((sum, l) => sum + Number(l.total_paid || 0), 0);
    
    return {
      total: loans.length,
      active: active.length,
      overdue: overdue.length,
      totalPending,
      totalReceived,
    };
  }, [loans]);

  const handleCreateLoan = async () => {
    if (!formData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }
    if (!formData.third_party_name.trim()) {
      toast.error('Informe o nome do terceiro');
      return;
    }
    if (!formData.principal_amount || Number(formData.principal_amount) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    const principal = Number(formData.principal_amount);
    const rate = Number(formData.interest_rate) || 0;
    const numInstallments = Number(formData.installments) || 1;
    
    let totalInterest = 0;
    if (formData.interest_mode === 'per_installment') {
      totalInterest = principal * (rate / 100) * numInstallments;
    } else if (formData.interest_mode === 'compound') {
      totalInterest = principal * Math.pow(1 + (rate / 100), numInstallments) - principal;
    } else {
      totalInterest = principal * (rate / 100);
    }

    // Generate installment dates
    const installmentDates: string[] = [];
    const startDate = new Date(formData.start_date + 'T12:00:00');
    for (let i = 0; i < numInstallments; i++) {
      const date = addMonths(startDate, i + 1);
      installmentDates.push(format(date, 'yyyy-MM-dd'));
    }

    await createLoan({
      client_id: formData.client_id,
      principal_amount: principal,
      interest_rate: rate,
      interest_type: formData.interest_type,
      interest_mode: formData.interest_mode,
      payment_type: formData.payment_type,
      installments: numInstallments,
      start_date: formData.start_date,
      due_date: installmentDates[installmentDates.length - 1] || formData.due_date,
      notes: formData.notes || null,
      installment_dates: installmentDates,
      remaining_balance: principal + totalInterest,
      total_interest: totalInterest,
      third_party_name: formData.third_party_name.trim(),
    });

    setIsCreateOpen(false);
    resetForm();
  };

  const handleRegisterPayment = async () => {
    if (!selectedLoan) return;
    if (!paymentData.amount || Number(paymentData.amount) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    const amount = Number(paymentData.amount);
    const remaining = Number(selectedLoan.remaining_balance);
    const principal = Number(selectedLoan.principal_amount);
    const totalInterest = Number(selectedLoan.total_interest) || 0;
    
    // Calculate principal and interest portions
    const totalToReceive = principal + totalInterest;
    const principalRatio = principal / totalToReceive;
    const interestRatio = totalInterest / totalToReceive;
    
    const principalPaid = amount * principalRatio;
    const interestPaid = amount * interestRatio;

    await registerPayment({
      loan_id: selectedLoan.id,
      amount,
      principal_paid: principalPaid,
      interest_paid: interestPaid,
      payment_date: paymentData.payment_date,
      notes: paymentData.notes || undefined,
    });

    setIsPaymentOpen(false);
    setSelectedLoan(null);
    setPaymentData({ amount: '', payment_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
  };

  const handleDelete = async (id: string) => {
    await deleteLoan(id);
    setDeleteConfirmId(null);
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      principal_amount: '',
      interest_rate: '',
      interest_type: 'simple',
      interest_mode: 'on_total',
      payment_type: 'installment',
      installments: '1',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      notes: '',
      third_party_name: '',
    });
  };

  const getCardStyle = (loan: Loan) => {
    const isPaid = loan.status === 'paid';
    const isOverdue = isLoanOverdue(loan);
    
    if (isPaid) {
      return 'bg-emerald-500/20 border-emerald-400 dark:bg-emerald-500/30 dark:border-emerald-400';
    }
    if (isOverdue) {
      return 'bg-gradient-to-r from-red-500/30 to-teal-500/30 border-red-400';
    }
    return 'bg-teal-500/20 border-teal-400 dark:bg-teal-500/30 dark:border-teal-400';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-teal-500" />
            <h1 className="text-2xl font-bold">Empréstimos de Terceiros</h1>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 rounded-xl">
              <Building2 className="w-6 h-6 text-teal-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Empréstimos de Terceiros</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie empréstimos que você administra para outras pessoas/empresas
              </p>
            </div>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Empréstimo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-teal-500" />
                  Novo Empréstimo de Terceiro
                </DialogTitle>
                <DialogDescription>
                  Crie um empréstimo que você administra para outra pessoa ou empresa
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Third Party Name */}
                <div className="space-y-2 p-3 bg-teal-500/10 rounded-lg border border-teal-500/30">
                  <Label htmlFor="third_party_name" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-500" />
                    Nome do Terceiro *
                  </Label>
                  <Input
                    id="third_party_name"
                    value={formData.third_party_name}
                    onChange={(e) => setFormData({ ...formData, third_party_name: e.target.value })}
                    placeholder="Ex: João da Silva, Empresa XYZ..."
                    className="border-teal-500/30"
                  />
                </div>
                
                {/* Client */}
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <ClientSelector
                    selectedClientId={formData.client_id || null}
                    onSelect={(client) => setFormData({ ...formData, client_id: client?.id || '' })}
                    placeholder="Selecione o cliente"
                  />
                </div>
                
                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="principal_amount">Valor Emprestado *</Label>
                  <Input
                    id="principal_amount"
                    type="number"
                    value={formData.principal_amount}
                    onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                
                {/* Interest */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interest_rate">Taxa de Juros (%)</Label>
                    <Input
                      id="interest_rate"
                      type="number"
                      value={formData.interest_rate}
                      onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Modo de Juros</Label>
                    <Select
                      value={formData.interest_mode}
                      onValueChange={(value: 'per_installment' | 'on_total' | 'compound') => 
                        setFormData({ ...formData, interest_mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_total">Sobre o Total</SelectItem>
                        <SelectItem value="per_installment">Por Parcela</SelectItem>
                        <SelectItem value="compound">Composto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Installments */}
                <div className="space-y-2">
                  <Label htmlFor="installments">Número de Parcelas</Label>
                  <Input
                    id="installments"
                    type="number"
                    min="1"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                  />
                </div>
                
                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Data Início</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Vencimento</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>
                
                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Anotações sobre este empréstimo..."
                  />
                </div>
                
                <Button onClick={handleCreateLoan} className="w-full bg-teal-600 hover:bg-teal-700">
                  Criar Empréstimo de Terceiro
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-teal-500/30 bg-teal-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/20">
                  <Building2 className="w-5 h-5 text-teal-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-blue-500/30 bg-blue-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                  <p className="text-xl font-bold">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A Receber</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalPending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-emerald-500/30 bg-emerald-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalReceived)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou terceiro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="overdue">Em Atraso</SelectItem>
              <SelectItem value="paid">Pagos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Loans List */}
        {filteredLoans.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum empréstimo de terceiro</h3>
              <p className="text-muted-foreground mb-4">
                Você ainda não administra nenhum empréstimo para outra pessoa ou empresa.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Empréstimo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLoans.map(loan => {
              const isOverdue = loan.status !== 'paid' && isLoanOverdue(loan);
              const daysOver = isOverdue ? getDaysOverdue(loan) : 0;
              const thirdPartyName = (loan as any).third_party_name || 'Terceiro';
              
              return (
                <Card key={loan.id} className={cn('border-2 transition-all', getCardStyle(loan))}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={loan.client?.avatar_url || undefined} />
                          <AvatarFallback>
                            {loan.client?.full_name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{loan.client?.full_name}</p>
                          <Badge variant="outline" className="text-[10px] bg-teal-500/20 text-teal-600 border-teal-400/50">
                            <Building2 className="w-3 h-3 mr-1" />
                            {thirdPartyName}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(loan.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isOverdue && (
                      <Badge variant="destructive" className="text-xs">
                        {daysOver} {daysOver === 1 ? 'dia' : 'dias'} em atraso
                      </Badge>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Principal</p>
                        <p className="font-medium">{formatCurrency(Number(loan.principal_amount))}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Restante</p>
                        <p className="font-medium">{formatCurrency(Number(loan.remaining_balance))}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Juros</p>
                        <p className="font-medium">{loan.interest_rate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Vencimento</p>
                        <p className="font-medium">{formatDateFns(new Date(loan.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    
                    {loan.status !== 'paid' && (
                      <Button 
                        className="w-full bg-teal-600 hover:bg-teal-700"
                        onClick={() => {
                          setSelectedLoan(loan);
                          setIsPaymentOpen(true);
                        }}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Registrar Pagamento
                      </Button>
                    )}
                    
                    {loan.status === 'paid' && (
                      <Badge className="w-full justify-center bg-emerald-500">
                        ✓ Quitado
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Payment Dialog */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>
                Cliente: {selectedLoan?.client?.full_name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Restante a receber:</p>
                <p className="text-xl font-bold">
                  {selectedLoan && formatCurrency(Number(selectedLoan.remaining_balance))}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment_amount">Valor do Pagamento</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment_date">Data do Pagamento</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment_notes">Observações</Label>
                <Textarea
                  id="payment_notes"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Anotações sobre este pagamento..."
                />
              </div>
              
              <Button onClick={handleRegisterPayment} className="w-full bg-teal-600 hover:bg-teal-700">
                Confirmar Pagamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Empréstimo</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este empréstimo? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
