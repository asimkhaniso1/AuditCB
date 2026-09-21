import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import { CLIENT, DOCS } from './fixtures/pcc-connection.mjs';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.state = window.state || {};
const SD = require('../supporting-docs.js');
const CS = require('../checklist-standards.js');
window.ChecklistStandards = CS;
window.SupportingDocs = SD;

const fs = await import('fs');
const path = await import('path');
eval(fs.readFileSync(path.resolve('./client-docs-bulk.js'), 'utf8'));
const B = window.ClientDocsBulk;

const ref = (stdId, r) => ({ stdId, ref: r });
const names = (res) => res.validated.map(v => v.doc.name);
const rank = (topic, refs) => SD.rank(DOCS, { topic, refs, client: CLIENT });

describe('the previous matcher really did recommend these documents (regression evidence)', () => {
    it('let a legacy supplier procedure tagged "8.4" cover three unrelated requirements', () => {
        const supplier = DOCS.find(d => /Supplier Management Procedure for ISO 27001/.test(d.name));
        expect(B.docCoversRef(supplier, 'iso22301', '8.4')).toBe(true);     // BC plans
        expect(B.docCoversRef(supplier, 'iso20000', '8.4.3')).toBe(true);   // capacity
        expect(B.docCoversRef(supplier, 'iso20000', '8.4.1')).toBe(true);   // budgeting
    });
});

describe('BIA', () => {
    it('is not evidenced by incident-management documents', () => {
        const r = rank('bcms-bia', [ref('iso22301', '8.2.2')]);
        expect(names(r).join(' ')).not.toMatch(/incident/i);
        expect(r.validated).toEqual([]);
    });
    it('is evidenced by a document that is about BIA methodology and stated for 22301', () => {
        const docs = DOCS.concat([{ id: 'bia', name: 'Business Impact Analysis Methodology', docNumber: 'BCMP-010', revision: 'Rev 2' }]);
        const r = SD.rank(docs, { topic: 'bcms-bia', refs: [ref('iso22301', '8.2.2')], client: CLIENT });
        expect(names(r)).toEqual(['Business Impact Analysis Methodology']);
    });
    it('says no validated document is mapped, and asks the auditor, rather than forcing one', () => {
        const text = SD.hint(DOCS, [ref('iso22301', '8.2.2')], { topic: 'bcms-bia', client: CLIENT });
        expect(text).toContain('No validated supporting document mapped');
        expect(text).toMatch(/auditor to select or confirm/i);
    });
});

describe('business continuity risk assessment', () => {
    it('does not borrow an ISMS or SMS risk procedure', () => {
        const r = rank('bcms-risk', [ref('iso22301', '8.2.3')]);
        expect(r.validated).toEqual([]);
        expect(r.rejected.some(x => /Risk Assessment Procedure for ISO 27001/.test(x.doc.name))).toBe(true);
    });
});

describe('business continuity plans', () => {
    it('are not evidenced by the ISO 27001 supplier procedure', () => {
        const r = rank('bcms-plans', [ref('iso22301', '8.4'), ref('iso22301', '8.4.2'), ref('iso22301', '8.4.3')]);
        expect(names(r).join(' ')).not.toMatch(/Supplier Management/);
        const rej = r.rejected.find(x => /Supplier Management Procedure for ISO 27001/.test(x.doc.name));
        expect(rej.reasons.join(' ')).toMatch(/not the requirement's subject|is not Business continuity plans|Its subject/i);
    });
});

describe('ISO 27001 risk assessment', () => {
    it('is evidenced by the ISO 27001 procedure and NOT by ISO 20000-1 procedures', () => {
        const r = rank('isms-risk', [ref('iso27001', '6.1.2'), ref('iso27001', '6.1.3'), ref('iso27001', '8.2'), ref('iso27001', '8.3')]);
        expect(names(r)).toEqual(['Risk Assessment Procedure for ISO 27001']);
        expect(r.rejected.some(x => /ISO 20000-1/.test(x.doc.name) && /Risk/.test(x.doc.name))).toBe(true);
    });
    it('does not pull in an unlabelled migration risk process', () => {
        const r = rank('isms-risk', [ref('iso27001', '6.1.2')]);
        const rej = r.rejected.find(x => /Migration Risk/.test(x.doc.name));
        expect(rej.reasons.join(' ')).toMatch(/States no applicable standard/);
    });
});

describe('Statement of Applicability', () => {
    it('is only ever evidenced by a document about the SoA', () => {
        const r = rank('isms-soa', [ref('iso27001', '6.1.3')]);
        expect(r.validated).toEqual([]);
        const docs = DOCS.concat([{ id: 'soa', name: 'Statement of Applicability', docNumber: 'ISMS-REC-001', revision: 'v4' }]);
        const r2 = SD.rank(docs, { topic: 'isms-soa', refs: [ref('iso27001', '6.1.3')], client: CLIENT });
        expect(names(r2)).toEqual(['Statement of Applicability']);
    });
});

describe('capacity and availability management', () => {
    it('are not evidenced by an ISO 27001 supplier procedure', () => {
        const r = rank('sms-capacity', [ref('iso20000', '8.4.3'), ref('iso20000', '8.7.1')]);
        expect(names(r).join(' ')).not.toMatch(/Supplier/);
        expect(SD.hint(DOCS, [ref('iso20000', '8.4.3')], { topic: 'sms-capacity', client: CLIENT }))
            .toContain('No validated supporting document mapped');
    });
    it('demand management and budgeting no longer name it either', () => {
        expect(names(rank('sms-demand', [ref('iso20000', '8.4.2')]))).toEqual([]);
        expect(names(rank('sms-budget', [ref('iso20000', '8.4.1')]))).toEqual([]);
    });
});

describe('supplier management', () => {
    it('ISMS supplier security is evidenced by the ISO 27001 procedure', () => {
        const r = rank('isms-supplier', [ref('iso27001', 'A.5.19'), ref('iso27001', 'A.5.20')]);
        expect(names(r)).toEqual(['Supplier Management Procedure for ISO 27001']);
    });
    it('ISO 20000-1 supplier management is NOT, without approved cross-standard applicability', () => {
        const r = rank('sms-supplier', [ref('iso20000', '8.3.4'), ref('iso20000', '8.2.3')]);
        expect(r.validated).toEqual([]);
        expect(r.rejected.find(x => /Supplier Management/.test(x.doc.name)).reasons.join(' ')).toMatch(/no approved cross-standard applicability/);
    });
    it('but IS, once its approved applicability explicitly names both standards', () => {
        const integrated = DOCS.map(d => /Supplier Management Procedure for ISO 27001/.test(d.name)
            ? Object.assign({}, d, { linkedStandards: 'iso27001, iso20000' }) : d);
        const r = SD.rank(integrated, { topic: 'sms-supplier', refs: [ref('iso20000', '8.3.4')], client: CLIENT });
        expect(names(r)).toEqual(['Supplier Management Procedure for ISO 27001']);
        expect(r.validated[0].via).toMatch(/integrated document/);
    });
});

describe('incident management', () => {
    it('ISO 20000-1 incidents use the client’s Incident Management process SOP', () => {
        const r = rank('sms-incident', [ref('iso20000', '8.6.1')]);
        expect(names(r)).toEqual(['Incident Management Process SOP']);
        expect(r.validated[0].via).toMatch(/client process SOP/);
    });
    it('information-security incidents use the security incident process, not the service one', () => {
        const r = rank('isms-incident', [ref('iso27001', 'A.5.24'), ref('iso27001', 'A.5.26')]);
        expect(names(r)).toContain('Security Incident Response Process');
        expect(names(r)).not.toContain('Incident Management Process SOP');
    });
});

describe('internal audit and management review', () => {
    it('internal audit: the ISO 20000-1 procedure is validated for 20000-1 only', () => {
        const refs = [ref('iso27001', '9.2'), ref('iso22301', '9.2'), ref('iso20000', '9.2')];
        const r = rank('performance.internal-audit', refs);
        expect(names(r)).toEqual(['Internal Audit Procedure for ISO 20000-1 (IT Service Management)']);
        // reports whose applicability is unstated are not assumed to apply
        expect(r.rejected.some(x => /2021 MSP- Azure Report/.test(x.doc.name))).toBe(true);
    });
    it('management review: same rule; unlabelled meeting minutes are not assumed', () => {
        const r = rank('performance.management-review', [ref('iso27001', '9.3'), ref('iso22301', '9.3'), ref('iso20000', '9.3')]);
        expect(names(r)).toEqual(['Management Review Procedure for ISO 20000-1 (IT Service Management)']);
        expect(r.rejected.some(x => /Meeting Mins/.test(x.doc.name))).toBe(true);
    });
    it('a 22301-only question is not given the 20000-1 procedure', () => {
        const r = rank('performance.management-review', [ref('iso22301', '9.3')]);
        expect(r.validated).toEqual([]);
    });
});

describe('document-level gates', () => {
    it('refuses templates, obsolete and draft documents', () => {
        const docs = [
            { id: 1, name: 'Business Impact Analysis Template', docNumber: 'BCMP-011' },
            { id: 2, name: 'Business Impact Analysis Methodology', docNumber: 'BCMP-010', status: 'Obsolete' },
            { id: 3, name: 'Business Impact Analysis Methodology v2', docNumber: 'BCMP-012', status: 'Draft' }
        ];
        const r = SD.rank(docs, { topic: 'bcms-bia', refs: [ref('iso22301', '8.2.2')] });
        expect(r.validated).toEqual([]);
        expect(r.rejected).toHaveLength(3);
    });
    it('text similarity ranks but never overrides a contradicting standard', () => {
        // the ISO 27001 procedure's title is nearly identical to the question text;
        // it is still refused for a 22301 question.
        const r = SD.rank(DOCS, { topic: 'bcms-risk', refs: [ref('iso22301', '8.2.3')], text: 'Risk Assessment Procedure for ISO 27001', client: CLIENT });
        expect(r.validated).toEqual([]);
    });
    it('gives no recommendation and no message when no document is expected (an interview question)', () => {
        expect(SD.hint(DOCS, [ref('iso27001', '5.1')], { topic: 'leadership.commitment', client: CLIENT })).toBe('');
    });
});

describe('the checklist generator applies it', () => {
    let checklist;
    beforeAll(() => {
        checklist = B.buildClientChecklist(CLIENT, DOCS, { auditType: 'recertification', standard: 'ISO/IEC 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018', manDays: 3 });
    });
    const q = (title) => checklist.clauses.flatMap(c => c.subClauses).find(s => s.title === title);

    it('BIA carries no incident-management document', () => {
        const item = q('Business impact analysis');
        expect(item.requirement).not.toMatch(/Incident Management Process SOP|Security Incident/);
        expect(item.requirement).toContain('No validated supporting document mapped');
    });
    it('continuity plans no longer cite the ISO 27001 supplier procedure', () => {
        expect(q('Business continuity plans and response structure').requirement).not.toMatch(/Supplier Management/);
    });
    it('capacity and availability no longer cite the ISO 27001 supplier procedure', () => {
        expect(q('Capacity and availability management').requirement).not.toMatch(/Supplier Management/);
    });
    it('ISO 27001 risk assessment cites the ISO 27001 procedure and no ISO 20000-1 procedure', () => {
        const item = q('Information security risk assessment and treatment');
        expect(item.requirement).toContain('Risk Assessment Procedure for ISO 27001');
        expect(item.requirement).not.toMatch(/for ISO 20000-1/);
    });
    it('no question anywhere pairs a document stated for one standard with another standard’s requirement', () => {
        const bad = [];
        checklist.clauses.flatMap(c => c.subClauses).forEach(s => {
            const m = s.requirement.match(/support this: ([^]*?)\.$/);
            if (!m) return;
            const stds = new Set((s.refs || []).map(r => r.stdId));
            m[1].split('; ').forEach(label => {
                const stated = /for ISO 27001|ISMS-/.test(label) ? 'iso27001' : /ISO 22301|BCMP-/.test(label) ? 'iso22301' : /ISO 20000|ITSM-/.test(label) ? 'iso20000' : null;
                if (stated && !stds.has(stated)) bad.push(`${s.clause}: ${label}`);
            });
        });
        expect(bad).toEqual([]);
    });
});
