-- ==============================================================================
-- ADD MISSING CLIENT COLUMN TO IMPARTIALITY THREATS TABLE
-- ==============================================================================
-- This script adds the missing 'client' column to the audit_impartiality_threats table
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- Add the client column if it doesn't exist
DO $$ 
BEGIN
    -- Check if column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_impartiality_threats' 
        AND column_name = 'client'
    ) THEN
        ALTER TABLE public.audit_impartiality_threats 
        ADD COLUMN client TEXT;
        
        RAISE NOTICE 'Column "client" added to audit_impartiality_threats table';
    ELSE
        RAISE NOTICE 'Column "client" already exists in audit_impartiality_threats table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'audit_impartiality_threats'
ORDER BY ordinal_position;
