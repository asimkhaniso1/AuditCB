-- ============================================
-- FIX: Infinite Recursion in RLS Policies
-- ============================================

-- 1. Create SECURITY DEFINER function to bypass RLS when checking role
-- This function runs with the privileges of the creator (superuser/admin), 
-- allowing it to read the 'profiles' table even if RLS would otherwise block it or recurse.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Certification Manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update 'clients' Policy to use the function
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;

CREATE POLICY "Staff can view all clients" 
ON public.clients
FOR ALL
USING ( public.is_admin() );

-- 3. Update 'profiles' Policy as well (User Management)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" 
ON public.profiles
FOR SELECT
USING ( public.is_admin() );

-- 4. Ensure Assignments are visible to Admins too
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.auditor_assignments;

CREATE POLICY "Admins can view all assignments"
ON public.auditor_assignments
FOR ALL
USING ( public.is_admin() );
