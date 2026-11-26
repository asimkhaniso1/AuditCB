// PC Connection's report exported 26 Nov 2026:
//  - NCR-092's CAR printed "Due Feb 15, 2027" (the item's automatic default)
//    while the register, and the closing meeting, said 11 Dec 2026;
//  - a long CAR ran Part C onto a page of its own;
//  - the lead auditor's signature printed twice (bare line after the
//    conclusion, and in Signature and Attestation);
//  - the Distribution List table moved off its heading;
//  - one tall Audit Trails row left that section's heading alone on a page.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
const EXEC = fs.readFileSync(path.resolve('./report-executive.js'), 'utf8');

function item(idx, clause, extra) {
    return Object.assign({
        checklistId: 'cl1', itemIdx: idx, status: 'nc', ncrType: 'minor', clause,
        requirement: 'Requirement for ' + clause, ncrDescription: 'Statement for ' + clause,
        comment: 'Evidence for ' + clause, caDueDate: '2027-02-15'
    }, extra || {});
}

function carHtml(items, ncrs) {
    const d = {
        report: { id: 'r1', planId: 'plan-1', client: 'PC', leadAuditor: 'Lead', date: '2026-11-17', closingMeeting: { date: '2026-11-19' }, checklistProgress: items },
        hydratedProgress: items, auditPlan: { id: 'plan-1' }, cbSettings: { cbName: 'CB' }
    };
    window.state = { ncrs: ncrs || [], auditReports: [d.report] };
    const host = document.createElement('div');
    host.innerHTML = window.ReportFindingsOps.sections(d).find((s) => s.key === 'carForms').bodyHtml;
    return host;
}

beforeAll(() => {
    window.Logger = { debug() {}, info() {}, warn() {}, error() {} };
    loadScript('./utils.js', { global: true });
    loadScript('./report-stats.js', { global: true });
    loadScript('./report-findings-ops.js', { global: true });
});

describe('CAR forms', () => {
    it('print the register due date, not the item default', () => {
        const host = carHtml([item('RECERT-0', '10.2')], [
            { id: 92, auditId: 'plan-1', sourceChecklistId: 'cl1', sourceItemIdx: 'RECERT-0', clause: '10.2', status: 'Open', dueDate: '2026-12-11' }
        ]);
        const text = host.textContent;
        expect(text).toMatch(/Due (Dec 11, 2026|11 Dec(ember)? 2026|2026-12-11)/);
        expect(text).not.toMatch(/2027/);
    });

    it('fall back to the item date when there is no register record', () => {
        expect(carHtml([item('A-0', '9.2')]).textContent).toMatch(/2027/);
    });

    it('set a long Part A in compact type, and leave a short one as it was', () => {
        const long = 'x'.repeat(700);
        const dense = carHtml([item('A-0', '9.2', { ncrDescription: long, comment: long })]);
        expect(dense.querySelector('table.car-dense')).not.toBeNull();
        expect(carHtml([item('A-0', '9.2')]).querySelector('table.car-dense')).toBeNull();
        expect(EXEC).toMatch(/\.b4-tbl--compact\.car-dense td \{[^}]*font-size: 8pt/);
    });
});

describe('report print layout', () => {
    it('prints the lead auditor signature once when Signature and Attestation is included', () => {
        expect(SRC).toMatch(/const showLeadSig = !secMap\['signature'\];\s*\n\s*if \(!showLeadSig && !showClientSig\) return '';/);
    });

    it('keeps the Distribution List heading and table together', () => {
        expect(SRC).toMatch(/<div class="keep-whole" style="break-inside:avoid;page-break-inside:avoid;"><div id="sec-distribution"/);
    });

    it('lets Audit Trails rows split across pages', () => {
        expect(SRC).toContain('<table class="f-tbl at-tbl"><thead>');
        expect(SRC).toContain('.f-tbl.at-tbl tbody tr{break-inside:auto;page-break-inside:auto;}');
    });
});
