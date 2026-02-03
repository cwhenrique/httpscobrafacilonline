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

export default function CheckDiscounts() {
  const { effectiveUserId } = useEmployeeContext();
  const { 
    filteredChecks, 
    loading, 
    stats, 
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

  // Calculated values for form preview
  const calculatedValues = useMemo(() => {
    if (!formData.nominal_value || !formData.due_date || !formData.discount_date) {
      return { days: 0, discountAmount: 0, netValue: 0, effectiveRate: 0 };
    }

    const days = getDaysUntilDue(formData.discount_date, formData.due_date);
    const discountAmount = calculateDiscountAmount(
      formData.nominal_value,
      formData.discount_rate,
      formData.discount_type,
      days
    );
    const netValue = calculateNetValue(formData.nominal_value, discountAmount);
    const effectiveRate = formData.discount_type === 'proportional' 
      ? (formData.discount_rate / 30) * days 
      : formData.discount_rate;

    return { days, discountAmount, netValue, effectiveRate };
  }, [formData]);

  // Client risk check
  const selectedClientRisk = useMemo(() => {
    if (!formData.client_id) return null;
    return getClientCheckHistory(formData.client_id);
  }, [formData.client_id, getClientCheckHistory]);

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
    });
    setSelectedCheck(null);
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
        discount_type: check.discount_type,
        discount_rate: check.discount_rate,
        payment_method: check.payment_method,
        notes: check.notes || '',
      });
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

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, banco, emitente ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CheckDiscountStatus | 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="in_wallet">Em Carteira</SelectItem>
              <SelectItem value="compensated">Compensados</SelectItem>
              <SelectItem value="returned">Devolvidos</SelectItem>
              <SelectItem value="in_collection">Em Cobrança</SelectItem>
            </SelectContent>
          </Select>
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
            {filteredChecks.map((check) => {
              const daysUntilDue = getDaysUntilDue(format(new Date(), 'yyyy-MM-dd'), check.due_date);
              const isOverdue = daysUntilDue < 0 && check.status === 'in_wallet';
              const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7 && check.status === 'in_wallet';
              
              return (
                <Card 
                  key={check.id} 
                  className={`transition-all ${
                    isOverdue ? 'border-red-300 dark:border-red-800' : 
                    isDueSoon ? 'border-orange-300 dark:border-orange-800' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Status Badge & Check Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getStatusColor(check.status)}>
                            {getStatusLabel(check.status)}
                          </Badge>
                          <span className="font-mono font-medium">#{check.check_number}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {check.bank_name}
                          </span>
                          {isDueSoon && (
                            <Badge variant="outline" className="border-orange-300 text-orange-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Vence em {daysUntilDue} dias
                            </Badge>
                          )}
                          {isOverdue && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Vencido há {Math.abs(daysUntilDue)} dias
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          {check.clients && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {check.clients.full_name}
                            </span>
                          )}
                          {check.issuer_name && (
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              {check.issuer_name}
                              {check.issuer_document && ` (${formatCPFCNPJ(check.issuer_document)})`}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Vence: {format(new Date(check.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </span>
                        </div>

                        {/* Values */}
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <span>
                            <span className="text-muted-foreground">Valor:</span>{' '}
                            <span className="font-medium">{formatCurrency(check.nominal_value)}</span>
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span>
                            <span className="text-muted-foreground">Líquido:</span>{' '}
                            <span className="font-medium text-primary">{formatCurrency(check.net_value)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            ({check.discount_rate}% {check.discount_type === 'proportional' ? 'proporcional' : 'fixo'})
                          </span>
                        </div>

                        {/* Debt info for returned/in_collection checks */}
                        {(check.status === 'returned' || check.status === 'in_collection') && (
                          <div className="flex items-center gap-4 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-lg flex-wrap">
                            <span className="text-red-600 dark:text-red-400">
                              <span className="font-medium">Dívida:</span> {formatCurrency(check.total_debt || 0)}
                            </span>
                            <span className="text-green-600 dark:text-green-400">
                              <span className="font-medium">Pago:</span> {formatCurrency(check.total_paid_debt || 0)}
                            </span>
                            <span className="text-orange-600 dark:text-orange-400">
                              <span className="font-medium">Restante:</span>{' '}
                              {formatCurrency((check.total_debt || 0) - (check.total_paid_debt || 0))}
                            </span>
                            {check.installments_count > 1 && (
                              <Badge variant="outline">{check.installments_count}x</Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {check.status === 'in_wallet' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-green-600 border-green-300 hover:bg-green-50"
                              onClick={() => handleCompensate(check)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Compensar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => handleOpenReturn(check)}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Devolver
                            </Button>
                          </>
                        )}
                        {check.status === 'in_collection' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-primary"
                            onClick={() => handleOpenPayment(check)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Receber
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleOpenForm(check)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedCheck(check);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

            {/* Discount Calculation */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Cálculo do Desconto
              </h4>

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

              {/* Calculation Preview */}
              {formData.nominal_value > 0 && formData.due_date && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor Nominal:</span>
                      <span className="font-medium">{formatCurrency(formData.nominal_value)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dias até vencimento:</span>
                      <span className="font-medium">{calculatedValues.days} dias</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa efetiva:</span>
                      <span className="font-medium">{calculatedValues.effectiveRate.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor do Desconto:</span>
                      <span className="font-medium text-red-600">- {formatCurrency(calculatedValues.discountAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-medium">Valor Líquido:</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(calculatedValues.netValue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lucro Esperado:</span>
                      <span className="font-medium text-green-600">{formatCurrency(calculatedValues.discountAmount)}</span>
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
