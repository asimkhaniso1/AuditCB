-- ============================================
-- Verification Script: Check Auditor Profiles Table
-- ============================================
-- Run this AFTER running 03-migrate-auditor-data-defensive.sql

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'auditor_profiles'
ORDER BY ordinal_position;

-- Check data count
SELECT 
    COUNT(*) as total_profiles,
    (SELECT COUNT(*) FROM public.auditor_profiles WHERE auditor_number LIKE 'AUD-%') as with_valid_numbers
FROM public.auditor_profiles;

-- Show a sample 
SELECT * FROM public.auditor_profiles LIMIT 5;
