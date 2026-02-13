-- Add missing columns to settings table for CB configuration
-- Run this SQL in your Supabase SQL Editor

-- Check if cb_settings column exists, add if not
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS cb_settings JSONB DEFAULT '{}'::jsonb;

-- Add other potentially missing columns
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS organization JSONB DEFAULT '[]'::jsonb;

ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS policies JSONB DEFAULT '{}'::jsonb;

ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS knowledge_base JSONB DEFAULT '{}'::jsonb;

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'settings';
