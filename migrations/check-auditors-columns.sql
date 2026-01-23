-- Quick check: What columns exist in auditors table?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'auditors'
ORDER BY ordinal_position;
