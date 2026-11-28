// Two exports of one checklist: the internal Auditor Checklist and the Client
// Preparation Checklist. The review of the PC Connection recertification
// checklist found page 1 carried Audit360's own validation and coverage
// diagnostics — content for the audit team, not for the client. The client
// copy is built from the same stored questions, by fixed rules, with none of it.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildScenario, M } from '../tools/pcc-scenario.mjs';

const { DF, CD, PS, CS } = M;
const BRAND = { primary: '#0f2a43', dark: '#0a1c2e', deep: '#16324d', text: '#0f2a43', tint: '#eaf0f6', tintBorder: '#b8c9db' };
let s;
let auditorHtml;
let clientHtml;
const ctx = (extra) => Object.assign({ brand: BRAND, cbName: 'Company Certification International', plan: s.plan, client: s.client,
    siblings: s.state.checklists, qa: s.qa, coverage: s.coverage, combined: s.combined, generatedOn: '2026-10-20' }, extra || {});

beforeAll(async () => {
    s = await buildScenario();
    auditorHtml = CD.build(s.checklist, ctx());
    // qa / coverage / combined are passed on purpose: the client copy must
    // ignore them, not merely be built without them.
    clientHtml = CD.build(s.checklist, ctx({ audience: 'client' }));
});
const clientText = () => DF.renderedText(clientHtml);

describe('Auditor Checklist (internal) — unchanged', () => {
    it('is the default audience and identical to audience "auditor"', () => {
        expect(CD.build(s.checklist, ctx({ audience: 'auditor' }))).toBe(auditorHtml);
        expect(CD.AUDIENCES).toEqual(['auditor', 'client']);
    });
    it('still carries the validation banner, the coverage panel and the auditor columns', () => {
        const text = DF.renderedText(auditorHtml);
        expect(auditorHtml).toContain('class="qa-panel');
        expect(text).toContain('Checklist validation status');
        expect(text).toContain('Recertification coverage validation');
        expect(text).toContain('Inherited from cycle');
        expect(text).toContain('Auditor comments / evidence');
        expect(text).toContain('Item status: Not Checked');
        expect(text).toContain('Lead Auditor Signature');
        expect(text).toMatch(/Sample A\.5\.\d+/);
        expect(text).toContain('Record the evidence seen against each control reference separately.');
    });
});

describe('Client Preparation Checklist — no internal Audit360 diagnostics', () => {
    const FORBIDDEN = [
        'qa-panel', 'qa-tag', 'cov-table',
        'Checklist validation', 'QA validation', 'Coverage validation', 'Recertification coverage validation',
        'coverage could not be assessed', 'Planned this audit', 'Inherited from cycle', 'Remaining',
        'Certification cycle', 'prior audit(s) on file', 'Integrated view', 'Dispositioned by the auditor',
        'SoA supplied', 'SoA document on file', 'Statement of Applicability — applicable controls',
        'Document Intelligence', 'not yet mapped to a requirement', 'document(s) on file', 'For awareness only',
        'No validated supporting document mapped', 'auditor to select or confirm',
        'controls sampled of', 'prioritised for this scope', 'Knowledge Base', 'For Auditor Review',
        'Not Checked', 'Item status', 'Auditor comments', 'Lead Auditor Signature', 'Checklist status'
    ];
    it.each(FORBIDDEN)('does not contain "%s"', (needle) => {
        expect(clientHtml).not.toContain(needle);
    });
    it('carries no document-search statistics', () => {
        expect(clientText()).not.toMatch(/\b\d+\s+documents?\b(?! on file\b)/i);
        expect(clientText()).not.toMatch(/\bdocuments? (?:searched|scanned|read|found)\b/i);
    });
    it('carries no SoA upload or field-mapping instructions', () => {
        expect(clientText()).not.toMatch(/upload|paste the control|field[- ]mapping|map(?:ped)? to (?:a|the) field/i);
    });
    it('rewords the auditor instructions as what to prepare', () => {
        const text = clientText();
        expect(text).not.toMatch(/(?:^|[.:;—]\s)(?:Verify|Confirm|Sample|Probe|Interview|Record|Note whether|Examine|Obtain)\b/);
        expect(text).not.toContain('Record the evidence seen');
        expect(text).not.toContain('Sample two internal audit reports');
        expect(text).toContain('Make available two internal audit reports.');
        expect(text).toContain('Be prepared to trace one decision through to implementation.');
    });
    it('states the sampling approach in one neutral sentence', () => {
        expect(clientText()).toContain('Records and Annex A controls are examined on a sample basis; the audit team may select other examples on the day.');
        expect(clientText()).not.toMatch(/risk-based/i);
    });
    it('passes the print lint', () => {
        expect(PS.lint(clientHtml)).toEqual([]);
    });
});

describe('Client Preparation Checklist — what it does contain', () => {
    it('is titled and labelled as the client copy, for the scheduled audit', () => {
        const text = clientText();
        expect(text).toContain('Audit Preparation Checklist');
        expect(text).toContain('Scheduled audit: 3–5 November 2026');
        expect(text).toContain('Issued: 20 October 2026');
    });
    it('lists the audit areas', () => {
        const text = clientText();
        expect(text).toContain('Area 1');
        expect(text).toContain('Recertification Priorities');
        expect(text).toContain('Certified Scope, Sites and Key Processes');
        expect(text).toContain('ISO/IEC 27001:2022 Annex A — selected controls');
    });
    it('cites each standard against its own clause', () => {
        expect(clientText()).toContain('ISO/IEC 27001:2022 9.2 / ISO 22301:2019 9.2 / ISO/IEC 20000-1:2018 9.2');
        expect(clientText()).toContain('ISO/IEC 27001:2022 10.2 / ISO 22301:2019 10.1 / ISO/IEC 20000-1:2018 10.1');
    });
    it('names the client’s own documents in their own column', () => {
        expect(clientHtml).toMatch(/<ul class="prep-docs"><li>Internal Audit Procedure for ISO 20000-1 \(IT Service Management\) \(ITSM-PRC-009\)<\/li><\/ul>/);
    });
    it('keeps the process-specific requirements', () => {
        const text = clientText();
        expect(text).toContain('Service Desk Operations');
        expect(text).toContain('Be prepared to walk through the Service Desk Operations process end to end');
        expect(text).toContain('Make available a sample of changes including at least one emergency change');
    });
    it('lists each sampled Annex A control by name, with one neutral preparation line', () => {
        const text = clientText();
        expect(text).toContain('A.5.35 Independent review of information security');
        expect(text).toContain('Have evidence available that each control listed is implemented and operating as described in your Statement of Applicability.');
    });
});

describe('Client Preparation Checklist — same data, nothing added', () => {
    it('has one row per auditor question, and no more', () => {
        const rows = CD.clientItems(s.checklist).filter(r => !r.isHeader);
        expect(rows.length).toBe(CD.itemCount(s.checklist));
        expect((clientHtml.match(/<tr class="item">/g) || []).length).toBe(rows.length);
    });
    it('names only documents the stored questions already name', () => {
        const stored = s.checklist.clauses.flatMap(c => c.subClauses).map(x => x.requirement).join('\n');
        CD.clientItems(s.checklist).filter(r => !r.isHeader).forEach(r => {
            r.documents.forEach(d => expect(stored).toContain(d));
        });
    });
    it('does not change the stored checklist', () => {
        const before = JSON.stringify(s.checklist);
        CD.build(s.checklist, ctx({ audience: 'client' }));
        expect(JSON.stringify(s.checklist)).toBe(before);
        expect(CD.fingerprint(s.checklist)).toBe(CD.fingerprint(JSON.parse(before)));
    });
    it('leaves out the Auditor Review and Document Intelligence sections', () => {
        const ck = JSON.parse(JSON.stringify(s.checklist));
        ck.clauses.push({ mainClause: 'REVIEW', title: 'For Auditor Review — no defensible clause mapping established',
            subClauses: [{ clause: 'REVIEW', title: 'Standard not held in the clause registry', requirement: 'The engagement names ISO 99999.', criterionSource: 'auditor-review', auditorReview: true }] });
        const html = CD.build(ck, ctx({ audience: 'client' }));
        expect(html).not.toContain('ISO 99999');
        expect(html).not.toContain('Document Intelligence');
    });
});

describe('the rewording rules', () => {
    it.each([
        ['Verify the policy is communicated.', 'Be prepared to show the policy is communicated.'],
        ['Confirm that records are retained.', 'Be prepared to show that records are retained.'],
        ['Establish what has changed since the previous audit.', 'Be prepared to explain what has changed since the previous audit.'],
        ['Sample two internal audit reports for depth of evidence.', 'Make available two internal audit reports.'],
        ['Sample incidents across the period: verify recording and closure.', 'Make available a sample of incidents across the period: show recording and closure.'],
        ['Review the objectives set for the QMS.', 'Make available the objectives set for the QMS.'],
        ['Interview top management to establish how they demonstrate commitment.', 'Arrange for top management to be available to explain how they demonstrate commitment.'],
        ['Verify handling against the organisation’s own procedure.', 'Be prepared to show handling against your own procedure.'],
        ['Does the organization retain records of training?', 'Does your organization retain records of training?']
    ])('%s', (input, out) => {
        expect(CD.clientSentence(input)).toBe(out);
    });
    it.each([
        'Record the evidence seen against each control reference separately.',
        'Note any control marked applicable but not evidenced.',
        'Awareness is evidenced by what people can tell you, not by an attendance sheet.',
        'Probe an activity near the edge and establish which system owns it.',
        'Extend the sample only if a weakness is found.'
    ])('drops the auditor-only sentence: %s', (input) => {
        expect(CD.clientSentence(input)).toBe('');
    });
    it('moves the document hint into the documents list and strips the builder note', () => {
        const r = CD.clientPrepare('Verify the BIA is current. Documented information on file that should support this: BIA Procedure (BCMP-002); BIA Register (Rev 3.0).');
        expect(r.prepare).toBe('Be prepared to show the BIA is current.');
        expect(r.documents).toEqual(['BIA Procedure (BCMP-002)', 'BIA Register (Rev 3.0)']);
        expect(CD.clientPrepare('Verify X is done. No validated supporting document mapped — auditor to select or confirm the document.').prepare)
            .toBe('Be prepared to show X is done.');
    });
    it('rewrites every registry prompt without leaving an auditor instruction or an empty row', () => {
        const prompts = [];
        Object.values(CS.SHARED_PROMPT).forEach(t => prompts.push(t.replace(/\{systems\}/g, 'the QMS')));
        CS.RECERT_PRIORITIES.forEach(p => prompts.push(p.prompt));
        CS.all().forEach(std => CS.themesFor([std.id]).forEach(t => prompts.push(t.prompt)));
        expect(prompts.length).toBeGreaterThan(60);
        prompts.forEach(p => {
            const out = CD.clientPrepare(p).prepare;
            expect(out, p).not.toBe('');
            expect(out, p).not.toMatch(/(?:^|[.:;,—]\s|\b(?:and|then)\s)(?:verify|confirm|sample(?! of)|probe|interview|record|examine|obtain|establish|check)\b/i);
            expect(out, p).not.toMatch(/\byou\b/i);
        });
    });
});

describe('Client Preparation Checklist — other checklist shapes', () => {
    it('prints a flat legacy checklist', () => {
        const html = CD.build({ id: 'x', name: 'Legacy', clientName: 'Acme Ltd', standard: 'ISO 9001:2015',
            items: [{ clause: '6.3', requirement: 'Verify changes to the QMS are planned.' }] }, { brand: BRAND, audience: 'client', generatedOn: '2026-10-20' });
        const text = DF.renderedText(html);
        expect(text).toContain('Be prepared to show changes to the QMS are planned.');
        expect(text).toContain('Scheduled audit: Not yet scheduled');
        expect(html).not.toContain('qa-panel');
        expect(PS.lint(html)).toEqual([]);
    });
    it('quotes a Stage 1 focus point and asks how it was addressed', () => {
        const ck = { id: 'f', clientName: 'Acme Ltd', standard: 'ISO 9001:2015', clauses: [{ mainClause: 'FOCUS', title: 'Audit Focus — carried over from the Stage 1 document review',
            subClauses: [{ clause: 'FOCUS.1', title: 'Stage 1 finding', requirement: 'Supplier evaluation records were incomplete.', criterionSource: 'focus-carryover', auditorReview: true, items: [{ clause: 'FOCUS.1', requirement: 'Supplier evaluation records were incomplete.' }] }] }] };
        const rows = CD.clientItems(ck);
        expect(rows[1].clause).toBe('');
        expect(rows[1].prepare).toBe('Point carried over from the Stage 1 document review: “Supplier evaluation records were incomplete.” Be prepared to show how it has been addressed.');
    });
});
