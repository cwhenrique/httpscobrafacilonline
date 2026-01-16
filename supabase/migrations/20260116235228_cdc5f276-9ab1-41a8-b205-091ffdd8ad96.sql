-- Fix the recalculate_loan_total_paid trigger to exclude amortization payments
CREATE OR REPLACE FUNCTION public.recalculate_loan_total_paid()
RETURNS TRIGGER AS $$
DECLARE
  total_payments NUMERIC;
  balance_reducing_payments NUMERIC;
  loan_principal NUMERIC;
  loan_total_interest NUMERIC;
BEGIN
  -- Sum all payments for this loan (for total_paid)
  SELECT COALESCE(SUM(amount), 0) INTO total_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  -- Sum only balance-reducing payments (excluding interest-only, pre-renegotiation, and amortization payments)
  SELECT COALESCE(SUM(amount), 0) INTO balance_reducing_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[AMORTIZATION]%' OR notes IS NULL);
  
  -- Get the loan's principal and total_interest
  SELECT principal_amount, COALESCE(total_interest, 0) INTO loan_principal, loan_total_interest
  FROM public.loans
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  -- Update the loan with new totals
  UPDATE public.loans
  SET 
    total_paid = total_payments,
    remaining_balance = GREATEST(0, (loan_principal + loan_total_interest) - balance_reducing_payments),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix the specific loan for Luiziane Limão
UPDATE public.loans 
SET remaining_balance = 600.00,
    updated_at = NOW()
WHERE id = '1f8dadbc-9697-44a3-b6fe-53e990a96225';