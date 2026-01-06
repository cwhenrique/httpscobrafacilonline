-- Criar índices para melhorar performance de queries frequentes
CREATE INDEX IF NOT EXISTS idx_loans_created_at ON public.loans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON public.loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loans_user_status ON public.loans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_payment_date ON public.loan_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON public.loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- Função otimizada para estatísticas do Dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_user_id uuid)
RETURNS TABLE (
  total_loaned numeric,
  total_received numeric,
  total_pending numeric,
  pending_interest numeric,
  overdue_count bigint,
  overdue_amount numeric,
  active_loans_count bigint,
  paid_loans_count bigint,
  active_clients bigint,
  loans_this_week bigint,
  received_this_week numeric,
  due_today_count bigint,
  overdue_this_week bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  week_start date;
  today date;
BEGIN
  week_start := date_trunc('week', CURRENT_DATE)::date;
  today := CURRENT_DATE;
  
  RETURN QUERY
  SELECT
    -- Total emprestado (principal de todos empréstimos)
    COALESCE(SUM(l.principal_amount), 0)::numeric as total_loaned,
    
    -- Total recebido (soma de total_paid)
    COALESCE(SUM(l.total_paid), 0)::numeric as total_received,
    
    -- Total pendente (remaining_balance de ativos)
    COALESCE(SUM(CASE WHEN l.status != 'paid' THEN l.remaining_balance ELSE 0 END), 0)::numeric as total_pending,
    
    -- Juros pendentes (estimativa)
    COALESCE(SUM(CASE WHEN l.status != 'paid' THEN l.total_interest - COALESCE((
      SELECT SUM(lp.interest_paid) FROM loan_payments lp WHERE lp.loan_id = l.id
    ), 0) ELSE 0 END), 0)::numeric as pending_interest,
    
    -- Quantidade de empréstimos em atraso
    COUNT(CASE WHEN l.status = 'overdue' OR (l.status = 'pending' AND l.due_date < today) THEN 1 END)::bigint as overdue_count,
    
    -- Valor em atraso
    COALESCE(SUM(CASE WHEN l.status = 'overdue' OR (l.status = 'pending' AND l.due_date < today) THEN l.remaining_balance ELSE 0 END), 0)::numeric as overdue_amount,
    
    -- Empréstimos ativos
    COUNT(CASE WHEN l.status != 'paid' THEN 1 END)::bigint as active_loans_count,
    
    -- Empréstimos pagos
    COUNT(CASE WHEN l.status = 'paid' THEN 1 END)::bigint as paid_loans_count,
    
    -- Clientes ativos (com empréstimos não pagos)
    COUNT(DISTINCT CASE WHEN l.status != 'paid' THEN l.client_id END)::bigint as active_clients,
    
    -- Empréstimos criados esta semana
    COUNT(CASE WHEN l.created_at >= week_start THEN 1 END)::bigint as loans_this_week,
    
    -- Recebido esta semana
    COALESCE((
      SELECT SUM(lp.amount) 
      FROM loan_payments lp 
      JOIN loans l2 ON lp.loan_id = l2.id 
      WHERE l2.user_id = p_user_id AND lp.payment_date >= week_start
    ), 0)::numeric as received_this_week,
    
    -- Vencendo hoje
    COUNT(CASE WHEN l.due_date = today AND l.status != 'paid' THEN 1 END)::bigint as due_today_count,
    
    -- Em atraso esta semana (entraram em atraso)
    COUNT(CASE WHEN l.due_date >= week_start AND l.due_date < today AND l.status != 'paid' THEN 1 END)::bigint as overdue_this_week
    
  FROM loans l
  WHERE l.user_id = p_user_id;
END;
$$;