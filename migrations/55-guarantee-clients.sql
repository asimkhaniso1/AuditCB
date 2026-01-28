-- GUARANTEE CLIENT INJECTION (Upsert)
-- 1. Pakistan Post Foundation
INSERT INTO public.clients (
    id, name, standard, status, type, website, employees, shifts, industry,
    contact_person, next_audit, last_audit, created_at, updated_at
) VALUES (
    '1767868038354', 
    'Pakistan Post Foundation', 
    'ISO 9001:2015, ISO 27001:2022', 
    'Active', 
    '', 
    'https://ppf.com.pk/divisions/', 
    100, 
    'No', 
    'Press', 
    'Shariq Jamil', 
    NULL, 
    NULL, 
    '2026-01-12 08:23:34.213052+00', 
    '2026-01-22 10:44:23.096462+00'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = 'Active';

-- 2. CCI Services - Internal Operations
INSERT INTO public.clients (
    id, name, standard, status, type, website, employees, shifts, industry,
    contact_person, next_audit, last_audit, created_at, updated_at
) VALUES (
    '999', 
    'CCI Services - Internal Operations', 
    'ISO 17021', 
    'Active', 
    'internal', 
    'https://companycertification.com/', 
    10, 
    'No', 
    'Certification Body', 
    'Quality Manager', 
    '2024-06-15', 
    NULL, 
    '2026-01-12 08:23:34.213052+00', 
    '2026-01-21 16:11:06.996889+00'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = 'Active';

-- 3. Check Count
SELECT count(*) as client_count FROM public.clients;
SELECT id, name, status FROM public.clients;
