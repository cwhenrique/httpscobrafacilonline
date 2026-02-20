

## Correção: Campo "Juros Total" no Formulário SAC

### Problema
O campo "Juros Total (R$)" mostra R$ 10.000 em vez de R$ 6.000 para um empréstimo SAC de R$ 10.000, 20% a.m., 5 parcelas.

**Causa raiz:** Na função `getTotalInterestRawValue()` (linha 2392), quando `payment_type === 'installment'` e existe `installmentValue`, o código entra no primeiro `if` e faz:
```
perInstallment * numInstallments - principal
= 4000 * 5 - 10000
= 10000   (ERRADO)
```

Como `installmentValue` agora mostra a primeira parcela SAC (4000 - a maior), essa multiplicacao gera um total inflado. O correto seria usar `calculateSACInterest` que soma os juros reais de cada parcela (6000).

### Correção

**Arquivo: `src/pages/Loans.tsx` - Linhas 2391-2395**

Adicionar uma verificação para SAC antes do cálculo baseado em `installmentValue`:

```typescript
if (formData.interest_mode === 'sac' && formData.interest_rate) {
  const rate = parseFloat(formData.interest_rate);
  totalInterest = calculateSACInterest(principal, rate, numInstallments);
} else if ((formData.payment_type === 'installment' || ...) && installmentValue) {
  const perInstallment = parseFloat(installmentValue);
  if (!perInstallment) return '';
  totalInterest = perInstallment * numInstallments - principal;
} else if (...) {
  // restante inalterado
}
```

Isso garante que para SAC o cálculo sempre use a soma real dos juros amortizados (R$ 6.000), independente do valor exibido no campo "1a Parcela".

