import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');

// A milestone ticks green only from a finalized report or a completion event,
// and nothing in the app wrote the latter. Clients audited every year — the
// audit done, the record never entered — read "no finalized audit on file"
// for ever. Recording a performed audit closes that gap without pretending a
// report exists.
const TODAY = new Date('2026-09-23T00:00:00');
const CERT = {
    id: 'HA-9001', certificateNo: '21PK9009', standard: 'ISO 9001:2015', status: 'Active',
    initialDate: '2021-07-05', currentIssue: '2026-07-05', expiryDate: '2027-07-04'
};
const AUTHORIZED = { user: 'Asim', role: 'Certification Manager', settings: {} };

const completion = (milestone, performedAt) => ({
    id: 'E-' + milestone + performedAt, certificateId: CERT.id,
    type: Domain.COMPLETION_MILESTONES[milestone], stage: milestone,
    occurredAt: new Date(performedAt).toISOString(),
    user: 'Asim', role: 'Certification Manager', metadata: { category: 'completion' }
});

function resolve(events) {
    const client = { id: 'ha', name: 'H. A Steel Chains Pvt Ltd.', certificates: [CERT], certificationLifecycleEvents: events };
    const cycleState = ReportStats.cycleState({
        client, standard: CERT.standard, certificate: CERT, allReports: [], allPlans: [], today: TODAY
    });
    const record = Domain.resolveCertificateCycle({
        client, certificate: CERT, cycleState, now: TODAY, settings: {},
        allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
    });
    return { cycleState, record };
}

describe('recording an audit that was performed but never captured', () => {
    it('ticks the milestone it names', () => {
        const before = resolve([]);
        expect(before.cycleState.completed.s1).toBe(false);
        expect(before.record.auditType).toBe('Recertification');   // both windows long shut

        const after = resolve([completion('Surveillance 1', '2025-07-10')]);
        expect(after.cycleState.completed.s1).toBe(true);
        expect(after.cycleState.completed.s2).toBe(false);
        expect(after.cycleState.stageSource).toBe('history');
        expect(after.record.auditType).toBe('Surveillance 2');
    });

    it('brings a client audited every year back to the audit actually next', () => {
        const { cycleState, record } = resolve([
            completion('Surveillance 1', '2025-07-10'),
            completion('Surveillance 2', '2026-07-08')
        ]);
        expect(cycleState.completed.s1).toBe(true);
        expect(cycleState.completed.s2).toBe(true);
        expect(cycleState.stage).toBe('Surveillance 2 completed');
        expect(record.auditType).toBe('Recertification');
    });

    it('keeps a record dated in an earlier cycle out of this one', () => {
        // The cycle began 05/07/2024; a surveillance from the cycle before it
        // is filed but must not tick this cycle's milestone.
        const { cycleState } = resolve([completion('Surveillance 1', '2023-07-10')]);
        expect(cycleState.completed.s1).toBe(false);
        expect(cycleState.lifecycleEvents).toHaveLength(1);
    });
});

describe('Domain.createCompletionRecord', () => {
    const base = { ...AUTHORIZED, milestone: 'Surveillance 1', performedAt: '2025-07-10', now: TODAY };

    it('maps each milestone to its append-only event type', () => {
        expect(Domain.createCompletionRecord(base).type).toBe('surveillance-1-completed');
        expect(Domain.createCompletionRecord({ ...base, milestone: 'surveillance 2' }).type).toBe('surveillance-2-completed');
        expect(Domain.createCompletionRecord({ ...base, milestone: 'Recertification' }).type).toBe('recertification-completed');
    });

    it('refuses a milestone it does not recognise', () => {
        expect(() => Domain.createCompletionRecord({ ...base, milestone: 'Stage 1' })).toThrow(/Surveillance 1, Surveillance 2, or Recertification/);
    });

    it('demands the same authority as an override', () => {
        expect(() => Domain.createCompletionRecord({ ...base, role: 'Auditor' })).toThrow(/not authorized/);
    });

    it('demands a real date, and will not accept a future one', () => {
        expect(() => Domain.createCompletionRecord({ ...base, performedAt: '' })).toThrow(/date/i);
        expect(() => Domain.createCompletionRecord({ ...base, performedAt: 'last summer' })).toThrow(/date/i);
        expect(() => Domain.createCompletionRecord({ ...base, performedAt: '2027-01-01' })).toThrow(/future/i);
    });

    it('records who entered it, when it was performed, and any reference', () => {
        const record = Domain.createCompletionRecord({ ...base, note: 'Report AR-2025-114' });
        expect(record.milestone).toBe('Surveillance 1');
        expect(record.performedAt).toBe('2025-07-10');
        expect(record.note).toBe('Report AR-2025-114');
        expect(record.user).toBe('Asim');
        expect(record.createdAt).toBeTruthy();
    });
});

describe('Domain.completionFallsInCycle', () => {
    const cycleState = { anchor: new Date('2024-07-05T00:00:00') };

    it('accepts a date inside the cycle, and the run-up to it', () => {
        expect(Domain.completionFallsInCycle(cycleState, '2025-07-10')).toBe(true);
        expect(Domain.completionFallsInCycle(cycleState, '2024-06-01')).toBe(true);   // within the 60-day run-up
    });

    it('rejects one from the cycle before', () => {
        expect(Domain.completionFallsInCycle(cycleState, '2023-07-10')).toBe(false);
    });

    it('is safe on missing input', () => {
        expect(Domain.completionFallsInCycle(null, '2025-07-10')).toBe(false);
        expect(Domain.completionFallsInCycle(cycleState, '')).toBe(false);
    });
});
