
# Plano: Corrigir Exibição do Botão "Pagar" nas Assinaturas

## Problema Identificado

Quando uma assinatura é paga, o sistema gera automaticamente o pagamento do próximo mês. Porém, o botão "Pagar" não aparece imediatamente para o próximo mês porque a função `getCurrentMonthPayment` só busca pagamentos do **mês de referência atual** (ex: `2026-02-01` se estamos em fevereiro).

### Fluxo Atual (com bug):
1. Usuário paga janeiro → status `paid`
2. Sistema gera pagamento de fevereiro automaticamente
3. Função `getCurrentMonthPayment` busca por `reference_month = '2026-02-01'` (mês atual)
4. **Se ainda estamos em janeiro**, não encontra pagamento → status `no_charge` → sem botão "Pagar"
5. **Se estamos em fevereiro**, encontra o pagamento → botão "Pagar" aparece

### Fluxo Correto (a implementar):
1. Usuário paga janeiro → status `paid`
2. Sistema gera pagamento de fevereiro automaticamente
3. Função busca o **próximo pagamento pendente** (independente do mês)
4. Sempre mostra o próximo pagamento a pagar

## Solução

Modificar a lógica para buscar o **pagamento pendente mais próximo** ao invés de apenas o pagamento do mês atual.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ProductSales.tsx` | Modificar funções `getCurrentMonthPayment` e `getSubscriptionStatus` |

## Alterações Detalhadas

### `src/pages/ProductSales.tsx`

Substituir a função `getCurrentMonthPayment` por `getNextPendingPayment`:

```typescript
// ANTES (linhas 1236-1239):
const getCurrentMonthPayment = (feeId: string) => {
  const currentMonth = format(new Date(), 'yyyy-MM-01');
  return feePayments.find(p => p.monthly_fee_id === feeId && p.reference_month === currentMonth);
};

// DEPOIS:
const getNextPendingPayment = (feeId: string) => {
  // Buscar todos os pagamentos desta assinatura
  const feePaymentsList = feePayments.filter(p => p.monthly_fee_id === feeId);
  
  // Ordenar por due_date e pegar o primeiro pendente
  const pendingPayments = feePaymentsList
    .filter(p => p.status !== 'paid')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  
  // Se houver pagamento pendente, retornar ele
  if (pendingPayments.length > 0) {
    return pendingPayments[0];
  }
  
  // Se não houver pendentes, verificar se há algum pago recente (para mostrar status "pago")
  const currentMonth = format(new Date(), 'yyyy-MM-01');
  const paidThisMonth = feePaymentsList.find(
    p => p.reference_month === currentMonth && p.status === 'paid'
  );
  
  return paidThisMonth || null;
};
```

Atualizar a função `getSubscriptionStatus`:

```typescript
// ANTES (linhas 1241-1249):
const getSubscriptionStatus = (fee: MonthlyFee) => {
  if (!fee.is_active) return 'inactive';
  const currentPayment = getCurrentMonthPayment(fee.id);
  if (!currentPayment) return 'no_charge';
  if (currentPayment.status === 'paid') return 'paid';
  if (isPast(parseISO(currentPayment.due_date)) && !isToday(parseISO(currentPayment.due_date))) return 'overdue';
  if (isToday(parseISO(currentPayment.due_date))) return 'due_today';
  return 'pending';
};

// DEPOIS:
const getSubscriptionStatus = (fee: MonthlyFee) => {
  if (!fee.is_active) return 'inactive';
  const payment = getNextPendingPayment(fee.id);
  if (!payment) return 'no_charge';
  if (payment.status === 'paid') return 'paid';
  if (isPast(parseISO(payment.due_date)) && !isToday(parseISO(payment.due_date))) return 'overdue';
  if (isToday(parseISO(payment.due_date))) return 'due_today';
  return 'pending';
};
```

Atualizar as referências de `getCurrentMonthPayment` para `getNextPendingPayment` em:
- Linha 2604: `const currentPayment = getNextPendingPayment(fee.id);`
- Linha 2717: condição `{currentPayment && currentPayment.status !== 'paid' && (...`

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Após pagar janeiro, não aparece botão | Após pagar janeiro, aparece botão "Pagar fevereiro" |
| Status mostra "pago" sem opção de pagar próximo | Status mostra o próximo pagamento pendente |
| Precisa esperar virar o mês para pagar | Pode pagar imediatamente após renovação automática |

## Seção Técnica

### Por que essa mudança é necessária?

A lógica anterior usava `reference_month === currentMonth` para identificar o pagamento ativo. Isso funcionava bem quando:
- O mês de referência sempre correspondia ao mês atual
- Pagamentos eram criados no início do mês

Mas falhava quando:
- O pagamento era gerado automaticamente para o próximo mês
- O usuário pagava no final do mês

A nova lógica busca o **próximo pagamento pendente por data de vencimento**, garantindo que:
1. Sempre mostre o próximo pagamento a ser feito
2. Se todos estiverem pagos, mostre o status "pago" para o mês atual
3. Funcione independente de quando o pagamento foi criado
