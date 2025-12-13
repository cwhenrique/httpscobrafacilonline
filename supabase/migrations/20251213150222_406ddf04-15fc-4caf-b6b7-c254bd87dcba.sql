CREATE OR REPLACE FUNCTION public.update_loan_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.loans
  SET 
    total_paid = total_paid + NEW.amount,
    remaining_balance = remaining_balance - NEW.amount,
    status = CASE 
      WHEN remaining_balance - NEW.amount <= 0 THEN 'paid'::payment_status
      WHEN due_date < CURRENT_DATE THEN 'overdue'::payment_status
      ELSE 'pending'::payment_status
    END
  WHERE id = NEW.loan_id;
  RETURN NEW;
END;
$function$;