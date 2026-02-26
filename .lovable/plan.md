

## Bug: Pagamento parcial de parcela com multa marca como quitada

### Causa Raiz

No fluxo `payment_type === 'installment'` (linhas 4723-4762), o sistema **ignora** o valor digitado pelo usuário e sempre calcula o valor total da parcela (base + multa). Na sequência (linhas 4879-4885), marca a parcela como **totalmente paga** com `[PARTIAL_PAID:idx:valor_total]`.

Exemplo: parcela = R$ 74 base + R$ 44 multa = R$ 118. Usuário digita R$ 100, mas o sistema registra R$ 118 e marca como quitada.

### Correção em `src/pages/Loans.tsx`

**1. Respeitar o valor digitado pelo usuário (linhas ~4740-4754)**

Após calcular `regularAmount` (valor total da parcela), verificar se o usuário editou o campo de valor. Se o valor digitado for menor que o calculado, usar o valor digitado:

```typescript
// Após linha 4754 (amount = regularAmount + subparcelaAmount)
const userEnteredAmount = parseFloat(paymentData.amount);
if (paymentData.amount && !isNaN(userEnteredAmount) && userEnteredAmount > 0 && userEnteredAmount < amount - 0.01) {
  amount = userEnteredAmount;
}
```

**2. Tratar pagamento parcial no tracking de notas (linhas ~4879-4891)**

Quando o valor pago for menor que o valor total da parcela, NÃO marcar como totalmente paga. Em vez disso, registrar o valor parcial e criar sub-parcela com o restante:

```typescript
for (const idx of regularIndicesForNotes) {
  const installmentVal = getInstallmentValue(idx);
  const alreadyPaid = partialsForCalc[idx] || 0;
  const remaining = Math.max(0, installmentVal - alreadyPaid);
  
  // Se o valor pago é menor que o restante, é pagamento parcial
  const paidForThis = Math.min(amount, remaining); // amount pode ser menor
  const newTotalPaid = alreadyPaid + paidForThis;
  
  updatedNotes = updatedNotes.replace(new RegExp(`\\[PARTIAL_PAID:${idx}:[0-9.]+\\]`, 'g'), '');
  updatedNotes += `[PARTIAL_PAID:${idx}:${newTotalPaid.toFixed(2)}]`;
  
  if (paidForThis < remaining - 0.01) {
    // Criar sub-parcela com o valor restante
    const dates = safeDates(selectedLoan.installment_dates);
    const dueDate = dates[idx] || selectedLoan.due_date;
    const uniqueId = Date.now().toString();
    const subRemainder = remaining - paidForThis;
    updatedNotes += `[ADVANCE_SUBPARCELA:${idx}:${subRemainder.toFixed(2)}:${dueDate}:${uniqueId}]`;
    installmentNote = `Pagamento parcial - Parcela ${idx + 1}/${numInstallments}. Sub-parcela: ${formatCurrency(subRemainder)}`;
  }
  
  // Taxa extra lógica existente...
}
```

**3. Ajustar cálculo de interest_paid/principal_paid (linhas ~4774-4778)**

Recalcular proporcionalmente com base no valor efetivamente pago (que agora pode ser menor que o total da parcela).

### Resultado Esperado

- Parcela de R$ 118 (74+44), usuário paga R$ 100
- Sistema registra `[PARTIAL_PAID:idx:100.00]` e cria `[ADVANCE_SUBPARCELA:idx:18.00:data:id]`
- Parcela aparece como parcialmente paga com R$ 18 restantes

