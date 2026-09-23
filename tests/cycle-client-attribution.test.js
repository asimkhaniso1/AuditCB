import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');

// Reports and plans in the field carry no clientId. The cycle only compared
// ids when BOTH sides had one, so a record without one counted as every
// client's history: one client's finalized surveillance ticked Surveillance 1
// for every other client holding the same standard, and the whole book read a
// stage ahead of the audit it owed.
const TODAY = new Date('2026-09-23T00:00:00');

const certificate = {
    id: 'LS-9001', certificateNo: '25UK9001', standard: 'ISO 9001:2015', status: 'Active',
    initialDate: '2025-11-07', currentIssue: '2025-11-07', expiryDate: '2026-11-06'
};
const client = {
    id: '24d5cd19-47fe-4eee-88d0-ea07da86fa01', name: 'Language Services UK Limited',
    certificates: [certificate], certificationLifecycleEvents: []
};

// A different client's finalized surveillance, saved without a clientId.
const strayReport = {
    client: 'KTD Select', standard: 'ISO 9001:2015', auditType: 'Surveillance',
    reportStatus: 'final', date: '2026-08-14'
};

const stateWith = (allReports, allPlans) => ReportStats.cycleState({
    client, standard: certificate.standard, certificate,
    allReports: allReports || [], allPlans: allPlans || [], today: TODAY
});

describe('a cycle counts only its own client´s records', () => {
    it('ignores another client´s finalized audit that carries no clientId', () => {
        const state = stateWith([strayReport]);

        expect(state.hasHistory).toBe(false);
        expect(state.completed.s1).toBe(false);
        expect(state.surveillancesDone).toBe(0);
        expect(state.stage).toBe('Initial certification');
        expect(state.stageSource).toBe('calendar');
    });

    it('still counts the client´s own audit when it is matched by name alone', () => {
        const own = { ...strayReport, client: 'Language Services UK Limited' };
        const state = stateWith([own]);

        expect(state.hasHistory).toBe(true);
        expect(state.completed.s1).toBe(true);
    });

    it('matches on clientId when both sides carry one, whatever the name says', () => {
        const own = { ...strayReport, client: 'renamed since', clientId: client.id };
        expect(stateWith([own]).completed.s1).toBe(true);

        const other = { ...strayReport, client: client.name, clientId: 'someone-else' };
        expect(stateWith([other]).completed.s1).toBe(false);
    });

    it('attributes a record naming nobody to nobody', () => {
        const orphan = { standard: 'ISO 9001:2015', auditType: 'Surveillance', reportStatus: 'final', date: '2026-08-14' };
        expect(stateWith([orphan]).completed.s1).toBe(false);
    });

    it('does not show another client´s scheduled audit as this client´s next visit', () => {
        const strayPlan = { client: 'KTD Select', standard: 'ISO 9001:2015', status: 'Scheduled', date: '2026-10-01' };
        const state = stateWith([], [strayPlan]);

        expect(state.nextAudit && state.nextAudit.source).not.toBe('scheduled');
    });

    it('still shows the client´s own scheduled audit', () => {
        const ownPlan = { client: client.name, standard: 'ISO 9001:2015', status: 'Scheduled', date: '2026-10-01' };
        const state = stateWith([], [ownPlan]);

        expect(state.nextAudit.source).toBe('scheduled');
    });
});
