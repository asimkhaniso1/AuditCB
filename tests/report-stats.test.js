import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [] };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./report-stats.js'), 'utf8');
eval(src);

function item(overrides) {
    return Object.assign({ status: 'conform', clause: '8.5', department: 'Production' }, overrides);
}

describe('ReportStats.build', () => {
    beforeEach(() => {
        window.state = { ncrs: [] };
    });

    it('advisories do not reduce conformity', () => {
        const hydratedProgress = [
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'nc', ncrType: 'observation' }),
            item({ status: 'nc', ncrType: 'ofi' })
        ];
        const d = window.ReportStats.build({ report: {}, hydratedProgress });
        expect(d.conformityPct).toBe(100);
        expect(d.uniqueFindings.length).toBe(0);
        expect(d.advisories.total).toBe(2);
    });

    it('NA excluded from both denominators', () => {
        const hydratedProgress = [
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'na' }),
            item({ status: 'na' })
        ];
        const d = window.ReportStats.build({ report: {}, hydratedProgress });
        expect(d.coveragePct).toBe(100);
        expect(d.conformityPct).toBe(100);
        expect(d.totals.applicable).toBe(4);
    });

    it('not-assessed hits coverage not conformity', () => {
        const hydratedProgress = [
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: '' })
        ];
        const d = window.ReportStats.build({ report: {}, hydratedProgress });
        expect(d.coveragePct).toBe(80);
        expect(d.conformityPct).toBe(100);
        expect(d.reconciliation.some((r) => r.code === 'coverage_gap')).toBe(true);
    });

    it('real NCs reduce conformity', () => {
        const hydratedProgress = [
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'nc', ncrType: 'major' }),
            item({ status: 'nc', ncrType: 'minor' })
        ];
        const d = window.ReportStats.build({ report: {}, hydratedProgress });
        expect(d.conformityPct).toBe(75);
        expect(d.resultCounts.majorNC).toBe(1);
        expect(d.resultCounts.minorNC).toBe(1);
    });

    it('pending_classification: nc with blank ncrType counted as NC and flagged', () => {
        const hydratedProgress = [
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'nc', ncrType: '' })
        ];
        const d = window.ReportStats.build({ report: {}, hydratedProgress });
        expect(d.resultCounts.pendingClassification).toBe(1);
        expect(d.reconciliation.some((r) => r.code === 'unclassified_finding')).toBe(true);
        expect(d.conformityPct).toBe(75); // 3 of 4 assessed conforming
    });

    it('unique finding dedupe: checklist + matching manual merge into one, unmatched manual adds one', () => {
        const hydratedProgress = [
            item({ status: 'nc', ncrType: 'major', clause: '8.5', department: 'Production' })
        ];
        const report = {
            planId: 'plan-1',
            ncrs: [
                { clause: '8.5', type: 'major', department: 'Production', comment: 'manual match' },
                { clause: '9.2', type: 'major', department: 'Quality', comment: 'unmatched manual' }
            ]
        };
        const d = window.ReportStats.build({ report, hydratedProgress });
        expect(d.uniqueFindings.length).toBe(2);
        const merged = d.uniqueFindings.find((f) => f.clause === '8.5');
        expect(merged.sources).toEqual(expect.arrayContaining(['checklist', 'manual']));
        const extra = d.uniqueFindings.find((f) => f.clause === '9.2');
        expect(extra).toBeDefined();
        expect(extra.sources).toEqual(['manual']);
    });

    it('contradiction sanitization: conform status with leftover ncrType is treated as conform', () => {
        const hydratedProgress = [item({ status: 'conform', ncrType: 'major' })];
        const d = window.ReportStats.build({ report: {}, hydratedProgress });
        expect(d.resultCounts.conform).toBe(1);
        expect(d.resultCounts.majorNC).toBe(0);
        expect(d.uniqueFindings.length).toBe(0);
    });

    it('never throws on empty/malformed input', () => {
        const d1 = window.ReportStats.build({});
        expect(d1).toHaveProperty('reconciliation');
        expect(Array.isArray(d1.reconciliation)).toBe(true);

        const d2 = window.ReportStats.build({ report: null, hydratedProgress: null });
        expect(d2).toHaveProperty('reconciliation');
        expect(Array.isArray(d2.reconciliation)).toBe(true);
    });
});
