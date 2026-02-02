
# Plano: Sincronização do Dashboard com Dados de Empréstimos em Tempo Real

## Problema Identificado

Quando um empréstimo é alterado (datas, valores, etc.), a área de "Próximos Vencimentos" e "Empréstimos Recentes" no Dashboard pode exibir informações desatualizadas por dois motivos:

1. **Cache não invalidado**: A função `invalidateLoans()` não invalida a queryKey `['dashboard-stats']`
2. **Polling ausente**: Os hooks `useDashboardStats` e `useOperationalStats` não atualizam automaticamente em background
3. **Cache longo**: Ambos os hooks têm `staleTime: 2 minutos`, muito alto para dados operacionais

## Solução Proposta

### 1. Invalidar Dashboard Stats ao Modificar Empréstimos

**Arquivo:** `src/hooks/useLoans.ts`

Adicionar invalidação da queryKey `['dashboard-stats']` na função `invalidateLoans()`:

```typescript
const invalidateLoans = () => {
  queryClient.invalidateQueries({ queryKey: ['loans'] });
  queryClient.invalidateQueries({ queryKey: ['operational-stats'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); // NOVO
};
```

### 2. Adicionar Polling e Refresh Automático

**Arquivo:** `src/hooks/useDashboardStats.ts`

Reduzir cache e adicionar polling:

```typescript
const { data: stats = defaultStats, isLoading: loading, refetch } = useQuery({
  queryKey: ['dashboard-stats', userId],
  queryFn: () => fetchDashboardStats(userId!),
  enabled: !!userId && !employeeLoading,
  staleTime: 1000 * 30, // 30 segundos (era 2 minutos)
  gcTime: 1000 * 60 * 5,
  refetchInterval: 1000 * 60, // Polling a cada 60 segundos
  refetchOnWindowFocus: true, // Atualiza ao voltar para a aba
  refetchOnMount: 'always', // Sempre atualiza ao montar
});
```

**Arquivo:** `src/hooks/useOperationalStats.ts`

Aplicar mesmas configurações:

```typescript
const { data, isLoading, refetch } = useQuery({
  queryKey: ['operational-stats', effectiveUserId],
  queryFn: fetchOperationalStats,
  enabled: !!user && !employeeLoading && !!effectiveUserId,
  staleTime: 1000 * 30, // 30 segundos (era 2 minutos)
  gcTime: 1000 * 60 * 5,
  refetchInterval: 1000 * 60, // Polling a cada 60 segundos
  refetchOnWindowFocus: true,
  refetchOnMount: 'always',
});
```

### 3. Forçar Refresh ao Navegar para Dashboard

**Arquivo:** `src/pages/Dashboard.tsx`

Adicionar `useEffect` para forçar refetch ao montar o componente:

```typescript
import { useEffect } from 'react';

// Dentro do componente Dashboard:
const { stats: opStats, refetch: refetchOpStats } = useOperationalStats();
const { stats, loading: statsLoading, refetch: refetchDashboard } = useDashboardStats();

// Forçar refresh ao montar o Dashboard
useEffect(() => {
  refetchOpStats();
  refetchDashboard();
}, []); // Executa apenas ao montar
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useLoans.ts` | Adicionar invalidação de `['dashboard-stats']` |
| `src/hooks/useDashboardStats.ts` | Reduzir cache, adicionar polling e `refetchOnMount` |
| `src/hooks/useOperationalStats.ts` | Reduzir cache, adicionar polling e `refetchOnMount` |
| `src/pages/Dashboard.tsx` | Forçar refetch ao montar |

## Resultado Esperado

- Após qualquer alteração em empréstimo, Dashboard atualiza imediatamente via invalidação de cache
- Mesmo sem alterações, Dashboard atualiza automaticamente a cada 60 segundos
- Ao voltar para a aba do navegador, dados são recarregados
- Ao navegar para o Dashboard, dados são sempre buscados do servidor
