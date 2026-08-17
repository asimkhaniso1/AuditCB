// KTD Select surveillance-audit acceptance suite.
// Recreates the defects found in the original KTD report (invented financial
// claims, fabricated Stage 1/2 dates, FOCUS.x criteria, false "recurring",
// "General" departments, wrong recommendation wording, address drift) and
// asserts the corrected pipeline rejects or fixes each one.
import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
window.CONSTANTS = { STATUS: { FINALIZED: 'Finalized' } };

const fs = await import('fs');
const path = await import('path');
function loadModule(file) {
    const src = fs.readFileSync(path.resolve(file), 'utf8');
    eval(src);
}
loadModule('./report-stats.js');
loadModule('./data-service.js');
loadModule('./report-integrity.js');

const KTD_CLIENT = () => ({
    id: 'ktd-1',
    name: 'KTD Select',
    sites: [{ address: '306 Camars Drive', city: 'Warminster', state: 'PA', zip: '18974' }],
    certificates: [{ standard: 'ISO 9001:2015', issueDate: '2024-08-20', expiryDate: '2027-08-19' }]
});

const KTD_PLAN = () => ({
    id: 'plan-ktd', clientId: 'ktd-1', auditType: 'Surveillance', type: 'Surveillance',
    standard: 'ISO 9001:2015', startDate: '2026-08-10', scope: 'Design and supply of selection systems',
    criteria: 'ISO 9001:2015', leadAuditor: 'A. Auditor'
});

function ncItem(overrides) {
    return Object.assign({
        status: 'nc', ncrType: 'minor', clause: '9.2',
        evidence: 'Internal audit programme IA-2026 reviewed; two scheduled audits not performed.',
        department: 'Quality', comment: 'Internal audit programme was not fully implemented.'
    }, overrides);
}

describe('KTD surveillance acceptance', () => {
    beforeEach(() => {
        window.state = { auditReports: [], ncrs: [], clients: [KTD_CLIENT()], auditPlans: [KTD_PLAN()] };
    });

    // 25.1 — surveillance recommendation wording
    it('surveillance recommendation never grants certification', () => {
        const text = window.ReportStats.recommendationText('Surveillance', { majorNC: 0, minorNC: 4 });
        expect(text).toBe('Continued certification is recommended subject to satisfactory closure of applicable nonconformities.');
        expect(text.toLowerCase()).not.toContain('recommended for certification');
        expect(window.ReportStats.recommendationText('Recertification', { majorNC: 0, minorNC: 1 }))
            .toMatch(/^Recertification is recommended/);
        expect(window.ReportStats.recommendationText('Stage 2', { majorNC: 0, minorNC: 1 }))
            .toMatch(/^Recommended for certification/);
    });

    // 25.2 — programme chronology anchored on the certificate, not the audit date
    it('programme anchors on the certificate and slots the current audit correctly', () => {
        const p = window.ReportStats.buildProgramme({
            client: KTD_CLIENT(), auditPlan: KTD_PLAN(),
            report: { id: 'rep-ktd', planId: 'plan-ktd', clientId: 'ktd-1', date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015' },
            allReports: []
        });
        expect(p.anchored).toBe('certificate');
        expect(p.issues).toEqual([]);
        const byId = Object.fromEntries(p.stages.map((s) => [s.id, s]));
        expect(byId.s1.timing).toBe('Aug 2024');            // NOT fabricated at Aug 2026
        expect(byId.s2.timing).toBe('Aug 2024');
        expect(byId.sv1.timing).toBe('Aug 2025');
        expect(byId.sv2.status).toBe('This audit');          // 2 years post-cert = SV2
        expect(p.stages.filter((s) => s.status === 'This audit')).toHaveLength(1);
        // nextAudit exposes a machine-readable ISO date alongside label/timing.
        expect(p.nextAudit).toBeTruthy();
        expect(p.nextAudit.id).toBe('recert');
        expect(p.nextAudit.date).toBe(new Date('2027-08-19').toISOString());
    });

    // Stabilization pass — prior-SV-history slotting (defect a): once real
    // history already records a Surveillance 1 for this client+standard, a
    // current generic-"Surveillance" audit must slot as SV2 EVEN WHEN its own
    // date sits closer to the SV1 due date than the SV2 due date — history
    // outranks naive date-proximity.
    it('a prior recorded surveillance in history forces the current generic-Surveillance audit to SV2, overriding date proximity', () => {
        const client = {
            id: 'ktd-1', name: 'KTD Select',
            certificates: [{ standard: 'ISO 9001:2015', issueDate: '2024-01-01', expiryDate: '2027-01-01' }]
        };
        const allReports = [{
            id: 'rep-prev', clientId: 'ktd-1', standard: 'ISO 9001:2015',
            date: '2025-01-10', auditType: 'Surveillance', reportStatus: 'final',
            checklistProgress: [], ncrs: []
        }];
        // 2025-02-15 is only ~5 weeks after the SV1 due date (2025-01-01) and
        // ~10.5 months before the SV2 due date (2026-01-01) — naive date
        // proximity alone would misclassify this as SV1 again.
        const report = { id: 'rep-ktd', planId: 'plan-ktd', clientId: 'ktd-1', date: '2025-02-15', auditType: 'Surveillance', standard: 'ISO 9001:2015' };
        const auditPlan = { id: 'plan-ktd', clientId: 'ktd-1', auditType: 'Surveillance', standard: 'ISO 9001:2015', startDate: '2025-02-15' };

        const p = window.ReportStats.buildProgramme({ client, auditPlan, report, allReports });
        const byId = Object.fromEntries(p.stages.map((s) => [s.id, s]));

        expect(byId.sv1.status).toBe('Completed');   // matched to the real history record
        expect(byId.sv2.status).toBe('This audit');  // forced past SV1 by history, not proximity
        expect(p.stages.filter((s) => s.status === 'This audit')).toHaveLength(1);
    });

    it('programme never fabricates prior-stage dates without an anchor', () => {
        const p = window.ReportStats.buildProgramme({
            client: { id: 'x', name: 'NoCert Co' },
            auditPlan: KTD_PLAN(),
            report: { id: 'rep-2', clientId: 'x', date: '2026-08-12', auditType: 'Surveillance' },
            allReports: []
        });
        expect(p.anchored).toBe('audit-date-fallback');
        const byId = Object.fromEntries(p.stages.map((s) => [s.id, s]));
        expect(byId.s1.timing).toBe('—');
        expect(byId.s2.timing).toBe('—');
        expect(p.issues.length).toBeGreaterThan(0);
    });

    // 25.3/25.4/25.5/25.6/25.8 — the "old" defective KTD report must be BLOCKED
    it('the original defective KTD report is blocked with the expected rule hits', () => {
        const report = {
            id: 'rep-ktd', planId: 'plan-ktd', clientId: 'ktd-1', client: 'KTD Select',
            date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
            executiveSummary: 'Certification protects an estimated $5M annual revenue tied to certified status. This recurring weakness may result in contractual penalties.',
            conclusion: 'The organization is Recommended for Certification.',
            checklistProgress: [
                ncItem({ clause: 'FOCUS.2', criterionRef: '', department: 'General', evidence: '' }),
                ncItem({ clause: 'FOCUS.8', criterionRef: '' })
            ],
            ncrs: []
        };
        const result = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() });
        expect(result.status).toBe('BLOCKED');
        const ids = result.blockers.map((b) => b.id.split('-')[0]).concat(result.warnings.map((w) => w.id.split('-')[0]));
        expect(ids).toContain('B1'); // FOCUS.x as final criterion
        expect(ids).toContain('B5'); // granting language on a surveillance audit
        expect(ids).toContain('B6'); // unsupported $5M financial claim
        expect(ids).toContain('B7'); // "recurring" with no audit history
        expect(ids).toContain('B3'); // NC without objective evidence
        expect(ids).toContain('W3'); // department "General"
    });

    // 25 happy path — the corrected KTD report passes with zero blockers
    it('the corrected KTD report is READY FOR AUDITOR REVIEW', () => {
        window.state.auditReports.push({
            id: 'rep-prev', clientId: 'ktd-1', standard: 'ISO 9001:2015',
            date: '2025-08-15', auditType: 'Surveillance', reportStatus: 'final',
            checklistProgress: [], ncrs: []
        });
        const report = {
            id: 'rep-ktd', planId: 'plan-ktd', clientId: 'ktd-1', client: 'KTD Select',
            date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
            executiveSummary: 'Four minor nonconformities and four observations were identified. The management system continues to meet the requirements of ISO 9001:2015.',
            conclusion: 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.',
            checklistProgress: [
                ncItem(),
                ncItem({ clause: 'FOCUS.2', criterionRef: '9.2', criterionSource: 'focus-carryover' }),
                ncItem({ clause: '7.1', department: 'Maintenance', evidence: 'Calibration record CAL-114 overdue since May 2026.' })
            ],
            ncrs: []
        };
        const result = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() });
        expect(result.blockers).toEqual([]);
        expect(result.status).toBe('READY FOR AUDITOR REVIEW');
    });

    // 25.13 — address comes from authoritative master data, with drift warning
    it('address drift between plan and master site record is detected', () => {
        const issues = window.DataService.checkAddressConsistency({
            client: KTD_CLIENT(),
            auditPlan: { location: '306 Camars Dr, Warwick, PA' },
            report: {}, certificate: null
        });
        expect(issues.length).toBeGreaterThan(0);
        const clean = window.DataService.checkAddressConsistency({
            client: KTD_CLIENT(),
            auditPlan: { location: '306 Camars Dr, Warminster, PA' },
            report: {}, certificate: null
        });
        expect(clean).toEqual([]); // "Dr" vs "Drive" normalized, same city
    });

    // Cycle state drives the dashboard widget's stage ticks. A stage is
    // complete because its audit was FINALIZED — publishing the report is what
    // advances the cycle, not the calendar rolling past a due date.
    describe('ReportStats.cycleState', () => {
        const ANNUAL_CERT_CLIENT = () => ({
            id: 'ktd-1', name: 'KTD Select',
            certificates: [{ standard: 'ISO 9001:2015', initialDate: '2024-08-21', currentIssue: '2025-08-21', expiryDate: '2026-08-20' }]
        });
        const sv2Report = (status) => ({
            id: 'rep-sv2', clientId: 'ktd-1', standard: 'ISO 9001:2015',
            date: '2026-08-14', auditType: 'Surveillance', reportStatus: status
        });
        const args = (reports) => ({
            client: ANNUAL_CERT_CLIENT(), standard: 'ISO 9001:2015',
            allReports: reports, allPlans: [], today: '2026-08-17'
        });

        it('an unpublished surveillance report leaves S2 un-ticked', () => {
            const cs = window.ReportStats.cycleState(args([sv2Report('draft')]));
            expect(cs.completed.s2).toBe(false);
            expect(cs.hasHistory).toBe(false);
        });

        it('publishing the surveillance report ticks S1 and S2 and moves the stage on', () => {
            const cs = window.ReportStats.cycleState(args([sv2Report('final')]));
            // Dated a year after SV1 was due, so it slots as the SECOND
            // surveillance — matching how buildProgramme slots the same record.
            expect(cs.surveillancesDone).toBe(2);
            expect(cs.completed.s1).toBe(true);
            expect(cs.completed.s2).toBe(true);
            expect(cs.completed.recert).toBe(false);
            expect(cs.stage).toBe('Surveillance 2 completed');
            // Annual cert expiry (Aug 2026) is NOT the cycle end — recert is
            // driven by the true 3-year cycle end (Aug 2027).
            expect(cs.cycleEnd.getFullYear()).toBe(2027);
            expect(cs.nextAudit.date.getFullYear()).toBe(2027);
        });

        it('a finalized recertification audit ticks the recert milestone', () => {
            const recert = { id: 'rep-re', clientId: 'ktd-1', standard: 'ISO 9001:2015', date: '2027-06-10', auditType: 'Recertification', reportStatus: 'final' };
            const base = { client: ANNUAL_CERT_CLIENT(), standard: 'ISO 9001:2015', allReports: [sv2Report('final'), recert], allPlans: [] };

            // Not yet performed on 2026-08-17 — a future-dated record must not
            // tick a milestone that hasn't happened.
            const before = window.ReportStats.cycleState(Object.assign({}, base, { today: '2026-08-17' }));
            expect(before.completed.recert).toBe(false);

            const after = window.ReportStats.cycleState(Object.assign({}, base, { today: '2027-06-20' }));
            expect(after.completed.recert).toBe(true);
            expect(after.stage).toBe('Recertification completed');
        });

        it('a scheduled plan outranks the computed due date for the next audit', () => {
            const cs = window.ReportStats.cycleState({
                client: ANNUAL_CERT_CLIENT(), standard: 'ISO 9001:2015',
                allReports: [sv2Report('final')],
                allPlans: [{ id: 'p1', clientId: 'ktd-1', standard: 'ISO 9001:2015', startDate: '2027-05-03', auditType: 'Recertification', status: 'Scheduled' }],
                today: '2026-08-17'
            });
            expect(cs.nextAudit.source).toBe('scheduled');
            expect(cs.nextAudit.date.toISOString().slice(0, 10)).toBe('2027-05-03');
        });

        it('another client\'s finalized audit never advances this client\'s cycle', () => {
            const cs = window.ReportStats.cycleState(args([
                { id: 'other', clientId: 'pc-conn', standard: 'ISO 9001:2015', date: '2026-08-14', auditType: 'Surveillance', reportStatus: 'final' }
            ]));
            expect(cs.completed.s1).toBe(false);
            expect(cs.hasHistory).toBe(false);
        });

        it('returns null when the client has no usable certificate', () => {
            expect(window.ReportStats.cycleState({ client: { id: 'x', name: 'No Cert' }, standard: 'ISO 9001:2015', allReports: [] })).toBe(null);
        });
    });

    // Item 10 — certificate's own recorded site (sitesCovered[] snapshot from
    // client.sites at issuance) is compared too, not just the audit plan/report.
    it('certificate sitesCovered address is checked against the master site record', () => {
        const issues = window.DataService.checkAddressConsistency({
            client: KTD_CLIENT(),
            auditPlan: {}, report: {},
            certificate: { standard: 'ISO 9001:2015', sitesCovered: [{ address: '99 Wrong Street', city: 'Nowhereville' }] }
        });
        expect(issues.some((i) => i.field === 'certificate.sitesCovered')).toBe(true);

        const clean = window.DataService.checkAddressConsistency({
            client: KTD_CLIENT(),
            auditPlan: {}, report: {},
            certificate: { standard: 'ISO 9001:2015', sitesCovered: [{ address: '306 Camars Drive', city: 'Warminster' }] }
        });
        expect(clean).toEqual([]);
    });

    // Item 10 — a full city-level mismatch on the audit plan is elevated to a
    // distinct warning (code city_mismatch) carrying all three values, not just
    // folded into the generic per-field W5 warning.
    it('a city-level plan/master mismatch is a distinct issue carrying site master, plan and report values', () => {
        const issues = window.DataService.checkAddressConsistency({
            client: KTD_CLIENT(),
            auditPlan: { location: '10 Different Road, Warwick, PA' },
            report: { location: '10 Different Road, Warwick, PA' },
            certificate: null
        });
        const cityIssue = issues.find((i) => i.code === 'city_mismatch');
        expect(cityIssue).toBeTruthy();
        expect(cityIssue.siteMaster).toContain('Warminster');
        expect(cityIssue.plan).toBe('10 Different Road, Warwick, PA');
        expect(cityIssue.report).toBe('10 Different Road, Warwick, PA');
        // Not also duplicated as a generic (uncoded) issue for the same field.
        expect(issues.filter((i) => i.field === 'auditPlan.location')).toHaveLength(1);

        const result = window.ReportIntegrity.check({
            report: { id: 'r1', clientId: 'ktd-1', client: 'KTD Select', location: '10 Different Road, Warwick, PA' },
            auditPlan: Object.assign({}, KTD_PLAN(), { location: '10 Different Road, Warwick, PA' }),
            client: KTD_CLIENT()
        });
        expect(result.warnings.some((w) => w.id.startsWith('W5c-'))).toBe(true);
    });

    // 25.7 — "General" is not a department label anywhere in the shared normalizer
    it('department normalization never yields "General"', () => {
        expect(window.ReportStats.normalizeDeptName('General')).toBe('Unassigned / Cross-functional');
        expect(window.ReportStats.normalizeDeptName('')).toBe('Unassigned / Cross-functional');
        expect(window.ReportStats.normalizeDeptName('Production')).toBe('Production');
    });

    // Stabilization pass — impossible certification-programme chronology (defect a):
    // a certificate whose 364-day expiry lands on/before the current audit date
    // must be flagged, its stage relabeled, nextAudit skip it, and the validator block.
    it('a certificate expiring on/before the current audit date is flagged, not silently printed', () => {
        // Genuine 3-year cert (expiry >= anchor+30mo) so the annual-issue cycleEnd
        // rule doesn't mask this as a routine annual re-issue date — this cert is
        // truly overdue for recertification.
        const client = {
            id: 'ktd-1', name: 'KTD Select',
            certificates: [{ standard: 'ISO 9001:2015', issueDate: '2023-08-15', expiryDate: '2026-08-14' }]
        };
        const auditPlan = { id: 'plan-ktd', clientId: 'ktd-1', auditType: 'Surveillance', standard: 'ISO 9001:2015', startDate: '2026-08-17' };
        const report = { id: 'rep-ktd', planId: 'plan-ktd', clientId: 'ktd-1', date: '2026-08-17', auditType: 'Surveillance', standard: 'ISO 9001:2015' };

        const p = window.ReportStats.buildProgramme({ client, auditPlan, report, allReports: [] });
        const recert = p.stages.find((s) => s.id === 'recert');

        expect(recert.status).toBe('Requires scheduling'); // not silently left as "Planned"
        expect(p.issues.some((i) => /not after the current audit date/i.test(i))).toBe(true);
        // nextAudit must never be the broken recert stage, or any date <= the audit date.
        if (p.nextAudit) {
            expect(p.nextAudit.id).not.toBe('recert');
        }

        const result = window.ReportIntegrity.check({ report, auditPlan, client });
        expect(result.status).toBe('BLOCKED');
        expect(result.blockers.some((b) => b.id === 'B9' || b.id.startsWith('B2'))).toBe(true);
    });

    // Defect 1 stabilization — annual-issue certificates (expiry = anchor + ~364
    // days, an app convention) must NOT be treated as the true 3-year cycle end.
    // Real KTD Select data: initialDate 2024-08-21, currentIssue/expiry
    // 2026-08-20 (an annual re-issue), surveillance audit dated 2026-08-14 —
    // the true cycle end is initialDate + 3 years (Aug 2027), not Aug 2026.
    it('an annual-issue certificate (expiry < anchor+30mo) computes cycleEnd as anchor+36 months, not the annual expiry', () => {
        const client = {
            id: 'ktd-1', name: 'KTD Select',
            certificates: [{ standard: 'ISO 9001:2015', initialDate: '2024-08-21', expiryDate: '2026-08-20' }]
        };
        const auditPlan = { id: 'plan-ktd', clientId: 'ktd-1', auditType: 'Surveillance', standard: 'ISO 9001:2015', startDate: '2026-08-14' };
        const report = { id: 'rep-ktd', planId: 'plan-ktd', clientId: 'ktd-1', date: '2026-08-14', auditType: 'Surveillance', standard: 'ISO 9001:2015' };

        const p = window.ReportStats.buildProgramme({ client, auditPlan, report, allReports: [] });
        const byId = Object.fromEntries(p.stages.map((s) => [s.id, s]));

        expect(byId.recert.timing).toBe('by Aug 2027'); // NOT 'by Aug 2026' (the annual re-issue date)
        expect(p.issues).toEqual([]); // no chronology issue — the true cycle end is a year out
        expect(p.nextAudit).toBeTruthy();
        expect(p.nextAudit.id).toBe('recert');
        expect(p.nextAudit.date).toBe(new Date('2027-08-21').toISOString());
    });

    // formatCriterion — single source of truth for real-vs-internal criterion display.
    // Default label is the real clause ONLY (no FOCUS/SURV/ORG/DOC parenthetical);
    // opts.showInternal restores the 'real (internalRef)' label for internal/CAPA
    // contexts that still want the carryover tag visible.
    it('formatCriterion resolves internal refs, resolved criteria and plain clauses', () => {
        expect(window.ReportStats.formatCriterion({ clause: 'FOCUS.2' }))
            .toEqual({ label: 'internal ref FOCUS.2', isInternal: true, real: null, internalRef: null });
        expect(window.ReportStats.formatCriterion({ clause: 'FOCUS.2', criterionRef: '9.2' }))
            .toEqual({ label: '9.2', isInternal: false, real: '9.2', internalRef: 'FOCUS.2' });
        expect(window.ReportStats.formatCriterion({ clause: 'FOCUS.2', criterionRef: '9.2' }, { showInternal: true }))
            .toEqual({ label: '9.2 (FOCUS.2)', isInternal: false, real: '9.2', internalRef: 'FOCUS.2' });
        expect(window.ReportStats.formatCriterion({ clause: '7.1' }))
            .toEqual({ label: '7.1', isInternal: false, real: '7.1', internalRef: null });
        expect(window.ReportStats.formatCriterion({}))
            .toEqual({ label: '', isInternal: false, real: null, internalRef: null });
        // showInternal has no effect on an unresolved internal ref — nothing to restore.
        expect(window.ReportStats.formatCriterion({ clause: 'FOCUS.2' }, { showInternal: true }))
            .toEqual({ label: 'internal ref FOCUS.2', isInternal: true, real: null, internalRef: null });
    });

    // Banned secondary-verdict language in formal narrative → blocked.
    it('"Certifiable with targeted fixes" in the executive summary is blocked', () => {
        const report = {
            id: 'rep-verdict', clientId: 'ktd-1', client: 'KTD Select',
            date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
            executiveSummary: 'The organization is Certifiable with targeted fixes to two minor findings.',
            conclusion: 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.',
            checklistProgress: [], ncrs: []
        };
        const result = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() });
        expect(result.status).toBe('BLOCKED');
        expect(result.blockers.some((b) => b.id.startsWith('B6p'))).toBe(true);
    });
});

// 25.11/25.14/25.15 — source-level hygiene: banned generators removed for good
describe('KTD acceptance — source hygiene', () => {
    const read = (f) => fs.readFileSync(path.resolve(f), 'utf8');

    it('execution-reporting.js no longer fabricates maturity or "General" departments', () => {
        const src = read('./execution-reporting.js');
        expect(src).not.toContain('_maturityStars');
        expect(src).not.toContain("|| 'General'");
    });

    it('report-executive.js no longer teaches financial/consultancy claims', () => {
        const src = read('./report-executive.js');
        expect(src).not.toContain('avoids a follow-up audit cost');
        expect(src).not.toMatch(/Big Four/i);
        expect(src).not.toContain('operational resilience');
    });

    it('formal/annex split exists and analytics sections are annexed', () => {
        const src = read('./execution-reporting.js');
        expect(src).toContain('SECTION_GROUPS');
        expect(src).toMatch(/['"]exec-dashboard['"]\s*:\s*['"]analytics['"]/);
        expect(src).toMatch(/['"]risk-heatmap['"]\s*:\s*['"]analytics['"]/);
        expect(src).toMatch(/['"]conclusion['"]\s*:\s*['"]formal['"]/);
    });

    it('auditee owns corrective actions in report-risk.js', () => {
        const src = read('./report-risk.js');
        expect(src).toMatch(/AUDITEE CORRECTIVE ACTION PLAN/);
        expect(src).not.toContain('retrain the relevant personnel');
    });
});
