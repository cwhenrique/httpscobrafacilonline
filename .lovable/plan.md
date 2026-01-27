
# Correção: Pagamentos de Empréstimos Diários Não Aparecem no Fluxo de Caixa

## Diagnóstico

Após investigação detalhada, encontrei o problema:

**Causa Raiz**: O cache do `useOperationalStats` (usado pelo Fluxo de Caixa) não é invalidado quando pagamentos são registrados.

### Fluxo Atual (com bug):
1. Usuário paga parcela de empréstimo diário
2. Sistema chama `invalidateLoans()` que invalida cache `['loans']`
3. Página de Empréstimos atualiza (mostra pagamento)
4. Página de Relatórios continua com dados antigos (cache `['operational-stats']` não foi invalidado)
5. Usuário precisa esperar 2 minutos ou clicar em "Atualizar" manualmente

### Dados Verificados no Banco:
| Tipo | Pagamentos em Janeiro | Total |
|------|----------------------|-------|
| Diário | 2 pagamentos | R$ 600,00 |
| Mensal | 1 pagamento | R$ 2.000,00 |

Os dados estão corretos no banco - o problema é apenas de sincronização do cache.

## Solução

Modificar a função `invalidateLoans()` no hook `useLoans.ts` para também invalidar o cache `operational-stats`, garantindo que todos os relatórios mostrem dados atualizados imediatamente após qualquer operação de pagamento.

## Alterações Técnicas

### Arquivo: `src/hooks/useLoans.ts`

**Modificar a função `invalidateLoans` (linha 149-151):**

```typescript
// Antes
const invalidateLoans = () => {
  queryClient.invalidateQueries({ queryKey: ['loans'] });
};

// Depois
const invalidateLoans = () => {
  queryClient.invalidateQueries({ queryKey: ['loans'] });
  queryClient.invalidateQueries({ queryKey: ['operational-stats'] });
};
```

Esta única alteração resolve o problema porque:
1. Toda operação de pagamento já chama `invalidateLoans()`
2. Ao adicionar a invalidação de `operational-stats`, o Fluxo de Caixa será atualizado automaticamente
3. O usuário verá os valores corretos imediatamente sem precisar clicar em "Atualizar"

## Resultado Esperado

- Após pagar parcela de empréstimo diário (ou qualquer tipo), o Fluxo de Caixa atualizará automaticamente
- "Entradas" mostrará o valor correto incluindo os novos pagamentos
- "Lucro" mostrará os juros recebidos corretamente
- Não será mais necessário clicar em "Atualizar" ou esperar 2 minutos

## Arquivo Modificado

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/hooks/useLoans.ts` | 149-151 | Adicionar invalidação do cache `operational-stats` |
