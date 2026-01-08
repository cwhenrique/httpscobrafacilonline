-- Atualizar função recalculate_loan_total_paid para incluir multas e juros consolidados
CREATE OR REPLACE FUNCTION public.recalculate_loan_total_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actual_total NUMERIC;
  loan_record RECORD;
  loan_total_amount NUMERIC;
  new_remaining NUMERIC;
  new_status TEXT;
  discount_amount NUMERIC := 0;
  penalty_total NUMERIC := 0;
  consolidated_total NUMERIC := 0;
  discount_match TEXT[];
BEGIN
  -- Buscar dados do empréstimo
  SELECT * INTO loan_record
  FROM public.loans
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  IF loan_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Soma real dos pagamentos
  SELECT COALESCE(SUM(amount), 0) INTO actual_total
  FROM public.loan_payments
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  -- Extrair desconto se houver tag [DISCOUNT_SETTLEMENT:valor]
  IF loan_record.notes IS NOT NULL THEN
    discount_match := regexp_match(loan_record.notes, '\[DISCOUNT_SETTLEMENT:([0-9.]+)\]');
    IF discount_match IS NOT NULL THEN
      discount_amount := discount_match[1]::numeric;
    END IF;
    
    -- Extrair soma de todas as multas diárias [DAILY_PENALTY:indice:valor]
    SELECT COALESCE(SUM(match[1]::numeric), 0) INTO penalty_total
    FROM regexp_matches(loan_record.notes, '\[DAILY_PENALTY:[0-9]+:([0-9.]+)\]', 'g') AS match;
    
    -- Extrair soma de todos os juros consolidados por atraso [OVERDUE_CONSOLIDATED:valor:data:dias]
    SELECT COALESCE(SUM(match[1]::numeric), 0) INTO consolidated_total
    FROM regexp_matches(loan_record.notes, '\[OVERDUE_CONSOLIDATED:([0-9.]+):[^\]]+\]', 'g') AS match;
  END IF;
  
  -- Para diários: parcela_diaria × quantidade_de_parcelas
  IF loan_record.payment_type = 'daily' THEN
    loan_total_amount := COALESCE(loan_record.total_interest, 0) * COALESCE(loan_record.installments, 1);
  ELSE
    -- Para outros tipos: principal + total_interest
    loan_total_amount := loan_record.principal_amount + COALESCE(loan_record.total_interest, 0);
  END IF;
  
  -- Adicionar multas e juros consolidados ao total
  loan_total_amount := loan_total_amount + penalty_total + consolidated_total;
  
  -- Calcular novo remaining_balance COM desconto
  new_remaining := GREATEST(loan_total_amount - actual_total - discount_amount, 0);
  
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
    AND (total_paid != actual_total OR remaining_balance != new_remaining OR status::text != new_status);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Correção em massa: recalcular remaining_balance de todos os empréstimos não-pagos
WITH loan_calculations AS (
  SELECT 
    l.id,
    -- Total base (diário vs outros)
    CASE 
      WHEN l.payment_type = 'daily' 
      THEN COALESCE(l.total_interest, 0) * COALESCE(l.installments, 1)
      ELSE l.principal_amount + COALESCE(l.total_interest, 0)
    END as base_total,
    -- Soma de multas diárias
    COALESCE((SELECT SUM(m[1]::numeric) 
      FROM regexp_matches(l.notes, '\[DAILY_PENALTY:[0-9]+:([0-9.]+)\]', 'g') m), 0) as penalties,
    -- Soma de juros consolidados por atraso
    COALESCE((SELECT SUM(m[1]::numeric) 
      FROM regexp_matches(l.notes, '\[OVERDUE_CONSOLIDATED:([0-9.]+):[^\]]+\]', 'g') m), 0) as consolidated,
    -- Desconto de quitação
    COALESCE((regexp_match(l.notes, '\[DISCOUNT_SETTLEMENT:([0-9.]+)\]'))[1]::numeric, 0) as discount,
    COALESCE(l.total_paid, 0) as total_paid
  FROM loans l
  WHERE l.status != 'paid'
)
UPDATE loans 
SET remaining_balance = GREATEST(0, 
  lc.base_total + lc.penalties + lc.consolidated - lc.total_paid - lc.discount
)
FROM loan_calculations lc
WHERE loans.id = lc.id;