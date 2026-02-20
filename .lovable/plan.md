

## Correção: Total a Receber e Remaining Balance no SAC

### Problema
Ao criar um empréstimo SAC (ex: R$ 10.000, 20% a.m., 5 parcelas), o sistema calcula o total errado porque:

1. O campo `installmentValue` mostra o valor da **primeira parcela** (R$ 4.000)
2. Na hora de salvar (linha 3810), o código faz `4.000 × 5 = R$ 20.000`
3. O correto seria somar todas as parcelas SAC: `4.000 + 3.600 + 3.200 + 2.800 + 2.400 = R$ 16.000`

Isso faz o `remaining_balance` e `total_interest` serem salvos errados no banco.

### Correção

**Arquivo: `src/pages/Loans.tsx` - Linha ~3808-3811**

Para SAC, ignorar o cálculo baseado em `installmentValue` e usar `calculateSACInterest` diretamente:

```typescript
if ((formData.payment_type === 'installment' || ...) && installmentValue) {
  // SAC: não usar perInstallment * numInstallments (parcelas são variáveis)
  if (formData.interest_mode === 'sac') {
    totalInterest = calculateSACInterest(principal, rate, numInstallments);
  } else {
    const perInstallment = parseFloat(installmentValue);
    const totalToReceive = perInstallment * numInstallments;
    totalInterest = totalToReceive - principal;
    // ... recálculo de taxa existente
  }
}
```

Isso garante que:
- `total_interest` = R$ 6.000 (soma real dos juros SAC)
- `remaining_balance` = R$ 16.000 (principal + juros reais)
- Os valores salvos no banco ficam consistentes com as parcelas decrescentes

### Impacto
Apenas 1 trecho de código precisa ser ajustado. A correção afeta somente a criação de empréstimos SAC com parcelas.
