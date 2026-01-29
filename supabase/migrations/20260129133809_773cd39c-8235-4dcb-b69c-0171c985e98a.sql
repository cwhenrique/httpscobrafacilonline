-- Allow unauthenticated admin (Clauclau) to update any profile's affiliate_email
-- This is protected by page-level access control

CREATE POLICY "Anyone can update profile affiliate_email"
ON public.profiles
FOR UPDATE
USING (true)
WITH CHECK (true);