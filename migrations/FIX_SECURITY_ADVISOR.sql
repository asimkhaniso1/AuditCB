-- ============================================
-- FIX ALL SUPABASE SECURITY ADVISOR WARNINGS
-- ============================================
-- Fully dynamic — only operates on tables that exist.
-- Safe to run multiple times on any database state.
-- Run in: Supabase SQL Editor (single script)
-- ============================================

-- ============================================
-- STEP 1: Revoke anon, enable RLS, drop old policies,
--         create auth-only policies, fix grants
-- ============================================
DO $$
DECLARE
    tbl TEXT;
    all_known_tables TEXT[] := ARRAY[
        'profiles', 'clients', 'auditors', 'audit_plans',
        'audit_reports', 'audit_findings', 'checklists', 'settings',
        'certification_decisions', 'audit_log', 'documents', 'notifications',
        'audit_ncrs', 'audit_appeals', 'audit_complaints',
        'audit_impartiality_members', 'audit_impartiality_threats',
        'audit_impartiality_meetings', 'audit_management_reviews',
        'auditor_assignments', 'api_usage_logs',
        'auditor_profiles'
    ];
    pol RECORD;
BEGIN
    FOREACH tbl IN ARRAY all_known_tables
    LOOP
        -- Skip tables that don't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            RAISE NOTICE 'Skipping % (table does not exist)', tbl;
            CONTINUE;
        END IF;

        RAISE NOTICE 'Fixing table: %', tbl;

        -- 1a. Revoke anon access
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);

        -- 1b. Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

        -- 1c. Drop ALL existing policies on this table
        FOR pol IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = tbl
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
        END LOOP;

        -- 1d. Create proper authenticated-only policies
        IF tbl = 'profiles' THEN
            -- Profiles: view all, but only insert/update own row
            EXECUTE 'CREATE POLICY "auth_select_profiles" ON public.profiles FOR SELECT TO authenticated USING (true)';
            EXECUTE 'CREATE POLICY "auth_insert_profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id)';
            EXECUTE 'CREATE POLICY "auth_update_profiles" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';

        ELSIF tbl = 'audit_log' THEN
            -- Audit log: read + insert only (no update/delete)
            EXECUTE 'CREATE POLICY "auth_select_audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true)';
            EXECUTE 'CREATE POLICY "auth_insert_audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true)';

        ELSIF tbl = 'settings' THEN
            -- Settings: no delete (single-row table)
            EXECUTE 'CREATE POLICY "auth_select_settings" ON public.settings FOR SELECT TO authenticated USING (true)';
            EXECUTE 'CREATE POLICY "auth_insert_settings" ON public.settings FOR INSERT TO authenticated WITH CHECK (true)';
            EXECUTE 'CREATE POLICY "auth_update_settings" ON public.settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';

        ELSE
            -- All other tables: full CRUD for authenticated users
            EXECUTE format('CREATE POLICY "auth_select_%s" ON public.%I FOR SELECT TO authenticated USING (true)', tbl, tbl);
            EXECUTE format('CREATE POLICY "auth_insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
            EXECUTE format('CREATE POLICY "auth_update_%s" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
            EXECUTE format('CREATE POLICY "auth_delete_%s" ON public.%I FOR DELETE TO authenticated USING (true)', tbl, tbl);
        END IF;

        -- 1e. Grant access to authenticated + service_role only
        EXECUTE format('GRANT ALL ON public.%I TO authenticated, service_role', tbl);

    END LOOP;
END $$;

-- ============================================
-- STEP 2: FIX admin_profiles_lookup VIEW
-- ============================================
-- Security Advisor flags SECURITY DEFINER views because
-- they bypass RLS. Recreate as SECURITY INVOKER.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'admin_profiles_lookup'
    ) THEN
        -- Get the view definition, then recreate without SECURITY DEFINER
        EXECUTE 'CREATE OR REPLACE VIEW public.admin_profiles_lookup
            WITH (security_invoker = true) AS ' ||
            (SELECT definition FROM pg_views
             WHERE schemaname = 'public' AND viewname = 'admin_profiles_lookup');
        RAISE NOTICE 'Fixed admin_profiles_lookup view (SECURITY INVOKER)';
    ELSE
        RAISE NOTICE 'Skipping admin_profiles_lookup (view does not exist)';
    END IF;
END $$;

-- ============================================
-- STEP 3: RELOAD POSTGREST SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
SELECT '✅ SECURITY ADVISOR FIX COMPLETE' AS status;

-- Show RLS status for all public tables
SELECT
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Show all policies
SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
