-- Add manage_checks permission to the enum
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'manage_checks';

-- Create check_discounts table
CREATE TABLE public.check_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  bank_name TEXT NOT NULL,
  check_number TEXT NOT NULL,
  issuer_document TEXT,
  issuer_name TEXT,
  nominal_value NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  discount_date DATE NOT NULL DEFAULT CURRENT_DATE,
  discount_type TEXT NOT NULL DEFAULT 'proportional' CHECK (discount_type IN ('percentage', 'proportional')),
  discount_rate NUMERIC NOT NULL DEFAULT 5,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  net_value NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'pix', 'transfer')),
  status TEXT NOT NULL DEFAULT 'in_wallet' CHECK (status IN ('in_wallet', 'compensated', 'returned', 'in_collection')),
  return_date DATE,
  return_reason TEXT,
  penalty_amount NUMERIC DEFAULT 0,
  penalty_rate NUMERIC DEFAULT 0,
  total_debt NUMERIC DEFAULT 0,
  total_paid_debt NUMERIC DEFAULT 0,
  installments_count INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create check_discount_payments table (for returned check payments)
CREATE TABLE public.check_discount_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_discount_id UUID NOT NULL REFERENCES public.check_discounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  installment_number INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.check_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_discount_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for check_discounts (owner access)
CREATE POLICY "Users can view own check discounts"
ON public.check_discounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own check discounts"
ON public.check_discounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own check discounts"
ON public.check_discounts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own check discounts"
ON public.check_discounts FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for check_discounts (employee access)
CREATE POLICY "Employees can view owner check discounts"
ON public.check_discounts FOR SELECT
USING (user_id = get_employee_owner_id(auth.uid()) AND has_employee_permission(auth.uid(), 'manage_checks'));

CREATE POLICY "Employees can insert check discounts for owner"
ON public.check_discounts FOR INSERT
WITH CHECK (user_id = get_employee_owner_id(auth.uid()) AND has_employee_permission(auth.uid(), 'manage_checks'));

CREATE POLICY "Employees can update owner check discounts"
ON public.check_discounts FOR UPDATE
USING (user_id = get_employee_owner_id(auth.uid()) AND has_employee_permission(auth.uid(), 'manage_checks'));

CREATE POLICY "Employees can delete owner check discounts"
ON public.check_discounts FOR DELETE
USING (user_id = get_employee_owner_id(auth.uid()) AND has_employee_permission(auth.uid(), 'manage_checks'));

-- RLS Policies for check_discount_payments (owner access)
CREATE POLICY "Users can view own check discount payments"
ON public.check_discount_payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own check discount payments"
ON public.check_discount_payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own check discount payments"
ON public.check_discount_payments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own check discount payments"
ON public.check_discount_payments FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for check_discount_payments (employee access)
CREATE POLICY "Employees can view owner check discount payments"
ON public.check_discount_payments FOR SELECT
USING (user_id = get_employee_owner_id(auth.uid()) AND has_employee_permission(auth.uid(), 'manage_checks'));

CREATE POLICY "Employees can insert check discount payments for owner"
ON public.check_discount_payments FOR INSERT
WITH CHECK (user_id = get_employee_owner_id(auth.uid()) AND has_employee_permission(auth.uid(), 'manage_checks'));

CREATE POLICY "Employees can update owner check discount payments"
ON public.check_discount_payments FOR UPDATE
USING (user_id = get_employee_owner_id(auth.uid()) AND has_employee_permission(auth.uid(), 'manage_checks'));

CREATE POLICY "Employees can delete owner check discount payments"
ON public.check_discount_payments FOR DELETE
USING (user_id = get_employee_owner_id(auth.uid()) AND has_employee_permission(auth.uid(), 'manage_checks'));

-- Create indexes for performance
CREATE INDEX idx_check_discounts_user_id ON public.check_discounts(user_id);
CREATE INDEX idx_check_discounts_client_id ON public.check_discounts(client_id);
CREATE INDEX idx_check_discounts_status ON public.check_discounts(status);
CREATE INDEX idx_check_discounts_due_date ON public.check_discounts(due_date);
CREATE INDEX idx_check_discount_payments_check_id ON public.check_discount_payments(check_discount_id);

-- Create trigger for updated_at
CREATE TRIGGER update_check_discounts_updated_at
BEFORE UPDATE ON public.check_discounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();