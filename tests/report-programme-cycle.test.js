// Certification programme in a later three-year cycle.
//
// PC Connection: first certified 16 Dec 2020, recertified Dec 2023, certificate
// on file re-issued 16 Dec 2025 and expiring 15 Dec 2026. Its February 2026
// surveillance report counted every stage from the Initial Date, so the
// programme read "Recertification by Dec 2023", placed Surveillance 2 after it,
// and the report was blocked three times over.
import { describe, it, expect } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
loadScript('./report-stats.js', { params: { module: undefined } });
const RS = window.ReportStats;

const STD = 'ISO 27001:2022';
const PCC = () => ({
    id: 'pcc', name: 'PC CONNECTION, INC.',
    certificates: [{ standard: STD, status: 'Active', initialDate: '2020-12-16', currentIssue: '2025-12-16', expiryDate: '2026-12-15' }]
});
const programme = (date, auditType, allReports) => RS.buildProgramme({
    client: PCC(),
    auditPlan: { id: 'plan-' + date, clientId: 'pcc', auditType, standard: STD, date },
    report: { id: 'rep-' + date, planId: 'plan-' + date, clientId: 'pcc', date, auditType, standard: STD },
    allReports: allReports || []
});
const byId = (p) => Object.fromEntries(p.stages.map((s) => [s.id, s]));

describe('buildProgramme — the cycle that contains the audit', () => {
    it('lays out the Dec 2023 – Dec 2026 cycle for the February 2026 surveillance', () => {
        const p = programme('2026-02-17', 'Surveillance');
        const s = byId(p);
        expect(p.issues).toEqual([]);
        expect(p.laterCycle).toBe(true);
        expect(p.cycleStart).toBe(new Date('2023-12-16').toISOString());
        expect([s.s1.label, s.s1.timing, s.s1.status]).toEqual(['Initial certification', 'Dec 2020', 'Completed']);
        expect([s.s2.label, s.s2.timing, s.s2.status]).toEqual(['Recertification (start of this cycle)', 'Dec 2023', 'Completed']);
        expect([s.sv1.timing, s.sv1.status]).toEqual(['Dec 2024', 'Completed']);
        expect([s.sv2.timing, s.sv2.status]).toEqual(['Feb 2026', 'This audit']);
        expect([s.recert.timing, s.recert.status]).toEqual(['by Dec 2026', 'Planned']);
        expect(p.nextAudit.id).toBe('recert');
        expect(p.nextAudit.date).toBe(new Date('2026-12-15').toISOString());
    });

    it('makes the November 2026 recertification the close of that cycle', () => {
        const s = byId(programme('2026-11-17', 'Recertification'));
        expect([s.recert.timing, s.recert.status]).toEqual(['Nov 2026', 'This audit']);
        expect(s.s2.timing).toBe('Dec 2023');
    });

    it('still closes that cycle with a recertification held just after the anniversary', () => {
        const p = programme('2027-01-20', 'Recertification');
        const s = byId(p);
        expect(p.cycleStart).toBe(new Date('2023-12-16').toISOString());
        expect(s.recert.status).toBe('This audit');
        expect(p.issues).toEqual([]);
    });

    it('ignores audits from earlier cycles and puts the opening recertification in its row', () => {
        const history = [
            { id: 'old-sv1', clientId: 'pcc', standard: STD, date: '2021-12-10', auditType: 'Surveillance 1', reportStatus: 'final' },
            { id: 'old-sv2', clientId: 'pcc', standard: STD, date: '2022-12-12', auditType: 'Surveillance 2', reportStatus: 'final' },
            { id: 'recert-23', clientId: 'pcc', standard: STD, date: '2023-11-28', auditType: 'Recertification', reportStatus: 'final' },
            { id: 'sv1-24', clientId: 'pcc', standard: STD, date: '2025-01-15', auditType: 'Surveillance 1', reportStatus: 'final' }
        ];
        const p = programme('2026-02-17', 'Surveillance', history);
        const s = byId(p);
        expect([s.s2.timing, s.s2.source]).toEqual(['Nov 2023', 'history']);
        expect([s.sv1.timing, s.sv1.source]).toEqual(['Jan 2025', 'history']);
        expect(s.sv2.status).toBe('This audit');
        expect([s.recert.timing, s.recert.status]).toEqual(['by Dec 2026', 'Planned']);
        expect(p.issues).toEqual([]);
    });

    it('leaves a first-cycle programme as it was', () => {
        const client = { id: 'k', name: 'KTD', certificates: [{ standard: 'ISO 9001:2015', initialDate: '2024-08-21', expiryDate: '2026-08-20' }] };
        const p = RS.buildProgramme({
            client,
            auditPlan: { id: 'p', clientId: 'k', auditType: 'Surveillance', standard: 'ISO 9001:2015', startDate: '2026-08-14' },
            report: { id: 'r', planId: 'p', clientId: 'k', date: '2026-08-14', auditType: 'Surveillance', standard: 'ISO 9001:2015' },
            allReports: []
        });
        const s = byId(p);
        expect(p.laterCycle).toBe(false);
        expect([s.s1.label, s.s1.timing]).toEqual(['Stage 1', 'Aug 2024']);
        expect([s.s2.label, s.s2.timing]).toEqual(['Stage 2 (Initial Certification)', 'Aug 2024']);
        expect(s.sv2.status).toBe('This audit');
        expect(s.recert.timing).toBe('by Aug 2027');
    });
});
