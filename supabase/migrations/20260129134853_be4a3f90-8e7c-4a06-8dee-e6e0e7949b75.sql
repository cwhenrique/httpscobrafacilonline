-- Allow unauthenticated reads on profiles for Clauclau admin access
-- This is protected by page-level access control

CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
USING (true);