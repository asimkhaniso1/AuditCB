-- ============================================
-- Pre-Migration Check Script
-- ============================================
-- Run this BEFORE executing the migration scripts
-- This helps you understand what data will be migrated

-- ============================================
-- 1. Check Current Tables
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING EXISTING TABLES ===';
    RAISE NOTICE '';
END $$;

-- Check if tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (
    VALUES 
        ('profiles'),
        ('auditors'),
        ('auditor_assignments'),
        ('auditor_profiles'),
        ('clients')
) AS t(table_name);

-- ============================================
-- 2. Check Existing Data Counts
-- ============================================
DO $$
DECLARE
    profile_count INTEGER;
    auditor_count INTEGER;
    assignment_count INTEGER;
    client_count INTEGER;
    auth_user_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CURRENT DATA COUNTS ===';
    RAISE NOTICE '';
    
    -- Count profiles
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    RAISE NOTICE 'Profiles: %', profile_count;
    
    -- Count auditors (if table exists)
    BEGIN
        SELECT COUNT(*) INTO auditor_count FROM public.auditors;
        RAISE NOTICE 'Auditors: %', auditor_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE 'Auditors: 0 (table does not exist)';
            auditor_count := 0;
    END;
    
    -- Count assignments
    BEGIN
        SELECT COUNT(*) INTO assignment_count FROM public.auditor_assignments;
        RAISE NOTICE 'Auditor Assignments: %', assignment_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE 'Auditor Assignments: 0 (table does not exist)';
            assignment_count := 0;
    END;
    
    -- Count clients
    BEGIN
        SELECT COUNT(*) INTO client_count FROM public.clients;
        RAISE NOTICE 'Clients: %', client_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE 'Clients: 0 (table does not exist)';
            client_count := 0;
    END;
    
    -- Count auth users
    SELECT COUNT(*) INTO auth_user_count FROM auth.users;
    RAISE NOTICE 'Auth Users: %', auth_user_count;
    
    RAISE NOTICE '';
END $$;

-- ============================================
-- 3. Check User Roles Distribution
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== USER ROLES DISTRIBUTION ===';
    RAISE NOTICE '';
END $$;

SELECT 
    role,
    COUNT(*) as count
FROM public.profiles
GROUP BY role
ORDER BY count DESC;

-- ============================================
-- 4. Check Auditors vs Users Overlap
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== AUDITORS VS USERS ANALYSIS ===';
    RAISE NOTICE '';
END $$;

-- Check if auditors table exists first
DO $$
DECLARE
    table_exists BOOLEAN;
    auditors_with_users INTEGER;
    auditors_without_users INTEGER;
    users_with_auditor_role INTEGER;
    users_without_auditor_profile INTEGER;
    rec RECORD;  -- Add this declaration
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditors'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Count auditors with matching auth users
        SELECT COUNT(DISTINCT a.id) INTO auditors_with_users
        FROM public.auditors a
        JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
        WHERE a.email IS NOT NULL;
        
        -- Count auditors without matching auth users
        SELECT COUNT(*) INTO auditors_without_users
        FROM public.auditors a
        LEFT JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
        WHERE u.id IS NULL
          AND a.email IS NOT NULL;
        
        RAISE NOTICE 'Auditors with auth users: %', auditors_with_users;
        RAISE NOTICE 'Auditors without auth users: %', auditors_without_users;
        
        IF auditors_without_users > 0 THEN
            RAISE NOTICE '';
            RAISE NOTICE '⚠️  These auditors need auth user creation:';
            
            -- List auditors without users
            FOR rec IN 
                SELECT a.name, a.email, a.role
                FROM public.auditors a
                LEFT JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
                WHERE u.id IS NULL
                  AND a.email IS NOT NULL
                LIMIT 10
            LOOP
                RAISE NOTICE '  • % (%) - %', rec.name, rec.email, rec.role;
            END LOOP;
        END IF;
    ELSE
        RAISE NOTICE 'No auditors table found - will create fresh auditor profiles';
    END IF;
    
    -- Count users with Auditor/Lead Auditor role
    SELECT COUNT(*) INTO users_with_auditor_role
    FROM public.profiles
    WHERE role IN ('Auditor', 'Lead Auditor');
    
    RAISE NOTICE '';
    RAISE NOTICE 'Users with Auditor/Lead Auditor role: %', users_with_auditor_role;
    
    -- Check if auditor_profiles table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditor_profiles'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT COUNT(*) INTO users_without_auditor_profile
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.id
        WHERE p.role IN ('Auditor', 'Lead Auditor')
          AND NOT EXISTS (
              SELECT 1 FROM public.auditor_profiles ap
              WHERE ap.user_id = u.id
          );
        
        RAISE NOTICE 'Auditor users without profiles: %', users_without_auditor_profile;
    ELSE
        RAISE NOTICE 'Auditor profiles table not yet created';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================
-- 5. Check Auditor Assignments Structure
-- ============================================
DO $$
DECLARE
    table_exists BOOLEAN;
    has_user_id BOOLEAN;
    has_auditor_id BOOLEAN;
BEGIN
    RAISE NOTICE '=== AUDITOR ASSIGNMENTS STRUCTURE ===';
    RAISE NOTICE '';
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditor_assignments'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Check if columns exist
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'auditor_assignments'
              AND column_name = 'user_id'
        ) INTO has_user_id;
        
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'auditor_assignments'
              AND column_name = 'auditor_id'
        ) INTO has_auditor_id;
        
        RAISE NOTICE 'Has user_id column: %', 
            CASE WHEN has_user_id THEN '✅ YES' ELSE '❌ NO' END;
        RAISE NOTICE 'Has auditor_id column: %', 
            CASE WHEN has_auditor_id THEN '✅ YES' ELSE '❌ NO' END;
        
        -- Show sample assignments
        RAISE NOTICE '';
        RAISE NOTICE 'Sample assignments:';
    ELSE
        RAISE NOTICE 'Auditor assignments table does not exist';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- Show sample assignments if table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditor_assignments'
    ) THEN
        PERFORM 1; -- Table exists, query will run below
    END IF;
END $$;

SELECT 
    id,
    client_id,
    auditor_id,
    role,
    assigned_at
FROM public.auditor_assignments
LIMIT 5;

-- ============================================
-- 6. Migration Readiness Check
-- ============================================
DO $$
DECLARE
    profiles_exist BOOLEAN;
    auth_users_exist BOOLEAN;
    ready_to_migrate BOOLEAN := TRUE;
    profile_count INTEGER;
    auth_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== MIGRATION READINESS CHECK ===';
    RAISE NOTICE '';
    
    -- Check profiles
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    profiles_exist := profile_count > 0;
    
    -- Check auth users
    SELECT COUNT(*) INTO auth_count FROM auth.users;
    auth_users_exist := auth_count > 0;
    
    IF NOT profiles_exist THEN
        RAISE WARNING '⚠️  No profiles found - create some users first';
        ready_to_migrate := FALSE;
    END IF;
    
    IF NOT auth_users_exist THEN
        RAISE WARNING '⚠️  No auth users found - create some users first';
        ready_to_migrate := FALSE;
    END IF;
    
    IF ready_to_migrate THEN
        RAISE NOTICE '✅ System is ready for migration!';
        RAISE NOTICE '';
        RAISE NOTICE 'Next steps:';
        RAISE NOTICE '1. Backup your database';
        RAISE NOTICE '2. Run: 01-create-auditor-profiles-table.sql';
        RAISE NOTICE '3. Run: 02-update-auditor-assignments-schema.sql';
        RAISE NOTICE '4. Run: 03-migrate-auditor-data.sql';
    ELSE
        RAISE NOTICE '⚠️  System needs setup before migration';
        RAISE NOTICE '';
        RAISE NOTICE 'Create some users first, then run this check again';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================
-- Summary
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== PRE-MIGRATION CHECK COMPLETE ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Review the output above to understand:';
    RAISE NOTICE '• What tables exist';
    RAISE NOTICE '• How much data will be migrated';
    RAISE NOTICE '• Which auditors need auth user creation';
    RAISE NOTICE '• Whether the system is ready for migration';
    RAISE NOTICE '';
END $$;
