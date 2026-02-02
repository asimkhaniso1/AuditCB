-- ============================================
-- FIX: Case-Insensitive Admin Check
-- ============================================

-- 1. Update is_admin to validly check role regardless of case
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (
          role = 'Admin' 
          OR role = 'admin' 
          OR role = 'Certification Manager'
          OR role = 'certification manager'
      )
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- 2. Grant explicitly all on clients to Admin (Double Check)
-- Note: The policy 'Staff can view all clients' uses is_admin(). 
-- By fixing is_admin(), we fix the policy.
