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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel, formatPercentage, calculateOverduePenalty } from '@/lib/calculations';
import { Plus, Search, Trash2, DollarSign, CreditCard, User, Calendar as CalendarIcon, Percent, RefreshCw, Camera, Clock, Pencil, FileText, Download, HelpCircle, History } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateContractReceipt, generatePaymentReceipt, generateOperationsReport, ContractReceiptData, PaymentReceiptData, LoanOperationData, OperationsReportData } from '@/lib/pdfGenerator';
import { useProfile } from '@/hooks/useProfile';
import ReceiptPreviewDialog from '@/components/ReceiptPreviewDialog';
import PaymentReceiptPrompt from '@/components/PaymentReceiptPrompt';
import LoansPageTutorial from '@/components/tutorials/LoansPageTutorial';
import { useAuth } from '@/contexts/AuthContext';

// Helper para extrair pagamentos parciais do notes do loan
const getPartialPaymentsFromNotes = (notes: string | null): Record<number, number> => {
  const payments: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    payments[parseInt(match[1])] = parseFloat(match[2]);
  }
  return payments;
};

// Helper para calcular quantas parcelas estão pagas usando o sistema de tracking
const getPaidInstallmentsCount = (loan: { notes?: string | null; installments?: number | null; principal_amount: number; interest_rate: number; interest_mode?: string | null }): number => {
  const numInstallments = loan.installments || 1;
  
  let totalInterest = 0;
  if (loan.interest_mode === 'on_total') {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100);
  } else {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
  }
  
  const principalPerInstallment = loan.principal_amount / numInstallments;
  const interestPerInstallment = totalInterest / numInstallments;
  const baseInstallmentValue = principalPerInstallment + interestPerInstallment;
  
  // Verificar taxa de renovação (suporta formato novo e antigo)
  // Novo: [RENEWAL_FEE_INSTALLMENT:index:newValue:feeAmount]
  // Antigo: [RENEWAL_FEE_INSTALLMENT:index:newValue]
  const renewalFeeMatch = (loan.notes || '').match(/\[RENEWAL_FEE_INSTALLMENT:(\d+):([0-9.]+)(?::[0-9.]+)?\]/);
  const renewalFeeInstallmentIndex = renewalFeeMatch ? parseInt(renewalFeeMatch[1]) : null;
  const renewalFeeValue = renewalFeeMatch ? parseFloat(renewalFeeMatch[2]) : 0;
  
  const getInstallmentValue = (index: number) => {
    if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
      return renewalFeeValue;
    }
    return baseInstallmentValue;
  };
  
  const partialPayments = getPartialPaymentsFromNotes(loan.notes);
  
  let paidCount = 0;
  for (let i = 0; i < numInstallments; i++) {
    const installmentValue = getInstallmentValue(i);
    const paidAmount = partialPayments[i] || 0;
    if (paidAmount >= installmentValue * 0.99) { // 99% tolerance for rounding
      paidCount++;
    } else {
      break; // Para no primeiro não pago
    }
  }
  
  return paidCount;
};

export default function Loans() {
  const { loans, loading, createLoan, registerPayment, deleteLoan, deletePayment, renegotiateLoan, updateLoan, fetchLoans, getLoanPayments } = useLoans();
  const { clients, updateClient, createClient, fetchClients } = useClients();
  const { profile } = useProfile();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'overdue' | 'renegotiated' | 'pending' | 'daily' | 'weekly' | 'interest_only'>('all');
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
    interest_payment_date: new Date().toISOString().split('T')[0], // Data do pagamento de juros
    send_interest_notification: false,
    renewal_fee_enabled: false,
    renewal_fee_percentage: '20',
    renewal_fee_amount: '',
    new_remaining_with_fee: '',
    renewal_fee_installment: 'next' as 'next' | string, // 'next' = próxima parcela, ou índice específico
  });
  const [interestOnlyOriginalRemaining, setInterestOnlyOriginalRemaining] = useState(0);
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
  
  // Receipt preview state
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [receiptPreviewData, setReceiptPreviewData] = useState<ContractReceiptData | null>(null);

  // Payment receipt prompt state
  const [isPaymentReceiptOpen, setIsPaymentReceiptOpen] = useState(false);
  const [paymentReceiptData, setPaymentReceiptData] = useState<PaymentReceiptData | null>(null);

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
    contract_date: '',
    start_date: '',
    due_date: '',
    notes: '',
    daily_amount: '',
    overdue_daily_rate: '', // Custom daily rate for overdue penalty (%)
    overdue_fixed_amount: '', // Fixed amount for overdue penalty (R$)
    overdue_penalty_type: 'percentage' as 'percentage' | 'fixed', // Type of penalty
    apply_overdue_penalty: false,
    send_notification: false, // Enviar notificação WhatsApp (desativado por padrão)
  });
  const [editInstallmentDates, setEditInstallmentDates] = useState<string[]>([]);
  
  // Payment history state
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  const [paymentHistoryLoanId, setPaymentHistoryLoanId] = useState<string | null>(null);
  const [paymentHistoryData, setPaymentHistoryData] = useState<any[]>([]);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  
  // Tutorial states - Single page tutorial (8 steps)
  const [pageTutorialRun, setPageTutorialRun] = useState(false);
  const [pageTutorialStep, setPageTutorialStep] = useState(0);
  const [showTutorialConfirmation, setShowTutorialConfirmation] = useState(false);
  const { user } = useAuth();

  // Check if user has seen tutorial on mount
  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!user?.id) return;
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('has_seen_loans_tutorial')
        .eq('id', user.id)
        .single();
      
      if (profileData) {
        // Show page tutorial confirmation if not seen
        if (!profileData.has_seen_loans_tutorial) {
          setShowTutorialConfirmation(true);
        }
      }
    };
    
    checkTutorialStatus();
  }, [user?.id]);

  // Start page tutorial
  const handleStartTutorial = () => {
    setShowTutorialConfirmation(false);
    setPageTutorialRun(true);
    setPageTutorialStep(0);
  };

  // Decline page tutorial
  const handleDeclineTutorial = async () => {
    setShowTutorialConfirmation(false);
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ has_seen_loans_tutorial: true })
        .eq('id', user.id);
    }
  };

  // Exit page tutorial
  const handleExitPageTutorial = async () => {
    setPageTutorialRun(false);
    setPageTutorialStep(0);
    
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ has_seen_loans_tutorial: true })
        .eq('id', user.id);
    }
    toast.info('Tutorial encerrado');
  };

  // Finish page tutorial
  const handlePageTutorialFinish = async () => {
    setPageTutorialRun(false);
    setPageTutorialStep(0);
    
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ has_seen_loans_tutorial: true })
        .eq('id', user.id);
    }
    toast.success('Tutorial concluído! 🎉');
  };

  // Dialog open handler - simplified (no form tutorial)
  const handleDialogOpen = (open: boolean) => {
    setIsDialogOpen(open);
  };

  const handleNewClientClick = () => {
    setShowNewClientForm(true);
  };

  const handleCreateClient = async () => {
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
  
  // Open payment history dialog
  const openPaymentHistory = async (loanId: string) => {
    setPaymentHistoryLoanId(loanId);
    setLoadingPaymentHistory(true);
    setIsPaymentHistoryOpen(true);
    
    const result = await getLoanPayments(loanId);
    if (result.data) {
      setPaymentHistoryData(result.data);
    }
    setLoadingPaymentHistory(false);
  };
  
  // Handle delete payment confirmation
  const handleDeletePayment = async () => {
    if (!deletePaymentId || !paymentHistoryLoanId) return;
    
    await deletePayment(deletePaymentId, paymentHistoryLoanId);
    setDeletePaymentId(null);
    
    // Refresh payment history
    const result = await getLoanPayments(paymentHistoryLoanId);
    if (result.data) {
      setPaymentHistoryData(result.data);
    }
  };
  
  const [formData, setFormData] = useState({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'simple' as InterestType,
    interest_mode: 'per_installment' as 'per_installment' | 'on_total',
    payment_type: 'single' as LoanPaymentType | 'daily',
    installments: '1',
    contract_date: new Date().toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
    daily_amount: '',
    daily_period: '15',
    is_historical_contract: false, // Contract being registered retroactively
    send_creation_notification: false, // Send WhatsApp notification on creation (default: off)
  });
  
  // Check if any dates are in the past
  const hasPastDates = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check installmentDates for installment, weekly, and daily payment types
    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'daily') && installmentDates.length > 0) {
      return installmentDates.some(d => {
        const date = new Date(d + 'T12:00:00');
        return date < today;
      });
    }
    
    if (formData.due_date) {
      const dueDate = new Date(formData.due_date + 'T12:00:00');
      return dueDate < today;
    }
    
    return false;
  })();
  
  const [installmentValue, setInstallmentValue] = useState('');
  const [isManuallyEditingInstallment, setIsManuallyEditingInstallment] = useState(false);
  
  // Store reference to interest rate for recalculation (avoid dependency loop)
  const interestRateRef = useRef(formData.interest_rate);
  useEffect(() => {
    if (!isManuallyEditingInstallment) {
      interestRateRef.current = formData.interest_rate;
    }
  }, [formData.interest_rate, isManuallyEditingInstallment]);
  
  // Recalcular valor da parcela quando principal, parcelas ou modo mudam (apenas se não estiver editando manualmente)
  useEffect(() => {
    if (isManuallyEditingInstallment) return;
    
    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly') && formData.principal_amount && interestRateRef.current && formData.installments) {
      const principal = parseFloat(formData.principal_amount);
      const rate = parseFloat(interestRateRef.current);
      const numInstallments = parseInt(formData.installments) || 1;
      const totalInterest = formData.interest_mode === 'per_installment'
        ? principal * (rate / 100) * numInstallments
        : principal * (rate / 100);
      const total = principal + totalInterest;
      setInstallmentValue((total / numInstallments).toFixed(2));
    }
  }, [formData.principal_amount, formData.installments, formData.interest_mode, formData.payment_type, isManuallyEditingInstallment]);
  
  // Reset manual editing flag quando dados principais mudam (mas não quando só a taxa muda)
  useEffect(() => {
    setIsManuallyEditingInstallment(false);
  }, [formData.principal_amount, formData.installments, formData.interest_mode, formData.payment_type]);
  
  // Calcula o "Juros Total" exibido no formulário, priorizando o valor da parcela arredondada
  const getTotalInterestDisplay = () => {
    if (!formData.principal_amount) return 'R$ 0,00';
    const principal = parseFloat(formData.principal_amount);
    const numInstallments = parseInt(formData.installments || '1');
    let totalInterest: number | null = null;

    // Se o usuário editou o valor da parcela, usamos ele como base
    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly') && installmentValue) {
      const perInstallment = parseFloat(installmentValue);
      if (!perInstallment) return 'R$ 0,00';
      totalInterest = perInstallment * numInstallments - principal;
    } else if (formData.interest_rate) {
      const rate = parseFloat(formData.interest_rate);
      totalInterest = formData.interest_mode === 'per_installment'
        ? principal * (rate / 100) * numInstallments
        : principal * (rate / 100);
    }

    if (totalInterest === null || !isFinite(totalInterest)) return 'R$ 0,00';
    return formatCurrency(totalInterest);
  };
  
  // Handler para quando o usuário edita o valor da parcela
  const handleInstallmentValueChange = (value: string) => {
    setIsManuallyEditingInstallment(true);
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
    
    // Permite qualquer taxa >= 0 (arredondamentos podem resultar em taxas baixas)
    if (newRate >= 0 && isFinite(newRate)) {
      setFormData(prev => ({ ...prev, interest_rate: newRate.toFixed(2) }));
    }
  };

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    new_due_date: '', // Nova data de vencimento (opcional)
    payment_type: 'partial' as 'partial' | 'total' | 'installment',
    selected_installments: [] as number[],
    partial_installment_index: null as number | null, // Índice da parcela para pagamento parcial
    send_notification: false, // Enviar notificação WhatsApp (desativado por padrão)
  });

  // Generate installment dates when start_date or installments change
  useEffect(() => {
    if (formData.payment_type === 'installment' && formData.start_date) {
      const numInstallments = parseInt(formData.installments) || 1;
      const startDate = new Date(formData.start_date + 'T12:00:00');
      const startDay = startDate.getDate(); // Get the day of month from start date
      const newDates: string[] = [];
      
      for (let i = 0; i < numInstallments; i++) {
        const date = new Date(startDate);
        // Add months instead of days - keep the same day of month
        date.setMonth(date.getMonth() + i);
        
        // Handle edge cases where the day doesn't exist in the target month
        // (e.g., day 31 in a month with 30 days)
        if (date.getDate() !== startDay) {
          // Go to the last day of the previous month
          date.setDate(0);
        }
        
        newDates.push(date.toISOString().split('T')[0]);
      }
      
      setInstallmentDates(newDates);
      // Set the last installment date as the due_date
      if (newDates.length > 0) {
        setFormData(prev => ({ ...prev, due_date: newDates[newDates.length - 1] }));
      }
    }
  }, [formData.payment_type, formData.start_date, formData.installments]);

  // Generate weekly dates when start_date or installments change
  useEffect(() => {
    if (formData.payment_type === 'weekly' && formData.start_date) {
      const numInstallments = parseInt(formData.installments) || 1;
      const startDate = new Date(formData.start_date + 'T12:00:00');
      const newDates: string[] = [];
      
      for (let i = 0; i < numInstallments; i++) {
        const date = new Date(startDate);
        // Add weeks (7 days) for each installment
        date.setDate(date.getDate() + (i * 7));
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
    
    // Se alterou a primeira parcela no calendário, sincroniza com start_date
    if (index === 0) {
      setFormData(prev => ({ ...prev, start_date: date }));
    }
    
    // Update due_date to the last installment date
    if (index === newDates.length - 1) {
      setFormData(prev => ({ ...prev, due_date: date }));
    }
  };

  const getLoanStatus = (loan: typeof loans[0]) => {
    const numInstallments = loan.installments || 1;
    
    // Calculate total interest based on interest_mode
    let totalInterest = 0;
    if (loan.interest_mode === 'on_total') {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100);
    } else {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
    }
    
    const totalToReceive = loan.principal_amount + totalInterest;
    const remainingToReceive = totalToReceive - (loan.total_paid || 0);
    const principalPerInstallment = loan.principal_amount / numInstallments;
    const interestPerInstallment = totalInterest / numInstallments;
    const totalPerInstallment = principalPerInstallment + interestPerInstallment;
    
    const isPaid = loan.status === 'paid' || remainingToReceive <= 0;
    const isRenegotiated = loan.notes?.includes('Valor prometido');
    const isHistoricalContract = loan.notes?.includes('[HISTORICAL_CONTRACT]');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let isOverdue = false;
    let overdueInstallmentIndex = -1;
    let overdueDate = '';
    let daysOverdue = 0;
    
    if (!isPaid && remainingToReceive > 0) {
      const paidInstallments = getPaidInstallmentsCount(loan);
      const dates = (loan.installment_dates as string[]) || [];
      
      if (isHistoricalContract) {
        // For historical contracts, only check future dates
        const futureDates = dates.filter(d => {
          const date = new Date(d + 'T12:00:00');
          return date >= today;
        });
        
        if (futureDates.length > 0) {
          const nextFutureDate = new Date(futureDates[0] + 'T12:00:00');
          isOverdue = today > nextFutureDate;
          if (isOverdue) {
            overdueInstallmentIndex = dates.indexOf(futureDates[0]);
            overdueDate = futureDates[0];
            daysOverdue = Math.ceil((today.getTime() - nextFutureDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        } else if (dates.length === 0) {
          const dueDate = new Date(loan.due_date + 'T12:00:00');
          isOverdue = dueDate >= today ? false : today > dueDate;
          if (isOverdue) {
            overdueDate = loan.due_date;
            daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        }
      } else {
        // Normal logic for non-historical contracts
        if (dates.length > 0 && paidInstallments < dates.length) {
          const nextDueDate = new Date(dates[paidInstallments] + 'T12:00:00');
          isOverdue = today > nextDueDate;
          if (isOverdue) {
            overdueInstallmentIndex = paidInstallments;
            overdueDate = dates[paidInstallments];
            daysOverdue = Math.ceil((today.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        } else {
          const dueDate = new Date(loan.due_date + 'T12:00:00');
          isOverdue = today > dueDate;
          if (isOverdue) {
            overdueDate = loan.due_date;
            daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        }
      }
    }
    
    return { 
      isPaid, 
      isRenegotiated, 
      isOverdue, 
      overdueInstallmentIndex, 
      overdueDate, 
      daysOverdue,
      totalPerInstallment 
    };
  };

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.client?.full_name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    if (statusFilter === 'all') return true;
    
    const { isPaid, isRenegotiated, isOverdue } = getLoanStatus(loan);
    const isInterestOnlyPayment = loan.notes?.includes('[INTEREST_ONLY_PAYMENT]') && !isPaid;
    
    switch (statusFilter) {
      case 'paid':
        return isPaid;
      case 'overdue':
        return isOverdue && !isPaid;
      case 'renegotiated':
        return isRenegotiated && !isPaid && !isOverdue && !isInterestOnlyPayment;
      case 'pending':
        return !isPaid && !isOverdue && !isRenegotiated && !isInterestOnlyPayment && loan.payment_type !== 'daily' && loan.payment_type !== 'weekly';
      case 'daily':
        return loan.payment_type === 'daily';
      case 'weekly':
        return loan.payment_type === 'weekly';
      case 'interest_only':
        return isInterestOnlyPayment && !isOverdue;
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
      contract_date: formData.contract_date,
      start_date: formData.start_date,
      due_date: installmentDates[installmentDates.length - 1],
      remaining_balance: totalToReceive,
      total_interest: dailyAmount,
      notes: formData.is_historical_contract 
        ? `[HISTORICAL_CONTRACT]\n${formData.notes ? formData.notes + '\n' : ''}Valor emprestado: R$ ${principalAmount.toFixed(2)}\nParcela diária: R$ ${dailyAmount.toFixed(2)}\nTotal a receber: R$ ${totalToReceive.toFixed(2)}\nLucro: R$ ${profit.toFixed(2)}`
        : (formData.notes 
          ? `${formData.notes}\nValor emprestado: R$ ${principalAmount.toFixed(2)}\nParcela diária: R$ ${dailyAmount.toFixed(2)}\nTotal a receber: R$ ${totalToReceive.toFixed(2)}\nLucro: R$ ${profit.toFixed(2)}` 
          : `Valor emprestado: R$ ${principalAmount.toFixed(2)}\nParcela diária: R$ ${dailyAmount.toFixed(2)}\nTotal a receber: R$ ${totalToReceive.toFixed(2)}\nLucro: R$ ${profit.toFixed(2)}`),
      installment_dates: installmentDates,
      send_creation_notification: formData.send_creation_notification,
    };
    
    console.log('loanData being passed to createLoan:', loanData);
    
    await createLoan(loanData);
    setIsDailyDialogOpen(false);
    resetForm();
  };

  // Calculate past installments and their value for historical contracts
  // Uses the rounded installmentValue when available (user-edited)
  const pastInstallmentsData = (() => {
    if (!formData.is_historical_contract || !hasPastDates) return { count: 0, totalValue: 0 };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const principal = parseFloat(formData.principal_amount) || 0;
    const numInstallments = parseInt(formData.installments) || 1;
    
    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'daily') && installmentDates.length > 0) {
      const pastDates = installmentDates.filter(d => {
        const date = new Date(d + 'T12:00:00');
        return date < today;
      });
      
      // Use the rounded installment value if user edited it, otherwise calculate
      let valuePerInstallment: number;
      let principalPerInstallment: number;
      let interestPerInstallment: number;
      
      // For daily loans, use daily_amount directly
      if (formData.payment_type === 'daily' && formData.daily_amount) {
        const dailyAmount = parseFloat(formData.daily_amount);
        const totalToReceive = dailyAmount * numInstallments;
        const profit = totalToReceive - principal;
        valuePerInstallment = dailyAmount;
        principalPerInstallment = principal / numInstallments;
        interestPerInstallment = profit / numInstallments;
      } else if (installmentValue && parseFloat(installmentValue) > 0) {
        // User edited/rounded the installment value - use it directly
        valuePerInstallment = parseFloat(installmentValue);
        principalPerInstallment = principal / numInstallments;
        interestPerInstallment = valuePerInstallment - principalPerInstallment;
      } else {
        // Calculate from interest rate
        const rate = parseFloat(formData.interest_rate) || 0;
        interestPerInstallment = formData.interest_mode === 'per_installment'
          ? principal * (rate / 100)
          : (principal * (rate / 100)) / numInstallments;
        principalPerInstallment = principal / numInstallments;
        valuePerInstallment = principalPerInstallment + interestPerInstallment;
      }
      
      return {
        count: pastDates.length,
        totalValue: valuePerInstallment * pastDates.length,
        dates: pastDates,
        valuePerInstallment,
        principalPerInstallment,
        interestPerInstallment,
      };
    }
    
    // For single payment with past due date, count as 1
    if (formData.due_date) {
      const dueDate = new Date(formData.due_date + 'T12:00:00');
      if (dueDate < today) {
        const rate = parseFloat(formData.interest_rate) || 0;
        const interestAmount = principal * (rate / 100);
        return {
          count: 1,
          totalValue: principal + interestAmount,
          dates: [formData.due_date],
          valuePerInstallment: principal + interestAmount,
          principalPerInstallment: principal,
          interestPerInstallment: interestAmount,
        };
      }
    }
    
    return { count: 0, totalValue: 0 };
  })();

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
    // For single payment, due_date comes from start_date (first payment date)
    // For installments, due_date comes from the last installment date
    let finalDueDate = formData.due_date;
    if (formData.payment_type === 'single') {
      finalDueDate = formData.start_date;
    } else if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly') && installmentDates.length > 0) {
      finalDueDate = installmentDates[installmentDates.length - 1];
    }
    
    if (!finalDueDate) {
      toast.error('Informe a data de vencimento');
      return;
    }
    
    // Build notes with historical contract marker if selected
    let notes = formData.notes || '';
    if (formData.is_historical_contract && hasPastDates) {
      notes = `[HISTORICAL_CONTRACT]\n${notes}`.trim();
    }
    
    // Calculate total_interest based on interest_mode e valor da parcela (quando informado)
    const principal = parseFloat(formData.principal_amount);
    let rate = parseFloat(formData.interest_rate);
    const numInstallments = parseInt(formData.installments) || 1;
    let totalInterest: number;

    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly') && installmentValue) {
      const perInstallment = parseFloat(installmentValue);
      const totalToReceive = perInstallment * numInstallments;
      totalInterest = totalToReceive - principal;

      // Recalcula a taxa de juros apenas para exibição, baseada no valor arredondado da parcela
      if (totalInterest >= 0) {
        const computedRate = formData.interest_mode === 'per_installment'
          ? (totalInterest / principal / numInstallments) * 100
          : (totalInterest / principal) * 100;
        rate = parseFloat(computedRate.toFixed(2));
      }
    } else {
      totalInterest = formData.interest_mode === 'per_installment'
        ? principal * (rate / 100) * numInstallments
        : principal * (rate / 100);
    }
    
    const result = await createLoan({
      ...formData,
      principal_amount: principal,
      interest_rate: rate,
      installments: numInstallments,
      total_interest: totalInterest,
      remaining_balance: principal + totalInterest,
      due_date: finalDueDate,
      installment_dates: formData.payment_type === 'installment' ? installmentDates : [],
      notes: notes || undefined,
      send_creation_notification: formData.send_creation_notification,
    });
    
    // If historical contract with past installments, register them as paid automatically
    if (result?.data && formData.is_historical_contract && pastInstallmentsData.count > 0) {
      const loanId = result.data.id;
      
      // Register a single payment for all past installments
      await registerPayment({
        loan_id: loanId,
        amount: pastInstallmentsData.totalValue,
        principal_paid: (pastInstallmentsData.principalPerInstallment || 0) * pastInstallmentsData.count,
        interest_paid: (pastInstallmentsData.interestPerInstallment || 0) * pastInstallmentsData.count,
        payment_date: new Date().toISOString().split('T')[0],
        notes: `[CONTRATO_ANTIGO] Pagamento automático de ${pastInstallmentsData.count} parcela(s) anterior(es) já recebida(s)`,
      });
      
      toast.success(`${pastInstallmentsData.count} parcela(s) passada(s) registrada(s) como já recebida(s)`);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) return;
    
    const selectedLoan = loans.find(l => l.id === selectedLoanId);
    if (!selectedLoan) return;
    
    const numInstallments = selectedLoan.installments || 1;
    
    // Calculate total interest based on interest_mode
    let totalInterest = 0;
    if (selectedLoan.interest_mode === 'on_total') {
      totalInterest = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100);
    } else {
      totalInterest = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100) * numInstallments;
    }
    
    const interestPerInstallment = totalInterest / numInstallments;
    const totalToReceive = selectedLoan.principal_amount + totalInterest;
    const remainingToReceive = totalToReceive - (selectedLoan.total_paid || 0);
    
    const principalPerInstallment = selectedLoan.principal_amount / numInstallments;
    const baseInstallmentValue = principalPerInstallment + interestPerInstallment;
    
    // Verificar se há taxa de renovação aplicada em uma parcela específica
    // Suporta formato novo e antigo
    const renewalFeeMatch = (selectedLoan.notes || '').match(/\[RENEWAL_FEE_INSTALLMENT:(\d+):([0-9.]+)(?::[0-9.]+)?\]/);
    const renewalFeeInstallmentIndex = renewalFeeMatch ? parseInt(renewalFeeMatch[1]) : null;
    const renewalFeeValue = renewalFeeMatch ? parseFloat(renewalFeeMatch[2]) : 0;
    
    // Função para obter o valor de uma parcela específica (considera taxa extra)
    const getInstallmentValue = (index: number) => {
      if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
        return renewalFeeValue;
      }
      return baseInstallmentValue;
    };
    
    let amount: number;
    let interest_paid: number;
    let principal_paid: number;
    
    if (paymentData.payment_type === 'total') {
      // Usar o remaining_balance real do banco (inclui principal + juros restantes)
      amount = selectedLoan.remaining_balance;
      
      // Calcular juros restantes: total_interest menos juros já pagos
      const totalInterestFromLoan = selectedLoan.total_interest || 0;
      const totalPaidSoFar = selectedLoan.total_paid || 0;
      
      // Calcular quanto do principal já foi pago
      const paidInstallmentsCount = Math.floor(totalPaidSoFar / baseInstallmentValue);
      const interestAlreadyPaid = paidInstallmentsCount * interestPerInstallment;
      
      // Juros restantes = total de juros - juros já pagos
      const remainingInterest = Math.max(0, totalInterestFromLoan - interestAlreadyPaid);
      
      // No pagamento total, paga todos os juros restantes + principal restante
      interest_paid = Math.min(amount, remainingInterest);
      principal_paid = amount - interest_paid;
    } else if (paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0) {
      // Paying selected installments - somar valor real de cada parcela (incluindo taxa extra se aplicável)
      amount = paymentData.selected_installments.reduce((sum, i) => sum + getInstallmentValue(i), 0);
      
      // Calcular juros e principal proporcionalmente
      const baseTotal = baseInstallmentValue * paymentData.selected_installments.length;
      const extraAmount = amount - baseTotal; // Valor extra da taxa de renovação
      
      interest_paid = (interestPerInstallment * paymentData.selected_installments.length) + extraAmount;
      principal_paid = principalPerInstallment * paymentData.selected_installments.length;
    } else {
      // Partial payment - permite pagar menos que uma parcela
      amount = parseFloat(paymentData.amount);
      interest_paid = Math.min(amount, interestPerInstallment);
      principal_paid = amount - interest_paid;
    }
    
    // Função helper para extrair pagamentos parciais do notes
    const getPartialPayments = (notes: string | null): Record<number, number> => {
      const payments: Record<number, number> = {};
      const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
      for (const match of matches) {
        payments[parseInt(match[1])] = parseFloat(match[2]);
      }
      return payments;
    };
    
    // Calcular qual parcela está sendo paga
    const existingPartials = getPartialPayments(selectedLoan.notes);
    let targetInstallmentIndex = 0;
    let accumulatedPaid = 0;
    
    // Se o usuário selecionou uma parcela específica, usar ela
    if (paymentData.payment_type === 'partial' && paymentData.partial_installment_index !== null) {
      targetInstallmentIndex = paymentData.partial_installment_index;
      accumulatedPaid = existingPartials[targetInstallmentIndex] || 0;
    } else {
      // Senão, encontrar a primeira parcela não paga completamente
      for (let i = 0; i < numInstallments; i++) {
        const installmentVal = getInstallmentValue(i);
        const partialPaid = existingPartials[i] || 0;
        
        if (partialPaid >= installmentVal * 0.99) {
          // Esta parcela já está paga completamente
          continue;
        } else {
          // Esta é a parcela atual que precisa ser paga
          targetInstallmentIndex = i;
          accumulatedPaid = partialPaid;
          break;
        }
      }
    }
    
    // Quando é pagamento parcial, atualizar o tracking de parcelas
    let updatedNotes = selectedLoan.notes || '';
    let installmentNote = '';
    
    if (paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0) {
      // Pagamento de parcelas selecionadas - marca como completas
      installmentNote = paymentData.selected_installments.length === 1
        ? `Parcela ${paymentData.selected_installments[0] + 1} de ${numInstallments}`
        : `Parcelas ${paymentData.selected_installments.map(i => i + 1).join(', ')} de ${numInstallments}`;
      
      // Marcar parcelas selecionadas como pagas no tracking
      for (const idx of paymentData.selected_installments) {
        const installmentVal = getInstallmentValue(idx);
        // Remover tracking parcial anterior se existir
        updatedNotes = updatedNotes.replace(new RegExp(`\\[PARTIAL_PAID:${idx}:[0-9.]+\\]`, 'g'), '');
        // Adicionar como totalmente paga
        updatedNotes += `[PARTIAL_PAID:${idx}:${installmentVal.toFixed(2)}]`;
        
        // IMPORTANTE: Se esta parcela tinha taxa extra, remover a tag pois já foi paga
        if (renewalFeeInstallmentIndex !== null && idx === renewalFeeInstallmentIndex) {
          updatedNotes = updatedNotes.replace(/\[RENEWAL_FEE_INSTALLMENT:[^\]]+\]\n?/g, '');
        }
      }
    } else if (paymentData.payment_type === 'partial') {
      // Pagamento parcial - atualizar tracking da parcela selecionada
      // Permite registrar valores maiores que a parcela (sem limitar)
      const targetInstallmentValue = getInstallmentValue(targetInstallmentIndex);
      const newPartialTotal = accumulatedPaid + amount; // Sem Math.min para permitir valor maior
      
      // Remover tracking anterior desta parcela se existir
      updatedNotes = updatedNotes.replace(new RegExp(`\\[PARTIAL_PAID:${targetInstallmentIndex}:[0-9.]+\\]`, 'g'), '');
      // Adicionar novo valor (pode ser maior que o valor original da parcela)
      updatedNotes += `[PARTIAL_PAID:${targetInstallmentIndex}:${newPartialTotal.toFixed(2)}]`;
      
      const remaining = targetInstallmentValue - newPartialTotal;
      if (remaining > 0) {
        installmentNote = `Pagamento parcial - Parcela ${targetInstallmentIndex + 1}/${numInstallments}. Falta: ${formatCurrency(remaining)}`;
      } else if (remaining < 0) {
        installmentNote = `Pagamento - Parcela ${targetInstallmentIndex + 1}/${numInstallments}. Excedente: ${formatCurrency(Math.abs(remaining))}`;
        // Se esta parcela tinha taxa extra e foi quitada (mesmo com excedente), remover a tag
        if (renewalFeeInstallmentIndex !== null && targetInstallmentIndex === renewalFeeInstallmentIndex) {
          updatedNotes = updatedNotes.replace(/\[RENEWAL_FEE_INSTALLMENT:[^\]]+\]\n?/g, '');
        }
      } else {
        installmentNote = `Parcela ${targetInstallmentIndex + 1}/${numInstallments} quitada`;
        // Se esta parcela tinha taxa extra e foi quitada, remover a tag
        if (renewalFeeInstallmentIndex !== null && targetInstallmentIndex === renewalFeeInstallmentIndex) {
          updatedNotes = updatedNotes.replace(/\[RENEWAL_FEE_INSTALLMENT:[^\]]+\]\n?/g, '');
        }
      }
    }
    
    const installmentNumber = paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0
      ? paymentData.selected_installments[0] + 1
      : targetInstallmentIndex + 1;
    
    // Atualizar notes do loan com tracking de parcelas ANTES do registerPayment
    // para que as notas já estejam salvas quando o fetchLoans for chamado
    if (updatedNotes !== selectedLoan.notes) {
      await supabase.from('loans').update({ notes: updatedNotes.trim() }).eq('id', selectedLoanId);
    }
    
    // CORREÇÃO: Se o usuário informou uma nova data de vencimento, atualizar ANTES do registerPayment
    // para que o fetchLoans() interno do registerPayment pegue a data correta
    if (paymentData.new_due_date) {
      const currentDates = (selectedLoan.installment_dates as string[]) || [];
      let updatedDates = [...currentDates];
      
      // Se for parcelado, atualizar a próxima parcela em aberto
      if ((selectedLoan.payment_type === 'installment' || selectedLoan.payment_type === 'weekly') && currentDates.length > 0) {
        // Usar o updatedNotes que já foi salvo no banco, não o notes antigo do selectedLoan
        const loanWithUpdatedNotes = { 
          ...selectedLoan, 
          notes: updatedNotes 
        };
        const paidInstallmentsCount = getPaidInstallmentsCount(loanWithUpdatedNotes);
        // Atualiza a data da próxima parcela em aberto
        if (paidInstallmentsCount < currentDates.length) {
          updatedDates[paidInstallmentsCount] = paymentData.new_due_date;
        }
      }
      
      // Atualizar o due_date e installment_dates ANTES de registerPayment
      await supabase.from('loans').update({ 
        due_date: paymentData.new_due_date,
        installment_dates: updatedDates.length > 0 ? updatedDates : [paymentData.new_due_date]
      }).eq('id', selectedLoanId);
    }
    
    await registerPayment({
      loan_id: selectedLoanId,
      amount: amount,
      principal_paid: principal_paid,
      interest_paid: interest_paid,
      payment_date: paymentData.payment_date,
      notes: installmentNote,
      send_notification: paymentData.send_notification,
    });
    
    // Calculate new remaining balance after payment - usar remaining_balance do banco
    const newRemainingBalance = selectedLoan.remaining_balance - amount;
    
    // Calculate total contract value (principal + interest)
    let totalInterestForReceipt = 0;
    if (selectedLoan.interest_mode === 'on_total') {
      totalInterestForReceipt = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100);
    } else {
      totalInterestForReceipt = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100) * numInstallments;
    }
    const totalContractValue = selectedLoan.principal_amount + totalInterestForReceipt;

    // Show payment receipt prompt
    setPaymentReceiptData({
      type: 'loan',
      contractId: selectedLoan.id,
      companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
      clientName: selectedLoan.client?.full_name || 'Cliente',
      installmentNumber: installmentNumber,
      totalInstallments: numInstallments,
      amountPaid: amount,
      paymentDate: paymentData.payment_date,
      remainingBalance: Math.max(0, newRemainingBalance),
      totalPaid: (selectedLoan.total_paid || 0) + amount,
      totalContract: totalContractValue,
    });
    setIsPaymentReceiptOpen(true);
    
    setIsPaymentDialogOpen(false);
    setSelectedLoanId(null);
    setPaymentData({ amount: '', payment_date: new Date().toISOString().split('T')[0], new_due_date: '', payment_type: 'partial', selected_installments: [], partial_installment_index: null, send_notification: false });
  };

  const resetForm = () => {
    setFormData({
      client_id: '', principal_amount: '', interest_rate: '', interest_type: 'simple',
      interest_mode: 'per_installment', payment_type: 'single', installments: '1', 
      contract_date: new Date().toISOString().split('T')[0],
      start_date: new Date().toISOString().split('T')[0], due_date: '', notes: '',
      daily_amount: '', daily_period: '15', is_historical_contract: false, send_creation_notification: false,
    });
    setInstallmentDates([]);
    setInstallmentValue('');
  };

  const openRenegotiateDialog = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    // Calculate total interest based on interest_mode
    const numInstallments = loan.installments || 1;
    
    let totalInterest = 0;
    if (loan.interest_mode === 'on_total') {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100);
    } else {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
    }
    
    // Interest per installment for auto-fill
    const interestPerInstallment = totalInterest / numInstallments;
    
    // Total original do contrato
    const totalToReceive = loan.principal_amount + totalInterest;
    
    // Total já pago (inclui parcelas + juros anteriores)
    const totalPaid = loan.total_paid || 0;
    
    // Valor que realmente falta considerando pagamentos já feitos
    const actualRemaining = totalToReceive - totalPaid;
    
    // Para "só juros": se já houve pagamento anterior de "só juros", usar o valor salvo
    // Caso contrário, usar o remaining atual (que já considera parcelas pagas)
    let remainingForInterestOnly = actualRemaining > 0 ? actualRemaining : 0;
    
    if (loan.notes?.includes('[INTEREST_ONLY_PAYMENT]')) {
      const match = loan.notes.match(/Valor que falta: R\$ ([0-9.,]+)/);
      if (match) {
        const storedRemaining = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(storedRemaining) && storedRemaining > 0) {
          remainingForInterestOnly = storedRemaining;
        }
      }
    }
    
    // Para renegociação normal
    const remainingForRenegotiation = actualRemaining > 0 ? actualRemaining : 0;
    
    setSelectedLoanId(loanId);
    const today = new Date();
    // Default to 7 days for weekly, 30 days for others
    today.setDate(today.getDate() + (loan.payment_type === 'weekly' ? 7 : 30));
    setRenegotiateData({
      promised_amount: '',
      promised_date: today.toISOString().split('T')[0],
      // Aqui usamos o remaining para renegociação normal, mas o modal vai usar
      // remainingForInterestOnly quando "só juros" estiver marcado
      remaining_amount: remainingForRenegotiation > 0 ? remainingForRenegotiation.toFixed(2) : '0',
      notes: loan.notes || '',
      interest_only_paid: false,
      interest_amount_paid: interestPerInstallment.toFixed(2), // Pre-fill with calculated interest
      interest_payment_date: new Date().toISOString().split('T')[0], // Data do pagamento de juros
      send_interest_notification: true,
      renewal_fee_enabled: false,
      renewal_fee_percentage: '20',
      renewal_fee_amount: '',
      new_remaining_with_fee: remainingForRenegotiation > 0 ? remainingForRenegotiation.toFixed(2) : '0',
      renewal_fee_installment: 'next',
    });
    // Guardar o valor original para quando marcar "só juros"
    setInterestOnlyOriginalRemaining(remainingForInterestOnly);
    setIsRenegotiateDialogOpen(true);
  };

  const handleGenerateLoanReceipt = (loan: typeof loans[0], interestOnlyPayment?: { amountPaid: number; remainingBalance: number }) => {
    const numInstallments = loan.installments || 1;
    let totalInterest = 0;
    if (loan.interest_mode === 'on_total') {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100);
    } else {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
    }
    const totalToReceive = loan.principal_amount + totalInterest;
    const installmentValue = totalToReceive / numInstallments;
    
    const receiptData: ContractReceiptData = {
      type: 'loan',
      contractId: loan.id,
      companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
      client: {
        name: loan.client?.full_name || 'Cliente',
        phone: loan.client?.phone || undefined,
        address: loan.client?.address || undefined,
      },
      negotiation: {
        principal: loan.principal_amount,
        interestRate: loan.interest_rate,
        installments: numInstallments,
        installmentValue: installmentValue,
        totalToReceive: totalToReceive,
        startDate: loan.start_date,
      },
      dueDates: (loan.installment_dates as string[]) || [loan.due_date],
      interestOnlyPayment: interestOnlyPayment ? {
        amountPaid: interestOnlyPayment.amountPaid,
        paymentDate: new Date().toISOString().split('T')[0],
        remainingBalance: interestOnlyPayment.remainingBalance,
      } : undefined,
    };
    
    setReceiptPreviewData(receiptData);
    setIsReceiptPreviewOpen(true);
  };

  const handleRenegotiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || !renegotiateData.promised_date) return;
    
    const loan = loans.find(l => l.id === selectedLoanId);
    if (!loan) return;
    
    // Se pagou só os juros, registrar o pagamento de juros
    if (renegotiateData.interest_only_paid && renegotiateData.interest_amount_paid) {
      const interestPaid = parseFloat(renegotiateData.interest_amount_paid);

      // Recalcular cenário atual do contrato (apenas para preencher default caso o campo esteja vazio)
      const numInstallments = loan.installments || 1;
      const baseTotalInterest = loan.interest_mode === 'on_total'
        ? loan.principal_amount * (loan.interest_rate / 100)
        : loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
      const totalToReceive = loan.principal_amount + baseTotalInterest;
      const totalPaidBefore = loan.total_paid || 0;
      const originalRemaining = totalToReceive - totalPaidBefore;

      // O valor que falta NUNCA deve descer automaticamente em pagamento só de juros.
      // Se taxa de renovação estiver habilitada, o remaining_balance deve AUMENTAR pelo valor da taxa
      // (não substituir pelo valor da parcela única)
      let safeRemaining: number;
      if (renegotiateData.renewal_fee_enabled) {
        // Quando há taxa de renovação, o remaining_balance = original + taxa
        const feeAmount = parseFloat(renegotiateData.renewal_fee_amount) || 0;
        safeRemaining = originalRemaining + feeAmount;
      } else {
        const manualRemaining = renegotiateData.remaining_amount
          ? parseFloat(renegotiateData.remaining_amount.replace(',', '.'))
          : originalRemaining;
        safeRemaining = isNaN(manualRemaining) ? originalRemaining : manualRemaining;
      }

      // Registrar pagamento apenas dos juros (principal_pago continua 0)
      await registerPayment({
        loan_id: selectedLoanId,
        amount: interestPaid,
        principal_paid: 0, // Nunca reduz principal neste fluxo
        interest_paid: interestPaid,
        payment_date: renegotiateData.interest_payment_date || new Date().toISOString().split('T')[0],
        notes: `[INTEREST_ONLY_PAYMENT] Pagamento de juros apenas. Valor restante: R$ ${safeRemaining.toFixed(2)}`,
      });
      
      // Atualizar notas e nova data de vencimento
      let notesText = loan.notes || '';
      // Adicionar marcador se ainda não existir
      if (!notesText.includes('[INTEREST_ONLY_PAYMENT]')) {
        notesText = `[INTEREST_ONLY_PAYMENT]\n${notesText}`;
      }
      notesText += `\nPagamento de juros: R$ ${interestPaid.toFixed(2)} em ${formatDate(new Date().toISOString())}`;
      if (renegotiateData.renewal_fee_enabled) {
        // Determinar qual parcela receberá a taxa de renovação
        const numInstallments = loan.installments || 1;
        const principalPerInstallment = loan.principal_amount / numInstallments;
        const totalInterestLoan = loan.total_interest || 0;
        const interestPerInstallmentLoan = totalInterestLoan / numInstallments;
        const originalInstallmentValue = principalPerInstallment + interestPerInstallmentLoan;
        
        const paidInstallments = getPaidInstallmentsCount(loan);
        const targetInstallment = renegotiateData.renewal_fee_installment === 'next' 
          ? paidInstallments 
          : parseInt(renegotiateData.renewal_fee_installment);
        
        // Calcular o novo valor da parcela específica = valor original + taxa de renovação
        const feeAmount = parseFloat(renegotiateData.renewal_fee_amount) || 0;
        const newInstallmentValue = originalInstallmentValue + feeAmount;
        
        notesText += `\nTaxa de renovação: ${renegotiateData.renewal_fee_percentage}% (R$ ${renegotiateData.renewal_fee_amount})`;
        notesText += `\n[RENEWAL_FEE_INSTALLMENT:${targetInstallment}:${newInstallmentValue.toFixed(2)}:${feeAmount.toFixed(2)}]`;
      }
      notesText += `\nValor que falta: R$ ${safeRemaining.toFixed(2)}`;
      
      // Manter número de parcelas original
      const currentInstallments = loan.installments || 1;
      const currentDates = (loan.installment_dates as string[]) || [];
      const paidInstallmentsCount = getPaidInstallmentsCount(loan);
      let newInstallmentDates = [...currentDates];

      // CORREÇÃO: Usar a data prometida pelo usuário para a próxima parcela em aberto,
      // em vez de simplesmente empurrar todas as datas +1 mês
      if (currentDates.length > 0 && renegotiateData.promised_date) {
        if (paidInstallmentsCount < currentDates.length) {
          newInstallmentDates[paidInstallmentsCount] = renegotiateData.promised_date;
        }
      } else if (currentDates.length === 0 && renegotiateData.promised_date) {
        // Se não tinha datas, usar a nova data prometida como primeira parcela
        newInstallmentDates = [renegotiateData.promised_date];
      }

      const finalDates = newInstallmentDates.length > 0 ? newInstallmentDates : currentDates;
      const finalDueDate = paidInstallmentsCount < finalDates.length
        ? finalDates[paidInstallmentsCount]
        : finalDates[finalDates.length - 1];
      
      await renegotiateLoan(selectedLoanId, {
        interest_rate: loan.interest_rate,
        installments: currentInstallments, // Mantém o número original de parcelas
        installment_dates: finalDates,
        due_date: finalDueDate,
        notes: notesText,
        remaining_balance: safeRemaining, // Atualiza o saldo restante com o novo valor (inclui taxa de renovação se aplicada)
      });
      
      // Validação visual do saldo atualizado
      if (renegotiateData.renewal_fee_enabled) {
        toast.success(
          `Saldo atualizado: ${formatCurrency(safeRemaining)} (inclui taxa de renovação de ${renegotiateData.renewal_fee_percentage}%)`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Novo saldo a cobrar: ${formatCurrency(safeRemaining)}`, { duration: 4000 });
      }
      
      // Enviar notificação WhatsApp se marcado
      if (renegotiateData.send_interest_notification) {
        try {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('phone')
              .eq('id', currentUser.id)
              .single();
            
            const userPhone = profileData?.phone;
            if (userPhone) {
              const loanIdShort = selectedLoanId.split('-')[0].toUpperCase();
              const clientName = loan.client?.full_name || 'Cliente';
              const newDueDate = formatDate(finalDueDate);
              
              const renewalFeeInfo = renegotiateData.renewal_fee_enabled 
                ? `\n📈 Taxa de Renovação: ${renegotiateData.renewal_fee_percentage}% (+${formatCurrency(parseFloat(renegotiateData.renewal_fee_amount) || 0)})`
                : '';
              
              const message = `💰 *PAGAMENTO DE JUROS REGISTRADO*
━━━━━━━━━━━━━━━━━━━━━

📋 Contrato: EMP-${loanIdShort}
👤 Cliente: ${clientName}
💵 Valor Pago (Juros): ${formatCurrency(interestPaid)}${renewalFeeInfo}
📊 Novo Valor a Cobrar: ${formatCurrency(safeRemaining)}
📅 Nova Data de Vencimento: ${newDueDate}

✅ Pagamento de juros registrado com sucesso!
📌 O valor principal não foi alterado.`;

              await supabase.functions.invoke('send-whatsapp', {
                body: { phone: userPhone, message }
              });
            }
          }
        } catch (error) {
          console.error('Erro ao enviar notificação WhatsApp:', error);
        }
      }
      
      // Fechar o diálogo primeiro para evitar problemas de estado
      setIsRenegotiateDialogOpen(false);
      setSelectedLoanId(null);
      
      // Abrir comprovante após pagamento de juros
      handleGenerateLoanReceipt(loan, {
        amountPaid: interestPaid,
        remainingBalance: safeRemaining,
      });
      
      return; // Sair da função aqui, não executar o else
    } else if (renegotiateData.renewal_fee_enabled) {
      // Aplicar juros extra em parcela específica (sem pagamento de juros)
      const numInstallments = loan.installments || 1;
      const principalPerInstallment = loan.principal_amount / numInstallments;
      const totalInterestLoan = loan.total_interest || 0;
      const interestPerInstallmentLoan = totalInterestLoan / numInstallments;
      const originalInstallmentValue = principalPerInstallment + interestPerInstallmentLoan;
      
      // Extrair pagamentos parciais
      const partialPayments: Record<number, number> = {};
      const matches = (loan.notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
      for (const match of matches) {
        partialPayments[parseInt(match[1])] = parseFloat(match[2]);
      }
      
      // Determinar parcela alvo
      let targetInstallment = 0;
      if (renegotiateData.renewal_fee_installment === 'next') {
        // Encontrar próxima parcela não totalmente paga
        for (let i = 0; i < numInstallments; i++) {
          const paidAmount = partialPayments[i] || 0;
          if (paidAmount < originalInstallmentValue * 0.99) {
            targetInstallment = i;
            break;
          }
        }
      } else {
        targetInstallment = parseInt(renegotiateData.renewal_fee_installment);
      }
      
      // Calcular valor RESTANTE da parcela alvo (considerando pagamentos parciais)
      const paidOnTarget = partialPayments[targetInstallment] || 0;
      const remainingOnTarget = originalInstallmentValue - paidOnTarget;
      
      // Calcular o novo valor da parcela específica = valor restante + taxa
      const feeAmount = parseFloat(renegotiateData.renewal_fee_amount) || 0;
      const newInstallmentValue = remainingOnTarget + feeAmount;
      
      // CORREÇÃO: Usar o remaining_balance atual do banco de dados como base
      const currentRemaining = loan.remaining_balance || 0;
      
      // Se já existia uma taxa anterior, subtrair ela antes de adicionar a nova (para não acumular)
      const existingFeeMatchNew = (loan.notes || '').match(/\[RENEWAL_FEE_INSTALLMENT:\d+:[0-9.]+:([0-9.]+)\]/);
      let existingFeeAmount = 0;
      if (existingFeeMatchNew) {
        existingFeeAmount = parseFloat(existingFeeMatchNew[1]);
      }
      
      // Novo saldo = atual - taxa antiga + taxa nova
      const newRemaining = currentRemaining - existingFeeAmount + feeAmount;
      
      // Atualizar notas com tag de renovação
      let notesText = loan.notes || '';
      // Remover tag anterior se existir
      notesText = notesText.replace(/\[RENEWAL_FEE_INSTALLMENT:[^\]]+\]\n?/g, '');
      // IMPORTANTE: Limpar o tracking de pagamento parcial desta parcela, pois o novo valor já considera isso
      notesText = notesText.replace(new RegExp(`\\[PARTIAL_PAID:${targetInstallment}:[0-9.]+\\]`, 'g'), '');
      notesText += `\nTaxa extra: ${renegotiateData.renewal_fee_percentage}% (R$ ${renegotiateData.renewal_fee_amount}) na parcela ${targetInstallment + 1}`;
      // Armazenar: índice da parcela, novo valor da parcela, e a taxa real aplicada
      notesText += `\n[RENEWAL_FEE_INSTALLMENT:${targetInstallment}:${newInstallmentValue.toFixed(2)}:${feeAmount.toFixed(2)}]`;
      
      await renegotiateLoan(selectedLoanId, {
        interest_rate: loan.interest_rate,
        installments: loan.installments || 1,
        installment_dates: (loan.installment_dates as string[]) || [],
        due_date: loan.due_date,
        notes: notesText,
        remaining_balance: newRemaining,
      });
      
      toast.success(
        `Taxa extra de ${formatCurrency(feeAmount)} aplicada na parcela ${targetInstallment + 1}. Novo total: ${formatCurrency(newRemaining)}`,
        { duration: 5000 }
      );
    } else {
      // Renegociação normal (não usado atualmente)
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
      const totalInterestForOverdue = loan.total_interest || 0;
      const interestPerInstallmentForOverdue = totalInterestForOverdue / numInstallments;
      const totalPerInstallment = principalPerInstallment + interestPerInstallmentForOverdue;
      const paidInstallments = getPaidInstallmentsCount(loan);
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
      contract_date: loan.contract_date || loan.start_date,
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
      send_notification: false,
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
    
    // Build overdue config to store in notes if applying penalty (only fixed amount)
    let overdueConfigNote = '';
    if (editFormData.apply_overdue_penalty && editLoanIsOverdue) {
      const fixedAmount = parseFloat(editFormData.overdue_fixed_amount) || 0;
      overdueConfigNote = `[OVERDUE_CONFIG:fixed:${fixedAmount}]`;
    }
    
    // Remove any existing overdue config from notes
    let cleanNotes = (editFormData.notes || '').replace(/\[OVERDUE_CONFIG:[^\]]+\]/g, '').trim();
    
    // For single payment, due_date comes from start_date (first payment date)
    // For installments, due_date comes from the last installment date
    let finalDueDate = editFormData.due_date;
    if (editFormData.payment_type === 'single') {
      finalDueDate = editFormData.start_date;
    } else if (editFormData.payment_type === 'installment' && editInstallmentDates.length > 0) {
      finalDueDate = editInstallmentDates[editInstallmentDates.length - 1];
    }
    
    let updateData: any = {
      client_id: editFormData.client_id,
      principal_amount: principalAmount,
      interest_rate: interestRate,
      interest_type: editFormData.interest_type,
      interest_mode: editFormData.interest_mode,
      payment_type: editFormData.payment_type,
      installments: numInstallments,
      contract_date: editFormData.contract_date,
      start_date: editFormData.start_date,
      due_date: finalDueDate,
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

  const handleGenerateOperationsReport = async () => {
    try {
      toast.loading('Gerando relatório...', { id: 'generating-report' });
      
      // Get payments for all loans
      const loansWithPayments: LoanOperationData[] = await Promise.all(
        loans.map(async (loan) => {
          const paymentsResult = await getLoanPayments(loan.id);
          const payments = paymentsResult.data || [];
          const numInstallments = loan.installments || 1;
          
          // Calculate total interest based on interest_mode
          let totalInterest = loan.total_interest || 0;
          const totalToReceive = loan.principal_amount + totalInterest;
          
          // Check if it's an interest-only payment loan
          const isInterestOnlyLoan = loan.notes?.includes('[INTEREST_ONLY_PAYMENT]');
          
          // Determine status
          let status = 'pending';
          if (isInterestOnlyLoan) {
            status = 'interest_only';
          } else if (loan.status === 'paid' || (loan.total_paid || 0) >= totalToReceive) {
            status = 'paid';
          } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(loan.due_date + 'T12:00:00');
            if (dueDate < today) {
              status = 'overdue';
            }
          }
          
          return {
            id: loan.id,
            clientName: loan.client?.full_name || 'Cliente',
            principalAmount: loan.principal_amount,
            interestRate: loan.interest_rate,
            interestMode: loan.interest_mode || 'on_total',
            installments: numInstallments,
            totalInterest: totalInterest,
            totalToReceive: totalToReceive,
            totalPaid: loan.total_paid || 0,
            remainingBalance: totalToReceive - (loan.total_paid || 0),
            status: status,
            startDate: loan.start_date,
            dueDate: loan.due_date,
            paymentType: loan.payment_type,
            payments: payments.map(p => ({
              date: p.payment_date,
              amount: p.amount,
              principalPaid: p.principal_paid || 0,
              interestPaid: p.interest_paid || 0,
              notes: p.notes || undefined,
            })),
          };
        })
      );
      
      // Calculate summary
      const summary = {
        totalLoans: loans.length,
        totalLent: loans.reduce((sum, l) => sum + l.principal_amount, 0),
        totalInterest: loansWithPayments.reduce((sum, l) => sum + l.totalInterest, 0),
        totalToReceive: loansWithPayments.reduce((sum, l) => sum + l.totalToReceive, 0),
        totalReceived: loans.reduce((sum, l) => sum + (l.total_paid || 0), 0),
        totalPending: loansWithPayments.reduce((sum, l) => sum + l.remainingBalance, 0),
        paidLoans: loansWithPayments.filter(l => l.status === 'paid').length,
        pendingLoans: loansWithPayments.filter(l => l.status === 'pending').length,
        overdueLoans: loansWithPayments.filter(l => l.status === 'overdue').length,
      };
      
      const reportData: OperationsReportData = {
        companyName: profile?.company_name || '',
        userName: profile?.full_name || '',
        generatedAt: new Date().toISOString(),
        loans: loansWithPayments,
        summary: summary,
      };
      
      await generateOperationsReport(reportData);
      toast.success('Relatório gerado com sucesso!', { id: 'generating-report' });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório', { id: 'generating-report' });
    }
  };

  return (
    <DashboardLayout>
      {/* Tutorial Confirmation Modal */}
      <AlertDialog open={showTutorialConfirmation} onOpenChange={setShowTutorialConfirmation}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg flex items-center gap-2">
              🎓 Bem-vindo aos Empréstimos!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Deseja fazer o tutorial interativo para aprender a usar o sistema de empréstimos? 
              É rápido e você aprenderá todas as funcionalidades.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel 
              onClick={handleDeclineTutorial}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/30"
            >
              Não, já sei usar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleStartTutorial}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sim, quero aprender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Page Tutorial (main page elements) */}
      <LoansPageTutorial 
        run={pageTutorialRun} 
        onFinish={handlePageTutorialFinish}
        stepIndex={pageTutorialStep}
        onStepChange={setPageTutorialStep}
      />

      {/* Fixed Tutorial Exit Bar */}
      {pageTutorialRun && (
        <div className="tutorial-exit-bar fixed bottom-0 left-0 right-0 bg-destructive text-destructive-foreground p-3 z-[10002] flex items-center justify-center gap-4 shadow-lg">
          <span className="text-sm font-medium">📚 Você está no tutorial guiado</span>
          <Button 
            variant="outline" 
            size="sm"
            className="bg-white text-destructive hover:bg-destructive-foreground border-white font-medium"
            onClick={handleExitPageTutorial}
          >
            ❌ Sair do Tutorial
          </Button>
        </div>
      )}
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">Empréstimos</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Gerencie seus empréstimos</p>
          </div>
          <TooltipProvider delayDuration={300}>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1.5 text-xs sm:text-sm"
                    onClick={() => {
                      setPageTutorialRun(true);
                      setPageTutorialStep(0);
                    }}
                  >
                    <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Tutorial</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Inicie o tour guiado para aprender a usar a página</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="tutorial-download-report gap-1.5 sm:gap-2 text-xs sm:text-sm"
                    onClick={handleGenerateOperationsReport}
                    disabled={loans.length === 0}
                  >
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Baixar Relatório</span>
                    <span className="sm:hidden">Relatório</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Baixe um PDF completo com todos seus empréstimos</p>
                </TooltipContent>
              </Tooltip>
              <Dialog open={isDailyDialogOpen} onOpenChange={setIsDailyDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="tutorial-new-daily gap-1.5 sm:gap-2 text-xs sm:text-sm border-sky-500 text-sky-600 hover:bg-sky-500/10">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Novo </span>Diário
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Crie empréstimo com cobrança diária</p>
                  </TooltipContent>
                </Tooltip>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto p-4 sm:p-6">
                <DialogHeader><DialogTitle className="text-base sm:text-xl">Novo Empréstimo Diário</DialogTitle></DialogHeader>
                <form onSubmit={handleDailySubmit} className="space-y-3 sm:space-y-4">
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Cliente *</Label>
                    <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                      <SelectTrigger className="h-9 sm:h-10 text-sm"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                      <SelectContent className="z-[10001] bg-popover">
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
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Data do Contrato</Label>
                      <Input type="date" value={formData.contract_date} onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })} className="h-9 sm:h-10 text-sm" />
                      <p className="text-[10px] text-muted-foreground">Quando foi fechado</p>
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">1ª Cobrança</Label>
                      <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="h-9 sm:h-10 text-sm" />
                      <p className="text-[10px] text-muted-foreground">Quando começa</p>
                    </div>
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
                  
                  {/* Historical contract option when dates are in the past - Daily loans */}
                  {hasPastDates && (
                    <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-400/30 space-y-2">
                      <p className="text-sm text-yellow-300 font-medium">
                        ⚠️ Este contrato possui datas anteriores à data atual
                      </p>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="is_historical_contract_daily"
                          checked={formData.is_historical_contract}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_historical_contract: !!checked })}
                          className="mt-0.5 border-yellow-400 data-[state=checked]:bg-yellow-500"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="is_historical_contract_daily" className="text-sm text-yellow-200 cursor-pointer">
                            Este é um contrato antigo que estou registrando
                          </Label>
                          <p className="text-xs text-yellow-300/70">
                            Se marcado, o contrato só ficará em atraso após a próxima data futura vencer
                          </p>
                        </div>
                      </div>
                      {!formData.is_historical_contract && (
                        <p className="text-xs text-red-300 mt-1">
                          Se não marcar, o contrato será considerado em atraso imediatamente
                        </p>
                      )}
                      {formData.is_historical_contract && pastInstallmentsData.count > 0 && (
                        <div className="p-2 rounded bg-green-500/20 border border-green-400/30 mt-2">
                          <p className="text-xs text-green-300">
                            ✓ <strong>{pastInstallmentsData.count}</strong> parcela(s) passada(s) serão automaticamente registradas como já recebidas 
                            ({formatCurrency(pastInstallmentsData.totalValue)})
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* WhatsApp Notification Option - Daily loans */}
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-muted/30">
                    <Checkbox
                      id="send_creation_notification_daily"
                      checked={formData.send_creation_notification}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_creation_notification: !!checked }))}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor="send_creation_notification_daily" className="text-sm font-medium cursor-pointer">
                        Receber notificação WhatsApp deste contrato
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Alertas de atraso e relatórios serão enviados normalmente mesmo que você não marque essa opção
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => { setIsDailyDialogOpen(false); resetForm(); }} className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">Cancelar</Button>
                    <Button type="submit" className="bg-sky-500 hover:bg-sky-600 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">Criar Diário</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
              <Dialog open={isDialogOpen} onOpenChange={handleDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button size="sm" className="tutorial-new-loan gap-1.5 sm:gap-2 text-xs sm:text-sm"><Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Novo </span>Empréstimo</Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Crie empréstimo parcelado, semanal ou pagamento único</p>
                  </TooltipContent>
                </Tooltip>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto p-4 sm:p-6">
              <DialogHeader><DialogTitle className="text-base sm:text-xl">Novo Empréstimo</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div className="space-y-2 tutorial-form-client">
                  <Label>Cliente *</Label>
                  
                  {!showNewClientForm ? (
                    <div className="space-y-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="tutorial-new-client-btn w-full border-dashed border-primary text-primary hover:bg-primary/10"
                        onClick={handleNewClientClick}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Cadastrar novo cliente
                      </Button>
                      <div className="tutorial-client-select">
                        <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                          <SelectContent className="z-[10001]">
                            {loanClients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div key="new-client-form" className="space-y-3 p-3 border rounded-lg bg-muted/30">
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
                      <div className="space-y-2 tutorial-client-name">
                        <Label className="text-xs">Nome completo *</Label>
                        <Input 
                          autoFocus
                          value={newClientData.full_name}
                          onChange={(e) => setNewClientData({ ...newClientData, full_name: e.target.value })}
                          placeholder="Nome do cliente"
                        />
                      </div>
                      <div className="space-y-2 tutorial-client-phone">
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
                        className="tutorial-create-client-btn w-full"
                        onClick={handleCreateClient}
                        disabled={creatingClient}
                      >
                        {creatingClient ? 'Criando...' : 'Criar Cliente'}
                      </Button>
                    </div>
                  )}
                </div>
                {formData.payment_type !== 'daily' && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2 tutorial-form-value">
                      <Label className="text-xs sm:text-sm">Valor *</Label>
                      <Input type="number" step="0.01" value={formData.principal_amount} onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                    </div>
                    <div className="space-y-1 sm:space-y-2 tutorial-form-interest">
                      <Label className="text-xs sm:text-sm">Taxa de Juros (%) *</Label>
                      <Input type="number" step="0.01" value={formData.interest_rate} onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                    </div>
                  </div>
                )}
                {formData.payment_type !== 'daily' && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2 tutorial-form-interest-mode">
                      <Label className="text-xs sm:text-sm">Juros Aplicado</Label>
                      <Select value={formData.interest_mode} onValueChange={(v: 'per_installment' | 'on_total') => setFormData({ ...formData, interest_mode: v })}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[10001]">
                          <SelectItem value="per_installment" className="text-xs sm:text-sm">Por Parcela</SelectItem>
                          <SelectItem value="on_total" className="text-xs sm:text-sm">Sobre o Total</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:space-y-2 tutorial-form-payment-type">
                      <Label className="text-xs sm:text-sm">Modalidade</Label>
                      <Select value={formData.payment_type} onValueChange={(v: LoanPaymentType) => setFormData({ ...formData, payment_type: v })}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[10001]">
                          <SelectItem value="single" className="text-xs sm:text-sm">Pagamento Único</SelectItem>
                          <SelectItem value="installment" className="text-xs sm:text-sm">Parcelado</SelectItem>
                          <SelectItem value="weekly" className="text-xs sm:text-sm">Semanal</SelectItem>
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
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="daily">Diário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(formData.payment_type === 'installment' || formData.payment_type === 'weekly') && (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Nº de {formData.payment_type === 'weekly' ? 'Semanas' : 'Parcelas'} *</Label>
                        <Input type="number" min="1" value={formData.installments} onChange={(e) => setFormData({ ...formData, installments: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Juros Total</Label>
                        <Input 
                          type="text" 
                          readOnly 
                          value={getTotalInterestDisplay()} 
                          className="bg-muted h-9 sm:h-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Valor da {formData.payment_type === 'weekly' ? 'Semana' : 'Parcela'} (R$)</Label>
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
                <div className="grid grid-cols-2 gap-2 sm:gap-4 tutorial-form-dates">
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Data do Contrato</Label>
                    <Input type="date" value={formData.contract_date} onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                    <p className="text-[10px] text-muted-foreground">Quando foi fechado</p>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">
                      {formData.payment_type === 'single' ? 'Data Vencimento *' : formData.payment_type === 'weekly' ? '1ª Semana *' : '1ª Parcela *'}
                    </Label>
                    <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required className="h-9 sm:h-10 text-sm" />
                    <p className="text-[10px] text-muted-foreground">Quando começa a pagar</p>
                  </div>
                </div>
                {(formData.payment_type === 'installment' || formData.payment_type === 'weekly') && installmentDates.length > 0 && (
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Vencimento das {formData.payment_type === 'weekly' ? 'Semanas' : 'Parcelas'}</Label>
                    <ScrollArea className="h-[120px] sm:h-[150px] rounded-md border p-2 sm:p-3">
                      <div className="space-y-1.5 sm:space-y-2">
                        {installmentDates.map((date, index) => (
                          <div key={index} className="flex items-center gap-2 sm:gap-3">
                            <span className="text-xs sm:text-sm font-medium w-16 sm:w-20">{formData.payment_type === 'weekly' ? 'Sem.' : 'Parc.'} {index + 1}</span>
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
                <div className="space-y-1 sm:space-y-2 tutorial-form-notes">
                  <Label className="text-xs sm:text-sm">Observações</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="text-sm" />
                </div>
                
                {/* Historical contract option when dates are in the past */}
                {hasPastDates && (
                  <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-400/30 space-y-2">
                    <p className="text-sm text-yellow-300 font-medium">
                      ⚠️ Este contrato possui datas anteriores à data atual
                    </p>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="is_historical_contract"
                        checked={formData.is_historical_contract}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_historical_contract: !!checked })}
                        className="mt-0.5 border-yellow-400 data-[state=checked]:bg-yellow-500"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="is_historical_contract" className="text-sm text-yellow-200 cursor-pointer">
                          Este é um contrato antigo que estou registrando
                        </Label>
                        <p className="text-xs text-yellow-300/70">
                          Se marcado, o contrato só ficará em atraso após a próxima data futura vencer
                        </p>
                      </div>
                    </div>
                    {!formData.is_historical_contract && (
                      <p className="text-xs text-red-300 mt-1">
                        Se não marcar, o contrato será considerado em atraso imediatamente
                      </p>
                    )}
                    {formData.is_historical_contract && pastInstallmentsData.count > 0 && (
                      <div className="p-2 rounded bg-green-500/20 border border-green-400/30 mt-2">
                        <p className="text-xs text-green-300">
                          ✓ <strong>{pastInstallmentsData.count}</strong> parcela(s) passada(s) serão automaticamente registradas como já recebidas 
                          ({formatCurrency(pastInstallmentsData.totalValue)})
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* WhatsApp Notification Option */}
                <div className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-muted/30">
                  <Checkbox
                    id="send_creation_notification"
                    checked={formData.send_creation_notification}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_creation_notification: !!checked }))}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="send_creation_notification" className="text-sm font-medium cursor-pointer">
                      Receber notificação WhatsApp deste contrato
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alertas de atraso e relatórios serão enviados normalmente mesmo que você não marque essa opção
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">Cancelar</Button>
                  <Button type="submit" className="tutorial-form-submit h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">Criar</Button>
                </div>
              </form>
            </DialogContent>
              </Dialog>
            </div>
          </TooltipProvider>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="relative tutorial-search">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm" />
          </div>

          <TooltipProvider delayDuration={300}>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 tutorial-filters">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                    className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                  >
                    Todos
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Exibe todos os empréstimos cadastrados</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('pending')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter !== 'pending' ? 'border-blue-500 text-blue-500 hover:bg-blue-500/10' : ''}`}
                  >
                    Em Dia
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos pendentes com pagamentos em dia</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'paid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('paid')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'paid' ? 'bg-primary' : 'border-primary text-primary hover:bg-primary/10'}`}
                  >
                    Pagos
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos totalmente quitados</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'overdue' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('overdue')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'overdue' ? 'bg-destructive' : 'border-destructive text-destructive hover:bg-destructive/10'}`}
                  >
                    Atraso
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos com parcelas vencidas</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'renegotiated' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('renegotiated')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'renegotiated' ? 'bg-yellow-500' : 'border-yellow-500 text-yellow-600 hover:bg-yellow-500/10'}`}
                  >
                    <span className="hidden xs:inline">Reneg.</span><span className="xs:hidden">Ren.</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos que foram renegociados com cliente</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'interest_only' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('interest_only')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'interest_only' ? 'bg-purple-500' : 'border-purple-500 text-purple-600 hover:bg-purple-500/10'}`}
                  >
                    <span className="hidden xs:inline">Só Juros</span><span className="xs:hidden">Juros</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos onde cliente pagou apenas os juros</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'weekly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('weekly')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'weekly' ? 'bg-orange-500' : 'border-orange-500 text-orange-600 hover:bg-orange-500/10'}`}
                  >
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    <span className="hidden xs:inline">Semanal</span><span className="xs:hidden">Sem.</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos com cobrança semanal</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'daily' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('daily')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'daily' ? 'bg-sky-500' : 'border-sky-500 text-sky-600 hover:bg-sky-500/10'}`}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    <span className="hidden xs:inline">Diário</span><span className="xs:hidden">Diá.</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos com cobrança diária</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          
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
              {filteredLoans.map((loan, loanIndex) => {
                const isDaily = loan.payment_type === 'daily';
                const isWeekly = loan.payment_type === 'weekly';
                const numInstallments = loan.installments || 1;
                
                // For daily loans: 
                // - principal_amount = valor emprestado
                // - total_interest = valor da parcela diária
                // - interest_rate = lucro total
                // - remaining_balance = total a receber (decreases with payments)
                const dailyInstallmentAmount = isDaily ? (loan.total_interest || 0) : 0;
                const dailyProfit = isDaily ? loan.interest_rate : 0;
                const dailyTotalToReceive = isDaily ? dailyInstallmentAmount * numInstallments : 0;
                
                // For regular loans - use stored total_interest (respects rounded installment values)
                const principalPerInstallment = loan.principal_amount / numInstallments;
                const storedTotalInterest = loan.total_interest || 0;
                
                // Calculate total interest based on interest_mode (only for comparison/fallback)
                let calculatedTotalInterest = 0;
                if (!isDaily) {
                  if (loan.interest_mode === 'on_total') {
                    calculatedTotalInterest = loan.principal_amount * (loan.interest_rate / 100);
                  } else {
                    calculatedTotalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
                  }
                }
                
                // Use stored total_interest as primary (it's the real rounded value), fallback to calculated
                const effectiveTotalInterest = isDaily ? 0 : (storedTotalInterest > 0 ? storedTotalInterest : calculatedTotalInterest);
                
                const calculatedInterestPerInstallment = isDaily ? 0 : effectiveTotalInterest / numInstallments;
                const totalPerInstallment = isDaily ? dailyInstallmentAmount : principalPerInstallment + calculatedInterestPerInstallment;
                
                // Verificar se há taxa de renovação aplicada
                // Formato novo: [RENEWAL_FEE_INSTALLMENT:index:newValue:feeAmount]
                // Formato antigo: [RENEWAL_FEE_INSTALLMENT:index:newValue]
                const hasRenewalFee = loan.notes?.includes('[RENEWAL_FEE_INSTALLMENT:');
                const renewalFeeMatchNew = hasRenewalFee ? loan.notes?.match(/\[RENEWAL_FEE_INSTALLMENT:\d+:([0-9.]+):([0-9.]+)\]/) : null;
                const renewalFeeMatchOld = hasRenewalFee && !renewalFeeMatchNew ? loan.notes?.match(/\[RENEWAL_FEE_INSTALLMENT:\d+:([0-9.]+)\]/) : null;
                
                let renewalFeeAmount = 0;
                if (renewalFeeMatchNew) {
                  // Novo formato: usar a taxa real armazenada
                  renewalFeeAmount = parseFloat(renewalFeeMatchNew[2]);
                } else if (renewalFeeMatchOld) {
                  // Formato antigo: calcular diferença (fallback)
                  const renewalFeeNewInstallmentValue = parseFloat(renewalFeeMatchOld[1]);
                  renewalFeeAmount = renewalFeeNewInstallmentValue > 0 ? renewalFeeNewInstallmentValue - totalPerInstallment : 0;
                }
                
                // Check if this is an interest-only payment
                const isInterestOnlyPayment = loan.notes?.includes('[INTEREST_ONLY_PAYMENT]');
                
                // Total original do contrato (antes de qualquer renegociação)
                const originalTotal = loan.principal_amount + effectiveTotalInterest;
                
                // Total a Receber base + taxa extra se existir
                let totalToReceive = isDaily ? dailyTotalToReceive : originalTotal;
                
                // Para pagamentos "só juros", o totalToReceive deve refletir o remaining + total_paid
                // porque o usuário pode ter adicionado juros extras
                if (isInterestOnlyPayment) {
                  totalToReceive = loan.remaining_balance + (loan.total_paid || 0);
                } else if (hasRenewalFee && renewalFeeAmount > 0) {
                  totalToReceive += renewalFeeAmount;
                }
                
                // Calcular juros extra: aparece quando:
                // 1. Foi pagamento só de juros com remaining_balance aumentado, OU
                // 2. Há taxa de renovação aplicada em uma parcela
                const originalRemainingBalance = loan.principal_amount + effectiveTotalInterest;
                
                let extraInterest = 0;
                if (isInterestOnlyPayment) {
                  // Para pagamentos só de juros, calcular diferença do remaining_balance
                  extraInterest = Math.max(0, loan.remaining_balance - originalRemainingBalance);
                } else if (hasRenewalFee && renewalFeeAmount > 0) {
                  // Para taxa de renovação direta, usar o valor extraído das notas
                  extraInterest = renewalFeeAmount;
                }
                
                // Para casos onde o remaining_balance foi atualizado diretamente (taxa extra, juros só, etc)
                // usamos o valor do banco. Nos demais, calculamos normalmente.
                // IMPORTANTE: Se o status é 'paid', o remaining é sempre 0
                let remainingToReceive: number;
                if (loan.status === 'paid') {
                  remainingToReceive = 0;
                } else if (isDaily) {
                  remainingToReceive = Math.max(0, (loan.remaining_balance || 0) - (loan.total_paid || 0));
                } else {
                  // SEMPRE usar remaining_balance do banco como fonte de verdade
                  remainingToReceive = Math.max(0, loan.remaining_balance);
                }
                
                const initials = loan.client?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                
                // Check if overdue penalty was applied (stored interest is higher than calculated)
                const hasAppliedOverduePenalty = !isDaily && storedTotalInterest > calculatedTotalInterest;
                
                const isPaid = loan.status === 'paid' || remainingToReceive <= 0;
                const isRenegotiated = loan.notes?.includes('Valor prometido') && !isInterestOnlyPayment;
                const isHistoricalContract = loan.notes?.includes('[HISTORICAL_CONTRACT]');
                
                // Check if overdue based on installment dates
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                let isOverdue = false;
                if (!isPaid && remainingToReceive > 0) {
                  // Calculate how many installments have been paid using tracking system
                  const paidInstallments = getPaidInstallmentsCount(loan);
                  
                  // Get installment dates array
                  const dates = (loan.installment_dates as string[]) || [];
                  
                  if (isHistoricalContract) {
                    // For historical contracts, only check future dates
                    const futureDates = dates.filter(d => {
                      const date = new Date(d + 'T12:00:00');
                      return date >= today;
                    });
                    
                    if (futureDates.length > 0) {
                      const nextFutureDate = new Date(futureDates[0] + 'T12:00:00');
                      isOverdue = today > nextFutureDate;
                    } else if (dates.length === 0) {
                      const dueDate = new Date(loan.due_date + 'T12:00:00');
                      isOverdue = dueDate < today;
                    }
                  } else {
                    // Normal logic for non-historical contracts
                    if (dates.length > 0 && paidInstallments < dates.length) {
                      const nextDueDate = new Date(dates[paidInstallments] + 'T12:00:00');
                      isOverdue = today > nextDueDate;
                    } else {
                      const dueDate = new Date(loan.due_date + 'T12:00:00');
                      isOverdue = today > dueDate;
                    }
                  }
                }
                
                // Calculate overdue penalty interest
                const overdueDate = (() => {
                  const dates = (loan.installment_dates as string[]) || [];
                  const paidInstallments = getPaidInstallmentsCount(loan);
                  return dates[paidInstallments] || loan.due_date;
                })();
                
                // Parse overdue config from notes (only fixed value)
                const overdueConfigMatch = loan.notes?.match(/\[OVERDUE_CONFIG:fixed:([0-9.]+)\]/);
                const hasOverdueConfig = !!overdueConfigMatch;
                const overdueConfigValue = overdueConfigMatch ? parseFloat(overdueConfigMatch[1]) : 0;
                
                // Calculate days overdue
                const overdueDateObj = new Date(overdueDate);
                overdueDateObj.setHours(0, 0, 0, 0);
                const daysOverdue = today > overdueDateObj ? Math.ceil((today.getTime() - overdueDateObj.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                
                // Calculate dynamic penalty based on config (fixed amount per day)
                let dynamicPenaltyAmount = 0;
                if (isOverdue && daysOverdue > 0 && hasOverdueConfig) {
                  // Fixed amount per day (e.g., R$ 50/day × 4 days = R$ 200)
                  dynamicPenaltyAmount = overdueConfigValue * daysOverdue;
                }
                
                const hasSpecialStyle = isPaid || isOverdue || isRenegotiated || isInterestOnlyPayment || isWeekly;
                
                const getCardStyle = () => {
                  if (isPaid) {
                    return 'bg-primary border-primary';
                  }
                  if (isInterestOnlyPayment && !isOverdue) {
                    return 'bg-purple-500/20 border-purple-400 dark:bg-purple-500/30 dark:border-purple-400';
                  }
                  if (isRenegotiated && !isOverdue) {
                    return 'bg-yellow-500/20 border-yellow-400 dark:bg-yellow-500/30 dark:border-yellow-400';
                  }
                  if (isOverdue) {
                    return 'bg-red-500/20 border-red-400 dark:bg-red-500/30 dark:border-red-400';
                  }
                  if (isWeekly) {
                    return 'bg-orange-500/20 border-orange-400 dark:bg-orange-500/30 dark:border-orange-400';
                  }
                  if (isDaily) {
                    return 'bg-blue-500/20 border-blue-400 dark:bg-blue-500/30 dark:border-blue-400';
                  }
                  return 'bg-card';
                };
                
                const textColor = isPaid ? 'text-white' : isInterestOnlyPayment ? 'text-purple-300' : isRenegotiated ? 'text-yellow-300' : isOverdue ? 'text-red-300' : '';
                const mutedTextColor = isPaid ? 'text-white/70' : 'text-muted-foreground';
                
                return (
                  <Card key={loan.id} className={`${loanIndex === 0 ? 'tutorial-loan-card' : ''} shadow-soft hover:shadow-md transition-shadow border ${getCardStyle()} ${textColor}`}>
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
                            <h3 className="font-semibold text-sm sm:text-lg truncate max-w-[120px] sm:max-w-[180px] lg:max-w-[150px] xl:max-w-[200px]">{loan.client?.full_name}</h3>
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                              <Button 
                                variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                size="sm" 
                                className={`tutorial-loan-receipt h-6 text-[9px] sm:text-[10px] px-1.5 sm:px-2 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                onClick={() => handleGenerateLoanReceipt(loan)}
                              >
                                <FileText className="w-3 h-3 sm:mr-1" />
                                <span className="hidden sm:inline">Comprovante</span>
                              </Button>
                              <Badge className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 ${hasSpecialStyle ? 'bg-white/20 text-white border-white/30' : getPaymentStatusColor(loan.status)}`}>
                                {isInterestOnlyPayment && !isOverdue ? 'Só Juros' : isRenegotiated && !isOverdue ? 'Reneg.' : getPaymentStatusLabel(loan.status)}
                              </Badge>
                            </div>
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
                            const paidCount = getPaidInstallmentsCount(loan);
                            const nextDate = dates[paidCount] || loan.due_date;
                            return formatDate(nextDate);
                          })()}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg font-semibold ${hasSpecialStyle ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                          <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">Pago: {formatCurrency(loan.total_paid || 0)}</span>
                        </div>
                      </div>
                      
                      {/* Interest only payment option */}
                      {!isDaily && !isPaid && (
                        <div className={`mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg text-xs sm:text-sm ${hasSpecialStyle ? 'bg-white/10' : 'bg-purple-500/10 border border-purple-400/30'}`}>
                          <div className="flex items-center justify-between">
                            <span className={hasSpecialStyle ? 'text-white/80' : 'text-purple-300'}>Só Juros (por parcela):</span>
                            <span className={`font-bold ${hasSpecialStyle ? 'text-white' : 'text-purple-400'}`}>
                              {formatCurrency(calculatedInterestPerInstallment)}
                            </span>
                          </div>
                          {extraInterest > 0 && (
                            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-purple-400/30">
                              <span className={hasSpecialStyle ? 'text-white/80' : 'text-orange-300'}>Juros Extra Adicionado:</span>
                              <span className={`font-bold ${hasSpecialStyle ? 'text-white' : 'text-orange-400'}`}>
                                +{formatCurrency(extraInterest)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Overdue installment info */}
                      {isOverdue && (
                        <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg bg-red-500/20 border border-red-400/30">
                          <div className="text-xs sm:text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-red-300 font-medium">
                                {(() => {
                                  const dates = (loan.installment_dates as string[]) || [];
                                  const paidCount = getPaidInstallmentsCount(loan);
                                  if (dates.length > 0 && paidCount < dates.length) {
                                    return `Parcela ${paidCount + 1}/${dates.length} em atraso`;
                                  }
                                  return 'Pagamento em atraso';
                                })()}
                              </span>
                              <span className="text-red-200 font-bold">{daysOverdue} dias</span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-red-300/70">
                              <span>Vencimento: {formatDate(overdueDate)}</span>
                              <span>Valor: {formatCurrency(totalPerInstallment)}</span>
                            </div>
                          </div>
                          {dynamicPenaltyAmount > 0 && (
                            <>
                              <div className="flex items-center justify-between mt-2 text-xs sm:text-sm">
                                <span className="text-red-300">
                                  Multa ({formatCurrency(overdueConfigValue)}/dia)
                                </span>
                                <span className="font-bold text-red-200">
                                  +{formatCurrency(dynamicPenaltyAmount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1 text-xs sm:text-sm border-t border-red-400/30 pt-2">
                                <span className="text-red-300/80">Total com Atraso:</span>
                                <span className="font-bold text-white">
                                  {formatCurrency(remainingToReceive + dynamicPenaltyAmount)}
                                </span>
                              </div>
                            </>
                          )}
                          <p className="text-[10px] text-red-300/60 mt-2">
                            Pague a parcela em atraso para regularizar o empréstimo
                          </p>
                        </div>
                      )}
                      
                      <div className={`flex flex-col gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 ${hasSpecialStyle ? 'border-t border-white/20' : 'border-t'}`}>
                        <TooltipProvider delayDuration={300}>
                          <div className="flex gap-1.5 sm:gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="sm" 
                                  className={`${loanIndex === 0 ? 'tutorial-loan-payment' : ''} flex-1 h-7 sm:h-8 text-xs ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`} 
                                  onClick={() => { 
                                    setSelectedLoanId(loan.id);
                                    
                                    // Calcular próxima data de vencimento (próximo mês da parcela atual)
                                    const dates = (loan.installment_dates as string[]) || [];
                                    const paidCount = getPaidInstallmentsCount(loan);
                                    let defaultNextDueDate = '';
                                    
                                    if (dates.length > 0 && paidCount < dates.length) {
                                      const currentInstallmentDate = new Date(dates[paidCount] + 'T12:00:00');
                                      currentInstallmentDate.setMonth(currentInstallmentDate.getMonth() + 1);
                                      defaultNextDueDate = currentInstallmentDate.toISOString().split('T')[0];
                                    } else if (loan.due_date) {
                                      const dueDate = new Date(loan.due_date + 'T12:00:00');
                                      dueDate.setMonth(dueDate.getMonth() + 1);
                                      defaultNextDueDate = dueDate.toISOString().split('T')[0];
                                    }
                                    
                                    setPaymentData({ 
                                      amount: '', 
                                      payment_date: new Date().toISOString().split('T')[0],
                                      new_due_date: defaultNextDueDate,
                                      payment_type: 'partial', 
                                      selected_installments: [], 
                                      partial_installment_index: null, 
                                      send_notification: false 
                                    });
                                    
                                    setIsPaymentDialogOpen(true); 
                                  }}
                                >
                                  <CreditCard className="w-3 h-3 mr-1" />
                                  Pagar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Registre pagamentos: parcela, valor parcial ou quitação total</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="sm" 
                                  className={`${loanIndex === 0 ? 'tutorial-loan-interest' : ''} flex-1 h-7 sm:h-8 text-xs ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                  onClick={() => openRenegotiateDialog(loan.id)}
                                >
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  Pagar Juros
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Cliente pagou só os juros ou aplicar taxa extra de renovação</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="icon" 
                                  className={`h-7 w-7 sm:h-8 sm:w-8 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                  onClick={() => openPaymentHistory(loan.id)}
                                >
                                  <History className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Ver histórico de pagamentos (pode excluir pagamentos errados)</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="icon" 
                                  className={`h-7 w-7 sm:h-8 sm:w-8 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                  onClick={() => openEditDialog(loan.id)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Alterar dados do empréstimo, datas e valores</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="icon" 
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={() => setDeleteId(loan.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Excluir este empréstimo permanentemente</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
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
            
            // Usar total_interest do banco (já calculado) para cenário geral
            const totalInterest = selectedLoan.total_interest || 0;
            const interestPerInstallment = totalInterest / numInstallments;
            
            // Valor "teórico" por parcela a partir de principal + juros cadastrados
            let totalPerInstallment = principalPerInstallment + interestPerInstallment;
            
            // Porém o valor realmente devido deve sempre respeitar o remaining_balance,
            // que já considera renegociações, taxa de renovação, etc.
            const remainingToReceive = selectedLoan.remaining_balance;
            
            // Para contratos de 1 parcela (caso típico de renovação), a próxima parcela
            // deve ser exatamente o remaining_balance (ex: 300 após taxa de renovação)
            if (numInstallments === 1) {
              totalPerInstallment = remainingToReceive;
            }
              
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
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={paymentData.payment_type === 'installment' ? 'default' : 'outline'}
                        onClick={() => setPaymentData({ ...paymentData, payment_type: 'installment', amount: '', selected_installments: [], partial_installment_index: null })}
                        className={`text-xs sm:text-sm ${paymentData.payment_type !== 'installment' ? 'border-2 border-primary' : ''}`}
                      >
                        Parcela
                      </Button>
                      <Button
                        type="button"
                        variant={paymentData.payment_type === 'partial' ? 'default' : 'outline'}
                        onClick={() => setPaymentData({ ...paymentData, payment_type: 'partial', amount: '', selected_installments: [], partial_installment_index: null })}
                        className="text-xs sm:text-sm"
                      >
                        Parcial
                      </Button>
                      <Button
                        type="button"
                        variant={paymentData.payment_type === 'total' ? 'default' : 'outline'}
                        onClick={() => setPaymentData({ ...paymentData, payment_type: 'total', amount: remainingToReceive.toString(), selected_installments: [], partial_installment_index: null })}
                        className="text-xs sm:text-sm"
                      >
                        Total
                      </Button>
                    </div>
                  </div>
                  
                  {paymentData.payment_type === 'installment' && (() => {
                    const dates = (selectedLoan.installment_dates as string[]) || [];

                    // Detecta cenário de pagamento só de juros com renovação
                    const hasInterestOnlyTag = (selectedLoan.notes || '').includes('[INTEREST_ONLY_PAYMENT]');
                    
                    // Verificar se há taxa de renovação aplicada em uma parcela específica
                    const renewalFeeMatch = (selectedLoan.notes || '').match(/\[RENEWAL_FEE_INSTALLMENT:(\d+):([0-9.]+)(?::[0-9.]+)?\]/);
                    const renewalFeeInstallmentIndex = renewalFeeMatch ? parseInt(renewalFeeMatch[1]) : null;
                    const renewalFeeValue = renewalFeeMatch ? parseFloat(renewalFeeMatch[2]) : 0;

                    // Extrair pagamentos parciais do notes
                    const getPartialPayments = (notes: string | null): Record<number, number> => {
                      const payments: Record<number, number> = {};
                      const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
                      for (const match of matches) {
                        payments[parseInt(match[1])] = parseFloat(match[2]);
                      }
                      return payments;
                    };
                    
                    const partialPayments = getPartialPayments(selectedLoan.notes);

                    const getInstallmentValue = (index: number) => {
                      // Se há taxa de renovação aplicada nesta parcela específica
                      if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
                        return renewalFeeValue;
                      }
                      // Caso contrário, usar o valor normal da parcela
                      return totalPerInstallment;
                    };
                    
                    // Verificar se parcela está paga (totalmente ou parcialmente)
                    const getInstallmentStatus = (index: number) => {
                      const installmentValue = getInstallmentValue(index);
                      const paidAmount = partialPayments[index] || 0;
                      const remaining = installmentValue - paidAmount;
                      const excess = paidAmount > installmentValue ? paidAmount - installmentValue : 0;
                      
                      if (paidAmount >= installmentValue * 0.99) {
                        return { isPaid: true, isPartial: false, paidAmount, remaining: 0, excess };
                      } else if (paidAmount > 0) {
                        return { isPaid: false, isPartial: true, paidAmount, remaining, excess: 0 };
                      }
                      return { isPaid: false, isPartial: false, paidAmount: 0, remaining: installmentValue, excess: 0 };
                    };
                    
                    if (dates.length === 0) {
                      return (
                        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                          Este empréstimo não possui parcelas registradas.
                        </div>
                      );
                    }
                    
                    const toggleInstallment = (index: number) => {
                      const current = paymentData.selected_installments;
                      let next: number[];
                      if (current.includes(index)) {
                        next = current.filter(i => i !== index);
                      } else {
                        next = [...current, index].sort((a, b) => a - b);
                      }

                      // Calcular valor total considerando parcelas parcialmente pagas
                      const totalSelectedAmount = next.reduce((sum, i) => {
                        const status = getInstallmentStatus(i);
                        return sum + status.remaining; // Usar o valor restante, não o valor total
                      }, 0);

                      setPaymentData({
                        ...paymentData,
                        selected_installments: next,
                        amount: totalSelectedAmount.toFixed(2),
                      });
                    };
                    
                    return (
                      <div className="space-y-2">
                        <Label>Selecione a(s) Parcela(s)</Label>
                        <p className="text-xs text-muted-foreground">Clique para selecionar múltiplas parcelas</p>
                        <ScrollArea className="h-48 rounded-md border p-2">
                          <div className="space-y-2">
                            {dates.map((date, index) => {
                              const status = getInstallmentStatus(index);
                              const dateObj = new Date(date + 'T12:00:00');
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const isOverdue = !status.isPaid && dateObj < today;
                              const isSelected = paymentData.selected_installments.includes(index);
                              const installmentValue = getInstallmentValue(index);
                              
                              return (
                                <Button
                                  key={index}
                                  type="button"
                                  variant={isSelected ? 'default' : 'outline'}
                                  className={`w-full justify-between text-sm h-auto py-2 ${
                                    status.isPaid 
                                      ? 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-300 cursor-not-allowed opacity-60' 
                                      : status.isPartial
                                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-300'
                                        : isOverdue && !isSelected
                                          ? 'border-destructive text-destructive' 
                                          : ''
                                  }`}
                                  onClick={() => {
                                    if (!status.isPaid) {
                                      toggleInstallment(index);
                                    }
                                  }}
                                  disabled={status.isPaid}
                                >
                                  <span className="flex flex-col items-start gap-0.5">
                                    <span className="flex items-center gap-2">
                                      {isSelected && <span className="text-primary-foreground">✓</span>}
                                      <span>
                                        Parcela {index + 1}/{dates.length}
                                        {status.isPaid && ' ✓'}
                                        {isOverdue && !status.isPaid && ' (Atrasada)'}
                                      </span>
                                    </span>
                                    {status.isPartial && (
                                      <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                        Valor: {formatCurrency(installmentValue)} | Pago: {formatCurrency(status.paidAmount)} | Falta: {formatCurrency(status.remaining)}
                                      </span>
                                    )}
                                    {status.isPaid && (
                                      <span className="text-xs text-green-600 dark:text-green-400">
                                        Valor: {formatCurrency(installmentValue)} | Pago: {formatCurrency(status.paidAmount)}
                                        {status.excess > 0 && ` (+${formatCurrency(status.excess)})`}
                                      </span>
                                    )}
                                  </span>
                                  <span className="flex flex-col items-end gap-0.5">
                                    <span className="text-xs opacity-70">{formatDate(date)}</span>
                                    <span className="font-medium">
                                      {status.isPaid 
                                        ? formatCurrency(status.paidAmount)
                                        : status.isPartial 
                                          ? formatCurrency(status.remaining) 
                                          : formatCurrency(installmentValue)
                                      }
                                    </span>
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                        
                        {paymentData.selected_installments.length >= 2 && (
                          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 text-sm">
                            <p className="font-medium text-yellow-700 dark:text-yellow-300">
                              ⚠️ Atenção: Você selecionou {paymentData.selected_installments.length} parcelas
                            </p>
                            <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                              O valor total será de {formatCurrency(paymentData.selected_installments.reduce((sum, i) => sum + getInstallmentValue(i), 0))}
                            </p>
                          </div>
                        )}
                        
                        {paymentData.selected_installments.length > 0 && (
                          <div className="bg-primary/10 rounded-lg p-3 text-sm">
                            <p>
                              <strong>
                                {paymentData.selected_installments.length === 1 
                                  ? `Parcela ${paymentData.selected_installments[0] + 1}`
                                  : `${paymentData.selected_installments.length} Parcelas selecionadas`
                                }
                              </strong>: {formatCurrency(paymentData.selected_installments.reduce((sum, i) => sum + getInstallmentValue(i), 0))}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Principal: {formatCurrency(principalPerInstallment * paymentData.selected_installments.length)} + Juros: {formatCurrency(interestPerInstallment * paymentData.selected_installments.length)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {paymentData.payment_type === 'partial' && (() => {
                    const dates = (selectedLoan.installment_dates as string[]) || [];
                    const numInstallments = selectedLoan.installments || 1;
                    
                    // Extrair pagamentos parciais
                    const partialPayments = getPartialPaymentsFromNotes(selectedLoan.notes);
                    
                    // Verificar taxa de renovação
                    const renewalFeeMatch = (selectedLoan.notes || '').match(/\[RENEWAL_FEE_INSTALLMENT:(\d+):([0-9.]+)(?::[0-9.]+)?\]/);
                    const renewalFeeInstallmentIndex = renewalFeeMatch ? parseInt(renewalFeeMatch[1]) : null;
                    const renewalFeeValue = renewalFeeMatch ? parseFloat(renewalFeeMatch[2]) : 0;
                    
                    const getInstallmentValuePartial = (index: number) => {
                      if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
                        return renewalFeeValue;
                      }
                      return totalPerInstallment;
                    };
                    
                    const getInstallmentStatusPartial = (index: number) => {
                      const installmentValue = getInstallmentValuePartial(index);
                      const paidAmount = partialPayments[index] || 0;
                      const remaining = installmentValue - paidAmount;
                      
                      if (paidAmount >= installmentValue * 0.99) {
                        return { isPaid: true, isPartial: false, paidAmount, remaining: 0 };
                      } else if (paidAmount > 0) {
                        return { isPaid: false, isPartial: true, paidAmount, remaining };
                      }
                      return { isPaid: false, isPartial: false, paidAmount: 0, remaining: installmentValue };
                    };
                    
                    // Encontrar parcelas não pagas
                    const unpaidInstallments = [];
                    for (let i = 0; i < numInstallments; i++) {
                      const status = getInstallmentStatusPartial(i);
                      if (!status.isPaid) {
                        unpaidInstallments.push({ index: i, status, date: dates[i] || '' });
                      }
                    }
                    
                    // Definir parcela selecionada (primeira não paga por padrão)
                    const selectedPartialIndex = paymentData.partial_installment_index ?? (unpaidInstallments[0]?.index ?? 0);
                    const selectedStatus = getInstallmentStatusPartial(selectedPartialIndex);
                    
                    return (
                      <div className="space-y-4">
                        {/* Seletor de Parcela */}
                        {dates.length > 0 && (
                          <div className="space-y-2">
                            <Label>Referente a qual Parcela?</Label>
                            <Select 
                              value={selectedPartialIndex.toString()} 
                              onValueChange={(value) => setPaymentData({ ...paymentData, partial_installment_index: parseInt(value) })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a parcela" />
                              </SelectTrigger>
                              <SelectContent>
                                {unpaidInstallments.map(({ index, status, date }) => (
                                  <SelectItem key={index} value={index.toString()}>
                                    <span className="flex items-center gap-2">
                                      Parcela {index + 1}/{dates.length}
                                      {date && <span className="text-xs text-muted-foreground">- {formatDate(date)}</span>}
                                      {status.isPartial && (
                                        <span className="text-xs text-yellow-600">(Falta: {formatCurrency(status.remaining)})</span>
                                      )}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            {/* Info da parcela selecionada */}
                            <div className="bg-muted/50 rounded-lg p-3 text-sm">
                              <div className="flex justify-between">
                                <span>Valor da parcela:</span>
                                <span className="font-medium">{formatCurrency(getInstallmentValuePartial(selectedPartialIndex))}</span>
                              </div>
                              {selectedStatus.isPartial && (
                                <>
                                  <div className="flex justify-between text-yellow-600">
                                    <span>Já pago:</span>
                                    <span>{formatCurrency(selectedStatus.paidAmount)}</span>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span>Falta pagar:</span>
                                    <span>{formatCurrency(selectedStatus.remaining)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <Label>Valor Pago *</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={paymentData.amount} 
                            onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })} 
                            placeholder={`Máx: ${formatCurrency(selectedStatus.remaining)}`}
                            required 
                          />
                          <p className="text-xs text-muted-foreground">
                            Digite qualquer valor até {formatCurrency(selectedStatus.remaining)}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                  
                  <div className="space-y-2">
                    <Label>Data do Pagamento</Label>
                    <Input 
                      type="date" 
                      value={paymentData.payment_date} 
                      onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })} 
                    />
                    <p className="text-xs text-muted-foreground">Quando o cliente efetivamente pagou</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Nova Data de Vencimento</Label>
                    <Input 
                      type="date" 
                      value={paymentData.new_due_date} 
                      onChange={(e) => setPaymentData({ ...paymentData, new_due_date: e.target.value })} 
                    />
                    <p className="text-xs text-muted-foreground">Pré-preenchido com próximo mês. Altere se necessário.</p>
                  </div>
                  
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <input
                      type="checkbox"
                      id="send_payment_notification"
                      checked={paymentData.send_notification}
                      onChange={(e) => setPaymentData({ ...paymentData, send_notification: e.target.checked })}
                      className="mt-0.5 rounded border-input"
                    />
                    <div className="flex-1">
                      <label htmlFor="send_payment_notification" className="text-sm font-medium cursor-pointer">
                        Receber notificação WhatsApp deste pagamento
                      </label>
                    </div>
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
              
              // Calcular valor de cada parcela
              const numInstallments = selectedLoan.installments || 1;
              const principalPerInstallment = selectedLoan.principal_amount / numInstallments;
              const totalInterest = selectedLoan.total_interest || 0;
              const interestPerInstallmentCalc = totalInterest / numInstallments;
              const installmentValue = principalPerInstallment + interestPerInstallmentCalc;
              // Calcular o valor que realmente falta
              const isInterestOnly = selectedLoan.notes?.includes('[INTEREST_ONLY_PAYMENT]');
              const totalToReceive = selectedLoan.principal_amount + totalInterest;
              // Para empréstimos "Só Juros", usar o remaining_balance do banco (que é o saldo real que falta)
              // Para outros, calcular normalmente
              const actualRemaining = isInterestOnly 
                ? selectedLoan.remaining_balance 
                : totalToReceive - (selectedLoan.total_paid || 0);
              
              // Função helper para extrair pagamentos parciais do notes
              const getPartialPayments = (notes: string | null): Record<number, number> => {
                const payments: Record<number, number> = {};
                const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
                for (const match of matches) {
                  payments[parseInt(match[1])] = parseFloat(match[2]);
                }
                return payments;
              };
              
              const partialPayments = getPartialPayments(selectedLoan.notes);
              
              // Obter valor restante de uma parcela específica (considerando pagamentos parciais)
              const getInstallmentRemainingValue = (index: number) => {
                const paidAmount = partialPayments[index] || 0;
                const remaining = installmentValue - paidAmount;
                return remaining > 0 ? remaining : 0;
              };
              
              // Verificar se parcela está totalmente paga
              const isInstallmentPaid = (index: number) => {
                const paidAmount = partialPayments[index] || 0;
                return paidAmount >= installmentValue * 0.99;
              };
              
              // Estado para controlar qual opção está ativa
              const activeOption = renegotiateData.interest_only_paid ? 'interest' : 
                                   renegotiateData.renewal_fee_enabled ? 'fee' : null;
              
              return (
                <form onSubmit={handleRenegotiateSubmit} className="space-y-4">
                  {/* Header com info do cliente */}
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
                          Saldo devedor: {formatCurrency(actualRemaining)}
                        </p>
                        {(selectedLoan.payment_type === 'installment' || selectedLoan.payment_type === 'weekly') && (
                          <p className="text-xs text-muted-foreground">
                            Valor por parcela: {formatCurrency(installmentValue)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Seleção de opções - Cards clicáveis */}
                  {!activeOption && (
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRenegotiateData({ 
                            ...renegotiateData, 
                            interest_only_paid: true,
                            renewal_fee_enabled: false,
                            remaining_amount: interestOnlyOriginalRemaining.toFixed(2)
                          });
                        }}
                        className="p-4 rounded-lg border-2 border-primary bg-primary/10 hover:bg-primary/20 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-primary">Cliente pagou só os juros</p>
                            <p className="text-sm text-muted-foreground">Registrar pagamento apenas dos juros da parcela</p>
                          </div>
                        </div>
                      </button>
                      
                      {(selectedLoan.payment_type === 'installment' || selectedLoan.payment_type === 'weekly') && (
                        <button
                          type="button"
                          onClick={() => {
                            // Encontrar próxima parcela em aberto e usar seu valor restante
                            const dates = (selectedLoan.installment_dates as string[]) || [];
                            let nextUnpaidIndex = -1;
                            for (let i = 0; i < dates.length; i++) {
                              if (!isInstallmentPaid(i)) {
                                nextUnpaidIndex = i;
                                break;
                              }
                            }
                            const baseValue = nextUnpaidIndex >= 0 
                              ? getInstallmentRemainingValue(nextUnpaidIndex) 
                              : installmentValue;
                            
                            const percentage = 20;
                            const feeAmount = baseValue * (percentage / 100);
                            const newTotal = actualRemaining + feeAmount;
                            setRenegotiateData({ 
                              ...renegotiateData, 
                              interest_only_paid: false,
                              renewal_fee_enabled: true,
                              renewal_fee_percentage: '20',
                              renewal_fee_amount: feeAmount.toFixed(2),
                              new_remaining_with_fee: newTotal.toFixed(2)
                            });
                          }}
                          className="p-4 rounded-lg border-2 border-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-amber-500/20">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                              </svg>
                            </div>
                            <div>
                              <p className="font-semibold text-amber-500">Aplicar juros extra em uma parcela</p>
                              <p className="text-sm text-muted-foreground">Adicionar taxa de renovação em parcela específica</p>
                            </div>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Opção 1: Cliente pagou só os juros */}
                  {activeOption === 'interest' && (
                    <div className="space-y-4 border-2 border-primary rounded-lg p-4 bg-slate-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          </svg>
                          <span className="font-semibold text-primary">Cliente pagou só os juros</span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setRenegotiateData({ ...renegotiateData, interest_only_paid: false })}
                          className="text-muted-foreground hover:text-white"
                        >
                          ← Voltar
                        </Button>
                      </div>
                      
                      <div className="bg-primary/20 rounded-lg p-3 text-sm border border-primary">
                        <p className="text-white">
                          <strong>Resumo:</strong> Cliente paga <strong className="text-primary">{formatCurrency(parseFloat(renegotiateData.interest_amount_paid) || 0)}</strong> de juros agora.
                        </p>
                        <p className="text-gray-300 mt-1">
                          {selectedLoan.payment_type === 'weekly' 
                            ? <>Na próxima <strong>semana</strong>, o valor a cobrar será: <strong className="text-primary">{formatCurrency(parseFloat(renegotiateData.remaining_amount) || 0)}</strong></>
                            : <>No próximo <strong>mês</strong>, o valor a cobrar será: <strong className="text-primary">{formatCurrency(parseFloat(renegotiateData.remaining_amount) || 0)}</strong></>
                          }
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-gray-400 text-xs">Valor Pago (Juros) (R$) *</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={renegotiateData.interest_amount_paid} 
                            onChange={(e) => setRenegotiateData({ ...renegotiateData, interest_amount_paid: e.target.value })} 
                            placeholder="Ex: 100,00"
                            required
                            className="bg-slate-800 text-white border-primary font-bold"
                          />
                          <p className="text-xs text-gray-500">Valor calculado automaticamente, editável</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-400 text-xs">Valor Total que Falta (R$)</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={renegotiateData.remaining_amount} 
                            onChange={(e) => setRenegotiateData({ ...renegotiateData, remaining_amount: e.target.value })} 
                            placeholder="Valor restante"
                            className="bg-slate-800 text-white border-primary font-bold"
                          />
                          <p className="text-xs text-gray-500">Só diminui se pagar mais que o juros</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-gray-400 text-xs">Data do Pagamento *</Label>
                          <Input 
                            type="date" 
                            value={renegotiateData.interest_payment_date} 
                            onChange={(e) => setRenegotiateData({ ...renegotiateData, interest_payment_date: e.target.value })} 
                            required
                            className="bg-slate-800 text-white border-primary"
                          />
                          <p className="text-xs text-gray-500">Quando o cliente pagou os juros</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-400 text-xs">Nova Data de Vencimento *</Label>
                          <Input 
                            type="date" 
                            value={renegotiateData.promised_date} 
                            onChange={(e) => setRenegotiateData({ ...renegotiateData, promised_date: e.target.value })} 
                            required
                            className="bg-slate-800 text-white border-primary"
                          />
                          <p className="text-xs text-gray-500">Próxima data de cobrança</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 p-3 rounded-lg border-2 border-primary bg-primary/5">
                        <Checkbox 
                          id="send_interest_notification" 
                          checked={renegotiateData.send_interest_notification} 
                          onCheckedChange={(checked) => setRenegotiateData({ ...renegotiateData, send_interest_notification: checked as boolean })} 
                        />
                        <Label htmlFor="send_interest_notification" className="text-sm font-medium cursor-pointer">
                          Receber notificação WhatsApp deste pagamento
                        </Label>
                      </div>
                    </div>
                  )}
                  
                  {/* Opção 2: Aplicar juros extra em parcela específica */}
                  {activeOption === 'fee' && (
                    <div className="space-y-4 border-2 border-amber-500 rounded-lg p-4 bg-amber-950/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                          </svg>
                          <span className="font-semibold text-amber-500">Juros Extra em Parcela</span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setRenegotiateData({ ...renegotiateData, renewal_fee_enabled: false })}
                          className="text-muted-foreground hover:text-white"
                        >
                          ← Voltar
                        </Button>
                      </div>
                      
                      {/* Calcular valor base da parcela selecionada (considerando pagamentos parciais) */}
                      {(() => {
                        // Determinar qual parcela está selecionada
                        let selectedInstallmentIndex = -1;
                        if (renegotiateData.renewal_fee_installment === 'next') {
                          // Encontrar próxima parcela em aberto
                          const dates = (selectedLoan.installment_dates as string[]) || [];
                          for (let i = 0; i < dates.length; i++) {
                            if (!isInstallmentPaid(i)) {
                              selectedInstallmentIndex = i;
                              break;
                            }
                          }
                        } else if (renegotiateData.renewal_fee_installment) {
                          selectedInstallmentIndex = parseInt(renegotiateData.renewal_fee_installment);
                        }
                        
                        // Valor restante da parcela selecionada (ou valor original se não há parcela selecionada)
                        const baseValueForFee = selectedInstallmentIndex >= 0 
                          ? getInstallmentRemainingValue(selectedInstallmentIndex) 
                          : installmentValue;
                        
                        const paidOnSelected = selectedInstallmentIndex >= 0 
                          ? (partialPayments[selectedInstallmentIndex] || 0) 
                          : 0;
                        const hasPartialPayment = paidOnSelected > 0 && paidOnSelected < installmentValue * 0.99;
                        
                        return (
                          <>
                            <p className="text-xs text-amber-300/70">
                              Aplique um acréscimo sobre o valor que falta da parcela {selectedInstallmentIndex >= 0 ? `${selectedInstallmentIndex + 1}` : 'selecionada'}. 
                              {hasPartialPayment && (
                                <span className="block mt-1 text-yellow-400">
                                  ⚠️ Esta parcela já teve pagamento parcial de {formatCurrency(paidOnSelected)}. Base para juros: {formatCurrency(baseValueForFee)}
                                </span>
                              )}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-amber-300 text-xs">Taxa (%):</Label>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  value={renegotiateData.renewal_fee_percentage} 
                                  onChange={(e) => {
                                    const percentage = parseFloat(e.target.value) || 0;
                                    const feeAmount = baseValueForFee * (percentage / 100);
                                    const newTotal = actualRemaining + feeAmount;
                                    
                                    setRenegotiateData({ 
                                      ...renegotiateData, 
                                      renewal_fee_percentage: e.target.value,
                                      renewal_fee_amount: feeAmount.toFixed(2),
                                      new_remaining_with_fee: newTotal.toFixed(2)
                                    });
                                  }} 
                                  placeholder="20"
                                  className="bg-amber-950 text-white border-amber-500 font-bold"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-amber-300 text-xs">Acréscimo (R$):</Label>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  value={renegotiateData.renewal_fee_amount} 
                                  onChange={(e) => {
                                    const feeAmount = parseFloat(e.target.value) || 0;
                                    const percentage = baseValueForFee > 0 ? (feeAmount / baseValueForFee) * 100 : 0;
                                    const newTotal = actualRemaining + feeAmount;
                                    
                                    setRenegotiateData({ 
                                      ...renegotiateData, 
                                      renewal_fee_amount: e.target.value,
                                      renewal_fee_percentage: percentage.toFixed(2),
                                      new_remaining_with_fee: newTotal.toFixed(2)
                                    });
                                  }}
                                  placeholder="50,00"
                                  className="bg-amber-950 text-white border-amber-500 font-bold"
                                />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      
                      <div className="space-y-2">
                        <Label className="text-amber-300 text-xs">Aplicar em qual parcela?</Label>
                        <Select 
                          value={renegotiateData.renewal_fee_installment} 
                          onValueChange={(v) => setRenegotiateData({ ...renegotiateData, renewal_fee_installment: v })}
                        >
                          <SelectTrigger className="bg-amber-950 text-white border-amber-500">
                            <SelectValue placeholder="Selecione a parcela" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="next">Próxima parcela em aberto</SelectItem>
                            {(() => {
                              const dates = (selectedLoan.installment_dates as string[]) || [];
                              return dates.map((date, index) => {
                                // Pular parcelas totalmente pagas
                                if (isInstallmentPaid(index)) return null;
                                
                                const remainingValue = getInstallmentRemainingValue(index);
                                const paidAmount = partialPayments[index] || 0;
                                const isPartiallyPaid = paidAmount > 0 && paidAmount < installmentValue * 0.99;
                                
                                return (
                                  <SelectItem key={index} value={index.toString()}>
                                    Parcela {index + 1} - {formatDate(date)} - {isPartiallyPaid 
                                      ? `Falta: ${formatCurrency(remainingValue)}` 
                                      : formatCurrency(installmentValue)}
                                  </SelectItem>
                                );
                              });
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {(() => {
                        // Recalcular valor base da parcela selecionada para exibir resumo correto
                        let selectedIdx = -1;
                        if (renegotiateData.renewal_fee_installment === 'next') {
                          const dates = (selectedLoan.installment_dates as string[]) || [];
                          for (let i = 0; i < dates.length; i++) {
                            if (!isInstallmentPaid(i)) {
                              selectedIdx = i;
                              break;
                            }
                          }
                        } else if (renegotiateData.renewal_fee_installment) {
                          selectedIdx = parseInt(renegotiateData.renewal_fee_installment);
                        }
                        
                        const baseVal = selectedIdx >= 0 ? getInstallmentRemainingValue(selectedIdx) : installmentValue;
                        const feeAmount = parseFloat(renegotiateData.renewal_fee_amount) || 0;
                        
                        return (
                          <div className="bg-amber-500/20 rounded-lg p-4 space-y-3 border border-amber-500">
                            <div className="flex justify-between items-center">
                              <span className="text-amber-300 font-medium text-sm">Valor restante + juros:</span>
                              <span className="text-lg font-bold text-white">
                                {formatCurrency(baseVal + feeAmount)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-t border-amber-500/50 pt-3">
                              <span className="text-amber-400 font-medium text-sm">Novo total a cobrar:</span>
                              <span className="text-xl font-bold text-amber-400">
                                {formatCurrency(parseFloat(renegotiateData.new_remaining_with_fee) || 0)}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  
                  {/* Observações - só aparece quando uma opção está selecionada */}
                  {activeOption && (
                    <>
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
                        <Button type="submit">
                          {activeOption === 'interest' ? 'Registrar Pagamento de Juros' : 'Aplicar Taxa'}
                        </Button>
                      </div>
                    </>
                  )}
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
                      <Label className="text-xs sm:text-sm">Data do Contrato</Label>
                      <Input 
                        type="date" 
                        value={editFormData.contract_date} 
                        onChange={(e) => setEditFormData({ ...editFormData, contract_date: e.target.value })} 
                        className="h-9 sm:h-10 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">Quando foi fechado</p>
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">
                        {editFormData.payment_type === 'single' ? 'Data Vencimento *' : '1ª Parcela *'}
                      </Label>
                      <Input 
                        type="date" 
                        value={editFormData.start_date} 
                        onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })} 
                        className="h-9 sm:h-10 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">Quando começa a pagar</p>
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
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm text-red-300">Valor de juros por dia de atraso (R$)</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editFormData.overdue_fixed_amount} 
                          onChange={(e) => setEditFormData({ ...editFormData, overdue_fixed_amount: e.target.value })} 
                          className="h-9 sm:h-10 text-sm bg-red-500/10 border-red-500/30"
                          placeholder="Ex: 50.00"
                        />
                        <p className="text-[10px] sm:text-xs text-red-300/60">
                          Este valor será multiplicado pelos dias em atraso
                        </p>
                      </div>
                      
                      {(() => {
                        const principal = parseFloat(editFormData.principal_amount) || 0;
                        const rate = parseFloat(editFormData.interest_rate) || 0;
                        const numInst = parseInt(editFormData.installments) || 1;
                        const interestPerInst = principal * (rate / 100);
                        const totalToReceive = principal + (interestPerInst * numInst);
                        const loan = loans.find(l => l.id === editingLoanId);
                        const totalPaid = loan?.total_paid || 0;
                        const remainingToReceive = totalToReceive - totalPaid;
                        
                        const dailyValue = parseFloat(editFormData.overdue_fixed_amount) || 0;
                        const penaltyAmount = dailyValue * editOverdueDays;
                        
                        return (
                          <div className="bg-red-500/20 rounded-lg p-2 sm:p-3 space-y-1">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-red-300">Saldo devedor:</span>
                              <span className="font-medium text-red-200">{formatCurrency(remainingToReceive)}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-red-300">
                                Juros de atraso ({editOverdueDays} dias x {formatCurrency(dailyValue)}):
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

        {/* Receipt Preview Dialog */}
        <ReceiptPreviewDialog 
          open={isReceiptPreviewOpen} 
          onOpenChange={setIsReceiptPreviewOpen} 
          data={receiptPreviewData} 
        />

        {/* Payment Receipt Prompt */}
        <PaymentReceiptPrompt 
          open={isPaymentReceiptOpen} 
          onOpenChange={setIsPaymentReceiptOpen} 
          data={paymentReceiptData} 
        />

        {/* Payment History Dialog */}
        <Dialog open={isPaymentHistoryOpen} onOpenChange={setIsPaymentHistoryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Histórico de Pagamentos</DialogTitle>
            </DialogHeader>
            {loadingPaymentHistory ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : paymentHistoryData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum pagamento registrado
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {paymentHistoryData.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{formatDate(payment.payment_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <DollarSign className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-primary">{formatCurrency(payment.amount)}</span>
                        </div>
                        {payment.notes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">{payment.notes}</p>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletePaymentId(payment.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir este pagamento</TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Payment Confirmation */}
        <AlertDialog open={!!deletePaymentId} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Pagamento?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                {(() => {
                  const payment = paymentHistoryData.find(p => p.id === deletePaymentId);
                  if (!payment) return null;
                  return (
                    <>
                      <p><strong>Valor:</strong> {formatCurrency(payment.amount)}</p>
                      <p><strong>Data:</strong> {formatDate(payment.payment_date)}</p>
                      <p className="text-amber-500 font-medium mt-3">
                        O saldo do empréstimo será restaurado automaticamente.
                      </p>
                    </>
                  );
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Confirmar Exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
