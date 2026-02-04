

# Plano: Mostrar Total de Clientes Cadastrados no Dashboard

## Problema Identificado

O card "Clientes" no Dashboard mostra **2** quando o usuário tem **7 clientes cadastrados**.

**Causa:** O campo `activeClients` vem da função RPC `get_dashboard_stats` que conta apenas **clientes com empréstimos ativos**:

```sql
COUNT(DISTINCT CASE WHEN l.status != 'paid' THEN l.client_id END) as active_clients
```

O usuário tem 7 clientes cadastrados, mas apenas 2 deles possuem empréstimos não pagos.

## Solução

Adicionar uma nova consulta para contar o **total de clientes cadastrados** e usar esse valor no Dashboard.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDashboardStats.ts` | Adicionar query para contar total de clientes |
| `src/pages/Dashboard.tsx` | Usar o novo campo `totalClients` no card |

## Alterações Detalhadas

### 1. `src/hooks/useDashboardStats.ts`

Adicionar nova propriedade `totalClients` na interface e buscar via `Promise.all`:

```typescript
// Na interface DashboardStats, adicionar:
totalClients: number;

// No fetchDashboardStats, adicionar query:
{ count: clientsCount },  // Nova query

// No Promise.all:
supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', userId),

// No return:
totalClients: clientsCount || 0,
```

### 2. `src/pages/Dashboard.tsx`

Alterar o card de Clientes para usar `totalClients`:

```typescript
// Antes:
{
  title: 'Clientes',
  value: stats.activeClients.toString(),
  subtitle: 'cadastrados',
  ...
}

// Depois:
{
  title: 'Clientes',
  value: stats.totalClients.toString(),
  subtitle: 'cadastrados',
  ...
}
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Clientes: 2 (com empréstimos ativos) | Clientes: 7 (total cadastrados) |

O card agora refletirá o total real de clientes na aba Clientes.

## Seção Técnica

### Código Completo - `useDashboardStats.ts`

```typescript
// Interface atualizada
export interface DashboardStats {
  // ... campos existentes ...
  totalClients: number;  // NOVO
}

// Default stats
const defaultStats: DashboardStats = {
  // ... campos existentes ...
  totalClients: 0,  // NOVO
};

// Na função fetchDashboardStats, adicionar ao Promise.all:
const [
  { data: loanStats, error: loanStatsError },
  { count: loanCount },
  // ... outros counts ...
  { count: clientsCount },  // NOVO - Total de clientes cadastrados
] = await Promise.all([
  supabase.rpc('get_dashboard_stats', { p_user_id: userId }),
  // ... queries existentes ...
  supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', userId),  // NOVO
]);

// No return:
return {
  // ... campos existentes ...
  activeClients: Number(rpcData?.active_clients || 0),  // Manter para compatibilidade
  totalClients: clientsCount || 0,  // NOVO
};
```

### Código Completo - `Dashboard.tsx`

```typescript
// No array financialCards, alterar:
{
  title: 'Clientes',
  value: stats.totalClients.toString(),  // Alterado de activeClients para totalClients
  subtitle: 'cadastrados',
  icon: Users,
  color: 'text-primary',
  bg: 'bg-primary/10',
},
```

