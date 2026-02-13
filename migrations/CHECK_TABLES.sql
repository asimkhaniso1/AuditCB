-- Check audit_plans and audit_reports structure
SELECT 'audit_plans' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns WHERE table_name = 'audit_plans'
UNION ALL
SELECT 'audit_reports' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns WHERE table_name = 'audit_reports'
ORDER BY 1, column_name;
