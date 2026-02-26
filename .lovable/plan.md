

## Problema: Empréstimos não aparecem para funcionário com `view_all_loans`

### Causa raiz

O funcionário tem permissão `view_all_loans` mas **não tem** `view_all_clients`. Quando o sistema busca os empréstimos, cada empréstimo faz um JOIN com a tabela `clients`. A política de segurança da tabela `clients` bloqueia o acesso do funcionário aos clientes que ele não criou/não foram atribuídos a ele.

O resultado: `loan.client` volta como `null`. Na linha 2918 de `Loans.tsx`:
```typescript
const matchesSearch = loan.client?.full_name.toLowerCase().includes(search.toLowerCase());
```
Quando `client` é `null`, `matchesSearch` é `undefined` (falsy), e **todos os empréstimos são filtrados**.

### Solução (2 partes)

#### 1. Corrigir o filtro em `src/pages/Loans.tsx` (linha 2918)
Tratar `client` nulo para não filtrar empréstimos válidos:
```typescript
const clientName = loan.client?.full_name || '';
const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase());
```

#### 2. Vincular automaticamente `view_all_clients` quando `view_all_loans` é dado
Se o funcionário pode ver todos os empréstimos, ele precisa ver os clientes associados. No `EmployeeManagement.tsx`, quando `view_all_loans` é marcado, marcar automaticamente `view_all_clients` também. E no RLS/função `can_view_client_optimized`, adicionar uma verificação: se o funcionário tem `view_all_loans`, ele pode ver os clientes que têm empréstimos do dono.

**Alternativa mais simples para parte 2**: Ajustar a função `can_view_client_optimized` no banco para também verificar `view_all_loans` — se o funcionário tem `view_all_loans`, ele pode ver qualquer cliente do dono.

### Alterações concretas

1. **`src/pages/Loans.tsx`** — Corrigir filtro nulo na linha 2918
2. **Migration SQL** — Atualizar `can_view_client_optimized` para adicionar check: se tem `view_all_loans`, pode ver clientes do dono
3. **`src/components/EmployeeManagement.tsx`** — Auto-selecionar `view_all_clients` quando `view_all_loans` é selecionado (UX helper)

