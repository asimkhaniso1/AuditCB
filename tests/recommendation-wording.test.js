// Recommendation wording on surveillance and recertification reports.
//
// The auditor's radio records a DECISION ("Recommended"). The client PDF
// printed that code as-is, so PC Connection's February 2026 surveillance report
// read "Certification Recommendation: Recommended", and Report Integrity warned
// (W8) that it did not match the surveillance wording "Continued certification
// is recommended subject to satisfactory closure of applicable
// nonconformities." The decision now drives the badge colour and the audit
// type's own wording is what is printed.
import { describe, it, expect } from 'vitest';
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
const resolveRecommendation = window.ReportStats.resolveRecommendation;

describe('every printed recommendation goes through the resolver', () => {
    it('prints rec.wording, never the bare decision code', () => {
        const src = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
        expect(src).not.toMatch(/'">' \+ rec\.primary \+ '</);
        expect(src).not.toMatch(/'\s*\+\s*rec\.primary\s*\+\s*'<\/div>/);
        expect(src.match(/rec\.wording/g).length).toBe(3);
    });
});

const SURV = 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.';

describe('resolveRecommendation — the decision is printed in the audit type\'s words', () => {
    it('prints a "Recommended" decision as the surveillance sentence, and keeps the decision for colour', () => {
        const rec = resolveRecommendation({ recommendation: 'Recommended' }, { rs: { recommendation: SURV } });
        expect(rec.primary).toBe('Recommended');
        expect(rec.wording).toBe(SURV);
        expect(rec.showAutoCaption).toBe(false);
    });

    it('reads the derived sentence from stats.recommendation too', () => {
        expect(resolveRecommendation({ recommendation: 'Recommended' }, { recommendation: SURV }).wording).toBe(SURV);
    });

    it('never rewords a Pending or Not Recommended decision', () => {
        const pending = resolveRecommendation({ recommendation: 'Pending' }, { rs: { recommendation: SURV } });
        expect(pending.wording).toBe('Pending');
        expect(pending.showAutoCaption).toBe(true);
        expect(resolveRecommendation({ recommendation: 'Not Recommended' }, { rs: { recommendation: SURV } }).wording).toBe('Not Recommended');
    });

    it('falls back to the derived sentence when no decision is recorded', () => {
        const rec = resolveRecommendation({}, { rs: { recommendation: SURV } });
        expect([rec.primary, rec.wording, rec.isManual]).toEqual([SURV, SURV, false]);
    });
});

describe('Report Integrity W8 — no warning once the printed wording matches', () => {
    const w8 = (auditType) => {
        const report = { id: 'r', planId: 'p', clientId: 'c', date: '2026-02-17', auditType, recommendation: 'Recommended',
            checklistProgress: [{ status: 'nc', ncrType: 'minor', clause: '7.5', comment: 'Document change control not followed.' }] };
        const auditPlan = { id: 'p', clientId: 'c', auditType, auditMethod: 'Remote' };
        const result = window.ReportIntegrity.check({ report, auditPlan, client: { id: 'c', name: 'PC CONNECTION, INC.' } });
        return result.warnings.filter((w) => w.id === 'W8');
    };

    it('does not warn on a surveillance report recommended by the radio', () => {
        expect(w8('Surveillance')).toEqual([]);
    });

    it('does not warn on a recertification report either', () => {
        expect(w8('Recertification')).toEqual([]);
    });
});
