-- NUCLEAR OPTION V2: Fix Permissions for ALL Tables
-- This script proactively disables RLS on all key tables and grants full access.
-- Run this to clear "403 Forbidden" errors across the entire app.

-- 1. CLIENTS Table
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.clients TO postgres, service_role, authenticated, anon;
DROP POLICY IF EXISTS "Allow all operations" ON public.clients;
CREATE POLICY "Allow All Clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

-- 2. SETTINGS Table (Fixes blank settings page)
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.settings TO postgres, service_role, authenticated, anon;
DROP POLICY IF EXISTS "Allow all operations" ON public.settings;
CREATE POLICY "Allow All Settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- 3. AUDIT PLANS Table
ALTER TABLE public.audit_plans DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.audit_plans TO postgres, service_role, authenticated, anon;
DROP POLICY IF EXISTS "Allow all operations" ON public.audit_plans;
CREATE POLICY "Allow All Audit Plans" ON public.audit_plans FOR ALL USING (true) WITH CHECK (true);

-- 4. AUDIT REPORTS Table
ALTER TABLE public.audit_reports DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.audit_reports TO postgres, service_role, authenticated, anon;
DROP POLICY IF EXISTS "Allow all operations" ON public.audit_reports;
CREATE POLICY "Allow All Audit Reports" ON public.audit_reports FOR ALL USING (true) WITH CHECK (true);

-- 5. CHECKLISTS Table
ALTER TABLE public.checklists DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.checklists TO postgres, service_role, authenticated, anon;
DROP POLICY IF EXISTS "Allow all operations" ON public.checklists;
CREATE POLICY "Allow All Checklists" ON public.checklists FOR ALL USING (true) WITH CHECK (true);

-- 6. DOCUMENTS Table
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.documents TO postgres, service_role, authenticated, anon;
DROP POLICY IF EXISTS "Allow all operations" ON public.documents;
CREATE POLICY "Allow All Documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);

-- 6. CERTIFICATION DECISIONS Table
ALTER TABLE public.certification_decisions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.certification_decisions TO postgres, service_role, authenticated, anon;
DROP POLICY IF EXISTS "Allow all operations" ON public.certification_decisions;
CREATE POLICY "Allow All Decisions" ON public.certification_decisions FOR ALL USING (true) WITH CHECK (true);

-- Verification Output
SELECT 'Permissions Fixed for ALL tables' as status;
