// OBS / OFI register: select findings and record one response for all of them
// (PC Connection audit, 2026-11-17). Also: a response recorded here was saved
// with saveData() only — local — so it never reached the database; both the
// single and the bulk response now sync the report.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.UTILS = require('../utils.js');
window.FindingWorkflow = require('../finding-workflow.js');
window.state = { ncrs: [], auditPlans: [] };
loadScript('./ncr-capa-module.js', { global: true });

let report, synced;
beforeEach(() => {
    report = { id: 'r1', planId: 'p1', clientId: 'c1', client: 'PC CONNECTION, INC.', date: '2026-02-17',
        checklistProgress: [
            { status: 'nc', ncrType: 'ofi', clause: 'A.8.8 (27001)', criterionRef: '8.1', ncrDescription: 'Formalise the patching log' },
            { status: 'nc', ncrType: 'observation', clause: 'A.8.13 (27001)', ncrDescription: 'Review backup logs' },
            { status: 'nc', ncrType: 'observation', clause: '4.1 / 4.2', ncrDescription: 'Context register', disposition: 'Monitor' },
            { status: 'nc', ncrType: 'minor', clause: '9.2', ncrDescription: 'Not OBS/OFI' }
        ] };
    window.state = { auditReports: [report], auditPlans: [{ id: 'p1', auditType: 'Surveillance', date: '2026-02-17' }], ncrs: [],
        clients: [{ id: 'c1', name: 'PC CONNECTION, INC.' }], activeClientId: null, currentUser: { name: 'Lead Auditor' } };
    synced = [];
    window.saveData = vi.fn();
    window.DataService = { syncAuditReport: (id, patch) => synced.push([id, patch]) };
    window.showNotification = vi.fn();
    window.openModal = () => { };
    window.closeModal = () => { };
    window.switchNCRTab = vi.fn();
    document.body.innerHTML = '<div id="host"></div><h2 id="modal-title"></h2><div id="modal-body"></div><button id="modal-save"></button>';
    document.getElementById('host').innerHTML = window.getOFIOBSHTML();
});

const rows = () => Array.from(document.querySelectorAll('#ofi-obs-table-container tr.ofiobs-row'));
const rowFor = (ref) => rows().find(r => r.cells[1].textContent.trim() === ref);

describe('selection', () => {
    it('Select all ticks every row and enables the bulk button; counts follow', () => {
        const btn = document.getElementById('ofiobs-bulk-btn');
        expect(btn.disabled).toBe(true);
        const all = document.getElementById('ofiobs-select-all');
        all.checked = true;
        window.toggleOFIOBSSelectAll(all);
        expect(document.getElementById('ofiobs-selected-count').textContent).toBe('3 selected');
        expect(btn.disabled).toBe(false);
        rowFor('OBS-001').querySelector('.ofiobs-select').checked = false;
        window.updateOFIOBSSelection();
        expect(all.indeterminate).toBe(true);
        expect(document.getElementById('ofiobs-selected-count').textContent).toBe('2 selected');
    });

    it('shows the assigned criterion next to the finding clause when they differ', () => {
        const cell = rowFor('OFI-001').cells[2].textContent;
        expect(cell).toContain('A.8.8 (27001)');
        expect(cell).toContain('criterion set: 8.1');
    });
});

describe('bulk response', () => {
    it('records one response on every ticked finding, keeps blank fields, and saves to the cloud', () => {
        ['OBS-001', 'OBS-002', 'OFI-001'].forEach(ref => { rowFor(ref).querySelector('.ofiobs-select').checked = true; });
        window.updateOFIOBSSelection();
        window.openBulkFindingResponse();
        expect(document.getElementById('modal-title').textContent).toContain('3 finding(s)');
        document.getElementById('bfr-eval').value = 'Reviewed by the ISM';
        document.getElementById('bfr-impact').value = 'Low';
        document.getElementById('bfr-decision').value = 'accepted';
        document.getElementById('modal-save').onclick();
        const [ofi, obs1, obs2] = report.checklistProgress;
        expect(obs1).toMatchObject({ managementEvaluation: 'Reviewed by the ISM', impactConsideration: 'Low', respondedBy: 'Lead Auditor' });
        expect(obs2).toMatchObject({ managementEvaluation: 'Reviewed by the ISM', disposition: 'Monitor' }); // blank disposition kept
        expect(ofi.ofiDecision).toBe('accepted');
        expect(report.checklistProgress[3].managementEvaluation).toBeUndefined();
        expect(synced).toHaveLength(1);
        expect(synced[0][0]).toBe('r1');
        expect(synced[0][1].checklistProgress).toBe(report.checklistProgress);
        expect(window.showNotification).toHaveBeenCalledWith('Response recorded for 3 finding(s).', 'success');
    });

    it('only shows the sections for the types ticked', () => {
        rowFor('OFI-001').querySelector('.ofiobs-select').checked = true;
        window.openBulkFindingResponse();
        expect(document.getElementById('bfr-decision')).not.toBeNull();
        expect(document.getElementById('bfr-eval')).toBeNull();
    });

    it('all fields blank changes nothing', () => {
        rowFor('OBS-001').querySelector('.ofiobs-select').checked = true;
        window.openBulkFindingResponse();
        document.getElementById('modal-save').onclick();
        expect(synced).toHaveLength(0);
        expect(window.showNotification).toHaveBeenCalledWith('Nothing to record: every field was left blank.', 'info');
    });
});

describe('single response also reaches the cloud', () => {
    it('Record response on one observation syncs its report', () => {
        window.openFindingResponse('r1', 'checklistProgress', '1');
        document.getElementById('fr-eval').value = 'Checked';
        document.getElementById('fr-disposition').value = 'Accepted';
        document.getElementById('modal-save').onclick();
        expect(synced).toHaveLength(1);
        expect(report.checklistProgress[1].disposition).toBe('Accepted');
    });
});

describe('grouped by audit, compact', () => {
    it('one heading row per audit with counts; no Audit column; icon buttons', () => {
        const group = document.querySelector('#ofi-obs-table-container tr.ofiobs-group-row');
        expect(group.textContent).toMatch(/Surveillance/);
        expect(group.textContent).toMatch(/2 OBS/);
        expect(group.textContent).toMatch(/1 OFI/);
        const heads = Array.from(document.querySelectorAll('#ofi-obs-table-container th')).map(th => th.textContent.trim());
        expect(heads).not.toContain('Audit');
        const actions = rowFor('OBS-001').cells[6];
        expect(actions.textContent.trim()).toBe('');
        expect(actions.querySelector('[data-action="openFindingResponse"]').getAttribute('title')).toBe('Record response');
        expect(actions.querySelector('[data-action="escalateObservationToNCR"]').getAttribute('aria-label')).toBe('Escalate to NCR');
    });

    it('the audit tick box selects that audit\'s findings', () => {
        const g = document.querySelector('#ofi-obs-table-container .ofiobs-group-select');
        g.checked = true;
        window.toggleOFIOBSGroup(g);
        expect(document.getElementById('ofiobs-selected-count').textContent).toBe('3 selected');
        rowFor('OFI-001').querySelector('.ofiobs-select').checked = false;
        window.updateOFIOBSSelection();
        expect(g.indeterminate).toBe(true);
    });

    it('response shows a short status with the details in its tooltip', () => {
        const status = rowFor('OBS-001').cells[5].querySelector('div');
        expect(status.textContent).toBe('Awaiting response');
        expect(status.getAttribute('title')).toMatch(/^Awaiting: /);
        expect(rowFor('OFI-001').cells[5].textContent.trim()).toBe('Awaiting decision');
    });
});
