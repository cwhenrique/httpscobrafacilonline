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
  discount_match TEXT[];
  -- Variaveis para emprestimos diarios
  paid_installments_count INTEGER := 0;
  due_installments_count INTEGER := 0;
  installment_date TIMESTAMPTZ;
  today DATE := CURRENT_DATE;
  dates_array JSONB;
  i INTEGER;
BEGIN
  -- Buscar dados do emprestimo
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
    
    -- Extrair soma de todas as multas diarias [DAILY_PENALTY:indice:valor]
    SELECT COALESCE(SUM(m[1]::numeric), 0) INTO penalty_total
    FROM regexp_matches(loan_record.notes, '\[DAILY_PENALTY:[0-9]+:([0-9.]+)\]', 'g') AS m;
  END IF;
  
  -- Para diarios: parcela_diaria x quantidade_de_parcelas
  IF loan_record.payment_type = 'daily' THEN
    loan_total_amount := COALESCE(loan_record.total_interest, 0) * COALESCE(loan_record.installments, 1);
  ELSE
    -- Para outros tipos: principal + total_interest
    loan_total_amount := loan_record.principal_amount + COALESCE(loan_record.total_interest, 0);
  END IF;
  
  -- Adicionar APENAS multas ao total
  loan_total_amount := loan_total_amount + penalty_total;
  
  -- Calcular novo remaining_balance COM desconto (usando apenas pagamentos que reduzem saldo)
  new_remaining := GREATEST(loan_total_amount - balance_reducing_payments - discount_amount, 0);
  
  -- Determinar novo status
  IF new_remaining <= 0.01 THEN
    new_status := 'paid';
  ELSIF loan_record.payment_type IN ('daily', 'weekly', 'biweekly') AND loan_record.installment_dates IS NOT NULL THEN
    -- CORRECAO: Para emprestimos parcelados (diario/semanal/quinzenal), verificar parcelas vencidas
    dates_array := loan_record.installment_dates::jsonb;
    
    -- Contar parcelas vencidas (datas anteriores a hoje)
    due_installments_count := 0;
    FOR i IN 0..jsonb_array_length(dates_array) - 1 LOOP
      installment_date := (dates_array->>i)::timestamptz;
      IF installment_date::date < today THEN
        due_installments_count := due_installments_count + 1;
      END IF;
    END LOOP;
    
    -- Contar parcelas pagas via PARTIAL_PAID ou pelo calculo do total pago
    IF loan_record.notes IS NOT NULL AND loan_record.notes LIKE '%[PARTIAL_PAID:%' THEN
      SELECT COUNT(*) INTO paid_installments_count
      FROM regexp_matches(loan_record.notes, '\[PARTIAL_PAID:([0-9]+):', 'g');
    ELSE
      -- Fallback: calcular pelo valor pago / valor da parcela
      paid_installments_count := FLOOR(balance_reducing_payments / NULLIF(loan_record.total_interest, 0))::integer;
    END IF;
    
    -- Se parcelas pagas < parcelas vencidas -> overdue
    IF COALESCE(paid_installments_count, 0) < due_installments_count THEN
      new_status := 'overdue';
    ELSE
      new_status := 'pending';
    END IF;
  ELSIF loan_record.due_date < CURRENT_DATE THEN
    new_status := 'overdue';
  ELSE
    new_status := 'pending';
  END IF;
  
  -- Atualizar emprestimo apenas se os valores mudaram
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

-- Forcar recalculo dos emprestimos diarios do usuario afetado
UPDATE loans 
SET updated_at = NOW() 
WHERE user_id = '1e506597-6874-4025-8997-0089843b4120'
  AND payment_type = 'daily'
  AND status = 'overdue';