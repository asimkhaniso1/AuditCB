import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');

// An authorized stage override decides which audit a certificate is treated as
// owing, and there was no way back out of one: the events are append-only and
// the latest override won, so a stage set by mistake stood forever. Cancelling
// is now itself a recorded decision — the override stays on the history and a
// revocation takes it out of force.
const TODAY = new Date('2026-09-23T00:00:00');
const CERT = {
    id: 'C-27001', certificateNo: '22PK9033', standard: 'ISO 27001:2022', status: 'Active',
    initialDate: '2022-09-16', currentIssue: '2025-09-16', expiryDate: '2026-09-15'
};

const override = (at, value = 'Surveillance 2') => ({
    id: 'OV-' + at, certificateId: CERT.id, type: 'authorized-override', overrideValue: value,
    metadata: { category: 'stage' }, reason: 'Client deferred', user: 'Admin', role: 'Admin', occurredAt: at
});
const revocation = (at) => ({
    id: 'REV-' + at, certificateId: CERT.id, type: 'authorized-override-revoked',
    metadata: { category: 'stage' }, reason: 'Recorded in error', user: 'Admin', role: 'Admin', occurredAt: at
});

function resolve(events) {
    const client = { id: 'silicon', name: 'SILICON NETWORKS LLC', certificates: [CERT], certificationLifecycleEvents: events };
    const cycleState = ReportStats.cycleState({
        client, standard: CERT.standard, certificate: CERT, allReports: [], allPlans: [], today: TODAY
    });
    return Domain.resolveCertificateCycle({
        client, certificate: CERT, cycleState, now: TODAY, settings: {},
        allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
    });
}

describe('cancelling an authorized stage override', () => {
    it('hands the cycle back to the certificate´s own dates', () => {
        const pinned = resolve([override('2026-09-23T05:32:00Z')]);
        expect(pinned.auditType).toBe('Surveillance 2');
        expect(pinned.stageSource).toBe('authorized-override');

        const released = resolve([override('2026-09-23T05:32:00Z'), revocation('2026-09-23T09:00:00Z')]);
        expect(released.auditType).toBe('Surveillance 1');
        expect(released.override).toBeNull();
        expect(released.stageSource).not.toBe('authorized-override');
    });

    it('keeps the cancelled override on the record', () => {
        const events = [override('2026-09-23T05:32:00Z'), revocation('2026-09-23T09:00:00Z')];
        const released = resolve(events);
        expect(released.lifecycleEvents).toHaveLength(2);
        expect(released.lifecycleEvents.some(e => e.type === 'authorized-override')).toBe(true);
        expect(released.lifecycleEvents.some(e => e.type === 'authorized-override-revoked')).toBe(true);
    });

    it('cancels only what came before it — a later override takes effect again', () => {
        const record = resolve([
            override('2026-09-23T05:32:00Z'),
            revocation('2026-09-23T09:00:00Z'),
            override('2026-09-23T10:00:00Z', 'Recertification')
        ]);
        expect(record.auditType).toBe('Recertification');
        expect(record.stageSource).toBe('authorized-override');
    });

    it('cancels the standing override when several were recorded', () => {
        // SILICON had two, minutes apart; one cancellation clears the stage.
        const record = resolve([
            override('2026-09-23T05:32:52Z'),
            override('2026-09-23T08:00:02Z'),
            revocation('2026-09-23T09:00:00Z')
        ]);
        expect(record.auditType).toBe('Surveillance 1');
        expect(record.override).toBeNull();
    });

    it('is ignored when it names a different category', () => {
        const record = resolve([
            override('2026-09-23T05:32:00Z'),
            Object.assign(revocation('2026-09-23T09:00:00Z'), { metadata: { category: 'duration' } })
        ]);
        expect(record.auditType).toBe('Surveillance 2');
    });
});

describe('createOverrideRevocation', () => {
    const base = { category: 'stage', reason: 'Recorded in error', user: 'Asim', role: 'Certification Manager' };

    it('demands the same authority as recording one', () => {
        expect(() => Domain.createOverrideRevocation({ ...base, role: 'Auditor' })).toThrow(/not authorized/);
    });

    it('demands a documented reason', () => {
        expect(() => Domain.createOverrideRevocation({ ...base, reason: '   ' })).toThrow(/reason/i);
    });

    it('records who cancelled what, and when', () => {
        const rev = Domain.createOverrideRevocation({ ...base, revokesOverrideId: 'OV-1', originalValue: 'Surveillance 2' });
        expect(rev.category).toBe('stage');
        expect(rev.revokesOverrideId).toBe('OV-1');
        expect(rev.originalValue).toBe('Surveillance 2');
        expect(rev.user).toBe('Asim');
        expect(rev.createdAt).toBeTruthy();
    });

    it('is a lifecycle event type the recorder accepts', () => {
        expect(Domain.EVENT_TYPES).toContain('authorized-override-revoked');
        const event = Domain.createLifecycleEvent({
            certificateId: CERT.id, type: 'authorized-override-revoked',
            user: 'Asim', role: 'Certification Manager', reason: 'Recorded in error',
            metadata: { category: 'stage' }
        });
        expect(event.type).toBe('authorized-override-revoked');
    });
});
