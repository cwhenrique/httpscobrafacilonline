-- Corrigir contratos com DISCOUNT_SETTLEMENT que foram afetados pela migração anterior
-- Quando total_paid + desconto >= principal + total_interest, o contrato deve estar quitado

UPDATE public.loans
SET 
  remaining_balance = 0,
  status = 'paid'::payment_status
WHERE notes LIKE '%DISCOUNT_SETTLEMENT%'
  AND status != 'paid'
  AND (
    -- Verificar se total_paid + desconto cobre o valor total
    COALESCE(total_paid, 0) + COALESCE(
      (regexp_match(notes, '\[DISCOUNT_SETTLEMENT:([0-9.]+)\]'))[1]::numeric,
      0
    ) >= principal_amount + COALESCE(total_interest, 0) - 0.01
  );

-- Atualizar função recalculate_loan_total_paid para considerar descontos
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
  discount_amount NUMERIC := 0;
  discount_match TEXT[];
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
  
  -- Extrair desconto se houver tag [DISCOUNT_SETTLEMENT:valor]
  IF loan_record.notes IS NOT NULL THEN
    discount_match := regexp_match(loan_record.notes, '\[DISCOUNT_SETTLEMENT:([0-9.]+)\]');
    IF discount_match IS NOT NULL THEN
      discount_amount := discount_match[1]::numeric;
    END IF;
  END IF;
  
  -- Para diários: parcela_diaria × quantidade_de_parcelas
  IF loan_record.payment_type = 'daily' THEN
    loan_total_amount := COALESCE(loan_record.total_interest, 0) * COALESCE(loan_record.installments, 1);
  ELSE
    -- Para outros tipos: principal + total_interest
    loan_total_amount := loan_record.principal_amount + COALESCE(loan_record.total_interest, 0);
  END IF;
  
  -- Calcular novo remaining_balance COM desconto
  new_remaining := GREATEST(loan_total_amount - actual_total - discount_amount, 0);
  
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