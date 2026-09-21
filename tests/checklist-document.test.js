import { describe, it, expect, beforeAll } from 'vitest';
import { buildScenario, M, TODAY, B } from '../tools/pcc-scenario.mjs';
import { CERT_SCOPE } from './fixtures/pcc-connection.mjs';

const { DF, CD, PS, CC } = M;
let s;
beforeAll(async () => { s = await buildScenario(); });
const text = () => DF.renderedText(s.checklistHtml);

describe('the checklist states the SCHEDULED audit, not the day it was printed', () => {
    it('shows the scheduled audit as 3–5 November 2026', () => {
        expect(text()).toContain('Scheduled audit: 3–5 November 2026');
    });
    it('shows the generation date separately, and labelled as such', () => {
        expect(text()).toContain('Checklist generated: 21 September 2026');
        expect(TODAY).toBe('2026-09-21');
    });
    it('never labels the generation date as the audit date', () => {
        expect(text()).not.toMatch(/Audit date:\s*21 Sep/i);
        expect(text()).not.toMatch(/\bDate:\s*21/i);
    });
    it('says so when the audit is not scheduled, rather than substituting today', () => {
        const html = CD.build(s.checklist, { brand: {}, plan: null, client: s.client, siblings: [s.checklist], brandless: true, ...brandCtx() });
        expect(DF.renderedText(html)).toContain('Scheduled audit: Not yet scheduled');
        expect(DF.renderedText(html)).not.toMatch(/Scheduled audit:\s*21 September/);
    });
    it('is not moved by the print date: the same checklist printed on any day reads the same', () => {
        const a = CD.build(s.checklist, Object.assign(brandCtx(), { plan: s.plan, client: s.client }));
        const b = CD.build(s.checklist, Object.assign(brandCtx(), { plan: s.plan, client: s.client, generatedOn: '2030-01-01' }));
        expect(DF.renderedText(a)).toContain('Scheduled audit: 3–5 November 2026');
        expect(DF.renderedText(b)).toContain('Scheduled audit: 3–5 November 2026');
        expect(DF.renderedText(b)).toContain('Checklist generated: 21 September 2026'); // the checklist's own date, not the print date
    });
});

describe('the certified-scope question compares against the certificate itself', () => {
    it('prints the certificate wording verbatim on the scope question', () => {
        expect(text()).toContain('The certificate reads: “' + CERT_SCOPE + '”');
    });
    it('shows every variant when the certificates disagree, rather than choosing one', () => {
        const c2 = JSON.parse(JSON.stringify(s.client));
        c2.certificates[1].scope += ' Also managed services.';
        const ck = B.buildClientChecklist(c2, s.docs, { auditType: 'recertification', standard: s.plan.standard, manDays: 3 });
        const q = ck.clauses.flatMap(c => c.subClauses).find(x => x.title === 'Certified scope against the certificate');
        expect(q.requirement).toMatch(/The certificates carry 2 different wordings: \(1\) “This certification.*\(2\) “This certification.*Also managed services\./);
    });
});

describe('lifecycle and item status', () => {
    it('a pre-audit checklist reads "Prepared — audit not started" with every item "Not Checked"', () => {
        expect(text()).toContain('Checklist status: Prepared — audit not started');
        expect(text()).toContain('Item status: Not Checked');
        const rows = (s.checklistHtml.match(/<tr class="item[^"]*">/g) || []).length;
        const notChecked = (s.checklistHtml.match(/<td class="status-col">Not Checked<\/td>/g) || []).length;
        expect(rows).toBeGreaterThan(50);
        expect(notChecked).toBe(rows);
    });
    it('follows the audit’s own record once it starts', () => {
        expect(CD.lifecycle({ report: { status: 'In Progress', checklistProgress: [{ status: 'conform' }] } }).label).toBe('Audit in progress');
        expect(CD.lifecycle({ report: { status: 'Finalized', checklistProgress: [] } }).label).toBe('Audit completed');
        expect(CD.lifecycle({}).label).toBe('Prepared — audit not started');
    });
    it('lists the controlled statuses, with Not Applicable requiring a justification', () => {
        ['Conforming', 'Nonconforming', 'Observation', 'Opportunity for Improvement', 'Not Applicable (justification required)', 'Not Checked']
            .forEach(label => expect(text()).toContain(label));
    });
    it('rejects Not Applicable without a justification, and accepts it with one', () => {
        expect(CD.validateItemStatus('na', '')).toEqual({ ok: false, error: 'Not Applicable requires a justification.' });
        expect(CD.validateItemStatus('na', '   ')).toMatchObject({ ok: false });
        expect(CD.validateItemStatus('na', 'Site has no physical media')).toEqual({ ok: true, error: '' });
        expect(CD.validateItemStatus('conform', '').ok).toBe(true);
        expect(CD.validateItemStatus('Not Checked', '').ok).toBe(true);
        expect(CD.validateItemStatus('bogus', '').ok).toBe(false);
    });
});

describe('validation status is stated once and never contradicts itself', () => {
    it('prints the combined outcome, and "validated" only when coverage was assessed', () => {
        expect(text()).toContain('Passed with notes — coverage validated with identified limitations');
        expect(text()).not.toMatch(/Coverage could not be assessed/i);
    });
    it('a blocked checklist prints Blocked — and nothing that says validated', () => {
        const ck = Object.assign({}, s.checklist, { standardIds: [], qaContext: {}, standard: 'Custom', clauses: [] });
        const cov = CC.assess(ck, CC.buildContext(ck, { client: s.client }));
        const html = CD.build(ck, Object.assign(brandCtx(), { plan: s.plan, client: s.client, qa: s.qa, coverage: cov, combined: CC.combine(s.qa, cov) }));
        const t = DF.renderedText(html);
        expect(t).toContain('Blocked — coverage could not be assessed');
        expect(t).not.toMatch(/coverage validated/i);
        expect(t).toContain('internal error');
    });
    it('reports coverage per standard as planned, inherited and remaining', () => {
        ['Planned this audit', 'Inherited from cycle', 'Remaining', 'Integrated view'].forEach(h => expect(text()).toContain(h));
    });
});

describe('page furniture and text hygiene', () => {
    it('has a controlled header and footer: identification, client, reference, audit type, page X of Y', () => {
        const css = s.checklistHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
        expect(css).toContain('@top-left{content:"Company Certification International"');
        expect(css).toContain('@top-center{content:"PC CONNECTION, INC."');
        expect(css).toMatch(/@top-right\{content:"CHK-PCI-2026-01 · Recertification"/);
        expect(css).toContain('content:"Page " counter(page) " of " counter(pages)');
    });
    it('shows a confidentiality classification when one is configured', () => {
        const html = CD.build(s.checklist, Object.assign(brandCtx(), { plan: s.plan, client: s.client, classification: 'Confidential — Client Restricted' }));
        expect(html).toContain('@bottom-left{content:"Confidential — Client Restricted"');
    });
    it('carries no browser decoration, no static page number, no script', () => {
        expect(PS.lint(s.checklistHtml)).toEqual([]);
        expect(DF.findBrowserArtifacts(text())).toEqual([]);
        expect(s.checklistHtml).not.toMatch(/about:blank/);
        expect(s.checklistHtml).not.toMatch(/<script/i);
    });
    it('prints stored, HTML-escaped requirement text as text, never as "&amp;"', () => {
        const ck = JSON.parse(JSON.stringify(s.checklist));
        ck.clauses[0].subClauses[0].items[0].requirement = 'Verify Patch &amp; Vulnerability Management &amp;amp; Backup';
        ck.clauses[0].title = 'Recertification &amp; Priorities';
        const html = CD.build(ck, Object.assign(brandCtx(), { plan: s.plan, client: s.client, qa: s.qa, coverage: s.coverage, combined: s.combined }));
        const t = DF.renderedText(html);
        expect(t).toContain('Patch & Vulnerability Management & Backup');
        expect(t).toContain('Recertification & Priorities');
        expect(DF.findRawEntities(t)).toEqual([]);
    });
    it('shows every date in words', () => {
        expect(DF.findUnwrittenDates(text())).toEqual([]);
        expect(text()).toContain('Certification cycle 16 December 2022–15 December 2026');
    });
    it('compresses runs of clause references for the clause column only', () => {
        expect(CD.displayClause('A.5.24 / A.5.25 / A.5.26 / A.5.27 / A.6.8')).toBe('A.5.24–A.5.27 / A.6.8');
        expect(CD.displayClause('10.2 / 10.1')).toBe('10.2 / 10.1');       // different standards: order and meaning kept
        expect(CD.displayClause('RECERT')).toBe('RECERT');
        expect(CD.displayClause('9.6.2 (a)')).toBe('9.6.2 (a)');
    });
    it('keeps headings with their first item, and the sign-off with the last rows', () => {
        expect(s.checklistHtml).toContain('tr.section-header,tr.sub-header{break-after:avoid');
        expect(s.checklistHtml).toContain('<tr class="sign-row">');
        expect(s.checklistHtml).toContain('tr.keep-next{break-after:avoid');
    });
});

function brandCtx() {
    return { brand: { primary: '#0f2a43', dark: '#0a1c2e', deep: '#16324d', text: '#0f2a43', tint: '#eaf0f6', tintBorder: '#b8c9db' }, cbName: 'Company Certification International', siblings: [s.checklist] };
}
