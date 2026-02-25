

# Adicionar Permissão "Calendário de Cobranças" para Funcionários

## Situação Atual

O calendário de cobranças (`/calendar`) usa a permissão `view_loans` para controle de acesso. Isso significa que qualquer funcionário com permissão de ver empréstimos automaticamente tem acesso ao calendário. Não existe uma permissão separada para bloquear/liberar o calendário independentemente.

## Solução

Criar uma nova permissão `view_calendar` no enum `employee_permission` e usá-la para controlar o acesso ao calendário de cobranças de forma independente.

### 1. Migração SQL

Adicionar o valor `view_calendar` ao enum:

```sql
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'view_calendar';
```

### 2. Atualizar `src/hooks/useEmployeeContext.tsx`

Adicionar `'view_calendar'` ao tipo `EmployeePermission`.

### 3. Atualizar `src/components/EmployeeManagement.tsx`

Adicionar na seção "Outros" do `PERMISSION_GROUPS`:

```typescript
{ key: 'view_calendar' as EmployeePermission, label: 'Ver calendário de cobranças' },
```

### 4. Atualizar rota e menu lateral

- **`src/App.tsx`** (linha 104): Trocar `permission="view_loans"` por `permission="view_calendar"` na rota `/calendar`.
- **`src/components/layout/DashboardLayout.tsx`** (linha 68): Trocar `permission: 'view_loans'` por `permission: 'view_calendar'` no item do menu "Calendário de Cobranças".

### 5. Atualizar `src/components/PermissionRoute.tsx`

Adicionar o label para a nova permissão:

```typescript
view_calendar: 'Visualizar Calendário de Cobranças',
```

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| Migração SQL | `ALTER TYPE employee_permission ADD VALUE 'view_calendar'` |
| `src/hooks/useEmployeeContext.tsx` | Adicionar `'view_calendar'` ao tipo |
| `src/components/EmployeeManagement.tsx` | Adicionar checkbox na UI de permissões |
| `src/components/PermissionRoute.tsx` | Adicionar label da permissão |
| `src/App.tsx` | Rota `/calendar` usa `view_calendar` |
| `src/components/layout/DashboardLayout.tsx` | Menu usa `view_calendar` |

