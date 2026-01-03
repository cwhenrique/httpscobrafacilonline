-- Criar função para verificar permissão de funcionário
CREATE OR REPLACE FUNCTION public.has_employee_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.employee_permissions ep ON ep.employee_id = e.id
    WHERE e.employee_user_id = _user_id
      AND e.is_active = true
      AND ep.permission::text = _permission
  )
$$;

-- Função para verificar se usuário é funcionário ativo
CREATE OR REPLACE FUNCTION public.is_active_employee(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE employee_user_id = _user_id
      AND is_active = true
  )
$$;