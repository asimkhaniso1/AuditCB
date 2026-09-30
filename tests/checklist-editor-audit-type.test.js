import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// The Create Checklist form had no Audit Type (the field had been removed,
// though the library still filters and badges by it), and a checklist created
// for a client did not keep the client either.
globalThis.window = globalThis.window || globalThis;
const fs = await import('fs');
const path = await import('path');
function loadModule(file) {
    const src = fs.readFileSync(path.resolve(file), 'utf8');
    // eslint-disable-next-line no-unused-vars
    const module = undefined;
    eval(src);
}

let realRenderLibrary;
beforeAll(() => {
    window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
    loadModule('./utils.js');
    loadModule('./validation.js');
    loadModule('./checklist-module.js');
    realRenderLibrary = window.renderChecklistLibrary;
});

function mount() {
    document.body.innerHTML = '<div id="content-area"></div>';
    window.contentArea = document.getElementById('content-area');
}

describe('Create Checklist: audit type and client are kept', () => {
    let saved;
    beforeEach(() => {
        saved = [];
        window.state = {
            currentUser: { name: 'Admin', role: 'Admin' }, checklists: [], cbSettings: { availableStandards: ['ISO 9001:2015', 'GMP'] },
            clients: [{ id: 'sg', name: 'SG 1888 (PVT.) LTD.' }]
        };
        window.showNotification = () => { };
        window.saveData = () => { };
        window.renderChecklistLibrary = () => { };
        window.SupabaseClient = { isInitialized: true, db: { insert: async (t, row) => { saved.push(row); return row; }, update: async () => ({}) } };
        mount();
    });

    it('offers Initial, Surveillance and Recertification', () => {
        window.renderChecklistEditor();
        const opts = Array.from(document.querySelectorAll('#checklist-audit-type option')).map(o => o.value);
        expect(opts).toEqual(['', 'initial', 'surveillance', 'recertification']);
    });

    it('saves the audit type and the client on create, locally and to the database', async () => {
        window.renderChecklistEditor();
        document.getElementById('checklist-name').value = 'GMP Guidelines Pakistan - Surveillance Checklist';
        document.getElementById('checklist-standard').value = 'GMP';
        document.getElementById('checklist-audit-type').value = 'surveillance';
        document.getElementById('checklist-client').value = 'sg';
        const row = document.querySelector('.checklist-item-row');
        row.querySelector('input[type="text"], input').value = '4.1';
        (row.querySelector('textarea') || row.querySelectorAll('input')[1]).value = 'Is there an organizational chart that defines responsibilities?';
        window.saveChecklistFromEditor();
        await new Promise(r => setTimeout(r, 0));

        const ck = window.state.checklists[0];
        expect(ck.auditType).toBe('surveillance');
        expect(ck.clientId).toBe('sg');
        expect(ck.clientName).toBe('SG 1888 (PVT.) LTD.');
        expect(saved[0]).toMatchObject({ audit_type: 'surveillance', client_id: 'sg', client_name: 'SG 1888 (PVT.) LTD.' });
    });

    it('New Checklist opens the analysis screen, scoped to the client being viewed', () => {
        const calls = [];
        window.showAnalysisModeModal = (...args) => calls.push(args);
        realRenderLibrary('sg');
        document.getElementById('btn-new-checklist').click();
        expect(calls).toEqual([[null, 'checklist', { clientId: 'sg' }]]);
        delete window.showAnalysisModeModal;
    });

    it('shows the saved audit type when the checklist is reopened', () => {
        window.state.checklists = [{ id: 7, name: 'x', standard: 'GMP', type: 'custom', auditType: 'recertification', clauses: [] }];
        window.renderChecklistEditor(7);
        expect(document.getElementById('checklist-audit-type').value).toBe('recertification');
    });
});
