-- Create function to revert loan values when payment is deleted
CREATE OR REPLACE FUNCTION public.revert_loan_on_payment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

-- Create trigger to execute on payment deletion
CREATE TRIGGER revert_loan_on_payment_delete_trigger
AFTER DELETE ON public.loan_payments
FOR EACH ROW
EXECUTE FUNCTION public.revert_loan_on_payment_delete();