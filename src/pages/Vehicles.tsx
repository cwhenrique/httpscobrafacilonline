import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useVehicles, useVehiclePayments, Vehicle, CreateVehicleData } from '@/hooks/useVehicles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { format, parseISO, isPast, isToday } from 'date-fns';
import { 
  Car, 
  CheckCircle,
  DollarSign,
  TrendingUp,
  Plus,
  Search,
  Check,
  Trash2,
  Edit,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { VehicleForm } from '@/components/VehicleForm';
import { useProfile } from '@/hooks/useProfile';
import { generateContractReceipt, ContractReceiptData, PaymentReceiptData } from '@/lib/pdfGenerator';
import ReceiptPreviewDialog from '@/components/ReceiptPreviewDialog';
import PaymentReceiptPrompt from '@/components/PaymentReceiptPrompt';

export default function Vehicles() {
  const { vehicles, isLoading: loading, createVehicle, updateVehicle, deleteVehicle, updateVehicleWithPayments } = useVehicles();
  const { payments: vehiclePaymentsList, markAsPaidFlexible } = useVehiclePayments();
  const { profile } = useProfile();

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
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
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Receipt preview states
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [receiptPreviewData, setReceiptPreviewData] = useState<ContractReceiptData | null>(null);

  // Payment receipt prompt states
  const [isPaymentReceiptOpen, setIsPaymentReceiptOpen] = useState(false);
  const [paymentClientPhone, setPaymentClientPhone] = useState<string | null>(null);
  const [paymentReceiptData, setPaymentReceiptData] = useState<PaymentReceiptData | null>(null);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  // Get vehicle payments
  const getVehiclePayments = (vehicleId: string) => {
    return vehiclePaymentsList?.filter(p => p.vehicle_id === vehicleId) || [];
  };

  // Helper to get vehicle status
  const getVehicleStatus = (vehicle: Vehicle): 'paid' | 'pending' | 'overdue' => {
    if (vehicle.status === 'paid') return 'paid';
    const hasOverdue = vehiclePaymentsList?.some(p => 
      p.vehicle_id === vehicle.id && 
      p.status === 'pending' && 
      isPast(parseISO(p.due_date)) && 
      !isToday(parseISO(p.due_date))
    );
    if (hasOverdue) return 'overdue';
    return 'pending';
  };

  // Filtered vehicles
  const filteredVehicles = vehicles?.filter(vehicle => {
    const matchesSearch = 
      vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vehicle.buyer_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return getVehicleStatus(vehicle) === statusFilter;
  }) || [];

  // Vehicle handlers
  const handleCreateVehicle = async (data: CreateVehicleData) => {
    await createVehicle.mutateAsync(data);
    setIsCreateOpen(false);
  };

  const openEditVehicleDialog = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsEditOpen(true);
  };

  const handleDeleteVehicle = async () => {
    if (!deleteVehicleId) return;
    await deleteVehicle.mutateAsync(deleteVehicleId);
    setDeleteVehicleId(null);
    toast.success('Veículo excluído com sucesso!');
  };

  const toggleVehicleExpand = (vehicleId: string) => {
    setExpandedVehicle(expandedVehicle === vehicleId ? null : vehicleId);
  };

  // Open vehicle payment dialog
  const openVehiclePaymentDialog = (payment: { id: string; amount: number; installment_number: number; due_date: string }, vehicle: Vehicle) => {
    setSelectedVehiclePaymentData({ paymentId: payment.id, vehicleId: vehicle.id, payment, vehicle });
    setPaymentAmount(payment.amount);
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setVehiclePaymentDialogOpen(true);
  };


  // Confirm vehicle payment with receipt prompt (flexible)
  const confirmVehiclePaymentWithReceipt = async () => {
    if (!selectedVehiclePaymentData) return;
    
    const { paymentId, vehicleId, payment, vehicle } = selectedVehiclePaymentData;
    
    await markAsPaidFlexible.mutateAsync({ 
      paymentId, 
      vehicleId,
      paidDate: paymentDate,
      paidAmount: paymentAmount,
      originalAmount: payment.amount,
    });
    
    setVehiclePaymentDialogOpen(false);
    setSelectedVehiclePaymentData(null);
    
    // Show payment receipt prompt
    const newRemainingBalance = Math.max(0, vehicle.remaining_balance - paymentAmount);
    setPaymentClientPhone(vehicle.buyer_phone || null);
    setPaymentReceiptData({
      type: 'vehicle',
      contractId: vehicle.id,
      companyName: profile?.company_name || profile?.full_name || 'CobraFácil',
      clientName: vehicle.buyer_name || vehicle.seller_name,
      installmentNumber: payment.installment_number,
      totalInstallments: vehicle.installments,
      amountPaid: paymentAmount,
      paymentDate: paymentDate,
      remainingBalance: newRemainingBalance,
      totalPaid: (vehicle.total_paid || 0) + paymentAmount,
    });
    setIsPaymentReceiptOpen(true);
  };

  // Receipt generation
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
      dueDates: vehiclePaymentsList?.filter(p => p.vehicle_id === vehicle.id).map(p => ({ date: p.due_date, isPaid: p.status === 'paid' })) || [],
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

  // Stats
  const stats = {
    total: vehicles?.length || 0,
    paid: vehicles?.filter(v => v.status === 'paid').length || 0,
    pending: vehicles?.filter(v => v.status === 'pending').length || 0,
    overdue: vehicles?.filter(v => {
      return vehiclePaymentsList?.some(p => 
        p.vehicle_id === v.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
    }).length || 0,
    totalValue: vehicles?.reduce((sum, v) => sum + Number(v.purchase_value), 0) || 0,
    totalReceived: vehicles?.reduce((sum, v) => sum + Number(v.total_paid || 0), 0) || 0,
    totalCost: vehicles?.reduce((sum, v) => sum + Number(v.cost_value || 0), 0) || 0,
    totalProfit: vehicles?.reduce((sum, v) => sum + (Number(v.purchase_value) - Number(v.cost_value || 0)), 0) || 0,
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">Veículos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie suas vendas de veículos
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Car className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quitados</p>
                  <p className="text-xl font-bold">{stats.paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalReceived)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lucro Total</p>
                  <p className="text-lg font-bold text-emerald-500">{formatCurrency(stats.totalProfit)}</p>
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
              placeholder="Buscar por marca, modelo ou comprador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Veículo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Veículo</DialogTitle>
              </DialogHeader>
              <VehicleForm billType="receivable" onSubmit={handleCreateVehicle} isPending={createVehicle.isPending} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            Todos ({stats.total})
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('pending')}
          >
            Em dia ({stats.pending - stats.overdue})
          </Button>
          <Button
            variant={statusFilter === 'overdue' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('overdue')}
            className={statusFilter === 'overdue' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            Em atraso ({stats.overdue})
          </Button>
          <Button
            variant={statusFilter === 'paid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('paid')}
            className={statusFilter === 'paid' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
          >
            <Check className="w-3 h-3 mr-1" />
            Quitados ({stats.paid})
          </Button>
        </div>

        {/* Vehicles Grid */}
        {filteredVehicles.length === 0 ? (
          <Card className="border-primary/30">
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum veículo cadastrado</p>
                <p className="text-sm">Clique em "Novo Veículo" para cadastrar</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {filteredVehicles.map((vehicle) => {
              const vehiclePaymentsForCard = getVehiclePayments(vehicle.id);
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

        {/* Edit Vehicle Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditingVehicle(null);
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Veículo</DialogTitle>
            </DialogHeader>
            {editingVehicle && (
              <VehicleForm
                billType="receivable"
                initialData={editingVehicle}
                existingPayments={getVehiclePayments(editingVehicle.id)}
                isEditing={true}
                onSubmit={async (data) => {
                  if (!editingVehicle) return;
                  await updateVehicleWithPayments.mutateAsync({ 
                    id: editingVehicle.id, 
                    data,
                    payments: data.custom_installments,
                  });
                  setIsEditOpen(false);
                  setEditingVehicle(null);
                }}
                isPending={updateVehicleWithPayments.isPending}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
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
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Valor Esperado:</span>
                    <span className="font-medium">{formatCurrency(selectedVehiclePaymentData.payment.amount)}</span>
                  </div>
                </div>

                {/* Editable Payment Amount */}
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Valor Pago (R$)</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="text-lg font-semibold"
                  />
                </div>

                {/* Underpayment Warning */}
                {paymentAmount < selectedVehiclePaymentData.payment.amount && paymentAmount > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-600">Pagamento Parcial</p>
                      <p className="text-muted-foreground">
                        Será criada uma nova parcela de{' '}
                        <span className="font-semibold text-amber-600">
                          {formatCurrency(selectedVehiclePaymentData.payment.amount - paymentAmount)}
                        </span>{' '}
                        para o valor restante.
                      </p>
                    </div>
                  </div>
                )}

                {/* Overpayment Notice */}
                {paymentAmount > selectedVehiclePaymentData.payment.amount && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <TrendingUp className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-emerald-600">Pagamento a Mais</p>
                      <p className="text-muted-foreground">
                        O excedente de{' '}
                        <span className="font-semibold text-emerald-600">
                          {formatCurrency(paymentAmount - selectedVehiclePaymentData.payment.amount)}
                        </span>{' '}
                        será abatido do saldo total.
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment Date */}
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Data do Pagamento</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setVehiclePaymentDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={confirmVehiclePaymentWithReceipt} 
                disabled={markAsPaidFlexible.isPending || paymentAmount <= 0} 
                className="flex-1"
              >
                {markAsPaidFlexible.isPending ? 'Processando...' : 'Confirmar Pagamento'}
              </Button>
            </div>
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
      </div>
    </DashboardLayout>
  );
}
