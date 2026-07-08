-- ============================================================
-- PHASE 2: SERVER-SIDE AUTHORIZATION HARDENING
-- ============================================================
-- Context: every RLS policy in this project was USING(true)/WITH CHECK(true)
-- for any authenticated user — authorization existed only client-side in
-- auth-manager.js. This migration closes the unambiguous holes:
--   1. DELETE is restricted to Admin/Certification Manager on data tables.
--   2. certification_decisions writes (insert/update/delete) are restricted
--      to Admin/Certification Manager.
--   3. settings writes (insert/update) are restricted to Admin only.
--   4. profiles gets a trigger blocking self role-escalation (today, a user
--      can UPDATE their own profiles.role to 'Admin' — no column check
--      exists on the current policy).
--
-- SELECT/INSERT/UPDATE on ordinary data tables are intentionally left as
-- "any authenticated user" — identical to today — so no existing workflow
-- can start failing. Per-auditor "assigned only" row-scoping is explicitly
-- deferred (see plan notes) because the data model (TEXT ids, JSONB
-- auditor arrays, email-based user<->auditor linking) makes it fragile to
-- get right in one pass, which is what forced the previous rollback
-- (see migrations/APPLY_RLS_FIX.sql history).
--
-- NOTE ON POLICY NAMES: the actual live policy names on this project
-- (auth_select_<table>, auth_insert_<table>, etc.) do not match ANY of the
-- naming conventions used across this messy migrations/ history ("Enable
-- delete for authenticated users", "Authenticated users can delete X",
-- "Allow all operations on X") — meaning at least one more change was
-- applied directly via the SQL editor and never saved to a file. Rather
-- than guess a policy name to DROP, every DROP below enumerates and drops
-- ALL existing policies for the affected table+command via pg_policies,
-- so this is correct regardless of what the live policy happens to be
-- named (including a combined "FOR ALL" policy, which is also handled).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER to avoid recursive RLS
--    evaluation when a profiles-table policy needs to read profiles;
--    SET search_path pins the function against search_path hijacking,
--    per Supabase's security advisor guidance for SECURITY DEFINER fns).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_cert_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('Admin', 'Certification Manager')
  );
$$;

-- ------------------------------------------------------------
-- 2. Generic helper: drop every existing policy for a given
--    table + command (handles 'ALL' policies too, since those
--    also grant the command in question).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION pg_temp.drop_policies_for(p_table text, p_cmd text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
      AND cmd IN (p_cmd, 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- 3. DELETE -> Admin/Certification Manager only, on every data table.
--    (Matches the app's own permission matrix in settings-module.js,
--    where only Admin/Certification Manager have 'full' access —
--    every other role is view/partial/assigned/own, none of which
--    include delete in the UI.)
-- ------------------------------------------------------------

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clients', 'auditors', 'audit_plans', 'audit_reports', 'checklists',
    'documents', 'audit_appeals', 'audit_complaints',
    'audit_impartiality_meetings', 'audit_impartiality_members',
    'audit_impartiality_threats', 'audit_management_reviews',
    'audit_ncrs', 'auditor_assignments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    PERFORM pg_temp.drop_policies_for(t, 'DELETE');
    EXECUTE format('DROP POLICY IF EXISTS "phase2_delete_admin_or_cm" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "phase2_delete_admin_or_cm" ON public.%I FOR DELETE TO authenticated USING (public.is_admin_or_cert_manager())',
      t
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4. certification_decisions: writes restricted to Admin/Cert Manager.
--    SELECT is untouched (stays open to authenticated).
-- ------------------------------------------------------------

SELECT pg_temp.drop_policies_for('certification_decisions', 'INSERT');
SELECT pg_temp.drop_policies_for('certification_decisions', 'UPDATE');
SELECT pg_temp.drop_policies_for('certification_decisions', 'DELETE');

DROP POLICY IF EXISTS "phase2_insert_admin_or_cm" ON public.certification_decisions;
DROP POLICY IF EXISTS "phase2_update_admin_or_cm" ON public.certification_decisions;
DROP POLICY IF EXISTS "phase2_delete_admin_or_cm" ON public.certification_decisions;

CREATE POLICY "phase2_insert_admin_or_cm" ON public.certification_decisions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_cert_manager());

CREATE POLICY "phase2_update_admin_or_cm" ON public.certification_decisions
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_cert_manager())
  WITH CHECK (public.is_admin_or_cert_manager());

CREATE POLICY "phase2_delete_admin_or_cm" ON public.certification_decisions
  FOR DELETE TO authenticated USING (public.is_admin_or_cert_manager());

-- ------------------------------------------------------------
-- 5. settings: writes restricted to Admin only. SELECT untouched.
-- ------------------------------------------------------------

SELECT pg_temp.drop_policies_for('settings', 'INSERT');
SELECT pg_temp.drop_policies_for('settings', 'UPDATE');

DROP POLICY IF EXISTS "phase2_insert_admin_only" ON public.settings;
DROP POLICY IF EXISTS "phase2_update_admin_only" ON public.settings;

CREATE POLICY "phase2_insert_admin_only" ON public.settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "phase2_update_admin_only" ON public.settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 6. audit_log: verified it already has only SELECT/INSERT policies
--    (no UPDATE/DELETE policy exists), and Postgres RLS default-denies
--    any command with no matching policy — so it's already append-only.
--    No change made here; this is a documented verification, not a skip.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 7. profiles: block self role-escalation. A user may still update
--    their own other profile fields (name, avatar, etc.) — only the
--    role column is protected, and only reverted (not rejected), so a
--    request that changes both role and an unrelated field doesn't
--    fail outright, it just doesn't get to change the role.
--
--    KNOWN EDGE CASE TO VERIFY: settings-users.js creates a new user by
--    calling supabase.auth.signUp() then directly upserting into
--    `profiles` with the chosen role (e.g. 'Lead Auditor'), from the
--    browser, while the ADMIN is (usually) still the active session. If
--    this Supabase project auto-confirms email and signUp() swaps the
--    browser's active session to the brand-new user before the profile
--    upsert runs, auth.uid() during that INSERT would be the new user's
--    own id (which has no existing profile row yet) rather than the
--    admin's — and this trigger would force their role to 'Auditor'
--    instead of the intended role. TEST THIS EXPLICITLY: create a new
--    user with a non-default role (e.g. Lead Auditor) via Settings ->
--    Users after applying this migration, and confirm the role actually
--    sticks. If it gets silently downgraded to Auditor, that's this edge
--    case firing — flag it and we'll adjust (e.g. move new-user creation
--    to the existing supabase/functions/invite-user edge function, which
--    already exists but does not appear to be wired up from the UI).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin') THEN
      NEW.role := OLD.role;
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'Auditor'::app_role THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin') THEN
      NEW.role := 'Auditor';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

-- ------------------------------------------------------------
-- 8. ADDED DURING VERIFICATION (not in the original plan): the
--    pre-existing "Users can update own profile" policy
--    (USING (auth.uid() = id), from APPLY_RLS_FIX.sql, untouched by
--    this migration) only ever allowed a user to update THEIR OWN
--    row. There was no policy letting an Admin update someone else's
--    profile — meaning Settings -> Users "edit user role" has likely
--    never worked end-to-end through the app's normal client calls
--    (RLS silently filters the target row out: 0 rows affected, no
--    error). This is a pre-existing gap, not something this migration
--    introduced, but it blocks legitimate admin user-management, so
--    it's fixed here alongside the rest of the profiles hardening.
--    The self-role-escalation trigger above still protects against a
--    non-admin editing their OWN role even though this policy exists,
--    since the trigger checks the ACTING user's own current role
--    regardless of which policy let the UPDATE through.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "phase2_admin_update_any_profile" ON public.profiles;
CREATE POLICY "phase2_admin_update_any_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'phase2_%'
ORDER BY tablename, cmd;
