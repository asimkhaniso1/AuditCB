# 🛡️ Manual Fix: Apply RLS Security Policies

Since I cannot directly execute SQL commands against your production Supabase database for security reasons, you need to apply the fix manually. This will resolve the permission issues blocking your access.

## Step 1: Fix Connection Configuration (Already Applied ✅)
I have updated `supabase-config.js` to ignore invalid URLs (like `audit.companycertification.com`) in localStorage. This forces the app to use the correct `supabase.co` URL.

## Step 2: Apply SQL Fix
1.  **Login** to your [Supabase Dashboard](https://supabase.com/dashboard).
2.  Select your project (`dfzisgfpstrsyncfsxyb`).
3.  Go to the **SQL Editor** (icon on the left sidebar).
4.  Click **"New Query"**.
5.  **Open** the file `APPLY_RLS_FIX.sql` I just created for you.
6.  **Copy and Paste** the content of that file (it is pure SQL, no markdown).
7.  Click **"Run"** (bottom right).

> **Note:** The error you saw earlier was because the `#` character is not valid in SQL (it was part of the Markdown instructions). Using the clean `APPLY_RLS_FIX.sql` file will prevent this.
-- ============================================
-- CRITICAL SECURITY FIX: Proper RLS Policies
-- ============================================

-- FIRST: Drop existing overly permissive policies
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

-- Drop previous iterative policies if they exist
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
-- PROFILES & AUTH
-- ============================================

CREATE POLICY "Authenticated users can view profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================
-- DATA TABLES (Authenticated Access)
-- ============================================

-- CLIENTS
CREATE POLICY "Authenticated users can view clients" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete clients" ON clients FOR DELETE TO authenticated USING (true);

-- AUDITORS
CREATE POLICY "Authenticated users can view auditors" ON auditors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert auditors" ON auditors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update auditors" ON auditors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete auditors" ON auditors FOR DELETE TO authenticated USING (true);

-- AUDIT PLANS
CREATE POLICY "Authenticated users can view audit_plans" ON audit_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit_plans" ON audit_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update audit_plans" ON audit_plans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete audit_plans" ON audit_plans FOR DELETE TO authenticated USING (true);

-- AUDIT REPORTS
CREATE POLICY "Authenticated users can view audit_reports" ON audit_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit_reports" ON audit_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update audit_reports" ON audit_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete audit_reports" ON audit_reports FOR DELETE TO authenticated USING (true);

-- CHECKLISTS
CREATE POLICY "Authenticated users can view checklists" ON checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert checklists" ON checklists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update checklists" ON checklists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete checklists" ON checklists FOR DELETE TO authenticated USING (true);

-- SETTINGS
CREATE POLICY "Authenticated users can view settings" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update settings" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- DOCUMENTS
CREATE POLICY "Authenticated users can view documents" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert documents" ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update documents" ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete documents" ON documents FOR DELETE TO authenticated USING (true);

-- CERTIFICATION DECISIONS
CREATE POLICY "Authenticated users can view certification_decisions" ON certification_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert certification_decisions" ON certification_decisions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update certification_decisions" ON certification_decisions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete certification_decisions" ON certification_decisions FOR DELETE TO authenticated USING (true);

-- AUDIT LOG
CREATE POLICY "Authenticated users can view audit_log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit_log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Verify
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('clients', 'auditors', 'audit_plans');
```

## Step 3: Verify Connection
After running the SQL:
1.  Refresh your application page.
2.  Wait for the page to reload (the `supabase-config.js` fix should take effect).
3.  Changes should be immediate.
