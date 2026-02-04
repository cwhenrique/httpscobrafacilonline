

# Plano: Corrigir Abatimento Duplicado em Pagamentos de Parcelas Diárias

## Problema Identificado

Quando um usuário:
1. Paga **R$100 parcialmente** em uma parcela diária de R$200
2. Depois seleciona a **mesma parcela** para pagar os R$100 restantes (usando tipo "parcela")

O sistema registra um pagamento de **R$200** (valor total da parcela) ao invés de **R$100** (valor restante), causando abatimento duplicado do `remaining_balance`.

## Causa Raiz

Na linha 4190-4192 do `src/pages/Loans.tsx`:

```typescript
} else if (paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0) {
  amount = paymentData.selected_installments.reduce((sum, i) => sum + getInstallmentValue(i), 0);
```

O código calcula `amount` como o **valor total da parcela** sem descontar os **pagamentos parciais já realizados** (`existingPartials`).

## Solução

Modificar o cálculo do `amount` para descontar os valores já pagos parcialmente:

```typescript
amount = paymentData.selected_installments.reduce((sum, i) => {
  const fullValue = getInstallmentValue(i);
  const alreadyPaid = existingPartials[i] || 0;
  const remaining = Math.max(0, fullValue - alreadyPaid);
  return sum + remaining;
}, 0);
```

## Arquivo a Modificar

**`src/pages/Loans.tsx`** - função `handlePaymentSubmit`

### Alteração Detalhada

| Linha | Antes | Depois |
|-------|-------|--------|
| 4190-4192 | `amount = paymentData.selected_installments.reduce((sum, i) => sum + getInstallmentValue(i), 0);` | `amount = paymentData.selected_installments.reduce((sum, i) => { const fullValue = getInstallmentValue(i); const alreadyPaid = existingPartials[i] \|\| 0; return sum + Math.max(0, fullValue - alreadyPaid); }, 0);` |

### Adicionar validação

Também precisamos adicionar uma validação para evitar registrar pagamento de R$0 se a parcela já estiver totalmente paga:

```typescript
if (amount <= 0.01) {
  toast.error('Esta parcela já está completamente paga');
  paymentLockRef.current = false;
  setIsPaymentSubmitting(false;
  return;
}
```

## Cenário de Teste

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | Criar empréstimo diário: principal R$400, 2 parcelas de R$200 | remaining_balance = R$400 |
| 2 | Pagar R$100 parcialmente na parcela 1 | remaining_balance = R$300 |
| 3 | Selecionar parcela 1 para pagar "como parcela" | Sistema deve registrar apenas R$100 (restante) |
| 4 | Verificar remaining_balance | Deve ser R$200 (não R$100 ou R$0) |

## Impacto

- Corrige o bug de abatimento duplicado em empréstimos diários
- Mantém compatibilidade com empréstimos mensais/semanais
- Não afeta pagamentos totais ou descontos

## Seção Técnica

### Código Completo da Correção

```typescript
// Linha ~4190-4199 em handlePaymentSubmit
} else if (paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0) {
  // 🆕 CORREÇÃO: Calcular valor restante da parcela descontando pagamentos parciais já feitos
  amount = paymentData.selected_installments.reduce((sum, i) => {
    const fullValue = getInstallmentValue(i);
    const alreadyPaid = existingPartials[i] || 0;
    const remaining = Math.max(0, fullValue - alreadyPaid);
    return sum + remaining;
  }, 0);
  
  // 🆕 Validar se há valor a pagar
  if (amount <= 0.01) {
    toast.error('Parcela(s) selecionada(s) já está(ão) completamente paga(s)');
    paymentLockRef.current = false;
    setIsPaymentSubmitting(false);
    return;
  }
  
  // Calcular juros e principal proporcionalmente ao valor efetivamente pago
  const baseTotal = baseInstallmentValue * paymentData.selected_installments.length;
  const actualBaseTotal = paymentData.selected_installments.reduce((sum, i) => {
    const fullValue = getInstallmentValue(i);
    const alreadyPaid = existingPartials[i] || 0;
    return sum + Math.max(0, fullValue - alreadyPaid);
  }, 0);
  
  // Proporção do valor base que está sendo pago
  const paymentRatio = actualBaseTotal / baseTotal || 0;
  
  interest_paid = interestPerInstallment * paymentData.selected_installments.length * paymentRatio;
  principal_paid = principalPerInstallment * paymentData.selected_installments.length * paymentRatio;
}
```

