// One screen for the findings that still need the auditor's words, and a
// review-then-approve step for AI-drafted text (PC Connection, 2026-11-19).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', NOT_SAMPLED: 'not_sampled', CLOSED: 'Closed' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};

let report;
function setup() {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = require('../utils.js');
    window.UTILS.escapeHtml = window.UTILS.escapeHtml || ((s) => String(s));
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    loadScript('./sanitization.js', { params: { module: undefined } });
    loadScript('./execution-module-v2.js', { params: { module: undefined } });
    loadScript('./report-integrity.js', { params: { module: undefined } });
    loadScript('./fix-findings.js', { params: { module: undefined } });
    report = { id: 'r1', standard: 'ISO 22301:2019', checklistProgress: [
        { checklistId: 'cl1', itemIdx: 'A-0', clause: '7.5', status: 'nc', ncrType: 'minor', requirement: 'Control documented information.', comment: 'Change request section missing in the procedure.' },
        { checklistId: 'cl1', itemIdx: 'A-1', clause: '4.4', status: 'nc', ncrType: 'minor', requirement: 'Establish the BCMS.', comment: '', ncrDescription: 'Process Map missing' },
        { checklistId: 'cl1', itemIdx: 'A-2', clause: '7.2', status: 'conform', comment: 'check competency matrix' },
        { checklistId: 'cl1', itemIdx: 'A-3', clause: '9.1', status: 'conform', comment: 'Monitoring results for 2026 were reviewed at the March management review.' },
        { checklistId: 'cl1', itemIdx: 'A-4', clause: '8.3', status: 'nc', ncrType: 'ofi', ncrDescription: 'Clause 8.3 requires X. This is met: Y. [What could be more effective, and why].', comment: 'Strategy options reviewed in 2025.' }
    ] };
    window.state = { auditReports: [report], checklists: [], ncrs: [], cbSettings: {} };
    globalThis.state = window.state;
    window.showNotification = vi.fn();
    window.saveChecklist = vi.fn();
    window.runReportIntegrityCheck = vi.fn();
    window.closeModal = vi.fn();
    window.DataService = { openFormModal: (title, html, onSave) => { document.body.innerHTML = '<h2 id="t">' + title + '</h2>' + html; window.__save = onSave; } };
}

describe('what needs the auditor’s text', () => {
    beforeEach(setup);

    it('lists missing statements, missing evidence, template blanks and raw notes — register NCs first', () => {
        const rows = window.FixFindings.collect(report);
        const summary = rows.map(r => r.clause + ':' + r.fields.map(f => f.key).join('+'));
        expect(summary).toEqual(['7.5:ncrDescription', '4.4:comment+ncrDescription', '7.2:comment', '8.3:ncrDescription']);
        // 9.1 is a proper statement: not listed.
        expect(rows.find(r => r.clause === '9.1')).toBeUndefined();
    });

    it('a missing statement starts from the template, with the auditor’s remark as the evidence', () => {
        const f = window.FixFindings.collect(report)[0].fields[0];
        expect(f.value).toBe('Clause 7.5 requires: control documented information. [What was not fulfilled]. Objective evidence: Change request section missing in the procedure.');
    });
});

describe('the Fix findings screen', () => {
    beforeEach(setup);
    const box = (clause) => {
        const row = Array.from(document.querySelectorAll('.ff-row')).find(r => r.textContent.includes(clause));
        return row.querySelector('.ff-box');
    };

    it('saves only what was written, once, and keeps the original note', () => {
        window.openFixFindings('r1');
        expect(document.getElementById('t').textContent).toBe('Fix findings — 5 to write');
        box('7.5').value = 'Clause 7.5 requires control of changes. The procedures have no change-request section. Objective evidence: Change request section missing in the procedure.';
        box('7.2').value = 'Competency matrix reviewed; two 2026 starters not yet included.';
        window.__save();
        const items = report.checklistProgress;
        expect(items[0].ncrDescription).toContain('The procedures have no change-request section.');
        expect(items[2].comment).toBe('Competency matrix reviewed; two 2026 starters not yet included.');
        expect(items[2]._originalComment).toBe('check competency matrix');
        // Untouched boxes stay as they were.
        expect(items[1].comment).toBe('');
        expect(items[4].ncrDescription).toContain('[What could be more effective, and why]');
        expect(window.saveChecklist).toHaveBeenCalledTimes(1);
        expect(window.runReportIntegrityCheck).toHaveBeenCalledWith('r1');
    });

    it('refuses to save a statement that still has a [blank], and writes nothing', () => {
        window.openFixFindings('r1');
        box('7.2').value = 'Competency matrix reviewed.';
        box('8.3').value = 'Clause 8.3 requires X. This is met: Y. [What could be more effective, and why]. Extra.';
        window.__save();
        expect(report.checklistProgress[2].comment).toBe('check competency matrix');
        expect(window.saveChecklist).not.toHaveBeenCalled();
        expect(window.showNotification).toHaveBeenCalledWith(expect.stringContaining('[bracketed] blank'), 'error');
    });

    it('stores text the way the checklist does (escaped once), and shows it decoded', () => {
        report.checklistProgress[2].comment = 'R&amp;D check';
        window.openFixFindings('r1');
        expect(box('7.2').value).toBe('R&D check');
        box('7.2').value = 'R&D change log reviewed; it is complete.';
        window.__save();
        expect(report.checklistProgress[2].comment).toBe('R&amp;D change log reviewed; it is complete.');
    });

    it('Polish rewrites only the text in the box, and Undo puts it back', async () => {
        window.AI_SERVICE = { refineAuditNotes: vi.fn(async (items) => items.map(i => ({ ...i, comment: 'The competency matrix was reviewed.' }))) };
        window.openFixFindings('r1');
        const b = box('7.2');
        b.value = 'competency matrix checked';
        b.closest('.ff-row').querySelector('.ff-polish').click();
        await vi.waitFor(() => expect(b.value).toBe('The competency matrix was reviewed.'));
        expect(window.AI_SERVICE.refineAuditNotes.mock.calls[0][0]).toEqual([{ clause: '7.2', status: 'conform', comment: 'competency matrix checked' }]);
        b.closest('.ff-row').querySelector('.ff-undo').click();
        expect(b.value).toBe('competency matrix checked');
    });

    it('never asks AI to fill an empty box or a template blank', () => {
        window.AI_SERVICE = { refineAuditNotes: vi.fn() };
        window.openFixFindings('r1');
        box('4.4').closest('.ff-row').querySelector('.ff-polish').click();
        box('7.5').closest('.ff-row').querySelector('.ff-polish').click();
        expect(window.AI_SERVICE.refineAuditNotes).not.toHaveBeenCalled();
    });
});

describe('Review & approve AI text', () => {
    beforeEach(setup);

    it('shows the AI-drafted summary, and Save approves it', () => {
        report.executiveSummary = 'The audit found a mature BCMS &amp; ISMS.';
        report.aiContent = { execSummary: { status: 'draft' } };
        window.confirmAiContent = vi.fn(() => true);
        window.approveAiText('r1');
        expect(document.body.textContent).toContain('The audit found a mature BCMS & ISMS.');
        window.__save();
        expect(window.confirmAiContent).toHaveBeenCalledWith('r1', 'all');
        expect(window.runReportIntegrityCheck).toHaveBeenCalledWith('r1');
    });

    it('says so when there is nothing to approve', () => {
        window.approveAiText('r1');
        expect(window.showNotification).toHaveBeenCalledWith(expect.stringContaining('no AI-drafted text'), 'info');
    });
});

describe('the Report Integrity panel offers both', () => {
    it('a Fix findings bar and an approve button on the AI warning', () => {
        const src = fs.readFileSync('execution-module-v2.js', 'utf8');
        expect(src).toContain('data-action="openFixFindings"');
        expect(src).toMatch(/showApproveAi = \/\^W6-\//);
        expect(src).toContain('data-action="approveAiText"');
        expect(fs.readFileSync('index.html', 'utf8')).toMatch(/report-integrity\.js[^"]*" defer><\/script>\s*<script src="\.\/fix-findings\.js/);
    });
});
