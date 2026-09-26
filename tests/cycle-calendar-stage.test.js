import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');

// The certification cycle starts from the Initial Date and rolls every three
// years. The stage is the year of the cycle today falls in — Year 1
// Surveillance 1, Year 2 Surveillance 2, Year 3 Recertification — whether or
// not any audit was performed; a performed audit only ticks its milestone.
// Current Issue / Expiry shown are the current annual period of that cycle,
// whatever certificate happens to be on file.
const iso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);

const pcCert = (overrides) => Object.assign({
    id: 'PC-27001', certificateNo: '22US9019', standard: 'ISO/IEC 27001:2022', status: 'Active',
    initialDate: '2022-12-16', currentIssue: '2025-12-16', expiryDate: '2026-12-15'
}, overrides || {});

function resolve({ certificate, today, reports, events }) {
    const client = { id: 'pcc', name: 'PC CONNECTION, INC.', certificates: [certificate], certificationLifecycleEvents: events || [] };
    const now = new Date(today + 'T00:00:00');
    const cycleState = ReportStats.cycleState({ client, standard: certificate.standard, certificate, allReports: reports || [], allPlans: [], today: now });
    const record = Domain.resolveCertificateCycle({ client, certificate, cycleState, now, settings: {}, allReports: reports || [], allPlans: [] });
    return { cycleState, record };
}

describe('PC CONNECTION on 26/09/2026 — Initial Date 16/12/2022', () => {
    const { cycleState, record } = resolve({ certificate: pcCert(), today: '2026-09-26' });

    it('is in Cycle 2 (16/12/2025 – 15/12/2028), Year 1', () => {
        expect(iso(cycleState.anchor)).toBe('2025-12-16');
        expect(iso(cycleState.cycleLastDay)).toBe('2028-12-15');
        expect(cycleState.cycleNumber).toBe(2);
        expect(cycleState.cycleYear).toBe(1);
        expect(cycleState.cycleLabel).toBe('Cycle 2 · Year 1');
    });

    it('names the stage by the year — Surveillance 1 — not "New cycle started"', () => {
        expect(cycleState.stage).toBe('Surveillance 1');
        expect(cycleState.stageSource).toBe('calendar');
    });

    it('shows the current annual period as Current Issue 16/12/2025 and Expiry 15/12/2026', () => {
        expect(iso(cycleState.periodStart)).toBe('2025-12-16');
        expect(iso(cycleState.periodEnd)).toBe('2026-12-15');
    });

    it('plans Surveillance 1 in its window 16/11/2026 – 15/01/2027', () => {
        expect(record.auditType).toBe('Surveillance 1');
        expect(record.recommendedWindowStart).toBe('2026-11-16');
        expect(record.recommendedWindowEnd).toBe('2027-01-15');
    });
});

describe('the stage does not depend on whether an audit was performed', () => {
    it('reads the same stage with a finalized Surveillance 1 on file as without', () => {
        const without = resolve({ certificate: pcCert(), today: '2026-11-30' });
        const withS1 = resolve({
            certificate: pcCert(), today: '2026-11-30',
            reports: [{ client: 'PC CONNECTION, INC.', standard: 'ISO/IEC 27001:2022', auditType: 'Surveillance 1', reportStatus: 'final', date: '2026-11-20' }]
        });
        expect(withS1.cycleState.stage).toBe(without.cycleState.stage);
        expect(withS1.cycleState.completed.s1).toBe(true);
        expect(without.cycleState.completed.s1).toBe(false);
        // A performed audit is never asked for twice: the next one is S2.
        expect(withS1.record.auditType).toBe('Surveillance 2');
        expect(without.record.auditType).toBe('Surveillance 1');
    });

    it('moves to Year 2 on the anniversary even with Surveillance 1 never done, and stops asking for it once its window closes', () => {
        const inWindow = resolve({ certificate: pcCert(), today: '2027-01-05' });   // S1 window open to 15/01/2027
        expect(inWindow.cycleState.stage).toBe('Surveillance 2');
        expect(inWindow.cycleState.cycleLabel).toBe('Cycle 2 · Year 2');
        expect(iso(inWindow.cycleState.periodStart)).toBe('2026-12-16');
        expect(iso(inWindow.cycleState.periodEnd)).toBe('2027-12-15');
        expect(inWindow.record.auditType).toBe('Surveillance 1');

        const afterWindow = resolve({ certificate: pcCert(), today: '2027-02-01' });
        expect(afterWindow.cycleState.stage).toBe('Surveillance 2');
        expect(afterWindow.cycleState.completed.s1).toBe(false);      // the node shows it missed
        expect(afterWindow.record.auditType).toBe('Surveillance 2');   // but it no longer holds planning back
    });

    it('reaches Recertification in Year 3 with no audit on file at all', () => {
        const { cycleState, record } = resolve({ certificate: pcCert(), today: '2028-03-01' });
        expect(cycleState.stage).toBe('Recertification');
        expect(cycleState.cycleLabel).toBe('Cycle 2 · Year 3');
        expect(iso(cycleState.periodStart)).toBe('2027-12-16');
        expect(iso(cycleState.periodEnd)).toBe('2028-12-15');
        expect(record.auditType).toBe('Recertification');
    });
});

describe('the current period comes from the Initial Date, not the certificate on file', () => {
    it('shows the current period even when the certificate on file was never re-issued', () => {
        // Certificate on file still carries last cycle's dates.
        const { cycleState } = resolve({
            certificate: pcCert({ currentIssue: '2023-12-16', expiryDate: '2024-12-15' }), today: '2026-09-26'
        });
        expect(cycleState.stage).toBe('Surveillance 1');
        expect(iso(cycleState.periodStart)).toBe('2025-12-16');
        expect(iso(cycleState.periodEnd)).toBe('2026-12-15');
        // The lapsed record is still reported separately, never hidden.
        expect(cycleState.certificateExpired).toBe(true);
        expect(cycleState.expired).toBe(false);
    });

    it('counts cycles from the Initial Date', () => {
        const first = resolve({ certificate: pcCert({ initialDate: '2025-12-16', currentIssue: '2025-12-16' }), today: '2026-09-26' });
        expect(first.cycleState.cycleNumber).toBe(1);
        expect(first.cycleState.cycleLabel).toBe('Cycle 1 · Year 1');

        const third = resolve({ certificate: pcCert({ initialDate: '2019-12-16' }), today: '2026-09-26' });
        expect(third.cycleState.cycleNumber).toBe(3);
    });
});
