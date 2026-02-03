-- Create contract_expenses table for tracking vehicle rental expenses
CREATE TABLE public.contract_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'outros',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for performance
CREATE INDEX idx_contract_expenses_contract_id ON public.contract_expenses(contract_id);
CREATE INDEX idx_contract_expenses_user_id ON public.contract_expenses(user_id);

-- Enable RLS
ALTER TABLE public.contract_expenses ENABLE ROW LEVEL SECURITY;

-- Users can view own contract expenses
CREATE POLICY "Users can view own contract expenses"
ON public.contract_expenses FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert own contract expenses
CREATE POLICY "Users can insert own contract expenses"
ON public.contract_expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update own contract expenses
CREATE POLICY "Users can update own contract expenses"
ON public.contract_expenses FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete own contract expenses
CREATE POLICY "Users can delete own contract expenses"
ON public.contract_expenses FOR DELETE
USING (auth.uid() = user_id);

-- Employees can view owner contract expenses
CREATE POLICY "Employees can view owner contract expenses"
ON public.contract_expenses FOR SELECT
USING (user_id = get_employee_owner_id(auth.uid()));

-- Employees can insert contract expenses for owner
CREATE POLICY "Employees can insert contract expenses for owner"
ON public.contract_expenses FOR INSERT
WITH CHECK (user_id = get_employee_owner_id(auth.uid()));

-- Employees can update owner contract expenses
CREATE POLICY "Employees can update owner contract expenses"
ON public.contract_expenses FOR UPDATE
USING (user_id = get_employee_owner_id(auth.uid()));

-- Employees can delete owner contract expenses
CREATE POLICY "Employees can delete owner contract expenses"
ON public.contract_expenses FOR DELETE
USING (user_id = get_employee_owner_id(auth.uid()));