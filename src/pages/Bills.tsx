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
import { Plus, Search, Check, Pencil, Trash2, Zap, Droplets, Wifi, Smartphone, CreditCard, Home, Car, Shield, Scissors, Tv, ShoppingCart, Heart, GraduationCap, Package, Calendar, AlertTriangle, CheckCircle2, Clock, DollarSign, Copy, TrendingUp, Wallet } from 'lucide-react';
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
  { value: 'investimentos', label: 'Investimentos', icon: TrendingUp, color: 'text-emerald-600' },
  { value: 'outros', label: 'Outros', icon: Package, color: 'text-muted-foreground' },
];

const getCategoryInfo = (category: BillCategory) => {
  return BILL_CATEGORIES.find(c => c.value === category) || BILL_CATEGORIES[BILL_CATEGORIES.length - 1];
};

type FilterType = 'all' | 'pending' | 'overdue' | 'paid' | 'today';

// Interface para props do BillForm
interface BillFormProps {
  formData: CreateBillData;
  setFormData: React.Dispatch<React.SetStateAction<CreateBillData>>;
  onSubmit: () => void;
  submitLabel: string;
  isLoading: boolean;
}

// BillForm movido para fora do componente Bills para evitar perda de foco
const BillForm = ({ formData, setFormData, onSubmit, submitLabel, isLoading }: BillFormProps) => (
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
        <Label>
          {formData.category === 'cartao' ? 'Valor da Fatura (opcional)' : 'Valor *'}
        </Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder={formData.category === 'cartao' ? 'Deixe vazio se não souber ainda' : '0,00'}
          value={formData.amount || ''}
          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
        />
        {formData.category === 'cartao' && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <CreditCard className="h-3 w-3" />
            Você pode atualizar o valor quando a fatura fechar
          </p>
        )}
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
    <Button onClick={onSubmit} className="w-full" disabled={isLoading}>
      {isLoading ? 'Salvando...' : submitLabel}
    </Button>
  </div>
);

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
    const totalCount = currentMonthBills.length;
    const total = currentMonthBills.reduce((acc, bill) => acc + Number(bill.amount), 0);
    const pending = currentMonthBills.filter(b => b.status === 'pending' && !isPast(parseISO(b.due_date)));
    const paid = currentMonthBills.filter(b => b.status === 'paid');
    const overdue = currentMonthBills.filter(b => b.status === 'overdue' || (b.status === 'pending' && isPast(parseISO(b.due_date)) && !isToday(parseISO(b.due_date))));
    const dueToday = currentMonthBills.filter(b => b.status === 'pending' && isToday(parseISO(b.due_date)));
    
    const pendingTotal = pending.reduce((acc, bill) => acc + Number(bill.amount), 0);
    const paidTotal = paid.reduce((acc, bill) => acc + Number(bill.amount), 0);
    const overdueTotal = overdue.reduce((acc, bill) => acc + Number(bill.amount), 0);
    const dueTodayTotal = dueToday.reduce((acc, bill) => acc + Number(bill.amount), 0);
    
    // Falta pagar (não pagas = pendentes + atrasadas + vence hoje)
    const unpaidCount = pending.length + overdue.length + dueToday.length;
    const unpaidTotal = pendingTotal + overdueTotal + dueTodayTotal;
    
    return { 
      total, 
      totalCount,
      pendingCount: pending.length, 
      paidCount: paid.length, 
      overdueCount: overdue.length, 
      dueTodayCount: dueToday.length, 
      pendingTotal, 
      paidTotal,
      overdueTotal,
      dueTodayTotal,
      unpaidCount,
      unpaidTotal
    };
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
    // Valor é opcional apenas para cartão de crédito
    const isAmountRequired = formData.category !== 'cartao';
    if (!formData.description || !formData.payee_name || (isAmountRequired && !formData.amount)) {
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
              <BillForm formData={formData} setFormData={setFormData} onSubmit={handleCreate} submitLabel="Cadastrar Conta" isLoading={createBill.isPending} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Total do Mês */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total do Mês</p>
                  <p className="text-xl font-bold">R$ {stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">{stats.totalCount} conta{stats.totalCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Falta Pagar */}
          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-8 w-8 text-violet-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Falta Pagar</p>
                  <p className="text-xl font-bold">R$ {stats.unpaidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">{stats.unpaidCount} conta{stats.unpaidCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Pendentes */}
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-xl font-bold">R$ {stats.pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">{stats.pendingCount} conta{stats.pendingCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Atrasadas */}
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Atrasadas</p>
                  <p className="text-xl font-bold">R$ {stats.overdueTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">{stats.overdueCount} conta{stats.overdueCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Pagas */}
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pagas</p>
                  <p className="text-xl font-bold">R$ {stats.paidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">{stats.paidCount} conta{stats.paidCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Vencem Hoje */}
          {stats.dueTodayCount > 0 && (
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Vence Hoje</p>
                    <p className="text-xl font-bold">R$ {stats.dueTodayTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">{stats.dueTodayCount} conta{stats.dueTodayCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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

              // Cores sólidas para diferenciar de empréstimos (que usam transparência)
              const getCardStyle = () => {
                switch (status) {
                  case 'overdue':
                    return 'bg-red-600 border-red-700';
                  case 'today':
                    return 'bg-amber-500 border-amber-600';
                  case 'paid':
                    return 'bg-emerald-600 border-emerald-700';
                  default:
                    return 'bg-slate-700 border-slate-600 dark:bg-slate-800 dark:border-slate-700';
                }
              };

              return (
                <Card 
                  key={bill.id} 
                  className={`relative overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02] ${getCardStyle()} text-white`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/20">
                          <CategoryIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base text-white">{bill.description}</CardTitle>
                          <p className="text-sm text-white/80">{bill.payee_name}</p>
                        </div>
                      </div>
                      <Badge 
                        className={`${
                          status === 'paid' ? 'bg-white/20 text-white border-white/30' :
                          status === 'overdue' ? 'bg-white/20 text-white border-white/30' :
                          status === 'today' ? 'bg-white/20 text-white border-white/30' :
                          'bg-white/20 text-white border-white/30'
                        }`}
                      >
                        {status === 'paid' ? 'Pago' :
                         status === 'overdue' ? 'Atrasado' :
                         status === 'today' ? 'Vence Hoje' : 'Pendente'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        {bill.category === 'cartao' && Number(bill.amount) === 0 ? (
                          <p className="text-lg font-medium text-white/80 flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Aguardando fatura
                          </p>
                        ) : (
                          <p className="text-2xl font-bold text-white">R$ {Number(bill.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        )}
                        <div className="flex items-center gap-1 text-sm text-white/70">
                          <Calendar className="h-3 w-3" />
                          <span>Vence {format(parseISO(bill.due_date), "dd 'de' MMM", { locale: ptBR })}</span>
                        </div>
                      </div>
                      {bill.is_recurring && (
                        <Badge variant="outline" className="text-xs bg-white/10 text-white border-white/30">
                          Recorrente
                        </Badge>
                      )}
                    </div>

                    {/* PIX Key Section */}
                    {bill.pix_key && (
                      <div className="mb-4 p-3 rounded-lg bg-white/10 border border-white/20">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/60 uppercase tracking-wider mb-1">
                              Chave PIX
                            </p>
                            <p className="text-sm font-mono text-white truncate">
                              {bill.pix_key}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-2 h-8 w-8 p-0 bg-white/10 hover:bg-white/20 text-white shrink-0"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(bill.pix_key!);
                                toast.success('Chave PIX copiada!');
                              } catch {
                                toast.error('Não foi possível copiar');
                              }
                            }}
                            title="Copiar chave PIX"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {status !== 'paid' && (
                        <Button 
                          size="sm" 
                          className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30"
                          variant="outline"
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
                        className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                        onClick={() => openEditDialog(bill)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="bg-white/10 hover:bg-red-500/50 text-white border-white/30">
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
            <BillForm formData={formData} setFormData={setFormData} onSubmit={handleEdit} submitLabel="Salvar Alterações" isLoading={updateBill.isPending} />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
