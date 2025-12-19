-- Atualiza o trigger update_loan_on_payment para NÃO abater do remaining_balance
-- quando o pagamento é de "só juros" (marcado com [INTEREST_ONLY_PAYMENT])

CREATE OR REPLACE FUNCTION public.update_loan_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if this is an interest-only payment (juros apenas, não abate do principal)
  IF NEW.notes LIKE '%[INTEREST_ONLY_PAYMENT]%' THEN
    -- Interest-only: add to total_paid for history BUT DON'T reduce remaining_balance
    -- O principal continua o mesmo, só os juros foram pagos
    UPDATE public.loans
    SET 
      total_paid = COALESCE(total_paid, 0) + NEW.amount,
      -- remaining_balance NÃO é alterado para pagamento de só juros!
      status = CASE 
        WHEN due_date < CURRENT_DATE THEN 'overdue'::payment_status
        ELSE 'pending'::payment_status
      END
    WHERE id = NEW.loan_id;
  ELSE
    -- Normal payment: reduce remaining_balance as before
    UPDATE public.loans
    SET 
      total_paid = COALESCE(total_paid, 0) + NEW.amount,
      remaining_balance = GREATEST(0, remaining_balance - NEW.amount),
      status = CASE 
        WHEN remaining_balance - NEW.amount <= 0 THEN 'paid'::payment_status
        WHEN due_date < CURRENT_DATE THEN 'overdue'::payment_status
        ELSE 'pending'::payment_status
      END
    WHERE id = NEW.loan_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Adicionar comentário para documentação
COMMENT ON FUNCTION public.update_loan_on_payment() IS 
'Trigger que atualiza o loan quando um pagamento é registrado. 
Para pagamentos de "só juros" (notes contendo [INTEREST_ONLY_PAYMENT]), 
apenas atualiza total_paid mas NÃO abate do remaining_balance. 
Para pagamentos normais, abate do remaining_balance normalmente.';