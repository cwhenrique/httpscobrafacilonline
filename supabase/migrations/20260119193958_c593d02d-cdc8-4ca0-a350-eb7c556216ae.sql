-- Update the trigger to exclude PRE_RENEGOTIATION payments from balance calculations
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
  total_to_receive NUMERIC;
  new_status payment_status;
BEGIN
  -- Sum all payments for this loan (excluding pre-renegotiation for display purposes)
  SELECT COALESCE(SUM(amount), 0) INTO total_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL);
  
  -- Sum only balance-reducing payments (excluding interest-only, pre-renegotiation, amortization)
  SELECT COALESCE(SUM(amount), 0) INTO balance_reducing_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[AMORTIZATION]%' OR notes IS NULL);
  
  -- Get the loan data including payment_type
  SELECT principal_amount, COALESCE(total_interest, 0), payment_type, COALESCE(installments, 1), due_date
  INTO loan_principal, loan_total_interest, loan_payment_type, loan_installments, loan_due_date
  FROM public.loans
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  -- Calculate total_to_receive based on payment_type
  IF loan_payment_type = 'daily' THEN
    -- For daily loans: total_interest stores the daily installment amount
    -- total_to_receive = daily_amount × installments
    total_to_receive := loan_total_interest * loan_installments;
  ELSE
    -- For other loans: total_to_receive = principal + total_interest (lucro)
    total_to_receive := loan_principal + loan_total_interest;
  END IF;
  
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