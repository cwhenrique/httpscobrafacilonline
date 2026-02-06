

## Plano: Corrigir Atraso Incorreto e Rollover de Data para Contratos de Juros Antigos

### Problema Identificado

Ao criar um empréstimo de "Juros Antigos" com 1 parcela (ex: R$ 300 + R$ 120 de juros = R$ 420), e marcar que já recebeu o pagamento de juros da parcela 20/01/2026:

1. **O sistema mostra a parcela como "em atraso"** (17 dias)
2. **Deveria mostrar como "juros pago"** e o vencimento rolado para 20/02/2026

### Causa Raiz

Existem **dois problemas** no código:

**Problema 1: Data não é atualizada para parcela única**

No arquivo `src/pages/Loans.tsx` (linhas ~3771-3777), quando é parcela única, o código **não atualiza** `due_date` e `installment_dates`:

```typescript
const isSingleInstallment = isSinglePayment || parseInt(formData.installments || '1') === 1;
if (!isSingleInstallment) {  // ← AQUI: Se é parcela única, NÃO atualiza datas
  updateData.due_date = nextDueDate;
  updateData.installment_dates = updatedDates;
}
```

Para contratos de juros antigos, quando o usuário paga o juros de uma parcela, a data deveria rolar para o próximo mês (20/01 → 20/02).

**Problema 2: Contagem de parcelas não considera juros pagos**

A função `getPaidInstallmentsCount()` (linhas 294-394) conta apenas parcelas com tag `[PARTIAL_PAID:]`, mas **não conta** parcelas com tag `[INTEREST_ONLY_PAID:]`. Isso faz com que:

- `paidInstallments = 0` (mesmo tendo pago juros)
- A lógica de atraso verifica `dates.slice(paidInstallments)` = `dates.slice(0)` = todas as datas
- A data 20/01/2026 < hoje (06/02/2026) → sistema marca como "em atraso"

### Solução

#### A) Atualizar `due_date` para contratos de juros antigos com parcela única

Quando for um contrato de juros antigos (`[HISTORICAL_INTEREST_CONTRACT]`) com 1 parcela, **devemos atualizar** a data de vencimento para a próxima data do ciclo, mesmo sendo parcela única.

**Mudança no bloco de empréstimos normais (~linhas 3771-3777):**

```typescript
// ANTES:
const isSingleInstallment = isSinglePayment || parseInt(formData.installments || '1') === 1;
if (!isSingleInstallment) {
  updateData.due_date = nextDueDate;
  updateData.installment_dates = updatedDates;
}

// DEPOIS:
const isSingleInstallment = isSinglePayment || parseInt(formData.installments || '1') === 1;
// 🆕 Para contratos de juros antigos, SEMPRE atualizar a data para a próxima do ciclo
// Isso garante que o vencimento "role" para o próximo mês após pagar o juros
if (!isSingleInstallment || formData.is_historical_contract) {
  updateData.due_date = nextDueDate;
  updateData.installment_dates = updatedDates;
}
```

**Mesma mudança no bloco de empréstimos diários (~linhas 3121-3125):**

```typescript
// DEPOIS:
if (!isSingleInstallment || formData.is_historical_contract) {
  updateDataDaily.due_date = nextDueDate;
  updateDataDaily.installment_dates = updatedDates;
}
```

#### B) Ajustar lógica de contagem para contratos de juros antigos

Na função `getLoanStatus()` (~linhas 2513-2567), para contratos `[HISTORICAL_INTEREST_CONTRACT]`, precisamos contar quantas parcelas tiveram juros pagos via `[INTEREST_ONLY_PAID:]` e usar esse valor como `paidInstallments`:

**Adicionar helper function (antes da função `getLoanStatus`):**

```typescript
// Helper para contar parcelas com juros pagos (para contratos de juros antigos)
const getInterestPaidInstallmentsCount = (notes: string | null): number => {
  const interestOnlyPayments = getInterestOnlyPaymentsFromNotes(notes);
  // Cada índice único de INTEREST_ONLY_PAID representa uma parcela com juros pago
  const uniqueIndices = new Set(interestOnlyPayments.map(p => p.installmentIndex));
  return uniqueIndices.size;
};
```

**Modificar `getLoanStatus` (~linha 2464):**

```typescript
// ANTES:
const paidInstallments = getPaidInstallmentsCount(loan);

// DEPOIS:
// Para contratos de juros antigos, considerar parcelas com juros pagos como "cobertas"
let paidInstallments = getPaidInstallmentsCount(loan);
if (isHistoricalInterestContract) {
  const interestPaidCount = getInterestPaidInstallmentsCount(loan.notes);
  paidInstallments = Math.max(paidInstallments, interestPaidCount);
}
```

### Arquivos a Modificar

- **`src/pages/Loans.tsx`**:
  - Adicionar helper function `getInterestPaidInstallmentsCount()`
  - Modificar `getLoanStatus()` para considerar juros pagos em contratos históricos
  - Modificar bloco de atualização de datas para empréstimos normais (linhas ~3771-3777)
  - Modificar bloco de atualização de datas para empréstimos diários (linhas ~3121-3125)

### Resultado Esperado

Após a correção, um empréstimo de juros antigos:
- Principal: R$ 300
- Juros: 40% = R$ 120
- Total a receber: R$ 420
- Marcado juros pago em 20/01/2026

Exibirá:
- **Vencimento**: 20/02/2026 (próximo mês)
- **Status**: Não está em atraso
- **Parcela**: 1x R$ 420
- **Juros pago**: R$ 120

### Validação

1. Criar empréstimo de juros antigos com:
   - Principal R$ 300, Juros 40%, Parcela única
   - Data de início: 20/01/2026
   - Marcar pagamento de juros da parcela 1 (R$ 120)
2. Verificar que:
   - Vencimento mostra 20/02/2026
   - Card NÃO mostra "em atraso"
   - Restante a receber: R$ 420
   - Pago: R$ 120 (juros históricos)

