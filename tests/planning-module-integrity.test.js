import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildScenario, M } from '../tools/pcc-scenario.mjs';

const { DF, IPI } = M;
const SRC = fs.readFileSync(path.resolve('./planning-module.js'), 'utf8');

let s; let approved;
beforeAll(async () => {
    s = await buildScenario();
    approved = await buildScenario({ approve: true });
    globalThis.window = globalThis.window || globalThis;
    window.showNotification = () => { };
    window.Sanitizer = { sanitizeText: (v) => v };
    window.Validator = {};
    (0, eval)(SRC);
});

function mountForm(team) {
    document.body.innerHTML = `
        <select id="plan-lead-auditor">${team.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
        <select id="plan-team" multiple>${team.slice(1).map(t => `<option value="${t}" selected>${t}</option>`).join('')}</select>
        <table><tbody id="agenda-tbody"></tbody></table>`;
    document.getElementById('plan-lead-auditor').value = team[0];
}
const lastRow = () => document.querySelector('#agenda-tbody tr:last-child');
const selectOf = (row) => row.querySelector('select');
const inputs = (row) => Array.from(row.querySelectorAll('input')).map(i => i.value);

describe('agenda row editor — no "Other", no auditor guessed, no text re-escaped', () => {
    beforeEach(() => { window.UTILS = M.UTILS; });

    it('offers only the auditors on the plan, and never an "Other" option', () => {
        mountForm(['Muhammad Asim Khan']);
        window.addAgendaRow({ day: 'Day 1', time: '09:00 – 10:00', item: 'x', dept: 'y', auditor: 'Muhammad Asim Khan' });
        const values = Array.from(selectOf(lastRow()).options).map(o => o.value);
        expect(values).toEqual(['Muhammad Asim Khan']);
        expect(values).not.toContain('Other');
        expect(lastRow().innerHTML).not.toMatch(/value="Other"/);
    });

    it('resolves "All Team", "All", "Other" and blank to the Lead Auditor on a team of one', () => {
        mountForm(['Muhammad Asim Khan']);
        ['All Team', 'All', 'Other', '', undefined].forEach(a => {
            window.addAgendaRow({ item: 'session', dept: 'IT', auditor: a });
            expect(selectOf(lastRow()).value, String(a)).toBe('Muhammad Asim Khan');
        });
    });

    it('leaves the auditor BLANK on a multi-person team rather than choosing "Other"', () => {
        mountForm(['Muhammad Asim Khan', 'Second Auditor']);
        window.addAgendaRow({ item: 'session', dept: 'IT', auditor: 'Other' });
        expect(selectOf(lastRow()).value).toBe('');
        expect(selectOf(lastRow()).options[0].textContent).toMatch(/select auditor/);
    });

    it('offers "All Team" only when there is a team', () => {
        mountForm(['A', 'B']);
        window.addAgendaRow({ item: 'joint', dept: 'IT', auditor: 'All Team' });
        expect(Array.from(selectOf(lastRow()).options).map(o => o.value)).toEqual(['All Team', 'A', 'B']);
        expect(selectOf(lastRow()).value).toBe('All Team');
    });

    it('a lunch row is N/A', () => {
        mountForm(['Muhammad Asim Khan']);
        window.addAgendaRow({ item: 'Lunch break', dept: 'All', auditor: 'All', kind: 'lunch' });
        expect(selectOf(lastRow()).value).toBe('N/A');
    });

    it('shows stored text with its entity layers removed, and does not grow one on each edit->save cycle', () => {
        mountForm(['Muhammad Asim Khan']);
        let stored = 'Patch &amp;amp; Vulnerability Management';
        window.addAgendaRow({ item: 'x', dept: stored, auditor: 'Muhammad Asim Khan' });
        expect(inputs(lastRow())[3]).toBe('Patch & Vulnerability Management');
        // simulate three save->edit cycles
        for (let i = 0; i < 3; i++) {
            stored = DF.toPlainText(inputs(lastRow())[3]);          // what saveAuditPlan stores
            window.addAgendaRow({ item: 'x', dept: stored, auditor: 'Muhammad Asim Khan' });
        }
        expect(stored).toBe('Patch & Vulnerability Management');
        expect(inputs(lastRow())[3]).toBe('Patch & Vulnerability Management');
    });

    it('keeps the traceability record on the row, so editing its text cannot lose the standard, clauses or findings', () => {
        mountForm(['Muhammad Asim Khan']);
        window.addAgendaRow({ item: 'Incident', dept: 'Ops', auditor: 'Muhammad Asim Khan', kind: 'session', sessionId: 'S07', standards: [{ stdId: 'iso27001', refs: ['A.5.24'] }], findingIds: ['NCR-1'], date: '2026-11-04', start: '09:30', end: '10:45' });
        const meta = JSON.parse(lastRow().dataset.meta);
        expect(meta).toMatchObject({ sessionId: 'S07', findingIds: ['NCR-1'], date: '2026-11-04', start: '09:30', end: '10:45' });
        expect(meta.standards[0].refs).toEqual(['A.5.24']);
    });

    it('selects the sole auditor on a one-person team even when the stored name does not match exactly (whitespace/case drift between two independent lookups)', () => {
        mountForm(['Muhammad Asim Khan']);
        ['muhammad asim khan', 'Muhammad  Asim Khan', 'Muhammad Asim Khan ', 'MUHAMMAD ASIM KHAN'].forEach(a => {
            window.addAgendaRow({ item: 'session', dept: 'IT', auditor: a });
            expect(selectOf(lastRow()).value, a).toBe('Muhammad Asim Khan');
            expect(selectOf(lastRow()).options[0].textContent, a).not.toMatch(/select auditor/);
        });
    });

    it('matches by auditor ID first, so a stale/renamed auditor name on the row still resolves', () => {
        document.body.innerHTML = `
            <select id="plan-lead-auditor"><option value="Muhammad Asim Khan" data-id="aud-1">Muhammad Asim Khan</option></select>
            <select id="plan-team" multiple><option value="Second Auditor" data-id="aud-2" selected>Second Auditor</option></select>
            <table><tbody id="agenda-tbody"></tbody></table>`;
        document.getElementById('plan-lead-auditor').value = 'Muhammad Asim Khan';
        // The row's saved NAME belongs to nobody on this plan any more, but its
        // auditorId still points at "Second Auditor" — id wins over name.
        window.addAgendaRow({ item: 'session', dept: 'IT', auditor: 'Some Other Name', auditorId: 'aud-2' });
        expect(selectOf(lastRow()).value).toBe('Second Auditor');
    });
});

describe('reopening a saved plan for editing', () => {
    beforeEach(() => {
        window.UTILS = M.UTILS;
        document.body.innerHTML = '';
        window.contentArea = document.createElement('div');
        document.body.appendChild(window.contentArea);
        window.state = s.state;
        window.state.activeClientId = null;
        window.editingPlanId = null;
    });
    afterEach(() => { vi.useRealTimers(); });

    it('restores the agenda AFTER the Lead Auditor/Team selects, not before — the plan is a single Lead Auditor and every saved row must show them, never "select auditor"', () => {
        vi.useFakeTimers();
        window.editAuditPlan(s.plan.id);
        vi.advanceTimersByTime(1000);
        vi.useRealTimers();

        expect(document.getElementById('plan-lead-auditor').value).toBe('Muhammad Asim Khan');
        const rows = Array.from(document.querySelectorAll('#agenda-tbody tr'));
        expect(rows.length).toBeGreaterThan(0);
        rows.forEach(row => {
            const sel = row.querySelector('select');
            const meta = JSON.parse(row.dataset.meta || '{}');
            if (meta.kind === 'lunch') { expect(sel.value).toBe('N/A'); return; }
            expect(sel.value, row.innerHTML).toBe('Muhammad Asim Khan');
            expect(sel.options[0].textContent).not.toMatch(/select auditor/);
        });
    });

    it('keeps a checklist linked through Configure attached after re-saving the plan through this form — the form has no field for it, so the save must carry it forward itself', () => {
        expect(s.plan.selectedChecklists).toEqual([s.checklist.id]); // sanity: really linked going in

        vi.useFakeTimers();
        window.editAuditPlan(s.plan.id);
        vi.advanceTimersByTime(1000);
        vi.useRealTimers();

        window.Validator = { validateFormElements: () => ({ valid: true, errors: {} }), displayErrors: () => { }, clearErrors: () => { } };
        window.saveData = () => { };
        window.viewAuditPlan = () => { };
        window.SupabaseClient = null;
        window.alert = () => { };

        window.saveAuditPlan(false, true); // Save Draft — no field on this form sets selectedChecklists

        const saved = state.auditPlans.find(p => String(p.id) === String(s.plan.id));
        expect(saved.selectedChecklists).toEqual([s.checklist.id]);
        expect(saved.validationSnapshot.warnings.join(' ')).not.toMatch(/No audit checklist is linked to the plan/);
    });
});

describe('printing the plan through the application', () => {
    let opened;
    function stubOpen() {
        opened = { html: '', printed: 0 };
        const doc = document.implementation.createHTMLDocument('');
        window.open = () => ({
            document: { write: (h) => { opened.html = h; doc.open(); doc.write(h); doc.close(); }, close: () => { }, querySelector: (q) => doc.querySelector(q) },
            addEventListener: () => { }, focus: () => { }, print: () => { opened.printed++; }
        });
    }
    function setup(scn, role) {
        window.state = scn.state;
        window.state.currentUser = { name: 'Tester', role };
        window.UTILS = M.UTILS;
        window.runChecklistCoverage = () => scn.coverage;
        window.saveData = () => { };
        window.viewAuditPlan = () => { };
        window.alert = () => { };
        window.SupabaseClient = null;
        stubOpen();
    }

    it('prints the corrected plan: written dates, time zone, Lead Auditor only, no Other', () => {
        setup(s, 'Certification Manager');
        window.printAuditPlanDetails(s.plan.id);
        const t = DF.renderedText(opened.html);
        expect(t).toContain('3–5 November 2026');
        expect(t).toContain('Eastern Standard Time (EST, UTC−05:00)');
        expect(t).toMatch(/Audit team\s*Lead Auditor only/);
        expect(t).not.toMatch(/\bOther\b/);
        expect(DF.findUnwrittenDates(t)).toEqual([]);
        expect(M.PS.lint(opened.html)).toEqual([]);
    });

    it('prints as Draft while a blocker stands, however the stored status reads', () => {
        setup(s, 'Certification Manager');
        s.plan.documentStatus = IPI.STATUSES[2]; // even if someone stored "Issued"
        window.printAuditPlanDetails(s.plan.id);
        expect(opened.html).toContain('Draft — Internal Review');
        expect(opened.html).toContain('This plan has not been approved for client issue.');
        s.plan.documentStatus = IPI.STATUSES[0];
    });

    it('wires the Print button so it prints (the popup cannot run a script under the site CSP)', () => {
        setup(s, 'Certification Manager');
        window.printAuditPlanDetails(s.plan.id);
        const doc = document.implementation.createHTMLDocument('');
        doc.write(opened.html);
        expect(doc.querySelector('[data-action="print"]')).toBeTruthy();
        expect(opened.html).not.toMatch(/<script/i);
    });

    it('opens the internal record with the readiness result and the traceability matrix', () => {
        setup(s, 'Certification Manager');
        window.printAuditPlanInternalRecord(s.plan.id);
        const t = DF.renderedText(opened.html);
        expect(opened.html).toContain('INTERNAL — NOT FOR CLIENT ISSUE'); // running header (page margin box)
        expect(t).toContain('1 blocking issue(s) — not ready for client issue');
        expect(t).toContain('Total findings requiring follow-up: 8 · mapped: 8 · unmapped: 0');
        expect(t).toContain('Session');
    });

    it('the plan view exposes the document status, blockers and the approve button', () => {
        setup(s, 'Certification Manager');
        const card = window.planStatusCardHTML(s.plan);
        expect(card).toContain('Document status: Draft — Internal Review');
        expect(card).toContain('1 blocking issue(s)');
        expect(card).toContain('The audit duration has not been approved');
        expect(card).toContain('data-action="approvePlanForClientIssue"');
    });
});

describe('approval and issue through the application', () => {
    let alerts; let notes;
    function setup(scn, role) {
        window.state = scn.state;
        window.state.currentUser = { name: 'Tester', role };
        window.UTILS = M.UTILS;
        window.runChecklistCoverage = () => scn.coverage;
        window.saveData = () => { };
        window.viewAuditPlan = () => { };
        window.SupabaseClient = null;
        alerts = []; notes = [];
        window.alert = (m) => alerts.push(m);
        window.showNotification = (m, t) => notes.push([m, t]);
    }

    it('refuses approval while the gate fails, and lists the blockers', async () => {
        setup(s, 'Certification Manager');
        s.plan.documentStatus = IPI.STATUSES[0];
        await window.approvePlanForClientIssue(s.plan.id);
        expect(s.plan.documentStatus).toBe(IPI.STATUSES[0]);
        expect(notes.at(-1)[0]).toMatch(/1 blocking issue\(s\) must be resolved first/);
        expect(alerts.join('\n')).toContain('The audit duration has not been approved');
    });

    it('refuses an unauthorised role even with a clean gate', async () => {
        setup(approved, 'Auditor');
        approved.plan.documentStatus = IPI.STATUSES[0];
        await window.approvePlanForClientIssue(approved.plan.id);
        expect(approved.plan.documentStatus).toBe(IPI.STATUSES[0]);
        expect(notes.at(-1)[0]).toMatch(/Only Admin, Certification Manager, Cert Manager may approve/);
    });

    it('approves, records who and when and a content hash, then issues', async () => {
        setup(approved, 'Certification Manager');
        approved.plan.documentStatus = IPI.STATUSES[0]; approved.plan.statusHistory = []; approved.plan.approval = null;
        await window.approvePlanForClientIssue(approved.plan.id);
        expect(approved.plan.documentStatus).toBe('Approved for Client Issue');
        expect(approved.plan.approval).toMatchObject({ by: 'Tester', role: 'Certification Manager' });
        expect(approved.plan.approval.contentHash).toBe(IPI.contentHash(approved.plan));
        await window.issuePlanToClient(approved.plan.id);
        expect(approved.plan.documentStatus).toBe('Issued to Client');
        expect(approved.plan.statusHistory.map(h => h.status)).toEqual(['Approved for Client Issue', 'Issued to Client']);
    });

    it('a plan edited after approval prints as a draft again and cannot be issued', async () => {
        setup(approved, 'Certification Manager');
        approved.plan.documentStatus = IPI.STATUSES[1];
        approved.plan.approval = { by: 'Tester', at: 'x', contentHash: IPI.contentHash(approved.plan) };
        approved.plan.agenda[2].item += ' (edited after approval)';
        const opened = { html: '' };
        window.open = () => ({ document: { write: (h) => { opened.html = h; }, close: () => { }, querySelector: () => null }, addEventListener: () => { }, focus: () => { }, print: () => { } });
        window.printAuditPlanDetails(approved.plan.id);
        expect(opened.html).toContain('Draft — Internal Review');
        await window.issuePlanToClient(approved.plan.id);
        expect(approved.plan.documentStatus).toBe(IPI.STATUSES[1]);
        expect(notes.at(-1)[0]).toMatch(/changed after approval/);
    });

    it('derivePlanRecords writes the certificate’s scope verbatim and the full duration record onto a plan', () => {
        setup(s, 'Certification Manager');
        const planData = JSON.parse(JSON.stringify(s.plan));
        planData.scope = 'something reworded'; planData.durationRecord = null; planData.assignedAuditors = null;
        window.derivePlanRecords(planData);
        expect(planData.scope).toBe(s.asm.scope.certificateScope);
        expect(planData.durationRecord.basisByStandard).toHaveLength(3);
        expect(planData.assignedAuditors).toEqual([{ id: 'aud-mak', name: 'Muhammad Asim Khan', role: 'Lead Auditor' }]);
    });
});

describe('source hygiene — the defects, by name', () => {
    it('the agenda editor has no "Other" option and never selects one', () => {
        expect(SRC).not.toMatch(/<option value="Other"/);
        expect(SRC).not.toMatch(/data\.auditor !== 'All'/);
    });
    it('the audit team is never printed as "None"', () => {
        expect(SRC).not.toMatch(/join\(', '\) \|\| 'None'/);
    });
    it('the plan is not printed with a fixed "Page 1 of 1" or an inline print script', () => {
        expect(SRC).not.toMatch(/Page 1 of 1/);
        expect(SRC).not.toMatch(/window\.onload = function\(\) \{ window\.print\(\); \}/);
    });
    it('agenda text is stored as plain text, not entity-escaped', () => {
        expect(SRC).not.toMatch(/Sanitizer\.sanitizeText\(inputs\[/);
        expect(SRC).not.toMatch(/objectives: Sanitizer\.sanitizeText/);
    });
    it('the agenda is built from the registry, not free-written by a language model', () => {
        const body = SRC.slice(SRC.indexOf('async function generateAIAgenda()'), SRC.indexOf('/** A plan-shaped object from the form'));
        expect(body).toContain('AuditPlanIntegrity.assemble');
        expect(body).not.toContain('AI_SERVICE.generateAuditAgenda');
    });
    it('previous findings come from the register, not only from status-nc report items capped at 20', () => {
        const body = SRC.slice(SRC.indexOf('function getPreviousPlanFindings'), SRC.indexOf('function generatePlanNarratives'));
        expect(body).toContain('collectPreviousFindings');
        expect(body).not.toContain('.slice(0, 20)');
    });
});
