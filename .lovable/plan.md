

# Corrigir Cálculo de Juros Pendentes para Rollover

## Problema Identificado

Quando o cliente paga **apenas os juros** mas não paga o principal, o sistema faz um "rollover" - ou seja, novos juros são gerados:

| Campo | Valor | Significado |
|-------|-------|-------------|
| `principal_amount` | R$ 10.000 | Capital original |
| `total_interest` | R$ 2.000 | Juros originais do contrato |
| `total_paid` | R$ 2.000 | Juros originais foram pagos |
| `remaining_balance` | R$ 12.000 | Principal + **novos juros** de rollover |

O `remaining_balance` de R$ 12.000 indica que há R$ 2.000 de **novos juros** além do principal de R$ 10.000.

## Solução

Calcular juros pendentes baseado no `remaining_balance` menos o principal restante, não apenas no `total_interest` original:

```text
Juros Pendentes = remaining_balance - (principal_amount - principal_paid)
                = R$ 12.000 - (R$ 10.000 - R$ 0)
                = R$ 2.000
```

## Alterações Necessárias

### Arquivo: `src/pages/ReportsLoans.tsx`

**Modificar cálculo de `pendingInterest` (linhas 460-538):**

Trocar a lógica de `totalInterest - interestPaid` para usar o `remaining_balance`:

```typescript
// Calcular juros pendentes baseado no remaining_balance
// Isso captura juros de rollover que não estão no total_interest original
const principalPaid = payments.reduce((s: number, p: any) => 
  s + Number(p.principal_paid || 0), 0);

const principalRemaining = principal - principalPaid;

// Juros pendentes = saldo devedor - principal restante
// Se remaining_balance = 12000 e principal restante = 10000, juros = 2000
const pendingInterestFromBalance = Math.max(0, remainingBalance - principalRemaining);

// Se há período selecionado, filtrar por datas de vencimento
if (dateRange?.from && dateRange?.to && installmentDates.length > 0) {
  // ... lógica de filtro por período usando pendingInterestFromBalance
}

return sum + pendingInterestFromBalance;
```

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Juros Pendentes | R$ 0,00 | R$ 2.000,00 |
| Juros no Período | R$ 2.000,00 | R$ 2.000,00 |

Ambos os cards agora mostrarão R$ 2.000:
- **Juros Pendentes**: Juros que ainda faltam pagar (rollover)
- **Juros no Período**: Juros das parcelas que vencem no período

## Arquivos Modificados

| Arquivo | Alterações |
|---------|------------|
| `src/pages/ReportsLoans.tsx` | Usar `remaining_balance - principal_restante` para calcular juros pendentes |

## Notas Importantes

Esta correção captura automaticamente qualquer cenário de rollover de juros, pois o `remaining_balance` sempre reflete o saldo real (principal + juros pendentes), independente de quantas vezes o cliente pagou "só juros".

