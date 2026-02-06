
## Plano: Correção do Remaining Balance para Empréstimos de Juros Antigos

### Problema Identificado

Ao criar um empréstimo de "Juros Antigos" (parcela única) com 1 pagamento de juros histórico registrado, o sistema está:

1. **Restante a receber mostra R$ 300** em vez de R$ 420
2. **Parcela mostra R$ 180** (300/1,66...) em vez de R$ 420

Isso ocorre porque o `remaining_balance` está sendo calculado como:
```
remaining_balance = principal + total_interest - juros_historicos_pagos
remaining_balance = 300 + 120 - 120 = 300  ❌ ERRADO
```

### Causa Raiz

Na linha 3731 do arquivo `src/pages/Loans.tsx`:
```typescript
const correctedRemainingBalance = principal + correctedTotalInterest - totalHistoricalInterest;
```

Para empréstimos de **parcela única com juros antigos**, esta lógica está incorreta.

### Conceito Correto de "Juros Antigos"

Os "Juros Antigos" representam **juros periódicos já recebidos** antes de cadastrar o contrato:
- O cliente já pagou juros ao longo do tempo
- O principal **ainda está pendente** e será pago na data de vencimento
- O contrato de parcela única espera receber: **Principal + Juros**

Portanto:
- ✅ `total_paid` aumenta com os juros históricos (registro do que já foi recebido)
- ❌ `remaining_balance` **NÃO deve diminuir** - continua sendo o total do contrato

### Solução

Para empréstimos de **parcela única** (`payment_type === 'single'`) com juros históricos:

**1. Manter `remaining_balance` = `principal + total_interest` (sem subtrair juros históricos)**

```typescript
// Para parcela única, remaining_balance deve ser o total do contrato
// Os juros históricos são registros de juros JÁ RECEBIDOS, não abatimento
const isSinglePayment = formData.payment_type === 'single';
const correctedRemainingBalance = isSinglePayment
  ? principal + correctedTotalInterest  // Parcela única: manter total
  : principal + correctedTotalInterest - totalHistoricalInterest;  // Outros: pode subtrair
```

**2. Ajustar a mesma lógica para empréstimos diários (linhas ~3110-3120)**

Aplicar a mesma correção no bloco de empréstimos diários.

### Arquivos a Modificar

- `src/pages/Loans.tsx`:
  - Linhas ~3100-3120 (empréstimos diários)
  - Linhas ~3730-3740 (empréstimos normais)

### Resultado Esperado

Após a correção, um empréstimo de:
- Principal: R$ 300
- Juros: 40% = R$ 120
- Total a receber: R$ 420
- 1 juros histórico registrado: R$ 120 (já recebido)

Exibirá:
- **Restante a receber**: R$ 420 ✅
- **Parcela**: 1x R$ 420 ✅
- **Total pago**: R$ 120 (juros antigos)
- **Lucro realizado**: R$ 120 ✅

### Alterações Específicas

**Bloco 1 - Empréstimos normais (linhas ~3730-3740):**
```typescript
// 🆕 CORREÇÃO: Para parcela única com juros antigos, NÃO subtrair do remaining_balance
// Os juros históricos são registros de juros JÁ RECEBIDOS, não abatimento do saldo
const isSinglePayment = formData.payment_type === 'single';
const correctedRemainingBalance = isSinglePayment
  ? principal + correctedTotalInterest
  : principal + correctedTotalInterest - totalHistoricalInterest;
```

**Bloco 2 - Empréstimos diários (linhas ~3100-3120):**
Mesma correção aplicada para manter consistência.
