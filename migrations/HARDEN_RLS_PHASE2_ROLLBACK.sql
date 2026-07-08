-- ============================================================
-- ROLLBACK for HARDEN_RLS_PHASE2.sql
-- ============================================================
-- Paste this into the Supabase SQL Editor and run it in ONE execution
-- (same requirement as the forward migration) if anything in the app
-- breaks after applying HARDEN_RLS_PHASE2.sql. This restores the exact
-- permissive behavior that existed before (any authenticated user can
-- select/insert/update/delete), removes the profiles role-escalation
-- guard, and drops the helper functions.
-- ============================================================

-- 1. Remove the profiles role-escalation trigger + function, and the
--    admin-can-update-any-profile policy (reverts to the original,
--    pre-migration state where only self-updates were possible).
DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_self_role_escalation();
DROP POLICY IF EXISTS "phase2_admin_update_any_profile" ON public.profiles;

-- 2. Drop the phase2 restrictive policies and restore permissive ones.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clients', 'auditors', 'audit_plans', 'audit_reports', 'checklists',
    'documents', 'audit_appeals', 'audit_complaints',
    'audit_impartiality_meetings', 'audit_impartiality_members',
    'audit_impartiality_threats', 'audit_management_reviews',
    'audit_ncrs', 'auditor_assignments', 'certification_decisions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "phase2_delete_admin_or_cm" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "rollback_delete_authenticated" ON public.%I FOR DELETE TO authenticated USING (true)',
      t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "phase2_insert_admin_or_cm" ON public.certification_decisions;
DROP POLICY IF EXISTS "phase2_update_admin_or_cm" ON public.certification_decisions;
CREATE POLICY "rollback_insert_authenticated" ON public.certification_decisions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rollback_update_authenticated" ON public.certification_decisions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "phase2_insert_admin_only" ON public.settings;
DROP POLICY IF EXISTS "phase2_update_admin_only" ON public.settings;
CREATE POLICY "rollback_insert_authenticated" ON public.settings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rollback_update_authenticated" ON public.settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3. Drop the helper functions last (no policy references them anymore).
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_admin_or_cert_manager();

-- Verify: should return zero rows (no phase2_* policies left).
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 'phase2_%';
