
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
BEGIN
  -- Get the loan data including notes for discount check
  SELECT principal_amount, COALESCE(total_interest, 0), payment_type, COALESCE(installments, 1), due_date, notes
  INTO loan_principal, loan_total_interest, loan_payment_type, loan_installments, loan_due_date, loan_notes
  FROM public.loans
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);

  -- CHECK: If loan has a DISCOUNT_SETTLEMENT tag, it was settled with discount
  -- This early exit is CORRECT and should remain first
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

  -- Sum only balance-reducing payments (EXCLUDING interest-only, partial interest, amortization, pre-renegotiation)
  SELECT COALESCE(SUM(amount), 0) INTO balance_reducing_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[PARTIAL_INTEREST_PAYMENT]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[AMORTIZATION]%' OR notes IS NULL);
  
  -- *** CORRIGIDO: Usar balance_reducing_payments em vez de total_payments ***
  -- Isso garante que pagamentos de somente-juros não marquem o empréstimo como quitado
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
