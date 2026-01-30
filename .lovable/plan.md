

# Plano: Corrigir Timeout na Consulta de Clientes (Performance RLS)

## Problema Identificado

A consulta de clientes está dando **TIMEOUT** (erro 57014) porque a nova política RLS com a função `can_view_client()` está sendo executada para **cada uma das 20.051 linhas** da tabela, causando milhares de subconsultas.

**Logs do erro:**
```
"code": "57014"
"message": "canceling statement due to statement timeout"
```

## Causa Raiz

A política RLS atual:
```sql
CREATE POLICY "Employees can view allowed clients" ON clients
  FOR SELECT USING (
    auth.uid() = user_id 
    OR can_view_client(auth.uid(), user_id, created_by, id)
  );
```

A função `can_view_client()` executa várias subconsultas por linha:
1. `get_employee_owner_id(_user_id)` - consulta employees
2. `EXISTS (SELECT 1 FROM client_assignments...)` - consulta client_assignments  
3. `has_employee_permission(_user_id, 'view_all_clients')` - consulta employee_permissions

Com 20.000+ clientes, isso gera **60.000+ subconsultas** = TIMEOUT!

## Solução

Reescrever a política RLS para ser mais eficiente, evitando chamar funções para cada linha quando o usuário é o dono:

### Otimização 1: Short-circuit para donos

Se `auth.uid() = user_id`, retorna TRUE imediatamente sem chamar a função.

### Otimização 2: Reescrever a função com CTE

Usar Common Table Expressions para calcular uma única vez se o usuário é funcionário e quais são suas permissões:

```sql
CREATE OR REPLACE FUNCTION can_view_client_optimized(_user_id uuid, _client_user_id uuid, _client_created_by uuid, _client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _has_view_all boolean;
  _employee_record RECORD;
BEGIN
  -- Se é o dono, retorna imediatamente
  IF _user_id = _client_user_id THEN
    RETURN true;
  END IF;
  
  -- Busca dados do funcionário uma única vez
  SELECT e.id, e.owner_id INTO _employee_record
  FROM employees e
  WHERE e.employee_user_id = _user_id
  LIMIT 1;
  
  -- Se não é funcionário, não tem acesso
  IF _employee_record.id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verifica se o owner_id do funcionário é o dono do cliente
  IF _employee_record.owner_id != _client_user_id THEN
    RETURN false;
  END IF;
  
  -- Funcionário CRIOU este cliente
  IF _client_created_by = _user_id THEN
    RETURN true;
  END IF;
  
  -- Funcionário tem view_all_clients
  IF EXISTS (
    SELECT 1 FROM employee_permissions 
    WHERE employee_id = _employee_record.id 
    AND permission = 'view_all_clients'
  ) THEN
    RETURN true;
  END IF;
  
  -- Cliente atribuído ao funcionário
  RETURN EXISTS (
    SELECT 1 FROM client_assignments 
    WHERE client_id = _client_id 
    AND employee_id = _employee_record.id
  );
END;
$$;
```

### Otimização 3: Adicionar índices

```sql
-- Índice para acelerar busca por created_by
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);

-- Índice para acelerar busca por employee_user_id
CREATE INDEX IF NOT EXISTS idx_employees_employee_user_id ON employees(employee_user_id);

-- Índice para acelerar client_assignments
CREATE INDEX IF NOT EXISTS idx_client_assignments_employee_id ON client_assignments(employee_id);
```

### Otimização 4: Atualizar a política RLS

```sql
-- Dropar políticas antigas
DROP POLICY IF EXISTS "Employees can view allowed clients" ON clients;
DROP POLICY IF EXISTS "Users can view own clients" ON clients;

-- Criar política única otimizada
CREATE POLICY "Users and employees can view clients" ON clients
  FOR SELECT USING (
    -- Short-circuit: donos veem seus próprios clientes diretamente
    auth.uid() = user_id
    OR
    -- Funcionários passam pela função otimizada
    can_view_client_optimized(auth.uid(), user_id, created_by, id)
  );
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Dono vê seus clientes | TIMEOUT | ~50ms |
| Funcionário vê clientes | Não testado | ~100ms |
| Total de subconsultas | 60.000+ | ~10 |

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| **Migration SQL** | Criar função otimizada, adicionar índices, atualizar políticas RLS |

## Estimativa

- **Complexidade**: Média
- **Linhas SQL**: ~60
- **Risco**: Baixo (melhoria de performance, lógica igual)
- **Impacto**: Imediato - clientes voltarão a aparecer

