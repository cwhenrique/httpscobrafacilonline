-- Add created_by column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by uuid;

-- Populate existing clients with user_id as created_by (owner created them)
UPDATE public.clients SET created_by = user_id WHERE created_by IS NULL;

-- Make created_by NOT NULL and set default
ALTER TABLE public.clients ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE public.clients ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Add view_all_clients to the employee_permission enum
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'view_all_clients';

-- Create client_assignments table
CREATE TABLE IF NOT EXISTS public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, employee_id)
);

-- Enable RLS on client_assignments
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_assignments
CREATE POLICY "Owners can manage client assignments" ON public.client_assignments
  FOR ALL USING (
    assigned_by = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.employees WHERE id = client_assignments.employee_id AND owner_id = auth.uid())
  );

CREATE POLICY "Employees can view their assignments" ON public.client_assignments
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE employee_user_id = auth.uid())
  );

-- Create can_view_client function
CREATE OR REPLACE FUNCTION public.can_view_client(_user_id uuid, _client_user_id uuid, _client_created_by uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Case 1: Is the owner
    _user_id = _client_user_id
    OR
    -- Case 2: Employee who CREATED this client
    (get_employee_owner_id(_user_id) = _client_user_id AND _client_created_by = _user_id)
    OR
    -- Case 3: Client ASSIGNED to the employee
    (get_employee_owner_id(_user_id) = _client_user_id AND EXISTS (
      SELECT 1 FROM public.client_assignments 
      WHERE client_id = _client_id 
      AND employee_id IN (SELECT id FROM public.employees WHERE employee_user_id = _user_id)
    ))
    OR
    -- Case 4: Employee with view_all_clients permission
    (get_employee_owner_id(_user_id) = _client_user_id AND has_employee_permission(_user_id, 'view_all_clients'))
$$;

-- Drop old employee SELECT policy for clients
DROP POLICY IF EXISTS "Employees can view owner clients" ON public.clients;

-- Create new policy using can_view_client function
CREATE POLICY "Employees can view allowed clients" ON public.clients
  FOR SELECT USING (
    auth.uid() = user_id 
    OR can_view_client(auth.uid(), user_id, created_by, id)
  );