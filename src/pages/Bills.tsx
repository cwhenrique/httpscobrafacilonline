import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
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
import { useContracts, Contract, CreateContractData, ContractPayment, UpdateContractData } from '@/hooks/useContracts';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Check, Trash2, Edit, Calendar, User, DollarSign, FileText, FileSignature, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Bills() {
  const { bills, isLoading: billsLoading, createBill, updateBill, deleteBill, markAsPaid } = useBills();
  const { contracts, isLoading: contractsLoading, createContract, updateContract, deleteContract, getContractPayments, markPaymentAsPaid } = useContracts();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [isEditContractOpen, setIsEditContractOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteContractId, setDeleteContractId] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [mainTab, setMainTab] = useState<'payable' | 'receivable'>('receivable');
  const [activeTab, setActiveTab] = useState('contracts');
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const [contractPayments, setContractPayments] = useState<Record<string, ContractPayment[]>>({});
  
  const [editContractForm, setEditContractForm] = useState<UpdateContractData>({
    client_name: '',
    contract_type: '',
    total_amount: 0,
    amount_to_receive: 0,
    notes: '',
  });

  const [formData, setFormData] = useState<CreateBillData>({
    description: '',
    payee_name: '',
    amount: 0,
    due_date: '',
    notes: '',
  });

  const [contractForm, setContractForm] = useState<CreateContractData>({
    client_name: '',
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
      contract_type: 'aluguel_casa',
      bill_type: mainTab,
      total_amount: 0,
      amount_to_receive: 0,
      frequency: 'monthly',
      installments: 12,
      first_payment_date: '',
      payment_method: 'all_days',
      notes: '',
    });
  };

  const handleCreate = async () => {
    if (!formData.payee_name || !formData.amount || !formData.due_date) return;
    await createBill.mutateAsync(formData);
    setIsCreateOpen(false);
    resetForm();
  };

  const handleCreateContract = async () => {
    if (!contractForm.client_name || !contractForm.total_amount || !contractForm.first_payment_date) return;
    await createContract.mutateAsync(contractForm);
    setIsContractOpen(false);
    resetContractForm();
  };

  const handleEdit = async () => {
    if (!editingBill) return;
    await updateBill.mutateAsync({
      id: editingBill.id,
      data: formData,
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
    if (filter === 'all') return true;
    if (filter === 'overdue') return status === 'overdue';
    return status === filter;
  });

  const filteredContracts = contracts.filter((contract) => {
    const matchesBillType = contract.bill_type === mainTab;
    return matchesBillType && contract.client_name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getCardStyle = (bill: Bill) => {
    const status = getBillStatus(bill);
    if (status === 'paid') return 'bg-primary/10 border-primary';
    if (status === 'overdue') return 'bg-destructive/10 border-destructive';
    return 'bg-card';
  };

  const getStatusBadge = (bill: Bill) => {
    const status = getBillStatus(bill);
    if (status === 'paid') return <Badge className="bg-primary text-primary-foreground">Pago</Badge>;
    if (status === 'overdue') return <Badge variant="destructive">Atrasado</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const receivableContracts = contracts.filter(c => c.bill_type === 'receivable');
  const payableContracts = contracts.filter(c => c.bill_type === 'payable');

  const stats = {
    total: bills.length,
    pending: bills.filter((b) => getBillStatus(b) === 'pending').length,
    overdue: bills.filter((b) => getBillStatus(b) === 'overdue').length,
    paid: bills.filter((b) => getBillStatus(b) === 'paid').length,
    totalAmount: bills.filter((b) => getBillStatus(b) !== 'paid').reduce((acc, b) => acc + b.amount, 0),
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

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
      biweekly: 'Quinzenal',
      monthly: 'Mensal',
    };
    return labels[frequency] || frequency;
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

  const getPaymentStatusStyle = (status: string, dueDate: string) => {
    if (status === 'paid') return 'bg-primary/10 text-primary';
    const due = parseISO(dueDate);
    if (isPast(due) && !isToday(due)) return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-muted-foreground';
  };

  const ContractForm = ({ billType }: { billType: 'payable' | 'receivable' }) => (
    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
      <div className="space-y-2">
        <Label>{billType === 'receivable' ? 'Cliente / Inquilino *' : 'Pagar para *'}</Label>
        <Input
          placeholder={billType === 'receivable' ? 'Nome do cliente ou inquilino' : 'Nome da pessoa ou empresa'}
          value={contractForm.client_name}
          onChange={(e) => setContractForm({ ...contractForm, client_name: e.target.value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label>Tipo de contrato</Label>
        <Select
          value={contractForm.contract_type}
          onValueChange={(value) => setContractForm({ ...contractForm, contract_type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
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
          <Input
            type="number"
            step="0.01"
            min="0"
            value={contractForm.total_amount || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              setContractForm({ 
                ...contractForm, 
                total_amount: value,
                amount_to_receive: value * contractForm.installments
              });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Meses / Parcelas</Label>
          <Input
            type="number"
            min="1"
            value={contractForm.installments}
            onChange={(e) => {
              const installments = parseInt(e.target.value) || 1;
              setContractForm({ 
                ...contractForm, 
                installments,
                amount_to_receive: contractForm.total_amount * installments
              });
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Primeiro vencimento *</Label>
          <Input
            type="date"
            value={contractForm.first_payment_date}
            onChange={(e) => setContractForm({ ...contractForm, first_payment_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Frequência</Label>
          <Select
            value={contractForm.frequency}
            onValueChange={(value) => setContractForm({ ...contractForm, frequency: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="biweekly">Quinzenal</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observação</Label>
        <Textarea
          placeholder={billType === 'receivable' ? 'Ex: Endereço do imóvel...' : 'Ex: Contrato de aluguel...'}
          value={contractForm.notes || ''}
          onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
        />
      </div>

      {contractForm.installments > 0 && contractForm.total_amount > 0 && (
        <div className={cn("p-3 rounded-lg", billType === 'receivable' ? 'bg-primary/10' : 'bg-orange-500/10')}>
          <p className="text-sm text-muted-foreground">Total do contrato:</p>
          <p className={cn("text-lg font-bold", billType === 'receivable' ? 'text-primary' : 'text-orange-600')}>
            R$ {(contractForm.total_amount * contractForm.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      <Button
        onClick={handleCreateContract}
        disabled={!contractForm.client_name || !contractForm.total_amount || !contractForm.first_payment_date || createContract.isPending}
        className="w-full"
      >
        {createContract.isPending ? 'Salvando...' : 'Criar Contrato'}
      </Button>
    </div>
  );

  const ContractsList = ({ contractsList, billType }: { contractsList: Contract[], billType: 'payable' | 'receivable' }) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {contractsList.map((contract) => (
        <Card key={contract.id} className={cn("overflow-hidden transition-all", billType === 'receivable' ? 'border-primary/30' : 'border-orange-500/30')}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", 
                  billType === 'receivable' ? 'bg-primary/20' : 'bg-orange-500/20')}>
                  <User className={cn("w-5 h-5", billType === 'receivable' ? 'text-primary' : 'text-orange-600')} />
                </div>
                <div>
                  <p className="font-semibold">{contract.client_name}</p>
                  <Badge variant="outline" className="text-xs">{getContractTypeLabel(contract.contract_type)}</Badge>
                </div>
              </div>
              <Badge variant="secondary">{getFrequencyLabel(contract.frequency)}</Badge>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor mensal</span>
                <span className="font-bold">R$ {contract.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Parcelas</span>
                <span className="font-semibold">{contract.installments}x</span>
              </div>
              <div className={cn("flex justify-between items-center p-2 rounded-lg", billType === 'receivable' ? 'bg-primary/10' : 'bg-orange-500/10')}>
                <span className="text-sm text-muted-foreground">Total</span>
                <span className={cn("font-bold text-lg", billType === 'receivable' ? 'text-primary' : 'text-orange-600')}>
                  R$ {contract.amount_to_receive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {contract.notes && <p className="text-xs text-muted-foreground mb-3 italic">"{contract.notes}"</p>}

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleContractExpand(contract.id)}>
                {expandedContract === contract.id ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                Parcelas
              </Button>
              <Button size="icon" variant="outline" onClick={() => openEditContractDialog(contract)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteContractId(contract.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {expandedContract === contract.id && contractPayments[contract.id] && (
              <div className="mt-4 pt-4 border-t space-y-2">
                {contractPayments[contract.id].map((payment) => (
                  <div key={payment.id} className={cn("flex items-center justify-between p-2 rounded-lg text-sm", getPaymentStatusStyle(payment.status, payment.due_date))}>
                    <div>
                      <span className="font-medium">{payment.installment_number}ª</span>
                      <span className="ml-2">{format(parseISO(payment.due_date), "dd/MM/yy")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      {payment.status !== 'paid' ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markPaymentAsPaid.mutateAsync(payment.id)}>
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
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Gestão Financeira</h1>
          <p className="text-muted-foreground">Gerencie contas a pagar, a receber e contratos</p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'payable' | 'receivable')} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="receivable" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Contas a Receber
            </TabsTrigger>
            <TabsTrigger value="payable" className="gap-2">
              <FileText className="w-4 h-4" />
              Contas a Pagar
            </TabsTrigger>
          </TabsList>

          {/* CONTAS A RECEBER */}
          <TabsContent value="receivable" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <FileSignature className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{receivableContracts.length}</p>
                      <p className="text-xs text-muted-foreground">Contratos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        R$ {receivableContracts.reduce((acc, c) => acc + c.amount_to_receive, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">Total a Receber</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Dialog open={isContractOpen && mainTab === 'receivable'} onOpenChange={(open) => {
                setIsContractOpen(open);
                if (open) setContractForm(prev => ({ ...prev, bill_type: 'receivable' }));
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" />Novo Contrato</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Novo Contrato - A Receber</DialogTitle></DialogHeader>
                  <ContractForm billType="receivable" />
                </DialogContent>
              </Dialog>
            </div>

            {contractsLoading ? (
              <div className="text-center py-12"><p className="text-muted-foreground">Carregando contratos...</p></div>
            ) : filteredContracts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileSignature className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">Nenhum contrato encontrado</h3>
                  <p className="text-muted-foreground text-sm">Crie contratos de aluguel ou mensalidades para gerenciar cobranças</p>
                </CardContent>
              </Card>
            ) : (
              <ContractsList contractsList={filteredContracts} billType="receivable" />
            )}
          </TabsContent>

          {/* CONTAS A PAGAR */}
          <TabsContent value="payable" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">Contas</p>
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
              <Card className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30">
                <CardContent className="p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total a Pagar</p>
                    <p className="text-2xl font-bold text-orange-600">
                      R$ {stats.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <TabsList>
                  <TabsTrigger value="bills" className="gap-2"><FileText className="w-4 h-4" />Contas</TabsTrigger>
                  <TabsTrigger value="contracts" className="gap-2"><FileSignature className="w-4 h-4" />Contratos</TabsTrigger>
                </TabsList>

                {activeTab === 'bills' ? (
                  <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2"><Plus className="w-4 h-4" />Nova Conta</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Pagar para *</Label>
                          <Input placeholder="Nome da pessoa ou empresa" value={formData.payee_name} onChange={(e) => setFormData({ ...formData, payee_name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição *</Label>
                          <Input placeholder="Ex: Aluguel, Conta de luz..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Valor (R$) *</Label>
                            <Input type="number" step="0.01" min="0" value={formData.amount || ''} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Vencimento *</Label>
                            <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Observações</Label>
                          <Textarea placeholder="Notas adicionais..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                        </div>
                        <Button onClick={handleCreate} disabled={!formData.payee_name || !formData.description || !formData.amount || !formData.due_date || createBill.isPending} className="w-full">
                          {createBill.isPending ? 'Salvando...' : 'Cadastrar Conta'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Dialog open={isContractOpen && mainTab === 'payable'} onOpenChange={(open) => {
                    setIsContractOpen(open);
                    if (open) setContractForm(prev => ({ ...prev, bill_type: 'payable' }));
                  }}>
                    <DialogTrigger asChild>
                      <Button className="gap-2"><Plus className="w-4 h-4" />Novo Contrato</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader><DialogTitle>Novo Contrato - A Pagar</DialogTitle></DialogHeader>
                      <ContractForm billType="payable" />
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={activeTab === 'bills' ? "Buscar por nome ou descrição..." : "Buscar por cliente..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
                {activeTab === 'bills' && (
                  <div className="flex gap-2 flex-wrap">
                    <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Todas</Button>
                    <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>Pendentes</Button>
                    <Button variant={filter === 'overdue' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('overdue')}>Atrasadas</Button>
                    <Button variant={filter === 'paid' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('paid')}>Pagas</Button>
                  </div>
                )}
              </div>

              <TabsContent value="bills" className="mt-4">
                {billsLoading ? (
                  <div className="text-center py-12"><p className="text-muted-foreground">Carregando contas...</p></div>
                ) : filteredBills.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="font-semibold mb-2">Nenhuma conta encontrada</h3>
                      <p className="text-muted-foreground text-sm">{searchTerm ? 'Tente ajustar sua busca' : 'Clique em "Nova Conta" para cadastrar'}</p>
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
                              <span className="font-bold text-lg">R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Vencimento</span>
                              <span className="text-sm">{format(parseISO(bill.due_date), "dd 'de' MMMM", { locale: ptBR })}</span>
                            </div>
                            {bill.paid_date && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Pago em</span>
                                <span className="text-sm text-primary">{format(parseISO(bill.paid_date), "dd 'de' MMMM", { locale: ptBR })}</span>
                              </div>
                            )}
                            {bill.notes && <p className="text-xs text-muted-foreground mt-2 italic">"{bill.notes}"</p>}
                          </div>
                          <div className="flex gap-2">
                            {getBillStatus(bill) !== 'paid' && (
                              <Button size="sm" variant="default" className="flex-1 gap-1" onClick={() => markAsPaid.mutateAsync(bill.id)} disabled={markAsPaid.isPending}>
                                <Check className="w-3 h-3" />Pagar
                              </Button>
                            )}
                            <Button size="icon" variant="outline" onClick={() => openEditDialog(bill)}><Edit className="w-4 h-4" /></Button>
                            <Button size="icon" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(bill.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="contracts" className="mt-4">
                {contractsLoading ? (
                  <div className="text-center py-12"><p className="text-muted-foreground">Carregando contratos...</p></div>
                ) : filteredContracts.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileSignature className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="font-semibold mb-2">Nenhum contrato encontrado</h3>
                      <p className="text-muted-foreground text-sm">Cadastre contratos de aluguel ou outros pagamentos recorrentes</p>
                    </CardContent>
                  </Card>
                ) : (
                  <ContractsList contractsList={filteredContracts} billType="payable" />
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Edit Bill Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Conta</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Pagar para *</Label>
                <Input value={formData.payee_name} onChange={(e) => setFormData({ ...formData, payee_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" value={formData.amount || ''} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento *</Label>
                  <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <Button onClick={handleEdit} disabled={updateBill.isPending} className="w-full">
                {updateBill.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Bill Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Contract Dialog */}
        <AlertDialog open={!!deleteContractId} onOpenChange={() => setDeleteContractId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
              <AlertDialogDescription>Todas as parcelas serão excluídas. Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContract} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Contract Dialog */}
        <Dialog open={isEditContractOpen} onOpenChange={setIsEditContractOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Editar Contrato</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{editingContract?.bill_type === 'receivable' ? 'Cliente / Inquilino' : 'Pagar para'}</Label>
                <Input
                  value={editContractForm.client_name || ''}
                  onChange={(e) => setEditContractForm({ ...editContractForm, client_name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tipo de contrato</Label>
                <Select
                  value={editContractForm.contract_type}
                  onValueChange={(value) => setEditContractForm({ ...editContractForm, contract_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <Label>Valor mensal (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editContractForm.total_amount || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setEditContractForm({ 
                        ...editContractForm, 
                        total_amount: value,
                        amount_to_receive: value * (editingContract?.installments || 1)
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total do contrato (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editContractForm.amount_to_receive || ''}
                    onChange={(e) => setEditContractForm({ ...editContractForm, amount_to_receive: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={editContractForm.notes || ''}
                  onChange={(e) => setEditContractForm({ ...editContractForm, notes: e.target.value })}
                />
              </div>

              <Button
                onClick={handleEditContract}
                disabled={!editContractForm.client_name || updateContract.isPending}
                className="w-full"
              >
                {updateContract.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
