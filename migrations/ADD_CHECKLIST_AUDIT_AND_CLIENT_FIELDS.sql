-- ADD_CHECKLIST_AUDIT_AND_CLIENT_FIELDS.sql
-- Adds columns required by the client mapping in
-- supabase-client.js → syncChecklistsFromSupabase()
-- (audit_type, audit_scope, client_name, client_id, archived).
-- Without these, PostgREST returns 400 on any select that references
-- them and the Checklist Library renders empty (0/0/0/0).
--
-- Idempotent: safe to re-run. No data loss.

ALTER TABLE checklists ADD COLUMN IF NOT EXISTS archived    boolean DEFAULT false;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS audit_type  text;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS audit_scope text;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS client_id   text;

-- Verification
SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'checklists'
ORDER  BY ordinal_position;
