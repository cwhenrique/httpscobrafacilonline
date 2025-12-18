import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useBills, Bill, BillCategory, CreateBillData } from '@/hooks/useBills';
import { format, parseISO, isToday, isPast, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Check, Pencil, Trash2, Zap, Droplets, Wifi, Smartphone, CreditCard, Home, Car, Shield, Scissors, Tv, ShoppingCart, Heart, GraduationCap, Package, Calendar, AlertTriangle, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

// Categorias com ícones e cores
const BILL_CATEGORIES: { value: BillCategory; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'energia', label: 'Energia/Luz', icon: Zap, color: 'text-yellow-500' },
  { value: 'agua', label: 'Água', icon: Droplets, color: 'text-blue-500' },
  { value: 'internet', label: 'Internet', icon: Wifi, color: 'text-purple-500' },
  { value: 'telefone', label: 'Telefone/Celular', icon: Smartphone, color: 'text-green-500' },
  { value: 'cartao', label: 'Cartão de Crédito', icon: CreditCard, color: 'text-red-500' },
  { value: 'aluguel', label: 'Aluguel', icon: Home, color: 'text-orange-500' },
  { value: 'financiamento', label: 'Financiamento', icon: Car, color: 'text-slate-500' },
  { value: 'seguro', label: 'Seguro', icon: Shield, color: 'text-cyan-500' },
  { value: 'servicos', label: 'Serviços Pessoais', icon: Scissors, color: 'text-pink-500' },
  { value: 'streaming', label: 'Streaming', icon: Tv, color: 'text-rose-500' },
  { value: 'supermercado', label: 'Supermercado', icon: ShoppingCart, color: 'text-emerald-500' },
  { value: 'saude', label: 'Saúde/Plano', icon: Heart, color: 'text-red-400' },
  { value: 'educacao', label: 'Educação', icon: GraduationCap, color: 'text-indigo-500' },
  { value: 'outros', label: 'Outros', icon: Package, color: 'text-muted-foreground' },
];

const getCategoryInfo = (category: BillCategory) => {
  return BILL_CATEGORIES.find(c => c.value === category) || BILL_CATEGORIES[BILL_CATEGORIES.length - 1];
};

type FilterType = 'all' | 'pending' | 'overdue' | 'paid' | 'today';

export default function Bills() {
  const { bills, isLoading, createBill, updateBill, deleteBill, markAsPaid } = useBills();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateBillData>({
    description: '',
    payee_name: '',
    amount: 0,
    due_date: format(new Date(), 'yyyy-MM-dd'),
    category: 'outros',
    is_recurring: false,
    recurrence_months: null,
    pix_key: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      description: '',
      payee_name: '',
      amount: 0,
      due_date: format(new Date(), 'yyyy-MM-dd'),
      category: 'outros',
      is_recurring: false,
      recurrence_months: null,
      pix_key: '',
      notes: '',
    });
  };

  // Filtros do mês atual
  const currentMonthBills = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    return bills.filter(bill => {
      const dueDate = parseISO(bill.due_date);
      return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
    });
  }, [bills]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = currentMonthBills.reduce((acc, bill) => acc + Number(bill.amount), 0);
    const pending = currentMonthBills.filter(b => b.status === 'pending');
    const paid = currentMonthBills.filter(b => b.status === 'paid');
    const overdue = currentMonthBills.filter(b => b.status === 'overdue' || (b.status === 'pending' && isPast(parseISO(b.due_date)) && !isToday(parseISO(b.due_date))));
    const dueToday = currentMonthBills.filter(b => b.status === 'pending' && isToday(parseISO(b.due_date)));
    
    const pendingTotal = pending.reduce((acc, bill) => acc + Number(bill.amount), 0);
    const paidTotal = paid.reduce((acc, bill) => acc + Number(bill.amount), 0);
    
    return { total, pending: pending.length, paid: paid.length, overdue: overdue.length, dueToday: dueToday.length, pendingTotal, paidTotal };
  }, [currentMonthBills]);

  // Filtrar contas
  const filteredBills = useMemo(() => {
    let filtered = [...bills];

    // Filtro por status
    if (filter === 'pending') {
      filtered = filtered.filter(b => b.status === 'pending' && !isPast(parseISO(b.due_date)));
    } else if (filter === 'overdue') {
      filtered = filtered.filter(b => b.status === 'overdue' || (b.status === 'pending' && isPast(parseISO(b.due_date)) && !isToday(parseISO(b.due_date))));
    } else if (filter === 'paid') {
      filtered = filtered.filter(b => b.status === 'paid');
    } else if (filter === 'today') {
      filtered = filtered.filter(b => b.status === 'pending' && isToday(parseISO(b.due_date)));
    }

    // Busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.description.toLowerCase().includes(term) || 
        b.payee_name.toLowerCase().includes(term)
      );
    }

    // Ordenar por data de vencimento
    filtered.sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime());

    return filtered;
  }, [bills, filter, searchTerm]);

  const handleCreate = async () => {
    if (!formData.description || !formData.payee_name || !formData.amount) {
      toast.error('Preencha todos os campos obrigatórios');
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
        category: formData.category,
        is_recurring: formData.is_recurring,
        recurrence_months: formData.recurrence_months,
        pix_key: formData.pix_key,
        notes: formData.notes,
      }
    });
    setEditingBill(null);
    resetForm();
  };

  const openEditDialog = (bill: Bill) => {
    setFormData({
      description: bill.description,
      payee_name: bill.payee_name,
      amount: bill.amount,
      due_date: bill.due_date,
      category: bill.category || 'outros',
      is_recurring: bill.is_recurring || false,
      recurrence_months: bill.recurrence_months ?? null,
      pix_key: bill.pix_key || '',
      notes: bill.notes || '',
    });
    setEditingBill(bill);
  };

  const getBillStatus = (bill: Bill) => {
    if (bill.status === 'paid') return 'paid';
    const dueDate = parseISO(bill.due_date);
    if (isToday(dueDate)) return 'today';
    if (isPast(dueDate)) return 'overdue';
    return 'pending';
  };

  const getStatusBadge = (bill: Bill) => {
    const status = getBillStatus(bill);
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Paga</Badge>;
      case 'today':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Vence Hoje</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Atrasada</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Pendente</Badge>;
    }
  };

  const BillForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nome da Conta *</Label>
          <Input
            placeholder="Ex: Luz de Janeiro, Cartão Nubank..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label>Fornecedor/Empresa *</Label>
          <Input
            placeholder="Ex: CEMIG, Vivo, Nubank..."
            value={formData.payee_name}
            onChange={(e) => setFormData({ ...formData, payee_name: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label>Chave PIX do Fornecedor (opcional)</Label>
          <Input
            placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
            value={formData.pix_key || ''}
            onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
            A chave PIX será incluída nos lembretes. Verifique se está correta — a responsabilidade é sua.
          </p>
        </div>
        <div>
          <Label>Valor *</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={formData.amount || ''}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>Vencimento *</Label>
          <Input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label>Categoria</Label>
          <Select
            value={formData.category}
            onValueChange={(value: BillCategory) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {BILL_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${cat.color}`} />
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={formData.is_recurring}
              onCheckedChange={(checked) => setFormData({ 
                ...formData, 
                is_recurring: checked,
                recurrence_months: checked ? formData.recurrence_months : null
              })}
            />
            <Label className="cursor-pointer" onClick={() => setFormData({ 
              ...formData, 
              is_recurring: !formData.is_recurring,
              recurrence_months: !formData.is_recurring ? formData.recurrence_months : null
            })}>
              Conta recorrente (mensal)
            </Label>
          </div>
          
          {formData.is_recurring && (
            <div className="ml-8 space-y-2 p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm text-muted-foreground">
                Por quantos meses? (deixe vazio para sempre)
              </Label>
              <Input
                type="number"
                min="1"
                max="120"
                placeholder="Sempre (infinito)"
                value={formData.recurrence_months || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  recurrence_months: e.target.value ? parseInt(e.target.value) : null 
                })}
                className="w-40"
              />
              <p className="text-xs text-muted-foreground">
                {formData.recurrence_months 
                  ? `A conta será criada por ${formData.recurrence_months} meses` 
                  : 'A conta será criada todo mês automaticamente'}
              </p>
            </div>
          )}
        </div>
        <div className="col-span-2">
          <Label>Observações</Label>
          <Textarea
            placeholder="Anotações adicionais..."
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>
      </div>
      <Button onClick={onSubmit} className="w-full" disabled={createBill.isPending || updateBill.isPending}>
        {createBill.isPending || updateBill.isPending ? 'Salvando...' : submitLabel}
      </Button>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Minhas Contas a Pagar</h1>
            <p className="text-muted-foreground">Gerencie suas contas do dia a dia</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Nova Conta</DialogTitle>
              </DialogHeader>
              <BillForm onSubmit={handleCreate} submitLabel="Cadastrar Conta" />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total do Mês</p>
                  <p className="text-xl font-bold">R$ {stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Atrasadas</p>
                  <p className="text-xl font-bold">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pagas</p>
                  <p className="text-xl font-bold">{stats.paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'today', label: 'Vence Hoje' },
              { value: 'pending', label: 'Pendentes' },
              { value: 'overdue', label: 'Atrasadas' },
              { value: 'paid', label: 'Pagas' },
            ].map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f.value as FilterType)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Bills List */}
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Carregando...</div>
        ) : filteredBills.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma conta encontrada</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira conta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBills.map((bill) => {
              const categoryInfo = getCategoryInfo(bill.category || 'outros');
              const CategoryIcon = categoryInfo.icon;
              const status = getBillStatus(bill);

              return (
                <Card 
                  key={bill.id} 
                  className={`relative overflow-hidden transition-all hover:shadow-md ${
                    status === 'overdue' ? 'border-red-500/50 bg-red-500/5' :
                    status === 'today' ? 'border-yellow-500/50 bg-yellow-500/5' :
                    status === 'paid' ? 'border-green-500/50 bg-green-500/5' : ''
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-muted ${categoryInfo.color}`}>
                          <CategoryIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{bill.description}</CardTitle>
                          <p className="text-sm text-muted-foreground">{bill.payee_name}</p>
                        </div>
                      </div>
                      {getStatusBadge(bill)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-2xl font-bold">R$ {Number(bill.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Vence {format(parseISO(bill.due_date), "dd 'de' MMM", { locale: ptBR })}</span>
                        </div>
                      </div>
                      {bill.is_recurring && (
                        <Badge variant="outline" className="text-xs">Recorrente</Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {status !== 'paid' && (
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => markAsPaid.mutateAsync(bill.id)}
                          disabled={markAsPaid.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Pagar
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openEditDialog(bill)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir "{bill.description}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteBill.mutateAsync(bill.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingBill} onOpenChange={(open) => { if (!open) { setEditingBill(null); resetForm(); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Conta</DialogTitle>
            </DialogHeader>
            <BillForm onSubmit={handleEdit} submitLabel="Salvar Alterações" />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
