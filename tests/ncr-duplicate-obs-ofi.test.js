// Duplicate observations and OFIs, and a finding counted twice as "previous".
//
// PC Connection's February 2026 surveillance audit has 8 findings; the register
// held 56 records for it, minted by older checklist-sync code on every save.
// The duplicate review only grouped Major/Minor NCs, so 44 observation and OFI
// copies never reached it, and the recertification plan listed 53 previous
// findings, with the 7.5 minor NC twice (NCR-021 and the report's own item).
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditPlans: [] };
loadScript('./utils.js', { params: { module: undefined } });
loadScript('./ncr-capa-module.js', { params: { module: undefined } });
window.FindingWorkflow = require('../finding-workflow.js');
window.ChecklistStandards = require('../checklist-standards.js');
const API = require('../audit-plan-integrity.js');

const AUDIT = 'feb-2026';
const base = { clientId: 'pcc', clientName: 'PC CONNECTION, INC.', auditId: AUDIT, status: 'Open', source: 'checklist' };
const report = (items) => ({ id: 'rep-1', planId: AUDIT, clientId: 'pcc', client: 'PC CONNECTION, INC.', date: '2026-02-17',
    checklistProgress: items.map((it, i) => Object.assign({ checklistId: 'cl-1', itemIdx: String(i), status: 'nc' }, it)) });

function setupDom() {
    document.body.innerHTML = '<div id="modal-title"></div><div id="modal-body"></div><button id="modal-save"></button>';
    window.openModal = () => { };
    window.closeModal = () => { };
    window.saveData = () => { };
    window.showNotification = () => { };
    window.confirm = () => true;
    window.contentArea = document.createElement('div');
    delete window.SupabaseClient; // persistNCR becomes a no-op
    window.localStorage.clear();
}

describe('findDuplicateNCRs — observations and OFIs', () => {
    beforeEach(() => {
        window.state = { auditPlans: [], clients: [], capaAnalytics: {}, ncrs: [
            { ...base, id: 3, clause: 'A.8.8 (27001)', severity: 'ofi', description: 'Patching tooling...' },
            { ...base, id: 14, clause: 'A.8.8 (27001)', severity: 'ofi', description: 'Patching tooling...' },
            { ...base, id: 9, clause: 'A.8.13 (27001)', severity: 'observation', description: 'Backups...' },
            { ...base, id: 15, clause: 'A.8.13 (27001)', severity: 'observation', description: 'Backups...' },
            // Same clause, different type: two findings, not a duplicate.
            { ...base, id: 60, clause: 'A.8.13 (27001)', severity: 'ofi', description: 'Restore tests...' },
            { ...base, id: 61, clause: '9.2', severity: 'pending', description: 'Unclassified' },
            { ...base, id: 62, clause: '9.2', severity: 'pending', description: 'Unclassified' }
        ] };
    });

    it('groups each type on its own and skips unclassified records', () => {
        const groups = window.findDuplicateNCRs();
        expect(groups.map(g => [g.clause, g.severity, g.records.map(r => r.id)])).toEqual([
            ['a.8.8 (27001)', 'ofi', [3, 14]],
            ['a.8.13 (27001)', 'observation', [9, 15]]
        ]);
    });
});

describe('duplicate review — which copy is kept', () => {
    beforeEach(setupDom);

    it('preselects the copy worded as in the audit report, then the newest — not the oldest', () => {
        window.state = { auditPlans: [], clients: [], capaAnalytics: {}, ncrs: [
            { ...base, id: 1, clause: '5.1 (Integrated)', severity: 'observation', raisedDate: '2026-02-19', description: '4/8/2005 Quaterly MRM. Summary not required.' },
            { ...base, id: 48, clause: '5.1 (Integrated)', severity: 'observation', raisedDate: '2026-02-25', description: 'An opportunity to improve the policy statement was noted.' },
            { ...base, id: 55, clause: '5.1 (Integrated)', severity: 'observation', raisedDate: '2026-03-04', description: 'An opportunity to improve the policy statement was noted.' },
            { ...base, id: 3, clause: 'A.8.8 (27001)', severity: 'ofi', raisedDate: '2026-02-20', description: 'Old wording' },
            { ...base, id: 49, clause: 'A.8.8 (27001)', severity: 'ofi', raisedDate: '2026-03-04', description: 'Newer wording' }
        ], auditReports: [report([
            { clause: '5.1 (Integrated)', ncrType: 'observation', ncrDescription: 'An opportunity to improve the policy statement was noted.' }
        ])] };
        window.openNCRDuplicateReview();
        const kept = [...document.querySelectorAll('.ncr-dup-group')].map(el => el.querySelector('input:checked').value);
        expect(kept).toEqual(['55', '49']);
        expect(document.getElementById('modal-body').textContent).toMatch(/worded as in the audit report/);
        expect(document.querySelector('.ncr-dup-group').textContent).toMatch(/Observation/);
    });

    it('still prefers the copy with CAPA work', () => {
        window.state = { auditPlans: [], clients: [], capaAnalytics: {}, ncrs: [
            { ...base, id: 21, clause: '7.5', severity: 'minor', raisedDate: '2026-02-25', description: 'x', rootCause: 'No procedure' },
            { ...base, id: 51, clause: '7.5', severity: 'minor', raisedDate: '2026-03-04', description: 'x' }
        ], auditReports: [] };
        window.openNCRDuplicateReview();
        expect(document.querySelector('input[name="ncr-dup-keep-0"]:checked').value).toBe('21');
    });
});

describe('duplicate review — copies from before a finding was reclassified', () => {
    beforeEach(() => {
        setupDom();
        // 7.5 was an OFI on 19-20 February, then raised to a minor NC (NCR-021).
        window.state = { auditPlans: [], clients: [], capaAnalytics: {}, ncrs: [
            { ...base, id: 2, clause: '7.5 (Integrated)', severity: 'ofi', raisedDate: '2026-02-19', description: 'An opportunity exists... Share' },
            { ...base, id: 6, clause: '7.5 (Integrated)', severity: 'ofi', raisedDate: '2026-02-20', description: 'An opportunity exists... Share' },
            { ...base, id: 10, clause: '7.5 (Integrated)', severity: 'ofi', raisedDate: '2026-02-20', description: 'An opportunity exists... Share' },
            { ...base, id: 21, clause: '7.5 (Integrated)', severity: 'minor', raisedDate: '2026-02-25', description: 'An opportunity exists regarding document change control.' }
        ], auditReports: [report([
            { clause: '7.5 (Integrated)', ncrType: 'minor', ncrDescription: 'A minor non-conformity was identified.' }
        ])] };
    });

    it('offers to withdraw all of them in favour of the reclassified record, preselected', async () => {
        window.openNCRDuplicateReview();
        const group = document.querySelector('.ncr-dup-group');
        expect(group.querySelector('input:checked').value).toBe('replaced:21');
        expect(group.textContent).toMatch(/now records this finding as a\s+Minor NC \(NCR-021\)/);

        await document.getElementById('modal-save').onclick();

        const byId = Object.fromEntries(window.state.ncrs.map(n => [n.id, n]));
        expect([2, 6, 10].map(id => byId[id].status)).toEqual(['Withdrawn', 'Withdrawn', 'Withdrawn']);
        expect(byId[2].withdrawnReason).toMatch(/Duplicate of NCR-021 — the finding was reclassified as a minor nc/);
        expect(byId[21].status).toBe('Open');
        expect(window.state.ncrs.length).toBe(4);
    });

    it('does not offer it while the report still records the group\'s type', () => {
        window.state.auditReports = [report([{ clause: '7.5 (Integrated)', ncrType: 'ofi', ncrDescription: 'x' }])];
        window.openNCRDuplicateReview();
        expect(document.querySelector('input[value^="replaced:"]')).toBeNull();
        expect(document.querySelector('input[name="ncr-dup-keep-0"]:checked').value).toBe('10');
    });
});

describe('collectPreviousFindings — the report\'s copy of an unlinked register record', () => {
    const client = { id: 'pcc', name: 'PC CONNECTION, INC.' };
    const prior = { id: AUDIT, clientId: 'pcc', date: '2026-02-17', status: 'Completed' };
    const recert = { id: 'recert', date: '2026-11-17' };

    it('lists the 7.5 minor NC once, not as NCR-021 plus the checklist item', () => {
        const state = {
            auditPlans: [prior],
            ncrs: [{ ...base, id: 21, clause: '7.5 (Integrated)', severity: 'minor', description: 'An opportunity exists regarding document change control.' }],
            auditReports: [report([
                { clause: '7.5 (Integrated)', ncrType: 'minor', ncrDescription: 'A minor non-conformity was identified.' },
                // A different type at the same clause is a different finding.
                { clause: '7.5 (Integrated)', ncrType: 'ofi', ncrDescription: 'Share the change log.' }
            ])]
        };
        const out = API.collectPreviousFindings({ state, client, plan: recert, standards: ['iso27001'] });
        expect(out.map(f => [f.source, f.type])).toEqual([['register', 'nonconformity'], ['report-checklist', 'ofi']]);
        expect(out.filter(f => f.requiresFollowUp).map(f => f.ref)).toEqual(['21']);
    });

    it('keeps a report finding whose register record links a different item', () => {
        const state = {
            auditPlans: [prior],
            ncrs: [{ ...base, id: 30, clause: '7.5', severity: 'minor', description: 'Linked one', sourceChecklistId: 'cl-1', sourceItemIdx: '9' }],
            auditReports: [report([{ clause: '7.5', ncrType: 'minor', ncrDescription: 'Another minor at 7.5' }])]
        };
        const out = API.collectPreviousFindings({ state, client, plan: recert, standards: ['iso27001'] });
        expect(out.length).toBe(2);
    });
});
