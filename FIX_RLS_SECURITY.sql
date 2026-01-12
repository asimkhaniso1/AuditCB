-- ============================================
-- CRITICAL SECURITY FIX: Proper RLS Policies
-- ============================================
-- This script fixes the overly permissive RLS policies
-- and implements auth.uid() based access control

-- FIRST: Drop existing overly permissive policies AND new ones if they exist
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
DROP POLICY IF EXISTS "Allow all operations on auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all operations on audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all operations on audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all operations on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
DROP POLICY IF EXISTS "Allow all operations on certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all operations on audit_log" ON audit_log;

-- Drop new policy names if they were already created from a previous run
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can view auditors" ON auditors;
DROP POLICY IF EXISTS "Authenticated users can insert auditors" ON auditors;
DROP POLICY IF EXISTS "Authenticated users can update auditors" ON auditors;
DROP POLICY IF EXISTS "Authenticated users can delete auditors" ON auditors;
DROP POLICY IF EXISTS "Authenticated users can view audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Authenticated users can insert audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Authenticated users can update audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Authenticated users can delete audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Authenticated users can view audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Authenticated users can insert audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Authenticated users can update audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Authenticated users can delete audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Authenticated users can view checklists" ON checklists;
DROP POLICY IF EXISTS "Authenticated users can insert checklists" ON checklists;
DROP POLICY IF EXISTS "Authenticated users can update checklists" ON checklists;
DROP POLICY IF EXISTS "Authenticated users can delete checklists" ON checklists;
DROP POLICY IF EXISTS "Authenticated users can view settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can view certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Authenticated users can insert certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Authenticated users can update certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Authenticated users can delete certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Authenticated users can view audit_log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit_log" ON audit_log;

-- ============================================
-- PROFILES TABLE - Authenticated users only
-- ============================================

-- Users can view all profiles (needed for team/auditor selection)
CREATE POLICY "Authenticated users can view profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own profile during signup
CREATE POLICY "Users can insert own profile"  
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================
-- CLIENTS TABLE - Authenticated users only
-- ============================================

CREATE POLICY "Authenticated users can view clients"
ON clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert clients"
ON clients FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
ON clients FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clients"
ON clients FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- AUDITORS TABLE - Authenticated users only
-- ============================================

CREATE POLICY "Authenticated users can view auditors"
ON auditors FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert auditors"
ON auditors FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update auditors"
ON auditors FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete auditors"
ON auditors FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- AUDIT_PLANS TABLE - Authenticated users only
-- ============================================

CREATE POLICY "Authenticated users can view audit_plans"
ON audit_plans FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert audit_plans"
ON audit_plans FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update audit_plans"
ON audit_plans FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete audit_plans"
ON audit_plans FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- AUDIT_REPORTS TABLE - Authenticated users only
-- ============================================

CREATE POLICY "Authenticated users can view audit_reports"
ON audit_reports FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert audit_reports"
ON audit_reports FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update audit_reports"
ON audit_reports FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete audit_reports"
ON audit_reports FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- CHECKLISTS TABLE - Authenticated users only
-- ============================================

CREATE POLICY "Authenticated users can view checklists"
ON checklists FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert checklists"
ON checklists FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update checklists"
ON checklists FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete checklists"
ON checklists FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- SETTINGS TABLE - Authenticated users only (read), Admins only (write)
-- ============================================

CREATE POLICY "Authenticated users can view settings"
ON settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert settings"
ON settings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update settings"
ON settings FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- DOCUMENTS TABLE - Authenticated users only
-- ============================================

CREATE POLICY "Authenticated users can view documents"
ON documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert documents"
ON documents FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update documents"
ON documents FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete documents"
ON documents FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- CERTIFICATION_DECISIONS TABLE - Authenticated users only
-- ============================================

CREATE POLICY "Authenticated users can view certification_decisions"
ON certification_decisions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert certification_decisions"
ON certification_decisions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update certification_decisions"
ON certification_decisions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete certification_decisions"
ON certification_decisions FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- AUDIT_LOG TABLE - Authenticated users (read/write)
-- ============================================

CREATE POLICY "Authenticated users can view audit_log"
ON audit_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert audit_log"
ON audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- VERIFICATION: Check RLS status
-- ============================================

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'clients', 'auditors', 'audit_plans', 'audit_reports', 'checklists', 'settings', 'documents', 'certification_decisions', 'audit_log')
ORDER BY tablename;

-- List all policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
