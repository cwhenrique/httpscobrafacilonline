import { useState, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useCheckDiscounts } from '@/hooks/useCheckDiscounts';
import { useClients } from '@/hooks/useClients';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  FileCheck, 
  Plus, 
  Search, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Calendar,
  Building2,
  User,
  CreditCard,
  TrendingUp,
  Clock,
  Phone,
  Trash2,
  Edit,
  RotateCcw,
  DollarSign,
  Banknote,
  Percent,
  CalendarDays,
  AlertCircle,
  CircleDollarSign,
  ArrowRight,
  BarChart3,
  Lock,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CheckDiscount,
  CheckDiscountFormData,
  CheckDiscountStatus,
  DiscountType,
  PaymentMethod,
  getStatusLabel,
  getStatusColor,
  getPaymentMethodLabel,
  calculateDiscountAmount,
  calculateNetValue,
  getDaysUntilDue,
  RETURN_REASONS,
  BANKS,
} from '@/types/checkDiscount';
import { ClientSelector } from '@/components/ClientSelector';
import { useProfile } from '@/hooks/useProfile';
import { CheckDiscountCard } from '@/components/CheckDiscountCard';

import { CheckDiscountFilterType } from '@/hooks/useCheckDiscounts';

export default function CheckDiscounts() {
  const { profile, loading: profileLoading } = useProfile();
  const { effectiveUserId } = useEmployeeContext();
  const { 
    filteredChecks, 
    loading, 
    stats,
    filterCounts,
    statusFilter, 
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    createCheck,
    updateCheck,
    compensateCheck,
    returnCheck,
    registerDebtPayment,
    deleteCheck,
    getClientCheckHistory,
    isCreating,
    isUpdating,
  } = useCheckDiscounts();
  const { clients } = useClients();

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckDiscount | null>(null);

  // Calculation mode: 'direct' = user enters purchase value, 'calculated' = use rate formula
  const [calculationMode, setCalculationMode] = useState<'direct' | 'calculated'>('direct');

  // Form state
  const [formData, setFormData] = useState<CheckDiscountFormData>({
    client_id: null,
    bank_name: '',
    check_number: '',
    issuer_document: '',
    issuer_name: '',
    nominal_value: 0,
    due_date: '',
    discount_date: format(new Date(), 'yyyy-MM-dd'),
    discount_type: 'proportional',
    discount_rate: 5,
    payment_method: 'cash',
    notes: '',
    purchase_value: 0,
    seller_name: '',
  });

  // Return form state
  const [returnData, setReturnData] = useState({
    return_date: format(new Date(), 'yyyy-MM-dd'),
    return_reason: RETURN_REASONS[0] as string,
    apply_penalty: true,
    penalty_rate: 10,
    installments_count: 1,
  });

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState('');

  // Calculated values for form preview - supports both modes
  const calculatedValues = useMemo(() => {
    if (!formData.nominal_value) {
      return { days: 0, discountAmount: 0, netValue: 0, purchaseValue: 0, profit: 0, profitRate: 0 };
    }

    let purchaseValue = 0;
    let discountAmount = 0;

    if (calculationMode === 'direct') {
      // User entered purchase value directly
      purchaseValue = formData.purchase_value || 0;
      discountAmount = formData.nominal_value - purchaseValue;
    } else {
      // Calculate based on rate
      if (!formData.due_date || !formData.discount_date) {
        return { days: 0, discountAmount: 0, netValue: 0, purchaseValue: 0, profit: 0, profitRate: 0 };
      }
      const days = getDaysUntilDue(formData.discount_date, formData.due_date);
      discountAmount = calculateDiscountAmount(
        formData.nominal_value,
        formData.discount_rate,
        formData.discount_type,
        days
      );
      purchaseValue = formData.nominal_value - discountAmount;
    }

    const netValue = purchaseValue; // What user pays
    const profit = formData.nominal_value - purchaseValue;
    const profitRate = purchaseValue > 0 ? (profit / purchaseValue) * 100 : 0;
    const days = formData.due_date && formData.discount_date 
      ? getDaysUntilDue(formData.discount_date, formData.due_date) 
      : 0;

    return { days, discountAmount, netValue, purchaseValue, profit, profitRate };
  }, [formData, calculationMode]);

  // Client risk check
  const selectedClientRisk = useMemo(() => {
    if (!formData.client_id) return null;
    return getClientCheckHistory(formData.client_id);
  }, [formData.client_id, getClientCheckHistory]);

  // Feature is unlocked if user has check_discount_enabled
  const isFeatureLocked = !profile?.check_discount_enabled;

  if (isFeatureLocked) {
    const whatsappNumber = '5511999999999'; // Número para compra
    const whatsappMessage = encodeURIComponent('Olá! Tenho interesse em adquirir o módulo de Desconto de Cheque por R$ 19,90.');
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

    return (
      <DashboardLayout>
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <Card className="max-w-lg w-full text-center">
            <CardHeader className="pb-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-2xl">Funcionalidade Premium</CardTitle>
              <CardDescription className="text-lg text-primary font-medium">
                Desconto de Cheque
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground">
                Gerencie cheques pré-datados com controle total de risco, 
                vencimento e recebimento.
              </p>
              
              <ul className="text-left space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span>Cálculo automático de desconto</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span>Controle de status (carteira, compensado, devolvido)</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span>Cobrança automática via WhatsApp</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span>Ranking de risco por cliente</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span>Relatórios completos</span>
                </li>
              </ul>

              <div className="bg-primary/10 rounded-xl p-6">
                <p className="text-sm text-muted-foreground">Por apenas</p>
                <p className="text-4xl font-bold text-primary my-1">R$ 19,90</p>
                <p className="text-sm text-muted-foreground">pagamento único</p>
              </div>

              <Button 
                asChild
                className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base"
              >
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Comprar Agora via WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const resetForm = () => {
    setFormData({
      client_id: null,
      bank_name: '',
      check_number: '',
      issuer_document: '',
      issuer_name: '',
      nominal_value: 0,
      due_date: '',
      discount_date: format(new Date(), 'yyyy-MM-dd'),
      discount_type: 'proportional',
      discount_rate: 5,
      payment_method: 'cash',
      notes: '',
      purchase_value: 0,
      seller_name: '',
    });
    setSelectedCheck(null);
    setCalculationMode('direct');
  };

  const handleOpenForm = (check?: CheckDiscount) => {
    if (check) {
      setSelectedCheck(check);
      setFormData({
        client_id: check.client_id,
        bank_name: check.bank_name,
        check_number: check.check_number,
        issuer_document: check.issuer_document || '',
        issuer_name: check.issuer_name || '',
        nominal_value: check.nominal_value,
        due_date: check.due_date,
        discount_date: check.discount_date,
        discount_type: check.discount_type as DiscountType,
        discount_rate: check.discount_rate,
        payment_method: check.payment_method as PaymentMethod,
        notes: check.notes || '',
        purchase_value: check.purchase_value || 0,
        seller_name: check.seller_name || '',
      });
      // Detect mode: if purchase_value exists and is different from calculated, use direct mode
      setCalculationMode(check.purchase_value && check.purchase_value > 0 ? 'direct' : 'calculated');
    } else {
      resetForm();
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.bank_name || !formData.check_number || !formData.nominal_value || !formData.due_date) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      if (selectedCheck) {
        await updateCheck({ id: selectedCheck.id, ...formData });
      } else {
        await createCheck(formData);
      }
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving check:', error);
    }
  };

  const handleCompensate = async (check: CheckDiscount) => {
    try {
      await compensateCheck(check.id);
    } catch (error) {
      console.error('Error compensating check:', error);
    }
  };

  const handleOpenReturn = (check: CheckDiscount) => {
    setSelectedCheck(check);
    setReturnData({
      return_date: format(new Date(), 'yyyy-MM-dd'),
      return_reason: RETURN_REASONS[0],
      apply_penalty: true,
      penalty_rate: 10,
      installments_count: 1,
    });
    setIsReturnDialogOpen(true);
  };

  const handleSubmitReturn = async () => {
    if (!selectedCheck) return;

    const penaltyAmount = returnData.apply_penalty 
      ? selectedCheck.nominal_value * (returnData.penalty_rate / 100)
      : 0;
    
    const totalDebt = selectedCheck.nominal_value + penaltyAmount;

    try {
      await returnCheck({
        id: selectedCheck.id,
        return_date: returnData.return_date,
        return_reason: returnData.return_reason,
        penalty_amount: penaltyAmount,
        penalty_rate: returnData.penalty_rate,
        total_debt: totalDebt,
        installments_count: returnData.installments_count,
      });
      setIsReturnDialogOpen(false);
      setSelectedCheck(null);
    } catch (error) {
      console.error('Error returning check:', error);
    }
  };

  const handleOpenPayment = (check: CheckDiscount) => {
    setSelectedCheck(check);
    const remaining = (check.total_debt || 0) - (check.total_paid_debt || 0);
    setPaymentAmount(check.installments_count > 1 ? remaining / check.installments_count : remaining);
    setPaymentNotes('');
    setIsPaymentDialogOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedCheck || paymentAmount <= 0) return;

    try {
      // Get current payment count
      const paidInstallments = Math.floor((selectedCheck.total_paid_debt || 0) / ((selectedCheck.total_debt || 1) / (selectedCheck.installments_count || 1)));
      
      await registerDebtPayment({
        checkId: selectedCheck.id,
        amount: paymentAmount,
        installmentNumber: paidInstallments + 1,
        notes: paymentNotes || undefined,
      });
      setIsPaymentDialogOpen(false);
      setSelectedCheck(null);
    } catch (error) {
      console.error('Error registering payment:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedCheck) return;

    try {
      await deleteCheck(selectedCheck.id);
      setIsDeleteDialogOpen(false);
      setSelectedCheck(null);
    } catch (error) {
      console.error('Error deleting check:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCPFCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileCheck className="h-7 w-7 text-primary" />
              Desconto de Cheque
            </h1>
            <p className="text-muted-foreground">Gerencie cheques pré-datados e descontos</p>
          </div>
          <Button onClick={() => handleOpenForm()} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Desconto
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-yellow-200 dark:border-yellow-800/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Wallet className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Em Carteira</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.inWalletValue)}</p>
                  <p className="text-xs text-muted-foreground">{stats.inWalletCount} cheques</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">A Vencer (7d)</p>
                  <p className="text-lg font-bold">{stats.dueSoonCount}</p>
                  <p className="text-xs text-muted-foreground">cheques</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Compensados</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.compensatedValue)}</p>
                  <p className="text-xs text-muted-foreground">{stats.compensatedCount} cheques</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-800/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Devolvidos</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.returnedValue)}</p>
                  <p className="text-xs text-muted-foreground">{stats.returnedCount + stats.inCollectionCount} cheques</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lucro</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(stats.realizedProfit)}</p>
                  <p className="text-xs text-muted-foreground">Prev: {formatCurrency(stats.expectedProfit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs - Like Loans */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <Button
            variant={statusFilter === 'open' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('open')}
            className="gap-1.5 h-8"
          >
            <Wallet className="h-3.5 w-3.5" />
            Em Aberto
            {filterCounts.open > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{filterCounts.open}</Badge>
            )}
          </Button>
          <Button
            variant={statusFilter === 'overdue' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('overdue')}
            className="gap-1.5 h-8"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Em Atraso
            {filterCounts.overdue > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{filterCounts.overdue}</Badge>
            )}
          </Button>
          <Button
            variant={statusFilter === 'paid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('paid')}
            className="gap-1.5 h-8"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Quitados
            {filterCounts.paid > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{filterCounts.paid}</Badge>
            )}
          </Button>
          <Button
            variant={statusFilter === 'in_collection' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('in_collection')}
            className="gap-1.5 h-8"
          >
            <Clock className="h-3.5 w-3.5" />
            Em Cobrança
            {filterCounts.inCollection > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{filterCounts.inCollection}</Badge>
            )}
          </Button>
          <Button
            variant={statusFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className="gap-1.5 h-8"
          >
            Todos
            {filterCounts.all > 0 && (
              <Badge variant="outline" className="ml-1 h-5 px-1.5 text-xs">{filterCounts.all}</Badge>
            )}
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cheque..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Checks List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredChecks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum cheque encontrado</p>
              <Button variant="outline" className="mt-4" onClick={() => handleOpenForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar primeiro cheque
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredChecks.map((check) => (
              <CheckDiscountCard
                key={check.id}
                check={check}
                onCompensate={handleCompensate}
                onReturn={handleOpenReturn}
                onPayment={handleOpenPayment}
                onEdit={handleOpenForm}
                onDelete={(c) => {
                  setSelectedCheck(c);
                  setIsDeleteDialogOpen(true);
                }}
                formatCurrency={formatCurrency}
                formatCPFCNPJ={formatCPFCNPJ}
              />
            ))}
          </div>
        )}
      </div>

      {/* New/Edit Check Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              {selectedCheck ? 'Editar Cheque' : 'Novo Desconto de Cheque'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do cheque para calcular o desconto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <ClientSelector
                selectedClientId={formData.client_id}
                onSelect={(client) => setFormData(prev => ({ ...prev, client_id: client?.id || null }))}
                placeholder="Selecionar cliente"
              />
              {selectedClientRisk && selectedClientRisk.total > 0 && (
                <div className={`text-sm p-2 rounded-lg ${
                  selectedClientRisk.isHighRisk 
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                    : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                }`}>
                  {selectedClientRisk.isHighRisk && <AlertTriangle className="h-4 w-4 inline mr-1" />}
                  Histórico: {selectedClientRisk.total} cheques, {selectedClientRisk.returned} devoluções 
                  ({selectedClientRisk.returnRate.toFixed(0)}% de devolução)
                </div>
              )}
            </div>

            <Separator />

            {/* Check Data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco *</Label>
                <Select 
                  value={formData.bank_name} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, bank_name: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número do Cheque *</Label>
                <Input
                  value={formData.check_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, check_number: e.target.value }))}
                  placeholder="Ex: 000123"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF/CNPJ do Emitente</Label>
                <Input
                  value={formData.issuer_document}
                  onChange={(e) => setFormData(prev => ({ ...prev, issuer_document: e.target.value.replace(/\D/g, '') }))}
                  placeholder="Somente números"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do Emitente</Label>
                <Input
                  value={formData.issuer_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, issuer_name: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Nominal *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.nominal_value || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, nominal_value: parseFloat(e.target.value) || 0 }))}
                    className="pl-10"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data de Vencimento *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            {/* Calculation Mode Toggle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valores da Operação
                </h4>
                <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                  <Button
                    type="button"
                    size="sm"
                    variant={calculationMode === 'direct' ? 'default' : 'ghost'}
                    onClick={() => setCalculationMode('direct')}
                    className="text-xs h-7"
                  >
                    <Banknote className="h-3 w-3 mr-1" />
                    Valor Direto
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={calculationMode === 'calculated' ? 'default' : 'ghost'}
                    onClick={() => setCalculationMode('calculated')}
                    className="text-xs h-7"
                  >
                    <Percent className="h-3 w-3 mr-1" />
                    Calcular por Taxa
                  </Button>
                </div>
              </div>

              {calculationMode === 'direct' ? (
                /* Direct Mode: User enters purchase value */
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor de Compra (quanto você pagou) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.purchase_value || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, purchase_value: parseFloat(e.target.value) || 0 }))}
                        className="pl-10"
                        placeholder="900,00"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Digite quanto você pagou para adquirir este cheque
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Comprado de (vendedor)</Label>
                    <Input
                      value={formData.seller_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, seller_name: e.target.value }))}
                      placeholder="Nome do vendedor"
                    />
                  </div>
                </div>
              ) : (
                /* Calculated Mode: Use rate formula */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data do Desconto</Label>
                      <Input
                        type="date"
                        value={formData.discount_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Taxa (% ao mês)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.discount_rate}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount_rate: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Desconto</Label>
                    <RadioGroup
                      value={formData.discount_type}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, discount_type: v as DiscountType }))}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="proportional" id="proportional" />
                        <Label htmlFor="proportional" className="cursor-pointer">
                          Proporcional aos dias
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="percentage" id="percentage" />
                        <Label htmlFor="percentage" className="cursor-pointer">
                          Percentual fixo
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Comprado de (vendedor)</Label>
                      <Input
                        value={formData.seller_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, seller_name: e.target.value }))}
                        placeholder="Nome do vendedor"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Improved Calculation Preview - shows profit clearly */}
              {formData.nominal_value > 0 && (calculationMode === 'direct' ? formData.purchase_value > 0 : formData.due_date) && (
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Resumo da Operação</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor do Cheque:</span>
                      <span className="font-medium">{formatCurrency(formData.nominal_value)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor de Compra:</span>
                      <span className="font-medium">- {formatCurrency(calculatedValues.purchaseValue)}</span>
                    </div>
                    
                    {calculationMode === 'calculated' && calculatedValues.days > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>({calculatedValues.days} dias × {formData.discount_rate}% ao mês)</span>
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center">
                      <span className="font-medium flex items-center gap-1">
                        <CircleDollarSign className="h-4 w-4 text-green-600" />
                        Lucro:
                      </span>
                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency(calculatedValues.profit)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        Rentabilidade:
                      </span>
                      <span className="font-medium text-primary">
                        {calculatedValues.profitRate.toFixed(2)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>


            <Separator />

            {/* Payment Method & Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, payment_method: v as PaymentMethod }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Anotações adicionais..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Salvando...' : selectedCheck ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <RotateCcw className="h-5 w-5" />
              Registrar Devolução
            </DialogTitle>
            <DialogDescription>
              Cheque #{selectedCheck?.check_number} - {formatCurrency(selectedCheck?.nominal_value || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo da Devolução</Label>
              <Select 
                value={returnData.return_reason} 
                onValueChange={(v) => setReturnData(prev => ({ ...prev, return_reason: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data da Devolução</Label>
              <Input
                type="date"
                value={returnData.return_date}
                onChange={(e) => setReturnData(prev => ({ ...prev, return_date: e.target.value }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="apply_penalty"
                checked={returnData.apply_penalty}
                onCheckedChange={(checked) => setReturnData(prev => ({ ...prev, apply_penalty: !!checked }))}
              />
              <Label htmlFor="apply_penalty" className="cursor-pointer">
                Aplicar multa
              </Label>
            </div>

            {returnData.apply_penalty && (
              <div className="space-y-2 ml-6">
                <Label>Taxa de Multa (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={returnData.penalty_rate}
                  onChange={(e) => setReturnData(prev => ({ ...prev, penalty_rate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Parcelar em</Label>
              <Select 
                value={String(returnData.installments_count)} 
                onValueChange={(v) => setReturnData(prev => ({ ...prev, installments_count: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 1 ? 'Pagamento único' : `${n} parcelas`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Total Preview */}
            {selectedCheck && (
              <Card className="bg-red-50 dark:bg-red-900/20">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Valor do Cheque:</span>
                    <span>{formatCurrency(selectedCheck.nominal_value)}</span>
                  </div>
                  {returnData.apply_penalty && (
                    <div className="flex justify-between text-sm">
                      <span>Multa ({returnData.penalty_rate}%):</span>
                      <span className="text-red-600">
                        + {formatCurrency(selectedCheck.nominal_value * (returnData.penalty_rate / 100))}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total a Cobrar:</span>
                    <span className="text-red-600">
                      {formatCurrency(
                        selectedCheck.nominal_value + 
                        (returnData.apply_penalty ? selectedCheck.nominal_value * (returnData.penalty_rate / 100) : 0)
                      )}
                    </span>
                  </div>
                  {returnData.installments_count > 1 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{returnData.installments_count}x de:</span>
                      <span>
                        {formatCurrency(
                          (selectedCheck.nominal_value + 
                          (returnData.apply_penalty ? selectedCheck.nominal_value * (returnData.penalty_rate / 100) : 0)) 
                          / returnData.installments_count
                        )}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReturnDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleSubmitReturn}>
              Registrar Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <DollarSign className="h-5 w-5" />
              Registrar Pagamento
            </DialogTitle>
            <DialogDescription>
              Cheque #{selectedCheck?.check_number} - Dívida: {formatCurrency(selectedCheck?.total_debt || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedCheck && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total da Dívida:</span>
                  <span className="font-medium">{formatCurrency(selectedCheck.total_debt || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Já Pago:</span>
                  <span className="text-green-600">{formatCurrency(selectedCheck.total_paid_debt || 0)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Restante:</span>
                  <span className="text-orange-600">
                    {formatCurrency((selectedCheck.total_debt || 0) - (selectedCheck.total_paid_debt || 0))}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor do Pagamento</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Anotações sobre o pagamento..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitPayment} disabled={paymentAmount <= 0}>
              Registrar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cheque</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cheque #{selectedCheck?.check_number}? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
