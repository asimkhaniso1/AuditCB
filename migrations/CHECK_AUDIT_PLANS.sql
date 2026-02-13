-- Check exact column types for audit_plans
SELECT 
    column_name, 
    data_type, 
    udt_name,  -- underlying type
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'audit_plans'
ORDER BY ordinal_position;
