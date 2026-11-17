// CAPA Tracker in the registers' style (PC Connection, 2026-11-17): grouped by
// audit (heading with CAPA / overdue counts), no Client / Audit columns, root
// cause and corrective action wrapped, icon actions. The severity badge read
// only severity === 'Major', so records stored with a lowercase type showed a
// blank badge; it now uses the normalised severity.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.UTILS = require('../utils.js');
window.FindingWorkflow = require('../finding-workflow.js');
window.state = { ncrs: [], auditPlans: [] };
loadScript('./ncr-capa-module.js', { global: true });

let host;
beforeEach(() => {
    window.state = {
        auditPlans: [{ id: 'feb', auditType: 'Surveillance', date: '2026-02-17' }, { id: 'nov', auditType: 'Recertification', date: '2026-11-17' }],
        ncrs: [
            { id: 53, auditId: 'feb', clientName: 'PC CONNECTION, INC.', clause: '9.2', type: 'minor', status: 'Open', dueDate: '2026-06-02' },
            { id: 21, auditId: 'feb', clientName: 'PC CONNECTION, INC.', clause: '7.5', severity: 'Minor', status: 'In Progress', capaImplementedDate: '2026-11-10', rootCause: 'No change log review', correctiveAction: 'Monthly review added', capaResponsible: 'Samantha Johnston', dueDate: '2027-01-01' },
            { id: 60, auditId: 'nov', clientName: 'PC CONNECTION, INC.', clause: '8.6.2', severity: 'Major', status: 'Open', dueDate: '2027-01-15' },
            { id: 70, auditId: 'nov', clientName: 'PC CONNECTION, INC.', clause: '9.1', severity: 'Minor', status: 'Closed' }
        ],
        clients: [{ id: 'c1', name: 'PC CONNECTION, INC.' }], activeClientId: null, ncrContextClientId: null, showClosedCAPAs: false
    };
    document.body.innerHTML = '<div id="host"></div>';
    host = document.getElementById('host');
    host.innerHTML = window.getCAPATrackerHTML();
});

const groupRows = () => Array.from(host.querySelectorAll('tr.capa-group-row')).map(r => r.textContent.replace(/\s+/g, ' ').trim());
const row = (ref) => Array.from(host.querySelectorAll('tr.capa-row')).find(r => r.cells[0].textContent.includes(ref));

describe('CAPA Tracker grouped and compact', () => {
    it('one heading per audit, newest first, with CAPA and overdue counts; closed items hidden', () => {
        const g = groupRows();
        expect(g).toHaveLength(2);
        expect(g[0]).toMatch(/^Recertification — .* · 1 CAPA$/);
        expect(g[1]).toMatch(/^Surveillance — .* · 2 CAPAs · 1 overdue$/);
        expect(row('NCR-070')).toBeUndefined();
    });

    it('no Client or Audit column', () => {
        const heads = Array.from(host.querySelectorAll('th')).map(th => th.textContent.trim());
        expect(heads).toEqual(['NCR#', 'Severity', 'Root Cause', 'Corrective Action', 'Responsible', 'Target Date', 'Status', 'Actions']);
    });

    it('a lowercase "minor" type still shows its severity', () => {
        expect(row('NCR-053').cells[1].textContent.trim()).toBe('Minor');
        expect(row('NCR-060').cells[1].textContent.trim()).toBe('Major');
    });

    it('icon actions: view and update always, verify once implemented; overdue flagged', () => {
        const a53 = row('NCR-053').cells[7];
        expect(a53.textContent.trim()).toBe('');
        expect(a53.querySelector('[data-action="updateCAPAProgress"]').getAttribute('aria-label')).toBe('Update CAPA');
        expect(a53.querySelector('[data-action="verifyCAPA"]')).toBeNull();
        expect(row('NCR-021').cells[7].querySelector('[data-action="verifyCAPA"]')).not.toBeNull();
        expect(row('NCR-053').textContent).toContain('OVERDUE');
        expect(row('NCR-021').textContent).toContain('Monthly review added');
    });
});
