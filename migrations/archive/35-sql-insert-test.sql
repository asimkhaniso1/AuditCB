-- ============================================
-- SQL INSERT TEST
-- Run this in Supabase SQL Editor
-- ============================================

INSERT INTO public.clients (id, name, status, standard, created_at, updated_at)
VALUES 
    ('SQL_TEST_CLIENT_1', 'SQL Test Client', 'Active', 'ISO 9001', NOW(), NOW());

SELECT * FROM public.clients WHERE id = 'SQL_TEST_CLIENT_1';
