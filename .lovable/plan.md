

## Correção: `interest_paid` calculado incorretamente em empréstimos diários com multa

### Causa Raiz

Dupla contagem da multa no cálculo de `interest_paid`:

**Bug 1 — Pagamento de parcela (tipo `installment`):**
- Linha ~4574: `getInstallmentValue(index)` já adiciona a multa ao valor da parcela
- Linha ~4762: `extraAmount = getInstallmentValue(parcelas) - baseInstallmentValue * count` → inclui multa
- Linha ~4770: `interest_paid = (interestPerInstallment + extraAmount) * ratio` → multa JÁ está em interest_paid
- Linha ~5281: `interest_paid += penaltyInPayment` → **ADICIONA DE NOVO** → valor dobrado

Resultado na parcela 2 da Jaqueline: interest_paid = (8+33) + 33 = 74, mas deveria ser 41.

**Bug 2 — Pagamento parcial (tipo `partial`):**
- Linha ~4781: `interest_paid = min(amount, interestPerInstallment)` = min(19, 8) = 8
- Linha ~5281: `interest_paid += 22` = 30
- Mas amount = 19! `interest_paid` (30) excede o valor pago (19)

### Correção em `src/pages/Loans.tsx`

**Linhas 5278-5282** — Substituir o bloco de ajuste de multa por:

```typescript
if (penaltyInPayment > 0) {
  if (paymentData.payment_type === 'installment') {
    // Para pagamento de parcelas, a multa JÁ foi incluída via extraAmount/getInstallmentValue
    // Apenas ajustar principal para não incluir a multa
    principal_paid = Math.max(0, amount - interest_paid);
  } else {
    // Para pagamento parcial/total, adicionar multa ao interest_paid
    principal_paid = Math.max(0, principal_paid - penaltyInPayment);
    interest_paid += penaltyInPayment;
  }
}

// Garantia de consistência: interest_paid nunca pode exceder amount
interest_paid = Math.min(interest_paid, amount);
principal_paid = Math.max(0, amount - interest_paid);
```

### Correção dos dados da Jaqueline no banco

**Pagamento 88b7614d** (Parcela 2, R$ 61):
- Atual: interest_paid=74, principal_paid=0
- Correto: interest_paid=41 (8 juros + 33 multa), principal_paid=20
- `UPDATE loan_payments SET interest_paid = 41, principal_paid = 20 WHERE id = '88b7614d-71d7-4b21-8332-e74331ce0f1c';`

**Pagamento 49c06f1b** (Parcela 3, R$ 19 parcial):
- Atual: interest_paid=30, principal_paid=0
- Correto: interest_paid=19 (pagamento parcial, multa consome tudo), principal_paid=0
- `UPDATE loan_payments SET interest_paid = 19 WHERE id = '49c06f1b-8345-4039-9547-c8451e0a79e4';`

### Detalhes Técnicos

```text
Parcela 2 (R$ 61 = R$ 28 base + R$ 33 multa):
  Base: principal=20, juros=8
  Multa: 33 (lucro puro)
  
  ANTES (bug):  interest=8+33+33=74, principal=max(0,20-33)=0  → total=74 (!!!)
  DEPOIS (fix): interest=8+33=41,    principal=20              → total=61 ✓

Parcela 3 parcial (R$ 19):
  Base: juros=min(19,8)=8, principal=11
  Multa: 22
  
  ANTES (bug):  interest=8+22=30, principal=max(0,11-22)=0  → total=30 (!!!)
  DEPOIS (fix): interest=min(30,19)=19, principal=0          → total=19 ✓
```

