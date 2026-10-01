import { describe, it, expect, beforeEach, vi } from 'vitest';

// Creating a checklist — from the Checklists page or from a standard's
// analysis view — goes through the same Configure Analysis screen as the
// Knowledge Base analysis: standard, audit type (Initial / Surveillance /
// Recertification), client and depth. The checklist keeps the audit type and
// client chosen there.
globalThis.window = globalThis.window || globalThis;
window.state = window.state || {};
window.state.knowledgeBase = { standards: [], sops: [], policies: [], marketing: [] };
window.switchSettingsSubTab = () => {};

const fs = await import('fs');
const path = await import('path');
const utils = await import('../utils.js');
window.UTILS = window.UTILS || utils.default || utils;
new Function(fs.readFileSync(path.resolve('./settings-kb.js'), 'utf8'))();

const GMP = {
    id: 9001, name: 'GMP Guidelines Pakistan', fileName: 'GMP.pdf', uploadDate: '2026-09-29', status: 'ready',
    clauses: [{ clause: '4.1', title: 'Organisation' }],
    generatedChecklist: [
        { clause: '4.1', requirement: 'Is there an organizational chart that defines responsibilities?' },
        { clause: '4.2', requirement: 'Are specific duties of personnel recorded in writing?' }
    ],
    lastAuditType: 'initial', lastAnalysisMode: 'standard', lastClientId: '', lastClientName: ''
};

function mount() {
    document.body.innerHTML = '<h3 id="modal-title"></h3><div id="modal-body"></div><div id="modal-save"></div>';
}

describe('Checklist creation uses the analysis screen', () => {
    let notes, upserts;
    beforeEach(() => {
        notes = [];
        upserts = [];
        window.showNotification = (msg, type) => notes.push({ msg, type });
        window.openModal = () => {};
        window.closeModal = () => {};
        window.saveData = () => {};
        window.DataService = { syncSettings: vi.fn(async () => true) };
        window.state.checklists = [];
        window.state.currentUser = { name: 'Admin' };
        window.state.clients = [{ id: 'sg', name: 'SG 1888 (PVT.) LTD.' }];
        window.state.knowledgeBase = { standards: [JSON.parse(JSON.stringify(GMP))], sops: [], policies: [], marketing: [] };
        window.SupabaseClient = {
            isInitialized: true,
            client: { from: () => ({ upsert: async (row) => { upserts.push(row); return {}; } }) }
        };
        window.AI_SERVICE = undefined;
        mount();
    });

    it('New Checklist shows the standard picker, three audit types, client and the depth cards', () => {
        window.showAnalysisModeModal(null, 'checklist', { clientId: 'sg' });
        const body = document.getElementById('modal-body');
        const std = Array.from(body.querySelectorAll('#analysis-standard-select option')).map(o => o.value);
        expect(std).toEqual(['', '9001']);
        expect(['at-initial', 'at-surveillance', 'at-recertification'].every(id => document.getElementById(id))).toBe(true);
        expect(document.getElementById('analysis-client-select').value).toBe('sg');
        const depths = Array.from(body.querySelectorAll('[data-action="_startAnalysis"]')).map(d => [d.dataset.arg2, d.dataset.arg3, d.dataset.arg1]);
        expect(depths).toEqual([['short', 'checklist', ''], ['standard', 'checklist', ''], ['comprehensive', 'checklist', '']]);
        expect(body.querySelector('[data-action="_buildChecklistManually"]')).toBeTruthy();
        expect(document.getElementById('modal-title').textContent).toBe('New Checklist');
    });

    it('limits the standard list to what the chosen client holds', () => {
        const kb = window.state.knowledgeBase.standards;
        kb.push(Object.assign({}, GMP, { id: 1, name: 'ISO 9001:2015' }), Object.assign({}, GMP, { id: 2, name: 'ISO 14001:2015' }),
            Object.assign({}, GMP, { id: 3, name: 'ISO 13485:2016' }));
        window.state.clients = [
            { id: 'sg', name: 'SG 1888 (PVT.) LTD.', standard: 'ISO 9001:2015', certificates: [{ standard: 'Halal' }, { standard: 'cGMP' }] },
            { id: 'ems', name: 'EMS Client', standard: 'ISO 14001:2015' },
            { id: 'new', name: 'New Client' }
        ];
        const options = () => Array.from(document.querySelectorAll('#analysis-standard-select option')).map(o => o.textContent.trim());
        const pick = (id) => { const sel = document.getElementById('analysis-client-select'); sel.value = id; sel.dispatchEvent(new Event('change')); };

        // Opened from SG 1888's page: the GMP guideline (their cGMP) and ISO 9001 only.
        window.showAnalysisModeModal(null, 'checklist', { clientId: 'sg' });
        expect(options()).toEqual(['— Select a Knowledge Base standard —', 'GMP Guidelines Pakistan', 'ISO 9001:2015']);
        expect(document.getElementById('analysis-standard-hint').textContent).toMatch(/Limited to SG 1888 \(PVT\.\) LTD\.'s Applicable Standards: ISO 9001:2015, Halal, cGMP/);

        // Switching client re-filters; a selection that is still valid is kept.
        document.getElementById('analysis-standard-select').value = '1';
        pick('ems');
        expect(options()).toEqual(['— Select a Knowledge Base standard —', 'ISO 14001:2015']);
        expect(document.getElementById('analysis-standard-select').value).toBe('');

        // No client, or a client with no standards recorded: the whole Knowledge Base.
        pick('');
        expect(options()).toHaveLength(5);
        expect(document.getElementById('analysis-standard-hint').textContent).toBe('');
        pick('new');
        expect(options()).toHaveLength(5);
    });

    it('says so when the Knowledge Base has nothing for the client’s standards', () => {
        window.state.clients = [{ id: 'h', name: 'Halal Only', standard: 'Halal' }];
        window.showAnalysisModeModal(null, 'checklist', { clientId: 'h' });
        const opts = Array.from(document.querySelectorAll('#analysis-standard-select option'));
        expect(opts).toHaveLength(1);
        expect(opts[0].textContent).toMatch(/No Knowledge Base standard for Halal Only \(Halal\)/);
    });

    it('asks for the standard before generating', async () => {
        window.showAnalysisModeModal(null, 'checklist');
        await window._startAnalysis('', 'standard', 'checklist');
        expect(window.state.checklists).toHaveLength(0);
        expect(notes.pop().msg).toMatch(/Select the standard/);
    });

    it('creates a recertification checklist for the chosen client, locally and in the database', async () => {
        window.showAnalysisModeModal(null, 'checklist');
        document.getElementById('analysis-standard-select').value = '9001';
        document.getElementById('analysis-client-select').value = 'sg';
        window._setAuditType('recertification');
        window.AI_SERVICE = { callProxyAPI: vi.fn(async () => JSON.stringify([
            { clause: '4.1', title: 'Organisation', requirement: 'x', checklistQuestions: ['Is the organisation chart current?'] },
            { clause: '5.1', title: 'Personnel', requirement: 'y', checklistQuestions: ['Are duties defined?'] }
        ])) };
        await window._startAnalysis('', 'short', 'checklist');

        const ck = window.state.checklists[0];
        expect(ck).toBeTruthy();
        expect(ck.auditType).toBe('recertification');
        expect(ck.clientId).toBe('sg');
        expect(ck.clientName).toBe('SG 1888 (PVT.) LTD.');
        expect(ck.type).toBe('custom');
        expect(ck.name).toBe('GMP Guidelines Pakistan - SG 1888 (PVT.) LTD. - Recertification Audit Checklist');
        expect(upserts[0]).toMatchObject({ audit_type: 'recertification', client_id: 'sg', client_name: 'SG 1888 (PVT.) LTD.' });
        // Recertification is analysed as a full-scope audit and re-analysed for the client.
        expect(window.AI_SERVICE.callProxyAPI).toHaveBeenCalled();
        const doc = window.state.knowledgeBase.standards[0];
        expect(doc.lastAuditType).toBe('initial');
        expect(doc.lastClientId).toBe('sg');
    });

    it('labels the checklist with the standard, not the Knowledge Base document title', async () => {
        // A cGMP client: the GMP guideline is their cGMP checklist.
        window.state.clients = [{ id: 'sg', name: 'SG 1888 (PVT.) LTD.', standard: 'ISO 9001:2015', certificates: [{ standard: 'Halal' }, { standard: 'cGMP' }] }];
        window.state.knowledgeBase.standards[0].lastClientId = 'sg';
        const forClient = await window.generateChecklistFromStandard(9001, 'standard', 'initial', 'sg');
        expect(forClient.standard).toBe('cGMP');
        // No client: the scheme the title names.
        window.state.knowledgeBase.standards[0].lastClientId = '';
        const generic = await window.generateChecklistFromStandard(9001, 'standard', 'initial', '');
        expect(generic.standard).toBe('GMP');
        // An ISO document is already a standard.
        window.state.knowledgeBase.standards.push(Object.assign({}, GMP, { id: 7, name: 'ISO 14001:2026' }));
        const iso = await window.generateChecklistFromStandard(7, 'standard', 'initial', '');
        expect(iso.standard).toBe('ISO 14001:2026');
        // ...and is never swapped for another edition the client happens to hold.
        window.state.clients = [{ id: 'e', name: 'EMS Client', standard: 'ISO 14001:2015' }];
        window.state.knowledgeBase.standards[1].lastClientId = 'e';
        const held2015 = await window.generateChecklistFromStandard(7, 'standard', 'initial', 'e');
        expect(held2015.standard).toBe('ISO 14001:2026');
    });

    it('a fresh analysis whose parts overlap stores each clause once', async () => {
        // Standard depth runs several batches; the model returned the same
        // clauses for each, as overlapping batches do at their edges.
        window.AI_SERVICE = { callProxyAPI: vi.fn(async () => JSON.stringify([
            { clause: '4.1', title: 'Organisation', requirement: 'x', checklistQuestions: ['Is the organisation chart current?'] },
            { clause: '5.1', title: 'Personnel', requirement: 'y', checklistQuestions: ['Are duties defined?'] }
        ])) };
        const doc = window.state.knowledgeBase.standards[0];
        await window.generateChecklistFromStandard(9001, 'standard', 'surveillance', '');
        expect(window.AI_SERVICE.callProxyAPI.mock.calls.length).toBeGreaterThan(1);
        expect(doc.clauses.map(c => c.clause)).toEqual(['4.1', '5.1']);
        expect(doc.generatedChecklist.map(q => q.clause)).toEqual(['4.1', '5.1']);
    });

    it('reuses the last analysis when it already matches the chosen settings', async () => {
        window.AI_SERVICE = { callProxyAPI: vi.fn() };
        const ck = await window.generateChecklistFromStandard(9001, 'standard', 'initial', '');
        expect(window.AI_SERVICE.callProxyAPI).not.toHaveBeenCalled();
        expect(ck.auditType).toBe('initial');
        expect(ck.type).toBe('global');
        expect(ck.clauses.flatMap(c => c.subClauses)).toHaveLength(2);
    });

    it('creates no checklist when the analysis yields no questions, instead of reusing an older run', async () => {
        window.AI_SERVICE = { callProxyAPI: vi.fn(async () => 'not json') };
        const ck = await window.generateChecklistFromStandard(9001, 'standard', 'surveillance', '');
        expect(ck).toBeNull();
        expect(window.state.checklists).toHaveLength(0);
        expect(notes.some(n => n.type === 'error' && /no checklist was created/.test(n.msg))).toBe(true);
    });

    it("the analysis view's Create Checklist opens the screen for that standard", () => {
        window.state.auditReports = [];
        window.viewKBAnalysis(9001);
        const btn = document.querySelector('#modal-body [data-action="openCreateChecklistFromKB"]');
        expect(btn).toBeTruthy();
        window.openCreateChecklistFromKB(9001);
        expect(document.getElementById('analysis-standard-select')).toBeNull();
        const card = document.querySelector('[data-action="_startAnalysis"]');
        expect(card.dataset.arg1).toBe('9001');
        expect(card.dataset.arg3).toBe('checklist');
        expect(document.getElementById('modal-body').textContent).toMatch(/GMP Guidelines Pakistan/);
    });

    it('Analyze Now no longer runs as a re-analysis (the "false" attribute was truthy)', async () => {
        window.analyzeStandard = vi.fn();
        window.reanalyzeStandard = vi.fn();
        window.showAnalysisModeModal(9001, false);
        const card = document.querySelector('[data-action="_startAnalysis"]');
        expect(card.dataset.arg3).toBe('analyze');
        window._setAuditType('recertification');
        await window._startAnalysis('9001', 'short', card.dataset.arg3);
        expect(window.reanalyzeStandard).not.toHaveBeenCalled();
        expect(window.analyzeStandard).toHaveBeenCalledWith('9001', 'short', 'initial', '');
    });
});
