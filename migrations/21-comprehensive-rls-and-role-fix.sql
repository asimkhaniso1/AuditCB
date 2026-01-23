-- ============================================
-- MIGRATION 21: COMPREHENSIVE RLS AND ROLE FIX
-- ============================================
-- This script fixes client visibility and write access for administrators
-- by normalizing roles and simplifying RLS policies.

-- 1. NORMALIZE ROLES in profiles table
-- Ensure all admin-like users have standard casing
UPDATE public.profiles 
SET role = 'Admin' 
WHERE role::text ILIKE 'admin';

UPDATE public.profiles 
SET role = 'Certification Manager' 
WHERE role::text ILIKE 'certification manager' OR role::text ILIKE 'certification_manager';

-- 2. REDEFINE is_admin() function
-- Make it robust and case-insensitive
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role::text INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    RETURN user_role IN (
        'Admin',
        'admin',
        'Certification Manager',
        'certification manager',
        'certification_manager',
        'Super Admin',
        'super_admin'
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- 3. RESET CLIENT RLS POLICIES
-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow staff to view all clients" ON public.clients;
DROP POLICY IF EXISTS "Allow auditors to view assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Public can view clients" ON public.clients;

-- Policy: Administrators see everything
CREATE POLICY "Admins have full access to clients"
ON public.clients FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy: Auditors see assigned clients (SELECT ONLY)
CREATE POLICY "Auditors can view assigned clients"
ON public.clients FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.auditor_assignments
        WHERE client_id = clients.id::text
        AND (user_id = auth.uid()::text OR auditor_id IN (
            SELECT id::text FROM public.auditors WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        ))
    )
);

-- 4. RESET SETTINGS RLS POLICIES
DROP POLICY IF EXISTS "Allow everyone to view settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Allow public to view settings" ON public.settings;
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON public.settings;

-- Policy: Everyone can read settings (needed for logo/branding on login)
CREATE POLICY "Public read access to settings"
ON public.settings FOR SELECT
USING (true);

-- Policy: Admins can manage settings
CREATE POLICY "Admins can manage settings"
ON public.settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. FINAL DIAGNOSTIC
SELECT 'Role distribution:' as info, role, COUNT(*) FROM public.profiles GROUP BY role;
SELECT 'Current user is admin?' as info, public.is_admin() as result;
SELECT 'Visible clients count:' as info, COUNT(*) FROM public.clients;
