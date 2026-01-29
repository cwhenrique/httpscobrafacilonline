
# Plano: Corrigir Exibição de Multa no Comprovante PDF e Mensagens

## Problema Identificado

Quando o usuário registra um pagamento de parcela que inclui multa, o comprovante PDF e as mensagens de WhatsApp não mostram o valor da multa - apenas o valor total pago.

### Causa Raiz

O cálculo de `totalPenaltyPaid` (multa paga) nas linhas 4309-4322 do arquivo `Loans.tsx` tem uma falha lógica:

```javascript
let totalPenaltyPaid = 0;
if (paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0) {
  // Somar multas das parcelas selecionadas - FUNCIONA ✓
  for (const idx of paymentData.selected_installments) {
    totalPenaltyPaid += loanPenalties[idx] || 0;
  }
} else if (paymentData.payment_type === 'partial' && paymentData.partial_installment_index !== null && paymentData.partial_installment_index >= 0) {
  // Multa da parcela específica - SÓ FUNCIONA SE USUÁRIO SELECIONOU PARCELA EXPLÍCITA ✗
  totalPenaltyPaid = loanPenalties[paymentData.partial_installment_index] || 0;
} else if (paymentData.payment_type === 'total') {
  // Pagamento total - somar todas as multas - FUNCIONA ✓
  totalPenaltyPaid = getTotalDailyPenalties(selectedLoan.notes);
}
```

**O problema**: Quando o usuário faz pagamento parcial **sem selecionar uma parcela explícita** (o sistema auto-detecta qual parcela está sendo paga usando `targetInstallmentIndex`), a condição `paymentData.partial_installment_index !== null` falha e a multa **não é incluída**.

A variável `targetInstallmentIndex` é calculada corretamente mais acima no código (linhas 3846-3886), mas não é usada para calcular a multa.

## Solução

Modificar a lógica de cálculo da multa para usar `targetInstallmentIndex` quando `paymentData.partial_installment_index` não está definido:

### Alteração Técnica

**Arquivo**: `src/pages/Loans.tsx`
**Linhas**: ~4309-4322

**Antes**:
```javascript
let totalPenaltyPaid = 0;
if (paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0) {
  for (const idx of paymentData.selected_installments) {
    totalPenaltyPaid += loanPenalties[idx] || 0;
  }
} else if (paymentData.payment_type === 'partial' && paymentData.partial_installment_index !== null && paymentData.partial_installment_index >= 0) {
  totalPenaltyPaid = loanPenalties[paymentData.partial_installment_index] || 0;
} else if (paymentData.payment_type === 'total') {
  totalPenaltyPaid = getTotalDailyPenalties(selectedLoan.notes);
}
```

**Depois**:
```javascript
let totalPenaltyPaid = 0;
if (paymentData.payment_type === 'installment' && paymentData.selected_installments.length > 0) {
  // Somar multas das parcelas selecionadas
  for (const idx of paymentData.selected_installments) {
    totalPenaltyPaid += loanPenalties[idx] || 0;
  }
} else if (paymentData.payment_type === 'partial') {
  // Usar targetInstallmentIndex para pagamentos parciais (já calculado anteriormente)
  // Cobre tanto seleção explícita quanto auto-detecção
  totalPenaltyPaid = loanPenalties[targetInstallmentIndex] || 0;
} else if (paymentData.payment_type === 'total') {
  // Pagamento total - somar todas as multas
  totalPenaltyPaid = getTotalDailyPenalties(selectedLoan.notes);
}
```

## Por que esta solução funciona?

A variável `targetInstallmentIndex` já é calculada corretamente no código (linhas 3846-3886):

1. Se `paymentData.partial_installment_index` está definido → `targetInstallmentIndex = paymentData.partial_installment_index`
2. Se não está definido → sistema detecta automaticamente a próxima parcela não paga

Usar `targetInstallmentIndex` em vez de `paymentData.partial_installment_index` unifica a lógica e garante que a multa sempre seja calculada corretamente.

## Comportamento Esperado Após Correção

| Cenário | Antes | Depois |
|---------|-------|--------|
| Pagamento de parcela com multa (parcela explícita) | Multa aparece | Multa aparece |
| Pagamento de parcela com multa (auto-detecção) | Multa NÃO aparece | Multa aparece |
| PDF mostra "Multa Inclusa: R$ X" | Às vezes | Sempre (quando há multa) |
| WhatsApp mostra "Multa: R$ X" | Às vezes | Sempre (quando há multa) |

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Loans.tsx` | Corrigir cálculo de `totalPenaltyPaid` (linhas ~4309-4322) |

## Impacto

- **Complexidade**: Baixa
- **Linhas alteradas**: ~5
- **Risco**: Mínimo (apenas corrige lógica de exibição, não afeta valores reais de pagamento)
- **Testes recomendados**: 
  - Registrar pagamento de parcela com multa aplicada
  - Verificar se PDF mostra "Multa Inclusa"
  - Verificar se mensagem WhatsApp mostra "Multa"
