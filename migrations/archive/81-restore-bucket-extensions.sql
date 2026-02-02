-- ============================================
-- 81. RESTORE BUCKET LISTING & EXTENSIONS
-- ============================================

-- The console errors are likely due to the JS client trying to list buckets
-- or generate UUIDs/crypto hashes using extensions that we inadvertently locked.

-- 1. Restore Access to Storage Buckets Table
-- The client often checks 'storage.buckets' to see if a bucket exists.
GRANT SELECT ON storage.buckets TO public;

-- 2. Restore Execute on Common Extensions (uuid-ossp, pgcrypto)
-- If these are in a separate schema (like 'extensions'), we need usage there.
-- If they are in public (which is common in some setups), we need EXECUTE.

GRANT USAGE ON SCHEMA extensions TO public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO public;

-- If installed in public:
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO public;

-- 3. Restore Access to 'auditor_assignments' for RLS checks
-- If you have RLS policies that do Lookups on other tables (like auditor_assignments),
-- the user needs SELECT permission on that table even if they can't see the rows directly,
-- otherwise the RLS query itself throws a permission denied error.

GRANT SELECT ON public.auditor_assignments TO public;
GRANT SELECT ON public.clients TO public; -- Needed if RLS policies join to clients

-- 4. Re-verify Sequence Access (for Insert)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO public;

-- Confirmation
SELECT 'Restored access to buckets, extensions, and lookup tables for RLS' as result;
