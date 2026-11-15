// The Pre-Audit Review record prints in the same controlled layout as the audit
// plan and checklist (PrintShell + DocFormat), and its wording follows the audit
// type: only an initial certification is a "Stage 1" review deciding on "Stage 2".
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const DF = require('../doc-format.js');
globalThis.DocFormat = DF;
globalThis.PrintShell = require('../print-shell.js');
const PAD = require('../pre-audit-document.js');

const text = (html) => DF.renderedText(html).replace(/\s+/g, ' ');

const review = {
    status: 'Complete', completedDate: '2026-11-15', completedBy: 'Admin', readinessDecision: 'Ready',
    notes: 'Records available.\nSharePoint access confirmed.',
    documentReview: {
        scope: { status: 'ok', notes: 'Documents on file: IMS Manual (MNL)' },
        corrective_action: { status: 'minor', notes: 'Lack of <clear> CAPA records' },
        site_readiness: { status: 'major', notes: '' }
    },
    focusPoints: ['Verify the training project is complete']
};
const recert = {
    id: '936fa673-de93-4fa3-abe0-529eef8912b3', client: 'PC CONNECTION, INC.', type: 'Recertification', auditType: 'Recertification',
    auditMethod: 'Remote', standard: 'ISO 20000-1:2018, ISO 27001:2022, ISO 22301:2019',
    date: '2026-11-17', endDate: '2026-11-19', team: ['Muhammad Asim Khan'], preAudit: review
};
const stage1 = Object.assign({}, recert, { type: 'Stage 1', auditType: 'Stage 1', auditMethod: 'On-site' });
const ctx = { client: { name: 'PC CONNECTION, INC.' }, brand: { name: 'Company Certification International', logoUrl: 'https://example.com/logo.png' }, planRef: 'PLN-2026-014' };

describe('PreAuditDocument wording', () => {
    it('a recertification is not called Stage 1 or Stage 2 anywhere', () => {
        const html = PAD.build(recert, ctx);
        expect(text(html)).not.toMatch(/Stage\s*[12]/i);
        expect(text(html)).toContain('Pre-Audit Review Report');
        expect(text(html)).toContain('Recertification audit');
        expect(text(html)).toContain('Ready for the audit');
        expect(text(html)).not.toMatch(/on-site audit/i);
    });

    it('a remote audit reviews remote readiness, an on-site one the site', () => {
        expect(PAD.items(recert).find(i => i.id === 'site_readiness').label).toMatch(/Remote Audit Readiness/);
        expect(PAD.items(Object.assign({}, recert, { auditMethod: 'On-site' })).find(i => i.id === 'site_readiness').label).toBe('Site Readiness for the Audit');
    });

    it('an initial certification keeps the Stage 1 / Stage 2 wording', () => {
        const w = PAD.wording(stage1);
        expect(w.initial).toBe(true);
        expect(w.readyLabel).toBe('Ready for Stage 2');
        const html = PAD.build(stage1, ctx);
        expect(text(html)).toContain('Stage 1 Review Report');
        expect(PAD.items(stage1).find(i => i.id === 'site_readiness').label).toBe('Site Readiness for Stage 2 Audit');
    });

    it('keeps the 16 stored item ids', () => {
        expect(PAD.items(recert).map(i => i.id)).toEqual(['scope', 'processes', 'legal', 'objectives', 'resources', 'competence',
            'documented_info', 'internal_audit', 'management_review', 'corrective_action', 'risks_opportunities', 'monitoring',
            'context', 'leadership', 'communication', 'site_readiness']);
    });
});

describe('PreAuditDocument layout', () => {
    const html = PAD.build(recert, ctx);

    it('uses the shared print shell: page rules, running header and footer, masthead with the CB logo', () => {
        expect(html).toMatch(/@page\{size:A4/);
        expect(html).toContain('counter(page)');
        expect(html).toContain('class="pd-masthead"');
        expect(html).toContain('src="https://example.com/logo.png"');
        expect(html).toContain('Company Certification International');
        expect(html).toContain('Ref: PLN-2026-014');
    });

    it('passes the print lint (no numeric dates, inline scripts, flow footers or 100vh covers)', () => {
        expect(globalThis.PrintShell.lint(html)).toEqual([]);
        expect(html).not.toMatch(/font-awesome|linear-gradient|<script/i);
    });

    it('writes dates out and numbers its sections', () => {
        expect(text(html)).toContain(DF.formatDate('2026-11-15'));
        const titles = [...html.matchAll(/<div class="pd-section-title"><span class="no">\d+<\/span>([^<]+)<\/div>/g)].map(m => m[1]);
        expect(titles).toEqual(['READINESS DECISION', 'DOCUMENT REVIEW FINDINGS', 'REVIEW RESULTS']);
    });

    it('prints every item with its result and escaped notes', () => {
        const t = text(html);
        expect(t).toContain('16 items: 1 OK · 1 minor · 1 major · 13 not reviewed.');
        expect(html).toContain('Lack of &lt;clear&gt; CAPA records');
        expect(html).toContain('Records available.<br>SharePoint access confirmed.');
        PAD.items(recert).forEach(i => expect(t).toContain(i.label));
    });

    it('says when no summary was recorded', () => {
        const bare = Object.assign({}, recert, { preAudit: Object.assign({}, review, { notes: '' }) });
        expect(text(PAD.build(bare, ctx))).toContain('No summary or recommendations recorded.');
    });
});
