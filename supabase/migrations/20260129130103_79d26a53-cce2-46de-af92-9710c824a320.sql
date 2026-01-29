
-- Create a debug function to log auth.uid() issues
CREATE OR REPLACE FUNCTION public.debug_auth_uid()
RETURNS TABLE(current_uid uuid, is_authenticated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT 
    auth.uid() as current_uid,
    (auth.uid() IS NOT NULL) as is_authenticated;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.debug_auth_uid() TO authenticated;
