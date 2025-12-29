-- Atualizar trigger para ignorar amortizações no insert de pagamento
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
  
  -- Check if this is an interest-only payment
  IF NEW.notes LIKE '%[INTEREST_ONLY_PAYMENT]%' THEN
    -- Interest-only: add to total_paid but DON'T reduce remaining_balance
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

-- Atualizar trigger para ignorar amortizações no delete de pagamento
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
BEGIN
  -- Se é amortização, pular - a reversão é feita pelo código
  IF OLD.notes LIKE '%[AMORTIZATION]%' THEN
    RETURN OLD;
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
    -- Normal payment: subtract from total_paid AND add back to remaining_balance
    UPDATE public.loans
    SET 
      total_paid = GREATEST(0, COALESCE(total_paid, 0) - OLD.amount),
      remaining_balance = remaining_balance + OLD.amount,
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