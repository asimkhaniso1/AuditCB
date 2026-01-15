-- Force schema cache reload and ensure columns exist
NOTIFY pgrst, 'reload config';

-- Ensure 'client' column exists (it should, but let's be safe)
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS client TEXT;

-- Verify other columns
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS checklist_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS custom_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS opening_meeting JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS closing_meeting JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS plan_id BIGINT;
