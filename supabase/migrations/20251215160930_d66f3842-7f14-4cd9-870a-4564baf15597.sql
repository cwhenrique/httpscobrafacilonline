-- Add subscription management columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'trial';

-- Add index for subscription checks
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires ON public.profiles(subscription_expires_at) WHERE is_active = true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.subscription_plan IS 'Values: trial, monthly, annual, lifetime';
COMMENT ON COLUMN public.profiles.subscription_expires_at IS 'NULL for lifetime plans, date for others';