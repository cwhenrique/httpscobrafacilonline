
# Plano: Corrigir Relatório de Empréstimos para Excluir Terceiros

## Problema Identificado

O hook `useOperationalStats.ts` busca **todos os empréstimos** sem filtrar por `is_third_party`, o que faz com que o relatório de empréstimos pessoais (`ReportsLoans.tsx`) inclua dados de empréstimos de terceiros incorretamente.

### Comparação dos Hooks

| Hook | Filtro | Comportamento |
|------|--------|---------------|
| `useThirdPartyStats.ts` | `.eq('is_third_party', true)` | Correto - só terceiros |
| `useOperationalStats.ts` | **Nenhum filtro** | Incorreto - inclui tudo |

## Solução

Adicionar filtro `.eq('is_third_party', false)` na query do `useOperationalStats.ts` para garantir que apenas empréstimos pessoais sejam incluídos.

## Arquivos a Modificar

### 1. src/hooks/useOperationalStats.ts

**Localização**: Linha 85-96 (função `fetchOperationalStats`)

**Antes:**
```typescript
const { data: loans } = await supabase
  .from('loans')
  .select(`
    id, user_id, client_id, principal_amount, ...
  `)
  .order('created_at', { ascending: false })
  .limit(1000);
```

**Depois:**
```typescript
const { data: loans } = await supabase
  .from('loans')
  .select(`
    id, user_id, client_id, principal_amount, ...
  `)
  .eq('is_third_party', false)  // NOVO: Excluir empréstimos de terceiros
  .order('created_at', { ascending: false })
  .limit(1000);
```

## Resultado Esperado

Após a correção:
- O relatório de empréstimos (`/reports`) mostrará apenas empréstimos pessoais
- O relatório de terceiros (`/reports-third-party`) continuará mostrando apenas empréstimos de terceiros
- Os dados financeiros (Total a Receber, Recebido, Em Atraso) estarão corretos
- O dashboard principal também será corrigido, pois usa o mesmo hook
