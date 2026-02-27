

## Diagnóstico: Multa desaparece ao excluir pagamentos

### Causa Raiz

Quando um pagamento é registrado para uma parcela com multa (R$100 base + R$30 multa), o sistema **remove** a tag `[DAILY_PENALTY:4:30.00]` das notas do empréstimo (linhas 5383-5424 do `Loans.tsx`). Isso é correto — a multa foi paga.

Porém, quando o pagamento é **excluído** (`useLoans.ts`, linhas 849-877), o sistema reverte `PARTIAL_PAID` e `ADVANCE_SUBPARCELA`, mas **nunca restaura** a tag `[DAILY_PENALTY]` que foi removida durante o pagamento.

**Fluxo do problema:**
1. Parcela 5/28: R$100 base + R$30 multa → tag `[DAILY_PENALTY:4:30.00]` existe
2. Paga R$100 parcial → cria `PARTIAL_PAID:4:100` + `ADVANCE_SUBPARCELA:4:30` + **remove** `DAILY_PENALTY:4:30`
3. Paga sub-parcela R$30 → marca `ADVANCE_SUBPARCELA_PAID`
4. Exclui pagamento da sub-parcela → reverte para `ADVANCE_SUBPARCELA` ✅
5. Exclui pagamento de R$100 → remove `PARTIAL_PAID` e `ADVANCE_SUBPARCELA` ✅, **mas NÃO restaura** `DAILY_PENALTY:4:30` ❌
6. Parcela volta a R$100 sem os R$30 de multa

### Correção

**Arquivo: `src/hooks/useLoans.ts`** (no bloco `parcelaMatch`, após a remoção das tags de sub-parcela)

Extrair o valor da multa da tag `[PENALTY_INCLUDED:X.XX]` presente nas notas do pagamento e restaurar a tag `[DAILY_PENALTY:índice:valor]` nas notas do empréstimo:

```typescript
// Restaurar tag DAILY_PENALTY se o pagamento incluiu multa
const penaltyMatch = paymentNotes.match(/\[PENALTY_INCLUDED:([0-9.]+)\]/);
if (penaltyMatch) {
  const penaltyValue = parseFloat(penaltyMatch[1]);
  if (penaltyValue > 0) {
    // Verificar se já não existe uma DAILY_PENALTY para este índice
    const existingPenalty = new RegExp(`\\[DAILY_PENALTY:${installmentIndex}:[0-9.]+\\]`);
    if (!existingPenalty.test(newNotes)) {
      newNotes = `[DAILY_PENALTY:${installmentIndex}:${penaltyValue.toFixed(2)}]\n${newNotes}`.trim();
    }
  }
}
```

Também aplicar a mesma lógica no bloco `advanceMatch` (linha 826) e no bloco de sub-parcela (linha 808), para cobrir todos os cenários de exclusão.

### Arquivos
- `src/hooks/useLoans.ts` — restaurar `DAILY_PENALTY` ao excluir pagamento que incluiu multa

