-- ============================================
-- MANUAL BACKUP SCRIPT FOR FREE TIER
-- ============================================
-- Run this BEFORE deploying schema changes
-- Copy the output and save it as backup.json
-- ============================================

-- Export clients
SELECT json_agg(row_to_json(t)) 
FROM (SELECT * FROM public.clients) t;

-- Export auditors  
SELECT json_agg(row_to_json(t))
FROM (SELECT * FROM public.auditors) t;

-- Export audit_plans
SELECT json_agg(row_to_json(t))
FROM (SELECT * FROM public.audit_plans) t;

-- Export audit_reports
SELECT json_agg(row_to_json(t))
FROM (SELECT * FROM public.audit_reports) t;

-- ============================================
-- Instructions:
-- 1. Run each query separately in Supabase SQL Editor
-- 2. Copy the JSON output from each
-- 3. Save to a file: backup_YYYY-MM-DD.json
-- 4. Store safely (local drive, GitHub, etc.)
-- ============================================
