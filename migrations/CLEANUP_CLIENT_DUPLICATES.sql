-- ============================================
-- CLEANUP CLIENT DUPLICATES MIGRATION (ROBUST)
-- ============================================
-- This script safely merges data from camelCase columns into snake_case columns if they exist.

DO $$
BEGIN
    -- 1. Merge nextAudit -> next_audit
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='nextAudit') THEN
        RAISE NOTICE 'Found "nextAudit" column. Merging data...';
        EXECUTE 'UPDATE clients SET next_audit = COALESCE(next_audit, "nextAudit") WHERE "nextAudit" IS NOT NULL';
    ELSE
        RAISE NOTICE '"nextAudit" column not found. Skipping merge.';
    END IF;

    -- 2. Merge lastAudit -> last_audit
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lastAudit') THEN
        RAISE NOTICE 'Found "lastAudit" column. Merging data...';
        EXECUTE 'UPDATE clients SET last_audit = COALESCE(last_audit, "lastAudit") WHERE "lastAudit" IS NOT NULL';
    ELSE
        RAISE NOTICE '"lastAudit" column not found. Skipping merge.';
    END IF;

    -- 3. Merge contactPerson -> contact_person
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='contactPerson') THEN
        RAISE NOTICE 'Found "contactPerson" column. Merging data...';
        EXECUTE 'UPDATE clients SET contact_person = COALESCE(contact_person, "contactPerson") WHERE "contactPerson" IS NOT NULL';
    ELSE
        RAISE NOTICE '"contactPerson" column not found. Skipping merge.';
    END IF;

END $$;

-- 4. Drop duplicate columns (Safe operation)
ALTER TABLE clients DROP COLUMN IF EXISTS "nextAudit";
ALTER TABLE clients DROP COLUMN IF EXISTS "lastAudit";
ALTER TABLE clients DROP COLUMN IF EXISTS "contactPerson";

-- 5. Verify Cleanup
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'clients' 
ORDER BY column_name;
