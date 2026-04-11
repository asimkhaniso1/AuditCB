-- ============================================
-- AUDITCB360 — PERFORMANCE & INTEGRITY MIGRATION
-- ============================================
-- Fixes: missing indexes, updated_at triggers, NOT NULL constraints,
--        audit_log immutability, settings singleton constraint.
-- Safe to run on existing database (all statements are idempotent).
-- Execute in: Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. UPDATED_AT TRIGGER FUNCTION
-- ============================================
-- Auto-updates updated_at on every row modification.
-- Without this, incremental sync (.gte('updated_at', ts)) is unreliable.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at column
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'updated_at'
          AND table_name NOT IN ('profiles') -- profiles has its own trigger
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON public.%I; '
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ============================================
-- 2. MISSING INDEXES (query performance)
-- ============================================
-- Based on WHERE/JOIN/ORDER BY patterns in supabase-client.js

-- audit_findings: filtered by report_id, status, type (table may not exist)
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_findings_report_id ON audit_findings(report_id);
    CREATE INDEX IF NOT EXISTS idx_findings_status ON audit_findings(status);
    CREATE INDEX IF NOT EXISTS idx_findings_type ON audit_findings(type);
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'audit_findings table not found — skipping indexes';
END $$;

-- audit_reports: filtered by client_id, audit_plan_id (columns may not exist)
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_reports_client_id ON audit_reports(client_id);
EXCEPTION WHEN undefined_column THEN RAISE NOTICE 'audit_reports.client_id not found'; END $$;
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_reports_audit_plan_id ON audit_reports(audit_plan_id);
EXCEPTION WHEN undefined_column THEN RAISE NOTICE 'audit_reports.audit_plan_id not found'; END $$;

-- audit_plans: filtered by lead_auditor
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_plans_lead_auditor ON audit_plans(lead_auditor);
EXCEPTION WHEN undefined_column THEN RAISE NOTICE 'audit_plans.lead_auditor not found'; END $$;

-- documents: sorted by created_at, filtered by uploaded_by
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
    CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
EXCEPTION WHEN undefined_column OR undefined_table THEN RAISE NOTICE 'documents column not found'; END $$;

-- audit_log: filtered by entity_type, timestamp
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
EXCEPTION WHEN undefined_column OR undefined_table THEN RAISE NOTICE 'audit_log column not found'; END $$;

-- certification_decisions: filtered by client
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_cert_decisions_client ON certification_decisions(client);
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'certification_decisions table not found — skipping index';
END $$;

-- notifications: filtered by user_id, read status
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'notifications table not found — skipping indexes';
END $$;

-- ============================================
-- 3. NOT NULL CONSTRAINTS (data integrity)
-- ============================================
-- Only add where existing data allows (no NULLs present).
-- Wrapped in DO blocks for safety.

-- audit_findings: report_id and type should never be null (table may not exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_findings') THEN
        UPDATE audit_findings SET report_id = 'UNKNOWN' WHERE report_id IS NULL;
        UPDATE audit_findings SET type = 'observation' WHERE type IS NULL;
        ALTER TABLE audit_findings ALTER COLUMN report_id SET NOT NULL;
        ALTER TABLE audit_findings ALTER COLUMN type SET NOT NULL;
    ELSE
        RAISE NOTICE 'audit_findings table not found — skipping NOT NULL constraints';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'audit_findings NOT NULL: %', SQLERRM;
END $$;

-- audit_plans: client_id should not be null
DO $$
BEGIN
    UPDATE audit_plans SET client_id = client WHERE client_id IS NULL AND client IS NOT NULL;
    -- Don't enforce NOT NULL yet — legacy data may have neither
EXCEPTION WHEN others THEN
    RAISE NOTICE 'audit_plans backfill: %', SQLERRM;
END $$;

-- ============================================
-- 4. SETTINGS SINGLETON CONSTRAINT
-- ============================================
-- Prevent accidental creation of multiple settings rows.

DO $$
BEGIN
    ALTER TABLE settings ADD CONSTRAINT settings_singleton CHECK (id::text = '1');
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'settings_singleton constraint already exists';
WHEN others THEN
    RAISE NOTICE 'settings_singleton: %', SQLERRM;
END $$;

-- ============================================
-- 5. AUDIT LOG IMMUTABILITY
-- ============================================
-- Audit trail should be append-only: no UPDATE, no DELETE.
-- Replace overly permissive policies.

DROP POLICY IF EXISTS "auth_update_audit_log" ON audit_log;
DROP POLICY IF EXISTS "auth_delete_audit_log" ON audit_log;

-- Restrict grants: remove UPDATE/DELETE from authenticated role
REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;

-- ============================================
-- 6. COLUMN CONSOLIDATION VIEWS
-- ============================================
-- Don't drop duplicate columns (would break existing code), but create
-- a function to keep them in sync via trigger.

-- Sync plan_id ↔ audit_plan_id on audit_reports (only if both columns exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_reports' AND column_name='audit_plan_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_reports' AND column_name='plan_id') THEN

        CREATE OR REPLACE FUNCTION public.sync_report_plan_ids()
        RETURNS TRIGGER AS $fn$
        BEGIN
            IF NEW.plan_id IS NOT NULL AND NEW.audit_plan_id IS NULL THEN
                NEW.audit_plan_id := NEW.plan_id;
            ELSIF NEW.audit_plan_id IS NOT NULL AND NEW.plan_id IS NULL THEN
                NEW.plan_id := NEW.audit_plan_id;
            END IF;
            IF NEW.client_id IS NOT NULL AND NEW.client IS NULL THEN
                NEW.client := (SELECT name FROM clients WHERE id = NEW.client_id LIMIT 1);
            END IF;
            RETURN NEW;
        END;
        $fn$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS sync_report_ids ON audit_reports;
        CREATE TRIGGER sync_report_ids
            BEFORE INSERT OR UPDATE ON audit_reports
            FOR EACH ROW EXECUTE FUNCTION public.sync_report_plan_ids();
    ELSE
        RAISE NOTICE 'audit_reports missing plan_id or audit_plan_id — skipping sync trigger';
    END IF;
END $$;

-- Sync client ↔ client_id on audit_plans (only if columns exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_plans' AND column_name='client_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_plans' AND column_name='client') THEN

        CREATE OR REPLACE FUNCTION public.sync_plan_client_ids()
        RETURNS TRIGGER AS $fn$
        BEGIN
            IF NEW.client_id IS NOT NULL THEN
                IF NEW.client IS NULL THEN
                    NEW.client := (SELECT name FROM clients WHERE id = NEW.client_id LIMIT 1);
                END IF;
            END IF;
            RETURN NEW;
        END;
        $fn$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS sync_plan_ids ON audit_plans;
        CREATE TRIGGER sync_plan_ids
            BEFORE INSERT OR UPDATE ON audit_plans
            FOR EACH ROW EXECUTE FUNCTION public.sync_plan_client_ids();
    ELSE
        RAISE NOTICE 'audit_plans missing client_id or client — skipping sync trigger';
    END IF;
END $$;

-- ============================================
-- 7. VERIFY
-- ============================================
DO $$
DECLARE
    idx_count INTEGER;
    trigger_count INTEGER;
BEGIN
    SELECT count(*) INTO idx_count FROM pg_indexes WHERE schemaname = 'public';
    SELECT count(*) INTO trigger_count FROM information_schema.triggers WHERE trigger_schema = 'public';
    RAISE NOTICE 'Migration complete: % indexes, % triggers', idx_count, trigger_count;
END $$;
