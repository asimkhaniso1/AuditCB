// Checklist authoring clause-validation tests.
//
// Root cause under test: findings inherit `clause` from the checklist item
// that raised them, and the Report Integrity validator blocks finalization
// when a finding's clause is a placeholder/checklist tag rather than a real
// standard clause. checklist-module.js now requires a real clause (via
// window.Validator.isClauseRef, checklist-module.js's own defensive
// fallback isValidClauseRef, and the shared pure row-validation helper
// window.validateChecklistRows) at SAVE and IMPORT time for both the manual
// builder and both CSV import paths.
import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;

const fs = await import('fs');
const path = await import('path');

function loadModule(file) {
    const src = fs.readFileSync(path.resolve(file), 'utf8');
    // Shadow Vite/vitest's CJS-interop `module` binding so the eval'd file's
    // own `if (typeof module !== 'undefined' && module.exports) {...}` tail
    // guard is false here, exactly as it is in the browser.
    // eslint-disable-next-line no-unused-vars
    const module = undefined;
    eval(src);
}

describe('validation.js Validator.isClauseRef (loaded standalone, used by checklist-module.js)', () => {
    beforeEach(() => {
        window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        loadModule('./validation.js');
    });

    it('is present and callable after checklist-module.js loads on top', () => {
        loadModule('./checklist-module.js');
        expect(typeof window.Validator.isClauseRef).toBe('function');
        expect(window.Validator.isClauseRef('9.2')).toBe(true);
        expect(window.Validator.isClauseRef('FOCUS.1')).toBe(false);
    });
});

describe('checklist-module.js isValidClauseRef (window.isValidClauseRef)', () => {
    describe('with window.Validator present (delegates to it)', () => {
        beforeEach(() => {
            window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
            loadModule('./validation.js');
            loadModule('./checklist-module.js');
        });

        it('accepts real clause references', () => {
            expect(window.isValidClauseRef('4.1')).toBe(true);
            expect(window.isValidClauseRef('A.8.13')).toBe(true);
            expect(window.isValidClauseRef('9.6.2 (a)')).toBe(true);
        });

        it('rejects pseudo tags and blanks', () => {
            expect(window.isValidClauseRef('FOCUS.2')).toBe(false);
            expect(window.isValidClauseRef('SURV.1')).toBe(false);
            expect(window.isValidClauseRef('')).toBe(false);
        });
    });

    describe('fallback when window.Validator is absent', () => {
        beforeEach(() => {
            delete window.Validator;
            loadModule('./checklist-module.js');
        });

        it('still accepts real clause references via the local regex fallback', () => {
            expect(window.Validator).toBeUndefined();
            expect(window.isValidClauseRef('9.2')).toBe(true);
            expect(window.isValidClauseRef('10.3.1')).toBe(true);
        });

        it('still rejects pseudo tags via the local regex fallback', () => {
            expect(window.isValidClauseRef('ORG.4')).toBe(false);
            expect(window.isValidClauseRef('DOC')).toBe(false);
        });
    });
});

describe('checklist-module.js validateChecklistRows (window.validateChecklistRows)', () => {
    beforeEach(() => {
        window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        loadModule('./validation.js');
        loadModule('./checklist-module.js');
    });

    it('accepts rows with a real clause and requirement text', () => {
        const { accepted, rejected } = window.validateChecklistRows([
            { rowNumber: 1, clause: '9.2', requirement: 'Are internal audits conducted?' }
        ]);
        expect(rejected).toHaveLength(0);
        expect(accepted).toHaveLength(1);
        expect(accepted[0]).toMatchObject({ clause: '9.2', requirement: 'Are internal audits conducted?', mClause: '9' });
    });

    it('ignores fully blank filler rows (neither accepted nor rejected)', () => {
        const { accepted, rejected } = window.validateChecklistRows([
            { rowNumber: 1, clause: '', requirement: '' },
            { rowNumber: 2, clause: '  ', requirement: '  ' }
        ]);
        expect(accepted).toHaveLength(0);
        expect(rejected).toHaveLength(0);
    });

    it('rejects a row with requirement text but a missing clause', () => {
        const { accepted, rejected } = window.validateChecklistRows([
            { rowNumber: 3, clause: '', requirement: 'Some requirement text' }
        ]);
        expect(accepted).toHaveLength(0);
        expect(rejected).toHaveLength(1);
        expect(rejected[0]).toMatchObject({ rowNumber: 3, reason: 'missing standard clause' });
    });

    it('rejects a row with requirement text but a pseudo-tag clause (FOCUS/SURV/ORG/DOC)', () => {
        const { accepted, rejected } = window.validateChecklistRows([
            { rowNumber: 7, clause: 'FOCUS.2', requirement: 'Some requirement text' }
        ]);
        expect(accepted).toHaveLength(0);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].rowNumber).toBe(7);
        expect(rejected[0].reason).toMatch(/invalid clause/);
    });

    it('rejects a row with a valid clause but no requirement text', () => {
        const { accepted, rejected } = window.validateChecklistRows([
            { rowNumber: 4, clause: '9.2', requirement: '' }
        ]);
        expect(accepted).toHaveLength(0);
        expect(rejected).toHaveLength(1);
        expect(rejected[0]).toMatchObject({ rowNumber: 4, reason: 'missing requirement text' });
    });

    it('reports every offending row number, preserving order, for a mixed batch', () => {
        const { accepted, rejected } = window.validateChecklistRows([
            { rowNumber: 1, clause: '4.1', requirement: 'Context determined?' },
            { rowNumber: 2, clause: '', requirement: '' },
            { rowNumber: 3, clause: 'ORG.1', requirement: 'Internal tracking item' },
            { rowNumber: 4, clause: '5.1', requirement: 'Leadership commitment?' },
            { rowNumber: 5, clause: '9.9.9', requirement: '' }
        ]);
        expect(accepted.map(r => r.clause)).toEqual(['4.1', '5.1']);
        expect(rejected.map(r => r.rowNumber)).toEqual([3, 5]);
    });

    it('defaults rowNumber to a 1-based index when the caller omits it', () => {
        const { rejected } = window.validateChecklistRows([
            { clause: '4.1', requirement: 'ok' },
            { clause: 'DOC.1', requirement: 'bad clause' }
        ]);
        expect(rejected[0].rowNumber).toBe(2);
    });

    it('trims whitespace on clause and requirement before evaluating', () => {
        const { accepted } = window.validateChecklistRows([
            { rowNumber: 1, clause: '  9.2  ', requirement: '  Trimmed requirement  ' }
        ]);
        expect(accepted[0].clause).toBe('9.2');
        expect(accepted[0].requirement).toBe('Trimmed requirement');
    });
});

describe('checklist-module.js clause datalist sourcing (window.AuditFrameworks integration)', () => {
    beforeEach(() => {
        window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        window.UTILS = { escapeHtml: (s) => String(s == null ? '' : s) };
        loadModule('./validation.js');
        loadModule('./audit-frameworks.js');
        loadModule('./checklist-module.js');
    });

    it('refreshChecklistClauseDatalist populates "ref — title" options for a known standard', () => {
        document.body.innerHTML = `
            <select id="checklist-standard"><option value="ISO 9001:2015" selected>ISO 9001:2015</option></select>
            <datalist id="checklist-clause-options"></datalist>
        `;
        window.refreshChecklistClauseDatalist();
        const datalist = document.getElementById('checklist-clause-options');
        expect(datalist.children.length).toBeGreaterThan(0);
        const first = datalist.querySelector('option[value="4.1"]');
        expect(first).not.toBeNull();
        expect(first.textContent).toContain('4.1 —');
    });

    it('degrades to an empty datalist for an unrecognized standard', () => {
        document.body.innerHTML = `
            <select id="checklist-standard"><option value="Not A Real Standard" selected>Not A Real Standard</option></select>
            <datalist id="checklist-clause-options"></datalist>
        `;
        window.refreshChecklistClauseDatalist();
        const datalist = document.getElementById('checklist-clause-options');
        expect(datalist.children.length).toBe(0);
    });

    it('degrades gracefully (no throw, empty list) when window.AuditFrameworks is unavailable', () => {
        delete window.AuditFrameworks;
        document.body.innerHTML = `
            <select id="checklist-standard"><option value="ISO 9001:2015" selected>ISO 9001:2015</option></select>
            <datalist id="checklist-clause-options"></datalist>
        `;
        expect(() => window.refreshChecklistClauseDatalist()).not.toThrow();
        expect(document.getElementById('checklist-clause-options').children.length).toBe(0);
    });
});

// Client Workspace → Checklists renders the SAME library scoped to one client.
// A client-specific checklist carries `clientId` from the moment
// client-docs-bulk.js builds it, so the scope is a real attribute rather than
// a name match. Global checklists stay visible in the scoped view because they
// apply to every client.
//
// The scope is remembered between renders: several in-module actions
// (restore/delete/permanent-delete) re-render by calling renderChecklistLibrary()
// with no argument, and without that memory the view would silently widen back
// to every client's checklists after any of them.
describe('renderChecklistLibrary — client scoping', () => {
    beforeEach(() => {
        window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        window.UTILS = { escapeHtml: (s) => String(s == null ? '' : s) };
        window.CONSTANTS = { AUDIT_TYPES: [], AUDIT_SCOPES: [], ROLES: { CERTIFICATION_MANAGER: 'Certification Manager' } };
        // renderChecklistLibrary writes to window.contentArea (script.js caches
        // the element there), not via getElementById.
        document.body.innerHTML = '<div id="content-area"></div>';
        window.contentArea = document.getElementById('content-area');
        window.state = {
            currentUser: { role: 'Admin' },
            settings: {},
            cbSettings: { availableStandards: ['ISO 9001:2015'] },
            clients: [
                { id: 'c-1', name: 'KTD Select' },
                { id: 'c-2', name: 'PC Connection' }
            ],
            checklists: [
                { id: 1, name: 'Global ISO 9001 Baseline', standard: 'ISO 9001:2015', type: 'global', clauses: [] },
                { id: 2, name: 'KTD Select - Surveillance', standard: 'ISO 9001:2015', type: 'custom', clientId: 'c-1', clauses: [] },
                { id: 3, name: 'PC Connection - Recertification', standard: 'ISO 9001:2015', type: 'custom', clientId: 'c-2', clauses: [] }
            ],
            auditReports: [], executions: []
        };
        loadModule('./checklist-module.js');
    });

    const html = () => document.getElementById('content-area').innerHTML;

    it('unscoped, shows every client\'s checklists', () => {
        window.renderChecklistLibrary(null);
        expect(html()).toContain('KTD Select - Surveillance');
        expect(html()).toContain('PC Connection - Recertification');
        expect(html()).toContain('Global ISO 9001 Baseline');
    });

    it('scoped to a client, hides another client\'s checklists but keeps global ones', () => {
        window.renderChecklistLibrary('c-1');
        expect(html()).toContain('KTD Select - Surveillance');
        expect(html()).not.toContain('PC Connection - Recertification');
        expect(html()).toContain('Global ISO 9001 Baseline');
    });

    it('names the client it is scoped to', () => {
        window.renderChecklistLibrary('c-1');
        expect(html()).toContain('Showing checklists for');
        expect(html()).toContain('KTD Select');
    });

    it('keeps the scope across a no-argument re-render', () => {
        window.renderChecklistLibrary('c-1');
        window.renderChecklistLibrary();          // what delete/restore do
        expect(html()).not.toContain('PC Connection - Recertification');
    });

    it('an explicit null clears a previously set scope — the global route', () => {
        window.renderChecklistLibrary('c-1');
        window.renderChecklistLibrary(null);
        expect(html()).toContain('PC Connection - Recertification');
        expect(html()).not.toContain('Showing checklists for');
    });

    // Fails CLOSED: an id that matches no client record still scopes, so a
    // scoped route can never fall back to showing every client's checklists.
    // Globals stay, since they apply to everyone.
    it('an unknown client id still scopes rather than showing every client', () => {
        window.renderChecklistLibrary('no-such-client');
        expect(html()).not.toContain('KTD Select - Surveillance');
        expect(html()).not.toContain('PC Connection - Recertification');
        expect(html()).toContain('Global ISO 9001 Baseline');
    });
});

// A CONSTANTS.ROLES object present but missing CERTIFICATION_MANAGER used to
// throw before any markup was produced — window.CONSTANTS.ROLES was truthy, so
// the guard passed, then .CERTIFICATION_MANAGER.toLowerCase() blew up on
// undefined and the whole Checklist Library failed to render. Two sibling call
// sites in the same file already used `?.`; all five now agree.
describe('renderChecklistLibrary — tolerates an incomplete CONSTANTS.ROLES', () => {
    beforeEach(() => {
        window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        window.UTILS = { escapeHtml: (s) => String(s == null ? '' : s) };
        document.body.innerHTML = '<div id="content-area"></div>';
        window.contentArea = document.getElementById('content-area');
        window.state = {
            currentUser: { role: 'Auditor' },
            settings: {},
            cbSettings: { availableStandards: ['ISO 9001:2015'] },
            clients: [{ id: 'c-1', name: 'KTD Select' }],
            checklists: [{ id: 1, name: 'Global Baseline', standard: 'ISO 9001:2015', type: 'global', clauses: [] }],
            auditReports: [], executions: []
        };
        loadModule('./checklist-module.js');
    });

    it('renders when ROLES exists but has no CERTIFICATION_MANAGER key', () => {
        window.CONSTANTS = { AUDIT_TYPES: [], AUDIT_SCOPES: [], ROLES: {} };
        expect(() => window.renderChecklistLibrary(null)).not.toThrow();
        expect(document.getElementById('content-area').innerHTML).toContain('Global Baseline');
    });

    it('renders when CONSTANTS has no ROLES at all', () => {
        window.CONSTANTS = { AUDIT_TYPES: [], AUDIT_SCOPES: [] };
        expect(() => window.renderChecklistLibrary(null)).not.toThrow();
        expect(document.getElementById('content-area').innerHTML).toContain('Global Baseline');
    });

    it('still recognises a certification manager when the key IS present', () => {
        window.CONSTANTS = { AUDIT_TYPES: [], AUDIT_SCOPES: [], ROLES: { CERTIFICATION_MANAGER: 'Certification Manager' } };
        window.state.currentUser = { role: 'Certification Manager' };
        window.renderChecklistLibrary(null);
        // The cert-manager/admin banner is the observable signal of that branch.
        expect(document.getElementById('content-area').innerHTML).toContain('Certification Manager');
    });
});

// A client scoped view must not offer checklists for standards the client is
// not certified to. Showing every global put ISO 14001 / 27001 / 50001 /
// 20000-1 checklists in front of a client certified to ISO 9001 alone.
describe('renderChecklistLibrary — globals are filtered to the client\'s standards', () => {
    beforeEach(() => {
        window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        window.UTILS = { escapeHtml: (s) => String(s == null ? '' : s) };
        window.CONSTANTS = { AUDIT_TYPES: [], AUDIT_SCOPES: [], ROLES: { CERTIFICATION_MANAGER: 'Certification Manager' } };
        document.body.innerHTML = '<div id="content-area"></div>';
        window.contentArea = document.getElementById('content-area');
        window.state = {
            currentUser: { role: 'Admin' },
            settings: {},
            cbSettings: { availableStandards: [] },
            clients: [
                { id: 'ktd', name: 'KTD Select', standard: 'ISO 9001:2015' },
                { id: 'pcc', name: 'PC Connection', standard: 'ISO 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018' },
                { id: 'noc', name: 'No Standards Recorded' }
            ],
            checklists: [
                { id: 1, name: 'ISO 9001 Initial', standard: 'ISO 9001:2015', type: 'global', clauses: [] },
                { id: 2, name: 'ISO 14001 Initial', standard: 'ISO 14001:2015', type: 'global', clauses: [] },
                { id: 3, name: 'ISO 27001 Initial', standard: 'ISO 27001:2022', type: 'global', clauses: [] },
                { id: 4, name: 'ISO 50001 Initial', standard: 'ISO 50001:2018', type: 'global', clauses: [] },
                { id: 5, name: 'IMS Recovered', standard: 'ISO 27001:2022, ISO 22301:2019, ISO 20000-1:2018', type: 'global', clauses: [] },
                { id: 6, name: 'KTD Own Surveillance', standard: 'ISO 9001:2015', type: 'custom', clientId: 'ktd', clauses: [] }
            ],
            auditReports: [], executions: []
        };
        loadModule('./checklist-module.js');
    });

    const html = () => document.getElementById('content-area').innerHTML;

    it('a single-standard client sees only globals for that standard', () => {
        window.renderChecklistLibrary('ktd');
        expect(html()).toContain('ISO 9001 Initial');
        expect(html()).toContain('KTD Own Surveillance');
        expect(html()).not.toContain('ISO 14001 Initial');
        expect(html()).not.toContain('ISO 27001 Initial');
        expect(html()).not.toContain('ISO 50001 Initial');
    });

    it('a multi-standard client sees globals for any standard it holds', () => {
        window.renderChecklistLibrary('pcc');
        expect(html()).toContain('ISO 27001 Initial');
        expect(html()).not.toContain('ISO 9001 Initial');
        expect(html()).not.toContain('ISO 50001 Initial');
    });

    it('an integrated global matches when ANY of its standards is held', () => {
        window.renderChecklistLibrary('pcc');
        expect(html()).toContain('IMS Recovered');
    });

    it('ISO/IEC vs ISO spelling does not hide a relevant checklist', () => {
        // Client holds "ISO/IEC 20000-1:2018"; the global names "ISO 20000-1:2018".
        window.renderChecklistLibrary('pcc');
        expect(html()).toContain('IMS Recovered');
    });

    it('names the standards it filtered to', () => {
        window.renderChecklistLibrary('ktd');
        expect(html()).toContain('plus global checklists for');
        expect(html()).toContain('ISO 9001:2015');
    });

    it('a client with no standards recorded is not left with an empty library', () => {
        window.renderChecklistLibrary('noc');
        expect(html()).toContain('ISO 9001 Initial');
        expect(html()).toContain('ISO 14001 Initial');
    });

    it('the unscoped global library is unaffected', () => {
        window.renderChecklistLibrary(null);
        expect(html()).toContain('ISO 14001 Initial');
        expect(html()).toContain('ISO 50001 Initial');
    });
});

// "Build from Client Documents" was reachable only via Plans & Audits -> a plan
// -> Configure Checklists, so a plan had to exist before a client checklist
// could be built at all. The client workspace's own Checklists screen now
// offers it directly.
describe('renderChecklistLibrary — Build from Client Documents action', () => {
    beforeEach(() => {
        window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        window.UTILS = { escapeHtml: (s) => String(s == null ? '' : s) };
        window.CONSTANTS = { AUDIT_TYPES: [], AUDIT_SCOPES: [], ROLES: { CERTIFICATION_MANAGER: 'Certification Manager' } };
        document.body.innerHTML = '<div id="content-area"></div>';
        window.contentArea = document.getElementById('content-area');
        window.state = {
            currentUser: { role: 'Admin' }, settings: {},
            cbSettings: { availableStandards: [] },
            clients: [
                { id: 'c-1', name: 'KTD Select', standard: 'ISO 9001:2015', documents: [{ name: 'Quality Manual' }] },
                { id: 'c-2', name: 'No Docs Client', standard: 'ISO 9001:2015', documents: [] }
            ],
            checklists: [], auditReports: [], executions: []
        };
        loadModule('./checklist-module.js');
    });

    it('offers the build action in a client-scoped view', () => {
        window.renderChecklistLibrary('c-1');
        expect(document.getElementById('btn-build-from-docs')).toBeTruthy();
    });

    it('does NOT offer it in the global library, which has no client context', () => {
        window.renderChecklistLibrary(null);
        expect(document.getElementById('btn-build-from-docs')).toBeNull();
    });

    it('invokes the builder with the scoped client and no plan', () => {
        const calls = [];
        window.buildChecklistFromClientDocs = (...args) => calls.push(args);
        window.showNotification = () => {};
        window.renderChecklistLibrary('c-1');
        document.getElementById('btn-build-from-docs').click();
        expect(calls).toHaveLength(1);
        expect(calls[0][0]).toBe('c-1');
        expect(calls[0][3]).toBeNull();   // planId — built into the library, attached later
        delete window.buildChecklistFromClientDocs;
    });

    it('refuses, with a reason, when the client has no documents on file', () => {
        const calls = [];
        const notes = [];
        window.buildChecklistFromClientDocs = (...args) => calls.push(args);
        window.showNotification = (msg) => notes.push(msg);
        window.renderChecklistLibrary('c-2');
        document.getElementById('btn-build-from-docs').click();
        expect(calls).toHaveLength(0);
        expect(notes.join(' ')).toMatch(/No documents on file/i);
        delete window.buildChecklistFromClientDocs;
    });
});

// The printed checklist is a client-facing controlled document. Two things had
// to hold and neither did: its Print / Save PDF button has to actually print
// (the popup is a separate document, so the app's event delegator never reached
// it), and the sheet has to carry the CB's brand colour rather than a hardcoded
// green.
describe('printChecklist — print button and brand colours', () => {
    let popup;

    function openPrint() {
        const doc = document.implementation.createHTMLDocument('');
        let printed = 0;
        popup = {
            document: {
                write: (html) => { doc.open(); doc.write(html); doc.close(); popup.html = html; },
                close: () => {},
                querySelector: (sel) => doc.querySelector(sel)
            },
            addEventListener: () => {},
            focus: () => {},
            print: () => { printed++; },
            printCount: () => printed,
            html: ''
        };
        window.open = () => popup;
        window.printChecklist('cl-1');
        return popup;
    }

    beforeEach(() => {
        window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        window.showNotification = () => {};
        window.confirm = () => true;
        window.state = {
            cbSettings: { cbName: 'Company Certification International', primaryColor: '#1d4ed8' },
            checklists: [{
                id: 'cl-1', name: 'Recertification Audit Checklist', standard: 'ISO/IEC 27001:2022',
                type: 'custom', items: [{ clause: '6.3', requirement: 'Changes since the previous audit' }]
            }],
            clients: []
        };
        loadModule('./validation.js');
        loadModule('./checklist-module.js');
    });

    it('prints when the Print / Save PDF button is clicked', () => {
        const win = openPrint();
        const btn = win.document.querySelector('[data-action="print"]');
        expect(btn).toBeTruthy();
        btn.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
        expect(win.printCount()).toBe(1);
    });

    it('does not throw when the pop-up is blocked', () => {
        window.open = () => null;
        expect(() => window.printChecklist('cl-1')).not.toThrow();
    });

    it('paints the sheet in the CB brand colour, not the old green', () => {
        const html = openPrint().html;
        expect(html).toContain('tr.section-header td { background: #1d4ed8');
        expect(html).not.toContain('background: #059669');   // former emerald section headers
        expect(html).not.toContain('#ecfdf5');               // former emerald sub-header tint
        // Pass/warn/fail stays green/amber/red — that is status, not branding.
        expect(html).toContain('.qa-panel.qa-pass { border-left: 4px solid #059669');
    });

    it('derives every tint from whatever hue the CB configured', () => {
        window.state.cbSettings.primaryColor = '#b91c1c';
        const html = openPrint().html;
        expect(html).toContain('tr.section-header td { background: #b91c1c');
        expect(html).toContain('#f9eded');       // brand mixed 92% toward white
    });

    it('falls back to the corporate blue when no brand colour is set', () => {
        delete window.state.cbSettings.primaryColor;
        expect(openPrint().html).toContain('#1d4ed8');
    });
});

// The Ready-for-Audit gate as the UI reaches it: the release is refused while
// blockers stand, granted once they are resolved, and withdrawn automatically
// when the checklist changes afterwards.
describe('markChecklistReadyForAudit — the release gate', () => {
    let notes;

    function checklistWith(subClauses) {
        return {
            id: 'cl-1', name: 'Recertification Audit Checklist', standard: 'ISO/IEC 27001:2022',
            standardIds: ['iso27001'], auditType: 'recertification', type: 'custom',
            clientId: 'c-1', clientName: 'Acme',
            qaContext: { standardIds: ['iso27001'], auditType: 'recertification', soaApplicable: ['A.5.1'] },
            clauses: [{ mainClause: 'RECERT', title: 'Recertification', subClauses }]
        };
    }

    function fullCoverage() {
        const std = window.ChecklistStandards.byId('iso27001');
        const rows = std.clauses.filter(c => c.mandatory)
            .map(c => ({ ref: c.ref, title: c.title }))
            .concat([{ ref: 'A.5.1', title: 'Policies for information security' }]);
        // The QA pass compares questions on substance with the digits stripped,
        // and several registry titles are genuinely near-identical once they are
        // (4.3 against 4.4, 6.1.2 against 8.2). Spelling the reference out in
        // words gives each fixture question its own vocabulary, so this fixture
        // is the clean checklist it is meant to be rather than one that trips
        // the duplicate check on the titles alone.
        const spell = ref => ref.replace(/[0-9]/g, d =>
            ' ' + ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][d] + ' ');
        return rows.map(row => ({
            clause: row.ref, title: row.title,
            requirement: 'Clause' + spell(row.ref) + '— examine how the organisation satisfies '
                + row.title.toLowerCase() + ', and obtain evidence that it operates as described.',
            refs: [{ stdId: 'iso27001', ref: row.ref }]
        }));
    }

    beforeEach(() => {
        notes = [];
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        window.showNotification = (m) => notes.push(String(m));
        window.saveData = () => { };
        window.contentArea = document.body;
        // The registry has to be loaded before the fixture is built — it is
        // where the mandatory clause list a "fully covered" checklist needs
        // comes from.
        loadModule('./validation.js');
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
        window.state = {
            currentUser: { name: 'Lead Auditor' },
            clients: [{ id: 'c-1', name: 'Acme', keyProcesses: [] }],
            auditPlans: [], ncrs: [], complaints: [], appeals: [], auditReports: [],
            checklists: [checklistWith(fullCoverage())]
        };
        loadModule('./checklist-module.js');
    });

    /**
     * Clear the gate the way an auditor does: record a justification for
     * whatever still stands, until nothing blocks.
     *
     * A fully covered checklist normally clears with nothing to justify —
     * questions that merely READ alike while testing different requirements are
     * a wording note, not a blocker. The loop is here for the fixtures that do
     * carry a real blocker.
     */
    function clearTheGate(note) {
        window.prompt = () => note || 'Both questions stand; the wording is tightened on site.';
        let r = window.checklistReadiness(window.state.checklists[0]).readiness;
        for (let guard = 0; !r.ready && guard < 10; guard++) {
            window.justifyChecklistIssue('cl-1', r.blockers[0].key);
            r = window.checklistReadiness(window.state.checklists[0]).readiness;
        }
        return r;
    }

    /** Two questions against the SAME requirement — a real duplicate, not similar wording. */
    function addRealDuplicate() {
        const subs = window.state.checklists[0].clauses[0].subClauses;
        const first = subs[0];
        subs.push({
            clause: first.clause, title: first.title,
            requirement: first.requirement,
            refs: first.refs.map(r => ({ stdId: r.stdId, ref: r.ref }))
        });
    }

    it('releases a checklist once every blocker is resolved or dispositioned', () => {
        expect(clearTheGate().ready).toBe(true);
        window.markChecklistReadyForAudit('cl-1');
        const cl = window.state.checklists[0];
        expect(cl.readyForAudit).toBeTruthy();
        expect(cl.readyForAudit.by).toBe('Lead Auditor');
        expect(notes.join(' ')).toMatch(/released for audit/i);
    });

    it('clears with nothing to justify when the checklist is genuinely clean', () => {
        const r = window.checklistReadiness(window.state.checklists[0]).readiness;
        expect(r.ready).toBe(true);
        expect(window.state.checklists[0].resolvedIssues).toBeUndefined();
    });

    it('records the justification that let a real duplicate stand', () => {
        addRealDuplicate();
        expect(window.checklistReadiness(window.state.checklists[0]).readiness.ready).toBe(false);

        clearTheGate('Both sites are audited against this requirement separately, so the question is asked twice by design.');
        const cl = window.state.checklists[0];
        const recorded = Object.keys(cl.resolvedIssues || {}).map(k => cl.resolvedIssues[k]);
        expect(recorded.length).toBeGreaterThan(0);
        expect(recorded[0].by).toBe('Lead Auditor');
        expect(recorded[0].note).toMatch(/audited against this requirement separately/);
    });

    it('refuses, naming the reasons, when a question has no clause behind it', () => {
        const cl = window.state.checklists[0];
        cl.clauses[0].subClauses.push({
            clause: 'REVIEW', title: 'Unmapped documented information',
            requirement: 'Four documents on file map to no requirement of any standard in scope.',
            refs: [], auditorReview: true
        });
        window.markChecklistReadyForAudit('cl-1');
        expect(cl.readyForAudit).toBeUndefined();
        expect(notes.join(' ')).toMatch(/must be resolved first/i);
    });

    it('withdraws the release as soon as the checklist changes', () => {
        clearTheGate();
        window.markChecklistReadyForAudit('cl-1');
        const cl = window.state.checklists[0];
        expect(cl.readyForAudit).toBeTruthy();
        window.removeChecklistQuestion('cl-1', cl.clauses[0].subClauses[0].clause, 'k');
        expect(cl.readyForAudit).toBeUndefined();
    });
});
