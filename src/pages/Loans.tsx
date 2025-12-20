import { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel, formatPercentage, calculateOverduePenalty, calculatePMT, calculateCompoundInterestPMT, calculateRateFromPMT } from '@/lib/calculations';
import { Plus, Minus, Search, Trash2, DollarSign, CreditCard, User, Calendar as CalendarIcon, Percent, RefreshCw, Camera, Clock, Pencil, FileText, Download, HelpCircle, History, Check, X, MessageCircle, ChevronDown, ChevronUp, Phone, MapPin, Mail, ListPlus, Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateContractReceipt, generatePaymentReceipt, generateOperationsReport, ContractReceiptData, PaymentReceiptData, LoanOperationData, OperationsReportData, InstallmentDetail } from '@/lib/pdfGenerator';
import { useProfile } from '@/hooks/useProfile';
import ReceiptPreviewDialog from '@/components/ReceiptPreviewDialog';
import PaymentReceiptPrompt from '@/components/PaymentReceiptPrompt';
import LoanCreatedReceiptPrompt from '@/components/LoanCreatedReceiptPrompt';
import LoansPageTutorial from '@/components/tutorials/LoansPageTutorial';
import { useAuth } from '@/contexts/AuthContext';
import SendOverdueNotification from '@/components/SendOverdueNotification';
import SendDueTodayNotification from '@/components/SendDueTodayNotification';
import { SendEarlyNotification } from '@/components/SendEarlyNotification';
import AddExtraInstallmentsDialog from '@/components/AddExtraInstallmentsDialog';

// Helper para extrair pagamentos parciais do notes do loan
const getPartialPaymentsFromNotes = (notes: string | null): Record<number, number> => {
  const payments: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    payments[parseInt(match[1])] = parseFloat(match[2]);
  }
  return payments;
};

// Helper para extrair sub-parcelas de adiantamento do notes
// Formato: [ADVANCE_SUBPARCELA:índice:valor:data:id_único]
const getAdvanceSubparcelasFromNotes = (notes: string | null): Array<{ originalIndex: number; amount: number; dueDate: string; uniqueId: string }> => {
  const subparcelas: Array<{ originalIndex: number; amount: number; dueDate: string; uniqueId: string }> = [];
  // Regex que suporta formato antigo (sem ID) e novo (com ID)
  const matches = (notes || '').matchAll(/\[ADVANCE_SUBPARCELA:(\d+):([0-9.]+):([^:\]]+)(?::(\d+))?\]/g);
  for (const match of matches) {
    subparcelas.push({
      originalIndex: parseInt(match[1]),
      amount: parseFloat(match[2]),
      dueDate: match[3],
      uniqueId: match[4] || `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // Fallback para sub-parcelas antigas
    });
  }
  return subparcelas;
};

// Helper para extrair sub-parcelas de adiantamento já PAGAS do notes
// Formato: [ADVANCE_SUBPARCELA_PAID:índice:valor:data:id_único]
const getPaidAdvanceSubparcelasFromNotes = (notes: string | null): Array<{ originalIndex: number; amount: number; dueDate: string; uniqueId: string }> => {
  const subparcelas: Array<{ originalIndex: number; amount: number; dueDate: string; uniqueId: string }> = [];
  const matches = (notes || '').matchAll(/\[ADVANCE_SUBPARCELA_PAID:(\d+):([0-9.]+):([^:\]]+)(?::(\d+))?\]/g);
  for (const match of matches) {
    subparcelas.push({
      originalIndex: parseInt(match[1]),
      amount: parseFloat(match[2]),
      dueDate: match[3],
      uniqueId: match[4] || `paid_${match[1]}_${match[3]}`
    });
  }
  return subparcelas;
};

// Helper para extrair pagamentos de "somente juros" por parcela do notes
// Formato: [INTEREST_ONLY_PAID:índice_parcela:valor:data]
const getInterestOnlyPaymentsFromNotes = (notes: string | null): Array<{ installmentIndex: number; amount: number; paymentDate: string }> => {
  const payments: Array<{ installmentIndex: number; amount: number; paymentDate: string }> = [];
  const matches = (notes || '').matchAll(/\[INTEREST_ONLY_PAID:(\d+):([0-9.]+):([^\]]+)\]/g);
  for (const match of matches) {
    payments.push({
      installmentIndex: parseInt(match[1]),
      amount: parseFloat(match[2]),
      paymentDate: match[3]
    });
  }
  return payments;
};

// Helper para calcular quantas parcelas estão pagas usando o sistema de tracking
const getPaidInstallmentsCount = (loan: { notes?: string | null; installments?: number | null; principal_amount: number; interest_rate: number; interest_mode?: string | null; total_interest?: number | null; payment_type?: string; total_paid?: number | null }): number => {
  const numInstallments = loan.installments || 1;
  const isDaily = loan.payment_type === 'daily';
  
  // CORREÇÃO: Usar total_interest do banco como fonte de verdade
  let totalInterest = 0;
  if (isDaily) {
    // Para empréstimo diário, total_interest é o valor da parcela
    const dailyAmount = loan.total_interest || 0;
    totalInterest = (dailyAmount * numInstallments) - loan.principal_amount;
  } else if (loan.total_interest !== undefined && loan.total_interest !== null && loan.total_interest > 0) {
    // Usar valor do banco quando disponível (inclui arredondamentos do usuário)
    totalInterest = loan.total_interest;
  } else if (loan.interest_mode === 'on_total') {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100);
  } else if (loan.interest_mode === 'compound') {
    // Usar fórmula PMT de amortização (Sistema Price)
    totalInterest = calculateCompoundInterestPMT(loan.principal_amount, loan.interest_rate, numInstallments);
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
  
  // 🆕 FALLBACK: Se não há tags de tracking mas há pagamentos registrados,
  // calcular parcelas pagas baseado no total_paid dividido pelo valor da parcela
  // MAS: Verificar se há tags de [INTEREST_ONLY_PAID] - se sim, NÃO usar o fallback
  const hasTrackingTags = Object.keys(partialPayments).length > 0;
  const hasInterestOnlyTags = (loan.notes || '').includes('[INTEREST_ONLY_PAID:');
  const totalPaid = loan.total_paid || 0;
  
  // Só usar fallback se não houver NENHUMA tag de tracking (nem partial, nem interest-only)
  if (!hasTrackingTags && !hasInterestOnlyTags && totalPaid > 0 && baseInstallmentValue > 0) {
    // Calcular quantas parcelas completas foram pagas
    const paidByValue = Math.floor(totalPaid / baseInstallmentValue);
    return Math.min(paidByValue, numInstallments);
  }
  
  // Extrair sub-parcelas de adiantamento - se houver sub-parcela pendente para um índice, 
  // essa parcela NÃO deve ser considerada como totalmente paga
  const advanceSubparcelas = getAdvanceSubparcelasFromNotes(loan.notes);
  const hasSubparcelaForIndex = (index: number) => 
    advanceSubparcelas.some(s => s.originalIndex === index);
  
  let paidCount = 0;
  for (let i = 0; i < numInstallments; i++) {
    const installmentValue = getInstallmentValue(i);
    const paidAmount = partialPayments[i] || 0;
    // Parcela só é considerada paga se: valor pago >= 99% E não tem sub-parcela pendente
    if (paidAmount >= installmentValue * 0.99 && !hasSubparcelaForIndex(i)) {
      paidCount++;
    } else {
      break; // Para no primeiro não pago
    }
  }
  
  return paidCount;
};

// 🆕 Função para encontrar a primeira parcela NÃO QUITADA (ignorando pagamentos de juros)
// Esta função é usada especificamente para pagamentos de "só juros" 
// para garantir que o juros sempre vá para a parcela 1 até que ela seja quitada
type LoanForUnpaidCheck = { 
  notes?: string | null; 
  installments?: number | null; 
  principal_amount: number; 
  interest_rate: number; 
  interest_mode?: string | null; 
  total_interest?: number | null; 
  payment_type?: string;
};

const getFirstUnpaidInstallmentIndex = (loan: LoanForUnpaidCheck): number => {
  const numInstallments = loan.installments || 1;
  const isDaily = loan.payment_type === 'daily';
  
  // Calcular valor da parcela
  let totalInterest = 0;
  if (isDaily) {
    const dailyAmount = loan.total_interest || 0;
    totalInterest = (dailyAmount * numInstallments) - loan.principal_amount;
  } else if (loan.total_interest !== undefined && loan.total_interest !== null && loan.total_interest > 0) {
    totalInterest = loan.total_interest;
  } else if (loan.interest_mode === 'on_total') {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100);
  } else if (loan.interest_mode === 'compound') {
    totalInterest = calculateCompoundInterestPMT(loan.principal_amount, loan.interest_rate, numInstallments);
  } else {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
  }
  
  const principalPerInstallment = loan.principal_amount / numInstallments;
  const interestPerInstallment = totalInterest / numInstallments;
  const baseInstallmentValue = principalPerInstallment + interestPerInstallment;
  
  // Verificar taxa de renovação
  const renewalFeeMatch = (loan.notes || '').match(/\[RENEWAL_FEE_INSTALLMENT:(\d+):([0-9.]+)(?::[0-9.]+)?\]/);
  const renewalFeeInstallmentIndex = renewalFeeMatch ? parseInt(renewalFeeMatch[1]) : null;
  const renewalFeeValue = renewalFeeMatch ? parseFloat(renewalFeeMatch[2]) : 0;
  
  const getInstallmentValue = (index: number) => {
    if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
      return renewalFeeValue;
    }
    return baseInstallmentValue;
  };
  
  // Pagamentos parciais (principal + juros efetivamente pagos, NÃO conta [INTEREST_ONLY_PAID])
  const partialPayments = getPartialPaymentsFromNotes(loan.notes);
  
  // Sub-parcelas de adiantamento pendentes
  const advanceSubparcelas = getAdvanceSubparcelasFromNotes(loan.notes);
  const hasSubparcelaForIndex = (index: number) => 
    advanceSubparcelas.some(s => s.originalIndex === index);
  
  // Encontrar a primeira parcela que NÃO está quitada
  for (let i = 0; i < numInstallments; i++) {
    const installmentValue = getInstallmentValue(i);
    const paidAmount = partialPayments[i] || 0;
    
    // Parcela NÃO está quitada se: valor pago < 99% OU tem sub-parcela pendente
    if (paidAmount < installmentValue * 0.99 || hasSubparcelaForIndex(i)) {
      return i; // Primeira não quitada
    }
  }
  
  // Se todas as parcelas estão pagas, retornar a última
  return numInstallments - 1;
};

export default function Loans() {
  const { loans, loading, createLoan, registerPayment, deleteLoan, deletePayment, renegotiateLoan, updateLoan, fetchLoans, getLoanPayments, updatePaymentDate, addExtraInstallments } = useLoans();
  const { clients, updateClient, createClient, fetchClients } = useClients();
  const { profile } = useProfile();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'overdue' | 'renegotiated' | 'pending' | 'weekly' | 'biweekly' | 'installment' | 'single' | 'interest_only'>('all');
  const [activeTab, setActiveTab] = useState<'regular' | 'daily'>('regular');
  const [isDailyDialogOpen, setIsDailyDialogOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [installmentDates, setInstallmentDates] = useState<string[]>([]);
  const [dailyDateMode, setDailyDateMode] = useState<'auto' | 'manual'>('auto');
  const [dailyFirstDate, setDailyFirstDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dailyInstallmentCount, setDailyInstallmentCount] = useState('20');
  const [skipSaturday, setSkipSaturday] = useState(false);
  const [skipSunday, setSkipSunday] = useState(false);
  
  // Generate daily dates (consecutive days, optionally skipping weekends)
  const generateDailyDates = (startDate: string, count: number, skipSat = false, skipSun = false): string[] => {
    const dates: string[] = [];
    let currentDate = new Date(startDate + 'T12:00:00');
    
    while (dates.length < count) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;
      
      // Skip if it's a day we should skip
      if ((skipSat && isSaturday) || (skipSun && isSunday)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };
  
  // Auto-generate dates when auto mode is active
  useEffect(() => {
    if (dailyDateMode === 'auto' && dailyFirstDate && dailyInstallmentCount) {
      const count = parseInt(dailyInstallmentCount) || 0;
      if (count > 0) {
        const generatedDates = generateDailyDates(dailyFirstDate, count, skipSaturday, skipSunday);
        setInstallmentDates(generatedDates);
        if (generatedDates.length > 0) {
          setFormData(prev => ({
            ...prev,
            start_date: generatedDates[0],
            due_date: generatedDates[generatedDates.length - 1],
            installments: count.toString(),
            daily_period: count.toString()
          }));
        }
      }
    }
  }, [dailyDateMode, dailyFirstDate, dailyInstallmentCount, skipSaturday, skipSunday]);
  
  // Regenerate dates for the dedicated daily dialog when skip options change
  useEffect(() => {
    if (isDailyDialogOpen && formData.start_date && formData.daily_period && parseInt(formData.daily_period) > 0) {
      const newDates = generateDailyDates(formData.start_date, parseInt(formData.daily_period), skipSaturday, skipSunday);
      setInstallmentDates(newDates);
      if (newDates.length > 0) {
        setFormData(prev => ({
          ...prev,
          due_date: newDates[newDates.length - 1],
          installments: newDates.length.toString()
        }));
      }
    }
  }, [skipSaturday, skipSunday, isDailyDialogOpen]);
  
  const [isRenegotiateDialogOpen, setIsRenegotiateDialogOpen] = useState(false);
  const [renegotiateData, setRenegotiateData] = useState({
    promised_amount: '',
    promised_date: '',
    remaining_amount: '',
    notes: '',
    interest_only_paid: false,
    interest_amount_paid: '',
    interest_payment_date: format(new Date(), 'yyyy-MM-dd'), // Data do pagamento de juros
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
  
  // State for historical contract installment selection
  const [selectedPastInstallments, setSelectedPastInstallments] = useState<number[]>([]);
  
  // Receipt preview state
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [receiptPreviewData, setReceiptPreviewData] = useState<ContractReceiptData | null>(null);

  // Payment receipt prompt state
  const [isPaymentReceiptOpen, setIsPaymentReceiptOpen] = useState(false);
  const [paymentReceiptData, setPaymentReceiptData] = useState<PaymentReceiptData | null>(null);
  const [paymentClientPhone, setPaymentClientPhone] = useState<string | null>(null);

  // Loan created receipt prompt state
  const [isLoanCreatedOpen, setIsLoanCreatedOpen] = useState(false);
  const [loanCreatedData, setLoanCreatedData] = useState<{
    id: string;
    clientName: string;
    clientPhone?: string;
    principalAmount: number;
    interestRate: number;
    totalInterest: number;
    totalToReceive: number;
    installments: number;
    installmentValue: number;
    startDate: string;
    dueDate: string;
    paymentType: string;
  } | null>(null);
  const [loanCreatedInstallmentDates, setLoanCreatedInstallmentDates] = useState<string[]>([]);

  // Edit loan state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [editLoanIsOverdue, setEditLoanIsOverdue] = useState(false);
  const [editOverdueDays, setEditOverdueDays] = useState(0);
  const [editIsRenegotiation, setEditIsRenegotiation] = useState(false);
  const [editHistoricalData, setEditHistoricalData] = useState<{
    originalPrincipal: number;
    originalRate: number;
    originalInstallments: number;
    originalInterestMode: string;
    originalTotalInterest: number;
    originalTotal: number;
    totalPaid: number;
    realizedProfit: number;
    remainingBalance: number;
  } | null>(null);
  const [editFormData, setEditFormData] = useState({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'simple' as InterestType,
    interest_mode: 'per_installment' as 'per_installment' | 'on_total' | 'compound',
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
  const [editInstallmentValue, setEditInstallmentValue] = useState('');
  const [isEditManuallyEditingInstallment, setIsEditManuallyEditingInstallment] = useState(false);
  
  // Auto-regenerate installment dates when number of installments changes in edit form
  useEffect(() => {
    if (isEditDialogOpen && (editFormData.payment_type === 'installment' || editFormData.payment_type === 'weekly' || editFormData.payment_type === 'biweekly') && editFormData.start_date) {
      const numInstallments = parseInt(editFormData.installments) || 1;
      const startDate = new Date(editFormData.start_date + 'T12:00:00');
      const startDay = startDate.getDate();
      
      setEditInstallmentDates(prev => {
        // Only regenerate if installment count changed
        if (prev.length === numInstallments) return prev;
        
        const newDates: string[] = [];
        
        for (let i = 0; i < numInstallments; i++) {
          // Keep existing dates if available
          if (prev[i]) {
            newDates.push(prev[i]);
          } else {
            // Generate new date based on payment type
            const date = new Date(startDate);
            if (editFormData.payment_type === 'weekly') {
              date.setDate(date.getDate() + (i * 7));
            } else if (editFormData.payment_type === 'biweekly') {
              date.setDate(date.getDate() + (i * 15));
            } else {
              // Monthly (installment)
              date.setMonth(date.getMonth() + i);
              // Handle edge cases where the day doesn't exist in the target month
              if (date.getDate() !== startDay) {
                date.setDate(0);
              }
            }
            newDates.push(format(date, 'yyyy-MM-dd'));
          }
        }
        
        // Update due_date to last installment
        if (newDates.length > 0) {
          setEditFormData(prevForm => ({ ...prevForm, due_date: newDates[newDates.length - 1] }));
        }
        
        return newDates;
      });
    }
  }, [isEditDialogOpen, editFormData.payment_type, editFormData.start_date, editFormData.installments]);
  
  // Auto-recalculate edit installment value when form values change (unless manually editing)
  useEffect(() => {
    if (isEditManuallyEditingInstallment) return;
    if (!isEditDialogOpen) return;
    if (editFormData.payment_type !== 'installment' && editFormData.payment_type !== 'weekly' && editFormData.payment_type !== 'biweekly') return;
    
    const principal = parseFloat(editFormData.principal_amount);
    const rate = parseFloat(editFormData.interest_rate);
    const numInstallments = parseInt(editFormData.installments) || 1;
    
    if (principal > 0 && rate >= 0) {
      let totalInterest: number;
      if (editFormData.interest_mode === 'on_total') {
        totalInterest = principal * (rate / 100);
      } else if (editFormData.interest_mode === 'compound') {
        // Juros compostos: M = P(1+i)^n - P
        totalInterest = principal * Math.pow(1 + (rate / 100), numInstallments) - principal;
      } else {
        // per_installment
        totalInterest = principal * (rate / 100) * numInstallments;
      }
      const total = principal + totalInterest;
      setEditInstallmentValue((total / numInstallments).toFixed(2));
    }
  }, [editFormData.principal_amount, editFormData.installments, editFormData.interest_rate, editFormData.interest_mode, editFormData.payment_type, isEditDialogOpen, isEditManuallyEditingInstallment]);
  
  // Payment history state
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  const [paymentHistoryLoanId, setPaymentHistoryLoanId] = useState<string | null>(null);
  const [paymentHistoryData, setPaymentHistoryData] = useState<any[]>([]);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPaymentDate, setEditingPaymentDate] = useState<Date | undefined>(undefined);
  
  // Extra installments dialog state (for daily loans)
  const [isExtraInstallmentsOpen, setIsExtraInstallmentsOpen] = useState(false);
  const [extraInstallmentsLoan, setExtraInstallmentsLoan] = useState<any>(null);
  
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

  // Expanded card state
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);


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
    interest_mode: 'per_installment' as 'per_installment' | 'on_total' | 'compound',
    payment_type: 'single' as LoanPaymentType | 'daily',
    installments: '1',
    contract_date: format(new Date(), 'yyyy-MM-dd'),
    start_date: format(new Date(), 'yyyy-MM-dd'),
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
    
    // Check installmentDates for installment, weekly, daily payment types, or when daily dialog is open
    // Note: isDailyDialogOpen is needed because payment_type is only set to 'daily' on submit
    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly' || formData.payment_type === 'daily' || isDailyDialogOpen) && installmentDates.length > 0) {
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
  
  // Recalcular valor da parcela quando principal, parcelas, taxa ou modo mudam (apenas se não estiver editando manualmente)
  useEffect(() => {
    if (isManuallyEditingInstallment) return;
    
    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly') && formData.principal_amount && formData.interest_rate && formData.installments) {
      const principal = parseFloat(formData.principal_amount);
      const rate = parseFloat(formData.interest_rate);
      const numInstallments = parseInt(formData.installments) || 1;
      let totalInterest: number;
      if (formData.interest_mode === 'per_installment') {
        totalInterest = principal * (rate / 100) * numInstallments;
      } else if (formData.interest_mode === 'compound') {
        // Usar fórmula PMT de amortização (Sistema Price)
        const pmt = calculatePMT(principal, rate, numInstallments);
        setInstallmentValue(pmt.toFixed(2));
        return; // Já calculado diretamente
      } else {
        // on_total
        totalInterest = principal * (rate / 100);
      }
      const total = principal + totalInterest;
      setInstallmentValue((total / numInstallments).toFixed(2));
    }
  }, [formData.principal_amount, formData.installments, formData.interest_rate, formData.interest_mode, formData.payment_type, isManuallyEditingInstallment]);
  
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
    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly') && installmentValue) {
      const perInstallment = parseFloat(installmentValue);
      if (!perInstallment) return 'R$ 0,00';
      totalInterest = perInstallment * numInstallments - principal;
    } else if (formData.interest_rate) {
      const rate = parseFloat(formData.interest_rate);
      if (formData.interest_mode === 'per_installment') {
        totalInterest = principal * (rate / 100) * numInstallments;
      } else if (formData.interest_mode === 'compound') {
        // Usar fórmula PMT de amortização (Sistema Price)
        totalInterest = calculateCompoundInterestPMT(principal, rate, numInstallments);
      } else {
        // on_total
        totalInterest = principal * (rate / 100);
      }
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
    } else if (formData.interest_mode === 'compound') {
      // Usar Newton-Raphson para encontrar a taxa a partir do PMT
      newRate = calculateRateFromPMT(newInstallmentValue, principal, numInstallments);
    } else {
      // on_total
      newRate = (totalInterest / principal) * 100;
    }
    
    // Permite qualquer taxa >= 0 (arredondamentos podem resultar em taxas baixas)
    if (newRate >= 0 && isFinite(newRate)) {
      setFormData(prev => ({ ...prev, interest_rate: newRate.toFixed(2) }));
    }
  };

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    new_due_date: '', // Nova data de vencimento (opcional)
    payment_type: 'partial' as 'partial' | 'total' | 'installment',
    selected_installments: [] as number[],
    partial_installment_index: null as number | null, // Índice da parcela para pagamento parcial
    send_notification: false, // Enviar notificação WhatsApp (desativado por padrão)
    is_advance_payment: false, // Flag para adiantamento de pagamento
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
        
        newDates.push(format(date, 'yyyy-MM-dd'));
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
        newDates.push(format(date, 'yyyy-MM-dd'));
      }
      
      setInstallmentDates(newDates);
      // Set the last installment date as the due_date
      if (newDates.length > 0) {
        setFormData(prev => ({ ...prev, due_date: newDates[newDates.length - 1] }));
      }
    }
  }, [formData.payment_type, formData.start_date, formData.installments]);

  // Generate biweekly dates when start_date or installments change
  useEffect(() => {
    if (formData.payment_type === 'biweekly' && formData.start_date) {
      const numInstallments = parseInt(formData.installments) || 1;
      const startDate = new Date(formData.start_date + 'T12:00:00');
      const newDates: string[] = [];
      
      for (let i = 0; i < numInstallments; i++) {
        const date = new Date(startDate);
        // Add 15 days for each installment (biweekly)
        date.setDate(date.getDate() + (i * 15));
        newDates.push(format(date, 'yyyy-MM-dd'));
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
      // In auto mode, generate dates; in manual mode, clear for manual selection
      if (dailyDateMode === 'auto' && dailyFirstDate && dailyInstallmentCount) {
        const count = parseInt(dailyInstallmentCount) || 20;
        const generatedDates = generateDailyDates(dailyFirstDate, count, skipSaturday, skipSunday);
        setInstallmentDates(generatedDates);
      } else {
        setInstallmentDates([]);
      }
    }
  }, [formData.payment_type, dailyDateMode]);

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
    const isDaily = loan.payment_type === 'daily';
    
    // CORREÇÃO: Usar total_interest do banco como fonte de verdade
    let totalInterest = 0;
    let totalToReceive = 0;
    
    if (isDaily) {
      // Para empréstimo diário, total_interest é o valor da parcela
      const dailyAmount = loan.total_interest || 0;
      totalToReceive = dailyAmount * numInstallments;
      totalInterest = totalToReceive - loan.principal_amount;
    } else if (loan.total_interest !== undefined && loan.total_interest !== null && loan.total_interest > 0) {
      // Usar valor do banco quando disponível (inclui arredondamentos do usuário)
      totalInterest = loan.total_interest;
      totalToReceive = loan.principal_amount + totalInterest;
    } else if (loan.interest_mode === 'on_total') {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100);
      totalToReceive = loan.principal_amount + totalInterest;
    } else if (loan.interest_mode === 'compound') {
      // Usar fórmula PMT de amortização (Sistema Price)
      totalInterest = calculateCompoundInterestPMT(loan.principal_amount, loan.interest_rate, numInstallments);
      totalToReceive = loan.principal_amount + totalInterest;
    } else {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
      totalToReceive = loan.principal_amount + totalInterest;
    }
    
    const remainingToReceive = totalToReceive - (loan.total_paid || 0);
    const principalPerInstallment = loan.principal_amount / numInstallments;
    const interestPerInstallment = totalInterest / numInstallments;
    const totalPerInstallment = principalPerInstallment + interestPerInstallment;
    
    const isPaid = loan.status === 'paid' || remainingToReceive <= 0;
    const isRenegotiated = loan.notes?.includes('Valor prometido') || loan.notes?.includes('[RENEGOTIATED]');
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
        } else if (dates.length > 0) {
          // All dates are in the past - check if there are unpaid installments
          if (paidInstallments < dates.length) {
            isOverdue = true;
            overdueInstallmentIndex = paidInstallments;
            overdueDate = dates[paidInstallments];
            const nextDueDate = new Date(dates[paidInstallments] + 'T12:00:00');
            daysOverdue = Math.ceil((today.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        } else {
          // No dates, use due_date
          const dueDate = new Date(loan.due_date + 'T12:00:00');
          isOverdue = today > dueDate;
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

  // First, filter by active tab (daily vs regular)
  const loansForCurrentTab = useMemo(() => {
    if (activeTab === 'daily') {
      return loans.filter(l => l.payment_type === 'daily');
    }
    return loans.filter(l => l.payment_type !== 'daily');
  }, [loans, activeTab]);

  // Calculate counts for each tab
  const regularLoansCount = useMemo(() => loans.filter(l => l.payment_type !== 'daily').length, [loans]);
  const dailyLoansCount = useMemo(() => loans.filter(l => l.payment_type === 'daily').length, [loans]);

  const filteredLoans = loansForCurrentTab.filter(loan => {
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
        return !isPaid && !isOverdue && !isRenegotiated && !isInterestOnlyPayment && loan.payment_type !== 'weekly' && loan.payment_type !== 'biweekly';
      case 'weekly':
        return loan.payment_type === 'weekly';
      case 'biweekly':
        return loan.payment_type === 'biweekly';
      case 'installment':
        return loan.payment_type === 'installment';
      case 'single':
        return loan.payment_type === 'single';
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
    
    // Calculate actual interest percentage for daily loans
    const interestPercentage = principalAmount > 0 ? (profit / principalAmount) * 100 : 0;
    
    const loanData = {
      client_id: formData.client_id,
      principal_amount: principalAmount,
      interest_rate: interestPercentage, // Store actual percentage, not absolute profit
      interest_type: 'simple' as const,
      interest_mode: 'per_installment' as const,
      payment_type: 'daily' as const,
      installments: numDays,
      contract_date: formData.contract_date,
      start_date: formData.start_date,
      due_date: installmentDates[installmentDates.length - 1],
      remaining_balance: totalToReceive,
      total_interest: dailyAmount,
      notes: (() => {
        let baseNotes = formData.notes || '';
        const skipTags = [];
        if (skipSaturday) skipTags.push('[SKIP_SATURDAY]');
        if (skipSunday) skipTags.push('[SKIP_SUNDAY]');
        const skipTagsStr = skipTags.length > 0 ? skipTags.join(' ') + '\n' : '';
        const details = `Valor emprestado: R$ ${principalAmount.toFixed(2)}\nParcela diária: R$ ${dailyAmount.toFixed(2)}\nTotal a receber: R$ ${totalToReceive.toFixed(2)}\nLucro: R$ ${profit.toFixed(2)}`;
        
        if (formData.is_historical_contract) {
          return `[HISTORICAL_CONTRACT]\n${skipTagsStr}${baseNotes ? baseNotes + '\n' : ''}${details}`;
        }
        return `${skipTagsStr}${baseNotes ? baseNotes + '\n' : ''}${details}`;
      })(),
      installment_dates: installmentDates,
      send_creation_notification: formData.send_creation_notification,
    };
    
    console.log('loanData being passed to createLoan:', loanData);
    
    const result = await createLoan(loanData);
    
    // Se contrato antigo com parcelas selecionadas, registrar como pagas
    if (formData.is_historical_contract && selectedPastInstallments.length > 0) {
      // Buscar o empréstimo recém-criado
      const { data: newLoans } = await supabase
        .from('loans')
        .select('id, notes')
        .eq('client_id', formData.client_id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (newLoans && newLoans[0]) {
        const loanId = newLoans[0].id;
        const installmentsList = pastInstallmentsData.pastInstallmentsList || [];
        
        // Calcular valores por parcela
        const principalPerInstallment = principalAmount / numDays;
        const interestPerInstallment = dailyAmount - principalPerInstallment;
        
        // Registrar cada parcela selecionada como pagamento
        for (const idx of selectedPastInstallments) {
          const installment = installmentsList.find(i => i.index === idx);
          if (!installment) continue;
          
          await registerPayment({
            loan_id: loanId,
            amount: dailyAmount,
            principal_paid: principalPerInstallment,
            interest_paid: interestPerInstallment,
            payment_date: installment.date,
            notes: `[CONTRATO_ANTIGO] Parcela ${idx + 1} - ${format(new Date(installment.date + 'T12:00:00'), 'dd/MM/yyyy')}`,
          });
        }
        
        // Adicionar tags PARTIAL_PAID nas notas
        const partialPaidTags = selectedPastInstallments
          .map(idx => {
            return `[PARTIAL_PAID:${idx}:${dailyAmount}]`;
          })
          .join(' ');
        
        if (partialPaidTags) {
          const updatedNotes = newLoans[0].notes 
            ? `${newLoans[0].notes} ${partialPaidTags}` 
            : partialPaidTags;
          
          await supabase
            .from('loans')
            .update({ notes: updatedNotes })
            .eq('id', loanId);
          
          await fetchLoans();
        }
        
        toast.success(`${selectedPastInstallments.length} parcela(s) registrada(s) como pagas`);
      }
    }
    
    // Show loan created receipt prompt (same as handleSubmit)
    if (result?.data) {
      const client = clients.find(c => c.id === formData.client_id);
      
      setLoanCreatedData({
        id: result.data.id,
        clientName: client?.full_name || 'Cliente',
        clientPhone: client?.phone || undefined,
        principalAmount: principalAmount,
        interestRate: interestPercentage,
        totalInterest: profit,
        totalToReceive: totalToReceive,
        installments: numDays,
        installmentValue: dailyAmount,
        startDate: formData.start_date,
        dueDate: installmentDates[installmentDates.length - 1],
        paymentType: 'daily',
      });
      setLoanCreatedInstallmentDates(installmentDates);
      setIsLoanCreatedOpen(true);
    }
    
    setIsDailyDialogOpen(false);
    resetForm();
  };

  // Calculate past installments and their value for historical contracts
  // Uses the rounded installmentValue when available (user-edited)
  const pastInstallmentsData = useMemo(() => {
    if (!formData.is_historical_contract || !hasPastDates) return { count: 0, totalValue: 0, pastInstallmentsList: [] as { date: string; value: number; index: number }[] };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const principal = parseFloat(formData.principal_amount) || 0;
    const numInstallments = parseInt(formData.installments) || 1;
    
    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly' || formData.payment_type === 'daily' || isDailyDialogOpen) && installmentDates.length > 0) {
      const pastDates = installmentDates.filter(d => {
        const date = new Date(d + 'T12:00:00');
        return date < today;
      });
      
      // Use the rounded installment value if user edited it, otherwise calculate
      let valuePerInstallment: number;
      let principalPerInstallment: number;
      let interestPerInstallment: number;
      
      // For daily loans (or when daily dialog is open), use daily_amount directly
      if ((formData.payment_type === 'daily' || isDailyDialogOpen) && formData.daily_amount) {
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
      
      // Build list with indices
      const pastInstallmentsList = pastDates.map((date, idx) => {
        const originalIndex = installmentDates.indexOf(date);
        return { date, value: valuePerInstallment, index: originalIndex >= 0 ? originalIndex : idx };
      });
      
      return {
        count: pastDates.length,
        totalValue: valuePerInstallment * pastDates.length,
        dates: pastDates,
        valuePerInstallment,
        principalPerInstallment,
        interestPerInstallment,
        pastInstallmentsList,
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
          pastInstallmentsList: [{ date: formData.due_date, value: principal + interestAmount, index: 0 }],
        };
      }
    }
    
    return { count: 0, totalValue: 0, pastInstallmentsList: [] as { date: string; value: number; index: number }[] };
  }, [formData.is_historical_contract, hasPastDates, formData.principal_amount, formData.installments, formData.payment_type, formData.daily_amount, formData.interest_rate, formData.interest_mode, formData.due_date, installmentDates, installmentValue, isDailyDialogOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação de campos obrigatórios
    if (!formData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }
    
    // Para pagamento diário no formulário regular, não permitir - redirecionar para "Novo Diário"
    if (formData.payment_type === 'daily') {
      toast.error('Use o botão "Empréstimo Diário" para criar empréstimos diários');
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
    } else if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly') && installmentDates.length > 0) {
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

    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly') && installmentValue) {
      const perInstallment = parseFloat(installmentValue);
      const totalToReceive = perInstallment * numInstallments;
      totalInterest = totalToReceive - principal;

      // Recalcula a taxa de juros apenas para exibição, baseada no valor arredondado da parcela
      if (totalInterest >= 0) {
        let computedRate: number;
        if (formData.interest_mode === 'per_installment') {
          computedRate = (totalInterest / principal / numInstallments) * 100;
        } else if (formData.interest_mode === 'compound') {
          // Inverter a fórmula de juros compostos para encontrar a taxa
          // totalInterest = P * (1+r)^n - P => totalInterest/P + 1 = (1+r)^n => r = (totalInterest/P + 1)^(1/n) - 1
          computedRate = (Math.pow((totalInterest / principal) + 1, 1 / numInstallments) - 1) * 100;
        } else {
          computedRate = (totalInterest / principal) * 100;
        }
        rate = parseFloat(computedRate.toFixed(2));
      }
    } else {
      if (formData.interest_mode === 'per_installment') {
        totalInterest = principal * (rate / 100) * numInstallments;
      } else if (formData.interest_mode === 'compound') {
        // Juros compostos: M = P(1+i)^n - P
        totalInterest = principal * Math.pow(1 + (rate / 100), numInstallments) - principal;
      } else {
        // on_total
        totalInterest = principal * (rate / 100);
      }
    }
    
    const result = await createLoan({
      ...formData,
      principal_amount: principal,
      interest_rate: rate,
      installments: formData.payment_type === 'single' ? 1 : numInstallments,
      total_interest: totalInterest,
      remaining_balance: principal + totalInterest,
      due_date: finalDueDate,
      installment_dates: ['installment', 'weekly', 'biweekly', 'daily'].includes(formData.payment_type) ? installmentDates : [],
      notes: notes || undefined,
      send_creation_notification: formData.send_creation_notification,
    });
    
    // If historical contract with past installments, register selected ones as paid
    if (result?.data && formData.is_historical_contract && selectedPastInstallments.length > 0) {
      const loanId = result.data.id;
      const installmentsList = pastInstallmentsData.pastInstallmentsList || [];
      
      // Register each selected installment as a separate payment
      for (const idx of selectedPastInstallments) {
        const installment = installmentsList.find(i => i.index === idx);
        if (!installment) continue;
        
        await registerPayment({
          loan_id: loanId,
          amount: installment.value,
          principal_paid: pastInstallmentsData.principalPerInstallment || 0,
          interest_paid: pastInstallmentsData.interestPerInstallment || 0,
          payment_date: installment.date,
          notes: `[CONTRATO_ANTIGO] Parcela ${idx + 1} - ${formatDate(installment.date)}`,
        });
      }
      
      // Add PARTIAL_PAID tags to loan notes so getInstallmentStatus recognizes them as paid
      const partialPaidTags = selectedPastInstallments
        .map(idx => {
          const installment = installmentsList.find(i => i.index === idx);
          return installment ? `[PARTIAL_PAID:${idx}:${installment.value}]` : null;
        })
        .filter(Boolean)
        .join(' ');
      
      if (partialPaidTags) {
        const currentNotes = notes || '';
        const updatedNotes = currentNotes ? `${currentNotes} ${partialPaidTags}` : partialPaidTags;
        
        await supabase
          .from('loans')
          .update({ notes: updatedNotes })
          .eq('id', loanId);
        
        // Recarregar loans para refletir as notas atualizadas com tags PARTIAL_PAID
        await fetchLoans();
      }
      
      toast.success(`${selectedPastInstallments.length} parcela(s) registrada(s) individualmente`);
    }
    
    // Show loan created receipt prompt
    if (result?.data) {
      const client = clients.find(c => c.id === formData.client_id);
      const installmentValueNum = installmentValue ? parseFloat(installmentValue) : (principal + totalInterest) / numInstallments;
      
      setLoanCreatedData({
        id: result.data.id,
        clientName: client?.full_name || 'Cliente',
        clientPhone: client?.phone || undefined,
        principalAmount: principal,
        interestRate: rate,
        totalInterest: totalInterest,
        totalToReceive: principal + totalInterest,
        installments: numInstallments,
        installmentValue: installmentValueNum,
        startDate: formData.start_date,
        dueDate: finalDueDate,
        paymentType: formData.payment_type,
      });
      setLoanCreatedInstallmentDates(['installment', 'weekly', 'biweekly', 'daily'].includes(formData.payment_type) ? installmentDates : []);
      setIsLoanCreatedOpen(true);
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
    const isDaily = selectedLoan.payment_type === 'daily';
    
    // CORREÇÃO: Usar total_interest do banco como fonte de verdade para cálculos
    let totalInterest = 0;
    let baseInstallmentValue = 0;
    let totalToReceive = 0;
    
    if (isDaily) {
      // For daily loans: total_interest stores the daily amount directly
      const dailyAmount = selectedLoan.total_interest || 0;
      totalToReceive = dailyAmount * numInstallments;
      totalInterest = totalToReceive - selectedLoan.principal_amount;
      baseInstallmentValue = dailyAmount;
    } else if (selectedLoan.total_interest !== undefined && selectedLoan.total_interest !== null && selectedLoan.total_interest > 0) {
      // USAR VALOR DO BANCO - inclui arredondamentos manuais do usuário
      totalInterest = selectedLoan.total_interest;
      totalToReceive = selectedLoan.principal_amount + totalInterest;
      baseInstallmentValue = totalToReceive / numInstallments;
    } else if (selectedLoan.interest_mode === 'on_total') {
      totalInterest = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100);
      totalToReceive = selectedLoan.principal_amount + totalInterest;
      baseInstallmentValue = totalToReceive / numInstallments;
    } else if (selectedLoan.interest_mode === 'compound') {
      totalInterest = selectedLoan.principal_amount * Math.pow(1 + (selectedLoan.interest_rate / 100), numInstallments) - selectedLoan.principal_amount;
      totalToReceive = selectedLoan.principal_amount + totalInterest;
      baseInstallmentValue = totalToReceive / numInstallments;
    } else {
      totalInterest = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100) * numInstallments;
      totalToReceive = selectedLoan.principal_amount + totalInterest;
      baseInstallmentValue = totalToReceive / numInstallments;
    }
    
    const interestPerInstallment = totalInterest / numInstallments;
    const remainingToReceive = totalToReceive - (selectedLoan.total_paid || 0);
    
    const principalPerInstallment = selectedLoan.principal_amount / numInstallments;
    
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
    
    // Verificar se é pagamento de sub-parcela de adiantamento (índice negativo)
    const isAdvanceSubparcelaPayment = paymentData.payment_type === 'partial' && 
      paymentData.partial_installment_index !== null && 
      paymentData.partial_installment_index < 0;
    
    let targetSubparcela: { originalIndex: number; amount: number; dueDate: string; uniqueId: string } | null = null;
    
    if (isAdvanceSubparcelaPayment) {
      // Pagamento de sub-parcela de adiantamento
      const subIdx = Math.abs(paymentData.partial_installment_index!) - 1;
      const advanceSubparcelas = getAdvanceSubparcelasFromNotes(selectedLoan.notes);
      targetSubparcela = advanceSubparcelas[subIdx] || null;
      if (targetSubparcela) {
        targetInstallmentIndex = targetSubparcela.originalIndex;
      }
    } else if (paymentData.payment_type === 'partial' && paymentData.partial_installment_index !== null) {
      // Se o usuário selecionou uma parcela específica, usar ela
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
    } else if (isAdvanceSubparcelaPayment && targetSubparcela) {
      // Pagamento de sub-parcela de adiantamento
      amount = parseFloat(paymentData.amount) || targetSubparcela.amount;
      
      // Renomear a tag da sub-parcela para PAID ao invés de remover
      // Suporta formato antigo (sem ID) e novo (com ID)
      const paidTag = `[ADVANCE_SUBPARCELA_PAID:${targetSubparcela.originalIndex}:${targetSubparcela.amount.toFixed(2)}:${targetSubparcela.dueDate}:${targetSubparcela.uniqueId}]`;
      const subparcelaRegexWithId = new RegExp(
        `\\[ADVANCE_SUBPARCELA:${targetSubparcela.originalIndex}:[0-9.]+:[^:\\]]+:${targetSubparcela.uniqueId}\\]`,
        'g'
      );
      const subparcelaRegexWithoutId = new RegExp(
        `\\[ADVANCE_SUBPARCELA:${targetSubparcela.originalIndex}:${targetSubparcela.amount.toFixed(2)}:${targetSubparcela.dueDate}\\]`,
        'g'
      );
      // Substituir por tag PAID ao invés de remover
      updatedNotes = updatedNotes.replace(subparcelaRegexWithId, paidTag);
      updatedNotes = updatedNotes.replace(subparcelaRegexWithoutId, paidTag);
      
      // Se o valor pago for menor que a sub-parcela, criar nova sub-parcela com restante (com novo ID)
      if (amount < targetSubparcela.amount - 0.01) {
        const newRemainder = targetSubparcela.amount - amount;
        const newUniqueId = Date.now().toString();
        updatedNotes += `[ADVANCE_SUBPARCELA:${targetSubparcela.originalIndex}:${newRemainder.toFixed(2)}:${targetSubparcela.dueDate}:${newUniqueId}]`;
        installmentNote = `Sub-parcela (Adiant. P${targetSubparcela.originalIndex + 1}) - Pagamento parcial. Restante: ${formatCurrency(newRemainder)}`;
      } else {
        installmentNote = `Sub-parcela (Adiant. P${targetSubparcela.originalIndex + 1}) quitada`;
      }
      
      // Calcular juros e principal proporcionalmente
      let subTotalInterest = 0;
      if (selectedLoan.interest_mode === 'on_total') {
        subTotalInterest = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100);
      } else if (selectedLoan.interest_mode === 'compound') {
        subTotalInterest = selectedLoan.principal_amount * Math.pow(1 + (selectedLoan.interest_rate / 100), numInstallments) - selectedLoan.principal_amount;
      } else {
        subTotalInterest = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100) * numInstallments;
      }
      const totalContract = selectedLoan.principal_amount + subTotalInterest;
      const interestRatio = (totalContract - selectedLoan.principal_amount) / totalContract;
      interest_paid = amount * interestRatio;
      principal_paid = amount - interest_paid;
    } else if (paymentData.payment_type === 'partial') {
      // Pagamento parcial - atualizar tracking da parcela selecionada
      const targetInstallmentValue = getInstallmentValue(targetInstallmentIndex);
      const dates = (selectedLoan.installment_dates as string[]) || [];
      
      // Se é um adiantamento (pagamento antes do vencimento + valor parcial)
      if (paymentData.is_advance_payment) {
        const remainderAmount = targetInstallmentValue - (accumulatedPaid + amount);
        const originalDueDate = dates[targetInstallmentIndex] || selectedLoan.due_date;
        
        if (remainderAmount > 0.01) {
          // Marcar a parcela original como totalmente paga (para não aparecer como pendente)
          updatedNotes = updatedNotes.replace(new RegExp(`\\[PARTIAL_PAID:${targetInstallmentIndex}:[0-9.]+\\]`, 'g'), '');
          updatedNotes += `[PARTIAL_PAID:${targetInstallmentIndex}:${targetInstallmentValue.toFixed(2)}]`;
          
          // Criar sub-parcela com o valor restante, data de vencimento original e ID único
          // Tag: [ADVANCE_SUBPARCELA:índice_original:valor_restante:data_vencimento:id_único]
          const uniqueId = Date.now().toString();
          updatedNotes += `[ADVANCE_SUBPARCELA:${targetInstallmentIndex}:${remainderAmount.toFixed(2)}:${originalDueDate}:${uniqueId}]`;
          
          installmentNote = `Adiantamento - Parcela ${targetInstallmentIndex + 1}/${numInstallments}. Sub-parcela criada: ${formatCurrency(remainderAmount)} vencendo em ${formatDate(originalDueDate)}`;
        } else {
          // Valor é suficiente para quitar a parcela
          updatedNotes = updatedNotes.replace(new RegExp(`\\[PARTIAL_PAID:${targetInstallmentIndex}:[0-9.]+\\]`, 'g'), '');
          updatedNotes += `[PARTIAL_PAID:${targetInstallmentIndex}:${targetInstallmentValue.toFixed(2)}]`;
          installmentNote = `Parcela ${targetInstallmentIndex + 1}/${numInstallments} quitada`;
        }
        
        // Se esta parcela tinha taxa extra e foi quitada, remover a tag
        if (renewalFeeInstallmentIndex !== null && targetInstallmentIndex === renewalFeeInstallmentIndex) {
          updatedNotes = updatedNotes.replace(/\[RENEWAL_FEE_INSTALLMENT:[^\]]+\]\n?/g, '');
        }
      } else {
        // Comportamento padrão: pagamento parcial normal
        // Permite registrar valores maiores que a parcela (sem limitar)
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
      if ((selectedLoan.payment_type === 'installment' || selectedLoan.payment_type === 'weekly' || selectedLoan.payment_type === 'biweekly') && currentDates.length > 0) {
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
    const isDailyForReceipt = selectedLoan.payment_type === 'daily';
    let totalContractValue = 0;

    if (isDailyForReceipt) {
      // Para diário: total = parcela × quantidade
      const dailyInstallment = selectedLoan.total_interest || 0;
      totalContractValue = dailyInstallment * numInstallments;
    } else {
      // CORREÇÃO: Usar total_interest do banco como fonte de verdade
      let totalInterestForReceipt = 0;
      if (selectedLoan.total_interest !== undefined && selectedLoan.total_interest !== null && selectedLoan.total_interest > 0) {
        totalInterestForReceipt = selectedLoan.total_interest;
      } else if (selectedLoan.interest_mode === 'on_total') {
        totalInterestForReceipt = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100);
      } else if (selectedLoan.interest_mode === 'compound') {
        totalInterestForReceipt = selectedLoan.principal_amount * Math.pow(1 + (selectedLoan.interest_rate / 100), numInstallments) - selectedLoan.principal_amount;
      } else {
        totalInterestForReceipt = selectedLoan.principal_amount * (selectedLoan.interest_rate / 100) * numInstallments;
      }
      totalContractValue = selectedLoan.principal_amount + totalInterestForReceipt;
    }

    // Save client phone before resetting selectedLoan
    setPaymentClientPhone(selectedLoan.client?.phone || null);
    
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
    setPaymentData({ amount: '', payment_date: format(new Date(), 'yyyy-MM-dd'), new_due_date: '', payment_type: 'partial', selected_installments: [], partial_installment_index: null, send_notification: false, is_advance_payment: false });
  };

  const resetForm = () => {
    setFormData({
      client_id: '', principal_amount: '', interest_rate: '', interest_type: 'simple',
      interest_mode: 'per_installment', payment_type: 'single', installments: '1', 
      contract_date: format(new Date(), 'yyyy-MM-dd'),
      start_date: format(new Date(), 'yyyy-MM-dd'), due_date: '', notes: '',
      daily_amount: '', daily_period: '15', is_historical_contract: false, send_creation_notification: false,
    });
    setInstallmentDates([]);
    setInstallmentValue('');
    setSelectedPastInstallments([]);
    setDailyDateMode('auto');
    setDailyFirstDate(format(new Date(), 'yyyy-MM-dd'));
    setDailyInstallmentCount('20');
    setSkipSaturday(false);
    setSkipSunday(false);
  };

  const openRenegotiateDialog = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    // CORREÇÃO: Usar total_interest do banco como fonte de verdade
    const numInstallments = loan.installments || 1;
    
    let totalInterest = 0;
    if (loan.total_interest !== undefined && loan.total_interest !== null && loan.total_interest > 0) {
      totalInterest = loan.total_interest;
    } else if (loan.interest_mode === 'on_total') {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100);
    } else if (loan.interest_mode === 'compound') {
      totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
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
    // Default to 7 days for weekly, 15 days for biweekly, 30 days for others
    today.setDate(today.getDate() + (loan.payment_type === 'weekly' ? 7 : loan.payment_type === 'biweekly' ? 15 : 30));
    setRenegotiateData({
      promised_amount: '',
      promised_date: format(today, 'yyyy-MM-dd'),
      // Aqui usamos o remaining para renegociação normal, mas o modal vai usar
      // remainingForInterestOnly quando "só juros" estiver marcado
      remaining_amount: remainingForRenegotiation > 0 ? remainingForRenegotiation.toFixed(2) : '0',
      notes: loan.notes || '',
      interest_only_paid: false,
      interest_amount_paid: interestPerInstallment.toFixed(2), // Pre-fill with calculated interest
      interest_payment_date: format(new Date(), 'yyyy-MM-dd'), // Data do pagamento de juros
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

    const isDailyLoan = loan.payment_type === 'daily';

    // Para empréstimo diário:
    // - total_interest = valor da parcela (diária)
    // - interest_rate = % de lucro (margem)
    // - total a receber = parcela × número de parcelas
    let totalToReceive = 0;
    let installmentValue = 0;

    if (isDailyLoan) {
      installmentValue = loan.total_interest || 0;
      totalToReceive = installmentValue * numInstallments;
    } else {
      // CORREÇÃO: Usar total_interest do banco como fonte de verdade
      let totalInterest = 0;
      if (loan.total_interest !== undefined && loan.total_interest !== null && loan.total_interest > 0) {
        totalInterest = loan.total_interest;
      } else if (loan.interest_mode === 'on_total') {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100);
      } else if (loan.interest_mode === 'compound') {
        totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
      } else {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
      }
      totalToReceive = loan.principal_amount + totalInterest;
      installmentValue = totalToReceive / numInstallments;
    }
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
      dueDates: (() => {
        const dates = (loan.installment_dates as string[]) || [loan.due_date];
        const partialPayments = getPartialPaymentsFromNotes(loan.notes);
        return dates.map((date, index) => {
          const paidAmount = partialPayments[index] || 0;
          const isPaid = paidAmount >= installmentValue * 0.99;
          return { date, isPaid };
        });
      })(),
      interestOnlyPayment: interestOnlyPayment ? {
        amountPaid: interestOnlyPayment.amountPaid,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
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

      // CORREÇÃO: Usar total_interest do banco como fonte de verdade
      const numInstallments = loan.installments || 1;
      let baseTotalInterest = 0;
      if (loan.total_interest !== undefined && loan.total_interest !== null && loan.total_interest > 0) {
        baseTotalInterest = loan.total_interest;
      } else if (loan.interest_mode === 'on_total') {
        baseTotalInterest = loan.principal_amount * (loan.interest_rate / 100);
      } else if (loan.interest_mode === 'compound') {
        baseTotalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
      } else {
        baseTotalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
      }
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
        payment_date: renegotiateData.interest_payment_date || format(new Date(), 'yyyy-MM-dd'),
        notes: `[INTEREST_ONLY_PAYMENT] Pagamento de juros apenas. Valor restante: R$ ${safeRemaining.toFixed(2)}`,
        send_notification: renegotiateData.send_interest_notification,
      });
      
      // Atualizar notas e nova data de vencimento
      let notesText = loan.notes || '';
      // Adicionar marcador se ainda não existir
      if (!notesText.includes('[INTEREST_ONLY_PAYMENT]')) {
        notesText = `[INTEREST_ONLY_PAYMENT]\n${notesText}`;
      }
      
      // Manter número de parcelas original
      const currentInstallments = loan.installments || 1;
      const currentDates = (loan.installment_dates as string[]) || [];
      const paidInstallmentsCount = getPaidInstallmentsCount(loan);
      
      // Adicionar tag específica para rastrear o pagamento de juros por parcela
      // Formato: [INTEREST_ONLY_PAID:índice_parcela:valor:data]
      const targetInstallmentIndex = getFirstUnpaidInstallmentIndex(loan); // Primeira parcela não quitada (ignora pagamentos de só juros)
      const paymentDateStr = renegotiateData.interest_payment_date || format(new Date(), 'yyyy-MM-dd');
      notesText += `\n[INTEREST_ONLY_PAID:${targetInstallmentIndex}:${interestPaid.toFixed(2)}:${paymentDateStr}]`;
      notesText += `\nPagamento de juros: R$ ${interestPaid.toFixed(2)} em ${formatDate(paymentDateStr)}`;
      
      if (renegotiateData.renewal_fee_enabled) {
        // Determinar qual parcela receberá a taxa de renovação
        const principalPerInstallment = loan.principal_amount / currentInstallments;
        const totalInterestLoan = loan.total_interest || 0;
        const interestPerInstallmentLoan = totalInterestLoan / currentInstallments;
        const originalInstallmentValue = principalPerInstallment + interestPerInstallmentLoan;
        
        const targetInstallment = renegotiateData.renewal_fee_installment === 'next' 
          ? paidInstallmentsCount 
          : parseInt(renegotiateData.renewal_fee_installment);
        
        // Calcular o novo valor da parcela específica = valor original + taxa de renovação
        const feeAmount = parseFloat(renegotiateData.renewal_fee_amount) || 0;
        const newInstallmentValue = originalInstallmentValue + feeAmount;
        
        notesText += `\nTaxa de renovação: ${renegotiateData.renewal_fee_percentage}% (R$ ${renegotiateData.renewal_fee_amount})`;
        notesText += `\n[RENEWAL_FEE_INSTALLMENT:${targetInstallment}:${newInstallmentValue.toFixed(2)}:${feeAmount.toFixed(2)}]`;
      }
      notesText += `\nValor que falta: R$ ${safeRemaining.toFixed(2)}`;
      
      // ROLAR TODAS AS DATAS DAS PARCELAS PARA FRENTE baseado no tipo de pagamento
      let newInstallmentDates = currentDates.map(dateStr => {
        const date = new Date(dateStr + 'T12:00:00');
        if (loan.payment_type === 'weekly') {
          date.setDate(date.getDate() + 7);  // +1 semana
        } else if (loan.payment_type === 'biweekly') {
          date.setDate(date.getDate() + 15); // +15 dias (quinzenal)
        } else {
          date.setMonth(date.getMonth() + 1); // +1 mês (mensal/outros)
        }
        return format(date, 'yyyy-MM-dd');
      });
      
      // Se a data prometida foi especificada, usar como base para a próxima parcela em aberto
      if (renegotiateData.promised_date && paidInstallmentsCount < newInstallmentDates.length) {
        newInstallmentDates[paidInstallmentsCount] = renegotiateData.promised_date;
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
              
              const contractTypeLabel = loan.payment_type === 'weekly' ? 'Semanal' : 
                                        loan.payment_type === 'biweekly' ? 'Quinzenal' : 'Mensal';
              
              const message = `💰 *PAGAMENTO DE JUROS REGISTRADO*
━━━━━━━━━━━━━━━━━━━━━

📋 Contrato: EMP-${loanIdShort} (${contractTypeLabel})
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
      
      // Abrir comprovante após pagamento de juros com opção de enviar ao cliente
      setPaymentClientPhone(loan.client?.phone || null);
      setPaymentReceiptData({
        type: 'loan',
        contractId: loan.id,
        companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
        clientName: loan.client?.full_name || 'Cliente',
        installmentNumber: getPaidInstallmentsCount(loan) + 1,
        totalInstallments: loan.installments || 1,
        amountPaid: interestPaid,
        paymentDate: renegotiateData.interest_payment_date || format(new Date(), 'yyyy-MM-dd'),
        remainingBalance: safeRemaining,
        totalPaid: (loan.total_paid || 0) + interestPaid,
      });
      setIsPaymentReceiptOpen(true);
      
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

  const openEditDialog = async (loanId: string) => {
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
    
    // Check if this is a renegotiation - always allow renegotiation for any contract
    const totalPaid = loan.total_paid || 0;
    const isRenegotiation = true; // Allow renegotiation for contracts with or without payments
    
    // Calculate historical data for renegotiation
    let historicalData: typeof editHistoricalData = null;
    if (isRenegotiation) {
      // CORREÇÃO: Usar total_interest do banco como fonte de verdade
      const numInstallments = loan.installments || 1;
      let totalInterest = 0;
      if (loan.total_interest !== undefined && loan.total_interest !== null && loan.total_interest > 0) {
        totalInterest = loan.total_interest;
      } else if (loan.interest_mode === 'on_total') {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100);
      } else if (loan.interest_mode === 'compound') {
        totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
      } else {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
      }
      const totalContract = loan.principal_amount + totalInterest;
      
      // Fetch actual payments to calculate realized profit correctly (sum of interest_paid)
      const paymentsResult = await getLoanPayments(loanId);
      const payments = paymentsResult.data || [];
      const realizedProfit = payments.reduce((sum, p) => sum + Number(p.interest_paid || 0), 0);
      
      // Remaining balance
      const remaining = loan.remaining_balance || (totalContract - totalPaid);
      
      historicalData = {
        originalPrincipal: loan.principal_amount,
        originalRate: loan.interest_rate,
        originalInstallments: numInstallments,
        originalInterestMode: loan.interest_mode || 'per_installment',
        originalTotalInterest: totalInterest,
        originalTotal: totalContract,
        totalPaid: totalPaid,
        realizedProfit: realizedProfit,
        remainingBalance: remaining > 0 ? remaining : 0,
      };
    }
    
    // Parse existing overdue config from notes
    const overdueConfigMatch = loan.notes?.match(/\[OVERDUE_CONFIG:(percentage|fixed):([0-9.]+)\]/);
    const hasExistingOverdueConfig = !!overdueConfigMatch;
    const existingOverdueType = overdueConfigMatch?.[1] as 'percentage' | 'fixed' | undefined;
    const existingOverdueValue = overdueConfigMatch ? parseFloat(overdueConfigMatch[2]) : 0;
    
    // Clean notes for display (remove the config tag and renegotiation tags)
    let cleanNotes = (loan.notes || '')
      .replace(/\[OVERDUE_CONFIG:[^\]]+\]\n?/g, '')
      .replace(/\[RENEGOTIATED\]\n?/g, '')
      .replace(/\[ORIGINAL_PRINCIPAL:[^\]]+\]\n?/g, '')
      .replace(/\[ORIGINAL_RATE:[^\]]+\]\n?/g, '')
      .replace(/\[ORIGINAL_INSTALLMENTS:[^\]]+\]\n?/g, '')
      .replace(/\[ORIGINAL_INTEREST_MODE:[^\]]+\]\n?/g, '')
      .replace(/\[ORIGINAL_TOTAL:[^\]]+\]\n?/g, '')
      .replace(/\[ORIGINAL_TOTAL_INTEREST:[^\]]+\]\n?/g, '')
      .replace(/\[HISTORICAL_PAID:[^\]]+\]\n?/g, '')
      .replace(/\[HISTORICAL_INTEREST_PAID:[^\]]+\]\n?/g, '')
      .replace(/\[RENEGOTIATION_DATE:[^\]]+\]\n?/g, '')
      .trim();
    
    setEditingLoanId(loanId);
    setEditLoanIsOverdue(isOverdue);
    setEditOverdueDays(daysOverdue);
    setEditIsRenegotiation(isRenegotiation);
    setEditHistoricalData(historicalData);
    setEditFormData({
      client_id: loan.client_id,
      principal_amount: isRenegotiation && historicalData ? historicalData.remainingBalance.toString() : loan.principal_amount.toString(),
      interest_rate: loan.interest_rate.toString(),
      interest_type: loan.interest_type,
      interest_mode: loan.interest_mode || 'per_installment',
      payment_type: loan.payment_type,
      installments: (loan.installments || 1).toString(),
      contract_date: format(new Date(), 'yyyy-MM-dd'), // New contract date for renegotiation
      start_date: format(new Date(), 'yyyy-MM-dd'),
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
    
    // For renegotiation, generate new installment dates starting from today
    if (isRenegotiation) {
      const numInst = loan.installments || 1;
      const startDate = new Date();
      const newDates: string[] = [];
      for (let i = 0; i < numInst; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);
        newDates.push(format(date, 'yyyy-MM-dd'));
      }
      setEditInstallmentDates(newDates);
    } else {
      setEditInstallmentDates((loan.installment_dates as string[]) || []);
    }
    
    // Calculate and set initial installment value for edit form
    const numInstEdit = loan.installments || 1;
    const principalForInstallment = historicalData ? historicalData.remainingBalance : loan.principal_amount;
    let totalInterestEdit = 0;
    if (loan.interest_mode === 'on_total') {
      totalInterestEdit = principalForInstallment * (loan.interest_rate / 100);
    } else if (loan.interest_mode === 'compound') {
      totalInterestEdit = principalForInstallment * Math.pow(1 + (loan.interest_rate / 100), numInstEdit) - principalForInstallment;
    } else {
      totalInterestEdit = principalForInstallment * (loan.interest_rate / 100) * numInstEdit;
    }
    const totalToReceiveEdit = principalForInstallment + totalInterestEdit;
    setEditInstallmentValue((totalToReceiveEdit / numInstEdit).toFixed(2));
    setIsEditManuallyEditingInstallment(false);
    
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
    
    // Build notes with renegotiation tags if this is a renegotiation
    let finalNotes = cleanNotes;
    if (editIsRenegotiation && editHistoricalData) {
      const renegotiationTags = `[RENEGOTIATED]
[ORIGINAL_PRINCIPAL:${editHistoricalData.originalPrincipal.toFixed(2)}]
[ORIGINAL_RATE:${editHistoricalData.originalRate}]
[ORIGINAL_INSTALLMENTS:${editHistoricalData.originalInstallments}]
[ORIGINAL_INTEREST_MODE:${editHistoricalData.originalInterestMode}]
[ORIGINAL_TOTAL:${editHistoricalData.originalTotal.toFixed(2)}]
[ORIGINAL_TOTAL_INTEREST:${editHistoricalData.originalTotalInterest.toFixed(2)}]
[HISTORICAL_PAID:${editHistoricalData.totalPaid.toFixed(2)}]
[HISTORICAL_INTEREST_PAID:${editHistoricalData.realizedProfit.toFixed(2)}]
[RENEGOTIATION_DATE:${format(new Date(), 'yyyy-MM-dd')}]`;
      
      finalNotes = `${renegotiationTags}\n${cleanNotes}`.trim();
    }
    
    if (overdueConfigNote) {
      finalNotes = `${overdueConfigNote}\n${finalNotes}`.trim();
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
      notes: finalNotes,
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
      let totalInterest: number;
      if (editFormData.interest_mode === 'per_installment') {
        totalInterest = principalAmount * (interestRate / 100) * numInstallments;
      } else if (editFormData.interest_mode === 'compound') {
        totalInterest = principalAmount * Math.pow(1 + (interestRate / 100), numInstallments) - principalAmount;
      } else {
        totalInterest = principalAmount * (interestRate / 100);
      }
      // For renegotiation, reset total_paid to 0 as it's a new contract
      if (editIsRenegotiation) {
        updateData.total_paid = 0;
        updateData.remaining_balance = principalAmount + totalInterest;
      } else {
        const totalPaid = loan.total_paid || 0;
        updateData.remaining_balance = principalAmount + totalInterest - totalPaid;
      }
      updateData.total_interest = totalInterest;
    }
    
    await updateLoan(editingLoanId, {
      ...updateData,
      send_notification: editIsRenegotiation,
      is_renegotiation: editIsRenegotiation,
    });
    
    if (editIsRenegotiation) {
      toast.success('Contrato renegociado com sucesso!');
    }
    
    setIsEditDialogOpen(false);
    setEditingLoanId(null);
    setEditIsRenegotiation(false);
    setEditHistoricalData(null);
  };

  const handleGenerateOperationsReport = async () => {
    try {
      toast.loading('Gerando relatório...', { id: 'generating-report' });
      
      // Get payments for all loans with detailed installment info
      const loansWithPayments: LoanOperationData[] = await Promise.all(
        loans.map(async (loan) => {
          const paymentsResult = await getLoanPayments(loan.id);
          const payments = paymentsResult.data || [];
          const numInstallments = loan.installments || 1;
          
          // Calculate total interest based on interest_mode
          let totalInterest = loan.total_interest || 0;
          const totalToReceive = loan.principal_amount + totalInterest;
          const installmentValue = totalToReceive / numInstallments;
          
          // Check if it's an interest-only payment loan
          const isInterestOnlyLoan = loan.notes?.includes('[INTEREST_ONLY_PAYMENT]');
          
          // Get partial payments from notes for installment tracking
          const partialPayments = getPartialPaymentsFromNotes(loan.notes);
          const installmentDates = (loan.installment_dates as string[]) || [];
          
          // Build installment details
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const installmentDetails: { number: number; dueDate: string; amount: number; status: 'paid' | 'pending' | 'overdue'; paidDate?: string; paidAmount?: number }[] = [];
          let paidInstallments = 0;
          let pendingInstallments = 0;
          let overdueInstallments = 0;
          
          for (let i = 0; i < numInstallments; i++) {
            // Get due date from installment_dates or calculate
            let dueDate = installmentDates[i] || loan.start_date;
            if (!installmentDates[i] && loan.start_date) {
              const startDate = new Date(loan.start_date + 'T12:00:00');
              if (loan.payment_type === 'daily') {
                startDate.setDate(startDate.getDate() + i);
              } else if (loan.payment_type === 'weekly') {
                startDate.setDate(startDate.getDate() + (i * 7));
              } else if (loan.payment_type === 'biweekly') {
                startDate.setDate(startDate.getDate() + (i * 15));
              } else {
                startDate.setMonth(startDate.getMonth() + i);
              }
              dueDate = format(startDate, 'yyyy-MM-dd');
            }
            
            const paidAmount = partialPayments[i] || 0;
            const isPaid = paidAmount >= installmentValue * 0.99;
            const dueDateObj = new Date(dueDate + 'T12:00:00');
            
            let status: 'paid' | 'pending' | 'overdue' = 'pending';
            if (isPaid) {
              status = 'paid';
              paidInstallments++;
            } else if (dueDateObj < today) {
              status = 'overdue';
              overdueInstallments++;
            } else {
              pendingInstallments++;
            }
            
            installmentDetails.push({
              number: i + 1,
              dueDate,
              amount: installmentValue,
              status,
              paidAmount: isPaid ? paidAmount : undefined,
              paidDate: isPaid ? (payments.find(p => Math.abs(p.amount - installmentValue) < 1)?.payment_date || undefined) : undefined,
            });
          }
          
          // Determine overall loan status
          let status = 'pending';
          if (isInterestOnlyLoan) {
            status = 'interest_only';
          } else if (loan.status === 'paid' || (loan.total_paid || 0) >= totalToReceive * 0.99) {
            status = 'paid';
          } else if (overdueInstallments > 0) {
            status = 'overdue';
          }
          
          // Para empréstimos com pagamento "só juros", usar remaining_balance do banco
          // pois o trigger não abate do saldo quando é só juros
          const calculatedRemaining = isInterestOnlyLoan 
            ? (loan.remaining_balance || totalToReceive)  // Usar saldo do banco para só juros
            : (totalToReceive - (loan.total_paid || 0));  // Cálculo normal para outros
          
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
            remainingBalance: calculatedRemaining,
            status: status,
            startDate: loan.start_date,
            dueDate: loan.due_date,
            paymentType: loan.payment_type,
            paidInstallments,
            pendingInstallments,
            overdueInstallments,
            installmentDetails,
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
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Empréstimo </span>Diário
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
                      <Label className="text-xs sm:text-sm">1ª Cobrança *</Label>
                      <Input 
                        type="date" 
                        value={formData.start_date} 
                        onChange={(e) => {
                          const newStartDate = e.target.value;
                          setFormData({ ...formData, start_date: newStartDate });
                          // Auto-generate dates when start_date changes and we have installments count
                          if (newStartDate && formData.daily_period && parseInt(formData.daily_period) > 0) {
                            const newDates = generateDailyDates(newStartDate, parseInt(formData.daily_period), skipSaturday, skipSunday);
                            setInstallmentDates(newDates);
                            if (newDates.length > 0) {
                              setFormData(prev => ({
                                ...prev,
                                start_date: newStartDate,
                                due_date: newDates[newDates.length - 1],
                                installments: newDates.length.toString()
                              }));
                            }
                          }
                        }} 
                        className="h-9 sm:h-10 text-sm" 
                      />
                      <p className="text-[10px] text-muted-foreground">Quando começa</p>
                    </div>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Nº de Parcelas *</Label>
                    <Input 
                      type="number" 
                      min="1"
                      max="365"
                      value={formData.daily_period || ''} 
                      onChange={(e) => {
                        const count = e.target.value;
                        setFormData({ ...formData, daily_period: count, installments: count });
                        // Auto-generate dates when count changes and we have start_date
                        if (formData.start_date && count && parseInt(count) > 0) {
                          const newDates = generateDailyDates(formData.start_date, parseInt(count), skipSaturday, skipSunday);
                          setInstallmentDates(newDates);
                          if (newDates.length > 0) {
                            setFormData(prev => ({
                              ...prev,
                              daily_period: count,
                              installments: count,
                              due_date: newDates[newDates.length - 1]
                            }));
                          }
                        } else {
                          setInstallmentDates([]);
                        }
                      }} 
                      placeholder="Ex: 20, 25, 30..."
                      className="h-9 sm:h-10 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Quantas parcelas diárias</p>
                  </div>
                  
                  {/* Opções de pular dias */}
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <Label className="text-xs text-muted-foreground">Não cobra nos seguintes dias:</Label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipSaturday}
                          onChange={(e) => setSkipSaturday(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-sm">Sábado</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipSunday}
                          onChange={(e) => setSkipSunday(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-sm">Domingo</span>
                      </label>
                    </div>
                    {(skipSaturday || skipSunday) && (
                      <p className="text-xs text-amber-500">
                        ⚠️ {skipSaturday && skipSunday ? 'Sábados e domingos' : skipSaturday ? 'Sábados' : 'Domingos'} serão pulados na geração das datas
                      </p>
                    )}
                  </div>
                  {installmentDates.length > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-2 sm:p-3 border border-emerald-200 dark:border-emerald-700">
                      <p className="text-xs sm:text-sm font-medium text-emerald-900 dark:text-emerald-100 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        {installmentDates.length} parcelas geradas
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {formatDate(installmentDates[0])} até {formatDate(installmentDates[installmentDates.length - 1])}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Calendário (visualização)</Label>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Datas geradas automaticamente - clique para ajustar se necessário</p>
                    <div className="border rounded-md p-2 sm:p-3 bg-background text-foreground">
                      <Calendar
                        mode="multiple"
                        selected={installmentDates.map(d => new Date(d + 'T12:00:00'))}
                        onSelect={(dates) => {
                          if (dates) {
                            const sortedDates = dates.map(d => format(d, 'yyyy-MM-dd')).sort();
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
                        <div className="p-3 rounded bg-yellow-500/10 border border-yellow-400/30 mt-2">
                          <div className="flex justify-between items-center mb-2">
                            <Label className="text-sm text-yellow-200">Selecione as parcelas já recebidas:</Label>
                            <div className="flex gap-2">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-xs text-yellow-300"
                                onClick={() => setSelectedPastInstallments((pastInstallmentsData.pastInstallmentsList || []).map(i => i.index))}
                              >
                                Todas
                              </Button>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-xs text-yellow-300"
                                onClick={() => setSelectedPastInstallments([])}
                              >
                                Nenhuma
                              </Button>
                            </div>
                          </div>
                          
                          <ScrollArea className="h-32">
                            <div className="space-y-1">
                              {pastInstallmentsData.pastInstallmentsList.map((installment) => (
                                <label 
                                  key={installment.index} 
                                  className="flex items-center gap-2 p-2 rounded hover:bg-yellow-500/10 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={selectedPastInstallments.includes(installment.index)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedPastInstallments(prev => [...prev, installment.index]);
                                      } else {
                                        setSelectedPastInstallments(prev => prev.filter(i => i !== installment.index));
                                      }
                                    }}
                                    className="border-yellow-400 data-[state=checked]:bg-yellow-500"
                                  />
                                  <span className="text-sm text-yellow-300">
                                    Parcela {installment.index + 1} - {formatDate(installment.date)} - {formatCurrency(installment.value)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </ScrollArea>
                          
                          <div className="mt-2 pt-2 border-t border-yellow-400/20">
                            <p className="text-xs text-green-300">
                              ✓ {selectedPastInstallments.length} parcela(s) selecionada(s) = {formatCurrency(selectedPastInstallments.length * (pastInstallmentsData.valuePerInstallment || 0))}
                            </p>
                          </div>
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
                      <Select value={formData.interest_mode} onValueChange={(v: 'per_installment' | 'on_total' | 'compound') => setFormData({ ...formData, interest_mode: v })}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[10001]">
                          <SelectItem value="per_installment" className="text-xs sm:text-sm">Por Parcela</SelectItem>
                          <SelectItem value="on_total" className="text-xs sm:text-sm">Sobre o Total</SelectItem>
                          <SelectItem value="compound" className="text-xs sm:text-sm">Juros Compostos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:space-y-2 tutorial-form-payment-type">
                      <Label className="text-xs sm:text-sm">Modalidade</Label>
                      <Select value={formData.payment_type} onValueChange={(v: LoanPaymentType) => setFormData({ ...formData, payment_type: v, installments: v === 'single' ? '1' : formData.installments })}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[10001]">
                        <SelectItem value="single" className="text-xs sm:text-sm">Pagamento Único</SelectItem>
                          <SelectItem value="installment" className="text-xs sm:text-sm">Parcelado</SelectItem>
                          <SelectItem value="biweekly" className="text-xs sm:text-sm">Quinzenal</SelectItem>
                          <SelectItem value="weekly" className="text-xs sm:text-sm">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {(formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly') && (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Nº de {formData.payment_type === 'weekly' ? 'Semanas' : formData.payment_type === 'biweekly' ? 'Quinzenas' : 'Parcelas'} *</Label>
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
                        <Label className="text-xs sm:text-sm">Valor da {formData.payment_type === 'weekly' ? 'Semana' : formData.payment_type === 'biweekly' ? 'Quinzena' : 'Parcela'} (R$)</Label>
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
                    
                    {/* Aviso visual quando o usuário arredonda manualmente o valor da parcela */}
                    {isManuallyEditingInstallment && installmentValue && formData.principal_amount && formData.installments && (() => {
                      const principal = parseFloat(formData.principal_amount);
                      const numInstallments = parseInt(formData.installments) || 1;
                      const rate = parseFloat(formData.interest_rate) || 0;
                      let calculatedInterest = 0;
                      if (formData.interest_mode === 'per_installment') {
                        calculatedInterest = principal * (rate / 100) * numInstallments;
                      } else if (formData.interest_mode === 'compound') {
                        calculatedInterest = principal * Math.pow(1 + (rate / 100), numInstallments) - principal;
                      } else {
                        calculatedInterest = principal * (rate / 100);
                      }
                      const calculatedInstallmentValue = (principal + calculatedInterest) / numInstallments;
                      const currentInstallmentValue = parseFloat(installmentValue);
                      const difference = Math.abs(currentInstallmentValue - calculatedInstallmentValue);
                      
                      // Mostrar aviso se a diferença for maior que R$ 0,01
                      if (difference > 0.01) {
                        return (
                          <div className="bg-amber-500/20 border border-amber-400/50 rounded-lg p-3 text-sm">
                            <p className="font-medium text-amber-300 flex items-center gap-2">
                              ⚠️ Valor da parcela ajustado manualmente
                            </p>
                            <div className="mt-1 text-xs text-amber-400/80 space-y-0.5">
                              <p>Valor calculado: {formatCurrency(calculatedInstallmentValue)}</p>
                              <p>Valor informado: {formatCurrency(currentInstallmentValue)}</p>
                            </div>
                            <p className="text-[10px] mt-2 text-amber-400/60">
                              A taxa de juros será ajustada para refletir este arredondamento. O sistema usará o valor da parcela informado em todos os cálculos.
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
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
                {(formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly') && installmentDates.length > 0 && (
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Vencimento das {formData.payment_type === 'weekly' ? 'Semanas' : formData.payment_type === 'biweekly' ? 'Quinzenas' : 'Parcelas'}</Label>
                    <ScrollArea className="h-[120px] sm:h-[150px] rounded-md border p-2 sm:p-3">
                      <div className="space-y-1.5 sm:space-y-2">
                        {installmentDates.map((date, index) => (
                          <div key={index} className="flex items-center gap-2 sm:gap-3">
                            <span className="text-xs sm:text-sm font-medium w-16 sm:w-20">{formData.payment_type === 'weekly' ? 'Sem.' : formData.payment_type === 'biweekly' ? 'Quinz.' : 'Parc.'} {index + 1}</span>
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
                      <div className="p-3 rounded bg-yellow-500/10 border border-yellow-400/30 mt-2">
                        <div className="flex justify-between items-center mb-2">
                          <Label className="text-sm text-yellow-200">Selecione as parcelas já recebidas:</Label>
                          <div className="flex gap-2">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs text-yellow-300"
                              onClick={() => setSelectedPastInstallments((pastInstallmentsData.pastInstallmentsList || []).map(i => i.index))}
                            >
                              Todas
                            </Button>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs text-yellow-300"
                              onClick={() => setSelectedPastInstallments([])}
                            >
                              Nenhuma
                            </Button>
                          </div>
                        </div>
                        
                        <ScrollArea className="h-32">
                          <div className="space-y-1">
                            {pastInstallmentsData.pastInstallmentsList.map((installment) => (
                              <label 
                                key={installment.index} 
                                className="flex items-center gap-2 p-2 rounded hover:bg-yellow-500/10 cursor-pointer"
                              >
                                <Checkbox
                                  checked={selectedPastInstallments.includes(installment.index)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedPastInstallments(prev => [...prev, installment.index]);
                                    } else {
                                      setSelectedPastInstallments(prev => prev.filter(i => i !== installment.index));
                                    }
                                  }}
                                  className="border-yellow-400 data-[state=checked]:bg-yellow-500"
                                />
                                <span className="text-sm text-yellow-300">
                                  Parcela {installment.index + 1} - {formatDate(installment.date)} - {formatCurrency(installment.value)}
                                </span>
                              </label>
                            ))}
                          </div>
                        </ScrollArea>
                        
                        <div className="mt-2 pt-2 border-t border-yellow-400/20">
                          <p className="text-xs text-green-300">
                            ✓ {selectedPastInstallments.length} parcela(s) selecionada(s) = {formatCurrency(selectedPastInstallments.length * (pastInstallmentsData.valuePerInstallment || 0))}
                          </p>
                        </div>
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

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'regular' | 'daily'); setStatusFilter('all'); }} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="regular" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Empréstimos ({regularLoansCount})
            </TabsTrigger>
            <TabsTrigger value="daily" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <Clock className="w-4 h-4" />
              Diário ({dailyLoansCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regular" className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative tutorial-search flex-1">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm" />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="tutorial-new-loan gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10">
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Novo Empréstimo
                  </Button>
                </DialogTrigger>
              </Dialog>
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
                    variant={statusFilter === 'biweekly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('biweekly')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'biweekly' ? 'bg-teal-500' : 'border-teal-500 text-teal-600 hover:bg-teal-500/10'}`}
                  >
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    <span className="hidden xs:inline">Quinzenal</span><span className="xs:hidden">Quin.</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos com cobrança quinzenal (a cada 15 dias)</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'installment' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('installment')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'installment' ? 'bg-emerald-500' : 'border-emerald-500 text-emerald-600 hover:bg-emerald-500/10'}`}
                  >
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    <span className="hidden xs:inline">Mensal</span><span className="xs:hidden">Mens.</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos com cobrança mensal parcelada</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={statusFilter === 'single' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('single')}
                    className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'single' ? 'bg-gray-500' : 'border-gray-500 text-gray-600 hover:bg-gray-500/10'}`}
                  >
                    <DollarSign className="w-3 h-3 mr-1" />
                    <span className="hidden xs:inline">Única</span><span className="xs:hidden">Ún.</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Empréstimos com pagamento em parcela única</p>
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
                const isBiweekly = loan.payment_type === 'biweekly';
                const numInstallments = loan.installments || 1;
                
                // For daily loans: 
                // - principal_amount = valor emprestado
                // - total_interest = valor da parcela diária
                // - interest_rate = lucro total
                // - remaining_balance = total a receber (decreases with payments)
                const dailyInstallmentAmount = isDaily ? (loan.total_interest || 0) : 0;
                const dailyTotalToReceive = isDaily ? dailyInstallmentAmount * numInstallments : 0;
                // Lucro diário = total a receber - valor emprestado
                const dailyProfit = isDaily ? (dailyTotalToReceive - loan.principal_amount) : 0;
                
                // For regular loans - use stored total_interest (respects rounded installment values)
                const principalPerInstallment = loan.principal_amount / numInstallments;
                const storedTotalInterest = loan.total_interest || 0;
                
                // Calculate total interest based on interest_mode (only for comparison/fallback)
                let calculatedTotalInterest = 0;
                if (!isDaily) {
                  if (loan.interest_mode === 'on_total') {
                    calculatedTotalInterest = loan.principal_amount * (loan.interest_rate / 100);
                  } else if (loan.interest_mode === 'compound') {
                    // Juros compostos: M = P(1+i)^n - P
                    calculatedTotalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
                  } else {
                    // per_installment
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
                } else {
                  // SEMPRE usar remaining_balance do banco como fonte de verdade
                  // (funciona para diários e não-diários)
                  remainingToReceive = Math.max(0, loan.remaining_balance);
                }
                
                const initials = loan.client?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                
                // Check if overdue penalty was applied (stored interest is higher than calculated)
                const hasAppliedOverduePenalty = !isDaily && storedTotalInterest > calculatedTotalInterest;
                
                const isPaid = loan.status === 'paid' || remainingToReceive <= 0;
                const isRenegotiated = (loan.notes?.includes('Valor prometido') || loan.notes?.includes('[RENEGOTIATED]')) && !isInterestOnlyPayment;
                const isHistoricalContract = loan.notes?.includes('[HISTORICAL_CONTRACT]');
                
                // Parse renegotiation historical data from notes
                const renegotiatedHistorical = loan.notes?.includes('[RENEGOTIATED]') ? (() => {
                  const origPrincipal = loan.notes?.match(/\[ORIGINAL_PRINCIPAL:([0-9.]+)\]/);
                  const origRate = loan.notes?.match(/\[ORIGINAL_RATE:([0-9.]+)\]/);
                  const origInstallments = loan.notes?.match(/\[ORIGINAL_INSTALLMENTS:(\d+)\]/);
                  const origInterestMode = loan.notes?.match(/\[ORIGINAL_INTEREST_MODE:([^\]]+)\]/);
                  const origTotal = loan.notes?.match(/\[ORIGINAL_TOTAL:([0-9.]+)\]/);
                  const origTotalInterest = loan.notes?.match(/\[ORIGINAL_TOTAL_INTEREST:([0-9.]+)\]/);
                  const histPaid = loan.notes?.match(/\[HISTORICAL_PAID:([0-9.]+)\]/);
                  const histInterestPaid = loan.notes?.match(/\[HISTORICAL_INTEREST_PAID:([0-9.]+)\]/);
                  const renegDate = loan.notes?.match(/\[RENEGOTIATION_DATE:([^\]]+)\]/);
                  
                  if (origPrincipal && histPaid) {
                    return {
                      originalPrincipal: parseFloat(origPrincipal[1]),
                      originalRate: origRate ? parseFloat(origRate[1]) : 0,
                      originalInstallments: origInstallments ? parseInt(origInstallments[1]) : 1,
                      originalInterestMode: origInterestMode ? origInterestMode[1] : 'per_installment',
                      originalTotal: origTotal ? parseFloat(origTotal[1]) : 0,
                      originalTotalInterest: origTotalInterest ? parseFloat(origTotalInterest[1]) : 0,
                      historicalPaid: parseFloat(histPaid[1]),
                      historicalInterestPaid: histInterestPaid ? parseFloat(histInterestPaid[1]) : 0,
                      renegotiationDate: renegDate ? renegDate[1] : null,
                    };
                  }
                  return null;
                })() : null;
                
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
                    // For historical contracts, check if next unpaid installment is in the past
                    if (dates.length > 0 && paidInstallments < dates.length) {
                      const nextUnpaidDate = new Date(dates[paidInstallments] + 'T12:00:00');
                      nextUnpaidDate.setHours(0, 0, 0, 0);
                      // If the next unpaid installment is in the past, it's overdue
                      // Considerar em atraso apenas APÓS a data passar (>)
                      isOverdue = today > nextUnpaidDate;
                    } else if (dates.length === 0) {
                      // No dates, use due_date
                      const dueDate = new Date(loan.due_date + 'T12:00:00');
                      dueDate.setHours(0, 0, 0, 0);
                      isOverdue = today > dueDate;
                    }
                    // If all installments paid, isOverdue stays false
                  } else {
                    // Normal logic for non-historical contracts
                    if (dates.length > 0 && paidInstallments < dates.length) {
                      const nextDueDate = new Date(dates[paidInstallments] + 'T12:00:00');
                      // Considerar em atraso apenas APÓS a data passar (>)
                      nextDueDate.setHours(0, 0, 0, 0);
                      isOverdue = today > nextDueDate;
                    } else {
                      const dueDate = new Date(loan.due_date + 'T12:00:00');
                      dueDate.setHours(0, 0, 0, 0);
                      // Considerar em atraso apenas APÓS a data passar (>)
                      isOverdue = today > dueDate;
                    }
                  }
                }
                
                // Calculate if due today (not overdue yet, but due date is today)
                let isDueToday = false;
                let dueTodayDate = '';
                if (!isPaid && !isOverdue && remainingToReceive > 0) {
                  const paidInstallmentsForDueToday = getPaidInstallmentsCount(loan);
                  const datesForDueToday = (loan.installment_dates as string[]) || [];
                  
                  if (datesForDueToday.length > 0 && paidInstallmentsForDueToday < datesForDueToday.length) {
                    const nextDueDateForToday = new Date(datesForDueToday[paidInstallmentsForDueToday] + 'T12:00:00');
                    nextDueDateForToday.setHours(0, 0, 0, 0);
                    isDueToday = today.getTime() === nextDueDateForToday.getTime();
                    if (isDueToday) {
                      dueTodayDate = datesForDueToday[paidInstallmentsForDueToday];
                    }
                  } else {
                    const dueDateForToday = new Date(loan.due_date + 'T12:00:00');
                    dueDateForToday.setHours(0, 0, 0, 0);
                    isDueToday = today.getTime() === dueDateForToday.getTime();
                    if (isDueToday) {
                      dueTodayDate = loan.due_date;
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
                const overdueDateObj = new Date(overdueDate + 'T12:00:00');
                overdueDateObj.setHours(0, 0, 0, 0);
                const daysOverdue = today > overdueDateObj ? Math.ceil((today.getTime() - overdueDateObj.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                
                // Calculate dynamic penalty based on config (fixed amount per day)
                let dynamicPenaltyAmount = 0;
                if (isOverdue && daysOverdue > 0 && hasOverdueConfig) {
                  // Fixed amount per day (e.g., R$ 50/day × 4 days = R$ 200)
                  dynamicPenaltyAmount = overdueConfigValue * daysOverdue;
                }
                
                const isCompound = loan.interest_mode === 'compound';
                const hasDueTodayStyle = isDueToday && !isOverdue;
                const hasSpecialStyle = isPaid || isOverdue || isRenegotiated || isInterestOnlyPayment || isWeekly || isBiweekly || isDaily || isCompound || hasDueTodayStyle;
                
                const getCardStyle = () => {
                  if (isPaid) {
                    return 'bg-primary border-primary';
                  }
                  if (isInterestOnlyPayment && !isOverdue) {
                    return 'bg-purple-500/20 border-purple-400 dark:bg-purple-500/30 dark:border-purple-400';
                  }
                  if (isRenegotiated && !isOverdue) {
                    return 'bg-pink-500/20 border-pink-400 dark:bg-pink-500/30 dark:border-pink-400';
                  }
                  // Diário em atraso: gradiente vermelho→azul para manter identidade
                  if (isDaily && isOverdue) {
                    return 'bg-gradient-to-r from-red-500/30 to-blue-500/30 border-red-400 dark:from-red-500/40 dark:to-blue-500/40';
                  }
                  // Semanal em atraso: gradiente vermelho→laranja
                  if (isWeekly && isOverdue) {
                    return 'bg-gradient-to-r from-red-500/30 to-orange-500/30 border-red-400 dark:from-red-500/40 dark:to-orange-500/40';
                  }
                  // Quinzenal em atraso: gradiente vermelho→ciano
                  if (isBiweekly && isOverdue) {
                    return 'bg-gradient-to-r from-red-500/30 to-cyan-500/30 border-red-400 dark:from-red-500/40 dark:to-cyan-500/40';
                  }
                  if (isOverdue) {
                    return 'bg-red-500/20 border-red-400 dark:bg-red-500/30 dark:border-red-400';
                  }
                  // Diário + Vence hoje: gradiente azul→amarelo
                  if (isDaily && hasDueTodayStyle) {
                    return 'bg-gradient-to-r from-blue-500/30 to-amber-500/30 border-amber-400 dark:from-blue-500/40 dark:to-amber-500/40';
                  }
                  // Semanal + Vence hoje: gradiente laranja→amarelo
                  if (isWeekly && hasDueTodayStyle) {
                    return 'bg-gradient-to-r from-orange-500/30 to-amber-500/30 border-amber-400 dark:from-orange-500/40 dark:to-amber-500/40';
                  }
                  // Quinzenal + Vence hoje: gradiente ciano→amarelo
                  if (isBiweekly && hasDueTodayStyle) {
                    return 'bg-gradient-to-r from-cyan-500/30 to-amber-500/30 border-amber-400 dark:from-cyan-500/40 dark:to-amber-500/40';
                  }
                  // Vence hoje: amarelo/âmbar
                  if (hasDueTodayStyle) {
                    return 'bg-amber-500/20 border-amber-400 dark:bg-amber-500/30 dark:border-amber-400';
                  }
                  if (isCompound && !isPaid) {
                    return 'bg-cyan-500/20 border-cyan-400 dark:bg-cyan-500/30 dark:border-cyan-400';
                  }
                  if (isWeekly) {
                    return 'bg-orange-500/20 border-orange-400 dark:bg-orange-500/30 dark:border-orange-400';
                  }
                  if (isBiweekly) {
                    return 'bg-cyan-500/20 border-cyan-400 dark:bg-cyan-500/30 dark:border-cyan-400';
                  }
                  if (isDaily) {
                    return 'bg-blue-500/20 border-blue-400 dark:bg-blue-500/30 dark:border-blue-400';
                  }
                  return 'bg-card';
                };
                
                const textColor = isPaid ? 'text-white' : isInterestOnlyPayment ? 'text-purple-300' : isRenegotiated ? 'text-pink-300' : isOverdue ? 'text-red-300' : hasDueTodayStyle ? 'text-amber-300' : isCompound ? 'text-cyan-300' : isBiweekly ? 'text-cyan-300' : '';
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
                              <Button 
                                variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                size="sm" 
                                className={`h-6 text-[9px] sm:text-[10px] px-1.5 sm:px-2 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                onClick={() => setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)}
                              >
                                {expandedLoanId === loan.id ? (
                                  <ChevronUp className="w-3 h-3 sm:mr-1" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 sm:mr-1" />
                                )}
                                <span className="hidden sm:inline">Detalhes</span>
                              </Button>
                              <Badge className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 ${hasSpecialStyle ? 'bg-white/20 text-white border-white/30' : getPaymentStatusColor(loan.status)}`}>
                                {isInterestOnlyPayment && !isOverdue ? 'Só Juros' : isRenegotiated && !isOverdue ? 'Reneg.' : getPaymentStatusLabel(loan.status)}
                              </Badge>
                              {loan.interest_mode === 'compound' && (
                                <Badge className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 bg-purple-500/20 text-purple-300 border-purple-500/30">
                                  J. Compostos
                                </Badge>
                              )}
                              {isDaily && (
                                <Badge className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 bg-blue-500/30 text-blue-300 border-blue-500/50 font-bold">
                                  📅 DIÁRIO
                                </Badge>
                              )}
                              {isWeekly && (
                                <Badge className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 bg-orange-500/30 text-orange-300 border-orange-500/50 font-bold">
                                  📅 SEMANAL
                                </Badge>
                              )}
                              {isBiweekly && (
                                <Badge className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 bg-cyan-500/30 text-cyan-300 border-cyan-500/50 font-bold">
                                  📅 QUINZENAL
                                </Badge>
                              )}
                              {loan.payment_type === 'installment' && (
                                <Badge className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 bg-emerald-500/30 text-emerald-300 border-emerald-500/50 font-bold">
                                  📅 MENSAL
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className={`text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1 ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>{formatCurrency(remainingToReceive)}</p>
                          <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>restante a receber</p>
                        </div>
                      </div>
                      
                      {/* Seção de Valores */}
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
                      
                      {/* Seção de Histórico do Contrato Anterior (para renegociações) */}
                      {renegotiatedHistorical && (
                        <div className="mt-2 p-2 sm:p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                          <p className="text-[10px] sm:text-xs font-medium text-yellow-400 mb-2 flex items-center gap-1">
                            📜 Contrato Anterior
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                            <div>
                              <p className="text-muted-foreground">Emprestado:</p>
                              <p className="font-semibold">{formatCurrency(renegotiatedHistorical.originalPrincipal)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Taxa:</p>
                              <p className="font-semibold">{renegotiatedHistorical.originalRate}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Previsto:</p>
                              <p className="font-semibold">{formatCurrency(renegotiatedHistorical.originalTotal)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Parcelas:</p>
                              <p className="font-semibold">{renegotiatedHistorical.originalInstallments}x</p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-yellow-500/30 space-y-1">
                            <div className="flex justify-between text-[10px] sm:text-xs">
                              <span className="text-muted-foreground">Total recebido:</span>
                              <span className="font-semibold text-green-400">{formatCurrency(renegotiatedHistorical.historicalPaid)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] sm:text-xs">
                              <span className="text-muted-foreground">Lucro realizado:</span>
                              <span className="font-semibold text-green-400">{formatCurrency(renegotiatedHistorical.historicalInterestPaid)} ✅</span>
                            </div>
                            {renegotiatedHistorical.renegotiationDate && (
                              <div className="flex justify-between text-[10px] sm:text-xs">
                                <span className="text-muted-foreground">Renegociado em:</span>
                                <span className="font-semibold text-yellow-400">{formatDate(renegotiatedHistorical.renegotiationDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Seção de Lucro - Previsto e Realizado */}
                      {(() => {
                        // Lucro previsto = total de juros do contrato
                        const expectedProfit = isDaily ? dailyProfit : effectiveTotalInterest;
                        
                        // Lucro realizado = soma dos interest_paid de todos os pagamentos
                        // Fonte de verdade: loan_payments.interest_paid registrado em cada pagamento
                        const payments = (loan as any).loan_payments || [];
                        let realizedProfit = payments.reduce((sum: number, p: any) => 
                          sum + Number(p.interest_paid || 0), 0);
                        
                        // Porcentagem do lucro realizado
                        const profitPercentage = expectedProfit > 0 
                          ? Math.round((realizedProfit / expectedProfit) * 100) 
                          : 0;
                        
                        return (
                          <div className={`grid grid-cols-2 gap-2 sm:gap-3 mt-2 p-2 sm:p-3 rounded-lg ${hasSpecialStyle ? 'bg-white/10' : 'bg-primary/5 border border-primary/20'}`}>
                            <div>
                              <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>Lucro Previsto</p>
                              <p className={`font-semibold text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>
                                {formatCurrency(expectedProfit)}
                              </p>
                            </div>
                            <div>
                              <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>Lucro Realizado</p>
                              <div className="flex items-center gap-1.5">
                                <p className={`font-semibold text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : 'text-emerald-500'}`}>
                                  {formatCurrency(realizedProfit)}
                                </p>
                                {expectedProfit > 0 && (
                                  <span className={`text-[9px] sm:text-[10px] px-1 py-0.5 rounded ${
                                    hasSpecialStyle 
                                      ? 'bg-white/20 text-white' 
                                      : profitPercentage >= 100 
                                        ? 'bg-emerald-500/20 text-emerald-500' 
                                        : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {profitPercentage}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      
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
                          {/* Manual overdue notification button */}
                          {profile?.whatsapp_to_clients_enabled && loan.client?.phone && (
                            <SendOverdueNotification
                              data={{
                                clientName: loan.client?.full_name || 'Cliente',
                                clientPhone: loan.client.phone,
                                contractType: 'loan',
                                installmentNumber: (() => {
                                  const dates = (loan.installment_dates as string[]) || [];
                                  const paidCount = getPaidInstallmentsCount(loan);
                                  return paidCount + 1;
                                })(),
                                totalInstallments: loan.installments || 1,
                                amount: totalPerInstallment,
                                dueDate: overdueDate,
                                daysOverdue: daysOverdue,
                                loanId: loan.id,
                              }}
                              className="w-full mt-2"
                            />
                          )}
                        </div>
                      )}
                      
                      {/* Due Today Section - Vence Hoje */}
                      {isDueToday && !isOverdue && (
                        <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg bg-amber-500/20 border border-amber-400/30">
                          <div className="text-xs sm:text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-amber-300 font-medium flex items-center gap-2">
                                <Bell className="w-4 h-4" />
                                Vence Hoje!
                              </span>
                              <span className="text-amber-200 font-bold">{formatCurrency(totalPerInstallment)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-amber-300/70">
                              <span>Parcela {getPaidInstallmentsCount(loan) + 1}/{loan.installments || 1}</span>
                              <span>Vencimento: {formatDate(dueTodayDate)}</span>
                            </div>
                            <p className="text-[10px] text-amber-300/60 mt-2">
                              Lembre o cliente para evitar atrasos
                            </p>
                            {/* Manual due today notification button */}
                            {profile?.whatsapp_to_clients_enabled && loan.client?.phone && (
                              <SendDueTodayNotification
                                data={{
                                  clientName: loan.client?.full_name || 'Cliente',
                                  clientPhone: loan.client.phone,
                                  contractType: 'loan',
                                  installmentNumber: getPaidInstallmentsCount(loan) + 1,
                                  totalInstallments: loan.installments || 1,
                                  amount: totalPerInstallment,
                                  dueDate: dueTodayDate,
                                  loanId: loan.id,
                                }}
                                className="w-full mt-2"
                              />
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Early Notification - Contrato normal (não vencido ainda) */}
                      {!isPaid && !isOverdue && !isDueToday && profile?.whatsapp_to_clients_enabled && loan.client?.phone && (
                        (() => {
                          const paidCount = getPaidInstallmentsCount(loan);
                          const dates = (loan.installment_dates as string[]) || [];
                          const nextDueDate = dates[paidCount] || loan.due_date;
                          const nextDueDateObj = new Date(nextDueDate + 'T12:00:00');
                          nextDueDateObj.setHours(0, 0, 0, 0);
                          const todayForEarly = new Date();
                          todayForEarly.setHours(0, 0, 0, 0);
                          const daysUntilDue = Math.ceil((nextDueDateObj.getTime() - todayForEarly.getTime()) / (1000 * 60 * 60 * 24));
                          
                          return (
                            <div className="mt-2 sm:mt-3">
                              <SendEarlyNotification
                                data={{
                                  clientName: loan.client?.full_name || 'Cliente',
                                  clientPhone: loan.client.phone,
                                  contractType: 'loan',
                                  installmentNumber: paidCount + 1,
                                  totalInstallments: loan.installments || 1,
                                  amount: totalPerInstallment,
                                  dueDate: nextDueDate,
                                  daysUntilDue: daysUntilDue,
                                  loanId: loan.id,
                                }}
                                className="w-full"
                              />
                            </div>
                          );
                        })()
                      )}
                      
                      {/* Advance subparcelas (sub-parcelas de adiantamento) */}
                      {(() => {
                        const advanceSubparcelas = getAdvanceSubparcelasFromNotes(loan.notes);
                        if (advanceSubparcelas.length === 0) return null;
                        
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        return (
                          <div className="mt-2 sm:mt-3 space-y-2">
                            {advanceSubparcelas.map((subparcela, idx) => {
                              const subDueDate = new Date(subparcela.dueDate + 'T12:00:00');
                              subDueDate.setHours(0, 0, 0, 0);
                              const isSubOverdue = today > subDueDate;
                              const subDaysOverdue = isSubOverdue 
                                ? Math.ceil((today.getTime() - subDueDate.getTime()) / (1000 * 60 * 60 * 24))
                                : 0;
                              
                              return (
                                <div 
                                  key={idx} 
                                  className={`p-2 sm:p-3 rounded-lg ${
                                    isSubOverdue 
                                      ? 'bg-amber-500/20 border border-amber-400/30' 
                                      : 'bg-blue-500/20 border border-blue-400/30'
                                  }`}
                                >
                                  <div className="text-xs sm:text-sm">
                                    <div className="flex items-center justify-between">
                                      <span className={`font-medium ${isSubOverdue ? 'text-amber-300' : 'text-blue-300'}`}>
                                        Sub-parcela (Adiantamento P{subparcela.originalIndex + 1})
                                      </span>
                                      {isSubOverdue && (
                                        <span className="text-amber-200 font-bold">{subDaysOverdue} dias</span>
                                      )}
                                    </div>
                                    <div className={`flex items-center justify-between mt-1 ${isSubOverdue ? 'text-amber-300/70' : 'text-blue-300/70'}`}>
                                      <span>Vencimento: {formatDate(subparcela.dueDate)}</span>
                                      <span className="font-bold">{formatCurrency(subparcela.amount)}</span>
                                    </div>
                                    <p className={`text-[10px] mt-1 ${isSubOverdue ? 'text-amber-300/60' : 'text-blue-300/60'}`}>
                                      {isSubOverdue ? 'Valor restante do adiantamento em atraso' : 'Valor restante do adiantamento pendente'}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      
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
                                      defaultNextDueDate = format(currentInstallmentDate, 'yyyy-MM-dd');
                                    } else if (loan.due_date) {
                                      const dueDate = new Date(loan.due_date + 'T12:00:00');
                                      dueDate.setMonth(dueDate.getMonth() + 1);
                                      defaultNextDueDate = format(dueDate, 'yyyy-MM-dd');
                                    }
                                    
                                    setPaymentData({ 
                                      amount: '', 
                                      payment_date: format(new Date(), 'yyyy-MM-dd'),
                                      new_due_date: defaultNextDueDate,
                                      payment_type: 'partial', 
                                      selected_installments: [], 
                                      partial_installment_index: null, 
                                      send_notification: false,
                                      is_advance_payment: false 
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
                            {/* Botão de adicionar parcelas extras - apenas para empréstimos diários ativos */}
                            {isDaily && !isPaid && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                    size="icon" 
                                    className={`h-7 w-7 sm:h-8 sm:w-8 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : 'border-sky-500 text-sky-500 hover:bg-sky-500/10'}`}
                                    onClick={() => {
                                      setExtraInstallmentsLoan(loan);
                                      setIsExtraInstallmentsOpen(true);
                                    }}
                                  >
                                    <ListPlus className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Adicionar parcelas extras (cliente atrasou)</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
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
                      
                      {/* Área Expandida com Informações Detalhadas */}
                      {expandedLoanId === loan.id && (() => {
                        const dates = (loan.installment_dates as string[]) || [];
                        const partialPayments = getPartialPaymentsFromNotes(loan.notes);
                        const advanceSubparcelas = getAdvanceSubparcelasFromNotes(loan.notes);
                        const paidAdvanceSubparcelas = getPaidAdvanceSubparcelasFromNotes(loan.notes);
                        
                        // Contar parcelas pagas
                        let paidInstallmentsCount = 0;
                        for (let i = 0; i < numInstallments; i++) {
                          const paidAmount = partialPayments[i] || 0;
                          const pendingSubs = advanceSubparcelas.filter(s => s.originalIndex === i);
                          if (paidAmount >= totalPerInstallment * 0.99 && pendingSubs.length === 0) {
                            paidInstallmentsCount++;
                          }
                        }
                        
                        const progressPercentage = numInstallments > 0 ? Math.round((paidInstallmentsCount / numInstallments) * 100) : 0;
                        
                        // Limpar notas de tags internas
                        const cleanNotes = (notes: string | null) => {
                          if (!notes) return null;
                          return notes
                            .replace(/\[HISTORICAL_CONTRACT\]/g, '')
                            .replace(/\[RENEGOTIATED\]/g, '')
                            .replace(/\[INTEREST_ONLY_PAYMENT\]/g, '')
                            .replace(/\[PARTIAL_PAID:\d+:[0-9.]+\]/g, '')
                            .replace(/\[ADVANCE_SUBPARCELA:\d+:[0-9.]+:[^\]]+\]/g, '')
                            .replace(/\[ADVANCE_SUBPARCELA_PAID:\d+:[0-9.]+:[^\]]+\]/g, '')
                            .replace(/\[RENEWAL_FEE_INSTALLMENT:\d+:[0-9.]+(?::[0-9.]+)?\]/g, '')
                            .replace(/\[ORIGINAL_PRINCIPAL:[0-9.]+\]/g, '')
                            .replace(/\[ORIGINAL_RATE:[0-9.]+\]/g, '')
                            .replace(/\[ORIGINAL_INSTALLMENTS:\d+\]/g, '')
                            .replace(/\[ORIGINAL_INTEREST_MODE:[^\]]+\]/g, '')
                            .replace(/\[ORIGINAL_TOTAL_INTEREST:[0-9.]+\]/g, '')
                            .replace(/\[HISTORICAL_PAID:[0-9.]+\]/g, '')
                            .replace(/\[HISTORICAL_INTEREST_PAID:[0-9.]+\]/g, '')
                            .replace(/\[RENEGOTIATION_DATE:[^\]]+\]/g, '')
                            .trim();
                        };
                        
                        const displayNotes = cleanNotes(loan.notes);
                        
                        // Calcular status de cada parcela
                        const getInstallmentStatusForDisplay = (index: number, dueDate: string) => {
                          const paidAmount = partialPayments[index] || 0;
                          const pendingSubs = advanceSubparcelas.filter(s => s.originalIndex === index);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const due = new Date(dueDate + 'T12:00:00');
                          
                          if (paidAmount >= totalPerInstallment * 0.99 && pendingSubs.length === 0) {
                            return { status: 'paid', label: 'Paga', color: 'text-emerald-500' };
                          } else if (pendingSubs.length > 0 || paidAmount > 0) {
                            return { status: 'partial', label: 'Parcial', color: 'text-amber-500' };
                          } else if (today > due) {
                            return { status: 'overdue', label: 'Atrasada', color: 'text-destructive' };
                          }
                          return { status: 'pending', label: 'Pendente', color: 'text-muted-foreground' };
                        };
                        
                        return (
                          <div className={`mt-3 pt-3 border-t space-y-3 ${hasSpecialStyle ? 'border-white/20' : 'border-border'}`}>
                            {/* Progresso de Parcelas */}
                            <div className={`rounded-lg p-3 ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
                              <p className={`font-medium text-sm mb-2 ${hasSpecialStyle ? 'text-white' : ''}`}>📊 Progresso</p>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary transition-all" 
                                    style={{ width: `${progressPercentage}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium ${hasSpecialStyle ? 'text-white' : ''}`}>{progressPercentage}%</span>
                              </div>
                              <p className={`text-xs ${hasSpecialStyle ? 'text-white/70' : 'text-muted-foreground'}`}>
                                {paidInstallmentsCount} de {numInstallments} parcela(s) paga(s) • {numInstallments - paidInstallmentsCount} restante(s)
                              </p>
                            </div>
                            
                            {/* Cronograma de Parcelas */}
                            {dates.length > 0 && (
                              <div className={`rounded-lg p-3 ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
                                <p className={`font-medium text-sm mb-2 ${hasSpecialStyle ? 'text-white' : ''}`}>📅 Cronograma de Parcelas</p>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                  {dates.map((date, idx) => {
                                    const statusInfo = getInstallmentStatusForDisplay(idx, date);
                                    return (
                                      <div key={idx} className={`flex items-center justify-between text-xs py-1 ${idx < dates.length - 1 ? 'border-b border-border/30' : ''}`}>
                                        <span className={hasSpecialStyle ? 'text-white/80' : 'text-muted-foreground'}>
                                          Parcela {idx + 1}/{numInstallments}
                                        </span>
                                        <span className={hasSpecialStyle ? 'text-white' : ''}>
                                          {formatCurrency(totalPerInstallment)}
                                        </span>
                                        <span className={hasSpecialStyle ? 'text-white/70' : 'text-muted-foreground'}>
                                          {formatDate(date)}
                                        </span>
                                        <span className={`font-medium ${hasSpecialStyle ? (statusInfo.status === 'paid' ? 'text-emerald-300' : statusInfo.status === 'overdue' ? 'text-red-300' : 'text-white/70') : statusInfo.color}`}>
                                          {statusInfo.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* Dados do Cliente */}
                            {loan.client && (loan.client.phone || loan.client.address || loan.client.email) && (
                              <div className={`rounded-lg p-3 ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
                                <p className={`font-medium text-sm mb-2 ${hasSpecialStyle ? 'text-white' : ''}`}>👤 Contato do Cliente</p>
                                <div className="space-y-1.5">
                                  {loan.client.phone && (
                                    <div className={`flex items-center gap-2 text-xs ${hasSpecialStyle ? 'text-white/80' : 'text-muted-foreground'}`}>
                                      <Phone className="w-3 h-3" />
                                      <span>{loan.client.phone}</span>
                                    </div>
                                  )}
                                  {loan.client.email && (
                                    <div className={`flex items-center gap-2 text-xs ${hasSpecialStyle ? 'text-white/80' : 'text-muted-foreground'}`}>
                                      <Mail className="w-3 h-3" />
                                      <span>{loan.client.email}</span>
                                    </div>
                                  )}
                                  {loan.client.address && (
                                    <div className={`flex items-center gap-2 text-xs ${hasSpecialStyle ? 'text-white/80' : 'text-muted-foreground'}`}>
                                      <MapPin className="w-3 h-3" />
                                      <span>{loan.client.address}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Detalhes do Contrato */}
                            <div className={`rounded-lg p-3 ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
                              <p className={`font-medium text-sm mb-2 ${hasSpecialStyle ? 'text-white' : ''}`}>📋 Detalhes do Contrato</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {loan.contract_date && (
                                  <div>
                                    <p className={hasSpecialStyle ? 'text-white/60' : 'text-muted-foreground'}>Data do Contrato</p>
                                    <p className={`font-medium ${hasSpecialStyle ? 'text-white' : ''}`}>{formatDate(loan.contract_date)}</p>
                                  </div>
                                )}
                                <div>
                                  <p className={hasSpecialStyle ? 'text-white/60' : 'text-muted-foreground'}>Início</p>
                                  <p className={`font-medium ${hasSpecialStyle ? 'text-white' : ''}`}>{formatDate(loan.start_date)}</p>
                                </div>
                                <div>
                                  <p className={hasSpecialStyle ? 'text-white/60' : 'text-muted-foreground'}>Tipo de Juros</p>
                                  <p className={`font-medium ${hasSpecialStyle ? 'text-white' : ''}`}>{loan.interest_type === 'simple' ? 'Simples' : 'Composto'}</p>
                                </div>
                                <div>
                                  <p className={hasSpecialStyle ? 'text-white/60' : 'text-muted-foreground'}>Modo de Juros</p>
                                  <p className={`font-medium ${hasSpecialStyle ? 'text-white' : ''}`}>{loan.interest_mode === 'on_total' ? 'Sobre o Total' : 'Por Parcela'}</p>
                                </div>
                                <div>
                                  <p className={hasSpecialStyle ? 'text-white/60' : 'text-muted-foreground'}>Total de Juros</p>
                                  <p className={`font-medium ${hasSpecialStyle ? 'text-white' : ''}`}>{formatCurrency(effectiveTotalInterest)}</p>
                                </div>
                                <div>
                                  <p className={hasSpecialStyle ? 'text-white/60' : 'text-muted-foreground'}>Tipo de Pagamento</p>
                                  <p className={`font-medium ${hasSpecialStyle ? 'text-white' : ''}`}>
                                    {loan.payment_type === 'single' ? 'Parcela Única' : 
                                     loan.payment_type === 'installment' ? 'Mensal' :
                                     loan.payment_type === 'daily' ? 'Diário' : 
                                     loan.payment_type === 'weekly' ? 'Semanal' :
                                     loan.payment_type === 'biweekly' ? 'Quinzenal' : 'Mensal'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Notas/Observações */}
                            {displayNotes && (
                              <div className={`rounded-lg p-3 ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
                                <p className={`font-medium text-sm mb-2 ${hasSpecialStyle ? 'text-white' : ''}`}>📝 Observações</p>
                                <p className={`text-xs whitespace-pre-wrap ${hasSpecialStyle ? 'text-white/80' : 'text-muted-foreground'}`}>
                                  {displayNotes}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          </TabsContent>

          <TabsContent value="daily" className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative tutorial-search flex-1">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm" />
              </div>
              <Dialog open={isDailyDialogOpen} onOpenChange={setIsDailyDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10 bg-sky-500 hover:bg-sky-600">
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Novo Diário
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>

            <TooltipProvider delayDuration={300}>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
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
                    <p>Exibe todos os empréstimos diários</p>
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
                    <p>Empréstimos com pagamentos em dia</p>
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
                    <p>Empréstimos quitados</p>
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
              </div>
            </TooltipProvider>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[...Array(6)].map((_, i) => (<Skeleton key={i} className="h-40 sm:h-48 w-full rounded-xl" />))}
              </div>
            ) : filteredLoans.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Clock className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground">{search ? 'Nenhum empréstimo diário encontrado' : 'Nenhum empréstimo diário cadastrado'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredLoans.map((loan, loanIndex) => {
                  const isDaily = loan.payment_type === 'daily';
                  const numInstallments = loan.installments || 1;
                  const dailyInstallmentAmount = isDaily ? (loan.total_interest || 0) : 0;
                  const dailyTotalToReceive = isDaily ? dailyInstallmentAmount * numInstallments : 0;
                  const dailyProfit = isDaily ? (dailyTotalToReceive - loan.principal_amount) : 0;
                  const totalPerInstallment = dailyInstallmentAmount;
                  
                  const { isPaid, isRenegotiated, isOverdue, overdueInstallmentIndex, overdueDate, daysOverdue } = getLoanStatus(loan);
                  const remainingToReceive = loan.remaining_balance;
                  
                  const isDueToday = (() => {
                    if (isPaid) return false;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dates = (loan.installment_dates as string[]) || [];
                    const paidCount = getPaidInstallmentsCount(loan);
                    if (dates.length > 0 && paidCount < dates.length) {
                      const nextDueDate = new Date(dates[paidCount] + 'T12:00:00');
                      nextDueDate.setHours(0, 0, 0, 0);
                      return today.getTime() === nextDueDate.getTime();
                    }
                    return false;
                  })();
                  
                  const dueTodayDate = (() => {
                    const dates = (loan.installment_dates as string[]) || [];
                    const paidCount = getPaidInstallmentsCount(loan);
                    return dates[paidCount] || loan.due_date;
                  })();
                  
                  const hasSpecialStyle = isOverdue || isPaid;
                  const mutedTextColor = hasSpecialStyle ? 'text-white/70' : 'text-muted-foreground';
                  
                  const expectedProfit = dailyProfit;
                  const realizedProfit = loan.total_paid ? Math.min(loan.total_paid - (loan.principal_amount * (loan.total_paid / dailyTotalToReceive)), expectedProfit * (loan.total_paid / dailyTotalToReceive)) : 0;
                  const profitPercentage = expectedProfit > 0 ? Math.round((realizedProfit / expectedProfit) * 100) : 0;
                  
                  const overdueConfigValue = (() => {
                    const overdueMatch = (loan.notes || '').match(/\[OVERDUE_CONFIG:(\d+(?:\.\d+)?)\]/);
                    return overdueMatch ? parseFloat(overdueMatch[1]) : 0;
                  })();
                  const dynamicPenaltyAmount = overdueConfigValue > 0 && daysOverdue > 0 ? overdueConfigValue * daysOverdue : 0;

                  return (
                    <Card 
                      key={loan.id} 
                      className={`relative overflow-hidden transition-all hover:shadow-lg ${
                        isOverdue 
                          ? 'bg-gradient-to-br from-red-500 to-red-600 text-white border-red-400' 
                          : isPaid 
                            ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border-green-400'
                            : isDueToday
                              ? 'border-amber-400 bg-amber-500/10'
                              : ''
                      }`}
                    >
                      <CardHeader className="p-3 sm:p-4 pb-0 sm:pb-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                              <AvatarImage src={loan.client?.avatar_url || ''} />
                              <AvatarFallback className="text-xs sm:text-sm">{loan.client?.full_name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <h3 className={`font-semibold truncate text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : ''}`}>{loan.client?.full_name}</h3>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                <Badge variant="outline" className="text-[9px] sm:text-[10px] bg-sky-500/20 text-sky-300 border-sky-400/50">
                                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5" /> Diário
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Badge className={`text-[10px] sm:text-xs flex-shrink-0 ${
                            isOverdue ? 'bg-white/20 text-white' :
                            isPaid ? 'bg-white/20 text-white' :
                            isDueToday ? 'bg-amber-500 text-white' :
                            'bg-blue-500/20 text-blue-500 border-blue-500/30'
                          }`}>
                            {isPaid ? 'Quitado' : isOverdue ? 'Em Atraso' : isDueToday ? 'Vence Hoje' : 'Em Dia'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-2 sm:pt-3">
                        <div className={`grid grid-cols-2 gap-2 p-2 sm:p-3 rounded-lg mb-2 ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/50'}`}>
                          <div>
                            <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>Emprestado</p>
                            <p className={`font-semibold text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : ''}`}>
                              {formatCurrency(loan.principal_amount)}
                            </p>
                          </div>
                          <div>
                            <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>Total a Receber</p>
                            <p className={`font-semibold text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : ''}`}>
                              {formatCurrency(dailyTotalToReceive)}
                            </p>
                          </div>
                          <div>
                            <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>Restante</p>
                            <p className={`font-bold text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>
                              {formatCurrency(remainingToReceive)}
                            </p>
                          </div>
                          <div>
                            <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>Lucro</p>
                            <p className={`font-semibold text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : 'text-emerald-500'}`}>
                              {formatCurrency(dailyProfit)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
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
                          <div className={`flex items-center gap-1.5 sm:gap-2 ${mutedTextColor}`}>
                            <Check className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="truncate">{getPaidInstallmentsCount(loan)}/{numInstallments} parcelas</span>
                          </div>
                        </div>
                        
                        {isOverdue && (
                          <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg bg-red-500/20 border border-red-400/30">
                            <div className="text-xs sm:text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-red-300 font-medium">
                                  Parcela {getPaidInstallmentsCount(loan) + 1}/{numInstallments} em atraso
                                </span>
                                <span className="text-red-200 font-bold">{daysOverdue} dias</span>
                              </div>
                              <div className="flex items-center justify-between mt-1 text-red-300/70">
                                <span>Vencimento: {formatDate(overdueDate)}</span>
                                <span>Valor: {formatCurrency(totalPerInstallment)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {isDueToday && !isOverdue && (
                          <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg bg-amber-500/20 border border-amber-400/30">
                            <div className="text-xs sm:text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-amber-300 font-medium flex items-center gap-2">
                                  <Bell className="w-4 h-4" />
                                  Vence Hoje!
                                </span>
                                <span className="text-amber-200 font-bold">{formatCurrency(totalPerInstallment)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className={`flex gap-1.5 sm:gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 ${hasSpecialStyle ? 'border-t border-white/20' : 'border-t'}`}>
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="sm" 
                                  className={`flex-1 h-7 sm:h-8 text-xs ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`} 
                                  onClick={() => { 
                                    setSelectedLoanId(loan.id);
                                    const dates = (loan.installment_dates as string[]) || [];
                                    const paidCount = getPaidInstallmentsCount(loan);
                                    let defaultNextDueDate = '';
                                    if (dates.length > 0 && paidCount < dates.length) {
                                      const currentDueDate = new Date(dates[paidCount] + 'T12:00:00');
                                      const nextDate = new Date(currentDueDate);
                                      nextDate.setMonth(nextDate.getMonth() + 1);
                                      defaultNextDueDate = format(nextDate, 'yyyy-MM-dd');
                                    }
                                    setPaymentData({ 
                                      amount: totalPerInstallment.toFixed(2), 
                                      payment_date: format(new Date(), 'yyyy-MM-dd'),
                                      new_due_date: defaultNextDueDate,
                                      payment_type: 'installment',
                                      selected_installments: [],
                                      partial_installment_index: null,
                                      send_notification: false,
                                      is_advance_payment: false,
                                    });
                                    setIsPaymentDialogOpen(true);
                                  }}
                                  disabled={isPaid}
                                >
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  Pagar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Registrar pagamento</TooltipContent>
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
                              <TooltipContent>Ver histórico</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="icon" 
                                  className={`h-7 w-7 sm:h-8 sm:w-8 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                  onClick={() => setDeleteId(loan.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
            {selectedLoanId && (() => {
            const selectedLoan = loans.find(l => l.id === selectedLoanId);
            if (!selectedLoan) return null;
            const numInstallments = selectedLoan.installments || 1;
            const principalPerInstallment = selectedLoan.principal_amount / numInstallments;
            const isDaily = selectedLoan.payment_type === 'daily';
            
            // Para empréstimos diários: total_interest armazena o valor da parcela diária
            // Para outros: total_interest é o juros total do contrato
            let totalInterest: number;
            let interestPerInstallment: number;
            let totalPerInstallment: number;
            
            if (isDaily) {
              // Para diários: total_interest É o valor da parcela diária (ex: R$30)
              const dailyAmount = selectedLoan.total_interest || 0;
              totalPerInstallment = dailyAmount;
              const totalToReceive = dailyAmount * numInstallments;
              totalInterest = totalToReceive - selectedLoan.principal_amount;
              interestPerInstallment = totalInterest / numInstallments;
            } else {
              totalInterest = selectedLoan.total_interest || 0;
              interestPerInstallment = totalInterest / numInstallments;
              totalPerInstallment = principalPerInstallment + interestPerInstallment;
            }
            
            // Porém o valor realmente devido deve sempre respeitar o remaining_balance,
            // que já considera renegociações, taxa de renovação, etc.
            const remainingToReceive = selectedLoan.remaining_balance;
            
            // Para contratos de 1 parcela (caso típico de renovação), a próxima parcela
            // deve ser exatamente o remaining_balance (ex: 300 após taxa de renovação)
            if (numInstallments === 1 && !isDaily) {
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
                      {isDaily ? (
                        <>Parcela Diária: {formatCurrency(totalPerInstallment)} (Lucro: {formatCurrency(totalInterest)})</>
                      ) : (
                        <>Parcela: {formatCurrency(totalPerInstallment)} ({formatCurrency(principalPerInstallment)} + {formatCurrency(interestPerInstallment)} juros)</>
                      )}
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
                    const advanceSubparcelas = getAdvanceSubparcelasFromNotes(selectedLoan.notes);
                    
                      // Verificar pagamentos de "somente juros" por parcela
                    const interestOnlyPayments = getInterestOnlyPaymentsFromNotes(selectedLoan.notes);
                    
                    const getInstallmentStatus = (index: number) => {
                      const installmentValue = getInstallmentValue(index);
                      let paidAmount = partialPayments[index] || 0;
                      
                      // Verificar TODOS os pagamentos de "somente juros" para esta parcela
                      const allInterestPayments = interestOnlyPayments.filter(p => p.installmentIndex === index);
                      const isInterestOnlyPaid = allInterestPayments.length > 0;
                      const totalInterestPaid = allInterestPayments.reduce((sum, p) => sum + p.amount, 0);
                      const interestPaymentsCount = allInterestPayments.length;
                      
                      // IMPORTANTE: Para pagamento de "somente juros", NÃO descontar do valor da parcela
                      // O paidAmount não inclui o pagamento de juros - o valor da parcela continua intacto
                      
                      // FALLBACK: Se não há tracking por tags [PARTIAL_PAID], calcular por total_paid
                      // MAS ignorar pagamentos de "somente juros" (não devem abater da parcela)
                      const hasAnyTrackingTags = Object.keys(partialPayments).length > 0;
                      const hasInterestOnlyTag = (selectedLoan.notes || '').includes('[INTEREST_ONLY_PAYMENT]');
                      
                      if (!hasAnyTrackingTags && !hasInterestOnlyTag && selectedLoan.total_paid && selectedLoan.total_paid > 0) {
                        // Calcular quantas parcelas completas foram pagas
                        const paidInstallmentsCount = Math.floor(selectedLoan.total_paid / totalPerInstallment);
                        if (index < paidInstallmentsCount) {
                          // Esta parcela foi totalmente paga
                        return { 
                            isPaid: true, 
                            isPartial: false, 
                            paidAmount: installmentValue, 
                            remaining: 0, 
                            excess: 0, 
                            subparcelas: [] as { originalIndex: number; amount: number; label: string }[],
                            isInterestOnlyPaid: false,
                            totalInterestPaid: 0,
                            interestPaymentsCount: 0,
                            allInterestPayments: [] as { installmentIndex: number; amount: number; paymentDate: string }[]
                          };
                        }
                        // Verificar se é a parcela parcialmente paga
                        const remainingPaid = selectedLoan.total_paid - (paidInstallmentsCount * totalPerInstallment);
                        if (index === paidInstallmentsCount && remainingPaid > 0) {
                          paidAmount = remainingPaid;
                        }
                      }
                      
                      const remaining = installmentValue - paidAmount;
                      const excess = paidAmount > installmentValue ? paidAmount - installmentValue : 0;
                      
                      // Verificar se há sub-parcelas pendentes para esta parcela
                      const pendingSubparcelas = advanceSubparcelas.filter(s => s.originalIndex === index);
                      const hasSubparcelas = pendingSubparcelas.length > 0;
                      
                      // Se há sub-parcelas pendentes, NÃO considerar como totalmente quitada
                      if (hasSubparcelas) {
                        return { isPaid: false, isPartial: true, paidAmount, remaining, excess: 0, subparcelas: pendingSubparcelas, isInterestOnlyPaid, totalInterestPaid, interestPaymentsCount, allInterestPayments };
                      }
                      
                      if (paidAmount >= installmentValue * 0.99) {
                        return { isPaid: true, isPartial: false, paidAmount, remaining: 0, excess, subparcelas: [] as typeof pendingSubparcelas, isInterestOnlyPaid: false, totalInterestPaid: 0, interestPaymentsCount: 0, allInterestPayments: [] as typeof allInterestPayments };
                      } else if (paidAmount > 0) {
                        return { isPaid: false, isPartial: true, paidAmount, remaining, excess: 0, subparcelas: [] as typeof pendingSubparcelas, isInterestOnlyPaid, totalInterestPaid, interestPaymentsCount, allInterestPayments };
                      }
                      return { isPaid: false, isPartial: false, paidAmount: 0, remaining: installmentValue, excess: 0, subparcelas: [] as typeof pendingSubparcelas, isInterestOnlyPaid, totalInterestPaid, interestPaymentsCount, allInterestPayments };
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

                      // Calcular valor total considerando parcelas e sub-parcelas
                      const totalSelectedAmount = next.reduce((sum, i) => {
                        if (i < 0) {
                          // É uma sub-parcela de adiantamento (índice negativo)
                          const subIdx = Math.abs(i) - 1;
                          return sum + (advanceSubparcelas[subIdx]?.amount || 0);
                        }
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
                              // Não marcar como atrasada se tiver pagamento de juros apenas
                              const isOverdue = !status.isPaid && !status.isInterestOnlyPaid && dateObj < today;
                              const isSelected = paymentData.selected_installments.includes(index);
                              const installmentValue = getInstallmentValue(index);
                              const hasSubparcelas = status.subparcelas.length > 0;
                              
                              return (
                                <div key={index} className="space-y-1">
                                  {/* Parcela Principal */}
                                  <Button
                                    type="button"
                                    variant={isSelected ? 'default' : 'outline'}
                                    className={`w-full justify-between text-sm h-auto py-2 ${
                                      status.isPaid 
                                        ? 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-300 cursor-not-allowed opacity-60' 
                                        : hasSubparcelas
                                          ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300'
                                          : status.isPartial
                                            ? 'bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-300'
                                            : isOverdue && !isSelected
                                              ? 'border-destructive text-destructive' 
                                              : ''
                                    }`}
                                    onClick={() => {
                                      if (!status.isPaid && !hasSubparcelas) {
                                        toggleInstallment(index);
                                      }
                                    }}
                                    disabled={status.isPaid || hasSubparcelas}
                                  >
                                    <span className="flex flex-col items-start gap-0.5">
                                      <span className="flex items-center gap-2">
                                        {isSelected && <span className="text-primary-foreground">✓</span>}
                                        <span>
                                          Parcela {index + 1}/{dates.length}
                                          {status.isPaid && ' ✓'}
                                          {hasSubparcelas && ` (${status.subparcelas.length} sub-parcela${status.subparcelas.length > 1 ? 's' : ''} pendente${status.subparcelas.length > 1 ? 's' : ''})`}
                                          {isOverdue && !status.isPaid && !hasSubparcelas && ' (Atrasada)'}
                                        </span>
                                      </span>
                                      {/* Indicação discreta de juros pagos com histórico completo */}
                                      {status.isInterestOnlyPaid && !status.isPaid && (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                            💜 {status.interestPaymentsCount}x juros pagos: {formatCurrency(status.totalInterestPaid)} total
                                          </span>
                                          {status.allInterestPayments.map((payment, idx) => (
                                            <span key={idx} className="text-xs text-muted-foreground ml-4">
                                              → {formatCurrency(payment.amount)} em {formatDate(payment.paymentDate)}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {status.isPartial && !hasSubparcelas && !status.isInterestOnlyPaid && (
                                        <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                          Valor: {formatCurrency(installmentValue)} | Pago: {formatCurrency(status.paidAmount)} | Falta: {formatCurrency(status.remaining)}
                                        </span>
                                      )}
                                      {hasSubparcelas && (
                                        <span className="text-xs text-amber-600 dark:text-amber-400">
                                          Pago antecipado: {formatCurrency(status.paidAmount)} | Selecione a sub-parcela abaixo
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
                                          : hasSubparcelas
                                            ? formatCurrency(status.subparcelas.reduce((sum, s) => sum + s.amount, 0))
                                            : status.isPartial 
                                              ? formatCurrency(status.remaining) 
                                              : formatCurrency(installmentValue)
                                        }
                                      </span>
                                    </span>
                                  </Button>
                                  
                                  {/* Sub-parcelas agrupadas sob a parcela (pagas + pendentes) */}
                                  {(() => {
                                    const paidSubparcelas = getPaidAdvanceSubparcelasFromNotes(selectedLoan?.notes || null);
                                    const paidSubparcelasForThis = paidSubparcelas.filter(s => s.originalIndex === index);
                                    const hasPaidSubparcelas = paidSubparcelasForThis.length > 0;
                                    
                                    if (!hasSubparcelas && !hasPaidSubparcelas) return null;
                                    
                                    return (
                                      <div className="ml-4 border-l-2 border-amber-500 pl-2 space-y-1">
                                        {/* Sub-parcelas PAGAS (bloqueadas) */}
                                        {paidSubparcelasForThis.map((sub, subIdx) => (
                                          <Button
                                            key={`sub-paid-${index}-${subIdx}`}
                                            type="button"
                                            variant="outline"
                                            className="w-full justify-between text-xs h-auto py-1.5 bg-green-500/20 border-green-500 text-green-700 dark:text-green-300 cursor-not-allowed opacity-60"
                                            disabled={true}
                                          >
                                            <span className="flex items-center gap-2">
                                              <span className="text-green-600">✓</span>
                                              <span>↳ Sub-parcela {index + 1}.{subIdx + 1}/{dates.length} (Paga)</span>
                                            </span>
                                            <span className="flex items-center gap-2">
                                              <span className="opacity-70">{formatDate(sub.dueDate)}</span>
                                              <span className="font-medium">{formatCurrency(sub.amount)}</span>
                                            </span>
                                          </Button>
                                        ))}
                                        
                                        {/* Sub-parcelas PENDENTES (clicáveis) */}
                                        {status.subparcelas.map((sub, subIdx) => {
                                          const subDateObj = new Date(sub.dueDate + 'T12:00:00');
                                          const isSubOverdue = subDateObj < today;
                                          const globalSubIdx = advanceSubparcelas.findIndex(s => s === sub);
                                          const negativeIndex = -1 - globalSubIdx;
                                          const isSubSelected = paymentData.selected_installments.includes(negativeIndex);
                                          
                                          return (
                                            <Button
                                              key={`sub-${index}-${subIdx}`}
                                              type="button"
                                              variant={isSubSelected ? 'default' : 'outline'}
                                              className={`w-full justify-between text-xs h-auto py-1.5 ${
                                                isSubOverdue 
                                                  ? 'bg-red-500/20 border-red-500 text-red-700 dark:text-red-300' 
                                                  : 'bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-300'
                                              }`}
                                              onClick={() => toggleInstallment(negativeIndex)}
                                            >
                                              <span className="flex items-center gap-2">
                                                {isSubSelected && <span className="text-primary-foreground">✓</span>}
                                                <span>
                                                  ↳ Sub-parcela {index + 1}.{paidSubparcelasForThis.length + subIdx + 1}/{dates.length}
                                                  {isSubOverdue && ' (Atrasada)'}
                                                </span>
                                              </span>
                                              <span className="flex items-center gap-2">
                                                <span className="opacity-70">{formatDate(sub.dueDate)}</span>
                                                <span className="font-medium">{formatCurrency(sub.amount)}</span>
                                              </span>
                                            </Button>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
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
                    
                    // Extrair sub-parcelas de adiantamento pendentes
                    const advanceSubparcelas = getAdvanceSubparcelasFromNotes(selectedLoan.notes);
                    
                    // Definir parcela selecionada (primeira não paga ou primeira sub-parcela por padrão)
                    const selectedPartialIndex = paymentData.partial_installment_index ?? (unpaidInstallments[0]?.index ?? (advanceSubparcelas.length > 0 ? -1 : 0));
                    
                    // Se selecionou uma sub-parcela (índice negativo = -1 - subIndex)
                    const isAdvanceSubparcelaSelected = selectedPartialIndex !== null && String(selectedPartialIndex).startsWith('-');
                    const selectedSubparcelaIdx = isAdvanceSubparcelaSelected ? Math.abs(selectedPartialIndex) - 1 : -1;
                    const selectedSubparcela = selectedSubparcelaIdx >= 0 ? advanceSubparcelas[selectedSubparcelaIdx] : null;
                    
                    const selectedStatus = selectedSubparcela 
                      ? { isPaid: false, isPartial: false, paidAmount: 0, remaining: selectedSubparcela.amount }
                      : getInstallmentStatusPartial(selectedPartialIndex ?? 0);
                    
                    return (
                      <div className="space-y-4">
                        {/* Seletor de Parcela */}
                        {(dates.length > 0 || advanceSubparcelas.length > 0) && (
                          <div className="space-y-2">
                            <Label>Referente a qual Parcela?</Label>
                            <Select 
                              value={selectedPartialIndex?.toString() ?? ''} 
                              onValueChange={(value) => setPaymentData({ ...paymentData, partial_installment_index: parseInt(value) })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a parcela" />
                              </SelectTrigger>
                              <SelectContent>
                                {/* Sub-parcelas de adiantamento primeiro (mais urgentes) */}
                                {advanceSubparcelas.map((sub, subIdx) => (
                                  <SelectItem key={`advance-${subIdx}`} value={(-1 - subIdx).toString()}>
                                    <span className="flex items-center gap-2">
                                      <span className="text-amber-600 font-medium">Sub-parcela (Adiant. P{sub.originalIndex + 1})</span>
                                      <span className="text-xs text-amber-500">- {formatDate(sub.dueDate)}</span>
                                      <span className="text-xs text-amber-600 font-medium">({formatCurrency(sub.amount)})</span>
                                    </span>
                                  </SelectItem>
                                ))}
                                {/* Parcelas normais */}
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
                              {selectedSubparcela ? (
                                <>
                                  <div className="flex justify-between text-amber-600">
                                    <span>Sub-parcela (Adiant. P{selectedSubparcela.originalIndex + 1}):</span>
                                    <span className="font-medium">{formatCurrency(selectedSubparcela.amount)}</span>
                                  </div>
                                  <div className="flex justify-between text-muted-foreground text-xs mt-1">
                                    <span>Vencimento:</span>
                                    <span>{formatDate(selectedSubparcela.dueDate)}</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex justify-between">
                                    <span>Valor da parcela:</span>
                                    <span className="font-medium">{formatCurrency(getInstallmentValuePartial(selectedPartialIndex ?? 0))}</span>
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
                            onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value, is_advance_payment: false })} 
                            placeholder={`Máx: ${formatCurrency(selectedStatus.remaining)}`}
                            required 
                          />
                          <p className="text-xs text-muted-foreground">
                            Digite qualquer valor até {formatCurrency(selectedStatus.remaining)}
                          </p>
                        </div>
                        
                        {/* Checkbox de Adiantamento - NÃO aparece para sub-parcelas (já são sub-parcelas) */}
                        {!selectedSubparcela && (() => {
                          const paymentDateObj = new Date(paymentData.payment_date + 'T12:00:00');
                          const installmentDueDate = dates[selectedPartialIndex ?? 0];
                          const dueDateObj = installmentDueDate ? new Date(installmentDueDate + 'T12:00:00') : null;
                          const isBeforeDueDate = dueDateObj ? paymentDateObj < dueDateObj : false;
                          const paidAmount = parseFloat(paymentData.amount) || 0;
                          const isPartialAmount = paidAmount > 0 && paidAmount < selectedStatus.remaining;
                          const showAdvanceOption = isBeforeDueDate && isPartialAmount;
                          const remainderAmount = selectedStatus.remaining - paidAmount;
                          
                          if (!showAdvanceOption) return null;
                          
                          return (
                            <>
                              <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                                <Checkbox
                                  id="is_advance_payment"
                                  checked={paymentData.is_advance_payment}
                                  onCheckedChange={(checked) => setPaymentData({ ...paymentData, is_advance_payment: !!checked })}
                                />
                                <div className="flex-1">
                                  <label htmlFor="is_advance_payment" className="text-sm font-medium cursor-pointer text-amber-700 dark:text-amber-300">
                                    É um adiantamento de pagamento?
                                  </label>
                                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    Se marcado, o valor restante ({formatCurrency(remainderAmount)}) 
                                    continuará vencendo em {formatDate(installmentDueDate)}
                                  </p>
                                </div>
                              </div>
                              {paymentData.is_advance_payment && (
                                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                                  <p className="text-muted-foreground">
                                    📅 A sub-parcela manterá a data de vencimento original da parcela: 
                                    <span className="font-medium text-foreground ml-1">
                                      {formatDate(installmentDueDate)}
                                    </span>
                                  </p>
                                </div>
                              )}
                            </>
                          );
                        })()}
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
                  
                  {!paymentData.is_advance_payment && (
                    <div className="space-y-2">
                      <Label>Nova Data de Vencimento</Label>
                      <Input 
                        type="date" 
                        value={paymentData.new_due_date} 
                        onChange={(e) => setPaymentData({ ...paymentData, new_due_date: e.target.value })} 
                      />
                      <p className="text-xs text-muted-foreground">Pré-preenchido com próximo mês. Altere se necessário.</p>
                    </div>
                  )}
                  
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
                        {(selectedLoan.payment_type === 'installment' || selectedLoan.payment_type === 'weekly' || selectedLoan.payment_type === 'biweekly') && (
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
                          // Função helper para rolar data baseado no tipo de pagamento
                          const rollDateForward = (date: Date, paymentType: string) => {
                            if (paymentType === 'weekly') {
                              date.setDate(date.getDate() + 7);  // +1 semana
                            } else if (paymentType === 'biweekly') {
                              date.setDate(date.getDate() + 15); // +15 dias
                            } else {
                              date.setMonth(date.getMonth() + 1); // +1 mês (mensal/outros)
                            }
                          };
                          
                          // Calcular próxima data de vencimento automaticamente baseado no tipo
                          const dates = (selectedLoan.installment_dates as string[]) || [];
                          let nextUnpaidIndex = -1;
                          for (let i = 0; i < dates.length; i++) {
                            if (!isInstallmentPaid(i)) {
                              nextUnpaidIndex = i;
                              break;
                            }
                          }
                          
                          // Se tem parcela em aberto, pegar a data dela e adicionar período baseado no tipo
                          let newDueDate = '';
                          if (nextUnpaidIndex >= 0 && dates[nextUnpaidIndex]) {
                            const currentDate = new Date(dates[nextUnpaidIndex] + 'T12:00:00');
                            rollDateForward(currentDate, selectedLoan.payment_type);
                            newDueDate = format(currentDate, 'yyyy-MM-dd');
                          } else if (selectedLoan.due_date) {
                            // Se não tem parcelas, usar due_date + período
                            const currentDate = new Date(selectedLoan.due_date + 'T12:00:00');
                            rollDateForward(currentDate, selectedLoan.payment_type);
                            newDueDate = format(currentDate, 'yyyy-MM-dd');
                          }
                          
                          setRenegotiateData({ 
                            ...renegotiateData, 
                            interest_only_paid: true,
                            renewal_fee_enabled: false,
                            remaining_amount: interestOnlyOriginalRemaining.toFixed(2),
                            promised_date: newDueDate
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
                      
                      {(selectedLoan.payment_type === 'installment' || selectedLoan.payment_type === 'weekly' || selectedLoan.payment_type === 'biweekly') && (
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
            <DialogHeader>
              <DialogTitle className="text-base sm:text-xl">
                {editIsRenegotiation ? '⚠️ Renegociação de Contrato' : 'Editar Empréstimo'}
              </DialogTitle>
            </DialogHeader>
            
            {/* Renegotiation Warning and Historical Data */}
            {editIsRenegotiation && editHistoricalData && (
              <div className="space-y-3 mb-4">
                <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 text-sm">
                  <p className="text-yellow-300 font-medium">
                    Este contrato já possui pagamentos registrados. Ao salvar, você estará criando uma <strong>RENEGOCIAÇÃO</strong> baseada no saldo devedor atual.
                  </p>
                </div>
                
                {/* Historical Contract Section */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-yellow-400 flex items-center gap-1.5">
                    📜 CONTRATO ANTERIOR
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Emprestado:</p>
                      <p className="font-semibold">{formatCurrency(editHistoricalData.originalPrincipal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taxa:</p>
                      <p className="font-semibold">{editHistoricalData.originalRate}% ({editHistoricalData.originalInterestMode === 'per_installment' ? 'Por Parcela' : 'Sobre Total'})</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Parcelas:</p>
                      <p className="font-semibold">{editHistoricalData.originalInstallments}x</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Previsto:</p>
                      <p className="font-semibold">{formatCurrency(editHistoricalData.originalTotal)}</p>
                    </div>
                  </div>
                  <div className="border-t border-yellow-500/30 pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total já recebido:</span>
                      <span className="font-semibold text-green-400">{formatCurrency(editHistoricalData.totalPaid)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Lucro já realizado:</span>
                      <span className="font-semibold text-green-400">{formatCurrency(editHistoricalData.realizedProfit)} ✅</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Saldo devedor atual:</span>
                      <span className="font-semibold text-yellow-400">{formatCurrency(editHistoricalData.remainingBalance)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                    📊 NOVO CONTRATO
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configure abaixo os novos termos. O valor base é o saldo devedor de {formatCurrency(editHistoricalData.remainingBalance)}.
                  </p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleEditSubmit} className="space-y-3 sm:space-y-4">
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Cliente *</Label>
                <Select value={editFormData.client_id} onValueChange={(v) => setEditFormData({ ...editFormData, client_id: v })} disabled={editIsRenegotiation}>
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
                            const sortedDates = dates.map(d => format(d, 'yyyy-MM-dd')).sort();
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
                      onValueChange={(v) => setEditFormData({ ...editFormData, interest_mode: v as 'per_installment' | 'on_total' | 'compound' })}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_installment">Por Parcela</SelectItem>
                        <SelectItem value="on_total">Sobre o Total</SelectItem>
                        <SelectItem value="compound">Juros Compostos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editFormData.payment_type === 'installment' && (
                    <>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div className="space-y-1 sm:space-y-2">
                          <Label className="text-xs sm:text-sm">Juros Total</Label>
                          <Input 
                            type="text" 
                            readOnly 
                            value={(() => {
                              const principal = parseFloat(editFormData.principal_amount) || 0;
                              const rate = parseFloat(editFormData.interest_rate) || 0;
                              const numInst = parseInt(editFormData.installments) || 1;
                              let totalInterest: number;
                              if (editFormData.interest_mode === 'on_total') {
                                totalInterest = principal * (rate / 100);
                              } else if (editFormData.interest_mode === 'compound') {
                                totalInterest = principal * Math.pow(1 + (rate / 100), numInst) - principal;
                              } else {
                                totalInterest = principal * (rate / 100) * numInst;
                              }
                              return formatCurrency(totalInterest);
                            })()}
                            className="bg-muted h-9 sm:h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <Label className="text-xs sm:text-sm">Valor da Parcela (R$)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={editInstallmentValue}
                            onChange={(e) => {
                              const value = e.target.value;
                              setIsEditManuallyEditingInstallment(true);
                              setEditInstallmentValue(value);
                              
                              const newInstallmentValue = parseFloat(value);
                              const principal = parseFloat(editFormData.principal_amount);
                              const numInstallments = parseInt(editFormData.installments) || 1;
                              
                              if (newInstallmentValue && principal && numInstallments) {
                                const totalToReceive = newInstallmentValue * numInstallments;
                                const newTotalInterest = totalToReceive - principal;
                                
                                if (newTotalInterest >= 0) {
                                  let newRate: number;
                                  if (editFormData.interest_mode === 'on_total') {
                                    newRate = (newTotalInterest / principal) * 100;
                                  } else if (editFormData.interest_mode === 'compound') {
                                    newRate = (Math.pow((newTotalInterest / principal) + 1, 1 / numInstallments) - 1) * 100;
                                  } else {
                                    newRate = (newTotalInterest / principal / numInstallments) * 100;
                                  }
                                  setEditFormData(prev => ({ ...prev, interest_rate: newRate.toFixed(2) }));
                                }
                              }
                            }}
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Total a Receber</Label>
                        <Input 
                          type="text" 
                          readOnly 
                          value={editInstallmentValue && editFormData.installments
                            ? formatCurrency(parseFloat(editInstallmentValue) * parseInt(editFormData.installments))
                            : 'R$ 0,00'
                          } 
                          className="bg-muted h-9 sm:h-10 text-sm font-medium text-primary"
                        />
                      </div>
                      
                      {/* Aviso visual quando o usuário arredonda manualmente o valor da parcela no formulário de edição */}
                      {isEditManuallyEditingInstallment && editInstallmentValue && editFormData.principal_amount && editFormData.installments && (() => {
                        const principal = parseFloat(editFormData.principal_amount);
                        const numInstallments = parseInt(editFormData.installments) || 1;
                        const rate = parseFloat(editFormData.interest_rate) || 0;
                        let calculatedInterest = 0;
                        if (editFormData.interest_mode === 'per_installment') {
                          calculatedInterest = principal * (rate / 100) * numInstallments;
                        } else if (editFormData.interest_mode === 'compound') {
                          calculatedInterest = principal * Math.pow(1 + (rate / 100), numInstallments) - principal;
                        } else {
                          calculatedInterest = principal * (rate / 100);
                        }
                        const calculatedInstallmentValue = (principal + calculatedInterest) / numInstallments;
                        const currentInstallmentValue = parseFloat(editInstallmentValue);
                        const difference = Math.abs(currentInstallmentValue - calculatedInstallmentValue);
                        
                        // Mostrar aviso se a diferença for maior que R$ 0,01
                        if (difference > 0.01) {
                          return (
                            <div className="bg-amber-500/20 border border-amber-400/50 rounded-lg p-3 text-sm">
                              <p className="font-medium text-amber-300 flex items-center gap-2">
                                ⚠️ Valor da parcela ajustado manualmente
                              </p>
                              <div className="mt-1 text-xs text-amber-400/80 space-y-0.5">
                                <p>Valor calculado: {formatCurrency(calculatedInstallmentValue)}</p>
                                <p>Valor informado: {formatCurrency(currentInstallmentValue)}</p>
                              </div>
                              <p className="text-[10px] mt-2 text-amber-400/60">
                                A taxa de juros será ajustada para refletir este arredondamento.
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}
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
                <Button type="submit" className={`h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 ${editIsRenegotiation ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}`}>
                  {editIsRenegotiation ? 'Salvar Renegociação' : 'Salvar Alterações'}
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
          clientPhone={paymentClientPhone || undefined}
        />

        {/* Loan Created Receipt Prompt */}
        <LoanCreatedReceiptPrompt
          open={isLoanCreatedOpen}
          onOpenChange={setIsLoanCreatedOpen}
          loan={loanCreatedData}
          companyName={profile?.company_name || profile?.full_name || 'CobraFácil'}
          userPhone={profile?.phone || undefined}
          installmentDates={loanCreatedInstallmentDates}
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
                  {paymentHistoryData.map((payment) => {
                    const isHistoricalPayment = payment.notes?.includes('[CONTRATO_ANTIGO]');
                    // Extract installment info from notes like "[CONTRATO_ANTIGO] Parcela 1 - 15/10/2024"
                    const installmentMatch = payment.notes?.match(/Parcela (\d+)/);
                    const installmentNumber = installmentMatch ? installmentMatch[1] : null;
                    const isEditing = editingPaymentId === payment.id;
                    
                    return (
                      <div key={payment.id} className={`flex items-center justify-between p-3 rounded-lg border ${isHistoricalPayment ? 'bg-yellow-500/10 border-yellow-400/30' : 'bg-muted/30 border-border/50'}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                            {isEditing ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 text-xs">
                                    {editingPaymentDate ? formatDate(format(editingPaymentDate, 'yyyy-MM-dd')) : formatDate(payment.payment_date)}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={editingPaymentDate}
                                    onSelect={(date) => setEditingPaymentDate(date)}
                                    initialFocus
                                    className="pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-sm">{formatDate(payment.payment_date)}</span>
                            )}
                            {isHistoricalPayment && (
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-400/30 text-xs">
                                {installmentNumber ? `Histórico - Parcela ${installmentNumber}` : 'Histórico'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <DollarSign className="w-4 h-4 text-primary" />
                            <span className="font-semibold text-primary">{formatCurrency(payment.amount)}</span>
                          </div>
                          {payment.notes && !isHistoricalPayment && (
                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">{payment.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={async () => {
                                      if (editingPaymentDate && paymentHistoryLoanId) {
                                        const dateStr = format(editingPaymentDate, 'yyyy-MM-dd');
                                        await updatePaymentDate(payment.id, dateStr);
                                        setEditingPaymentId(null);
                                        setEditingPaymentDate(undefined);
                                        // Refresh payment history
                                        const result = await getLoanPayments(paymentHistoryLoanId);
                                        if (result.data) setPaymentHistoryData(result.data);
                                      }
                                    }}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Confirmar</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setEditingPaymentId(null);
                                      setEditingPaymentDate(undefined);
                                    }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Cancelar</TooltipContent>
                              </Tooltip>
                            </>
                          ) : (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setEditingPaymentId(payment.id);
                                      setEditingPaymentDate(new Date(payment.payment_date + 'T12:00:00'));
                                    }}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar data</TooltipContent>
                              </Tooltip>
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
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
        
        {/* Dialog para adicionar parcelas extras em empréstimos diários */}
        {extraInstallmentsLoan && (
          <AddExtraInstallmentsDialog
            isOpen={isExtraInstallmentsOpen}
            onClose={() => {
              setIsExtraInstallmentsOpen(false);
              setExtraInstallmentsLoan(null);
            }}
            loan={{
              id: extraInstallmentsLoan.id,
              installments: extraInstallmentsLoan.installments || 1,
              installment_dates: (extraInstallmentsLoan.installment_dates as string[]) || [],
              total_interest: extraInstallmentsLoan.total_interest || 0,
              principal_amount: extraInstallmentsLoan.principal_amount,
              client: extraInstallmentsLoan.client,
            }}
            onConfirm={addExtraInstallments}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
