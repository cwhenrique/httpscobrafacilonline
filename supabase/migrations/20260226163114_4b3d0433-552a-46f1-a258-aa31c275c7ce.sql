
-- Tabela para registrar atividades dos funcionários
CREATE TABLE public.employee_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_user_id uuid NOT NULL,
  action_type text NOT NULL, -- 'loan_created', 'payment_registered', 'client_created', 'client_edited', 'loan_deleted', 'payment_deleted'
  description text NOT NULL,
  related_id uuid, -- ID do empréstimo, cliente, pagamento, etc
  related_type text, -- 'loan', 'client', 'payment', etc
  amount numeric, -- valor quando aplicável (pagamento registrado, empréstimo criado)
  client_name text, -- nome do cliente envolvido
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_employee_activity_log_owner_id ON public.employee_activity_log(owner_id);
CREATE INDEX idx_employee_activity_log_employee_id ON public.employee_activity_log(employee_id);
CREATE INDEX idx_employee_activity_log_created_at ON public.employee_activity_log(created_at DESC);
CREATE INDEX idx_employee_activity_log_action_type ON public.employee_activity_log(action_type);

-- RLS
ALTER TABLE public.employee_activity_log ENABLE ROW LEVEL SECURITY;

-- Dono pode ver tudo dos seus funcionários
CREATE POLICY "Owners can view employee activity logs"
ON public.employee_activity_log
FOR SELECT
USING (auth.uid() = owner_id);

-- Service role insere (via triggers/edge functions)
CREATE POLICY "Service role can insert activity logs"
ON public.employee_activity_log
FOR INSERT
WITH CHECK (true);

-- Dono pode deletar logs antigos se quiser
CREATE POLICY "Owners can delete own activity logs"
ON public.employee_activity_log
FOR DELETE
USING (auth.uid() = owner_id);

-- Função helper para registrar atividade de funcionário
CREATE OR REPLACE FUNCTION public.log_employee_activity(
  _employee_user_id uuid,
  _action_type text,
  _description text,
  _related_id uuid DEFAULT NULL,
  _related_type text DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _client_name text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _employee RECORD;
BEGIN
  -- Buscar dados do funcionário
  SELECT id, owner_id, employee_user_id
  INTO _employee
  FROM public.employees
  WHERE employee_user_id = _employee_user_id
    AND is_active = true
  LIMIT 1;

  -- Se não é funcionário, ignorar silenciosamente
  IF _employee.id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.employee_activity_log (
    owner_id, employee_id, employee_user_id,
    action_type, description, related_id, related_type,
    amount, client_name, metadata
  ) VALUES (
    _employee.owner_id, _employee.id, _employee_user_id,
    _action_type, _description, _related_id, _related_type,
    _amount, _client_name, _metadata
  );
END;
$$;

-- Trigger: log quando funcionário CRIA empréstimo
CREATE OR REPLACE FUNCTION public.trigger_log_employee_loan_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _client_name text;
  _is_emp boolean;
BEGIN
  -- Verificar se created_by é um funcionário
  SELECT EXISTS (
    SELECT 1 FROM public.employees WHERE employee_user_id = NEW.created_by AND is_active = true
  ) INTO _is_emp;

  IF NOT _is_emp THEN
    RETURN NEW;
  END IF;

  -- Buscar nome do cliente
  SELECT full_name INTO _client_name FROM public.clients WHERE id = NEW.client_id;

  PERFORM log_employee_activity(
    NEW.created_by,
    'loan_created',
    'Criou empréstimo de R$ ' || ROUND(NEW.principal_amount, 2) || ' para ' || COALESCE(_client_name, 'cliente'),
    NEW.id,
    'loan',
    NEW.principal_amount,
    _client_name
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_employee_loan_created
AFTER INSERT ON public.loans
FOR EACH ROW
EXECUTE FUNCTION public.trigger_log_employee_loan_created();

-- Trigger: log quando funcionário REGISTRA pagamento
CREATE OR REPLACE FUNCTION public.trigger_log_employee_payment_registered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _client_name text;
  _is_emp boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.employees WHERE employee_user_id = NEW.created_by AND is_active = true
  ) INTO _is_emp;

  IF NOT _is_emp THEN
    RETURN NEW;
  END IF;

  -- Buscar nome do cliente via loan
  SELECT c.full_name INTO _client_name
  FROM public.loans l
  JOIN public.clients c ON c.id = l.client_id
  WHERE l.id = NEW.loan_id;

  PERFORM log_employee_activity(
    NEW.created_by,
    'payment_registered',
    'Registrou pagamento de R$ ' || ROUND(NEW.amount, 2) || ' de ' || COALESCE(_client_name, 'cliente'),
    NEW.id,
    'payment',
    NEW.amount,
    _client_name
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_employee_payment_registered
AFTER INSERT ON public.loan_payments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_log_employee_payment_registered();

-- Trigger: log quando funcionário CRIA cliente
CREATE OR REPLACE FUNCTION public.trigger_log_employee_client_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_emp boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.employees WHERE employee_user_id = NEW.created_by AND is_active = true
  ) INTO _is_emp;

  IF NOT _is_emp THEN
    RETURN NEW;
  END IF;

  PERFORM log_employee_activity(
    NEW.created_by,
    'client_created',
    'Cadastrou cliente: ' || NEW.full_name,
    NEW.id,
    'client',
    NULL,
    NEW.full_name
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_employee_client_created
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.trigger_log_employee_client_created();

-- Trigger: log quando funcionário DELETA pagamento
CREATE OR REPLACE FUNCTION public.trigger_log_employee_payment_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _client_name text;
  _is_emp boolean;
  _deleter_id uuid;
BEGIN
  _deleter_id := auth.uid();
  
  SELECT EXISTS (
    SELECT 1 FROM public.employees WHERE employee_user_id = _deleter_id AND is_active = true
  ) INTO _is_emp;

  IF NOT _is_emp THEN
    RETURN OLD;
  END IF;

  SELECT c.full_name INTO _client_name
  FROM public.loans l
  JOIN public.clients c ON c.id = l.client_id
  WHERE l.id = OLD.loan_id;

  PERFORM log_employee_activity(
    _deleter_id,
    'payment_deleted',
    'Excluiu pagamento de R$ ' || ROUND(OLD.amount, 2) || ' de ' || COALESCE(_client_name, 'cliente'),
    OLD.id,
    'payment',
    OLD.amount,
    _client_name
  );

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_log_employee_payment_deleted
BEFORE DELETE ON public.loan_payments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_log_employee_payment_deleted();
