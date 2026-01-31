-- ==========================================
-- 73. ADD MISSING CERTIFICATE COLUMNS
-- ==========================================

DO $$
BEGIN
    -- 1. Add 'certificate_no' (TEXT)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'certificate_no') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN certificate_no TEXT;
    END IF;

    -- 2. Add 'revision' (TEXT) - e.g. "00", "01"
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'revision') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN revision TEXT DEFAULT '00';
    END IF;

    -- 3. Add 'site_scopes' (JSONB) - Mapping of site names to specific scope text
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'site_scopes') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN site_scopes JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- 4. Add 'initial_date' (DATE) 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'initial_date') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN initial_date DATE;
    END IF;

    -- 5. Add 'current_issue' (DATE)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'current_issue') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN current_issue DATE;
    END IF;

END $$;
