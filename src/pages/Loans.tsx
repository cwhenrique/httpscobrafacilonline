import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLoans } from '@/hooks/useLoans';
import { useClients } from '@/hooks/useClients';
import { InterestType, LoanPaymentType, Client, Loan } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel, formatPercentage, calculateOverduePenalty, calculatePMT, calculatePureCompoundInterest, calculateRateFromPMT, generatePriceTable } from '@/lib/calculations';
import { ClientSelector } from '@/components/ClientSelector';
import { Plus, Minus, Search, Trash2, DollarSign, CreditCard, User, Calendar as CalendarIcon, Percent, RefreshCw, Camera, Clock, Pencil, FileText, Download, HelpCircle, History, Check, X, MessageCircle, ChevronDown, ChevronUp, Phone, MapPin, Mail, ListPlus, Bell, CheckCircle2, Table2, LayoutGrid, List, UserCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateContractReceipt, generatePaymentReceipt, generateOperationsReport, generatePriceTablePDF, ContractReceiptData, PaymentReceiptData, LoanOperationData, OperationsReportData, InstallmentDetail } from '@/lib/pdfGenerator';
import { useProfile } from '@/hooks/useProfile';
import ReceiptPreviewDialog from '@/components/ReceiptPreviewDialog';
import PaymentReceiptPrompt from '@/components/PaymentReceiptPrompt';
import LoanCreatedReceiptPrompt from '@/components/LoanCreatedReceiptPrompt';
import LoansPageTutorial from '@/components/tutorials/LoansPageTutorial';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import SendOverdueNotification from '@/components/SendOverdueNotification';
import SendDueTodayNotification from '@/components/SendDueTodayNotification';
import { SendEarlyNotification } from '@/components/SendEarlyNotification';
import AddExtraInstallmentsDialog from '@/components/AddExtraInstallmentsDialog';
import PriceTableDialog from '@/components/PriceTableDialog';
import { isHoliday } from '@/lib/holidays';
import { getAvatarUrl } from '@/lib/avatarUtils';
import { LoansTableView } from '@/components/LoansTableView';


// Helper para extrair pagamentos parciais do notes do loan
const getPartialPaymentsFromNotes = (notes: string | null): Record<number, number> => {
  const payments: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    payments[parseInt(match[1])] = parseFloat(match[2]);
  }
  return payments;
};

// Helper para extrair total de amortizações das notas do empréstimo
// Formato: [AMORTIZATION:valor_amortizado:novo_principal:novos_juros:data]
const getTotalAmortizationsFromNotes = (notes: string | null): number => {
  if (!notes) return 0;
  const amortizationMatches = notes.matchAll(/\[AMORTIZATION:([0-9.]+):/g);
  let total = 0;
  for (const match of amortizationMatches) {
    total += parseFloat(match[1]) || 0;
  }
  return total;
};

// Helper para calcular o valor efetivo da parcela considerando amortizações
// Se houve amortização, usa remaining_balance / parcelas_restantes
// Caso contrário, usa o cálculo normal (principal/parcelas + juros/parcelas)
const getEffectiveInstallmentValue = (
  loan: { 
    notes: string | null; 
    payment_type: string; 
    remaining_balance: number; 
    installments: number | null;
    principal_amount: number;
    total_interest: number | null;
  },
  normalInstallmentValue: number,
  paidInstallmentsCount: number
): number => {
  const totalAmortizations = getTotalAmortizationsFromNotes(loan.notes);
  const isDaily = loan.payment_type === 'daily';
  
  // Se houve amortização e não é empréstimo diário, usar remaining_balance
  if (totalAmortizations > 0 && !isDaily) {
    const numInstallments = loan.installments || 1;
    const remainingInstallments = Math.max(1, numInstallments - paidInstallmentsCount);
    return loan.remaining_balance / remainingInstallments;
  }
  
  return normalInstallmentValue;
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

// Helper para extrair total de juros históricos recebidos
// Suporta formato novo: [HISTORICAL_INTEREST_RECEIVED:valor]
// E formato antigo: [HISTORICAL_INTEREST:valor]
const getHistoricalInterestReceived = (notes: string | null): number => {
  const notesStr = notes || '';
  
  // Formato novo
  const newMatch = notesStr.match(/\[HISTORICAL_INTEREST_RECEIVED:([0-9.]+)\]/);
  if (newMatch) return parseFloat(newMatch[1]);
  
  // Formato antigo
  const oldMatch = notesStr.match(/\[HISTORICAL_INTEREST:([0-9.]+)\]/);
  if (oldMatch) return parseFloat(oldMatch[1]);
  
  return 0;
};

// Helper para extrair multas por parcela específica em contratos diários
// Formato: [DAILY_PENALTY:índice_parcela:valor]
const getDailyPenaltiesFromNotes = (notes: string | null): Record<number, number> => {
  const penalties: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[DAILY_PENALTY:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    penalties[parseInt(match[1])] = parseFloat(match[2]);
  }
  return penalties;
};

// Helper para calcular o total de todas as multas aplicadas
const getTotalDailyPenalties = (notes: string | null): number => {
  const penalties = getDailyPenaltiesFromNotes(notes);
  return Object.values(penalties).reduce((sum, val) => sum + val, 0);
};

// Helper para calcular multas cumulativas para TODAS as parcelas em atraso
interface OverdueInstallmentDetail {
  index: number;
  dueDate: string;
  daysOverdue: number;
}

interface CumulativePenaltyResult {
  totalPenalty: number;
  penaltyBreakdown: Array<{
    installmentNumber: number;
    daysOverdue: number;
    penaltyAmount: number;
    installmentAmount: number;
    totalWithPenalty: number;
  }>;
  totalOverdueAmount: number;
  totalWithPenalties: number;
}

const calculateCumulativePenalty = (
  overdueInstallmentsDetails: OverdueInstallmentDetail[],
  penaltyType: 'percentage' | 'fixed',
  penaltyValue: number,
  installmentValue: number,
  numInstallments: number
): CumulativePenaltyResult => {
  let totalPenalty = 0;
  let totalOverdueAmount = 0;
  const penaltyBreakdown: CumulativePenaltyResult['penaltyBreakdown'] = [];
  
  for (const detail of overdueInstallmentsDetails) {
    let penaltyForInstallment = 0;
    
    if (penaltyType === 'percentage') {
      penaltyForInstallment = (installmentValue * (penaltyValue / 100)) * detail.daysOverdue;
    } else {
      penaltyForInstallment = penaltyValue * detail.daysOverdue;
    }
    
    totalPenalty += penaltyForInstallment;
    totalOverdueAmount += installmentValue;
    
    penaltyBreakdown.push({
      installmentNumber: detail.index + 1,
      daysOverdue: detail.daysOverdue,
      penaltyAmount: penaltyForInstallment,
      installmentAmount: installmentValue,
      totalWithPenalty: installmentValue + penaltyForInstallment
    });
  }
  
  return { 
    totalPenalty, 
    penaltyBreakdown,
    totalOverdueAmount,
    totalWithPenalties: totalOverdueAmount + totalPenalty
  };
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
  } else if (loan.total_interest !== undefined && loan.total_interest !== null && (loan.total_interest > 0 || loan.interest_rate === 0)) {
    // Usar valor do banco quando disponível (inclui arredondamentos do usuário e juros 0%)
    totalInterest = loan.total_interest;
  } else if (loan.interest_mode === 'on_total') {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100);
  } else if (loan.interest_mode === 'compound') {
    // Juros compostos puros: M = P × (1 + i)^n
    totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
  } else {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
  }
  
  let principalPerInstallment = loan.principal_amount / numInstallments;
  let interestPerInstallment = totalInterest / numInstallments;
  let baseInstallmentValue = principalPerInstallment + interestPerInstallment;
  
  // 🆕 Se houve amortização, usar remaining_balance para calcular valor da parcela
  const totalAmortizations = getTotalAmortizationsFromNotes(loan.notes);
  if (totalAmortizations > 0 && !isDaily && 'remaining_balance' in loan) {
    const loanWithBalance = loan as typeof loan & { remaining_balance: number };
    const paidSoFar = getPaidInstallmentsCount({ ...loan, notes: '' }); // Evitar recursão
    const remainingInstallments = Math.max(1, numInstallments - paidSoFar);
    baseInstallmentValue = loanWithBalance.remaining_balance / remainingInstallments;
  }
  
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

// 🆕 Função para encontrar a parcela que vence EXATAMENTE hoje
// Retorna null se nenhuma parcela vence hoje
type LoanForTodayCheck = {
  installment_dates?: unknown;
  due_date: string;
};

const getTodayInstallmentInfo = (loan: LoanForTodayCheck): { installmentNumber: number; totalInstallments: number; dueDate: string } | null => {
  const today = new Date().toISOString().split('T')[0];
  const dates = (loan.installment_dates as string[]) || [];
  
  // Se não tem array de datas, verificar due_date única
  if (dates.length === 0) {
    if (loan.due_date === today) {
      return { installmentNumber: 1, totalInstallments: 1, dueDate: today };
    }
    return null;
  }
  
  // Encontrar qual parcela vence exatamente hoje
  const todayIndex = dates.findIndex(d => d === today);
  
  if (todayIndex === -1) {
    return null; // Nenhuma parcela vence hoje
  }
  
  return {
    installmentNumber: todayIndex + 1, // 1-indexed
    totalInstallments: dates.length,
    dueDate: today
  };
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
    totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
  } else {
    totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
  }
  
  let principalPerInstallment = loan.principal_amount / numInstallments;
  let interestPerInstallment = totalInterest / numInstallments;
  let baseInstallmentValue = principalPerInstallment + interestPerInstallment;
  
  // 🆕 Se houve amortização, usar remaining_balance para calcular valor da parcela
  const totalAmortizations = getTotalAmortizationsFromNotes(loan.notes);
  if (totalAmortizations > 0 && !isDaily && 'remaining_balance' in loan) {
    const loanWithBalance = loan as typeof loan & { remaining_balance: number };
    const remainingInstallments = Math.max(1, numInstallments);
    baseInstallmentValue = loanWithBalance.remaining_balance / remainingInstallments;
  }
  
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
  const { hasPermission, isEmployee } = useEmployeeContext();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterByEmployee, setFilterByEmployee] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'overdue' | 'renegotiated' | 'pending' | 'weekly' | 'biweekly' | 'installment' | 'single' | 'interest_only' | 'due_today'>('all');
  const [overdueDaysFilter, setOverdueDaysFilter] = useState<number | null>(null);
  const [customOverdueDays, setCustomOverdueDays] = useState<string>('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  
  // Query para buscar funcionários do dono (só para donos)
  const { data: myEmployees = [] } = useQuery({
    queryKey: ['my-employees', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('employee_user_id, name')
        .eq('owner_id', user?.id)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!user && !isEmployee,
  });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    const saved = localStorage.getItem('loans-view-mode');
    return saved === 'table' ? 'table' : 'cards';
  });
  const [dailyViewMode, setDailyViewMode] = useState<'cards' | 'table'>(() => {
    const saved = localStorage.getItem('daily-loans-view-mode');
    return saved === 'table' ? 'table' : 'cards';
  });
  const [activeTab, setActiveTab] = useState<'regular' | 'daily' | 'price'>('regular');
  const [isDailyDialogOpen, setIsDailyDialogOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPriceTableDialogOpen, setIsPriceTableDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [installmentDates, setInstallmentDates] = useState<string[]>([]);
  const [dailyDateMode, setDailyDateMode] = useState<'auto' | 'manual'>('auto');
  const [dailyFirstDate, setDailyFirstDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dailyInstallmentCount, setDailyInstallmentCount] = useState('20');
  const [skipSaturday, setSkipSaturday] = useState(false);
  const [skipSunday, setSkipSunday] = useState(false);
  const [skipHolidays, setSkipHolidays] = useState(false);
  
  // Estado para juros históricos simplificado
  const [historicalInterestReceived, setHistoricalInterestReceived] = useState('');
  const [historicalInterestNotes, setHistoricalInterestNotes] = useState('');
  
  // Estado para controlar expansão das parcelas em atraso
  const [expandedOverdueCards, setExpandedOverdueCards] = useState<Set<string>>(new Set());
  
  // Estados para a aba Tabela Price inline
  const [priceFormData, setPriceFormData] = useState({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    installments: '6',
    contract_date: format(new Date(), 'yyyy-MM-dd'),
    start_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    send_notification: false,
  });
  const [isGeneratingPricePDF, setIsGeneratingPricePDF] = useState(false);
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);
  
  // Cálculo da Tabela Price
  const priceTablePreview = useMemo(() => {
    const principal = parseFloat(priceFormData.principal_amount);
    const rate = parseFloat(priceFormData.interest_rate);
    const installments = parseInt(priceFormData.installments) || 1;

    if (!principal || principal <= 0 || !rate || rate <= 0 || installments <= 0) {
      return null;
    }

    return generatePriceTable(principal, rate, installments);
  }, [priceFormData.principal_amount, priceFormData.interest_rate, priceFormData.installments]);
  
  // Datas das parcelas Price
  const priceInstallmentDates = useMemo(() => {
    if (!priceFormData.start_date) return [];
    
    const numInstallments = parseInt(priceFormData.installments) || 1;
    const startDate = new Date(priceFormData.start_date + 'T12:00:00');
    const dates: string[] = [];
    
    for (let i = 0; i < numInstallments; i++) {
      const date = addMonths(startDate, i);
      dates.push(format(date, 'yyyy-MM-dd'));
    }
    
    return dates;
  }, [priceFormData.start_date, priceFormData.installments]);
  
  // Função para criar empréstimo Price
  const handlePriceTableSubmit = async () => {
    if (!priceFormData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }

    if (!priceTablePreview) {
      toast.error('Preencha os valores corretamente');
      return;
    }

    const principal = parseFloat(priceFormData.principal_amount);
    const rate = parseFloat(priceFormData.interest_rate);
    const installments = parseInt(priceFormData.installments);

    let notes = priceFormData.notes || '';
    notes = `[PRICE_TABLE]\n${notes}`;

    const result = await createLoan({
      client_id: priceFormData.client_id,
      principal_amount: principal,
      interest_rate: rate,
      interest_type: 'compound',
      interest_mode: 'compound',
      payment_type: 'installment',
      installments: installments,
      contract_date: priceFormData.contract_date,
      start_date: priceFormData.start_date,
      due_date: priceInstallmentDates[priceInstallmentDates.length - 1] || priceFormData.start_date,
      notes: notes.trim(),
      installment_dates: priceInstallmentDates,
      total_interest: priceTablePreview.totalInterest,
      send_creation_notification: priceFormData.send_notification,
    });

    if (result.data) {
      toast.success('Empréstimo Tabela Price criado com sucesso!');
      setPriceFormData({
        client_id: '',
        principal_amount: '',
        interest_rate: '',
        installments: '6',
        contract_date: format(new Date(), 'yyyy-MM-dd'),
        start_date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
        send_notification: false,
      });
    }
  };
  
  // Função para exportar PDF da Tabela Price
  const handlePriceExportPDF = async () => {
    if (!priceTablePreview) return;
    
    setIsGeneratingPricePDF(true);
    try {
      const selectedClient = clients.find(c => c.id === priceFormData.client_id);
      
      await generatePriceTablePDF({
        companyName: profile?.company_name || profile?.full_name || undefined,
        customLogoUrl: profile?.company_logo_url,
        clientName: selectedClient?.full_name,
        principal: parseFloat(priceFormData.principal_amount),
        interestRate: parseFloat(priceFormData.interest_rate),
        installments: parseInt(priceFormData.installments),
        pmt: priceTablePreview.pmt,
        rows: priceTablePreview.rows,
        totalPayment: priceTablePreview.totalPayment,
        totalInterest: priceTablePreview.totalInterest,
        installmentDates: priceInstallmentDates,
      });
      
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGeneratingPricePDF(false);
    }
  };
  
  const toggleOverdueExpand = (loanId: string) => {
    setExpandedOverdueCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(loanId)) {
        newSet.delete(loanId);
      } else {
        newSet.add(loanId);
      }
      return newSet;
    });
  };
  
  // Generate daily dates (consecutive days, optionally skipping weekends and holidays)
  const generateDailyDates = (startDate: string, count: number, skipSat = false, skipSun = false, skipHol = false): string[] => {
    const dates: string[] = [];
    let currentDate = new Date(startDate + 'T12:00:00');
    
    while (dates.length < count) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;
      const isHolidayDate = skipHol && isHoliday(currentDate);
      
      // Skip if it's a day we should skip
      if ((skipSat && isSaturday) || (skipSun && isSunday) || isHolidayDate) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };
  
  // Generate weekly dates (7 days apart, optionally skipping weekends and holidays)
  const generateWeeklyDates = (startDate: string, count: number, skipSat = false, skipSun = false, skipHol = false): string[] => {
    const dates: string[] = [];
    let currentDate = new Date(startDate + 'T12:00:00');
    
    for (let i = 0; i < count; i++) {
      // Avançar para a próxima data válida se cair em dia pulado
      while (
        (skipSat && currentDate.getDay() === 6) || 
        (skipSun && currentDate.getDay() === 0) || 
        (skipHol && isHoliday(currentDate))
      ) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      
      // Avançar 7 dias para próxima parcela
      currentDate.setDate(currentDate.getDate() + 7);
    }
    return dates;
  };
  
  // Generate biweekly dates (15 days apart, optionally skipping weekends and holidays)
  const generateBiweeklyDates = (startDate: string, count: number, skipSat = false, skipSun = false, skipHol = false): string[] => {
    const dates: string[] = [];
    let currentDate = new Date(startDate + 'T12:00:00');
    
    for (let i = 0; i < count; i++) {
      // Avançar para a próxima data válida se cair em dia pulado
      while (
        (skipSat && currentDate.getDay() === 6) || 
        (skipSun && currentDate.getDay() === 0) || 
        (skipHol && isHoliday(currentDate))
      ) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      
      // Avançar 15 dias para próxima parcela
      currentDate.setDate(currentDate.getDate() + 15);
    }
    return dates;
  };
  
  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem('loans-view-mode', viewMode);
  }, [viewMode]);
  
  // Persist daily view mode preference
  useEffect(() => {
    localStorage.setItem('daily-loans-view-mode', dailyViewMode);
  }, [dailyViewMode]);
  
  // Auto-generate dates when auto mode is active
  useEffect(() => {
    if (dailyDateMode === 'auto' && dailyFirstDate && dailyInstallmentCount) {
      const count = parseInt(dailyInstallmentCount) || 0;
      if (count > 0) {
        const generatedDates = generateDailyDates(dailyFirstDate, count, skipSaturday, skipSunday, skipHolidays);
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
  }, [dailyDateMode, dailyFirstDate, dailyInstallmentCount, skipSaturday, skipSunday, skipHolidays]);
  
  // Regenerate dates for the dedicated daily dialog when skip options change
  useEffect(() => {
    if (isDailyDialogOpen && formData.start_date && formData.daily_period && parseInt(formData.daily_period) > 0) {
      const newDates = generateDailyDates(formData.start_date, parseInt(formData.daily_period), skipSaturday, skipSunday, skipHolidays);
      setInstallmentDates(newDates);
      if (newDates.length > 0) {
        setFormData(prev => ({
          ...prev,
          due_date: newDates[newDates.length - 1],
          installments: newDates.length.toString()
        }));
      }
    }
  }, [skipSaturday, skipSunday, skipHolidays, isDailyDialogOpen]);
  
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
  const [paymentInstallmentDates, setPaymentInstallmentDates] = useState<string[]>([]);
  const [paymentPaidCount, setPaymentPaidCount] = useState<number>(0);

  // Loan created receipt prompt state
  const [isLoanCreatedOpen, setIsLoanCreatedOpen] = useState(false);
  const [loanCreatedData, setLoanCreatedData] = useState<{
    id: string;
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    principalAmount: number;
    interestRate: number;
    totalInterest: number;
    totalToReceive: number;
    installments: number;
    installmentValue: number;
    contractDate: string;
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
  const [editFormData, setEditFormData] = useState<{
    client_id: string;
    principal_amount: string;
    interest_rate: string;
    interest_type: InterestType;
    interest_mode: 'per_installment' | 'on_total' | 'compound';
    payment_type: LoanPaymentType;
    installments: string;
    contract_date: string;
    start_date: string;
    due_date: string;
    notes: string;
    daily_amount: string;
    overdue_daily_rate: string;
    overdue_fixed_amount: string;
    overdue_penalty_type: 'percentage' | 'fixed';
    apply_overdue_penalty: boolean;
    send_notification: boolean;
  }>({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'simple',
    interest_mode: 'per_installment',
    payment_type: 'single',
    installments: '1',
    contract_date: '',
    start_date: '',
    due_date: '',
    notes: '',
    daily_amount: '',
    overdue_daily_rate: '',
    overdue_fixed_amount: '',
    overdue_penalty_type: 'percentage',
    apply_overdue_penalty: false,
    send_notification: false,
  });
  const [editInstallmentDates, setEditInstallmentDates] = useState<string[]>([]);
  const [editInstallmentValue, setEditInstallmentValue] = useState('');
  const [isEditManuallyEditingInstallment, setIsEditManuallyEditingInstallment] = useState(false);
  const [editEditableTotalInterest, setEditEditableTotalInterest] = useState('');
  const [isEditManuallyEditingInterest, setIsEditManuallyEditingInterest] = useState(false);
  
  // Skip states for edit form
  const [editSkipSaturday, setEditSkipSaturday] = useState(false);
  const [editSkipSunday, setEditSkipSunday] = useState(false);
  const [editSkipHolidays, setEditSkipHolidays] = useState(false);
  
  // Inline penalty configuration states
  const [configuringPenaltyLoanId, setConfiguringPenaltyLoanId] = useState<string | null>(null);
  const [inlinePenaltyType, setInlinePenaltyType] = useState<'percentage' | 'fixed' | 'manual'>('percentage');
  const [inlinePenaltyValue, setInlinePenaltyValue] = useState('');
  
  // Edit due date inline states
  const [editingDueDateLoanId, setEditingDueDateLoanId] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);
  const [editingInstallmentIndex, setEditingInstallmentIndex] = useState<number | null>(null);
  
  // Manual penalty dialog state
  const [manualPenaltyDialog, setManualPenaltyDialog] = useState<{
    isOpen: boolean;
    loanId: string;
    currentNotes: string | null;
    penaltyMode: 'percentage' | 'fixed' | 'manual';
    overdueInstallments: Array<{
      index: number;
      dueDate: string;
      daysOverdue: number;
      installmentValue: number;
    }>;
  } | null>(null);
  const [manualPenaltyValues, setManualPenaltyValues] = useState<Record<number | string, string>>({});
  
  // Discount settlement state
  const [discountSettlementData, setDiscountSettlementData] = useState({
    receivedAmount: '',
    discountAmount: 0,
  });
  
  // Function to save inline penalty configuration
  const handleSaveInlinePenalty = async (
    loanId: string, 
    currentNotes: string | null, 
    startInstallmentIndex?: number, 
    daysOverdue?: number,
    installmentValue?: number,
    isDaily?: boolean
  ) => {
    try {
      // Clean old OVERDUE_CONFIG
      let cleanNotes = (currentNotes || '')
        .replace(/\[OVERDUE_CONFIG:[^\]]+\]/g, '')
        .trim();
      
      // Add new config
      const penaltyValue = parseFloat(inlinePenaltyValue) || 0;
      if (penaltyValue > 0) {
        const newConfig = `[OVERDUE_CONFIG:${inlinePenaltyType}:${penaltyValue}]`;
        cleanNotes = `${newConfig}\n${cleanNotes}`.trim();
        
        if (startInstallmentIndex !== undefined && daysOverdue && daysOverdue > 0) {
          if (isDaily) {
            // Para contratos diários, aplicar multa em TODAS as parcelas atrasadas
            // Calcular os dias de atraso de CADA parcela individualmente
            const loan = loans.find(l => l.id === loanId);
            const dates = (loan?.installment_dates as string[]) || [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Remover multas antigas de todas as parcelas que serão atualizadas
            for (let i = 0; i < daysOverdue; i++) {
              const idx = startInstallmentIndex + i;
              cleanNotes = cleanNotes.replace(new RegExp(`\\[DAILY_PENALTY:${idx}:[0-9.]+\\]\\n?`, 'g'), '');
            }
            
            // Adicionar multa para CADA parcela atrasada com cálculo individual
            // (ordem reversa para manter ordem correta nas notas)
            for (let i = daysOverdue - 1; i >= 0; i--) {
              const idx = startInstallmentIndex + i;
              const dueDate = dates[idx] ? new Date(dates[idx] + 'T12:00:00') : null;
              
              if (dueDate) {
                dueDate.setHours(0, 0, 0, 0);
                const daysLateForInstallment = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
                
                // Calcular multa total para esta parcela: dias de atraso × valor por dia
                let penaltyForInstallment = 0;
                if (inlinePenaltyType === 'percentage' && installmentValue) {
                  penaltyForInstallment = (installmentValue * (penaltyValue / 100)) * daysLateForInstallment;
                } else {
                  penaltyForInstallment = penaltyValue * daysLateForInstallment;
                }
                
                const dailyPenaltyTag = `[DAILY_PENALTY:${idx}:${penaltyForInstallment.toFixed(2)}]`;
                cleanNotes = `${dailyPenaltyTag}\n${cleanNotes}`.trim();
              }
            }
          } else {
            // Para contratos mensais/semanais/quinzenais, salvar UMA tag com o total da multa
            // Calcular o valor total da multa baseado no tipo
            let totalPenaltyAmount = 0;
            if (inlinePenaltyType === 'percentage' && installmentValue) {
              totalPenaltyAmount = (installmentValue * (penaltyValue / 100)) * daysOverdue;
            } else {
              totalPenaltyAmount = penaltyValue * daysOverdue;
            }
            
            // Remover multa antiga desta parcela específica
            cleanNotes = cleanNotes.replace(new RegExp(`\\[DAILY_PENALTY:${startInstallmentIndex}:[0-9.]+\\]\\n?`, 'g'), '');
            
            // Adicionar tag com o valor total da multa para a parcela em atraso
            const dailyPenaltyTag = `[DAILY_PENALTY:${startInstallmentIndex}:${totalPenaltyAmount.toFixed(2)}]`;
            cleanNotes = `${dailyPenaltyTag}\n${cleanNotes}`.trim();
          }
        }
      }
      
      // Calculate total penalties being added
      const newPenalties = getDailyPenaltiesFromNotes(cleanNotes);
      const oldPenalties = getDailyPenaltiesFromNotes(currentNotes || '');
      const newTotalPenalty = Object.values(newPenalties).reduce((sum, val) => sum + val, 0);
      const oldTotalPenalty = Object.values(oldPenalties).reduce((sum, val) => sum + val, 0);
      const penaltyDifference = newTotalPenalty - oldTotalPenalty;
      
      // Get current remaining_balance
      const loan = loans.find(l => l.id === loanId);
      const currentBalance = loan?.remaining_balance || 0;
      
      // Update in database - also adjust remaining_balance
      const { error } = await supabase
        .from('loans')
        .update({ 
          notes: cleanNotes,
          remaining_balance: currentBalance + penaltyDifference 
        })
        .eq('id', loanId);
      
      if (error) throw error;
      
      // Reset states and reload
      setConfiguringPenaltyLoanId(null);
      setInlinePenaltyValue('');
      fetchLoans();
      toast.success(`Multa aplicada com sucesso!`);
    } catch (error) {
      console.error('Error saving penalty:', error);
      toast.error('Erro ao salvar configuração de multa');
    }
  };
  
  // State for edit penalty dialog
  const [editPenaltyDialog, setEditPenaltyDialog] = useState<{
    isOpen: boolean;
    loanId: string;
    installmentIndex: number;
    currentValue: number;
    currentNotes: string | null;
  } | null>(null);
  const [editPenaltyValue, setEditPenaltyValue] = useState('');

  // Function to remove penalty from specific daily installment
  const handleRemoveDailyPenalty = async (loanId: string, installmentIndex: number, currentNotes: string | null) => {
    try {
      // Get the penalty value being removed
      const oldPenalties = getDailyPenaltiesFromNotes(currentNotes);
      const penaltyBeingRemoved = oldPenalties[installmentIndex] || 0;
      
      const regex = new RegExp(`\\[DAILY_PENALTY:${installmentIndex}:[0-9.]+\\]\\n?`, 'g');
      const cleanNotes = (currentNotes || '').replace(regex, '').trim();
      
      // Get current remaining_balance
      const loan = loans.find(l => l.id === loanId);
      const currentBalance = loan?.remaining_balance || 0;
      
      const { error } = await supabase
        .from('loans')
        .update({ 
          notes: cleanNotes,
          remaining_balance: currentBalance - penaltyBeingRemoved
        })
        .eq('id', loanId);
      
      if (error) throw error;
      
      fetchLoans();
      toast.success('Multa removida com sucesso!');
    } catch (error) {
      console.error('Error removing penalty:', error);
      toast.error('Erro ao remover multa');
    }
  };

  // Function to edit penalty for specific daily installment
  const handleEditDailyPenalty = async (
    loanId: string, 
    installmentIndex: number, 
    newPenaltyValue: number,
    currentNotes: string | null
  ) => {
    try {
      // Get the old penalty value for this installment
      const oldPenalties = getDailyPenaltiesFromNotes(currentNotes);
      const oldPenaltyValue = oldPenalties[installmentIndex] || 0;
      const penaltyDifference = newPenaltyValue - oldPenaltyValue;
      
      // Remove old penalty for this installment
      const regex = new RegExp(`\\[DAILY_PENALTY:${installmentIndex}:[0-9.]+\\]\\n?`, 'g');
      let cleanNotes = (currentNotes || '').replace(regex, '').trim();
      
      // Add new penalty with edited value
      if (newPenaltyValue > 0) {
        const dailyPenaltyTag = `[DAILY_PENALTY:${installmentIndex}:${newPenaltyValue.toFixed(2)}]`;
        cleanNotes = `${dailyPenaltyTag}\n${cleanNotes}`.trim();
      }
      
      // Get current remaining_balance
      const loan = loans.find(l => l.id === loanId);
      const currentBalance = loan?.remaining_balance || 0;
      
      const { error } = await supabase
        .from('loans')
        .update({ 
          notes: cleanNotes,
          remaining_balance: currentBalance + penaltyDifference
        })
        .eq('id', loanId);
      
      if (error) throw error;
      
      fetchLoans();
      toast.success('Multa atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating penalty:', error);
      toast.error('Erro ao atualizar multa');
    }
  };
  
  // Function to save manual penalties
  const handleSaveManualPenalties = async () => {
    if (!manualPenaltyDialog) return;
    
    try {
      // Get old penalties before modifying
      const oldPenalties = getDailyPenaltiesFromNotes(manualPenaltyDialog.currentNotes);
      const oldTotalPenalty = Object.values(oldPenalties).reduce((sum, val) => sum + val, 0);
      
      let cleanNotes = (manualPenaltyDialog.currentNotes || '')
        .replace(/\[OVERDUE_CONFIG:[^\]]+\]/g, '')
        .trim();
      
      // Se for modo dinâmico (% por dia ou R$/dia), salva a configuração no campo de config
      if (manualPenaltyDialog.penaltyMode === 'percentage' || manualPenaltyDialog.penaltyMode === 'fixed') {
        const dynamicValue = parseFloat(manualPenaltyValues['dynamic'] || '0');
        
        if (dynamicValue > 0) {
          // Remove multas manuais antigas
          for (const inst of manualPenaltyDialog.overdueInstallments) {
            cleanNotes = cleanNotes.replace(
              new RegExp(`\\[DAILY_PENALTY:${inst.index}:[0-9.]+\\]\\n?`, 'g'), 
              ''
            );
          }
          cleanNotes = cleanNotes.trim();
          
          // Adiciona configuração de multa dinâmica
          const configTag = `[OVERDUE_CONFIG:${manualPenaltyDialog.penaltyMode}:${dynamicValue}]`;
          cleanNotes = `${configTag}\n${cleanNotes}`.trim();
        }
      } else {
        // Modo manual: aplica multa por parcela
        for (const inst of manualPenaltyDialog.overdueInstallments) {
          const enteredValue = parseFloat(manualPenaltyValues[inst.index] || '0');
          
          // Remove old penalty for this installment
          cleanNotes = cleanNotes.replace(
            new RegExp(`\\[DAILY_PENALTY:${inst.index}:[0-9.]+\\]\\n?`, 'g'), 
            ''
          );
          
          if (enteredValue > 0) {
            // Add new FIXED penalty
            const penaltyTag = `[DAILY_PENALTY:${inst.index}:${enteredValue.toFixed(2)}]`;
            cleanNotes = `${penaltyTag}\n${cleanNotes}`.trim();
          }
        }
      }
      
      // Calculate new total penalties and difference
      const newPenalties = getDailyPenaltiesFromNotes(cleanNotes);
      const newTotalPenalty = Object.values(newPenalties).reduce((sum, val) => sum + val, 0);
      const penaltyDifference = newTotalPenalty - oldTotalPenalty;
      
      // Get current remaining_balance
      const loan = loans.find(l => l.id === manualPenaltyDialog.loanId);
      const currentBalance = loan?.remaining_balance || 0;
      
      // Save to database with updated remaining_balance
      const { error } = await supabase
        .from('loans')
        .update({ 
          notes: cleanNotes,
          remaining_balance: currentBalance + penaltyDifference
        })
        .eq('id', manualPenaltyDialog.loanId);
      
      if (error) throw error;
      
      setManualPenaltyDialog(null);
      setManualPenaltyValues({});
      fetchLoans();
      toast.success('Multas aplicadas com sucesso!');
    } catch (error) {
      console.error('Error saving manual penalties:', error);
      toast.error('Erro ao aplicar multas');
    }
  };

  // Function to open manual penalty dialog
  const openManualPenaltyDialog = (
    loan: any, 
    overdueInstallments: Array<{ index: number; dueDate: string; daysOverdue: number }>,
    installmentValue: number
  ) => {
    // Buscar multas já aplicadas para pré-preencher
    const existingPenalties = getDailyPenaltiesFromNotes(loan.notes);
    
    setManualPenaltyDialog({
      isOpen: true,
      loanId: loan.id,
      currentNotes: loan.notes,
      penaltyMode: 'manual', // Padrão é modo manual (por parcela)
      overdueInstallments: overdueInstallments.map(inst => ({
        ...inst,
        installmentValue
      }))
    });
    
    // Preencher os valores existentes das multas
    const initialValues: Record<number | string, string> = {};
    Object.entries(existingPenalties).forEach(([idx, value]) => {
      initialValues[parseInt(idx)] = value.toString();
    });
    setManualPenaltyValues(initialValues);
    setConfiguringPenaltyLoanId(null);
  };
  
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
            let date: Date;
            if (editFormData.payment_type === 'weekly') {
              date = new Date(startDate);
              date.setDate(date.getDate() + (i * 7));
            } else if (editFormData.payment_type === 'biweekly') {
              date = new Date(startDate);
              date.setDate(date.getDate() + (i * 15));
            } else {
              // Monthly (installment) - usar addMonths do date-fns
              date = addMonths(startDate, i);
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
    if (isEditManuallyEditingInstallment || isEditManuallyEditingInterest) return;
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
        // Juros compostos puros: M = P × (1 + i)^n - P
        totalInterest = principal * Math.pow(1 + (rate / 100), numInstallments) - principal;
      } else {
        // per_installment
        totalInterest = principal * (rate / 100) * numInstallments;
      }
      const total = principal + totalInterest;
      setEditInstallmentValue((total / numInstallments).toFixed(2));
    }
  }, [editFormData.principal_amount, editFormData.installments, editFormData.interest_rate, editFormData.interest_mode, editFormData.payment_type, isEditDialogOpen, isEditManuallyEditingInstallment, isEditManuallyEditingInterest]);
  
  // Reset manual editing flags when base values change in edit form
  useEffect(() => {
    if (!isEditDialogOpen) return;
    setIsEditManuallyEditingInstallment(false);
    setIsEditManuallyEditingInterest(false);
    setEditEditableTotalInterest('');
  }, [editFormData.principal_amount, editFormData.installments, editFormData.interest_mode, editFormData.payment_type]);
  
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

  // Handle inline due date update from card
  const handleUpdateDueDate = async (loanId: string, newDateStr: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;

    const currentDates = (loan.installment_dates as string[]) || [];
    const paidCount = getPaidInstallmentsCount(loan);
    
    // Update the next unpaid installment date
    const updatedDates = [...currentDates];
    if (paidCount < updatedDates.length) {
      updatedDates[paidCount] = newDateStr;
    }

    // Calculate new due_date (last installment or the new date)
    const newDueDateForLoan = updatedDates.length > 0 
      ? updatedDates[updatedDates.length - 1] 
      : newDateStr;

    try {
      const { error } = await supabase
        .from('loans')
        .update({
          installment_dates: updatedDates,
          due_date: newDueDateForLoan,
        })
        .eq('id', loanId);

      if (error) {
        toast.error('Erro ao atualizar data');
        return;
      }

      toast.success('Data de vencimento atualizada!');
      setEditingDueDateLoanId(null);
      setNewDueDate(undefined);
      fetchLoans();
    } catch (err) {
      toast.error('Erro ao atualizar data');
    }
  };

  // Handle update of a specific installment date (for daily loans)
  const handleUpdateSpecificDate = async (loanId: string, index: number, newDateStr: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;

    const currentDates = (loan.installment_dates as string[]) || [];
    const updatedDates = [...currentDates];
    
    // Verificar se é empréstimo diário (só diário tem cascata)
    const isDaily = loan.payment_type === 'daily';
    
    // Atualizar a data da parcela selecionada
    updatedDates[index] = newDateStr;
    
    let diffDays = 0;
    
    // CASCATA: Mover todas as parcelas SEGUINTES apenas para empréstimos DIÁRIOS
    if (isDaily) {
      const oldDate = new Date(currentDates[index] + 'T12:00:00');
      const newDate = new Date(newDateStr + 'T12:00:00');
      diffDays = Math.round((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
      
      for (let i = index + 1; i < updatedDates.length; i++) {
        const originalDate = new Date(currentDates[i] + 'T12:00:00');
        originalDate.setDate(originalDate.getDate() + diffDays);
        updatedDates[i] = format(originalDate, 'yyyy-MM-dd');
      }
    }
    // Para mensal/semanal/quinzenal: só atualiza a parcela específica (sem cascata)

    // Atualizar due_date para a última data do array
    const newDueDateForLoan = updatedDates[updatedDates.length - 1];

    try {
      const { error } = await supabase
        .from('loans')
        .update({
          installment_dates: updatedDates,
          due_date: newDueDateForLoan,
        })
        .eq('id', loanId);

      if (error) {
        toast.error('Erro ao atualizar data');
        return;
      }

      // Mensagem de sucesso diferente para diário (com cascata) vs outros (sem cascata)
      if (isDaily && updatedDates.length > index + 1) {
        const diffText = diffDays > 0 ? `+${diffDays}` : `${diffDays}`;
        toast.success(`Data atualizada! (${diffText} dias aplicado às ${updatedDates.length - index - 1} parcelas seguintes)`);
      } else {
        toast.success('Data da parcela atualizada!');
      }
      
      setEditingInstallmentIndex(null);
      setNewDueDate(undefined);
      fetchLoans(); // Recarrega e recalcula status automaticamente (sai do atraso se data for futura)
    } catch (err) {
      toast.error('Erro ao atualizar data');
    }
  };

  // Dialog open handler - reset form when opening or closing
  const handleDialogOpen = (open: boolean) => {
    if (open) {
      resetForm(); // Reset to defaults (installments: '1') when opening
    }
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
  
  // Estado para edição completa de empréstimos diários
  const [editingDailyLoanId, setEditingDailyLoanId] = useState<string | null>(null);


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
    daily_interest_rate: '', // Taxa de juros para empréstimo diário
    is_historical_contract: false, // Contract being registered retroactively
    send_creation_notification: false, // Send WhatsApp notification on creation (default: off)
  });
  
  // Handlers para sincronização bidirecional do empréstimo diário
  const handleDailyAmountChange = (value: string) => {
    const dailyAmount = parseFloat(value) || 0;
    const principal = parseFloat(formData.principal_amount) || 0;
    const numInstallments = installmentDates.length || parseInt(formData.daily_period) || 1;
    
    if (dailyAmount > 0 && principal > 0 && numInstallments > 0) {
      const totalToReceive = dailyAmount * numInstallments;
      const profit = totalToReceive - principal;
      const interestRate = (profit / principal) * 100;
      
      setFormData(prev => ({ 
        ...prev, 
        daily_amount: value,
        daily_interest_rate: interestRate.toFixed(2)
      }));
    } else {
      setFormData(prev => ({ ...prev, daily_amount: value }));
    }
  };
  
  const handleDailyInterestChange = (value: string) => {
    const interestRate = parseFloat(value) || 0;
    const principal = parseFloat(formData.principal_amount) || 0;
    const numInstallments = installmentDates.length || parseInt(formData.daily_period) || 1;
    
    if (principal > 0 && numInstallments > 0 && interestRate >= 0) {
      const totalInterest = principal * (interestRate / 100);
      const totalToReceive = principal + totalInterest;
      const dailyAmount = totalToReceive / numInstallments;
      
      setFormData(prev => ({ 
        ...prev, 
        daily_interest_rate: value,
        daily_amount: dailyAmount.toFixed(2)
      }));
    } else {
      setFormData(prev => ({ ...prev, daily_interest_rate: value }));
    }
  };
  
  const handleDailyPrincipalChange = (value: string) => {
    const principal = parseFloat(value) || 0;
    const interestRate = parseFloat(formData.daily_interest_rate) || 0;
    const numInstallments = installmentDates.length || parseInt(formData.daily_period) || 1;
    
    // Se já há uma taxa de juros definida, recalcular a parcela
    if (principal > 0 && interestRate > 0 && numInstallments > 0) {
      const totalInterest = principal * (interestRate / 100);
      const totalToReceive = principal + totalInterest;
      const dailyAmount = totalToReceive / numInstallments;
      
      setFormData(prev => ({ 
        ...prev, 
        principal_amount: value,
        daily_amount: dailyAmount.toFixed(2)
      }));
    } else {
      setFormData(prev => ({ ...prev, principal_amount: value }));
    }
  };
  
  // Estado removido - agora usa historicalInterestReceived e historicalInterestNotes definidos anteriormente
  
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
    
    // Fallback for biweekly when installmentDates not yet generated
    // Check start_date directly to show historical contract option
    if (formData.payment_type === 'biweekly' && formData.start_date && installmentDates.length === 0) {
      const startDate = new Date(formData.start_date + 'T12:00:00');
      return startDate < today;
    }
    
    if (formData.due_date) {
      const dueDate = new Date(formData.due_date + 'T12:00:00');
      return dueDate < today;
    }
    
    return false;
  })();
  
  const [installmentValue, setInstallmentValue] = useState('');
  const [isManuallyEditingInstallment, setIsManuallyEditingInstallment] = useState(false);
  const [editableTotalInterest, setEditableTotalInterest] = useState('');
  const [isManuallyEditingInterest, setIsManuallyEditingInterest] = useState(false);
  
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
        // Juros compostos puros: M = P × (1 + i)^n - P
        totalInterest = principal * Math.pow(1 + (rate / 100), numInstallments) - principal;
        const total = principal + totalInterest;
        setInstallmentValue((total / numInstallments).toFixed(2));
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
    setIsManuallyEditingInterest(false);
    setEditableTotalInterest('');
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
        // Juros compostos puros: M = P × (1 + i)^n - P
        totalInterest = principal * Math.pow(1 + (rate / 100), numInstallments) - principal;
      } else {
        // on_total
        totalInterest = principal * (rate / 100);
      }
    }

    if (totalInterest === null || !isFinite(totalInterest)) return 'R$ 0,00';
    return formatCurrency(totalInterest);
  };
  
  // Função para obter valor numérico do juros total (usado no campo editável)
  const getTotalInterestRawValue = () => {
    if (!formData.principal_amount) return '';
    const principal = parseFloat(formData.principal_amount);
    const numInstallments = parseInt(formData.installments || '1');
    let totalInterest = 0;

    // Se o usuário editou o valor da parcela, usamos ele como base
    if ((formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly') && installmentValue) {
      const perInstallment = parseFloat(installmentValue);
      if (!perInstallment) return '';
      totalInterest = perInstallment * numInstallments - principal;
    } else if (formData.interest_rate) {
      const rate = parseFloat(formData.interest_rate);
      if (formData.interest_mode === 'per_installment') {
        totalInterest = principal * (rate / 100) * numInstallments;
      } else if (formData.interest_mode === 'compound') {
        totalInterest = principal * Math.pow(1 + (rate / 100), numInstallments) - principal;
      } else {
        totalInterest = principal * (rate / 100);
      }
    }

    return totalInterest > 0 ? totalInterest.toFixed(2) : '';
  };
  
  // Handler para quando o usuário edita o juros total manualmente
  const handleTotalInterestChange = (value: string) => {
    setIsManuallyEditingInterest(true);
    setIsManuallyEditingInstallment(true);
    setEditableTotalInterest(value);
    
    const newTotalInterest = parseFloat(value);
    if (!newTotalInterest || !formData.principal_amount || !formData.installments) return;
    
    const principal = parseFloat(formData.principal_amount);
    const numInstallments = parseInt(formData.installments) || 1;
    
    // Calcular novo valor da parcela
    const totalToReceive = principal + newTotalInterest;
    const newInstallmentValue = totalToReceive / numInstallments;
    setInstallmentValue(newInstallmentValue.toFixed(2));
    
    // Recalcular taxa de juros baseada no modo
    let newRate: number;
    if (formData.interest_mode === 'per_installment') {
      newRate = (newTotalInterest / principal / numInstallments) * 100;
    } else if (formData.interest_mode === 'compound') {
      // Juros compostos puros: inverter M = P × (1+r)^n => r = (M/P)^(1/n) - 1
      // onde M = P + totalInterest
      newRate = (Math.pow((newTotalInterest / principal) + 1, 1 / numInstallments) - 1) * 100;
    } else {
      // on_total
      newRate = (newTotalInterest / principal) * 100;
    }
    
    if (newRate >= 0 && isFinite(newRate)) {
      setFormData(prev => ({ ...prev, interest_rate: newRate.toFixed(2) }));
    }
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
      // Juros compostos puros: inverter M = P × (1+r)^n => r = (M/P)^(1/n) - 1
      // onde M = P + totalInterest = totalToReceive
      newRate = (Math.pow(totalToReceive / principal, 1 / numInstallments) - 1) * 100;
    } else {
      // on_total
      newRate = (totalInterest / principal) * 100;
    }
    
    // Permite qualquer taxa >= 0 (arredondamentos podem resultar em taxas baixas)
    if (newRate >= 0 && isFinite(newRate)) {
      setFormData(prev => ({ ...prev, interest_rate: newRate.toFixed(2) }));
    }
    // Ao editar a parcela, também marca que o juros foi ajustado manualmente
    setIsManuallyEditingInterest(true);
    setEditableTotalInterest(totalInterest.toFixed(2));
  };

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    new_due_date: '', // Nova data de vencimento (opcional)
    payment_type: 'partial' as 'partial' | 'total' | 'installment' | 'discount',
    selected_installments: [] as number[],
    partial_installment_index: null as number | null, // Índice da parcela para pagamento parcial
    send_notification: false, // Enviar notificação WhatsApp (desativado por padrão)
    is_advance_payment: false, // Flag para adiantamento de pagamento
    recalculate_interest: false, // Flag para recalcular juros sobre saldo devedor
  });

  // Generate monthly installment dates
  const generateMonthlyDates = (startDateStr: string, count: number, skipSat = false, skipSun = false, skipHol = false): string[] => {
    const dates: string[] = [];
    const startDate = new Date(startDateStr + 'T12:00:00');
    const startDay = startDate.getDate();
    
    for (let i = 0; i < count; i++) {
      // Usar addMonths do date-fns para evitar bugs na virada de ano/mês
      let date = addMonths(startDate, i);
      
      // Skip weekends and holidays if marked
      while (
        (skipSat && date.getDay() === 6) || 
        (skipSun && date.getDay() === 0) || 
        (skipHol && isHoliday(date))
      ) {
        date.setDate(date.getDate() + 1);
      }
      
      dates.push(format(date, 'yyyy-MM-dd'));
    }
    return dates;
  };

  // Generate installment dates when start_date or installments change
  useEffect(() => {
    if (formData.payment_type === 'installment' && formData.start_date) {
      const numInstallments = parseInt(formData.installments) || 1;
      const newDates = generateMonthlyDates(formData.start_date, numInstallments, skipSaturday, skipSunday, skipHolidays);
      
      setInstallmentDates(newDates);
      // Set the last installment date as the due_date
      if (newDates.length > 0) {
        setFormData(prev => ({ ...prev, due_date: newDates[newDates.length - 1] }));
      }
    }
  }, [formData.payment_type, formData.start_date, formData.installments, skipSaturday, skipSunday, skipHolidays]);

  // Generate weekly dates when start_date or installments change
  useEffect(() => {
    if (formData.payment_type === 'weekly' && formData.start_date) {
      const numInstallments = parseInt(formData.installments) || 1;
      const newDates = generateWeeklyDates(formData.start_date, numInstallments, skipSaturday, skipSunday, skipHolidays);
      
      setInstallmentDates(newDates);
      // Set the last installment date as the due_date
      if (newDates.length > 0) {
        setFormData(prev => ({ ...prev, due_date: newDates[newDates.length - 1] }));
      }
    }
  }, [formData.payment_type, formData.start_date, formData.installments, skipSaturday, skipSunday, skipHolidays]);

  // Generate biweekly dates when start_date or installments change
  useEffect(() => {
    if (formData.payment_type === 'biweekly' && formData.start_date) {
      const numInstallments = parseInt(formData.installments) || 1;
      const newDates = generateBiweeklyDates(formData.start_date, numInstallments, skipSaturday, skipSunday, skipHolidays);
      
      setInstallmentDates(newDates);
      // Set the last installment date as the due_date
      if (newDates.length > 0) {
        setFormData(prev => ({ ...prev, due_date: newDates[newDates.length - 1] }));
      }
    }
  }, [formData.payment_type, formData.start_date, formData.installments, skipSaturday, skipSunday, skipHolidays]);

  // Reset dates when switching to daily payment type
  useEffect(() => {
    if (formData.payment_type === 'daily') {
      // In auto mode, generate dates; in manual mode, clear for manual selection
      if (dailyDateMode === 'auto' && dailyFirstDate && dailyInstallmentCount) {
        const count = parseInt(dailyInstallmentCount) || 20;
        const generatedDates = generateDailyDates(dailyFirstDate, count, skipSaturday, skipSunday, skipHolidays);
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
    } else if (loan.total_interest !== undefined && loan.total_interest !== null && (loan.total_interest > 0 || loan.interest_rate === 0)) {
      // Usar valor do banco quando disponível (inclui arredondamentos do usuário e juros 0%)
      totalInterest = loan.total_interest;
      totalToReceive = loan.principal_amount + totalInterest;
    } else if (loan.interest_mode === 'on_total') {
      totalInterest = loan.principal_amount * (loan.interest_rate / 100);
      totalToReceive = loan.principal_amount + totalInterest;
    } else if (loan.interest_mode === 'compound') {
      // Juros compostos puros: M = P × (1 + i)^n - P
      totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
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
    const isHistoricalInterestContract = loan.notes?.includes('[HISTORICAL_INTEREST_CONTRACT]');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let isOverdue = false;
    let overdueInstallmentIndex = -1;
    let overdueDate = '';
    let daysOverdue = 0;
    
    // NOVO: Array com detalhes de TODAS as parcelas em atraso
    const overdueInstallmentsDetails: Array<{
      index: number;
      dueDate: string;
      daysOverdue: number;
    }> = [];
    
    if (!isPaid && remainingToReceive > 0) {
      const paidInstallments = getPaidInstallmentsCount(loan);
      const dates = (loan.installment_dates as string[]) || [];
      
      // Para empréstimos diários, verificar TODAS as parcelas não pagas que já venceram
      if (isDaily && dates.length > 0) {
        for (let i = paidInstallments; i < dates.length; i++) {
          const installmentDueDate = new Date(dates[i] + 'T12:00:00');
          installmentDueDate.setHours(0, 0, 0, 0);
          
          if (today > installmentDueDate) {
            const daysDiff = Math.ceil((today.getTime() - installmentDueDate.getTime()) / (1000 * 60 * 60 * 24));
            overdueInstallmentsDetails.push({
              index: i,
              dueDate: dates[i],
              daysOverdue: daysDiff
            });
          } else {
            // Parcelas futuras - não estão em atraso
            break;
          }
        }
        
        // Se há parcelas em atraso, definir os valores da primeira (para compatibilidade)
        if (overdueInstallmentsDetails.length > 0) {
          isOverdue = true;
          overdueInstallmentIndex = overdueInstallmentsDetails[0].index;
          overdueDate = overdueInstallmentsDetails[0].dueDate;
          daysOverdue = overdueInstallmentsDetails[0].daysOverdue;
        }
      } else {
        // Lógica para empréstimos NÃO diários (mantém comportamento original)
        let nextDueDateStr: string | null = null;
        
        if (dates.length > 0) {
          if (paidInstallments < dates.length) {
            nextDueDateStr = dates[paidInstallments];
            overdueInstallmentIndex = paidInstallments;
          } else {
            nextDueDateStr = dates[dates.length - 1];
            overdueInstallmentIndex = dates.length - 1;
          }
        } else {
          nextDueDateStr = loan.due_date;
        }
        
        if (nextDueDateStr) {
          const nextDueDate = new Date(nextDueDateStr + 'T12:00:00');
          nextDueDate.setHours(0, 0, 0, 0);
          
          if (isHistoricalContract || isHistoricalInterestContract) {
            const futureDates = dates.filter(d => {
              const date = new Date(d + 'T12:00:00');
              date.setHours(0, 0, 0, 0);
              return date > today;
            });
            
            if (futureDates.length === 0 && paidInstallments < dates.length) {
              const overdueCheckDate = new Date(dates[paidInstallments] + 'T12:00:00');
              overdueCheckDate.setHours(0, 0, 0, 0);
              isOverdue = today > overdueCheckDate;
              if (isOverdue) {
                overdueDate = dates[paidInstallments];
                daysOverdue = Math.ceil((today.getTime() - overdueCheckDate.getTime()) / (1000 * 60 * 60 * 24));
              }
            } else if (futureDates.length > 0) {
              if (paidInstallments < dates.length) {
                const nextUnpaidDate = dates[paidInstallments];
                const nextUnpaidDateObj = new Date(nextUnpaidDate + 'T12:00:00');
                nextUnpaidDateObj.setHours(0, 0, 0, 0);
                isOverdue = today > nextUnpaidDateObj;
                if (isOverdue) {
                  overdueDate = nextUnpaidDate;
                  overdueInstallmentIndex = paidInstallments;
                  daysOverdue = Math.ceil((today.getTime() - nextUnpaidDateObj.getTime()) / (1000 * 60 * 60 * 24));
                }
              }
            } else if (dates.length === 0) {
              const dueDate = new Date(loan.due_date + 'T12:00:00');
              dueDate.setHours(0, 0, 0, 0);
              isOverdue = today > dueDate;
              if (isOverdue) {
                overdueDate = loan.due_date;
                daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              }
            }
          } else {
            isOverdue = today > nextDueDate;
            if (isOverdue) {
              overdueDate = nextDueDateStr;
              daysOverdue = Math.ceil((today.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
            }
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
      totalPerInstallment,
      overdueInstallmentsDetails
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
    
    // Filtro por funcionário criador (só para donos)
    if (filterByEmployee) {
      if (filterByEmployee === 'owner') {
        // Criados pelo dono (created_by === user_id)
        if (loan.created_by !== loan.user_id) return false;
      } else {
        // Criados por um funcionário específico
        if (loan.created_by !== filterByEmployee) return false;
      }
    }
    
    if (statusFilter === 'all') return true;
    
    const { isPaid, isRenegotiated, isOverdue } = getLoanStatus(loan);
    const isInterestOnlyPayment = loan.notes?.includes('[INTEREST_ONLY_PAYMENT]') && !isPaid;
    
    switch (statusFilter) {
      case 'paid':
        return isPaid;
      case 'overdue':
        if (!isOverdue || isPaid) return false;
        // Aplicar subfiltro de dias se selecionado
        if (overdueDaysFilter !== null) {
          const { daysOverdue } = getLoanStatus(loan);
          switch (overdueDaysFilter) {
            case 5: return daysOverdue >= 1 && daysOverdue <= 5;
            case 10: return daysOverdue >= 6 && daysOverdue <= 10;
            case 15: return daysOverdue >= 11 && daysOverdue <= 15;
            case 30: return daysOverdue >= 16 && daysOverdue <= 30;
            case 60: return daysOverdue >= 31 && daysOverdue <= 60;
            case 999: return daysOverdue > 60;
            case -1: // Personalizado
              const customDays = parseInt(customOverdueDays);
              if (!isNaN(customDays) && customDays > 0) {
                return daysOverdue === customDays;
              }
              return true;
            default: return true;
          }
        }
        return true;
      case 'renegotiated':
        return isRenegotiated && !isPaid && !isOverdue && !isInterestOnlyPayment;
      case 'pending':
        // Mostrar todos os empréstimos pendentes, independente do tipo de pagamento
        return !isPaid && !isOverdue && !isRenegotiated && !isInterestOnlyPayment;
      case 'weekly':
        return loan.payment_type === 'weekly' && !isPaid;
      case 'biweekly':
        return loan.payment_type === 'biweekly' && !isPaid;
      case 'installment':
        return loan.payment_type === 'installment' && !isPaid;
      case 'single':
        return loan.payment_type === 'single' && !isPaid;
      case 'interest_only':
        return isInterestOnlyPayment && !isOverdue;
      case 'due_today':
        // Empréstimos com parcela vencendo hoje
        const today = format(new Date(), 'yyyy-MM-dd');
        if (isPaid) return false;
        
        // Verificar due_date do empréstimo
        if (loan.due_date === today) return true;
        
        // Verificar installment_dates para empréstimos parcelados
        if (loan.installment_dates && Array.isArray(loan.installment_dates)) {
          const paidCount = getPaidInstallmentsCount(loan);
          const unpaidDates = (loan.installment_dates as string[]).slice(paidCount);
          return unpaidDates.some(date => date === today);
        }
        
        return false;
      default:
        return true;
    }
  });

  // Helper para obter a próxima data de vencimento de um empréstimo
  const getNextDueDate = (loan: typeof loans[0]): Date | null => {
    const paidCount = getPaidInstallmentsCount(loan);
    const dates = (loan.installment_dates as string[]) || [];
    
    // Para empréstimos com múltiplas parcelas
    if (dates.length > 0) {
      const unpaidDates = dates.slice(paidCount);
      if (unpaidDates.length > 0) {
        return new Date(unpaidDates[0] + 'T12:00:00');
      }
      return null; // Todas as parcelas pagas
    }
    
    // Para empréstimo à vista ou parcela única
    if (loan.due_date) {
      return new Date(loan.due_date + 'T12:00:00');
    }
    
    return null;
  };

  // Ordenar empréstimos por próximo vencimento
  const sortedLoans = useMemo(() => {
    return [...filteredLoans].sort((a, b) => {
      const { isPaid: isPaidA } = getLoanStatus(a);
      const { isPaid: isPaidB } = getLoanStatus(b);
      
      // Empréstimos pagos vão para o final
      if (isPaidA && !isPaidB) return 1;
      if (!isPaidA && isPaidB) return -1;
      if (isPaidA && isPaidB) {
        // Ambos pagos: ordenar por data de criação (mais recente primeiro)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      
      // Empréstimos não pagos: ordenar por próximo vencimento
      const nextDueDateA = getNextDueDate(a);
      const nextDueDateB = getNextDueDate(b);
      
      if (!nextDueDateA && !nextDueDateB) return 0;
      if (!nextDueDateA) return 1;
      if (!nextDueDateB) return -1;
      
      // Vencimentos mais próximos primeiro (incluindo vencidos/atrasados no topo)
      return nextDueDateA.getTime() - nextDueDateB.getTime();
    });
  }, [filteredLoans]);

  const loanClients = clients.filter(c => c.client_type === 'loan' || c.client_type === 'both');

  // Função para abrir o diálogo de edição completa de empréstimos diários
  const openDailyEditDialog = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    // Limpar notas de tags internas para exibição
    const cleanNotes = (loan.notes || '')
      .replace(/\[OVERDUE_CONFIG:[^\]]+\]\n?/g, '')
      .replace(/\[SKIP_SATURDAY\]\n?/g, '')
      .replace(/\[SKIP_SUNDAY\]\n?/g, '')
      .replace(/\[SKIP_HOLIDAYS\]\n?/g, '')
      .replace(/\[DAILY_PENALTY:\d+:[0-9.]+\]\n?/g, '')
      .replace(/\[HISTORICAL_CONTRACT\]\n?/g, '')
      .replace(/\[HISTORICAL_INTEREST_CONTRACT\]\n?/g, '')
      .replace(/\[HISTORICAL_INTEREST_RECEIVED:[0-9.]+\]\n?/g, '')
      .replace(/\[INTEREST_NOTES:[^\]]+\]\n?/g, '')
      .replace(/\[PARTIAL_PAID:\d+:[0-9.]+\]\s?/g, '')
      .replace(/Valor emprestado:.*\n?/g, '')
      .replace(/Parcela diária:.*\n?/g, '')
      .replace(/Total a receber:.*\n?/g, '')
      .replace(/Lucro:.*\n?/g, '')
      .trim();
    
    // Carregar configuração de pular dias
    const loanNotes = loan.notes || '';
    setSkipSaturday(loanNotes.includes('[SKIP_SATURDAY]'));
    setSkipSunday(loanNotes.includes('[SKIP_SUNDAY]'));
    setSkipHolidays(loanNotes.includes('[SKIP_HOLIDAYS]'));
    
    // Calcular taxa de juros a partir dos valores do empréstimo
    const numInstallments = loan.installments || 1;
    const dailyAmount = loan.total_interest || 0;
    const totalToReceive = dailyAmount * numInstallments;
    const profit = totalToReceive - loan.principal_amount;
    const interestRate = loan.principal_amount > 0 
      ? (profit / loan.principal_amount) * 100 
      : 0;
    
    // Preencher formulário com dados do empréstimo
    setFormData({
      ...formData,
      client_id: loan.client_id,
      principal_amount: loan.principal_amount.toString(),
      daily_amount: dailyAmount.toString(),
      daily_interest_rate: interestRate.toFixed(2),
      contract_date: loan.contract_date || format(new Date(), 'yyyy-MM-dd'),
      start_date: (loan.installment_dates as string[])?.[0] || loan.start_date,
      daily_period: numInstallments.toString(),
      installments: numInstallments.toString(),
      due_date: loan.due_date,
      notes: cleanNotes,
      payment_type: 'daily',
      is_historical_contract: false,
      send_creation_notification: false,
    });
    
    // Carregar datas das parcelas existentes
    setInstallmentDates((loan.installment_dates as string[]) || []);
    
    // Marcar que estamos editando
    setEditingDailyLoanId(loanId);
    setIsDailyDialogOpen(true);
  };

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
    
    // Construir notas com configurações de pular dias
    let finalNotes = formData.notes || '';
    const skipTags = [];
    if (skipSaturday) skipTags.push('[SKIP_SATURDAY]');
    if (skipSunday) skipTags.push('[SKIP_SUNDAY]');
    if (skipHolidays) skipTags.push('[SKIP_HOLIDAYS]');
    const skipTagsStr = skipTags.length > 0 ? skipTags.join(' ') + '\n' : '';
    const details = `Valor emprestado: R$ ${principalAmount.toFixed(2)}\nParcela diária: R$ ${dailyAmount.toFixed(2)}\nTotal a receber: R$ ${totalToReceive.toFixed(2)}\nLucro: R$ ${profit.toFixed(2)}`;
    
    // MODO EDIÇÃO: Atualizar empréstimo existente
    if (editingDailyLoanId) {
      const loan = loans.find(l => l.id === editingDailyLoanId);
      if (!loan) {
        toast.error('Empréstimo não encontrado');
        return;
      }
      
      // Preservar tags existentes que não queremos sobrescrever
      const existingNotes = loan.notes || '';
      const partialPaidTags = (existingNotes.match(/\[PARTIAL_PAID:\d+:[0-9.]+\]/g) || []).join(' ');
      const historicalTags = existingNotes.includes('[HISTORICAL_CONTRACT]') ? '[HISTORICAL_CONTRACT]\n' : '';
      const historicalInterestMatch = existingNotes.match(/\[HISTORICAL_INTEREST_RECEIVED:[0-9.]+\]/);
      const historicalInterestTag = historicalInterestMatch ? historicalInterestMatch[0] + ' ' : '';
      
      const updatedNotes = `${historicalTags}${skipTagsStr}${finalNotes ? finalNotes + '\n' : ''}${details}${partialPaidTags ? '\n' + partialPaidTags : ''}${historicalInterestTag}`.trim();
      
      const updateData = {
        client_id: formData.client_id,
        principal_amount: principalAmount,
        interest_rate: Math.min(interestPercentage, 999.99), // Cap para evitar overflow
        interest_type: 'simple' as const,
        payment_type: 'daily' as const,
        total_interest: dailyAmount, // Para diários, guarda valor da parcela
        installments: numDays,
        installment_dates: installmentDates,
        start_date: installmentDates[0],
        due_date: installmentDates[installmentDates.length - 1],
        contract_date: formData.contract_date,
        notes: updatedNotes,
        remaining_balance: totalToReceive - (loan.total_paid || 0),
      };
      
      await updateLoan(editingDailyLoanId, updateData);
      toast.success('Empréstimo diário atualizado!');
      setEditingDailyLoanId(null);
      setIsDailyDialogOpen(false);
      resetForm();
      return;
    }
    
    // MODO CRIAÇÃO: Lógica existente
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
        if (formData.is_historical_contract) {
          return `[HISTORICAL_CONTRACT]\n${skipTagsStr}${finalNotes ? finalNotes + '\n' : ''}${details}`;
        }
        return `${skipTagsStr}${finalNotes ? finalNotes + '\n' : ''}${details}`;
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
    
    
    // 🆕 Registrar juros históricos como valor único (simplificado)
    if (formData.is_historical_contract && parseFloat(historicalInterestReceived) > 0) {
      // Buscar o empréstimo recém-criado
      const { data: newLoans } = await supabase
        .from('loans')
        .select('id, notes')
        .eq('client_id', formData.client_id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (newLoans && newLoans[0]) {
        const loanId = newLoans[0].id;
        let currentNotes = newLoans[0].notes || '';
        
        // Adicionar tag de contrato histórico com juros e valor recebido
        if (!currentNotes.includes('[HISTORICAL_INTEREST_CONTRACT]')) {
          currentNotes += ' [HISTORICAL_INTEREST_CONTRACT]';
        }
        currentNotes += ` [HISTORICAL_INTEREST_RECEIVED:${parseFloat(historicalInterestReceived).toFixed(2)}]`;
        
        // Adicionar anotações de juros se fornecidas
        if (historicalInterestNotes.trim()) {
          currentNotes += ` [INTEREST_NOTES:${historicalInterestNotes.trim()}]`;
        }
        
        // Registrar pagamento único de juros históricos
        await registerPayment({
          loan_id: loanId,
          amount: parseFloat(historicalInterestReceived),
          principal_paid: 0,
          interest_paid: parseFloat(historicalInterestReceived),
          payment_date: formData.start_date,
          notes: `[JUROS_HISTORICO] Total de juros antigos já recebidos`,
        });
        
        // Atualizar notas do empréstimo
        await supabase
          .from('loans')
          .update({ notes: currentNotes.trim() })
          .eq('id', loanId);
        
        await fetchLoans();
        toast.success(`Juros históricos de ${formatCurrency(parseFloat(historicalInterestReceived))} registrados`);
      }
    }
    
    // Show loan created receipt prompt (same as handleSubmit)
    if (result?.data) {
      const client = clients.find(c => c.id === formData.client_id);
      
      setLoanCreatedData({
        id: result.data.id,
        clientName: client?.full_name || 'Cliente',
        clientPhone: client?.phone || undefined,
        clientAddress: client ? [client.street, client.number, client.complement, client.neighborhood, client.city, client.state].filter(Boolean).join(', ') || client.address : undefined,
        principalAmount: principalAmount,
        interestRate: interestPercentage,
        totalInterest: profit,
        totalToReceive: totalToReceive,
        installments: numDays,
        installmentValue: dailyAmount,
        contractDate: formData.contract_date,
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
    
    // Fallback for biweekly when installmentDates not yet generated
    // Generate dates on-the-fly based on start_date
    if (formData.payment_type === 'biweekly' && formData.start_date && installmentDates.length === 0) {
      const startDate = new Date(formData.start_date + 'T12:00:00');
      const generatedDates: string[] = [];
      for (let i = 0; i < numInstallments; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (i * 14)); // 14 days = biweekly
        generatedDates.push(format(date, 'yyyy-MM-dd'));
      }
      
      const pastDates = generatedDates.filter(d => {
        const date = new Date(d + 'T12:00:00');
        return date < today;
      });
      
      if (pastDates.length > 0) {
        let valuePerInstallment: number;
        let principalPerInstallment: number;
        let interestPerInstallment: number;
        
        if (installmentValue && parseFloat(installmentValue) > 0) {
          valuePerInstallment = parseFloat(installmentValue);
          principalPerInstallment = principal / numInstallments;
          interestPerInstallment = valuePerInstallment - principalPerInstallment;
        } else {
          const rate = parseFloat(formData.interest_rate) || 0;
          interestPerInstallment = formData.interest_mode === 'per_installment'
            ? principal * (rate / 100)
            : (principal * (rate / 100)) / numInstallments;
          principalPerInstallment = principal / numInstallments;
          valuePerInstallment = principalPerInstallment + interestPerInstallment;
        }
        
        const pastInstallmentsList = pastDates.map((date, idx) => {
          const originalIndex = generatedDates.indexOf(date);
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
  }, [formData.is_historical_contract, hasPastDates, formData.principal_amount, formData.installments, formData.payment_type, formData.daily_amount, formData.interest_rate, formData.interest_mode, formData.due_date, formData.start_date, installmentDates, installmentValue, isDailyDialogOpen]);

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
    // Permitir taxa de juros 0% (zero é um valor válido)
    const interestRateValue = formData.interest_rate !== '' && formData.interest_rate !== undefined && formData.interest_rate !== null
      ? parseFloat(String(formData.interest_rate))
      : NaN;
    if (isNaN(interestRateValue) || interestRateValue < 0) {
      toast.error('Informe a taxa de juros (pode ser 0%)');
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
    const principal = parseFloat(formData.principal_amount) || 0;
    let rate = parseFloat(String(formData.interest_rate)) || 0;
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
    
    
    // 🆕 Registrar juros históricos como valor único (simplificado)
    if (result?.data && formData.is_historical_contract && parseFloat(historicalInterestReceived) > 0) {
      const loanId = result.data.id;
      
      // Buscar notas atuais
      const { data: currentLoan } = await supabase
        .from('loans')
        .select('notes')
        .eq('id', loanId)
        .single();
      
      let currentNotes = currentLoan?.notes || '';
      
      // Adicionar tag de contrato histórico com juros e valor recebido
      if (!currentNotes.includes('[HISTORICAL_INTEREST_CONTRACT]')) {
        currentNotes += ' [HISTORICAL_INTEREST_CONTRACT]';
      }
      currentNotes += ` [HISTORICAL_INTEREST_RECEIVED:${parseFloat(historicalInterestReceived).toFixed(2)}]`;
      
      // Adicionar anotações de juros se fornecidas
      if (historicalInterestNotes.trim()) {
        currentNotes += ` [INTEREST_NOTES:${historicalInterestNotes.trim()}]`;
      }
      
      // Registrar pagamento único de juros históricos
      await registerPayment({
        loan_id: loanId,
        amount: parseFloat(historicalInterestReceived),
        principal_paid: 0,
        interest_paid: parseFloat(historicalInterestReceived),
        payment_date: formData.start_date,
        notes: `[JUROS_HISTORICO] Total de juros antigos já recebidos`,
      });
      
      // Atualizar notas do empréstimo
      await supabase
        .from('loans')
        .update({ notes: currentNotes.trim() })
        .eq('id', loanId);
      
      await fetchLoans();
      toast.success(`Juros históricos de ${formatCurrency(parseFloat(historicalInterestReceived))} registrados`);
    }
    
    // Show loan created receipt prompt
    if (result?.data) {
      const client = clients.find(c => c.id === formData.client_id);
      const installmentValueNum = installmentValue ? parseFloat(installmentValue) : (principal + totalInterest) / numInstallments;
      
      setLoanCreatedData({
        id: result.data.id,
        clientName: client?.full_name || 'Cliente',
        clientPhone: client?.phone || undefined,
        clientAddress: client ? [client.street, client.number, client.complement, client.neighborhood, client.city, client.state].filter(Boolean).join(', ') || client.address : undefined,
        principalAmount: principal,
        interestRate: rate,
        totalInterest: totalInterest,
        totalToReceive: principal + totalInterest,
        installments: numInstallments,
        installmentValue: installmentValueNum,
        contractDate: formData.contract_date,
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
    
    // Obter multas aplicadas às parcelas do loan
    const loanPenalties = getDailyPenaltiesFromNotes(selectedLoan.notes);
    
    // Função para obter o valor de uma parcela específica (considera taxa extra + multa)
    const getInstallmentValue = (index: number) => {
      let value = baseInstallmentValue;
      if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
        value = renewalFeeValue;
      }
      // Adicionar multa se existir para esta parcela
      const penalty = loanPenalties[index] || 0;
      return value + penalty;
    };
    
    let amount: number;
    let interest_paid: number;
    let principal_paid: number;
    
    if (paymentData.payment_type === 'discount') {
      // Pagamento com desconto para quitação
      const receivedAmount = parseFloat(discountSettlementData.receivedAmount) || 0;
      if (receivedAmount <= 0) {
        toast.error('Informe o valor recebido');
        return;
      }
      if (receivedAmount > selectedLoan.remaining_balance) {
        toast.error('O valor recebido não pode ser maior que o saldo devedor');
        return;
      }
      
      const discountAmount = selectedLoan.remaining_balance - receivedAmount;
      
      // Registrar pagamento com o valor recebido
      await registerPayment({
        loan_id: selectedLoanId,
        amount: receivedAmount,
        principal_paid: receivedAmount,
        interest_paid: 0,
        payment_date: paymentData.payment_date,
        notes: `Quitação com desconto de ${formatCurrency(discountAmount)} [DISCOUNT_SETTLEMENT:${discountAmount.toFixed(2)}]`,
      });
      
      // Forçar remaining_balance = 0 e status = 'paid'
      const existingNotes = selectedLoan.notes || '';
      const newNotes = existingNotes 
        ? `${existingNotes}\n[DISCOUNT_SETTLEMENT:${discountAmount.toFixed(2)}]`
        : `[DISCOUNT_SETTLEMENT:${discountAmount.toFixed(2)}]`;
      
      await supabase.from('loans').update({
        remaining_balance: 0,
        status: 'paid',
        notes: newNotes.trim(),
      }).eq('id', selectedLoanId);
      
      // Preparar dados do comprovante
      setPaymentClientPhone(selectedLoan.client?.phone || null);
      setPaymentInstallmentDates((selectedLoan.installment_dates as string[]) || []);
      setPaymentPaidCount(selectedLoan.installments || 1); // Quitado = todas pagas
      setPaymentReceiptData({
        type: 'loan',
        contractId: selectedLoanId,
        companyName: profile?.company_name || '',
        clientName: selectedLoan.client?.full_name || 'Cliente',
        installmentNumber: selectedLoan.installments || 1,
        totalInstallments: selectedLoan.installments || 1,
        amountPaid: receivedAmount,
        paymentDate: paymentData.payment_date,
        remainingBalance: 0,
        totalPaid: (selectedLoan.total_paid || 0) + receivedAmount,
        nextDueDate: undefined,
        discountAmount: discountAmount,
        billingSignatureName: profile?.billing_signature_name || undefined,
      });
      
      setIsPaymentDialogOpen(false);
      setDiscountSettlementData({ receivedAmount: '', discountAmount: 0 });
      await fetchLoans();
      
      // Abrir diálogo de comprovante
      setIsPaymentReceiptOpen(true);
      
      toast.success(`Empréstimo quitado com desconto de ${formatCurrency(discountAmount)}!`);
      return;
    } else if (paymentData.payment_type === 'total') {
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
      } else if (paymentData.recalculate_interest) {
        // 🆕 AMORTIZAÇÃO: Não adicionar [PARTIAL_PAID:...] - será tratado no bloco de amortização abaixo
        // Amortização reduz o principal e recalcula juros, NÃO é um pagamento de parcela
        installmentNote = 'Amortização processada';
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
    
    // Suporte a múltiplas parcelas selecionadas
    const installmentNumber = paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0
      ? paymentData.selected_installments.length === 1
        ? paymentData.selected_installments[0] + 1  // Uma parcela: número único
        : paymentData.selected_installments.map(i => i + 1)  // Múltiplas: array de números
      : targetInstallmentIndex + 1;
    
    // Atualizar notes do loan com tracking de parcelas ANTES do registerPayment
    // para que as notas já estejam salvas quando o fetchLoans for chamado
    // 🆕 NÃO salvar se for amortização - a amortização salva suas próprias notas abaixo
    if (updatedNotes !== selectedLoan.notes && !paymentData.recalculate_interest) {
      await supabase.from('loans').update({ notes: updatedNotes.trim() }).eq('id', selectedLoanId);
    }
    
    // 🆕 RECÁLCULO DE JUROS (AMORTIZAÇÃO): Se o usuário marcou a opção de recalcular juros
    // A amortização reduz o PRINCIPAL ORIGINAL, e os novos juros são calculados sobre esse novo principal
    if (paymentData.recalculate_interest && paymentData.payment_type === 'partial') {
      const originalPrincipal = selectedLoan.principal_amount;
      const interestRate = selectedLoan.interest_rate;
      const numInstallments = selectedLoan.installments || 1;
      
      // Calcular quanto do principal já foi amortizado anteriormente
      const previousAmortizations = getTotalAmortizationsFromNotes(selectedLoan.notes);
      
      // Guardar valores anteriores para reversão
      const previousTotalInterest = selectedLoan.total_interest || 0;
      const previousRemainingBalance = selectedLoan.remaining_balance;
      
      // Novo principal = Original - amortizações anteriores - esta amortização
      const newPrincipal = Math.max(0, originalPrincipal - previousAmortizations - amount);
      
      // Recalcular juros sobre o novo principal
      const newTotalInterest = newPrincipal * (interestRate / 100);
      
      // Novo saldo total a pagar
      const newRemainingBalance = newPrincipal + newTotalInterest;
      
      // Calcular novo valor por parcela
      const paidInstallmentsCount = getPaidInstallmentsCount(selectedLoan);
      const remainingInstallmentsCount = Math.max(1, numInstallments - paidInstallmentsCount);
      const newInstallmentValue = newRemainingBalance / remainingInstallmentsCount;
      
      // Tag de amortização para histórico - usar notas ORIGINAIS, não updatedNotes
      const amortTag = `[AMORTIZATION:${amount.toFixed(2)}:${newPrincipal.toFixed(2)}:${newTotalInterest.toFixed(2)}:${format(new Date(), 'yyyy-MM-dd')}]`;
      const notesWithAmort = ((selectedLoan.notes || '') + '\n' + amortTag).trim();
      
      // Atualizar banco - NÃO altera principal_amount nem total_paid
      // Amortização NÃO é um pagamento, apenas recálculo do saldo devedor
      await supabase.from('loans').update({ 
        total_interest: newTotalInterest,
        remaining_balance: newRemainingBalance,
        notes: notesWithAmort
      }).eq('id', selectedLoanId);
      
      // Economia de juros
      const originalInterest = originalPrincipal * (interestRate / 100);
      const interestSavings = originalInterest - newTotalInterest;
      
      // Criar nota com dados para reversão (valores ANTERIORES à amortização)
      const amortizationPaymentNote = `[AMORTIZATION] Amortização de ${formatCurrency(amount)} | ` +
        `Novo principal: ${formatCurrency(newPrincipal)}, Novos juros: ${formatCurrency(newTotalInterest)}, ` +
        `Economia: ${formatCurrency(interestSavings)} | ` +
        `[AMORT_REVERSAL:${previousAmortizations.toFixed(2)}:${previousTotalInterest.toFixed(2)}:${previousRemainingBalance.toFixed(2)}]`;
      
      // Registrar na tabela loan_payments para aparecer no histórico
      await registerPayment({
        loan_id: selectedLoanId,
        amount: amount,
        payment_date: paymentData.payment_date,
        notes: amortizationPaymentNote,
        principal_paid: amount, // Amortização reduz o principal
        interest_paid: 0
      });
      
      toast.success(
        `Amortização registrada! Economia de ${formatCurrency(interestSavings)} em juros. ` +
        `Novas ${remainingInstallmentsCount} parcelas de ${formatCurrency(newInstallmentValue)}`
      );
      
      setIsPaymentDialogOpen(false);
      setSelectedLoanId(null);
      setPaymentData({ amount: '', payment_date: format(new Date(), 'yyyy-MM-dd'), new_due_date: '', payment_type: 'partial', selected_installments: [], partial_installment_index: null, send_notification: false, is_advance_payment: false, recalculate_interest: false });
      return;
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
    
    // 🆕 CORREÇÃO: Atualizar due_date automaticamente para a próxima parcela não paga
    // Isso corrige o problema de empréstimos semanais/quinzenais/parcelados ficando "atrasados"
    // mesmo após pagamento, porque o due_date não era atualizado para a próxima parcela
    if (!paymentData.new_due_date) {
      const dates = (selectedLoan.installment_dates as string[]) || [];
      const hasMultipleInstallments = ['weekly', 'biweekly', 'installment', 'daily'].includes(selectedLoan.payment_type);
      
      if (hasMultipleInstallments && dates.length > 1) {
        // Usar o updatedNotes que já foi salvo no banco
        const loanForCalc = { 
          ...selectedLoan, 
          notes: updatedNotes,
          total_paid: (selectedLoan.total_paid || 0) + amount // Simular o novo total_paid
        };
        const newPaidInstallments = getPaidInstallmentsCount(loanForCalc);
        
        // Se ainda há parcelas em aberto, atualizar due_date para a próxima
        if (newPaidInstallments < dates.length) {
          const nextDueDate = dates[newPaidInstallments];
          
          await supabase.from('loans').update({ 
            due_date: nextDueDate
          }).eq('id', selectedLoanId);
          
          console.log(`[AUTO_DUE_DATE] Atualizado due_date para próxima parcela: ${nextDueDate} (parcela ${newPaidInstallments + 1})`);
        }
      }
    }
    
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
    
    // Calculate next due date for receipt
    const loanDates = (selectedLoan.installment_dates as string[]) || [];
    let nextDueDateForReceipt: string | undefined;
    // Obter o maior índice de parcela paga para calcular próximo vencimento
    const maxPaidIndex = Array.isArray(installmentNumber) 
      ? Math.max(...installmentNumber) - 1 
      : installmentNumber - 1;
    if (loanDates.length > maxPaidIndex + 1 && newRemainingBalance > 0) {
      nextDueDateForReceipt = loanDates[maxPaidIndex + 1];
    }
    
    // Calculate total penalty paid in this payment
    let totalPenaltyPaid = 0;
    if (paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0) {
      // Somar multas das parcelas selecionadas
      for (const idx of paymentData.selected_installments) {
        totalPenaltyPaid += loanPenalties[idx] || 0;
      }
    } else if (paymentData.payment_type === 'partial' && paymentData.partial_installment_index !== null && paymentData.partial_installment_index >= 0) {
      // Multa da parcela específica sendo paga parcialmente
      totalPenaltyPaid = loanPenalties[paymentData.partial_installment_index] || 0;
    } else if (paymentData.payment_type === 'total') {
      // Pagamento total - somar todas as multas
      totalPenaltyPaid = getTotalDailyPenalties(selectedLoan.notes);
    }
    
    // Show payment receipt prompt
    setPaymentClientPhone(selectedLoan.client?.phone || null);
    setPaymentInstallmentDates((selectedLoan.installment_dates as string[]) || []);
    setPaymentPaidCount(newRemainingBalance <= 0 ? numInstallments : getPaidInstallmentsCount(selectedLoan) + (paymentData.selected_installments.length || 1));
    setPaymentReceiptData({
      type: 'loan',
      contractId: selectedLoan.id,
      companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
      billingSignatureName: profile?.billing_signature_name || undefined,
      clientName: selectedLoan.client?.full_name || 'Cliente',
      installmentNumber: installmentNumber,
      totalInstallments: numInstallments,
      amountPaid: amount,
      paymentDate: paymentData.payment_date,
      remainingBalance: Math.max(0, newRemainingBalance),
      totalPaid: (selectedLoan.total_paid || 0) + amount,
      totalContract: totalContractValue,
      nextDueDate: nextDueDateForReceipt,
      penaltyAmount: totalPenaltyPaid > 0 ? totalPenaltyPaid : undefined,
    });
    setIsPaymentReceiptOpen(true);
    
    setIsPaymentDialogOpen(false);
    setSelectedLoanId(null);
    setPaymentData({ amount: '', payment_date: format(new Date(), 'yyyy-MM-dd'), new_due_date: '', payment_type: 'partial', selected_installments: [], partial_installment_index: null, send_notification: false, is_advance_payment: false, recalculate_interest: false });
  };

  const resetForm = () => {
    setFormData({
      client_id: '', principal_amount: '', interest_rate: '', interest_type: 'simple',
      interest_mode: 'per_installment', payment_type: 'single', installments: '1', 
      contract_date: format(new Date(), 'yyyy-MM-dd'),
      start_date: format(new Date(), 'yyyy-MM-dd'), due_date: '', notes: '',
      daily_amount: '', daily_period: '15', daily_interest_rate: '', is_historical_contract: false, send_creation_notification: false,
    });
    setInstallmentDates([]);
    setInstallmentValue('');
    setSelectedPastInstallments([]);
    setDailyDateMode('auto');
    setDailyFirstDate(format(new Date(), 'yyyy-MM-dd'));
    setDailyInstallmentCount('20');
    setSkipSaturday(false);
    setSkipSunday(false);
    setHistoricalInterestReceived('');
    setHistoricalInterestNotes('');
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
    
    // CORREÇÃO: Usar remaining_balance como fonte de verdade (já inclui amortizações)
    // O remaining_balance é atualizado automaticamente quando há amortização
    const actualRemaining = loan.remaining_balance > 0 ? loan.remaining_balance : (loan.principal_amount + totalInterest - (loan.total_paid || 0));
    
    // Para "só juros": se já houve pagamento anterior de "só juros", usar o valor salvo
    // Caso contrário, usar o remaining atual (que já considera amortizações)
    let remainingForInterestOnly = actualRemaining;
    
    if (loan.notes?.includes('[INTEREST_ONLY_PAYMENT]')) {
      const match = loan.notes.match(/Valor que falta: R\$ ([0-9.,]+)/);
      if (match) {
        const storedRemaining = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(storedRemaining) && storedRemaining > 0) {
          remainingForInterestOnly = storedRemaining;
        }
      }
    }
    
    // Para renegociação normal - usar remaining_balance real
    const remainingForRenegotiation = actualRemaining;
    
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
      send_interest_notification: false,
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
        startDate: loan.contract_date || loan.start_date, // Fallback para compatibilidade
        contractDate: loan.contract_date || loan.start_date, // Data do contrato
        firstDueDate: loan.start_date, // Data do primeiro vencimento
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
        send_notification: false, // Nunca enviar automaticamente - usar tela de comprovante
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
        let newDate: Date;
        if (loan.payment_type === 'weekly') {
          newDate = new Date(date);
          newDate.setDate(newDate.getDate() + 7);  // +1 semana
        } else if (loan.payment_type === 'biweekly') {
          newDate = new Date(date);
          newDate.setDate(newDate.getDate() + 15); // +15 dias (quinzenal)
        } else {
          // Usar addMonths do date-fns para evitar bugs na virada de ano
          newDate = addMonths(date, 1);
        }
        return format(newDate, 'yyyy-MM-dd');
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
      
      // Notificação WhatsApp removida - usuário usará a tela de comprovante para enviar
      
      // Fechar o diálogo primeiro para evitar problemas de estado
      setIsRenegotiateDialogOpen(false);
      setSelectedLoanId(null);
      
      // Abrir comprovante após pagamento de juros com opção de enviar ao cliente
      setPaymentClientPhone(loan.client?.phone || null);
      setPaymentInstallmentDates((loan.installment_dates as string[]) || []);
      setPaymentPaidCount(getPaidInstallmentsCount(loan));
      setPaymentReceiptData({
        type: 'loan',
        contractId: loan.id,
        companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
        billingSignatureName: profile?.billing_signature_name || undefined,
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

  // Simple Edit Dialog - for editing dates and values without renegotiation
  const openSimpleEditDialog = async (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    // Parse existing overdue config from notes
    const overdueConfigMatch = loan.notes?.match(/\[OVERDUE_CONFIG:(percentage|fixed):([0-9.]+)\]/);
    const hasExistingOverdueConfig = !!overdueConfigMatch;
    const existingOverdueType = overdueConfigMatch?.[1] as 'percentage' | 'fixed' | undefined;
    const existingOverdueValue = overdueConfigMatch ? parseFloat(overdueConfigMatch[2]) : 0;
    
    // Clean notes for display (remove internal tags)
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
      .replace(/\[SKIP_SATURDAY\]\n?/g, '')
      .replace(/\[SKIP_SUNDAY\]\n?/g, '')
      .replace(/\[SKIP_HOLIDAYS\]\n?/g, '')
      .trim();
    
    // Load skip settings from notes
    const loanNotes = loan.notes || '';
    setEditSkipSaturday(loanNotes.includes('[SKIP_SATURDAY]'));
    setEditSkipSunday(loanNotes.includes('[SKIP_SUNDAY]'));
    setEditSkipHolidays(loanNotes.includes('[SKIP_HOLIDAYS]'));
    
    setEditingLoanId(loanId);
    setEditLoanIsOverdue(false);
    setEditOverdueDays(0);
    setEditIsRenegotiation(false); // IMPORTANT: This is NOT a renegotiation
    setEditHistoricalData(null); // No historical data for simple edit
    
    // Load CURRENT loan data (not calculate new contract)
    setEditFormData({
      client_id: loan.client_id,
      principal_amount: loan.principal_amount.toString(),
      interest_rate: loan.interest_rate.toString(),
      interest_type: loan.interest_type,
      interest_mode: loan.interest_mode || 'per_installment',
      payment_type: loan.payment_type,
      installments: (loan.installments || 1).toString(),
      contract_date: loan.contract_date || format(new Date(), 'yyyy-MM-dd'),
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
    
    // Load CURRENT installment dates
    setEditInstallmentDates((loan.installment_dates as string[]) || []);
    
    // Calculate and set current installment value
    const numInstEdit = loan.installments || 1;
    let totalInterestEdit = 0;
    if (loan.total_interest !== undefined && loan.total_interest !== null && loan.total_interest > 0) {
      if (loan.payment_type === 'daily') {
        // For daily loans, total_interest stores the daily amount
        totalInterestEdit = (loan.total_interest * numInstEdit) - loan.principal_amount;
      } else {
        totalInterestEdit = loan.total_interest;
      }
    } else if (loan.interest_mode === 'on_total') {
      totalInterestEdit = loan.principal_amount * (loan.interest_rate / 100);
    } else if (loan.interest_mode === 'compound') {
      totalInterestEdit = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstEdit) - loan.principal_amount;
    } else {
      totalInterestEdit = loan.principal_amount * (loan.interest_rate / 100) * numInstEdit;
    }
    const totalToReceiveEdit = loan.principal_amount + totalInterestEdit;
    setEditInstallmentValue((totalToReceiveEdit / numInstEdit).toFixed(2));
    setIsEditManuallyEditingInstallment(false);
    setIsEditManuallyEditingInterest(false);
    setEditEditableTotalInterest('');
    
    setIsEditDialogOpen(true);
  };

  // Renegotiation Dialog - for creating new contract based on outstanding balance
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
    
    // This is always a renegotiation
    const totalPaid = loan.total_paid || 0;
    const isRenegotiation = true;
    
    // Calculate historical data for renegotiation
    let historicalData: typeof editHistoricalData = null;
    if (isRenegotiation) {
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
      
      // Fetch actual payments to calculate realized profit correctly
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
    
    // Clean notes for display
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
      .replace(/\[SKIP_SATURDAY\]\n?/g, '')
      .replace(/\[SKIP_SUNDAY\]\n?/g, '')
      .replace(/\[SKIP_HOLIDAYS\]\n?/g, '')
      .trim();
    
    // Load skip settings from notes
    const loanNotes = loan.notes || '';
    setEditSkipSaturday(loanNotes.includes('[SKIP_SATURDAY]'));
    setEditSkipSunday(loanNotes.includes('[SKIP_SUNDAY]'));
    setEditSkipHolidays(loanNotes.includes('[SKIP_HOLIDAYS]'));
    
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
        const date = addMonths(startDate, i);
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
    setIsEditManuallyEditingInterest(false);
    setEditEditableTotalInterest('');
    
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
    
    // Remove any existing skip tags from notes (overdue config is now managed via card)
    let cleanNotes = (editFormData.notes || '')
      .replace(/\[OVERDUE_CONFIG:[^\]]+\]/g, '')
      .replace(/\[SKIP_SATURDAY\]\n?/g, '')
      .replace(/\[SKIP_SUNDAY\]\n?/g, '')
      .replace(/\[SKIP_HOLIDAYS\]\n?/g, '')
      .trim();
    
    // Add skip tags if enabled
    const skipTags = [
      editSkipSaturday && '[SKIP_SATURDAY]',
      editSkipSunday && '[SKIP_SUNDAY]',
      editSkipHolidays && '[SKIP_HOLIDAYS]',
    ].filter(Boolean).join('');
    
    if (skipTags) {
      cleanNotes = `${skipTags}\n${cleanNotes}`.trim();
    }
    
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
    
    // Remove any existing custom installment value tag
    finalNotes = finalNotes.replace(/\[CUSTOM_INSTALLMENT_VALUE:[0-9.]+\]\n?/g, '').trim();
    
    // If user manually edited the installment value, save it as a tag
    if (isEditManuallyEditingInstallment && editInstallmentValue && 
        (editFormData.payment_type === 'installment' || editFormData.payment_type === 'weekly' || editFormData.payment_type === 'biweekly')) {
      const customValue = parseFloat(editInstallmentValue);
      if (!isNaN(customValue) && customValue > 0) {
        finalNotes = `[CUSTOM_INSTALLMENT_VALUE:${customValue.toFixed(2)}]\n${finalNotes}`.trim();
      }
    }
    
    if (editIsRenegotiation && editHistoricalData) {
      // Limpar tags de tracking antigas que não fazem sentido após renegociação
      // pois os valores mudaram e o tracking antigo está desatualizado
      cleanNotes = cleanNotes
        // Remover tracking de pagamentos parciais antigos
        .replace(/\[PARTIAL_PAID:\d+:[0-9.]+\]\n?/g, '')
        // Remover sub-parcelas de adiantamento antigas
        .replace(/\[ADVANCE_SUBPARCELA:\d+:[0-9.]+:[^\]]+\]\n?/g, '')
        // Remover pagamentos de juros antigos
        .replace(/\[INTEREST_ONLY_PAID:\d+:[0-9.]+:[^\]]+\]\n?/g, '')
        // Remover tags de parcelas pagas
        .replace(/\[INSTALLMENT_PAID:\d+:[0-9.]+:[^\]]+\]\n?/g, '')
        .trim();
      
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
      
      // Para renegociação, resetar total_paid
      if (editIsRenegotiation) {
        updateData.remaining_balance = totalToReceive;
        updateData.total_paid = 0;
      } else {
        // Para edição simples, manter o total_paid e ajustar remaining_balance
        const totalPaid = loan.total_paid || 0;
        updateData.remaining_balance = totalToReceive - totalPaid;
      }
      
      updateData.total_interest = dailyAmount;
      // Calcular taxa percentual para o banco (máximo 999.99%)
      const calculatedRate = principalAmount > 0 ? (profit / principalAmount) * 100 : 0;
      updateData.interest_rate = Math.min(calculatedRate, 999.99);
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
    } else {
      toast.success('Empréstimo atualizado! As próximas cobranças usarão os novos dados.');
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
              const baseDate = new Date(loan.start_date + 'T12:00:00');
              let calculatedDate: Date;
              if (loan.payment_type === 'daily') {
                calculatedDate = new Date(baseDate);
                calculatedDate.setDate(calculatedDate.getDate() + i);
              } else if (loan.payment_type === 'weekly') {
                calculatedDate = new Date(baseDate);
                calculatedDate.setDate(calculatedDate.getDate() + (i * 7));
              } else if (loan.payment_type === 'biweekly') {
                calculatedDate = new Date(baseDate);
                calculatedDate.setDate(calculatedDate.getDate() + (i * 15));
              } else {
                // Usar addMonths do date-fns para evitar bugs na virada de ano
                calculatedDate = addMonths(baseDate, i);
              }
              dueDate = format(calculatedDate, 'yyyy-MM-dd');
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
              
              {/* Filtro por funcionário (só para donos com funcionários) */}
              {!isEmployee && myEmployees.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={filterByEmployee ? 'default' : 'outline'}
                      size="sm"
                      className={`gap-1 text-xs sm:text-sm ${filterByEmployee ? 'bg-violet-500 hover:bg-violet-600' : 'border-violet-500 text-violet-600 hover:bg-violet-500/10'}`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {!filterByEmployee ? 'Criador' : 
                          filterByEmployee === 'owner' ? 'Meus' : 
                          myEmployees.find(e => e.employee_user_id === filterByEmployee)?.name || 'Func.'}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background z-50">
                    <DropdownMenuItem onClick={() => setFilterByEmployee(null)}>
                      <span className="font-medium">Todos</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilterByEmployee('owner')}>
                      Criados por mim
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {myEmployees.map(emp => (
                      <DropdownMenuItem 
                        key={emp.employee_user_id} 
                        onClick={() => setFilterByEmployee(emp.employee_user_id)}
                      >
                        {emp.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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
              <Dialog open={isDailyDialogOpen} onOpenChange={(open) => {
                setIsDailyDialogOpen(open);
                if (!open) setEditingDailyLoanId(null);
              }}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto p-4 sm:p-6">
                <DialogHeader><DialogTitle className="text-base sm:text-xl">{editingDailyLoanId ? 'Editar Empréstimo Diário' : 'Novo Empréstimo Diário'}</DialogTitle></DialogHeader>
                <form onSubmit={handleDailySubmit} className="space-y-3 sm:space-y-4">
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Cliente *</Label>
                    <ClientSelector
                      selectedClientId={formData.client_id || null}
                      onSelect={(client) => setFormData({ ...formData, client_id: client?.id || '' })}
                      placeholder="Buscar cliente por nome, telefone ou CPF..."
                      className="h-9 sm:h-10"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Valor Emprestado (R$) *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={formData.principal_amount} 
                        onChange={(e) => handleDailyPrincipalChange(e.target.value)} 
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
                        onChange={(e) => handleDailyAmountChange(e.target.value)} 
                        placeholder="Ex: 50"
                        required 
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Juros (%)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={formData.daily_interest_rate} 
                      onChange={(e) => handleDailyInterestChange(e.target.value)} 
                      placeholder="Ex: 25"
                      className="h-9 sm:h-10 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Altere o juros para recalcular a parcela automaticamente</p>
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
                            const newDates = generateDailyDates(newStartDate, parseInt(formData.daily_period), skipSaturday, skipSunday, skipHolidays);
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
                        const numInstallments = parseInt(count) || 0;
                        
                        // Auto-generate dates when count changes and we have start_date
                        if (formData.start_date && count && numInstallments > 0) {
                          const newDates = generateDailyDates(formData.start_date, numInstallments, skipSaturday, skipSunday, skipHolidays);
                          setInstallmentDates(newDates);
                          
                          // Se tem juros definido, recalcular a parcela
                          const principal = parseFloat(formData.principal_amount) || 0;
                          const interestRate = parseFloat(formData.daily_interest_rate) || 0;
                          
                          if (principal > 0 && interestRate > 0 && newDates.length > 0) {
                            const totalInterest = principal * (interestRate / 100);
                            const totalToReceive = principal + totalInterest;
                            const dailyAmount = totalToReceive / newDates.length;
                            
                            setFormData(prev => ({
                              ...prev,
                              daily_period: count,
                              installments: count,
                              due_date: newDates[newDates.length - 1],
                              daily_amount: dailyAmount.toFixed(2)
                            }));
                          } else if (newDates.length > 0) {
                            setFormData(prev => ({
                              ...prev,
                              daily_period: count,
                              installments: count,
                              due_date: newDates[newDates.length - 1]
                            }));
                          }
                        } else {
                          setFormData(prev => ({ ...prev, daily_period: count, installments: count }));
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
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipHolidays}
                          onChange={(e) => setSkipHolidays(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-sm">Feriados</span>
                      </label>
                    </div>
                    {(skipSaturday || skipSunday || skipHolidays) && (
                      <p className="text-xs text-amber-500">
                        ⚠️ {[
                          skipSaturday && 'Sábados',
                          skipSunday && 'Domingos',
                          skipHolidays && 'Feriados'
                        ].filter(Boolean).join(', ')} serão pulados na geração das datas
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
                          
                          {/* 🆕 Seção simplificada de juros históricos - ROXO */}
                          <div className="mt-3 pt-3 border-t border-purple-400/30 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm text-purple-200 flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                💵 Valor de Juros Antigos Recebidos (R$)
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0,00"
                                value={historicalInterestReceived}
                                onChange={(e) => setHistoricalInterestReceived(e.target.value)}
                                className="bg-purple-500/10 border-purple-400/30 text-purple-100"
                              />
                              <p className="text-xs text-purple-300/70">
                                Digite o total de juros que já recebeu deste contrato antes de cadastrar
                              </p>
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-sm text-purple-200">
                                📝 Anotações sobre Juros Antigos
                              </Label>
                              <Textarea
                                value={historicalInterestNotes}
                                onChange={(e) => setHistoricalInterestNotes(e.target.value)}
                                placeholder="Ex: Cliente pagou R$200 de juros em 15/10, R$200 em 15/11..."
                                className="bg-purple-500/10 border-purple-400/30 text-purple-100 min-h-[60px]"
                              />
                            </div>
                            
                            {/* Resumo total já recebido */}
                            {(parseFloat(historicalInterestReceived) > 0 || selectedPastInstallments.length > 0) && (
                              <div className="p-2 rounded bg-green-500/10 border border-green-400/30">
                                <p className="text-xs text-green-300 font-medium">
                                  📊 Total já recebido: {formatCurrency(
                                    (selectedPastInstallments.length * (pastInstallmentsData.valuePerInstallment || 0)) + 
                                    (parseFloat(historicalInterestReceived) || 0)
                                  )}
                                </p>
                              </div>
                            )}
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
                    <Button type="button" variant="outline" onClick={() => { setIsDailyDialogOpen(false); setEditingDailyLoanId(null); resetForm(); }} className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">Cancelar</Button>
                    <Button type="submit" className="bg-sky-500 hover:bg-sky-600 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">{editingDailyLoanId ? 'Salvar Alterações' : 'Criar Diário'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
              <Dialog open={isDialogOpen} onOpenChange={handleDialogOpen}>
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
                        <ClientSelector
                          selectedClientId={formData.client_id || null}
                          onSelect={(client) => setFormData({ ...formData, client_id: client?.id || '' })}
                          placeholder="Buscar cliente por nome, telefone ou CPF..."
                        />
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
                          <SelectItem value="compound" className="text-xs sm:text-sm">Juros Compostos Puros</SelectItem>
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
                        <Label className="text-xs sm:text-sm">Juros Total (R$)</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="Ex: 160.00"
                          value={isManuallyEditingInterest ? editableTotalInterest : getTotalInterestRawValue()} 
                          onChange={(e) => handleTotalInterestChange(e.target.value)}
                          className="h-9 sm:h-10 text-sm"
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
                {/* Prévia para Pagamento Único */}
                {formData.payment_type === 'single' && formData.principal_amount && formData.interest_rate && (
                  <div className="p-3 sm:p-4 bg-muted/50 rounded-lg space-y-2 border border-border/50">
                    <p className="text-xs sm:text-sm font-medium">Resumo do Empréstimo</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Valor Emprestado</p>
                        <p className="text-sm sm:text-base font-medium">
                          {formatCurrency(parseFloat(formData.principal_amount))}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Juros ({formData.interest_rate}%)
                        </p>
                        <p className="text-sm sm:text-base font-medium text-amber-500">
                          {(() => {
                            const principal = parseFloat(formData.principal_amount);
                            const rate = parseFloat(formData.interest_rate) / 100;
                            if (formData.interest_mode === 'compound') {
                              return formatCurrency(principal * Math.pow(1 + rate, 1) - principal);
                            }
                            return formatCurrency(principal * rate);
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex justify-between items-center">
                        <p className="text-xs sm:text-sm text-muted-foreground">Total a Receber</p>
                        <p className="text-base sm:text-lg font-bold text-emerald-500">
                          {(() => {
                            const principal = parseFloat(formData.principal_amount);
                            const rate = parseFloat(formData.interest_rate) / 100;
                            let interest = 0;
                            if (formData.interest_mode === 'compound') {
                              interest = principal * Math.pow(1 + rate, 1) - principal;
                            } else {
                              interest = principal * rate;
                            }
                            return formatCurrency(principal + interest);
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
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
                {(formData.payment_type === 'installment' || formData.payment_type === 'weekly' || formData.payment_type === 'biweekly') && (
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
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipHolidays}
                          onChange={(e) => setSkipHolidays(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-sm">Feriados</span>
                      </label>
                    </div>
                    {(skipSaturday || skipSunday || skipHolidays) && (
                      <p className="text-xs text-amber-500">
                        ⚠️ {[
                          skipSaturday && 'Sábados',
                          skipSunday && 'Domingos',
                          skipHolidays && 'Feriados'
                        ].filter(Boolean).join(', ')} serão pulados na geração das datas
                      </p>
                    )}
                  </div>
                )}
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
                        
                        {/* 🆕 Seção simplificada de juros históricos - ROXO */}
                        <div className="mt-3 pt-3 border-t border-purple-400/30 space-y-3">
                          <div className="space-y-2">
                            <Label className="text-sm text-purple-200 flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4" />
                              💵 Valor de Juros Antigos Recebidos (R$)
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              value={historicalInterestReceived}
                              onChange={(e) => setHistoricalInterestReceived(e.target.value)}
                              className="bg-purple-500/10 border-purple-400/30 text-purple-100"
                            />
                            <p className="text-xs text-purple-300/70">
                              Digite o total de juros que já recebeu deste contrato antes de cadastrar
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm text-purple-200">
                              📝 Anotações sobre Juros Antigos
                            </Label>
                            <Textarea
                              value={historicalInterestNotes}
                              onChange={(e) => setHistoricalInterestNotes(e.target.value)}
                              placeholder="Ex: Cliente pagou R$200 de juros em 15/10, R$200 em 15/11..."
                              className="bg-purple-500/10 border-purple-400/30 text-purple-100 min-h-[60px]"
                            />
                          </div>
                          
                          {/* Resumo total já recebido */}
                          {(parseFloat(historicalInterestReceived) > 0 || selectedPastInstallments.length > 0) && (
                            <div className="p-2 rounded bg-green-500/10 border border-green-400/30">
                              <p className="text-xs text-green-300 font-medium">
                                📊 Total já recebido: {formatCurrency(
                                  (selectedPastInstallments.length * (pastInstallmentsData.valuePerInstallment || 0)) + 
                                  (parseFloat(historicalInterestReceived) || 0)
                                )}
                              </p>
                            </div>
                          )}
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

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'regular' | 'daily' | 'price'); setStatusFilter('all'); setOverdueDaysFilter(null); }} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="regular" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Empréstimos</span>
              <span className="sm:hidden">Emprést.</span>
              ({regularLoansCount})
            </TabsTrigger>
            <TabsTrigger value="daily" className="gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Diário</span>
              ({dailyLoansCount})
            </TabsTrigger>
            <TabsTrigger value="price" className="gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Table2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Tabela Price</span>
              <span className="sm:hidden">Price</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regular" className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative tutorial-search flex-1">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm" />
              </div>
              {hasPermission('create_loans') && (
                <Button 
                  size="sm" 
                  className="tutorial-new-loan gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => handleDialogOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Novo Empréstimo</span><span className="sm:hidden">Novo</span>
                </Button>
              )}
            </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Collapsible open={isFiltersExpanded} onOpenChange={setIsFiltersExpanded} className="tutorial-filters">
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 text-xs sm:text-sm px-3 gap-2 ${statusFilter !== 'all' ? 'border-primary text-primary' : ''}`}
                >
                  <Search className="w-3 h-3" />
                  {statusFilter === 'all' ? 'Filtros' : 
                    statusFilter === 'pending' ? 'Em Dia' :
                    statusFilter === 'due_today' ? 'Vence Hoje' :
                    statusFilter === 'paid' ? 'Pagos' :
                    statusFilter === 'overdue' ? 'Atraso' :
                    statusFilter === 'renegotiated' ? 'Reneg.' :
                    statusFilter === 'interest_only' ? 'Só Juros' :
                    statusFilter === 'weekly' ? 'Semanal' :
                    statusFilter === 'biweekly' ? 'Quinzenal' :
                    statusFilter === 'installment' ? 'Mensal' :
                    statusFilter === 'single' ? 'Única' : 'Filtros'
                  }
                  {isFiltersExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
              </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <TooltipProvider delayDuration={300}>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 p-3 bg-muted/50 rounded-lg border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={statusFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setStatusFilter('all'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
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
                        onClick={() => { setStatusFilter('pending'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
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
                        variant={statusFilter === 'due_today' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setStatusFilter('due_today'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
                        className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'due_today' ? 'bg-amber-500' : 'border-amber-500 text-amber-600 hover:bg-amber-500/10'}`}
                      >
                        <Bell className="w-3 h-3 mr-1" />
                        Vence Hoje
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Empréstimos com parcela vencendo hoje</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={statusFilter === 'paid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setStatusFilter('paid'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
                        className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'paid' ? 'bg-primary' : 'border-primary text-primary hover:bg-primary/10'}`}
                      >
                        Pagos
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Empréstimos totalmente quitados</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={statusFilter === 'overdue' ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'overdue' ? 'bg-destructive' : 'border-destructive text-destructive hover:bg-destructive/10'}`}
                      >
                        {statusFilter === 'overdue' && overdueDaysFilter !== null
                          ? overdueDaysFilter === 5 ? 'Atraso 1-5d'
                            : overdueDaysFilter === 10 ? 'Atraso 6-10d'
                            : overdueDaysFilter === 15 ? 'Atraso 11-15d'
                            : overdueDaysFilter === 30 ? 'Atraso 16-30d'
                            : overdueDaysFilter === 60 ? 'Atraso 31-60d'
                            : overdueDaysFilter === 999 ? 'Atraso +60d'
                            : overdueDaysFilter === -1 ? `Atraso ${customOverdueDays}d`
                            : 'Atraso'
                          : 'Atraso'}
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-background">
                      <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}>
                        Todos em atraso
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(5); setIsFiltersExpanded(false); }}>
                        1-5 dias
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(10); setIsFiltersExpanded(false); }}>
                        6-10 dias
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(15); setIsFiltersExpanded(false); }}>
                        11-15 dias
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(30); setIsFiltersExpanded(false); }}>
                        16-30 dias
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(60); setIsFiltersExpanded(false); }}>
                        31-60 dias
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(999); setIsFiltersExpanded(false); }}>
                        +60 dias
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <div className="p-2">
                        <Label className="text-xs text-muted-foreground">Dias personalizados</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            type="number"
                            min="1"
                            placeholder="Ex: 45"
                            value={customOverdueDays}
                            onChange={(e) => setCustomOverdueDays(e.target.value)}
                            className="h-8 w-20"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (customOverdueDays && parseInt(customOverdueDays) > 0) {
                                setStatusFilter('overdue');
                                setOverdueDaysFilter(-1);
                                setIsFiltersExpanded(false);
                              }
                            }}
                          >
                            Aplicar
                          </Button>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={statusFilter === 'renegotiated' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setStatusFilter('renegotiated'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
                        className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'renegotiated' ? 'bg-yellow-500' : 'border-yellow-500 text-yellow-600 hover:bg-yellow-500/10'}`}
                      >
                        Reneg.
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
                        onClick={() => { setStatusFilter('interest_only'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
                        className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'interest_only' ? 'bg-purple-500' : 'border-purple-500 text-purple-600 hover:bg-purple-500/10'}`}
                      >
                        Só Juros
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
                        onClick={() => { setStatusFilter('weekly'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
                        className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'weekly' ? 'bg-orange-500' : 'border-orange-500 text-orange-600 hover:bg-orange-500/10'}`}
                      >
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        Semanal
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
                        onClick={() => { setStatusFilter('biweekly'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
                        className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'biweekly' ? 'bg-teal-500' : 'border-teal-500 text-teal-600 hover:bg-teal-500/10'}`}
                      >
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        Quinzenal
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
                        onClick={() => { setStatusFilter('installment'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
                        className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'installment' ? 'bg-emerald-500' : 'border-emerald-500 text-emerald-600 hover:bg-emerald-500/10'}`}
                      >
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        Mensal
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
                        onClick={() => { setStatusFilter('single'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
                        className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'single' ? 'bg-gray-500' : 'border-gray-500 text-gray-600 hover:bg-gray-500/10'}`}
                      >
                        <DollarSign className="w-3 h-3 mr-1" />
                        Única
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Empréstimos com pagamento em parcela única</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Toggle de Visualização */}
          <TooltipProvider delayDuration={200}>
            <div className="flex border rounded-md bg-muted/30">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                    className="h-8 px-2.5 rounded-r-none"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Visualização em Cards</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="h-8 px-2.5 rounded-l-none border-l"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Visualização em Lista</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
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
          ) : viewMode === 'table' ? (
            <LoansTableView 
              loans={sortedLoans}
              onPayment={(loanId) => {
                setSelectedLoanId(loanId);
                setIsPaymentDialogOpen(true);
              }}
              onPayInterest={openRenegotiateDialog}
              onEdit={openSimpleEditDialog}
              onRenegotiate={openEditDialog}
              onDelete={setDeleteId}
              onViewHistory={openPaymentHistory}
              getPaidInstallmentsCount={getPaidInstallmentsCount}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {sortedLoans.map((loan, loanIndex) => {
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
                
                // Adicionar multas aplicadas ao total a receber
                const totalAppliedPenaltiesForTotal = getTotalDailyPenalties(loan.notes);
                totalToReceive += totalAppliedPenaltiesForTotal;
                
                // Para pagamentos "só juros", o totalToReceive deve refletir o remaining + total_paid
                // porque o usuário pode ter adicionado juros extras
                if (isInterestOnlyPayment) {
                  totalToReceive = loan.remaining_balance + (loan.total_paid || 0) + totalAppliedPenaltiesForTotal;
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
                const totalAppliedPenalties = getTotalDailyPenalties(loan.notes);
                let remainingToReceive: number;
                if (loan.status === 'paid') {
                  remainingToReceive = 0;
                } else {
                  // SEMPRE usar remaining_balance do banco + multas aplicadas como fonte de verdade
                  remainingToReceive = Math.max(0, loan.remaining_balance + totalAppliedPenalties);
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
                
                // Parse overdue config from notes (percentage or fixed value)
                const overdueConfigMatch = loan.notes?.match(/\[OVERDUE_CONFIG:(percentage|fixed):([0-9.]+)\]/);
                const hasOverdueConfig = !!overdueConfigMatch;
                const overdueConfigType = overdueConfigMatch?.[1] as 'percentage' | 'fixed' | undefined;
                const overdueConfigValue = overdueConfigMatch ? parseFloat(overdueConfigMatch[2]) : 0;
                
                // Calculate days overdue
                const overdueDateObj = new Date(overdueDate + 'T12:00:00');
                overdueDateObj.setHours(0, 0, 0, 0);
                const daysOverdue = today > overdueDateObj ? Math.ceil((today.getTime() - overdueDateObj.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                
                // Calculate dynamic penalty based on config (percentage or fixed amount per day)
                let dynamicPenaltyAmount = 0;
                if (isOverdue && daysOverdue > 0 && hasOverdueConfig) {
                  // Para empréstimos diários, usar cálculo CUMULATIVO para TODAS as parcelas em atraso
                  if (isDaily) {
                    const loanStatusResult = getLoanStatus(loan);
                    if (loanStatusResult.overdueInstallmentsDetails.length > 0) {
                      const cumulativeResult = calculateCumulativePenalty(
                        loanStatusResult.overdueInstallmentsDetails,
                        overdueConfigType!,
                        overdueConfigValue,
                        totalPerInstallment,
                        numInstallments
                      );
                      dynamicPenaltyAmount = cumulativeResult.totalPenalty;
                    }
                  } else {
                    // Para outros tipos (mensal, semanal, etc.), manter cálculo simples
                    if (overdueConfigType === 'percentage') {
                      dynamicPenaltyAmount = (totalPerInstallment * (overdueConfigValue / 100)) * daysOverdue;
                    } else {
                      dynamicPenaltyAmount = overdueConfigValue * daysOverdue;
                    }
                  }
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
                      <div className="flex items-start gap-2 sm:gap-4">
                        <div className="relative group flex-shrink-0">
                          <Avatar className={`h-10 w-10 sm:h-14 sm:w-14 border-2 ${hasSpecialStyle ? 'border-white/30' : 'border-primary/20'}`}>
                            <AvatarImage src={loan.client?.avatar_url || ''} alt={loan.client?.full_name} />
                            <AvatarFallback className={`text-xs sm:text-base font-semibold ${hasSpecialStyle ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
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
                              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                            )}
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* LINHA 1: Nome + Botões na mesma linha */}
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="font-semibold text-sm sm:text-lg truncate">{loan.client?.full_name}</h3>
                            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                              <Button 
                                variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                size="sm" 
                                className={`h-5 sm:h-6 text-[8px] sm:text-[10px] px-1 sm:px-2 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                onClick={() => setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)}
                              >
                                {expandedLoanId === loan.id ? (
                                  <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 sm:mr-1" />
                                ) : (
                                  <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 sm:mr-1" />
                                )}
                                <span className="hidden sm:inline">Detalhes</span>
                              </Button>
                              <Button 
                                variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                size="sm" 
                                className={`tutorial-loan-receipt h-5 sm:h-6 text-[8px] sm:text-[10px] px-1 sm:px-2 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                onClick={() => handleGenerateLoanReceipt(loan)}
                              >
                                <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 sm:mr-1" />
                                <span className="hidden sm:inline">Comprovante</span>
                              </Button>
                            </div>
                          </div>
                          
                          {/* LINHA 2: Badges de status e tipo */}
                          <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 mt-1">
                            <Badge className={`text-[8px] sm:text-[10px] px-1 sm:px-1.5 ${hasSpecialStyle ? 'bg-white/20 text-white border-white/30' : getPaymentStatusColor(loan.status)}`}>
                              {isInterestOnlyPayment && !isOverdue ? 'Só Juros' : isRenegotiated && !isOverdue ? 'Reneg.' : getPaymentStatusLabel(loan.status)}
                            </Badge>
                            {loan.interest_mode === 'compound' && (
                              <Badge className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-purple-500/20 text-purple-300 border-purple-500/30">
                                J. Compostos
                              </Badge>
                            )}
                            {isDaily && (
                              <Badge className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-blue-500/30 text-blue-300 border-blue-500/50 font-bold">
                                DIÁRIO
                              </Badge>
                            )}
                            {isWeekly && (
                              <Badge className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-orange-500/30 text-orange-300 border-orange-500/50 font-bold">
                                SEMANAL
                              </Badge>
                            )}
                            {isBiweekly && (
                              <Badge className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-cyan-500/30 text-cyan-300 border-cyan-500/50 font-bold">
                                QUINZENAL
                              </Badge>
                            )}
                            {loan.payment_type === 'installment' && (
                              <Badge className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-emerald-500/30 text-emerald-300 border-emerald-500/50 font-bold">
                                MENSAL
                              </Badge>
                            )}
                            {/* 🆕 Badge roxo para contratos históricos com juros */}
                            {loan.notes?.includes('[HISTORICAL_INTEREST_CONTRACT]') && (
                              <Badge className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-purple-600/30 text-purple-300 border-purple-500/50 font-bold">
                                📜 JUROS ANTIGOS
                              </Badge>
                            )}
                            {/* Badge de funcionário criador (só para donos verem) */}
                            {!isEmployee && loan.creator_employee && (
                              <Badge className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-violet-500/30 text-violet-300 border-violet-500/50">
                                <UserCheck className="w-2.5 h-2.5 mr-0.5" />
                                {loan.creator_employee.name}
                              </Badge>
                            )}
                          </div>
                          
                          {/* LINHA 3: Valor em destaque */}
                          <p className={`text-lg sm:text-2xl font-bold mt-1.5 sm:mt-2 ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>{formatCurrency(remainingToReceive)}</p>
                          <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>
                            restante a receber
                            {totalAppliedPenalties > 0 && (
                              <span className="ml-1 text-red-400 font-medium">(+{formatCurrency(totalAppliedPenalties)} multas)</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      {/* Seção de Valores Resumida - Emprestado e Total */}
                      <div className={`grid grid-cols-2 gap-1.5 sm:gap-3 mt-2 sm:mt-4 p-1.5 sm:p-3 rounded-lg text-xs sm:text-sm ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
                        <div>
                          <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>Emprestado</p>
                          <p className="font-semibold text-xs sm:text-sm truncate">{formatCurrency(loan.principal_amount)}</p>
                        </div>
                        <div>
                          <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>Total a Receber</p>
                          <p className="font-semibold text-xs sm:text-sm truncate">{formatCurrency(totalToReceive)}</p>
                        </div>
                      </div>
                      
                      {/* Seção de Lucro - Previsto e Realizado (visível direto no card) */}
                      {(() => {
                        const penaltiesForProfit = getTotalDailyPenalties(loan.notes);
                        const expectedProfit = (isDaily ? dailyProfit : effectiveTotalInterest) + penaltiesForProfit;
                        const payments = (loan as any).loan_payments || [];
                        const realizedProfit = payments.reduce((sum: number, p: any) => 
                          sum + Number(p.interest_paid || 0), 0);
                        const profitPercentage = expectedProfit > 0 
                          ? Math.round((realizedProfit / expectedProfit) * 100) 
                          : 0;
                        
                        const interestPart = isDaily ? dailyProfit : effectiveTotalInterest;
                        
                        return (
                          <div className={`mt-1.5 sm:mt-2 p-1.5 sm:p-2 rounded-lg ${hasSpecialStyle ? 'bg-white/10' : 'bg-primary/5 border border-primary/20'}`}>
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                              <div>
                                <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>💰 Lucro Previsto</p>
                                <p className={`font-semibold text-xs sm:text-sm ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>
                                  {formatCurrency(expectedProfit)}
                                </p>
                                {penaltiesForProfit > 0 && (
                                  <div className={`flex flex-wrap gap-1 mt-0.5 text-[8px] sm:text-[9px] ${mutedTextColor}`}>
                                    <span className={`px-1 py-0.5 rounded ${hasSpecialStyle ? 'bg-white/10' : 'bg-blue-500/10 text-blue-600'}`}>
                                      📊 Juros: {formatCurrency(interestPart)}
                                    </span>
                                    <span className={`px-1 py-0.5 rounded ${hasSpecialStyle ? 'bg-white/10' : 'bg-orange-500/10 text-orange-600'}`}>
                                      ⚠️ Multas: {formatCurrency(penaltiesForProfit)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>✅ Lucro Realizado</p>
                                <div className="flex items-center gap-1">
                                  <p className={`font-semibold text-xs sm:text-sm ${hasSpecialStyle ? 'text-white' : 'text-emerald-500'}`}>
                                    {formatCurrency(realizedProfit)}
                                  </p>
                                  {expectedProfit > 0 && (
                                    <span className={`text-[8px] sm:text-[9px] px-1 py-0.5 rounded ${
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
                          </div>
                        );
                      })()}
                      
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
                      
                      {/* Info resumida - Vencimento e Pago */}
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-3 mt-1.5 sm:mt-3 text-[10px] sm:text-sm">
                        <Popover 
                          open={editingDueDateLoanId === loan.id} 
                          onOpenChange={(open) => {
                            if (open) {
                              setEditingDueDateLoanId(loan.id);
                              setEditingInstallmentIndex(null);
                              const dates = (loan.installment_dates as string[]) || [];
                              const paidCount = getPaidInstallmentsCount(loan);
                              const nextDate = dates[paidCount] || loan.due_date;
                              setNewDueDate(new Date(nextDate + 'T12:00:00'));
                            } else {
                              setEditingDueDateLoanId(null);
                              setEditingInstallmentIndex(null);
                              setNewDueDate(undefined);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <div className={`flex items-center gap-1 sm:gap-2 ${mutedTextColor} cursor-pointer hover:text-primary transition-colors group`}>
                              <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate group-hover:underline">
                                Venc: {(() => {
                                  const dates = (loan.installment_dates as string[]) || [];
                                  const paidCount = getPaidInstallmentsCount(loan);
                                  const nextDate = dates[paidCount] || loan.due_date;
                                  return formatDate(nextDate);
                                })()}
                              </span>
                              <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-50 group-hover:opacity-100 transition-opacity touch-manipulation" />
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            {((loan.installment_dates as string[]) || []).length > 1 ? (
                              // Empréstimo com MÚLTIPLAS PARCELAS: Lista de todas as parcelas
                              <div className="p-3 max-w-[320px]">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-medium">Datas das Parcelas</p>
                                  <p className="text-xs text-muted-foreground">Clique para editar</p>
                                </div>
                                
                                <ScrollArea className="h-[280px]">
                                  <div className="space-y-1">
                                    {((loan.installment_dates as string[]) || []).map((dateStr, index) => {
                                      const dailyPaidCount = getPaidInstallmentsCount(loan);
                                      const isPaidInstallment = index < dailyPaidCount;
                                      const isEditingThis = editingInstallmentIndex === index;
                                      const dateObj = new Date(dateStr + 'T12:00:00');
                                      const dayName = format(dateObj, 'EEE', { locale: ptBR });
                                      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                      
                                      return (
                                        <div key={index}>
                                          {isEditingThis ? (
                                            // Modo edição: mostrar calendário
                                            <div className="p-2 rounded-lg bg-muted/50 border border-primary/30">
                                              <p className="text-xs text-muted-foreground mb-2">
                                                Alterar data da parcela {index + 1}
                                              </p>
                                              <Calendar
                                                mode="single"
                                                selected={newDueDate}
                                                onSelect={(date) => date && setNewDueDate(date)}
                                                locale={ptBR}
                                                className="pointer-events-auto"
                                              />
                                              <div className="flex gap-2 mt-2">
                                                <Button
                                                  size="sm"
                                                  className="flex-1"
                                                  onClick={() => {
                                                    if (newDueDate) {
                                                      handleUpdateSpecificDate(loan.id, index, format(newDueDate, 'yyyy-MM-dd'));
                                                    }
                                                  }}
                                                >
                                                  Salvar
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => {
                                                    setEditingInstallmentIndex(null);
                                                    setNewDueDate(undefined);
                                                  }}
                                                >
                                                  Cancelar
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            // Modo visualização
                                            <div 
                                              className={`flex items-center gap-2 p-1.5 rounded-md transition-colors ${
                                                isPaidInstallment 
                                                  ? 'bg-green-500/10' 
                                                  : 'hover:bg-muted/50 cursor-pointer'
                                              }`}
                                              onClick={() => {
                                                if (!isPaidInstallment) {
                                                  setEditingInstallmentIndex(index);
                                                  setNewDueDate(new Date(dateStr + 'T12:00:00'));
                                                }
                                              }}
                                            >
                                              <span className={`w-7 text-xs font-medium ${
                                                isPaidInstallment ? 'text-green-400' : 'text-muted-foreground'
                                              }`}>
                                                {index + 1}ª
                                              </span>
                                              
                                              <span className={`flex-1 text-xs ${
                                                isPaidInstallment ? 'text-green-400' : isWeekend ? 'text-orange-400' : ''
                                              }`}>
                                                {formatDate(dateStr)} ({dayName})
                                              </span>
                                              
                                              {isPaidInstallment ? (
                                                <Check className="w-3.5 h-3.5 text-green-400" />
                                              ) : (
                                                <Pencil className="w-3 h-3 text-muted-foreground hover:text-primary" />
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </ScrollArea>
                                
                                <div className="flex justify-end mt-3 pt-3 border-t">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingDueDateLoanId(null)}
                                  >
                                    Fechar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // Empréstimo com 1 PARCELA: calendário simples
                              <div className="p-3">
                                <p className="text-xs text-muted-foreground mb-2">
                                  Alterar vencimento da parcela {getPaidInstallmentsCount(loan) + 1}
                                </p>
                                <Calendar
                                  mode="single"
                                  selected={newDueDate}
                                  onSelect={(date) => {
                                    if (date) {
                                      setNewDueDate(date);
                                    }
                                  }}
                                  initialFocus
                                  locale={ptBR}
                                  className="pointer-events-auto"
                                />
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => {
                                      if (newDueDate) {
                                        handleUpdateDueDate(loan.id, format(newDueDate, 'yyyy-MM-dd'));
                                      }
                                    }}
                                  >
                                    Salvar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingDueDateLoanId(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                        <div className={`flex items-center gap-1 sm:gap-2 p-1 sm:p-2 rounded-lg font-semibold ${hasSpecialStyle ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
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
                          {dynamicPenaltyAmount > 0 && totalAppliedPenalties === 0 && (
                            <>
                              <div className="flex items-center justify-between mt-2 text-xs sm:text-sm">
                                <span className="text-red-300">
                                  {overdueConfigType === 'percentage' 
                                    ? `Multa (${overdueConfigValue}%/dia de ${formatCurrency(totalPerInstallment)})`
                                    : `Multa (${formatCurrency(overdueConfigValue)}/dia)`}
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
                          
                          {/* Inline penalty configuration */}
                          {!hasOverdueConfig && configuringPenaltyLoanId !== loan.id && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setConfiguringPenaltyLoanId(loan.id);
                                setInlinePenaltyType('percentage');
                                setInlinePenaltyValue('');
                              }}
                              className="w-full mt-3 border-red-400/50 text-red-300 hover:bg-red-500/20"
                            >
                              <Percent className="w-4 h-4 mr-2" />
                              Aplicar Multa
                            </Button>
                          )}
                          
                          {configuringPenaltyLoanId === loan.id && (
                            <div className="mt-3 pt-3 border-t border-red-400/30 space-y-2">
                              <Label className="text-xs text-red-300">Tipo de multa</Label>
                              <Select 
                                value={inlinePenaltyType} 
                                onValueChange={(v) => {
                                  if (v === 'manual') {
                                    // Open manual penalty dialog for monthly loans
                                    const paidCount = getPaidInstallmentsCount(loan);
                                    openManualPenaltyDialog(
                                      loan,
                                      [{ index: paidCount, dueDate: loan.due_date, daysOverdue }],
                                      totalPerInstallment
                                    );
                                  } else {
                                    setInlinePenaltyType(v as 'percentage' | 'fixed');
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 bg-white/10 border-blue-400/50 text-red-100">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentage">% do valor da parcela/dia</SelectItem>
                                  <SelectItem value="fixed">R$ valor fixo/dia</SelectItem>
                                  <SelectItem value="manual">📝 Aplicar manualmente (valor fixo)</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Input 
                                type="number" 
                                step="0.01"
                                value={inlinePenaltyValue}
                                onChange={(e) => setInlinePenaltyValue(e.target.value)}
                                placeholder={inlinePenaltyType === 'percentage' ? 'Ex: 1.00' : 'Ex: 50.00'}
                                className="h-8 bg-white/10 border-blue-400/50 text-red-100 placeholder:text-red-300/50"
                              />
                              
                              {parseFloat(inlinePenaltyValue) > 0 && (
                                <div className="text-xs text-red-300/80 p-2 bg-red-500/10 rounded">
                                  {inlinePenaltyType === 'percentage' 
                                    ? `${inlinePenaltyValue}% de ${formatCurrency(totalPerInstallment)}/dia × ${daysOverdue} dias = ${formatCurrency((totalPerInstallment * (parseFloat(inlinePenaltyValue) / 100)) * daysOverdue)}`
                                    : `R$ ${inlinePenaltyValue}/dia × ${daysOverdue} dias = ${formatCurrency(parseFloat(inlinePenaltyValue) * daysOverdue)}`
                                  }
                                </div>
                              )}
                              
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSaveInlinePenalty(
                                    loan.id, 
                                    loan.notes, 
                                    getPaidInstallmentsCount(loan), 
                                    daysOverdue,
                                    totalPerInstallment,
                                    loan.payment_type === 'daily'
                                  )}
                                  className="flex-1 bg-red-600 hover:bg-red-700"
                                >
                                  Salvar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => setConfiguringPenaltyLoanId(null)}
                                  className="border-red-400/50 text-red-300"
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {hasOverdueConfig && configuringPenaltyLoanId !== loan.id && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => {
                                setConfiguringPenaltyLoanId(loan.id);
                                setInlinePenaltyType(overdueConfigType || 'percentage');
                                setInlinePenaltyValue(overdueConfigValue.toString());
                              }}
                              className="w-full mt-2 text-red-300/70 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Editar multa
                            </Button>
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
                                amount: getEffectiveInstallmentValue(loan, totalPerInstallment, getPaidInstallmentsCount(loan)),
                                dueDate: overdueDate,
                                daysOverdue: daysOverdue,
                                loanId: loan.id,
                                // Multa dinâmica (só passa se não há multa manual aplicada)
                                penaltyAmount: dynamicPenaltyAmount > 0 && totalAppliedPenalties === 0 ? dynamicPenaltyAmount : undefined,
                                penaltyType: overdueConfigType || undefined,
                                penaltyValue: overdueConfigValue > 0 ? overdueConfigValue : undefined,
                                interestAmount: calculatedInterestPerInstallment > 0 ? calculatedInterestPerInstallment : undefined,
                                principalAmount: principalPerInstallment > 0 ? principalPerInstallment : undefined,
                                isDaily: loan.payment_type === 'daily',
                                // Multa manual (usada quando há multa aplicada manualmente)
                                manualPenaltyAmount: totalAppliedPenalties > 0 ? totalAppliedPenalties : undefined,
                                hasDynamicPenalty: overdueConfigValue > 0,
                                // Status das parcelas com emojis
                                installmentDates: (loan.installment_dates as string[]) || [],
                                paidCount: getPaidInstallmentsCount(loan),
                              }}
                              className="w-full mt-2"
                            />
                          )}
                          {/* Botão de lembrete do dia para contratos diários em atraso - SÓ mostrar se há parcela vencendo HOJE */}
                          {(() => {
                            const todayInfo = getTodayInstallmentInfo(loan);
                            if (!todayInfo || !profile?.whatsapp_to_clients_enabled || !loan.client?.phone || loan.payment_type !== 'daily') {
                              return null;
                            }
                            return (
                              <SendDueTodayNotification
                                data={{
                                  clientName: loan.client?.full_name || 'Cliente',
                                  clientPhone: loan.client.phone,
                                  contractType: 'loan',
                                  installmentNumber: todayInfo.installmentNumber,
                                  totalInstallments: todayInfo.totalInstallments,
                                  amount: getEffectiveInstallmentValue(loan, totalPerInstallment, getPaidInstallmentsCount(loan)),
                                  dueDate: todayInfo.dueDate,
                                  loanId: loan.id,
                                  interestAmount: calculatedInterestPerInstallment > 0 ? calculatedInterestPerInstallment : undefined,
                                  principalAmount: principalPerInstallment > 0 ? principalPerInstallment : undefined,
                                  isDaily: loan.payment_type === 'daily',
                                  // Status das parcelas com emojis
                                  installmentDates: (loan.installment_dates as string[]) || [],
                                  paidCount: getPaidInstallmentsCount(loan),
                                }}
                                className="w-full mt-2"
                              />
                            );
                          })()}
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
                                  amount: getEffectiveInstallmentValue(loan, totalPerInstallment, getPaidInstallmentsCount(loan)),
                                  dueDate: dueTodayDate,
                                  loanId: loan.id,
                                  interestAmount: calculatedInterestPerInstallment > 0 ? calculatedInterestPerInstallment : undefined,
                                  principalAmount: principalPerInstallment > 0 ? principalPerInstallment : undefined,
                                  isDaily: loan.payment_type === 'daily',
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
                                  amount: getEffectiveInstallmentValue(loan, totalPerInstallment, paidCount),
                                  dueDate: nextDueDate,
                                  daysUntilDue: daysUntilDue,
                                  loanId: loan.id,
                                  interestAmount: calculatedInterestPerInstallment > 0 ? calculatedInterestPerInstallment : undefined,
                                  principalAmount: principalPerInstallment > 0 ? principalPerInstallment : undefined,
                                  isDaily: loan.payment_type === 'daily',
                                  // Status das parcelas com emojis
                                  installmentDates: (loan.installment_dates as string[]) || [],
                                  paidCount: paidCount,
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
                                    
                                    // Usar a próxima parcela do array installment_dates
                                    if (dates.length > 0 && paidCount + 1 < dates.length) {
                                      // Há próxima parcela - usar ela diretamente
                                      defaultNextDueDate = dates[paidCount + 1];
                                    } else if (dates.length > 0 && paidCount < dates.length) {
                                      // É a última parcela - não há próximo vencimento
                                      defaultNextDueDate = '';
                                    } else if (loan.due_date) {
                                      // Fallback para empréstimos sem installment_dates
                                      const dueDate = new Date(loan.due_date + 'T12:00:00');
                                      // Usar addMonths do date-fns para evitar bugs na virada de ano
                                      const nextDueDate = addMonths(dueDate, 1);
                                      defaultNextDueDate = format(nextDueDate, 'yyyy-MM-dd');
                                    }
                                    
                                    setPaymentData({ 
                                      amount: '', 
                                      payment_date: format(new Date(), 'yyyy-MM-dd'),
                                      new_due_date: defaultNextDueDate,
                                      payment_type: 'partial', 
                                      selected_installments: [], 
                                      partial_installment_index: null, 
                                      send_notification: false,
                                      is_advance_payment: false,
                                      recalculate_interest: false 
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
                            {/* Botão de Edição Simples (Lápis) - Edita datas e valores do contrato atual */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="icon" 
                                  className={`h-7 w-7 sm:h-8 sm:w-8 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : 'border-blue-500 text-blue-500 hover:bg-blue-500/10'}`}
                                  onClick={() => openSimpleEditDialog(loan.id)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Editar datas e valores do contrato</p>
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
                            {/* Espaçador para separar edição de ações destrutivas */}
                            <div className="w-2" />
                            {/* Botão de Renegociação - Cria novo contrato baseado no saldo devedor */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="icon" 
                                  className={`h-7 w-7 sm:h-8 sm:w-8 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : 'border-amber-500 text-amber-500 hover:bg-amber-500/10'}`}
                                  onClick={() => openEditDialog(loan.id)}
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Renegociar contrato (criar novo baseado no saldo)</p>
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
                      
                      {/* Área Expandida com Informações Detalhadas */}
                      <AnimatePresence>
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
                            .replace(/\[HISTORICAL_INTEREST_CONTRACT\]/g, '')
                            .replace(/\[RENEGOTIATED\]/g, '')
                            .replace(/\[INTEREST_ONLY_PAYMENT\]/g, '')
                            .replace(/\[INTEREST_ONLY_PAID:\d+:[0-9.]+:[^\]]+\]/g, '')
                            .replace(/\[PARTIAL_PAID:\d+:[0-9.]+\]/g, '')
                            .replace(/\[ADVANCE_SUBPARCELA:\d+:[0-9.]+:[^\]]+\]/g, '')
                            .replace(/\[ADVANCE_SUBPARCELA_PAID:\d+:[0-9.]+:[^\]]+\]/g, '')
                            .replace(/\[INTEREST_SUBPARCELA:\d+:[0-9.]+:[^:\]]+:[^\]]+\]/g, '')
                            .replace(/\[INTEREST_SUBPARCELA_PAID:\d+:[0-9.]+:[^:\]]+:[^\]]+\]/g, '')
                            .replace(/\[FROZEN_INSTALLMENTS:\d+\]/g, '')
                            .replace(/\[RENEWAL_FEE_INSTALLMENT:\d+:[0-9.]+(?::[0-9.]+)?\]/g, '')
                            .replace(/\[ORIGINAL_PRINCIPAL:[0-9.]+\]/g, '')
                            .replace(/\[ORIGINAL_RATE:[0-9.]+\]/g, '')
                            .replace(/\[ORIGINAL_INSTALLMENTS:\d+\]/g, '')
                            .replace(/\[ORIGINAL_INTEREST_MODE:[^\]]+\]/g, '')
                            .replace(/\[ORIGINAL_TOTAL_INTEREST:[0-9.]+\]/g, '')
                            .replace(/\[HISTORICAL_PAID:[0-9.]+\]/g, '')
                            .replace(/\[HISTORICAL_INTEREST_PAID:[0-9.]+\]/g, '')
                            .replace(/\[RENEGOTIATION_DATE:[^\]]+\]/g, '')
                            .replace(/\[JUROS_HISTORICO_DATADO\]/g, '')
                            .replace(/\[HISTORICAL_INTEREST_RECEIVED:[0-9.]+\]/g, '')
                            .replace(/\[HISTORICAL_INTEREST:[0-9.]+\]/g, '')
                            .replace(/\[INTEREST_NOTES:[^\]]*\]/g, '')
                            .trim();
                        };
                        
                        const displayNotes = cleanNotes(loan.notes);
                        
                        // Calcular status de cada parcela (simplificado - sem frozen/interest_mode)
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
                        
                        // Lucro previsto e realizado
                        const penaltiesForProfit = getTotalDailyPenalties(loan.notes);
                        const expectedProfit = (isDaily ? dailyProfit : effectiveTotalInterest) + penaltiesForProfit;
                        const payments = (loan as any).loan_payments || [];
                        const realizedProfit = payments.reduce((sum: number, p: any) => 
                          sum + Number(p.interest_paid || 0), 0);
                        const profitPercentage = expectedProfit > 0 
                          ? Math.round((realizedProfit / expectedProfit) * 100) 
                          : 0;
                        
                        const interestPart = isDaily ? dailyProfit : effectiveTotalInterest;
                        
                        return (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className={`mt-3 pt-3 border-t space-y-3 overflow-hidden ${hasSpecialStyle ? 'border-white/20' : 'border-border'}`}
                          >
                            {/* Seção de Lucro - Previsto e Realizado (movido para área expandível) */}
                            <div className={`p-2 sm:p-3 rounded-lg ${hasSpecialStyle ? 'bg-white/10' : 'bg-primary/5 border border-primary/20'}`}>
                              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                <div>
                                  <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>💰 Lucro Previsto</p>
                                  <p className={`font-semibold text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>
                                    {formatCurrency(expectedProfit)}
                                  </p>
                                  {penaltiesForProfit > 0 && (
                                    <div className={`flex flex-wrap gap-1 mt-1 text-[9px] sm:text-[10px] ${mutedTextColor}`}>
                                      <span className={`px-1.5 py-0.5 rounded ${hasSpecialStyle ? 'bg-white/10' : 'bg-blue-500/10 text-blue-600'}`}>
                                        📊 Juros: {formatCurrency(interestPart)}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded ${hasSpecialStyle ? 'bg-white/10' : 'bg-orange-500/10 text-orange-600'}`}>
                                        ⚠️ Multas: {formatCurrency(penaltiesForProfit)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>✅ Lucro Realizado</p>
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
                            </div>
                            
                            {/* Juros Antigos Recebidos - para contratos históricos */}
                            {(() => {
                              const historicalInterestAmount = getHistoricalInterestReceived(loan.notes);
                              if (historicalInterestAmount <= 0) return null;
                              
                              return (
                                <div className={`rounded-lg p-3 ${hasSpecialStyle ? 'bg-purple-500/20' : 'bg-purple-50 border border-purple-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <p className={`font-medium text-sm ${hasSpecialStyle ? 'text-purple-200' : 'text-purple-700'}`}>
                                      💜 Juros Antigos Recebidos
                                    </p>
                                    <p className={`font-bold text-lg ${hasSpecialStyle ? 'text-white' : 'text-purple-600'}`}>
                                      {formatCurrency(historicalInterestAmount)}
                                    </p>
                                  </div>
                                  <p className={`text-xs mt-1 ${hasSpecialStyle ? 'text-purple-300' : 'text-purple-500'}`}>
                                    Juros já recebidos antes de cadastrar este contrato
                                  </p>
                                </div>
                              );
                            })()}
                            
                            {/* Detalhes adicionais: Juros e Parcelas */}
                            <div className={`grid grid-cols-2 gap-2 text-xs sm:text-sm ${hasSpecialStyle ? '' : ''}`}>
                              <div className={`flex items-center gap-1.5 ${mutedTextColor}`}>
                                <Percent className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                {isDaily ? (
                                  <span className="truncate">Lucro: {formatCurrency(dailyProfit)}</span>
                                ) : (
                                  <span className="truncate">Juros: {formatPercentage(loan.interest_rate)}</span>
                                )}
                              </div>
                              <div className={`flex items-center gap-1.5 ${mutedTextColor}`}>
                                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                <span className="truncate">{numInstallments}x {formatCurrency(totalPerInstallment)}</span>
                              </div>
                            </div>
                            
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
                            {(dates.length > 0 || loan.payment_type === 'single') && (
                              <div className={`rounded-lg p-3 ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
                                <p className={`font-medium text-sm mb-2 ${hasSpecialStyle ? 'text-white' : ''}`}>📅 Cronograma de Parcelas</p>
                                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                                  {/* Para pagamento único sem dates, usar due_date como parcela única */}
                                  {(dates.length > 0 ? dates : [loan.due_date]).map((date, idx) => {
                                    const statusInfo = getInstallmentStatusForDisplay(idx, date);
                                    
                                    // Get penalty for this installment (works for all loan types including daily)
                                    const installmentPenalty = (() => {
                                      const dailyPenalties = getDailyPenaltiesFromNotes(loan.notes);
                                      return dailyPenalties[idx] || 0;
                                    })();
                                    
                                    // Calculate days overdue for this specific installment
                                    const installmentDaysOverdue = (() => {
                                      if (statusInfo.status !== 'overdue') return 0;
                                      const dueDate = new Date(date + 'T12:00:00');
                                      dueDate.setHours(0, 0, 0, 0);
                                      const todayDate = new Date();
                                      todayDate.setHours(0, 0, 0, 0);
                                      return Math.ceil((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                                    })();
                                    
                                    return (
                                      <div key={idx} className={`py-1.5 ${idx < dates.length - 1 ? 'border-b border-border/30' : ''}`}>
                                        <div className="flex items-center justify-between text-xs">
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
                                        
                                        {/* Show penalty details for installment with penalty */}
                                        {installmentPenalty > 0 && (
                                          <div className={`mt-1.5 p-2 rounded ${hasSpecialStyle ? 'bg-orange-500/20' : 'bg-orange-50 dark:bg-orange-500/10'}`}>
                                            <div className="flex items-center justify-between text-xs">
                                              <span className={hasSpecialStyle ? 'text-orange-300' : 'text-orange-600 dark:text-orange-400'}>
                                                🔥 Multa aplicada ({installmentDaysOverdue} dias)
                                              </span>
                                              <div className="flex items-center gap-1">
                                                <span className={`font-bold ${hasSpecialStyle ? 'text-orange-200' : 'text-orange-700 dark:text-orange-300'}`}>
                                                  + {formatCurrency(installmentPenalty)}
                                                </span>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditPenaltyDialog({
                                                      isOpen: true,
                                                      loanId: loan.id,
                                                      installmentIndex: idx,
                                                      currentValue: installmentPenalty,
                                                      currentNotes: loan.notes
                                                    });
                                                    setEditPenaltyValue(installmentPenalty.toString());
                                                  }}
                                                  className={`p-1 rounded hover:bg-blue-500/20 transition-colors ${hasSpecialStyle ? 'text-blue-300 hover:text-blue-200' : 'text-blue-500 hover:text-blue-600'}`}
                                                  title="Editar multa"
                                                >
                                                  <Pencil className="w-3 h-3" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveDailyPenalty(loan.id, idx, loan.notes);
                                                  }}
                                                  className={`p-1 rounded hover:bg-red-500/20 transition-colors ${hasSpecialStyle ? 'text-red-300 hover:text-red-200' : 'text-red-500 hover:text-red-600'}`}
                                                  title="Remover multa"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              </div>
                                            </div>
                                            <div className={`text-[10px] mt-0.5 ${hasSpecialStyle ? 'text-orange-300/70' : 'text-orange-500/70'}`}>
                                              Total com multa: {formatCurrency(totalPerInstallment + installmentPenalty)}
                                            </div>
                                          </div>
                                        )}
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
                          </motion.div>
                        );
                      })()}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          </TabsContent>

          <TabsContent value="daily" className="space-y-3 sm:space-y-4">
            {/* Resumo do Dia */}
            {(() => {
              const dailyLoans = loans.filter(l => l.payment_type === 'daily');
              const activeDailyLoans = dailyLoans.filter(l => l.status !== 'paid');
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              let dueToday = 0;
              let profitToday = 0;
              let dueTodayCount = 0;
              let receivedToday = 0;
              let receivedTodayCount = 0;
              let totalOverdue = 0;
              let overdueCount = 0;
              
              // Calcular parcelas a cobrar hoje (empréstimos ativos)
              activeDailyLoans.forEach(loan => {
                const numInstallments = loan.installments || 1;
                const dailyInstallmentAmount = loan.total_interest || 0;
                const principalPerInstallment = loan.principal_amount / numInstallments;
                const profitPerInstallment = dailyInstallmentAmount - principalPerInstallment;
                
                const paidCount = getPaidInstallmentsCount(loan);
                const dates = (loan.installment_dates as string[]) || [];
                
                // Verificar próxima parcela não paga
                if (paidCount < dates.length) {
                  const nextDueDate = new Date(dates[paidCount] + 'T12:00:00');
                  nextDueDate.setHours(0, 0, 0, 0);
                  
                  if (nextDueDate.getTime() === today.getTime()) {
                    dueToday += dailyInstallmentAmount;
                    profitToday += profitPerInstallment;
                    dueTodayCount++;
                  }
                  
                  // Contar parcelas em atraso
                  for (let i = paidCount; i < dates.length; i++) {
                    const dueDate = new Date(dates[i] + 'T12:00:00');
                    dueDate.setHours(0, 0, 0, 0);
                    if (dueDate < today) {
                      totalOverdue += dailyInstallmentAmount;
                      if (i === paidCount) overdueCount++; // Conta o cliente uma vez
                    }
                  }
                }
              });
              
              // Calcular parcelas recebidas hoje (todos os empréstimos diários)
              dailyLoans.forEach(loan => {
                const dailyInstallmentAmount = loan.total_interest || 0;
                const paidCount = getPaidInstallmentsCount(loan);
                const dates = (loan.installment_dates as string[]) || [];
                
                // Verificar parcelas pagas que vencem hoje
                for (let i = 0; i < paidCount && i < dates.length; i++) {
                  const dueDate = new Date(dates[i] + 'T12:00:00');
                  dueDate.setHours(0, 0, 0, 0);
                  if (dueDate.getTime() === today.getTime()) {
                    receivedToday += dailyInstallmentAmount;
                    receivedTodayCount++;
                  }
                }
              });
              
              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  <Card className="bg-sky-500/10 border-sky-500/30">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarIcon className="w-4 h-4 text-sky-500" />
                        <span className="text-xs text-muted-foreground">A Cobrar Hoje</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-sky-600 dark:text-sky-400">{formatCurrency(dueToday)}</p>
                      <p className="text-xs text-muted-foreground">{dueTodayCount} parcela{dueTodayCount !== 1 ? 's' : ''}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-emerald-500/10 border-emerald-500/30">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">Lucro do Dia</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(profitToday)}</p>
                      <p className="text-xs text-muted-foreground">previsto</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-emerald-500/10 border-emerald-500/30">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">Recebido Hoje</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(receivedToday)}</p>
                      <p className="text-xs text-muted-foreground">{receivedTodayCount} parcela{receivedTodayCount !== 1 ? 's' : ''}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-destructive/10 border-destructive/30">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Bell className="w-4 h-4 text-destructive" />
                        <span className="text-xs text-muted-foreground">Em Atraso</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-destructive">{formatCurrency(totalOverdue)}</p>
                      <p className="text-xs text-muted-foreground">{overdueCount} cliente{overdueCount !== 1 ? 's' : ''}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative tutorial-search flex-1">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm" />
              </div>
              
              {/* Toggle de Visualização para Diários */}
              <TooltipProvider delayDuration={200}>
                <div className="flex border rounded-md bg-muted/30">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={dailyViewMode === 'cards' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setDailyViewMode('cards')}
                        className="h-9 sm:h-10 px-2.5 rounded-r-none"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Visualização em Cards</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={dailyViewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setDailyViewMode('table')}
                        className="h-9 sm:h-10 px-2.5 rounded-l-none border-l"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Visualização em Lista</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              
              {/* Filtro por funcionário (só para donos) */}
              {!isEmployee && myEmployees && myEmployees.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={filterByEmployee ? 'default' : 'outline'}
                      size="sm"
                      className={`gap-1 text-xs sm:text-sm h-9 sm:h-10 ${
                        filterByEmployee ? 'bg-violet-500 hover:bg-violet-600' : 
                        'border-violet-500 text-violet-600 hover:bg-violet-500/10'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {!filterByEmployee ? 'Criador' : 
                          filterByEmployee === 'owner' ? 'Meus' : 
                          myEmployees.find(e => e.employee_user_id === filterByEmployee)?.name || 'Func.'}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background z-50">
                    <DropdownMenuItem onClick={() => setFilterByEmployee(null)}>
                      <span className="font-medium">Todos</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilterByEmployee('owner')}>
                      Criados por mim
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {myEmployees.map(emp => (
                      <DropdownMenuItem 
                        key={emp.employee_user_id} 
                        onClick={() => setFilterByEmployee(emp.employee_user_id)}
                      >
                        {emp.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="tutorial-new-daily gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10 border-sky-500 text-sky-600 hover:bg-sky-500/10"
                onClick={() => setIsDailyDialogOpen(true)}
              >
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Novo Diário
              </Button>
            </div>

            <Collapsible open={isFiltersExpanded} onOpenChange={setIsFiltersExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 text-xs sm:text-sm px-3 gap-2 ${statusFilter !== 'all' ? 'border-primary text-primary' : ''}`}
                >
                  <Search className="w-3 h-3" />
                  {statusFilter === 'all' ? 'Filtros' : 
                    statusFilter === 'pending' ? 'Em Dia' :
                    statusFilter === 'paid' ? 'Pagos' :
                    statusFilter === 'overdue' ? 'Atraso' : 'Filtros'
                  }
                  {isFiltersExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <TooltipProvider delayDuration={300}>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 p-3 bg-muted/50 rounded-lg border">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={statusFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => { setStatusFilter('all'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
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
                          onClick={() => { setStatusFilter('pending'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
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
                          onClick={() => { setStatusFilter('paid'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}
                          className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'paid' ? 'bg-primary' : 'border-primary text-primary hover:bg-primary/10'}`}
                        >
                          Pagos
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>Empréstimos quitados</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={statusFilter === 'overdue' ? 'default' : 'outline'}
                          size="sm"
                          className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${statusFilter === 'overdue' ? 'bg-destructive' : 'border-destructive text-destructive hover:bg-destructive/10'}`}
                        >
                          {statusFilter === 'overdue' && overdueDaysFilter !== null
                            ? overdueDaysFilter === 5 ? 'Atraso 1-5d'
                              : overdueDaysFilter === 10 ? 'Atraso 6-10d'
                              : overdueDaysFilter === 15 ? 'Atraso 11-15d'
                              : overdueDaysFilter === 30 ? 'Atraso 16-30d'
                              : overdueDaysFilter === 60 ? 'Atraso 31-60d'
                              : overdueDaysFilter === 999 ? 'Atraso +60d'
                              : 'Atraso'
                            : 'Atraso'}
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-background">
                        <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(null); setIsFiltersExpanded(false); }}>
                          Todos em atraso
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(5); setIsFiltersExpanded(false); }}>
                          1-5 dias
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(10); setIsFiltersExpanded(false); }}>
                          6-10 dias
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(15); setIsFiltersExpanded(false); }}>
                          11-15 dias
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(30); setIsFiltersExpanded(false); }}>
                          16-30 dias
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(60); setIsFiltersExpanded(false); }}>
                          31-60 dias
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setStatusFilter('overdue'); setOverdueDaysFilter(999); setIsFiltersExpanded(false); }}>
                          +60 dias
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TooltipProvider>
              </CollapsibleContent>
            </Collapsible>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[...Array(6)].map((_, i) => (<Skeleton key={i} className="h-40 sm:h-48 w-full rounded-xl" />))}
              </div>
            ) : filteredLoans.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Clock className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground">{search ? 'Nenhum empréstimo diário encontrado' : 'Nenhum empréstimo diário cadastrado'}</p>
              </div>
            ) : dailyViewMode === 'table' ? (
              <LoansTableView 
                loans={sortedLoans}
                onPayment={(loanId) => {
                  setSelectedLoanId(loanId);
                  setIsPaymentDialogOpen(true);
                }}
                onPayInterest={openRenegotiateDialog}
                onEdit={openSimpleEditDialog}
                onRenegotiate={openEditDialog}
                onDelete={setDeleteId}
                onViewHistory={openPaymentHistory}
                getPaidInstallmentsCount={getPaidInstallmentsCount}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {sortedLoans.map((loan, loanIndex) => {
                  const isDaily = loan.payment_type === 'daily';
                  const numInstallments = loan.installments || 1;
                  const dailyInstallmentAmount = isDaily ? (loan.total_interest || 0) : 0;
                  const dailyTotalToReceive = isDaily ? dailyInstallmentAmount * numInstallments : 0;
                  const dailyProfit = isDaily ? (dailyTotalToReceive - loan.principal_amount) : 0;
                  const totalPerInstallment = dailyInstallmentAmount;
                  
                  const { isPaid, isRenegotiated, isOverdue, overdueInstallmentIndex, overdueDate, daysOverdue, overdueInstallmentsDetails } = getLoanStatus(loan);
                  const totalAppliedPenaltiesDaily = getTotalDailyPenalties(loan.notes);
                  const remainingToReceive = loan.status === 'paid' ? 0 : Math.max(0, loan.remaining_balance + totalAppliedPenaltiesDaily);
                  
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
                  
                  const expectedProfit = dailyProfit + totalAppliedPenaltiesDaily;
                  const realizedProfit = loan.total_paid ? Math.min(loan.total_paid - (loan.principal_amount * (loan.total_paid / dailyTotalToReceive)), expectedProfit * (loan.total_paid / dailyTotalToReceive)) : 0;
                  const profitPercentage = expectedProfit > 0 ? Math.round((realizedProfit / expectedProfit) * 100) : 0;
                  
                  const overdueConfigResult = (() => {
                    const overdueMatch = (loan.notes || '').match(/\[OVERDUE_CONFIG:(percentage|fixed):([0-9.]+)\]/);
                    if (overdueMatch) {
                      return { type: overdueMatch[1] as 'percentage' | 'fixed', value: parseFloat(overdueMatch[2]) };
                    }
                    // Fallback for old format without type
                    const oldMatch = (loan.notes || '').match(/\[OVERDUE_CONFIG:(\d+(?:\.\d+)?)\]/);
                    if (oldMatch) {
                      return { type: 'fixed' as const, value: parseFloat(oldMatch[1]) };
                    }
                    return { type: 'fixed' as const, value: 0 };
                  })();
                  const overdueConfigType = overdueConfigResult.type;
                  const overdueConfigValue = overdueConfigResult.value;
                  
                  // NOVO: Calcular breakdown para TODAS as parcelas em atraso (mesmo sem multa dinâmica)
                  // Isso garante que a mensagem WhatsApp tenha todas as parcelas, mesmo que overdueConfigValue seja 0
                  const cumulativePenaltyResult = overdueInstallmentsDetails.length > 0
                    ? calculateCumulativePenalty(
                        overdueInstallmentsDetails,
                        overdueConfigType,
                        overdueConfigValue, // Se for 0, penaltyAmount será 0, mas o breakdown será gerado
                        dailyInstallmentAmount,
                        numInstallments
                      )
                    : { totalPenalty: 0, penaltyBreakdown: [], totalOverdueAmount: 0, totalWithPenalties: 0 };
                  
                  // Usar multa cumulativa para contratos diários
                  const dynamicPenaltyAmount = cumulativePenaltyResult.totalPenalty;

                  // Cálculos adicionais para o card completo
                  const initials = loan.client?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '';
                  const totalToReceive = dailyTotalToReceive + totalAppliedPenaltiesDaily;
                  const effectiveTotalInterest = dailyProfit;
                  const totalPerInstallmentDisplay = dailyInstallmentAmount;
                  
                  // Funções de parcelas
                  const partialPayments = getPartialPaymentsFromNotes(loan.notes);
                  const advanceSubparcelas = getAdvanceSubparcelasFromNotes(loan.notes);
                  
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
                      .replace(/\[OVERDUE_CONFIG:[^\]]+\]/g, '')
                      .trim();
                  };
                  
                  const displayNotes = cleanNotes(loan.notes);
                  
                  const getCardStyle = () => {
                    if (isPaid) return 'bg-gradient-to-r from-emerald-500 to-primary text-white border-emerald-400';
                    if (isOverdue) return 'bg-gradient-to-r from-red-500/70 to-blue-500/70 text-white border-red-400 dark:from-red-500/80 dark:to-blue-500/80';
                    if (isDueToday) return 'bg-gradient-to-r from-blue-500/30 to-amber-500/30 border-amber-400 dark:from-blue-500/40 dark:to-amber-500/40';
                    return 'bg-blue-500/20 border-blue-400 dark:bg-blue-500/30 dark:border-blue-400';
                  };
                  
                  const textColor = isPaid ? 'text-white' : isOverdue ? 'text-red-300' : isDueToday ? 'text-amber-300' : '';
                  
                  return (
                    <Card key={loan.id} className={`shadow-soft hover:shadow-md transition-shadow border ${getCardStyle()} ${textColor}`}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-2 sm:gap-4">
                          <div className="relative group flex-shrink-0">
                            <Avatar className={`h-10 w-10 sm:h-14 sm:w-14 border-2 ${hasSpecialStyle ? 'border-white/30' : 'border-primary/20'}`}>
                              <AvatarImage src={loan.client?.avatar_url || ''} alt={loan.client?.full_name} />
                              <AvatarFallback className={`text-xs sm:text-base font-semibold ${hasSpecialStyle ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
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
                                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              )}
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* LINHA 1: Nome + Botões na mesma linha */}
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="font-semibold text-sm sm:text-lg truncate">{loan.client?.full_name}</h3>
                              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="sm" 
                                  className={`h-5 sm:h-6 text-[8px] sm:text-[10px] px-1 sm:px-2 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                  onClick={() => setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)}
                                >
                                  {expandedLoanId === loan.id ? (
                                    <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 sm:mr-1" />
                                  ) : (
                                    <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 sm:mr-1" />
                                  )}
                                  <span className="hidden sm:inline">Detalhes</span>
                                </Button>
                                <Button 
                                  variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                  size="sm" 
                                  className={`h-5 sm:h-6 text-[8px] sm:text-[10px] px-1 sm:px-2 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : ''}`}
                                  onClick={() => handleGenerateLoanReceipt(loan)}
                                >
                                  <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Comprovante</span>
                                </Button>
                              </div>
                            </div>
                            
                            {/* LINHA 2: Badges de status e tipo */}
                            <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 mt-1">
                              <Badge className={`text-[8px] sm:text-[10px] px-1 sm:px-1.5 ${hasSpecialStyle ? 'bg-white/20 text-white border-white/30' : getPaymentStatusColor(loan.status)}`}>
                                {getPaymentStatusLabel(loan.status)}
                              </Badge>
                              <Badge className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-blue-500/30 text-blue-300 border-blue-500/50 font-bold">
                                DIÁRIO
                              </Badge>
                              {/* Badge do funcionário criador (só para donos) */}
                              {!isEmployee && loan.creator_employee && (
                                <Badge variant="secondary" className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-violet-500/30 text-violet-300 border-violet-500/50">
                                  <UserCheck className="w-2.5 h-2.5 mr-0.5" />
                                  {loan.creator_employee.name}
                                </Badge>
                              )}
                            </div>
                            
                            {/* LINHA 3: Valor em destaque */}
                            <p className={`text-lg sm:text-2xl font-bold mt-1.5 sm:mt-2 ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>{formatCurrency(remainingToReceive)}</p>
                            <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>
                              restante a receber
                              {totalAppliedPenaltiesDaily > 0 && (
                                <span className="ml-1 text-red-400 font-medium">(+{formatCurrency(totalAppliedPenaltiesDaily)} multas)</span>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        {/* Seção de Valores Resumida - Emprestado e Total */}
                        <div className={`grid grid-cols-2 gap-1.5 sm:gap-3 mt-2 sm:mt-4 p-1.5 sm:p-3 rounded-lg text-xs sm:text-sm ${hasSpecialStyle ? 'bg-white/10' : 'bg-muted/30'}`}>
                          <div>
                            <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>Emprestado</p>
                            <p className="font-semibold text-xs sm:text-sm truncate">{formatCurrency(loan.principal_amount)}</p>
                          </div>
                          <div>
                            <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>Total a Receber</p>
                            <p className="font-semibold text-xs sm:text-sm truncate">{formatCurrency(totalToReceive)}</p>
                          </div>
                        </div>
                        
                        {/* Seção de Lucro - Previsto e Realizado (visível direto no card) */}
                        {(() => {
                          const expectedProfitCard = dailyProfit + totalAppliedPenaltiesDaily;
                          const paymentsCard = (loan as any).loan_payments || [];
                          const realizedProfitCard = paymentsCard.reduce((sum: number, p: any) => 
                            sum + Number(p.interest_paid || 0), 0);
                          const profitPercentageCard = expectedProfitCard > 0 
                            ? Math.round((realizedProfitCard / expectedProfitCard) * 100) 
                            : 0;
                          
                          return (
                            <div className={`mt-1.5 sm:mt-2 p-1.5 sm:p-2 rounded-lg ${hasSpecialStyle ? 'bg-white/10' : 'bg-primary/5 border border-primary/20'}`}>
                              <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                                <div>
                                  <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>💰 Lucro Previsto</p>
                                  <p className={`font-semibold text-xs sm:text-sm ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>
                                    {formatCurrency(expectedProfitCard)}
                                  </p>
                                  {totalAppliedPenaltiesDaily > 0 && (
                                    <div className={`flex flex-wrap gap-1 mt-0.5 text-[8px] sm:text-[9px] ${mutedTextColor}`}>
                                      <span className={`px-1 py-0.5 rounded ${hasSpecialStyle ? 'bg-white/10' : 'bg-blue-500/10 text-blue-600'}`}>
                                        📊 Juros: {formatCurrency(dailyProfit)}
                                      </span>
                                      <span className={`px-1 py-0.5 rounded ${hasSpecialStyle ? 'bg-white/10' : 'bg-orange-500/10 text-orange-600'}`}>
                                        ⚠️ Multas: {formatCurrency(totalAppliedPenaltiesDaily)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className={`text-[9px] sm:text-xs ${mutedTextColor}`}>✅ Lucro Realizado</p>
                                  <div className="flex items-center gap-1">
                                    <p className={`font-semibold text-xs sm:text-sm ${hasSpecialStyle ? 'text-white' : 'text-emerald-500'}`}>
                                      {formatCurrency(realizedProfitCard)}
                                    </p>
                                    {expectedProfitCard > 0 && (
                                      <span className={`text-[8px] sm:text-[9px] px-1 py-0.5 rounded ${
                                        hasSpecialStyle 
                                          ? 'bg-white/20 text-white' 
                                          : profitPercentageCard >= 100 
                                            ? 'bg-emerald-500/20 text-emerald-500' 
                                            : 'bg-muted text-muted-foreground'
                                      }`}>
                                        {profitPercentageCard}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Info resumida - Vencimento e Pago */}
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-3 mt-1.5 sm:mt-3 text-[10px] sm:text-sm">
                          <Popover 
                            open={editingDueDateLoanId === loan.id} 
                            onOpenChange={(open) => {
                              if (open) {
                                setEditingDueDateLoanId(loan.id);
                                setEditingInstallmentIndex(null);
                                const dates = (loan.installment_dates as string[]) || [];
                                const paidCount = getPaidInstallmentsCount(loan);
                                const nextDate = dates[paidCount] || loan.due_date;
                                setNewDueDate(new Date(nextDate + 'T12:00:00'));
                              } else {
                                setEditingDueDateLoanId(null);
                                setEditingInstallmentIndex(null);
                                setNewDueDate(undefined);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <div className={`flex items-center gap-1 sm:gap-2 ${mutedTextColor} cursor-pointer hover:text-primary transition-colors group`}>
                                <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                <span className="truncate group-hover:underline">
                                  Venc: {(() => {
                                    const dates = (loan.installment_dates as string[]) || [];
                                    const paidCount = getPaidInstallmentsCount(loan);
                                    const nextDate = dates[paidCount] || loan.due_date;
                                    return formatDate(nextDate);
                                  })()}
                                </span>
                                <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-50 group-hover:opacity-100 transition-opacity touch-manipulation" />
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <div className="p-3 max-w-[320px]">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-medium">Datas das Parcelas</p>
                                  <p className="text-xs text-muted-foreground">Clique para editar</p>
                                </div>
                                
                                <ScrollArea className="h-[280px]">
                                  <div className="space-y-1">
                                    {((loan.installment_dates as string[]) || []).map((dateStr, index) => {
                                      const dailyPaidCount = getPaidInstallmentsCount(loan);
                                      const isPaidInstallment = index < dailyPaidCount;
                                      const isEditingThis = editingInstallmentIndex === index;
                                      const dateObj = new Date(dateStr + 'T12:00:00');
                                      const dayName = format(dateObj, 'EEE', { locale: ptBR });
                                      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                      
                                      return (
                                        <div key={index}>
                                          {isEditingThis ? (
                                            <div className="p-2 rounded-lg bg-muted/50 border border-primary/30">
                                              <p className="text-xs text-muted-foreground mb-2">
                                                Alterar data da parcela {index + 1}
                                              </p>
                                              <Calendar
                                                mode="single"
                                                selected={newDueDate}
                                                onSelect={(date) => date && setNewDueDate(date)}
                                                locale={ptBR}
                                                className="pointer-events-auto"
                                              />
                                              <div className="flex gap-2 mt-2">
                                                <Button
                                                  size="sm"
                                                  className="flex-1"
                                                  onClick={() => {
                                                    if (newDueDate) {
                                                      handleUpdateSpecificDate(loan.id, index, format(newDueDate, 'yyyy-MM-dd'));
                                                    }
                                                  }}
                                                >
                                                  Salvar
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => setEditingInstallmentIndex(null)}
                                                >
                                                  Cancelar
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div 
                                              className={`flex items-center gap-2 p-1.5 rounded-md transition-colors ${
                                                isPaidInstallment 
                                                  ? 'bg-green-500/10' 
                                                  : isWeekend 
                                                    ? 'bg-amber-500/5 hover:bg-muted/50' 
                                                    : 'hover:bg-muted/50'
                                              }`}
                                            >
                                              <span className={`w-7 text-xs font-medium ${isPaidInstallment ? 'text-green-400' : 'text-muted-foreground'}`}>
                                                {index + 1}ª
                                              </span>
                                              <span className={`flex-1 text-xs ${isPaidInstallment ? 'text-green-400' : isWeekend ? 'text-amber-400' : ''}`}>
                                                {formatDate(dateStr)} ({dayName})
                                              </span>
                                              {isPaidInstallment ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                              ) : (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-6 w-6 p-0 hover:bg-primary/20"
                                                  onClick={() => {
                                                    setEditingInstallmentIndex(index);
                                                    setNewDueDate(new Date(dateStr + 'T12:00:00'));
                                                  }}
                                                >
                                                  <Pencil className="w-3 h-3" />
                                                </Button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </ScrollArea>
                                
                                <div className="flex justify-end mt-3 pt-3 border-t">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingDueDateLoanId(null)}
                                  >
                                    Fechar
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <div className={`flex items-center gap-1 sm:gap-2 p-1 sm:p-2 rounded-lg font-semibold ${hasSpecialStyle ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                            <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="truncate">Pago: {formatCurrency(loan.total_paid || 0)}</span>
                          </div>
                        </div>
                        
                        {/* Overdue installment info */}
                        {isOverdue && (
                          <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg bg-red-500/20 border border-red-400/30">
                            <div className="text-xs sm:text-sm">
                              {/* CARD UNIFICADO para múltiplas parcelas com multa dinâmica */}
                              {overdueInstallmentsDetails.length > 1 && overdueConfigValue > 0 ? (
                                <>
                                  {/* Cabeçalho clicável com quantidade + regra de multa */}
                                  <div 
                                    onClick={() => toggleOverdueExpand(loan.id)}
                                    className="flex items-center justify-between mb-2 cursor-pointer hover:bg-red-500/10 rounded px-1 py-0.5 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-white font-bold">
                                        {overdueInstallmentsDetails.length} parcelas em atraso
                                      </span>
                                      {expandedOverdueCards.has(loan.id) ? (
                                        <ChevronUp className="w-4 h-4 text-white" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-white" />
                                      )}
                                    </div>
                                    <span className="text-red-100 font-medium text-[10px] bg-red-500/30 px-2 py-0.5 rounded">
                                      ⚡ {overdueConfigType === 'percentage' 
                                        ? `${overdueConfigValue}%/dia`
                                        : `${formatCurrency(overdueConfigValue)}/dia`}
                                    </span>
                                  </div>
                                  
                                  {/* Lista de parcelas colapsável */}
                                  {expandedOverdueCards.has(loan.id) && (
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                      {cumulativePenaltyResult.penaltyBreakdown.map((item, idx) => (
                                        <div key={idx} className="bg-red-900/60 rounded px-2.5 py-1.5">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="text-white font-medium">
                                              Parc. {item.installmentNumber}/{numInstallments} • {item.daysOverdue}d de atraso
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-xs mt-1">
                                            <span className="text-gray-200">
                                              Valor: {formatCurrency(item.installmentAmount)}
                                            </span>
                                            {item.penaltyAmount > 0 && (
                                              <span className="font-semibold text-yellow-300">
                                                Multa: +{formatCurrency(item.penaltyAmount)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Total a Pagar - sempre visível */}
                                  <div className="flex items-center justify-between bg-gradient-to-r from-red-800/80 to-red-900/80 rounded-lg px-3 py-2 mt-3 border border-red-700/50 animate-[pulse_2s_ease-in-out_infinite]">
                                    <span className="text-white font-medium">Total a Pagar:</span>
                                    <span className="font-bold text-yellow-300 text-lg">
                                      {formatCurrency(cumulativePenaltyResult.totalWithPenalties)}
                                    </span>
                                  </div>
                                </>
                              ) : overdueInstallmentsDetails.length > 1 ? (
                                /* Múltiplas parcelas SEM multa dinâmica */
                                <>
                                  <div 
                                    onClick={() => toggleOverdueExpand(loan.id)}
                                    className="flex items-center justify-between mb-2 cursor-pointer hover:bg-red-500/10 rounded px-1 py-0.5 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-red-300 font-bold">
                                        {overdueInstallmentsDetails.length} parcelas em atraso
                                      </span>
                                      {expandedOverdueCards.has(loan.id) ? (
                                        <ChevronUp className="w-4 h-4 text-red-300" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-red-300" />
                                      )}
                                    </div>
                                    <span className="text-red-200 font-medium text-xs">
                                      Total: {formatCurrency(cumulativePenaltyResult.totalOverdueAmount + totalAppliedPenaltiesDaily)}
                                    </span>
                                  </div>
                                  {expandedOverdueCards.has(loan.id) && (
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                      {(() => {
                                        const manualPenalties = getDailyPenaltiesFromNotes(loan.notes);
                                        return cumulativePenaltyResult.penaltyBreakdown.map((item, idx) => {
                                          const manualPenalty = manualPenalties[item.installmentNumber - 1] || 0;
                                          const displayPenalty = manualPenalty > 0 ? manualPenalty : item.penaltyAmount;
                                          
                                          return (
                                            <div key={idx} className="flex items-center justify-between text-xs bg-red-500/10 rounded px-2 py-1">
                                              <span className="text-red-300/90">
                                                Parc. {item.installmentNumber}/{numInstallments} • {item.daysOverdue}d
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <span className="text-red-300/70">{formatCurrency(item.installmentAmount)}</span>
                                                {displayPenalty > 0 && (
                                                  <span className={`font-medium ${manualPenalty > 0 ? 'text-orange-200' : 'text-red-200'}`}>
                                                    +{formatCurrency(displayPenalty)}
                                                    {manualPenalty > 0 && <span className="text-[9px] ml-1">(manual)</span>}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  )}
                                </>
                              ) : (
                                /* UMA parcela em atraso */
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-red-300 font-medium">
                                      Parcela {getPaidInstallmentsCount(loan) + 1}/{numInstallments} em atraso
                                    </span>
                                    <span className="text-red-200 font-bold">{daysOverdue} dias</span>
                                  </div>
                                  <div className="flex items-center justify-between mt-1 text-red-300/70">
                                    <span>Vencimento: {formatDate(overdueDate)}</span>
                                    <span>Valor: {formatCurrency(totalPerInstallmentDisplay)}</span>
                                  </div>
                                  
                                  {/* Multa dinâmica para 1 parcela */}
                                  {dynamicPenaltyAmount > 0 && (
                                    <div className="mt-3 bg-black/30 rounded-lg p-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-red-200/80 text-xs">
                                          ⚡ {overdueConfigType === 'percentage' 
                                            ? `${overdueConfigValue}%/dia`
                                            : `${formatCurrency(overdueConfigValue)}/dia`}
                                        </span>
                                        <span className="font-medium text-red-200">
                                          Multa: +{formatCurrency(dynamicPenaltyAmount)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-lg px-3 py-2">
                                        <span className="text-white font-medium">Total a Pagar:</span>
                                        <span className="font-bold text-red-400 text-lg">
                                          {formatCurrency(cumulativePenaltyResult.totalWithPenalties)}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            
                            {/* Seção de multas MANUAIS aplicadas */}
                            {totalAppliedPenaltiesDaily > 0 && overdueConfigValue === 0 && (
                              <div className="mt-3 bg-black/30 rounded-lg p-3 space-y-3">
                                {/* Cabeçalho */}
                                <div className="flex items-center justify-between">
                                  <span className="text-amber-400 font-semibold flex items-center gap-1.5 text-sm">
                                    <span>📝</span> Multas aplicadas (manual)
                                  </span>
                                  <span className="font-bold text-amber-300">
                                    +{formatCurrency(totalAppliedPenaltiesDaily)}
                                  </span>
                                </div>
                                
                                {/* Detalhamento por parcela */}
                                <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                  {(() => {
                                    const manualPenalties = getDailyPenaltiesFromNotes(loan.notes);
                                    return Object.entries(manualPenalties).map(([idx, penalty]) => (
                                      <div key={idx} className="flex items-center justify-between text-xs bg-white/10 rounded px-2.5 py-1">
                                        <span className="text-white/80">Parcela {parseInt(idx) + 1}/{numInstallments}</span>
                                        <span className="font-medium text-amber-400">+{formatCurrency(penalty)}</span>
                                      </div>
                                    ));
                                  })()}
                                </div>
                                
                                {/* Total a Pagar */}
                                <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg px-3 py-2">
                                  <span className="text-white font-medium">Total a Pagar:</span>
                                  <span className="font-bold text-amber-400 text-lg">
                                    {formatCurrency(cumulativePenaltyResult.totalOverdueAmount + totalAppliedPenaltiesDaily)}
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {/* Inline penalty configuration for daily loans */}
                            {/* Botão Aplicar Multa - só aparece se NÃO tem multas dinâmicas E NÃO tem multas manuais */}
                            {overdueConfigValue <= 0 && totalAppliedPenaltiesDaily === 0 && configuringPenaltyLoanId !== loan.id && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => {
                                  setConfiguringPenaltyLoanId(loan.id);
                                  setInlinePenaltyType('percentage');
                                  setInlinePenaltyValue('');
                                }}
                                className="w-full mt-3 border-red-400/50 text-red-300 hover:bg-red-500/20"
                              >
                                <Percent className="w-4 h-4 mr-2" />
                                Aplicar Multa
                              </Button>
                            )}
                            
                            {/* Botão Editar Minhas Multas - aparece quando TEM multas manuais aplicadas E NÃO há multa dinâmica */}
                            {totalAppliedPenaltiesDaily > 0 && overdueConfigValue === 0 && configuringPenaltyLoanId !== loan.id && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => {
                                  openManualPenaltyDialog(
                                    loan,
                                    overdueInstallmentsDetails,
                                    totalPerInstallmentDisplay
                                  );
                                }}
                                className="w-full mt-3 border-orange-400/50 text-orange-300 hover:bg-orange-500/20"
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar Minhas Multas
                              </Button>
                            )}
                            
                            {configuringPenaltyLoanId === loan.id && (
                              <div className="mt-3 pt-3 border-t border-red-400/30 space-y-2">
                                <Label className="text-xs text-red-300">Tipo de multa</Label>
                                <Select 
                                  value={inlinePenaltyType} 
                                  onValueChange={(v) => {
                                    if (v === 'manual') {
                                      // Open manual penalty dialog for daily loans
                                      openManualPenaltyDialog(
                                        loan,
                                        overdueInstallmentsDetails,
                                        totalPerInstallmentDisplay
                                      );
                                    } else {
                                      setInlinePenaltyType(v as 'percentage' | 'fixed');
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8 bg-white/10 border-blue-400/50 text-red-100">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="percentage">% do valor da parcela/dia</SelectItem>
                                    <SelectItem value="fixed">R$ valor fixo/dia</SelectItem>
                                    <SelectItem value="manual">📝 Aplicar manualmente (valor fixo)</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  value={inlinePenaltyValue}
                                  onChange={(e) => setInlinePenaltyValue(e.target.value)}
                                  placeholder={inlinePenaltyType === 'percentage' ? 'Ex: 1.00' : 'Ex: 50.00'}
                                  className="h-8 bg-white/10 border-blue-400/50 text-red-100 placeholder:text-red-300/50"
                                />
                                
                                {parseFloat(inlinePenaltyValue) > 0 && overdueInstallmentsDetails.length > 0 && (
                                  <div className="text-xs text-red-300/80 p-2 bg-red-500/10 rounded space-y-1">
                                    <p className="font-medium">Prévia da multa ({overdueInstallmentsDetails.length} parcelas):</p>
                                    {overdueInstallmentsDetails.slice(0, 3).map((detail, idx) => {
                                      const penaltyVal = parseFloat(inlinePenaltyValue);
                                      const penalty = inlinePenaltyType === 'percentage' 
                                        ? (totalPerInstallmentDisplay * (penaltyVal / 100)) * detail.daysOverdue
                                        : penaltyVal * detail.daysOverdue;
                                      return (
                                        <p key={idx} className="text-[10px]">
                                          Parc. {detail.index + 1}: {detail.daysOverdue}d × {inlinePenaltyType === 'percentage' ? `${penaltyVal}%` : formatCurrency(penaltyVal)} = {formatCurrency(penalty)}
                                        </p>
                                      );
                                    })}
                                    {overdueInstallmentsDetails.length > 3 && (
                                      <p className="text-[10px] text-red-300/60">...e mais {overdueInstallmentsDetails.length - 3} parcelas</p>
                                    )}
                                    <p className="font-medium border-t border-red-400/30 pt-1 mt-1">
                                      Total: {formatCurrency((() => {
                                        const penaltyVal = parseFloat(inlinePenaltyValue);
                                        return overdueInstallmentsDetails.reduce((sum, detail) => {
                                          const penalty = inlinePenaltyType === 'percentage' 
                                            ? (totalPerInstallmentDisplay * (penaltyVal / 100)) * detail.daysOverdue
                                            : penaltyVal * detail.daysOverdue;
                                          return sum + penalty;
                                        }, 0);
                                      })())}
                                    </p>
                                  </div>
                                )}
                                
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleSaveInlinePenalty(
                                      loan.id, 
                                      loan.notes, 
                                      getPaidInstallmentsCount(loan), 
                                      overdueInstallmentsDetails.length, // Passa quantidade de parcelas em atraso
                                      totalPerInstallmentDisplay,
                                      true // isDaily = true
                                    )}
                                    className="flex-1 bg-red-600 hover:bg-red-700"
                                  >
                                    Salvar
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => setConfiguringPenaltyLoanId(null)}
                                    className="border-red-400/50 text-red-300"
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {overdueConfigValue > 0 && configuringPenaltyLoanId !== loan.id && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => {
                                  setConfiguringPenaltyLoanId(loan.id);
                                  setInlinePenaltyType(overdueConfigType || 'percentage');
                                  setInlinePenaltyValue(overdueConfigValue.toString());
                                }}
                                className="w-full mt-2 text-red-300/70 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Editar multa
                              </Button>
                            )}
                            
                            <p className="text-[10px] text-red-300/60 mt-2">
                              {overdueInstallmentsDetails.length > 1 
                                ? `Regularize as ${overdueInstallmentsDetails.length} parcelas em atraso`
                                : 'Pague a parcela em atraso para regularizar o empréstimo'}
                            </p>
                            {/* Manual overdue notification button */}
                            {profile?.whatsapp_to_clients_enabled && loan.client?.phone && (
                              <SendOverdueNotification
                                data={{
                                  clientName: loan.client?.full_name || 'Cliente',
                                  clientPhone: loan.client.phone,
                                  contractType: 'loan',
                                  installmentNumber: getPaidInstallmentsCount(loan) + 1,
                                  totalInstallments: numInstallments,
                                  amount: getEffectiveInstallmentValue(loan, totalPerInstallmentDisplay, getPaidInstallmentsCount(loan)),
                                  dueDate: overdueDate,
                                  daysOverdue: daysOverdue,
                                  loanId: loan.id,
                                  penaltyAmount: dynamicPenaltyAmount > 0 ? dynamicPenaltyAmount : undefined,
                                  penaltyType: overdueConfigType || undefined,
                                  penaltyValue: overdueConfigValue > 0 ? overdueConfigValue : undefined,
                                  interestAmount: (() => {
                                    const principalPart = loan.principal_amount / numInstallments;
                                    const interestPart = dailyInstallmentAmount - principalPart;
                                    return interestPart > 0 ? interestPart : undefined;
                                  })(),
                                  principalAmount: loan.principal_amount / numInstallments,
                                  isDaily: true,
                                  // NOVO: Passar dados de TODAS as parcelas em atraso
                                  overdueInstallmentsCount: overdueInstallmentsDetails.length,
                                  overdueInstallmentsDetails: cumulativePenaltyResult.penaltyBreakdown,
                                  totalOverdueAmount: cumulativePenaltyResult.totalOverdueAmount,
                                  totalPenaltyAmount: cumulativePenaltyResult.totalPenalty,
                                  // Multas manuais aplicadas (só usadas se NÃO houver multa dinâmica)
                                  manualPenaltyAmount: totalAppliedPenaltiesDaily > 0 ? totalAppliedPenaltiesDaily : undefined,
                                  // Detalhamento das multas manuais por parcela
                                  manualPenaltiesBreakdown: (() => {
                                    const breakdown = getDailyPenaltiesFromNotes(loan.notes);
                                    return Object.keys(breakdown).length > 0 ? breakdown : undefined;
                                  })(),
                                  // Indica se há multa dinâmica configurada
                                  hasDynamicPenalty: overdueConfigValue > 0,
                                  // Status das parcelas com emojis
                                  installmentDates: (loan.installment_dates as string[]) || [],
                                  paidCount: getPaidInstallmentsCount(loan),
                                }}
                                className="w-full mt-2"
                              />
                            )}
                            {/* Botão de lembrete do dia para contratos diários em atraso - SÓ mostrar se há parcela vencendo HOJE */}
                            {(() => {
                              const todayInfo = getTodayInstallmentInfo(loan);
                              if (!todayInfo || !profile?.whatsapp_to_clients_enabled || !loan.client?.phone) {
                                return null;
                              }
                              return (
                                <SendDueTodayNotification
                                  data={{
                                    clientName: loan.client?.full_name || 'Cliente',
                                    clientPhone: loan.client.phone,
                                    contractType: 'loan',
                                    installmentNumber: todayInfo.installmentNumber,
                                    totalInstallments: todayInfo.totalInstallments,
                                    amount: getEffectiveInstallmentValue(loan, totalPerInstallmentDisplay, getPaidInstallmentsCount(loan)),
                                    dueDate: todayInfo.dueDate,
                                    loanId: loan.id,
                                    interestAmount: (() => {
                                      const principalPart = loan.principal_amount / numInstallments;
                                      const interestPart = dailyInstallmentAmount - principalPart;
                                      return interestPart > 0 ? interestPart : undefined;
                                    })(),
                                    principalAmount: loan.principal_amount / numInstallments,
                                    isDaily: true,
                                    // Status das parcelas com emojis
                                    installmentDates: (loan.installment_dates as string[]) || [],
                                    paidCount: getPaidInstallmentsCount(loan),
                                  }}
                                  className="w-full mt-2"
                                />
                              );
                            })()}
                          </div>
                        )}
                        
                        {/* Due Today Section */}
                        {isDueToday && !isOverdue && (
                          <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg bg-amber-500/20 border border-amber-400/30">
                            <div className="text-xs sm:text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-amber-300 font-medium flex items-center gap-2">
                                  <Bell className="w-4 h-4" />
                                  Vence Hoje!
                                </span>
                                <span className="text-amber-200 font-bold">{formatCurrency(totalPerInstallmentDisplay)}</span>
                              </div>
                              <div className="flex items-center justify-between mt-1 text-amber-300/70">
                                <span>Parcela {getPaidInstallmentsCount(loan) + 1}/{numInstallments}</span>
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
                                    totalInstallments: numInstallments,
                                    amount: getEffectiveInstallmentValue(loan, totalPerInstallmentDisplay, getPaidInstallmentsCount(loan)),
                                    dueDate: dueTodayDate,
                                    loanId: loan.id,
                                    interestAmount: (() => {
                                      const principalPart = loan.principal_amount / numInstallments;
                                      const interestPart = dailyInstallmentAmount - principalPart;
                                      return interestPart > 0 ? interestPart : undefined;
                                    })(),
                                    principalAmount: loan.principal_amount / numInstallments,
                                    isDaily: true,
                                  }}
                                  className="w-full mt-2"
                                />
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Early Notification */}
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
                                    totalInstallments: numInstallments,
                                    amount: getEffectiveInstallmentValue(loan, totalPerInstallmentDisplay, paidCount),
                                    dueDate: nextDueDate,
                                    daysUntilDue: daysUntilDue,
                                    loanId: loan.id,
                                    interestAmount: (() => {
                                      const principalPart = loan.principal_amount / numInstallments;
                                      const interestPart = dailyInstallmentAmount - principalPart;
                                      return interestPart > 0 ? interestPart : undefined;
                                    })(),
                                    principalAmount: loan.principal_amount / numInstallments,
                                    isDaily: true,
                                    // Status das parcelas com emojis
                                    installmentDates: (loan.installment_dates as string[]) || [],
                                    paidCount: paidCount,
                                  }}
                                  className="w-full"
                                />
                              </div>
                            );
                          })()
                        )}
                        
                        <div className={`flex flex-col gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 ${hasSpecialStyle ? 'border-t border-white/20' : 'border-t'}`}>
                          <TooltipProvider delayDuration={300}>
                            <div className="flex gap-1.5 sm:gap-2">
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
                                      // Usar a próxima parcela do array installment_dates
                                      if (dates.length > 0 && paidCount + 1 < dates.length) {
                                        // Há próxima parcela - usar ela diretamente
                                        defaultNextDueDate = dates[paidCount + 1];
                                      }
                                      // Se é a última parcela, defaultNextDueDate fica vazio
                                      setPaymentData({ 
                                        amount: totalPerInstallmentDisplay.toFixed(2), 
                                        payment_date: format(new Date(), 'yyyy-MM-dd'),
                                        new_due_date: defaultNextDueDate,
                                        payment_type: 'installment',
                                        selected_installments: [],
                                        partial_installment_index: null,
                                        send_notification: false,
                                        is_advance_payment: false,
                                        recalculate_interest: false,
                                      });
                                      setIsPaymentDialogOpen(true);
                                    }}
                                    disabled={isPaid}
                                  >
                                    <CreditCard className="w-3 h-3 mr-1" />
                                    Pagar
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Registrar pagamento</p>
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
                                  <p>Ver histórico de pagamentos</p>
                                </TooltipContent>
                              </Tooltip>
                              {/* Botão de Edição Completa - Azul */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                    size="icon" 
                                    className={`h-7 w-7 sm:h-8 sm:w-8 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : 'border-blue-500 text-blue-500 hover:bg-blue-500/10'}`}
                                    onClick={() => openDailyEditDialog(loan.id)}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Editar empréstimo diário</p>
                                </TooltipContent>
                              </Tooltip>
                              {/* Botão de Renegociação - Âmbar */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant={hasSpecialStyle ? 'secondary' : 'outline'} 
                                    size="icon" 
                                    className={`h-7 w-7 sm:h-8 sm:w-8 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : 'border-amber-500 text-amber-500 hover:bg-amber-500/10'}`}
                                    onClick={() => openEditDialog(loan.id)}
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Renegociar contrato (criar novo baseado no saldo)</p>
                                </TooltipContent>
                              </Tooltip>
                              {/* Botão de adicionar parcelas extras */}
                              {!isPaid && (
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
                                    <p>Adicionar parcelas extras</p>
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
                                  <p>Excluir este empréstimo</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </div>
                        
                        {/* Área Expandida com Informações Detalhadas */}
                        <AnimatePresence>
                        {expandedLoanId === loan.id && (() => {
                          const dates = (loan.installment_dates as string[]) || [];
                          const paidAdvanceSubparcelas = getPaidAdvanceSubparcelasFromNotes(loan.notes);
                          
                          // Contar parcelas pagas
                          let paidInstallmentsCount = 0;
                          for (let i = 0; i < numInstallments; i++) {
                            const paidAmount = partialPayments[i] || 0;
                            const pendingSubs = advanceSubparcelas.filter(s => s.originalIndex === i);
                            if (paidAmount >= totalPerInstallmentDisplay * 0.99 && pendingSubs.length === 0) {
                              paidInstallmentsCount++;
                            }
                          }
                          
                          const progressPercentage = numInstallments > 0 ? Math.round((paidInstallmentsCount / numInstallments) * 100) : 0;
                          
                          // Calcular status de cada parcela
                          const getInstallmentStatusForDisplay = (index: number, dueDate: string) => {
                            const paidAmount = partialPayments[index] || 0;
                            const pendingSubs = advanceSubparcelas.filter(s => s.originalIndex === index);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const due = new Date(dueDate + 'T12:00:00');
                            
                            if (paidAmount >= totalPerInstallmentDisplay * 0.99 && pendingSubs.length === 0) {
                              return { status: 'paid', label: 'Paga', color: 'text-emerald-500' };
                            } else if (pendingSubs.length > 0 || paidAmount > 0) {
                              return { status: 'partial', label: 'Parcial', color: 'text-amber-500' };
                            } else if (today > due) {
                              return { status: 'overdue', label: 'Atrasada', color: 'text-destructive' };
                            }
                            return { status: 'pending', label: 'Pendente', color: 'text-muted-foreground' };
                          };
                          
                          // Lucro previsto e realizado para diários
                          const expectedProfitDaily = dailyProfit;
                          const paymentsDailyExp = (loan as any).loan_payments || [];
                          const realizedProfitDaily = paymentsDailyExp.reduce((sum: number, p: any) => 
                            sum + Number(p.interest_paid || 0), 0);
                          const profitPercentageDaily = expectedProfitDaily > 0 
                            ? Math.round((realizedProfitDaily / expectedProfitDaily) * 100) 
                            : 0;
                          
                          return (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                              className={`mt-3 pt-3 border-t space-y-3 overflow-hidden ${hasSpecialStyle ? 'border-white/20' : 'border-border'}`}
                            >
                              {/* Seção de Lucro - Previsto e Realizado (movido para área expandível) */}
                              <div className={`grid grid-cols-2 gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg ${hasSpecialStyle ? 'bg-white/10' : 'bg-primary/5 border border-primary/20'}`}>
                                <div>
                                  <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>💰 Lucro Previsto</p>
                                  <p className={`font-semibold text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : 'text-primary'}`}>
                                    {formatCurrency(expectedProfitDaily)}
                                  </p>
                                </div>
                                <div>
                                  <p className={`text-[10px] sm:text-xs ${mutedTextColor}`}>✅ Lucro Realizado</p>
                                  <div className="flex items-center gap-1.5">
                                    <p className={`font-semibold text-sm sm:text-base ${hasSpecialStyle ? 'text-white' : 'text-emerald-500'}`}>
                                      {formatCurrency(realizedProfitDaily)}
                                    </p>
                                    {expectedProfitDaily > 0 && (
                                      <span className={`text-[9px] sm:text-[10px] px-1 py-0.5 rounded ${
                                        hasSpecialStyle 
                                          ? 'bg-white/20 text-white' 
                                          : profitPercentageDaily >= 100 
                                            ? 'bg-emerald-500/20 text-emerald-500' 
                                            : 'bg-muted text-muted-foreground'
                                      }`}>
                                        {profitPercentageDaily}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Detalhes adicionais: Lucro e Parcelas */}
                              <div className={`grid grid-cols-2 gap-2 text-xs sm:text-sm ${hasSpecialStyle ? '' : ''}`}>
                                <div className={`flex items-center gap-1.5 ${mutedTextColor}`}>
                                  <Percent className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span className="truncate">Lucro: {formatCurrency(dailyProfit)}</span>
                                </div>
                                <div className={`flex items-center gap-1.5 ${mutedTextColor}`}>
                                  <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span className="truncate">{numInstallments}x {formatCurrency(totalPerInstallmentDisplay)}</span>
                                </div>
                              </div>
                              
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
                                    {(() => {
                                      const dailyPenalties = getDailyPenaltiesFromNotes(loan.notes);
                                      return dates.map((date, idx) => {
                                        const statusInfo = getInstallmentStatusForDisplay(idx, date);
                                        const penaltyForInstallment = dailyPenalties[idx] || 0;
                                        return (
                                          <div key={idx} className={`flex items-center justify-between gap-1 text-xs py-1 ${idx < dates.length - 1 ? 'border-b border-border/30' : ''}`}>
                                            <span className={`flex-shrink-0 ${hasSpecialStyle ? 'text-white/80' : 'text-muted-foreground'}`}>
                                              {idx + 1}/{numInstallments}
                                            </span>
                                            <span className={`flex-shrink-0 ${hasSpecialStyle ? 'text-white' : ''}`}>
                                              {formatCurrency(totalPerInstallmentDisplay)}
                                            </span>
                                            <span className={`flex-shrink-0 ${hasSpecialStyle ? 'text-white/70' : 'text-muted-foreground'}`}>
                                              {formatDate(date)}
                                            </span>
                                            <span className={`font-medium flex-shrink-0 ${hasSpecialStyle ? (statusInfo.status === 'paid' ? 'text-emerald-300' : statusInfo.status === 'overdue' ? 'text-red-300' : 'text-white/70') : statusInfo.color}`}>
                                              {statusInfo.label}
                                            </span>
                                            {penaltyForInstallment > 0 && (
                                              <div className="flex items-center gap-1">
                                                <span className={`text-[10px] font-medium ${hasSpecialStyle ? 'text-red-300' : 'text-red-500'}`}>
                                                  +{formatCurrency(penaltyForInstallment)}
                                                </span>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className={`h-4 w-4 p-0 ${hasSpecialStyle ? 'text-blue-300 hover:text-white hover:bg-blue-500/30' : 'text-blue-500 hover:text-blue-700 hover:bg-blue-100'}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditPenaltyDialog({
                                                      isOpen: true,
                                                      loanId: loan.id,
                                                      installmentIndex: idx,
                                                      currentValue: penaltyForInstallment,
                                                      currentNotes: loan.notes
                                                    });
                                                    setEditPenaltyValue(penaltyForInstallment.toString());
                                                  }}
                                                >
                                                  <Pencil className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className={`h-4 w-4 p-0 ${hasSpecialStyle ? 'text-red-300 hover:text-white hover:bg-red-500/30' : 'text-red-500 hover:text-red-700 hover:bg-red-100'}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveDailyPenalty(loan.id, idx, loan.notes);
                                                  }}
                                                >
                                                  <X className="w-3 h-3" />
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      });
                                    })()}
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
                                    <p className={hasSpecialStyle ? 'text-white/60' : 'text-muted-foreground'}>Tipo de Pagamento</p>
                                    <p className={`font-medium ${hasSpecialStyle ? 'text-white' : ''}`}>Diário</p>
                                  </div>
                                  <div>
                                    <p className={hasSpecialStyle ? 'text-white/60' : 'text-muted-foreground'}>Total de Lucro</p>
                                    <p className={`font-medium ${hasSpecialStyle ? 'text-white' : ''}`}>{formatCurrency(dailyProfit)}</p>
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
                            </motion.div>
                          );
                        })()}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab: Tabela Price */}
          <TabsContent value="price" className="space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-base sm:text-lg">Sistema de Amortização Francês (Price)</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Parcelas fixas com juros compostos embutidos - ideal para empréstimos de longo prazo
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Seleção de Cliente */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <User className="w-4 h-4" /> Cliente
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={priceFormData.client_id}
                      onValueChange={(value) => setPriceFormData(prev => ({ ...prev, client_id: value }))}
                    >
                      <SelectTrigger className="flex-1 h-10">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.filter(c => c.client_type === 'loan' || c.client_type === 'both').map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => setIsNewClientDialogOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Valores Principais */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" /> Valor do Capital
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="2500.00"
                      value={priceFormData.principal_amount}
                      onChange={(e) => setPriceFormData(prev => ({ ...prev, principal_amount: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Percent className="w-4 h-4" /> Taxa Mensal (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="20"
                      value={priceFormData.interest_rate}
                      onChange={(e) => setPriceFormData(prev => ({ ...prev, interest_rate: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" /> Parcelas
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={priceFormData.installments}
                      onChange={(e) => setPriceFormData(prev => ({ ...prev, installments: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Datas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <CalendarIcon className="w-4 h-4" /> Data do Contrato
                    </Label>
                    <Input
                      type="date"
                      value={priceFormData.contract_date}
                      onChange={(e) => setPriceFormData(prev => ({ ...prev, contract_date: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <CalendarIcon className="w-4 h-4" /> 1ª Parcela
                    </Label>
                    <Input
                      type="date"
                      value={priceFormData.start_date}
                      onChange={(e) => setPriceFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Prévia da Tabela Price */}
                {priceTablePreview && (
                  <Card className="border-border bg-muted/30">
                    <CardContent className="p-4 space-y-4">
                      {/* Cabeçalho com resumo */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-border">
                        <div className="flex items-center gap-2">
                          <Table2 className="w-5 h-5 text-primary" />
                          <span className="font-semibold text-foreground">Tabela de Amortização</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="font-medium text-foreground">Parcela: {formatCurrency(priceTablePreview.pmt)}</span>
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handlePriceExportPDF}
                            disabled={isGeneratingPricePDF}
                            className="h-8"
                          >
                            <Download className="w-4 h-4 mr-1.5" />
                            {isGeneratingPricePDF ? 'Gerando...' : 'PDF'}
                          </Button>
                        </div>
                      </div>

                      {/* Tabela de Amortização */}
                      <ScrollArea className="h-[200px] sm:h-[280px]">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                            <tr>
                              <th className="px-2 py-2 text-left font-medium text-muted-foreground">#</th>
                              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Parcela</th>
                              <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                                <span className="hidden sm:inline">Amortização</span>
                                <span className="sm:hidden">Amort.</span>
                              </th>
                              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Juros</th>
                              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Saldo</th>
                              <th className="px-2 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">Vencimento</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {priceTablePreview.rows.map((row, index) => (
                              <tr key={row.installmentNumber} className="hover:bg-muted/30">
                                <td className="px-2 py-1.5 text-primary font-medium">{row.installmentNumber}</td>
                                <td className="px-2 py-1.5 text-right font-medium text-foreground">{formatCurrency(row.payment)}</td>
                                <td className="px-2 py-1.5 text-right text-emerald-500">{formatCurrency(row.amortization)}</td>
                                <td className="px-2 py-1.5 text-right text-orange-500">{formatCurrency(row.interest)}</td>
                                <td className="px-2 py-1.5 text-right text-foreground">{formatCurrency(row.balance)}</td>
                                <td className="px-2 py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                                  {priceInstallmentDates[index] ? formatDate(priceInstallmentDates[index]) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>

                      {/* Totais */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-3 border-t border-border">
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="w-4 h-4 text-emerald-500" />
                          <span className="text-muted-foreground">Total a Receber:</span>
                          <span className="font-bold text-emerald-500">
                            {formatCurrency(priceTablePreview.totalPayment)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Percent className="w-4 h-4 text-primary" />
                          <span className="text-muted-foreground">Juros Total:</span>
                          <span className="font-bold text-primary">
                            {formatCurrency(priceTablePreview.totalInterest)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Observações */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Observações
                  </Label>
                  <Textarea
                    placeholder="Notas sobre o empréstimo..."
                    value={priceFormData.notes}
                    onChange={(e) => setPriceFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="min-h-[60px]"
                  />
                </div>

                {/* Notificação WhatsApp */}
                <div className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-muted/30">
                  <Checkbox
                    id="price_send_notification"
                    checked={priceFormData.send_notification}
                    onCheckedChange={(checked) => setPriceFormData(prev => ({ ...prev, send_notification: !!checked }))}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="price_send_notification" className="text-sm font-medium cursor-pointer">
                      Enviar notificação WhatsApp ao criar
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alertas de atraso e relatórios serão enviados normalmente
                    </p>
                  </div>
                </div>

                {/* Botão Criar */}
                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={handlePriceTableSubmit}
                    className="h-10 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!priceTablePreview}
                  >
                    <Table2 className="w-4 h-4 mr-1.5" />
                    Criar Empréstimo Price
                  </Button>
                </div>
              </CardContent>
            </Card>
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
            
            // 🆕 Verificar se houve amortização - se sim, usar remaining_balance como base
            const totalAmortizations = getTotalAmortizationsFromNotes(selectedLoan.notes);
            const paidInstallmentsCountForCalc = getPaidInstallmentsCount(selectedLoan);
            const remainingInstallmentsCountForCalc = Math.max(1, numInstallments - paidInstallmentsCountForCalc);
            
            if (totalAmortizations > 0 && !isDaily) {
              // Após amortização: o remaining_balance já contém o novo saldo (principal + juros recalculados)
              // Dividir pelo número de parcelas restantes
              totalPerInstallment = remainingToReceive / remainingInstallmentsCountForCalc;
            } else if (numInstallments === 1 && !isDaily) {
              // Para contratos de 1 parcela (caso típico de renovação), a próxima parcela
              // deve ser exatamente o remaining_balance (ex: 300 após taxa de renovação)
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
                    <div className="grid grid-cols-4 gap-2">
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
                      <Button
                        type="button"
                        variant={paymentData.payment_type === 'discount' ? 'default' : 'outline'}
                        onClick={() => {
                          setPaymentData({ ...paymentData, payment_type: 'discount', amount: '', selected_installments: [], partial_installment_index: null });
                          setDiscountSettlementData({ receivedAmount: '', discountAmount: 0 });
                        }}
                        className={`text-xs sm:text-sm ${paymentData.payment_type === 'discount' ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'}`}
                      >
                        <Percent className="w-3 h-3 mr-1" />
                        Desconto
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
                    
                    // Ler multas diárias aplicadas por parcela
                    const dailyPenalties = getDailyPenaltiesFromNotes(selectedLoan.notes);

                    const getInstallmentBaseValue = (index: number) => {
                      // Se há taxa de renovação aplicada nesta parcela específica
                      if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
                        return renewalFeeValue;
                      }
                      // Caso contrário, usar o valor normal da parcela
                      return totalPerInstallment;
                    };
                    
                    // Obter multa para uma parcela específica
                    const getPenaltyForInstallment = (index: number) => dailyPenalties[index] || 0;
                    
                    const getInstallmentValue = (index: number) => {
                      const baseValue = getInstallmentBaseValue(index);
                      const penalty = getPenaltyForInstallment(index);
                      return baseValue + penalty;
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
                                      {/* Mostrar multa se existir */}
                                      {getPenaltyForInstallment(index) > 0 && !status.isPaid && (
                                        <span className="text-xs text-red-500 font-medium">
                                          +{formatCurrency(getPenaltyForInstallment(index))} multa
                                        </span>
                                      )}
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
                            onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value, is_advance_payment: false, recalculate_interest: false })} 
                            placeholder={`Máx: ${formatCurrency(selectedStatus.remaining)}`}
                            required 
                          />
                          <p className="text-xs text-muted-foreground">
                            Digite qualquer valor até {formatCurrency(selectedStatus.remaining)}
                          </p>
                        </div>
                        
                        {/* Checkbox de Recálculo de Juros - aparece para pagamentos parciais que não sejam adiantamento */}
                        {!selectedSubparcela && (() => {
                          const paidAmount = parseFloat(paymentData.amount) || 0;
                          const isPartialAmount = paidAmount > 0 && paidAmount < selectedStatus.remaining;
                          
                          // Só mostra para pagamentos parciais (amortização) que reduzem o saldo devedor
                          if (!isPartialAmount || paymentData.is_advance_payment) return null;
                          
                          // Calcular novo saldo e novos juros
                          const originalPrincipal = selectedLoan?.principal_amount || 0;
                          const currentInterestRate = selectedLoan?.interest_rate || 0;
                          const numInstallments = selectedLoan?.installments || 1;
                          
                          // Calcular amortizações anteriores
                          const previousAmortizations = getTotalAmortizationsFromNotes(selectedLoan?.notes || null);
                          
                          // Principal atual (após amortizações anteriores)
                          const currentPrincipal = Math.max(0, originalPrincipal - previousAmortizations);
                          
                          // Novo principal após esta amortização
                          const newPrincipal = Math.max(0, currentPrincipal - paidAmount);
                          
                          // Juros originais (sobre principal original)
                          const originalInterest = originalPrincipal * (currentInterestRate / 100);
                          
                          // Novos juros (sobre novo principal)
                          const newTotalInterest = newPrincipal * (currentInterestRate / 100);
                          
                          // Economia total de juros
                          const interestSavings = Math.max(0, originalInterest - newTotalInterest);
                          
                          // Calcular novas parcelas
                          const paidInstallmentsCount = selectedLoan ? getPaidInstallmentsCount(selectedLoan) : 0;
                          const remainingInstallmentsCount = Math.max(1, numInstallments - paidInstallmentsCount);
                          
                          // Valor atual por parcela
                          const currentInstallmentValue = (selectedLoan?.remaining_balance || 0) / remainingInstallmentsCount;
                          
                          // Novo valor por parcela
                          const newRemainingBalance = newPrincipal + newTotalInterest;
                          const newInstallmentValue = newRemainingBalance / remainingInstallmentsCount;
                          
                          // Só mostra se houver economia real
                          if (interestSavings < 0.01) return null;
                          
                          return (
                            <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                              <Checkbox
                                id="recalculate_interest"
                                checked={paymentData.recalculate_interest}
                                onCheckedChange={(checked) => setPaymentData({ ...paymentData, recalculate_interest: !!checked })}
                              />
                              <div className="flex-1">
                                <label htmlFor="recalculate_interest" className="text-sm font-medium cursor-pointer text-blue-700 dark:text-blue-300">
                                  Amortizar e recalcular juros?
                                </label>
                                <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 space-y-1">
                                  <div className="flex justify-between">
                                    <span>Principal original:</span>
                                    <span>{formatCurrency(originalPrincipal)}</span>
                                  </div>
                                  {previousAmortizations > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                      <span>Amortizações anteriores:</span>
                                      <span>-{formatCurrency(previousAmortizations)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span>Amortização agora:</span>
                                    <span className="text-amber-600">-{formatCurrency(paidAmount)}</span>
                                  </div>
                                  <div className="flex justify-between font-medium border-t border-blue-500/20 pt-1">
                                    <span>Novo principal:</span>
                                    <span>{formatCurrency(newPrincipal)}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-blue-500/20 pt-1 mt-1">
                                    <span>Juros originais ({currentInterestRate}%):</span>
                                    <span>{formatCurrency(originalInterest)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Novos juros ({currentInterestRate}% de {formatCurrency(newPrincipal)}):</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(newTotalInterest)}</span>
                                  </div>
                                  <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400 border-t border-blue-500/20 pt-1">
                                    <span>💰 Economia de juros:</span>
                                    <span>{formatCurrency(interestSavings)}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-blue-500/20 pt-1 mt-1">
                                    <span>Parcelas restantes:</span>
                                    <span>{remainingInstallmentsCount}x</span>
                                  </div>
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Valor atual:</span>
                                    <span>{formatCurrency(currentInstallmentValue)}</span>
                                  </div>
                                  <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
                                    <span>NOVO valor:</span>
                                    <span>{formatCurrency(newInstallmentValue)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        
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
                  
                  {/* Seção de Desconto para Quitação */}
                  {paymentData.payment_type === 'discount' && (() => {
                    const remainingBalance = selectedLoan?.remaining_balance || 0;
                    const receivedAmount = parseFloat(discountSettlementData.receivedAmount) || 0;
                    const discountAmount = remainingBalance - receivedAmount;
                    const isValidDiscount = receivedAmount > 0 && receivedAmount <= remainingBalance;
                    
                    return (
                      <div className="space-y-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <Percent className="w-5 h-5" />
                            <span className="font-semibold">Quitação com Desconto</span>
                          </div>
                          
                          <div className="flex justify-between items-center py-2 border-b border-emerald-500/20">
                            <span className="text-muted-foreground">Saldo Devedor:</span>
                            <span className="font-bold text-lg">{formatCurrency(remainingBalance)}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Valor Recebido *</Label>
                            <Input 
                              type="number" 
                              step="0.01" 
                              value={discountSettlementData.receivedAmount}
                              onChange={(e) => setDiscountSettlementData({ 
                                ...discountSettlementData, 
                                receivedAmount: e.target.value,
                                discountAmount: remainingBalance - (parseFloat(e.target.value) || 0)
                              })}
                              placeholder={`Máximo: ${formatCurrency(remainingBalance)}`}
                              className="text-lg font-semibold"
                              required
                            />
                            <p className="text-xs text-muted-foreground">
                              Quanto o cliente efetivamente pagou para quitar
                            </p>
                          </div>
                          
                          {receivedAmount > 0 && (
                            <div className={`p-3 rounded-lg ${isValidDiscount ? 'bg-emerald-500/20 border border-emerald-500' : 'bg-destructive/10 border border-destructive'}`}>
                              <div className="flex justify-between items-center">
                                <span className={isValidDiscount ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-destructive font-medium'}>
                                  Desconto Aplicado:
                                </span>
                                <span className={`text-xl font-bold ${isValidDiscount ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                  {isValidDiscount ? formatCurrency(discountAmount) : 'Valor inválido'}
                                </span>
                              </div>
                              {isValidDiscount && discountAmount > 0 && (
                                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                                  {((discountAmount / remainingBalance) * 100).toFixed(1)}% de desconto sobre o saldo
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {isValidDiscount && (
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" />
                              O contrato será encerrado como <strong className="mx-1">QUITADO</strong>
                            </p>
                          </div>
                        )}
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
                  
                  {!paymentData.is_advance_payment && paymentData.payment_type !== 'discount' && (
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
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                    <Button 
                      type="submit" 
                      className={paymentData.payment_type === 'discount' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    >
                      {paymentData.payment_type === 'discount' ? 'Quitar com Desconto' : 'Registrar Pagamento'}
                    </Button>
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
              
              // CORREÇÃO: Sempre usar remaining_balance como fonte de verdade
              // remaining_balance já considera amortizações e pagamentos reais
              const actualRemaining = selectedLoan.remaining_balance;
              
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
                          const rollDateForward = (date: Date, paymentType: string): Date => {
                            if (paymentType === 'weekly') {
                              const newDate = new Date(date);
                              newDate.setDate(newDate.getDate() + 7);  // +1 semana
                              return newDate;
                            } else if (paymentType === 'biweekly') {
                              const newDate = new Date(date);
                              newDate.setDate(newDate.getDate() + 15); // +15 dias
                              return newDate;
                            } else {
                              // Usar addMonths do date-fns para evitar bugs na virada de ano
                              return addMonths(date, 1);
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
                            const rolledDate = rollDateForward(currentDate, selectedLoan.payment_type);
                            newDueDate = format(rolledDate, 'yyyy-MM-dd');
                          } else if (selectedLoan.due_date) {
                            // Se não tem parcelas, usar due_date + período
                            const currentDate = new Date(selectedLoan.due_date + 'T12:00:00');
                            const rolledDate = rollDateForward(currentDate, selectedLoan.payment_type);
                            newDueDate = format(rolledDate, 'yyyy-MM-dd');
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
                <ClientSelector
                  selectedClientId={editFormData.client_id || null}
                  onSelect={(client) => setEditFormData({ ...editFormData, client_id: client?.id || '' })}
                  placeholder="Buscar cliente por nome, telefone ou CPF..."
                  className={`h-9 sm:h-10 ${editIsRenegotiation ? 'opacity-50 pointer-events-none' : ''}`}
                />
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
                  
                  {/* Skip weekends/holidays section for daily loans edit form */}
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <Label className="text-xs text-muted-foreground">Não cobra nos seguintes dias:</Label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox 
                          checked={editSkipSaturday} 
                          onCheckedChange={(checked) => setEditSkipSaturday(!!checked)} 
                        />
                        <span className="text-sm">Sábados</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox 
                          checked={editSkipSunday} 
                          onCheckedChange={(checked) => setEditSkipSunday(!!checked)} 
                        />
                        <span className="text-sm">Domingos</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox 
                          checked={editSkipHolidays} 
                          onCheckedChange={(checked) => setEditSkipHolidays(!!checked)} 
                        />
                        <span className="text-sm">Feriados</span>
                      </label>
                    </div>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const numInstallments = parseInt(editFormData.installments) || editInstallmentDates.length || 1;
                        const startDate = editFormData.start_date || editInstallmentDates[0];
                        if (!startDate) {
                          toast.error('Selecione uma data inicial primeiro');
                          return;
                        }
                        const newDates = generateDailyDates(startDate, numInstallments, editSkipSaturday, editSkipSunday, editSkipHolidays);
                        
                        setEditInstallmentDates(newDates);
                        if (newDates.length > 0) {
                          setEditFormData(prev => ({ 
                            ...prev, 
                            due_date: newDates[newDates.length - 1],
                            installments: newDates.length.toString()
                          }));
                        }
                        toast.success('Datas recalculadas!');
                      }}
                      className="mt-2"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Recalcular Datas
                    </Button>
                    
                    {(editSkipSaturday || editSkipSunday || editSkipHolidays) && (
                      <p className="text-xs text-amber-500">
                        ⚠️ {[
                          editSkipSaturday && 'Sábados',
                          editSkipSunday && 'Domingos', 
                          editSkipHolidays && 'Feriados'
                        ].filter(Boolean).join(', ')} serão pulados ao recalcular
                      </p>
                    )}
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
                          <SelectItem value="installment">Parcelado (Mensal)</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="biweekly">Quinzenal</SelectItem>
                          <SelectItem value="daily">Diário</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(editFormData.payment_type === 'installment' || editFormData.payment_type === 'weekly' || editFormData.payment_type === 'biweekly') && (
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
                  {(editFormData.payment_type === 'installment' || editFormData.payment_type === 'weekly' || editFormData.payment_type === 'biweekly') && (
                    <>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div className="space-y-1 sm:space-y-2">
                          <Label className="text-xs sm:text-sm">Juros Total (R$)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="Ex: 160.00"
                            value={isEditManuallyEditingInterest ? editEditableTotalInterest : (() => {
                              const principal = parseFloat(editFormData.principal_amount) || 0;
                              const rate = parseFloat(editFormData.interest_rate) || 0;
                              const numInst = parseInt(editFormData.installments) || 1;
                              let totalInterest: number;
                              if (editFormData.interest_mode === 'on_total') {
                                totalInterest = principal * (rate / 100);
                              } else if (editFormData.interest_mode === 'compound') {
                                // Juros compostos puros: M = P × (1 + i)^n - P
                                totalInterest = principal * Math.pow(1 + (rate / 100), numInst) - principal;
                              } else {
                                totalInterest = principal * (rate / 100) * numInst;
                              }
                              return totalInterest > 0 ? totalInterest.toFixed(2) : '';
                            })()}
                            onChange={(e) => {
                              const value = e.target.value;
                              setIsEditManuallyEditingInterest(true);
                              setIsEditManuallyEditingInstallment(true);
                              setEditEditableTotalInterest(value);
                              
                              const newTotalInterest = parseFloat(value);
                              const principal = parseFloat(editFormData.principal_amount);
                              const numInstallments = parseInt(editFormData.installments) || 1;
                              
                              if (newTotalInterest && principal && numInstallments) {
                                // Calcular novo valor da parcela
                                const totalToReceive = principal + newTotalInterest;
                                const newInstallmentValue = totalToReceive / numInstallments;
                                setEditInstallmentValue(newInstallmentValue.toFixed(2));
                                
                                // Recalcular taxa de juros
                                let newRate: number;
                                if (editFormData.interest_mode === 'on_total') {
                                  newRate = (newTotalInterest / principal) * 100;
                                } else if (editFormData.interest_mode === 'compound') {
                                  newRate = calculateRateFromPMT(newInstallmentValue, principal, numInstallments);
                                } else {
                                  newRate = (newTotalInterest / principal / numInstallments) * 100;
                                }
                                if (newRate >= 0 && isFinite(newRate)) {
                                  setEditFormData(prev => ({ ...prev, interest_rate: newRate.toFixed(2) }));
                                }
                              }
                            }}
                            className="h-9 sm:h-10 text-sm"
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
                        onChange={(e) => {
                          const newDate = e.target.value;
                          setEditFormData({ ...editFormData, start_date: newDate });
                          
                          // Sincronizar a Parcela 1 na lista de parcelas
                          if (editInstallmentDates.length > 0) {
                            setEditInstallmentDates(prev => {
                              const newDates = [...prev];
                              newDates[0] = newDate;
                              return newDates;
                            });
                          }
                        }} 
                        className="h-9 sm:h-10 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">Quando começa a pagar</p>
                    </div>
                  </div>
                  {(editFormData.payment_type === 'installment' || editFormData.payment_type === 'weekly' || editFormData.payment_type === 'biweekly') && (
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
                  
                  {/* Skip weekends/holidays section for edit form */}
                  {(editFormData.payment_type === 'installment' || editFormData.payment_type === 'weekly' || editFormData.payment_type === 'biweekly') && (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label className="text-xs text-muted-foreground">Não cobra nos seguintes dias:</Label>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox 
                            checked={editSkipSaturday} 
                            onCheckedChange={(checked) => setEditSkipSaturday(!!checked)} 
                          />
                          <span className="text-sm">Sábados</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox 
                            checked={editSkipSunday} 
                            onCheckedChange={(checked) => setEditSkipSunday(!!checked)} 
                          />
                          <span className="text-sm">Domingos</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox 
                            checked={editSkipHolidays} 
                            onCheckedChange={(checked) => setEditSkipHolidays(!!checked)} 
                          />
                          <span className="text-sm">Feriados</span>
                        </label>
                      </div>
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const numInstallments = parseInt(editFormData.installments) || 1;
                          const startDate = editFormData.start_date;
                          let newDates: string[] = [];
                          
                          if (editFormData.payment_type === 'weekly') {
                            newDates = generateWeeklyDates(startDate, numInstallments, editSkipSaturday, editSkipSunday, editSkipHolidays);
                          } else if (editFormData.payment_type === 'biweekly') {
                            newDates = generateBiweeklyDates(startDate, numInstallments, editSkipSaturday, editSkipSunday, editSkipHolidays);
                          } else if (editFormData.payment_type === 'installment') {
                            newDates = generateMonthlyDates(startDate, numInstallments, editSkipSaturday, editSkipSunday, editSkipHolidays);
                          }
                          
                          setEditInstallmentDates(newDates);
                          if (newDates.length > 0) {
                            setEditFormData(prev => ({ ...prev, due_date: newDates[newDates.length - 1] }));
                          }
                          toast.success('Datas recalculadas!');
                        }}
                        className="mt-2"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Recalcular Datas
                      </Button>
                      
                      {(editSkipSaturday || editSkipSunday || editSkipHolidays) && (
                        <p className="text-xs text-amber-500">
                          ⚠️ {[
                            editSkipSaturday && 'Sábados',
                            editSkipSunday && 'Domingos', 
                            editSkipHolidays && 'Feriados'
                          ].filter(Boolean).join(', ')} serão pulados ao recalcular
                        </p>
                      )}
                    </div>
                  )}
                </>
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
          installmentDates={paymentInstallmentDates}
          paidCount={paymentPaidCount}
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
        
        {/* Dialog para criar empréstimo com Tabela Price */}
        <PriceTableDialog
          open={isPriceTableDialogOpen}
          onOpenChange={setIsPriceTableDialogOpen}
          clients={loanClients}
          onCreateLoan={async (loanData) => {
            const result = await createLoan({
              client_id: loanData.client_id,
              principal_amount: loanData.principal_amount,
              interest_rate: loanData.interest_rate,
              interest_type: loanData.interest_type,
              interest_mode: loanData.interest_mode,
              payment_type: loanData.payment_type,
              installments: loanData.installments,
              contract_date: loanData.contract_date,
              start_date: loanData.start_date,
              due_date: loanData.due_date,
              notes: loanData.notes,
              installment_dates: loanData.installment_dates,
              total_interest: loanData.total_interest,
              send_creation_notification: loanData.send_notification,
            });
            return result;
          }}
          onNewClientClick={handleNewClientClick}
        />
        {/* Dialog para editar multa de parcela */}
        <Dialog open={!!editPenaltyDialog} onOpenChange={() => setEditPenaltyDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar Multa</DialogTitle>
              <DialogDescription>
                Parcela {(editPenaltyDialog?.installmentIndex || 0) + 1} - Valor atual: {formatCurrency(editPenaltyDialog?.currentValue || 0)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Novo valor da multa (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPenaltyValue}
                  onChange={(e) => setEditPenaltyValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditPenaltyDialog(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    if (editPenaltyDialog) {
                      handleEditDailyPenalty(
                        editPenaltyDialog.loanId,
                        editPenaltyDialog.installmentIndex,
                        parseFloat(editPenaltyValue) || 0,
                        editPenaltyDialog.currentNotes
                      );
                      setEditPenaltyDialog(null);
                    }
                  }}
                  className="flex-1"
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Dialog para aplicar multa manualmente */}
        <Dialog open={!!manualPenaltyDialog} onOpenChange={() => setManualPenaltyDialog(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurar Multa por Atraso</DialogTitle>
              <DialogDescription>
                Escolha como calcular a multa: automática (% ou R$/dia) ou manualmente por parcela.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Escolha: % ou R$ ou por parcela (manual) */}
              <div className="space-y-2">
                <Label>Tipo de valor</Label>
                <Select 
                  value={manualPenaltyDialog?.penaltyMode} 
                  onValueChange={(v) => {
                    setManualPenaltyDialog(prev => prev ? {...prev, penaltyMode: v as 'percentage' | 'fixed' | 'manual'} : null);
                    // Limpa os valores quando muda o tipo
                    if (v !== 'manual') {
                      setManualPenaltyValues({});
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (% por dia)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$ por dia)</SelectItem>
                    <SelectItem value="manual">Manualmente (por parcela)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Input único para multa dinâmica (% ou R$/dia) */}
              {(manualPenaltyDialog?.penaltyMode === 'percentage' || manualPenaltyDialog?.penaltyMode === 'fixed') && (
                <div className="space-y-2">
                  <Label>
                    {manualPenaltyDialog.penaltyMode === 'percentage' 
                      ? 'Porcentagem por dia de atraso (%)' 
                      : 'Valor fixo por dia de atraso (R$)'}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={manualPenaltyDialog.penaltyMode === 'percentage' ? 'Ex: 1.5' : 'Ex: 5.00'}
                    value={manualPenaltyValues['dynamic'] || ''}
                    onChange={(e) => setManualPenaltyValues({ dynamic: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {manualPenaltyDialog.penaltyMode === 'percentage' 
                      ? 'A multa será calculada automaticamente: % × valor × dias em atraso' 
                      : 'A multa será calculada automaticamente: R$/dia × dias em atraso'}
                  </p>
                </div>
              )}
              
              {/* Lista de parcelas em atraso - só mostra para modo manual */}
              {manualPenaltyDialog?.penaltyMode === 'manual' && (
                <div className="space-y-2">
                  <Label>Parcelas em atraso ({manualPenaltyDialog?.overdueInstallments.length})</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {manualPenaltyDialog?.overdueInstallments.map((inst) => {
                      const enteredValue = parseFloat(manualPenaltyValues[inst.index] || '0');
                      
                      return (
                        <div key={inst.index} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Parcela {inst.index + 1}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Venc: {format(new Date(inst.dueDate + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })} • {inst.daysOverdue} dias atraso
                            </p>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-20 h-8"
                            placeholder="R$"
                            value={manualPenaltyValues[inst.index] || ''}
                            onChange={(e) => setManualPenaltyValues(prev => ({
                              ...prev,
                              [inst.index]: e.target.value
                            }))}
                          />
                          {enteredValue > 0 && (
                            <span className="text-xs text-orange-500 w-20 text-right">
                              +{formatCurrency(enteredValue)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Total preview para modo manual */}
              {manualPenaltyDialog?.penaltyMode === 'manual' && Object.keys(manualPenaltyValues).some(k => parseFloat(manualPenaltyValues[parseInt(k)] || '0') > 0) && (
                <div className="p-2 bg-orange-500/10 rounded border border-orange-500/30">
                  <p className="text-sm font-medium text-orange-600">
                    Total de multas: {formatCurrency(
                      manualPenaltyDialog?.overdueInstallments.reduce((sum, inst) => {
                        const enteredValue = parseFloat(manualPenaltyValues[inst.index] || '0');
                        return sum + enteredValue;
                      }, 0) || 0
                    )}
                  </p>
                </div>
              )}
              
              {/* Preview para multa dinâmica */}
              {(manualPenaltyDialog?.penaltyMode === 'percentage' || manualPenaltyDialog?.penaltyMode === 'fixed') && parseFloat(manualPenaltyValues['dynamic'] || '0') > 0 && (
                <div className="p-2 bg-orange-500/10 rounded border border-orange-500/30">
                  <p className="text-sm font-medium text-orange-600">
                    Multa configurada: {manualPenaltyDialog.penaltyMode === 'percentage' 
                      ? `${manualPenaltyValues['dynamic']}% por dia de atraso`
                      : `R$ ${parseFloat(manualPenaltyValues['dynamic'] || '0').toFixed(2)} por dia de atraso`}
                  </p>
                </div>
              )}
              
              {/* Botões */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setManualPenaltyDialog(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleSaveManualPenalties} className="flex-1">
                  Aplicar Multas
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>


      </div>
    </DashboardLayout>
  );
}
