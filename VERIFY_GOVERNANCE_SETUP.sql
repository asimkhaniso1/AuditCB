-- ==============================================================================
-- VERIFY GOVERNANCE MODULE SETUP
-- ==============================================================================
-- Run this script to confirm that the tables exist and the IDs are TEXT.
-- ==============================================================================

SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name IN (
        'audit_ncrs', 
        'audit_appeals', 
        'audit_complaints', 
        'audit_impartiality_members', 
        'audit_impartiality_threats', 
        'audit_impartiality_meetings', 
        'audit_management_reviews',
        'clients',
        'audit_plans'
    )
    AND column_name IN ('id', 'client_id', 'audit_id', 'related_audit_id')
ORDER BY 
    table_name, column_name;
