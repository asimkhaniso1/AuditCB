-- Audit planning lifecycle and immutable decision basis.
-- Apply through the normal reviewed Supabase migration process.

CREATE TABLE IF NOT EXISTS public.certification_lifecycle_events (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    certificate_id TEXT NOT NULL,
    audit_plan_id TEXT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'certification-decision', 'certificate-issue',
        'surveillance-1-planned', 'surveillance-1-completed',
        'surveillance-2-planned', 'surveillance-2-completed',
        'recertification-planned', 'recertification-completed',
        'technical-review', 'certification-renewal',
        'suspension', 'withdrawal', 'expiry', 'authorized-override'
    )),
    stage TEXT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID NULL REFERENCES auth.users(id),
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    original_value JSONB NULL,
    override_value JSONB NULL,
    approved_by TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_lifecycle_client_certificate
    ON public.certification_lifecycle_events(client_id, certificate_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_cert_lifecycle_plan
    ON public.certification_lifecycle_events(audit_plan_id);

ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS certification_cycle_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS planning_policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS duration_calculation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS competence_validation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS validation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS coverage_matrix JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS overrides JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'Draft';

ALTER TABLE public.certification_lifecycle_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.certification_lifecycle_events TO authenticated;

DROP POLICY IF EXISTS "Authenticated read certification lifecycle" ON public.certification_lifecycle_events;
CREATE POLICY "Authenticated read certification lifecycle"
    ON public.certification_lifecycle_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authorized roles append certification lifecycle" ON public.certification_lifecycle_events;
CREATE POLICY "Authorized roles append certification lifecycle"
    ON public.certification_lifecycle_events FOR INSERT TO authenticated
    WITH CHECK (
        COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN
        ('Admin', 'Certification Manager', 'Cert Manager', 'Lead Auditor')
    );

-- No UPDATE/DELETE policies are intentionally provided: lifecycle events are append-only.
