
## Plano: Correção do Número de Parcelas em Empréstimos de Juros Antigos

### Problema

Ao criar um empréstimo de "Juros Antigos" e registrar 1 pagamento de juros histórico, o sistema está salvando `installments = 2` em vez de manter `installments = 1`. Isso causa:

1. Exibição incorreta: "2x R$ 270,00" em vez de "1x R$ 420,00"
2. Cronograma de parcelas incorreto: mostra 2 parcelas pendentes
3. Cálculos de progresso e status incorretos

### Causa Raiz

Na função `handleSubmit` (linhas ~3700-3740) e na função de empréstimos diários (~3085-3110), após registrar pagamentos de juros históricos, o código atualiza o banco com:

```typescript
const totalInstallmentsCount = selectedHistoricalInterestInstallments.length + 1;
// ...
await supabase.from('loans').update({
  // ...
  installments: totalInstallmentsCount,  // ← AQUI ESTÁ O BUG
}).eq('id', loanId);
```

Se o usuário seleciona 1 parcela de juros históricos, o sistema calcula `1 + 1 = 2` parcelas, o que é incorreto para empréstimos de parcela única com juros antigos.

### Solução

Para empréstimos de "Juros Antigos" (parcela única), o número de parcelas **não deve ser alterado**. Os pagamentos de juros históricos representam cobranças periódicas de juros que já foram recebidas, mas o contrato continua sendo de **1 parcela única** que vence no futuro.

#### Alterações no arquivo `src/pages/Loans.tsx`:

**1. Corrigir lógica para empréstimos normais (linhas ~3710-3740):**

```typescript
// ANTES (incorreto):
const totalInstallmentsCount = selectedHistoricalInterestInstallments.length + 1;
// ...
installments: totalInstallmentsCount,

// DEPOIS (correto):
// Para contratos de Juros Antigos (parcela única), NÃO alterar o número de parcelas
// O número de parcelas original deve ser mantido - os juros históricos são apenas
// registros de juros já recebidos, não parcelas adicionais
const originalInstallments = formData.payment_type === 'single' ? 1 : 
  (formData.installments ? parseInt(formData.installments) : 1);
// ...
installments: originalInstallments,  // Manter original
```

**2. Corrigir lógica para empréstimos diários (linhas ~3085-3110):**

Similar correção para manter o número original de parcelas configuradas, não sobrescrever com `selectedHistoricalInterestInstallments.length + 1`.

**3. Corrigir cálculo de `remaining_balance` e `total_interest`:**

O `remaining_balance` e `total_interest` devem refletir os valores corretos considerando:
- Principal: mantido intacto (juros antigos NÃO reduzem principal)
- Juros totais: baseado na configuração original do empréstimo
- Remaining: total a receber menos juros já pagos

#### Lógica corrigida para empréstimos de parcela única:

```typescript
// Para parcela única (single) com juros antigos:
// - installments permanece 1
// - installment_dates pode ter 1 data (a data de vencimento final)
// - remaining_balance = principal + total_interest - juros_ja_pagos
// - NÃO alterar due_date baseado em parcelas históricas

if (formData.payment_type === 'single') {
  // Manter a data de vencimento original
  // Não recalcular installments baseado em juros históricos
  await supabase.from('loans').update({
    notes: currentNotes.trim(),
    // NÃO alterar: due_date, installment_dates, installments
    // Apenas atualizar remaining_balance para refletir juros já pagos
    remaining_balance: correctedRemainingBalance,
  }).eq('id', loanId);
}
```

### Detalhes Técnicos

**Arquivos a modificar:**
- `src/pages/Loans.tsx` (linhas ~3085-3110 e ~3706-3740)

**Alterações específicas:**

1. **Linha ~3708-3715**: Adicionar condição para empréstimos `single`:
   ```typescript
   // Para single payment, não alterar installments
   const isSinglePayment = formData.payment_type === 'single';
   const finalInstallments = isSinglePayment 
     ? 1 
     : (selectedHistoricalInterestInstallments.length + 1);
   ```

2. **Linha ~3730-3738**: Condicionar a atualização:
   ```typescript
   const updateData: Record<string, any> = {
     notes: currentNotes.trim(),
     remaining_balance: correctedRemainingBalance,
   };
   
   // Só alterar dates e installments se NÃO for parcela única
   if (!isSinglePayment) {
     updateData.due_date = nextDueDate;
     updateData.installment_dates = updatedDates;
     updateData.total_interest = correctedTotalInterest;
     updateData.installments = finalInstallments;
   }
   
   await supabase.from('loans').update(updateData).eq('id', loanId);
   ```

3. **Mesma correção para diários** (linhas ~3095-3110): Aplicar lógica similar.

### Resultado Esperado

Após a correção:
- Empréstimo de R$ 300 com 40% de juros
- Juros total: R$ 120
- Total a receber: R$ 420
- 1 pagamento de juros antigo registrado: R$ 120
- Exibição correta: **1x R$ 420,00** (não 2x R$ 270,00)
- Remaining balance: R$ 300 (principal restante após juros já pagos)
- Progresso: "0 de 1 parcela(s) paga(s)" (o principal ainda está pendente)
