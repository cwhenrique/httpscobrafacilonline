

# Plano: Adicionar Gastos Iniciais no Formulário de Criação de Contrato de Veículo

## Objetivo

Permitir que o usuário registre gastos iniciais (manutenção, seguro, documentação, etc.) diretamente ao criar um novo contrato de aluguel de veículo, sem precisar criar o contrato primeiro e depois adicionar os gastos separadamente.

---

## Alterações Necessárias

### 1. Estado para armazenar gastos iniciais

No arquivo `src/pages/ProductSales.tsx`, adicionar um novo estado para armazenar os gastos que serão criados junto com o contrato:

```typescript
// Novo estado para gastos iniciais no formulário de contrato
const [contractInitialExpenses, setContractInitialExpenses] = useState<Array<{
  amount: number;
  category: string;
  description: string;
  expense_date: string;
}>>([]);
```

---

### 2. Seção de gastos no formulário de criação

Adicionar uma nova seção no formulário de criação de contrato (após os campos do veículo, linha ~2075), que aparece **apenas** quando o tipo de contrato é `aluguel_veiculo`:

```tsx
{/* Gastos Iniciais do Veículo - Only shown when aluguel_veiculo is selected */}
{contractForm.contract_type === 'aluguel_veiculo' && (
  <div className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
        <Receipt className="w-4 h-4" />
        <Label className="font-medium">Gastos Iniciais (opcional)</Label>
      </div>
      <Button 
        type="button"
        variant="outline" 
        size="sm"
        onClick={addInitialExpense}
        className="h-7 text-xs"
      >
        <Plus className="w-3 h-3 mr-1" />
        Adicionar
      </Button>
    </div>
    
    {contractInitialExpenses.length > 0 && (
      <div className="space-y-2">
        {contractInitialExpenses.map((expense, index) => (
          <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-background border">
            <Select value={expense.category} onValueChange={(v) => updateInitialExpense(index, 'category', v)}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input 
              placeholder="Valor"
              className="w-24 h-8"
              value={expense.amount || ''}
              onChange={(e) => updateInitialExpense(index, 'amount', parseFloat(e.target.value) || 0)}
            />
            <Input 
              placeholder="Descrição (opcional)"
              className="flex-1 h-8"
              value={expense.description}
              onChange={(e) => updateInitialExpense(index, 'description', e.target.value)}
            />
            <Button 
              type="button"
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => removeInitialExpense(index)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        <div className="text-sm text-muted-foreground text-right">
          Total: <span className="font-medium text-destructive">
            {formatCurrency(contractInitialExpenses.reduce((sum, e) => sum + e.amount, 0))}
          </span>
        </div>
      </div>
    )}
  </div>
)}
```

---

### 3. Funções auxiliares para gerenciar gastos

Adicionar funções para adicionar, atualizar e remover gastos da lista:

```typescript
const addInitialExpense = () => {
  setContractInitialExpenses([...contractInitialExpenses, {
    amount: 0,
    category: 'manutencao',
    description: '',
    expense_date: format(new Date(), 'yyyy-MM-dd')
  }]);
};

const updateInitialExpense = (index: number, field: string, value: any) => {
  const updated = [...contractInitialExpenses];
  updated[index] = { ...updated[index], [field]: value };
  setContractInitialExpenses(updated);
};

const removeInitialExpense = (index: number) => {
  setContractInitialExpenses(contractInitialExpenses.filter((_, i) => i !== index));
};
```

---

### 4. Modificar `handleCreateContract` para criar gastos após o contrato

Atualizar a função de criação de contrato para também criar os gastos iniciais:

```typescript
const handleCreateContract = async () => {
  // ... código existente de criação do contrato ...
  
  const result = await createContract.mutateAsync({...contractData});
  
  // Se há gastos iniciais e o contrato foi criado com sucesso
  if (result && contractInitialExpenses.length > 0) {
    // Criar cada gasto usando o hook de gastos
    for (const expense of contractInitialExpenses) {
      if (expense.amount > 0) {
        await createExpense.mutateAsync({
          contract_id: result.id,
          amount: expense.amount,
          category: expense.category,
          description: expense.description || undefined,
          expense_date: expense.expense_date,
        });
      }
    }
  }
  
  // Limpar gastos iniciais após criação
  setContractInitialExpenses([]);
  // ... resto do código ...
};
```

---

### 5. Resetar gastos ao fechar/abrir dialog

Adicionar lógica para limpar os gastos quando o dialog é fechado ou quando muda o tipo de contrato:

```typescript
// No onOpenChange do Dialog de novo contrato
onOpenChange={(open) => {
  setIsContractOpen(open);
  if (!open) {
    setContractInitialExpenses([]);
  }
}}

// Quando muda o tipo de contrato (se não for mais veículo, limpar gastos)
useEffect(() => {
  if (contractForm.contract_type !== 'aluguel_veiculo') {
    setContractInitialExpenses([]);
  }
}, [contractForm.contract_type]);
```

---

### 6. Importar categorias de gastos

Adicionar import das categorias para usar no select:

```typescript
import { useContractExpenses, EXPENSE_CATEGORIES } from '@/hooks/useContractExpenses';
```

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ProductSales.tsx` | Adicionar estado `contractInitialExpenses` |
| `src/pages/ProductSales.tsx` | Adicionar seção visual de gastos no formulário |
| `src/pages/ProductSales.tsx` | Funções `addInitialExpense`, `updateInitialExpense`, `removeInitialExpense` |
| `src/pages/ProductSales.tsx` | Modificar `handleCreateContract` para salvar gastos |
| `src/pages/ProductSales.tsx` | Importar `EXPENSE_CATEGORIES` do hook |

---

## Resultado Final

**No formulário de Novo Contrato (quando tipo = Aluguel de Veículo):**

1. Após os campos do veículo, aparece uma seção "Gastos Iniciais (opcional)"
2. Botão "Adicionar" para incluir novos gastos
3. Para cada gasto: seletor de categoria, valor, descrição e botão de remover
4. Total de gastos é exibido
5. Ao criar o contrato, todos os gastos são salvos automaticamente

