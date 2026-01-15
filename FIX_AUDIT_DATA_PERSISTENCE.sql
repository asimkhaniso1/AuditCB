-- ============================================
-- FIX AUDIT DATA PERSISTENCE
-- ============================================
-- Run this script in Supabase SQL Editor to fix data persistence issues
-- This adds missing columns required for saving checklist execution data

-- Add missing columns to audit_reports table
ALTER TABLE audit_reports 
ADD COLUMN IF NOT EXISTS plan_id BIGINT,
ADD COLUMN IF NOT EXISTS checklist_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS custom_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS opening_meeting JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS closing_meeting JSONB DEFAULT '{}'::jsonb;

-- Add report_id to audit_plans (for linking back)
ALTER TABLE audit_plans
ADD COLUMN IF NOT EXISTS report_id BIGINT,
ADD COLUMN IF NOT EXISTS checklist_config JSONB DEFAULT '[]'::jsonb;

-- Reload PostgREST schema cache so the API knows about new columns
NOTIFY pgrst, 'reload config';

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_reports'
ORDER BY ordinal_position;
