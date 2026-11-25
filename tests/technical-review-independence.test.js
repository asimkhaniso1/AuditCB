// The technical review is done by someone outside the audit team, and says who
// recorded it.
//
// ISO/IEC 17021-1 clause 9.5: the review before the certification decision is
// made by a person not involved in the audit. The Record Technical Review form
// took the reviewer as free text and recorded nobody as having entered it, so
// the lead auditor of PC Connection's 2026 recertification could have recorded
// a review of their own report in a colleague's name.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', CLOSED: 'Closed', FINALIZED: 'Finalized' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' }
};
window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [], auditors: [{ id: 'a7', name: 'Umair Tech' }] };
loadScript('./report-stats.js', { params: { module: undefined } });
loadScript('./report-integrity.js', { params: { module: undefined } });
const RI = window.ReportIntegrity;

const PLAN = () => ({ id: 'plan-recert', auditType: 'Recertification', lead: 'Muhammad Asim Khan', team: ['Muhammad Asim Khan'],
    teamAllocations: [{ auditor: 'Sara Second', days: 1 }], auditors: ['a7'] });
const REPORT = (reviewer) => ({ id: 'rep', planId: 'plan-recert', client: 'PC CONNECTION, INC.', date: '2026-11-17', auditType: 'Recertification',
    leadAuditor: 'Muhammad Asim Khan', checklistProgress: [], technicalReview: reviewer ? { reviewer, outcome: 'Approved', date: '2026-11-25' } : undefined });

describe('the audit team and the reviewer', () => {
    it('lists the lead, the team, team allocations and assigned auditors once each', () => {
        expect(RI.auditTeamOf(REPORT(), PLAN())).toEqual(['Muhammad Asim Khan', 'Sara Second', 'Umair Tech']);
    });

    it('recognises a team member whatever the case or punctuation, and nobody else', () => {
        expect(RI.reviewerOnAuditTeam('muhammad  asim khan.', REPORT(), PLAN())).toBe('Muhammad Asim Khan');
        expect(RI.reviewerOnAuditTeam('Umair Tech', REPORT(), PLAN())).toBe('Umair Tech');
        expect(RI.reviewerOnAuditTeam('Hassan Javed', REPORT(), PLAN())).toBe('');
        expect(RI.reviewerOnAuditTeam('', REPORT(), PLAN())).toBe('');
    });

    it('records the signed-in user as the person entering a review', () => {
        window.state.currentUser = { name: 'Admin User', role: 'Admin', id: 'u1' };
        const by = RI.reviewRecordedBy();
        expect([by.name, by.role, by.id]).toEqual(['Admin User', 'Admin', 'u1']);
        expect(Date.parse(by.at)).not.toBeNaN();
    });
});

describe('Report Integrity B34', () => {
    const b34 = (reviewer) => RI.check({ report: REPORT(reviewer), auditPlan: PLAN(), client: { name: 'PC CONNECTION, INC.' } })
        .blockers.filter((b) => b.id === 'B34');

    it('blocks a review recorded in the lead auditor\'s name', () => {
        const b = b34('Muhammad Asim Khan');
        expect(b).toHaveLength(1);
        expect(b[0].message).toMatch(/recorded in the name of Muhammad Asim Khan, a member of the audit team/);
    });

    it('passes an independent reviewer, and a report with no review yet', () => {
        expect(b34('Hassan Javed')).toEqual([]);
        expect(b34(null)).toEqual([]);
    });
});

describe('Record Technical Review form', () => {
    let onSave;
    beforeEach(() => {
        window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
        window.UTILS = { escapeHtml: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
        window.Sanitizer = { sanitizeText: (s) => String(s == null ? '' : s) };
        window.closeModal = () => { };
        window.showNotification = () => { };
        window.saveChecklist = () => { };
        window.runReportIntegrityCheck = () => { };
        for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = () => { };
        window.DataService = { openFormModal: (title, body, save) => { document.body.innerHTML = body; onSave = save; } };
        window.state.currentUser = { name: 'Admin User', role: 'Admin', id: 'u1' };
        window.state.auditPlans = [PLAN()];
        window.state.auditReports = [REPORT()];
        globalThis.state = window.state;
        // recordTechnicalReview is defined inside renderExecutionTab, so render a tab first.
        loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
        document.body.innerHTML = '<div id="tab-content"></div>';
        window.__renderExecutionTab(window.state.auditReports[0], 'ncr', { assignedChecklists: [] });
        // Rendering defines the real save; the form's save is what is tested here.
        window.saveChecklist = () => { };
        window.saveData = () => { };
    });
    const fill = (reviewer) => {
        document.getElementById('tr-reviewer-input').value = reviewer;
        document.getElementById('tr-outcome-input').value = 'Approved';
        onSave();
    };

    it('refuses a reviewer from the audit team and saves nothing', () => {
        window.recordTechnicalReview('rep');
        expect(document.body.textContent).toMatch(/audit team: Muhammad Asim Khan, Sara Second, Umair Tech/);
        fill('Muhammad Asim Khan');
        expect(document.getElementById('tr-warning').textContent).toMatch(/Muhammad Asim Khan was on the audit team/);
        expect(window.state.auditReports[0].technicalReview).toBeUndefined();
    });

    it('saves an independent review with who recorded it', () => {
        window.recordTechnicalReview('rep');
        fill('Hassan Javed');
        const tr = window.state.auditReports[0].technicalReview;
        expect([tr.reviewer, tr.outcome, tr.recordedBy.name, tr.recordedBy.role]).toEqual(['Hassan Javed', 'Approved', 'Admin User', 'Admin']);
    });

    it('shows who recorded the current review when it is reopened', () => {
        window.state.auditReports[0].technicalReview = { reviewer: 'Hassan Javed', outcome: 'Approved', date: '2026-11-25',
            recordedBy: { name: 'Admin User', role: 'Admin', at: '2026-11-25T10:00:00Z' } };
        window.recordTechnicalReview('rep');
        expect(document.body.textContent).toMatch(/Last recorded by Admin User \(Admin\) on 2026-11-25/);
    });
});
