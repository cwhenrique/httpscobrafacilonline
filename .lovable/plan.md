
# Plano: Controle de Visibilidade de Clientes por Funcionário

## Resumo do Pedido

Você quer implementar:
1. **Funcionário A cadastra cliente** → Só ele e o dono veem esse cliente
2. **Funcionário B não vê** clientes cadastrados pelo Funcionário A (e vice-versa)
3. **Dono (conta principal)** vê TODOS os clientes
4. **Dono pode atribuir** quais clientes cada funcionário pode acessar

## Arquitetura Proposta

### Nova Tabela: `client_assignments`

Tabela de relacionamento entre funcionários e clientes:

```text
┌─────────────────────────────────────────────────────┐
│                 client_assignments                  │
├─────────────────────────────────────────────────────┤
│ id            │ uuid (PK)                           │
│ client_id     │ uuid (FK → clients)                 │
│ employee_id   │ uuid (FK → employees)               │
│ assigned_by   │ uuid (FK → auth.users) - quem atribuiu
│ created_at    │ timestamp                           │
└─────────────────────────────────────────────────────┘
```

### Novo Campo: `created_by` na tabela `clients`

Similar ao que já existe em `loans`, para saber quem cadastrou o cliente:

```text
ALTER TABLE clients ADD COLUMN created_by uuid;
```

## Lógica de Visibilidade

```text
┌──────────────────────────────────────────────────────────────────┐
│                    QUEM PODE VER O CLIENTE?                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DONO (owner)                                                    │
│  └── Vê TODOS os clientes                                        │
│                                                                  │
│  FUNCIONÁRIO A                                                   │
│  └── Vê clientes que ELE cadastrou (created_by = employee_id)   │
│  └── Vê clientes ATRIBUÍDOS a ele pelo dono                     │
│  └── Se tiver permissão "view_all_clients" → vê todos           │
│                                                                  │
│  FUNCIONÁRIO B                                                   │
│  └── Vê clientes que ELE cadastrou (created_by = employee_id)   │
│  └── Vê clientes ATRIBUÍDOS a ele pelo dono                     │
│  └── NÃO VÊ clientes do Funcionário A                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Alterações Necessárias

### 1. Banco de Dados (Migrations)

**Adicionar coluna `created_by` em `clients`:**
```sql
ALTER TABLE clients ADD COLUMN created_by uuid;

-- Popular dados existentes (clientes antigos foram criados pelo dono)
UPDATE clients SET created_by = user_id WHERE created_by IS NULL;

-- Tornar NOT NULL depois de popular
ALTER TABLE clients ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE clients ALTER COLUMN created_by SET DEFAULT auth.uid();
```

**Criar tabela `client_assignments`:**
```sql
CREATE TABLE client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, employee_id)
);

ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;
```

**Nova função `can_view_client`:**
```sql
CREATE OR REPLACE FUNCTION can_view_client(_user_id uuid, _client_user_id uuid, _client_created_by uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Caso 1: É o dono
    _user_id = _client_user_id
    OR
    -- Caso 2: Funcionário que CRIOU este cliente
    (get_employee_owner_id(_user_id) = _client_user_id AND _client_created_by = _user_id)
    OR
    -- Caso 3: Cliente ATRIBUÍDO ao funcionário
    (get_employee_owner_id(_user_id) = _client_user_id AND EXISTS (
      SELECT 1 FROM client_assignments 
      WHERE client_id = _client_id 
      AND employee_id IN (SELECT id FROM employees WHERE employee_user_id = _user_id)
    ))
    OR
    -- Caso 4: Funcionário com permissão view_all_clients
    (get_employee_owner_id(_user_id) = _client_user_id AND has_employee_permission(_user_id, 'view_all_clients'))
$$;
```

**Atualizar RLS policies de `clients`:**
```sql
-- Substituir política de SELECT para funcionários
DROP POLICY IF EXISTS "Employees can view owner clients" ON clients;

CREATE POLICY "Employees can view allowed clients" ON clients
  FOR SELECT USING (
    auth.uid() = user_id 
    OR can_view_client(auth.uid(), user_id, created_by, id)
  );
```

### 2. Nova Permissão

Adicionar ao enum `employee_permission`:

| Permissão | Descrição |
|-----------|-----------|
| `view_all_clients` | Funcionário vê TODOS os clientes do dono |

### 3. Código Frontend

**`src/hooks/useClients.ts`**
- Passar `created_by: user.id` ao criar cliente
- Incluir `created_by` nos dados retornados

**`src/components/EmployeeManagement.tsx`**
- Adicionar checkbox para permissão `view_all_clients`
- Interface para atribuir clientes a funcionários

**Nova seção na UI de funcionários:**
```text
┌─────────────────────────────────────────────────────┐
│  📋 Clientes Atribuídos ao Funcionário              │
├─────────────────────────────────────────────────────┤
│  [✓] Cliente João Silva                             │
│  [ ] Cliente Maria Santos                           │
│  [ ] Cliente Pedro Oliveira                         │
│  [✓] Cliente Ana Costa                              │
├─────────────────────────────────────────────────────┤
│  [Salvar Atribuições]                               │
└─────────────────────────────────────────────────────┘
```

### 4. Interface do Dono para Atribuir Clientes

No modal de edição do funcionário, adicionar aba/seção para gerenciar clientes:

**Arquivo**: `src/components/EmployeeManagement.tsx`

- Nova aba "Clientes" no dialog de edição
- Lista todos os clientes do dono com checkboxes
- Salvar atribuições na tabela `client_assignments`

## Fluxo de Uso

### Cenário 1: Funcionário cadastra cliente novo
1. Funcionário A cria cliente "João Silva"
2. Sistema salva com `created_by = funcionario_a_id`
3. Funcionário A vê o cliente
4. Funcionário B NÃO vê o cliente
5. Dono vê o cliente

### Cenário 2: Dono atribui cliente ao funcionário
1. Dono acessa gerenciamento de funcionários
2. Edita "Funcionário B"
3. Vai na aba "Clientes"
4. Marca checkbox do cliente "João Silva"
5. Salva
6. Agora Funcionário B também vê "João Silva"

### Cenário 3: Funcionário com view_all_clients
1. Dono habilita permissão "Ver todos os clientes" para Funcionário C
2. Funcionário C agora vê TODOS os clientes (como se fosse o dono)

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| **Migration SQL** | Criar tabela `client_assignments`, adicionar `created_by` em `clients`, nova função `can_view_client`, atualizar RLS |
| `src/hooks/useClients.ts` | Passar `created_by` ao criar cliente |
| `src/hooks/useEmployeeContext.tsx` | Adicionar `view_all_clients` ao tipo de permissão |
| `src/components/EmployeeManagement.tsx` | Adicionar UI para atribuir clientes e nova permissão |
| `src/components/PermissionRoute.tsx` | Adicionar label para nova permissão |

## Estimativa

- **Complexidade**: Média-Alta
- **Migrations SQL**: ~50 linhas
- **Código Frontend**: ~150 linhas
- **Risco**: Médio (alteração de RLS afeta acesso a dados)
- **Testes recomendados**:
  - Criar cliente como funcionário → verificar que outro funcionário não vê
  - Atribuir cliente pelo dono → verificar que funcionário passou a ver
  - Habilitar `view_all_clients` → verificar acesso total
