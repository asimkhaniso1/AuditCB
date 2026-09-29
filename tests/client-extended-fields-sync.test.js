import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };
globalThis.Logger = window.Logger;
const SC = require('../supabase-client.js');

// Client fields without a column of their own must round-trip through
// clients.data, or they live in one browser only. compliance (contract, NDA,
// application status, ISO 17021-1 9.6.2 changes log) never reached the cloud.
const COMPLIANCE = {
    applicationStatus: 'Contract Signed',
    contract: { number: 'CCI-2026-014', signedDate: '2026-03-01' },
    nda: { signed: true, date: '2026-03-01' },
    changesLog: [{ date: '2026-08-10', type: 'Scope', description: 'Added cGMP line', reportedBy: 'QA Manager' }]
};

function fakeDb(rowsToReturn) {
    const calls = { upserts: [] };
    const chain = {
        upsert(payload) { calls.upserts.push(payload); return chain; },
        select() { return Promise.resolve({ data: [], error: null }); },
        order() { return Promise.resolve({ data: rowsToReturn || [], error: null }); }
    };
    return { calls, client: { from: () => chain } };
}

describe('client fields carried in clients.data', () => {
    beforeEach(() => {
        window.state = { clients: [], currentUser: { id: 'u1' } };
        SC.isInitialized = true;
        SC._buildSyncQuery = () => ({ query: { order: () => Promise.resolve({ data: [], error: null }) }, isIncremental: false });
        SC._setSyncTimestamp = () => { };
    });

    it('saves compliance, the registry id and group name with the client', async () => {
        const db = fakeDb();
        SC.client = db.client;
        await SC.upsertClient({ id: 'sg', name: 'SG 1888', compliance: COMPLIANCE, cciCompanyId: 'cci-77', groupName: 'SG Group', profileDocument: { name: 'profile.pdf', size: 10 } });
        const data = db.calls.upserts[0].data;
        expect(data.compliance).toEqual(COMPLIANCE);
        expect(data.cciCompanyId).toBe('cci-77');
        expect(data.groupName).toBe('SG Group');
        expect(data.profileDocument.name).toBe('profile.pdf');
    });

    it('keeps large transient profile content out of the cloud row', async () => {
        const db = fakeDb();
        SC.client = db.client;
        await SC.upsertClient({ id: 'sg', name: 'SG 1888', profileDocumentBase64: 'AAAA', profileDocumentText: 'long text' });
        const data = db.calls.upserts[0].data;
        expect(data.profileDocumentBase64).toBeUndefined();
        expect(data.profileDocumentText).toBeUndefined();
    });

    it('the bulk save carries them too', async () => {
        const db = fakeDb();
        SC.client = db.client;
        await SC.syncClientsToSupabase([{ id: 'sg', name: 'SG 1888', compliance: COMPLIANCE }]);
        expect(db.calls.upserts[0][0].data.compliance).toEqual(COMPLIANCE);
    });

    it('reads them back on load — and a cloud row without them does not blank the local copy', async () => {
        window.state.clients = [{ id: 'old', name: 'Old Row Ltd', compliance: { applicationStatus: 'Active (local)' } }];
        const rows = [
            { id: 'sg', name: 'SG 1888', data: { compliance: COMPLIANCE, cciCompanyId: 'cci-77' } },
            { id: 'old', name: 'Old Row Ltd', data: { certificates: [] } }
        ];
        SC._buildSyncQuery = () => ({ query: { order: () => Promise.resolve({ data: rows, error: null }) }, isIncremental: false });
        await SC.syncClientsFromSupabase();
        const sg = window.state.clients.find(c => c.id === 'sg');
        expect(sg.compliance).toEqual(COMPLIANCE);
        expect(sg.cciCompanyId).toBe('cci-77');
        expect(window.state.clients.find(c => c.id === 'old').compliance.applicationStatus).toBe('Active (local)');
    });
});
