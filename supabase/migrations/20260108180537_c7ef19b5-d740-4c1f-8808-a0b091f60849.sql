-- Recriar função para extrair segundos do timestamp (garantindo que exista)
DROP FUNCTION IF EXISTS public.payment_created_second(timestamptz);

CREATE FUNCTION public.payment_created_second(ts timestamptz)
RETURNS timestamptz
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT DATE_TRUNC('second', ts);
$$;

-- Criar índice único para prevenir pagamentos duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_payments_prevent_duplicates 
ON public.loan_payments (
  loan_id, 
  amount, 
  COALESCE(notes, ''),
  public.payment_created_second(created_at)
);