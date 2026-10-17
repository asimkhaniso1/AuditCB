// "Start New Audit" (execution list) opens openCreateReportModal, which lives
// in execution-list.js; execution-reporting.js only re-exports that global.
// Its company filter read an undeclared `uniqueClients`, so every click threw
// a ReferenceError before the modal opened.
import { describe, it, expect, beforeEach } from 'vitest';

const fs = await import('fs');
const path = await import('path');
const SRC = fs.readFileSync(path.resolve('./execution-list.js'), 'utf8');

function loadExecutionList() {
    // Plain-script evaluation, as the browser loads it; expose the declaration.
    // eslint-disable-next-line no-new-func
    new Function('module', SRC + '\nwindow.__openCreateReportModal = openCreateReportModal;')(undefined);
    return window.__openCreateReportModal;
}

beforeEach(() => {
    document.body.innerHTML = '<button id="modal-save">Save</button>';
    window.state = {
        clients: [],
        auditReports: [],
        auditPlans: [
            { id: 'p1', client: 'Beta <Ltd>', standard: 'ISO 9001:2015', date: '2026-11-02' },
            { id: 'p2', client: 'Acme', standard: 'ISO 14001:2015', date: '2026-11-01' },
            { id: 'p3', client: 'Acme', standard: 'ISO 45001:2018', date: '2026-11-03' },
            { id: 'p4', client: 'Done Co', standard: 'ISO 9001:2015', date: '2026-10-01', reportId: 'r9' }
        ]
    };
    globalThis.state = window.state;
    window.CONSTANTS = { STATUS: { IN_PROGRESS: 'In Progress', DRAFT: 'Draft' } };
    window.UTILS = {
        getPlanRef: (p) => `PLN-${p.id}`,
        escapeHtml: (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    };
    window.DataService = {
        isPlanCompleted: () => false,
        openFormModal: (title, html) => { document.body.insertAdjacentHTML('afterbegin', `<div id="modal">${html}</div>`); }
    };
});

describe('Start New Audit modal', () => {
    it('opens and lists each company with an open plan once', () => {
        const open = loadExecutionList();
        expect(() => open()).not.toThrow();

        const options = [...document.querySelectorAll('#start-audit-client-filter option')].map(o => o.value);
        expect(options).toEqual(['', 'Acme', 'Beta <Ltd>']);
        expect(document.querySelector('#start-audit-client-filter option:last-child').textContent).toBe('Beta <Ltd>');
        expect(document.querySelectorAll('#plan-list-tbody tr')).toHaveLength(3);
        expect(document.getElementById('modal-save').textContent).toBe('Start Audit');
    });
});
