
-- Passo 1: Atualizar o gatilho recalculate_loan_total_paid com verificação de principal_paid
CREATE OR REPLACE FUNCTION public.recalculate_loan_total_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_payments NUMERIC;
  balance_reducing_payments NUMERIC;
  total_principal_payments NUMERIC;
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

  -- Sum total principal paid across all payments
  SELECT COALESCE(SUM(principal_paid), 0) INTO total_principal_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL);

  -- Determine new status
  -- Check 1: balance_reducing_payments cover the full amount
  IF GREATEST(0, total_to_receive - balance_reducing_payments) <= 0.01 THEN
    new_status := 'paid';
  -- Check 2: total_paid covers full amount AND principal has been fully paid
  -- This handles cases where interest was paid separately via INTEREST_ONLY tags
  -- but the principal was paid in full via regular payments
  -- Excludes recurring interest-only contracts where principal_paid = 0
  ELSIF total_payments >= total_to_receive - 0.01 
    AND total_principal_payments >= loan_principal - 0.01 THEN
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
    remaining_balance = CASE 
      WHEN new_status = 'paid' THEN 0
      ELSE GREATEST(0, total_to_receive - balance_reducing_payments)
    END,
    status = new_status,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Passo 2: Corrigir os empréstimos onde principal foi quitado mas status não é 'paid'
-- Atualiza empréstimos onde:
-- 1. total_paid >= principal + interest (ou interest * installments para diários)
-- 2. SUM(principal_paid) >= principal_amount
-- 3. Não tem DISCOUNT_SETTLEMENT
UPDATE public.loans l
SET 
  remaining_balance = 0,
  status = 'paid',
  updated_at = NOW()
WHERE l.status != 'paid'
  AND l.remaining_balance > 0
  AND (l.notes NOT LIKE '%[DISCOUNT_SETTLEMENT:%' OR l.notes IS NULL)
  AND COALESCE(l.total_paid, 0) >= (
    CASE 
      WHEN l.payment_type = 'daily' THEN COALESCE(l.total_interest, 0) * COALESCE(l.installments, 1)
      ELSE l.principal_amount + COALESCE(l.total_interest, 0)
    END
  ) - 0.01
  AND (
    SELECT COALESCE(SUM(lp.principal_paid), 0)
    FROM public.loan_payments lp
    WHERE lp.loan_id = l.id
      AND (lp.notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR lp.notes IS NULL)
  ) >= l.principal_amount - 0.01;
