import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLoans } from '@/hooks/useLoans';
import { useClients } from '@/hooks/useClients';
import { InterestType, LoanPaymentType } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel, formatPercentage } from '@/lib/calculations';
import { Plus, Search, Trash2, DollarSign, CreditCard, User, Calendar, Percent } from 'lucide-react';

export default function Loans() {
  const { loans, loading, createLoan, registerPayment, deleteLoan } = useLoans();
  const { clients } = useClients();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [installmentDates, setInstallmentDates] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'simple' as InterestType,
    interest_mode: 'per_installment' as 'per_installment' | 'on_total',
    payment_type: 'single' as LoanPaymentType,
    installments: '1',
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'partial' as 'partial' | 'total',
  });

  // Generate installment dates when start_date or installments change
  useEffect(() => {
    if (formData.payment_type === 'installment' && formData.start_date) {
      const numInstallments = parseInt(formData.installments) || 1;
      const startDate = new Date(formData.start_date);
      const newDates: string[] = [];
      
      for (let i = 0; i < numInstallments; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (15 * (i + 1))); // Default 15 days interval
        newDates.push(date.toISOString().split('T')[0]);
      }
      
      setInstallmentDates(newDates);
      // Set the last installment date as the due_date
      if (newDates.length > 0) {
        setFormData(prev => ({ ...prev, due_date: newDates[newDates.length - 1] }));
      }
    }
  }, [formData.payment_type, formData.start_date, formData.installments]);

  const updateInstallmentDate = (index: number, date: string) => {
    const newDates = [...installmentDates];
    newDates[index] = date;
    setInstallmentDates(newDates);
    // Update due_date to the last installment date
    if (index === newDates.length - 1) {
      setFormData(prev => ({ ...prev, due_date: date }));
    }
  };

  const filteredLoans = loans.filter(loan =>
    loan.client?.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const loanClients = clients.filter(c => c.client_type === 'loan' || c.client_type === 'both');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLoan({
      ...formData,
      principal_amount: parseFloat(formData.principal_amount),
      interest_rate: parseFloat(formData.interest_rate),
      installments: parseInt(formData.installments),
      installment_dates: formData.payment_type === 'installment' ? installmentDates : [],
    });
    setIsDialogOpen(false);
    resetForm();
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) return;
    
    const selectedLoan = loans.find(l => l.id === selectedLoanId);
    if (!selectedLoan) return;
    
    const amount = paymentData.payment_type === 'total' 
      ? selectedLoan.remaining_balance 
      : parseFloat(paymentData.amount);
    
    // Calculate how much goes to interest vs principal
    const interestPerInstallment = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100);
    const interest_paid = Math.min(amount, interestPerInstallment);
    const principal_paid = amount - interest_paid;
    
    await registerPayment({
      loan_id: selectedLoanId,
      amount: amount,
      principal_paid: principal_paid,
      interest_paid: interest_paid,
      payment_date: paymentData.payment_date,
      notes: '',
    });
    setIsPaymentDialogOpen(false);
    setSelectedLoanId(null);
    setPaymentData({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_type: 'partial' });
  };

  const resetForm = () => {
    setFormData({
      client_id: '', principal_amount: '', interest_rate: '', interest_type: 'simple',
      interest_mode: 'on_total', payment_type: 'single', installments: '1', start_date: new Date().toISOString().split('T')[0], due_date: '', notes: '',
    });
    setInstallmentDates([]);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Empréstimos</h1>
            <p className="text-muted-foreground">Gerencie seus empréstimos</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Novo Empréstimo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo Empréstimo</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      {loanClients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input type="number" step="0.01" value={formData.principal_amount} onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Taxa de Juros (%) * <span className="text-xs text-muted-foreground">(por parcela)</span></Label>
                    <Input type="number" step="0.01" value={formData.interest_rate} onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Juros</Label>
                    <Select value={formData.interest_type} onValueChange={(v: InterestType) => setFormData({ ...formData, interest_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simples</SelectItem>
                        <SelectItem value="compound">Composto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modalidade</Label>
                    <Select value={formData.payment_type} onValueChange={(v: LoanPaymentType) => setFormData({ ...formData, payment_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Pagamento Único</SelectItem>
                        <SelectItem value="installment">Parcelado</SelectItem>
                      </SelectContent>
                  </Select>
                  </div>
                </div>
                {formData.payment_type === 'installment' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nº de Parcelas *</Label>
                        <Input type="number" min="1" value={formData.installments} onChange={(e) => setFormData({ ...formData, installments: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Juros por Parcela</Label>
                        <Input 
                          type="text" 
                          readOnly 
                          value={formData.principal_amount && formData.interest_rate
                            ? formatCurrency(parseFloat(formData.principal_amount) * (parseFloat(formData.interest_rate) / 100))
                            : 'R$ 0,00'
                          } 
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
                  </div>
                  {formData.payment_type === 'single' && (
                    <div className="space-y-2">
                      <Label>Data Vencimento *</Label>
                      <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} required />
                    </div>
                  )}
                </div>
                {formData.payment_type === 'installment' && installmentDates.length > 0 && (
                  <div className="space-y-2">
                    <Label>Vencimento das Parcelas</Label>
                    <ScrollArea className="h-[150px] rounded-md border p-3">
                      <div className="space-y-2">
                        {installmentDates.map((date, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <span className="text-sm font-medium w-20">Parcela {index + 1}</span>
                            <Input 
                              type="date" 
                              value={date} 
                              onChange={(e) => updateInstallmentDate(index, e.target.value)} 
                              className="flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">Criar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar empréstimos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (<Skeleton key={i} className="h-48 w-full rounded-xl" />))}
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{search ? 'Nenhum empréstimo encontrado' : 'Nenhum empréstimo cadastrado'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLoans.map((loan) => {
                const numInstallments = loan.installments || 1;
                const principalPerInstallment = loan.principal_amount / numInstallments;
                const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
                const totalPerInstallment = principalPerInstallment + interestPerInstallment;
                const totalToReceive = loan.principal_amount + (interestPerInstallment * numInstallments);
                const remainingToReceive = totalToReceive - (loan.total_paid || 0);
                const initials = loan.client?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                
                const isPaid = loan.status === 'paid' || remainingToReceive <= 0;
                // Check if overdue based on due_date and remaining balance
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDate = new Date(loan.due_date);
                dueDate.setHours(0, 0, 0, 0);
                const isOverdue = !isPaid && (loan.status === 'overdue' || (remainingToReceive > 0 && dueDate < today));
                
                const getCardStyle = () => {
                  if (isPaid) {
                    return 'bg-primary border-primary';
                  }
                  if (isOverdue) {
                    return 'bg-destructive border-destructive';
                  }
                  return 'bg-card';
                };
                
                const textColor = (isPaid || isOverdue) ? 'text-white' : '';
                const mutedTextColor = (isPaid || isOverdue) ? 'text-white/70' : 'text-muted-foreground';
                
                return (
                  <Card key={loan.id} className={`shadow-soft hover:shadow-md transition-shadow border ${getCardStyle()} ${textColor}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className={`h-16 w-16 border-2 ${isPaid || isOverdue ? 'border-white/30' : 'border-primary/20'}`}>
                          <AvatarImage src={loan.client?.avatar_url || ''} alt={loan.client?.full_name} />
                          <AvatarFallback className={`text-lg font-semibold ${isPaid || isOverdue ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-lg truncate">{loan.client?.full_name}</h3>
                            <Badge className={isPaid ? 'bg-white/20 text-white border-white/30' : isOverdue ? 'bg-white/20 text-white border-white/30' : getPaymentStatusColor(loan.status)}>
                              {getPaymentStatusLabel(loan.status)}
                            </Badge>
                          </div>
                          <p className={`text-2xl font-bold mt-1 ${isPaid || isOverdue ? 'text-white' : 'text-primary'}`}>{formatCurrency(remainingToReceive)}</p>
                          <p className={`text-xs ${mutedTextColor}`}>restante a receber</p>
                        </div>
                      </div>
                      
                      <div className={`grid grid-cols-2 gap-3 mt-4 p-3 rounded-lg text-sm ${isPaid || isOverdue ? 'bg-white/10' : 'bg-muted/30'}`}>
                        <div>
                          <p className={`text-xs ${mutedTextColor}`}>Emprestado</p>
                          <p className="font-semibold">{formatCurrency(loan.principal_amount)}</p>
                        </div>
                        <div>
                          <p className={`text-xs ${mutedTextColor}`}>Total a Receber</p>
                          <p className="font-semibold">{formatCurrency(totalToReceive)}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div className={`flex items-center gap-2 ${mutedTextColor}`}>
                          <Percent className="w-4 h-4" />
                          <span>Juros: {formatPercentage(loan.interest_rate)}/parcela</span>
                        </div>
                        <div className={`flex items-center gap-2 ${mutedTextColor}`}>
                          <CreditCard className="w-4 h-4" />
                          <span>{numInstallments}x de {formatCurrency(totalPerInstallment)}</span>
                        </div>
                        <div className={`flex items-center gap-2 ${mutedTextColor}`}>
                          <Calendar className="w-4 h-4" />
                          <span>Venc: {formatDate(loan.due_date)}</span>
                        </div>
                        <div className={`flex items-center gap-2 ${mutedTextColor}`}>
                          <DollarSign className="w-4 h-4" />
                          <span>Pago: {formatCurrency(loan.total_paid || 0)}</span>
                        </div>
                      </div>
                      
                      <div className={`flex gap-2 mt-4 pt-4 ${isPaid || isOverdue ? 'border-t border-white/20' : 'border-t'}`}>
                        <Button 
                          variant={isPaid || isOverdue ? 'secondary' : 'outline'} 
                          size="sm" 
                          className={`flex-1 ${isPaid || isOverdue ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`} 
                          onClick={() => { setSelectedLoanId(loan.id); setIsPaymentDialogOpen(true); }}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Pagamento
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={isPaid || isOverdue ? 'text-white/70 hover:text-white hover:bg-white/20' : ''}
                          onClick={() => setDeleteId(loan.id)}
                        >
                          <Trash2 className={`w-4 h-4 ${isPaid || isOverdue ? '' : 'text-destructive'}`} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
            {selectedLoanId && (() => {
              const selectedLoan = loans.find(l => l.id === selectedLoanId);
              if (!selectedLoan) return null;
              const numInstallments = selectedLoan.installments || 1;
              const principalPerInstallment = selectedLoan.principal_amount / numInstallments;
              const interestPerInstallment = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100);
              const totalPerInstallment = principalPerInstallment + interestPerInstallment;
              
              return (
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={selectedLoan.client?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {selectedLoan.client?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{selectedLoan.client?.full_name}</p>
                        <p className="text-sm text-muted-foreground">Saldo: {formatCurrency(selectedLoan.remaining_balance)}</p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Parcela: {formatCurrency(totalPerInstallment)} ({formatCurrency(principalPerInstallment)} + {formatCurrency(interestPerInstallment)} juros)
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tipo de Pagamento</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={paymentData.payment_type === 'partial' ? 'default' : 'outline'}
                        onClick={() => setPaymentData({ ...paymentData, payment_type: 'partial', amount: '' })}
                      >
                        Parcial
                      </Button>
                      <Button
                        type="button"
                        variant={paymentData.payment_type === 'total' ? 'default' : 'outline'}
                        onClick={() => setPaymentData({ ...paymentData, payment_type: 'total', amount: selectedLoan.remaining_balance.toString() })}
                      >
                        Total ({formatCurrency(selectedLoan.remaining_balance)})
                      </Button>
                    </div>
                  </div>
                  
                  {paymentData.payment_type === 'partial' && (
                    <div className="space-y-2">
                      <Label>Valor Pago *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={paymentData.amount} 
                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })} 
                        placeholder={`Ex: ${totalPerInstallment.toFixed(2)}`}
                        required 
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Data do Pagamento</Label>
                    <Input 
                      type="date" 
                      value={paymentData.payment_date} 
                      onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })} 
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit">Registrar Pagamento</Button>
                  </div>
                </form>
              );
            })()}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir este empréstimo?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { deleteLoan(deleteId!); setDeleteId(null); }} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
