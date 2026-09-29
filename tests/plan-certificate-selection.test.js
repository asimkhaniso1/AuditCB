import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');

// SG 1888 on 29/09/2026: Halal owes Surveillance 2 now (window to 14/10/2026),
// ISO 9001 owes Surveillance 1 in 2027, cGMP was created without dates. The
// plan took every certificate, so no plan could be made at all.
const client = {
    id: 'sg', name: 'SG 1888 (PVT.) LTD.',
    certificates: [
        { id: 'C-9001', standard: 'ISO 9001:2015', certificateNo: '23PK9001', status: 'Active', initialDate: '2023-02-03', currentIssue: '2026-02-03', expiryDate: '2027-02-02' },
        { id: 'C-HALAL', standard: 'Halal', certificateNo: 'CR/IHC/SG/09/24/HC', status: 'Active', initialDate: '2024-09-14', currentIssue: '2025-09-14', expiryDate: '2026-09-13' },
        { id: 'C-CGMP', standard: 'cGMP', certificateNo: '', status: 'Active' }
    ]
};
const resolve = (certificateIds) => Domain.resolveCycleContext({
    client, now: '2026-09-29', settings: {}, certificateIds, cycleStateResolver: ReportStats.cycleState, allReports: [], allPlans: []
});

describe('choosing which certificates a plan covers', () => {
    it('names each certificate and what it owes when they cannot share a plan', () => {
        const all = resolve();
        expect(all.valid).toBe(false);
        expect(all.conflict).toMatch(/ISO 9001:2015 — Surveillance 1/);
        expect(all.conflict).toMatch(/Halal — Surveillance 2/);
        expect(all.conflict).toMatch(/separate plans — untick/);
    });

    it('lists every dated certificate for the picker, and names the undated one instead of planning it', () => {
        const all = resolve();
        expect(all.available.map(a => a.standard)).toEqual(['ISO 9001:2015', 'Halal']);
        expect(all.available.every(a => a.selected)).toBe(true);
        expect(all.undated).toEqual(['cGMP']);
    });

    it('plans Halal alone', () => {
        const halal = resolve(['C-HALAL']);
        expect(halal.valid).toBe(true);
        expect(halal.auditType).toBe('Surveillance 2');
        expect(halal.standards).toEqual(['Halal']);
        expect(halal.certificateIds).toEqual(['C-HALAL']);
        expect(halal.available.find(a => a.standard === 'ISO 9001:2015').selected).toBe(false);
    });

    it('plans ISO 9001 alone, separately', () => {
        const iso = resolve(['C-9001']);
        expect(iso.valid).toBe(true);
        expect(iso.auditType).toBe('Surveillance 1');
        expect(iso.recommendedWindowStart).toBe('2027-01-04');
    });
});
