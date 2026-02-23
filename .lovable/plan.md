
## Corrigir valores de parcelas personalizadas no modal de pagamento

### Problema

O modal "Registrar Pagamento" ignora os valores individuais das parcelas personalizadas e exibe todas com o mesmo valor (R$ 400 = media de R$ 2000 / 5 parcelas). O screenshot mostra Parcela 3/5, 4/5 e 5/5 todas com R$ 400,00, mas deveriam ter valores individuais.

### Causa Raiz

Existem **4 funcoes** no modal de pagamento que calculam valor da parcela sem considerar o modo `custom`:

1. **`totalPerInstallment`** (linha ~12632): calculado como `principalPerInstallment + interestPerInstallment` (media simples)
2. **`getInstallmentBaseValue`** (linha ~12746): retorna `totalPerInstallment` como fallback, sem checar `custom`
3. **`getInstallmentValue`** no handler de pagamento (linha ~4522): usa `baseInstallmentValue` sem checar `custom`
4. **`getInstallmentValuePartial`** (linha ~13227): usa `totalPerInstallment` sem checar `custom`
5. **Header do dialog** (linha ~12673): exibe `totalPerInstallment` fixo como "Parcela: R$ X"

### Solucao

**Arquivo: `src/pages/Loans.tsx`**

**Correcao 1 - `getInstallmentBaseValue` (linha 12746-12757):**
Adicionar tratamento de `custom` antes do fallback:

```typescript
const getInstallmentBaseValue = (index: number) => {
  if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
    return renewalFeeValue;
  }
  if (selectedLoan.interest_mode === 'sac') {
    return calculateSACInstallmentValue(...);
  }
  // Parcelas personalizadas: usar valor individual
  if (selectedLoan.interest_mode === 'custom') {
    const customValues = parseCustomInstallments(selectedLoan.notes);
    if (customValues && index < customValues.length) return customValues[index];
  }
  return totalPerInstallment;
};
```

**Correcao 2 - `getInstallmentValue` no handler de pagamento (linha 4522-4532):**
Adicionar tratamento de `custom`:

```typescript
const getInstallmentValue = (index: number) => {
  let value = baseInstallmentValue;
  if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
    value = renewalFeeValue;
  } else if (selectedLoan.interest_mode === 'sac') {
    value = calculateSACInstallmentValue(...);
  } else if (selectedLoan.interest_mode === 'custom') {
    const customValues = parseCustomInstallments(selectedLoan.notes);
    if (customValues && index < customValues.length) value = customValues[index];
  }
  const penalty = loanPenalties[index] || 0;
  return value + penalty;
};
```

**Correcao 3 - `getInstallmentValuePartial` (linha 13227-13235):**
Adicionar tratamento de `custom`:

```typescript
const getInstallmentValuePartial = (index: number) => {
  let baseValue = totalPerInstallment;
  if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
    baseValue = renewalFeeValue;
  } else if (selectedLoan.interest_mode === 'custom') {
    const customValues = parseCustomInstallments(selectedLoan.notes);
    if (customValues && index < customValues.length) baseValue = customValues[index];
  }
  const penalty = dailyPenaltiesPartial[index] || 0;
  const overdueInterest = getOverdueInterestForInstallmentPartial(index).amount;
  return baseValue + penalty + overdueInterest;
};
```

**Correcao 4 - Header do dialog (linha 12669-12675):**
Para `custom`, mostrar "Parcelas Personalizadas" em vez de um valor fixo:

```typescript
<div className="text-sm text-muted-foreground">
  {isDaily ? (
    <>Parcela Diaria: {formatCurrency(totalPerInstallment)} (Lucro: {formatCurrency(totalInterest)})</>
  ) : selectedLoan.interest_mode === 'custom' ? (
    <>Parcelas Personalizadas (Total: {formatCurrency(selectedLoan.principal_amount + totalInterest)})</>
  ) : (
    <>Parcela: {formatCurrency(totalPerInstallment)} ({formatCurrency(principalPerInstallment)} + {formatCurrency(interestPerInstallment)} juros)</>
  )}
</div>
```

### Resultado Esperado

Cada parcela no modal de pagamento exibira seu valor individual correto conforme definido na criacao do emprestimo, tanto na lista de selecao de parcelas quanto no calculo de pagamento.
