

## Corrigir "Valor base" no pagamento parcial para parcelas personalizadas

### Problema

No modal de pagamento parcial, o campo "Valor base" mostra R$ 490,00 (media simples = total / parcelas) em vez do valor real da parcela personalizada (R$ 400,00). O "Total da parcela" mostra R$ 400,00 corretamente porque `getInstallmentValuePartial` ja foi corrigido, mas o `baseValue` exibido na linha 13352-13354 ainda usa `totalPerInstallment` sem considerar o modo `custom`.

### Solucao

Uma unica alteracao no arquivo `src/pages/Loans.tsx`, linha 13352-13354:

**Arquivo: `src/pages/Loans.tsx` (linha ~13352-13354)**

Adicionar verificacao de `custom` no calculo do `baseValue` exibido:

```typescript
const baseValue = renewalFeeInstallmentIndex !== null && (selectedPartialIndex ?? 0) === renewalFeeInstallmentIndex 
  ? renewalFeeValue 
  : selectedLoan.interest_mode === 'custom'
    ? (() => {
        const customValues = parseCustomInstallments(selectedLoan.notes);
        return customValues && (selectedPartialIndex ?? 0) < customValues.length
          ? customValues[selectedPartialIndex ?? 0]
          : totalPerInstallment;
      })()
    : totalPerInstallment;
```

Isso garante que o "Valor base" exiba o valor individual correto da parcela personalizada, alinhado com o "Total da parcela" que ja funciona corretamente.

