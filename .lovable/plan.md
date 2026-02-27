

## Diagnóstico Completo

### Padrão encontrado — Usuário Eric (ericsilvasantana2412@gmail.com)

A correção anterior já foi aplicada nos 3 locais do card/list/buildClientGroup e no `ClientLoansFolder`. O "restante a receber" agora usa `unpaidCount × installmentValue` para daily loans.

Para ROSEMEIRE: 37 parcelas, 10 pagas (tags 0-8 e 13), restante = 27 × R$27 = **R$729**. Parcelas 0 e 3 com R$100 (R$73 de multa cada) não afetam mais o cálculo.

### Problema residual: `getLoanStatus` (linha 2759)

A função `getLoanStatus` ainda usa `remaining_balance` direto do banco (linha 2759). Esta função determina `isPaid` e `remainingToReceive` para a **view de detalhes/expandida** do empréstimo. Para daily loans, o `remaining_balance` pode estar deflacionado por multas, fazendo com que o status apareça incorretamente.

### Alcance global — 22 usuários afetados

Consulta no banco identificou **35 empréstimos diários** em **22 usuários** onde o `remaining_balance` diverge do cálculo correto (parcelas abertas × valor), totalizando R$ 1.957,90 de drift. A correção no frontend já resolve a exibição para todos esses usuários, exceto na `getLoanStatus`.

### Plano de correção

**Arquivo: `src/pages/Loans.tsx`** — 1 local restante:

1. **`getLoanStatus`** (linha 2759): Para daily loans, calcular `remainingToReceive` como `unpaidCount × dailyInstallmentAmount` em vez de usar `loan.remaining_balance`. Para não-daily, manter `remaining_balance`.

```typescript
// Linha 2756-2759 — de:
const remainingToReceive = loan.remaining_balance;

// Para:
let remainingToReceive: number;
if (isDaily) {
  const paidCountForStatus = getPaidInstallmentsCount(loan);
  const dailyAmount = loan.total_interest || 0;
  const unpaidCount = Math.max(0, numInstallments - paidCountForStatus);
  remainingToReceive = unpaidCount * dailyAmount;
} else {
  remainingToReceive = loan.remaining_balance;
}
```

Isso garante que a regra **"multas nunca reduzem o restante a receber"** seja aplicada consistentemente em **todas as views** para **todos os usuários**.

