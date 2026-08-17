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

    it('methodologyNote is always populated with the exact required wording', () => {
        const populated = window.ReportStats.build({ report: {}, hydratedProgress: [item({ status: 'conform' })] });
        const EXACT = 'Audit Coverage = items assessed ÷ applicable checklist items (N/A excluded). '
            + 'Conformity indicator = assessed items without nonconformity ÷ assessed items; observations and OFIs '
            + 'do not reduce it. Analytical indicators only — not certification scores.';
        expect(populated.methodologyNote).toBe(EXACT);

        // Still populated (non-empty) even on the malformed/empty-input fallback path.
        const empty = window.ReportStats.build({});
        expect(typeof empty.methodologyNote).toBe('string');
        expect(empty.methodologyNote.length).toBeGreaterThan(0);
    });

    it('exposes coverageInputs/conformityInputs so renderers can show "N of M items"', () => {
        const hydratedProgress = [
            item({ status: 'conform' }),
            item({ status: 'conform' }),
            item({ status: 'nc', ncrType: 'major' }),
            item({ status: 'na' })
        ];
        const d = window.ReportStats.build({ report: {}, hydratedProgress });
        // applicable = 3 (4 total - 1 N/A); assessed = 3 (2 conform + 1 major)
        expect(d.coverageInputs).toEqual({ assessed: 3, applicable: 3 });
        // conforming = 2 (assessed 3 - 1 major)
        expect(d.conformityInputs).toEqual({ conforming: 2, assessed: 3 });
    });
});

describe('ReportStats.cleanEvidenceText', () => {
    it('trims and collapses internal whitespace', () => {
        expect(window.ReportStats.cleanEvidenceText('  two   spaces\n\tand a tab  ')).toBe('Two spaces and a tab.');
    });

    it('uppercases only the first letter, never the rest of the text', () => {
        expect(window.ReportStats.cleanEvidenceText('internal audit programme IA-2026 reviewed'))
            .toBe('Internal audit programme IA-2026 reviewed.');
    });

    it('adds a terminal period to a fragment ending in a letter or digit', () => {
        expect(window.ReportStats.cleanEvidenceText('calibration record overdue since May')).toBe('Calibration record overdue since May.');
        expect(window.ReportStats.cleanEvidenceText('record CAL-114')).toBe('Record CAL-114.');
    });

    it('does not double up a terminal period, or add one after other punctuation', () => {
        expect(window.ReportStats.cleanEvidenceText('already ends properly.')).toBe('Already ends properly.');
        expect(window.ReportStats.cleanEvidenceText('a quoted phrase"')).toBe('A quoted phrase"');
        expect(window.ReportStats.cleanEvidenceText('a parenthetical (note)')).toBe('A parenthetical (note)');
    });

    it('un-double-encodes stray HTML entities textually, without touching real content', () => {
        expect(window.ReportStats.cleanEvidenceText('Records &amp;amp; logs reviewed')).toBe('Records &amp; logs reviewed.');
        expect(window.ReportStats.cleanEvidenceText('a &amp;lt;tag&amp;gt; in the text')).toBe('A &lt;tag&gt; in the text.');
    });

    it('never rewords, rephrases or corrects spelling — mechanical only', () => {
        expect(window.ReportStats.cleanEvidenceText('teh recieved documnet was reviewd')).toBe('Teh recieved documnet was reviewd.');
    });

    it('handles empty/null input without throwing', () => {
        expect(window.ReportStats.cleanEvidenceText('')).toBe('');
        expect(window.ReportStats.cleanEvidenceText(null)).toBe('');
        expect(window.ReportStats.cleanEvidenceText(undefined)).toBe('');
        expect(window.ReportStats.cleanEvidenceText('   ')).toBe('');
    });
});
