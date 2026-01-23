-- ============================================
-- FIX: Update is_admin() function to only use valid enum values
-- The role column is an ENUM type and doesn't accept lowercase variants
-- ============================================

-- Drop and recreate the is_admin() function with correct enum values
DROP FUNCTION IF EXISTS public.is_admin();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Certification Manager')  -- Only valid enum values
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- Test the function
SELECT 'Testing is_admin() function...' as step;
SELECT public.is_admin() as am_i_admin;

-- Verify current user's role
SELECT 'Current user role:' as step;
SELECT id, email, role FROM public.profiles WHERE id = auth.uid();
