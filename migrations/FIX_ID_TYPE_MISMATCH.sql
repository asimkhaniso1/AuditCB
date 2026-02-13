-- ============================================
-- FIX ID TYPE MISMATCH
-- ============================================
-- The App generates IDs using Date.now() (Numbers/Strings).
-- The Database expects UUIDs.
-- This script changes the ID columns to TEXT to accept ANY ID format.

-- 1. Clients
ALTER TABLE clients ALTER COLUMN id TYPE TEXT;

-- 2. Audit Plans
ALTER TABLE audit_plans ALTER COLUMN id TYPE TEXT;

-- 3. Audit Reports
ALTER TABLE audit_reports ALTER COLUMN id TYPE TEXT;

-- 4. Auditors
ALTER TABLE auditors ALTER COLUMN id TYPE TEXT;

-- 5. Audit Log
ALTER TABLE audit_log ALTER COLUMN id TYPE TEXT;

-- 6. Checklists (if exists)
ALTER TABLE checklists ALTER COLUMN id TYPE TEXT;

-- Verification
SELECT 'ID columns converted to TEXT' as status;
