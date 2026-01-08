-- Corrigir empréstimos single/parcela única com due_date futura que estão como overdue
UPDATE loans
SET status = 'pending'
WHERE status = 'overdue'
  AND payment_type = 'single'
  AND due_date >= CURRENT_DATE;