-- ============================================
-- REFINED RLS POLICIES FOR DATA ISOLATION
-- ============================================
-- This script implements proper security based on Auditor-Client assignments.

-- 1. HELPER FUNCTIONS
-- --------------------------------------------

-- Function to check if current user is Admin or Certification Manager
CREATE OR REPLACE FUNCTION public.is_admin_or_cert_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('Admin', 'Certification Manager')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get the auditor_id for the current user (from auditors table)
CREATE OR REPLACE FUNCTION public.get_my_auditor_id()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT id FROM public.auditors WHERE email = auth.email() LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. RESET POLICIES
-- --------------------------------------------
-- (Drop existing permissive policies)
DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'ALTER TABLE public.' || t || ' ENABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- 3. PROFILES POLICIES
-- --------------------------------------------
DROP POLICY IF EXISTS "Profiles visibility" ON public.profiles;
CREATE POLICY "Profiles visibility" ON public.profiles
FOR SELECT TO authenticated
USING (true); -- Keep public for now as auditors need to see teammates

DROP POLICY IF EXISTS "Profiles self-update" ON public.profiles;
CREATE POLICY "Profiles self-update" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id);

-- 4. CLIENTS POLICIES
-- --------------------------------------------
DROP POLICY IF EXISTS "Clients access" ON public.clients;
CREATE POLICY "Clients access" ON public.clients
FOR ALL TO authenticated
USING (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id::TEXT = get_my_auditor_id()::TEXT 
    AND client_id::TEXT = public.clients.id::TEXT
  )
)
WITH CHECK (
  is_admin_or_cert_manager()
);

-- 5. AUDITORS POLICIES
-- --------------------------------------------
DROP POLICY IF EXISTS "Auditors access" ON public.auditors;
CREATE POLICY "Auditors access" ON public.auditors
FOR ALL TO authenticated
USING (
  is_admin_or_cert_manager() OR 
  email = auth.email() -- Can see own
  OR true -- Temporary: Allow auditors to see all auditors (directory view)
)
WITH CHECK (
  is_admin_or_cert_manager()
);

-- 6. AUDIT_PLANS POLICIES
-- --------------------------------------------
DROP POLICY IF EXISTS "Audit plans access" ON public.audit_plans;
CREATE POLICY "Audit plans access" ON public.audit_plans
FOR ALL TO authenticated
USING (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id::TEXT = get_my_auditor_id()::TEXT 
    AND client_id::TEXT = public.audit_plans.client_id::TEXT
  )
)
WITH CHECK (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id::TEXT = get_my_auditor_id()::TEXT 
    AND client_id::TEXT = public.audit_plans.client_id::TEXT
  )
);

-- 7. AUDIT_REPORTS POLICIES
-- --------------------------------------------
DROP POLICY IF EXISTS "Audit reports access" ON public.audit_reports;
CREATE POLICY "Audit reports access" ON public.audit_reports
FOR ALL TO authenticated
USING (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id::TEXT = get_my_auditor_id()::TEXT 
    AND client_id::TEXT = public.audit_reports.client_id::TEXT
  )
)
WITH CHECK (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id::TEXT = get_my_auditor_id()::TEXT 
    AND client_id::TEXT = public.audit_reports.client_id::TEXT
  )
);

-- 8. AUDITOR_ASSIGNMENTS POLICIES
-- --------------------------------------------
DROP POLICY IF EXISTS "Auditor assignments access" ON public.auditor_assignments;
CREATE POLICY "Auditor assignments access" ON public.auditor_assignments
FOR SELECT TO authenticated
USING (
  is_admin_or_cert_manager() OR 
  auditor_id::TEXT = get_my_auditor_id()::TEXT
);

DROP POLICY IF EXISTS "Auditor assignments manage" ON public.auditor_assignments ;
CREATE POLICY "Auditor assignments manage" ON public.auditor_assignments 
FOR ALL TO authenticated
USING (is_admin_or_cert_manager())
WITH CHECK (is_admin_or_cert_manager());

-- 9. CHECKLISTS POLICIES
-- --------------------------------------------
DROP POLICY IF EXISTS "Checklists access" ON public.checklists;
CREATE POLICY "Checklists access" ON public.checklists
FOR SELECT TO authenticated
USING (true); -- Checklists are generally shared

DROP POLICY IF EXISTS "Checklists manage" ON public.checklists;
CREATE POLICY "Checklists manage" ON public.checklists
FOR ALL TO authenticated
USING (is_admin_or_cert_manager())
WITH CHECK (is_admin_or_cert_manager());

-- 10. SETTINGS POLICIES
-- --------------------------------------------
DROP POLICY IF EXISTS "Settings access" ON public.settings;
CREATE POLICY "Settings access" ON public.settings
FOR SELECT TO authenticated
USING (true); -- Read-only for most

DROP POLICY IF EXISTS "Settings manage" ON public.settings;
CREATE POLICY "Settings manage" ON public.settings
FOR ALL TO authenticated
USING (is_admin_or_cert_manager())
WITH CHECK (is_admin_or_cert_manager());

-- 11. DOCUMENTS POLICIES
-- --------------------------------------------
-- Note: Documents often linked to clients
DROP POLICY IF EXISTS "Documents access" ON public.documents;
-- For now, keep simple or link to client_id if added later
CREATE POLICY "Documents access" ON public.documents
FOR ALL TO authenticated
USING (true);

-- RELOAD CACHE
NOTIFY pgrst, 'reload schema';
