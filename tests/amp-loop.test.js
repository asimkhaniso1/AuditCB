// "Process &amp;amp;amp;… Quality Manager" (PC Connection, 2026-11-18, v290):
// the checklist rendered stored text with escapeHtml, but the text was stored
// escaped (saveChecklist runs it through Sanitizer.sanitizeText). The input
// therefore showed "&amp;", the next save escaped that again, and every
// autosave added one "amp;". Remarks with an apostrophe grew the same way.
// The decoders also gave up after 5–6 layers, so a long chain printed as is.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', NOT_SAMPLED: 'not_sampled', CLOSED: 'Closed' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};
const chain = (n) => 'Process &' + 'amp;'.repeat(n) + ' Quality Manager';

describe('decoders collapse a runaway chain', () => {
    it('UTILS.decodeEntities: any depth, and other entities still decode', () => {
        const U = require('../utils.js');
        expect(U.decodeEntities(chain(1))).toBe('Process & Quality Manager');
        expect(U.decodeEntities(chain(150))).toBe('Process & Quality Manager');
        expect(U.decodeEntities("don&amp;amp;amp;#039;t &amp;amp;lt;b&amp;gt;")).toBe("don't <b>");
        expect(U.decodeEntities('plain text')).toBe('plain text');
    });

    it('DocFormat.decodeEntities (the prints): any depth', () => {
        const DF = require('../doc-format.js');
        expect(DF.decodeEntities(chain(150))).toBe('Process & Quality Manager');
        expect(DF.decodeEntities('O&amp;amp;amp;#039;Brien')).toBe("O'Brien");
    });
});

describe('the checklist saves a value back unchanged', () => {
    let row;
    beforeEach(() => {
        window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        window.CONSTANTS = CONSTANTS;
        window.UTILS = require('../utils.js');
        window.UTILS.escapeHtml = window.UTILS.escapeHtml || ((s) => String(s));
        window.state = { auditReports: [], auditPlans: [], checklists: [], clients: [], ncrs: [], cbSettings: {} };
        globalThis.state = window.state;
        for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
        loadScript('./sanitization.js', { params: { module: undefined } });
        loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
        row = { checklistId: 'cl1', itemIdx: 'IMS-0', status: 'conform' };
    });

    const checklist = { id: 'cl1', name: 'PCC', clauses: [{ mainClause: 'IMS', title: 'IMS', subClauses: [{ clause: '9.3', requirement: 'Management review.' }] }] };
    const personnel = [{ name: "Samantha O'Neil", role: 'Process & Quality Manager' }];
    function render(saved) {
        document.body.innerHTML = '<div id="tab-content"></div>';
        vi.useFakeTimers();
        window.__renderExecutionTab({ id: 'r1', checklistProgress: [saved] }, 'checklist', { assignedChecklists: [checklist], progressMap: { 'cl1-IMS-0': saved }, customItems: [], clientPersonnel: personnel });
        vi.useRealTimers();
        const v = (id) => document.getElementById(id + '-cl1-IMS-0').value;
        return { comment: v('comment'), designation: v('ncr-designation'), department: v('ncr-department'), personnel: v('ncr-personnel') };
    }
    // What saveChecklist stores for these fields.
    const store = (shown) => ({
        comment: window.Sanitizer.sanitizeText(shown.comment),
        designation: window.Sanitizer.sanitizeText(shown.designation),
        department: window.Sanitizer.sanitizeText(shown.department),
        personnel: window.Sanitizer.sanitizeText(shown.personnel)
    });

    it('shows a corrupted value clean, and saving it stores it escaped once', () => {
        const shown = render(Object.assign(row, { designation: chain(120), department: 'R&amp;amp;amp;D', comment: "Minutes don&amp;amp;#039;t list decisions" }));
        expect(shown.designation).toBe('Process & Quality Manager');
        expect(shown.department).toBe('R&D');
        expect(shown.comment).toBe("Minutes don't list decisions");
        const saved = store(shown);
        expect(saved.designation).toBe('Process &amp; Quality Manager');
        expect(saved.department).toBe('R&amp;D');
    });

    it('ten save-and-redraw cycles leave the value as it was', () => {
        let saved = Object.assign(row, { designation: 'Process &amp; Quality Manager', comment: "It&#039;s held & minuted", personnel: "Samantha O&#039;Neil" });
        for (let i = 0; i < 10; i++) saved = Object.assign({}, row, store(render(saved)));
        const shown = render(saved);
        expect(shown.designation).toBe('Process & Quality Manager');
        expect(shown.comment).toBe("It's held & minuted");
        expect(saved.designation).toBe('Process &amp; Quality Manager');
    });

    it('a stored name with an apostrophe still selects the client contact', () => {
        render(Object.assign(row, { personnel: 'Samantha O&#039;Neil' }));
        const sel = document.getElementById('ncr-personnel-cl1-IMS-0');
        expect(sel.value).toBe("Samantha O'Neil");
        expect(Array.from(sel.options).filter(o => o.value === "Samantha O'Neil").length).toBe(1);
    });
});
