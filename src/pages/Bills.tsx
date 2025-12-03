import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { useBills, Bill, CreateBillData } from '@/hooks/useBills';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Check, Trash2, Edit, Calendar, User, DollarSign, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Bills() {
  const { bills, isLoading, createBill, updateBill, deleteBill, markAsPaid } = useBills();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');

  // Form state
  const [formData, setFormData] = useState<CreateBillData>({
    description: '',
    payee_name: '',
    amount: 0,
    due_date: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      description: '',
      payee_name: '',
      amount: 0,
      due_date: '',
      notes: '',
    });
  };

  const handleCreate = async () => {
    if (!formData.payee_name || !formData.amount || !formData.due_date) {
      return;
    }
    await createBill.mutateAsync(formData);
    setIsCreateOpen(false);
    resetForm();
  };

  const handleEdit = async () => {
    if (!editingBill) return;
    await updateBill.mutateAsync({
      id: editingBill.id,
      data: {
        description: formData.description,
        payee_name: formData.payee_name,
        amount: formData.amount,
        due_date: formData.due_date,
        notes: formData.notes,
      },
    });
    setIsEditOpen(false);
    setEditingBill(null);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteBill.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const openEditDialog = (bill: Bill) => {
    setEditingBill(bill);
    setFormData({
      description: bill.description,
      payee_name: bill.payee_name,
      amount: bill.amount,
      due_date: bill.due_date,
      notes: bill.notes || '',
    });
    setIsEditOpen(true);
  };

  const getBillStatus = (bill: Bill) => {
    if (bill.status === 'paid') return 'paid';
    const dueDate = parseISO(bill.due_date);
    if (isPast(dueDate) && !isToday(dueDate)) return 'overdue';
    return 'pending';
  };

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.payee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    const status = getBillStatus(bill);
    if (filter === 'all') return true;
    if (filter === 'overdue') return status === 'overdue';
    return status === filter;
  });

  const getCardStyle = (bill: Bill) => {
    const status = getBillStatus(bill);
    if (status === 'paid') return 'bg-primary/10 border-primary';
    if (status === 'overdue') return 'bg-destructive/10 border-destructive';
    return 'bg-card';
  };

  const getStatusBadge = (bill: Bill) => {
    const status = getBillStatus(bill);
    if (status === 'paid') {
      return <Badge className="bg-primary text-primary-foreground">Pago</Badge>;
    }
    if (status === 'overdue') {
      return <Badge variant="destructive">Atrasado</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const stats = {
    total: bills.length,
    pending: bills.filter((b) => getBillStatus(b) === 'pending').length,
    overdue: bills.filter((b) => getBillStatus(b) === 'overdue').length,
    paid: bills.filter((b) => getBillStatus(b) === 'paid').length,
    totalAmount: bills.filter((b) => getBillStatus(b) !== 'paid').reduce((acc, b) => acc + b.amount, 0),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Contas a Pagar</h1>
            <p className="text-muted-foreground">Gerencie suas contas e despesas</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Conta a Pagar</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="payee_name">Pagar para *</Label>
                  <Input
                    id="payee_name"
                    placeholder="Nome da pessoa ou empresa"
                    value={formData.payee_name}
                    onChange={(e) => setFormData({ ...formData, payee_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    placeholder="Ex: Aluguel, Conta de luz..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor (R$) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Vencimento *</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    placeholder="Notas adicionais..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.payee_name || !formData.description || !formData.amount || !formData.due_date || createBill.isPending}
                  className="w-full"
                >
                  {createBill.isPending ? 'Salvando...' : 'Cadastrar Conta'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Contas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.overdue}</p>
                  <p className="text-xs text-muted-foreground">Atrasadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.paid}</p>
                  <p className="text-xs text-muted-foreground">Pagas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Total Pending */}
        <Card className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total a Pagar (Pendentes + Atrasadas)</p>
                <p className="text-3xl font-bold text-orange-600">
                  R$ {stats.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todas
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pendentes
            </Button>
            <Button
              variant={filter === 'overdue' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('overdue')}
            >
              Atrasadas
            </Button>
            <Button
              variant={filter === 'paid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('paid')}
            >
              Pagas
            </Button>
          </div>
        </div>

        {/* Bills List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando contas...</p>
          </div>
        ) : filteredBills.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold mb-2">Nenhuma conta encontrada</h3>
              <p className="text-muted-foreground text-sm">
                {searchTerm ? 'Tente ajustar sua busca' : 'Clique em "Nova Conta" para cadastrar'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredBills.map((bill) => (
              <Card key={bill.id} className={cn('transition-all', getCardStyle(bill))}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">{bill.payee_name}</p>
                        <p className="text-sm text-muted-foreground">{bill.description}</p>
                      </div>
                    </div>
                    {getStatusBadge(bill)}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valor</span>
                      <span className="font-bold text-lg">
                        R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Vencimento</span>
                      <span className="text-sm">
                        {format(parseISO(bill.due_date), "dd 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                    {bill.paid_date && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Pago em</span>
                        <span className="text-sm text-primary">
                          {format(parseISO(bill.paid_date), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    {bill.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">"{bill.notes}"</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {getBillStatus(bill) !== 'paid' && (
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 gap-1"
                        onClick={() => markAsPaid.mutateAsync(bill.id)}
                        disabled={markAsPaid.isPending}
                      >
                        <Check className="w-3 h-3" />
                        Pagar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(bill)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteId(bill.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Conta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit_payee_name">Pagar para *</Label>
                <Input
                  id="edit_payee_name"
                  value={formData.payee_name}
                  onChange={(e) => setFormData({ ...formData, payee_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_description">Descrição *</Label>
                <Input
                  id="edit_description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_amount">Valor (R$) *</Label>
                  <Input
                    id="edit_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_due_date">Vencimento *</Label>
                  <Input
                    id="edit_due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_notes">Observações</Label>
                <Textarea
                  id="edit_notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <Button
                onClick={handleEdit}
                disabled={!formData.payee_name || !formData.description || !formData.amount || !formData.due_date || updateBill.isPending}
                className="w-full"
              >
                {updateBill.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
