import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// supabase-js does NOT throw on an RLS or schema failure — it resolves with
// { data: null, error }. Writers that only wrapped the await in try/catch
// treated every such failure as success. upsertChecklist / deleteChecklist read
// the error and hand back { ok: false, error } so the caller can tell the user.
globalThis.window = globalThis.window || globalThis;
window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };
globalThis.Logger = window.Logger;
const SC = require('../supabase-client.js');

function fakeClient(result) {
    const calls = { upserts: [], deletes: [] };
    const chain = {
        upsert(row, opts) { calls.upserts.push({ row, opts }); return typeof result === 'function' ? result() : Promise.resolve(result); },
        delete() { return { eq(col, val) { calls.deletes.push({ col, val }); return typeof result === 'function' ? result() : Promise.resolve(result); } }; }
    };
    return { calls, client: { from: vi.fn(() => chain) } };
}

const CHECKLIST = {
    id: 1712345678901,
    name: 'ISO 9001 - Acme - Initial Audit Checklist',
    standard: 'ISO 9001:2015',
    type: 'custom',
    auditType: 'initial',
    auditScope: 'Design and manufacture',
    clientId: 'acme',
    clientName: 'Acme Ltd',
    clauses: [{ mainClause: '4', subClauses: [] }],
    createdBy: 'Admin',
    readyForAudit: { released: true },
    resolvedIssues: { 'Q-1': 'accepted' },
    qaContext: { standardIds: ['iso9001'] },
    sourceDocumentSnapshot: [{ name: 'QM.pdf' }]
};

describe('SupabaseClient.upsertChecklist', () => {
    beforeEach(() => {
        SC.isInitialized = true;
        window.Logger.error = vi.fn();
    });

    it('writes the canonical row and reports success', async () => {
        const db = fakeClient({ data: null, error: null });
        SC.client = db.client;
        const res = await SC.upsertChecklist(CHECKLIST);
        expect(res).toEqual({ ok: true });
        expect(db.client.from).toHaveBeenCalledWith('checklists');
        const { row, opts } = db.calls.upserts[0];
        expect(opts).toEqual({ onConflict: 'id' });
        expect(row).toMatchObject({
            id: '1712345678901',
            name: CHECKLIST.name,
            standard: 'ISO 9001:2015',
            type: 'custom',
            audit_type: 'initial',
            audit_scope: 'Design and manufacture',
            created_by: 'Admin',
            client_id: 'acme',
            client_name: 'Acme Ltd',
            clauses: CHECKLIST.clauses,
            ready_for_audit: { released: true },
            resolved_issues: { 'Q-1': 'accepted' },
            qa_context: { standardIds: ['iso9001'], sourceDocuments: [{ name: 'QM.pdf' }] }
        });
        expect(typeof row.updated_at).toBe('string');
        // created_at is left to the column default so an update keeps the original.
        expect('created_at' in row).toBe(false);
    });

    it('the bulk sync writes the same row shape', async () => {
        const upsert = vi.fn(() => Promise.resolve({ error: null }));
        SC.client = { from: () => ({ upsert }) };
        await SC.syncChecklistsToSupabase([CHECKLIST]);
        const bulkRow = upsert.mock.calls[0][0][0];
        const single = SC._checklistRow(CHECKLIST);
        delete bulkRow.updated_at; delete single.updated_at;
        expect(bulkRow).toEqual(single);
    });

    it('reports failure when supabase-js returns an error (RLS / schema)', async () => {
        const rlsError = { message: 'new row violates row-level security policy for table "checklists"', code: '42501' };
        const db = fakeClient({ data: null, error: rlsError });
        SC.client = db.client;
        const res = await SC.upsertChecklist(CHECKLIST);
        expect(res.ok).toBe(false);
        expect(res.error).toBe(rlsError);
        expect(window.Logger.error).toHaveBeenCalled();
    });

    it('reports failure when the client throws (network)', async () => {
        const db = fakeClient(() => Promise.reject(new Error('Failed to fetch')));
        SC.client = db.client;
        const res = await SC.upsertChecklist(CHECKLIST);
        expect(res.ok).toBe(false);
        expect(res.error.message).toBe('Failed to fetch');
    });

    it('reports failure, without calling the client, when Supabase is not initialised', async () => {
        const db = fakeClient({ error: null });
        SC.client = db.client;
        SC.isInitialized = false;
        const res = await SC.upsertChecklist(CHECKLIST);
        expect(res.ok).toBe(false);
        expect(db.client.from).not.toHaveBeenCalled();
    });
});

describe('SupabaseClient.deleteChecklist', () => {
    beforeEach(() => { SC.isInitialized = true; });

    it('deletes by id and reports success', async () => {
        const db = fakeClient({ error: null });
        SC.client = db.client;
        expect(await SC.deleteChecklist(42)).toEqual({ ok: true });
        expect(db.calls.deletes[0]).toEqual({ col: 'id', val: '42' });
    });

    it('reports a returned error', async () => {
        const db = fakeClient({ error: { message: 'permission denied' } });
        SC.client = db.client;
        const res = await SC.deleteChecklist(42);
        expect(res.ok).toBe(false);
        expect(res.error.message).toBe('permission denied');
    });
});
