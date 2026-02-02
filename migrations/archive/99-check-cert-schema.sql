-- Check if the certification_decisions table has the new columns
SELECT 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'certification_decisions'
ORDER BY 
    column_name;
