-- ============================================
-- Phase 2: Data Migration (Simplified - No Existing Auditors Table)
-- ============================================
-- This script creates auditor profiles for existing users with Auditor/Lead Auditor roles
-- Use this version if you DON'T have an existing 'auditors' table

-- ============================================
-- STEP 1: Analyze Current Data
-- ============================================
DO $$
DECLARE
    user_count INTEGER;
    auth_count INTEGER;
    auditor_role_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    SELECT COUNT(*) INTO auth_count FROM auth.users;
    SELECT COUNT(*) INTO auditor_role_count 
    FROM public.profiles 
    WHERE role IN ('Auditor', 'Lead Auditor');
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Current Data Analysis ===';
    RAISE NOTICE 'Users in profiles table: %', user_count;
    RAISE NOTICE 'Auth users in auth.users: %', auth_count;
    RAISE NOTICE 'Users with Auditor/Lead Auditor role: %', auditor_role_count;
    RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 2: Create Auditor Profiles for Existing Users
-- ============================================
-- Create auditor profiles for all users with Auditor or Lead Auditor role

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
    NULL as customer_rating,
    NULL as performance_score,
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
    RAISE NOTICE '✅ Created % auditor profiles for existing users', created_count;
END $$;

-- ============================================
-- STEP 3: Verification Report
-- ============================================
DO $$
DECLARE
    total_auditor_users INTEGER;
    auditors_with_profiles INTEGER;
    total_assignments INTEGER;
    assignments_with_user_id INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_auditor_users 
    FROM public.profiles 
    WHERE role IN ('Auditor', 'Lead Auditor');
    
    SELECT COUNT(*) INTO auditors_with_profiles 
    FROM public.auditor_profiles;
    
    SELECT COUNT(*) INTO total_assignments 
    FROM public.auditor_assignments;
    
    SELECT COUNT(*) INTO assignments_with_user_id 
    FROM public.auditor_assignments 
    WHERE user_id IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Migration Summary ===';
    RAISE NOTICE 'Total users with Auditor/Lead Auditor role: %', total_auditor_users;
    RAISE NOTICE 'Auditor profiles created: %', auditors_with_profiles;
    RAISE NOTICE 'Total assignments: %', total_assignments;
    RAISE NOTICE 'Assignments with user_id: %', assignments_with_user_id;
    RAISE NOTICE '';
    
    IF auditors_with_profiles = total_auditor_users THEN
        RAISE NOTICE '✅ All auditor users have profiles';
    ELSE
        RAISE WARNING '⚠️  Some auditor users missing profiles';
        RAISE NOTICE 'Missing: %', (total_auditor_users - auditors_with_profiles);
    END IF;
    
    IF total_assignments > 0 THEN
        IF assignments_with_user_id = total_assignments THEN
            RAISE NOTICE '✅ All assignments have user_id';
        ELSE
            RAISE WARNING '⚠️  Some assignments missing user_id';
            RAISE NOTICE 'Missing: %', (total_assignments - assignments_with_user_id);
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  No assignments exist yet';
    END IF;
END $$;

-- ============================================
-- STEP 4: Show Created Auditor Profiles
-- ============================================
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
LIMIT 20;

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Data Migration Complete ===';
    RAISE NOTICE '✅ Auditor profiles created for all Auditor/Lead Auditor users';
    RAISE NOTICE '✅ System ready for frontend code updates';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify the auditor profiles shown above look correct';
    RAISE NOTICE '2. Update frontend code to use new schema (Phase 3)';
    RAISE NOTICE '3. Test user creation with Auditor role';
    RAISE NOTICE '';
    RAISE NOTICE 'Note: Future users with Auditor/Lead Auditor role will';
    RAISE NOTICE 'automatically get auditor profiles via frontend code.';
END $$;
