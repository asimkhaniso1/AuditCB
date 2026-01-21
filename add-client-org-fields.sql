-- Add missing columns to clients table for organizational data
-- Run this SQL in your Supabase SQL Editor

-- Add departments column (JSON array)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS departments JSONB DEFAULT '[]'::jsonb;

-- Add designations column (JSON array)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS designations JSONB DEFAULT '[]'::jsonb;

-- Add goods_services column (JSON array)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS goods_services JSONB DEFAULT '[]'::jsonb;

-- Add key_processes column (JSON array)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS key_processes JSONB DEFAULT '[]'::jsonb;

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'clients'
AND column_name IN ('departments', 'designations', 'goods_services', 'key_processes');
