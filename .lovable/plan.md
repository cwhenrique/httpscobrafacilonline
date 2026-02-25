

# Correcao: Parcelas pagas exibidas incorretamente na visualizacao em lista

## Problema

Na visualizacao em lista (LoansTableView), a coluna "Parcelas" mostra `{paidCount}/{numInstallments}` (ex: "1/4" quando deveria ser "3/4"). Isso acontece porque tanto `getPaidInstallmentsCount` (em Loans.tsx) quanto `calculatePaidInstallments` (em calculations.ts) usam `break` ao encontrar a primeira parcela nao paga sequencialmente.

```text
Exemplo:
- Parcela 0: PARTIAL_PAID:0:162.00 → paga ✅
- Parcela 1: sem tag (pagamento antigo, antes do sistema de tracking) → 0 >= 162 * 0.99? NAO
- break! → retorna paidCount = 1
- Parcela 2: PARTIAL_PAID:2:162.00 → nunca avaliada
- Parcela 3: PARTIAL_PAID:3:162.00 → nunca avaliada
```

Isso ocorre quando:
1. O emprestimo teve parcelas pagas antes do sistema de tracking `[PARTIAL_PAID]` existir (parcelas antigas sem tag)
2. Pagamentos foram feitos fora de ordem (ex: pagar parcela 3 antes da 2)

## Solucao

### 1. `src/lib/calculations.ts` - funcao `calculatePaidInstallments`

Remover o `break` (linha 412) e contar TODAS as parcelas pagas, independente da ordem. Manter a mesma logica de verificacao (`paidAmount >= installmentValue * 0.99`), mas sem parar no primeiro gap.

Antes:
```typescript
if (paidAmount >= installmentValue * 0.99 && !hasSubparcelaForIndex(i)) {
  paidCount++;
} else {
  break;  // ← REMOVER
}
```

Depois:
```typescript
if (paidAmount >= installmentValue * 0.99 && !hasSubparcelaForIndex(i)) {
  paidCount++;
}
// Sem break - continua contando todas as parcelas pagas
```

### 2. `src/pages/Loans.tsx` - funcao `getPaidInstallmentsCount` (linha ~518-528)

Mesma correcao: remover o `break` (linha 526).

Antes:
```typescript
if (paidAmount >= installmentValue * 0.99 && !hasSubparcelaForIndex(i)) {
  paidCount++;
} else {
  break;
}
```

Depois:
```typescript
if (paidAmount >= installmentValue * 0.99 && !hasSubparcelaForIndex(i)) {
  paidCount++;
}
```

### 3. `src/components/LoansTableView.tsx` - melhorar exibicao de parcelas

Na coluna "Parcelas" (linha 477-481), alem de mostrar `paidCount/total`, adicionar indicador visual quando ha parcelas em atraso. Isso da ao usuario visibilidade imediata sobre o estado do emprestimo na lista.

Antes:
```tsx
<span className="text-sm">
  {paidCount}/{numInstallments}
</span>
```

Depois:
```tsx
<div className="flex flex-col">
  <span className="text-sm">
    {paidCount}/{numInstallments}
  </span>
  {isOverdue && !isPaid && (
    <span className="text-[10px] text-red-500">
      em atraso
    </span>
  )}
</div>
```

### 4. Impacto em `getNextDueDate`

A funcao `getNextDueDate` em LoansTableView (linha 117-124) usa `dates[paidCount]` para determinar o proximo vencimento. Com o `break` removido e `paidCount` agora contando corretamente todas as parcelas pagas (ex: 3 em vez de 1), o proximo vencimento apontara para a parcela REALMENTE nao paga, em vez de apontar para uma parcela ja paga.

Porem, se parcelas foram pagas fora de ordem (ex: 0, 2, 3 pagas mas 1 nao), `dates[3]` seria incorreto. Para resolver isso, `getNextDueDate` precisa procurar a primeira parcela NAO paga explicitamente, em vez de usar `dates[paidCount]`.

Correcao em `getNextDueDate`:
```typescript
const getNextDueDate = (loan: Loan): string | null => {
  const dates = (loan.installment_dates as string[]) || [];
  const partialPayments = getPartialPaymentsFromNotes(loan.notes);
  // Encontrar primeira parcela nao paga
  for (let i = 0; i < dates.length; i++) {
    const paidAmount = partialPayments[i] || 0;
    const installmentValue = getInstallmentValueForLoan(loan, i);
    if (paidAmount < installmentValue * 0.99) {
      return dates[i];
    }
  }
  return loan.due_date;
};
```

Mesma correcao precisa ser aplicada em `getNextUnpaidInstallmentDate` em calculations.ts (linha 423-442) e nos locais de Loans.tsx que usam `dates[paidCount]`.

### 5. Funcao auxiliar para obter valor da parcela

Para que `getNextDueDate` em LoansTableView possa verificar parcelas individuais, sera necessario extrair a logica de calculo do valor da parcela para uma funcao reutilizavel ou importar `calculateInstallmentValue` de calculations.ts (ja existe).

## Resumo das alteracoes

| Arquivo | Alteracao |
|---|---|
| `src/lib/calculations.ts` | Remover `break` em `calculatePaidInstallments`; atualizar `getNextUnpaidInstallmentDate` para iterar parcelas individuais |
| `src/pages/Loans.tsx` | Remover `break` em `getPaidInstallmentsCount` |
| `src/components/LoansTableView.tsx` | Atualizar `getNextDueDate` para buscar primeira parcela nao paga; melhorar exibicao visual de parcelas |

