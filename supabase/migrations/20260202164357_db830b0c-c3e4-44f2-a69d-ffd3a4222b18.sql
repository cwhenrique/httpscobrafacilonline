-- Remover política antiga de SELECT para owners (está duplicando e ambas são RESTRICTIVE)
DROP POLICY IF EXISTS "Users can view own loans" ON public.loans;

-- Recriar a política de visualização ÚNICA que atende tanto owner quanto employees
DROP POLICY IF EXISTS "Employees can view allowed loans" ON public.loans;

CREATE POLICY "Users and employees can view loans"
ON public.loans
FOR SELECT
TO authenticated
USING (
  -- Owner pode ver seus próprios empréstimos
  auth.uid() = user_id
  OR
  -- Funcionário pode ver empréstimos que criou OU tem permissão view_all_loans
  can_view_loan_optimized(auth.uid(), user_id, created_by)
);