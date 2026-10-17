-- ============================================================
-- SECURE ROLE SOURCE
-- ============================================================
-- Authorization must never read auth.jwt() -> 'user_metadata': any user can
-- write their own user_metadata (at signUp, or later via auth.updateUser()),
-- so a policy keyed on it lets anyone grant themselves a role.
--
-- This migration:
--   1. (Re)creates the profiles-based role helpers is_admin() and
--      is_admin_or_cert_manager() — identical to HARDEN_RLS_PHASE2.sql, so
--      this file does not depend on that one having been run.
--   2. Replaces the certification_lifecycle_events INSERT policy from
--      ADD_CERTIFICATION_LIFECYCLE_AND_PLAN_SNAPSHOTS.sql (which trusted
--      user_metadata.role) with public.is_admin_or_cert_manager().
--      NOTE: the old policy also admitted 'Lead Auditor'. Nothing in the app
--      writes this table yet; widen the check deliberately if Lead Auditors
--      need to append lifecycle events.
--   3. Lets the service role through the profiles self-escalation trigger,
--      so the admin-only invite-user edge function can set the invited
--      user's role (auth.uid() is NULL for service-role calls, so the trigger
--      previously forced every invited user to 'Auditor').
--   4. Warns about any other policy in the public or storage schemas that
--      still reads user_metadata (review and fix those by hand).
--
-- Idempotent. Run in the Supabase SQL editor; NOT applied automatically.
-- ============================================================

BEGIN;

-- 1. Role helpers ------------------------------------------------------------

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

-- 2. Lifecycle events INSERT policy -----------------------------------------

DO $$
BEGIN
  IF to_regclass('public.certification_lifecycle_events') IS NULL THEN
    RAISE NOTICE 'certification_lifecycle_events does not exist — skipping its policy';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "Authorized roles append certification lifecycle" ON public.certification_lifecycle_events';
  EXECUTE 'CREATE POLICY "Authorized roles append certification lifecycle"
             ON public.certification_lifecycle_events FOR INSERT TO authenticated
             WITH CHECK (public.is_admin_or_cert_manager())';
END $$;

-- 3. Self-escalation trigger: allow the service role ------------------------

DO $$
BEGIN
  IF to_regprocedure('public.prevent_self_role_escalation()') IS NULL THEN
    RAISE NOTICE 'prevent_self_role_escalation() not installed (HARDEN_RLS_PHASE2.sql not run) — skipping';
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    BEGIN
      -- Service-role writes (edge functions) are already fully privileged;
      -- invite-user checks is_admin() on the caller before writing.
      IF auth.role() = 'service_role' THEN
        RETURN NEW;
      END IF;

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
    $body$;
  $fn$;
END $$;

-- 4. No policy may read user_metadata ---------------------------------------

DO $$
DECLARE
  offenders text;
BEGIN
  SELECT string_agg(format('%I.%I: %I', schemaname, tablename, policyname), E'\n')
    INTO offenders
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage')
    AND (coalesce(qual, '') ILIKE '%user_metadata%'
         OR coalesce(with_check, '') ILIKE '%user_metadata%');

  IF offenders IS NOT NULL THEN
    RAISE WARNING 'Policies still trust user_metadata — review and replace with is_admin()/is_admin_or_cert_manager():%', E'\n' || offenders;
  END IF;
END $$;

COMMIT;

-- Verify
SELECT schemaname, tablename, policyname, cmd, roles, with_check
FROM pg_policies
WHERE tablename = 'certification_lifecycle_events';
