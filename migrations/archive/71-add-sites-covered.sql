-- Add sites_covered column to certification_decisions
-- This allows linking specific client sites to a certificate

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'sites_covered') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN sites_covered JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;
