
-- Adicionar colunas de presença na tabela employees
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Função RPC para atualizar last_seen_at do funcionário autenticado
CREATE OR REPLACE FUNCTION public.update_employee_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.employees
  SET last_seen_at = now()
  WHERE employee_user_id = auth.uid()
    AND is_active = true;
END;
$$;

-- Função RPC para atualizar last_login_at do funcionário autenticado
CREATE OR REPLACE FUNCTION public.update_employee_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.employees
  SET last_login_at = now(), last_seen_at = now()
  WHERE employee_user_id = auth.uid()
    AND is_active = true;
END;
$$;

-- Trigger para atualizar last_seen_at quando atividade é registrada
CREATE OR REPLACE FUNCTION public.trigger_update_employee_last_seen_on_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.employees
  SET last_seen_at = now()
  WHERE employee_user_id = NEW.employee_user_id
    AND is_active = true;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_employee_last_seen_on_activity
AFTER INSERT ON public.employee_activity_log
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_employee_last_seen_on_activity();
