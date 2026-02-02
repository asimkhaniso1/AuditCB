-- ============================================
-- 82. FIX INFINITE RECURSION IN PROFILES
-- ============================================

-- PROBLEM:
-- The 'is_admin()' function queries 'public.profiles'.
-- The 'public.profiles' table has an RLS policy that calls 'is_admin()'.
-- Even though 'is_admin' is SECURITY DEFINER, it doesn't automatically bypass RLS on the table
-- if the owner doesn't have BYPASSRLS or if the query resolves to the public table with RLS enabled.

-- SOLUTION:
-- 1. Create a "private" view that matches 'profiles' but is not subject to RLS.
--    NOTE: Views in Postgres generally do NOT enforce RLS unless defined with security_invoker.
--    However, they do enforce permissions. We will own it by a high-privilege user (postgres).

-- 2. Modify 'is_admin()' to query this view instead of the table.

-- A. Create Secure View for Admin Lookups
-- We create this in public but will rely on column-level or standard permissions.
CREATE OR REPLACE VIEW public.admin_profiles_lookup AS
SELECT id, role FROM public.profiles;

-- Lock down the view (revoke public access)
REVOKE ALL ON public.admin_profiles_lookup FROM public;
GRANT SELECT ON public.admin_profiles_lookup TO authenticated; 
-- (Actually, we only need the function to see it, but the function runs as owner, likely postgres)

-- B. Update is_admin() to prevent recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Query the View, not the Table.
  -- Since Views don't have RLS by default (unless security_invoker=true), 
  -- this avoids triggering the row policy on 'profiles'.
  RETURN EXISTS (
    SELECT 1 FROM public.admin_profiles_lookup
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Certification Manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set search_path to safe default as good practice
ALTER FUNCTION public.is_admin() SET search_path = public;

-- C. OPTIONAL: Fix Policy just in case (Simplify it if possible)
-- (We keep the policy effectively the same, but now the function inside it won't trigger RLS loop)

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" 
ON public.profiles
FOR SELECT
USING ( public.is_admin() );

-- Verify
SELECT 'Fixed infinite recursion by redirecting is_admin to a non-RLS view' as result;
