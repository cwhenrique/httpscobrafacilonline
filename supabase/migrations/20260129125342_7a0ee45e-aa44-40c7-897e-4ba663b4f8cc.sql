-- Fix RLS policies for affiliates (explicit INSERT/UPDATE/DELETE/SELECT for admins)

-- Drop legacy admin policy if it exists
DROP POLICY IF EXISTS "Admins can manage affiliates" ON public.affiliates;

-- Drop target policies if they already exist
DROP POLICY IF EXISTS "Admins can insert affiliates" ON public.affiliates;
DROP POLICY IF EXISTS "Admins can update affiliates" ON public.affiliates;
DROP POLICY IF EXISTS "Admins can delete affiliates" ON public.affiliates;
DROP POLICY IF EXISTS "Admins can read all affiliates" ON public.affiliates;

-- Admins: INSERT
CREATE POLICY "Admins can insert affiliates"
ON public.affiliates
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins: UPDATE
CREATE POLICY "Admins can update affiliates"
ON public.affiliates
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins: DELETE
CREATE POLICY "Admins can delete affiliates"
ON public.affiliates
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins: SELECT all
CREATE POLICY "Admins can read all affiliates"
ON public.affiliates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
