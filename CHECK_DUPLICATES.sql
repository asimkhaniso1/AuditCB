-- CHECK FOR DUPLICATES

-- 1. Check for Duplicate Clients (by Name)
SELECT name, COUNT(*), array_agg(id) as ids
FROM clients
GROUP BY name
HAVING COUNT(*) > 1;

-- 2. Check for Duplicate Auditors (by Name or Email)
SELECT name, email, COUNT(*), array_agg(id) as ids
FROM auditors
GROUP BY name, email
HAVING COUNT(*) > 1;

-- 3. Check for Duplicate Audit Plans (by Client, Standard, Date)
SELECT client_id, standard, date, COUNT(*), array_agg(id) as ids
FROM audit_plans
GROUP BY client_id, standard, date
HAVING COUNT(*) > 1;
