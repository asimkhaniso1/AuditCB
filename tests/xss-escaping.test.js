// Stored-XSS regression guard. Client names, auditor remarks and Gemini output
// are stored by one user and rendered into innerHTML / document.write for
// others, so every such interpolation must go through the escape helper.
// Each test renders a real sink with a hostile value and asserts that it
// arrives as text: no <img> element is created and the payload shows up as
// the literal characters the user typed.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

const fs = await import('fs');
const path = await import('path');

const PAYLOAD = '<img src=x onerror=alert(1)>';
const read = (f) => fs.readFileSync(path.resolve(f), 'utf8');

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug() { }, info() { }, warn() { }, error() { } };

// Real UTILS — the point is to exercise the shipped escapeHtml, not a stub.
loadScript('./utils.js', { global: true });
const REAL_UTILS = window.UTILS;

// No live <img> made it into the markup, and the payload text is visible.
function expectInert(container) {
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.textContent).toContain(PAYLOAD);
}

describe('UTILS.escapeHtml', () => {
    it('renders 0 as "0" instead of blank', () => {
        expect(REAL_UTILS.escapeHtml(0)).toBe('0');
        expect(REAL_UTILS.escapeHtml(false)).toBe('false');
    });

    it('keeps null/undefined blank and escapes all five characters', () => {
        expect(REAL_UTILS.escapeHtml(null)).toBe('');
        expect(REAL_UTILS.escapeHtml(undefined)).toBe('');
        expect(REAL_UTILS.escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
    });

    it('escapes non-string values too (an object toString can carry markup)', () => {
        const sneaky = { toString: () => PAYLOAD };
        expect(REAL_UTILS.escapeHtml(sneaky)).toBe('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('escapeText decodes a stored-escaped value first, so it is escaped exactly once', () => {
        expect(REAL_UTILS.escapeText('A &amp; B')).toBe('A &amp; B');
        expect(REAL_UTILS.escapeText('&lt;img src=x onerror=alert(1)&gt;')).toBe('&lt;img src=x onerror=alert(1)&gt;');
        expect(REAL_UTILS.escapeText(0)).toBe('0');
    });
});

describe('plan header (planning-module.js viewAuditPlan)', () => {
    beforeAll(() => {
        window.showNotification = () => { };
        window.Sanitizer = { sanitizeText: (v) => v };
        window.Validator = {};
        loadScript('./planning-module.js', { global: true });
    });

    it('escapes a hostile client name in the plan header', () => {
        window.UTILS = REAL_UTILS;
        window.DataService = { isPlanCompleted: () => false };
        window.contentArea = document.createElement('div');
        window.state = {
            auditPlans: [{ id: 'p1', client: PAYLOAD, standard: 'ISO 9001:2015', date: '2026-11-02', status: 'Draft', selectedChecklists: [] }],
            clients: [{ id: 'c1', name: PAYLOAD, industry: PAYLOAD }],
            checklists: [],
            auditReports: []
        };
        window.viewAuditPlan('p1');
        const h2 = window.contentArea.querySelector('h2');
        expect(h2.textContent).toBe(PAYLOAD);
        expectInert(window.contentArea);
    });
});

describe('execution list row (execution-list.js renderAuditExecutionEnhanced)', () => {
    let render;
    beforeAll(() => {
        // eslint-disable-next-line no-new-func
        render = loadScript('./execution-list.js', { params: { module: undefined }, append: '\nreturn renderAuditExecutionEnhanced;' });
    });

    beforeEach(() => {
        window.UTILS = Object.assign({}, REAL_UTILS, { getPlanRef: () => 'PLN-1' });
        window.CONSTANTS = { STATUS: { FINALIZED: 'Finalized', IN_PROGRESS: 'In Progress', DRAFT: 'Draft' } };
        window.contentArea = document.createElement('div');
        document.body.innerHTML = '';
        globalThis.debounce = (fn) => fn;
    });

    it('escapes a hostile client name and status in the report table', () => {
        window.state = {
            clients: [],
            auditReports: [{ id: 'r1', client: PAYLOAD, date: '2026-11-02', findings: 0, status: PAYLOAD }]
        };
        globalThis.state = window.state;
        render();
        const row = window.contentArea.querySelector('tr.execution-row');
        expect(row).not.toBeNull();
        expect(row.children[1].textContent).toBe(PAYLOAD);
        expectInert(row);
        // A zero findings count still prints "0".
        expect(row.children[3].textContent.trim()).toBe('0');
    });
});

describe('AI narrative in the report preview (execution-reporting.js)', () => {
    beforeAll(() => {
        window.UTILS = REAL_UTILS;
        // execution-reporting.js re-exports execution-list.js's modal opener.
        globalThis.openCreateReportModal = () => { };
        loadScript('./report-stats.js', { global: true });
        loadScript('./execution-reporting.js', { global: true });
    });

    function previewData(report) {
        return {
            report: Object.assign({ id: 'r1', client: PAYLOAD, standard: 'ISO 9001:2015', date: '2026-11-02', checklistProgress: [], ncrs: [] }, report),
            hydratedProgress: [],
            client: { id: 'c1', name: PAYLOAD, industry: PAYLOAD, sites: [] },
            auditPlan: { id: 'p1', standard: 'ISO 9001:2015', team: [] },
            cbSettings: {},
            cbSite: {},
            clientLogo: '',
            cbLogo: '',
            stats: {
                majorNC: 0, minorNC: 0, ncCount: 0, observationCount: 0, ofiCount: 0, conformCount: 0, naCount: 0,
                totalItems: 0, statusColor: '#10b981', auditStatus: 'Recommended', coveragePct: 0, ncByClause: {}
            },
            today: '02/11/2026'
        };
    }

    beforeEach(() => {
        window.UTILS = Object.assign({}, REAL_UTILS, { getPlanRef: () => 'PLN-1' });
        window.state = { auditReports: [], clients: [], auditPlans: [] };
        document.body.innerHTML = '';
    });

    it('seeds the editable conclusion and executive summary as text, not markup', () => {
        window._reportPreviewData = previewData({
            conclusion: 'Conclusion ' + PAYLOAD,
            executiveSummary: 'Summary ' + PAYLOAD,
            positiveObservations: 'Strength ' + PAYLOAD,
            ofi: ['Improve ' + PAYLOAD]
        });
        window.showReportPreviewModal();
        const overlay = document.getElementById('report-preview-overlay');
        expect(overlay).not.toBeNull();
        expect(document.getElementById('rp-conclusion').textContent).toContain('Conclusion ' + PAYLOAD);
        expect(document.getElementById('rp-exec-summary').textContent).toContain('Summary ' + PAYLOAD);
        expect(document.getElementById('rp-positive-obs').textContent).toContain('Strength ' + PAYLOAD);
        expect(document.getElementById('rp-ofi').textContent).toContain('Improve ' + PAYLOAD);
        expect(overlay.querySelector('img[onerror]')).toBeNull();
        expect(overlay.querySelector('img[src="x"]')).toBeNull();
        // Client name in the cover heading is text too.
        expect(overlay.textContent).toContain(PAYLOAD);
    });

    it('escapes stored-escaped remarks exactly once (no &amp;amp; shown to users)', () => {
        const esc = window._reportHtmlEsc;
        expect(esc('A &amp; B')).toBe('A &amp; B');
        expect(esc(PAYLOAD)).toBe('&lt;img src=x onerror=alert(1)&gt;');
    });
});

describe('AI executive summary textarea (execution-module-v2.js review tab)', () => {
    it('cannot break out of the textarea it is seeded into', () => {
        window.UTILS = REAL_UTILS;
        loadScript('./execution-module-v2.js', { global: true });
        const html = '<textarea id="t">' + window._execEscText('</textarea>' + PAYLOAD) + '</textarea>';
        const host = document.createElement('div');
        host.innerHTML = html;
        expect(host.querySelectorAll('textarea').length).toBe(1);
        expect(host.querySelector('img')).toBeNull();
        expect(host.querySelector('textarea').value).toBe('</textarea>' + PAYLOAD);
    });
});

describe('document gap analysis (client-docs-bulk.js)', () => {
    let client;
    beforeAll(() => {
        window.UTILS = REAL_UTILS;
        loadScript('./report-stats.js', { global: true });
        loadScript('./client-docs-bulk.js', { global: true });
    });

    beforeEach(() => {
        window.UTILS = REAL_UTILS;
        document.body.innerHTML = '<div id="modal-title"></div><div id="modal-body"></div><button id="modal-save"></button>';
        client = {
            id: 'c1',
            name: PAYLOAD,
            standard: 'ISO 9001:2015',
            documents: [{ id: 'd1', name: PAYLOAD + ' Quality Manual', linkedClauses: ['4.1', '4.2'], category: 'Quality Manual' }]
        };
        window.KB_HELPERS = { normalizeStdName: (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '') };
        window.state = {
            clients: [client],
            knowledgeBase: {
                standards: [{
                    name: 'ISO 9001:2015',
                    status: 'ready',
                    clauses: [
                        { clause: '4.1', title: 'Understanding the organization', requirement: 'Determine external and internal issues.' },
                        { clause: '4.2', title: 'Interested parties', requirement: 'Determine interested parties.' }
                    ]
                }]
            }
        };
        window.DataService = {
            findClient: () => client,
            openFormModal: (title, html) => {
                document.getElementById('modal-title').textContent = title;
                document.getElementById('modal-body').innerHTML = html;
            }
        };
    });

    it('renders the gap table and the printed report with the client and document names as text', () => {
        window.openDocumentGapAnalysis('c1');
        const body = document.getElementById('gap-body');
        expect(body.innerHTML.length).toBeGreaterThan(0);
        expect(body.querySelector('img')).toBeNull();
        expect(body.textContent).toContain(PAYLOAD + ' Quality Manual');

        let written = '';
        const prevOpen = window.open;
        window.open = () => ({ document: { write: (s) => { written += s; }, close() { } }, focus() { }, print() { } });
        try {
            window.printDocumentGapAnalysis();
        } finally {
            window.open = prevOpen;
        }
        const doc = new DOMParser().parseFromString(written, 'text/html');
        expect(doc.querySelector('img')).toBeNull();
        expect(doc.title).toContain(PAYLOAD);
        expect(doc.body.textContent).toContain(PAYLOAD);
    });
});
