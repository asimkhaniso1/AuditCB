-- ============================================
-- CLEANUP CLIENT DUPLICATES MIGRATION
-- ============================================
-- This script merges data from camelCase columns into snake_case columns
-- and then drops the camelCase columns to fix schema inconsistencies.

BEGIN;

-- 1. Merge nextAudit -> next_audit
UPDATE clients 
SET next_audit = COALESCE(next_audit, "nextAudit") 
WHERE next_audit IS NULL AND "nextAudit" IS NOT NULL;

-- 2. Merge lastAudit -> last_audit
UPDATE clients 
SET last_audit = COALESCE(last_audit, "lastAudit") 
WHERE last_audit IS NULL AND "lastAudit" IS NOT NULL;

-- 3. Merge contactPerson -> contact_person
UPDATE clients 
SET contact_person = COALESCE(contact_person, "contactPerson") 
WHERE contact_person IS NULL AND "contactPerson" IS NOT NULL;

-- 4. Drop duplicate columns
ALTER TABLE clients DROP COLUMN IF EXISTS "nextAudit";
ALTER TABLE clients DROP COLUMN IF EXISTS "lastAudit";
ALTER TABLE clients DROP COLUMN IF EXISTS "contactPerson";

COMMIT;

-- Verify changes
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'clients';
