// PC Connection draft report, 2026-11-21 (85 pages), reviewed against the
// audit record:
//  1. a three-day audit (17–19 November) printed as one day on the cover, in
//     both summaries, the audit information and the narrative ("from
//     2026-11-17 to 2026-11-17"): the last day is on the plan, and the report
//     read report.endDate only;
//  2. every corrective action form was dated the first day;
//  3. "109 items audited" and "109 items sampled" beside "73 of 109 assessed";
//  4. the auditor's planning notes printed as the Requirement, also on the
//     corrective action forms;
//  5. the distribution list printed as one run-on line above an empty table;
//  6. "&amp;" printed in the evidence traceability table.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import fs from 'fs';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

beforeAll(() => {
    loadScript('./utils.js', { global: true });
    window.UTILS.getPlanRef = () => 'PLN-PCI-2026-02';
    globalThis.openCreateReportModal = () => { };
    globalThis.openEditReportModal = () => { };
    loadScript('./doc-format.js', { params: { module: undefined } });
    loadScript('./report-stats.js', { global: true });
    loadScript('./report-executive.js', { params: { module: undefined } });
    loadScript('./report-findings-ops.js', { params: { module: undefined } });
    loadScript('./execution-reporting.js', { global: true });
});
beforeEach(() => {
    window.state = { auditReports: [], clients: [], auditPlans: [], ncrs: [] };
    globalThis.state = window.state;
});

const REPORT = { id: '1794902180881', date: '2026-11-17', leadAuditor: 'Lead', ncrs: [], closingMeeting: { date: '2026-11-19' } };
const PLAN = { id: 'p1', date: '2026-11-17', startDate: '2026-11-17', endDate: '2026-11-19', manDays: 1.5, auditMethod: 'Remote' };

describe('1. the audit dates run from the first day to the last', () => {
    const RS = () => window.ReportStats;

    it('takes the last day from the plan when the report row has none', () => {
        expect(RS().auditDates(REPORT, PLAN)).toEqual({ start: '2026-11-17', end: '2026-11-19', days: 3, text: '17–19 November 2026' });
        expect(window._auditDatesText(REPORT, PLAN)).toBe('17–19 November 2026');
    });

    it('a one-day audit is one date; an end on or before the start is not a range', () => {
        expect(RS().auditDates(REPORT, { endDate: '2026-11-17' })).toMatchObject({ end: '', days: 1, text: '17 November 2026' });
        expect(RS().auditDates(REPORT, { endDate: '2026-11-10' })).toMatchObject({ end: '', days: 1, text: '17 November 2026' });
        expect(RS().auditDates(REPORT, null)).toMatchObject({ end: '', days: 1 });
    });

    it('the report\'s own end date wins over the plan; a range can cross a month', () => {
        expect(RS().auditDates({ date: '2026-11-30', endDate: '2026-12-02' }, { endDate: '2026-12-05' })).toMatchObject({ end: '2026-12-02', days: 3, text: '30 November–2 December 2026' });
    });

    it('with no date at all there is nothing to print', () => {
        expect(RS().auditDates({}, {})).toEqual({ start: '', end: '', days: 0, text: '' });
        expect(RS().auditDates({}, { startDate: '2026-11-17', endDate: '2026-11-19' }).text).toBe('17–19 November 2026');
    });

    it('still gives a range when the date formatter is not loaded', () => {
        const df = window.DocFormat;
        try {
            window.DocFormat = undefined;
            expect(RS().auditDates(REPORT, PLAN)).toEqual({ start: '2026-11-17', end: '2026-11-19', days: 3, text: '2026-11-17 — 2026-11-19' });
        } finally { window.DocFormat = df; }
    });

    it('every print site uses it, and the narrative prompts are told the range', () => {
        const src = fs.readFileSync('execution-reporting.js', 'utf8');
        // No print site reads the report's end date on its own any more.
        expect(src).not.toMatch(/d\.report\.endDate \?/);
        expect(src).not.toMatch(/report\.endDate \? ' (to|—) '/);
        expect((src.match(/auditDatesText\(/g) || []).length).toBeGreaterThanOrEqual(7);
        // The duration says over how many days the man-days were spent.
        expect(src).toContain("(span > 1 ? ' over ' + span + ' days' : '')");
        expect(fs.readFileSync('ai-service.js', 'utf8')).toContain('- Audit dates: ${auditDatesLine}');
        expect(fs.readFileSync('report-executive.js', 'utf8')).toContain('- Audit dates: ${(window.ReportStats && window.ReportStats.auditDates');
    });
});

describe('2 and 4. corrective action forms', () => {
    const forms = (item, report) => {
        const d = {
            report: Object.assign({}, REPORT, report), auditPlan: PLAN, cbSettings: { cbName: 'CB' },
            hydratedProgress: [Object.assign({ checklistId: 'cl1', itemIdx: 'A-0', clause: '8.6.2', status: 'nc', ncrType: 'minor', requirement: 'Sample service requests: verify they are fulfilled through the defined procedure.' }, item)]
        };
        const sec = window.ReportFindingsOps.sections(d).find((s) => s.key === 'carForms');
        const el = document.createElement('div');
        el.innerHTML = sec.bodyHtml.replace(/<\/(td|div)>/g, ' </$1>');
        return el.textContent.replace(/\s+/g, ' ');
    };

    it('carry the audit\'s dates, and are raised on the day of the closing meeting', () => {
        const t = forms({});
        expect(t).toContain('Report AR-PCI-2026-02 · 17–19 November 2026');
        expect(t).toMatch(/Raised By \/ Date Lead \/ Nov 19, 2026/);
        expect(t).not.toContain('Nov 17, 2026');
    });

    it('with no closing meeting recorded, the last audit day; for a one-day audit, that day', () => {
        expect(forms({}, { closingMeeting: null })).toMatch(/Raised By \/ Date Lead \/ Nov 19, 2026/);
        const d = { report: { id: 'r', date: '2026-11-17', leadAuditor: 'Lead', ncrs: [] }, auditPlan: { id: 'p1' }, cbSettings: {},
            hydratedProgress: [{ checklistId: 'cl1', itemIdx: 'A-0', clause: '7.5', status: 'nc', ncrType: 'minor', requirement: 'Control documented information.' }] };
        const body = window.ReportFindingsOps.sections(d).find((s) => s.key === 'carForms').bodyHtml;
        expect(body).toContain('17 November 2026');
        expect(body).toContain('Nov 17, 2026');
    });

    it('print the requirement without the auditor\'s planning notes', () => {
        const t = forms({ requirement: 'Sample service requests: verify they are fulfilled through the defined procedure. Pre-audit gap: no documented information was on file at the pre-audit review, and evidence was requested from the client on 16 November 2026. Record what was supplied, or whether its absence affects conformity.' });
        expect(t).toContain('Requirement Sample service requests: verify they are fulfilled through the defined procedure.');
        expect(t).not.toContain('Pre-audit gap');
        expect(t).not.toContain('Record what was supplied');
    });
});

describe('4. the requirement, as the client reads it', () => {
    const clean = (t) => window.ReportStats.clientRequirement(t);

    it('drops each kind of planning note, and everything after it', () => {
        expect(clean('Verify the BIA is current. Documented information on file that should support this: Business Impact Analysis Procedure (Business Continuity Management).')).toBe('Verify the BIA is current.');
        expect(clean('Sample releases deployed since the previous audit. No validated supporting document mapped — auditor to select or confirm the document.')).toBe('Sample releases deployed since the previous audit.');
        expect(clean('Verify service costs are budgeted. Pre-audit gap: no documented information was on file. Record what was supplied.')).toBe('Verify service costs are budgeted.');
        expect(clean('Verify X. Documented information on file that should support this: A; B. Pre-audit gap: none on file.')).toBe('Verify X.');
    });

    it('leaves an ordinary requirement alone', () => {
        expect(clean('The organization shall retain documented information as evidence of the results.')).toBe('The organization shall retain documented information as evidence of the results.');
        expect(clean(null)).toBe('');
    });

    it('is applied where the report hydrates each question', () => {
        const src = fs.readFileSync('execution-reporting.js', 'utf8');
        expect(src).toContain("requirement: clientReq(requirement || item.text || item.requirement || item.description) || 'Requirement details not available',");
    });
});

describe('3. counts mean assessed items', () => {
    it('the classifier is available to the report, and items with no result are left out of the audit trails', () => {
        expect(window.ReportStats.classifyItem({ status: 'not_sampled' })).toBe('notAssessed');
        expect(window.ReportStats.classifyItem({ status: '' })).toBe('notAssessed');
        expect(window.ReportStats.classifyItem({ status: 'conform' })).toBe('conform');
        const src = fs.readFileSync('execution-reporting.js', 'utf8');
        expect((src.match(/\(d\.hydratedProgress \|\| \[\]\)\.filter\(wasAssessed\)\.forEach/g) || []).length).toBe(2);
        expect(src).not.toContain('Total Items Audited');
        expect(src).toContain("'Checklist Items: ' + c.total + ' | Assessed: ' + c.assessed");
        expect(src).toContain('Items Assessed: ${assessedCounts(d).assessed} of ${d.stats.totalItems}');
    });
});

describe('5 and 6. small print defects', () => {
    it('the distribution list is sanitized inside a table, and used only if it is still rows', () => {
        const src = fs.readFileSync('execution-reporting.js', 'utf8');
        expect(src).toContain("window.Sanitizer.sanitizeHTML('<table><tbody>' + editedDistribution + '</tbody></table>'");
        expect(src).toContain("ALLOWED_TAGS: ['table', 'tbody', 'tr', 'td', 'th', 'span', 'strong', 'em', 'b', 'i', 'br']");
        expect(src).toMatch(/\/<tr\[\\s>\]\/i\.test\(editedDistribution\)/);
    });

    it('a previous finding that is open says so once', () => {
        const src = fs.readFileSync('execution-reporting.js', 'utf8');
        expect(src).toContain("(raw.toLowerCase() === 'open' ? '' : ' (' + window.UTILS.escapeHtml(raw) + ')')");
    });

    it('the evidence traceability table decodes a stored entity in the auditor note and names the record as elsewhere', () => {
        const d = {
            report: REPORT, auditPlan: PLAN, cbSettings: {},
            hydratedProgress: [{ checklistId: 'cl1', itemIdx: 'A-0', clause: '8.2.2', status: 'nc', ncrType: 'minor', department: 'Service Desk', requirement: 'Verify the BIA is current. Documented information on file that should support this: BIA Procedure.', comment: 'Service Desk RTO 24 Hour &amp; RPO', evidenceImages: ['a'] }]
        };
        const sec = window.ReportFindingsOps.sections(d).find((s) => /Auditor Note/.test(s.bodyHtml || ''));
        expect(sec).toBeTruthy();
        expect(sec.bodyHtml).toContain('Service Desk RTO 24 Hour &amp; RPO');      // escaped once
        expect(sec.bodyHtml).not.toContain('&amp;amp;');
        expect(sec.bodyHtml).not.toContain('Documented information on file');
        const src = fs.readFileSync('report-findings-ops.js', 'utf8');
        expect((src.match(/'NCR-' \+ String\(r\.capa\.id\)\.padStart\(3, '0'\)/g) || []).length).toBe(2);
    });
});
