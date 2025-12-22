CREATE OR REPLACE FUNCTION public.revert_loan_on_payment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  remaining_interest_only_count integer;
BEGIN
  -- Check if this was an interest-only payment
  IF OLD.notes LIKE '%[INTEREST_ONLY_PAYMENT]%' THEN
    -- Interest-only: just subtract from total_paid, remaining_balance wasn't changed
    UPDATE public.loans
    SET 
      total_paid = GREATEST(0, COALESCE(total_paid, 0) - OLD.amount),
      status = CASE 
        WHEN due_date < CURRENT_DATE THEN 'overdue'::payment_status
        ELSE 'pending'::payment_status
      END
    WHERE id = OLD.loan_id;
    
    -- Check if there are any remaining interest-only payments for this loan
    SELECT COUNT(*) INTO remaining_interest_only_count
    FROM public.loan_payments
    WHERE loan_id = OLD.loan_id 
      AND notes LIKE '%[INTEREST_ONLY_PAYMENT]%'
      AND id != OLD.id;
    
    -- If no more interest-only payments, remove the tag from loan notes
    IF remaining_interest_only_count = 0 THEN
      UPDATE public.loans
      SET notes = TRIM(REGEXP_REPLACE(REPLACE(COALESCE(notes, ''), '[INTEREST_ONLY_PAYMENT]', ''), E'\\n\\s*\\n', E'\n', 'g'))
      WHERE id = OLD.loan_id;
    END IF;
  ELSE
    -- Normal payment: subtract from total_paid AND add back to remaining_balance
    UPDATE public.loans
    SET 
      total_paid = GREATEST(0, COALESCE(total_paid, 0) - OLD.amount),
      remaining_balance = remaining_balance + OLD.amount,
      status = CASE 
        WHEN due_date < CURRENT_DATE THEN 'overdue'::payment_status
        ELSE 'pending'::payment_status
      END
    WHERE id = OLD.loan_id;
  END IF;
  RETURN OLD;
END;
$$;