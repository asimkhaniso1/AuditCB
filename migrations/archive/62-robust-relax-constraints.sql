-- ROBUST RELAX CONSTRAINTS
-- This script safely checks if columns exist before trying to modify them.
-- It fixes the "column updated_by does not exist" error.

DO $$
DECLARE
    tbl text;
    col text;
    tables text[] := ARRAY['clients', 'settings', 'audit_plans', 'audit_reports', 'checklists', 'auditors', 'documents', 'certification_decisions'];
    cols text[] := ARRAY['created_by', 'updated_by', 'auditor_id'];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        FOREACH col IN ARRAY cols LOOP
            -- Check if column exists in the table
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = tbl
                AND column_name = col
                AND table_schema = 'public'
            ) THEN
                -- Execute the ALTER statement dynamically
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', tbl, col);
                RAISE NOTICE 'Relaxed constraint on %.%', tbl, col;
            ELSE
                RAISE NOTICE 'Skipping %.% (Column does not exist)', tbl, col;
            END IF;
        END LOOP;
    END LOOP;
END $$;
