-- ENSURE_CHECKLISTS_SYNC_AND_POLICIES.sql
-- Context: sign-in on audit360.isoxpert.com logs
--   "[WARN] Full checklist sync returned 0 rows but 15 exist locally"
-- Root cause was client-side: the bulk checklist push in data-service.js
-- called syncChecklistsToSupabase() with no argument, which silently
-- no-oped, so the checklists table was never seeded from the local library.
-- The JS fix (supabase-client.js / data-service.js) now pushes the local
-- library up on the next sign-in. This migration makes the DB side of that
-- path verifiable and self-consistent:
--
--   1. Columns the client push/pull maps must exist (archived, audit_type,
--      audit_scope, client_name, client_id) — without them the bulk upsert
--      returns 400 and the heal never lands. (Re-issues
--      ADD_CHECKLIST_AUDIT_AND_CLIENT_FIELDS.sql in case prod missed it.)
--   2. RLS is enabled and SELECT/INSERT/UPDATE policies for authenticated
--      exist. Policies are only created if MISSING for their command —
--      nothing existing is dropped or weakened, so an already-correct DB is
--      untouched. Expected live set after FIX_SECURITY_ADVISOR.sql +
--      HARDEN_RLS_PHASE2.sql: auth_select/auth_insert/auth_update_checklists
--      plus phase2_delete_admin_or_cm.
--   3. DELETE: if no delete policy survives, the Phase-2 admin/cert-manager
--      policy is recreated — never USING(true), which would undo the
--      HARDEN_RLS_PHASE2 hardening.
--
-- Idempotent: safe to re-run. No data loss.

-- ------------------------------------------------------------
-- 1. Columns required by the client mapping
-- ------------------------------------------------------------
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS archived    boolean DEFAULT false;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS audit_type  text;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS audit_scope text;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS client_id   text;

-- ------------------------------------------------------------
-- 2. RLS enabled + grants (authenticated only, no anon)
-- ------------------------------------------------------------
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checklists FROM anon;
GRANT ALL ON public.checklists TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Create SELECT / INSERT / UPDATE policies only where the
--    command has NO policy at all (an 'ALL' policy also counts
--    as covering the command, matching Postgres semantics).
-- ------------------------------------------------------------
DO $$
DECLARE
    p_cmd text;
BEGIN
    FOREACH p_cmd IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'checklists'
              AND cmd IN (p_cmd, 'ALL')
        ) THEN
            IF p_cmd = 'SELECT' THEN
                EXECUTE 'CREATE POLICY "auth_select_checklists" ON public.checklists FOR SELECT TO authenticated USING (true)';
            ELSIF p_cmd = 'INSERT' THEN
                EXECUTE 'CREATE POLICY "auth_insert_checklists" ON public.checklists FOR INSERT TO authenticated WITH CHECK (true)';
            ELSE
                EXECUTE 'CREATE POLICY "auth_update_checklists" ON public.checklists FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
            END IF;
            RAISE NOTICE 'checklists: created missing % policy', p_cmd;
        ELSE
            RAISE NOTICE 'checklists: % policy already present — untouched', p_cmd;
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4. DELETE stays Admin/Certification Manager only
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'checklists'
          AND cmd IN ('DELETE', 'ALL')
    ) THEN
        IF to_regproc('public.is_admin_or_cert_manager') IS NOT NULL THEN
            CREATE POLICY "phase2_delete_admin_or_cm" ON public.checklists
                FOR DELETE TO authenticated USING (public.is_admin_or_cert_manager());
            RAISE NOTICE 'checklists: recreated phase2 DELETE policy';
        ELSE
            -- No helper function means HARDEN_RLS_PHASE2 was never applied.
            -- Leave DELETE default-denied rather than opening it to everyone.
            RAISE NOTICE 'checklists: no DELETE policy and is_admin_or_cert_manager() missing — DELETE stays denied; run HARDEN_RLS_PHASE2.sql';
        END IF;
    ELSE
        RAISE NOTICE 'checklists: DELETE policy already present — untouched';
    END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Reload PostgREST schema cache (new columns)
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verification (SQL editor runs as postgres, so the count below
-- bypasses RLS — it is the TRUE row count. If it shows 0 before
-- the app's next sign-in, the table really was never seeded and
-- the client-side heal will populate it.)
-- ------------------------------------------------------------
SELECT COUNT(*) AS checklists_row_count FROM public.checklists;

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'checklists'
ORDER BY cmd, policyname;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'checklists'
ORDER BY ordinal_position;
