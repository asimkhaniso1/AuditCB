import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { M } from '../tools/pcc-scenario.mjs';

// PC CONNECTION's recertification plan had two client checklists ticked (the
// original, 86 items, and a November rebuild, 117 items). The plan page
// printed them as an unbranded "Audit Checklist Execution Report" while the
// Checklists library printed the branded document, and nothing recorded which
// one the client was sent.
//  - Plan-page Print now prints the same ChecklistDocument, one per checklist.
//  - "Sent to client" records date, recipient, reference, item count and a
//    fingerprint on the plan, and flags a checklist changed since it was sent.
//  - Ticking two checklists that ask the same standard warns, live and on save.
globalThis.window = globalThis.window || globalThis;

const STDS = 'ISO/IEC 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018';
const clauses = (n) => [{ mainClause: '6', title: 'Planning', subClauses: Array.from({ length: n }, (_, i) => ({ clause: `6.${i + 1}`, requirement: `Question ${i + 1}` })) }];
const CHECKLISTS = () => [
    { id: 101, name: 'PC CONNECTION, INC. - Recertification Audit Checklist (Client-Specific)', standard: STDS, type: 'custom', clientId: 'pcc', clauses: clauses(3) },
    { id: 102, name: 'PC CONNECTION, INC. - Recertification Audit Checklist (Client-Specific, Nov 2026 rebuild)', standard: STDS, type: 'custom', clientId: 'pcc', clauses: clauses(5) },
    { id: 201, name: 'ISO 27001:2022 - Initial Audit Checklist', standard: 'ISO 27001:2022', type: 'global', clauses: clauses(2) },
    { id: 202, name: 'ISO 27001:2022, ISO 22301:2019, ISO 20000-1:2018 Checklist (Recovered)', standard: 'ISO 27001:2022, ISO 22301:2019, ISO 20000-1:2018', type: 'global', clauses: clauses(2) }
];
const CLIENT = { id: 'pcc', name: 'PC CONNECTION, INC.', standard: STDS };
const PLAN = (selected) => ({ id: 'plan-pcc', client: 'PC CONNECTION, INC.', standard: STDS, date: '2026-11-17', endDate: '2026-11-19', selectedChecklists: selected });

function mountModal() {
    document.body.innerHTML = '<div id="content-area"></div><div id="modal-overlay" class="hidden"><h3 id="modal-title"></h3><div id="modal-body"></div><button id="modal-save">Save</button></div>';
    window.contentArea = document.getElementById('content-area');
    window.closeModal = () => { document.getElementById('modal-overlay').classList.add('hidden'); };
    window.DataService = {
        openFormModal(title, body, onSave) {
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-body').innerHTML = body;
            const save = document.getElementById('modal-save');
            save.style.display = onSave ? '' : 'none';
            save.onclick = onSave || null;
            document.getElementById('modal-overlay').classList.remove('hidden');
        }
    };
}

let notes;
beforeAll(() => {
    window.UTILS = M.UTILS;
    window.ChecklistDocument = M.CD;
    window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
    window.Sanitizer = { sanitizeText: (v) => v };
    window.Validator = {};
    window.showNotification = (m, t) => notes.push({ m, t });
    loadScript('./planning-module.js', { global: true });
});

beforeEach(() => {
    notes = [];
    mountModal();
    window.SupabaseClient = undefined;
    window.saveData = () => { window.__saved = (window.__saved || 0) + 1; };
    window.viewAuditPlan = () => { };
    window.confirm = () => true;
    window.state = { clients: [CLIENT], checklists: CHECKLISTS(), auditPlans: [PLAN(['101', '102'])], currentUser: { name: 'Lead Auditor' } };
});

describe('ChecklistDocument.itemCount / fingerprint', () => {
    it('counts questions, not section headings', () => {
        expect(M.CD.itemCount(CHECKLISTS()[0])).toBe(3);
        expect(M.CD.itemCount(CHECKLISTS()[1])).toBe(5);
    });
    it('is stable for the same content and changes when a question changes', () => {
        const a = CHECKLISTS()[0];
        const before = M.CD.fingerprint(a);
        expect(M.CD.fingerprint(CHECKLISTS()[0])).toBe(before);
        a.clauses[0].subClauses[1].requirement = 'Question 2, reworded';
        expect(M.CD.fingerprint(a)).not.toBe(before);
    });
});

describe('findOverlappingChecklists', () => {
    const byId = (...ids) => CHECKLISTS().filter(c => ids.includes(c.id));
    it('flags two client checklists for the same standards', () => {
        const pairs = window.findOverlappingChecklists(byId(101, 102));
        expect(pairs).toHaveLength(1);
        expect(pairs[0].standards).toHaveLength(3);
    });
    it('does not flag a global base checklist beside a client-specific one', () => {
        expect(window.findOverlappingChecklists(byId(101, 201))).toEqual([]);
    });
    it('flags any two checklists naming exactly the same standards', () => {
        expect(window.findOverlappingChecklists(byId(101, 202))).toHaveLength(1);
    });
    it('ignores checklists for different standards and missing entries', () => {
        const other = { id: 9, name: 'ISO 9001 client list', standard: 'ISO 9001:2015', type: 'custom', clientId: 'pcc' };
        expect(window.findOverlappingChecklists([CHECKLISTS()[0], other, undefined])).toEqual([]);
    });
});

describe('plan-page Print uses the branded checklist document', () => {
    let calls;
    beforeEach(() => { calls = []; window.printChecklist = (...a) => calls.push(a); });

    it('one ticked checklist prints straight away, for THIS plan', () => {
        window.state.auditPlans = [PLAN(['102'])];
        window.printAuditChecklist('plan-pcc');
        expect(calls.map(([id, planId]) => [String(id), planId])).toEqual([['102', 'plan-pcc']]);
    });

    it('several ticked checklists open a list with one Print per checklist and the overlap warning', () => {
        window.printAuditChecklist('plan-pcc');
        expect(calls).toHaveLength(0);
        const body = document.getElementById('modal-body');
        const prints = Array.from(body.querySelectorAll('[data-action="printChecklist"]')).map(b => [b.dataset.arg1, b.dataset.arg2]);
        expect(prints).toEqual([['101', 'plan-pcc'], ['102', 'plan-pcc']]);
        expect(body.querySelector('.checklist-overlap-warning').textContent).toMatch(/2 ticked checklists cover the same standards/);
        // Reference and item count as the printed document shows them.
        const ref = M.CD.reference(CHECKLISTS()[0], { plan: PLAN([]), client: CLIENT, siblings: CHECKLISTS() });
        expect(body.textContent).toContain(ref);
        expect(body.textContent).toMatch(/Not recorded/);
    });

    it('says so when nothing is assigned', () => {
        window.state.auditPlans = [PLAN([])];
        window.printAuditChecklist('plan-pcc');
        expect(notes.map(n => n.m).join(' ')).toMatch(/No checklists are assigned/);
    });
});

describe('recording which checklist was sent to the client', () => {
    const plan = () => window.state.auditPlans[0];
    function record(values) {
        window.openRecordChecklistSent('plan-pcc', '102');
        Object.entries(values).forEach(([id, v]) => { document.getElementById(id).value = v; });
        return window.saveChecklistSent('plan-pcc', '102');
    }

    it('stores date, recipient, reference, item count and fingerprint on the plan', async () => {
        await record({ 'rcs-date': '2026-11-10', 'rcs-to': 'quality@pcconnection.example', 'rcs-method': 'Email', 'rcs-note': 'Recert checklist' });
        const [e] = plan().checklistIssues;
        const cl = CHECKLISTS()[1];
        expect(e).toMatchObject({
            checklistId: '102', sentOn: '2026-11-10', sentTo: 'quality@pcconnection.example', method: 'Email', note: 'Recert checklist',
            itemCount: 5, fingerprint: M.CD.fingerprint(cl), recordedBy: 'Lead Auditor',
            reference: M.CD.reference(cl, { plan: plan(), client: CLIENT, siblings: CHECKLISTS() })
        });
        expect(window.__saved).toBeGreaterThan(0);
        expect(window.latestChecklistIssue(plan(), 102).sentOn).toBe('2026-11-10');
    });

    it('refuses a missing recipient or a future date', async () => {
        await record({ 'rcs-date': '2026-11-10', 'rcs-to': '  ' });
        await record({ 'rcs-date': '2999-01-01', 'rcs-to': 'someone' });
        expect(plan().checklistIssues).toBeUndefined();
        expect(notes.filter(n => n.t === 'error')).toHaveLength(2);
    });

    it('shows the record in the list, and flags the checklist once it changes', async () => {
        await record({ 'rcs-date': '2026-11-10', 'rcs-to': 'quality@pcconnection.example' });
        window.openPlanChecklists('plan-pcc');
        let body = document.getElementById('modal-body').textContent;
        expect(body).toMatch(/to quality@pcconnection\.example/);
        expect(body).not.toMatch(/Changed since sent/);
        window.state.checklists[1].clauses[0].subClauses.push({ clause: '6.9', requirement: 'Added after sending' });
        window.openPlanChecklists('plan-pcc');
        body = document.getElementById('modal-body').textContent;
        expect(body).toMatch(/Changed since sent/);
    });
});

describe('Configure Checklists warns about overlapping checklists', () => {
    const warning = () => document.getElementById('checklist-overlap-warning').textContent;

    it('warns while both PC CONNECTION checklists are ticked, and clears when one is unticked', async () => {
        await window.renderConfigureChecklist('plan-pcc');
        expect(warning()).toMatch(/2 ticked checklists cover the same standards/);
        const cb = document.querySelector('.checklist-select-cb[data-id="101"]');
        cb.checked = false;
        cb.dispatchEvent(new Event('change'));
        expect(warning().trim()).toBe('');
    });

    it('saving with both ticked asks first, and cancelling keeps the plan as it was', async () => {
        await window.renderConfigureChecklist('plan-pcc');
        window.state.auditPlans[0].selectedChecklists = ['201'];
        let asked = '';
        window.confirm = (msg) => { asked = msg; return false; };
        await window.saveChecklistConfiguration('plan-pcc');
        expect(asked).toMatch(/cover the same standards/);
        expect(window.state.auditPlans[0].selectedChecklists).toEqual(['201']);
    });
});
