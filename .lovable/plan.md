
# Plano: Corrigir Auto-Renovação de Assinaturas IPTV

## Problema Identificado

Ao pagar uma assinatura, o próximo mês **não está sendo gerado automaticamente**. Isso acontece porque a função `markAsPaid` busca o pagamento na lista local do React Query (`payments`), que pode estar desatualizada ou vazia no momento da chamada.

### Código com Bug (linha 439 de useMonthlyFees.ts):
```typescript
const payment = payments.find(p => p.id === paymentId);
if (!payment) throw new Error('Pagamento não encontrado');
```

Se o `payments` não contém o registro (lista desatualizada), a função falha silenciosamente e não gera o próximo mês.

## Solução

Modificar a função `markAsPaid` para buscar o pagamento **diretamente do banco de dados** ao invés de depender da lista local.

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useMonthlyFees.ts` | Buscar pagamento do banco em vez da lista local |

## Alteração Detalhada

### `src/hooks/useMonthlyFees.ts` (linhas 437-492)

```typescript
// ANTES:
const markAsPaid = useMutation({
  mutationFn: async ({ paymentId, paidDate, paidAmount }) => {
    const payment = payments.find(p => p.id === paymentId);  // BUG!
    if (!payment) throw new Error('Pagamento não encontrado');
    // ...resto do código
  }
});

// DEPOIS:
const markAsPaid = useMutation({
  mutationFn: async ({ paymentId, paidDate, paidAmount }) => {
    // Buscar o pagamento diretamente do banco para garantir dados atualizados
    const { data: payment, error: fetchError } = await supabase
      .from('monthly_fee_payments')
      .select('*')
      .eq('id', paymentId)
      .single();
    
    if (fetchError || !payment) throw new Error('Pagamento não encontrado');
    // ...resto do código (continua igual)
  }
});
```

## Correção dos Dados Existentes

Também preciso gerar o pagamento de março para o cliente "devedor 02" que ficou sem renovação:

```sql
INSERT INTO monthly_fee_payments (user_id, monthly_fee_id, reference_month, amount, due_date, status)
SELECT 
  mf.user_id,
  mf.id,
  '2026-03-01'::date,
  mf.amount,
  MAKE_DATE(2026, 3, mf.due_day),
  'pending'
FROM monthly_fees mf
JOIN monthly_fee_payments mfp ON mfp.monthly_fee_id = mf.id
JOIN clients c ON c.id = mf.client_id
WHERE c.full_name ILIKE '%devedor 02%'
  AND mfp.reference_month = '2026-02-01'
  AND mfp.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM monthly_fee_payments mfp2 
    WHERE mfp2.monthly_fee_id = mf.id 
    AND mfp2.reference_month = '2026-03-01'
  );
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Pagar assinatura não gera próximo mês | Pagar sempre gera o próximo mês automaticamente |
| Lista local pode estar desatualizada | Busca dados frescos do banco |
| "devedor 02" ficou quitado | "devedor 02" terá cobrança de março pendente |

## Seção Técnica

### Por que o bug acontece?

1. O hook `useMonthlyFeePayments()` é chamado sem `feeId` na página ProductSales
2. Ele busca todos os pagamentos uma vez e armazena em `payments`
3. Quando `markAsPaid` é chamado, ele usa `payments.find()` para encontrar o registro
4. Se o `payments` não foi re-fetched após a última atualização, pode não conter o registro
5. `payments.find()` retorna `undefined` e a função para antes de gerar o próximo mês

### Solução robusta

Buscar diretamente do Supabase garante que sempre teremos os dados mais recentes, independente do estado do cache do React Query.
