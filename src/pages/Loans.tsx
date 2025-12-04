import { useState, useEffect, useRef } from 'react';
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
import { Plus, Search, Trash2, DollarSign, CreditCard, User, Calendar as CalendarIcon, Percent, RefreshCw, Camera, Clock } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Loans() {
  const { loans, loading, createLoan, registerPayment, deleteLoan, renegotiateLoan, fetchLoans } = useLoans();
  const { clients, updateClient, createClient, fetchClients } = useClients();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'overdue' | 'renegotiated' | 'pending'>('all');
  const [isDailyDialogOpen, setIsDailyDialogOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [installmentDates, setInstallmentDates] = useState<string[]>([]);
  const [isRenegotiateDialogOpen, setIsRenegotiateDialogOpen] = useState(false);
  const [renegotiateData, setRenegotiateData] = useState({
    promised_amount: '',
    promised_date: '',
    remaining_amount: '',
    notes: '',
  });
  const [uploadingClientId, setUploadingClientId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({
    full_name: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [creatingClient, setCreatingClient] = useState(false);

  const handleCreateClientInline = async () => {
    if (!newClientData.full_name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    setCreatingClient(true);
    const result = await createClient({
      full_name: newClientData.full_name,
      phone: newClientData.phone || undefined,
      address: newClientData.address || undefined,
      notes: newClientData.notes || undefined,
      client_type: 'loan',
    });
    
    if (result.data) {
      setFormData(prev => ({ ...prev, client_id: result.data!.id }));
      setShowNewClientForm(false);
      setNewClientData({ full_name: '', phone: '', address: '', notes: '' });
      await fetchClients();
    }
    setCreatingClient(false);
  };

  const handleAvatarUpload = async (clientId: string, file: File) => {
    if (!file) return;
    
    setUploadingClientId(clientId);
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${clientId}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('client-avatars')
      .upload(filePath, file, { upsert: true });
    
    if (uploadError) {
      toast.error('Erro ao fazer upload da foto');
      setUploadingClientId(null);
      return;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('client-avatars')
      .getPublicUrl(filePath);
    
    await updateClient(clientId, { avatar_url: publicUrl });
    await fetchLoans();
    setUploadingClientId(null);
    toast.success('Foto atualizada!');
  };
  
  const [formData, setFormData] = useState({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'simple' as InterestType,
    interest_mode: 'per_installment' as 'per_installment' | 'on_total',
    payment_type: 'single' as LoanPaymentType | 'daily',
    installments: '1',
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
    daily_amount: '',
    daily_period: '15',
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

  // Reset dates when switching to daily payment type
  useEffect(() => {
    if (formData.payment_type === 'daily') {
      // Clear previous dates to allow manual selection
      setInstallmentDates([]);
    }
  }, [formData.payment_type]);

  const updateInstallmentDate = (index: number, date: string) => {
    const newDates = [...installmentDates];
    newDates[index] = date;
    setInstallmentDates(newDates);
    // Update due_date to the last installment date
    if (index === newDates.length - 1) {
      setFormData(prev => ({ ...prev, due_date: date }));
    }
  };

  const getLoanStatus = (loan: typeof loans[0]) => {
    const numInstallments = loan.installments || 1;
    const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
    const totalToReceive = loan.principal_amount + (interestPerInstallment * numInstallments);
    const remainingToReceive = totalToReceive - (loan.total_paid || 0);
    const principalPerInstallment = loan.principal_amount / numInstallments;
    const totalPerInstallment = principalPerInstallment + interestPerInstallment;
    
    const isPaid = loan.status === 'paid' || remainingToReceive <= 0;
    const isRenegotiated = loan.notes?.includes('Valor prometido');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let isOverdue = false;
    if (!isPaid && remainingToReceive > 0) {
      const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);
      const dates = (loan.installment_dates as string[]) || [];
      
      if (dates.length > 0 && paidInstallments < dates.length) {
        const nextDueDate = new Date(dates[paidInstallments]);
        nextDueDate.setHours(0, 0, 0, 0);
        isOverdue = today > nextDueDate;
      } else {
        const dueDate = new Date(loan.due_date);
        dueDate.setHours(0, 0, 0, 0);
        isOverdue = today > dueDate;
      }
    }
    
    return { isPaid, isRenegotiated, isOverdue };
  };

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.client?.full_name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    if (statusFilter === 'all') return true;
    
    const { isPaid, isRenegotiated, isOverdue } = getLoanStatus(loan);
    
    switch (statusFilter) {
      case 'paid':
        return isPaid;
      case 'overdue':
        return isOverdue && !isPaid;
      case 'renegotiated':
        return isRenegotiated && !isPaid && !isOverdue;
      case 'pending':
        return !isPaid && !isOverdue && !isRenegotiated;
      default:
        return true;
    }
  });

  const loanClients = clients.filter(c => c.client_type === 'loan' || c.client_type === 'both');

  const handleDailySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }
    
    if (!formData.principal_amount || parseFloat(formData.principal_amount) <= 0) {
      toast.error('Informe o valor total emprestado');
      return;
    }
    
    if (!formData.daily_amount || parseFloat(formData.daily_amount) <= 0) {
      toast.error('Informe o valor da parcela diária');
      return;
    }
    
    if (installmentDates.length === 0) {
      toast.error('Selecione pelo menos uma data de cobrança');
      return;
    }
    
    const principalAmount = parseFloat(formData.principal_amount);
    const dailyAmount = parseFloat(formData.daily_amount);
    const numDays = installmentDates.length;
    const totalToReceive = dailyAmount * numDays;
    
    await createLoan({
      client_id: formData.client_id,
      principal_amount: principalAmount,
      interest_rate: 0,
      interest_type: 'simple',
      interest_mode: 'per_installment',
      payment_type: 'daily',
      installments: numDays,
      start_date: formData.start_date,
      due_date: installmentDates[installmentDates.length - 1],
      notes: formData.notes 
        ? `${formData.notes}\nValor emprestado: R$ ${principalAmount.toFixed(2)}\nParcela diária: R$ ${dailyAmount.toFixed(2)}\nTotal a receber: R$ ${totalToReceive.toFixed(2)}` 
        : `Valor emprestado: R$ ${principalAmount.toFixed(2)}\nParcela diária: R$ ${dailyAmount.toFixed(2)}\nTotal a receber: R$ ${totalToReceive.toFixed(2)}`,
      installment_dates: installmentDates,
    });
    setIsDailyDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação de campos obrigatórios
    if (!formData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }
    
    // Para pagamento diário, calcular valores a partir do valor diário
    if (formData.payment_type === 'daily') {
      if (!formData.daily_amount || parseFloat(formData.daily_amount) <= 0) {
        toast.error('Informe o valor da parcela diária');
        return;
      }
      
      const dailyAmount = parseFloat(formData.daily_amount);
      const numDays = parseInt(formData.daily_period);
      const totalAmount = dailyAmount * numDays;
      
      await createLoan({
        client_id: formData.client_id,
        principal_amount: totalAmount,
        interest_rate: 0, // Sem juros adicional para diário
        interest_type: formData.interest_type,
        interest_mode: formData.interest_mode,
        payment_type: 'daily',
        installments: numDays,
        start_date: formData.start_date,
        due_date: formData.due_date,
        notes: formData.notes ? `${formData.notes}\nParcela diária: R$ ${dailyAmount.toFixed(2)}` : `Parcela diária: R$ ${dailyAmount.toFixed(2)}`,
        installment_dates: installmentDates,
      });
      setIsDialogOpen(false);
      resetForm();
      return;
    }
    
    if (!formData.principal_amount || parseFloat(formData.principal_amount) <= 0) {
      toast.error('Informe o valor do empréstimo');
      return;
    }
    if (!formData.interest_rate || parseFloat(formData.interest_rate) < 0) {
      toast.error('Informe a taxa de juros');
      return;
    }
    if (!formData.due_date) {
      toast.error('Informe a data de vencimento');
      return;
    }
    
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
    
    const numInstallments = selectedLoan.installments || 1;
    const interestPerInstallment = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100);
    const totalToReceive = selectedLoan.principal_amount + (interestPerInstallment * numInstallments);
    const remainingToReceive = totalToReceive - (selectedLoan.total_paid || 0);
    
    const amount = paymentData.payment_type === 'total' 
      ? remainingToReceive 
      : parseFloat(paymentData.amount);
    
    // Calculate how much goes to interest vs principal
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
      interest_mode: 'per_installment', payment_type: 'single', installments: '1', start_date: new Date().toISOString().split('T')[0], due_date: '', notes: '',
      daily_amount: '', daily_period: '15',
    });
    setInstallmentDates([]);
  };

  const openRenegotiateDialog = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    // Calculate remaining amount (total to receive - total paid)
    const numInstallments = loan.installments || 1;
    const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
    const totalToReceive = loan.principal_amount + (interestPerInstallment * numInstallments);
    const totalPaid = loan.total_paid || 0;
    const remainingAmount = totalToReceive - totalPaid;
    
    setSelectedLoanId(loanId);
    const today = new Date();
    today.setDate(today.getDate() + 15);
    setRenegotiateData({
      promised_amount: '',
      promised_date: today.toISOString().split('T')[0],
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0',
      notes: loan.notes || '',
    });
    setIsRenegotiateDialogOpen(true);
  };

  const handleRenegotiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || !renegotiateData.promised_date) return;
    
    const loan = loans.find(l => l.id === selectedLoanId);
    if (!loan) return;
    
    let notesText = renegotiateData.notes;
    if (renegotiateData.remaining_amount) {
      notesText += `\nValor que falta: R$ ${renegotiateData.remaining_amount}`;
    }
    if (renegotiateData.promised_amount) {
      notesText += `\nValor prometido: R$ ${renegotiateData.promised_amount}`;
    }
    
    await renegotiateLoan(selectedLoanId, {
      interest_rate: loan.interest_rate,
      installments: 1,
      installment_dates: [renegotiateData.promised_date],
      due_date: renegotiateData.promised_date,
      notes: notesText,
    });
    
    setIsRenegotiateDialogOpen(false);
    setSelectedLoanId(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Empréstimos</h1>
            <p className="text-muted-foreground">Gerencie seus empréstimos</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDailyDialogOpen} onOpenChange={setIsDailyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-sky-500 text-sky-600 hover:bg-sky-500/10">
                  <Clock className="w-4 h-4" />Novo Diário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Novo Empréstimo Diário</DialogTitle></DialogHeader>
                <form onSubmit={handleDailySubmit} className="space-y-4">
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
                      <Label>Valor Total Emprestado (R$) *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={formData.principal_amount} 
                        onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })} 
                        placeholder="Ex: 1000.00"
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor da Parcela Diária (R$) *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={formData.daily_amount} 
                        onChange={(e) => setFormData({ ...formData, daily_amount: e.target.value })} 
                        placeholder="Ex: 50.00"
                        required 
                      />
                    </div>
                  </div>
                  {formData.principal_amount && formData.daily_amount && installmentDates.length > 0 && (
                    <div className="bg-sky-50 dark:bg-sky-900/20 rounded-lg p-3 space-y-1">
                      <p className="text-sm font-medium">Resumo ({installmentDates.length} parcelas):</p>
                      <p className="text-sm text-muted-foreground">
                        Total a receber: {formatCurrency(parseFloat(formData.daily_amount) * installmentDates.length)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Lucro: {formatCurrency((parseFloat(formData.daily_amount) * installmentDates.length) - parseFloat(formData.principal_amount))}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Data de Início</Label>
                    <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Datas de Cobrança ({installmentDates.length} dias selecionados)</Label>
                    <p className="text-xs text-muted-foreground">Clique nas datas do calendário para selecionar os dias de cobrança</p>
                    <div className="border rounded-md p-3">
                      <Calendar
                        mode="multiple"
                        selected={installmentDates.map(d => new Date(d + 'T12:00:00'))}
                        onSelect={(dates) => {
                          if (dates) {
                            const sortedDates = dates.map(d => d.toISOString().split('T')[0]).sort();
                            setInstallmentDates(sortedDates);
                            if (sortedDates.length > 0) {
                              setFormData(prev => ({
                                ...prev,
                                due_date: sortedDates[sortedDates.length - 1],
                                installments: sortedDates.length.toString(),
                                daily_period: sortedDates.length.toString()
                              }));
                            }
                          } else {
                            setInstallmentDates([]);
                          }
                        }}
                        className="pointer-events-auto"
                      />
                    </div>
                    {installmentDates.length > 0 && formData.daily_amount && (
                      <div className="bg-sky-50 dark:bg-sky-900/20 rounded-lg p-3 space-y-1">
                        <p className="text-sm font-medium">Resumo:</p>
                        <p className="text-sm text-muted-foreground">Total a receber: {formatCurrency(parseFloat(formData.daily_amount) * installmentDates.length)}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => { setIsDailyDialogOpen(false); resetForm(); }}>Cancelar</Button>
                    <Button type="submit" className="bg-sky-500 hover:bg-sky-600">Criar Diário</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" />Novo Empréstimo</Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo Empréstimo</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  
                  {!showNewClientForm ? (
                    <div className="space-y-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full border-dashed border-primary text-primary hover:bg-primary/10"
                        onClick={() => setShowNewClientForm(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Cadastrar novo cliente
                      </Button>
                      <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                        <SelectContent>
                          {loanClients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-primary">Novo Cliente</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          className="h-auto py-1 text-xs"
                          onClick={() => setShowNewClientForm(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Nome completo *</Label>
                        <Input 
                          value={newClientData.full_name}
                          onChange={(e) => setNewClientData({ ...newClientData, full_name: e.target.value })}
                          placeholder="Nome do cliente"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Telefone</Label>
                        <Input 
                          value={newClientData.phone}
                          onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Endereço</Label>
                        <Input 
                          value={newClientData.address}
                          onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                          placeholder="Endereço completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Observações</Label>
                        <Textarea 
                          value={newClientData.notes}
                          onChange={(e) => setNewClientData({ ...newClientData, notes: e.target.value })}
                          rows={2}
                          placeholder="Observações sobre o cliente"
                        />
                      </div>
                      <Button 
                        type="button" 
                        size="sm" 
                        className="w-full"
                        onClick={handleCreateClientInline}
                        disabled={creatingClient}
                      >
                        {creatingClient ? 'Criando...' : 'Criar Cliente'}
                      </Button>
                    </div>
                  )}
                </div>
                {formData.payment_type !== 'daily' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor *</Label>
                      <Input type="number" step="0.01" value={formData.principal_amount} onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Taxa de Juros (%) *</Label>
                      <Input type="number" step="0.01" value={formData.interest_rate} onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })} required />
                    </div>
                  </div>
                )}
                {formData.payment_type !== 'daily' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Juros Aplicado</Label>
                      <Select value={formData.interest_mode} onValueChange={(v: 'per_installment' | 'on_total') => setFormData({ ...formData, interest_mode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_installment">Por Parcela</SelectItem>
                          <SelectItem value="on_total">Sobre o Total</SelectItem>
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
                          <SelectItem value="daily">Diário</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {formData.payment_type === 'daily' && (
                  <div className="space-y-2">
                    <Label>Modalidade</Label>
                    <Select value={formData.payment_type} onValueChange={(v: LoanPaymentType) => setFormData({ ...formData, payment_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Pagamento Único</SelectItem>
                        <SelectItem value="installment">Parcelado</SelectItem>
                        <SelectItem value="daily">Diário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {formData.payment_type === 'installment' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nº de Parcelas *</Label>
                        <Input type="number" min="1" value={formData.installments} onChange={(e) => setFormData({ ...formData, installments: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>{formData.interest_mode === 'per_installment' ? 'Juros por Parcela' : 'Juros Total'}</Label>
                        <Input 
                          type="text" 
                          readOnly 
                          value={formData.principal_amount && formData.interest_rate
                            ? formData.interest_mode === 'per_installment'
                              ? formatCurrency(parseFloat(formData.principal_amount) * (parseFloat(formData.interest_rate) / 100))
                              : formatCurrency(parseFloat(formData.principal_amount) * (parseFloat(formData.interest_rate) / 100) * parseInt(formData.installments || '1'))
                            : 'R$ 0,00'
                          } 
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </>
                )}
                {formData.payment_type === 'daily' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor da Parcela Diária (R$) *</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={formData.daily_amount} 
                          onChange={(e) => setFormData({ ...formData, daily_amount: e.target.value })} 
                          placeholder="Valor combinado por dia"
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Período de Cobrança (dias) *</Label>
                        <Input 
                          type="number" 
                          min="1"
                          value={formData.daily_period} 
                          onChange={(e) => setFormData({ ...formData, daily_period: e.target.value })}
                          placeholder="Ex: 15, 30, 45..."
                          required
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                      <p className="text-sm"><strong>Total a receber:</strong> {formData.daily_amount ? formatCurrency(parseFloat(formData.daily_amount) * parseInt(formData.daily_period)) : 'R$ 0,00'}</p>
                      <p className="text-xs text-muted-foreground">Cliente pagará {formData.daily_period} parcelas de {formData.daily_amount ? formatCurrency(parseFloat(formData.daily_amount)) : 'R$ 0,00'}</p>
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
                {formData.payment_type === 'daily' && (
                  <div className="space-y-2">
                    <Label>Datas de Cobrança ({installmentDates.length} dias selecionados)</Label>
                    <p className="text-xs text-muted-foreground">Clique nas datas do calendário para selecionar/remover os dias de cobrança</p>
                    <div className="border rounded-md p-3">
                      <Calendar
                        mode="multiple"
                        selected={installmentDates.map(d => new Date(d + 'T12:00:00'))}
                        onSelect={(dates) => {
                          if (dates) {
                            const sortedDates = dates
                              .map(d => d.toISOString().split('T')[0])
                              .sort();
                            setInstallmentDates(sortedDates);
                            if (sortedDates.length > 0) {
                              setFormData(prev => ({
                                ...prev,
                                due_date: sortedDates[sortedDates.length - 1],
                                installments: sortedDates.length.toString(),
                                daily_period: sortedDates.length.toString()
                              }));
                            }
                          } else {
                            setInstallmentDates([]);
                          }
                        }}
                        className="pointer-events-auto"
                      />
                    </div>
                    {installmentDates.length > 0 && (
                      <ScrollArea className="h-[100px] rounded-md border p-3">
                        <div className="space-y-1">
                          {installmentDates.map((date, index) => (
                            <div key={index} className="flex items-center gap-3 text-sm">
                              <span className="font-medium w-16">Dia {index + 1}</span>
                              <span className="text-muted-foreground">{formatDate(date)}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
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
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar empréstimos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
              className={statusFilter !== 'pending' ? 'border-blue-500 text-blue-500 hover:bg-blue-500/10' : ''}
            >
              Em Dia
            </Button>
            <Button
              variant={statusFilter === 'paid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('paid')}
              className={statusFilter === 'paid' ? 'bg-primary' : 'border-primary text-primary hover:bg-primary/10'}
            >
              Pagos
            </Button>
            <Button
              variant={statusFilter === 'overdue' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('overdue')}
              className={statusFilter === 'overdue' ? 'bg-destructive' : 'border-destructive text-destructive hover:bg-destructive/10'}
            >
              Em Atraso
            </Button>
            <Button
              variant={statusFilter === 'renegotiated' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('renegotiated')}
              className={statusFilter === 'renegotiated' ? 'bg-yellow-500' : 'border-yellow-500 text-yellow-600 hover:bg-yellow-500/10'}
            >
              Renegociados
            </Button>
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
                const isRenegotiated = loan.notes?.includes('Valor prometido');
                
                // Check if overdue based on installment dates
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                let isOverdue = false;
                if (!isPaid && remainingToReceive > 0) {
                  // Calculate how many installments have been paid
                  const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);
                  
                  // Get installment dates array
                  const dates = (loan.installment_dates as string[]) || [];
                  
                  if (dates.length > 0 && paidInstallments < dates.length) {
                    // Check if the next due installment date has passed
                    const nextDueDate = new Date(dates[paidInstallments]);
                    nextDueDate.setHours(0, 0, 0, 0);
                    isOverdue = today > nextDueDate;
                  } else {
                    // Fallback to general due_date for single payment loans
                    const dueDate = new Date(loan.due_date);
                    dueDate.setHours(0, 0, 0, 0);
                    isOverdue = today > dueDate;
                  }
                }
                
                const isDaily = loan.payment_type === 'daily';
                const hasSpecialStyle = isPaid || isOverdue || isRenegotiated;
                
                const getCardStyle = () => {
                  if (isPaid) {
                    return 'bg-primary border-primary';
                  }
                  if (isRenegotiated && !isOverdue) {
                    return 'bg-yellow-500 border-yellow-500';
                  }
                  if (isOverdue) {
                    return 'bg-destructive border-destructive';
                  }
                  if (isDaily) {
                    return 'bg-sky-100 border-sky-300 dark:bg-sky-900/30 dark:border-sky-700';
                  }
                  return 'bg-card';
                };
                
                const textColor = hasSpecialStyle ? 'text-white' : '';
                const mutedTextColor = hasSpecialStyle ? 'text-white/70' : 'text-muted-foreground';
                
                return (
                  <Card key={loan.id} className={`shadow-soft hover:shadow-md transition-shadow border ${getCardStyle()} ${textColor}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="relative group">
                          <Avatar className={`h-16 w-16 border-2 ${hasSpecialStyle ? 'border-white/30' : 'border-primary/20'}`}>
                            <AvatarImage src={loan.client?.avatar_url || ''} alt={loan.client?.full_name} />
                            <AvatarFallback className={`text-lg font-semibold ${hasSpecialStyle ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <button
                            type="button"
                            className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${uploadingClientId === loan.client_id ? 'opacity-100' : ''}`}
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file && loan.client_id) {
                                  handleAvatarUpload(loan.client_id, file);
                                }
                              };
                              input.click();
                            }}
                            disabled={uploadingClientId === loan.client_id}
                          >
                            {uploadingClientId === loan.client_id ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Camera className="w-5 h-5 text-white" />
                            )}
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-lg truncate">{loan.client?.full_name}</h3>
                            <Badge className={hasSpecialStyle ? 'bg-white/20 text-white border-white/30' : getPaymentStatusColor(loan.status)}>
                              {isRenegotiated && !isOverdue ? 'Renegociado' : getPaymentStatusLabel(loan.status)}
                            </Badge>
                          </div>
                          <p className={`text-2xl font-bold mt-1 ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>{formatCurrency(remainingToReceive)}</p>
                          <p className={`text-xs ${mutedTextColor}`}>restante a receber</p>
                        </div>
                      </div>
                      
                      <div className={`grid grid-cols-2 gap-3 mt-4 p-3 rounded-lg text-sm ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
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
                          <span>Juros: {formatPercentage(loan.interest_rate)}</span>
                        </div>
                        <div className={`flex items-center gap-2 ${mutedTextColor}`}>
                          <CreditCard className="w-4 h-4" />
                          <span>{numInstallments}x de {formatCurrency(totalPerInstallment)}</span>
                        </div>
                        <div className={`flex items-center gap-2 ${mutedTextColor}`}>
                          <CalendarIcon className="w-4 h-4" />
                          <span>Venc: {(() => {
                            const dates = (loan.installment_dates as string[]) || [];
                            const paidCount = Math.floor((loan.total_paid || 0) / totalPerInstallment);
                            const nextDate = dates[paidCount] || loan.due_date;
                            return formatDate(nextDate);
                          })()}</span>
                        </div>
                        <div className={`flex items-center gap-2 p-2 rounded-lg font-semibold ${hasSpecialStyle ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                          <DollarSign className="w-4 h-4" />
                          <span>Pago: {formatCurrency(loan.total_paid || 0)}</span>
                        </div>
                      </div>
                      
                      <div className={`flex gap-2 mt-4 pt-4 ${hasSpecialStyle ? 'border-t border-white/20' : 'border-t'}`}>
                        <Button 
                          variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                          size="sm" 
                          className={`flex-1 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`} 
                          onClick={() => { setSelectedLoanId(loan.id); setIsPaymentDialogOpen(true); }}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Pagamento
                        </Button>
                        <Button 
                          variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                          size="icon" 
                          className={hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}
                          onClick={() => openRenegotiateDialog(loan.id)}
                          title="Renegociar"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={hasSpecialStyle ? 'text-white/70 hover:text-white hover:bg-white/20' : ''}
                          onClick={() => setDeleteId(loan.id)}
                        >
                          <Trash2 className={`w-4 h-4 ${hasSpecialStyle ? '' : 'text-destructive'}`} />
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
              const totalToReceive = selectedLoan.principal_amount + (interestPerInstallment * numInstallments);
              const remainingToReceive = totalToReceive - (selectedLoan.total_paid || 0);
              
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
                        <p className="text-sm text-muted-foreground">Restante: {formatCurrency(remainingToReceive)}</p>
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
                        onClick={() => setPaymentData({ ...paymentData, payment_type: 'total', amount: remainingToReceive.toString() })}
                      >
                        Total ({formatCurrency(remainingToReceive)})
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

        <Dialog open={isRenegotiateDialogOpen} onOpenChange={setIsRenegotiateDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Renegociar Dívida</DialogTitle>
            </DialogHeader>
            {selectedLoanId && (() => {
              const selectedLoan = loans.find(l => l.id === selectedLoanId);
              if (!selectedLoan) return null;
              
              return (
                <form onSubmit={handleRenegotiateSubmit} className="space-y-4">
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
                        <p className="text-sm text-muted-foreground">
                          Saldo devedor: {formatCurrency(selectedLoan.remaining_balance)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Valor que Falta (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={renegotiateData.remaining_amount} 
                      onChange={(e) => setRenegotiateData({ ...renegotiateData, remaining_amount: e.target.value })} 
                      placeholder="Calculado automaticamente"
                    />
                    <p className="text-xs text-muted-foreground">Valor calculado automaticamente, mas você pode editar</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor Prometido (R$)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={renegotiateData.promised_amount} 
                        onChange={(e) => setRenegotiateData({ ...renegotiateData, promised_amount: e.target.value })} 
                        placeholder="Ex: 500,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data do Pagamento *</Label>
                      <Input 
                        type="date" 
                        value={renegotiateData.promised_date} 
                        onChange={(e) => setRenegotiateData({ ...renegotiateData, promised_date: e.target.value })} 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea 
                      value={renegotiateData.notes} 
                      onChange={(e) => setRenegotiateData({ ...renegotiateData, notes: e.target.value })} 
                      rows={2}
                      placeholder="Motivo da renegociação..."
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsRenegotiateDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit">Renegociar</Button>
                  </div>
                </form>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
