-- ==============================================================================
-- COMPREHENSIVE DATABASE SCHEMA CHECK
-- ==============================================================================
-- This script checks for all required columns across all tables
-- Run this in Supabase SQL Editor to see what's missing
-- ==============================================================================

-- Check clients table columns
SELECT 'clients' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'clients'
ORDER BY ordinal_position;

-- Check if audit_impartiality_threats has client column
SELECT 'audit_impartiality_threats' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'audit_impartiality_threats'
ORDER BY ordinal_position;

-- Check all public tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
