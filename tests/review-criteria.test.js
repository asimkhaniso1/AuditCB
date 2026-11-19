// Review Criteria (PC Connection, 2026-11-19). With every finding already on a
// criterion the screen still said "5 of them block issuance", described the
// rows as internal FOCUS/ORG/DOC references, and ran "Suggest clauses with AI"
// on all 18 assigned rows, so "use all AI proposals" + Save could replace the
// auditor's criteria in one go. One long ref also stopped the Ref column from
// wrapping and squeezed the question to one word per line.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', NOT_SAMPLED: 'not_sampled', CLOSED: 'Closed' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};

let report;
function setup(progress) {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), getPlanRef: () => 'PLN-1' };
    report = { id: 'r1', checklistProgress: progress };
    window.state = { auditReports: [report], auditPlans: [], checklists: [], clients: [], ncrs: [], cbSettings: {} };
    globalThis.state = window.state;
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    window.showNotification = vi.fn();
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    // The review helpers are defined while a tab renders.
    document.body.innerHTML = '<div id="tab-content"></div>';
    vi.useFakeTimers();
    window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [], progressMap: {}, customItems: [] });
    vi.runAllTimers();
    vi.useRealTimers();
    window.DataService = Object.assign({}, window.DataService, {
        openFormModal: (title, html) => { document.body.innerHTML = '<h2 id="t">' + title + '</h2>' + html; }
    });
    globalThis.AI_SERVICE = window.AI_SERVICE = { suggestQuestionClause: vi.fn(async () => ({ clause: '9.3', confidence: 'medium', reason: 'r' })) };
    window.reviewAllCriteria('r1');
}
const LONG = 'A.5.15 / A.5.16 / A.5.17 / A.5.18 / A.6.1 / A.6.5 / A.8.2 / A.8.5';

describe('every finding already has a criterion', () => {
    beforeEach(() => setup([
        { clause: '4.4', status: 'nc', ncrType: 'minor', requirement: 'Verify the processes needed for the ISMS, BCMS and SMS.' },
        { clause: LONG, status: 'nc', ncrType: 'major', requirement: 'Sample joiners, movers and leavers.' },
        { clause: 'FOCUS.4', criterionRef: '7.2', status: 'nc', ncrType: 'minor', requirement: 'Competence.' }
    ]));

    it('no row is said to block issuance', () => {
        expect(document.getElementById('t').textContent).toBe('Review Criteria — 0 unassigned, 3 to review');
        expect(document.body.textContent).not.toMatch(/block issuance/i);
        expect(document.getElementById('rac-intro').textContent).toMatch(/^Every finding already has a criterion, so nothing blocks issuance here/);
        expect(document.getElementById('rac-intro').textContent).not.toContain('FOCUS/ORG/DOC');
    });

    it('AI is not offered, so it cannot replace a chosen criterion', () => {
        const btn = document.getElementById('rac-ai-suggest-btn');
        expect(btn.disabled).toBe(true);
        expect(btn.textContent.trim()).toBe('Suggest clauses with AI');
        expect(btn.getAttribute('title')).toMatch(/already has a criterion/);
    });

    it('a long ref wraps instead of widening the Ref column', () => {
        const cell = Array.from(document.querySelectorAll('#rac-table-wrap tbody td:first-child')).find(td => td.textContent === LONG);
        expect(cell.style.whiteSpace).toBe('normal');
        expect(cell.style.maxWidth).toBe('7.5rem');
    });
});

describe('a mix of assigned and unassigned findings', () => {
    beforeEach(() => setup([
        { clause: '4.4', status: 'nc', ncrType: 'minor', requirement: 'Processes.' },
        { clause: 'FOCUS.2', status: 'nc', ncrType: 'minor', requirement: 'Management review inputs.' },
        { clause: 'FOCUS.3', status: 'conform', requirement: 'Leadership commitment.' },
        { clause: 'FOCUS.5', status: 'conform', requirement: 'Awareness.', criterionSuggestedRef: '7.3', criterionConfidence: 'medium', criterionBasis: 'clause-token-in-question' }
    ]));

    it('only an unassigned Major/Minor blocks, and the text says so', () => {
        const rows = window.NCRSyncUtils.collectUnconfirmedCriteria(report, { includeAssigned: true });
        expect(rows.filter(r => r.blocksIssuance).map(r => r.clause)).toEqual(['FOCUS.2']);
        const intro = document.getElementById('rac-intro').textContent;
        expect(intro).toContain('3 findings carry an internal working reference');
        expect(intro).toContain('1 of them block issuance');
        expect(intro).toContain('The 1 with a criterion already follow, for review.');
    });

    it('AI runs only on unassigned rows with no suggestion, and "use all" leaves an assigned criterion alone', async () => {
        const btn = document.getElementById('rac-ai-suggest-btn');
        expect(btn.textContent.trim()).toBe('Suggest clauses with AI (2)');
        btn.click();
        await vi.waitFor(() => expect(document.getElementById('rac-ai-toggle-all').disabled).toBe(false));
        expect(window.AI_SERVICE.suggestQuestionClause).toHaveBeenCalledTimes(2);
        const asked = window.AI_SERVICE.suggestQuestionClause.mock.calls.map(c => c[0].sourceClause).sort();
        expect(asked).toEqual(['FOCUS.2', 'FOCUS.3']);

        const toggle = document.getElementById('rac-ai-toggle-all');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        const value = (clause) => {
            const row = Array.from(document.querySelectorAll('#rac-table-wrap tbody tr')).find(tr => tr.cells[0].textContent === clause);
            return row.querySelector('.rac-input').value;
        };
        expect(value('4.4')).toBe('4.4');
        expect(value('FOCUS.2')).toBe('9.3');
        expect(value('FOCUS.3')).toBe('9.3');
        expect(value('FOCUS.5')).toBe('');
    });

    it('unticking "use" puts back what the row had', () => {
        const row = Array.from(document.querySelectorAll('#rac-table-wrap tbody tr')).find(tr => tr.cells[0].textContent === 'FOCUS.5');
        const box = row.querySelector('.rac-use');
        const input = row.querySelector('.rac-input');
        input.setAttribute('data-current', '7.1');
        box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
        expect(input.value).toBe('7.3');
        box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true }));
        expect(input.value).toBe('7.1');
    });
});
