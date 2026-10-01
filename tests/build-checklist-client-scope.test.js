import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { M, B } from '../tools/pcc-scenario.mjs';

// Build Checklist (from client documents) listed the whole clause registry
// under "Audit scope — standards": ISO/IEC 27001, ISO 22301, ISO/IEC 20000-1,
// ISO 14001 and ISO 45001 for SG 1888, which holds ISO 9001:2015, Halal and
// cGMP. The list is gated by the client's Applicable Standards.
const DOC = [{ id: 'd1', name: 'Quality Manual', docNumber: 'QM-01' }];
const SG = () => ({
    id: 'sg', name: 'SG 1888 (PVT.) LTD.', standard: 'ISO 9001:2015', documents: DOC,
    certificates: [{ standard: 'ISO 9001:2015' }, { standard: 'Halal' }, { standard: 'cGMP' }],
    sites: [{ name: 'Head Office', standards: 'ISO 9001:2015, Halal, cGMP' }]
});

let html; let save; let notes = [];
function open(client, presetStandard) {
    html = '';
    window.UTILS = M.UTILS;
    window.state = { clients: [client], auditPlans: [] };
    window.DataService = {
        findClient: (id) => (String(id) === String(client.id) ? client : null),
        findAuditPlan: () => null,
        openFormModal: (_title, body, onSave) => { html = body; document.body.innerHTML = body; save = onSave; }
    };
    window.saveData = () => { };
    window.closeModal = () => { };
    window.SupabaseClient = undefined;
    notes = [];
    window.showNotification = (msg, type) => notes.push({ msg, type });
    window.buildChecklistFromClientDocs(client.id, 'surveillance', presetStandard);
}
const offered = () => Array.from(document.querySelectorAll('.cldoc-std')).map(cb => cb.value);
const ticked = () => Array.from(document.querySelectorAll('.cldoc-std:checked')).map(cb => cb.value);
const schemes = () => Array.from(document.querySelectorAll('.cldoc-scheme')).map(cb => cb.value);
const tickedSchemes = () => Array.from(document.querySelectorAll('.cldoc-scheme:checked')).map(cb => cb.value);

describe('Build Checklist — audit scope is the client’s standards', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('SG 1888 is offered ISO 9001 only, with Halal and cGMP named as schemes', () => {
        open(SG());
        expect(offered()).toEqual(['iso9001']);
        expect(ticked()).toEqual(['iso9001']);
        expect(html).toMatch(/Halal, cGMP<\/strong> have no clause set in the registry/);
        // ...and both are selectable, unticked until chosen.
        expect(schemes()).toEqual(['Halal', 'cGMP']);
        expect(tickedSchemes()).toEqual([]);
        expect(html).not.toMatch(/27001|22301|20000-1|14001|45001/);
        expect(document.getElementById('cldoc-soa')).toBeNull();   // no ISO 27001 -> no SoA field
    });

    it('reads standards held only on the certificates or the site', () => {
        const c = SG(); c.standard = ''; c.certificates = [{ standard: 'ISO 14001:2015' }]; c.sites = [{ standards: 'ISO 45001:2018' }];
        open(c);
        expect(offered().sort()).toEqual(['iso14001', 'iso45001']);
    });

    it('an integrated ISMS client keeps all three, and the SoA field', () => {
        const c = { id: 'pcc', name: 'PC CONNECTION, INC.', standard: 'ISO/IEC 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018', documents: DOC };
        open(c);
        expect(offered().sort()).toEqual(['iso20000', 'iso22301', 'iso27001']);
        expect(document.getElementById('cldoc-soa')).toBeTruthy();
    });

    it('a client with no standards recorded still sees the registry', () => {
        open({ id: 'n', name: 'New Client', documents: DOC });
        expect(offered().length).toBe(M.CS.all().length);
        expect(ticked()).toEqual([]);
    });
});

describe('Build Checklist — schemes (Halal, cGMP) are selectable', () => {
    const tick = (cls, value, on) => { const el = document.querySelector(`.${cls}[value="${value}"]`); el.checked = on; };
    const flush = () => new Promise(r => setTimeout(r, 0));

    it('a cGMP plan opens on cGMP, not on the client’s ISO 9001', () => {
        open(SG(), 'cGMP');
        expect(tickedSchemes()).toEqual(['cGMP']);
        expect(ticked()).toEqual([]);
        expect(offered()).toEqual(['iso9001']);      // still offered, just not ticked
    });

    it('builds a cGMP surveillance checklist for the client that can be released', async () => {
        open(SG(), 'cGMP');
        await save();
        await flush();
        const ck = window.state.checklists[0];
        expect(ck).toBeTruthy();
        expect(ck.standard).toBe('cGMP');
        expect(String(ck.clientId)).toBe('sg');
        expect(ck.clauses.flatMap(c => c.subClauses || []).length).toBeGreaterThan(0);
        // No ISO 9001 clause set was borrowed for it.
        expect(M.CC.resolveStandardIds(ck).ids).toEqual([]);
        const coverage = M.CC.assess(ck, M.CC.buildContext(ck, { client: SG() }));
        expect(coverage.outcome).toBe('not-assessed');
    });

    it('two schemes can be built together; a scheme and an ISO standard cannot', async () => {
        open(SG());
        tick('cldoc-std', 'iso9001', true); tick('cldoc-scheme', 'Halal', true);
        await save();
        expect(window.state.checklists || []).toHaveLength(0);
        expect(notes.pop().msg).toMatch(/Halal has no clause set in the registry or the Knowledge Base, so it cannot share a checklist/);

        tick('cldoc-std', 'iso9001', false); tick('cldoc-scheme', 'cGMP', true);
        await save();
        await flush();
        expect(window.state.checklists[0].standard).toBe('Halal, cGMP');
    });

    it('asks for a standard when nothing is ticked', async () => {
        open(SG());
        tick('cldoc-std', 'iso9001', false);
        await save();
        expect(window.state.checklists || []).toHaveLength(0);
        expect(notes.pop().msg).toMatch(/Tick the standard/);
    });

    it('an initial cGMP checklist takes its clauses from the scheme’s Knowledge Base document', async () => {
        open(SG(), 'cGMP');
        window._resolveChecklistStandard = (doc, client) => (/GMP/.test(doc.name) && M.UTILS.clientStandards(client).includes('cGMP') ? 'cGMP' : doc.name);
        window.state.knowledgeBase = { standards: [{ id: 9, name: 'GMP Guidelines Pakistan', status: 'ready',
            clauses: [{ clause: '4.1', title: 'Organisation and personnel', requirement: 'An organisation chart shall define GMP responsibilities.' }] }] };
        expect(document.body.innerHTML).toBeTruthy();
        // Re-open so the note reads the Knowledge Base now in state.
        const kb = window.state.knowledgeBase;
        open(SG(), 'cGMP'); window.state.knowledgeBase = kb;
        document.getElementById('cldoc-audit-type').value = 'initial';
        await save();
        await flush();
        const text = JSON.stringify(window.state.checklists[0].clauses);
        expect(text).toMatch(/Organisation and personnel|organisation chart shall define GMP/);
        delete window._resolveChecklistStandard;
    });
});

describe('Build Checklist — Knowledge Base standards join the registry ones in one checklist', () => {
    // Language Services UK: ISO 9001, 14001 and 27001 are in the clause
    // registry; ISO 17100 and ISO 18841 are analysed in the Knowledge Base.
    // They were labelled "schemes" and refused alongside the ISO standards.
    const kbClauses = (tag, n) => Array.from({ length: n }, (_, i) => ({
        clause: `${4 + Math.floor(i / 3)}.${(i % 3) + 1}`, title: `${tag} requirement ${i + 1}`,
        requirement: `The provider shall control ${tag} item ${i + 1}.`, checklistQuestions: [`How is ${tag} item ${i + 1} controlled?`]
    }));
    const LS = () => ({
        id: 'ls', name: 'Language Services UK Limited', documents: DOC,
        standard: 'ISO 9001:2015, ISO 14001:2015, ISO 27001:2022, ISO 17100:2015, ISO 18841:2018, ISO 18587:2017',
        keyProcesses: [{ name: 'Translation' }], sites: [{ name: 'HQ', employees: 10 }]
    });
    const KB = () => ({ standards: [
        { id: 1, name: 'ISO 17100:2015', status: 'ready', clauses: kbClauses('translation', 12) },
        { id: 2, name: 'ISO 18841:2018', status: 'ready', clauses: kbClauses('interpreting', 4) }
    ] });
    const flush = () => new Promise(r => setTimeout(r, 0));
    function openLS(auditType) {
        window._resolveChecklistStandard = (doc) => M.UTILS.canonicalStandard(doc.name);
        const client = LS();
        html = '';
        window.UTILS = M.UTILS;
        window.state = { clients: [client], auditPlans: [], knowledgeBase: KB() };
        window.DataService = { findClient: () => client, findAuditPlan: () => null,
            openFormModal: (_t, body, onSave) => { html = body; document.body.innerHTML = body; save = onSave; } };
        window.saveData = () => { }; window.closeModal = () => { }; window.SupabaseClient = undefined;
        notes = []; window.showNotification = (msg, type) => notes.push({ msg, type });
        window.buildChecklistFromClientDocs('ls', auditType);
    }
    const tickRegistry = () => document.querySelectorAll('.cldoc-std').forEach(cb => { cb.checked = true; });
    const tickScheme = (name) => { document.querySelector(`.cldoc-scheme[value="${name}"]`).checked = true; };
    const releaseBlockers = (ck) => {
        const qa = M.QA.validate(ck, ck.qaContext);
        const coverage = M.CC.assess(ck, M.CC.buildContext(ck, { client: LS() }));
        return { qa, blockers: M.CC.readiness(ck, { qa, coverage }).blockers.map(b => b.code) };
    };

    it('labels them as Knowledge Base clause sets, and only the un-analysed one as a scheme', () => {
        openLS('surveillance');
        expect(offered().sort()).toEqual(['iso14001', 'iso27001', 'iso9001']);
        expect(schemes()).toEqual(['ISO 17100:2015', 'ISO 18841:2018', 'ISO 18587:2017']);
        expect(html).toMatch(/ISO 17100:2015 <span[^>]*>— Knowledge Base clause set \(ISO 17100:2015\)/);
        expect(html).toMatch(/ISO 18587:2017 <span[^>]*>— scheme, built from the client/);
        expect(html).toMatch(/ISO 17100:2015, ISO 18841:2018<\/strong> are built from their analysed Knowledge Base clause set and can be combined/);
        expect(html).toMatch(/ISO 18587:2017<\/strong> has no clause set in the registry/);
    });

    it('builds one surveillance checklist across all five, sampled, and it can be released', async () => {
        openLS('surveillance');
        tickRegistry(); tickScheme('ISO 17100:2015'); tickScheme('ISO 18841:2018');
        document.getElementById('cldoc-length').value = '45';      // Two days: Knowledge Base clauses are sampled
        await save(); await flush();
        const ck = window.state.checklists[0];
        expect(ck.standard).toBe('ISO/IEC 27001:2022, ISO 9001:2015, ISO 14001:2015, ISO 17100:2015, ISO 18841:2018');
        expect(ck.knowledgeBaseStandards).toEqual(['ISO 17100:2015', 'ISO 18841:2018']);
        const section = (name) => ck.clauses.find(c => c.mainClause === name);
        const sampled = section('ISO 17100:2015').subClauses.length;          // 12 clauses, sampled
        expect(sampled).toBeGreaterThanOrEqual(2);
        expect(sampled).toBeLessThan(12);
        expect(section('ISO 17100:2015').title).toMatch(new RegExp(`${sampled} of 12 clauses sampled`));
        expect(section('ISO 18841:2018').subClauses).toHaveLength(4);
        expect(section('ISO 17100:2015').subClauses[0]).toMatchObject({ criterionSource: 'knowledge-base', criterionStandard: 'ISO 17100:2015', requirement: 'How is translation item 1 controlled?' });
        expect(ck.clauses.some(c => c.mainClause === 'SURV')).toBe(true);

        const { qa, blockers } = releaseBlockers(ck);
        expect(qa.issues.filter(i => i.severity === 'critical')).toEqual([]);
        expect(blockers).toEqual([]);
    });

    it('an initial audit takes every Knowledge Base clause and is releasable too', async () => {
        openLS('initial');
        tickRegistry(); tickScheme('ISO 17100:2015');
        await save(); await flush();
        const ck = window.state.checklists[0];
        expect(ck.clauses.find(c => c.mainClause === 'ISO 17100:2015').subClauses).toHaveLength(12);
        expect(releaseBlockers(ck).blockers).toEqual([]);
    });

    it('the chosen length sizes the surveillance checklist; mandatory elements are never trimmed', async () => {
        const sizes = {};
        for (const length of ['25', '45', '75', '']) {
            openLS('surveillance');
            tickRegistry(); tickScheme('ISO 17100:2015'); tickScheme('ISO 18841:2018');
            document.getElementById('cldoc-length').value = length;
            await save(); await flush();
            const ck = window.state.checklists[0];
            sizes[length || 'none'] = ck.itemCount;
            expect(ck.clauses.find(c => c.mainClause === 'SURV').subClauses).toHaveLength(8);
            // Over the target only when even the smallest sample is (the
            // mandatory structure alone can be): Half day on this scope.
            if (length && length !== '25') expect(ck.itemCount).toBeLessThanOrEqual(Number(length));
            expect(releaseBlockers(ck).blockers).toEqual([]);
        }
        expect(sizes['25']).toBeLessThan(sizes['45']);
        expect(sizes['45']).toBeLessThanOrEqual(sizes['75']);
        expect(sizes['75']).toBeLessThan(sizes.none);
    });

    it('still refuses to mix in a standard with no clause set anywhere, and names it', async () => {
        openLS('surveillance');
        tickRegistry(); tickScheme('ISO 17100:2015'); tickScheme('ISO 18587:2017');
        await save();
        expect(window.state.checklists || []).toHaveLength(0);
        expect(notes.pop().msg).toMatch(/^ISO 18587:2017 has no clause set in the registry or the Knowledge Base/);
    });

    it('ISO 9001 + ISO 14001 ask the general improvement clause once, not twice', () => {
        const ck = B.buildClientChecklist(LS(), DOC, { auditType: 'initial', standardIds: ['iso9001', 'iso14001'], manDays: 2 });
        const tens = ck.clauses.flatMap(c => (c.subClauses || []).map(i => i)).filter(i => i.clause === '10.1');
        expect(tens).toHaveLength(1);
        expect(tens[0].refs.map(r => r.stdId).sort()).toEqual(['iso14001', 'iso9001']);
        expect(M.QA.validate(ck, ck.qaContext).issues.some(i => i.code === 'DUPLICATE_QUESTION')).toBe(false);
    });
});

describe('client Checklists area — standard pick-lists follow the client', () => {
    const fs = require('fs');
    const path = require('path');
    let loaded = false;
    function setup(scope) {
        window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
        window.UTILS = M.UTILS;
        window.showNotification = () => { };
        if (!loaded) { (0, eval)(fs.readFileSync(path.resolve('./checklist-module.js'), 'utf8')); loaded = true; }
        document.body.innerHTML = '<div id="content-area"></div>';
        window.contentArea = document.getElementById('content-area');
        window.state = {
            currentUser: { name: 'Admin', role: 'Admin' }, settings: { isAdmin: true }, auditPlans: [],
            cbSettings: { availableStandards: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'GMP', 'Halal', 'cGMP'] },
            clients: [SG(), { id: 'n', name: 'New Client' }],
            checklists: [{ id: 1, name: 'Old one', standard: 'ISO 14001:2015', type: 'custom', clientId: 'sg', clauses: [] }]
        };
        window.renderChecklistLibrary(scope);
    }
    const values = (sel) => Array.from(document.querySelectorAll(sel + ' option')).map(o => o.value || o.textContent.trim()).filter(v => v && v !== 'all');

    it('the filter and the editor list SG 1888’s three standards, not the CB’s whole list', () => {
        setup('sg');
        expect(values('#checklist-filter-standard')).toEqual(['ISO 9001:2015', 'Halal', 'cGMP']);
        window.renderChecklistEditor();
        expect(values('#checklist-standard').filter(v => !/select/i.test(v))).toEqual(['ISO 9001:2015', 'Halal', 'cGMP']);
    });

    it('editing keeps the standard already on the checklist selectable', () => {
        setup('sg');
        window.renderChecklistEditor(1);
        expect(values('#checklist-standard')).toContain('ISO 14001:2015');
    });

    it('the global library and a client with no standards keep the full list', () => {
        setup(null);
        expect(values('#checklist-filter-standard')).toHaveLength(6);
        setup('n');
        expect(values('#checklist-filter-standard')).toHaveLength(6);
    });
});
