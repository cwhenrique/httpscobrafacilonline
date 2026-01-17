-- Corrigir o trigger recalculate_loan_total_paid para calcular corretamente empréstimos diários
-- Para empréstimos diários, total_interest armazena o valor da parcela, não o lucro total
-- Então total_to_receive = total_interest * installments

CREATE OR REPLACE FUNCTION public.recalculate_loan_total_paid()
RETURNS TRIGGER AS $$
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
  -- Sum all payments for this loan
  SELECT COALESCE(SUM(amount), 0) INTO total_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id);
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Corrigir o empréstimo da Pietra que foi afetado
UPDATE loans 
SET 
  remaining_balance = (34.0 * 25) - 782.0,  -- = 68
  status = 'overdue'::payment_status,
  updated_at = now()
WHERE id = 'bc2ee829-3667-42d1-a45b-17198a15a35a';

-- Corrigir TODOS os empréstimos diários que podem ter sido afetados
UPDATE loans 
SET 
  remaining_balance = GREATEST(0, (total_interest * installments) - COALESCE(total_paid, 0)),
  status = CASE 
    WHEN GREATEST(0, (total_interest * installments) - COALESCE(total_paid, 0)) <= 0.01 THEN 'paid'::payment_status
    WHEN due_date >= CURRENT_DATE THEN 'pending'::payment_status
    ELSE 'overdue'::payment_status
  END,
  updated_at = now()
WHERE payment_type = 'daily'
  AND remaining_balance != GREATEST(0, (total_interest * installments) - COALESCE(total_paid, 0));