-- Criar ENUM de permissões para funcionários
CREATE TYPE employee_permission AS ENUM (
  'view_loans',
  'create_loans',
  'register_payments',
  'adjust_dates',
  'delete_loans',
  'view_clients',
  'create_clients',
  'edit_clients',
  'delete_clients',
  'view_reports',
  'manage_bills',
  'manage_vehicles',
  'manage_products',
  'view_settings'
);

-- Criar tabela de funcionários
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, employee_user_id),
  UNIQUE(employee_user_id)
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Criar tabela de permissões dos funcionários
CREATE TABLE public.employee_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  permission employee_permission NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, permission)
);

ALTER TABLE employee_permissions ENABLE ROW LEVEL SECURITY;

-- Adicionar colunas na tabela profiles para controle do recurso
ALTER TABLE profiles 
ADD COLUMN employees_feature_enabled boolean DEFAULT false,
ADD COLUMN max_employees integer DEFAULT 3;

-- =============================================
-- RLS POLICIES PARA TABELA employees
-- =============================================

-- Funcionário pode ver seu próprio registro
CREATE POLICY "Employees can view own record"
ON employees FOR SELECT
USING (employee_user_id = auth.uid());

-- Dono pode gerenciar seus funcionários
CREATE POLICY "Owners can manage their employees"
ON employees FOR ALL
USING (owner_id = auth.uid());

-- =============================================
-- RLS POLICIES PARA TABELA employee_permissions
-- =============================================

-- Funcionário pode ver suas permissões
CREATE POLICY "Employees can view own permissions"
ON employee_permissions FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM employees WHERE employee_user_id = auth.uid()
  )
);

-- Dono pode gerenciar permissões dos seus funcionários
CREATE POLICY "Owners can manage employee permissions"
ON employee_permissions FOR ALL
USING (
  employee_id IN (
    SELECT id FROM employees WHERE owner_id = auth.uid()
  )
);

-- =============================================
-- FUNÇÃO PARA VERIFICAR SE É FUNCIONÁRIO E OBTER OWNER_ID
-- =============================================

CREATE OR REPLACE FUNCTION public.get_employee_owner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id 
  FROM public.employees 
  WHERE employee_user_id = _user_id 
    AND is_active = true
  LIMIT 1
$$;

-- =============================================
-- ATUALIZAR RLS DE TODAS AS TABELAS DE DADOS
-- =============================================

-- LOANS: Funcionário pode ver empréstimos do dono
CREATE POLICY "Employees can view owner loans"
ON loans FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert loans for owner"
ON loans FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner loans"
ON loans FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner loans"
ON loans FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- CLIENTS: Funcionário pode gerenciar clientes do dono
CREATE POLICY "Employees can view owner clients"
ON clients FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert clients for owner"
ON clients FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner clients"
ON clients FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner clients"
ON clients FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- LOAN_PAYMENTS: Funcionário pode gerenciar pagamentos do dono
CREATE POLICY "Employees can view owner loan payments"
ON loan_payments FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert loan payments for owner"
ON loan_payments FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner loan payments"
ON loan_payments FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner loan payments"
ON loan_payments FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- BILLS: Funcionário pode gerenciar contas do dono
CREATE POLICY "Employees can view owner bills"
ON bills FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert bills for owner"
ON bills FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner bills"
ON bills FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner bills"
ON bills FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- VEHICLES: Funcionário pode gerenciar veículos do dono
CREATE POLICY "Employees can view owner vehicles"
ON vehicles FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert vehicles for owner"
ON vehicles FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner vehicles"
ON vehicles FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner vehicles"
ON vehicles FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- VEHICLE_PAYMENTS: Funcionário pode gerenciar pagamentos de veículos do dono
CREATE POLICY "Employees can view owner vehicle payments"
ON vehicle_payments FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert vehicle payments for owner"
ON vehicle_payments FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner vehicle payments"
ON vehicle_payments FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner vehicle payments"
ON vehicle_payments FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- PRODUCT_SALES: Funcionário pode gerenciar vendas do dono
CREATE POLICY "Employees can view owner product sales"
ON product_sales FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert product sales for owner"
ON product_sales FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner product sales"
ON product_sales FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner product sales"
ON product_sales FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- PRODUCT_SALE_PAYMENTS: Funcionário pode gerenciar pagamentos de vendas do dono
CREATE POLICY "Employees can view owner product sale payments"
ON product_sale_payments FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert product sale payments for owner"
ON product_sale_payments FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner product sale payments"
ON product_sale_payments FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner product sale payments"
ON product_sale_payments FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- CONTRACTS: Funcionário pode gerenciar contratos do dono
CREATE POLICY "Employees can view owner contracts"
ON contracts FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert contracts for owner"
ON contracts FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner contracts"
ON contracts FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner contracts"
ON contracts FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- CONTRACT_PAYMENTS: Funcionário pode gerenciar pagamentos de contratos do dono
CREATE POLICY "Employees can view owner contract payments"
ON contract_payments FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert contract payments for owner"
ON contract_payments FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner contract payments"
ON contract_payments FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner contract payments"
ON contract_payments FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- MONTHLY_FEES: Funcionário pode gerenciar mensalidades do dono
CREATE POLICY "Employees can view owner monthly fees"
ON monthly_fees FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert monthly fees for owner"
ON monthly_fees FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner monthly fees"
ON monthly_fees FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner monthly fees"
ON monthly_fees FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- MONTHLY_FEE_PAYMENTS: Funcionário pode gerenciar pagamentos de mensalidades do dono
CREATE POLICY "Employees can view owner monthly fee payments"
ON monthly_fee_payments FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert monthly fee payments for owner"
ON monthly_fee_payments FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner monthly fee payments"
ON monthly_fee_payments FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner monthly fee payments"
ON monthly_fee_payments FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- NOTIFICATIONS: Funcionário pode ver notificações do dono
CREATE POLICY "Employees can view owner notifications"
ON notifications FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert notifications for owner"
ON notifications FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can update owner notifications"
ON notifications FOR UPDATE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner notifications"
ON notifications FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- WHATSAPP_MESSAGES: Funcionário pode ver mensagens do dono
CREATE POLICY "Employees can view owner whatsapp messages"
ON whatsapp_messages FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert whatsapp messages for owner"
ON whatsapp_messages FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- CLIENT_DOCUMENTS: Funcionário pode gerenciar documentos do dono
CREATE POLICY "Employees can view owner client documents"
ON client_documents FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can insert client documents for owner"
ON client_documents FOR INSERT
WITH CHECK (
  user_id = public.get_employee_owner_id(auth.uid())
);

CREATE POLICY "Employees can delete owner client documents"
ON client_documents FOR DELETE
USING (
  user_id = public.get_employee_owner_id(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();