// Audit findings are nonconformities (Major / Minor), observations (OBS) and
// opportunities for improvement (OFI). Seen on the PC Connection audit:
//  - the execution "NCRs" tab titled every finding a "Non-Conformity Report",
//    numbered observations and OFIs as NCR-00x and labelled OFIs "Obs";
//  - its open-in-checklist link never knew which checklist item raised the
//    finding, so every click warned instead of opening it;
//  - the register's OFI / OBS tab did not follow the NCR Register layout.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', CLOSED: 'Closed' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};

describe('AuditFindingCategory', () => {
    beforeEach(() => { loadScript('./execution-module-v2.js', { params: { module: undefined } }); });

    it('only Major and Minor are NCRs; OBS and OFI are their own series', () => {
        const C = window.AuditFindingCategory;
        expect(C.of('major').prefix).toBe('NCR');
        expect(C.of('Minor').prefix).toBe('NCR');
        expect(C.of('observation').prefix).toBe('OBS');
        expect(C.of('ofi').prefix).toBe('OFI');
        expect(C.of('ofi').label).toBe('OFI');
        expect(C.of('pending_classification').label).toBe('Unclassified');
    });

    it('orders NCRs first and numbers each series on its own', () => {
        const out = window.AuditFindingCategory.numberFindings([
            { type: 'observation', clause: 'A.8.13' }, { type: 'ofi', clause: 'A.8.8' }, { type: 'minor', clause: '9.2' },
            { type: 'observation', clause: '5.1' }, { type: 'major', clause: '8.1' }, { type: 'ofi', clause: '10' }
        ]);
        expect(out.map(f => f._ref + ' ' + f.clause)).toEqual([
            'NCR-001 8.1', 'NCR-002 9.2', 'OBS-001 A.8.13', 'OBS-002 5.1', 'OFI-001 A.8.8', 'OFI-002 10'
        ]);
        expect(window.AuditFindingCategory.counts(out)).toEqual({ major: 1, minor: 1, pending: 0, obs: 2, ofi: 2, nc: 2 });
    });
});

describe('execution Findings tab', () => {
    let tab;
    beforeEach(() => {
        window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [], currentUser: { role: 'Lead Auditor' } };
        globalThis.state = window.state;
        window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        window.CONSTANTS = CONSTANTS;
        window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
        for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
        document.body.innerHTML = '<div id="tab-content"></div>';
        loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
        const report = { id: 'r1', ncrs: [{ type: 'minor', clause: '8.5', description: 'Manual minor', status: 'Open' }],
            checklistProgress: [
                { checklistId: 'cl1', itemIdx: 'ISMS-5', status: 'nc', ncrType: 'ofi', comment: 'Patching OFI' },
                { checklistId: 'cl1', itemIdx: 'ISMS-7', status: 'nc', ncrType: 'observation', comment: 'Backup OBS' },
                { checklistId: 'cl1', itemIdx: 'RECERT-5', status: 'nc', ncrType: 'minor', ncrDescription: 'Internal audit gap' },
                { checklistId: 'cl1', itemIdx: 'IMS-0', status: 'conform' }
            ] };
        window.__renderExecutionTab(report, 'ncr', { assignedChecklists: [] });
        tab = document.getElementById('tab-content');
    });

    it('is titled Audit Findings and counts each category', () => {
        expect(tab.querySelector('h3').textContent).toBe('Audit Findings');
        expect(tab.textContent).not.toContain('Non-Conformity Reports');
        const sub = tab.querySelector('h3 + p').textContent.replace(/\s+/g, ' ');
        expect(sub).toContain('2 nonconformities (Major 0 · Minor 2)');
        expect(sub).toContain('1 observation');
        expect(sub).toContain('1 OFI');
        expect(tab.textContent).toContain('Add Finding');
    });

    it('numbers OBS and OFI in their own series and labels an OFI as OFI', () => {
        const rows = Array.from(tab.querySelectorAll('tbody tr')).map(r => [r.cells[0].textContent.trim(), r.cells[2].textContent.trim()]);
        expect(rows).toEqual([['NCR-001', 'Minor NC'], ['NCR-002', 'Minor NC'], ['OBS-001', 'OBS'], ['OFI-001', 'OFI']]);
    });

    it('a checklist finding links to the item that raised it', () => {
        const link = Array.from(tab.querySelectorAll('[data-action="openNCRInChecklist"]'))
            .find(b => b.closest('tr').cells[0].textContent.trim() === 'OFI-001');
        expect(link.getAttribute('data-arg1')).toBe('cl1');
        expect(link.getAttribute('data-arg2')).toBe('ISMS-5');
    });

    it('a manual finding keeps its own index for editing, whatever the display order', () => {
        const edit = tab.querySelector('[data-action="editExecutionNCR"]');
        expect(edit.getAttribute('data-arg2')).toBe('0');
    });
});

describe('register OBS / OFI tab follows the NCR Register layout', () => {
    beforeEach(() => {
        window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
        window.UTILS = require('../utils.js');
        window.FindingWorkflow = require('../finding-workflow.js');
        window.state = { ncrs: [], auditPlans: [] };
        loadScript('./ncr-capa-module.js', { global: true });
        window.state = {
            auditReports: [{ id: 'r1', planId: 'p1', clientId: 'c1', client: 'PC CONNECTION, INC.', date: '2026-02-17', standard: 'ISO/IEC 27001:2022',
                checklistProgress: [
                    { status: 'nc', ncrType: 'ofi', clause: 'A.8.8', ncrDescription: 'Formalise the patching log' },
                    { status: 'nc', ncrType: 'observation', clause: 'A.8.13', ncrDescription: 'Review backup logs' },
                    { status: 'nc', ncrType: 'minor', clause: '9.2', ncrDescription: 'Not an OBS/OFI' }
                ] }],
            auditPlans: [{ id: 'p1', auditType: 'Surveillance', date: '2026-02-17' }],
            ncrs: [], clients: [{ id: 'c1', name: 'PC CONNECTION, INC.' }], activeClientId: null, currentUser: { name: 'Lead Auditor' }
        };
        window.openModal = () => { };
        document.body.innerHTML = '<div id="host"></div><h2 id="modal-title"></h2><div id="modal-body"></div><button id="modal-save"></button>';
        document.getElementById('host').innerHTML = window.getOFIOBSHTML();
    });

    it('has the register columns, references and audit, without the KPI cards', () => {
        const heads = Array.from(document.querySelectorAll('#ofi-obs-table-container th')).map(th => th.textContent.trim());
        expect(heads).toEqual(['Ref#', 'Level', 'Client', 'Audit', 'Clause', 'Type', 'Description', 'Response', 'Actions']);
        const rows = Array.from(document.querySelectorAll('#ofi-obs-table-container tbody tr'));
        expect(rows.map(r => r.cells[0].textContent.trim()).sort()).toEqual(['OBS-001', 'OFI-001']);
        expect(rows[0].cells[3].textContent).toMatch(/Surveillance/);
        expect(document.body.textContent).not.toContain('Total Findings');
        expect(document.getElementById('host').textContent).toContain('OBS / OFI Register');
    });

    it('filters by type and search, like the NCR Register', () => {
        document.getElementById('ofiobs-filter-type').value = 'OFI';
        window.filterOFIOBS();
        let refs = Array.from(document.querySelectorAll('#ofi-obs-table-container tbody tr')).map(r => r.cells[0].textContent.trim());
        expect(refs).toEqual(['OFI-001']);
        document.getElementById('ofiobs-filter-type').value = 'all';
        document.getElementById('ofiobs-filter-search').value = 'backup';
        window.filterOFIOBS();
        refs = Array.from(document.querySelectorAll('#ofi-obs-table-container tbody tr')).map(r => r.cells[0].textContent.trim());
        expect(refs).toEqual(['OBS-001']);
    });

    it('the eye opens the full finding; response and escalation stay in Actions', () => {
        const row = Array.from(document.querySelectorAll('#ofi-obs-table-container tbody tr')).find(r => r.cells[0].textContent.trim() === 'OBS-001');
        expect(row.cells[8].querySelector('[data-action="openFindingResponse"]')).not.toBeNull();
        expect(row.cells[8].querySelector('[data-action="escalateObservationToNCR"]')).not.toBeNull();
        const eye = row.cells[8].querySelector('[data-action="viewFindingDetails"]');
        window.viewFindingDetails(eye.getAttribute('data-arg1'), eye.getAttribute('data-arg2'), eye.getAttribute('data-arg3'));
        expect(document.getElementById('modal-title').textContent).toContain('OBS-001');
        expect(document.getElementById('modal-body').textContent).toContain('Review backup logs');
    });
});
