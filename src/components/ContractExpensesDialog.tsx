import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Plus, 
  Trash2, 
  CalendarIcon, 
  Wrench, 
  Shield, 
  FileText, 
  AlertTriangle, 
  Fuel, 
  Cog, 
  File, 
  MoreHorizontal,
  Receipt
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contract } from '@/hooks/useContracts';
import { useContractExpenses, EXPENSE_CATEGORIES, ContractExpense } from '@/hooks/useContractExpenses';

interface ContractExpensesDialogProps {
  contract: Contract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getCategoryIcon = (category: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    manutencao: <Wrench className="h-4 w-4" />,
    seguro: <Shield className="h-4 w-4" />,
    ipva: <FileText className="h-4 w-4" />,
    multa: <AlertTriangle className="h-4 w-4" />,
    combustivel: <Fuel className="h-4 w-4" />,
    pecas: <Cog className="h-4 w-4" />,
    documentacao: <File className="h-4 w-4" />,
    outros: <MoreHorizontal className="h-4 w-4" />,
  };
  return iconMap[category] || <MoreHorizontal className="h-4 w-4" />;
};

const getCategoryLabel = (category: string) => {
  const cat = EXPENSE_CATEGORIES.find(c => c.value === category);
  return cat?.label || 'Outros';
};

export function ContractExpensesDialog({ contract, open, onOpenChange }: ContractExpensesDialogProps) {
  const { expenses, isLoading, createExpense, deleteExpense, getExpensesByCategory } = useContractExpenses(contract.id);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('manutencao');
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [description, setDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<ContractExpense | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountValue = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amountValue) || amountValue <= 0) {
      return;
    }

    await createExpense.mutateAsync({
      contract_id: contract.id,
      amount: amountValue,
      expense_date: format(expenseDate, 'yyyy-MM-dd'),
      category,
      description: description || undefined,
    });

    // Reset form
    setAmount('');
    setCategory('manutencao');
    setExpenseDate(new Date());
    setDescription('');
    setShowAddForm(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteExpense.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value) {
      const numValue = parseInt(value) / 100;
      value = numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    setAmount(value);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const expensesByCategory = getExpensesByCategory(contract.id);

  // Extrair informações do veículo do notes ou client_name
  const vehicleInfo = contract.notes?.match(/Placa: ([^\n]+).*?Modelo: ([^\n]+)/s);
  const displayTitle = vehicleInfo 
    ? `${vehicleInfo[1]} - ${vehicleInfo[2]}`
    : contract.client_name;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Gastos - {displayTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Resumo Total */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total de Gastos</p>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(totalExpenses)}
              </p>
            </div>

            {/* Resumo por Categoria */}
            {Object.keys(expensesByCategory).length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(expensesByCategory).map(([cat, total]) => (
                  <div key={cat} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2">
                    {getCategoryIcon(cat)}
                    <span className="flex-1">{getCategoryLabel(cat)}</span>
                    <span className="font-medium">{formatCurrency(total)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Botão Adicionar */}
            {!showAddForm && (
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar Gasto
              </Button>
            )}

            {/* Formulário de Adição */}
            {showAddForm && (
              <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-background">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor</Label>
                    <Input
                      id="amount"
                      placeholder="0,00"
                      value={amount}
                      onChange={handleAmountChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <span className="flex items-center gap-2">
                              {getCategoryIcon(cat.value)}
                              {cat.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data do Gasto</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !expenseDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expenseDate ? format(expenseDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={expenseDate}
                        onSelect={(date) => date && setExpenseDate(date)}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Ex: Troca de óleo e filtro"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createExpense.isPending}
                  >
                    {createExpense.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            )}

            {/* Lista de Gastos */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-4">Carregando...</p>
                ) : expenses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum gasto registrado
                  </p>
                ) : (
                  expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 bg-muted rounded-md">
                        {getCategoryIcon(expense.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {getCategoryLabel(expense.category)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        {expense.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {expense.description}
                          </p>
                        )}
                      </div>
                      <span className="font-medium text-destructive whitespace-nowrap">
                        {formatCurrency(Number(expense.amount))}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteConfirm(expense)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O gasto de{' '}
              <strong>{deleteConfirm && formatCurrency(Number(deleteConfirm.amount))}</strong>{' '}
              será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteExpense.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
