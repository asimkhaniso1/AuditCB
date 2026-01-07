-- ============================================
-- FIX SETTINGS SCHEMA & AUDIT LOG (v2)
-- ============================================

-- 1. Update settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cb_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS organization JSONB DEFAULT '[]'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS policies JSONB DEFAULT '{}'::jsonb;

-- 2. Update audit_log table (fix missing columns)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 3. Make columns nullable if they exist
ALTER TABLE audit_log ALTER COLUMN entity_id DROP NOT NULL;
ALTER TABLE audit_log ALTER COLUMN details DROP NOT NULL;

-- 4. Disable RLS for smooth sync
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

SELECT 'Schema fixed!' as status;
