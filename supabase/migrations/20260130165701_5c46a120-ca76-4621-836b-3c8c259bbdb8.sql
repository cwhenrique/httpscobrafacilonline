-- ===========================================
-- OTIMIZAÇÃO DE PERFORMANCE: Políticas RLS de Clientes
-- ===========================================

-- 1. Criar índices para acelerar as consultas
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_user_id ON employees(employee_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_owner_id ON employees(owner_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_employee_id ON client_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_client_id ON client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_employee_id ON employee_permissions(employee_id);

-- 2. Criar função otimizada que faz menos subconsultas
CREATE OR REPLACE FUNCTION can_view_client_optimized(_user_id uuid, _client_user_id uuid, _client_created_by uuid, _client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_record RECORD;
BEGIN
  -- Short-circuit: Se é o dono, retorna imediatamente
  IF _user_id = _client_user_id THEN
    RETURN true;
  END IF;
  
  -- Busca dados do funcionário UMA ÚNICA VEZ
  SELECT e.id, e.owner_id 
  INTO _employee_record
  FROM employees e
  WHERE e.employee_user_id = _user_id
    AND e.is_active = true
  LIMIT 1;
  
  -- Se não é funcionário ativo, não tem acesso
  IF _employee_record.id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verifica se o owner_id do funcionário é o dono do cliente
  IF _employee_record.owner_id != _client_user_id THEN
    RETURN false;
  END IF;
  
  -- Funcionário CRIOU este cliente? (mais comum, check primeiro)
  IF _client_created_by = _user_id THEN
    RETURN true;
  END IF;
  
  -- Funcionário tem permissão view_all_clients?
  IF EXISTS (
    SELECT 1 FROM employee_permissions 
    WHERE employee_id = _employee_record.id 
    AND permission = 'view_all_clients'
  ) THEN
    RETURN true;
  END IF;
  
  -- Cliente foi atribuído ao funcionário?
  RETURN EXISTS (
    SELECT 1 FROM client_assignments 
    WHERE client_id = _client_id 
    AND employee_id = _employee_record.id
  );
END;
$$;

-- 3. Remover políticas SELECT antigas
DROP POLICY IF EXISTS "Employees can view allowed clients" ON clients;
DROP POLICY IF EXISTS "Users can view own clients" ON clients;

-- 4. Criar política única otimizada para SELECT
-- O short-circuit auth.uid() = user_id é avaliado PRIMEIRO pelo PostgreSQL
-- Se for TRUE, a função NÃO é chamada (otimização do OR)
CREATE POLICY "Users and employees can view clients" ON clients
  FOR SELECT USING (
    auth.uid() = user_id
    OR
    can_view_client_optimized(auth.uid(), user_id, created_by, id)
  );