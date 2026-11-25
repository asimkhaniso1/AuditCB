// The statement box showed one fixed example, about clause 9.2 internal audits,
// under every question. On PC Connection's 6.1 risk question it was no use as a
// model (2026-11-18). The label, the example and an insertable template now
// follow the question's clause and requirement and the grade chosen, and a
// template blank left in a statement is caught before it is printed.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', CLOSED: 'Closed', FINALIZED: 'Finalized' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};
const RISK_REQ = 'Verify that actions to address risks and opportunities are planned, proportionate and integrated into the system processes, and that their effectiveness is evaluated. Documented information on file that should support this: Risk Assessment Procedure 20000-1; Risk Assessment Procedure 22301.';
const RISK_REQ_TEXT = 'actions to address risks and opportunities are planned, proportionate and integrated into the system processes, and that their effectiveness is evaluated';

let H;
beforeEach(() => {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), getPlanRef: () => 'PLN-1' };
    window.state = { auditReports: [], auditPlans: [], checklists: [], clients: [], ncrs: [], cbSettings: {} };
    globalThis.state = window.state;
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    H = window.FindingStatementHint;
});

describe('the example follows the question and the grade', () => {
    it('a nonconformity on the 6.1 risk question states that requirement, not clause 9.2', () => {
        const hint = H.forType('minor', '6.1.1 / 6.1', RISK_REQ);
        expect(hint.title).toBe('Nonconformity statement');
        expect(hint.template).toBe('Clause 6.1.1 / 6.1 requires that ' + RISK_REQ_TEXT + '. [What was not fulfilled], as shown by [record, interview or observation].');
        expect(H.example(hint)).toMatch(/^e\.g\. Clause 6\.1\.1 \/ 6\.1 requires that /);
        // The list of client documents is not part of the requirement.
        expect(hint.template).not.toContain('Documented information');
    });

    it('an observation asks for what was seen and the risk', () => {
        const hint = H.forType('observation', '6.1.1 / 6.1', RISK_REQ);
        expect(hint.title).toBe('Observation');
        expect(hint.template).toContain('[What was seen], as shown by [record, interview or observation]. This is not a nonconformity yet, but [the risk if it continues].');
    });

    it('an OFI says the requirement is met and asks what could be more effective, without a solution', () => {
        const hint = H.forType('ofi', '6.1.1 / 6.1', RISK_REQ);
        expect(hint.title).toBe('Opportunity for improvement');
        expect(hint.help).toMatch(/do not prescribe a solution/);
        expect(hint.template).toContain('This is met: [evidence that it is met]. [What could be more effective, and why].');
    });

    it('reads a requirement written as an instruction, and copes with none', () => {
        expect(H.forType('minor', '4.4', 'Determine the processes needed for the management system and their interactions.').template)
            .toBe('Clause 4.4 requires: determine the processes needed for the management system and their interactions. [What was not fulfilled], as shown by [record, interview or observation].');
        expect(H.forType('', '', '').template).toBe('The requirement applies. [What was not fulfilled], as shown by [record, interview or observation].');
    });

    it('finds template blanks, and only those', () => {
        expect(H.hasBlanks('Clause 6.1 requires X. [What was not fulfilled], as shown by the register.')).toBe(true);
        expect(H.hasBlanks('Clause 6.1 requires X. Not done, as shown by [record, interview or observation].')).toBe(true);
        expect(H.hasBlanks('Clause 6.1 requires X [see SoA v4]. Not done.')).toBe(false);
        expect(H.hasBlanks('')).toBe(false);
    });
});

describe('the Finding Details panel', () => {
    const checklist = { id: 'cl1', name: 'PCC', clauses: [{ mainClause: 'IMS', title: 'IMS', subClauses: [{ clause: '6.1.1 / 6.1', requirement: RISK_REQ }] }] };
    function render(saved) {
        document.body.innerHTML = '<div id="tab-content"></div>';
        vi.useFakeTimers();
        const report = { id: 'r1', checklistProgress: [Object.assign({ checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc' }, saved)] };
        window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [checklist], progressMap: { 'cl1-IMS-0': report.checklistProgress[0] }, customItems: [] });
        vi.useRealTimers();
        return 'cl1-IMS-0';
    }

    it('shows the example and label for this question and grade', () => {
        const id = render({ ncrType: 'minor' });
        const box = document.getElementById('ncr-desc-' + id);
        expect(box.getAttribute('placeholder')).toMatch(/^e\.g\. Clause 6\.1\.1 \/ 6\.1 requires that actions to address risks/);
        expect(box.getAttribute('placeholder')).not.toContain('9.2');
        expect(document.getElementById('ncr-desc-title-' + id).textContent).toBe('Nonconformity statement');
    });

    it('changes label and example when the grade changes', () => {
        const id = render({ ncrType: 'minor' });
        const sel = document.getElementById('ncr-type-' + id);
        sel.value = 'observation';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        expect(document.getElementById('ncr-desc-title-' + id).textContent).toBe('Observation');
        expect(document.getElementById('ncr-desc-' + id).getAttribute('placeholder')).toContain('[the risk if it continues]');
    });

    it('Insert template fills an empty box, selects the first blank and tells autosave', () => {
        const id = render({ ncrType: 'minor' });
        const box = document.getElementById('ncr-desc-' + id);
        const onInput = vi.fn();
        box.addEventListener('input', onInput);
        expect(window.insertFindingTemplate(id)).toBe(true);
        expect(box.value).toBe('Clause 6.1.1 / 6.1 requires that ' + RISK_REQ_TEXT + '. [What was not fulfilled], as shown by [record, interview or observation].');
        expect(onInput).toHaveBeenCalled();
        expect(box.value.slice(box.selectionStart, box.selectionEnd)).toBe('[What was not fulfilled]');
    });

    it('puts the remark in as the evidence (OFI), leaving only the judgement blank', () => {
        const id = render({ ncrType: 'ofi', comment: 'Three separate risk assessment procedures are maintained (20000-1, 22301, 27001)' });
        const box = document.getElementById('ncr-desc-' + id);
        expect(window.insertFindingTemplate(id)).toBe(true);
        expect(box.value).toBe('Clause 6.1.1 / 6.1 requires that ' + RISK_REQ_TEXT + '. This is met: Three separate risk assessment procedures are maintained (20000-1, 22301, 27001). [What could be more effective, and why].');
        expect(box.value.slice(box.selectionStart, box.selectionEnd)).toBe('[What could be more effective, and why]');
    });

    it('uses the remark as it is now, not as it was loaded, and as objective evidence for an NC', () => {
        const id = render({ ncrType: 'minor', comment: 'old' });
        document.getElementById('comment-' + id).value = '  Risk register  last reviewed in 2024.  ';
        window.insertFindingTemplate(id);
        expect(document.getElementById('ncr-desc-' + id).value).toBe('Clause 6.1.1 / 6.1 requires that ' + RISK_REQ_TEXT + '. [What was not fulfilled]. Objective evidence: Risk register last reviewed in 2024.');
    });

    it('an observation keeps the risk blank; a remark with "&" or "$&" goes in as typed', () => {
        const H2 = window.FindingStatementHint;
        const hint = H2.forType('observation', '8.1', 'Operational planning and control.');
        expect(H2.withEvidence(hint, 'R&D change log has gaps; see $& note')).toBe('Clause 8.1 requires: operational planning and control. [What was seen]. Objective evidence: R&D change log has gaps; see $& note. This is not a nonconformity yet, but [the risk if it continues].');
        expect(H2.withEvidence(hint, '   ')).toBe(hint.template);
    });

    it('never overwrites a statement already written', () => {
        const id = render({ ncrType: 'minor', ncrDescription: 'My own statement.' });
        window.showNotification = vi.fn();
        expect(window.insertFindingTemplate(id)).toBe(false);
        expect(document.getElementById('ncr-desc-' + id).value).toBe('My own statement.');
        expect(window.showNotification).toHaveBeenCalledWith(expect.stringContaining('Clear it first'), 'info');
    });

    it('the button is wired through the delegator by question id', () => {
        const id = render({ ncrType: 'minor' });
        const btn = document.querySelector('[data-action="insertFindingTemplate"]');
        expect(btn.getAttribute('data-arg1')).toBe(id);
    });
});

describe('a template blank is caught before it prints', () => {
    it('Report Integrity warns (W33) for a statement with a blank left in', () => {
        window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
        loadScript('./report-stats.js', { params: { module: undefined } });
        loadScript('./report-integrity.js', { params: { module: undefined } });
        const report = { id: 'r1', planId: 'p1', date: '2026-11-17', checklistProgress: [
            { checklistId: 'cl1', itemIdx: 'IMS-0', clause: '6.1', status: 'nc', ncrType: 'minor', ncrDescription: 'Clause 6.1 requires X. [What was not fulfilled], as shown by the register.' },
            { checklistId: 'cl1', itemIdx: 'IMS-1', clause: '9.2', status: 'nc', ncrType: 'minor', ncrDescription: 'Clause 9.2 requires audits. None held in 2026, as shown by the audit log.' }
        ] };
        const w33 = window.ReportIntegrity.check({ report, auditPlan: { id: 'p1', auditType: 'Recertification' }, client: {} }).warnings.filter(w => w.id === 'W33');
        expect(w33).toHaveLength(1);
        expect(w33[0].message).toMatch(/clause 6\.1 still has a template blank/);
    });

    it('the findings summary asks before printing one', () => {
        const DF = require('../doc-format.js'); const PS = require('../print-shell.js');
        window.DocFormat = DF; window.PrintShell = PS;
        loadScript('./findings-summary.js', { params: { module: undefined } });
        window.state = { auditReports: [{ id: 'r1', client: 'C', ncrs: [], checklistProgress: [
            { checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc', ncrType: 'minor', ncrDescription: 'Clause 6.1 requires X. [What was not fulfilled], as shown by Y.' }] }],
            auditPlans: [], checklists: [], clients: [], cbSettings: {} };
        const open = vi.spyOn(PS, 'open').mockReturnValue({});
        window.confirm = vi.fn(() => false);
        expect(window.printFindingsSummary('r1')).toBeNull();
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('NC-001 still has a template blank'));
        expect(open).not.toHaveBeenCalled();
        open.mockRestore();
    });
});
