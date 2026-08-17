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
