-- ============================================
-- AUTOMATION: Auto-Create Auditor Profiles
-- ============================================

-- Function to handle new auditor users
CREATE OR REPLACE FUNCTION public.handle_new_auditor_user() 
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if role is Auditor or Lead Auditor
    IF NEW.role IN ('Auditor', 'Lead Auditor') THEN
        -- Insert into auditor_profiles if not exists
        INSERT INTO public.auditor_profiles (
            user_id,
            auditor_number,
            availability_status,
            max_audits_per_month,
            audits_completed,
            experience,
            created_at,
            updated_at
        )
        VALUES (
            NEW.id,
            -- Generate AUD-YYYY-XXXXXX
            CONCAT('AUD-', EXTRACT(YEAR FROM NOW()), '-', LPAD(FLOOR(RANDOM() * 100000)::TEXT, 6, '0')),
            'Available',
            10,
            0,
            0,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger on public.profiles
-- Trigger fires on INSERT (new user) or UPDATE (role change)
DROP TRIGGER IF EXISTS on_profile_created_auditor ON public.profiles;

CREATE TRIGGER on_profile_created_auditor
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auditor_user();

-- ============================================
-- FIX: Backfill missing profiles for existing users
-- ============================================
INSERT INTO public.auditor_profiles (
    user_id,
    auditor_number,
    availability_status,
    experience,
    created_at,
    updated_at
)
SELECT 
    p.id,
    CONCAT('AUD-', EXTRACT(YEAR FROM NOW()), '-', LPAD(FLOOR(RANDOM() * 100000)::TEXT, 6, '0')),
    'Available',
    0,
    NOW(),
    NOW()
FROM public.profiles p
JOIN auth.users u ON u.id = p.id  -- CRITICAL: Ensure Auth User exists
LEFT JOIN public.auditor_profiles ap ON p.id = ap.user_id
WHERE p.role IN ('Auditor', 'Lead Auditor')
  AND ap.user_id IS NULL;

