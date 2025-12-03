import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { useBills, Bill, CreateBillData } from '@/hooks/useBills';
import { useContracts, Contract, CreateContractData, ContractPayment } from '@/hooks/useContracts';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Check, Trash2, Edit, Calendar, User, DollarSign, FileText, FileSignature, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Bills() {
  const { bills, isLoading: billsLoading, createBill, updateBill, deleteBill, markAsPaid } = useBills();
  const { contracts, isLoading: contractsLoading, createContract, deleteContract, getContractPayments, markPaymentAsPaid } = useContracts();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteContractId, setDeleteContractId] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [activeTab, setActiveTab] = useState('bills');
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const [contractPayments, setContractPayments] = useState<Record<string, ContractPayment[]>>({});

  // Bill form state
  const [formData, setFormData] = useState<CreateBillData>({
    description: '',
    payee_name: '',
    amount: 0,
    due_date: '',
    notes: '',
  });

  // Contract form state
  const [contractForm, setContractForm] = useState<CreateContractData>({
    client_name: '',
    contract_type: 'parcelado',
    total_amount: 0,
    amount_to_receive: 0,
    frequency: 'monthly',
    installments: 1,
    first_payment_date: '',
    payment_method: 'all_days',
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

  const resetContractForm = () => {
    setContractForm({
      client_name: '',
      contract_type: 'parcelado',
      total_amount: 0,
      amount_to_receive: 0,
      frequency: 'monthly',
      installments: 1,
      first_payment_date: '',
      payment_method: 'all_days',
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

  const handleCreateContract = async () => {
    if (!contractForm.client_name || !contractForm.total_amount || !contractForm.first_payment_date) {
      return;
    }
    await createContract.mutateAsync(contractForm);
    setIsContractOpen(false);
    resetContractForm();
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

  const handleDeleteContract = async () => {
    if (!deleteContractId) return;
    await deleteContract.mutateAsync(deleteContractId);
    setDeleteContractId(null);
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

  const filteredContracts = contracts.filter((contract) => {
    return contract.client_name.toLowerCase().includes(searchTerm.toLowerCase());
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
    totalContracts: contracts.length,
    contractsAmount: contracts.reduce((acc, c) => acc + c.amount_to_receive, 0),
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

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Diário';
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quinzenal';
      case 'monthly': return 'Mensal';
      default: return frequency;
    }
  };

  const getPaymentStatusStyle = (status: string, dueDate: string) => {
    if (status === 'paid') return 'bg-primary/10 text-primary';
    const due = parseISO(dueDate);
    if (isPast(due) && !isToday(due)) return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Contas a Pagar</h1>
            <p className="text-muted-foreground">Gerencie suas contas, despesas e contratos</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Contas</p>
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
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <FileSignature className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalContracts}</p>
                  <p className="text-xs text-muted-foreground">Contratos</p>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <TabsList>
              <TabsTrigger value="bills" className="gap-2">
                <FileText className="w-4 h-4" />
                Contas
              </TabsTrigger>
              <TabsTrigger value="contracts" className="gap-2">
                <FileSignature className="w-4 h-4" />
                Contratos
              </TabsTrigger>
            </TabsList>

            {activeTab === 'bills' ? (
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
            ) : (
              <Dialog open={isContractOpen} onOpenChange={setIsContractOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Contrato
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Novo Contrato</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-2">
                      <Label htmlFor="client_name">Cliente *</Label>
                      <Input
                        id="client_name"
                        placeholder="Nome do cliente"
                        value={contractForm.client_name}
                        onChange={(e) => setContractForm({ ...contractForm, client_name: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="contract_type">Tipo de contrato</Label>
                      <Select
                        value={contractForm.contract_type}
                        onValueChange={(value) => setContractForm({ ...contractForm, contract_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parcelado">Parcelado</SelectItem>
                          <SelectItem value="avista">À Vista</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="total_amount">Valor do contrato (R$) *</Label>
                        <Input
                          id="total_amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={contractForm.total_amount || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setContractForm({ 
                              ...contractForm, 
                              total_amount: value,
                              amount_to_receive: value
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount_to_receive">Valor a receber (R$)</Label>
                        <Input
                          id="amount_to_receive"
                          type="number"
                          step="0.01"
                          min="0"
                          value={contractForm.amount_to_receive || ''}
                          onChange={(e) => setContractForm({ ...contractForm, amount_to_receive: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="frequency">Frequência</Label>
                        <Select
                          value={contractForm.frequency}
                          onValueChange={(value) => setContractForm({ ...contractForm, frequency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Diário</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="biweekly">Quinzenal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="installments">Número de parcelas</Label>
                        <Input
                          id="installments"
                          type="number"
                          min="1"
                          value={contractForm.installments}
                          onChange={(e) => setContractForm({ ...contractForm, installments: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_payment_date">Primeiro pagamento *</Label>
                        <Input
                          id="first_payment_date"
                          type="date"
                          value={contractForm.first_payment_date}
                          onChange={(e) => setContractForm({ ...contractForm, first_payment_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment_method">Forma de pagamento</Label>
                        <Select
                          value={contractForm.payment_method || 'all_days'}
                          onValueChange={(value) => setContractForm({ ...contractForm, payment_method: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all_days">Todos os dias</SelectItem>
                            <SelectItem value="weekdays">Dias da semana (Seg a Sex)</SelectItem>
                            <SelectItem value="weekends">Fins de semana</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contract_notes">Observação</Label>
                      <Textarea
                        id="contract_notes"
                        placeholder="Ex: Contrato 6 meses / Toyota Corolla / Placa XYZ - 1234"
                        value={contractForm.notes || ''}
                        onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                        className="border-primary/50"
                      />
                    </div>

                    {contractForm.installments > 0 && contractForm.amount_to_receive > 0 && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Valor por parcela:</p>
                        <p className="text-lg font-bold">
                          R$ {(contractForm.amount_to_receive / contractForm.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleCreateContract}
                      disabled={!contractForm.client_name || !contractForm.total_amount || !contractForm.first_payment_date || createContract.isPending}
                      className="w-full"
                    >
                      {createContract.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === 'bills' ? "Buscar por nome ou descrição..." : "Buscar por cliente..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {activeTab === 'bills' && (
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
            )}
          </div>

          {/* Bills Tab */}
          <TabsContent value="bills" className="mt-4">
            {billsLoading ? (
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
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="mt-4">
            {contractsLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Carregando contratos...</p>
              </div>
            ) : filteredContracts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileSignature className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">Nenhum contrato encontrado</h3>
                  <p className="text-muted-foreground text-sm">
                    {searchTerm ? 'Tente ajustar sua busca' : 'Clique em "Novo Contrato" para cadastrar'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredContracts.map((contract) => (
                  <Card key={contract.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{contract.client_name}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline">{contract.contract_type === 'parcelado' ? 'Parcelado' : 'À Vista'}</Badge>
                              <Badge variant="outline">{getFrequencyLabel(contract.frequency)}</Badge>
                              <Badge variant="secondary">{contract.installments}x</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Valor Total</p>
                          <p className="text-xl font-bold">
                            R$ {contract.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4 p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground">A Receber</p>
                          <p className="font-semibold">R$ {contract.amount_to_receive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Por Parcela</p>
                          <p className="font-semibold">R$ {(contract.amount_to_receive / contract.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Início</p>
                          <p className="font-semibold">{format(parseISO(contract.first_payment_date), 'dd/MM/yyyy')}</p>
                        </div>
                      </div>

                      {contract.notes && (
                        <p className="text-sm text-muted-foreground mt-3 p-2 bg-primary/5 rounded border border-primary/20 italic">
                          {contract.notes}
                        </p>
                      )}

                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1"
                          onClick={() => toggleContractExpand(contract.id)}
                        >
                          {expandedContract === contract.id ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Ocultar Parcelas
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              Ver Parcelas
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteContractId(contract.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Expanded Payments */}
                      {expandedContract === contract.id && contractPayments[contract.id] && (
                        <div className="mt-4 border-t pt-4">
                          <p className="font-semibold mb-3">Parcelas do Contrato</p>
                          <div className="space-y-2">
                            {contractPayments[contract.id].map((payment) => (
                              <div 
                                key={payment.id}
                                className={cn(
                                  'flex items-center justify-between p-3 rounded-lg',
                                  getPaymentStatusStyle(payment.status, payment.due_date)
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold">#{payment.installment_number}</span>
                                  <div>
                                    <p className="text-sm font-medium">
                                      R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs opacity-75">
                                      Vence: {format(parseISO(payment.due_date), 'dd/MM/yyyy')}
                                    </p>
                                  </div>
                                </div>
                                {payment.status === 'paid' ? (
                                  <Badge className="bg-primary text-primary-foreground">Pago</Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => markPaymentAsPaid.mutateAsync(payment.id)}
                                    disabled={markPaymentAsPaid.isPending}
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Pagar
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

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

        {/* Delete Bill Confirmation */}
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

        {/* Delete Contract Confirmation */}
        <AlertDialog open={!!deleteContractId} onOpenChange={() => setDeleteContractId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este contrato e todas as suas parcelas? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContract}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
