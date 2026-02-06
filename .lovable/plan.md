
## Plano: Correção Definitiva do Remaining Balance para Contratos de Juros Antigos

### Problema Identificado

Através da análise dos logs de rede, identifiquei a causa raiz:

1. **Empréstimo criado corretamente** com `remaining_balance: 420`
2. **Mas o PATCH subsequente** (após registrar juros históricos) atualiza para `remaining_balance: 300`

O Request Body do PATCH mostra:
```json
{
  "remaining_balance": 300,  // ← ERRADO! Deveria ser 420
  "due_date": "2026-02-20",
  "installment_dates": ["2026-02-20"]
}
```

### Causa Raiz

A condição no código verifica:
```typescript
const isSinglePayment = formData.payment_type === 'single';
```

Mas o usuário está criando com `payment_type: "installment"` com 1 parcela, não `"single"`. Portanto, `isSinglePayment = false`, e o código executa:
```typescript
correctedRemainingBalance = principal + correctedTotalInterest - totalHistoricalInterest;
// = 300 + 120 - 120 = 300 ← ERRADO
```

### Solução Correta

Para contratos de **Juros Antigos** (que têm a tag `[HISTORICAL_INTEREST_CONTRACT]`), o `remaining_balance` deve **SEMPRE** ser mantido como `principal + total_interest`, independentemente do `payment_type`.

A regra de negócio é:
- Juros históricos são registros de **juros JÁ RECEBIDOS**
- Eles NÃO reduzem o saldo devedor
- O contrato ainda espera receber o **valor total (principal + juros)**

### Alterações no arquivo `src/pages/Loans.tsx`

**Linha ~3736-3756**: Substituir a verificação por `isSinglePayment` por uma verificação de **contrato de juros antigos**:

```typescript
// ANTES (incorreto):
const isSinglePayment = formData.payment_type === 'single';
// ...
const correctedRemainingBalance = isSinglePayment
  ? principal + correctedTotalInterest
  : principal + correctedTotalInterest - totalHistoricalInterest;

// DEPOIS (correto):
// Para contratos de Juros Antigos, NUNCA subtrair do remaining_balance
// Os juros históricos são registros de juros JÁ RECEBIDOS, não abatimento
// Esta lógica se aplica a QUALQUER payment_type (single, installment, etc.)
const correctedRemainingBalance = principal + correctedTotalInterest;
// (Sempre manter o total do contrato - juros antigos entram só em total_paid)
```

Além disso, para evitar alterar `due_date` e `installment_dates` desnecessariamente:

```typescript
// ANTES:
if (!isSinglePayment) {
  updateData.due_date = nextDueDate;
  updateData.installment_dates = updatedDates;
}

// DEPOIS:
// Para Juros Antigos de parcela única (1 parcela), não alterar datas
const isSingleInstallment = (formData.payment_type === 'single' || 
                              parseInt(formData.installments || '1') === 1);
if (!isSingleInstallment) {
  updateData.due_date = nextDueDate;
  updateData.installment_dates = updatedDates;
}
```

### Aplicar mesma correção para empréstimos diários

Na seção de empréstimos diários (~linhas 3040-3120), aplicar a mesma lógica: **NUNCA subtrair juros históricos do `remaining_balance`**.

### Resultado Esperado

Após a correção:
- Empréstimo criado: `remaining_balance = 420`
- PATCH após juros históricos: `remaining_balance = 420` (mantido)
- `due_date` e `installment_dates` não alterados para parcela única
- `total_paid = 120` (juros antigos)
- Card exibe: **Restante a receber: R$ 420** e **Parcela: 1x R$ 420**
