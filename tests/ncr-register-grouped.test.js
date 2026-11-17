// NCR Register in the OBS / OFI register's style (PC Connection, 2026-11-17):
// grouped by audit (heading row with Major/Minor counts), no Audit / Level /
// Client columns (an internal NCR carries an "Internal" tag; the client goes in
// the heading only when the list spans several clients), wrapped description,
// smaller text, icon actions.
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

const plans = [
    { id: 'feb', auditType: 'Surveillance', date: '2026-02-17' },
    { id: 'nov', auditType: 'Recertification', date: '2026-11-17' }
];
let html;
const render = (ncrs) => {
    window.state = { ncrs, auditPlans: plans, clients: [{ id: 'c1', name: 'PC CONNECTION, INC.' }], activeClientId: null, ncrContextClientId: null, currentUser: { name: 'Lead Auditor' } };
    document.body.innerHTML = '<div id="t"></div>';
    document.getElementById('t').innerHTML = window.renderNCRTable(ncrs);
    html = document.getElementById('t');
};
const groups = () => Array.from(html.querySelectorAll('tr.ncr-group-row')).map(r => r.textContent.replace(/\s+/g, ' ').trim());
const refsIn = () => Array.from(html.querySelectorAll('tr.ncr-row')).map(r => r.cells[0].textContent.replace(/\s+/g, ' ').trim());

describe('NCR register grouped and compact', () => {
    beforeEach(() => render([
        { id: 53, auditId: 'feb', clientName: 'PC CONNECTION, INC.', clause: '9.2', severity: 'Minor', status: 'Open', dueDate: '2026-06-02', description: 'Internal audit gap', level: 'client' },
        { id: 21, auditId: 'feb', clientName: 'PC CONNECTION, INC.', clause: '7.5', severity: 'Minor', status: 'In Progress', capaImplementedDate: '2026-11-10', dueDate: '2027-01-01', description: 'Document control', level: 'client' },
        { id: 60, auditId: 'nov', clientName: 'PC CONNECTION, INC.', clause: '8.6.2', severity: 'Major', status: 'Open', dueDate: '2027-01-15', description: 'Service requests', level: 'cb-internal' }
    ]));

    it('one heading per audit, newest first, with Major/Minor counts', () => {
        const g = groups();
        expect(g).toHaveLength(2);
        expect(g[0]).toMatch(/^Recertification — .* · 1 Major · 0 Minor$/);
        expect(g[1]).toMatch(/^Surveillance — .* · 0 Major · 2 Minor$/);
    });

    it('drops the Level, Client and Audit columns', () => {
        const heads = Array.from(html.querySelectorAll('th')).map(th => th.textContent.trim());
        expect(heads).toEqual(['NCR#', 'Clause', 'Severity', 'Description', 'Due Date', 'Status', 'Actions']);
    });

    it('tags an internal NCR, flags overdue, and uses icon actions', () => {
        expect(refsIn().find(r => r.startsWith('NCR-060'))).toMatch(/Internal$/);
        const row53 = Array.from(html.querySelectorAll('tr.ncr-row')).find(r => r.textContent.includes('NCR-053'));
        expect(row53.textContent).toContain('OVERDUE');
        const actions = row53.cells[6];
        expect(actions.textContent.trim()).toBe('');
        expect(actions.querySelector('[data-action="openAddCAPAModal"]').getAttribute('aria-label')).toBe('Add CAPA');
        const row21 = Array.from(html.querySelectorAll('tr.ncr-row')).find(r => r.textContent.includes('NCR-021'));
        expect(row21.querySelector('[data-action="verifyCAPA"]').getAttribute('aria-label')).toBe('Verify CAPA');
    });

    it('names the client in the heading when several clients are listed', () => {
        render([
            { id: 1, auditId: 'feb', clientName: 'PC CONNECTION, INC.', clause: '9.2', severity: 'Minor', status: 'Open' },
            { id: 2, auditId: 'x', clientName: 'Acme Ltd', clause: '7.5', severity: 'Major', status: 'Open', raisedDate: '2026-03-01' }
        ]);
        expect(groups().some(g => g.startsWith('PC CONNECTION, INC. — Surveillance'))).toBe(true);
        expect(groups().some(g => g.startsWith('Acme Ltd — '))).toBe(true);
    });
});
