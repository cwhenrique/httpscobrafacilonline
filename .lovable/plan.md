
# Plano: Unificar Métricas do Dashboard com Relatório de Empréstimos

## Diagnóstico do Problema

### Fontes de Dados Diferentes

| Página | Hook Utilizado | Fonte de Dados |
|--------|---------------|----------------|
| Dashboard | `useDashboardStats` | Função RPC `get_dashboard_stats` |
| Relatório | `useOperationalStats` | Consulta direta com cálculos no frontend |

### Cálculos Divergentes

**Dashboard (useDashboardStats):**
```
totalPending = rpcData.total_pending (apenas remaining_balance)
totalToReceive = total_pending + pending_interest + totalOverdueInterest
```

**Relatório (useOperationalStats):**
```
pendingAmount = remaining_balance + penalties + dynamicInterest
pendingInterest = calculado com base em juros ainda não recebidos
```

### Problemas Identificados

1. **Juros Pendentes**: O Dashboard usa `pending_interest` da RPC que calcula de forma diferente
2. **Multas (Penalties)**: O Relatório inclui multas aplicadas (`getTotalDailyPenalties`), o Dashboard não
3. **Juros por Atraso Dinâmicos**: Ambos calculam, mas em momentos e fontes diferentes
4. **Cache Diferente**: `useDashboardStats` usa RPC com cache de 2 min, `useOperationalStats` usa consulta direta

## Solução Proposta

### Unificar Dashboard para Usar useOperationalStats

O `useOperationalStats` já possui cálculos mais precisos e detalhados. Vamos fazer o Dashboard usar as mesmas fontes:

**Arquivo: `src/pages/Dashboard.tsx`**

1. Importar `useOperationalStats` junto com `useDashboardStats`
2. Usar os valores de `useOperationalStats` para as métricas financeiras:
   - **A Receber** → `stats.pendingAmount` (inclui multas e juros dinâmicos)
   - **Pendente** → `stats.totalOnStreet + stats.pendingInterest` (capital + juros pendentes)

**Arquivo: `src/hooks/useDashboardStats.ts`**

3. Ajustar o cálculo de `totalToReceive` para incluir multas (se disponível)
4. Sincronizar a fórmula de `totalPending` com o relatório

### Alterações Detalhadas

#### 1. Dashboard.tsx - Usar dados do useOperationalStats para métricas financeiras

```typescript
// Importar
import { useOperationalStats } from '@/hooks/useOperationalStats';

// No componente
const { stats: operationalStats } = useOperationalStats();

// Nos cards financeiros, usar:
// A Receber = operationalStats.pendingAmount (inclui remaining_balance + multas + juros atraso)
// Pendente = operationalStats.totalOnStreet + operationalStats.pendingInterest (capital + juros)
```

#### 2. Atualizar labels para clareza

| Métrica | Valor Atual | Valor Correto |
|---------|-------------|---------------|
| A Receber | `totalToReceive` de RPC | `pendingAmount` de useOperationalStats |
| Pendente | `totalPending` de RPC | `totalOnStreet + pendingInterest` |
| Recebido | `totalReceived` de RPC | Manter igual |

### Detalhes Técnicos

**Antes (Dashboard):**
```typescript
const financialCards = [
  {
    title: 'A Receber',
    value: formatCurrency(stats.totalToReceive),  // ❌ RPC incompleta
  },
  {
    title: 'Pendente',
    value: formatCurrency(stats.totalPending),    // ❌ RPC incompleta
  },
];
```

**Depois (Dashboard):**
```typescript
// Importar useOperationalStats
const { stats: opStats } = useOperationalStats();

const financialCards = [
  {
    title: 'Total a Receber',
    value: formatCurrency(opStats.pendingAmount),  // ✅ Inclui multas + juros atraso
  },
  {
    title: 'Capital na Rua',
    value: formatCurrency(opStats.totalOnStreet),  // ✅ Apenas principal pendente
  },
  {
    title: 'Juros a Receber',
    value: formatCurrency(opStats.pendingInterest),  // ✅ Juros ainda não recebidos
  },
];
```

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| src/pages/Dashboard.tsx | Importar useOperationalStats e usar para métricas financeiras |

## Fluxo Após Alterações

```text
Dashboard.tsx
     │
     ├── useDashboardStats()  → Contagens (empréstimos, clientes, semana)
     │
     └── useOperationalStats() → Métricas financeiras (a receber, pendente, capital)
                                   └── Mesma fonte que ReportsLoans.tsx ✓
```

## Resultado Esperado

| Métrica | Dashboard | Relatório | Status |
|---------|-----------|-----------|--------|
| A Receber | pendingAmount | pendingAmount | ✅ Igual |
| Capital na Rua | totalOnStreet | totalOnStreet | ✅ Igual |
| Juros Pendentes | pendingInterest | pendingInterest | ✅ Igual |
| Total Recebido | totalReceived | totalReceived | ✅ Igual |

## Observações

- O `useDashboardStats` continuará sendo usado para contagens (empréstimos, clientes, resumo semanal)
- Apenas as métricas financeiras serão migradas para `useOperationalStats`
- Isso pode gerar uma requisição extra, mas garante consistência entre as páginas
