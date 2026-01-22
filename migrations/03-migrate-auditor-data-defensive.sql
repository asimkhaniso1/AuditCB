-- ============================================
-- Phase 2: Data Migration (Defensive / Final)
-- ============================================
-- Use this script if previous attempts failed due to missing columns or constraints.
-- This script assumes the 'auditors' table exists but might have a simple schema.

-- ============================================
-- STEP 1: Create User Profiles (Only if Auth User Exists)
-- ============================================
DO $$
DECLARE
    created_count INTEGER := 0;
BEGIN
    -- We match auditors to auth.users by email.
    -- We only insert into profiles if the auth user exists (because profiles.id must equal auth.users.id)
    INSERT INTO public.profiles (id, email, full_name, role, avatar_url, created_at)
    SELECT 
        u.id,
        a.email,
        a.name,
        COALESCE(a.role, 'Auditor')::app_role, -- Cast to enum
        CONCAT('https://ui-avatars.com/api/?name=', REPLACE(a.name, ' ', '+'), '&background=random'),
        NOW()
    FROM public.auditors a
    JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
    WHERE a.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
    ON CONFLICT (id) DO NOTHING;

    GET DIAGNOSTICS created_count = ROW_COUNT;
    RAISE NOTICE '✅ Created % user profiles for auditors (matched with auth users)', created_count;
END $$;

-- ============================================
-- STEP 2: Create Auditor Profiles (Populate with Defaults)
-- ============================================
DO $$
DECLARE
    created_count INTEGER := 0;
BEGIN
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
        -- Generate a default auditor number: AUD-YYYY-XXXX
        CONCAT('AUD-', EXTRACT(YEAR FROM NOW()), '-', LPAD(ROW_NUMBER() OVER (ORDER BY u.created_at)::TEXT, 6, '0')),
        0,              -- Default experience
        '[]'::jsonb,    -- Default certifications
        '[]'::jsonb,    -- Default industries
        '[]'::jsonb,    -- Default standards
        '[]'::jsonb,    -- Default qualifications
        '[]'::jsonb,    -- Default training_records
        0,              -- Default audits_completed
        'Available',    -- Default status
        10,             -- Default max audits
        NOW(),
        NOW()
    FROM public.auditors a
    JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
    WHERE a.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.auditor_profiles ap WHERE ap.user_id = u.id)
    ON CONFLICT (user_id) DO NOTHING;

    GET DIAGNOSTICS created_count = ROW_COUNT;
    RAISE NOTICE '✅ Created % auditor profiles details', created_count;
END $$;

-- ============================================
-- STEP 3: Auto-Create Profiles for ANY Auditor/Lead Auditor User
-- ============================================
-- Catches any users who have the role but weren't in the auditors table
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
    created_at,
    updated_at
)
SELECT 
    u.id,
    CONCAT('AUD-', EXTRACT(YEAR FROM NOW()), '-', LPAD(ROW_NUMBER() OVER (ORDER BY p.created_at)::TEXT, 6, '0')),
    0, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 0, 'Available',
    NOW(), NOW()
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE p.role IN ('Auditor', 'Lead Auditor')
  AND NOT EXISTS (SELECT 1 FROM public.auditor_profiles ap WHERE ap.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- STEP 4: Update Assignments
-- ============================================
UPDATE public.auditor_assignments aa
SET user_id = ap.user_id::TEXT
FROM public.auditor_profiles ap
JOIN auth.users u ON u.id = ap.user_id
JOIN public.auditors a ON LOWER(u.email) = LOWER(a.email)
WHERE a.id::TEXT = aa.auditor_id
  AND aa.user_id IS NULL;

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Linked % assignments to user IDs', updated_count;
END $$;

-- ============================================
-- STEP 5: Report Missing Auth Users
-- ============================================
-- Lists auditors who exist in the old table but have no login account yet
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  The following auditors have NO User Account (Auth User):';
    RAISE NOTICE '---------------------------------------------------';
    FOR r IN 
        SELECT a.name, a.email, a.role FROM public.auditors a
        LEFT JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
        WHERE u.id IS NULL
    LOOP
        RAISE NOTICE 'MISSING: % (%) - %', r.name, r.email, r.role;
    END LOOP;
    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'Action: Manually create these users in Supabase Auth if needed.';
END $$;
