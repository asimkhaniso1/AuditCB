-- Add missing columns to auditors table
ALTER TABLE auditors 
ADD COLUMN IF NOT EXISTS standards TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS expertise TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS industries TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS man_day_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS education TEXT,
ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'auditors';
