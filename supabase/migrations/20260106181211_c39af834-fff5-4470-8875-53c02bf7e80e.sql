-- Função para recalcular total_paid baseado na soma real dos pagamentos
CREATE OR REPLACE FUNCTION public.recalculate_loan_total_paid()
RETURNS TRIGGER AS $$
DECLARE
  actual_total NUMERIC;
  loan_record RECORD;
  loan_total_amount NUMERIC;
  new_remaining NUMERIC;
  new_status TEXT;
BEGIN
  -- Buscar dados do empréstimo
  SELECT * INTO loan_record
  FROM public.loans
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  IF loan_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Soma real dos pagamentos (excluindo o pagamento atual se for DELETE)
  SELECT COALESCE(SUM(amount), 0) INTO actual_total
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  -- Calcular total a receber do empréstimo
  IF loan_record.payment_type = 'daily' THEN
    -- Para empréstimos diários: principal * (1 + taxa/100)
    loan_total_amount := loan_record.principal_amount * (1 + loan_record.interest_rate / 100);
  ELSE
    -- Para outros tipos: usar remaining_balance inicial + total_paid ou calcular
    loan_total_amount := loan_record.principal_amount * (1 + loan_record.interest_rate / 100);
  END IF;
  
  -- Calcular novo remaining_balance
  new_remaining := GREATEST(loan_total_amount - actual_total, 0);
  
  -- Determinar novo status
  IF new_remaining <= 0.01 THEN
    new_status := 'paid';
  ELSIF loan_record.due_date < CURRENT_DATE THEN
    new_status := 'overdue';
  ELSE
    new_status := 'pending';
  END IF;
  
  -- Atualizar empréstimo apenas se os valores mudaram
  UPDATE public.loans
  SET 
    total_paid = actual_total,
    remaining_balance = new_remaining,
    status = new_status::payment_status
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id)
    AND (total_paid != actual_total OR remaining_balance != new_remaining);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS trigger_sync_loan_total_paid ON public.loan_payments;

-- Criar trigger que sincroniza total_paid após cada operação em loan_payments
CREATE TRIGGER trigger_sync_loan_total_paid
AFTER INSERT OR UPDATE OR DELETE ON public.loan_payments
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_loan_total_paid();