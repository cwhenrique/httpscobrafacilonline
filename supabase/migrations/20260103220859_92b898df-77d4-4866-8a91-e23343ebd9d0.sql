-- 1. Adicionar coluna created_by na tabela loans
ALTER TABLE public.loans ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- 2. Preencher dados existentes (empréstimos antigos foram criados pelo dono)
UPDATE public.loans SET created_by = user_id WHERE created_by IS NULL;

-- 3. Tornar obrigatório para novos registros
ALTER TABLE public.loans ALTER COLUMN created_by SET NOT NULL;

-- 4. Adicionar nova permissão ao enum
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'view_all_loans';

-- 5. Criar função para verificar acesso aos empréstimos
CREATE OR REPLACE FUNCTION public.can_view_loan(_user_id uuid, _loan_user_id uuid, _loan_created_by uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Caso 1: É o dono do empréstimo
    _user_id = _loan_user_id
    OR
    -- Caso 2: É funcionário do dono E criou este empréstimo
    (get_employee_owner_id(_user_id) = _loan_user_id AND _loan_created_by = _user_id)
    OR
    -- Caso 3: É funcionário do dono E tem permissão view_all_loans
    (get_employee_owner_id(_user_id) = _loan_user_id AND has_employee_permission(_user_id, 'view_all_loans'))
$$;

-- 6. Remover política antiga de SELECT para funcionários
DROP POLICY IF EXISTS "Employees can view owner loans" ON public.loans;

-- 7. Criar nova política com isolamento de dados
CREATE POLICY "Employees can view allowed loans"
ON public.loans FOR SELECT
USING (
  auth.uid() = user_id
  OR can_view_loan(auth.uid(), user_id, created_by)
);