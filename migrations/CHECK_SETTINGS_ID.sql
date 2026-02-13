-- Check settings id column type
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'settings' AND column_name = 'id';
