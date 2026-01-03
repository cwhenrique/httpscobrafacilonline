-- Atualizar políticas RLS para clients com verificação de permissão
-- Primeiro dropar as políticas existentes de funcionários
DROP POLICY IF EXISTS "Employees can view owner clients" ON public.clients;
DROP POLICY IF EXISTS "Employees can insert clients for owner" ON public.clients;
DROP POLICY IF EXISTS "Employees can update owner clients" ON public.clients;
DROP POLICY IF EXISTS "Employees can delete owner clients" ON public.clients;

-- Recriar com verificação de permissão
CREATE POLICY "Employees can view owner clients" 
ON public.clients 
FOR SELECT 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'view_clients')
);

CREATE POLICY "Employees can insert clients for owner" 
ON public.clients 
FOR INSERT 
WITH CHECK (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'create_clients')
);

CREATE POLICY "Employees can update owner clients" 
ON public.clients 
FOR UPDATE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'edit_clients')
);

CREATE POLICY "Employees can delete owner clients" 
ON public.clients 
FOR DELETE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'delete_clients')
);

-- Atualizar políticas RLS para loans com verificação de permissão
DROP POLICY IF EXISTS "Employees can view owner loans" ON public.loans;
DROP POLICY IF EXISTS "Employees can insert loans for owner" ON public.loans;
DROP POLICY IF EXISTS "Employees can update owner loans" ON public.loans;
DROP POLICY IF EXISTS "Employees can delete owner loans" ON public.loans;

CREATE POLICY "Employees can view owner loans" 
ON public.loans 
FOR SELECT 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'view_loans')
);

CREATE POLICY "Employees can insert loans for owner" 
ON public.loans 
FOR INSERT 
WITH CHECK (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'create_loans')
);

CREATE POLICY "Employees can update owner loans" 
ON public.loans 
FOR UPDATE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND (has_employee_permission(auth.uid(), 'register_payments') OR has_employee_permission(auth.uid(), 'adjust_dates'))
);

CREATE POLICY "Employees can delete owner loans" 
ON public.loans 
FOR DELETE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'delete_loans')
);

-- Atualizar políticas RLS para loan_payments
DROP POLICY IF EXISTS "Employees can view owner loan payments" ON public.loan_payments;
DROP POLICY IF EXISTS "Employees can insert loan payments for owner" ON public.loan_payments;
DROP POLICY IF EXISTS "Employees can update owner loan payments" ON public.loan_payments;
DROP POLICY IF EXISTS "Employees can delete owner loan payments" ON public.loan_payments;

CREATE POLICY "Employees can view owner loan payments" 
ON public.loan_payments 
FOR SELECT 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'view_loans')
);

CREATE POLICY "Employees can insert loan payments for owner" 
ON public.loan_payments 
FOR INSERT 
WITH CHECK (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'register_payments')
);

CREATE POLICY "Employees can update owner loan payments" 
ON public.loan_payments 
FOR UPDATE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'register_payments')
);

CREATE POLICY "Employees can delete owner loan payments" 
ON public.loan_payments 
FOR DELETE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'delete_loans')
);

-- Atualizar políticas RLS para bills
DROP POLICY IF EXISTS "Employees can view owner bills" ON public.bills;
DROP POLICY IF EXISTS "Employees can insert bills for owner" ON public.bills;
DROP POLICY IF EXISTS "Employees can update owner bills" ON public.bills;
DROP POLICY IF EXISTS "Employees can delete owner bills" ON public.bills;

CREATE POLICY "Employees can view owner bills" 
ON public.bills 
FOR SELECT 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_bills')
);

CREATE POLICY "Employees can insert bills for owner" 
ON public.bills 
FOR INSERT 
WITH CHECK (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_bills')
);

CREATE POLICY "Employees can update owner bills" 
ON public.bills 
FOR UPDATE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_bills')
);

CREATE POLICY "Employees can delete owner bills" 
ON public.bills 
FOR DELETE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_bills')
);

-- Atualizar políticas RLS para vehicles
DROP POLICY IF EXISTS "Employees can view owner vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Employees can insert vehicles for owner" ON public.vehicles;
DROP POLICY IF EXISTS "Employees can update owner vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Employees can delete owner vehicles" ON public.vehicles;

CREATE POLICY "Employees can view owner vehicles" 
ON public.vehicles 
FOR SELECT 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_vehicles')
);

CREATE POLICY "Employees can insert vehicles for owner" 
ON public.vehicles 
FOR INSERT 
WITH CHECK (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_vehicles')
);

CREATE POLICY "Employees can update owner vehicles" 
ON public.vehicles 
FOR UPDATE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_vehicles')
);

CREATE POLICY "Employees can delete owner vehicles" 
ON public.vehicles 
FOR DELETE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_vehicles')
);

-- Atualizar políticas RLS para vehicle_payments
DROP POLICY IF EXISTS "Employees can view owner vehicle payments" ON public.vehicle_payments;
DROP POLICY IF EXISTS "Employees can insert vehicle payments for owner" ON public.vehicle_payments;
DROP POLICY IF EXISTS "Employees can update owner vehicle payments" ON public.vehicle_payments;
DROP POLICY IF EXISTS "Employees can delete owner vehicle payments" ON public.vehicle_payments;

CREATE POLICY "Employees can view owner vehicle payments" 
ON public.vehicle_payments 
FOR SELECT 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_vehicles')
);

CREATE POLICY "Employees can insert vehicle payments for owner" 
ON public.vehicle_payments 
FOR INSERT 
WITH CHECK (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_vehicles')
);

CREATE POLICY "Employees can update owner vehicle payments" 
ON public.vehicle_payments 
FOR UPDATE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_vehicles')
);

CREATE POLICY "Employees can delete owner vehicle payments" 
ON public.vehicle_payments 
FOR DELETE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_vehicles')
);

-- Atualizar políticas RLS para product_sales
DROP POLICY IF EXISTS "Employees can view owner product sales" ON public.product_sales;
DROP POLICY IF EXISTS "Employees can insert product sales for owner" ON public.product_sales;
DROP POLICY IF EXISTS "Employees can update owner product sales" ON public.product_sales;
DROP POLICY IF EXISTS "Employees can delete owner product sales" ON public.product_sales;

CREATE POLICY "Employees can view owner product sales" 
ON public.product_sales 
FOR SELECT 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_products')
);

CREATE POLICY "Employees can insert product sales for owner" 
ON public.product_sales 
FOR INSERT 
WITH CHECK (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_products')
);

CREATE POLICY "Employees can update owner product sales" 
ON public.product_sales 
FOR UPDATE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_products')
);

CREATE POLICY "Employees can delete owner product sales" 
ON public.product_sales 
FOR DELETE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_products')
);

-- Atualizar políticas RLS para product_sale_payments
DROP POLICY IF EXISTS "Employees can view owner product sale payments" ON public.product_sale_payments;
DROP POLICY IF EXISTS "Employees can insert product sale payments for owner" ON public.product_sale_payments;
DROP POLICY IF EXISTS "Employees can update owner product sale payments" ON public.product_sale_payments;
DROP POLICY IF EXISTS "Employees can delete owner product sale payments" ON public.product_sale_payments;

CREATE POLICY "Employees can view owner product sale payments" 
ON public.product_sale_payments 
FOR SELECT 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_products')
);

CREATE POLICY "Employees can insert product sale payments for owner" 
ON public.product_sale_payments 
FOR INSERT 
WITH CHECK (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_products')
);

CREATE POLICY "Employees can update owner product sale payments" 
ON public.product_sale_payments 
FOR UPDATE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_products')
);

CREATE POLICY "Employees can delete owner product sale payments" 
ON public.product_sale_payments 
FOR DELETE 
USING (
  user_id = get_employee_owner_id(auth.uid()) 
  AND has_employee_permission(auth.uid(), 'manage_products')
);