
# Custos Extras Manuais no Fluxo de Caixa

## Objetivo
Adicionar um campo editável na seção "Saídas" do card de Fluxo de Caixa que permita ao usuário cadastrar **custos extras avulsos** (nome, data, valor) diretamente ali, sem precisar ir para outra tela. Esses custos devem:
- Ser filtrados pelo período selecionado no relatório (via a `dateRange`)
- Atualizar automaticamente os totais de saídas, saldo atual e resultado líquido
- Ser persistidos no banco de dados (tabela `bills`, categoria `custom`)

---

## Estratégia de Implementação

Em vez de criar uma nova tabela, os custos extras serão salvos na **tabela `bills` já existente**, com `category = 'custom'` e `owner_type = 'business'`. Isso evita migrações e reutiliza toda a infraestrutura (hook `useBills`, RLS, etc.).

Os itens `custom` adicionados via o card de fluxo de caixa aparecerão também na tela "Contas a Pagar" naturalmente, pois usam a mesma tabela.

---

## O que será modificado

### 1. `src/components/reports/CashFlowCard.tsx`

**Novas props:**
```typescript
interface CashFlowCardProps {
  // ... props existentes ...
  extraCosts: ExtraCost[];             // lista de custos extras do período
  onAddExtraCost: (cost: NewExtraCost) => void;
  onDeleteExtraCost: (id: string) => void;
}

interface ExtraCost {
  id: string;
  name: string;
  date: string;
  amount: number;
}

interface NewExtraCost {
  name: string;
  date: string;
  amount: number;
}
```

**Novo bloco dentro da seção "SAÍDAS"**, abaixo de "Contas a pagar":

```
┌──────────────────────────────────────────────────┐
│ 🔴 Empréstimos                    -R$ 31.000     │
│ 🧾 Contas a pagar  [toggle]        -R$ 500       │
│ ─────────────────────────────────────────────── │
│ ➕ Custos extras                   -R$ 200       │
│   • Gasolina  15/02      -R$ 120   [🗑]          │
│   • Almoço    18/02      -R$ 80    [🗑]          │
│  [+ Adicionar custo extra]                       │
│ ─────────────────────────────────────────────── │
│ Total saídas:                    R$ 31.700       │
└──────────────────────────────────────────────────┘
```

**Formulário inline para adicionar custo:**
- Campo `nome` (texto livre)
- Campo `data` (date picker simples, pré-preenchido com hoje)
- Campo `valor` (número)
- Botão "Salvar" e "Cancelar"

**Cálculo atualizado:**
```typescript
const extraCostsTotal = extraCosts.reduce((s, c) => s + c.amount, 0);
const totalOutflows = loanedInPeriod + billsOutflow + extraCostsTotal;
const dynamicNetResult = (receivedInPeriod + interestReceived) - totalOutflows;
```

### 2. `src/pages/ReportsLoans.tsx`

**Filtro de custos extras por período:**
```typescript
const extraCostsInPeriod = useMemo(() => {
  return bills
    .filter(b => b.category === 'custom')
    .filter(b => {
      if (!dateRange?.from || !dateRange?.to) return true;
      const date = parseISO(b.due_date);
      return isWithinInterval(date, {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to),
      });
    })
    .map(b => ({ id: b.id, name: b.description, date: b.due_date, amount: Number(b.amount) }));
}, [bills, dateRange]);
```

**Handlers passados para `CashFlowCard`:**
```typescript
const handleAddExtraCost = async ({ name, date, amount }) => {
  await createBill.mutateAsync({
    description: name,
    payee_name: name,
    amount,
    due_date: date,
    category: 'custom',
    owner_type: 'business',
    status: 'paid',   // já marca como pago, pois está saindo do caixa
  });
};

const handleDeleteExtraCost = async (id: string) => {
  await deleteBill.mutateAsync(id);
};
```

**Props adicionadas ao `<CashFlowCard>`:**
```tsx
<CashFlowCard
  ...props existentes...
  extraCosts={extraCostsInPeriod}
  onAddExtraCost={handleAddExtraCost}
  onDeleteExtraCost={handleDeleteExtraCost}
/>
```

---

## Fluxo de dados

```
Usuário clica "+ Adicionar custo extra"
        ↓
Formulário inline abre (nome, data, valor)
        ↓
Salva via createBill (category='custom', status='paid')
        ↓
useBills() recarrega automaticamente (React Query)
        ↓
extraCostsInPeriod (useMemo) filtra pelo dateRange
        ↓
CashFlowCard recalcula totalOutflows + Saldo Atual + Resultado Líquido
```

---

## Arquivos modificados

| Arquivo | Tipo de mudança |
|---|---|
| `src/components/reports/CashFlowCard.tsx` | Adicionar bloco "Custos extras" na seção Saídas, formulário inline, cálculos atualizados |
| `src/pages/ReportsLoans.tsx` | Adicionar `extraCostsInPeriod` memo, handlers `handleAddExtraCost` / `handleDeleteExtraCost`, passar novas props ao `CashFlowCard` |

**Sem migrações de banco de dados** — reutiliza a tabela `bills` com `category = 'custom'`.

---

## Detalhes de UX

- O formulário abre **inline** (sem modal), com uma animação suave
- A data é pré-preenchida com a data de hoje
- Ao salvar, o formulário fecha automaticamente e o total atualiza em tempo real
- Cada custo extra exibe nome abreviado, data formatada e botão de exclusão (ícone lixeira)
- Se não houver custos extras, exibe apenas o botão "+ Adicionar custo extra" em estilo discreto
- O total de custos extras aparece colapsado se a lista estiver vazia
