-- Add logo_url column to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Verify column addition
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' AND column_name = 'logo_url';
