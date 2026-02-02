
-- Criar função otimizada para verificar se usuário pode ver empréstimo
-- Usa short-circuit: verifica primeiro se é dono (mais rápido)
CREATE OR REPLACE FUNCTION public.can_view_loan_optimized(
  _user_id uuid,
  _loan_user_id uuid,
  _loan_created_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  _owner_id uuid;
  _has_view_all boolean;
BEGIN
  -- Caso 1 (mais comum): É o próprio dono do empréstimo - retorna imediatamente
  IF _user_id = _loan_user_id THEN
    RETURN true;
  END IF;
  
  -- Buscar owner_id uma única vez
  SELECT owner_id INTO _owner_id
  FROM public.employees
  WHERE employee_user_id = _user_id
    AND is_active = true
  LIMIT 1;
  
  -- Se não é funcionário, não pode ver
  IF _owner_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar se é funcionário do dono deste empréstimo
  IF _owner_id != _loan_user_id THEN
    RETURN false;
  END IF;
  
  -- Caso 2: Funcionário criou este empréstimo
  IF _loan_created_by = _user_id THEN
    RETURN true;
  END IF;
  
  -- Caso 3: Funcionário tem permissão view_all_loans
  SELECT EXISTS (
    SELECT 1 FROM public.employee_permissions ep
    JOIN public.employees e ON e.id = ep.employee_id
    WHERE e.employee_user_id = _user_id
      AND e.is_active = true
      AND ep.permission = 'view_all_loans'
  ) INTO _has_view_all;
  
  RETURN COALESCE(_has_view_all, false);
END;
$$;

-- Atualizar a política RLS para usar a função otimizada
DROP POLICY IF EXISTS "Employees can view allowed loans" ON public.loans;

CREATE POLICY "Employees can view allowed loans"
ON public.loans
FOR SELECT
USING (
  -- Short-circuit: se é o dono, acesso imediato (não chama função)
  auth.uid() = user_id
  OR
  -- Senão, verificar via função otimizada
  can_view_loan_optimized(auth.uid(), user_id, created_by)
);
