
-- 1. Update trigger: update_loan_on_payment - exclude penalty from remaining_balance reduction
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
  penalty_amount numeric := 0;
BEGIN
  -- Se é amortização, NÃO altera valores (já foram atualizados pelo código antes)
  IF NEW.notes LIKE '%[AMORTIZATION]%' THEN
    RETURN NEW;
  END IF;

  -- Extract penalty amount from notes tag [PENALTY_INCLUDED:X.XX]
  IF NEW.notes IS NOT NULL AND NEW.notes LIKE '%[PENALTY_INCLUDED:%' THEN
    penalty_amount := COALESCE(
      (regexp_match(NEW.notes, '\[PENALTY_INCLUDED:([0-9.]+)\]'))[1]::numeric,
      0
    );
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
      status = CASE 
        WHEN remaining_balance - NEW.amount <= 0 THEN 'paid'::payment_status
        WHEN due_date >= CURRENT_DATE THEN 'pending'::payment_status
        ELSE status
      END
    WHERE id = NEW.loan_id;
  ELSE
    -- Normal payment: reduce remaining_balance by (amount - penalty)
    UPDATE public.loans
    SET 
      total_paid = COALESCE(total_paid, 0) + NEW.amount,
      remaining_balance = GREATEST(0, remaining_balance - (NEW.amount - penalty_amount)),
      status = CASE 
        WHEN remaining_balance - (NEW.amount - penalty_amount) <= 0 THEN 'paid'::payment_status
        WHEN due_date >= CURRENT_DATE THEN 'pending'::payment_status
        ELSE 'overdue'::payment_status
      END
    WHERE id = NEW.loan_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Update trigger: revert_loan_on_payment_delete - exclude penalty from remaining_balance revert
CREATE OR REPLACE FUNCTION public.revert_loan_on_payment_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  remaining_interest_only_count integer;
  installment_num integer;
  updated_notes text;
  num_text text;
  loan_due_date date;
  penalty_amount numeric := 0;
BEGIN
  -- Se é amortização, pular - a reversão é feita pelo código
  IF OLD.notes LIKE '%[AMORTIZATION]%' THEN
    RETURN OLD;
  END IF;

  -- Extract penalty amount from notes tag [PENALTY_INCLUDED:X.XX]
  IF OLD.notes IS NOT NULL AND OLD.notes LIKE '%[PENALTY_INCLUDED:%' THEN
    penalty_amount := COALESCE(
      (regexp_match(OLD.notes, '\[PENALTY_INCLUDED:([0-9.]+)\]'))[1]::numeric,
      0
    );
  END IF;

  -- Get due_date for status calculation
  SELECT due_date INTO loan_due_date FROM public.loans WHERE id = OLD.loan_id;
  
  -- Check if this was an interest-only payment
  IF OLD.notes LIKE '%[INTEREST_ONLY_PAYMENT]%' THEN
    -- Interest-only: just subtract from total_paid
    UPDATE public.loans
    SET 
      total_paid = GREATEST(0, COALESCE(total_paid, 0) - OLD.amount),
      status = CASE 
        WHEN loan_due_date >= CURRENT_DATE THEN 'pending'::payment_status
        ELSE 'overdue'::payment_status
      END
    WHERE id = OLD.loan_id;
    
    -- Check if there are any remaining interest-only payments
    SELECT COUNT(*) INTO remaining_interest_only_count
    FROM public.loan_payments
    WHERE loan_id = OLD.loan_id 
      AND notes LIKE '%[INTEREST_ONLY_PAYMENT]%'
      AND id != OLD.id;
    
    -- If no more interest-only payments, remove the tag
    IF remaining_interest_only_count = 0 THEN
      UPDATE public.loans
      SET notes = TRIM(REGEXP_REPLACE(REPLACE(COALESCE(notes, ''), '[INTEREST_ONLY_PAYMENT]', ''), E'\\n\\s*\\n', E'\n', 'g'))
      WHERE id = OLD.loan_id;
    END IF;
  ELSE
    -- Normal payment: subtract from total_paid AND add back to remaining_balance (excluding penalty)
    UPDATE public.loans
    SET 
      total_paid = GREATEST(0, COALESCE(total_paid, 0) - OLD.amount),
      remaining_balance = remaining_balance + (OLD.amount - penalty_amount),
      status = CASE 
        WHEN loan_due_date >= CURRENT_DATE THEN 'pending'::payment_status
        ELSE 'overdue'::payment_status
      END
    WHERE id = OLD.loan_id;
    
    -- Handle PARTIAL_PAID tags removal
    IF OLD.notes IS NOT NULL AND OLD.notes ~ 'Parcela' THEN
      SELECT notes INTO updated_notes FROM public.loans WHERE id = OLD.loan_id;
      
      IF updated_notes IS NOT NULL THEN
        IF OLD.notes ~ 'Parcela [0-9]+ de [0-9]+' THEN
          num_text := (regexp_match(OLD.notes, 'Parcela ([0-9]+) de'))[1];
          IF num_text IS NOT NULL THEN
            installment_num := num_text::integer - 1;
            updated_notes := regexp_replace(updated_notes, '\[PARTIAL_PAID:' || installment_num || ':[0-9.]+\]', '', 'g');
          END IF;
        END IF;
        
        IF OLD.notes ~ 'Parcelas [0-9]' THEN
          FOR num_text IN 
            SELECT (regexp_matches(
              split_part(OLD.notes, ' de ', 1), 
              '([0-9]+)', 'g'
            ))[1]
          LOOP
            installment_num := num_text::integer - 1;
            updated_notes := regexp_replace(updated_notes, '\[PARTIAL_PAID:' || installment_num || ':[0-9.]+\]', '', 'g');
          END LOOP;
        END IF;
        
        UPDATE public.loans
        SET notes = TRIM(regexp_replace(updated_notes, E'\\s+', ' ', 'g'))
        WHERE id = OLD.loan_id;
      END IF;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$function$;

-- 3. Update trigger: recalculate_loan_total_paid - exclude penalty from balance_reducing_payments
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

  -- FIX: For amortization payments, the application code already set remaining_balance correctly
  IF NEW IS NOT NULL AND NEW.notes LIKE '%[AMORTIZATION]%' THEN
    UPDATE public.loans
    SET 
      total_paid = total_payments,
      updated_at = NOW()
    WHERE id = NEW.loan_id;
    RETURN NEW;
  END IF;

  -- Calculate total_to_receive based on payment_type
  IF loan_payment_type = 'daily' THEN
    total_to_receive := loan_total_interest * loan_installments;
  ELSE
    total_to_receive := loan_principal + loan_total_interest;
  END IF;

  -- Sum only balance-reducing payments, EXCLUDING penalty amounts from each payment
  SELECT COALESCE(SUM(
    amount - COALESCE(
      (regexp_match(notes, '\[PENALTY_INCLUDED:([0-9.]+)\]'))[1]::numeric,
      0
    )
  ), 0) INTO balance_reducing_payments
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
  IF GREATEST(0, total_to_receive - balance_reducing_payments) <= 0.01 THEN
    new_status := 'paid';
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
