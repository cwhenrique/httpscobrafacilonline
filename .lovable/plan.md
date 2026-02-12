
# Correcao do Status das Parcelas na Mensagem WhatsApp (Pagamentos Fora de Ordem)

## Problema

Quando um cliente de emprestimo diario paga parcelas fora de ordem (ex: pula a parcela 4 e paga a 5), a mensagem de cobranca/comprovante mostra incorretamente o status das parcelas. A parcela 5 aparece como "Em Aberto" mesmo estando paga, porque o sistema assume que pagamentos sao sempre sequenciais.

**Exemplo do bug:**
- Parcela 3: atrasada (nao paga)
- Parcela 4, 5, 6: pagas via PARTIAL_PAID tags
- Na mensagem: parcela 3 aparece "Em Atraso" (correto), mas 4, 5, 6 tambem aparecem como "Em Aberto" (incorreto)

**Causa raiz:**
1. `getPaidInstallmentsCount()` para de contar no primeiro gap (`break` na linha 391)
2. `getInstallmentStatus()` usa logica sequencial: `installmentNum <= paidCount`
3. Ambos assumem que parcelas sao pagas na ordem 1, 2, 3...

## Solucao

Passar o mapa real de parcelas pagas (extraido das tags `[PARTIAL_PAID:indice:valor]`) para as funcoes de geracao de mensagem, em vez de depender apenas de um contador sequencial.

### Alteracoes

**1. `src/lib/messageUtils.ts`**

- Adicionar campo opcional `paidIndices` (Set ou array de indices pagos) na interface `GenerateInstallmentListOptions`
- Atualizar `getInstallmentStatus` para aceitar opcionalmente um conjunto de indices pagos
- Quando `paidIndices` estiver presente, verificar se o indice especifico esta no conjunto em vez de usar `installmentNum <= paidCount`

```typescript
// Interface atualizada
interface GenerateInstallmentListOptions {
  installmentDates: string[];
  paidCount: number;
  paidIndices?: number[]; // indices (0-based) das parcelas efetivamente pagas
  maxOpenToShow?: number;
}

// getInstallmentStatus atualizado
export const getInstallmentStatus = (
  installmentNum: number, 
  paidCount: number, 
  dueDateStr: string,
  paidIndices?: number[]
): InstallmentStatusResult => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dueDateStr + 'T12:00:00');
  
  // Se temos o mapa real, usar ele (indice 0-based = installmentNum - 1)
  const isPaid = paidIndices 
    ? paidIndices.includes(installmentNum - 1)
    : installmentNum <= paidCount;
  
  if (isPaid) {
    return { emoji: '\u2705', status: 'Paga' };
  }
  
  if (dueDate < today) {
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return { emoji: '\u274C', status: `Em Atraso (${daysOverdue}d)`, daysOverdue };
  }
  
  return { emoji: '\u23F3', status: 'Em Aberto' };
};
```

- Atualizar `generateInstallmentStatusList` para propagar `paidIndices` ao chamar `getInstallmentStatus`

**2. `src/pages/Loans.tsx`**

- Criar helper `getPaidIndices(loan)` que retorna array de indices onde `PARTIAL_PAID` >= 99% do valor da parcela
- Passar `paidIndices` em todas as chamadas que enviam `installmentDates` e `paidCount` para os componentes de notificacao (SendOverdueNotification, SendDueTodayNotification, SendEarlyNotification, PaymentReceiptPrompt, LoanCreatedReceiptPrompt)

**3. Componentes de notificacao** (SendOverdueNotification, SendDueTodayNotification, SendEarlyNotification, PaymentReceiptPrompt)

- Adicionar `paidIndices?: number[]` na interface de dados
- Propagar para `generateInstallmentStatusList({ ..., paidIndices })`

### Resumo de arquivos

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/messageUtils.ts` | Adicionar `paidIndices` na interface e logica de status |
| `src/pages/Loans.tsx` | Criar helper e passar `paidIndices` em todas as chamadas |
| `src/components/SendOverdueNotification.tsx` | Aceitar e propagar `paidIndices` |
| `src/components/SendDueTodayNotification.tsx` | Aceitar e propagar `paidIndices` |
| `src/components/SendEarlyNotification.tsx` | Aceitar e propagar `paidIndices` |
| `src/components/PaymentReceiptPrompt.tsx` | Aceitar e propagar `paidIndices` |
| `src/components/LoanCreatedReceiptPrompt.tsx` | Aceitar e propagar `paidIndices` |
