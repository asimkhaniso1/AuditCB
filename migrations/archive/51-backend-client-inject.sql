-- DIRECT BACKEND DATA INJECTION
-- Purpose: Bypasses Browser/API entirely to force-load Clients.

-- 1. Insert Clients (Pakistan Post, CCI, TechFlow)
INSERT INTO public.clients (id, name, standard, status, website, industry, created_at, updated_at)
VALUES 
    -- Pakistan Post Foundation (Conflicting ID handled by ON CONFLICT)
    ('1767868038354', 'Pakistan Post Foundation', 'ISO 9001:2015, ISO 27001:2022', 'Active', 'https://ppf.com.pk/divisions/', 'Press', '2026-01-12 08:23:34.213+00', '2026-01-22 10:44:23.096+00'),
    
    -- CCI Services
    ('1768406734791', 'CCI Services', 'ISO 9001:2015', 'Active', 'https://cciservices.com', 'Services', '2026-01-18 10:00:00+00', '2026-01-22 11:33:00+00'),
    
    -- TechFlow Solutions
    ('1767868038355', 'TechFlow Solutions', 'ISO 27001:2022', 'Active', 'https://techflow.io', 'Technology', '2026-01-15 09:15:00+00', '2026-01-22 10:00:00+00')

ON CONFLICT (id) DO UPDATE 
SET 
    name = EXCLUDED.name,
    standard = EXCLUDED.standard,
    status = EXCLUDED.status,
    website = EXCLUDED.website,
    industry = EXCLUDED.industry;

-- 2. Verify and Count
SELECT count(*) as "Clients Restored" FROM public.clients;
