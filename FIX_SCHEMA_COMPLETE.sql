-- ============================================
-- COMPREHENSIVE AUDIT_REPORTS SCHEMA FIX
-- ============================================
-- Run this in Supabase SQL Editor

-- STEP 1: Check current columns (run this first to see what exists)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'audit_reports'
ORDER BY ordinal_position;

-- STEP 2: If 'client' column is missing, add it
-- (This is the column causing the error)
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS client TEXT;

-- STEP 3: Add all other missing columns for execution data
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS plan_id BIGINT;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft';
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS findings INTEGER DEFAULT 0;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS checklist_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS custom_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS opening_meeting JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS closing_meeting JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS conclusion TEXT;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS recommendation TEXT;

-- STEP 4: For audit_plans, add checklist config column
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS report_id BIGINT;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS checklist_config JSONB DEFAULT '[]'::jsonb;

-- STEP 5: Verify columns were added
SELECT 'audit_reports columns:' as info;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'audit_reports' ORDER BY ordinal_position;

-- STEP 6: Force schema cache reload (multiple methods)
-- Method 1: Standard notify
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- If above doesn't work, you may need to:
-- 1. Go to Supabase Dashboard -> Settings -> API
-- 2. Click "Reload Schema" button
-- OR
-- 3. Restart the Supabase project (Settings -> General -> Restart project)
