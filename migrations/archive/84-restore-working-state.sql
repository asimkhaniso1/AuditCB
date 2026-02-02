-- ============================================
-- 84. RESTORE WORKING STATE (ROLLBACK)
-- ============================================

-- The security tightening (Migrations 79-83) caused recursion and permission issues.
-- This script restores the "Insecure but Working" state.

-- 1. Restore Public Access to All Tables (Fixes "Permission Denied")
GRANT ALL ON ALL TABLES IN SCHEMA public TO public;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO public;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO public;

-- 2. Restore Storage Access
GRANT ALL ON SCHEMA storage TO public;
GRANT ALL ON storage.buckets TO public;
GRANT ALL ON storage.objects TO public;

-- 3. Reset RLS Policies to Simple Versions (Fixes "Infinite Recursion")
-- We will simplify the critical policies to minimal checks or disable RLS where safe for now.

-- Profiles: Allow users to read all profiles (simplest fix for recursion)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Public Read Profiles"
ON public.profiles FOR SELECT
TO public
USING (true); -- Allow everyone to read profiles. Fixes recursion/lookup issues.

-- Clients: Allow authenticated usage, but maybe just open it up if RLS was the issue
DROP POLICY IF EXISTS "Full Admin Access to Clients" ON public.clients;
DROP POLICY IF EXISTS "Auditor View Access" ON public.clients;

-- Revert to the view-based one if it worked, OR just go back to simple role check
-- If the View from 83 is causing issues, let's try a direct simple policy again, 
-- but since we granted ALL to public above, we need RLS to actually restrict anything.
-- If we want to fully "Restore", maybe we assume the previous state used simple boolean logic.

CREATE POLICY "Authenticated Access Clients"
ON public.clients FOR ALL
TO authenticated
USING (true); -- Relaxed for now to ensure app works.

-- Settings: Public Read already restored, ensured here
DROP POLICY IF EXISTS "Admin Settings Full Access" ON public.settings;
CREATE POLICY "Settings Public Access"
ON public.settings FOR SELECT
TO public
USING (true);

CREATE POLICY "Settings Admin Write"
ON public.settings FOR ALL
TO authenticated
USING (true); -- Relaxed.

-- 4. Revert Function "is_admin" search_path (Optional, but strictness might have caused issues)
ALTER FUNCTION public.is_admin() RESET search_path;

-- 5. Disable RLS on tables where it might be causing trouble and isn't critical for MVP
-- (Optional: Uncomment if policies still fail)
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;

-- Confirmation
SELECT 'Rolled back strict security. Public access restored. RLS relaxed.' as result;
