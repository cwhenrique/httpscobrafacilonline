
-- Atualizar função recalculate_loan_total_paid para ignorar pagamentos PRE_RENEGOTIATION
CREATE OR REPLACE FUNCTION public.recalculate_loan_total_paid()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actual_total NUMERIC;
  balance_reducing_payments NUMERIC;
  loan_record RECORD;
  loan_total_amount NUMERIC;
  new_remaining NUMERIC;
  new_status TEXT;
  discount_amount NUMERIC := 0;
  penalty_total NUMERIC := 0;
  consolidated_total NUMERIC := 0;
  discount_match TEXT[];
BEGIN
  -- Buscar dados do empréstimo
  SELECT * INTO loan_record
  FROM public.loans
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  IF loan_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Soma total de todos os pagamentos (para total_paid) - EXCLUINDO PRE_RENEGOTIATION
  SELECT COALESCE(SUM(amount), 0) INTO actual_total
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL);
  
  -- Soma de pagamentos que REDUZEM o saldo (exclui INTEREST_ONLY_PAYMENT e PRE_RENEGOTIATION)
  SELECT COALESCE(SUM(amount), 0) INTO balance_reducing_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL);
  
  -- Extrair desconto se houver tag [DISCOUNT_SETTLEMENT:valor]
  IF loan_record.notes IS NOT NULL THEN
    discount_match := regexp_match(loan_record.notes, '\[DISCOUNT_SETTLEMENT:([0-9.]+)\]');
    IF discount_match IS NOT NULL THEN
      discount_amount := discount_match[1]::numeric;
    END IF;
    
    -- Extrair soma de todas as multas diárias [DAILY_PENALTY:indice:valor]
    SELECT COALESCE(SUM(m[1]::numeric), 0) INTO penalty_total
    FROM regexp_matches(loan_record.notes, '\[DAILY_PENALTY:[0-9]+:([0-9.]+)\]', 'g') AS m;
    
    -- Extrair soma de todos os juros consolidados por atraso [OVERDUE_CONSOLIDATED:valor:data:dias]
    SELECT COALESCE(SUM(m[1]::numeric), 0) INTO consolidated_total
    FROM regexp_matches(loan_record.notes, '\[OVERDUE_CONSOLIDATED:([0-9.]+):[^\]]+\]', 'g') AS m;
  END IF;
  
  -- Para diários: parcela_diaria × quantidade_de_parcelas
  IF loan_record.payment_type = 'daily' THEN
    loan_total_amount := COALESCE(loan_record.total_interest, 0) * COALESCE(loan_record.installments, 1);
  ELSE
    -- Para outros tipos: principal + total_interest
    loan_total_amount := loan_record.principal_amount + COALESCE(loan_record.total_interest, 0);
  END IF;
  
  -- Adicionar multas e juros consolidados ao total
  loan_total_amount := loan_total_amount + penalty_total + consolidated_total;
  
  -- Calcular novo remaining_balance COM desconto (usando apenas pagamentos que reduzem saldo)
  new_remaining := GREATEST(loan_total_amount - balance_reducing_payments - discount_amount, 0);
  
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
$$;
