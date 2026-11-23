// Annex C CAR forms, PC Connection 23 Nov 2026: each form ran a few lines over
// one A4 page, so its signature row printed alone on the next page (four
// near-empty pages), and a page break before the first form left the
// "Annex C" heading alone on a page. Rendered with headless Chrome, the
// tighter form gains about 15-20 mm per page.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

function item(idx, clause) {
    return {
        checklistId: 'cl1', itemIdx: idx, status: 'nc', ncrType: 'minor', clause,
        requirement: 'Requirement for ' + clause, ncrDescription: 'Statement for ' + clause,
        comment: 'Evidence for ' + clause, caDueDate: '2027-02-15'
    };
}

let html;
beforeAll(() => {
    window.Logger = { debug() {}, info() {}, warn() {}, error() {} };
    loadScript('./utils.js', { global: true });
    loadScript('./report-stats.js', { global: true });
    loadScript('./report-findings-ops.js', { global: true });
    const items = [item('A-0', '9.2'), item('A-1', '4.4'), item('A-2', '7.5.3')];
    const d = {
        report: { id: 'r1', client: 'PC', leadAuditor: 'Lead', date: '2026-11-17', closingMeeting: { date: '2026-11-19' }, checklistProgress: items },
        hydratedProgress: items, auditPlan: {}, cbSettings: { cbName: 'CB' }
    };
    window.state = { ncrs: [], auditReports: [d.report] };
    html = window.ReportFindingsOps.sections(d).find((s) => s.key === 'carForms').bodyHtml;
});

describe('Annex C CAR forms print one per page', () => {
    const forms = () => {
        const host = document.createElement('div');
        host.innerHTML = html;
        return Array.from(host.children);
    };

    it('the first form follows the Annex C heading; every later form starts a new page', () => {
        const f = forms();
        expect(f).toHaveLength(3);
        expect(f[0].getAttribute('style') || '').not.toMatch(/break-before/);
        expect(f[1].getAttribute('style')).toMatch(/break-before:page/);
        expect(f[2].getAttribute('style')).toMatch(/break-before:page/);
    });

    it('keeps Part C and the signature row together, so the signatures never print alone', () => {
        const f = forms()[0];
        const partC = Array.from(f.querySelectorAll('h4')).find((h) => /PART C/.test(h.textContent)).parentElement;
        expect(partC.getAttribute('style')).toMatch(/break-inside:avoid/);
        expect(partC.textContent).toContain('Auditee Representative');
        expect(partC.textContent).toContain('Lead Auditor');
    });

    it('uses two ruled lines per blank Part B box (was three)', () => {
        const f = forms()[0];
        const box = Array.from(f.querySelectorAll('div')).find((dv) => dv.children.length === 0 && dv.textContent === 'Root Cause');
        const lines = Array.from(box.parentElement.children).slice(1);
        expect(lines).toHaveLength(2);
    });
});
