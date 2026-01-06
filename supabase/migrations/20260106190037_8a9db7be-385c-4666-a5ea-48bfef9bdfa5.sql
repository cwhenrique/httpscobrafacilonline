-- Fase 1: Adicionar colunas IPTV na tabela monthly_fees
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'basic';
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS login_username text;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS login_password text;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS credit_expires_at date;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS max_devices integer DEFAULT 1;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS current_devices integer DEFAULT 0;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS demo_expires_at date;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS last_renewal_at timestamp with time zone;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0;

-- Criar tabela de planos IPTV pré-configurados
CREATE TABLE IF NOT EXISTS public.iptv_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  max_devices integer DEFAULT 1,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on iptv_plans
ALTER TABLE public.iptv_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for iptv_plans
CREATE POLICY "Users can view own iptv_plans" ON public.iptv_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own iptv_plans" ON public.iptv_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own iptv_plans" ON public.iptv_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own iptv_plans" ON public.iptv_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Criar tabela de histórico de reativações
CREATE TABLE IF NOT EXISTS public.subscription_reactivations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  monthly_fee_id uuid NOT NULL REFERENCES public.monthly_fees(id) ON DELETE CASCADE,
  reactivated_at timestamp with time zone DEFAULT now(),
  previous_inactive_days integer,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on subscription_reactivations
ALTER TABLE public.subscription_reactivations ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscription_reactivations
CREATE POLICY "Users can view own subscription_reactivations" ON public.subscription_reactivations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscription_reactivations" ON public.subscription_reactivations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription_reactivations" ON public.subscription_reactivations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscription_reactivations" ON public.subscription_reactivations
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at na tabela iptv_plans
CREATE TRIGGER update_iptv_plans_updated_at
  BEFORE UPDATE ON public.iptv_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();