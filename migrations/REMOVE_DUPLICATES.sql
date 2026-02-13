-- ============================================
-- REMOVE DUPLICATES (GENERIC)
-- ============================================
-- keeps the LATEST record (based on updated_at) and deletes older duplicates.

-- 1. Remove Duplicate Clients (by Name)
DELETE FROM clients
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY name ORDER BY updated_at DESC, id DESC) as r_num
        FROM clients
    ) t
    WHERE t.r_num > 1
);

-- 2. Remove Duplicate Auditors (by Name)
DELETE FROM auditors
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY name ORDER BY updated_at DESC, id DESC) as r_num
        FROM auditors
    ) t
    WHERE t.r_num > 1
);

-- 3. Remove Duplicate Audit Plans (by Client ID, Standard, Date)
DELETE FROM audit_plans
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY client_id, standard, date ORDER BY updated_at DESC, id DESC) as r_num
        FROM audit_plans
    ) t
    WHERE t.r_num > 1
);

SELECT 'Duplicate removal complete!' as status;
