ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cash_flow_initial_balance numeric DEFAULT 0;