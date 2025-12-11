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
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel, formatPercentage, calculateOverduePenalty } from '@/lib/calculations';
import { Plus, Search, Trash2, DollarSign, CreditCard, User, Calendar as CalendarIcon, Percent, RefreshCw, Camera, Clock, Pencil } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Loans() {
  const { loans, loading, createLoan, registerPayment, deleteLoan, renegotiateLoan, updateLoan, fetchLoans } = useLoans();
  const { clients, updateClient, createClient, fetchClients } = useClients();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'overdue' | 'renegotiated' | 'pending' | 'daily'>('all');
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
    interest_only_paid: false,
    interest_amount_paid: '',
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
  
  // Edit loan state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [editLoanIsOverdue, setEditLoanIsOverdue] = useState(false);
  const [editOverdueDays, setEditOverdueDays] = useState(0);
  const [editFormData, setEditFormData] = useState({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'simple' as InterestType,
    interest_mode: 'per_installment' as 'per_installment' | 'on_total',
    payment_type: 'single' as LoanPaymentType | 'daily',
    installments: '1',
    start_date: '',
    due_date: '',
    notes: '',
    daily_amount: '',
    overdue_daily_rate: '', // Custom daily rate for overdue penalty (%)
    overdue_fixed_amount: '', // Fixed amount for overdue penalty (R$)
    overdue_penalty_type: 'percentage' as 'percentage' | 'fixed', // Type of penalty
    apply_overdue_penalty: false,
  });
  const [editInstallmentDates, setEditInstallmentDates] = useState<string[]>([]);

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
  
  const [installmentValue, setInstallmentValue] = useState('');
  
  // Recalcular valor da parcela quando principal, juros ou parcelas mudam
  useEffect(() => {
    if (formData.payment_type === 'installment' && formData.principal_amount && formData.interest_rate && formData.installments) {
      const principal = parseFloat(formData.principal_amount);
      const rate = parseFloat(formData.interest_rate);
      const numInstallments = parseInt(formData.installments) || 1;
      const totalInterest = formData.interest_mode === 'per_installment'
        ? principal * (rate / 100) * numInstallments
        : principal * (rate / 100);
      const total = principal + totalInterest;
      setInstallmentValue((total / numInstallments).toFixed(2));
    }
  }, [formData.principal_amount, formData.installments, formData.interest_mode, formData.payment_type]);
  
  // Handler para quando o usuário edita o valor da parcela
  const handleInstallmentValueChange = (value: string) => {
    setInstallmentValue(value);
    const newInstallmentValue = parseFloat(value);
    if (!newInstallmentValue || !formData.principal_amount || !formData.installments) return;
    
    const principal = parseFloat(formData.principal_amount);
    const numInstallments = parseInt(formData.installments) || 1;
    const totalToReceive = newInstallmentValue * numInstallments;
    const totalInterest = totalToReceive - principal;
    
    // Recalcular a taxa de juros baseada no novo valor de parcela
    let newRate: number;
    if (formData.interest_mode === 'per_installment') {
      newRate = (totalInterest / principal / numInstallments) * 100;
    } else {
      newRate = (totalInterest / principal) * 100;
    }
    
    if (newRate >= 0) {
      setFormData(prev => ({ ...prev, interest_rate: newRate.toFixed(2) }));
    }
  };

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
      case 'daily':
        return loan.payment_type === 'daily';
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
    const profit = totalToReceive - principalAmount;
    
    console.log('handleDailySubmit values:', {
      principalAmount,
      dailyAmount,
      numDays,
      totalToReceive,
      profit,
    });
    
    const loanData = {
      client_id: formData.client_id,
      principal_amount: principalAmount,
      interest_rate: profit,
      interest_type: 'simple' as const,
      interest_mode: 'per_installment' as const,
      payment_type: 'daily' as const,
      installments: numDays,
      start_date: formData.start_date,
      due_date: installmentDates[installmentDates.length - 1],
      remaining_balance: totalToReceive,
      total_interest: dailyAmount,
      notes: formData.notes 
        ? `${formData.notes}\nValor emprestado: R$ ${principalAmount.toFixed(2)}\nParcela diária: R$ ${dailyAmount.toFixed(2)}\nTotal a receber: R$ ${totalToReceive.toFixed(2)}\nLucro: R$ ${profit.toFixed(2)}` 
        : `Valor emprestado: R$ ${principalAmount.toFixed(2)}\nParcela diária: R$ ${dailyAmount.toFixed(2)}\nTotal a receber: R$ ${totalToReceive.toFixed(2)}\nLucro: R$ ${profit.toFixed(2)}`,
      installment_dates: installmentDates,
    };
    
    console.log('loanData being passed to createLoan:', loanData);
    
    await createLoan(loanData);
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
    
    // Para pagamento diário no formulário regular, não permitir - redirecionar para "Novo Diário"
    if (formData.payment_type === 'daily') {
      toast.error('Use o botão "Novo Diário" para criar empréstimos diários');
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
    setInstallmentValue('');
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
      interest_only_paid: false,
      interest_amount_paid: '',
    });
    setIsRenegotiateDialogOpen(true);
  };

  const handleRenegotiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || !renegotiateData.promised_date) return;
    
    const loan = loans.find(l => l.id === selectedLoanId);
    if (!loan) return;
    
    // Se pagou só os juros, registrar o pagamento de juros
    if (renegotiateData.interest_only_paid && renegotiateData.interest_amount_paid) {
      const interestPaid = parseFloat(renegotiateData.interest_amount_paid);
      
      // Registrar pagamento apenas dos juros (não reduz o principal)
      await registerPayment({
        loan_id: selectedLoanId,
        amount: interestPaid,
        principal_paid: 0, // Não paga nada do principal
        interest_paid: interestPaid,
        payment_date: new Date().toISOString().split('T')[0],
        notes: `Pagamento de juros apenas. Valor restante: R$ ${renegotiateData.remaining_amount}`,
      });
      
      // Atualizar notas e nova data de vencimento
      let notesText = loan.notes || '';
      notesText += `\nPagamento de juros: R$ ${interestPaid.toFixed(2)} em ${formatDate(new Date().toISOString())}`;
      notesText += `\nValor que falta: R$ ${renegotiateData.remaining_amount}`;
      notesText += `\nValor prometido: R$ ${renegotiateData.remaining_amount}`;
      
      await renegotiateLoan(selectedLoanId, {
        interest_rate: loan.interest_rate,
        installments: 1,
        installment_dates: [renegotiateData.promised_date],
        due_date: renegotiateData.promised_date,
        notes: notesText,
      });
    } else {
      // Renegociação normal
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
    }
    
    setIsRenegotiateDialogOpen(false);
    setSelectedLoanId(null);
  };

  const openEditDialog = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    // Check if loan is overdue
    const { isOverdue } = getLoanStatus(loan);
    
    // Calculate days overdue
    let daysOverdue = 0;
    if (isOverdue) {
      const numInstallments = loan.installments || 1;
      const principalPerInstallment = loan.principal_amount / numInstallments;
      const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
      const totalPerInstallment = principalPerInstallment + interestPerInstallment;
      const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);
      const dates = (loan.installment_dates as string[]) || [];
      const overdueDate = dates[paidInstallments] || loan.due_date;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(overdueDate);
      due.setHours(0, 0, 0, 0);
      daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    // Parse existing overdue config from notes
    const overdueConfigMatch = loan.notes?.match(/\[OVERDUE_CONFIG:(percentage|fixed):([0-9.]+)\]/);
    const hasExistingOverdueConfig = !!overdueConfigMatch;
    const existingOverdueType = overdueConfigMatch?.[1] as 'percentage' | 'fixed' | undefined;
    const existingOverdueValue = overdueConfigMatch ? parseFloat(overdueConfigMatch[2]) : 0;
    
    // Clean notes for display (remove the config tag)
    const cleanNotes = (loan.notes || '').replace(/\[OVERDUE_CONFIG:[^\]]+\]\n?/g, '').trim();
    
    setEditingLoanId(loanId);
    setEditLoanIsOverdue(isOverdue);
    setEditOverdueDays(daysOverdue);
    setEditFormData({
      client_id: loan.client_id,
      principal_amount: loan.principal_amount.toString(),
      interest_rate: loan.interest_rate.toString(),
      interest_type: loan.interest_type,
      interest_mode: loan.interest_mode || 'per_installment',
      payment_type: loan.payment_type,
      installments: (loan.installments || 1).toString(),
      start_date: loan.start_date,
      due_date: loan.due_date,
      notes: cleanNotes,
      daily_amount: loan.payment_type === 'daily' ? (loan.total_interest || 0).toString() : '',
      overdue_daily_rate: hasExistingOverdueConfig && existingOverdueType === 'percentage' 
        ? existingOverdueValue.toString() 
        : (loan.interest_rate / 30).toFixed(2),
      overdue_fixed_amount: hasExistingOverdueConfig && existingOverdueType === 'fixed' 
        ? existingOverdueValue.toString() 
        : '',
      overdue_penalty_type: hasExistingOverdueConfig ? existingOverdueType! : 'percentage',
      apply_overdue_penalty: hasExistingOverdueConfig,
    });
    setEditInstallmentDates((loan.installment_dates as string[]) || []);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoanId) return;
    
    const loan = loans.find(l => l.id === editingLoanId);
    if (!loan) return;
    
    if (!editFormData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }
    
    let principalAmount = parseFloat(editFormData.principal_amount);
    const interestRate = parseFloat(editFormData.interest_rate);
    const numInstallments = parseInt(editFormData.installments) || 1;
    
    // Build overdue config to store in notes if applying penalty
    let overdueConfigNote = '';
    if (editFormData.apply_overdue_penalty && editLoanIsOverdue) {
      if (editFormData.overdue_penalty_type === 'fixed') {
        const fixedAmount = parseFloat(editFormData.overdue_fixed_amount) || 0;
        overdueConfigNote = `[OVERDUE_CONFIG:fixed:${fixedAmount}]`;
      } else {
        const dailyRate = parseFloat(editFormData.overdue_daily_rate) || 0;
        overdueConfigNote = `[OVERDUE_CONFIG:percentage:${dailyRate}]`;
      }
    }
    
    // Remove any existing overdue config from notes
    let cleanNotes = (editFormData.notes || '').replace(/\[OVERDUE_CONFIG:[^\]]+\]/g, '').trim();
    
    let updateData: any = {
      client_id: editFormData.client_id,
      principal_amount: principalAmount,
      interest_rate: interestRate,
      interest_type: editFormData.interest_type,
      interest_mode: editFormData.interest_mode,
      payment_type: editFormData.payment_type,
      installments: numInstallments,
      start_date: editFormData.start_date,
      due_date: editFormData.due_date,
      notes: overdueConfigNote ? `${overdueConfigNote}\n${cleanNotes}`.trim() : cleanNotes,
      installment_dates: editInstallmentDates,
    };
    
    // Calculate remaining balance and total interest based on payment type
    if (editFormData.payment_type === 'daily') {
      const dailyAmount = parseFloat(editFormData.daily_amount) || 0;
      const totalToReceive = dailyAmount * numInstallments;
      const profit = totalToReceive - principalAmount;
      updateData.remaining_balance = totalToReceive;
      updateData.total_interest = dailyAmount;
      updateData.interest_rate = profit;
    } else {
      const totalInterest = editFormData.interest_mode === 'per_installment'
        ? principalAmount * (interestRate / 100) * numInstallments
        : principalAmount * (interestRate / 100);
      const totalPaid = loan.total_paid || 0;
      updateData.remaining_balance = principalAmount - totalPaid;
      updateData.total_interest = totalInterest;
    }
    
    await updateLoan(editingLoanId, updateData);
    setIsEditDialogOpen(false);
    setEditingLoanId(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">Empréstimos</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Gerencie seus empréstimos</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDailyDialogOpen} onOpenChange={setIsDailyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm border-sky-500 text-sky-600 hover:bg-sky-500/10">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Novo </span>Diário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto p-4 sm:p-6">
                <DialogHeader><DialogTitle className="text-base sm:text-xl">Novo Empréstimo Diário</DialogTitle></DialogHeader>
                <form onSubmit={handleDailySubmit} className="space-y-3 sm:space-y-4">
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Cliente *</Label>
                    <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                      <SelectTrigger className="h-9 sm:h-10 text-sm"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                      <SelectContent>
                        {loanClients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Valor Emprestado (R$) *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={formData.principal_amount} 
                        onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })} 
                        placeholder="Ex: 1000"
                        required 
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Parcela Diária (R$) *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={formData.daily_amount} 
                        onChange={(e) => setFormData({ ...formData, daily_amount: e.target.value })} 
                        placeholder="Ex: 50"
                        required 
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>
                  {formData.principal_amount && formData.daily_amount && installmentDates.length > 0 && (
                    <div className="bg-sky-50 dark:bg-sky-900/30 rounded-lg p-2 sm:p-3 space-y-0.5 sm:space-y-1 border border-sky-200 dark:border-sky-700">
                      <p className="text-xs sm:text-sm font-medium text-sky-900 dark:text-sky-100">Resumo ({installmentDates.length} parcelas):</p>
                      <p className="text-xs sm:text-sm text-sky-700 dark:text-sky-200">
                        Total a receber: {formatCurrency(parseFloat(formData.daily_amount) * installmentDates.length)}
                      </p>
                      <p className="text-xs sm:text-sm text-sky-700 dark:text-sky-200">
                        Lucro: {formatCurrency((parseFloat(formData.daily_amount) * installmentDates.length) - parseFloat(formData.principal_amount))} 
                        ({(((parseFloat(formData.daily_amount) * installmentDates.length) - parseFloat(formData.principal_amount)) / parseFloat(formData.principal_amount) * 100).toFixed(1)}%)
                      </p>
                    </div>
                  )}
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Data de Início</Label>
                    <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="h-9 sm:h-10 text-sm" />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Datas de Cobrança ({installmentDates.length} dias)</Label>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Clique nas datas para selecionar os dias de cobrança</p>
                    <div className="border rounded-md p-2 sm:p-3 bg-background text-foreground">
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
                        className="pointer-events-auto text-xs sm:text-sm"
                      />
                    </div>
                    {installmentDates.length > 0 && formData.daily_amount && (
                      <div className="bg-sky-50 dark:bg-sky-900/30 rounded-lg p-2 sm:p-3 space-y-0.5 sm:space-y-1 border border-sky-200 dark:border-sky-700">
                        <p className="text-xs sm:text-sm font-medium text-sky-900 dark:text-sky-100">Resumo:</p>
                        <p className="text-xs sm:text-sm text-sky-700 dark:text-sky-200">Total a receber: {formatCurrency(parseFloat(formData.daily_amount) * installmentDates.length)}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Observações</Label>
                    <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="text-sm" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => { setIsDailyDialogOpen(false); resetForm(); }} className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">Cancelar</Button>
                    <Button type="submit" className="bg-sky-500 hover:bg-sky-600 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">Criar Diário</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm"><Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Novo </span>Empréstimo</Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto p-4 sm:p-6">
              <DialogHeader><DialogTitle className="text-base sm:text-xl">Novo Empréstimo</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Valor *</Label>
                      <Input type="number" step="0.01" value={formData.principal_amount} onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Taxa de Juros (%) *</Label>
                      <Input type="number" step="0.01" value={formData.interest_rate} onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                    </div>
                  </div>
                )}
                {formData.payment_type !== 'daily' && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Juros Aplicado</Label>
                      <Select value={formData.interest_mode} onValueChange={(v: 'per_installment' | 'on_total') => setFormData({ ...formData, interest_mode: v })}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_installment" className="text-xs sm:text-sm">Por Parcela</SelectItem>
                          <SelectItem value="on_total" className="text-xs sm:text-sm">Sobre o Total</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Modalidade</Label>
                      <Select value={formData.payment_type} onValueChange={(v: LoanPaymentType) => setFormData({ ...formData, payment_type: v })}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single" className="text-xs sm:text-sm">Pagamento Único</SelectItem>
                          <SelectItem value="installment" className="text-xs sm:text-sm">Parcelado</SelectItem>
                          <SelectItem value="daily" className="text-xs sm:text-sm">Diário</SelectItem>
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
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Nº de Parcelas *</Label>
                        <Input type="number" min="1" value={formData.installments} onChange={(e) => setFormData({ ...formData, installments: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Juros Total</Label>
                        <Input 
                          type="text" 
                          readOnly 
                          value={formData.principal_amount && formData.interest_rate
                            ? formData.interest_mode === 'per_installment'
                              ? formatCurrency(parseFloat(formData.principal_amount) * (parseFloat(formData.interest_rate) / 100) * parseInt(formData.installments || '1'))
                              : formatCurrency(parseFloat(formData.principal_amount) * (parseFloat(formData.interest_rate) / 100))
                            : 'R$ 0,00'
                          } 
                          className="bg-muted h-9 sm:h-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Valor da Parcela (R$)</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          value={installmentValue}
                          onChange={(e) => handleInstallmentValueChange(e.target.value)}
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Total a Receber</Label>
                        <Input 
                          type="text" 
                          readOnly 
                          value={installmentValue && formData.installments
                            ? formatCurrency(parseFloat(installmentValue) * parseInt(formData.installments))
                            : 'R$ 0,00'
                          } 
                          className="bg-muted h-9 sm:h-10 text-sm"
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
                <div className={`grid gap-2 sm:gap-4 ${formData.payment_type === 'single' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Data Início</Label>
                    <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                  </div>
                  {formData.payment_type === 'single' && (
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Data Vencimento *</Label>
                      <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                    </div>
                  )}
                </div>
                {formData.payment_type === 'installment' && installmentDates.length > 0 && (
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Vencimento das Parcelas</Label>
                    <ScrollArea className="h-[120px] sm:h-[150px] rounded-md border p-2 sm:p-3">
                      <div className="space-y-1.5 sm:space-y-2">
                        {installmentDates.map((date, index) => (
                          <div key={index} className="flex items-center gap-2 sm:gap-3">
                            <span className="text-xs sm:text-sm font-medium w-16 sm:w-20">Parcela {index + 1}</span>
                            <Input 
                              type="date" 
                              value={date} 
                              onChange={(e) => updateInstallmentDate(index, e.target.value)} 
                              className="flex-1 h-8 sm:h-10 text-xs sm:text-sm"
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
                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Observações</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="text-sm" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">Cancelar</Button>
                  <Button type="submit" className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">Criar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm" />
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
            >
              Todos
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
              className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter !== 'pending' ? 'border-blue-500 text-blue-500 hover:bg-blue-500/10' : ''}`}
            >
              <span className="hidden xs:inline">Em </span>Dia
            </Button>
            <Button
              variant={statusFilter === 'paid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('paid')}
              className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'paid' ? 'bg-primary' : 'border-primary text-primary hover:bg-primary/10'}`}
            >
              Pagos
            </Button>
            <Button
              variant={statusFilter === 'overdue' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('overdue')}
              className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'overdue' ? 'bg-destructive' : 'border-destructive text-destructive hover:bg-destructive/10'}`}
            >
              Atraso
            </Button>
            <Button
              variant={statusFilter === 'renegotiated' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('renegotiated')}
              className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'renegotiated' ? 'bg-yellow-500' : 'border-yellow-500 text-yellow-600 hover:bg-yellow-500/10'}`}
            >
              <span className="hidden xs:inline">Reneg.</span><span className="xs:hidden">Ren.</span>
            </Button>
            <Button
              variant={statusFilter === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('daily')}
              className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'daily' ? 'bg-sky-500' : 'border-sky-500 text-sky-600 hover:bg-sky-500/10'}`}
            >
              <Clock className="w-3 h-3 mr-1" />
              <span className="hidden xs:inline">Diário</span><span className="xs:hidden">Diá.</span>
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (<Skeleton key={i} className="h-40 sm:h-48 w-full rounded-xl" />))}
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <DollarSign className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-muted-foreground">{search ? 'Nenhum empréstimo encontrado' : 'Nenhum empréstimo cadastrado'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredLoans.map((loan) => {
                const isDaily = loan.payment_type === 'daily';
                const numInstallments = loan.installments || 1;
                
                // For daily loans: 
                // - principal_amount = valor emprestado
                // - total_interest = valor da parcela diária
                // - interest_rate = lucro total
                // - remaining_balance = total a receber (decreases with payments)
                const dailyInstallmentAmount = isDaily ? (loan.total_interest || 0) : 0;
                const dailyProfit = isDaily ? loan.interest_rate : 0;
                const dailyTotalToReceive = isDaily ? dailyInstallmentAmount * numInstallments : 0;
                
                // For regular loans
                const principalPerInstallment = loan.principal_amount / numInstallments;
                const calculatedInterestPerInstallment = isDaily ? 0 : loan.principal_amount * (loan.interest_rate / 100);
                const totalPerInstallment = isDaily ? dailyInstallmentAmount : principalPerInstallment + calculatedInterestPerInstallment;
                
                // Use the stored total_interest if it includes overdue penalty (when it's higher than calculated)
                const calculatedTotalInterest = calculatedInterestPerInstallment * numInstallments;
                const storedTotalInterest = loan.total_interest || 0;
                // If stored total_interest is higher, it means overdue penalty was applied
                const effectiveTotalInterest = isDaily ? 0 : Math.max(calculatedTotalInterest, storedTotalInterest);
                
                const totalToReceive = isDaily ? dailyTotalToReceive : loan.principal_amount + effectiveTotalInterest;
                const remainingToReceive = isDaily ? (loan.remaining_balance || 0) - (loan.total_paid || 0) : totalToReceive - (loan.total_paid || 0);
                const initials = loan.client?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                
                // Check if overdue penalty was applied (stored interest is higher than calculated)
                const hasAppliedOverduePenalty = !isDaily && storedTotalInterest > calculatedTotalInterest;
                
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
                
                // Calculate overdue penalty interest
                const overdueDate = (() => {
                  const dates = (loan.installment_dates as string[]) || [];
                  const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);
                  return dates[paidInstallments] || loan.due_date;
                })();
                
                // Parse overdue config from notes
                const overdueConfigMatch = loan.notes?.match(/\[OVERDUE_CONFIG:(percentage|fixed):([0-9.]+)\]/);
                const hasOverdueConfig = !!overdueConfigMatch;
                const overdueConfigType = overdueConfigMatch?.[1] as 'percentage' | 'fixed' | undefined;
                const overdueConfigValue = overdueConfigMatch ? parseFloat(overdueConfigMatch[2]) : 0;
                
                // Calculate days overdue
                const overdueDateObj = new Date(overdueDate);
                overdueDateObj.setHours(0, 0, 0, 0);
                const daysOverdue = today > overdueDateObj ? Math.ceil((today.getTime() - overdueDateObj.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                
                // Calculate dynamic penalty based on config
                let dynamicPenaltyAmount = 0;
                if (isOverdue && daysOverdue > 0 && hasOverdueConfig) {
                  if (overdueConfigType === 'fixed') {
                    // Fixed amount per day (e.g., R$ 50/day × 4 days = R$ 200)
                    dynamicPenaltyAmount = overdueConfigValue * daysOverdue;
                  } else {
                    // Percentage per day based on TOTAL TO RECEIVE (not remaining)
                    // e.g., 1% of R$ 1300 = R$ 13/day × 4 days = R$ 52
                    const baseAmount = loan.principal_amount + calculatedTotalInterest;
                    dynamicPenaltyAmount = baseAmount * (overdueConfigValue / 100) * daysOverdue;
                  }
                } else if (isOverdue && daysOverdue > 0) {
                  // Fallback: use default calculation if no config
                  const dailyRate = loan.interest_rate / 30 / 100;
                  dynamicPenaltyAmount = remainingToReceive * dailyRate * daysOverdue;
                }
                
                const hasSpecialStyle = isPaid || isOverdue || isRenegotiated;
                
                const getCardStyle = () => {
                  if (isPaid) {
                    return 'bg-primary border-primary';
                  }
                  if (isRenegotiated && !isOverdue) {
                    return 'bg-yellow-500/20 border-yellow-400 dark:bg-yellow-500/30 dark:border-yellow-400';
                  }
                  if (isOverdue) {
                    return 'bg-red-500/20 border-red-400 dark:bg-red-500/30 dark:border-red-400';
                  }
                  if (isDaily) {
                    return 'bg-blue-500/20 border-blue-400 dark:bg-blue-500/30 dark:border-blue-400';
                  }
                  return 'bg-card';
                };
                
                const textColor = isPaid ? 'text-white' : isRenegotiated ? 'text-yellow-300' : isOverdue ? 'text-red-300' : '';
                const mutedTextColor = isPaid ? 'text-white/70' : 'text-muted-foreground';
                
                return (
                  <Card key={loan.id} className={`shadow-soft hover:shadow-md transition-shadow border ${getCardStyle()} ${textColor}`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="relative group flex-shrink-0">
                          <Avatar className={`h-12 w-12 sm:h-16 sm:w-16 border-2 ${hasSpecialStyle ? 'border-white/30' : 'border-primary/20'}`}>
                            <AvatarImage src={loan.client?.avatar_url || ''} alt={loan.client?.full_name} />
                            <AvatarFallback className={`text-sm sm:text-lg font-semibold ${hasSpecialStyle ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
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
                              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            )}
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm sm:text-lg truncate">{loan.client?.full_name}</h3>
                            <Badge className={`text-[10px] sm:text-xs flex-shrink-0 ${hasSpecialStyle ? 'bg-white/20 text-white border-white/30' : getPaymentStatusColor(loan.status)}`}>
                              {isRenegotiated && !isOverdue ? 'Reneg.' : getPaymentStatusLabel(loan.status)}
                            </Badge>
                          </div>
                          <p className={`text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1 ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>{formatCurrency(remainingToReceive)}</p>
                          <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>restante a receber</p>
                        </div>
                      </div>
                      
                      <div className={`grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4 p-2 sm:p-3 rounded-lg text-xs sm:text-sm ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
                        <div>
                          <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>Emprestado</p>
                          <p className="font-semibold truncate">{formatCurrency(loan.principal_amount)}</p>
                        </div>
                        <div>
                          <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>Total a Receber</p>
                          <p className="font-semibold truncate">{formatCurrency(totalToReceive)}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2 sm:mt-3 text-xs sm:text-sm">
                        <div className={`flex items-center gap-1.5 sm:gap-2 ${mutedTextColor}`}>
                          <Percent className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          {isDaily ? (
                            <span className="truncate">Lucro: {formatCurrency(dailyProfit)}</span>
                          ) : (
                            <span className="truncate">Juros: {formatPercentage(loan.interest_rate)}</span>
                          )}
                        </div>
                        <div className={`flex items-center gap-1.5 sm:gap-2 ${mutedTextColor}`}>
                          <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{numInstallments}x {formatCurrency(totalPerInstallment)}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 sm:gap-2 ${mutedTextColor}`}>
                          <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">Venc: {(() => {
                            const dates = (loan.installment_dates as string[]) || [];
                            const paidCount = Math.floor((loan.total_paid || 0) / totalPerInstallment);
                            const nextDate = dates[paidCount] || loan.due_date;
                            return formatDate(nextDate);
                          })()}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg font-semibold ${hasSpecialStyle ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                          <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">Pago: {formatCurrency(loan.total_paid || 0)}</span>
                        </div>
                      </div>
                      
                      {/* Overdue penalty section */}
                      {isOverdue && dynamicPenaltyAmount > 0 && (
                        <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg bg-red-500/20 border border-red-400/30">
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="text-red-300 font-medium">
                              Juros de Atraso ({daysOverdue} dias)
                            </span>
                            <span className="font-bold text-red-200">
                              {daysOverdue} dias = {formatCurrency(dynamicPenaltyAmount)}
                            </span>
                          </div>
                          {hasOverdueConfig && (
                            <div className="text-xs text-red-300/70 mt-1">
                              {overdueConfigType === 'fixed' 
                                ? `R$ ${overdueConfigValue.toFixed(2)}/dia` 
                                : `${overdueConfigValue.toFixed(2)}%/dia sobre ${formatCurrency(loan.principal_amount + calculatedTotalInterest)}`
                              }
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-1 text-xs sm:text-sm">
                            <span className="text-red-300/80">Total com Atraso:</span>
                            <span className="font-bold text-white">
                              {formatCurrency(remainingToReceive + dynamicPenaltyAmount)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className={`flex gap-1.5 sm:gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 ${hasSpecialStyle ? 'border-t border-white/20' : 'border-t'}`}>
                        <Button 
                          variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                          size="sm" 
                          className={`flex-1 h-8 sm:h-9 text-xs sm:text-sm ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`} 
                          onClick={() => { setSelectedLoanId(loan.id); setIsPaymentDialogOpen(true); }}
                        >
                          <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          <span className="hidden xs:inline">Pagamento</span><span className="xs:hidden">Pagar</span>
                        </Button>
                        <Button 
                          variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                          size="icon" 
                          className={`h-8 w-8 sm:h-9 sm:w-9 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                          onClick={() => openEditDialog(loan.id)}
                          title="Editar Empréstimo"
                        >
                          <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button 
                          variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                          size="icon" 
                          className={`h-8 w-8 sm:h-9 sm:w-9 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                          onClick={() => openRenegotiateDialog(loan.id)}
                          title="Renegociar"
                        >
                          <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 sm:h-9 sm:w-9 ${hasSpecialStyle ? 'text-white/70 hover:text-white hover:bg-white/20' : ''}`}
                          onClick={() => setDeleteId(loan.id)}
                        >
                          <Trash2 className={`w-3 h-3 sm:w-4 sm:h-4 ${hasSpecialStyle ? '' : 'text-destructive'}`} />
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
                  
                  <div className="space-y-4 border border-yellow-600 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/30">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="interest_only" 
                        checked={renegotiateData.interest_only_paid}
                        onCheckedChange={(checked) => setRenegotiateData({ 
                          ...renegotiateData, 
                          interest_only_paid: checked as boolean 
                        })}
                      />
                      <Label htmlFor="interest_only" className="text-sm font-medium cursor-pointer text-yellow-900 dark:text-yellow-100">
                        Cliente pagou só os juros da parcela
                      </Label>
                    </div>
                    
                    {renegotiateData.interest_only_paid && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-yellow-900 dark:text-yellow-100">Valor Pago (Juros) (R$) *</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={renegotiateData.interest_amount_paid} 
                            onChange={(e) => setRenegotiateData({ ...renegotiateData, interest_amount_paid: e.target.value })} 
                            placeholder="Ex: 100,00"
                            required={renegotiateData.interest_only_paid}
                            className="bg-white text-gray-900 placeholder:text-gray-500 dark:bg-zinc-800 dark:text-white dark:placeholder:text-gray-400 border-yellow-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-yellow-900 dark:text-yellow-100">Valor que Ainda Falta (R$)</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={renegotiateData.remaining_amount} 
                            onChange={(e) => setRenegotiateData({ ...renegotiateData, remaining_amount: e.target.value })} 
                            placeholder="Valor restante"
                            className="bg-white text-gray-900 placeholder:text-gray-500 dark:bg-zinc-800 dark:text-white dark:placeholder:text-gray-400 border-yellow-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {!renegotiateData.interest_only_paid && (
                    <>
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
                    </>
                  )}
                  
                  {renegotiateData.interest_only_paid && (
                    <div className="space-y-2">
                      <Label>Nova Data de Vencimento *</Label>
                      <Input 
                        type="date" 
                        value={renegotiateData.promised_date} 
                        onChange={(e) => setRenegotiateData({ ...renegotiateData, promised_date: e.target.value })} 
                        required 
                      />
                      <p className="text-xs text-muted-foreground">Próxima data de cobrança do valor restante</p>
                    </div>
                  )}
                  
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
                    <Button type="submit">{renegotiateData.interest_only_paid ? 'Registrar Pagamento de Juros' : 'Renegociar'}</Button>
                  </div>
                </form>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Edit Loan Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto p-4 sm:p-6">
            <DialogHeader><DialogTitle className="text-base sm:text-xl">Editar Empréstimo</DialogTitle></DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-3 sm:space-y-4">
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Cliente *</Label>
                <Select value={editFormData.client_id} onValueChange={(v) => setEditFormData({ ...editFormData, client_id: v })}>
                  <SelectTrigger className="h-9 sm:h-10 text-sm"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              
              {editFormData.payment_type === 'daily' ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Valor Emprestado (R$) *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={editFormData.principal_amount} 
                        onChange={(e) => setEditFormData({ ...editFormData, principal_amount: e.target.value })} 
                        required 
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Parcela Diária (R$) *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={editFormData.daily_amount} 
                        onChange={(e) => setEditFormData({ ...editFormData, daily_amount: e.target.value })} 
                        required 
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Datas de Cobrança ({editInstallmentDates.length} dias)</Label>
                    <div className="border rounded-md p-2 sm:p-3 bg-background text-foreground">
                      <Calendar
                        mode="multiple"
                        selected={editInstallmentDates.map(d => new Date(d + 'T12:00:00'))}
                        onSelect={(dates) => {
                          if (dates) {
                            const sortedDates = dates.map(d => d.toISOString().split('T')[0]).sort();
                            setEditInstallmentDates(sortedDates);
                            if (sortedDates.length > 0) {
                              setEditFormData(prev => ({
                                ...prev,
                                due_date: sortedDates[sortedDates.length - 1],
                                installments: sortedDates.length.toString(),
                              }));
                            }
                          } else {
                            setEditInstallmentDates([]);
                          }
                        }}
                        className="pointer-events-auto text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Valor (R$) *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={editFormData.principal_amount} 
                        onChange={(e) => setEditFormData({ ...editFormData, principal_amount: e.target.value })} 
                        required 
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Juros (%)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={editFormData.interest_rate} 
                        onChange={(e) => setEditFormData({ ...editFormData, interest_rate: e.target.value })} 
                        required 
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Tipo de Pagamento</Label>
                      <Select 
                        value={editFormData.payment_type} 
                        onValueChange={(v) => setEditFormData({ ...editFormData, payment_type: v as LoanPaymentType })}
                      >
                        <SelectTrigger className="h-9 sm:h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Pagamento Único</SelectItem>
                          <SelectItem value="installment">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editFormData.payment_type === 'installment' && (
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Parcelas</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={editFormData.installments} 
                          onChange={(e) => setEditFormData({ ...editFormData, installments: e.target.value })} 
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Juros Aplicado</Label>
                    <Select 
                      value={editFormData.interest_mode} 
                      onValueChange={(v) => setEditFormData({ ...editFormData, interest_mode: v as 'per_installment' | 'on_total' })}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_installment">Por Parcela</SelectItem>
                        <SelectItem value="on_total">Sobre o Total</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Data de Início</Label>
                      <Input 
                        type="date" 
                        value={editFormData.start_date} 
                        onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })} 
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Vencimento *</Label>
                      <Input 
                        type="date" 
                        value={editFormData.due_date} 
                        onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })} 
                        required 
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>
                  {editFormData.payment_type === 'installment' && (
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Datas das Parcelas</Label>
                      <ScrollArea className="h-32 border rounded-md p-2">
                        {Array.from({ length: parseInt(editFormData.installments) || 1 }).map((_, index) => (
                          <div key={index} className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground w-16">Parcela {index + 1}:</span>
                            <Input 
                              type="date" 
                              value={editInstallmentDates[index] || ''} 
                              onChange={(e) => {
                                const newDates = [...editInstallmentDates];
                                newDates[index] = e.target.value;
                                setEditInstallmentDates(newDates);
                                if (index === newDates.length - 1 || index === parseInt(editFormData.installments) - 1) {
                                  setEditFormData(prev => ({ ...prev, due_date: e.target.value }));
                                }
                              }} 
                              className="h-8 text-sm flex-1"
                            />
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}
              
              {/* Overdue penalty section - only shown when loan is overdue */}
              {editLoanIsOverdue && editOverdueDays > 0 && (
                <div className="p-3 sm:p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-400">Juros de Atraso</p>
                      <p className="text-xs text-red-300/70">{editOverdueDays} dias em atraso</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="apply_overdue"
                        checked={editFormData.apply_overdue_penalty}
                        onCheckedChange={(checked) => setEditFormData({ ...editFormData, apply_overdue_penalty: !!checked })}
                      />
                      <Label htmlFor="apply_overdue" className="text-xs sm:text-sm text-red-300 cursor-pointer">
                        Aplicar juros de atraso
                      </Label>
                    </div>
                  </div>
                  
                  {editFormData.apply_overdue_penalty && (
                    <>
                      {/* Penalty type selector */}
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm text-red-300">Tipo de cálculo</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={editFormData.overdue_penalty_type === 'percentage' ? 'default' : 'outline'}
                            size="sm"
                            className={`h-9 text-xs sm:text-sm ${editFormData.overdue_penalty_type === 'percentage' ? 'bg-red-500 hover:bg-red-600' : 'border-red-500/30 text-red-300'}`}
                            onClick={() => setEditFormData({ ...editFormData, overdue_penalty_type: 'percentage' })}
                          >
                            <Percent className="w-3 h-3 mr-1" />
                            Porcentagem
                          </Button>
                          <Button
                            type="button"
                            variant={editFormData.overdue_penalty_type === 'fixed' ? 'default' : 'outline'}
                            size="sm"
                            className={`h-9 text-xs sm:text-sm ${editFormData.overdue_penalty_type === 'fixed' ? 'bg-red-500 hover:bg-red-600' : 'border-red-500/30 text-red-300'}`}
                            onClick={() => setEditFormData({ ...editFormData, overdue_penalty_type: 'fixed' })}
                          >
                            <DollarSign className="w-3 h-3 mr-1" />
                            Valor Fixo
                          </Button>
                        </div>
                      </div>
                      
                      {editFormData.overdue_penalty_type === 'percentage' ? (
                        <div className="space-y-1 sm:space-y-2">
                          <Label className="text-xs sm:text-sm text-red-300">Taxa diária de atraso (%)</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={editFormData.overdue_daily_rate} 
                            onChange={(e) => setEditFormData({ ...editFormData, overdue_daily_rate: e.target.value })} 
                            className="h-9 sm:h-10 text-sm bg-red-500/10 border-red-500/30"
                            placeholder="Ex: 3.0 (3% ao dia)"
                          />
                          <p className="text-[10px] sm:text-xs text-red-300/60">
                            Juros mensal ({editFormData.interest_rate}%) ÷ 30 = {(parseFloat(editFormData.interest_rate) / 30).toFixed(2)}% ao dia
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1 sm:space-y-2">
                          <Label className="text-xs sm:text-sm text-red-300">Valor fixo do juros de atraso (R$)</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={editFormData.overdue_fixed_amount} 
                            onChange={(e) => setEditFormData({ ...editFormData, overdue_fixed_amount: e.target.value })} 
                            className="h-9 sm:h-10 text-sm bg-red-500/10 border-red-500/30"
                            placeholder="Ex: 150.00"
                          />
                          <p className="text-[10px] sm:text-xs text-red-300/60">
                            Valor total do juros de atraso a ser adicionado
                          </p>
                        </div>
                      )}
                      
                      {(() => {
                        const principal = parseFloat(editFormData.principal_amount) || 0;
                        const rate = parseFloat(editFormData.interest_rate) || 0;
                        const numInst = parseInt(editFormData.installments) || 1;
                        const interestPerInst = principal * (rate / 100);
                        const totalToReceive = principal + (interestPerInst * numInst);
                        const loan = loans.find(l => l.id === editingLoanId);
                        const totalPaid = loan?.total_paid || 0;
                        const remainingToReceive = totalToReceive - totalPaid;
                        
                        let penaltyAmount = 0;
                        if (editFormData.overdue_penalty_type === 'fixed') {
                          penaltyAmount = parseFloat(editFormData.overdue_fixed_amount) || 0;
                        } else {
                          const dailyRate = parseFloat(editFormData.overdue_daily_rate) || 0;
                          penaltyAmount = remainingToReceive * (dailyRate / 100) * editOverdueDays;
                        }
                        
                        return (
                          <div className="bg-red-500/20 rounded-lg p-2 sm:p-3 space-y-1">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-red-300">Saldo devedor:</span>
                              <span className="font-medium text-red-200">{formatCurrency(remainingToReceive)}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-red-300">
                                {editFormData.overdue_penalty_type === 'fixed' 
                                  ? 'Juros de atraso (valor fixo):' 
                                  : `Juros de atraso (${editOverdueDays} dias x ${editFormData.overdue_daily_rate || 0}%):`}
                              </span>
                              <span className="font-bold text-red-200">+ {formatCurrency(penaltyAmount)}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm border-t border-red-500/30 pt-1 mt-1">
                              <span className="text-red-300 font-medium">Novo total:</span>
                              <span className="font-bold text-white">{formatCurrency(remainingToReceive + penaltyAmount)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
              
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Observações</Label>
                <Textarea 
                  value={editFormData.notes} 
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} 
                  rows={2} 
                  className="text-sm"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">
                  Cancelar
                </Button>
                <Button type="submit" className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
