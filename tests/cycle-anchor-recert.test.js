import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');

// A recertification starts a new three-year cycle but leaves the original
// certification date on the certificate. Anchoring on that date forever
// produced cycles of four years and more — impossible under ISO 17021-1 — and
// the calendar then ran past the new cycle's surveillances to report
// recertification overdue for a client that had just been recertified.
const TODAY = new Date('2026-09-23T00:00:00');
const iso = (d) => (d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : null);

function cycleFor(cert, today = TODAY) {
    const client = { id: 'c', certificates: [cert], certificationLifecycleEvents: [] };
    const cycleState = ReportStats.cycleState({
        client, standard: cert.standard, certificate: cert, allReports: [], allPlans: [], today
    });
    const record = Domain.resolveCertificateCycle({
        client, certificate: cert, cycleState, now: today, settings: {},
        allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
    });
    return { cycleState, record };
}

const cert = (over) => Object.assign({
    id: 'C1', certificateNo: 'C-1', standard: 'ISO 9001:2015', status: 'Active'
}, over);

describe('the cycle restarts at a recertification', () => {
    it('re-anchors RYMA on the recertification, so Surveillance 1 is what is due', () => {
        const { cycleState, record } = cycleFor(cert({
            initialDate: '2022-10-07', currentIssue: '2025-10-07', expiryDate: '2026-10-06'
        }));

        expect(iso(cycleState.anchor)).toBe('2025-10-07');
        expect(iso(cycleState.firstCertified)).toBe('2022-10-07');
        expect(iso(cycleState.cycleEnd)).toBe('2028-10-07');
        expect(iso(cycleState.surv1Due)).toBe('2026-10-07');
        expect(record.auditType).toBe('Surveillance 1');
        expect(record.recommendedWindowStart).toBe('2026-09-07');
        expect(record.recommendedWindowEnd).toBe('2026-11-06');
        expect(Domain.describeCycleWindow(record, TODAY).state).toBe('open');
    });

    it('keeps a cycle at three years, never four', () => {
        const { cycleState } = cycleFor(cert({
            initialDate: '2022-10-07', currentIssue: '2025-10-07', expiryDate: '2026-10-06'
        }));
        const years = (cycleState.cycleEnd - cycleState.anchor) / (365.25 * 24 * 3600 * 1000);
        expect(years).toBeGreaterThan(2.9);
        expect(years).toBeLessThan(3.1);
    });

    it('does not restart the cycle for an annual re-issue inside it', () => {
        const { cycleState, record } = cycleFor(cert({
            initialDate: '2024-01-10', currentIssue: '2025-01-10', expiryDate: '2026-01-09'
        }), new Date('2026-01-05T00:00:00'));

        expect(iso(cycleState.anchor)).toBe('2024-01-10');   // unchanged
        expect(iso(cycleState.surv1Due)).toBe('2025-01-10');
        expect(iso(cycleState.surv2Due)).toBe('2026-01-10');
        expect(record.auditType).not.toBe('Surveillance 1');
    });

    it('leaves a first cycle alone', () => {
        const { cycleState } = cycleFor(cert({
            initialDate: '2025-11-07', currentIssue: '2025-11-07', expiryDate: '2026-11-06'
        }));
        expect(iso(cycleState.anchor)).toBe('2025-11-07');
        expect(cycleState.stage).toBe('Initial certification');
    });

    it('re-anchors a second recertification too', () => {
        const { cycleState } = cycleFor(cert({
            initialDate: '2019-05-02', currentIssue: '2025-05-02', expiryDate: '2026-05-01'
        }));
        expect(iso(cycleState.anchor)).toBe('2025-05-02');
    });

    it('accepts a recertification issued a little early', () => {
        // Recert audit run two months before the anniversary — plainly the
        // boundary, not an annual re-issue.
        const { cycleState } = cycleFor(cert({
            initialDate: '2022-10-07', currentIssue: '2025-08-20', expiryDate: '2026-08-19'
        }));
        expect(iso(cycleState.anchor)).toBe('2025-10-07');
    });

    it('does not call a recertified client "Initial certification"', () => {
        const { cycleState, record } = cycleFor(cert({
            initialDate: '2022-10-07', currentIssue: '2025-10-07', expiryDate: '2026-10-06'
        }));
        expect(cycleState.stage).toBe('New cycle started');
        // The label must not push the planner back to recertification.
        expect(record.auditType).toBe('Surveillance 1');
    });

    it('separates a lapsed certificate from a finished cycle', () => {
        // SILICON NETWORKS: recertified Sept 2025, annual certificate expired
        // 15 Sept 2026. The cycle runs to 2028 — the re-issue is overdue, the
        // certification is not over.
        const { cycleState, record } = cycleFor(cert({
            initialDate: '2022-09-16', currentIssue: '2025-09-16', expiryDate: '2026-09-15'
        }));

        expect(iso(cycleState.anchor)).toBe('2025-09-16');
        expect(iso(cycleState.cycleEnd)).toBe('2028-09-16');
        expect(cycleState.certificateExpired).toBe(true);
        expect(cycleState.expired).toBe(false);
        expect(iso(cycleState.surv1Due)).toBe('2026-09-16');
        expect(record.auditType).toBe('Surveillance 1');
    });

    it('drops a stage override recorded in the cycle that the recertification replaced', () => {
        // SILICON NETWORKS: an Admin pinned the stage to Surveillance 2 in June
        // 2024. The client was recertified in September 2025, which started a
        // new cycle — that override names a stage in a cycle that is over.
        const certificate = cert({ initialDate: '2022-09-16', currentIssue: '2025-09-16', expiryDate: '2026-09-15' });
        const client = {
            id: 'silicon', certificates: [certificate],
            certificationLifecycleEvents: [{
                id: 'OV1', certificateId: 'C1', type: 'authorized-override', overrideValue: 'Surveillance 2',
                metadata: { category: 'stage' }, reason: 'ok', user: 'Admin', role: 'Admin',
                occurredAt: '2024-06-01T00:00:00Z'
            }]
        };
        const cycleState = ReportStats.cycleState({
            client, standard: certificate.standard, certificate, allReports: [], allPlans: [], today: TODAY
        });
        const record = Domain.resolveCertificateCycle({
            client, certificate, cycleState, now: TODAY, settings: {},
            allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
        });

        expect(record.auditType).toBe('Surveillance 1');
        expect(record.override).toBeNull();
        expect(record.supersededOverride.overrideValue).toBe('Surveillance 2');
        expect(record.supersededReason).toBe('earlier-cycle');
        expect(record.recommendedWindowStart).toBe('2026-08-17');
        expect(Domain.describeCycleWindow(record, TODAY).state).toBe('open');
    });

    it('keeps an override recorded inside the current cycle', () => {
        const certificate = cert({ initialDate: '2022-09-16', currentIssue: '2025-09-16', expiryDate: '2026-09-15' });
        const client = {
            id: 'silicon', certificates: [certificate],
            certificationLifecycleEvents: [{
                id: 'OV2', certificateId: 'C1', type: 'authorized-override', overrideValue: 'Surveillance 2',
                metadata: { category: 'stage' }, reason: 'Client deferred the first surveillance',
                user: 'Certification Manager', role: 'Certification Manager', occurredAt: '2026-03-01T00:00:00Z'
            }]
        };
        const cycleState = ReportStats.cycleState({
            client, standard: certificate.standard, certificate, allReports: [], allPlans: [], today: TODAY
        });
        const record = Domain.resolveCertificateCycle({
            client, certificate, cycleState, now: TODAY, settings: {},
            allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
        });

        expect(record.auditType).toBe('Surveillance 2');
        expect(record.stageSource).toBe('authorized-override');
        expect(record.supersededOverride).toBeNull();
    });

    it('asks for the surveillance that is owed, not the one after it', () => {
        // Surveillance 1 fell due a week ago with nothing recorded. It is the
        // audit owed; the cycle does not get to step over it.
        const certificate = cert({ initialDate: '2025-09-16', currentIssue: '2025-09-16', expiryDate: '2028-09-15' });
        const { record, cycleState } = cycleFor(certificate);

        expect(iso(cycleState.surv1Due)).toBe('2026-09-16');
        expect(cycleState.stage).toBe('Surveillance 1 period');
        expect(record.auditType).toBe('Surveillance 1');
    });

    it('moves on once the surveillance window has fully closed', () => {
        const certificate = cert({ initialDate: '2025-01-10', currentIssue: '2025-01-10', expiryDate: '2028-01-09' });
        const { record } = cycleFor(certificate);   // S1 was due 2026-01-10, window shut 2026-02-09
        expect(record.auditType).toBe('Surveillance 2');
    });

    it('rolls into the next cycle rather than declaring certification over', () => {
        // Certification runs in three-year cycles: the one that began in 2022
        // ended in 2025 and the next is running now. The certificate ON FILE
        // lapsed in 2025 — a re-issue overdue, reported separately, not the end
        // of the cycle.
        const { cycleState } = cycleFor(cert({
            initialDate: '2022-09-16', currentIssue: '2022-09-16', expiryDate: '2025-09-15'
        }));
        expect(iso(cycleState.anchor)).toBe('2025-09-16');
        expect(iso(cycleState.cycleEnd)).toBe('2028-09-16');
        expect(cycleState.expired).toBe(false);
        expect(cycleState.certificateExpired).toBe(true);
    });

    it('counts whole cycles forward however many have passed', () => {
        const { cycleState } = cycleFor(cert({
            initialDate: '2011-04-02', currentIssue: '2011-04-02', expiryDate: '2012-04-01'
        }));
        expect(iso(cycleState.anchor)).toBe('2026-04-02');   // 2011 + five cycles
        expect(iso(cycleState.cycleEnd)).toBe('2029-04-02');
    });

    it('ignores a certificate carrying a date beyond its own cycle', () => {
        // LITHOCRAFT: first certified March 2024, certificate re-issued with an
        // April 2027 issue and a 2030 expiry. The cycle is still 2024 to 2027.
        const { cycleState, record } = cycleFor(cert({
            initialDate: '2024-03-07', currentIssue: '2027-04-19', expiryDate: '2030-04-15'
        }));

        expect(iso(cycleState.anchor)).toBe('2024-03-07');
        expect(iso(cycleState.cycleEnd)).toBe('2027-03-07');
        expect(iso(cycleState.surv1Due)).toBe('2025-03-07');
        expect(iso(cycleState.surv2Due)).toBe('2026-03-07');
        // Both surveillance windows shut months ago, so recertification is next
        // — and its window sits before the cycle ends, not out at the 2030 date.
        expect(record.auditType).toBe('Recertification');
        expect(record.recommendedWindowStart).toBe('2026-12-07');
        expect(record.recommendedWindowEnd).toBe('2027-02-05');
    });
});
