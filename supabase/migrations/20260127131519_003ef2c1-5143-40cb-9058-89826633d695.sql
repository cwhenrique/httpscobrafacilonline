-- Create verification_codes table for 2FA on sensitive profile changes
CREATE TABLE public.verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code text NOT NULL, -- SHA-256 hashed code
  field_name text NOT NULL, -- Primary field being verified (pix_key, payment_link)
  pending_updates jsonb NOT NULL DEFAULT '{}'::jsonb, -- All pending profile updates
  ip_address inet,
  user_agent text,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified_at timestamp with time zone,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can insert their own codes
CREATE POLICY "Users can insert own verification codes"
ON public.verification_codes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own codes (needed for verification)
CREATE POLICY "Users can view own verification codes"
ON public.verification_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all codes for audit purposes
CREATE POLICY "Admins can view all verification codes"
ON public.verification_codes
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Add verification_id column to profile_audit_log to link audits to verification codes
ALTER TABLE public.profile_audit_log 
ADD COLUMN IF NOT EXISTS verification_id uuid REFERENCES public.verification_codes(id);

-- Create index for faster lookups
CREATE INDEX idx_verification_codes_user_expires ON public.verification_codes(user_id, expires_at);
CREATE INDEX idx_verification_codes_user_verified ON public.verification_codes(user_id, verified_at);

-- Add comment for documentation
COMMENT ON TABLE public.verification_codes IS 'Stores temporary verification codes for 2FA on sensitive profile changes';