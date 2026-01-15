-- ============================================
-- FIX: ADD MISSING COLUMNS TO AUDIT_PLANS
-- ============================================

-- 1. Add 'data' column for JSON persistence (catch-all)
ALTER TABLE audit_plans 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 2. Add 'man_days' and 'onsite_days' for specific reporting
ALTER TABLE audit_plans 
ADD COLUMN IF NOT EXISTS man_days NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS onsite_days NUMERIC DEFAULT 0;

-- 3. Add 'selected_sites' and 'agenda' to ensure they differ from generic JSON
ALTER TABLE audit_plans 
ADD COLUMN IF NOT EXISTS selected_sites JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS agenda JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS team JSONB DEFAULT '[]'::jsonb;

-- 4. Add 'client_id' if missing (referencing clients table)
ALTER TABLE audit_plans 
ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES clients(id);

-- 5. Add 'lead_auditor'
ALTER TABLE audit_plans 
ADD COLUMN IF NOT EXISTS lead_auditor TEXT;

-- 6. Add 'audit_type' (since we use 'type' or 'audit_type')
ALTER TABLE audit_plans 
ADD COLUMN IF NOT EXISTS audit_type TEXT;

-- Reload schema cache
NOTIFY pgrst, 'reload config';

SELECT 'Audit Plans schema updated successfully' as status;
