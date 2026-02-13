-- Add missing columns to audit_reports to support checklist execution saving
ALTER TABLE audit_reports 
ADD COLUMN IF NOT EXISTS plan_id BIGINT,
ADD COLUMN IF NOT EXISTS checklist_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS custom_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS opening_meeting JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS closing_meeting JSONB DEFAULT '{}'::jsonb;

-- Add report_id to audit_plans to link back to the report
ALTER TABLE audit_plans
ADD COLUMN IF NOT EXISTS report_id BIGINT;
