-- ============================================
-- ENHANCED INPUT VALIDATION (SCHEMA-CORRECTED)
-- ============================================
-- This version matches the actual database schema

-- 1. ADD CHECK CONSTRAINTS FOR DATA VALIDATION
-- --------------------------------------------

-- CLIENTS TABLE VALIDATION (using actual schema)
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_name_check,
  ADD CONSTRAINT clients_name_check CHECK (char_length(name) >= 2 AND char_length(name) <= 200);

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_status_check,
  ADD CONSTRAINT clients_status_check CHECK (status IS NULL OR status IN ('Active', 'Inactive', 'Suspended', 'Prospect'));

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_employees_check,
  ADD CONSTRAINT clients_employees_check CHECK (employees >= 0 AND employees <= 1000000);

-- AUDITORS TABLE VALIDATION
ALTER TABLE public.auditors
  DROP CONSTRAINT IF EXISTS auditors_name_check,
  ADD CONSTRAINT auditors_name_check CHECK (char_length(name) >= 2 AND char_length(name) <= 200);

ALTER TABLE public.auditors
  DROP CONSTRAINT IF EXISTS auditors_email_check,
  ADD CONSTRAINT auditors_email_check CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE public.auditors
  DROP CONSTRAINT IF EXISTS auditors_role_check,
  ADD CONSTRAINT auditors_role_check CHECK (role IS NULL OR role IN ('Lead Auditor', 'Auditor', 'Technical Expert', 'Trainee Auditor'));

-- AUDIT_PLANS TABLE VALIDATION
ALTER TABLE public.audit_plans
  DROP CONSTRAINT IF EXISTS audit_plans_date_not_too_old,
  ADD CONSTRAINT audit_plans_date_not_too_old CHECK (date IS NULL OR date >= CURRENT_DATE - INTERVAL '2 years');

ALTER TABLE public.audit_plans
  DROP CONSTRAINT IF EXISTS audit_plans_date_not_too_future,
  ADD CONSTRAINT audit_plans_date_not_too_future CHECK (date IS NULL OR date <= CURRENT_DATE + INTERVAL '3 years');

ALTER TABLE public.audit_plans
  DROP CONSTRAINT IF EXISTS audit_plans_status_check,
  ADD CONSTRAINT audit_plans_status_check CHECK (status IS NULL OR status IN ('Draft', 'Planned', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'));

-- Add man_days validation if column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_plans' AND column_name = 'man_days') THEN
    ALTER TABLE public.audit_plans
      DROP CONSTRAINT IF EXISTS audit_plans_man_days_check,
      ADD CONSTRAINT audit_plans_man_days_check CHECK (man_days IS NULL OR (man_days >= 0.5 AND man_days <= 100));
  END IF;
END$$;

-- AUDIT_REPORTS TABLE VALIDATION
ALTER TABLE public.audit_reports
  DROP CONSTRAINT IF EXISTS audit_reports_status_check,
  ADD CONSTRAINT audit_reports_status_check CHECK (status IS NULL OR status IN ('Draft', 'In Progress', 'In Review', 'Approved', 'Finalized', 'Published'));

ALTER TABLE public.audit_reports
  DROP CONSTRAINT IF EXISTS audit_reports_recommendation_check,
  ADD CONSTRAINT audit_reports_recommendation_check CHECK (
    recommendation IS NULL OR 
    recommendation IN ('Recommend Certification', 'Recommend with Conditions', 'Do Not Recommend', 'Suspend', 'Withdraw')
  );

-- 2. ADD TRIGGERS FOR AUTOMATIC VALIDATION
-- --------------------------------------------

-- Function to validate audit plan dates (if man_days and onsite_days columns exist)
CREATE OR REPLACE FUNCTION validate_audit_plan_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate onsite_days vs man_days if both columns exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_plans' AND column_name = 'onsite_days')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_plans' AND column_name = 'man_days') THEN
    IF NEW.onsite_days IS NOT NULL AND NEW.man_days IS NOT NULL AND NEW.onsite_days > NEW.man_days THEN
      RAISE EXCEPTION 'On-site days cannot exceed total man-days';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_plan_validation_trigger ON public.audit_plans;
CREATE TRIGGER audit_plan_validation_trigger
  BEFORE INSERT OR UPDATE ON public.audit_plans
  FOR EACH ROW
  EXECUTE FUNCTION validate_audit_plan_dates();

-- Function to prevent duplicate client names
CREATE OR REPLACE FUNCTION prevent_duplicate_client_names()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clients 
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.name))
    AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Client with name "%" already exists', NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_duplicate_name_trigger ON public.clients;
CREATE TRIGGER client_duplicate_name_trigger
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_client_names();

-- Function to validate required fields in audit reports before finalization
CREATE OR REPLACE FUNCTION validate_report_finalization()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Finalized' OR NEW.status = 'Published' THEN
    IF NEW.conclusion IS NULL OR TRIM(NEW.conclusion) = '' THEN
      RAISE EXCEPTION 'Conclusion is required before finalizing report';
    END IF;
    
    IF NEW.recommendation IS NULL THEN
      RAISE EXCEPTION 'Recommendation is required before finalizing report';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_finalization_validation_trigger ON public.audit_reports;
CREATE TRIGGER report_finalization_validation_trigger
  BEFORE UPDATE ON public.audit_reports
  FOR EACH ROW
  EXECUTE FUNCTION validate_report_finalization();

-- 3. ADD AUDIT LOGGING
-- --------------------------------------------

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID,
  user_email TEXT,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Audit log admin access" ON public.audit_log;
DROP POLICY IF EXISTS "Audit log select for admins" ON public.audit_log;

-- Only admins can view audit logs (if is_admin_or_cert_manager exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_or_cert_manager') THEN
    EXECUTE 'CREATE POLICY "Audit log admin access" ON public.audit_log
    FOR SELECT TO authenticated
    USING (is_admin_or_cert_manager())';
  ELSE
    -- Fallback: allow all authenticated users to see audit log
    EXECUTE 'CREATE POLICY "Audit log select for admins" ON public.audit_log
    FOR SELECT TO authenticated
    USING (true)';
  END IF;
END$$;

-- Function to log changes
CREATE OR REPLACE FUNCTION log_data_changes()
RETURNS TRIGGER AS $$
DECLARE
  user_id_val UUID;
  user_email_val TEXT;
BEGIN
  -- Safely get auth.uid() and auth.email() if functions exist
  BEGIN
    user_id_val := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    user_id_val := NULL;
  END;
  
  BEGIN
    user_email_val := auth.email();
  EXCEPTION WHEN OTHERS THEN
    user_email_val := current_user;
  END;

  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    user_email,
    record_id,
    old_data,
    new_data
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    user_id_val,
    user_email_val,
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
      ELSE NEW.id::TEXT
    END,
    CASE 
      WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)
      ELSE NULL
    END,
    CASE 
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)
      ELSE NULL
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit logging to critical tables
DROP TRIGGER IF EXISTS clients_audit_trigger ON public.clients;
CREATE TRIGGER clients_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION log_data_changes();

DROP TRIGGER IF EXISTS audit_plans_audit_trigger ON public.audit_plans;
CREATE TRIGGER audit_plans_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.audit_plans
  FOR EACH ROW
  EXECUTE FUNCTION log_data_changes();

DROP TRIGGER IF EXISTS audit_reports_audit_trigger ON public.audit_reports;
CREATE TRIGGER audit_reports_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.audit_reports
  FOR EACH ROW
  EXECUTE FUNCTION log_data_changes();

-- RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';

SELECT 'Enhanced input validation applied successfully!' AS status;
