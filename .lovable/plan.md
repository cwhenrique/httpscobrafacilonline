

## Diagnóstico: Pagamento parcial não reconhecido após excluir e pagar novamente

### Causa Raiz

No fluxo de exclusão de pagamento (`useLoans.ts`, linhas 849-868), quando o pagamento original que **criou** a sub-parcela é excluído, o bloco `parcelaMatch` remove corretamente a tag `[PARTIAL_PAID:4:...]`, **mas NÃO remove** as tags `[ADVANCE_SUBPARCELA:4:...]` e `[ADVANCE_SUBPARCELA_PAID:4:...]` associadas.

Isso acontece porque:
- O bloco `advanceMatch` (linha 826) só detecta notas com "Adiantamento - Parcela N"
- Mas pagamentos feitos via tipo "Parcela" (checkbox) geram notas com "Pagamento parcial - Parcela N/M. Sub-parcela: R$ X"
- Esse formato **não** é detectado pelo `advanceMatch`, então as sub-parcelas ficam órfãs

**Resultado**: Após excluir o pagamento, a `PARTIAL_PAID` é removida (R$ 0,00 pago) mas a sub-parcela continua existindo. Quando o usuário paga novamente, o sistema vê `existingPartials[4] = 0` (nada pago) mas a sub-parcela de R$ 75 ainda aparece, criando inconsistência.

### Correção

**Arquivo: `src/hooks/useLoans.ts`** (linhas 849-868)

No bloco `parcelaMatch`, adicionar a remoção das tags `ADVANCE_SUBPARCELA` e `ADVANCE_SUBPARCELA_PAID` quando a nota do pagamento indica que uma sub-parcela foi criada (contém "Sub-parcela" ou "Pagamento parcial"):

```typescript
if (parcelaMatch && !advanceMatch && !isSubparcelaPayment && !paymentNotes.includes('[AMORTIZATION]')) {
  const installmentIndex = parseInt(parcelaMatch[1]) - 1;
  let newNotes = updatedLoanNotes.replace(
    new RegExp(`\\[PARTIAL_PAID:${installmentIndex}:[0-9.]+\\]`, 'g'), ''
  );
  newNotes = newNotes.replace(
    new RegExp(`\\[OVERDUE_INTEREST_PAID:${installmentIndex}:[^\\]]+\\]`, 'g'), ''
  );
  // 🆕 FIX: Se o pagamento criou sub-parcela, remover as tags também
  if (paymentNotes.includes('Sub-parcela') || paymentNotes.includes('Pagamento parcial')) {
    newNotes = newNotes.replace(
      new RegExp(`\\[ADVANCE_SUBPARCELA:${installmentIndex}:[^\\]]+\\]`, 'g'), ''
    );
    newNotes = newNotes.replace(
      new RegExp(`\\[ADVANCE_SUBPARCELA_PAID:${installmentIndex}:[^\\]]+\\]`, 'g'), ''
    );
  }
  // ... rest unchanged
}
```

Isso garante que ao excluir um pagamento parcial que criou sub-parcela, TUDO é limpo: `PARTIAL_PAID`, `ADVANCE_SUBPARCELA` e `ADVANCE_SUBPARCELA_PAID`.

