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
} from '@/components/ui/dialog';
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
import { format, parseISO, isPast, isToday, addMonths, getDate, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Check, Trash2, Edit, ShoppingBag, User, DollarSign, Calendar, ChevronDown, ChevronUp, Package, Banknote, FileSignature, FileText, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProfile } from '@/hooks/useProfile';
import { generateContractReceipt, generatePaymentReceipt, ContractReceiptData, PaymentReceiptData } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import ReceiptPreviewDialog from '@/components/ReceiptPreviewDialog';
import PaymentReceiptPrompt from '@/components/PaymentReceiptPrompt';
import ProductSaleCard from '@/components/ProductSaleCard';
import ProductInstallmentsDialog from '@/components/ProductInstallmentsDialog';
import SaleCreatedReceiptPrompt from '@/components/SaleCreatedReceiptPrompt';

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
  const { contracts, isLoading: contractsLoading, createContract, updateContract, deleteContract, getContractPayments, markPaymentAsPaid } = useContracts();
  
  const { profile } = useProfile();

  // Main tab state
  const [mainTab, setMainTab] = useState<'products' | 'contracts'>('products');
  
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
    contract_type: '',
    total_amount: 0,
    amount_to_receive: 0,
    notes: '',
  });

  // Contract payment dialog states
  const [contractPaymentDialogOpen, setContractPaymentDialogOpen] = useState(false);
  const [selectedContractPayment, setSelectedContractPayment] = useState<{ payment: ContractPayment; contract: Contract } | null>(null);
  const [contractPaymentDate, setContractPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));


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
    first_payment_date: '',
    payment_method: 'all_days',
    notes: '',
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
      first_payment_date: '',
      payment_method: 'all_days',
      notes: '',
    });
  };



  // Generate installment dates for product sales
  useEffect(() => {
    if (formData.first_due_date && formData.installments > 0) {
      const firstDate = parseISO(formData.first_due_date);
      const dayOfMonth = getDate(firstDate);
      
      const dates: InstallmentDate[] = [];
      for (let i = 0; i < formData.installments; i++) {
        let dueDate = addMonths(firstDate, i);
        try {
          dueDate = setDate(dueDate, dayOfMonth);
        } catch {
          // Handle edge cases
        }
        dates.push({
          number: i + 1,
          date: format(dueDate, 'yyyy-MM-dd'),
        });
      }
      setInstallmentDates(dates);
    }
  }, [formData.first_due_date, formData.installments]);

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

  // Select all past installments
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

  const openEditSaleDialog = (sale: ProductSale) => {
    setEditingSale(sale);
    
    // Load existing payments for this sale
    const salePayments = allSalePayments?.filter(p => p.product_sale_id === sale.id) || [];
    const existingInstallments: InstallmentDate[] = salePayments
      .sort((a, b) => a.installment_number - b.installment_number)
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
    await createContract.mutateAsync(contractForm);
    setIsContractOpen(false);
    resetContractForm();
  };

  const openEditContractDialog = (contract: Contract) => {
    setEditingContract(contract);
    setEditContractForm({
      client_name: contract.client_name,
      contract_type: contract.contract_type,
      total_amount: contract.total_amount,
      amount_to_receive: contract.amount_to_receive,
      notes: contract.notes || '',
    });
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
  const handleGenerateProductReceipt = (sale: ProductSale) => {
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
      dueDates: getSalePayments(sale.id).map(p => ({ date: p.due_date, isPaid: p.status === 'paid' })),
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

  const filteredContracts = contracts.filter(contract =>
    contract.client_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    contract.bill_type === 'receivable'
  );

  const getCardStyles = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-primary/10 border-primary/40';
      case 'overdue':
        return 'bg-destructive/10 border-destructive/40';
      case 'due_today':
        return 'bg-yellow-500/10 border-yellow-500/40';
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

  const getContractTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      aluguel_casa: 'Aluguel de Casa',
      aluguel_kitnet: 'Aluguel de Kitnet',
      aluguel_apartamento: 'Aluguel de Apartamento',
      aluguel_sala: 'Aluguel de Sala Comercial',
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

  const isLoading = salesLoading || contractsLoading;

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
          <p className="text-sm text-muted-foreground">Gerencie vendas de produtos e contratos</p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="products" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-2 text-[10px] sm:text-sm">
              <ShoppingBag className="w-4 h-4" />
              <span>Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-2 text-[10px] sm:text-sm">
              <FileSignature className="w-4 h-4" />
              <span>Contratos</span>
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
                        <Label>Valor da Parcela (R$)</Label>
                        <Input
                          type="number"
                          value={formData.installment_value.toFixed(2)}
                          disabled
                          className="bg-muted"
                        />
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Dialog open={isContractOpen} onOpenChange={setIsContractOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" />Novo Contrato</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
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
                    <div className="space-y-2">
                      <Label>Tipo de contrato</Label>
                      <Select value={contractForm.contract_type} onValueChange={(value) => setContractForm({ ...contractForm, contract_type: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aluguel_casa">Aluguel de Casa</SelectItem>
                          <SelectItem value="aluguel_kitnet">Aluguel de Kitnet</SelectItem>
                          <SelectItem value="aluguel_apartamento">Aluguel de Apartamento</SelectItem>
                          <SelectItem value="aluguel_sala">Aluguel de Sala Comercial</SelectItem>
                          <SelectItem value="mensalidade">Mensalidade</SelectItem>
                          <SelectItem value="servico_mensal">Serviço Mensal</SelectItem>
                          <SelectItem value="parcelado">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor mensal (R$) *</Label>
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
                    <div className="space-y-2">
                      <Label>Primeiro vencimento *</Label>
                      <Input type="date" value={contractForm.first_payment_date} onChange={(e) => setContractForm({ ...contractForm, first_payment_date: e.target.value })} />
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
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredContracts.map((contract) => (
                  <Card key={contract.id} className={cn("transition-all", contract.status === 'paid' && 'bg-primary/10 border-primary/40')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <FileSignature className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{contract.client_name}</p>
                            <p className="text-xs text-muted-foreground">{getContractTypeLabel(contract.contract_type)}</p>
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
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleContractExpand(contract.id)}>
                          {expandedContract === contract.id ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                          Parcelas
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => openEditContractDialog(contract)}><Edit className="w-4 h-4" /></Button>
                        <Button size="icon" variant="outline" className="text-destructive" onClick={() => setDeleteContractId(contract.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                      {expandedContract === contract.id && contractPayments[contract.id] && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          {contractPayments[contract.id].map((payment) => (
                            <div key={payment.id} className={cn("flex items-center justify-between p-2 rounded-lg text-sm",
                              payment.status === 'paid' ? 'bg-primary/10 text-primary' :
                              isPast(parseISO(payment.due_date)) && !isToday(parseISO(payment.due_date)) ? 'bg-destructive/10 text-destructive' : 'bg-muted'
                            )}>
                              <div>
                                <span className="font-medium">{payment.installment_number}ª</span>
                                <span className="ml-2">{format(parseISO(payment.due_date), "dd/MM/yy")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                                {payment.status !== 'paid' ? (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openContractPaymentDialog(payment, contract)}>
                                    <Check className="w-3 h-3" />
                                  </Button>
                                ) : (
                                  <Check className="w-4 h-4 text-primary" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
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
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Editar Contrato</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input value={editContractForm.client_name} onChange={(e) => setEditContractForm({ ...editContractForm, client_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={editContractForm.notes || ''} onChange={(e) => setEditContractForm({ ...editContractForm, notes: e.target.value })} />
              </div>
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
      </div>
    </DashboardLayout>
  );
}
