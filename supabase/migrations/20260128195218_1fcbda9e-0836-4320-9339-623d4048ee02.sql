-- Update trigger update_loan_on_payment to recognize PARTIAL_INTEREST_PAYMENT
CREATE OR REPLACE FUNCTION public.update_loan_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  loan_record RECORD;
  installment_dates jsonb;
  paid_count integer;
  next_due_date date;
BEGIN
  -- Se é amortização, NÃO altera valores (já foram atualizados pelo código antes)
  IF NEW.notes LIKE '%[AMORTIZATION]%' THEN
    RETURN NEW;
  END IF;

  -- Get current loan data
  SELECT l.*, COALESCE(l.installment_dates, '[]'::jsonb) as dates
  INTO loan_record
  FROM public.loans l
  WHERE l.id = NEW.loan_id;
  
  -- Check if this is an interest-only payment OR partial interest payment
  IF NEW.notes LIKE '%[INTEREST_ONLY_PAYMENT]%' OR NEW.notes LIKE '%[PARTIAL_INTEREST_PAYMENT]%' THEN
    -- Interest-only or partial interest: add to total_paid but DON'T reduce remaining_balance
    UPDATE public.loans
    SET 
      total_paid = COALESCE(total_paid, 0) + NEW.amount,
      -- Keep same status - interest-only payments don't change overdue status
      -- Only change to pending if currently overdue and due_date is in the future
      status = CASE 
        WHEN remaining_balance - NEW.amount <= 0 THEN 'paid'::payment_status
        WHEN due_date >= CURRENT_DATE THEN 'pending'::payment_status
        ELSE status  -- Keep current status
      END
    WHERE id = NEW.loan_id;
  ELSE
    -- Normal payment: reduce remaining_balance
    UPDATE public.loans
    SET 
      total_paid = COALESCE(total_paid, 0) + NEW.amount,
      remaining_balance = GREATEST(0, remaining_balance - NEW.amount),
      status = CASE 
        WHEN remaining_balance - NEW.amount <= 0 THEN 'paid'::payment_status
        WHEN due_date >= CURRENT_DATE THEN 'pending'::payment_status
        ELSE 'overdue'::payment_status
      END
    WHERE id = NEW.loan_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update trigger recalculate_loan_total_paid to exclude PARTIAL_INTEREST_PAYMENT from balance calculations
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
  
  -- Sum only balance-reducing payments (excluding interest-only, partial interest, pre-renegotiation, amortization)
  SELECT COALESCE(SUM(amount), 0) INTO balance_reducing_payments
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR notes IS NULL)
    AND (notes NOT LIKE '%[PARTIAL_INTEREST_PAYMENT]%' OR notes IS NULL)
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