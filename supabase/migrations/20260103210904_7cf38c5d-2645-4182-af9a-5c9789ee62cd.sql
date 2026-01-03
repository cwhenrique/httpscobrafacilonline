-- Function to get complete employee context in one secure call
CREATE OR REPLACE FUNCTION public.get_employee_context(_user_id uuid)
RETURNS TABLE (
  is_employee boolean,
  employee_id uuid,
  owner_id uuid,
  employee_name text,
  is_active boolean,
  permissions text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_record RECORD;
BEGIN
  -- Try to find employee record for this user
  SELECT e.id, e.owner_id, e.name, e.is_active
  INTO emp_record
  FROM public.employees e
  WHERE e.employee_user_id = _user_id
  LIMIT 1;
  
  -- If not found, user is NOT an employee (owner or regular user)
  IF emp_record IS NULL THEN
    RETURN QUERY SELECT 
      false::boolean,
      NULL::uuid,
      NULL::uuid,
      NULL::text,
      NULL::boolean,
      ARRAY[]::text[];
    RETURN;
  END IF;
  
  -- User IS an employee - return their data with permissions
  RETURN QUERY SELECT 
    true::boolean,
    emp_record.id,
    emp_record.owner_id,
    emp_record.name,
    emp_record.is_active,
    COALESCE(
      (SELECT array_agg(ep.permission::text)
       FROM public.employee_permissions ep
       WHERE ep.employee_id = emp_record.id),
      ARRAY[]::text[]
    );
END;
$$;