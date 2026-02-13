-- Fix audit_log table - handle PK constraint

-- 1. Set default for id (works even with PK)
ALTER TABLE audit_log ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- 2. Add created_at column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 3. Reload schema
NOTIFY pgrst, 'reload schema';

SELECT 'audit_log fixed' as status;
