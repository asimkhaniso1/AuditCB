-- Fix auditor_ids column type from UUID[] to TEXT[]

-- 1. Drop the default first
ALTER TABLE audit_plans ALTER COLUMN auditor_ids DROP DEFAULT;

-- 2. Convert column to TEXT[]
ALTER TABLE audit_plans 
ALTER COLUMN auditor_ids TYPE TEXT[] 
USING auditor_ids::TEXT[];

-- 3. Reload schema
NOTIFY pgrst, 'reload schema';

SELECT 'auditor_ids is now TEXT[]' as status;
