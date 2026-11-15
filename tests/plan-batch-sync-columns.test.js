// The batch plan sync must only write columns that exist on audit_plans.
// auditor_ids was dropped (migrations/CLEANUP_3_TABLES_ONLY.sql); writing it
// made PostgREST reject the whole upsert ("Could not find the 'auditor_ids'
// column of 'audit_plans' in the schema cache"), so nothing was saved.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };
globalThis.Logger = window.Logger;

const SC = require('../supabase-client.js');

// Columns of the live audit_plans table (read 2026-11-15).
const LIVE_COLUMNS = new Set([
    'agenda', 'audit_team', 'audit_type', 'certification_cycle_snapshot', 'checklist_config', 'client_id',
    'client_name', 'competence_validation_snapshot', 'cost', 'coverage_matrix', 'created_at', 'created_by',
    'data', 'date', 'duration_calculation_snapshot', 'end_date', 'id', 'lead_auditor', 'lifecycle_state',
    'manDays', 'man_days', 'objectives', 'onsite_days', 'overrides', 'planning_policy_snapshot', 'pre_audit',
    'report_id', 'scope', 'selectedChecklists', 'selected_checklists', 'selected_sites', 'standard',
    'start_date', 'status', 'team', 'type', 'updated_at', 'validation_snapshot'
]);

describe('syncAuditPlansToSupabase', () => {
    let sent;
    beforeEach(() => {
        sent = null;
        SC.isInitialized = true;
        SC.client = {
            from: (table) => ({
                upsert: async (rows) => { sent = { table, rows }; return { error: null }; }
            })
        };
    });

    it('writes only columns that exist on audit_plans', async () => {
        await SC.syncAuditPlansToSupabase([{
            id: 'p1', client: 'PC CONNECTION, INC.', clientId: 'c1', standard: 'ISO/IEC 27001:2022',
            date: '2026-11-17', endDate: '2026-11-19', status: 'Scheduled', manDays: 1.5,
            auditors: ['a1', 'a2'], auditTeam: [{ id: 'a1' }], selectedChecklists: ['101'], scope: 'IT services'
        }]);
        expect(sent.table).toBe('audit_plans');
        const keys = Object.keys(sent.rows[0]);
        expect(keys).not.toContain('auditor_ids');
        expect(keys.filter(k => !LIVE_COLUMNS.has(k))).toEqual([]);
    });

    it('keeps the auditors in the data copy', async () => {
        await SC.syncAuditPlansToSupabase([{ id: 'p2', auditors: ['a1'], date: '2026-11-17' }]);
        expect(sent.rows[0].data.auditors).toEqual(['a1']);
        expect(sent.rows[0].selected_checklists).toEqual([]);
    });
});
