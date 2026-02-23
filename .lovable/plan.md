
## Problema

As mensagens de cobrança para empréstimos diários estão sendo enviadas sem a lista de status das parcelas em alguns casos. Existem 3 causas raiz:

### Causa 1: `paidIndices` não está sendo passado
Em `Loans.tsx`, ao montar os dados de notificação (overdue e due_today), o campo `paidIndices` (que indica quais parcelas foram pagas via tags `[PARTIAL_PAID]`) **não está sendo incluído** nos dados. Isso afeta 4 locais no arquivo (2 instâncias de `getOverdueNotificationData` e 2 de `getDueTodayNotificationData`).

Sem `paidIndices`, a lógica de status usa `paidCount` sequencial, que não funciona corretamente para empréstimos diários onde pagamentos podem ser feitos fora de ordem.

### Causa 2: Múltiplas parcelas em atraso (diários) pula a lista
Em `SendOverdueNotification.tsx`, quando `hasMultipleOverdue && data.isDaily` (linha ~208), o bloco de código gera a mensagem com detalhamento das parcelas em atraso mas **não inclui** a lista de status das parcelas com emojis.

### Causa 3: Limite de 20 parcelas bloqueia diários
Em `messageUtils.ts` (linha 132), `generateInstallmentStatusList` retorna string vazia quando `installmentDates.length > 20`. Empréstimos diários frequentemente possuem mais de 20 parcelas.

## Solução

### 1. Adicionar `paidIndices` nos dados de notificação (Loans.tsx)
Nos 4 callbacks (`getOverdueNotificationData` e `getDueTodayNotificationData`, nas 2 instâncias - linhas ~8198 e ~10599 para overdue, ~8246 e ~10647 para due_today), adicionar:

```typescript
paidIndices: getPaidIndicesFromNotes(loan),
```

### 2. Adicionar lista de parcelas no bloco de múltiplos atrasos diários (SendOverdueNotification.tsx)
Após o bloco que lista as parcelas em atraso individuais e o total a pagar (~linha 244), inserir a geração da lista de status:

```typescript
if (config.includeInstallmentsList && data.installmentDates && data.installmentDates.length > 0) {
  message += `\n`;
  message += generateInstallmentStatusList({
    installmentDates: data.installmentDates,
    paidCount: data.paidCount || 0,
    paidIndices: data.paidIndices,
  });
}
```

### 3. Aumentar o limite de parcelas para diários (messageUtils.ts)
Alterar o limite de 20 para um valor maior (ex: 60) ou remover o limite para que empréstimos diários também exibam a lista:

```typescript
// De:
if (!installmentDates || installmentDates.length === 0 || installmentDates.length > 20) {
// Para:
if (!installmentDates || installmentDates.length === 0 || installmentDates.length > 60) {
```

### Arquivos afetados
- `src/pages/Loans.tsx` - 4 alterações (adicionar `paidIndices` nos 4 callbacks)
- `src/components/SendOverdueNotification.tsx` - 1 alteração (adicionar lista no bloco de múltiplos atrasos)
- `src/lib/messageUtils.ts` - 1 alteração (aumentar limite de parcelas)
