-- ============================================================================
-- HEAL_PLAN_TEXT_AND_CHECKLIST_STANDARDS.sql
--
-- DATA migration (no schema change). Idempotent — safe to run more than once.
-- The application heals the same records itself on sign-in
-- (DataMigration.healPlansAndChecklists), so running this is OPTIONAL: it repairs
-- the cloud copy for every device at once, and is the way to confirm the fix on
-- rows nobody has opened yet.
--
-- WHY
--   1. Checklists: the standards a checklist is tied to are stored only inside
--      qa_context->'standardIds'. A row that lost them made ChecklistCoverage
--      report "not tied to a standard in the clause registry" while ChecklistQA
--      (which parses the standard NAME) reported "passed". Both now use one
--      resolver; this backfills the ids from the standard name.
--   2. Audit plans: agenda text was HTML-escaped on WRITE (Sanitizer.sanitizeText)
--      and escaped AGAIN when the edit form re-populated it, so every
--      edit->save added an entity layer ("Patch &amp;amp; Vulnerability") and the
--      PDF printed literal "&amp;". Text is now stored plain; this strips the
--      layers from rows already saved.
--
-- NO SCHEMA CHANGE IS NEEDED for the new fields. The plan's document status,
-- approval, status history, agreed time zone, traceability record, full duration
-- record and the richer agenda rows all live in audit_plans.data / agenda (jsonb).
-- Observation and OFI responses (management evaluation, disposition, OFI decision,
-- improvement-register link, escalation link) are written onto the existing
-- report records in audit_reports.data. Nothing here needs to run before the
-- JavaScript is deployed.
--
-- HOW TO USE: run the PREVIEW block first and read the counts, then the UPDATEs.
-- ============================================================================

-- ── PREVIEW ─────────────────────────────────────────────────────────────────
SELECT 'checklists with no standard ids' AS what, count(*) AS rows
FROM checklists
WHERE coalesce(jsonb_array_length(qa_context->'standardIds'), 0) = 0
  AND standard IS NOT NULL
UNION ALL
SELECT 'audit_plans with entity-escaped agenda text', count(*)
FROM audit_plans
WHERE agenda::text LIKE '%&amp;%' OR agenda::text LIKE '%&lt;%' OR agenda::text LIKE '%&gt;%' OR agenda::text LIKE '%&quot;%' OR agenda::text LIKE '%&#39;%';

-- ── 1. checklists: backfill qa_context.standardIds from the standard name ───
-- Registry ids: iso27001, iso22301, iso20000 (checklist-standards.js). Only
-- rows that carry NO ids are touched; a recorded association is never replaced.
UPDATE checklists c
SET qa_context = coalesce(c.qa_context, '{}'::jsonb) || jsonb_build_object('standardIds', ids.list),
    updated_at = now()
FROM (
    SELECT id,
           (SELECT coalesce(jsonb_agg(x ORDER BY ord), '[]'::jsonb)
              FROM (VALUES (1, 'iso27001', standard ~* '27001'),
                           (2, 'iso22301', standard ~* '22301'),
                           (3, 'iso20000', standard ~* '20000')) AS v(ord, x, hit)
             WHERE hit) AS list
    FROM checklists
) ids
WHERE c.id = ids.id
  AND coalesce(jsonb_array_length(c.qa_context->'standardIds'), 0) = 0
  AND jsonb_array_length(ids.list) > 0;

-- ── 2. audit_plans: strip HTML-entity layers from agenda text ───────────────
-- Applied to the jsonb as text, repeatedly, because a record edited twice reads
-- "&amp;amp;". "&amp;" must be decoded LAST so "&amp;lt;" cannot become "<".
CREATE OR REPLACE FUNCTION pg_temp.decode_entities(t text) RETURNS text AS $$
DECLARE prev text; cur text := t; i int := 0;
BEGIN
    LOOP
        prev := cur;
        cur := replace(replace(replace(replace(replace(cur, '&#39;', ''''), '&quot;', '\"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&');
        i := i + 1;
        EXIT WHEN cur = prev OR i > 6;
    END LOOP;
    RETURN cur;
END $$ LANGUAGE plpgsql IMMUTABLE;

UPDATE audit_plans
SET agenda = pg_temp.decode_entities(agenda::text)::jsonb,
    updated_at = now()
WHERE agenda::text LIKE '%&amp;%' OR agenda::text LIKE '%&lt;%' OR agenda::text LIKE '%&gt;%' OR agenda::text LIKE '%&quot;%' OR agenda::text LIKE '%&#39;%';

-- The catch-all copy of the plan (data) carries the same agenda and narratives.
UPDATE audit_plans
SET data = pg_temp.decode_entities(data::text)::jsonb,
    updated_at = now()
WHERE data IS NOT NULL
  AND (data::text LIKE '%&amp;%' OR data::text LIKE '%&lt;%' OR data::text LIKE '%&gt;%' OR data::text LIKE '%&quot;%' OR data::text LIKE '%&#39;%');

-- ── VERIFY (both should return 0) ───────────────────────────────────────────
SELECT 'checklists still without standard ids' AS what, count(*) AS rows
FROM checklists
WHERE coalesce(jsonb_array_length(qa_context->'standardIds'), 0) = 0
  AND (standard ~* '27001' OR standard ~* '22301' OR standard ~* '20000')
UNION ALL
SELECT 'audit_plans still entity-escaped', count(*)
FROM audit_plans
WHERE agenda::text LIKE '%&amp;%' OR data::text LIKE '%&amp;%';
