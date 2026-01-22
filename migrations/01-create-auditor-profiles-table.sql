-- ============================================
-- Phase 1.1: Create Auditor Profiles Table
-- ============================================
-- This creates a new table to store auditor-specific professional data
-- linked to user accounts via user_id foreign key

-- 1. Create auditor_profiles table
CREATE TABLE IF NOT EXISTS public.auditor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- Professional Information
    auditor_number TEXT UNIQUE,
    experience INTEGER DEFAULT 0,
    certifications JSONB DEFAULT '[]'::jsonb,
    industries JSONB DEFAULT '[]'::jsonb,
    standards JSONB DEFAULT '[]'::jsonb,
    languages JSONB DEFAULT '[]'::jsonb,
    qualifications JSONB DEFAULT '[]'::jsonb,
    training_records JSONB DEFAULT '[]'::jsonb,
    
    -- Performance Metrics
    audits_completed INTEGER DEFAULT 0,
    customer_rating DECIMAL(3,2),
    performance_score DECIMAL(5,2),
    
    -- Availability
    availability_status TEXT DEFAULT 'Available',
    max_audits_per_month INTEGER DEFAULT 10,
    
    -- Additional Professional Data
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_auditor_profiles_user 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE,
    CONSTRAINT unique_user_id UNIQUE(user_id),
    CONSTRAINT check_experience_positive CHECK (experience >= 0),
    CONSTRAINT check_rating_range CHECK (customer_rating >= 0 AND customer_rating <= 5),
    CONSTRAINT check_max_audits_positive CHECK (max_audits_per_month > 0)
);

-- 2. Create indexes for performance
CREATE INDEX idx_auditor_profiles_user_id 
    ON public.auditor_profiles(user_id);
    
CREATE INDEX idx_auditor_profiles_auditor_number 
    ON public.auditor_profiles(auditor_number);
    
CREATE INDEX idx_auditor_profiles_availability 
    ON public.auditor_profiles(availability_status);

-- 3. Enable Row Level Security
ALTER TABLE public.auditor_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies

-- Policy: Anyone authenticated can view auditor profiles
CREATE POLICY "Auditor profiles viewable by authenticated users"
    ON public.auditor_profiles FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Admins and Cert Managers can do anything
CREATE POLICY "Auditor profiles manageable by admin"
    ON public.auditor_profiles FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('Admin', 'Certification Manager')
        )
    );

-- Policy: Auditors can update their own profile
CREATE POLICY "Auditors can update own profile"
    ON public.auditor_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_auditor_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auditor_profiles_updated_at
    BEFORE UPDATE ON public.auditor_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_auditor_profiles_updated_at();

-- 6. Grant permissions
GRANT ALL ON public.auditor_profiles TO authenticated;
GRANT ALL ON public.auditor_profiles TO service_role;

-- 7. Add helpful comments
COMMENT ON TABLE public.auditor_profiles IS 'Professional profiles for users with Auditor or Lead Auditor roles';
COMMENT ON COLUMN public.auditor_profiles.user_id IS 'Foreign key to auth.users - links auditor profile to user account';
COMMENT ON COLUMN public.auditor_profiles.auditor_number IS 'Unique auditor identification number (e.g., AUD-2024-001)';
COMMENT ON COLUMN public.auditor_profiles.availability_status IS 'Current availability: Available, Busy, On Leave, etc.';

-- ============================================
-- Verification Queries
-- ============================================

-- Check table was created
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'auditor_profiles';

-- Check columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'auditor_profiles'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'auditor_profiles';

-- Check RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'auditor_profiles';

-- Check policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'auditor_profiles';

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Auditor Profiles table created successfully!';
    RAISE NOTICE '✅ Indexes created';
    RAISE NOTICE '✅ RLS enabled with 3 policies';
    RAISE NOTICE '✅ Triggers configured';
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Run update-auditor-assignments-schema.sql';
END $$;
