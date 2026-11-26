// Technical review of PC Connection's 2026 recertification (item 10): the
// plan recorded three days of document review on the client's SharePoint,
// done before the audit, as a 3-day REDUCTION, so the report showed 1.5
// auditor-days for three standards. Review outside the agenda is audit time:
// it is recorded as such and counts towards the total, while the agenda
// still reconciles to the time it schedules.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildScenario, M } from '../tools/pcc-scenario.mjs';

const { IPI, PD } = M;
const clone = (o) => JSON.parse(JSON.stringify(o));
const codes = (v) => v.blockers.map(b => b.code);
const REVIEW = { days: 3, timing: 'before', date: '2026-11-15', covered: 'Policies, procedures and registers on the Managed Services Hub', evidence: 'Pre-audit document review' };

let approved;
beforeAll(async () => { approved = await buildScenario({ approve: true }); });

function gateWith(mutate) {
    const plan = clone(approved.plan);
    mutate(plan);
    const ctx = Object.assign({}, approved.ctx, { auditors: approved.auditors, client: approved.client });
    const html = PD.build(plan, approved.ctx);
    return { plan, html, validation: IPI.validate(plan, Object.assign({}, ctx, { html, lint: M.PS.lint(html), hoursPerDay: 8, findings: approved.ctx.findings })) };
}

describe('remote document review outside the agenda', () => {
    it('is absent unless days are recorded', () => {
        expect(IPI.offAgendaReviewOf({})).toBeNull();
        expect(IPI.offAgendaReviewOf({ durationCalculation: { offAgendaReview: { days: 0, covered: 'x' } } })).toBeNull();
        expect(IPI.durationSummary({ manDays: 1.5, auditMethod: 'Remote' })).toBe('1.5 auditor-days');
    });

    it('adds to the agenda time and says so', () => {
        const plan = { auditMethod: 'Remote', manDays: 1.5, durationCalculation: { finalDays: 1.5, offAgendaReview: REVIEW } };
        expect(IPI.totalAuditDays(plan)).toBe(4.5);
        expect(IPI.durationSummary(plan)).toBe('4.5 auditor-days: 1.5 in remote audit sessions and 3 in remote document review before the audit');
        const rec = IPI.buildDurationRecord(plan, {});
        expect(rec.finalDays).toBe(1.5);
        expect(rec.totalDays).toBe(4.5);
        expect(rec.offAgendaReview).toMatchObject({ days: 3, timing: 'before', date: '2026-11-15' });
    });

    it('leaves the agenda reconciliation alone and prints in the plan and the internal record', () => {
        const { plan, html, validation } = gateWith((p) => { p.durationCalculation.offAgendaReview = REVIEW; });
        expect(validation.blockers).toEqual([]);
        expect(html).toContain('in remote document review before the audit');
        const internal = PD.buildInternal(plan, Object.assign({}, approved.ctx, { durationRecord: IPI.buildDurationRecord(plan, {}), validation }));
        expect(internal).toContain('Remote document review outside the agenda');
        expect(internal).toContain('Policies, procedures and registers on the Managed Services Hub');
        expect(internal).toMatch(/in the agenda \+ 3 remote document review = \d+(\.\d+)? total auditor-days/);
    });

    it('is blocked when it does not say what was reviewed', () => {
        const { validation } = gateWith((p) => { p.durationCalculation.offAgendaReview = Object.assign({}, REVIEW, { covered: '' }); });
        expect(codes(validation)).toContain('OFF_AGENDA_REVIEW_UNSUPPORTED');
    });

    it('the report duration line and the scoring figure use the total', () => {
        const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
        expect(SRC).toContain('window.AuditPlanIntegrity.durationSummary(d.auditPlan)');
        const SCORING = fs.readFileSync(path.resolve('./report-scoring.js'), 'utf8');
        expect(SCORING).toContain('ipi.totalAuditDays(d.auditPlan)');
    });
});
