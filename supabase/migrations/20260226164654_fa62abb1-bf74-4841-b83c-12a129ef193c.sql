
CREATE OR REPLACE FUNCTION public.trigger_log_employee_payment_registered()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _client_name text;
  _is_emp boolean;
  _description text;
  _payment_type text;
  _parcela_match text[];
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

  -- Determinar tipo de pagamento baseado nas notes
  IF NEW.notes LIKE '%[INTEREST_ONLY_PAYMENT]%' THEN
    _payment_type := 'interest_only';
    _description := 'Registrou pagamento de juros de R$ ' || ROUND(NEW.amount, 2) || ' de ' || COALESCE(_client_name, 'cliente');
  ELSIF NEW.notes LIKE '%[PARTIAL_INTEREST_PAYMENT]%' THEN
    _payment_type := 'partial_interest';
    _description := 'Registrou pagamento de juros parcial de R$ ' || ROUND(NEW.amount, 2) || ' de ' || COALESCE(_client_name, 'cliente');
  ELSIF NEW.notes LIKE '%[AMORTIZATION]%' THEN
    _payment_type := 'amortization';
    _description := 'Registrou amortização de R$ ' || ROUND(NEW.amount, 2) || ' de ' || COALESCE(_client_name, 'cliente');
  ELSIF NEW.notes LIKE '%[HISTORICAL_INTEREST]%' THEN
    _payment_type := 'historical_interest';
    _description := 'Registrou juros histórico de R$ ' || ROUND(NEW.amount, 2) || ' de ' || COALESCE(_client_name, 'cliente');
  ELSIF NEW.notes IS NOT NULL AND NEW.notes ~ 'Parcela [0-9]+ de [0-9]+' THEN
    _payment_type := 'installment';
    _parcela_match := regexp_match(NEW.notes, 'Parcela ([0-9]+) de ([0-9]+)');
    _description := 'Registrou pagamento da parcela ' || _parcela_match[1] || '/' || _parcela_match[2] || ' de R$ ' || ROUND(NEW.amount, 2) || ' de ' || COALESCE(_client_name, 'cliente');
  ELSE
    _payment_type := 'regular';
    _description := 'Registrou pagamento de R$ ' || ROUND(NEW.amount, 2) || ' de ' || COALESCE(_client_name, 'cliente');
  END IF;

  PERFORM log_employee_activity(
    NEW.created_by,
    'payment_registered',
    _description,
    NEW.id,
    'payment',
    NEW.amount,
    _client_name,
    jsonb_build_object('payment_type', _payment_type)
  );

  RETURN NEW;
END;
$function$;
