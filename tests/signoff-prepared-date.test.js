// PC Connection, 24 Nov 2026: the sign-off printed "Prepared: 24/11/2026",
// the day the PDF was exported, beside "Reviewed: 2026-11-23", so the report
// read as reviewed before it was prepared, in two date formats. Prepared now
// comes from the report and never falls after the technical review; both dates
// print as "19 November 2026".
//
// execution-reporting.js is too DOM-dependent to load whole here (see
// tests/previous-findings-status.test.js), so the sign-off block is lifted
// from the source.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
const BLOCK = (() => {
    const start = SRC.indexOf('// Resolve the display values for the technical review block');
    const end = SRC.indexOf('// ─── Corrective-action timeframe display');
    if (start < 0 || end < 0) throw new Error('sign-off block not found in execution-reporting.js');
    return SRC.slice(start, end);
})();

globalThis.window = globalThis.window || globalThis;

let prepared, fmt;
beforeAll(() => {
    loadScript('./doc-format.js', { global: true });
    loadScript('./report-stats.js', { global: true });
    // eslint-disable-next-line no-new-func
    new Function('window', 'const auditDatesInfo = (r, p) => window.ReportStats.auditDates(r, p);\n' + BLOCK)(window);
    prepared = window._resolvePreparedDate;
    fmt = window._formatSignoffDate;
});

const pcc = () => ({
    id: '1794902180881', date: '2026-11-17',
    closingMeeting: { date: '2026-11-19', summary: 'Held.' },
    technicalReview: { reviewer: 'Hassan Javed', outcome: 'Approved', date: '2026-11-23' }
});
const plan = { startDate: '2026-11-17', endDate: '2026-11-19' };

describe('Prepared date', () => {
    it('is the closing meeting date, not the export date (PC Connection)', () => {
        expect(fmt(prepared(pcc(), plan))).toBe('19 November 2026');
    });

    it('prefers the date the report was submitted for review', () => {
        const r = Object.assign(pcc(), { submittedAt: '2026-11-21T09:14:00.000Z' });
        expect(fmt(prepared(r, plan))).toBe('21 November 2026');
    });

    it('never derives a date after the technical review', () => {
        const r = Object.assign(pcc(), { submittedAt: '2026-11-24T10:00:00.000Z' });
        expect(prepared(r, plan)).toBe('2026-11-19');
    });

    it('falls back to the last audit day when no closing meeting date is recorded', () => {
        const r = Object.assign(pcc(), { closingMeeting: {} });
        expect(fmt(prepared(r, plan))).toBe('19 November 2026');
    });

    it('keeps a date the auditor recorded', () => {
        const r = Object.assign(pcc(), { preparedDate: '20/11/2026' });
        expect(fmt(prepared(r, plan))).toBe('20 November 2026');
        expect(fmt(prepared(Object.assign(pcc(), { preparedDate: 'Pending' }), plan))).toBe('Pending');
    });

    it('is blank, not today, when the report has no dates at all', () => {
        expect(prepared({ id: 'x' }, {})).toBe('');
    });
});

describe('sign-off date format', () => {
    it('prints both dates in the same long form', () => {
        expect(fmt('2026-11-23')).toBe('23 November 2026');
        expect(fmt('24/11/2026')).toBe('24 November 2026');
        expect(fmt('')).toBe('');
    });
});

describe('report wiring', () => {
    it('the preview and the export use the resolver, not the export date', () => {
        expect(SRC).not.toMatch(/rp-sig-date[^\n]*new Date\(\)\.toLocaleDateString/);
        expect(SRC).not.toMatch(/Prepared: ' \+ htmlEsc\(editedSigDate \|\| d\.today\)/);
        expect(SRC).toMatch(/id="rp-sig-date"[^\n]*formatSignoffDate\(resolvePreparedDate\(d\.report, d\.auditPlan\)\)/);
        expect(SRC).toMatch(/const editedReviewerDate = formatSignoffDate\(/);
    });

    it('a Prepared date typed in the preview is saved to the report', () => {
        expect(SRC).toMatch(/'rp-sig-date': \{ path: \['preparedDate'\] \}/);
    });
});
