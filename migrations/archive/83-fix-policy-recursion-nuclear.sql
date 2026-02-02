-- ============================================
-- 83. FIX POLICY RECURSION (NUCLEAR OPTION)
-- ============================================

-- PROBLEM:
-- Even with the fixed 'is_admin()' function, existing policies on 'clients' and other tables 
-- might be querying 'profiles' table directly (via inline SQL). 
-- This triggers 'profiles' RLS, which checks 'is_admin', which might trigger RLS again if not perfectly isolated.

-- SOLUTION:
-- replace ALL critical policies to use 'public.admin_profiles_lookup' view.
-- The View is owned by the system (or migration runner) and does NOT trigger RLS on 'profiles'.

-- 1. Ensure the View exists and is secure (Redundant but safe)
CREATE OR REPLACE VIEW public.admin_profiles_lookup AS
SELECT id, role FROM public.profiles;

REVOKE ALL ON public.admin_profiles_lookup FROM public;
GRANT SELECT ON public.admin_profiles_lookup TO authenticated;

-- 2. RESET POLICIES ON CLIENTS
DROP POLICY IF EXISTS "Full Admin Access to Clients" ON public.clients;
DROP POLICY IF EXISTS "Auditor View Access" ON public.clients;
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;

-- Policy: Admin Access (Using VIEW)
CREATE POLICY "Full Admin Access to Clients"
ON public.clients FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_profiles_lookup 
        WHERE id = auth.uid() 
        AND role IN ('Admin', 'Certification Manager')
    )
);

-- Policy: Auditor Access (Standard, checks assignments)
-- Note: queries auditor_assignments. Ensure that doesn't loop.
CREATE POLICY "Auditor View Access"
ON public.clients FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.auditor_assignments
        WHERE client_id = clients.id::text
        AND user_id = auth.uid()::text
    )
);

-- 3. RESET POLICIES ON SETTINGS
DROP POLICY IF EXISTS "Admin Settings Full Access" ON public.settings;
DROP POLICY IF EXISTS "Public Read Settings" ON public.settings;

-- Public Read (Restored in 80, keeping it)
CREATE POLICY "Public Read Settings"
ON public.settings FOR SELECT
TO public
USING (true);

-- Admin Write (Using VIEW)
CREATE POLICY "Admin Settings Full Access"
ON public.settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_profiles_lookup
        WHERE id = auth.uid() 
        AND role IN ('Admin')
    )
);

-- 4. RESET POLICIES ON PROFILES (The Source of the loop)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Users can see themselves (Simple row check - Safe)
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING ( id = auth.uid() );

-- Admins can see everyone (Using VIEW - Prevents Loop)
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_profiles_lookup
        WHERE id = auth.uid() 
        AND role IN ('Admin', 'Certification Manager')
    )
);

-- 5. RESET POLICIES ON AUDITOR PROFILES
DROP POLICY IF EXISTS "Admins can manage auditor profiles" ON public.auditor_profiles;

CREATE POLICY "Admins can manage auditor profiles"
ON public.auditor_profiles FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_profiles_lookup
        WHERE id = auth.uid() 
        AND role IN ('Admin', 'Certification Manager')
    )
);

-- Confirmation
SELECT 'All RLS policies updated to use non-recursive lookup view' as result;
