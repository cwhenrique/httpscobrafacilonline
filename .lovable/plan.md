

## Correção: Multas/juros extras não devem abater saldo nem parcelas

### Problema atual
Quando uma multa (penalty) é incluída no pagamento, ela é somada ao `amount` total e distribuída proporcionalmente entre `principal_paid` e `interest_paid`. Os triggers tentam compensar subtraindo a multa do `remaining_balance`, mas o `principal_paid` ainda inclui a porção da multa, o que causa:
1. A condição 2 do `recalculate_loan_total_paid` contar multa como principal pago
2. Encerramento prematuro de contratos

### Solução
Tratar multas exatamente como pagamentos de juros: aceitar como lucro mas **não reduzir saldo** nem **contar como parcela paga**.

### Alterações

#### 1. `src/pages/Loans.tsx` — Separar multa do principal_paid e interest_paid
Após calcular `principal_paid` e `interest_paid` (por volta da linha 4770), subtrair a porção de multa do `principal_paid` e mover para `interest_paid`:

```typescript
// Após calcular penaltyInPayment (linha ~5260):
// Remover a multa do principal_paid — multa é lucro, não reduz saldo
if (penaltyInPayment > 0) {
  // A multa já foi incluída no amount e distribuída entre principal/interest
  // Precisamos garantir que ela vá 100% para interest_paid
  principal_paid = Math.max(0, principal_paid - penaltyInPayment);
  interest_paid = interest_paid + penaltyInPayment;
}
```

Mas como o `penaltyInPayment` é calculado depois (linha 5207), precisamos **reordenar** o código ou aplicar a correção após o cálculo da multa, antes de chamar `registerPayment`.

Concretamente, inserir **antes** da linha 5264 (`registerPayment`):
```typescript
// Multa é lucro puro — não deve contar como principal pago
if (penaltyInPayment > 0) {
  principal_paid = Math.max(0, principal_paid - penaltyInPayment);
  interest_paid += penaltyInPayment;
}
```

#### 2. `update_loan_on_payment` trigger — Já subtrai penalty do remaining_balance ✓
O trigger atual já faz `remaining_balance - (amount - penalty_amount)`, o que está correto.

#### 3. `recalculate_loan_total_paid` trigger — Já corrigido na migração anterior ✓
A condição 2 já desconta `total_penalty_amount` do `total_payments`. Com a correção do `principal_paid`, o `total_principal_payments` também não vai mais incluir multa, tornando a condição duplamente segura.

#### 4. `revert_loan_on_payment_delete` trigger — Já subtrai penalty ✓
Já faz `remaining_balance + (OLD.amount - penalty_amount)`.

### Resumo
Uma única alteração no frontend (`Loans.tsx`) para garantir que `principal_paid` nunca inclua valores de multa, e `interest_paid` absorva o valor da multa como lucro puro. Os triggers do banco já tratam o `[PENALTY_INCLUDED]` corretamente para o `remaining_balance`.

