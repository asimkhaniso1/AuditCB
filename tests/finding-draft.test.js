// "Draft from evidence" on Fix findings (PC Connection, 2026-11-20): the
// "What you saw" box of a finding was empty and "Polish" had nothing to
// rewrite. The draft uses only the auditor's record of that question (note,
// finding note, who, when, screenshots); what it does not say is left as
// "[To write: …]", and a box with one is never saved.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', NOT_SAMPLED: 'not_sampled', CLOSED: 'Closed' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};

let AI;
let report;
beforeAll(() => {
    window.CONSTANTS = CONSTANTS;
    window.UTILS = require('../utils.js');
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    loadScript('./sanitization.js', { params: { module: undefined } });
    loadScript('./report-stats.js', { global: true });
    loadScript('./ai-service.js', { params: { module: undefined } });
    loadScript('./execution-module-v2.js', { params: { module: undefined } });
    loadScript('./report-integrity.js', { params: { module: undefined } });
    loadScript('./fix-findings.js', { params: { module: undefined } });
});
let realDraft;
beforeEach(() => {
    AI = window.AI_SERVICE;
    realDraft = realDraft || AI.draftFindingText;
    AI.draftFindingText = realDraft;
    report = { id: 'r1', standard: 'ISO 22301:2019', checklistProgress: [
        { checklistId: 'cl1', itemIdx: 'A-0', clause: '4.4', status: 'nc', ncrType: 'minor', requirement: 'Verify the processes needed for the BCMS and their interactions are determined.', comment: '', ncrDescription: 'Process Map missing',
            personnel: 'Samantha Johnston', designation: 'Process &amp; Quality Manager', evidenceImages: ['https://x/sop.jpg'], evidenceCapturedAtList: ['2026-11-17T14:40:00.000Z'] },
        { checklistId: 'cl1', itemIdx: 'A-1', clause: '7.2', status: 'conform', requirement: 'Verify competence requirements are defined.', comment: 'check competency matrix' },
        { checklistId: 'cl1', itemIdx: 'A-2', clause: '8.4', status: 'nc', ncrType: 'minor', requirement: 'Sample the plans.', comment: '' }
    ] };
    window.state = { auditReports: [report], checklists: [], ncrs: [], cbSettings: {}, knowledgeBase: { standards: [] } };
    globalThis.state = window.state;
    window.EvidenceUtils = { compress: vi.fn(async (src) => 'data:image/jpeg;base64,' + Buffer.from(String(src).slice(-10)).toString('base64')) };
    window.showNotification = vi.fn();
    window.saveChecklist = vi.fn();
    window.runReportIntegrityCheck = vi.fn();
    window.closeModal = vi.fn();
    window.DataService = { openFormModal: (title, html, onSave) => { document.body.innerHTML = '<h2 id="t">' + title + '</h2>' + html; window.__save = onSave; } };
});

const reply = (obj) => ({ text: JSON.stringify(obj), usage: { promptTokenCount: 900, candidatesTokenCount: 120 }, model: 'gemini-2.5-flash' });
const INPUT = {
    kind: 'evidence', grade: 'minor', clause: '4.4', question: 'Verify the processes needed for the BCMS and their interactions are determined.', requirements: [],
    remark: '', statement: 'Process Map missing', auditee: 'Samantha Johnston', designation: 'Process & Quality Manager', dates: ['17 November 2026'],
    images: [{ evId: 'Image 1', src: 'https://x/sop.jpg' }]
};

describe('what the draft is given', () => {
    it('only the auditor’s record of that question: notes, who, when and its screenshots', () => {
        const rows = window.FixFindings.collect(report);
        const input = window.FixFindings.draftInputFor(rows[0], 'comment', report);
        expect(input).toMatchObject({
            kind: 'evidence', grade: 'minor', clause: '4.4', remark: '', statement: 'Process Map missing',
            auditee: 'Samantha Johnston', designation: 'Process & Quality Manager', dates: ['17 November 2026'],
            images: [{ evId: 'Image 1', src: 'https://x/sop.jpg' }]
        });
        expect(window.FixFindings.draftInputFor(rows[0], 'ncrDescription', report).kind).toBe('statement');
    });

    it('one call with the screenshots, on the evidence model, and the prompt forbids guessing', async () => {
        AI.callProxyAPI = vi.fn(async () => reply({ text: 'The MSD Support SOP was reviewed.', quotes: ['MSD Support SOP'] }));
        await AI.draftFindingText(INPUT);
        const [prompt, opts] = AI.callProxyAPI.mock.calls[0];
        expect(opts).toMatchObject({ json: true, feature: 'finding-draft', models: ['gemini-2.0-flash-lite'] });
        expect(opts.images).toHaveLength(1);
        expect(prompt).toContain('AUDITOR\'S FINDING NOTE: "Process Map missing"');
        expect(prompt).toContain('RECORDED WITH: Samantha Johnston, Process & Quality Manager');
        expect(prompt).toContain('SCREENSHOTS CAPTURED ON: 17 November 2026');
        expect(prompt).toContain('do not guess. Write [To write: what is needed]');
        expect(prompt).toContain('never write "conform"');
        expect(prompt).toContain('never the person\'s name');
        expect(prompt).toContain('add [To write: what the issue was]');
        expect(prompt).toContain('Do not restate the audit question');
    });

    it('nothing recorded (no note, no finding note, no screenshot): no call', async () => {
        AI.callProxyAPI = vi.fn();
        const out = await AI.draftFindingText({ kind: 'evidence', clause: '8.4', question: 'Sample the plans.', remark: '', statement: '', images: [] });
        expect(out.status).toBe('nothing');
        expect(out.flags[0]).toContain('nothing to draft from');
        expect(AI.callProxyAPI).not.toHaveBeenCalled();
    });

    it('a statement draft is asked for the requirement, what was not fulfilled, and the evidence', async () => {
        AI.callProxyAPI = vi.fn(async () => reply({ text: 'x', quotes: [] }));
        await AI.draftFindingText(Object.assign({}, INPUT, { kind: 'statement' }));
        const prompt = AI.callProxyAPI.mock.calls[0][0];
        expect(prompt).toContain('what clause 4.4 requires');
        expect(prompt).toContain('[To write: what was not fulfilled]');
        expect(prompt).toContain('starting "Evidence:"');
        expect(prompt).toContain('Take it from the AUDIT QUESTION');
        expect(prompt).toContain('Write the statement itself, not a report of it.');
        expect(prompt).toContain('never write "the auditor noted"');
        await AI.draftFindingText(Object.assign({}, INPUT, { kind: 'statement', grade: 'ofi' }));
        expect(AI.callProxyAPI.mock.calls[1][0]).toContain('[To write: what could be more effective]');
    });
});

describe('the draft is checked before it reaches the box', () => {
    const run = async (obj, input) => { AI.callProxyAPI = vi.fn(async () => reply(obj)); return AI.draftFindingText(input || INPUT); };

    it('keeps what is quoted from a screenshot or in the auditor’s record, and keeps the blanks', async () => {
        const out = await run({
            text: 'The MSD Support SOP was reviewed with the Process & Quality Manager on 17 November 2026. It contains a case workflow for the service desk. [To write: what showed that no process map exists].',
            quotes: ['MSD Support SOP', 'Workflow']
        });
        expect(out.text).toBe('The MSD Support SOP was reviewed with the Process & Quality Manager on 17 November 2026. It contains a case workflow for the service desk. [To write: what showed that no process map exists].');
        expect(out.blanks).toBe(1);
        expect(out.flags).toEqual([]);
    });

    it('removes a sentence with a date, figure or document name that is not in the record', async () => {
        const out = await run({
            text: 'The MSD Support SOP was reviewed on 18 November 2026. The Process Mapping Procedure was last approved in 2024. It contains a case workflow.',
            quotes: ['MSD Support SOP']
        });
        expect(out.text).toBe('It contains a case workflow.');
        expect(out.flags).toHaveLength(2);
        expect(out.flags.join(' ')).toContain('"18"');
        expect(out.flags.join(' ')).toContain('Process Mapping Procedure');
    });

    it('an evidence paragraph never states the result, but may name a Compliance Register', async () => {
        const out = await run({
            text: 'The Compliance Register was reviewed. This is a nonconformity against the clause.',
            quotes: ['Compliance Register']
        });
        expect(out.text).toBe('The Compliance Register was reviewed.');
        expect(out.flags.join(' ')).toContain('the result is yours to record');
    });

    it('what is inside a [To write: …] blank is not treated as a fact', async () => {
        const out = await run({ text: 'The workflow was reviewed. [To write: which of the 13 services the Access Policy covers].', quotes: [] });
        expect(out.text).toContain('[To write: which of the 13 services the Access Policy covers].');
        expect(out.flags).toEqual([]);
    });

    it('takes the quotation marks off names, and leaves apostrophes alone', async () => {
        const out = await run({ text: 'The "MSD Support SOP" was reviewed; its \'Workflow\' page shows the service desk\'s case intake.', quotes: ['MSD Support SOP', 'Workflow'] });
        expect(out.text).toBe('The MSD Support SOP was reviewed; its Workflow page shows the service desk\'s case intake.');
    });

    it('the question’s planning notes are not sent and are not a source of facts', async () => {
        const input = Object.assign({}, INPUT, { question: 'Sample service requests. Pre-audit gap: no documented information was on file at the pre-audit review, and evidence was requested from the client on 16 November 2026.' });
        const out = await run({ text: 'The MSD Support SOP was reviewed. Evidence was requested on 16 November 2026.', quotes: ['MSD Support SOP'] }, input);
        expect(AI.callProxyAPI.mock.calls[0][0]).not.toContain('Pre-audit gap');
        expect(AI.callProxyAPI.mock.calls[0][0]).toContain('Sample service requests.');
        expect(out.text).toBe('The MSD Support SOP was reviewed.');
        expect(out.flags.join(' ')).toContain('"16"');
    });

    it('says so when nothing survives, or the reply cannot be read', async () => {
        const out = await run({ text: 'The Annual Audit Report dated 2019 was reviewed.', quotes: [] });
        expect(out.text).toBe('');
        expect(out.flags.join(' ')).toContain('write it yourself');
        AI.callProxyAPI = vi.fn(async () => ({ text: 'oops', usage: {}, model: 'm' }));
        await expect(AI.draftFindingText(INPUT)).rejects.toThrow('The AI reply could not be read.');
    });
});

describe('on the Fix findings screen', () => {
    const box = (clause, key) => {
        const row = Array.from(document.querySelectorAll('.ff-row')).find((r) => r.textContent.includes(clause));
        return row.querySelector('.ff-box[data-key="' + key + '"]');
    };
    const draftButton = (b) => b.parentElement.querySelector('.ff-draft');
    const DRAFT = { status: 'draft', text: 'The MSD Support SOP was reviewed on 17 November 2026. [To write: what showed that no process map exists].', blanks: 1, imagesSent: ['Image 1'], imagesFailed: [], flags: [] };

    it('fills the box with the draft, says what it used, and Undo puts the box back', async () => {
        AI.draftFindingText = vi.fn(async () => DRAFT);
        window.openFixFindings('r1');
        const b = box('4.4', 'comment');
        expect(b.value).toBe('');
        draftButton(b).click();
        await vi.waitFor(() => expect(b.value).toBe(DRAFT.text));
        expect(AI.draftFindingText.mock.calls[0][0]).toMatchObject({ kind: 'evidence', statement: 'Process Map missing', dates: ['17 November 2026'] });
        const note = b.parentElement.querySelector('.ff-note');
        expect(note.textContent).toBe('Drafted from 1 screenshot and your notes. Check it against what you saw. 1 part marked [To write: …] for you.');
        // Nothing is written to the answer by drafting.
        expect(report.checklistProgress[0].comment).toBe('');
        b.parentElement.querySelector('.ff-undo').click();
        expect(b.value).toBe('');
    });

    it('will not save a box that still has a [To write: …] blank, in either box', async () => {
        AI.draftFindingText = vi.fn(async () => DRAFT);
        window.openFixFindings('r1');
        const b = box('4.4', 'comment');
        draftButton(b).click();
        await vi.waitFor(() => expect(b.value).toBe(DRAFT.text));
        window.__save();
        expect(report.checklistProgress[0].comment).toBe('');
        expect(window.saveChecklist).not.toHaveBeenCalled();
        expect(b.parentElement.querySelector('.ff-warning').textContent).toBe('Replace the part in [brackets] before saving.');
        // The auditor writes the missing part: now it saves.
        b.value = 'The MSD Support SOP was reviewed on 17 November 2026. No process map of the three systems was available.';
        window.__save();
        expect(report.checklistProgress[0].comment).toBe('The MSD Support SOP was reviewed on 17 November 2026. No process map of the three systems was available.');
        expect(window.saveChecklist).toHaveBeenCalledTimes(1);
    });

    it('shows why when there is nothing to draft from, and leaves the box alone', async () => {
        AI.callProxyAPI = vi.fn();
        window.openFixFindings('r1');
        const b = box('8.4', 'comment');
        draftButton(b).click();
        await vi.waitFor(() => expect(b.parentElement.querySelector('.ff-note').textContent).toContain('nothing to draft from'));
        expect(b.value).toBe('');
        expect(AI.callProxyAPI).not.toHaveBeenCalled();
    });

    it('drafts a raw conform note into a remark, keeping the original note on save', async () => {
        AI.draftFindingText = vi.fn(async () => ({ status: 'draft', text: 'The competency matrix was reviewed.', blanks: 0, imagesSent: [], imagesFailed: [], flags: [] }));
        window.openFixFindings('r1');
        const b = box('7.2', 'comment');
        draftButton(b).click();
        await vi.waitFor(() => expect(b.value).toBe('The competency matrix was reviewed.'));
        expect(b.parentElement.querySelector('.ff-note').textContent).toBe('Drafted from your notes. Check it against what you saw.');
        window.__save();
        expect(report.checklistProgress[1].comment).toBe('The competency matrix was reviewed.');
        expect(report.checklistProgress[1]._originalComment).toBe('check competency matrix');
    });
});
