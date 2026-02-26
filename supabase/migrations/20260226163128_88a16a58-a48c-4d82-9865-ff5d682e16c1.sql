
-- Corrigir policy de INSERT para aceitar apenas de funções security definer (via owner_id check)
DROP POLICY IF EXISTS "Service role can insert activity logs" ON public.employee_activity_log;

-- Permitir inserção quando o owner_id corresponde ao dono do funcionário
CREATE POLICY "Authenticated can insert activity logs"
ON public.employee_activity_log
FOR INSERT
WITH CHECK (
  owner_id IN (
    SELECT owner_id FROM public.employees WHERE employee_user_id = auth.uid() AND is_active = true
  )
  OR auth.uid() = owner_id
);
