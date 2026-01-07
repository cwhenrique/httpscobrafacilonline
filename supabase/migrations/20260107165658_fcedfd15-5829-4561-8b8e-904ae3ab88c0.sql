-- Corrigir a função recalculate_loan_total_paid para usar total_interest corretamente
CREATE OR REPLACE FUNCTION public.recalculate_loan_total_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actual_total NUMERIC;
  loan_record RECORD;
  loan_total_amount NUMERIC;
  new_remaining NUMERIC;
  new_status TEXT;
BEGIN
  -- Buscar dados do empréstimo
  SELECT * INTO loan_record
  FROM public.loans
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  IF loan_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Soma real dos pagamentos
  SELECT COALESCE(SUM(amount), 0) INTO actual_total
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  -- CORREÇÃO: Usar total_interest em vez de recalcular com taxa
  IF loan_record.payment_type = 'daily' THEN
    -- Para diários: principal + (valor_diario * parcelas)
    loan_total_amount := loan_record.principal_amount + 
      (COALESCE(loan_record.total_interest, 0) * COALESCE(loan_record.installments, 1));
  ELSE
    -- Para outros tipos: principal + total_interest
    loan_total_amount := loan_record.principal_amount + COALESCE(loan_record.total_interest, 0);
  END IF;
  
  -- Calcular novo remaining_balance
  new_remaining := GREATEST(loan_total_amount - actual_total, 0);
  
  -- Determinar novo status
  IF new_remaining <= 0.01 THEN
    new_status := 'paid';
  ELSIF loan_record.due_date < CURRENT_DATE THEN
    new_status := 'overdue';
  ELSE
    new_status := 'pending';
  END IF;
  
  -- Atualizar empréstimo apenas se os valores mudaram
  UPDATE public.loans
  SET 
    total_paid = actual_total,
    remaining_balance = new_remaining,
    status = new_status::payment_status
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (total_paid != actual_total OR remaining_balance != new_remaining OR status::text != new_status);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Corrigir os empréstimos afetados do usuário edsonrosalvo7@gmail.com
-- Recalcular remaining_balance e status para empréstimos parcelados (não diários)
UPDATE public.loans
SET 
  remaining_balance = GREATEST((principal_amount + COALESCE(total_interest, 0)) - COALESCE(total_paid, 0), 0),
  status = CASE 
    WHEN (principal_amount + COALESCE(total_interest, 0)) - COALESCE(total_paid, 0) <= 0.01 THEN 'paid'::payment_status
    WHEN due_date < CURRENT_DATE THEN 'overdue'::payment_status
    ELSE 'pending'::payment_status
  END
WHERE payment_type = 'installment'
  AND status = 'paid'
  AND (principal_amount + COALESCE(total_interest, 0)) - COALESCE(total_paid, 0) > 0.01;