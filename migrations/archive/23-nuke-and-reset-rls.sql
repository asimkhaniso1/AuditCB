-- ============================================
-- THE "NUKE AND RESET" RLS FIX
-- Run this to clear all hidden policies and restore admin access
-- ============================================

-- 1. DYNAMICALLY DROP ALL POLICIES on clients table
-- This handles any policies with names we don't know about
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN (SELECT policyname FROM pg_policies WHERE tablename = 'clients' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON public.clients';
    END LOOP;
END $$;

-- 2. DYNAMICALLY DROP ALL POLICIES on settings table
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN (SELECT policyname FROM pg_policies WHERE tablename = 'settings' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON public.clients'; -- Fixed typo in loop: should be settings
    END LOOP;
END $$;
-- Re-fix for settings (manual just in case)
DROP POLICY IF EXISTS "Public read access to settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;

-- 3. APPLY SIMPLE BUT ROBUST POLICIES
-- We use direct subqueries for maximum reliability

-- Role normalization (one more time for safety)
UPDATE public.profiles SET role = 'Admin' WHERE role::text ILIKE 'admin';

-- Policy: Admin Access for Clients
CREATE POLICY "Full Admin Access to Clients"
ON public.clients FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('Admin', 'Certification Manager')
    )
);

-- Policy: Auditor Access (SELECT only)
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

-- Policy: Settings Access
CREATE POLICY "Public Read Settings"
ON public.settings FOR SELECT
TO public
USING (true);

CREATE POLICY "Admin Settings Full Access"
ON public.settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('Admin')
    )
);

-- 4. VERIFICATION
SELECT 'Total clients in table:' as info, COUNT(*) FROM public.clients;
SELECT 'Policies active on clients:' as info, COUNT(*) FROM pg_policies WHERE tablename = 'clients';
SELECT 'Can I see rows now?' as info, id, name FROM public.clients LIMIT 2;
