-- Consolidate Certifications into certification_decisions
-- This makes certification_decisions the single source of truth for issued certificates

DO $$
BEGIN
    -- 1. Add ID column if missing (primary key for certs)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'id') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN id TEXT;
        -- Generate IDs for existing rows if any
        UPDATE public.certification_decisions SET id = 'CERT-' || extract(epoch from now())::text || '-' || floor(random() * 1000)::text WHERE id IS NULL;
        ALTER TABLE public.certification_decisions ADD CONSTRAINT certification_decisions_id_key UNIQUE (id);
    END IF;

    -- 2. Add Certificate Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'issue_date') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN issue_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'expiry_date') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN expiry_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'status') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN status TEXT DEFAULT 'Valid';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'scope') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN scope TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'history') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN history JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'decision_record') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN decision_record JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- 3. Ensure RLS
    ALTER TABLE public.certification_decisions ENABLE ROW LEVEL SECURITY;

END $$;

-- Proactive RLS Policies replacement
DROP POLICY IF EXISTS "Enable read access for all users" ON public.certification_decisions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.certification_decisions;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.certification_decisions;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.certification_decisions;

CREATE POLICY "Enable read access for all users" ON public.certification_decisions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.certification_decisions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.certification_decisions
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.certification_decisions
    FOR DELETE USING (auth.role() = 'authenticated');
