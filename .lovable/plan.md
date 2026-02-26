

## Bug: Sub-parcela continua como "Paga" ao excluir pagamento

### Causa Raiz

Em `src/hooks/useLoans.ts` (linha 775), ao excluir um pagamento, o sistema tenta reverter `[ADVANCE_SUBPARCELA_PAID]` para `[ADVANCE_SUBPARCELA]` usando o regex:

```
/Sub-parcela \(Adiant\. P(\d+)\)/
```

Porém, o pagamento de sub-parcela criado pelo **fluxo de pagamento parcial** (não adiantamento) gera notas com formato diferente:
- `"Pagamento parcial - Parcela 1/24. Sub-parcela: R$ 19,00"`
- `"Sub-parcela (Adiant. P1) quitada"` (apenas no fluxo de adiantamento)

O regex não reconhece o formato do pagamento parcial, então a tag `ADVANCE_SUBPARCELA_PAID` nunca é revertida para `ADVANCE_SUBPARCELA`.

Além disso, quando a sub-parcela é paga via seleção múltipla de parcelas (linhas 4922-4941 de Loans.tsx), a nota do pagamento contém o número da parcela pai, não o formato "Sub-parcela (Adiant.".

### Correção em `src/hooks/useLoans.ts`

**Linha ~775-790** — Ampliar detecção para cobrir todos os formatos de pagamento de sub-parcela:

```typescript
// Detectar pagamento de sub-parcela por múltiplos formatos de notas
const subparcelaPaidMatch = paymentNotes.match(/Sub-parcela \(Adiant\. P(\d+)\)/);
const partialSubparcelaMatch = paymentNotes.match(/Pagamento parcial - Parcela (\d+)[\/ de]+\d+\. Sub-parcela:/);

const subparcelaOriginalIndex = subparcelaPaidMatch 
  ? parseInt(subparcelaPaidMatch[1]) - 1
  : partialSubparcelaMatch
    ? parseInt(partialSubparcelaMatch[1]) - 1
    : null;

if (subparcelaOriginalIndex !== null) {
  // Buscar a tag PAID correspondente e reverter para PENDENTE
  const paidTagRegex = new RegExp(
    `\\[ADVANCE_SUBPARCELA_PAID:${subparcelaOriginalIndex}:([0-9.]+):([^:\\]]+)(?::(\\d+))?\\]`,
    'g'
  );
  const newNotes = updatedLoanNotes.replace(paidTagRegex, (match, amount, date, id) => {
    return `[ADVANCE_SUBPARCELA:${subparcelaOriginalIndex}:${amount}:${date}${id ? ':' + id : ''}]`;
  });
  if (newNotes !== updatedLoanNotes) {
    updatedLoanNotes = newNotes;
    notesChanged = true;
  }
}
```

E atualizar a referência `subparcelaPaidMatch` no guard da linha 819 para usar a nova variável:

```typescript
if (parcelaMatch && !advanceMatch && subparcelaOriginalIndex === null && !paymentNotes.includes('[AMORTIZATION]')) {
```

Isso garante que ao excluir o pagamento da sub-parcela (R$ 19), a tag `ADVANCE_SUBPARCELA_PAID` seja revertida para `ADVANCE_SUBPARCELA`, fazendo a sub-parcela aparecer novamente como pendente.

