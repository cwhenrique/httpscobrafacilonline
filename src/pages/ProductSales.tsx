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
import { useBills, Bill, CreateBillData } from '@/hooks/useBills';
import { useContracts, Contract, CreateContractData, ContractPayment, UpdateContractData } from '@/hooks/useContracts';
import { useVehicles, useVehiclePayments, Vehicle, CreateVehicleData } from '@/hooks/useVehicles';
import { VehicleForm } from '@/components/VehicleForm';
import { format, parseISO, isPast, isToday, addMonths, getDate, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Check, Trash2, Edit, ShoppingBag, User, DollarSign, Calendar, ChevronDown, ChevronUp, Package, Banknote, Car, FileSignature, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProfile } from '@/hooks/useProfile';
import { generateContractReceipt, generatePaymentReceipt, ContractReceiptData, PaymentReceiptData } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import ReceiptPreviewDialog from '@/components/ReceiptPreviewDialog';
import PaymentReceiptPrompt from '@/components/PaymentReceiptPrompt';
import ProductSaleCard from '@/components/ProductSaleCard';
import ProductInstallmentsDialog from '@/components/ProductInstallmentsDialog';

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
}: {
  installmentDates: ProductInstallment[];
  isHistorical: boolean;
  today: Date;
  updateInstallmentDate: (index: number, date: string) => void;
  toggleInstallmentPaid: (index: number) => void;
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
      <Label>Datas das Parcelas</Label>
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
  const { sales, isLoading: salesLoading, createSale, updateSale, deleteSale } = useProductSales();
  const { payments: allSalePayments, markAsPaid: markSalePaymentAsPaid } = useProductSalePayments();
  
  // Bills hooks
  const { bills, isLoading: billsLoading, createBill, updateBill, deleteBill, markAsPaid: markBillAsPaid } = useBills();
  
  // Contracts hooks
  const { contracts, isLoading: contractsLoading, createContract, updateContract, deleteContract, getContractPayments, markPaymentAsPaid } = useContracts();
  
  // Vehicles hooks
  const { vehicles, isLoading: vehiclesLoading, createVehicle, updateVehicle, deleteVehicle } = useVehicles();
  const { payments: vehiclePaymentsList, markAsPaid: markVehiclePaymentAsPaid } = useVehiclePayments();
  const { profile } = useProfile();

  // Main tab state
  const [mainTab, setMainTab] = useState<'products' | 'contracts' | 'vehicles' | 'bills'>('products');
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Product Sales states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<ProductSale | null>(null);
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

  // Vehicles states
  const [isVehicleOpen, setIsVehicleOpen] = useState(false);
  const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  
  // Vehicle payment dialog states
  const [vehiclePaymentDialogOpen, setVehiclePaymentDialogOpen] = useState(false);
  const [selectedVehiclePaymentData, setSelectedVehiclePaymentData] = useState<{
    paymentId: string;
    vehicleId: string;
    payment: { id: string; amount: number; installment_number: number; due_date: string };
    vehicle: Vehicle;
  } | null>(null);

  // Bills states
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [isEditBillOpen, setIsEditBillOpen] = useState(false);
  const [deleteBillId, setDeleteBillId] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [billFilter, setBillFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');

  // Receipt preview states
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [receiptPreviewData, setReceiptPreviewData] = useState<ContractReceiptData | null>(null);

  // Payment receipt prompt states
  const [isPaymentReceiptOpen, setIsPaymentReceiptOpen] = useState(false);
  const [paymentReceiptData, setPaymentReceiptData] = useState<PaymentReceiptData | null>(null);

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

  const [vehicleForm, setVehicleForm] = useState<CreateVehicleData>({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    plate: '',
    chassis: '',
    seller_name: '',
    buyer_name: '',
    buyer_phone: '',
    buyer_email: '',
    buyer_cpf: '',
    buyer_rg: '',
    buyer_address: '',
    purchase_date: '',
    purchase_value: 0,
    down_payment: 0,
    installments: 12,
    installment_value: 0,
    first_due_date: '',
    notes: '',
  });

  const [billForm, setBillForm] = useState<CreateBillData>({
    description: '',
    payee_name: '',
    amount: 0,
    due_date: '',
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

  const resetVehicleForm = () => {
    setVehicleForm({
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      color: '',
      plate: '',
      chassis: '',
      seller_name: '',
      buyer_name: '',
      buyer_phone: '',
      buyer_email: '',
      buyer_cpf: '',
      buyer_rg: '',
      buyer_address: '',
      purchase_date: '',
      purchase_value: 0,
      down_payment: 0,
      installments: 12,
      installment_value: 0,
      first_due_date: '',
      notes: '',
    });
  };

  const resetBillForm = () => {
    setBillForm({
      description: '',
      payee_name: '',
      amount: 0,
      due_date: '',
      notes: '',
    });
  };

  // Generate installment dates for product sales
  useEffect(() => {
    if (formData.first_due_date && formData.installments > 0) {
      const firstDate = new Date(formData.first_due_date);
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

  // Product Sales handlers
  const handleCreateSale = async () => {
    await createSale.mutateAsync({ ...formData, installmentDates });
    setIsCreateOpen(false);
    resetForm();
  };

  const openEditSaleDialog = (sale: ProductSale) => {
    setEditingSale(sale);
    setIsEditOpen(true);
  };

  const handleEditSale = async () => {
    if (!editingSale) return;
    await updateSale.mutateAsync({
      id: editingSale.id,
      product_name: editingSale.product_name,
      product_description: editingSale.product_description || undefined,
      client_name: editingSale.client_name,
      client_phone: editingSale.client_phone || undefined,
      client_email: editingSale.client_email || undefined,
      notes: editingSale.notes || undefined,
    });
    setIsEditOpen(false);
    setEditingSale(null);
  };

  const handleDeleteSale = async () => {
    if (!deleteId) return;
    await deleteSale.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleMarkSalePaymentAsPaid = async (paymentId: string) => {
    const payment = allSalePayments.find(p => p.id === paymentId);
    const sale = payment ? sales.find(s => s.id === payment.product_sale_id) : null;
    
    await markSalePaymentAsPaid.mutateAsync({
      paymentId,
      paidDate: paymentDate,
    });
    
    // Show payment receipt prompt
    if (payment && sale) {
      const newRemainingBalance = Math.max(0, sale.remaining_balance - payment.amount);
      setPaymentReceiptData({
        type: 'product',
        contractId: sale.id,
        companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
        clientName: sale.client_name,
        installmentNumber: payment.installment_number,
        totalInstallments: sale.installments,
        amountPaid: payment.amount,
        paymentDate: paymentDate,
        remainingBalance: newRemainingBalance,
        totalPaid: (sale.total_paid || 0) + payment.amount,
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

  // Open vehicle payment dialog
  const openVehiclePaymentDialog = (payment: { id: string; amount: number; installment_number: number; due_date: string }, vehicle: Vehicle) => {
    setSelectedVehiclePaymentData({ paymentId: payment.id, vehicleId: vehicle.id, payment, vehicle });
    setVehiclePaymentDialogOpen(true);
  };

  // Confirm vehicle payment with receipt prompt
  const confirmVehiclePaymentWithReceipt = async () => {
    if (!selectedVehiclePaymentData) return;
    
    const { paymentId, vehicleId, payment, vehicle } = selectedVehiclePaymentData;
    
    await markVehiclePaymentAsPaid.mutateAsync({ paymentId, vehicleId });
    
    setVehiclePaymentDialogOpen(false);
    setSelectedVehiclePaymentData(null);
    
    // Show payment receipt prompt
    const newRemainingBalance = Math.max(0, vehicle.remaining_balance - payment.amount);
    setPaymentReceiptData({
      type: 'vehicle',
      contractId: vehicle.id,
      companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
      clientName: vehicle.buyer_name || vehicle.seller_name,
      installmentNumber: payment.installment_number,
      totalInstallments: vehicle.installments,
      amountPaid: payment.amount,
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      remainingBalance: newRemainingBalance,
      totalPaid: (vehicle.total_paid || 0) + payment.amount,
    });
    setIsPaymentReceiptOpen(true);
  };

  // Wrapper for contract payment with receipt prompt
  const handleMarkContractPaymentAsPaid = async (paymentId: string, contract: Contract) => {
    const payments = contractPayments[contract.id] || [];
    const payment = payments.find(p => p.id === paymentId);
    
    await markPaymentAsPaid.mutateAsync(paymentId);
    
    // Show payment receipt prompt
    if (payment) {
      const paidPayments = payments.filter(p => p.status === 'paid').length;
      const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
      const newRemainingBalance = Math.max(0, contract.amount_to_receive - paidAmount - payment.amount);
      setPaymentReceiptData({
        type: 'contract',
        contractId: contract.id,
        companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
        clientName: contract.client_name,
        installmentNumber: payment.installment_number,
        totalInstallments: contract.installments,
        amountPaid: payment.amount,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        remainingBalance: newRemainingBalance,
        totalPaid: paidAmount + payment.amount,
      });
      setIsPaymentReceiptOpen(true);
    }
    
    // Refresh contract payments
    const updatedPayments = await getContractPayments(contract.id);
    setContractPayments(prev => ({ ...prev, [contract.id]: updatedPayments }));
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

  // Vehicle handlers
  const handleCreateVehicle = async (data: CreateVehicleData) => {
    await createVehicle.mutateAsync(data);
    setIsVehicleOpen(false);
  };

  const openEditVehicleDialog = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color || '',
      plate: vehicle.plate || '',
      chassis: vehicle.chassis || '',
      seller_name: vehicle.seller_name,
      buyer_name: vehicle.buyer_name || '',
      buyer_phone: vehicle.buyer_phone || '',
      buyer_email: vehicle.buyer_email || '',
      purchase_date: vehicle.purchase_date,
      purchase_value: vehicle.purchase_value,
      down_payment: vehicle.down_payment,
      installments: vehicle.installments,
      installment_value: vehicle.installment_value,
      first_due_date: vehicle.first_due_date,
      notes: vehicle.notes || '',
    });
    setIsEditVehicleOpen(true);
  };

  const handleEditVehicle = async () => {
    if (!editingVehicle) return;
    await updateVehicle.mutateAsync({
      id: editingVehicle.id,
      data: {
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        year: vehicleForm.year,
        color: vehicleForm.color || undefined,
        plate: vehicleForm.plate || undefined,
        chassis: vehicleForm.chassis || undefined,
        seller_name: vehicleForm.seller_name,
        buyer_name: vehicleForm.buyer_name || undefined,
        buyer_phone: vehicleForm.buyer_phone || undefined,
        buyer_email: vehicleForm.buyer_email || undefined,
        purchase_value: vehicleForm.purchase_value,
        down_payment: vehicleForm.down_payment,
        installment_value: vehicleForm.installment_value,
        notes: vehicleForm.notes || undefined,
      },
    });
    setIsEditVehicleOpen(false);
    setEditingVehicle(null);
    resetVehicleForm();
  };

  const handleDeleteVehicle = async () => {
    if (!deleteVehicleId) return;
    await deleteVehicle.mutateAsync(deleteVehicleId);
    setDeleteVehicleId(null);
  };

  const toggleVehicleExpand = (vehicleId: string) => {
    setExpandedVehicle(expandedVehicle === vehicleId ? null : vehicleId);
  };

  // Bill handlers
  const handleCreateBill = async () => {
    if (!billForm.payee_name || !billForm.amount || !billForm.due_date) return;
    await createBill.mutateAsync(billForm);
    setIsBillOpen(false);
    resetBillForm();
  };

  const openEditBillDialog = (bill: Bill) => {
    setEditingBill(bill);
    setBillForm({
      description: bill.description,
      payee_name: bill.payee_name,
      amount: bill.amount,
      due_date: bill.due_date,
      notes: bill.notes || '',
    });
    setIsEditBillOpen(true);
  };

  const handleEditBill = async () => {
    if (!editingBill) return;
    await updateBill.mutateAsync({
      id: editingBill.id,
      data: billForm,
    });
    setIsEditBillOpen(false);
    setEditingBill(null);
    resetBillForm();
  };

  const handleDeleteBill = async () => {
    if (!deleteBillId) return;
    await deleteBill.mutateAsync(deleteBillId);
    setDeleteBillId(null);
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
      dueDates: getSalePayments(sale.id).map(p => p.due_date),
      productInfo: { name: sale.product_name, description: sale.product_description || undefined },
    };
    setReceiptPreviewData(receiptData);
    setIsReceiptPreviewOpen(true);
  };

  const handleGenerateVehicleReceipt = (vehicle: Vehicle) => {
    const receiptData: ContractReceiptData = {
      type: 'vehicle',
      contractId: vehicle.id,
      companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
      client: {
        name: vehicle.buyer_name || vehicle.seller_name,
        phone: vehicle.buyer_phone || undefined,
        cpf: vehicle.buyer_cpf || undefined,
        rg: vehicle.buyer_rg || undefined,
        email: vehicle.buyer_email || undefined,
        address: vehicle.buyer_address || undefined,
      },
      negotiation: {
        principal: vehicle.purchase_value,
        installments: vehicle.installments,
        installmentValue: vehicle.installment_value,
        totalToReceive: vehicle.purchase_value,
        startDate: vehicle.purchase_date,
        downPayment: vehicle.down_payment || 0,
        costValue: vehicle.cost_value || 0,
      },
      dueDates: vehiclePaymentsList.filter(p => p.vehicle_id === vehicle.id).map(p => p.due_date),
      vehicleInfo: {
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color || undefined,
        plate: vehicle.plate || undefined,
        chassis: vehicle.chassis || undefined,
      },
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
      dueDates: payments.map(p => p.due_date),
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

  // Filtered data
  const filteredSales = sales?.filter(sale =>
    sale.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredContracts = contracts.filter(contract =>
    contract.client_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    contract.bill_type === 'receivable'
  );

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vehicle.buyer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getBillStatus = (bill: Bill) => {
    if (bill.status === 'paid') return 'paid';
    const dueDate = parseISO(bill.due_date);
    if (isPast(dueDate) && !isToday(dueDate)) return 'overdue';
    return 'pending';
  };

  const filteredBills = bills.filter((bill) => {
    const matchesSearch = bill.payee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.description.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    const status = getBillStatus(bill);
    if (billFilter === 'all') return true;
    if (billFilter === 'overdue') return status === 'overdue';
    return status === billFilter;
  });

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

  // Stats
  const salesStats = {
    totalSales: filteredSales.length,
    totalValue: filteredSales.reduce((acc, s) => acc + s.total_amount, 0),
    totalReceived: filteredSales.reduce((acc, s) => acc + (s.total_paid || 0), 0),
    pending: filteredSales.reduce((acc, s) => acc + s.remaining_balance, 0),
  };

  const billsStats = {
    total: bills.length,
    pending: bills.filter((b) => getBillStatus(b) === 'pending').length,
    overdue: bills.filter((b) => getBillStatus(b) === 'overdue').length,
    totalAmount: bills.filter((b) => getBillStatus(b) !== 'paid').reduce((acc, b) => acc + b.amount, 0),
  };

  const isLoading = salesLoading || billsLoading || contractsLoading || vehiclesLoading;

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
          <p className="text-sm text-muted-foreground">Gerencie vendas, contratos, veículos e contas</p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="products" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-2 text-[10px] sm:text-sm">
              <ShoppingBag className="w-4 h-4" />
              <span>Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-2 text-[10px] sm:text-sm">
              <FileSignature className="w-4 h-4" />
              <span>Contratos</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-2 text-[10px] sm:text-sm">
              <Car className="w-4 h-4" />
              <span>Veículos</span>
            </TabsTrigger>
            <TabsTrigger value="bills" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-2 text-[10px] sm:text-sm">
              <FileText className="w-4 h-4" />
              <span>Contas</span>
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
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMarkContractPaymentAsPaid(payment.id, contract)}>
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

          {/* VEÍCULOS TAB */}
          <TabsContent value="vehicles" className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por marca, modelo ou comprador..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Dialog open={isVehicleOpen} onOpenChange={setIsVehicleOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" />Novo Veículo</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Cadastrar Veículo</DialogTitle></DialogHeader>
                  <VehicleForm billType="receivable" onSubmit={handleCreateVehicle} isPending={createVehicle.isPending} />
                </DialogContent>
              </Dialog>
            </div>

            {filteredVehicles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Car className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">Nenhum veículo cadastrado</h3>
                  <p className="text-muted-foreground text-sm">Cadastre veículos vendidos para controlar os recebimentos</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVehicles.map((vehicle) => {
                  const vehiclePaymentsForCard = vehiclePaymentsList.filter(p => p.vehicle_id === vehicle.id);
                  const hasOverdue = vehiclePaymentsForCard.some(p => p.status !== 'paid' && isPast(parseISO(p.due_date)) && !isToday(parseISO(p.due_date)));
                  
                  return (
                    <Card key={vehicle.id} className={cn(
                      "transition-all",
                      vehicle.status === 'paid' && 'bg-primary/10 border-primary/40',
                      hasOverdue && vehicle.status !== 'paid' && 'bg-destructive/10 border-destructive/40'
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                              <Car className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{vehicle.brand} {vehicle.model}</p>
                              <p className="text-xs text-muted-foreground">{vehicle.year} {vehicle.color && `• ${vehicle.color}`}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-6 text-[10px] px-2"
                              onClick={() => handleGenerateVehicleReceipt(vehicle)}
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Comprovante
                            </Button>
                            <Badge variant={vehicle.status === 'paid' ? 'default' : 'secondary'}>{vehicle.status === 'paid' ? 'Quitado' : `${vehicle.installments}x`}</Badge>
                          </div>
                        </div>
                        {vehicle.plate && <div className="mb-2 p-2 bg-muted rounded text-center font-mono font-bold text-sm">{vehicle.plate}</div>}
                        <div className="space-y-2 mb-3">
                          {vehicle.buyer_name && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Comprador</span>
                              <span className="font-medium truncate max-w-[50%]">{vehicle.buyer_name}</span>
                            </div>
                          )}
                          {(vehicle.cost_value || 0) > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Custo</span>
                              <span className="font-medium">{formatCurrency(vehicle.cost_value || 0)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Valor venda</span>
                            <span className="font-bold">{formatCurrency(vehicle.purchase_value)}</span>
                          </div>
                          {(vehicle.cost_value || 0) > 0 && (
                            <div className={cn("flex justify-between items-center p-2 rounded-lg", 
                              vehicle.purchase_value - (vehicle.cost_value || 0) >= 0 ? "bg-emerald-500/10" : "bg-destructive/10"
                            )}>
                              <span className="text-sm text-muted-foreground">Lucro</span>
                              <span className={cn("font-bold", 
                                vehicle.purchase_value - (vehicle.cost_value || 0) >= 0 ? "text-emerald-500" : "text-destructive"
                              )}>
                                {formatCurrency(vehicle.purchase_value - (vehicle.cost_value || 0))}
                                <span className="ml-1 text-xs font-normal">
                                  ({(vehicle.cost_value || 0) > 0 ? (((vehicle.purchase_value - (vehicle.cost_value || 0)) / (vehicle.cost_value || 1)) * 100).toFixed(1) : 0}%)
                                </span>
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center p-2 rounded-lg bg-primary/10">
                            <span className="text-sm text-muted-foreground">Recebido</span>
                            <span className="font-bold text-primary">{formatCurrency(vehicle.total_paid)}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 rounded-lg bg-orange-500/10">
                            <span className="text-sm text-muted-foreground">Falta</span>
                            <span className="font-bold text-orange-600">{formatCurrency(vehicle.remaining_balance)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleVehicleExpand(vehicle.id)}>
                            {expandedVehicle === vehicle.id ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                            Parcelas
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => openEditVehicleDialog(vehicle)}><Edit className="w-4 h-4" /></Button>
                          <Button size="icon" variant="outline" className="text-destructive" onClick={() => setDeleteVehicleId(vehicle.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        {expandedVehicle === vehicle.id && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                              {vehiclePaymentsForCard.map((payment) => (
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
                                      <Button size="sm" variant="default" className="h-7 text-xs bg-primary hover:bg-primary/90" onClick={() => openVehiclePaymentDialog(payment, vehicle)}>
                                        Pagar
                                      </Button>
                                    ) : (
                                      <Check className="w-4 h-4 text-primary" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* CONTAS A PAGAR TAB */}
          <TabsContent value="bills" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{billsStats.total}</p>
                      <p className="text-xs text-muted-foreground">Contas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{billsStats.pending}</p>
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{billsStats.overdue}</p>
                      <p className="text-xs text-muted-foreground">Atrasadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/30">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total a Pagar</p>
                  <p className="text-sm font-bold text-orange-600 truncate">{formatCurrency(billsStats.totalAmount)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant={billFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setBillFilter('all')}>Todas</Button>
                <Button variant={billFilter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setBillFilter('pending')}>Pendentes</Button>
                <Button variant={billFilter === 'overdue' ? 'default' : 'outline'} size="sm" onClick={() => setBillFilter('overdue')}>Atrasadas</Button>
                <Button variant={billFilter === 'paid' ? 'default' : 'outline'} size="sm" onClick={() => setBillFilter('paid')}>Pagas</Button>
              </div>
              <Dialog open={isBillOpen} onOpenChange={setIsBillOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" />Nova Conta</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Pagar para *</Label>
                      <Input placeholder="Nome da pessoa ou empresa" value={billForm.payee_name} onChange={(e) => setBillForm({ ...billForm, payee_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição *</Label>
                      <Input placeholder="Ex: Aluguel, Conta de luz..." value={billForm.description} onChange={(e) => setBillForm({ ...billForm, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor (R$) *</Label>
                        <Input type="number" step="0.01" min="0" value={billForm.amount || ''} onChange={(e) => setBillForm({ ...billForm, amount: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Vencimento *</Label>
                        <Input type="date" value={billForm.due_date} onChange={(e) => setBillForm({ ...billForm, due_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Textarea placeholder="Notas adicionais..." value={billForm.notes} onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })} />
                    </div>
                    <Button onClick={handleCreateBill} disabled={!billForm.payee_name || !billForm.description || !billForm.amount || !billForm.due_date || createBill.isPending} className="w-full">
                      {createBill.isPending ? 'Salvando...' : 'Cadastrar Conta'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {filteredBills.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">Nenhuma conta encontrada</h3>
                  <p className="text-muted-foreground text-sm">Clique em "Nova Conta" para cadastrar</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBills.map((bill) => {
                  const status = getBillStatus(bill);
                  return (
                    <Card key={bill.id} className={cn("transition-all",
                      status === 'paid' && 'bg-primary/10 border-primary/40',
                      status === 'overdue' && 'bg-destructive/10 border-destructive/40'
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-semibold">{bill.payee_name}</p>
                              <p className="text-xs text-muted-foreground">{bill.description}</p>
                            </div>
                          </div>
                          {getStatusBadge(status)}
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Valor</span>
                            <span className="font-bold">{formatCurrency(bill.amount)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Vencimento</span>
                            <span className={cn("font-medium", status === 'overdue' && 'text-destructive')}>
                              {format(parseISO(bill.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {status !== 'paid' && (
                            <Button size="sm" className="flex-1" onClick={() => markBillAsPaid.mutateAsync(bill.id)} disabled={markBillAsPaid.isPending}>
                              <Check className="w-3 h-3 mr-1" />
                              Pagar
                            </Button>
                          )}
                          <Button size="icon" variant="outline" onClick={() => openEditBillDialog(bill)}><Edit className="w-4 h-4" /></Button>
                          <Button size="icon" variant="outline" className="text-destructive" onClick={() => setDeleteBillId(bill.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Sale Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Editar Venda</DialogTitle></DialogHeader>
            {editingSale && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Produto</Label>
                  <Input value={editingSale.product_name} onChange={(e) => setEditingSale({ ...editingSale, product_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={editingSale.product_description || ''} onChange={(e) => setEditingSale({ ...editingSale, product_description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Cliente</Label>
                    <Input value={editingSale.client_name} onChange={(e) => setEditingSale({ ...editingSale, client_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={editingSale.client_phone || ''} onChange={(e) => setEditingSale({ ...editingSale, client_phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={editingSale.notes || ''} onChange={(e) => setEditingSale({ ...editingSale, notes: e.target.value })} />
                </div>
                <Button onClick={handleEditSale} disabled={updateSale.isPending} className="w-full">{updateSale.isPending ? 'Salvando...' : 'Salvar Alterações'}</Button>
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

        {/* Edit Vehicle Dialog */}
        <Dialog open={isEditVehicleOpen} onOpenChange={setIsEditVehicleOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Veículo</DialogTitle></DialogHeader>
            <VehicleForm
              billType="receivable"
              onSubmit={async (data) => {
                if (!editingVehicle) return;
                await updateVehicle.mutateAsync({ id: editingVehicle.id, data });
                setIsEditVehicleOpen(false);
                setEditingVehicle(null);
              }}
              isPending={updateVehicle.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Bill Dialog */}
        <Dialog open={isEditBillOpen} onOpenChange={setIsEditBillOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Conta</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pagar para</Label>
                <Input value={billForm.payee_name} onChange={(e) => setBillForm({ ...billForm, payee_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={billForm.description} onChange={(e) => setBillForm({ ...billForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={billForm.amount || ''} onChange={(e) => setBillForm({ ...billForm, amount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Input type="date" value={billForm.due_date} onChange={(e) => setBillForm({ ...billForm, due_date: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleEditBill} disabled={updateBill.isPending} className="w-full">{updateBill.isPending ? 'Salvando...' : 'Salvar Alterações'}</Button>
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
                  <p className="text-sm text-muted-foreground mt-2">Valor da parcela</p>
                  <p className="font-semibold text-primary">{formatCurrency(selectedPayment.amount)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Valor Pago (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={paymentAmount || ''} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label>Data do Pagamento</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Quando o cliente efetivamente pagou</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setPaymentDialogOpen(false); setSelectedPayment(null); setPaymentDate(format(new Date(), 'yyyy-MM-dd')); }}>Cancelar</Button>
                  <Button className="flex-1 gap-2" onClick={() => handleMarkSalePaymentAsPaid(selectedPayment.id)} disabled={markSalePaymentAsPaid.isPending || paymentAmount <= 0}>
                    <Check className="w-4 h-4" />
                    {markSalePaymentAsPaid.isPending ? 'Salvando...' : 'Confirmar'}
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

        <AlertDialog open={!!deleteVehicleId} onOpenChange={() => setDeleteVehicleId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Veículo</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteVehicle} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteBillId} onOpenChange={() => setDeleteBillId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteBill} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
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
        />

        {/* Vehicle Payment Confirmation Dialog */}
        <Dialog open={vehiclePaymentDialogOpen} onOpenChange={setVehiclePaymentDialogOpen}>
          <DialogContent className="w-[95vw] max-w-md animate-scale-in">
            <DialogHeader>
              <DialogTitle>Confirmar Pagamento</DialogTitle>
            </DialogHeader>
            
            {selectedVehiclePaymentData && (
              <div className="space-y-4">
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Veículo:</span>
                    <span className="font-medium">{selectedVehiclePaymentData.vehicle.brand} {selectedVehiclePaymentData.vehicle.model}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Comprador:</span>
                    <span className="font-medium">{selectedVehiclePaymentData.vehicle.buyer_name || selectedVehiclePaymentData.vehicle.seller_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Parcela:</span>
                    <span className="font-medium">{selectedVehiclePaymentData.payment.installment_number}ª de {selectedVehiclePaymentData.vehicle.installments}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vencimento:</span>
                    <span className="font-medium">{format(parseISO(selectedVehiclePaymentData.payment.due_date), "dd/MM/yyyy")}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-2 border-t">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-bold text-primary">{formatCurrency(selectedVehiclePaymentData.payment.amount)}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setVehiclePaymentDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={confirmVehiclePaymentWithReceipt} disabled={markVehiclePaymentAsPaid.isPending} className="flex-1">
                {markVehiclePaymentAsPaid.isPending ? 'Processando...' : 'Confirmar Pagamento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
      </div>
    </DashboardLayout>
  );
}
