

# Correção: Multas/juros por atraso devem ser valores EXTRAS, não descontados do saldo original

## Problema

O sistema tem uma inconsistência na forma como multas (DAILY_PENALTY) interagem com o `remaining_balance`:

1. A Edge Function `check-overdue-loans` **soma** a multa diretamente ao `remaining_balance`: `newBalance = loan.remaining_balance + penaltyToAdd`
2. Porém, o trigger `recalculate_loan_total_paid` (que dispara em todo pagamento) **recalcula** o `remaining_balance` como `total_to_receive - balance_reducing_payments`, onde `total_to_receive = principal + total_interest` — **sem incluir multas**. Isso sobrescreve a adição feita pela Edge Function.
3. O frontend tenta compensar com lógica de detecção `penaltiesLikelyIncluded`, comparando se o `remaining_balance` é maior que o esperado. Essa heurística falha em cenários como: pagamentos parciais, contratos antigos, ou quando o trigger já recalculou o saldo.

**Resultado:** O saldo exibido fica inconsistente — às vezes desconta a multa do original, às vezes duplica.

## Solução: Multas vivem APENAS nas tags, NUNCA no remaining_balance

A arquitetura correta (que já funciona parcialmente) é:

```text
remaining_balance = saldo ORIGINAL do contrato (principal + juros - pagamentos)
Multas = tags [DAILY_PENALTY:X:Y] nas notas (valor EXTRA)
Total a receber = remaining_balance + sum(DAILY_PENALTY tags)
```

### 1. Edge Function `check-overdue-loans` — Parar de modificar remaining_balance

**Arquivo:** `supabase/functions/check-overdue-loans/index.ts`

Remover a linha que atualiza `remaining_balance` ao aplicar multas. Apenas atualizar as `notes` com a tag `[DAILY_PENALTY]`.

Antes:
```typescript
const newBalance = loan.remaining_balance + penaltyToAdd;
const { error: updateError } = await supabase
  .from('loans')
  .update({ notes: updatedNotes, remaining_balance: newBalance })
  .eq('id', loan.id);
```

Depois:
```typescript
const { error: updateError } = await supabase
  .from('loans')
  .update({ notes: updatedNotes })
  .eq('id', loan.id);
```

### 2. Frontend — Remover heurística `penaltiesLikelyIncluded`

**Arquivo:** `src/pages/Loans.tsx`

Em todos os locais onde existe a lógica `penaltiesLikelyIncluded`, simplificar para SEMPRE somar multas ao remaining_balance:

**Cards (linhas ~8696-8717):**
Antes:
```typescript
const penaltiesLikelyIncluded = loan.remaining_balance > expectedBaseRemaining;
let remainingToReceive;
if (loan.status === 'paid') {
  remainingToReceive = 0;
} else {
  if (penaltiesLikelyIncluded) {
    remainingToReceive = Math.max(0, loan.remaining_balance);
  } else {
    remainingToReceive = Math.max(0, loan.remaining_balance + totalAppliedPenalties);
  }
}
```

Depois:
```typescript
let remainingToReceive;
if (loan.status === 'paid') {
  remainingToReceive = 0;
} else {
  remainingToReceive = Math.max(0, loan.remaining_balance + totalAppliedPenalties);
}
```

**Tabela/lista (linhas ~11011-11022):**
Mesma simplificação — remover `penaltiesLikelyIncludedTable` e sempre somar:
```typescript
const remainingToReceive = loan.status === 'paid'
  ? 0
  : Math.max(0, loan.remaining_balance + totalAppliedPenaltiesDaily);
```

### 3. Corrigir empréstimos existentes com remaining_balance inflado

Empréstimos que já tiveram multas somadas ao `remaining_balance` pela Edge Function precisam ser corrigidos. Criar uma query para identificar e ajustar:

```sql
-- Identificar empréstimos onde remaining_balance inclui multas indevidamente
-- e recalcular o saldo correto
UPDATE loans
SET remaining_balance = GREATEST(0,
  CASE 
    WHEN payment_type = 'daily' 
    THEN (COALESCE(total_interest, 0) * COALESCE(installments, 1)) - (
      SELECT COALESCE(SUM(
        amount - COALESCE((regexp_match(notes, '\[PENALTY_INCLUDED:([0-9.]+)\]'))[1]::numeric, 0)
      ), 0)
      FROM loan_payments lp
      WHERE lp.loan_id = loans.id
        AND (lp.notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR lp.notes IS NULL)
        AND (lp.notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR lp.notes IS NULL)
        AND (lp.notes NOT LIKE '%[AMORTIZATION]%' OR lp.notes IS NULL)
    )
    ELSE (principal_amount + COALESCE(total_interest, 0)) - (
      SELECT COALESCE(SUM(
        amount - COALESCE((regexp_match(notes, '\[PENALTY_INCLUDED:([0-9.]+)\]'))[1]::numeric, 0)
      ), 0)
      FROM loan_payments lp
      WHERE lp.loan_id = loans.id
        AND (lp.notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR lp.notes IS NULL)
        AND (lp.notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR lp.notes IS NULL)
        AND (lp.notes NOT LIKE '%[AMORTIZATION]%' OR lp.notes IS NULL)
    )
  END
)
WHERE status != 'paid'
  AND notes LIKE '%[DAILY_PENALTY:%';
```

## Resumo das alterações

| Arquivo | Alteração |
|---|---|
| `supabase/functions/check-overdue-loans/index.ts` | Remover atualização de `remaining_balance` ao aplicar multas — só atualizar `notes` |
| `src/pages/Loans.tsx` (cards ~8696-8717) | Remover heurística `penaltiesLikelyIncluded`, sempre somar multas ao remaining |
| `src/pages/Loans.tsx` (tabela ~11011-11022) | Mesma simplificação para visualização em lista |
| Banco de dados | Recalcular `remaining_balance` de empréstimos ativos com multas, removendo multas que foram indevidamente incorporadas ao saldo |

