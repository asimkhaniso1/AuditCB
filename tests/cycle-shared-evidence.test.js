import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');

// Certificates issued on the same dates are maintained by one audit programme:
// an integrated visit surveils every management system in that cycle, but the
// completion is recorded against a single certificate. SILICON NETWORKS holds
// ISO 9001 and ISO 27001 with identical initial / issue / expiry dates; the
// surveillances were recorded against the 9001 certificate, so the 27001 card
// claimed they never happened — amber nodes and a projected stage beside an
// identical certificate showing green ticks.
const TODAY = new Date('2026-09-23T00:00:00');
const DATES = { initialDate: '2025-09-16', currentIssue: '2025-09-16', expiryDate: '2026-09-15', status: 'Active' };

const completion = (certificateId, type, occurredAt) => ({
    id: `${certificateId}-${type}`, certificateId, type, occurredAt,
    user: 'Certification Manager', role: 'Certification Manager'
});

function siliconNetworks(overrides) {
    return {
        id: 'silicon', name: 'SILICON NETWORKS LLC',
        certificates: [
            Object.assign({ id: 'C-27001', certificateNo: '22PK9033', standard: 'ISO 27001:2022' }, DATES, overrides?.iso27001),
            Object.assign({ id: 'C-9001', certificateNo: '22PK9032', standard: 'ISO 9001:2015' }, DATES)
        ],
        certificationLifecycleEvents: overrides?.events || [
            completion('C-9001', 'surveillance-1-completed', '2025-10-10T00:00:00Z'),
            completion('C-9001', 'surveillance-2-completed', '2026-03-10T00:00:00Z')
        ]
    };
}

const stateFor = (client, standard) => ReportStats.cycleState({
    client, standard, certificate: client.certificates.find((c) => c.standard === standard),
    allReports: [], allPlans: [], today: TODAY
});

describe('completion evidence within one certification cycle', () => {
    it('ticks the other standard in the cycle and names where the evidence came from', () => {
        const client = siliconNetworks();
        const iso27001 = stateFor(client, 'ISO 27001:2022');

        expect(iso27001.completed.s1).toBe(true);
        expect(iso27001.completed.s2).toBe(true);
        expect(iso27001.sharedEvidence.s1).toBe('22PK9032');
        expect(iso27001.sharedEvidence.s2).toBe('22PK9032');
        // Evidence-backed, so the card drops "projected from certificate dates".
        expect(iso27001.stageSource).toBe('history');
    });

    it('leaves both cards of the cycle reading the same', () => {
        const client = siliconNetworks();
        const a = stateFor(client, 'ISO 27001:2022');
        const b = stateFor(client, 'ISO 9001:2015');

        expect(a.stage).toBe(b.stage);
        expect(a.stageSource).toBe(b.stageSource);
        expect(a.completed).toEqual(b.completed);
        expect(a.surv1Due.getTime()).toBe(b.surv1Due.getTime());
        expect(a.recertDue.getTime()).toBe(b.recertDue.getTime());
    });

    it('does not claim the evidence as the certificate´s own', () => {
        const client = siliconNetworks();
        const iso9001 = stateFor(client, 'ISO 9001:2015');

        expect(iso9001.completed.s2).toBe(true);
        expect(iso9001.sharedEvidence.s1).toBeNull();
        expect(iso9001.sharedEvidence.s2).toBeNull();
        expect(iso9001.lifecycleEvents).toHaveLength(2);
    });

    it('will not lend evidence to a certificate on a different cycle', () => {
        // A standard added mid-cycle: different anchor and expiry, so its own
        // surveillance programme has genuinely not started.
        const client = siliconNetworks({ iso27001: { initialDate: '2025-03-01', currentIssue: '2025-03-01', expiryDate: '2028-02-29' } });
        const iso27001 = stateFor(client, 'ISO 27001:2022');

        expect(iso27001.completed.s1).toBe(false);
        expect(iso27001.completed.s2).toBe(false);
        expect(iso27001.sharedEvidence.s1).toBeNull();
        expect(iso27001.stageSource).toBe('calendar');
    });

    it('will not lend evidence when only the expiry differs', () => {
        const client = siliconNetworks({ iso27001: { expiryDate: '2027-09-15' } });
        expect(stateFor(client, 'ISO 27001:2022').completed.s1).toBe(false);
    });

    it('shares recertification and renewal, which end the cycle', () => {
        const client = siliconNetworks({
            events: [completion('C-9001', 'recertification-completed', '2026-07-01T00:00:00Z')]
        });
        const iso27001 = stateFor(client, 'ISO 27001:2022');

        expect(iso27001.completed.recert).toBe(true);
        expect(iso27001.sharedEvidence.recert).toBe('22PK9032');
        expect(iso27001.expired).toBe(false);   // a completed recert re-opens the cycle

        const renewed = siliconNetworks({ events: [completion('C-9001', 'certification-renewal', '2026-07-01T00:00:00Z')] });
        expect(stateFor(renewed, 'ISO 27001:2022').completed.recert).toBe(true);
    });

    it('never shares an authorized stage override — that names one certificate', () => {
        const client = siliconNetworks({
            events: [{
                id: 'OV1', certificateId: 'C-9001', type: 'authorized-override', overrideValue: 'Surveillance 2',
                metadata: { category: 'stage' }, reason: 'ok', user: 'Admin', role: 'Admin', occurredAt: '2024-06-01T00:00:00Z'
            }]
        });
        const iso27001 = stateFor(client, 'ISO 27001:2022');

        expect(iso27001.lifecycleEvents).toHaveLength(0);
        expect(iso27001.completed.s1).toBe(false);
        expect(iso27001.completed.s2).toBe(false);
    });

    it('inherits milestones evidenced by the sibling´s FINALIZED AUDIT REPORTS', () => {
        // Reports carry a standard, not a certificate, so an integrated visit
        // finalized under "ISO 9001:2015" never reached the 27001 cycle.
        const client = siliconNetworks({ events: [] });
        const reports = [
            { clientId: 'silicon', standard: 'ISO 9001:2015', reportStatus: 'Finalized', auditType: 'Surveillance 1', date: '2025-10-10' },
            { clientId: 'silicon', standard: 'ISO 9001:2015', reportStatus: 'Finalized', auditType: 'Surveillance 2', date: '2026-03-10' }
        ];
        const state = (standard) => ReportStats.cycleState({
            client, standard, certificate: client.certificates.find((c) => c.standard === standard),
            allReports: reports, allPlans: [], today: TODAY
        });

        const iso27001 = state('ISO 27001:2022');
        expect(iso27001.completed.s1).toBe(true);
        expect(iso27001.completed.s2).toBe(true);
        expect(iso27001.sharedEvidence.s1).toBe('22PK9032');
        expect(iso27001.sharedEvidence.s2).toBe('22PK9032');
        expect(iso27001.stageSource).toBe('history');
        expect(iso27001.completed).toEqual(state('ISO 9001:2015').completed);
    });

    it('leaves a certificate that keeps its own record alone, even one milestone behind', () => {
        // Both certificates were surveilled once and recorded separately; only
        // the 9001 system had its second surveillance. They genuinely sit at
        // different stages now, which the planner must see so it asks for
        // separate plans rather than one integrated visit.
        const client = siliconNetworks({
            events: [
                completion('C-27001', 'surveillance-1-completed', '2025-10-10T00:00:00Z'),
                completion('C-9001', 'surveillance-1-completed', '2025-10-10T00:00:00Z'),
                completion('C-9001', 'surveillance-2-completed', '2026-03-10T00:00:00Z')
            ]
        });
        const iso27001 = stateFor(client, 'ISO 27001:2022');

        expect(iso27001.completed.s1).toBe(true);
        expect(iso27001.completed.s2).toBe(false);
        expect(iso27001.sharedEvidence.s2).toBeNull();
        expect(stateFor(client, 'ISO 9001:2015').completed.s2).toBe(true);
    });

    it('does not share into a certificate that has finalized reports of its own', () => {
        const client = siliconNetworks();
        const report = {
            clientId: 'silicon', standard: 'ISO 27001:2022', reportStatus: 'Finalized',
            auditType: 'Stage 2', date: '2025-09-16'
        };
        const iso27001 = ReportStats.cycleState({
            client, standard: 'ISO 27001:2022', certificate: client.certificates[0],
            allReports: [report], allPlans: [], today: TODAY
        });

        expect(iso27001.hasHistory).toBe(true);
        expect(iso27001.completed.s2).toBe(false);
        expect(iso27001.sharedEvidence.s2).toBeNull();
    });

    it('does not share the certificate-issue and decision flags, which are per certificate', () => {
        const client = siliconNetworks({
            events: [completion('C-9001', 'certification-decision', '2025-09-20T00:00:00Z'),
            completion('C-9001', 'certificate-issue', '2025-09-20T00:00:00Z')]
        });
        const iso27001 = stateFor(client, 'ISO 27001:2022');

        expect(iso27001.completed.certificationDecision).toBe(false);
        expect(iso27001.completed.certificateIssued).toBe(false);
    });

    it('is unaffected when the client holds a single certificate', () => {
        const client = siliconNetworks();
        client.certificates = [client.certificates[0]];
        const iso27001 = stateFor(client, 'ISO 27001:2022');

        expect(iso27001.completed.s1).toBe(false);
        expect(iso27001.sharedEvidence).toEqual({ s1: null, s2: null, recert: null });
    });
});
