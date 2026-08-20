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
loadModule('./report-executive.js');
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
                // No evidence field, no photo AND no substantive remark — a
                // genuinely unevidenced nonconformity.
                ncItem({ clause: 'FOCUS.2', criterionRef: '', department: 'General', evidence: '', comment: '' }),
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

    // Checklist findings have no dedicated evidence-text field in the execution
    // UI — the auditor writes the objective evidence into the finding's remarks.
    // B3 must accept that, or every photo-less checklist NC blocks issuance.
    describe('B3 objective evidence', () => {
        const base = (overrides) => ({
            id: 'rep-e', planId: 'plan-ktd', clientId: 'ktd-1', client: 'KTD Select',
            date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
            conclusion: 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.',
            checklistProgress: [Object.assign({
                status: 'nc', ncrType: 'minor', clause: '9.2', department: 'Quality', evidence: ''
            }, overrides)],
            ncrs: []
        });
        const b3s = (report) => window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() })
            .blockers.filter((b) => b.id.startsWith('B3'));

        it('a substantive remark counts as the objective-evidence statement', () => {
            expect(b3s(base({ comment: 'Internal audit programme IA-2026 reviewed; two of six scheduled audits were not performed.' }))).toEqual([]);
        });

        it('a photo alone still satisfies it', () => {
            expect(b3s(base({ comment: '', evidenceImage: 'data:image/jpeg;base64,xxx' }))).toEqual([]);
        });

        it('an empty or stub remark with no photo still blocks', () => {
            expect(b3s(base({ comment: '' })).length).toBe(1);
            expect(b3s(base({ comment: 'n/a' })).length).toBe(1);
            expect(b3s(base({ comment: 'see notes' })).length).toBe(1);
        });

        // An unresolved client has no certificates, which made the chronology
        // rule claim "no certificate on file" for a client that plainly has one.
        it('checkById resolves the client via the audit plan when the report lacks clientId', () => {
            const client = KTD_CLIENT();
            const plan = Object.assign(KTD_PLAN(), { clientId: 'ktd-1' });
            const report = {
                id: 'rep-noclient', planId: 'plan-ktd', client: 'KTD Select', // no clientId
                date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
                conclusion: 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.',
                checklistProgress: [], ncrs: []
            };
            window.state = { auditReports: [report], auditPlans: [plan], clients: [client], ncrs: [] };
            const result = window.ReportIntegrity.checkById('rep-noclient');
            const certIssue = result.blockers.filter((b) => /no certificate/i.test(b.message));
            expect(certIssue).toEqual([]);
        });

        // Narrative drafted before the AI guardrails can still carry stale facts
        // and consultancy register — warn, don't block (it is wording, not a
        // competing certification conclusion).
        it('W10 warns on maturity/consultancy wording in a formal narrative', () => {
            const report = base({ comment: 'Programme not fully implemented as scheduled.' });
            report.executiveSummary = 'The QMS demonstrates a foundational level of implementation and avenues for enhanced maturity and strategic integration.';
            const result = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() });
            expect(result.warnings.some((w) => w.id.startsWith('W10-'))).toBe(true);
            expect(result.blockers.some((b) => b.id.startsWith('B6p'))).toBe(false); // warning, not blocker
        });

        it('W11 warns when the narrative names a city other than the master site', () => {
            const report = base({ comment: 'Programme not fully implemented as scheduled.' });
            report.executiveSummary = 'A Surveillance Audit was conducted at the Head Office in Warwick, PA.';
            const result = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() });
            const w11 = result.warnings.find((w) => w.id.startsWith('W11-'));
            expect(w11).toBeTruthy();
            expect(w11.message).toContain('Warwick');
            expect(w11.message).toContain('Warminster');

            report.executiveSummary = 'A Surveillance Audit was conducted at the Head Office in Warminster, PA.';
            const clean = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() });
            expect(clean.warnings.some((w) => w.id.startsWith('W11-'))).toBe(false);
        });

        it('criterion blockers carry a ref so the UI can offer a direct fix', () => {
            const report = base({ clause: 'FOCUS.2', criterionRef: '', checklistId: 'cl-1', itemIdx: 4, comment: 'Programme not fully implemented as scheduled.' });
            const b1 = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() })
                .blockers.find((b) => b.id.startsWith('B1-'));
            expect(b1.ref).toEqual({ kind: 'finding', index: 0, clause: 'FOCUS.2', source: 'checklist', checklistId: 'cl-1', itemIdx: 4 });
        });
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

        // The widget must be able to tell an EARNED stage from a PROJECTED one:
        // with no finalized audit on file the stage label is a calendar
        // projection ("Surveillance N period") that sits beside unticked stage
        // nodes, so the UI annotates it — stageSource is that discriminator.
        it('flags a calendar-projected stage (no finalized history) as stageSource "calendar"', () => {
            const cs = window.ReportStats.cycleState(args([sv2Report('draft')]));
            expect(cs.stageSource).toBe('calendar');
            expect(cs.stage).toMatch(/period|Initial certification|Recertification due/);
        });

        it('flags an audit-earned stage as stageSource "history"', () => {
            const cs = window.ReportStats.cycleState(args([sv2Report('final')]));
            expect(cs.stageSource).toBe('history');
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
        // `kind` classifies what the reference actually is, so a caller never
        // presents a programme criterion or internal ref as a clause of the standard.
        expect(window.ReportStats.formatCriterion({ clause: 'FOCUS.2' }))
            .toEqual({ label: 'internal ref FOCUS.2', isInternal: true, real: null, internalRef: null, kind: 'internal' });
        expect(window.ReportStats.formatCriterion({ clause: 'FOCUS.2', criterionRef: '9.2' }))
            .toEqual({ label: '9.2', isInternal: false, real: '9.2', internalRef: 'FOCUS.2', kind: 'standard' });
        expect(window.ReportStats.formatCriterion({ clause: 'FOCUS.2', criterionRef: '9.2' }, { showInternal: true }))
            .toEqual({ label: '9.2 (FOCUS.2)', isInternal: false, real: '9.2', internalRef: 'FOCUS.2', kind: 'standard' });
        expect(window.ReportStats.formatCriterion({ clause: '7.1' }))
            .toEqual({ label: '7.1', isInternal: false, real: '7.1', internalRef: null, kind: 'standard' });
        expect(window.ReportStats.formatCriterion({}))
            .toEqual({ label: '', isInternal: false, real: null, internalRef: null, kind: 'none' });
        // showInternal has no effect on an unresolved internal ref — nothing to restore.
        expect(window.ReportStats.formatCriterion({ clause: 'FOCUS.2' }, { showInternal: true }))
            .toEqual({ label: 'internal ref FOCUS.2', isInternal: true, real: null, internalRef: null, kind: 'internal' });
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

// Regression: the validator must read the SHAPE ReportStats.build() actually
// returns. build() nests counts (resultCounts.majorNC, advisories.observation);
// reading only flat names yielded 0 for everything, which made the narrative
// count rule fire a false blocker on every report that stated any count.
describe('ReportIntegrity consumes the real ReportStats dataset shape', () => {
    const progress = [
        { status: 'nc', ncrType: 'minor', clause: '9.2', comment: 'Internal audit programme was not fully implemented as scheduled.' },
        { status: 'nc', ncrType: 'minor', clause: '7.2', comment: 'Required training for two operators had not been completed.' },
        { status: 'nc', ncrType: 'minor', clause: '8.2.2', comment: 'Legal and other requirements register was not available for review.' },
        { status: 'nc', ncrType: 'minor', clause: '9.1', comment: 'Monitoring data was not analysed at the planned intervals.' },
        { status: 'nc', ncrType: 'observation', clause: '7.1', comment: 'Competency matrix maintained; consider adding re-evaluation dates.' },
        { status: 'nc', ncrType: 'observation', clause: '8.1', comment: 'Production planning records were complete for the sample reviewed.' },
        { status: 'nc', ncrType: 'observation', clause: '8.4', comment: 'Supplier evaluation records were available for the sample reviewed.' },
        { status: 'nc', ncrType: 'observation', clause: '10.2', comment: 'Corrective action records were retained for the sample reviewed.' },
        { status: 'nc', ncrType: 'ofi', clause: '6.1', comment: 'The risk register could link actions to named owners.' },
        { status: 'conform', clause: '4.1', comment: 'Context of the organization is documented in the system manual.' }
    ];

    function builtStats(report) {
        return window.ReportStats.build({
            report, hydratedProgress: progress, auditPlan: KTD_PLAN(), client: KTD_CLIENT()
        });
    }

    it('does not raise a false count blocker when the narrative agrees with the dataset', () => {
        const report = {
            id: 'rep-shape', planId: 'plan-ktd', clientId: 'ktd-1', client: 'KTD Select',
            date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
            executiveSummary: 'The audit identified 4 non-conformities, 4 observations and 1 opportunity for improvement.',
            conclusion: 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.',
            checklistProgress: progress, ncrs: []
        };
        const stats = builtStats(report);
        // Guards the assumption this test exists to protect.
        expect(stats.resultCounts.minorNC).toBe(4);
        expect(stats.advisories.ofi).toBe(1);

        const result = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT(), stats });
        expect(result.blockers.some((b) => b.id.startsWith('B13'))).toBe(false);
    });

    it('still catches the real defect — observations and OFIs summed into one figure', () => {
        const report = {
            id: 'rep-shape-2', planId: 'plan-ktd', clientId: 'ktd-1', client: 'KTD Select',
            date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
            executiveSummary: 'The assessment concluded with the identification of 4 non-conformities and 5 opportunities for improvement.',
            conclusion: 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.',
            checklistProgress: progress, ncrs: []
        };
        const result = window.ReportIntegrity.check({
            report, auditPlan: KTD_PLAN(), client: KTD_CLIENT(), stats: builtStats(report)
        });
        const b13 = result.blockers.find((b) => b.id.startsWith('B13'));
        expect(b13).toBeTruthy();
        expect(b13.message).toContain('opportunities for improvement');
    });
});


// A client nonconformity must be raised against the standard being audited.
// ISO 17021 surveillance elements (cited as "9.6.2(b)") govern the certification
// body's own programme, not the client's management system.
describe('ReportIntegrity — criterion belongs to the audited standard', () => {
    const base = (clause) => ({
        id: 'rep-b15', planId: 'plan-ktd', clientId: 'ktd-1', client: 'KTD Select',
        date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
        conclusion: 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.',
        checklistProgress: [ncItem({ clause })],
        ncrs: []
    });

    it('blocks a nonconformity raised against a surveillance programme criterion', () => {
        const result = window.ReportIntegrity.check({
            report: base('9.6.2(b)'), auditPlan: KTD_PLAN(), client: KTD_CLIENT()
        });
        const b15 = result.blockers.find((b) => b.id.startsWith('B15'));
        expect(b15).toBeTruthy();
        expect(b15.message).toContain('9.6.2(b)');
        expect(result.status).toBe('BLOCKED');
    });

    it('leaves a nonconformity raised against a real clause alone', () => {
        const result = window.ReportIntegrity.check({
            report: base('9.2'), auditPlan: KTD_PLAN(), client: KTD_CLIENT()
        });
        expect(result.blockers.some((b) => b.id.startsWith('B15'))).toBe(false);
    });
});

// Specification #33 — the KTD Select surveillance audit as the regression test.
// The capstone is the CORRECTED report: every rule added across phases A-E must
// stay silent on a properly-formed certification report. A validator that only
// ever fires is as useless as one that never does.
describe('KTD acceptance #33 — the corrected report issues cleanly', () => {
    // 4 minor NCs, 4 observations, 1 OFI — each NC carrying an auditor-confirmed
    // clause of the audited standard, evidence, and a real department.
    const correctedProgress = () => [
        { status: 'nc', ncrType: 'minor', clause: 'FOCUS.2', criterionRef: '9.2', criterionSource: 'auditor-assigned', department: 'Quality',
            comment: 'Internal audit programme IA-2026 was reviewed; two scheduled audits had not been performed within the planned programme.' },
        { status: 'nc', ncrType: 'minor', clause: 'FOCUS.8', criterionRef: '8.2.2', criterionSource: 'auditor-assigned', department: 'Compliance',
            comment: 'The legal and other requirements register was requested and was not available for review during the audit.' },
        { status: 'nc', ncrType: 'minor', clause: '7.2', department: 'Human Resources',
            comment: 'Training records for two operators showed required competence training had not been completed.' },
        { status: 'nc', ncrType: 'minor', clause: '9.1', department: 'Quality',
            comment: 'Monitoring and measurement data was not analysed at the intervals defined by the organization.' },
        { status: 'nc', ncrType: 'observation', clause: '7.1', criterionRef: '7.1', department: 'Human Resources',
            comment: 'A competency matrix was maintained and was available for the sample reviewed.' },
        { status: 'nc', ncrType: 'observation', clause: '8.1', department: 'Production',
            comment: 'Production planning records were complete for the sample reviewed.' },
        { status: 'nc', ncrType: 'observation', clause: '8.4', department: 'Purchasing',
            comment: 'Supplier evaluation records were available for the sample reviewed.' },
        { status: 'nc', ncrType: 'observation', clause: '10.2', department: 'Quality',
            comment: 'Corrective action records were retained for the sample reviewed.' },
        { status: 'nc', ncrType: 'ofi', clause: '6.1', department: 'Quality',
            comment: 'The organization may consider recording named owners against each risk-register mitigation.' },
        { status: 'conform', clause: '4.1', department: 'Management',
            comment: 'Context of the organization is documented in the system manual and was reviewed.' }
    ];

    const correctedReport = () => ({
        id: 'rep-ktd-fixed', planId: 'plan-ktd', clientId: 'ktd-1', client: 'KTD Select',
        date: '2026-08-14', auditType: 'Surveillance', standard: 'ISO 9001:2015',
        auditMethod: 'Remote',
        scope: 'Manufacture and supply of precision cable and wire harness assemblies.',
        leadAuditor: 'Muhammad Asim Khan',
        // Counts stated exactly, with observations and OFIs kept distinct.
        executiveSummary: 'The audit identified 4 non-conformities, 4 observations and 1 opportunity for improvement.',
        previousFindingsStatus: 'No previous nonconformities requiring follow-up.',
        changesSinceLastAudit: 'No significant changes to the management system scope or organizational structure were reported.',
        conclusion: 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.',
        checklistProgress: correctedProgress(),
        ncrs: []
    });

    const remotePlan = () => Object.assign(KTD_PLAN(), { auditMethod: 'Remote' });

    const builtStats = () => window.ReportStats.build({
        report: correctedReport(), hydratedProgress: correctedProgress(),
        auditPlan: remotePlan(), client: KTD_CLIENT()
    });

    it('raises no blockers at all', () => {
        const result = window.ReportIntegrity.check({
            report: correctedReport(), auditPlan: remotePlan(), client: KTD_CLIENT(), stats: builtStats()
        });

        expect(result.blockers).toEqual([]);
        expect(result.status).toBe('READY FOR AUDITOR REVIEW');
    });

    it('counts 4 minor nonconformities, 4 observations and 1 OFI', () => {
        const stats = builtStats();
        expect(stats.resultCounts.majorNC).toBe(0);
        expect(stats.resultCounts.minorNC).toBe(4);
        expect(stats.advisories.observation).toBe(4);
        expect(stats.advisories.ofi).toBe(1);
    });

    it('never presents a FOCUS item as a clause of the standard', () => {
        correctedProgress().filter((i) => /^FOCUS/.test(i.clause)).forEach((i) => {
            const fc = window.ReportStats.formatCriterion(i);
            expect(fc.kind).toBe('standard');   // resolved to a real clause
            expect(fc.label).not.toMatch(/FOCUS/);
        });
    });

    it('keeps management system effectiveness consistent with the findings', () => {
        const eff = window.ReportStats.effectivenessStatements(correctedReport());
        // 9.2 carries a minor NC, so the internal audit programme cannot read as conforming.
        expect(eff.internalAudit).toMatch(/minor nonconformity/i);
        expect(eff.internalAudit).not.toMatch(/conforms to the requirements/i);
    });

    it('states a surveillance recommendation, never a granting one', () => {
        const text = window.ReportStats.recommendationText('Surveillance', { majorNC: 0, minorNC: 4 });
        expect(text.toLowerCase()).not.toContain('recommended for certification');
    });

    it('catches each original defect if it returns', () => {
        const stats = builtStats();
        const withDefect = (patch) => window.ReportIntegrity.check({
            report: Object.assign(correctedReport(), patch),
            auditPlan: remotePlan(), client: KTD_CLIENT(), stats
        });

        // Internal metadata leaking into client-facing text.
        expect(withDefect({ conclusion: 'Continued certification is recommended. (system-derived: x)' })
            .blockers.some((b) => b.id.startsWith('B11'))).toBe(true);
        // On-site wording on a Remote audit.
        expect(withDefect({ executiveSummary: 'The audit included on-site observation of production activities.' })
            .blockers.some((b) => b.id.startsWith('B12'))).toBe(true);
        // Observations and OFIs summed into one figure.
        expect(withDefect({ executiveSummary: 'The audit identified 4 non-conformities and 5 opportunities for improvement.' })
            .blockers.some((b) => b.id.startsWith('B13'))).toBe(true);
    });

    // Client spec (KTD Select recertification report review): the shipped
    // report's Section 5 narrative read "The audit identified 4
    // non-conformities (Minor/Major) and 5 opportunities for improvement" —
    // spelling out neither Major nor Minor separately, and inflating OFI from
    // 1 to 5 (4 Observations restated as OFIs). B13's regexes previously only
    // matched digits; a spelled-out count bypassed them entirely.
    it('catches a spelled-out count that disagrees with the dataset', () => {
        const stats = builtStats();
        const result = window.ReportIntegrity.check({
            report: Object.assign(correctedReport(), {
                executiveSummary: 'Four minor nonconformities were identified. Minor non-conformity in Clause 9.2 (Management).'
            }),
            auditPlan: remotePlan(), client: KTD_CLIENT(), stats
        });
        // 4 matches the real minor count here, so nothing should fire on THIS
        // sentence — the point of this fixture is the next one, which changes
        // only the digit.
        expect(result.blockers.some((b) => b.id.startsWith('B13'))).toBe(false);

        const wrong = window.ReportIntegrity.check({
            report: Object.assign(correctedReport(), {
                executiveSummary: 'Five minor nonconformities were identified. Minor non-conformity in Clause 9.2 (Management).'
            }),
            auditPlan: remotePlan(), client: KTD_CLIENT(), stats
        });
        const b13 = wrong.blockers.find((b) => b.id.startsWith('B13'));
        expect(b13).toBeTruthy();
        expect(b13.message).toContain('5');
        expect(b13.message).toContain('4');
    });

    it('catches "5 opportunities for improvement" for 4 Observations + 1 OFI, spelled out or digit', () => {
        const stats = builtStats();
        ['5 opportunities for improvement', 'five opportunities for improvement'].forEach((phrase) => {
            const result = window.ReportIntegrity.check({
                report: Object.assign(correctedReport(), {
                    executiveSummary: `The audit identified 4 non-conformities (Minor/Major) and ${phrase}.`
                }),
                auditPlan: remotePlan(), client: KTD_CLIENT(), stats
            });
            const b13 = result.blockers.find((b) => b.id.startsWith('B13') && b.message.includes('opportunities for improvement'));
            expect(b13, `expected a B13 blocker for "${phrase}"`).toBeTruthy();
            expect(b13.message).toContain('the validated findings dataset records 1');
        });
    });

    // Clause Area Performance table: single computation, one clause-resolution
    // rule for every item type (conform/NC/observation/OFI alike), so its own
    // Checked/Conform/Minor NC/Observation/OFI totals can never silently
    // disagree with the report's headline counts the way the old dual-rule
    // table could.
    describe('Clause Area Performance — single source of truth', () => {
        it('accounts for every assessed item — Checked totals equal the headline assessed count', () => {
            const stats = builtStats();
            const t = stats.byClauseArea.totals;
            expect(t.checked).toBe(stats.totals.assessed);
            expect(t.conform).toBe(stats.resultCounts.conform);
            expect(t.majorNC).toBe(stats.resultCounts.majorNC);
            expect(t.minorNC).toBe(stats.resultCounts.minorNC);
            expect(t.observation).toBe(stats.advisories.observation);
            expect(t.ofi).toBe(stats.advisories.ofi);
        });

        it('resolves a FOCUS carryover item (with criterionRef) to its real clause area, not "unresolved"', () => {
            const stats = builtStats();
            // FOCUS.2 -> criterionRef 9.2 -> Clause 9 (Performance Evaluation).
            const clause9 = stats.byClauseArea.rows.find((r) => r.clause === '9');
            expect(clause9).toBeTruthy();
            expect(clause9.minorNC).toBeGreaterThanOrEqual(1); // 9.2 and 9.1 both land here
        });

        it('puts a genuinely unattributable item in the unresolved bucket instead of dropping it', () => {
            const withUnresolved = correctedProgress().concat([
                { status: 'nc', ncrType: 'observation', clause: 'FOCUS.9', department: 'Quality', comment: 'No criterion assigned yet.' }
            ]);
            const rs = window.ReportStats.build({
                report: correctedReport(), hydratedProgress: withUnresolved, auditPlan: remotePlan(), client: KTD_CLIENT()
            });
            expect(rs.byClauseArea.unresolved).toBeTruthy();
            expect(rs.byClauseArea.unresolved.observation).toBe(1);
            // Still fully accounted for — nothing silently vanished from Checked.
            expect(rs.byClauseArea.totals.checked).toBe(rs.totals.assessed);
        });

        // B16 is a structural safety net, not something normal data should ever
        // trip — verify it stays silent on the real, correctly-computed dataset.
        it('B16 raises nothing against the correctly-computed dataset', () => {
            const result = window.ReportIntegrity.check({
                report: correctedReport(), auditPlan: remotePlan(), client: KTD_CLIENT(), stats: builtStats()
            });
            expect(result.blockers.some((b) => b.id.startsWith('B16'))).toBe(false);
        });
    });

    // OFI narrative (report.ofi) must never restate Observations as if they
    // were OFIs — the exact defect behind the shipped report's "Opportunities
    // for Improvement" section reading as 4-5 paragraphs when only 1 real OFI
    // existed, with the structured OFI table beneath it correctly showing 1.
    describe('B17 — OFI narrative cannot list more items than the dataset has OFIs', () => {
        it('stays silent when report.ofi has exactly one paragraph for the one real OFI', () => {
            const result = window.ReportIntegrity.check({
                report: Object.assign(correctedReport(), {
                    ofi: 'The organization may consider recording named owners against each risk-register mitigation.'
                }),
                auditPlan: remotePlan(), client: KTD_CLIENT(), stats: builtStats()
            });
            expect(result.blockers.some((b) => b.id.startsWith('B17'))).toBe(false);
        });

        it('blocks when report.ofi restates the 4 Observations alongside the 1 real OFI', () => {
            const result = window.ReportIntegrity.check({
                report: Object.assign(correctedReport(), {
                    ofi: [
                        'The audit team noted an opportunity to further enhance the effectiveness of the management review process.',
                        'An opportunity for improvement was identified concerning the management of external providers.',
                        'The audit team observed an opportunity to strengthen document control practices related to change management.',
                        'An opportunity for improvement was noted regarding the organization’s approach to establishing and monitoring objectives and targets.',
                        'The organization may consider recording named owners against each risk-register mitigation.'
                    ].join('\n')
                }),
                auditPlan: remotePlan(), client: KTD_CLIENT(), stats: builtStats()
            });
            const b17 = result.blockers.find((b) => b.id.startsWith('B17'));
            expect(b17).toBeTruthy();
            expect(b17.message).toContain('5');
            expect(b17.message).toContain('1 OFI');
        });
    });

    // Executive Summary "Key Findings" must summarize ALL NCs, not just one —
    // the shipped report's Key Findings read "Four minor non-conformities were
    // identified. Minor non-conformity in Clause 9.2 (Management)." and never
    // mentioned 8.2.2, 7.2 or 9.1. Generated dynamically from the same finding
    // set ReportStats counts, deterministically — never AI-summarized down to
    // one representative example.
    describe('Key Findings names every distinct NC clause, not just one', () => {
        function keyFindings() {
            const d = { report: correctedReport(), hydratedProgress: correctedProgress(), stats: {} };
            const s = window.ReportExecutive.buildAuditOutcomeSummary(d, { findings: [], strengths: [] });
            return s.findings.join(' | ');
        }

        it('names all four minor-NC clauses', () => {
            const text = keyFindings();
            expect(text).toContain('9.2');
            expect(text).toContain('8.2.2');
            expect(text).toContain('7.2');
            expect(text).toContain('9.1');
        });

        it('states the count exactly once, correctly, not per-clause', () => {
            const text = keyFindings();
            expect(text).toMatch(/\b4 minor nonconformities\b/);
        });

        it('never states a major-NC count when there are none', () => {
            const text = keyFindings();
            expect(text).not.toMatch(/major/i);
        });

        it('reports "no nonconformities" cleanly when there are none', () => {
            const cleanProgress = correctedProgress().filter((i) => i.status !== 'nc' || i.ncrType === 'observation' || i.ncrType === 'ofi');
            const d = { report: correctedReport(), hydratedProgress: cleanProgress, stats: {} };
            const s = window.ReportExecutive.buildAuditOutcomeSummary(d, { findings: [], strengths: [] });
            expect(s.findings).toEqual(['No nonconformities were identified during this audit.']);
        });
    });
});
