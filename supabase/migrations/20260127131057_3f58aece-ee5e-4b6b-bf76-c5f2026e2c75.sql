-- Create profile audit log table for tracking sensitive field changes
CREATE TABLE public.profile_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  ip_address inet,
  user_agent text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NOT NULL
);

-- Add index for efficient queries by user
CREATE INDEX idx_profile_audit_log_user_id ON public.profile_audit_log(user_id);
CREATE INDEX idx_profile_audit_log_changed_at ON public.profile_audit_log(changed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.profile_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only view their own audit logs (SELECT only, no INSERT/UPDATE/DELETE from client)
CREATE POLICY "Users can view own audit logs"
ON public.profile_audit_log
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.profile_audit_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Service role (edge functions) can insert audit logs - no RLS bypass needed since we use service role key