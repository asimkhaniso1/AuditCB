import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');

// The client overview draws a card per certificate: stage dots from
// ReportStats.cycleState, and a "Recommended Audit Window" from the planning
// domain. Resolving the window per CLIENT and matching it back by standard let
// it describe a different certificate than the card was showing — a superseded
// twin of the same scheme family, or one carrying an authorized stage override —
// so the window contradicted the dots beside it (a two-year-old surveillance
// window next to a card reading "Certificate expired").
const TODAY = new Date('2026-09-23T00:00:00');

const certificate = (over) => Object.assign({
    id: 'CERT-A', certificateNo: '22PK9033', standard: 'ISO 27001:2022', status: 'Active',
    initialDate: '2022-09-16', currentIssue: '2025-09-16', expiryDate: '2026-09-15'
}, over || {});

// What the card does: pick the certificate, derive cycleState, resolve the
// window from that same pair.
function cardFor(client, standard) {
    const stdCerts = client.certificates.filter((c) => c.standard === standard);
    const cert = stdCerts.find((c) => c.status === 'Active') || stdCerts[0];
    const cycleState = ReportStats.cycleState({
        client, standard, certificate: cert, allReports: [], allPlans: [], today: TODAY
    });
    const record = Domain.resolveCertificateCycle({
        client, certificate: cert, cycleState, now: TODAY, settings: {},
        allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
    });
    return { cert, cycleState, record, windowState: Domain.describeCycleWindow(record, TODAY) };
}

describe('recommended audit window belongs to the certificate on the card', () => {
    it('ignores a superseded same-family certificate the client context would have preferred', () => {
        const client = {
            id: 'silicon', name: 'SILICON NETWORKS LLC',
            certificates: [
                certificate(),
                // Same scheme family, later issue date, so the per-client
                // resolution picked THIS one for the '27001' family.
                certificate({ id: 'CERT-OLD', certificateNo: '21PK9001', standard: 'ISO/IEC 27001:2013', status: 'Suspended', currentIssue: '2025-12-01' })
            ],
            certificationLifecycleEvents: [{
                id: 'E1', certificateId: 'CERT-OLD', type: 'surveillance-1-completed',
                occurredAt: '2023-09-10T00:00:00Z', user: 'CM', role: 'Certification Manager'
            }]
        };

        const { record, windowState, cycleState } = cardFor(client, 'ISO 27001:2022');

        expect(record.certificateNo).toBe('22PK9033');
        expect(record.auditType).toBe('Recertification');
        expect(record.recommendedWindowStart).toBe('2026-06-17');
        expect(record.recommendedWindowEnd).toBe('2026-08-16');
        // Dots and window agree: nothing finalized, recertification missed.
        expect(cycleState.completed.recert).toBe(false);
        expect(windowState.state).toBe('closed');
    });

    it('does not let a duplicate certificate record lend its history to the card', () => {
        const client = {
            id: 'silicon', name: 'SILICON NETWORKS LLC',
            certificates: [certificate(), certificate({ id: 'CERT-B', certificateNo: '22PK9033-B', status: 'Draft', currentIssue: '2025-12-01' })],
            certificationLifecycleEvents: [{
                id: 'E1', certificateId: 'CERT-B', type: 'surveillance-1-completed',
                occurredAt: '2023-09-10T00:00:00Z', user: 'CM', role: 'Certification Manager'
            }]
        };

        const { record } = cardFor(client, 'ISO 27001:2022');

        // Before: 'Surveillance 2' targeting 2024-09-16 — the twin's stage.
        expect(record.certificateNo).toBe('22PK9033');
        expect(record.auditType).toBe('Recertification');
        expect(record.recommendedWindowStart).toBe('2026-06-17');
    });

    it('still honours an authorized override recorded against that same certificate', () => {
        const client = {
            id: 'silicon', certificates: [certificate()],
            certificationLifecycleEvents: [{
                id: 'OV1', certificateId: 'CERT-A', type: 'authorized-override', overrideValue: 'Surveillance 2',
                metadata: { category: 'stage' }, reason: 'Client requested deferral',
                user: 'Admin', role: 'Admin', occurredAt: '2024-06-01T00:00:00Z'
            }]
        };

        const { record, windowState } = cardFor(client, 'ISO 27001:2022');

        expect(record.auditType).toBe('Surveillance 2');
        expect(record.stageSource).toBe('authorized-override');
        expect(record.override.user).toBe('Admin');
        expect(record.recommendedWindowStart).toBe('2024-08-17');
        expect(record.recommendedWindowEnd).toBe('2024-10-16');
        // The card can now say WHY the window is two years old, and that it lapsed.
        expect(windowState.state).toBe('closed');
        expect(windowState.days).toBeGreaterThan(700);
    });

    it('resolves a window for a certificate whose family twin would have shadowed it', () => {
        // Two live certificates in one family: the per-client context keeps one
        // cycle for '27001', so a lookup by standard string found nothing for the
        // other card and it rendered no window at all.
        const client = {
            id: 'silicon',
            certificates: [
                certificate({ id: 'CERT-13', certificateNo: '19PK0001', standard: 'ISO/IEC 27001:2013', currentIssue: '2025-12-01' }),
                certificate()
            ],
            certificationLifecycleEvents: []
        };

        const context = Domain.resolveCycleContext({
            client, now: TODAY, settings: {}, allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
        });
        expect(context.cycles).toHaveLength(1);
        expect(context.cycles.find((c) => c.standard === 'ISO 27001:2022')).toBeUndefined();

        const { record } = cardFor(client, 'ISO 27001:2022');
        expect(record.certificateNo).toBe('22PK9033');
        expect(record.recommendedWindowStart).toBe('2026-06-17');
    });

    it('keeps the per-client context in step with the per-certificate resolver', () => {
        const client = { id: 'silicon', certificates: [certificate()], certificationLifecycleEvents: [] };
        const context = Domain.resolveCycleContext({
            client, now: TODAY, settings: {}, allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
        });
        const { record } = cardFor(client, 'ISO 27001:2022');
        expect(context.cycles[0]).toEqual(record);
    });
});

describe('describeCycleWindow', () => {
    const record = { recommendedWindowStart: '2026-06-17', recommendedWindowEnd: '2026-08-16' };

    it('reports a window that has closed, with how long ago', () => {
        const state = Domain.describeCycleWindow(record, TODAY);
        expect(state.state).toBe('closed');
        expect(state.days).toBe(38);
    });

    it('reports an open window with the days left', () => {
        const state = Domain.describeCycleWindow(record, new Date('2026-07-17T00:00:00'));
        expect(state.state).toBe('open');
        expect(state.days).toBe(30);
    });

    it('reports a window still ahead', () => {
        const state = Domain.describeCycleWindow(record, new Date('2026-05-18T00:00:00'));
        expect(state.state).toBe('upcoming');
        expect(state.days).toBe(30);
    });

    it('is safe on a record without dates', () => {
        expect(Domain.describeCycleWindow(null, TODAY).state).toBe('unknown');
        expect(Domain.describeCycleWindow({}, TODAY).state).toBe('unknown');
    });

    it('counts the first and last day as inside the window', () => {
        expect(Domain.describeCycleWindow(record, new Date('2026-06-17T00:00:00')).state).toBe('open');
        expect(Domain.describeCycleWindow(record, new Date('2026-08-16T00:00:00')).state).toBe('open');
    });
});
