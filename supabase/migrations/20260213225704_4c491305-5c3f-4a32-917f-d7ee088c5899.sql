
-- 1. Corrigir o gatilho recalculate_loan_total_paid com verificação de quitação total
CREATE OR REPLACE FUNCTION public.recalculate_loan_total_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_payments NUMERIC;
  balance_reducing_payments NUMERIC;
  loan_principal NUMERIC;
  loan_total_interest NUMERIC;
  loan_payment_type TEXT;
  loan_installments INTEGER;
  loan_due_date DATE;
  loan_notes TEXT;
  total_to_receive NUMERIC;
  new_status payment_status;
  discount_value NUMERIC;
  discount_match TEXT[];
BEGIN
  -- Get the loan data including notes for discount check
  SELECT principal_amount, COALESCE(total_interest, 0), payment_type, COALESCE(installments, 1), due_date, notes
  INTO loan_principal, loan_total_interest, loan_payment_type, loan_installments, loan_due_date, loan_notes
  FROM public.loans
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);

  -- CHECK: If loan has a DISCOUNT_SETTLEMENT tag, it was settled with discount
  IF loan_notes LIKE '%[DISCOUNT_SETTLEMENT:%' THEN
    SELECT COALESCE(SUM(amount), 0) INTO total_payments
    FROM public.loan_payments
    WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
      AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL);

    UPDATE public.loans
    SET 
      total_paid = total_payments,
      remaining_balance = 0,
      status = 'paid',
      updated_at = NOW()
    WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
    
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Sum all payments for this loan (excluding pre-renegotiation)
  SELECT COALESCE(SUM(amount), 0) INTO total_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL);
  
  -- Calculate total_to_receive based on payment_type
  IF loan_payment_type = 'daily' THEN
    total_to_receive := loan_total_interest * loan_installments;
  ELSE
    total_to_receive := loan_principal + loan_total_interest;
  END IF;

  -- *** NOVA VERIFICAÇÃO: Se total pago >= total a receber, está quitado ***
  -- Independentemente do tipo de pagamento (interest-only, normal, etc.)
  IF total_payments >= total_to_receive - 0.01 THEN
    UPDATE public.loans
    SET 
      total_paid = total_payments,
      remaining_balance = 0,
      status = 'paid',
      updated_at = NOW()
    WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
    
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Sum only balance-reducing payments
  SELECT COALESCE(SUM(amount), 0) INTO balance_reducing_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[PARTIAL_INTEREST_PAYMENT]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[AMORTIZATION]%' OR notes IS NULL);
  
  -- Determine new status
  IF GREATEST(0, total_to_receive - balance_reducing_payments) <= 0.01 THEN
    new_status := 'paid';
  ELSIF loan_due_date >= CURRENT_DATE THEN
    new_status := 'pending';
  ELSE
    new_status := 'overdue';
  END IF;
  
  -- Update the loan with new totals
  UPDATE public.loans
  SET 
    total_paid = total_payments,
    remaining_balance = GREATEST(0, total_to_receive - balance_reducing_payments),
    status = new_status,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. Reparar empréstimos normais (não-daily) onde total_paid >= principal + juros
UPDATE public.loans
SET 
  remaining_balance = 0,
  status = 'paid',
  updated_at = NOW()
WHERE status != 'paid'
  AND payment_type != 'daily'
  AND COALESCE(total_paid, 0) >= (principal_amount + COALESCE(total_interest, 0)) - 0.01
  AND (notes NOT LIKE '%[DISCOUNT_SETTLEMENT:%' OR notes IS NULL);

-- 3. Reparar empréstimos daily onde total_paid >= total_interest * installments
UPDATE public.loans
SET 
  remaining_balance = 0,
  status = 'paid',
  updated_at = NOW()
WHERE status != 'paid'
  AND payment_type = 'daily'
  AND COALESCE(total_paid, 0) >= (COALESCE(total_interest, 0) * COALESCE(installments, 1)) - 0.01
  AND (notes NOT LIKE '%[DISCOUNT_SETTLEMENT:%' OR notes IS NULL);
