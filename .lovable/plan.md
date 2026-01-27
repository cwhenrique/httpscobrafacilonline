

# Simplificar para Um Único Card "Juros a Receber"

## Objetivo

Consolidar os dois cards de juros (Juros Pendentes + Juros no Período) em um único card **"Juros a Receber"** que mostra os juros a receber das parcelas que vencem no período filtrado, usando a lógica correta de rollover.

## Lógica de Negócio

Quando o cliente paga via "PAGAR JUROS":
1. O sistema registra como pagamento de juros (`interest_paid`)
2. O principal permanece devendo
3. Novos juros são adicionados ao `remaining_balance` (rollover)
4. O card "Juros a Receber" deve mostrar esses novos juros

**Cálculo:**
```text
Juros a Receber = remaining_balance - principal_restante
```

## Alterações Necessárias

### Arquivo: `src/pages/ReportsLoans.tsx`

**1. Remover cálculo de `interestScheduledInPeriod` (linhas 511-555):**

Deletar todo o bloco que calcula juros programados separadamente.

**2. Manter apenas `pendingInterest` (linhas 465-509):**

A lógica atual já está correta - usa `remaining_balance - principal_restante` para capturar rollover.

**3. Atualizar retorno do `filteredStats` (linha 661):**

Remover `interestScheduledInPeriod` do objeto retornado:

```typescript
return {
  totalOnStreet,
  pendingInterest,  // Manter - agora é o único
  // interestScheduledInPeriod, ← REMOVER
  totalReceivedAllTime: totalReceivedInPeriod,
  // ...resto
};
```

**4. Atualizar UI - Consolidar em um card (linhas 1141-1158):**

Substituir os dois cards por um único:

```tsx
{/* Antes: 2 cards */}
<StatCard label="💰 Juros Pendentes" ... />
<StatCard label="📅 Juros no Período" ... />

{/* Depois: 1 card */}
<StatCard
  label="💰 Juros a Receber"
  value={formatCurrency(filteredStats.pendingInterest)}
  icon={TrendingUp}
  iconColor="text-primary"
  bgColor="bg-primary/10"
  subtitle="No período"
  compact
/>
```

## Resultado Esperado

| Cenário | Filtro | Card "Juros a Receber" |
|---------|--------|------------------------|
| Empréstimo R$ 10k, juros R$ 2k pagos via rollover | jan-mai (parcela em 27/03) | R$ 2.000,00 |
| Mesmo empréstimo | jun-dez (fora do período) | R$ 0,00 |
| Sem filtro de período | Todos | R$ 2.000,00 |

## Arquivos Modificados

| Arquivo | Alterações |
|---------|------------|
| `src/pages/ReportsLoans.tsx` | Remover `interestScheduledInPeriod`, manter apenas `pendingInterest`, consolidar UI em um card |

## Resumo Técnico

- Remove ~45 linhas de código duplicado
- Simplifica a interface de 6 para 5 cards no grid
- Mantém a lógica correta de rollover via `remaining_balance - principal_restante`
- Filtra por período usando as datas de vencimento das parcelas

