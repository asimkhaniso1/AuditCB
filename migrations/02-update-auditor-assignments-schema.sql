-- ============================================
-- Phase 1.2: Update Auditor Assignments Schema
-- ============================================
-- This updates the auditor_assignments table to use user_id instead of auditor_id
-- IMPORTANT: This is a breaking change - backup your data first!

-- ============================================
-- STEP 1: Backup Current Data
-- ============================================
-- Create a backup table (optional but recommended)
CREATE TABLE IF NOT EXISTS public.auditor_assignments_backup AS
SELECT * FROM public.auditor_assignments;

DO $$
BEGIN
    RAISE NOTICE '✅ Backup created: auditor_assignments_backup';
END $$;

-- ============================================
-- STEP 2: Add new user_id column
-- ============================================
-- Add the new column (don't drop old one yet for safety)
ALTER TABLE public.auditor_assignments
    ADD COLUMN IF NOT EXISTS user_id TEXT;

DO $$
BEGIN
    RAISE NOTICE '✅ Added user_id column to auditor_assignments';
END $$;

-- ============================================
-- STEP 3: Migrate Data
-- ============================================
-- Copy auditor_id to user_id
-- This assumes auditor_id currently stores user IDs
-- If your auditor_id references the old auditors table, you'll need a different migration
UPDATE public.auditor_assignments
SET user_id = auditor_id
WHERE user_id IS NULL;

DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM public.auditor_assignments
    WHERE user_id IS NOT NULL;
    
    RAISE NOTICE '✅ Migrated % assignments to use user_id', migrated_count;
END $$;

-- ============================================
-- STEP 4: Create Index on new column
-- ============================================
CREATE INDEX IF NOT EXISTS idx_auditor_assignments_user_id 
    ON public.auditor_assignments(user_id);

DO $$
BEGIN
    RAISE NOTICE '✅ Created index on user_id column';
END $$;

-- ============================================
-- STEP 5: Verification
-- ============================================
-- Check data integrity
DO $$
DECLARE
    total_count INTEGER;
    user_id_count INTEGER;
    auditor_id_count INTEGER;
    mismatch_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM public.auditor_assignments;
    SELECT COUNT(*) INTO user_id_count FROM public.auditor_assignments WHERE user_id IS NOT NULL;
    SELECT COUNT(*) INTO auditor_id_count FROM public.auditor_assignments WHERE auditor_id IS NOT NULL;
    SELECT COUNT(*) INTO mismatch_count FROM public.auditor_assignments WHERE user_id != auditor_id;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Data Verification ===';
    RAISE NOTICE 'Total assignments: %', total_count;
    RAISE NOTICE 'Assignments with user_id: %', user_id_count;
    RAISE NOTICE 'Assignments with auditor_id: %', auditor_id_count;
    RAISE NOTICE 'Mismatches: %', mismatch_count;
    RAISE NOTICE '';
    
    IF user_id_count = total_count THEN
        RAISE NOTICE '✅ All assignments have user_id populated';
    ELSE
        RAISE WARNING '⚠️  Some assignments missing user_id!';
    END IF;
    
    IF mismatch_count > 0 THEN
        RAISE WARNING '⚠️  Found % assignments where user_id != auditor_id', mismatch_count;
        RAISE NOTICE 'Review these records before dropping auditor_id column';
    END IF;
END $$;

-- Show sample data for verification
SELECT 
    id,
    client_id,
    auditor_id AS old_auditor_id,
    user_id AS new_user_id,
    role,
    assigned_date,
    CASE 
        WHEN user_id = auditor_id THEN '✅ Match'
        ELSE '⚠️  Mismatch'
    END as status
FROM public.auditor_assignments
LIMIT 10;

-- ============================================
-- STEP 6: Optional Cleanup (COMMENTED OUT)
-- ============================================
-- ⚠️  ONLY run this after verifying data is correct!
-- ⚠️  Uncomment these lines when you're ready to clean up

-- Drop the old auditor_id column
-- ALTER TABLE public.auditor_assignments DROP COLUMN IF EXISTS auditor_id;

-- Drop the backup table (after confirming everything works)
-- DROP TABLE IF EXISTS public.auditor_assignments_backup;

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Migration Complete ===';
    RAISE NOTICE '✅ user_id column added';
    RAISE NOTICE '✅ Data migrated from auditor_id';
    RAISE NOTICE '✅ Index created';
    RAISE NOTICE '✅ Backup table created';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Review the verification results above';
    RAISE NOTICE '⚠️  Test your application before dropping auditor_id column';
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Update frontend code to use user_id';
END $$;
