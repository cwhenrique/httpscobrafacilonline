

## Bug: Pagamento parcial não cria sub-parcela

### Causa Raiz

No fluxo de pagamento parcial **sem adiantamento** (linhas 5038-5063 de `Loans.tsx`), quando o usuário paga R$ 100 de uma parcela de R$ 119 (R$ 75 + R$ 44 multa), o sistema:
1. ✅ Calcula corretamente `remaining = 119 - 100 = 19`
2. ✅ Registra `[PARTIAL_PAID:idx:100.00]`
3. ❌ **NÃO cria** `[ADVANCE_SUBPARCELA]` com os R$ 19 restantes

Apenas o fluxo de adiantamento (`is_advance_payment`, linhas 5006-5028) cria sub-parcelas. O fluxo parcial padrão apenas registra a nota textual "Falta: R$ 19" mas não cria a tag de sub-parcela.

### Correção

Em `src/pages/Loans.tsx`, no bloco de pagamento parcial padrão (linhas 5048-5050), adicionar criação de sub-parcela quando `remaining > 0.01`:

```typescript
// Linha ~5048-5050, após calcular remaining
const remaining = targetInstallmentValue - newPartialTotal;
if (remaining > 0.01) {
  // Criar sub-parcela com o valor restante
  const uniqueId = Date.now().toString();
  const originalDueDate = dates[targetInstallmentIndex] || selectedLoan.due_date;
  const subDueDate = paymentData.new_due_date || originalDueDate;
  updatedNotes += `[ADVANCE_SUBPARCELA:${targetInstallmentIndex}:${remaining.toFixed(2)}:${subDueDate}:${uniqueId}]`;
  installmentNote = `Pagamento parcial - Parcela ${targetInstallmentIndex + 1}/${numInstallments}. Sub-parcela: ${formatCurrency(remaining)}`;
} else if (remaining < -0.01) {
  // excedente (lógica existente)
  ...
} else {
  // quitada (lógica existente)
  ...
}
```

Isso garante que ao pagar R$ 100 de uma parcela de R$ 119, o sistema crie uma sub-parcela de R$ 19 que aparecerá na lista de parcelas pendentes.

