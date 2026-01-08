-- Check if settings are saved in Supabase
SELECT 
    id,
    standards,
    roles,
    is_admin,
    cb_settings,
    organization,
    policies,
    updated_at
FROM settings
ORDER BY updated_at DESC
LIMIT 5;
