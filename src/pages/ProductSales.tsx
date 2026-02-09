import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProductSales, useProductSalePayments, ProductSale, CreateProductSaleData, InstallmentDate } from '@/hooks/useProductSales';
import { ClientSelector, formatFullAddress } from '@/components/ClientSelector';
import { Client } from '@/types/database';

import { useContracts, Contract, CreateContractData, ContractPayment, UpdateContractData } from '@/hooks/useContracts';
import { useContractExpenses, EXPENSE_CATEGORIES } from '@/hooks/useContractExpenses';
import { ContractExpensesDialog } from '@/components/ContractExpensesDialog';
import { useMonthlyFees, useMonthlyFeePayments, MonthlyFee, CreateMonthlyFeeData } from '@/hooks/useMonthlyFees';
import { useClients } from '@/hooks/useClients';
import { format, parseISO, isPast, isToday, addMonths, addDays, getDate, setDate, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Check, Trash2, Edit, ShoppingBag, User, DollarSign, Calendar, ChevronDown, ChevronUp, Package, Banknote, FileSignature, FileText, AlertTriangle, TrendingUp, Pencil, Tv, Power, MessageCircle, Phone, Bell, Loader2, Clock, CheckCircle, History, Car, Receipt, Server, ExternalLink, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { generateContractReceipt, generatePaymentReceipt, ContractReceiptData, PaymentReceiptData } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import ReceiptPreviewDialog from '@/components/ReceiptPreviewDialog';
import PaymentReceiptPrompt from '@/components/PaymentReceiptPrompt';
import ProductSaleCard from '@/components/ProductSaleCard';
import ProductInstallmentsDialog from '@/components/ProductInstallmentsDialog';
import SaleCreatedReceiptPrompt from '@/components/SaleCreatedReceiptPrompt';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import MessagePreviewDialog from '@/components/MessagePreviewDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import IPTVDashboard from '@/components/iptv/IPTVDashboard';
import IPTVPlanManager from '@/components/iptv/IPTVPlanManager';
import IPTVServerConfig from '@/components/iptv/IPTVServerConfig';
import IPTVSubscriptionForm from '@/components/iptv/IPTVSubscriptionForm';
import SendOverdueNotification from '@/components/SendOverdueNotification';
import SendDueTodayNotification from '@/components/SendDueTodayNotification';
import { SendEarlyNotification } from '@/components/SendEarlyNotification';
import IPTVSubscriptionListView from '@/components/iptv/IPTVSubscriptionListView';
import ContractListView from '@/components/ContractListView';

// Subcomponente para lista de parcelas de produtos com scroll automático
interface ProductInstallment {
  number: number;
  date: string;
  isPaid?: boolean;
}

function ProductInstallmentsList({
  installmentDates,
  isHistorical,
  today,
  updateInstallmentDate,
  toggleInstallmentPaid,
  onSelectAll,
  onDeselectAll,
}: {
  installmentDates: ProductInstallment[];
  isHistorical: boolean;
  today: Date;
  updateInstallmentDate: (index: number, date: string) => void;
  toggleInstallmentPaid: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstUnpaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHistorical && firstUnpaidRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = firstUnpaidRef.current;
      const offsetTop = element.offsetTop - container.offsetTop;
      container.scrollTop = Math.max(0, offsetTop - 10);
    }
  }, [isHistorical, installmentDates]);

  const firstUnpaidIndex = installmentDates.findIndex(inst => !inst.isPaid);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Datas das Parcelas</Label>
        {isHistorical && (
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={onSelectAll}>
              Todas
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onDeselectAll}>
              Nenhuma
            </Button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="h-[180px] overflow-y-auto rounded-md border p-3 space-y-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {installmentDates.map((inst, index) => {
          const instDate = new Date(inst.date);
          instDate.setHours(0, 0, 0, 0);
          const isPastDate = instDate < today;
          const showPaidCheckbox = isHistorical && isPastDate;
          const isFirstUnpaid = index === firstUnpaidIndex;

          return (
            <div
              key={inst.number}
              ref={isFirstUnpaid ? firstUnpaidRef : undefined}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                inst.isPaid ? "bg-primary/10 border border-primary/30" : "bg-background border border-border"
              )}
            >
              <Badge variant="outline" className={cn(
                "w-16 justify-center text-xs",
                inst.isPaid && "bg-primary text-primary-foreground border-primary"
              )}>
                {inst.number}ª
              </Badge>
              <Input
                type="date"
                value={inst.date}
                onChange={(e) => updateInstallmentDate(index, e.target.value)}
                className="flex-1"
              />
              {showPaidCheckbox && (
                <Button
                  type="button"
                  variant={inst.isPaid ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => toggleInstallmentPaid(index)}
                >
                  {inst.isPaid ? (
                    <><Check className="w-3 h-3 mr-1" /> Paga</>
                  ) : (
                    "Marcar Paga"
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductSales() {
  // Product Sales hooks
  const { sales, isLoading: salesLoading, createSale, updateSale, updateSaleWithPayments, deleteSale } = useProductSales();
  const { payments: allSalePayments, markAsPaid: markSalePaymentAsPaid, markAsPaidFlexible } = useProductSalePayments();
  
  
  // Contracts hooks
  const { contracts, allContractPayments, isLoading: contractsLoading, createContract, updateContract, deleteContract, getContractPayments, markPaymentAsPaid, revertPayment, updatePaymentDueDate } = useContracts();
  const { allExpenses: contractExpenses, getTotalExpensesByContract, createExpense } = useContractExpenses();
  
  // Monthly Fees (Subscriptions) hooks
  const { fees: monthlyFees, isLoading: feesLoading, createFee, updateFee, deleteFee, toggleActive, generatePayment } = useMonthlyFees();
  const { payments: feePayments, isLoading: feePaymentsLoading, markAsPaid: markFeePaymentAsPaid, calculateWithInterest, updatePayment: updateFeePayment } = useMonthlyFeePayments();
  const { clients } = useClients();
  
  const { profile } = useProfile();

  // Main tab state
  const [mainTab, setMainTab] = useState<'products' | 'contracts' | 'subscriptions'>('products');
  
  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [salesStatusFilter, setSalesStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
  
  // Product Sales states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<ProductSale | null>(null);
  const [editingPayments, setEditingPayments] = useState<InstallmentDate[]>([]);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [installmentDates, setInstallmentDates] = useState<InstallmentDate[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{ id: string; amount: number; installmentNumber: number; saleId: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  // Installments dialog state
  const [installmentsDialogOpen, setInstallmentsDialogOpen] = useState(false);
  const [selectedSaleForInstallments, setSelectedSaleForInstallments] = useState<ProductSale | null>(null);

  // Contracts states
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [isEditContractOpen, setIsEditContractOpen] = useState(false);
  const [deleteContractId, setDeleteContractId] = useState<string | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const [contractPayments, setContractPayments] = useState<Record<string, ContractPayment[]>>({});
  const [editContractForm, setEditContractForm] = useState<UpdateContractData>({
    client_name: '',
    client_phone: '',
    client_cpf: '',
    client_rg: '',
    client_email: '',
    client_address: '',
    contract_type: '',
    total_amount: 0,
    amount_to_receive: 0,
    notes: '',
  });
  const [editingContractPayments, setEditingContractPayments] = useState<ContractPayment[]>([]);
  const [selectedContractClientId, setSelectedContractClientId] = useState<string | null>(null);
  const [isContractHistorical, setIsContractHistorical] = useState(false);
  const [historicalPaidInstallments, setHistoricalPaidInstallments] = useState<number[]>([]);
  const [contractsStatusFilter, setContractsStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
  const [contractViewMode, setContractViewMode] = useState<'cards' | 'list'>('cards');
  const [expensesDialogContract, setExpensesDialogContract] = useState<Contract | null>(null);
  const [contractInitialExpenses, setContractInitialExpenses] = useState<Array<{
    amount: number;
    category: string;
    description: string;
    expense_date: string;
  }>>([]);

  // Contract payment dialog states
  const [contractPaymentDialogOpen, setContractPaymentDialogOpen] = useState(false);
  const [selectedContractPayment, setSelectedContractPayment] = useState<{ payment: ContractPayment; contract: Contract } | null>(null);
  const [contractPaymentDate, setContractPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Contract payment due date edit states
  const [editingPaymentDueDateId, setEditingPaymentDueDateId] = useState<string | null>(null);
  const [newPaymentDueDate, setNewPaymentDueDate] = useState<Date | undefined>(undefined);

  // Subscription states
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState<CreateMonthlyFeeData>({
    client_id: '',
    amount: 0,
    description: 'IPTV',
    due_day: 10,
    interest_rate: 0,
    generate_current_month: true,
  });
  const [deleteSubscriptionId, setDeleteSubscriptionId] = useState<string | null>(null);
  const [subscriptionPaymentDialogOpen, setSubscriptionPaymentDialogOpen] = useState(false);
  const [selectedSubscriptionPayment, setSelectedSubscriptionPayment] = useState<{ paymentId: string; amount: number; feeId: string } | null>(null);
  const [subscriptionPaymentDate, setSubscriptionPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<'all' | 'active' | 'pending' | 'overdue'>('all');
  const [subscriptionViewMode, setSubscriptionViewMode] = useState<'cards' | 'list'>('cards');
  const [isSendingCharge, setIsSendingCharge] = useState<Record<string, boolean>>({});
  const [expandedSubscriptions, setExpandedSubscriptions] = useState<Record<string, boolean>>({});
  const [showChargePreview, setShowChargePreview] = useState(false);
  const [chargePreviewData, setChargePreviewData] = useState<{
    feeId: string;
    clientName: string;
    clientPhone: string;
    message: string;
  } | null>(null);
  
  // Subscription edit states
  const [editingSubscriptionDueDateId, setEditingSubscriptionDueDateId] = useState<string | null>(null);
  const [newSubscriptionDueDate, setNewSubscriptionDueDate] = useState<Date | undefined>(undefined);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null);
  const [editSubscriptionForm, setEditSubscriptionForm] = useState({
    amount: 0,
    description: '',
    interest_rate: 0,
    due_day: 10,
    iptv_server_name: '',
    iptv_server_url: '',
  });
  const [editSubscriptionNewDueDate, setEditSubscriptionNewDueDate] = useState<Date | undefined>(undefined);
  const [historyDialogFee, setHistoryDialogFee] = useState<MonthlyFee | null>(null);
  const { user } = useAuth();

  // Receipt preview states
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [receiptPreviewData, setReceiptPreviewData] = useState<ContractReceiptData | null>(null);

  // Payment receipt prompt states
  const [isPaymentReceiptOpen, setIsPaymentReceiptOpen] = useState(false);
  const [paymentClientPhone, setPaymentClientPhone] = useState<string | null>(null);
  const [paymentReceiptData, setPaymentReceiptData] = useState<PaymentReceiptData | null>(null);

  // Sale created receipt prompt states
  const [isSaleReceiptPromptOpen, setIsSaleReceiptPromptOpen] = useState(false);
  const [newCreatedSale, setNewCreatedSale] = useState<ProductSale | null>(null);
  const [newSaleInstallmentDates, setNewSaleInstallmentDates] = useState<InstallmentDate[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Forms
  const [formData, setFormData] = useState<CreateProductSaleData>({
    product_name: '',
    product_description: '',
    client_name: '',
    client_phone: '',
    client_email: '',
    client_cpf: '',
    client_rg: '',
    client_address: '',
    sale_date: format(new Date(), 'yyyy-MM-dd'),
    total_amount: 0,
    cost_value: 0,
    down_payment: 0,
    installments: 1,
    installment_value: 0,
    first_due_date: '',
    notes: '',
    send_creation_notification: false,
    is_historical: false,
    payment_frequency: 'monthly' as 'monthly' | 'weekly' | 'biweekly',
  });

  const [contractForm, setContractForm] = useState<CreateContractData>({
    client_name: '',
    client_phone: '',
    client_cpf: '',
    client_rg: '',
    client_email: '',
    client_address: '',
    contract_type: 'aluguel_casa',
    bill_type: 'receivable',
    total_amount: 0,
    amount_to_receive: 0,
    frequency: 'monthly',
    installments: 12,
    contract_date: format(new Date(), 'yyyy-MM-dd'),
    first_payment_date: '',
    payment_method: 'all_days',
    notes: '',
    is_historical: false,
    // Vehicle rental fields
    vehicle_plate: '',
    vehicle_brand: '',
    vehicle_model: '',
    vehicle_color: '',
    vehicle_km_start: '',
    vehicle_km_end: '',
    vehicle_year: '',
    vehicle_renavam: '',
  });



  // Reset functions
  const resetForm = () => {
    setFormData({
      product_name: '',
      product_description: '',
      client_name: '',
      client_phone: '',
      client_email: '',
      client_cpf: '',
      client_rg: '',
      client_address: '',
      sale_date: format(new Date(), 'yyyy-MM-dd'),
      total_amount: 0,
      cost_value: 0,
      down_payment: 0,
      installments: 1,
      installment_value: 0,
      first_due_date: '',
      notes: '',
      send_creation_notification: false,
      is_historical: false,
      payment_frequency: 'monthly',
    });
    setInstallmentDates([]);
    setSelectedClientId(null);
  };

  // Handler for client selection
  const handleClientSelect = (client: Client | null) => {
    if (client) {
      setSelectedClientId(client.id);
      setFormData(prev => ({
        ...prev,
        client_name: client.full_name,
        client_phone: client.phone || '',
        client_cpf: client.cpf || '',
        client_rg: client.rg || '',
        client_email: client.email || '',
        client_address: formatFullAddress(client),
      }));
    } else {
      setSelectedClientId(null);
    }
  };

  const resetContractForm = () => {
    setContractForm({
      client_name: '',
      client_phone: '',
      client_cpf: '',
      client_rg: '',
      client_email: '',
      client_address: '',
      contract_type: 'aluguel_casa',
      bill_type: 'receivable',
      total_amount: 0,
      amount_to_receive: 0,
      frequency: 'monthly',
      installments: 12,
      contract_date: format(new Date(), 'yyyy-MM-dd'),
      first_payment_date: '',
      payment_method: 'all_days',
      notes: '',
      is_historical: false,
      // Reset vehicle fields
      vehicle_plate: '',
      vehicle_brand: '',
      vehicle_model: '',
      vehicle_color: '',
      vehicle_km_start: '',
      vehicle_km_end: '',
      vehicle_year: '',
      vehicle_renavam: '',
    });
    setSelectedContractClientId(null);
    setIsContractHistorical(false);
    setHistoricalPaidInstallments([]);
    setContractInitialExpenses([]);
  };

  // Handler for contract client selection
  const handleContractClientSelect = (client: Client | null) => {
    if (client) {
      setSelectedContractClientId(client.id);
      setContractForm(prev => ({
        ...prev,
        client_name: client.full_name,
        client_phone: client.phone || '',
        client_cpf: client.cpf || '',
        client_rg: client.rg || '',
        client_email: client.email || '',
        client_address: formatFullAddress(client),
      }));
    } else {
      setSelectedContractClientId(null);
    }
  };

  // Generate contract installment dates for preview (when historical)
  const getContractInstallmentDates = () => {
    if (!contractForm.first_payment_date || !contractForm.installments) return [];
    
    const dates = [];
    const firstDate = parseISO(contractForm.first_payment_date);
    
    for (let i = 0; i < contractForm.installments; i++) {
      let dueDate: Date;
      if (contractForm.frequency === 'weekly') {
        dueDate = addDays(firstDate, i * 7);
      } else if (contractForm.frequency === 'biweekly') {
        dueDate = addDays(firstDate, i * 15);
      } else {
        dueDate = addMonths(firstDate, i);
      }
      dates.push({
        number: i + 1,
        date: format(dueDate, 'yyyy-MM-dd'),
        isPast: isPast(dueDate) && !isToday(dueDate),
      });
    }
    return dates;
  };

  const toggleHistoricalInstallment = (installmentNumber: number) => {
    setHistoricalPaidInstallments(prev => 
      prev.includes(installmentNumber)
        ? prev.filter(n => n !== installmentNumber)
        : [...prev, installmentNumber]
    );
  };

  const selectAllHistoricalInstallments = () => {
    const dates = getContractInstallmentDates();
    const pastInstallments = dates.filter(d => d.isPast).map(d => d.number);
    setHistoricalPaidInstallments(pastInstallments);
  };

  const deselectAllHistoricalInstallments = () => {
    setHistoricalPaidInstallments([]);
  };

  // Initial expenses functions for vehicle rental contracts
  const addInitialExpense = () => {
    setContractInitialExpenses([...contractInitialExpenses, {
      amount: 0,
      category: 'manutencao',
      description: '',
      expense_date: format(new Date(), 'yyyy-MM-dd')
    }]);
  };

  const updateInitialExpense = (index: number, field: string, value: any) => {
    const updated = [...contractInitialExpenses];
    updated[index] = { ...updated[index], [field]: value };
    setContractInitialExpenses(updated);
  };

  const removeInitialExpense = (index: number) => {
    setContractInitialExpenses(contractInitialExpenses.filter((_, i) => i !== index));
  };



  // Generate installment dates for product sales
  useEffect(() => {
    if (formData.first_due_date && formData.installments > 0) {
      const firstDate = parseISO(formData.first_due_date);
      const dayOfMonth = getDate(firstDate);
      
      const dates: InstallmentDate[] = [];
      for (let i = 0; i < formData.installments; i++) {
        let dueDate: Date;
        
        if (formData.payment_frequency === 'weekly') {
          // Add 7 days for each installment (weekly)
          dueDate = addDays(firstDate, i * 7);
        } else if (formData.payment_frequency === 'biweekly') {
          // Add 15 days for each installment (biweekly/quinzenal)
          dueDate = addDays(firstDate, i * 15);
        } else {
          // Add 1 month for each installment (monthly)
          dueDate = addMonths(firstDate, i);
          // Ajustar o dia para não exceder o máximo do mês
          // Ex: 31/01 -> 28/02 (não 03/03)
          const maxDaysInMonth = getDaysInMonth(dueDate);
          const adjustedDay = Math.min(dayOfMonth, maxDaysInMonth);
          dueDate = setDate(dueDate, adjustedDay);
        }
        
        dates.push({
          number: i + 1,
          date: format(dueDate, 'yyyy-MM-dd'),
        });
      }
      setInstallmentDates(dates);
    }
  }, [formData.first_due_date, formData.installments, formData.payment_frequency]);

  const updateInstallmentDate = (index: number, newDate: string) => {
    setInstallmentDates(prev => 
      prev.map((item, i) => i === index ? { ...item, date: newDate } : item)
    );
  };
  
  const toggleInstallmentPaid = (index: number) => {
    setInstallmentDates(prev => 
      prev.map((item, i) => i === index ? { ...item, isPaid: !item.isPaid } : item)
    );
  };
  
  // Check if there are past installments
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasPastInstallments = installmentDates.some(inst => {
    const instDate = new Date(inst.date);
    instDate.setHours(0, 0, 0, 0);
    return instDate < today;
  });
  
  const pastInstallmentsCount = installmentDates.filter(inst => {
    const instDate = new Date(inst.date);
    instDate.setHours(0, 0, 0, 0);
    return instDate < today;
  }).length;
  
  const paidHistoricalCount = installmentDates.filter(inst => inst.isPaid).length;
  const paidHistoricalAmount = paidHistoricalCount * formData.installment_value;

  // Auto-select all past installments when is_historical is activated
  useEffect(() => {
    if (formData.is_historical && installmentDates.length > 0) {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      setInstallmentDates(prev => prev.map(inst => {
        const instDate = new Date(inst.date);
        instDate.setHours(0, 0, 0, 0);
        return instDate < todayDate ? { ...inst, isPaid: true } : inst;
      }));
    }
  }, [formData.is_historical]);

  // Clear initial expenses when contract type changes from vehicle rental
  useEffect(() => {
    if (contractForm.contract_type !== 'aluguel_veiculo') {
      setContractInitialExpenses([]);
    }
  }, [contractForm.contract_type]);

  const selectAllPastInstallments = () => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    setInstallmentDates(prev => prev.map(inst => {
      const instDate = new Date(inst.date);
      instDate.setHours(0, 0, 0, 0);
      return instDate < todayDate ? { ...inst, isPaid: true } : inst;
    }));
  };

  // Deselect all installments
  const deselectAllInstallments = () => {
    setInstallmentDates(prev => prev.map(inst => ({ ...inst, isPaid: false })));
  };

  // Product Sales handlers
  const handleCreateSale = async () => {
    const result = await createSale.mutateAsync({ ...formData, installmentDates });
    setIsCreateOpen(false);
    
    // Save data for receipt prompt
    setNewCreatedSale(result);
    setNewSaleInstallmentDates([...installmentDates]);
    setIsSaleReceiptPromptOpen(true);
    
    resetForm();
  };

  const openEditSaleDialog = async (sale: ProductSale) => {
    setEditingSale(sale);
    
    // Fetch payments directly from DB for this specific sale to avoid limit issues
    const { data: salePayments, error } = await supabase
      .from('product_sale_payments')
      .select('*')
      .eq('product_sale_id', sale.id)
      .order('installment_number', { ascending: true });
    
    if (error) {
      console.error('Error fetching sale payments:', error);
      toast.error('Erro ao carregar parcelas');
      return;
    }
    
    const existingInstallments: InstallmentDate[] = (salePayments || [])
      .map(p => ({
        number: p.installment_number,
        date: p.due_date,
        isPaid: p.status === 'paid',
        amount: p.amount,
      }));
    setEditingPayments(existingInstallments);
    setIsEditOpen(true);
  };

  const handleEditSale = async () => {
    if (!editingSale) return;
    await updateSaleWithPayments.mutateAsync({
      id: editingSale.id,
      data: {
        product_name: editingSale.product_name,
        product_description: editingSale.product_description || undefined,
        client_name: editingSale.client_name,
        client_phone: editingSale.client_phone || undefined,
        client_email: editingSale.client_email || undefined,
        client_cpf: editingSale.client_cpf || undefined,
        client_rg: editingSale.client_rg || undefined,
        client_address: editingSale.client_address || undefined,
        cost_value: editingSale.cost_value,
        total_amount: editingSale.total_amount,
        down_payment: editingSale.down_payment || 0,
        installments: editingPayments.length,
        installment_value: editingSale.installment_value,
        notes: editingSale.notes || undefined,
      },
      payments: editingPayments,
    });
    setIsEditOpen(false);
    setEditingSale(null);
    setEditingPayments([]);
  };

  const updateEditingPaymentDate = (index: number, newDate: string) => {
    setEditingPayments(prev => 
      prev.map((item, i) => i === index ? { ...item, date: newDate } : item)
    );
  };

  const updateEditingPaymentAmount = (index: number, newAmount: number) => {
    setEditingPayments(prev => 
      prev.map((item, i) => i === index ? { ...item, amount: newAmount } : item)
    );
  };

  const toggleEditingPaymentPaid = (index: number) => {
    setEditingPayments(prev => 
      prev.map((item, i) => i === index ? { ...item, isPaid: !item.isPaid } : item)
    );
  };

  const handleDeleteSale = async () => {
    if (!deleteId) return;
    await deleteSale.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleMarkSalePaymentAsPaid = async (paymentId: string) => {
    if (!selectedPayment) return;
    
    const payment = allSalePayments.find(p => p.id === paymentId);
    const sale = payment ? sales.find(s => s.id === payment.product_sale_id) : null;
    
    // Use flexible payment function that handles underpayment/overpayment
    const result = await markAsPaidFlexible.mutateAsync({
      paymentId,
      paidDate: paymentDate,
      paidAmount: paymentAmount,
      originalAmount: selectedPayment.amount,
    });
    
    // Show payment receipt prompt
    if (sale) {
      // Calculate next due date
      const salePaymentsList = allSalePayments?.filter(p => p.product_sale_id === sale.id) || [];
      const paidCount = salePaymentsList.filter(p => p.status === 'paid').length + 1; // +1 for current payment
      const nextPayment = salePaymentsList
        .filter(p => p.status !== 'paid')
        .sort((a, b) => a.installment_number - b.installment_number)
        .find(p => p.installment_number > (payment?.installment_number || 0));
      const nextDueDateForReceipt = result.newRemainingBalance > 0 ? nextPayment?.due_date : undefined;
      
      setPaymentClientPhone(sale.client_phone || null);
      setPaymentReceiptData({
        type: 'product',
        contractId: sale.id,
        companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
        billingSignatureName: profile?.billing_signature_name || undefined,
        clientName: sale.client_name,
        installmentNumber: payment?.installment_number || 1,
        totalInstallments: sale.installments,
        amountPaid: paymentAmount,
        paymentDate: paymentDate,
        remainingBalance: result.newRemainingBalance,
        totalPaid: result.newTotalPaid,
        nextDueDate: nextDueDateForReceipt,
      });
      setIsPaymentReceiptOpen(true);
    }
    
    setPaymentDialogOpen(false);
    setSelectedPayment(null);
    setPaymentAmount(0);
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const openPaymentDialog = (payment: { id: string; amount: number; installment_number: number; product_sale_id: string }) => {
    setSelectedPayment({
      id: payment.id,
      amount: payment.amount,
      installmentNumber: payment.installment_number,
      saleId: payment.product_sale_id,
    });
    setPaymentAmount(payment.amount);
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setPaymentDialogOpen(true);
  };


  // Open contract payment dialog
  const openContractPaymentDialog = (payment: ContractPayment, contract: Contract) => {
    setSelectedContractPayment({ payment, contract });
    setContractPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setContractPaymentDialogOpen(true);
  };

  // Confirm contract payment with selected date
  const confirmContractPayment = async () => {
    if (!selectedContractPayment) return;
    
    const { payment, contract } = selectedContractPayment;
    const payments = contractPayments[contract.id] || [];
    
    await markPaymentAsPaid.mutateAsync({ paymentId: payment.id, paidDate: contractPaymentDate });
    
    // Show payment receipt prompt
    const paidPayments = payments.filter(p => p.status === 'paid').length;
    const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const newRemainingBalance = Math.max(0, contract.amount_to_receive - paidAmount - payment.amount);
    setPaymentClientPhone(contract.client_phone || null);
    setPaymentReceiptData({
      type: 'contract',
      contractId: contract.id,
      companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
      billingSignatureName: profile?.billing_signature_name || undefined,
      clientName: contract.client_name,
      installmentNumber: payment.installment_number,
      totalInstallments: contract.installments,
      amountPaid: payment.amount,
      paymentDate: contractPaymentDate,
      remainingBalance: newRemainingBalance,
      totalPaid: paidAmount + payment.amount,
    });
    setIsPaymentReceiptOpen(true);
    
    // Refresh contract payments
    const updatedPayments = await getContractPayments(contract.id);
    setContractPayments(prev => ({ ...prev, [contract.id]: updatedPayments }));
    
    // Close dialog
    setContractPaymentDialogOpen(false);
    setSelectedContractPayment(null);
  };


  // Contract handlers
  const handleCreateContract = async () => {
    if (!contractForm.client_name || !contractForm.total_amount || !contractForm.first_payment_date) return;
    
    // Build vehicle notes if it's a vehicle rental
    let finalNotes = contractForm.notes || '';
    if (contractForm.contract_type === 'aluguel_veiculo' && contractForm.vehicle_plate) {
      const vehicleInfo = `[VEÍCULO] Placa: ${contractForm.vehicle_plate} | Marca: ${contractForm.vehicle_brand || '-'} | Modelo: ${contractForm.vehicle_model || '-'} | Cor: ${contractForm.vehicle_color || '-'} | Ano: ${contractForm.vehicle_year || '-'} | KM Inicial: ${contractForm.vehicle_km_start || '-'} | KM Final: ${contractForm.vehicle_km_end || '-'} | Renavam: ${contractForm.vehicle_renavam || '-'}`;
      finalNotes = vehicleInfo + (finalNotes ? `\n\n${finalNotes}` : '');
    }
    
    const formDataWithHistorical = {
      ...contractForm,
      notes: finalNotes,
      is_historical: isContractHistorical,
      historical_paid_installments: isContractHistorical ? historicalPaidInstallments : undefined,
    };
    
    const result = await createContract.mutateAsync(formDataWithHistorical);
    
    // Create initial expenses if any were added for vehicle rental
    if (result && contractInitialExpenses.length > 0) {
      for (const expense of contractInitialExpenses) {
        if (expense.amount > 0) {
          await createExpense.mutateAsync({
            contract_id: result.id,
            amount: expense.amount,
            category: expense.category,
            description: expense.description || undefined,
            expense_date: expense.expense_date,
          });
        }
      }
    }
    
    setIsContractOpen(false);
    resetContractForm();
  };

  const openEditContractDialog = async (contract: Contract) => {
    setEditingContract(contract);
    setEditContractForm({
      client_name: contract.client_name,
      client_phone: contract.client_phone || '',
      client_cpf: contract.client_cpf || '',
      client_rg: contract.client_rg || '',
      client_email: contract.client_email || '',
      client_address: contract.client_address || '',
      contract_type: contract.contract_type,
      total_amount: contract.total_amount,
      amount_to_receive: contract.amount_to_receive,
      frequency: contract.frequency as 'monthly' | 'biweekly' | 'weekly',
      contract_date: contract.contract_date || '',
      notes: contract.notes || '',
    });
    
    // Load payments for editing
    const payments = await getContractPayments(contract.id);
    setEditingContractPayments(payments);
    setIsEditContractOpen(true);
  };

  const handleEditContract = async () => {
    if (!editingContract) return;
    await updateContract.mutateAsync({
      id: editingContract.id,
      data: editContractForm,
    });
    setIsEditContractOpen(false);
    setEditingContract(null);
    setEditingContractPayments([]);
  };

  const handleDeleteContract = async () => {
    if (!deleteContractId) return;
    await deleteContract.mutateAsync(deleteContractId);
    setDeleteContractId(null);
  };

  const toggleContractExpand = async (contractId: string) => {
    if (expandedContract === contractId) {
      setExpandedContract(null);
    } else {
      setExpandedContract(contractId);
      if (!contractPayments[contractId]) {
        const payments = await getContractPayments(contractId);
        setContractPayments(prev => ({ ...prev, [contractId]: payments }));
      }
    }
  };



  // Receipt generation functions
  const handleGenerateProductReceipt = async (sale: ProductSale) => {
    // Fetch payments directly from the database to avoid the 1000-record limit issue
    const { data: payments, error } = await supabase
      .from('product_sale_payments')
      .select('*')
      .eq('product_sale_id', sale.id)
      .order('installment_number', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar parcelas para o comprovante');
      console.error('Error fetching payments for receipt:', error);
      return;
    }

    const receiptData: ContractReceiptData = {
      type: 'product',
      contractId: sale.id,
      companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
      client: {
        name: sale.client_name,
        phone: sale.client_phone || undefined,
        cpf: sale.client_cpf || undefined,
        rg: sale.client_rg || undefined,
        email: sale.client_email || undefined,
        address: sale.client_address || undefined,
      },
      negotiation: {
        principal: sale.total_amount,
        installments: sale.installments,
        installmentValue: sale.installment_value,
        totalToReceive: sale.total_amount,
        startDate: sale.sale_date,
        downPayment: sale.down_payment || 0,
        costValue: sale.cost_value || 0,
      },
      dueDates: (payments || []).map(p => ({ date: p.due_date, isPaid: p.status === 'paid' })),
      productInfo: { name: sale.product_name, description: sale.product_description || undefined },
    };
    setReceiptPreviewData(receiptData);
    setIsReceiptPreviewOpen(true);
  };


  const handleGenerateContractReceipt = (contract: Contract) => {
    const payments = contractPayments[contract.id] || [];
    const receiptData: ContractReceiptData = {
      type: 'contract',
      contractId: contract.id,
      companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
      client: {
        name: contract.client_name,
        phone: contract.client_phone || undefined,
        cpf: contract.client_cpf || undefined,
        rg: contract.client_rg || undefined,
        email: contract.client_email || undefined,
        address: contract.client_address || undefined,
      },
      negotiation: {
        principal: contract.total_amount,
        installments: contract.installments,
        installmentValue: contract.total_amount,
        totalToReceive: contract.amount_to_receive,
        startDate: contract.first_payment_date,
      },
      dueDates: payments.map(p => ({ date: p.due_date, isPaid: p.status === 'paid' })),
    };
    setReceiptPreviewData(receiptData);
    setIsReceiptPreviewOpen(true);
  };
  const calculateInstallmentValue = (total: number, down: number, installments: number) => {
    if (installments <= 0) return 0;
    return (total - down) / installments;
  };

  const handleTotalChange = (value: number) => {
    const installmentValue = calculateInstallmentValue(value, formData.down_payment || 0, formData.installments);
    setFormData(prev => ({
      ...prev,
      total_amount: value,
      installment_value: installmentValue,
    }));
  };

  const handleDownPaymentChange = (value: number) => {
    const installmentValue = calculateInstallmentValue(formData.total_amount, value, formData.installments);
    setFormData(prev => ({
      ...prev,
      down_payment: value,
      installment_value: installmentValue,
    }));
  };

  const handleInstallmentsChange = (value: number) => {
    const installmentValue = calculateInstallmentValue(formData.total_amount, formData.down_payment || 0, value);
    setFormData(prev => ({
      ...prev,
      installments: value,
      installment_value: installmentValue,
    }));
  };

  // Helper functions - must be defined before filteredSales
  const getSalePayments = (saleId: string) => {
    return allSalePayments?.filter(p => p.product_sale_id === saleId) || [];
  };

  const getSaleStatus = (sale: ProductSale) => {
    if (sale.status === 'paid' || sale.remaining_balance <= 0) {
      return 'paid';
    }
    const payments = getSalePayments(sale.id);
    const hasOverdue = payments.some(p => 
      p.status !== 'paid' && isPast(parseISO(p.due_date)) && !isToday(parseISO(p.due_date))
    );
    if (hasOverdue) return 'overdue';
    const hasDueToday = payments.some(p => 
      p.status !== 'paid' && isToday(parseISO(p.due_date))
    );
    if (hasDueToday) return 'due_today';
    return 'pending';
  };

  // Toggle subscription card expand
  const toggleSubscriptionExpand = (id: string) => {
    setExpandedSubscriptions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Get active months count for a subscription
  const getActiveMonths = (feeId: string): number => {
    const payments = feePayments?.filter(p => p.monthly_fee_id === feeId && p.status === 'paid') || [];
    return payments.length;
  };

  // Filtered data
  const filteredSales = sales?.filter(sale => {
    const matchesSearch = 
      sale.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (salesStatusFilter === 'all') return true;
    
    const status = getSaleStatus(sale);
    if (salesStatusFilter === 'pending') return status === 'pending' || status === 'due_today';
    return status === salesStatusFilter;
  }) || [];

  // Helper to get contract status based on next pending payment
  const getContractStatus = (contract: Contract) => {
    if (contract.status === 'paid') return 'paid';
    
    const payments = allContractPayments.filter(p => p.contract_id === contract.id);
    const nextPendingPayment = payments
      .filter(p => p.status !== 'paid')
      .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime())[0];
    
    if (!nextPendingPayment) return 'paid';
    
    const paymentDate = parseISO(nextPendingPayment.due_date);
    if (isPast(paymentDate) && !isToday(paymentDate)) return 'overdue';
    if (isToday(paymentDate)) return 'due_today';
    // Check if due this month
    const now = new Date();
    if (paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear()) return 'due_this_month';
    return 'pending';
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    const isReceivable = contract.bill_type === 'receivable';
    
    if (!matchesSearch || !isReceivable) return false;
    if (contractsStatusFilter === 'all') return true;
    
    const status = getContractStatus(contract);
    if (contractsStatusFilter === 'pending') return status === 'pending' || status === 'due_today' || status === 'due_this_month';
    return status === contractsStatusFilter;
  }).sort((a, b) => {
    const statusOrder: Record<string, number> = { overdue: 0, due_today: 1, due_this_month: 2, pending: 3, paid: 4 };
    const statusA = getContractStatus(a);
    const statusB = getContractStatus(b);
    const orderA = statusOrder[statusA] ?? 2;
    const orderB = statusOrder[statusB] ?? 2;
    if (orderA !== orderB) return orderA - orderB;
    // Within same status, sort by earliest next pending payment
    const paymentsA = allContractPayments.filter(p => p.contract_id === a.id && p.status !== 'paid');
    const paymentsB = allContractPayments.filter(p => p.contract_id === b.id && p.status !== 'paid');
    const nextA = paymentsA.length > 0 ? new Date(paymentsA[0].due_date).getTime() : Infinity;
    const nextB = paymentsB.length > 0 ? new Date(paymentsB[0].due_date).getTime() : Infinity;
    return nextA - nextB;
  });

  // Contract stats
  const allContractsStats = {
    total: contracts.filter(c => c.bill_type === 'receivable').length,
    pending: contracts.filter(c => {
      const status = getContractStatus(c);
      return c.bill_type === 'receivable' && (status === 'pending' || status === 'due_today' || status === 'due_this_month');
    }).length,
    overdue: contracts.filter(c => c.bill_type === 'receivable' && getContractStatus(c) === 'overdue').length,
    paid: contracts.filter(c => c.bill_type === 'receivable' && getContractStatus(c) === 'paid').length,
  };

  const contractsStats = {
    totalContracts: filteredContracts.length,
    totalToReceive: filteredContracts.reduce((acc, c) => acc + c.amount_to_receive, 0),
    totalReceived: filteredContracts.reduce((acc, c) => {
      const payments = allContractPayments.filter(p => p.contract_id === c.id);
      return acc + payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    }, 0),
    overdueAmount: filteredContracts.reduce((acc, c) => {
      if (getContractStatus(c) !== 'overdue') return acc;
      const payments = allContractPayments.filter(p => p.contract_id === c.id);
      const overduePayments = payments.filter(p => {
        const date = parseISO(p.due_date);
        return p.status !== 'paid' && isPast(date) && !isToday(date);
      });
      return acc + overduePayments.reduce((sum, p) => sum + p.amount, 0);
    }, 0),
  };

  // Frequency label helper
  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quinzenal';
      case 'monthly': 
      default: return 'Mensal';
    }
  };

  const getCardStyles = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-primary/10 border-primary/40';
      case 'overdue':
        return 'bg-destructive/10 border-destructive/40';
      case 'due_today':
        return 'bg-yellow-500/10 border-yellow-500/40';
      case 'due_this_month':
        return 'bg-yellow-400/20 border-yellow-500/60';
      default:
        return '';
    }
  };

  const getStatusBadge = (status: string, dueDate?: string) => {
    if (status === 'paid') {
      return <Badge className="bg-primary/20 text-primary border-primary/30">Pago</Badge>;
    }
    if (dueDate) {
      const date = parseISO(dueDate);
      if (isPast(date) && !isToday(date)) {
        return <Badge variant="destructive">Atrasado</Badge>;
      }
      if (isToday(date)) {
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Vence Hoje</Badge>;
      }
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const getPixKeyTypeLabel = (type: string | null): string => {
    switch (type) {
      case 'cpf': return 'Chave PIX CPF';
      case 'cnpj': return 'Chave PIX CNPJ';
      case 'telefone': return 'Chave PIX Telefone';
      case 'email': return 'Chave PIX Email';
      case 'aleatoria': return 'Chave PIX Aleatória';
      default: return 'Chave PIX';
    }
  };

  const generateIPTVChargeMessage = (
    fee: MonthlyFee,
    currentPayment: ReturnType<typeof useMonthlyFeePayments>['payments'][number] | undefined,
    status: string,
    amountWithInterest: number
  ): string => {
    const companyName = profile?.company_name || 'Empresa';
    const signatureName = profile?.billing_signature_name || companyName;
    const dueDate = currentPayment 
      ? format(parseISO(currentPayment.due_date), 'dd/MM/yyyy') 
      : `dia ${fee.due_day}`;

    let message = `⚠️ *Atenção ${fee.client?.full_name}*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    message += `📋 *Serviço:* ${fee.description || 'IPTV'}\n\n`;

    if (status === 'overdue' && currentPayment) {
      const daysLate = Math.floor((new Date().getTime() - new Date(currentPayment.due_date).getTime()) / (1000 * 60 * 60 * 24));
      message += `🚨 *MENSALIDADE EM ATRASO*\n\n`;
      message += `💰 *Valor Original:* ${formatCurrency(fee.amount)}\n`;
      message += `📅 *Vencimento:* ${dueDate}\n`;
      message += `⏰ *Dias em atraso:* ${daysLate}\n\n`;
      
      if (amountWithInterest > fee.amount) {
        message += `⚠️ *Multa:* +${formatCurrency(amountWithInterest - fee.amount)}\n`;
        message += `💵 *TOTAL A PAGAR:* ${formatCurrency(amountWithInterest)}\n\n`;
      }
      
      message += `Por favor, regularize para continuar utilizando o serviço.\n`;
    } else if (status === 'due_today') {
      message += `⏰ *VENCE HOJE!*\n\n`;
      message += `💰 *Valor:* ${formatCurrency(fee.amount)}\n`;
      message += `📅 *Vencimento:* ${dueDate}\n\n`;
      message += `Faça o pagamento para manter seu serviço ativo.\n`;
    } else {
      message += `📅 *Vencimento:* ${dueDate}\n`;
      message += `💰 *Valor:* ${formatCurrency(fee.amount)}\n\n`;
      message += `Fique atento ao vencimento!\n`;
    }

    // Adicionar Chave PIX
    if (profile?.pix_key) {
      message += `\n━━━━━━━━━━━━━━━━\n`;
      message += `💳 *${getPixKeyTypeLabel(profile.pix_key_type)}:*\n`;
      message += `${profile.pix_key}\n`;
    }

    // Adicionar Link de Pagamento
    if (profile?.payment_link) {
      message += `\n🔗 *Link de Pagamento:*\n`;
      message += `${profile.payment_link}\n`;
    }

    // Assinatura
    message += `\n━━━━━━━━━━━━━━━━\n`;
    message += `_${signatureName}_`;

    return message;
  };

  const getContractTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      aluguel_casa: 'Aluguel de Casa',
      aluguel_kitnet: 'Aluguel de Kitnet',
      aluguel_apartamento: 'Aluguel de Apartamento',
      aluguel_sala: 'Aluguel de Sala Comercial',
      aluguel_veiculo: 'Aluguel de Veículo',
      mensalidade: 'Mensalidade',
      servico_mensal: 'Serviço Mensal',
      parcelado: 'Parcelado',
      avista: 'À Vista',
    };
    return labels[type] || type;
  };

  // Stats - using all sales for counts, not filtered
  const allSalesStats = {
    total: sales?.length || 0,
    pending: sales?.filter(s => {
      const status = getSaleStatus(s);
      return status === 'pending' || status === 'due_today';
    }).length || 0,
    overdue: sales?.filter(s => getSaleStatus(s) === 'overdue').length || 0,
    paid: sales?.filter(s => getSaleStatus(s) === 'paid').length || 0,
  };

  const salesStats = {
    totalSales: filteredSales.length,
    totalValue: filteredSales.reduce((acc, s) => acc + s.total_amount, 0),
    totalReceived: filteredSales.reduce((acc, s) => acc + (s.total_paid || 0), 0),
    pending: filteredSales.reduce((acc, s) => acc + s.remaining_balance, 0),
  };

  // Subscription helpers - busca o próximo pagamento pendente ao invés de apenas o mês atual
  const getNextPendingPayment = (feeId: string) => {
    // Buscar todos os pagamentos desta assinatura
    const feePaymentsList = feePayments.filter(p => p.monthly_fee_id === feeId);
    
    // Ordenar por due_date e pegar o primeiro pendente
    const pendingPayments = feePaymentsList
      .filter(p => p.status !== 'paid')
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    
    // Se houver pagamento pendente, retornar ele
    if (pendingPayments.length > 0) {
      return pendingPayments[0];
    }
    
    // Se não houver pendentes, verificar se há algum pago recente (para mostrar status "pago")
    const currentMonth = format(new Date(), 'yyyy-MM-01');
    const paidThisMonth = feePaymentsList.find(
      p => p.reference_month === currentMonth && p.status === 'paid'
    );
    
    return paidThisMonth || null;
  };

  const getSubscriptionStatus = (fee: MonthlyFee) => {
    if (!fee.is_active) return 'inactive';
    const payment = getNextPendingPayment(fee.id);
    if (!payment) return 'no_charge';
    if (payment.status === 'paid') return 'paid';
    if (isPast(parseISO(payment.due_date)) && !isToday(parseISO(payment.due_date))) return 'overdue';
    if (isToday(parseISO(payment.due_date))) return 'due_today';
    return 'pending';
  };

  const filteredSubscriptions = monthlyFees
    .filter(fee => {
      if (subscriptionStatusFilter === 'all') return true;
      if (subscriptionStatusFilter === 'active') return fee.is_active;
      const status = getSubscriptionStatus(fee);
      if (subscriptionStatusFilter === 'pending') return status === 'pending' || status === 'due_today';
      if (subscriptionStatusFilter === 'overdue') return status === 'overdue';
      return true;
    })
    .sort((a, b) => {
      const statusA = getSubscriptionStatus(a);
      const statusB = getSubscriptionStatus(b);
      
      // Prioridade de status: overdue > due_today > pending > paid > no_charge > inactive
      const priority: Record<string, number> = { 
        overdue: 0, 
        due_today: 1, 
        pending: 2, 
        paid: 3,
        no_charge: 4,
        inactive: 5
      };
      
      if (priority[statusA] !== priority[statusB]) {
        return priority[statusA] - priority[statusB];
      }
      
      // Dentro do mesmo status, ordenar por data de vencimento
      const paymentA = getNextPendingPayment(a.id);
      const paymentB = getNextPendingPayment(b.id);
      
      if (paymentA && paymentB) {
        return new Date(paymentA.due_date).getTime() - new Date(paymentB.due_date).getTime();
      }
      
      // Fallback: ordenar por nome do cliente
      return (a.client?.full_name || '').localeCompare(b.client?.full_name || '');
    });

  const subscriptionStats = {
    total: monthlyFees.length,
    active: monthlyFees.filter(f => f.is_active).length,
    pending: monthlyFees.filter(f => {
      const status = getSubscriptionStatus(f);
      return status === 'pending' || status === 'due_today';
    }).length,
    overdue: monthlyFees.filter(f => getSubscriptionStatus(f) === 'overdue').length,
    mrr: monthlyFees.filter(f => f.is_active).reduce((acc, f) => acc + f.amount, 0),
  };

  const handleCreateSubscription = async () => {
    if (!subscriptionForm.client_id || !subscriptionForm.amount) return;
    await createFee.mutateAsync(subscriptionForm);
    setIsSubscriptionOpen(false);
    setSubscriptionForm({
      client_id: '',
      amount: 0,
      description: 'IPTV',
      due_day: 10,
      interest_rate: 1,
      generate_current_month: true,
    });
  };

  const handleDeleteSubscription = async () => {
    if (!deleteSubscriptionId) return;
    await deleteFee.mutateAsync(deleteSubscriptionId);
    setDeleteSubscriptionId(null);
  };

  const handleMarkSubscriptionPaymentAsPaid = async () => {
    if (!selectedSubscriptionPayment) return;
    await markFeePaymentAsPaid.mutateAsync({
      paymentId: selectedSubscriptionPayment.paymentId,
      paidDate: subscriptionPaymentDate,
    });
    setSubscriptionPaymentDialogOpen(false);
    setSelectedSubscriptionPayment(null);
  };

  const openSubscriptionPaymentDialog = (paymentId: string, amount: number, feeId: string) => {
    setSelectedSubscriptionPayment({ paymentId, amount, feeId });
    setSubscriptionPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setSubscriptionPaymentDialogOpen(true);
  };

  const getClientInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const isLoading = salesLoading || contractsLoading || feesLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Vendas e Gestão Financeira</h1>
          <p className="text-sm text-muted-foreground">Gerencie vendas de produtos, contratos e assinaturas</p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="products" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-2 text-[10px] sm:text-sm">
              <ShoppingBag className="w-4 h-4" />
              <span>Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-2 text-[10px] sm:text-sm">
              <FileSignature className="w-4 h-4" />
              <span>Contratos</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-2 text-[10px] sm:text-sm">
              <Tv className="w-4 h-4" />
              <span>Assinaturas</span>
            </TabsTrigger>
          </TabsList>

          {/* PRODUTOS TAB */}
          <TabsContent value="products" className="mt-4 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{salesStats.totalSales}</p>
                      <p className="text-xs text-muted-foreground">Vendas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-500 truncate">{formatCurrency(salesStats.totalValue)}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary truncate">{formatCurrency(salesStats.totalReceived)}</p>
                      <p className="text-xs text-muted-foreground">Recebido</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-yellow-500 truncate">{formatCurrency(salesStats.pending)}</p>
                      <p className="text-xs text-muted-foreground">A Receber</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search and Create */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por produto ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Nova Venda
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Nova Venda de Produto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome do Produto *</Label>
                      <Input
                        value={formData.product_name}
                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                        placeholder="Ex: iPhone 15, Geladeira, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição do Produto</Label>
                      <Textarea
                        value={formData.product_description}
                        onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
                        placeholder="Detalhes do produto..."
                      />
                    </div>
                    {/* Client Selector */}
                    <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <Label className="text-primary font-medium">👤 Usar cliente cadastrado</Label>
                      <ClientSelector
                        onSelect={handleClientSelect}
                        selectedClientId={selectedClientId}
                        placeholder="Selecionar cliente..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Selecione um cliente para preencher os dados automaticamente, ou digite manualmente abaixo.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome do Cliente *</Label>
                        <Input
                          value={formData.client_name}
                          onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          value={formData.client_phone}
                          onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>CPF</Label>
                        <Input
                          value={formData.client_cpf}
                          onChange={(e) => setFormData({ ...formData, client_cpf: e.target.value })}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>RG</Label>
                        <Input
                          value={formData.client_rg}
                          onChange={(e) => setFormData({ ...formData, client_rg: e.target.value })}
                          placeholder="00.000.000-0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>E-mail</Label>
                        <Input
                          type="email"
                          value={formData.client_email}
                          onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Endereço</Label>
                        <Input
                          value={formData.client_address}
                          onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                          placeholder="Rua, número, bairro..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data da Venda *</Label>
                        <Input
                          type="date"
                          value={formData.sale_date}
                          onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Custo (R$)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.cost_value || ''}
                          onChange={(e) => setFormData({ ...formData, cost_value: parseFloat(e.target.value) || 0 })}
                          placeholder="Quanto você pagou"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor de Venda (R$) *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.total_amount || ''}
                          onChange={(e) => handleTotalChange(parseFloat(e.target.value) || 0)}
                          placeholder="Quanto está vendendo"
                        />
                      </div>
                      {(formData.cost_value || 0) > 0 && formData.total_amount > 0 && (
                        <div className="space-y-2">
                          <Label>Lucro Estimado</Label>
                          <div className={cn("h-10 px-3 py-2 rounded-md border flex items-center font-bold text-sm", 
                            formData.total_amount - (formData.cost_value || 0) >= 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"
                          )}>
                            {formatCurrency(formData.total_amount - (formData.cost_value || 0))}
                            <span className="ml-2 text-xs font-normal">
                              ({(formData.cost_value || 0) > 0 ? (((formData.total_amount - (formData.cost_value || 0)) / (formData.cost_value || 1)) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entrada (R$)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.down_payment || ''}
                          onChange={(e) => handleDownPaymentChange(parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nº de Parcelas *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={formData.installments === 0 ? '' : formData.installments}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            handleInstallmentsChange(val || 0);
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Frequência de Pagamento *</Label>
                        <Select 
                          value={formData.payment_frequency || 'monthly'} 
                          onValueChange={(v) => setFormData({ ...formData, payment_frequency: v as 'monthly' | 'weekly' | 'biweekly' })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="biweekly">Quinzenal</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Primeiro Vencimento *</Label>
                        <Input
                          type="date"
                          value={formData.first_due_date}
                          onChange={(e) => setFormData({ ...formData, first_due_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor da Parcela (R$)</Label>
                        <Input
                          type="number"
                          value={formData.installment_value.toFixed(2)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs">
                          {formData.payment_frequency === 'weekly' 
                            ? 'Parcelas geradas a cada 7 dias' 
                            : formData.payment_frequency === 'biweekly'
                            ? 'Parcelas geradas a cada 15 dias'
                            : 'Parcelas geradas no mesmo dia do mês'}
                        </Label>
                      </div>
                    </div>
                    {/* Historical Sale Checkbox */}
                    {hasPastInstallments && (
                      <div className="p-3 rounded-lg border border-amber-500/50 bg-amber-500/10 space-y-3">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            id="is_historical_product"
                            checked={formData.is_historical}
                            onChange={(e) => setFormData({ ...formData, is_historical: e.target.checked })}
                            className="mt-0.5 rounded border-input"
                          />
                          <div className="flex-1">
                            <label htmlFor="is_historical_product" className="text-sm font-medium cursor-pointer text-amber-600">
                              É uma venda antiga que está registrando na plataforma?
                            </label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Marque as parcelas que já foram pagas antes de registrar na plataforma
                            </p>
                          </div>
                        </div>
                        
                        {formData.is_historical && paidHistoricalCount > 0 && (
                          <div className="p-2 rounded bg-primary/10 border border-primary/30">
                            <p className="text-sm text-primary font-medium">
                              {paidHistoricalCount} parcela(s) marcada(s) como paga(s) = {formatCurrency(paidHistoricalAmount)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {installmentDates.length >= 1 && (
                      <ProductInstallmentsList
                        installmentDates={installmentDates}
                        isHistorical={formData.is_historical || false}
                        today={today}
                        updateInstallmentDate={updateInstallmentDate}
                        toggleInstallmentPaid={toggleInstallmentPaid}
                        onSelectAll={selectAllPastInstallments}
                        onDeselectAll={deselectAllInstallments}
                      />
                    )}
                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Notas adicionais..."
                      />
                    </div>
                    
                    {/* WhatsApp Notification Option */}
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-muted/30">
                      <input
                        type="checkbox"
                        id="send_creation_notification_product"
                        checked={formData.send_creation_notification}
                        onChange={(e) => setFormData({ ...formData, send_creation_notification: e.target.checked })}
                        className="mt-0.5 rounded border-input"
                      />
                      <div className="flex-1">
                        <label htmlFor="send_creation_notification_product" className="text-sm font-medium cursor-pointer">
                          Receber notificação WhatsApp deste contrato
                        </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alertas de atraso e relatórios serão enviados normalmente mesmo que você não marque essa opção
                    </p>
                      </div>
                    </div>
                    
                    {(!formData.product_name || !formData.client_name || !formData.total_amount || !formData.first_due_date) && (
                      <p className="text-xs text-destructive text-center">
                        Preencha: {!formData.product_name && 'Produto, '}{!formData.client_name && 'Cliente, '}{!formData.total_amount && 'Valor Total, '}{!formData.first_due_date && '1º Vencimento'}
                      </p>
                    )}
                    <Button
                      onClick={handleCreateSale}
                      disabled={!formData.product_name || !formData.client_name || !formData.total_amount || !formData.first_due_date || createSale.isPending}
                      className="w-full"
                    >
                      {createSale.isPending ? 'Salvando...' : 'Cadastrar Venda'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={salesStatusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSalesStatusFilter('all')}
              >
                Todos ({allSalesStats.total})
              </Button>
              <Button
                variant={salesStatusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSalesStatusFilter('pending')}
              >
                Em dia ({allSalesStats.pending})
              </Button>
              <Button
                variant={salesStatusFilter === 'overdue' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSalesStatusFilter('overdue')}
                className={salesStatusFilter === 'overdue' ? 'bg-destructive hover:bg-destructive/90' : ''}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                Em atraso ({allSalesStats.overdue})
              </Button>
              <Button
                variant={salesStatusFilter === 'paid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSalesStatusFilter('paid')}
                className={salesStatusFilter === 'paid' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
              >
                <Check className="w-3 h-3 mr-1" />
                Quitados ({allSalesStats.paid})
              </Button>
            </div>

            {/* Sales List - Grid Layout */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {filteredSales.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhuma venda encontrada</h3>
                    <p className="text-muted-foreground">Cadastre sua primeira venda de produto.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredSales.map((sale) => (
                  <ProductSaleCard
                    key={sale.id}
                    sale={sale}
                    payments={getSalePayments(sale.id)}
                    onEdit={openEditSaleDialog}
                    onDelete={(id) => setDeleteId(id)}
                    onViewInstallments={(s) => {
                      setSelectedSaleForInstallments(s);
                      setInstallmentsDialogOpen(true);
                    }}
                    onGenerateReceipt={handleGenerateProductReceipt}
                    onPayNextInstallment={(payment) => openPaymentDialog(payment)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* CONTRATOS TAB */}
          <TabsContent value="contracts" className="mt-4 space-y-4">
            {/* Dashboard Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Total</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{allContractsStats.total}</p>
                  <p className="text-xs text-muted-foreground">contratos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">A Receber</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(contractsStats.totalToReceive - contractsStats.totalReceived)}</p>
                </CardContent>
              </Card>
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    <span className="text-sm text-muted-foreground">Em Atraso</span>
                  </div>
                  <p className="text-2xl font-bold mt-1 text-destructive">{formatCurrency(contractsStats.overdueAmount)}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Recebido</span>
                  </div>
                  <p className="text-2xl font-bold mt-1 text-primary">{formatCurrency(contractsStats.totalReceived)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={contractsStatusFilter === 'all' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setContractsStatusFilter('all')}
              >
                Todos ({allContractsStats.total})
              </Button>
              <Button 
                variant={contractsStatusFilter === 'pending' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setContractsStatusFilter('pending')}
              >
                Pendentes ({allContractsStats.pending})
              </Button>
              <Button 
                variant={contractsStatusFilter === 'overdue' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setContractsStatusFilter('overdue')}
                className={contractsStatusFilter !== 'overdue' && allContractsStats.overdue > 0 ? 'text-destructive border-destructive/50' : ''}
              >
                Atrasados ({allContractsStats.overdue})
              </Button>
              <Button 
                variant={contractsStatusFilter === 'paid' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setContractsStatusFilter('paid')}
              >
                Quitados ({allContractsStats.paid})
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar por cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
                <div className="flex items-center gap-1 border rounded-lg p-0.5">
                  <Button
                    variant={contractViewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 gap-1.5"
                    onClick={() => setContractViewMode('cards')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden sm:inline">Cards</span>
                  </Button>
                  <Button
                    variant={contractViewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 gap-1.5"
                    onClick={() => setContractViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline">Lista</span>
                  </Button>
                </div>
              </div>
              <Dialog open={isContractOpen} onOpenChange={(open) => {
                setIsContractOpen(open);
                if (!open) resetContractForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" />Novo Contrato</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* ClientSelector */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Usar cliente cadastrado
                      </Label>
                      <ClientSelector
                        selectedClientId={selectedContractClientId}
                        onSelect={handleContractClientSelect}
                        placeholder="Selecione para preencher automaticamente"
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label>Cliente / Inquilino *</Label>
                      <Input placeholder="Nome do cliente" value={contractForm.client_name} onChange={(e) => setContractForm({ ...contractForm, client_name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input placeholder="(00) 00000-0000" value={contractForm.client_phone} onChange={(e) => setContractForm({ ...contractForm, client_phone: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>E-mail</Label>
                        <Input type="email" placeholder="email@exemplo.com" value={contractForm.client_email} onChange={(e) => setContractForm({ ...contractForm, client_email: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>CPF</Label>
                        <Input placeholder="000.000.000-00" value={contractForm.client_cpf} onChange={(e) => setContractForm({ ...contractForm, client_cpf: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>RG</Label>
                        <Input placeholder="00.000.000-0" value={contractForm.client_rg} onChange={(e) => setContractForm({ ...contractForm, client_rg: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Endereço</Label>
                      <Input placeholder="Rua, número, bairro, cidade..." value={contractForm.client_address} onChange={(e) => setContractForm({ ...contractForm, client_address: e.target.value })} />
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label>Tipo de contrato</Label>
                      <Select value={contractForm.contract_type} onValueChange={(value) => setContractForm({ ...contractForm, contract_type: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aluguel_casa">Aluguel de Casa</SelectItem>
                          <SelectItem value="aluguel_kitnet">Aluguel de Kitnet</SelectItem>
                          <SelectItem value="aluguel_apartamento">Aluguel de Apartamento</SelectItem>
                          <SelectItem value="aluguel_sala">Aluguel de Sala Comercial</SelectItem>
                          <SelectItem value="aluguel_veiculo">Aluguel de Veículo</SelectItem>
                          <SelectItem value="mensalidade">Mensalidade</SelectItem>
                          <SelectItem value="servico_mensal">Serviço Mensal</SelectItem>
                          <SelectItem value="parcelado">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Vehicle Rental Fields - Only shown when aluguel_veiculo is selected */}
                    {contractForm.contract_type === 'aluguel_veiculo' && (
                      <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                          <Car className="w-4 h-4" />
                          <Label className="font-medium">Dados do Veículo</Label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Placa *</Label>
                            <Input 
                              placeholder="ABC-1234" 
                              value={contractForm.vehicle_plate || ''} 
                              onChange={(e) => setContractForm({...contractForm, vehicle_plate: e.target.value.toUpperCase()})} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Marca</Label>
                            <Input 
                              placeholder="Ex: Fiat, Honda..." 
                              value={contractForm.vehicle_brand || ''} 
                              onChange={(e) => setContractForm({...contractForm, vehicle_brand: e.target.value})} 
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Modelo</Label>
                            <Input 
                              placeholder="Ex: Uno, Civic..." 
                              value={contractForm.vehicle_model || ''} 
                              onChange={(e) => setContractForm({...contractForm, vehicle_model: e.target.value})} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Cor</Label>
                            <Input 
                              placeholder="Ex: Preto, Prata..." 
                              value={contractForm.vehicle_color || ''} 
                              onChange={(e) => setContractForm({...contractForm, vehicle_color: e.target.value})} 
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>KM Inicial</Label>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              value={contractForm.vehicle_km_start || ''} 
                              onChange={(e) => setContractForm({...contractForm, vehicle_km_start: e.target.value})} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>KM Final (devolução)</Label>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              value={contractForm.vehicle_km_end || ''} 
                              onChange={(e) => setContractForm({...contractForm, vehicle_km_end: e.target.value})} 
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Ano</Label>
                            <Input 
                              type="number" 
                              placeholder="2024" 
                              value={contractForm.vehicle_year || ''} 
                              onChange={(e) => setContractForm({...contractForm, vehicle_year: e.target.value})} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Renavam</Label>
                            <Input 
                              placeholder="00000000000" 
                              value={contractForm.vehicle_renavam || ''} 
                              onChange={(e) => setContractForm({...contractForm, vehicle_renavam: e.target.value})} 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Initial Expenses for Vehicle Rental - Only shown when aluguel_veiculo is selected */}
                    {contractForm.contract_type === 'aluguel_veiculo' && (
                      <div className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                            <Receipt className="w-4 h-4" />
                            <Label className="font-medium">Gastos Iniciais (opcional)</Label>
                          </div>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm"
                            onClick={addInitialExpense}
                            className="h-7 text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Adicionar
                          </Button>
                        </div>
                        
                        {contractInitialExpenses.length > 0 && (
                          <div className="space-y-2">
                            {contractInitialExpenses.map((expense, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-background border">
                                <Select value={expense.category} onValueChange={(v) => updateInitialExpense(index, 'category', v)}>
                                  <SelectTrigger className="w-[130px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EXPENSE_CATEGORIES.map(cat => (
                                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  placeholder="Valor"
                                  className="w-24 h-8"
                                  value={expense.amount || ''}
                                  onChange={(e) => updateInitialExpense(index, 'amount', parseFloat(e.target.value) || 0)}
                                />
                                <Input 
                                  placeholder="Descrição (opcional)"
                                  className="flex-1 h-8"
                                  value={expense.description}
                                  onChange={(e) => updateInitialExpense(index, 'description', e.target.value)}
                                />
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => removeInitialExpense(index)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                            <div className="text-sm text-muted-foreground text-right">
                              Total: <span className="font-medium text-destructive">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  contractInitialExpenses.reduce((sum, e) => sum + e.amount, 0)
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {contractInitialExpenses.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Adicione gastos como seguro, IPVA, manutenção, etc. que já foram pagos para este veículo.
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label>Frequência de Pagamento *</Label>
                      <Select value={contractForm.frequency} onValueChange={(value: 'monthly' | 'biweekly' | 'weekly') => setContractForm({ ...contractForm, frequency: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="biweekly">Quinzenal</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor da parcela (R$) *</Label>
                        <Input type="number" step="0.01" min="0" value={contractForm.total_amount || ''} onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setContractForm({ ...contractForm, total_amount: value, amount_to_receive: value * contractForm.installments });
                        }} />
                      </div>
                      <div className="space-y-2">
                        <Label>Nº de parcelas</Label>
                        <Input type="number" min="1" value={contractForm.installments || ''} onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          setContractForm({ ...contractForm, installments: value, amount_to_receive: contractForm.total_amount * value });
                        }} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data do Contrato</Label>
                        <Input type="date" value={contractForm.contract_date} onChange={(e) => setContractForm({ ...contractForm, contract_date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Primeiro Vencimento *</Label>
                        <Input type="date" value={contractForm.first_payment_date} onChange={(e) => setContractForm({ ...contractForm, first_payment_date: e.target.value })} />
                      </div>
                    </div>
                    
                    {/* Historical Contract Option */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isContractHistorical}
                          onCheckedChange={(checked) => {
                            setIsContractHistorical(checked);
                            if (!checked) setHistoricalPaidInstallments([]);
                          }}
                        />
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <History className="w-4 h-4" />
                          É um contrato antigo que está registrando?
                        </Label>
                      </div>
                      
                      {isContractHistorical && contractForm.first_payment_date && (
                        <div className="mt-3 p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Marque as parcelas já pagas:</p>
                            <div className="flex gap-2">
                              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={selectAllHistoricalInstallments}>
                                Passadas
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAllHistoricalInstallments}>
                                Nenhuma
                              </Button>
                            </div>
                          </div>
                          <ScrollArea className="h-[150px]">
                            <div className="space-y-1">
                              {getContractInstallmentDates().map((inst) => (
                                <div 
                                  key={inst.number}
                                  className={cn(
                                    "flex items-center justify-between p-2 rounded-lg text-sm",
                                    historicalPaidInstallments.includes(inst.number) 
                                      ? "bg-primary/10 border border-primary/30" 
                                      : "bg-background border border-border"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="w-12 justify-center text-xs">
                                      {inst.number}ª
                                    </Badge>
                                    <span>{format(parseISO(inst.date), "dd/MM/yyyy")}</span>
                                    {inst.isPast && !historicalPaidInstallments.includes(inst.number) && (
                                      <Badge variant="destructive" className="text-xs">Passada</Badge>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant={historicalPaidInstallments.includes(inst.number) ? "default" : "outline"}
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => toggleHistoricalInstallment(inst.number)}
                                    disabled={!inst.isPast}
                                  >
                                    {historicalPaidInstallments.includes(inst.number) ? (
                                      <><Check className="w-3 h-3 mr-1" /> Paga</>
                                    ) : (
                                      "Marcar Paga"
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Textarea value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} />
                    </div>
                    <Button onClick={handleCreateContract} disabled={!contractForm.client_name || !contractForm.total_amount || !contractForm.first_payment_date || createContract.isPending} className="w-full">
                      {createContract.isPending ? 'Salvando...' : 'Cadastrar Contrato'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {filteredContracts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileSignature className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">Nenhum contrato encontrado</h3>
                  <p className="text-muted-foreground text-sm">Crie contratos de aluguel ou mensalidades</p>
                </CardContent>
              </Card>
            ) : contractViewMode === 'list' ? (
              <ContractListView
                contracts={filteredContracts}
                allContractPayments={allContractPayments}
                getContractStatus={getContractStatus}
                formatCurrency={formatCurrency}
                onOpenPaymentDialog={openContractPaymentDialog}
                onDelete={(id) => setDeleteContractId(id)}
                onEdit={openEditContractDialog}
              />
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredContracts.map((contract) => (
                  <Card key={contract.id} className={cn("transition-all", getCardStyles(getContractStatus(contract)))}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            {contract.contract_type === 'aluguel_veiculo' ? (
                              <Car className="w-5 h-5 text-primary" />
                            ) : (
                              <FileSignature className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{contract.client_name}</p>
                            <p className="text-xs text-muted-foreground">{getContractTypeLabel(contract.contract_type)}</p>
                            {contract.contract_type === 'aluguel_veiculo' && contract.notes?.includes('[VEÍCULO]') && (
                              <div className="flex items-center gap-1 text-xs text-primary font-medium mt-0.5">
                                <Car className="w-3 h-3" />
                                {contract.notes.match(/Placa: ([^\|]+)/)?.[1]?.trim() || 'Sem placa'}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 text-[10px] px-2"
                            onClick={() => handleGenerateContractReceipt(contract)}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Comprovante
                          </Button>
                          <Badge variant={contract.status === 'paid' ? 'default' : 'secondary'}>{contract.status === 'paid' ? 'Quitado' : `${contract.installments}x`}</Badge>
                        </div>
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Valor mensal</span>
                          <span className="font-bold">{formatCurrency(contract.total_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-primary/10">
                          <span className="text-sm text-muted-foreground">Total a receber</span>
                          <span className="font-bold text-primary">{formatCurrency(contract.amount_to_receive)}</span>
                        </div>
                        
                        {contract.contract_type === 'aluguel_veiculo' && (() => {
                          const payments = contractPayments[contract.id] || allContractPayments.filter(p => p.contract_id === contract.id);
                          const totalReceived = payments
                            .filter(p => p.status === 'paid')
                            .reduce((sum, p) => sum + Number(p.amount), 0);
                          const totalExpenses = getTotalExpensesByContract(contract.id);
                          const netProfit = totalReceived - totalExpenses;
                          
                          return (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="flex flex-col p-2 rounded-lg bg-destructive/10">
                                <span className="text-xs text-muted-foreground">Gastos</span>
                                <span className="font-bold text-destructive">{formatCurrency(totalExpenses)}</span>
                              </div>
                              <div className={cn(
                                "flex flex-col p-2 rounded-lg",
                                netProfit >= 0 ? "bg-green-500/10" : "bg-destructive/10"
                              )}>
                                <span className="text-xs text-muted-foreground">Lucro Líquido</span>
                                <span className={cn(
                                  "font-bold",
                                  netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
                                )}>
                                  {formatCurrency(netProfit)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      
                      {contract.status !== 'paid' && (() => {
                        const payments = contractPayments[contract.id] || allContractPayments.filter(p => p.contract_id === contract.id);
                        const nextPendingPayment = payments
                          .filter(p => p.status !== 'paid')
                          .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime())[0];
                        
                        if (!nextPendingPayment) return null;
                        
                        const paymentDate = parseISO(nextPendingPayment.due_date);
                        const isOverdue = isPast(paymentDate) && !isToday(paymentDate);
                        const isDueToday = isToday(paymentDate);
                        const isPending = !isPast(paymentDate) && !isToday(paymentDate);
                        const daysOverdue = isOverdue ? Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                        const daysUntilDue = isPending ? Math.max(1, Math.floor((paymentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
                        const paidCount = payments.filter(p => p.status === 'paid').length;
                        
                        return (
                          <div className="mb-3 space-y-2">
                            <div className={cn(
                              "p-2 rounded-lg text-sm flex items-center justify-between",
                              isOverdue && "bg-destructive/10",
                              isDueToday && "bg-yellow-500/10",
                              isPending && "bg-muted"
                            )}>
                              <div className="flex items-center gap-2">
                                {isOverdue && <AlertTriangle className="w-4 h-4 text-destructive" />}
                                {isDueToday && <Clock className="w-4 h-4 text-yellow-600" />}
                                {isPending && <Calendar className="w-4 h-4 text-muted-foreground" />}
                                <span>
                                  {nextPendingPayment.installment_number}ª parcela - {format(paymentDate, "dd/MM")}
                                  {isOverdue && <span className="text-destructive font-medium ml-1">({daysOverdue}d atraso)</span>}
                                  {isDueToday && <span className="text-yellow-600 font-medium ml-1">(Vence Hoje)</span>}
                                </span>
                              </div>
                              <span className="font-semibold">{formatCurrency(nextPendingPayment.amount)}</span>
                            </div>
                            
                            {contract.client_phone && isOverdue && (
                              <SendOverdueNotification
                                data={{
                                  clientName: contract.client_name,
                                  clientPhone: contract.client_phone,
                                  contractType: 'contract',
                                  installmentNumber: nextPendingPayment.installment_number,
                                  totalInstallments: contract.installments,
                                  amount: nextPendingPayment.amount,
                                  dueDate: nextPendingPayment.due_date,
                                  daysOverdue: daysOverdue,
                                  loanId: contract.id,
                                  paidCount: paidCount,
                                }}
                                className="w-full"
                              />
                            )}
                            {contract.client_phone && isDueToday && (
                              <SendDueTodayNotification
                                data={{
                                  clientName: contract.client_name,
                                  clientPhone: contract.client_phone,
                                  contractType: 'contract',
                                  installmentNumber: nextPendingPayment.installment_number,
                                  totalInstallments: contract.installments,
                                  amount: nextPendingPayment.amount,
                                  dueDate: nextPendingPayment.due_date,
                                  loanId: contract.id,
                                  paidCount: paidCount,
                                }}
                                className="w-full"
                              />
                            )}
                            {contract.client_phone && isPending && (
                              <SendEarlyNotification
                                data={{
                                  clientName: contract.client_name,
                                  clientPhone: contract.client_phone,
                                  contractType: 'contract',
                                  installmentNumber: nextPendingPayment.installment_number,
                                  totalInstallments: contract.installments,
                                  amount: nextPendingPayment.amount,
                                  dueDate: nextPendingPayment.due_date,
                                  daysUntilDue: daysUntilDue,
                                  loanId: contract.id,
                                  paidCount: paidCount,
                                }}
                                className="w-full"
                              />
                            )}
                          </div>
                        );
                      })()}

                      {/* Botão Pagar Parcela do Mês */}
                      {contract.status !== 'paid' && (() => {
                        const payments = contractPayments[contract.id] || allContractPayments.filter(p => p.contract_id === contract.id);
                        const nextPending = payments
                          .filter(p => p.status !== 'paid')
                          .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime())[0];
                        if (!nextPending) return null;
                        return (
                          <Button 
                            size="sm" 
                            className="w-full mb-2 gap-2"
                            onClick={() => openContractPaymentDialog(nextPending, contract)}
                          >
                            <Check className="w-4 h-4" />
                            Pagar {nextPending.installment_number}ª parcela - {format(parseISO(nextPending.due_date), "dd/MM")} ({formatCurrency(nextPending.amount)})
                          </Button>
                        );
                      })()}

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleContractExpand(contract.id)}>
                          {expandedContract === contract.id ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                          Parcelas
                        </Button>
                        {contract.contract_type === 'aluguel_veiculo' && (
                          <Button size="sm" variant="outline" onClick={() => setExpensesDialogContract(contract)}>
                            <Receipt className="w-4 h-4 mr-1" />
                            Gastos
                          </Button>
                        )}
                        <Button size="icon" variant="outline" onClick={() => openEditContractDialog(contract)}><Edit className="w-4 h-4" /></Button>
                        <Button size="icon" variant="outline" className="text-destructive" onClick={() => setDeleteContractId(contract.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                      {expandedContract === contract.id && contractPayments[contract.id] && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          {contractPayments[contract.id].map((payment) => {
                            const paymentDate = parseISO(payment.due_date);
                            const isOverdue = payment.status !== 'paid' && isPast(paymentDate) && !isToday(paymentDate);
                            const isDueToday = payment.status !== 'paid' && isToday(paymentDate);
                            const isPending = payment.status !== 'paid' && !isPast(paymentDate);
                            const daysOverdue = isOverdue ? Math.floor((new Date().getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                            const daysUntilDue = isPending ? Math.max(1, Math.floor((paymentDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
                            const paidPaymentsCount = contractPayments[contract.id].filter(p => p.status === 'paid').length;
                            
                            return (
                              <div key={payment.id} className="space-y-2">
                                <div className={cn("flex items-center justify-between p-2 rounded-lg text-sm",
                                  payment.status === 'paid' ? 'bg-primary/10 text-primary' :
                                  isOverdue ? 'bg-destructive/10 text-destructive' : 
                                  isDueToday ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' : 'bg-muted'
                                )}>
                                  <div className="flex items-center">
                                    <span className="font-medium">{payment.installment_number}ª</span>
                                    {payment.status !== 'paid' ? (
                                      <Popover 
                                        open={editingPaymentDueDateId === payment.id} 
                                        onOpenChange={(open) => {
                                          if (open) {
                                            setEditingPaymentDueDateId(payment.id);
                                            setNewPaymentDueDate(parseISO(payment.due_date));
                                          } else {
                                            setEditingPaymentDueDateId(null);
                                            setNewPaymentDueDate(undefined);
                                          }
                                        }}
                                      >
                                        <PopoverTrigger asChild>
                                          <span className="ml-2 cursor-pointer hover:underline hover:text-primary group inline-flex items-center gap-1 p-1 -m-1 rounded touch-manipulation">
                                            {format(parseISO(payment.due_date), "dd/MM/yy")}
                                            <Pencil className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                                          </span>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <div className="p-3">
                                            <p className="text-xs text-muted-foreground mb-2">
                                              Alterar vencimento da {payment.installment_number}ª parcela
                                            </p>
                                            <CalendarComponent
                                              mode="single"
                                              selected={newPaymentDueDate}
                                              onSelect={(date) => date && setNewPaymentDueDate(date)}
                                              initialFocus
                                              locale={ptBR}
                                            />
                                            <div className="flex gap-2 mt-3">
                                              <Button
                                                size="sm"
                                                className="flex-1"
                                                onClick={async () => {
                                                  if (newPaymentDueDate) {
                                                    await updatePaymentDueDate.mutateAsync({
                                                      paymentId: payment.id,
                                                      newDueDate: format(newPaymentDueDate, 'yyyy-MM-dd')
                                                    });
                                                    setEditingPaymentDueDateId(null);
                                                    const updatedPayments = await getContractPayments(contract.id);
                                                    setContractPayments(prev => ({ ...prev, [contract.id]: updatedPayments }));
                                                  }
                                                }}
                                              >
                                                Salvar
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setEditingPaymentDueDateId(null)}
                                              >
                                                Cancelar
                                              </Button>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    ) : (
                                      <span className="ml-2">{format(parseISO(payment.due_date), "dd/MM/yy")}</span>
                                    )}
                                    {isOverdue && (
                                      <Badge variant="destructive" className="ml-2 text-[10px] h-5">
                                        {daysOverdue}d atraso
                                      </Badge>
                                    )}
                                    {isDueToday && (
                                      <Badge className="ml-2 text-[10px] h-5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                                        Vence Hoje
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                                    {payment.status !== 'paid' ? (
                                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openContractPaymentDialog(payment, contract)}>
                                        <Check className="w-3 h-3" />
                                      </Button>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        {payment.paid_date && (
                                          <span className="text-[10px] text-muted-foreground">
                                            {format(parseISO(payment.paid_date), "dd/MM")}
                                          </span>
                                        )}
                                        <Check className="w-4 h-4 text-primary" />
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={async () => {
                                            await revertPayment.mutateAsync(payment.id);
                                            const updatedPayments = await getContractPayments(contract.id);
                                            setContractPayments(prev => ({ ...prev, [contract.id]: updatedPayments }));
                                          }}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {payment.status !== 'paid' && contract.client_phone && (
                                  <div className="pl-2">
                                    {isOverdue && (
                                      <SendOverdueNotification
                                        data={{
                                          clientName: contract.client_name,
                                          clientPhone: contract.client_phone,
                                          contractType: 'contract',
                                          installmentNumber: payment.installment_number,
                                          totalInstallments: contract.installments,
                                          amount: payment.amount,
                                          dueDate: payment.due_date,
                                          daysOverdue: daysOverdue,
                                          loanId: contract.id,
                                          paidCount: paidPaymentsCount,
                                        }}
                                        className="w-full"
                                      />
                                    )}
                                    {isDueToday && (
                                      <SendDueTodayNotification
                                        data={{
                                          clientName: contract.client_name,
                                          clientPhone: contract.client_phone,
                                          contractType: 'contract',
                                          installmentNumber: payment.installment_number,
                                          totalInstallments: contract.installments,
                                          amount: payment.amount,
                                          dueDate: payment.due_date,
                                          loanId: contract.id,
                                          paidCount: paidPaymentsCount,
                                        }}
                                        className="w-full"
                                      />
                                    )}
                                    {isPending && (
                                      <SendEarlyNotification
                                        data={{
                                          clientName: contract.client_name,
                                          clientPhone: contract.client_phone,
                                          contractType: 'contract',
                                          installmentNumber: payment.installment_number,
                                          totalInstallments: contract.installments,
                                          amount: payment.amount,
                                          dueDate: payment.due_date,
                                          daysUntilDue: daysUntilDue,
                                          loanId: contract.id,
                                          paidCount: paidPaymentsCount,
                                        }}
                                        className="w-full"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ASSINATURAS TAB */}
          <TabsContent value="subscriptions" className="mt-4 space-y-4">
            {/* IPTV Dashboard */}
            <IPTVDashboard fees={monthlyFees} payments={feePayments} serverCost={profile?.iptv_server_cost || 0} />

            {/* Search and Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar assinatura..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-9" 
                />
              </div>
              <div className="flex gap-2">
                <IPTVServerConfig />
                <IPTVPlanManager />
                <Button className="gap-2" onClick={() => setIsSubscriptionOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Nova Assinatura
                </Button>
              </div>
            </div>

            {/* IPTV Subscription Form */}
            <IPTVSubscriptionForm
              isOpen={isSubscriptionOpen}
              onOpenChange={setIsSubscriptionOpen}
              clients={clients || []}
              onSubmit={async (data) => {
                await createFee.mutateAsync(data);
                setIsSubscriptionOpen(false);
              }}
              isPending={createFee.isPending}
            />

            {/* Status Filters + View Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={subscriptionStatusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSubscriptionStatusFilter('all')}
                >
                  Todas ({subscriptionStats.total})
                </Button>
                <Button
                  variant={subscriptionStatusFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSubscriptionStatusFilter('active')}
                >
                  Ativas ({subscriptionStats.active})
                </Button>
                <Button
                  variant={subscriptionStatusFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSubscriptionStatusFilter('pending')}
                >
                  Pendentes ({subscriptionStats.pending})
                </Button>
                <Button
                  variant={subscriptionStatusFilter === 'overdue' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSubscriptionStatusFilter('overdue')}
                  className={subscriptionStatusFilter === 'overdue' ? 'bg-destructive hover:bg-destructive/90' : ''}
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Atrasados ({subscriptionStats.overdue})
                </Button>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 border rounded-lg p-0.5">
                <Button
                  variant={subscriptionViewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setSubscriptionViewMode('cards')}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Cards</span>
                </Button>
                <Button
                  variant={subscriptionViewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setSubscriptionViewMode('list')}
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">Lista</span>
                </Button>
              </div>
            </div>

            {/* Subscriptions List/Cards View */}
            {subscriptionViewMode === 'list' ? (
              <IPTVSubscriptionListView
                subscriptions={filteredSubscriptions}
                payments={feePayments}
                getSubscriptionStatus={getSubscriptionStatus}
                getNextPendingPayment={getNextPendingPayment}
                calculateWithInterest={calculateWithInterest}
                onToggleActive={(id, isActive) => toggleActive.mutate({ id, is_active: isActive })}
                onDelete={(id) => setDeleteSubscriptionId(id)}
                onOpenPaymentDialog={openSubscriptionPaymentDialog}
                onOpenHistory={(fee) => setHistoryDialogFee(fee)}
                formatCurrency={formatCurrency}
              />
            ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {filteredSubscriptions.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center">
                    <Tv className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhuma assinatura encontrada</h3>
                    <p className="text-muted-foreground">Cadastre sua primeira assinatura IPTV ou mensalidade.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredSubscriptions.map((fee) => {
                  const status = getSubscriptionStatus(fee);
                  const currentPayment = getNextPendingPayment(fee.id);
                  const amountWithInterest = currentPayment && fee.interest_rate 
                    ? calculateWithInterest(currentPayment, fee.interest_rate)
                    : currentPayment?.amount || fee.amount;

                  return (
                    <Card 
                      key={fee.id}
                      className={cn(
                        "transition-all hover:shadow-md relative overflow-hidden",
                        !fee.is_active && "opacity-60",
                        status === 'overdue' && "bg-destructive/10 border-destructive/50",
                        status === 'due_today' && "bg-yellow-500/10 border-yellow-500/50",
                        status === 'paid' && "bg-green-500/10 border-green-500/40",
                        status === 'pending' && "bg-muted/20"
                      )}
                      style={fee.card_color ? { borderWidth: '2px', borderColor: fee.card_color } : undefined}
                    >
                      {/* Alert Icons */}
                      {status === 'overdue' && (
                        <div className="absolute -top-2 -right-2 animate-pulse z-10">
                          <div className="bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-lg">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                      {status === 'due_today' && (
                        <div className="absolute -top-2 -right-2 animate-pulse z-10">
                          <div className="bg-yellow-500 text-white rounded-full p-1.5 shadow-lg">
                            <Clock className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                      {status === 'paid' && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <div className="bg-green-500 text-white rounded-full p-1.5 shadow-lg">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                      <CardContent className="p-4 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-purple-500/20 text-purple-500 text-sm font-medium">
                                {fee.client ? getClientInitials(fee.client.full_name) : '??'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold">{fee.client?.full_name || 'Cliente'}</h3>
                              <p className="text-sm text-muted-foreground">{fee.description || 'Assinatura'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={fee.is_active ? "default" : "secondary"} className={fee.is_active ? "bg-primary/20 text-primary border-primary/30" : ""}>
                              {fee.is_active ? 'Ativa' : 'Inativa'}
                            </Badge>
                            {status === 'overdue' && <Badge variant="destructive">Atrasado</Badge>}
                            {status === 'due_today' && <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Vence Hoje</Badge>}
                            {status === 'paid' && <Badge className="bg-primary/20 text-primary border-primary/30">Pago</Badge>}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => toggleSubscriptionExpand(fee.id)}
                            >
                              {expandedSubscriptions[fee.id] ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Expandable Client Details */}
                        <Collapsible open={expandedSubscriptions[fee.id]}>
                          <CollapsibleContent>
                            <div className="p-3 rounded-lg bg-muted/30 border space-y-3">
                              <div className="flex items-center gap-2 text-sm">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Cliente:</span>
                                <span className="font-medium">{fee.client?.full_name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Telefone:</span>
                                <span className="font-medium">
                                  {fee.client?.phone 
                                    ? fee.client.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
                                    : 'Não cadastrado'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Meses ativos:</span>
                                <Badge variant="outline" className="text-xs">
                                  {getActiveMonths(fee.id)} {getActiveMonths(fee.id) === 1 ? 'mês' : 'meses'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Desde:</span>
                                <span className="font-medium">
                                  {format(parseISO(fee.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                                </span>
                              </div>
                              
                              {/* Server Info */}
                              {fee.iptv_server_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Server className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Servidor:</span>
                                  <span className="font-medium">{fee.iptv_server_name}</span>
                                  {fee.iptv_server_url && (
                                    <a 
                                      href={fee.iptv_server_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline flex items-center gap-1 text-xs"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      abrir painel
                                    </a>
                                  )}
                                </div>
                              )}
                              
                              <Separator className="my-2" />
                              
                              {/* Ações de Gerenciamento */}
                              <div className="flex flex-wrap gap-2">
                                {/* Botão Editar Data de Vencimento */}
                                {currentPayment && currentPayment.status !== 'paid' && (
                                  <Popover
                                    open={editingSubscriptionDueDateId === currentPayment.id}
                                    onOpenChange={(open) => {
                                      if (open) {
                                        setEditingSubscriptionDueDateId(currentPayment.id);
                                        setNewSubscriptionDueDate(parseISO(currentPayment.due_date));
                                      } else {
                                        setEditingSubscriptionDueDateId(null);
                                      }
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                                        <Calendar className="w-3 h-3" />
                                        Alterar Vencimento
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-3">
                                      <CalendarComponent
                                        mode="single"
                                        selected={newSubscriptionDueDate}
                                        onSelect={setNewSubscriptionDueDate}
                                        locale={ptBR}
                                      />
                                      <div className="flex gap-2 mt-2">
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            if (newSubscriptionDueDate && currentPayment) {
                                              await updateFeePayment.mutateAsync({
                                                paymentId: currentPayment.id,
                                                data: { due_date: format(newSubscriptionDueDate, 'yyyy-MM-dd') }
                                              });
                                              setEditingSubscriptionDueDateId(null);
                                            }
                                          }}
                                        >
                                          Salvar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setEditingSubscriptionDueDateId(null)}
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                                
                                {/* Botão Ver Histórico */}
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 gap-1 text-xs"
                                  onClick={() => setHistoryDialogFee(fee)}
                                >
                                  <History className="w-3 h-3" />
                                  Histórico
                                </Button>
                                
                                {/* Botão Editar Assinatura */}
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 gap-1 text-xs"
                                  onClick={() => {
                                    setEditingSubscriptionId(fee.id);
                                    setEditSubscriptionForm({
                                      amount: fee.amount,
                                      description: fee.description || 'IPTV',
                                      interest_rate: fee.interest_rate || 0,
                                      due_day: fee.due_day,
                                      iptv_server_name: fee.iptv_server_name || '',
                                      iptv_server_url: fee.iptv_server_url || '',
                                    });
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                  Editar Valor
                                </Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Info Grid */}
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Mensalidade</p>
                            <p className="font-bold text-primary">{formatCurrency(fee.amount)}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Vencimento</p>
                            <p className="font-semibold">
                              {currentPayment 
                                ? format(parseISO(currentPayment.due_date), 'dd/MM') 
                                : `Dia ${fee.due_day}`}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Multa/mês</p>
                            <p className={cn(
                              "font-semibold",
                              (fee.interest_rate || 0) === 0 && "text-muted-foreground"
                            )}>
                              {(fee.interest_rate || 0) === 0 ? 'Sem multa' : `${(fee.interest_rate || 0).toFixed(1)}%`}
                            </p>
                          </div>
                        </div>

                        {/* Current Month Status */}
                        {currentPayment && status !== 'paid' && (
                          <div className={cn(
                            "p-3 rounded-lg border",
                            status === 'overdue' ? "bg-destructive/10 border-destructive/30" : "bg-muted/30 border-border"
                          )}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {format(parseISO(currentPayment.reference_month), 'MMMM/yyyy', { locale: ptBR })}
                                </p>
                                <p className="font-semibold">
                                  Vence {format(parseISO(currentPayment.due_date), 'dd/MM')}
                                  {status === 'overdue' && (
                                    <span className="text-destructive ml-2">
                                      ({Math.floor((new Date().getTime() - new Date(currentPayment.due_date).getTime()) / (1000 * 60 * 60 * 24))} dias)
                                    </span>
                                  )}
                                </p>
                                {status === 'overdue' && amountWithInterest > currentPayment.amount && (
                                  <p className="text-xs text-destructive mt-1">
                                    Com juros: {formatCurrency(amountWithInterest)}
                                  </p>
                                )}
                              </div>
                              <Button 
                                size="sm" 
                                className="gap-1"
                                onClick={() => openSubscriptionPaymentDialog(currentPayment.id, amountWithInterest, fee.id)}
                              >
                                <Check className="w-3 h-3" />
                                Pagar
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs gap-1"
                              onClick={() => setHistoryDialogFee(fee)}
                            >
                              <History className="w-3 h-3" />
                              Histórico
                            </Button>
                            {fee.client?.phone && (
                              <>
                                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" asChild>
                                  <a href={`https://wa.me/55${fee.client.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="w-3 h-3" />
                                    WhatsApp
                                  </a>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs gap-1"
                                  disabled={!profile?.whatsapp_instance_id || isSendingCharge[fee.id] || status === 'paid'}
                                  onClick={() => {
                                    const phoneDigits = fee.client?.phone?.replace(/\D/g, '') || '';
                                    if (!user?.id) return;
                                    if (!phoneDigits || phoneDigits.length < 10) {
                                      toast.error('Telefone do cliente inválido. Cadastre o número com DDD.');
                                      return;
                                    }
                                    
                                    // Gerar mensagem e abrir preview
                                    const message = generateIPTVChargeMessage(fee, currentPayment, status, amountWithInterest);
                                    setChargePreviewData({
                                      feeId: fee.id,
                                      clientName: fee.client?.full_name || 'Cliente',
                                      clientPhone: phoneDigits,
                                      message,
                                    });
                                    setShowChargePreview(true);
                                  }}
                                >
                                  {isSendingCharge[fee.id] ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Bell className="w-3 h-3" />
                                  )}
                                  Cobrar
                                </Button>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={fee.is_active}
                                onCheckedChange={(checked) => toggleActive.mutate({ id: fee.id, is_active: checked })}
                              />
                              <span className="text-xs text-muted-foreground">{fee.is_active ? 'Ativa' : 'Inativa'}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteSubscriptionId(fee.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Sale Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditingSale(null);
            setEditingPayments([]);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Venda</DialogTitle></DialogHeader>
            {editingSale && (
              <div className="space-y-6">
                {/* Product Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="w-4 h-4" /> Dados do Produto
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Produto</Label>
                      <Input value={editingSale.product_name} onChange={(e) => setEditingSale({ ...editingSale, product_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input value={editingSale.product_description || ''} onChange={(e) => setEditingSale({ ...editingSale, product_description: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Financial Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4" /> Valores
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Custo (R$)</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        value={editingSale.cost_value || ''} 
                        onChange={(e) => setEditingSale({ ...editingSale, cost_value: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Venda (R$)</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        value={editingSale.total_amount || ''} 
                        onChange={(e) => setEditingSale({ ...editingSale, total_amount: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Entrada (R$)</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        value={editingSale.down_payment || ''} 
                        onChange={(e) => setEditingSale({ ...editingSale, down_payment: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Parcela (R$)</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        value={editingSale.installment_value || ''} 
                        onChange={(e) => setEditingSale({ ...editingSale, installment_value: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                  </div>
                </div>

                {/* Client Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" /> Dados do Cliente
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={editingSale.client_name} onChange={(e) => setEditingSale({ ...editingSale, client_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input value={editingSale.client_phone || ''} onChange={(e) => setEditingSale({ ...editingSale, client_phone: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input value={editingSale.client_cpf || ''} onChange={(e) => setEditingSale({ ...editingSale, client_cpf: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>RG</Label>
                      <Input value={editingSale.client_rg || ''} onChange={(e) => setEditingSale({ ...editingSale, client_rg: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={editingSale.client_email || ''} onChange={(e) => setEditingSale({ ...editingSale, client_email: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Endereço</Label>
                      <Input value={editingSale.client_address || ''} onChange={(e) => setEditingSale({ ...editingSale, client_address: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Installments */}
                {editingPayments.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" /> Parcelas ({editingPayments.length})
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="bg-primary/10 text-primary">
                          {editingPayments.filter(p => p.isPaid).length} pagas
                        </Badge>
                        <Badge variant="outline">
                          {editingPayments.filter(p => !p.isPaid).length} pendentes
                        </Badge>
                      </div>
                    </div>
                    <ScrollArea className="h-[200px] rounded-md border p-3">
                      <div className="space-y-2">
                        {editingPayments.map((inst, index) => (
                          <div
                            key={inst.number}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-lg transition-colors",
                              inst.isPaid ? "bg-primary/10 border border-primary/30" : "bg-background border border-border"
                            )}
                          >
                            <Badge variant="outline" className={cn(
                              "w-12 justify-center text-xs shrink-0",
                              inst.isPaid && "bg-primary text-primary-foreground border-primary"
                            )}>
                              {inst.number}ª
                            </Badge>
                            <Input
                              type="date"
                              value={inst.date}
                              onChange={(e) => updateEditingPaymentDate(index, e.target.value)}
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={inst.amount || editingSale.installment_value || ''}
                              onChange={(e) => updateEditingPaymentAmount(index, parseFloat(e.target.value) || 0)}
                              className="w-28"
                              placeholder="Valor"
                            />
                            <Button
                              type="button"
                              variant={inst.isPaid ? "default" : "outline"}
                              size="sm"
                              className="h-8 text-xs shrink-0"
                              onClick={() => toggleEditingPaymentPaid(index)}
                            >
                              {inst.isPaid ? (
                                <><Check className="w-3 h-3 mr-1" /> Paga</>
                              ) : (
                                "Pendente"
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={editingSale.notes || ''} onChange={(e) => setEditingSale({ ...editingSale, notes: e.target.value })} />
                </div>

                <Button onClick={handleEditSale} disabled={updateSaleWithPayments.isPending} className="w-full">
                  {updateSaleWithPayments.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Contract Dialog */}
        <Dialog open={isEditContractOpen} onOpenChange={setIsEditContractOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Contrato</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input value={editContractForm.client_name} onChange={(e) => setEditContractForm({ ...editContractForm, client_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={editContractForm.client_phone || ''} onChange={(e) => setEditContractForm({ ...editContractForm, client_phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={editContractForm.client_email || ''} onChange={(e) => setEditContractForm({ ...editContractForm, client_email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={editContractForm.client_cpf || ''} onChange={(e) => setEditContractForm({ ...editContractForm, client_cpf: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input value={editContractForm.client_rg || ''} onChange={(e) => setEditContractForm({ ...editContractForm, client_rg: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={editContractForm.client_address || ''} onChange={(e) => setEditContractForm({ ...editContractForm, client_address: e.target.value })} />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor da Parcela (R$)</Label>
                  <Input type="number" step="0.01" value={editContractForm.total_amount || ''} onChange={(e) => setEditContractForm({ ...editContractForm, total_amount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Data do Contrato</Label>
                  <Input type="date" value={editContractForm.contract_date || ''} onChange={(e) => setEditContractForm({ ...editContractForm, contract_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={editContractForm.notes || ''} onChange={(e) => setEditContractForm({ ...editContractForm, notes: e.target.value })} />
              </div>
              
              {/* Parcelas do contrato */}
              {editingContractPayments.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Parcelas ({editingContractPayments.length})
                  </Label>
                  <ScrollArea className="h-[150px] rounded-md border p-3">
                    <div className="space-y-2">
                      {editingContractPayments.map((payment) => (
                        <div key={payment.id} className={cn(
                          "flex items-center justify-between p-2 rounded-lg text-sm",
                          payment.status === 'paid' ? "bg-primary/10" : "bg-muted"
                        )}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-10 justify-center text-xs">{payment.installment_number}ª</Badge>
                            <span>{format(parseISO(payment.due_date), "dd/MM/yyyy")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(payment.amount)}</span>
                            {payment.status === 'paid' && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              <Button onClick={handleEditContract} disabled={updateContract.isPending} className="w-full">{updateContract.isPending ? 'Salvando...' : 'Salvar Alterações'}</Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* Payment Registration Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) {
            setSelectedPayment(null);
            setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
          }
        }}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
            {selectedPayment && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Parcela</p>
                  <p className="font-semibold">{selectedPayment.installmentNumber}ª parcela</p>
                  <p className="text-sm text-muted-foreground mt-2">Valor combinado</p>
                  <p className="font-semibold text-primary">{formatCurrency(selectedPayment.amount)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Valor Pago (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={paymentAmount || ''} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} placeholder="0,00" />
                </div>
                
                {/* Underpayment Warning */}
                {paymentAmount > 0 && paymentAmount < selectedPayment.amount && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-start gap-2 text-amber-600 text-sm">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Valor menor que o combinado</p>
                        <p className="mt-1 text-amber-600/80">
                          Será criada uma nova parcela de <strong>{formatCurrency(selectedPayment.amount - paymentAmount)}</strong> para o valor restante.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Overpayment Notice */}
                {paymentAmount > selectedPayment.amount && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <div className="flex items-start gap-2 text-primary text-sm">
                      <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Valor maior que o combinado</p>
                        <p className="mt-1 text-primary/80">
                          O excedente de <strong>{formatCurrency(paymentAmount - selectedPayment.amount)}</strong> será abatido do saldo total da venda.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Data do Pagamento</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Quando o cliente efetivamente pagou</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setPaymentDialogOpen(false); setSelectedPayment(null); setPaymentDate(format(new Date(), 'yyyy-MM-dd')); }}>Cancelar</Button>
                  <Button className="flex-1 gap-2" onClick={() => handleMarkSalePaymentAsPaid(selectedPayment.id)} disabled={markAsPaidFlexible.isPending || paymentAmount <= 0}>
                    <Check className="w-4 h-4" />
                    {markAsPaidFlexible.isPending ? 'Salvando...' : 'Confirmar'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmations */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Venda</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSale} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteContractId} onOpenChange={() => setDeleteContractId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContract} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {/* Receipt Preview Dialog */}
        <ReceiptPreviewDialog 
          open={isReceiptPreviewOpen} 
          onOpenChange={setIsReceiptPreviewOpen} 
          data={receiptPreviewData}
          clientPhone={receiptPreviewData?.client?.phone || undefined}
        />

        {/* Payment Receipt Prompt */}
        <PaymentReceiptPrompt 
          open={isPaymentReceiptOpen} 
          onOpenChange={setIsPaymentReceiptOpen} 
          data={paymentReceiptData}
          clientPhone={paymentClientPhone || undefined}
        />


        {/* Product Installments Dialog */}
        <ProductInstallmentsDialog
          open={installmentsDialogOpen}
          onOpenChange={setInstallmentsDialogOpen}
          sale={selectedSaleForInstallments}
          payments={selectedSaleForInstallments ? getSalePayments(selectedSaleForInstallments.id) : []}
          onPaymentClick={(payment) => {
            setInstallmentsDialogOpen(false);
            openPaymentDialog(payment);
          }}
          isPending={markSalePaymentAsPaid.isPending}
        />

        {/* Sale Created Receipt Prompt */}
        <SaleCreatedReceiptPrompt
          open={isSaleReceiptPromptOpen}
          onOpenChange={setIsSaleReceiptPromptOpen}
          sale={newCreatedSale}
          companyName={profile?.company_name || profile?.full_name || 'CobraFácil'}
          userPhone={profile?.phone || undefined}
          installmentDates={newSaleInstallmentDates}
        />

        {/* Contract Payment Date Dialog */}
        <Dialog open={contractPaymentDialogOpen} onOpenChange={(open) => {
          setContractPaymentDialogOpen(open);
          if (!open) setSelectedContractPayment(null);
        }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
            </DialogHeader>
            {selectedContractPayment && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Parcela:</span>
                    <span className="font-medium">{selectedContractPayment.payment.installment_number}ª de {selectedContractPayment.contract.installments}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-semibold text-primary">{formatCurrency(selectedContractPayment.payment.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vencimento:</span>
                    <span>{format(parseISO(selectedContractPayment.payment.due_date), "dd/MM/yyyy")}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contractPaymentDate">Data do Pagamento</Label>
                  <Input
                    id="contractPaymentDate"
                    type="date"
                    value={contractPaymentDate}
                    onChange={(e) => setContractPaymentDate(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setContractPaymentDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={confirmContractPayment} disabled={markPaymentAsPaid.isPending}>
                    {markPaymentAsPaid.isPending ? 'Salvando...' : 'Confirmar Pagamento'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Subscription Delete Confirmation */}
        <AlertDialog open={!!deleteSubscriptionId} onOpenChange={() => setDeleteSubscriptionId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Assinatura</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta assinatura? Todas as cobranças relacionadas também serão excluídas. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSubscription} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Subscription Payment Dialog */}
        <Dialog open={subscriptionPaymentDialogOpen} onOpenChange={(open) => {
          setSubscriptionPaymentDialogOpen(open);
          if (!open) setSelectedSubscriptionPayment(null);
        }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
            </DialogHeader>
            {selectedSubscriptionPayment && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-semibold text-primary">{formatCurrency(selectedSubscriptionPayment.amount)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscriptionPaymentDate">Data do Pagamento</Label>
                  <Input
                    id="subscriptionPaymentDate"
                    type="date"
                    value={subscriptionPaymentDate}
                    onChange={(e) => setSubscriptionPaymentDate(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSubscriptionPaymentDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleMarkSubscriptionPaymentAsPaid} disabled={markFeePaymentAsPaid.isPending}>
                    {markFeePaymentAsPaid.isPending ? 'Salvando...' : 'Confirmar Pagamento'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* IPTV Charge Preview Dialog */}
        <MessagePreviewDialog
          open={showChargePreview}
          onOpenChange={setShowChargePreview}
          simpleMessage={chargePreviewData?.message || ''}
          completeMessage={chargePreviewData?.message || ''}
          recipientName={chargePreviewData?.clientName || 'Cliente'}
          recipientType="client"
          onConfirm={async (editedMessage) => {
            if (!chargePreviewData || !user?.id) return;
            
            setIsSendingCharge(prev => ({ ...prev, [chargePreviewData.feeId]: true }));
            
            try {
              const { error } = await supabase.functions.invoke('send-whatsapp-to-client', {
                body: {
                  userId: user.id,
                  clientPhone: chargePreviewData.clientPhone,
                  message: editedMessage,
                },
              });

              if (error) throw error;
              toast.success('Cobrança enviada com sucesso!');
              setShowChargePreview(false);
            } catch (error: any) {
              console.error('Error sending charge:', error);
              toast.error(error?.message || 'Erro ao enviar cobrança');
            } finally {
              setIsSendingCharge(prev => ({ ...prev, [chargePreviewData.feeId]: false }));
            }
          }}
          isSending={chargePreviewData ? isSendingCharge[chargePreviewData.feeId] : false}
        />

        {/* Subscription History Dialog */}
        <Dialog open={!!historyDialogFee} onOpenChange={(open) => !open && setHistoryDialogFee(null)}>
          <DialogContent className="max-w-md max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Histórico de Pagamentos</DialogTitle>
              <DialogDescription>
                {historyDialogFee?.client?.full_name} - {historyDialogFee?.description}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {feePayments
                  .filter(p => p.monthly_fee_id === historyDialogFee?.id)
                  .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
                  .map(payment => (
                    <div 
                      key={payment.id}
                      className={cn(
                        "p-3 rounded-lg border flex items-center justify-between",
                        payment.status === 'paid' && "bg-green-500/10 border-green-500/30",
                        payment.status !== 'paid' && isPast(parseISO(payment.due_date)) && "bg-destructive/10 border-destructive/30"
                      )}
                    >
                      <div>
                        <p className="font-medium">
                          {format(parseISO(payment.reference_month), 'MMMM/yyyy', { locale: ptBR })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Venc: {format(parseISO(payment.due_date), 'dd/MM/yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                        <Badge 
                          variant={payment.status === 'paid' ? 'default' : 'destructive'}
                          className={payment.status === 'paid' ? 'bg-green-500' : ''}
                        >
                          {payment.status === 'paid' ? 'Pago' : 'Pendente'}
                        </Badge>
                        {payment.payment_date && (
                          <p className="text-xs text-muted-foreground">
                            Pago em {format(parseISO(payment.payment_date), 'dd/MM')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                {feePayments.filter(p => p.monthly_fee_id === historyDialogFee?.id).length === 0 && (
                  <p className="text-center text-muted-foreground py-4">Nenhum pagamento registrado.</p>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Dialog */}
        <Dialog 
          open={!!editingSubscriptionId} 
          onOpenChange={(open) => {
            if (!open) {
              setEditingSubscriptionId(null);
              setEditSubscriptionNewDueDate(undefined);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Assinatura</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={editSubscriptionForm.description}
                  onChange={(e) => setEditSubscriptionForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: IPTV Premium"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Valor Mensal (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editSubscriptionForm.amount || ''}
                  onChange={(e) => setEditSubscriptionForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Alterar Data de Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="w-4 h-4 mr-2" />
                      {editSubscriptionNewDueDate 
                        ? format(editSubscriptionNewDueDate, 'dd/MM/yyyy', { locale: ptBR })
                        : `Dia ${editSubscriptionForm.due_day} de cada mês`
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editSubscriptionNewDueDate}
                      onSelect={setEditSubscriptionNewDueDate}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  {editSubscriptionNewDueDate 
                    ? `A cobrança atual será movida para ${format(editSubscriptionNewDueDate, 'dd/MM/yyyy', { locale: ptBR })} e renovações futuras seguirão o dia ${Math.min(getDate(editSubscriptionNewDueDate), 28)}.`
                    : 'Selecione uma nova data para alterar o vencimento da cobrança atual e futuras renovações.'
                  }
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Taxa de Multa (%)
                  {editSubscriptionForm.interest_rate === 0 && (
                    <Badge variant="outline" className="text-xs">Sem multa</Badge>
                  )}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editSubscriptionForm.interest_rate || ''}
                  onChange={(e) => setEditSubscriptionForm(prev => ({ ...prev, interest_rate: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.0 = sem multa"
                />
              </div>
              
              {/* Server Info */}
              <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Servidor IPTV
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Servidor</Label>
                    <Input
                      value={editSubscriptionForm.iptv_server_name}
                      onChange={(e) => setEditSubscriptionForm(prev => ({ ...prev, iptv_server_name: e.target.value }))}
                      placeholder="Ex: MegaTV, IPTVBrasil..."
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Link do Painel</Label>
                    <div className="flex gap-1">
                      <Input
                        value={editSubscriptionForm.iptv_server_url}
                        onChange={(e) => setEditSubscriptionForm(prev => ({ ...prev, iptv_server_url: e.target.value }))}
                        placeholder="https://painel.servidor.com"
                        className="h-9"
                      />
                      {editSubscriptionForm.iptv_server_url && (
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild>
                          <a href={editSubscriptionForm.iptv_server_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setEditingSubscriptionId(null);
                setEditSubscriptionNewDueDate(undefined);
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={async () => {
                  if (editingSubscriptionId) {
                    // Calcular novo due_day a partir da data selecionada
                    let newDueDay = editSubscriptionForm.due_day;
                    if (editSubscriptionNewDueDate) {
                      newDueDay = Math.min(getDate(editSubscriptionNewDueDate), 28);
                    }
                    
                    // Atualizar a assinatura (due_day)
                    await updateFee.mutateAsync({
                      id: editingSubscriptionId,
                      data: { ...editSubscriptionForm, due_day: newDueDay },
                    });
                    
                    // Se uma nova data foi selecionada, atualizar o pagamento pendente
                    if (editSubscriptionNewDueDate) {
                      const pendingPayment = getNextPendingPayment(editingSubscriptionId);
                      if (pendingPayment && pendingPayment.status !== 'paid') {
                        await updateFeePayment.mutateAsync({
                          paymentId: pendingPayment.id,
                          data: { due_date: format(editSubscriptionNewDueDate, 'yyyy-MM-dd') }
                        });
                      }
                    }
                    
                    setEditingSubscriptionId(null);
                    setEditSubscriptionNewDueDate(undefined);
                  }
                }}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Contract Expenses Dialog */}
        {expensesDialogContract && (
          <ContractExpensesDialog
            contract={expensesDialogContract}
            open={!!expensesDialogContract}
            onOpenChange={(open) => !open && setExpensesDialogContract(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
