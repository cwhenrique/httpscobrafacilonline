-- Add a policy to allow reading affiliate links for authenticated users
-- This is needed so the Auth page can fetch links when showing renewal options
CREATE POLICY "Anyone can read active affiliates"
ON public.affiliates
FOR SELECT
USING (is_active = true);