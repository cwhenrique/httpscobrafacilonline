import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { useProductSales, useProductSalePayments, ProductSale, CreateProductSaleData, InstallmentDate } from '@/hooks/useProductSales';
import { format, parseISO, isPast, isToday, addMonths, getDate, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Check, Trash2, Edit, ShoppingBag, User, DollarSign, Calendar, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ProductSales() {
  const { sales, isLoading, createSale, updateSale, deleteSale } = useProductSales();
  const { payments: allPayments, markAsPaid } = useProductSalePayments();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<ProductSale | null>(null);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [installmentDates, setInstallmentDates] = useState<InstallmentDate[]>([]);

  const [formData, setFormData] = useState<CreateProductSaleData>({
    product_name: '',
    product_description: '',
    client_name: '',
    client_phone: '',
    client_email: '',
    sale_date: format(new Date(), 'yyyy-MM-dd'),
    total_amount: 0,
    down_payment: 0,
    installments: 1,
    installment_value: 0,
    first_due_date: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      product_name: '',
      product_description: '',
      client_name: '',
      client_phone: '',
      client_email: '',
      sale_date: format(new Date(), 'yyyy-MM-dd'),
      total_amount: 0,
      down_payment: 0,
      installments: 1,
      installment_value: 0,
      first_due_date: '',
      notes: '',
    });
    setInstallmentDates([]);
  };

  // Generate installment dates when first_due_date or installments change
  useEffect(() => {
    if (formData.first_due_date && formData.installments > 0) {
      const firstDate = new Date(formData.first_due_date);
      const dayOfMonth = getDate(firstDate);
      
      const dates: InstallmentDate[] = [];
      for (let i = 0; i < formData.installments; i++) {
        let dueDate = addMonths(firstDate, i);
        // Try to keep the same day of month
        try {
          dueDate = setDate(dueDate, dayOfMonth);
        } catch {
          // If day doesn't exist in month (e.g., 31 in Feb), use last day of month
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

  const handleCreate = async () => {
    // Pass installment dates to the hook
    await createSale.mutateAsync({ ...formData, installmentDates });
    setIsCreateOpen(false);
    resetForm();
  };

  const openEditDialog = (sale: ProductSale) => {
    setEditingSale(sale);
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
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

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteSale.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    await markAsPaid.mutateAsync({
      paymentId,
      paidDate: format(new Date(), 'yyyy-MM-dd'),
    });
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

  const filteredSales = sales?.filter(sale =>
    sale.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getSalePayments = (saleId: string) => {
    return allPayments?.filter(p => p.product_sale_id === saleId) || [];
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

  const stats = {
    totalSales: filteredSales.length,
    totalValue: filteredSales.reduce((acc, s) => acc + s.total_amount, 0),
    totalReceived: filteredSales.reduce((acc, s) => acc + (s.total_paid || 0), 0),
    pending: filteredSales.reduce((acc, s) => acc + s.remaining_balance, 0),
  };

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">Vendas de Produtos</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas vendas de produtos</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold">{stats.totalSales}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Vendas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:text-xl font-bold text-blue-500 truncate">
                    {formatCurrency(stats.totalValue)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Vendido</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:text-xl font-bold text-primary truncate">
                    {formatCurrency(stats.totalReceived)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Recebido</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:text-xl font-bold text-yellow-500 truncate">
                    {formatCurrency(stats.pending)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">A Receber</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Create */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-center sm:justify-between">
          <div className="relative flex-1 w-full sm:max-w-md">
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
                <div className="space-y-2">
                  <Label>E-mail do Cliente</Label>
                  <Input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
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
                    <Label>Valor Total (R$) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.total_amount || ''}
                      onChange={(e) => handleTotalChange(parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                    />
                  </div>
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

                {/* Installment Dates */}
                {installmentDates.length > 1 && (
                  <div className="space-y-2">
                    <Label>Datas das Parcelas</Label>
                    <ScrollArea className="h-[200px] rounded-md border p-3">
                      <div className="space-y-2">
                        {installmentDates.map((inst, index) => (
                          <div key={inst.number} className="flex items-center gap-3">
                            <Badge variant="outline" className="w-16 justify-center text-xs">
                              {inst.number}ª
                            </Badge>
                            <Input
                              type="date"
                              value={inst.date}
                              onChange={(e) => updateInstallmentDate(index, e.target.value)}
                              className="flex-1"
                            />
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(inst.date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notas adicionais..."
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.product_name || !formData.client_name || !formData.total_amount || !formData.first_due_date || createSale.isPending}
                  className="w-full"
                >
                  {createSale.isPending ? 'Salvando...' : 'Cadastrar Venda'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sales List */}
        <div className="space-y-3">
          {filteredSales.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma venda encontrada</h3>
                <p className="text-muted-foreground">Cadastre sua primeira venda de produto.</p>
              </CardContent>
            </Card>
          ) : (
            filteredSales.map((sale) => {
              const salePayments = getSalePayments(sale.id);
              const isExpanded = expandedSale === sale.id;

              return (
                <Card key={sale.id} className={cn(
                  "transition-all",
                  sale.status === 'paid' && "bg-primary/5 border-primary/20"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-primary flex-shrink-0" />
                          <h3 className="font-semibold truncate">{sale.product_name}</h3>
                          {getStatusBadge(sale.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <User className="w-3.5 h-3.5" />
                          <span>{sale.client_name}</span>
                          {sale.client_phone && (
                            <span className="text-xs">• {sale.client_phone}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Total:</span>
                            <p className="font-medium">{formatCurrency(sale.total_amount)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pago:</span>
                            <p className="font-medium text-primary">{formatCurrency(sale.total_paid || 0)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Restante:</span>
                            <p className="font-medium">{formatCurrency(sale.remaining_balance)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Parcelas:</span>
                            <p className="font-medium">{sale.installments}x de {formatCurrency(sale.installment_value)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(sale)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(sale.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expandable Payments */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <h4 className="font-medium text-sm mb-3">Parcelas</h4>
                        {salePayments.map((payment) => {
                          const isPaid = payment.status === 'paid';
                          const isOverdue = !isPaid && isPast(parseISO(payment.due_date)) && !isToday(parseISO(payment.due_date));
                          const isDueToday = !isPaid && isToday(parseISO(payment.due_date));

                          return (
                            <div
                              key={payment.id}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg",
                                isPaid && "bg-primary/10",
                                isOverdue && "bg-destructive/10",
                                isDueToday && "bg-yellow-500/10",
                                !isPaid && !isOverdue && !isDueToday && "bg-muted/50"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-xs">
                                  {payment.installment_number}/{sale.installments}
                                </Badge>
                                <div>
                                  <p className="font-medium text-sm">{formatCurrency(payment.amount)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Venc: {format(parseISO(payment.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(payment.status, payment.due_date)}
                                {!isPaid && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => handleMarkAsPaid(payment.id)}
                                    disabled={markAsPaid.isPending}
                                  >
                                    <Check className="w-3 h-3" />
                                    Pagar
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Venda</DialogTitle>
            </DialogHeader>
            {editingSale && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Produto</Label>
                  <Input
                    value={editingSale.product_name}
                    onChange={(e) => setEditingSale({ ...editingSale, product_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={editingSale.product_description || ''}
                    onChange={(e) => setEditingSale({ ...editingSale, product_description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Cliente</Label>
                    <Input
                      value={editingSale.client_name}
                      onChange={(e) => setEditingSale({ ...editingSale, client_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={editingSale.client_phone || ''}
                      onChange={(e) => setEditingSale({ ...editingSale, client_phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    value={editingSale.client_email || ''}
                    onChange={(e) => setEditingSale({ ...editingSale, client_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={editingSale.notes || ''}
                    onChange={(e) => setEditingSale({ ...editingSale, notes: e.target.value })}
                  />
                </div>
                <Button onClick={handleEdit} disabled={updateSale.isPending} className="w-full">
                  {updateSale.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Venda</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.
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
      </div>
    </DashboardLayout>
  );
}
