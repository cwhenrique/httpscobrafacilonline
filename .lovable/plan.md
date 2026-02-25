

# Correção: Parcelas Pagas e Em Atraso no Modo Lista

## Problema

No modo lista (LoansTableView), a coluna "Parcelas" mostra apenas `paidCount/total` e um texto genérico "em atraso". Isso não reflete corretamente situações onde pagamentos são feitos fora de ordem (ex: parcelas 1 e 3 pagas, parcela 2 em atraso). O contador mostra "1 pago" quando deveria mostrar "2 pagas" e "1 em atraso".

A causa raiz: `getPaidInstallmentsCount` já conta corretamente parcelas pagas por índice (usando tags `[PARTIAL_PAID]`), mas o componente de lista não calcula nem exibe o **número de parcelas em atraso** separadamente.

## Solução

### 1. Criar função `getOverdueInstallmentsCount` em `src/pages/Loans.tsx`

Nova função que percorre todas as parcelas não pagas e verifica quais têm data de vencimento no passado:

```typescript
const getOverdueInstallmentsCount = (loan: Loan): number => {
  if (loan.status === 'paid' || loan.remaining_balance <= 0) return 0;
  
  const dates = safeDates(loan.installment_dates);
  if (dates.length === 0) {
    // Single payment — check due_date
    const dueDate = new Date(loan.due_date + 'T12:00:00');
    const today = new Date(); today.setHours(12, 0, 0, 0);
    return dueDate < today ? 1 : 0;
  }
  
  const numInstallments = loan.installments || 1;
  const partialPayments = getPartialPaymentsFromNotes(loan.notes);
  // ... determine installment value per index (same logic as getPaidInstallmentsCount)
  // Count unpaid installments where date < today
  const today = new Date(); today.setHours(12, 0, 0, 0);
  let overdueCount = 0;
  for (let i = 0; i < Math.min(dates.length, numInstallments); i++) {
    const isPaid = /* check if installment i is paid */;
    if (!isPaid) {
      const dueDate = new Date(dates[i] + 'T12:00:00');
      if (dueDate < today) overdueCount++;
    }
  }
  return overdueCount;
};
```

### 2. Passar `getOverdueInstallmentsCount` como prop para LoansTableView

**Arquivo:** `src/components/LoansTableView.tsx`

- Adicionar prop `getOverdueInstallmentsCount: (loan: Loan) => number`
- Na coluna "Parcelas", mostrar:
  - `✅ X pagas` (verde)
  - `🔴 Y em atraso` (vermelho, se Y > 0)

### 3. Atualizar a coluna "Parcelas" no LoansTableView

Antes (linhas 478-488):
```tsx
<TableCell className="hidden md:table-cell">
  <div className="flex flex-col">
    <span className="text-sm">{paidCount}/{numInstallments}</span>
    {isOverdue && !isPaid && (
      <span className="text-[10px] text-destructive">em atraso</span>
    )}
  </div>
</TableCell>
```

Depois:
```tsx
<TableCell className="hidden md:table-cell">
  <div className="flex flex-col gap-0.5">
    <span className="text-sm text-emerald-600 dark:text-emerald-400">
      ✅ {paidCount}/{numInstallments}
    </span>
    {overdueCount > 0 && (
      <span className="text-[10px] text-destructive font-medium">
        🔴 {overdueCount} em atraso
      </span>
    )}
  </div>
</TableCell>
```

## Resumo

| Arquivo | Alteração |
|---|---|
| `src/pages/Loans.tsx` | Criar `getOverdueInstallmentsCount()` e passá-la como prop ao `LoansTableView` |
| `src/components/LoansTableView.tsx` | Adicionar prop `getOverdueInstallmentsCount`, calcular e exibir número de parcelas em atraso na coluna "Parcelas" |

