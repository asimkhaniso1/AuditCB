-- ============================================
-- 79. SECURE SCHEMA & FIX SUPABASE ADVISOR ERRORS
-- ============================================

-- A. REVOKE EXCESSIVE PUBLIC PERMISSIONS
-- The 'public' role in Postgres includes unauthenticated users.
-- We must revoke generic access and rely on RLS + 'authenticated' role.

-- 1. Revoke all from public on key tables
REVOKE ALL ON public.clients FROM public;
REVOKE ALL ON public.settings FROM public;
REVOKE ALL ON public.auditor_profiles FROM public;
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.auditor_assignments FROM public;
REVOKE ALL ON public.certification_decisions FROM public;
REVOKE ALL ON public.audit_plans FROM public;

-- 2. Grant necessary usage to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditor_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditor_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certification_decisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_plans TO authenticated;

-- Also grant usage on sequences if not already valid
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- B. SECURE HELPER FUNCTIONS
-- 'SECURITY DEFINER' functions run with the privileges of the creator.
-- If search_path is not set, they can be hijacked.
-- We will alter known security definer functions to set a safe search_path.

-- (Attempting to fix common ones found in codebase)

DO $$ 
BEGIN
    -- Fix: is_admin()
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
        ALTER FUNCTION public.is_admin() SET search_path = public;
    END IF;

    -- Fix: custom_access_token_hook (if exists)
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'custom_access_token_hook') THEN
        ALTER FUNCTION public.custom_access_token_hook(jsonb) SET search_path = public;
    END IF;

    -- Fix: check_auditor_conflict (example generic name)
    -- Add others if your specific security definer functions are named differently
END $$;

-- C. ENABLE RLS ON ALL TABLES (JUST IN CASE)
-- It is a security best practice to enable RLS on all tables in public.
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auditor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auditor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.certification_decisions ENABLE ROW LEVEL SECURITY;

-- D. FIX STORAGE POLICIES TO BE SPECIFIC
-- (Supabase often flags 'public' bucket usage as a warning, but sometimes it is intended.
--  Here we ensure we don't have 'GRANT ALL' on storage.objects to public)

REVOKE ALL ON storage.objects FROM public;
-- Note: 'anon' usages for fetching public bucket files are handled by specific policies,
-- so revoking 'ALL' from the table level is correct and safe if RLS is on.

-- ============================================
-- RECOVERY INSTRUCTIONS
-- If this breaks the app (e.g. valid users can't see data), 
-- run the following to restore broad permissions:
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO public;
-- ============================================
