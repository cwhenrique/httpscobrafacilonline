
CREATE OR REPLACE FUNCTION public.can_view_client_optimized(_user_id uuid, _client_user_id uuid, _client_created_by uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM public.employees e
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

  -- ✅ Funcionário tem permissão view_all_loans? Pode ver clientes do dono
  IF EXISTS (
    SELECT 1
    FROM public.employee_permissions ep
    WHERE ep.employee_id = _employee_record.id
      AND ep.permission = 'view_all_loans'
  ) THEN
    RETURN true;
  END IF;

  -- Funcionário criou um empréstimo para este cliente?
  IF EXISTS (
    SELECT 1
    FROM public.loans l
    WHERE l.user_id = _client_user_id
      AND l.client_id = _client_id
      AND l.created_by = _user_id
    LIMIT 1
  ) THEN
    RETURN true;
  END IF;

  -- Funcionário tem permissão view_all_clients?
  IF EXISTS (
    SELECT 1
    FROM public.employee_permissions ep
    WHERE ep.employee_id = _employee_record.id
      AND ep.permission = 'view_all_clients'
  ) THEN
    RETURN true;
  END IF;

  -- Cliente foi atribuído ao funcionário?
  RETURN EXISTS (
    SELECT 1
    FROM public.client_assignments ca
    WHERE ca.client_id = _client_id
      AND ca.employee_id = _employee_record.id
  );
END;
$function$;
