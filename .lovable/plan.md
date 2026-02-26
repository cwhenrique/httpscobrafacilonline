

## Correção: Pagamentos excluídos não somem da aba Recebimentos

### Problema
A função `invalidateLoans()` invalida as queries `['loans']`, `['operational-stats']`, `['dashboard-stats']` e `['all-payments']`, mas **não invalida** `['payments-history']` — que é a query usada pelo `PaymentsHistoryTab`. Resultado: ao excluir um pagamento, a aba de Recebimentos continua mostrando o pagamento deletado até o cache expirar (2 minutos).

### Correção

**Arquivo: `src/hooks/useLoans.ts` (linha 157)**

Adicionar invalidação da query `payments-history` dentro de `invalidateLoans()`:

```typescript
const invalidateLoans = () => {
  queryClient.invalidateQueries({ queryKey: ['loans'] });
  queryClient.invalidateQueries({ queryKey: ['operational-stats'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  queryClient.invalidateQueries({ queryKey: ['all-payments'] });
  queryClient.invalidateQueries({ queryKey: ['payments-history'] }); // NOVO
};
```

Uma linha adicionada. Isso garante que qualquer operação que chame `invalidateLoans()` (criar, excluir, registrar pagamento) também atualize a aba de Recebimentos.

