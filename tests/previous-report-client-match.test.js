// Previous findings come from THIS client's previous report.
//
// PC Connection's 2026 recertification draft listed NCR-080 to NCR-083 as its
// previous findings. They were KTD Select's: the Previous Findings tables
// matched `r.clientId === report.clientId`, and none of the three reports
// carried a clientId, so undefined === undefined made KTD Select's August audit
// "the previous report". The programme, which demanded a clientId, ignored PC
// Connection's own finalized February surveillance and printed Surveillance 2
// as the calendar's "Dec 2025".
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
window.CONSTANTS = { STATUS: { FINALIZED: 'Finalized' } };
loadScript('./report-stats.js', { params: { module: undefined } });
loadScript('./data-service.js', { params: { module: undefined } });
loadScript('./report-executive.js', { params: { module: undefined } });
loadScript('./report-integrity.js', { params: { module: undefined } });
const RS = window.ReportStats;

const PCC = { id: 'ca1e77a0', name: 'PC CONNECTION, INC.',
    certificates: [{ standard: 'ISO 27001:2022', status: 'Active', initialDate: '2020-12-16', currentIssue: '2025-12-16', expiryDate: '2026-12-15' }] };
// Reports as they are in the field: no clientId.
const FEB = { id: 'feb', planId: 'plan-feb', client: 'PC CONNECTION, INC.', date: '2026-02-17', auditType: 'Surveillance',
    standard: 'ISO 27001:2022, ISO 22301:2019, ISO 20000-1:2018', status: 'Finalized', reportStatus: 'final' };
const KTD = { id: 'ktd', planId: 'plan-ktd', client: 'KTD Select', date: '2026-08-14', auditType: 'Surveillance',
    standard: 'ISO 9001:2015', status: 'Finalized', reportStatus: 'final' };
const RECERT = { id: 'recert', planId: 'plan-recert', client: 'PC CONNECTION, INC.', date: '2026-11-17', auditType: 'Recertification',
    standard: 'ISO 20000-1:2018, ISO 27001:2022, ISO 22301:2019', status: 'In Progress', reportStatus: 'draft' };
const ALL = [FEB, KTD, RECERT];

describe('ReportStats.previousReport', () => {
    it('finds PC Connection\'s February report, not KTD Select\'s later one', () => {
        expect(RS.previousReport({ report: RECERT, client: PCC, allReports: ALL })).toBe(FEB);
    });

    it('decides by id when both sides carry one, and by name otherwise', () => {
        const otherWithId = Object.assign({}, KTD, { clientId: 'ktd-1', client: 'PC CONNECTION, INC.' });
        const recertWithId = Object.assign({}, RECERT, { clientId: 'ca1e77a0' });
        expect(RS.previousReport({ report: recertWithId, client: PCC, allReports: [FEB, otherWithId, recertWithId] })).toBe(FEB);
        const pcc = Object.assign({}, FEB, { client: 'PC Connection Inc' });
        expect(RS.previousReport({ report: RECERT, client: PCC, allReports: [pcc, KTD, RECERT] })).toBe(pcc);
    });

    it('takes only finalized reports dated before this one, never another report of the same plan', () => {
        const draftEarlier = Object.assign({}, FEB, { id: 'draft', reportStatus: 'draft', status: 'In Progress' });
        const sameDayRedo = Object.assign({}, FEB, { id: 'redo', planId: 'plan-recert', date: '2026-11-17' });
        expect(RS.previousReport({ report: RECERT, client: PCC, allReports: [draftEarlier, sameDayRedo, RECERT] })).toBeNull();
    });

    it('attributes a report naming no client to nobody', () => {
        expect(RS.previousReport({ report: { id: 'x', date: '2026-11-17' }, client: {}, allReports: ALL })).toBeNull();
    });
});

describe('the report code uses it everywhere', () => {
    const src = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
    it('has no id-only previous-report match left', () => {
        expect(src).not.toMatch(/r\.clientId === d\.report\.clientId/);
        expect(src.match(/findPreviousReport\(d\)/g)).toHaveLength(3);
    });
});

describe('the programme counts the client\'s own surveillance', () => {
    it('puts the February 2026 audit in Surveillance 2 of the Dec 2023 – Dec 2026 cycle', () => {
        const p = RS.buildProgramme({ client: PCC, auditPlan: { id: 'plan-recert', auditType: 'Recertification' }, report: RECERT, allReports: ALL });
        const byId = Object.fromEntries(p.stages.map((s) => [s.id, s]));
        expect([byId.sv2.timing, byId.sv2.status, byId.sv2.source]).toEqual(['Feb 2026', 'Completed', 'history']);
        expect(byId.sv1.source).not.toBe('history');
        expect(byId.recert.status).toBe('This audit');
        expect(p.issues).toEqual([]);
    });
});

describe('Report Integrity B33 — another client\'s NCR in the narrative', () => {
    beforeEach(() => {
        window.state.auditReports = ALL;
        window.state.ncrs = [
            { id: 80, clientId: 'ktd-1', clientName: 'KTD Select', auditId: 'plan-ktd', clause: 'FOCUS.2', severity: 'minor', status: 'Open' },
            { id: 85, clientId: 'ca1e77a0', clientName: 'PC CONNECTION, INC.', auditId: 'plan-feb', clause: '7.5 (Integrated)', severity: 'minor', status: 'Open' }
        ];
    });
    const run = (text) => window.ReportIntegrity.check({ report: Object.assign({}, RECERT, { previousFindingsStatus: text }), client: PCC,
        auditPlan: { id: 'plan-recert', auditType: 'Recertification', auditMethod: 'Remote' } }).blockers.filter((b) => /^B33/.test(b.id));

    it('blocks KTD Select\'s NCR-080 in PC Connection\'s previous findings', () => {
        const b = run('The nonconformities from previous audits remain open: NCR-080 (clause 9.2) and NCR-085 (clause 7.5).');
        expect(b).toHaveLength(1);
        expect(b[0].message).toMatch(/cites NCR-080, which is a nonconformity of another client \(KTD Select\)/);
    });

    it('passes the client\'s own NCR', () => {
        expect(run('NCR-085 (clause 7.5) remains open.')).toEqual([]);
    });
});

describe('Key Strengths wording', () => {
    // Technical review, 28 Nov 2026: no conformity percentage at all.
    it('prints no conformity percentage', () => {
        const src = fs.readFileSync(path.resolve('./report-executive.js'), 'utf8');
        expect(src).not.toMatch(/% of applicable items conforming/);
        expect(src).not.toMatch(/% of assessed items without a nonconformity/);
    });
});
