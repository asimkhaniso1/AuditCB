-- Fix for auditors table
-- Run this in Supabase SQL Editor

-- 1. Add 'data' column (JSONB storage for full auditor profile)
ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 2. Add 'email' column (Important for notifications/linking)
ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Verify other columns exist (based on code usage)
ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS standards TEXT; -- or TEXT[] if array, usually stored as JSON or text in simple setups

-- 4. Enable RLS
ALTER TABLE public.auditors ENABLE ROW LEVEL SECURITY;

-- 5. Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
