-- ============================================
-- Cleanup Script: Remove Backup Tables
-- ============================================
-- Run this ONLY after you've verified the migration worked correctly
-- and tested your application thoroughly

-- ⚠️  WARNING: This will permanently delete backup tables!
-- ⚠️  Make sure you have CSV backups before running this!

-- ============================================
-- Check what backup tables exist
-- ============================================
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%backup%'
ORDER BY tablename;

-- ============================================
-- Drop backup tables (COMMENTED OUT FOR SAFETY)
-- ============================================
-- ⚠️  Uncomment these lines ONLY when you're ready to delete backups

-- Drop auditor_assignments backup
-- DROP TABLE IF EXISTS public.auditor_assignments_backup;

-- Drop any other backup tables you see above
-- DROP TABLE IF EXISTS public.profiles_backup;
-- DROP TABLE IF EXISTS public.clients_backup;

-- ============================================
-- Verification
-- ============================================
-- After dropping, verify they're gone
-- SELECT tablename 
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename LIKE '%backup%';

-- Should return no rows

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Cleanup Instructions ===';
    RAISE NOTICE '';
    RAISE NOTICE '1. Review the backup tables listed above';
    RAISE NOTICE '2. Verify your application works correctly';
    RAISE NOTICE '3. Uncomment the DROP TABLE statements';
    RAISE NOTICE '4. Run this script again to delete backups';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Only delete backups after thorough testing!';
END $$;
