-- ============================================
-- ULTIMATE FIX: RLS WITH CHECK CLAUSE FOR INSERT/UPDATE
-- The previous script was missing WITH CHECK, which is required for INSERT/UPDATE
-- ============================================

-- 1. DYNAMICALLY DROP ALL POLICIES on clients table (again)
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN (SELECT policyname FROM pg_policies WHERE tablename = 'clients' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON public.clients';
    END LOOP;
END $$;

-- 2. Verify your profile role is correctly set
UPDATE public.profiles SET role = 'Admin' WHERE role::text ILIKE 'admin';

-- 3. CREATE SIMPLE PERMISSIVE POLICY WITH BOTH USING AND WITH CHECK
-- This is the key fix: WITH CHECK is required for INSERT/UPDATE

CREATE POLICY "Admin Full Access"
ON public.clients FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('Admin', 'Certification Manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('Admin', 'Certification Manager')
    )
);

-- Auditor can only SELECT (no WITH CHECK needed for SELECT-only)
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

-- 4. VERIFICATION
SELECT 'My profile:' as info, id, email, role FROM public.profiles WHERE id = auth.uid();
SELECT 'Policy count on clients:' as info, COUNT(*) FROM pg_policies WHERE tablename = 'clients';

-- 5. TEST INSERT (to verify WITH CHECK works)
-- This should succeed if you are an Admin
INSERT INTO public.clients (id, name, status, standard)
VALUES ('99999', 'Test Client', 'Active', 'ISO 9001')
ON CONFLICT (id) DO NOTHING;

SELECT 'Test client created?' as info, id, name FROM public.clients WHERE id = '99999';

-- Clean up test
DELETE FROM public.clients WHERE id = '99999';
