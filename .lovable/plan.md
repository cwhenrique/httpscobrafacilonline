

# Corrigir Lógica do Fluxo de Caixa - Dupla Contagem no Capital Inicial

## Problema

O Capital Inicial esta sendo calculado como a soma do principal de **todos os emprestimos ativos**, incluindo os criados **durante** o periodo selecionado. Isso causa dupla contagem porque esses mesmos emprestimos tambem aparecem como "Saidas" (Emprestimos concedidos no periodo).

Exemplo do usuario:
- Capital Inicial: R$7.700 (soma de todos emprestimos ativos)
- Saidas: R$16.900 (emprestimos concedidos no periodo 01/02 a 19/02)
- Os R$7.700 do capital inicial ja incluem emprestimos criados nesse periodo, inflando ambos os lados

Alem disso, na linha 770 do `ReportsLoans.tsx`, o calculo de `currentBalance` ainda soma `interestReceived`, duplicando o bug que acabamos de corrigir no componente `CashFlowCard.tsx`.

## Solucao

1. **Capital Inicial calculado** deve representar o capital investido em emprestimos que ja existiam **antes** do inicio do periodo selecionado. Filtrar apenas emprestimos ativos cuja `contract_date` (ou `start_date`) seja anterior ao inicio do periodo.

2. **Remover a soma de `interestReceived`** no calculo de `currentBalance` em `ReportsLoans.tsx` (linha 770), alinhando com a correcao ja feita no `CashFlowCard.tsx`.

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/pages/ReportsLoans.tsx` | Filtrar `calculatedInitialBalance` para incluir apenas emprestimos ativos criados antes do inicio do periodo. Remover `+ interestReceived` da linha 770. |

## Detalhes tecnicos

### 1. Corrigir `calculatedInitialBalance` (linhas 752-758)

Antes:
```tsx
const calculatedInitialBalance = useMemo(() => {
  const activeLoansTotal = stats.allLoans
    .filter(loan => loan.status !== 'paid')
    .reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
  return activeLoansTotal;
}, [stats.allLoans]);
```

Depois:
```tsx
const calculatedInitialBalance = useMemo(() => {
  const periodStart = dateRange?.from ? startOfDay(dateRange.from) : null;
  const activeLoansTotal = stats.allLoans
    .filter(loan => {
      if (loan.status === 'paid') return false;
      if (!periodStart) return true;
      const loanDate = parseISO(loan.contract_date || loan.start_date);
      return loanDate < periodStart;
    })
    .reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
  return activeLoansTotal;
}, [stats.allLoans, dateRange]);
```

Isso garante que apenas emprestimos criados **antes** do periodo sejam contados como capital inicial. Emprestimos criados **durante** o periodo aparecerao apenas como saidas.

### 2. Remover dupla contagem de juros (linha 770)

Antes:
```tsx
const currentBalance = effectiveBalance - loanedInPeriod + receivedInPeriod + interestReceived;
```

Depois:
```tsx
const currentBalance = effectiveBalance - loanedInPeriod + receivedInPeriod;
```

Alinha com a correcao ja aplicada no `CashFlowCard.tsx`.

