
# Plano: Corrigir Lógica de Atraso para Contratos com Juros Históricos

## Problema Identificado

O relatório de empréstimos do usuário `gustaavo92@hotmail.com` está exibindo aproximadamente R$ 34 mil em atraso incorretamente. Após análise dos dados, identifiquei dois problemas:

### Problema 1: Status Incorreto no Banco de Dados
Alguns empréstimos estão marcados como `status: overdue` no banco mesmo quando o `due_date` ainda não passou:

| Cliente | Remaining Balance | Status | Due Date | Problema |
|---------|------------------|--------|----------|----------|
| Bruce | R$ 7.200 | overdue | 2026-02-14 | Due date no futuro |
| Felipão | R$ 12.000 | overdue | 2026-02-28 | Due date no futuro |

Total incorretamente marcado: R$ 19.200

### Problema 2: Lógica de Cálculo de Parcelas Pagas
A função `calculatePaidInstallments` em `src/lib/calculations.ts` não reconhece contratos com juros históricos corretamente:

```text
Fluxo Atual (com bug):
1. Busca tags [PARTIAL_PAID:X:Y] nas notas
2. Contratos históricos usam [INTEREST_ONLY_PAID:] em vez de [PARTIAL_PAID:]
3. Retorna paidCount = 0 mesmo com juros pagos
4. isLoanOverdue verifica dates[0] e marca como atrasado se data passou
```

### Problema 3: Dados de Parcelas Inconsistentes
O empréstimo do Felipão tem `installment_dates: ["2026-02-28", "2026-01-30", "2026-02-28"]` com datas fora de ordem cronológica, causando cálculos incorretos.

## Solução Proposta

### Etapa 1: Atualizar Lógica de isLoanOverdue para Contratos Históricos

Modificar `src/lib/calculations.ts` para tratar especialmente contratos com a tag `[HISTORICAL_INTEREST_CONTRACT]`:

```typescript
export function isLoanOverdue(loan: LoanForCalculation): boolean {
  if (loan.status === 'paid') return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // NOVA LÓGICA: Contratos com juros históricos e 1 parcela
  // Usam due_date como referência principal, não installment_dates
  const isHistoricalInterestContract = (loan.notes || '').includes('[HISTORICAL_INTEREST_CONTRACT]');
  const isSingleInstallment = (loan.installments || 1) === 1;
  
  if (isHistoricalInterestContract && isSingleInstallment) {
    const loanDueDate = new Date(loan.due_date + 'T12:00:00');
    loanDueDate.setHours(0, 0, 0, 0);
    return today > loanDueDate;
  }
  
  // ... resto da lógica existente ...
}
```

### Etapa 2: Corrigir Status dos Empréstimos no Banco

Executar correção SQL para os 2 empréstimos incorretamente marcados:

```sql
UPDATE loans 
SET status = 'pending', updated_at = NOW()
WHERE id IN (
  '3133e6a2-1303-42ee-a205-657ea658e5d4',  -- Bruce
  '13a4d9a1-4cd9-40f6-bfb6-1f0100c0c5b6'   -- Felipão
)
AND due_date > CURRENT_DATE;
```

### Etapa 3: Atualizar getDaysOverdue para Contratos Históricos

Aplicar a mesma lógica especial em `getDaysOverdue`:

```typescript
export function getDaysOverdue(loan: LoanForCalculation): number {
  if (!isLoanOverdue(loan)) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Para contratos históricos, usar due_date
  const isHistoricalInterestContract = (loan.notes || '').includes('[HISTORICAL_INTEREST_CONTRACT]');
  const isSingleInstallment = (loan.installments || 1) === 1;
  
  let nextDueDate: Date | null;
  if (isHistoricalInterestContract && isSingleInstallment) {
    nextDueDate = new Date(loan.due_date + 'T12:00:00');
  } else {
    nextDueDate = getNextUnpaidInstallmentDate(loan);
  }
  
  // ... resto ...
}
```

## Arquivos a Modificar

1. **src/lib/calculations.ts**
   - Função `isLoanOverdue`: Adicionar tratamento especial para `[HISTORICAL_INTEREST_CONTRACT]`
   - Função `getDaysOverdue`: Sincronizar lógica com `isLoanOverdue`
   - Função `getNextUnpaidInstallmentDate`: Adicionar tratamento para contratos históricos

2. **Migração SQL**
   - Corrigir status de empréstimos incorretamente marcados como `overdue`

## Resultado Esperado

Após as correções:
- Contratos com juros históricos serão avaliados pelo `due_date` final
- Empréstimos com pagamentos de juros em dia não aparecerão como "em atraso"
- O valor "Em Atraso" do relatório refletirá apenas empréstimos genuinamente vencidos
- Redução esperada: de ~R$ 34 mil para ~R$ 0 em atraso (assumindo que todos os due_dates estão no futuro)

## Detalhes Técnicos

### Identificação de Contratos Históricos

```typescript
const isHistoricalInterestContract = (notes || '').includes('[HISTORICAL_INTEREST_CONTRACT]');
```

### Lógica de Atraso Corrigida

Para contratos históricos com 1 parcela:
- Ignorar `installment_dates` para cálculo de atraso
- Usar apenas `due_date` como referência
- Considerar atrasado APENAS se `today > due_date`

Para outros contratos (comportamento atual mantido):
- Continuar usando `installment_dates` e `calculatePaidInstallments`
- Verificar próxima parcela não paga
