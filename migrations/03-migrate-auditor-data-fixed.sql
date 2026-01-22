-- ============================================
-- Phase 2: Data Migration (Fixed - With Error Handling)
-- ============================================
-- This script migrates existing auditors to the new unified model
-- Run this AFTER creating the auditor_profiles table

-- ============================================
-- STEP 1: Analyze Current Data
-- ============================================
DO $$
DECLARE
    auditor_count INTEGER := 0;
    user_count INTEGER;
    profile_count INTEGER;
    auditors_table_exists BOOLEAN;
BEGIN
    -- Check if auditors table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditors'
    ) INTO auditors_table_exists;
    
    IF auditors_table_exists THEN
        SELECT COUNT(*) INTO auditor_count FROM public.auditors;
    END IF;
    
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    SELECT COUNT(*) INTO profile_count FROM auth.users;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Current Data Analysis ===';
    RAISE NOTICE 'Auditors table exists: %', auditors_table_exists;
    RAISE NOTICE 'Auditors in auditors table: %', auditor_count;
    RAISE NOTICE 'Users in profiles table: %', user_count;
    RAISE NOTICE 'Auth users in auth.users: %', profile_count;
    RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 2: Create User Profiles for Auditors
-- ============================================
-- This creates profile entries for auditors who don't have user accounts yet
-- Only runs if auditors table exists

DO $$
DECLARE
    auditors_table_exists BOOLEAN;
    created_count INTEGER := 0;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditors'
    ) INTO auditors_table_exists;
    
    IF auditors_table_exists THEN
        INSERT INTO public.profiles (email, full_name, role, avatar_url, created_at)
        SELECT 
            a.email,
            a.name,
            COALESCE(a.role, 'Auditor'),
            CONCAT('https://ui-avatars.com/api/?name=', 
                   REPLACE(a.name, ' ', '+'), 
                   '&background=random'),
            NOW()
        FROM public.auditors a
        WHERE a.email IS NOT NULL
          AND a.email != ''
          AND NOT EXISTS (
              SELECT 1 FROM public.profiles p 
              WHERE LOWER(p.email) = LOWER(a.email)
          )
        ON CONFLICT (email) DO NOTHING;
        
        GET DIAGNOSTICS created_count = ROW_COUNT;
        RAISE NOTICE '✅ Created % user profiles for auditors', created_count;
    ELSE
        RAISE NOTICE 'ℹ️  No auditors table found - skipping profile creation from auditors';
    END IF;
END $$;

-- ============================================
-- STEP 3: Create Auditor Profiles from Auditors Table
-- ============================================
-- Link existing auditors to their user accounts via auditor_profiles

DO $$
DECLARE
    auditors_table_exists BOOLEAN;
    created_count INTEGER := 0;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditors'
    ) INTO auditors_table_exists;
    
    IF auditors_table_exists THEN
        INSERT INTO public.auditor_profiles (
            user_id,
            auditor_number,
            experience,
            certifications,
            industries,
            standards,
            qualifications,
            training_records,
            audits_completed,
            customer_rating,
            performance_score,
            availability_status,
            notes,
            created_at,
            updated_at
        )
        SELECT 
            u.id as user_id,
            COALESCE(a.auditor_number, CONCAT('AUD-', EXTRACT(YEAR FROM NOW()), '-', LPAD(a.id::TEXT, 6, '0'))),
            COALESCE(a.experience, 0),
            COALESCE(a.certifications, '[]'::jsonb),
            COALESCE(a.industries, '[]'::jsonb),
            COALESCE(a.standards, '[]'::jsonb),
            COALESCE(a.qualifications, '[]'::jsonb),
            COALESCE(a.training_records, '[]'::jsonb),
            COALESCE(a.audits_completed, 0),
            a.customer_rating,
            a.performance_score,
            COALESCE(a.availability_status, 'Available'),
            a.notes,
            COALESCE(a.created_at, NOW()),
            NOW()
        FROM public.auditors a
        JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
        WHERE a.email IS NOT NULL
          AND a.email != ''
          AND NOT EXISTS (
              SELECT 1 FROM public.auditor_profiles ap
              WHERE ap.user_id = u.id
          )
        ON CONFLICT (user_id) DO NOTHING;
        
        GET DIAGNOSTICS created_count = ROW_COUNT;
        RAISE NOTICE '✅ Created % auditor profiles linked to users', created_count;
    ELSE
        RAISE NOTICE 'ℹ️  No auditors table found - skipping auditor profile creation from auditors';
    END IF;
END $$;

-- ============================================
-- STEP 3B: Create Auditor Profiles for Users Without Them
-- ============================================
-- For users with Auditor/Lead Auditor role who don't have profiles yet

INSERT INTO public.auditor_profiles (
    user_id,
    auditor_number,
    experience,
    certifications,
    industries,
    standards,
    qualifications,
    training_records,
    audits_completed,
    availability_status,
    max_audits_per_month,
    created_at,
    updated_at
)
SELECT 
    u.id as user_id,
    CONCAT('AUD-', EXTRACT(YEAR FROM NOW()), '-', LPAD(ROW_NUMBER() OVER (ORDER BY p.created_at)::TEXT, 6, '0')) as auditor_number,
    0 as experience,
    '[]'::jsonb as certifications,
    '[]'::jsonb as industries,
    '[]'::jsonb as standards,
    '[]'::jsonb as qualifications,
    '[]'::jsonb as training_records,
    0 as audits_completed,
    'Available' as availability_status,
    10 as max_audits_per_month,
    NOW() as created_at,
    NOW() as updated_at
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE p.role IN ('Auditor', 'Lead Auditor')
  AND NOT EXISTS (
      SELECT 1 FROM public.auditor_profiles ap
      WHERE ap.user_id = u.id
  )
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE
    created_count INTEGER;
BEGIN
    GET DIAGNOSTICS created_count = ROW_COUNT;
    IF created_count > 0 THEN
        RAISE NOTICE '✅ Created % additional auditor profiles for users', created_count;
    END IF;
END $$;

-- ============================================
-- STEP 4: Identify Auditors Without Auth Users
-- ============================================
-- These auditors need manual auth user creation in Supabase Dashboard

DO $$
DECLARE
    auditors_table_exists BOOLEAN;
    missing_auth_count INTEGER := 0;
    auditor_record RECORD;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditors'
    ) INTO auditors_table_exists;
    
    IF auditors_table_exists THEN
        SELECT COUNT(*) INTO missing_auth_count
        FROM public.auditors a
        LEFT JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
        WHERE u.id IS NULL
          AND a.email IS NOT NULL
          AND a.email != '';
        
        IF missing_auth_count > 0 THEN
            RAISE NOTICE '';
            RAISE NOTICE '⚠️  Found % auditors without auth users', missing_auth_count;
            RAISE NOTICE '⚠️  These need manual creation in Supabase Dashboard → Authentication → Users';
            RAISE NOTICE '';
            RAISE NOTICE '=== Auditors Needing Auth User Creation ===';
            
            FOR auditor_record IN
                SELECT 
                    a.id,
                    a.name,
                    a.email,
                    a.role
                FROM public.auditors a
                LEFT JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
                WHERE u.id IS NULL
                  AND a.email IS NOT NULL
                  AND a.email != ''
                ORDER BY a.name
                LIMIT 10
            LOOP
                RAISE NOTICE '  • % (%) - Role: %', 
                    auditor_record.name, 
                    auditor_record.email,
                    auditor_record.role;
            END LOOP;
            
            RAISE NOTICE '';
            RAISE NOTICE 'To create these users:';
            RAISE NOTICE '1. Go to Supabase Dashboard → Authentication → Users';
            RAISE NOTICE '2. Click "Add User"';
            RAISE NOTICE '3. Enter email and set password';
            RAISE NOTICE '4. Re-run this migration to link them';
        ELSE
            RAISE NOTICE '✅ All auditors have auth users';
        END IF;
    END IF;
END $$;

-- ============================================
-- STEP 5: Update Auditor Assignments
-- ============================================
-- Update assignments to use user IDs

DO $$
DECLARE
    auditors_table_exists BOOLEAN;
    updated_count INTEGER := 0;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditors'
    ) INTO auditors_table_exists;
    
    IF auditors_table_exists THEN
        -- Update from auditors table
        UPDATE public.auditor_assignments aa
        SET user_id = ap.user_id::TEXT
        FROM public.auditor_profiles ap
        JOIN auth.users u ON u.id = ap.user_id
        JOIN public.auditors a ON LOWER(u.email) = LOWER(a.email)
        WHERE a.id::TEXT = aa.auditor_id
          AND aa.user_id IS NULL;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '✅ Updated % assignments to use user_id (from auditors table)', updated_count;
    END IF;
END $$;

-- ============================================
-- STEP 6: Verification Report
-- ============================================
DO $$
DECLARE
    auditors_table_exists BOOLEAN;
    total_auditors INTEGER := 0;
    auditors_with_profiles INTEGER;
    auditors_with_auth INTEGER := 0;
    total_assignments INTEGER;
    assignments_with_user_id INTEGER;
    auditor_role_users INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auditors'
    ) INTO auditors_table_exists;
    
    IF auditors_table_exists THEN
        SELECT COUNT(*) INTO total_auditors FROM public.auditors;
        SELECT COUNT(DISTINCT a.id) INTO auditors_with_auth
        FROM public.auditors a
        JOIN auth.users u ON LOWER(u.email) = LOWER(a.email);
    END IF;
    
    SELECT COUNT(*) INTO auditors_with_profiles FROM public.auditor_profiles;
    SELECT COUNT(*) INTO total_assignments FROM public.auditor_assignments;
    SELECT COUNT(*) INTO assignments_with_user_id 
    FROM public.auditor_assignments WHERE user_id IS NOT NULL;
    SELECT COUNT(*) INTO auditor_role_users
    FROM public.profiles WHERE role IN ('Auditor', 'Lead Auditor');
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Migration Summary ===';
    IF auditors_table_exists THEN
        RAISE NOTICE 'Total auditors in auditors table: %', total_auditors;
        RAISE NOTICE 'Auditors with auth users: %', auditors_with_auth;
    END IF;
    RAISE NOTICE 'Users with Auditor/Lead Auditor role: %', auditor_role_users;
    RAISE NOTICE 'Auditor profiles created: %', auditors_with_profiles;
    RAISE NOTICE 'Total assignments: %', total_assignments;
    RAISE NOTICE 'Assignments with user_id: %', assignments_with_user_id;
    RAISE NOTICE '';
    
    IF auditor_role_users = auditors_with_profiles THEN
        RAISE NOTICE '✅ All auditor users have profiles';
    ELSE
        RAISE WARNING '⚠️  Mismatch between auditor users and profiles';
    END IF;
    
    IF total_assignments > 0 THEN
        IF assignments_with_user_id = total_assignments THEN
            RAISE NOTICE '✅ All assignments have user_id';
        ELSE
            RAISE WARNING '⚠️  Some assignments missing user_id (%/%)', 
                assignments_with_user_id, total_assignments;
        END IF;
    END IF;
END $$;

-- Show sample migrated data
SELECT 
    u.email,
    p.full_name,
    p.role as user_role,
    ap.auditor_number,
    ap.experience,
    ap.availability_status,
    (SELECT COUNT(*) FROM public.auditor_assignments WHERE user_id = u.id::TEXT) as assignment_count
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.auditor_profiles ap ON ap.user_id = u.id
WHERE p.role IN ('Auditor', 'Lead Auditor')
ORDER BY p.full_name
LIMIT 10;

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Data Migration Complete ===';
    RAISE NOTICE '✅ User profiles created for auditors';
    RAISE NOTICE '✅ Auditor profiles linked to users';
    RAISE NOTICE '✅ Assignments updated to use user_id';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Create auth users for any auditors listed above (if any)';
    RAISE NOTICE '2. Update frontend code to use new schema';
    RAISE NOTICE '3. Test thoroughly before dropping old auditors table';
END $$;
