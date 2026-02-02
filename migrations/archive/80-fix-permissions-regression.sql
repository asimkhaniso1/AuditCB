-- ============================================
-- 80. FIX PERMISSIONS REGRESSION (Restore Read Access)
-- ============================================

-- The previous migration (79) revoked ALL from public.
-- This blocked the 'anon' role (unauthenticated users) from reading tables,
-- even if RLS policies allowed it. The backend denies access before checking RLS.

-- 1. Restore SELECT on Settings (Required for app initialization/config)
GRANT SELECT ON public.settings TO public;

-- 2. Restore SELECT on Profiles (Required for some auth flows/checks)
GRANT SELECT ON public.profiles TO public;

-- 3. Restore SELECT on Storage Objects (Required for fetching public images/logos)
-- Explicitly grant usage on the schema and select on the objects table
GRANT USAGE ON SCHEMA storage TO public;
GRANT SELECT ON storage.objects TO public;

-- 4. Ensure Authenticated role definitely has what it needs
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- Confirmation
SELECT 'Permissions restored for public read (settings, profiles, storage)' as result;
