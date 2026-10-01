import { describe, it, expect } from 'vitest';
import { M } from '../tools/pcc-scenario.mjs';

// What the printed checklist leaves out, after the review of Language
// Services UK's surveillance checklist PDF:
//  - the QA issue list ("Identical to the question at 4.1" × 38) — internal;
//  - the Document Intelligence (DOCNOTE) section — "not an audit finding";
//  - preparation notes inside questions ("No validated supporting document
//    mapped — auditor to select or confirm the document.").
// It keeps the validation status line and the coverage panel, headed for the
// audit type, and a long section code ("ISO 18841:2018") wraps in its column
// instead of running into the title.
const { DF, CD, CC } = M;
const BRAND = { brand: { primary: '#0f2a43', dark: '#0a1c2e', deep: '#16324d', text: '#0f2a43', tint: '#eaf0f6', tintBorder: '#b8c9db' }, cbName: 'Company Certification Int.' };

const checklist = (auditType) => ({
    id: 'ck1', name: 'Language Services UK Limited - Surveillance Audit Checklist (Client-Specific)', clientName: 'Language Services UK Limited',
    standard: 'ISO 9001:2015, ISO 18841:2018', auditType, type: 'custom',
    clauses: [
        { mainClause: 'IMS', title: 'Integrated Management System', subClauses: [
            { clause: '4.1', title: 'Context', requirement: 'Confirm the issues are current. No validated supporting document mapped — auditor to select or confirm the document.',
                items: [{ clause: '4.1', requirement: 'Confirm the issues are current. No validated supporting document mapped — auditor to select or confirm the document.' }] }
        ] },
        { mainClause: 'ISO 18841:2018', title: 'ISO 18841:2018 — requirements from the Knowledge Base (ISO 18841:2018)', subClauses: [
            { clause: '4.1', title: 'General', requirement: 'Does the interpreter render messages faithfully?', items: [{ clause: '4.1', requirement: 'Does the interpreter render messages faithfully?' }] }
        ] },
        { mainClause: 'DOCNOTE', title: 'Document Intelligence — awareness note, not an audit finding', subClauses: [
            { clause: 'DOCNOTE', title: 'Documents on file not yet mapped to a requirement', requirement: 'For awareness only — 14 document(s) on file carry no mapping.', documentNote: true,
                items: [{ clause: 'DOCNOTE', requirement: 'For awareness only — 14 document(s) on file carry no mapping.' }] }
        ] }
    ]
});
const qa = { ok: false, blocking: false, itemCount: 2, issues: [{ code: 'DUPLICATE_QUESTION', severity: 'warning', itemRef: '4.1', message: 'Identical to the question at 4.1.' }], counts: { critical: 0, warning: 1, info: 0 } };
const coverage = { outcome: 'passed-with-notes', issues: [], coverage: { cycle: { start: '2025-11-07', end: '2028-11-07' }, clauses: [], controls: [] } };

function print(auditType) {
    const ck = checklist(auditType);
    const html = CD.build(ck, Object.assign({}, BRAND, { qa, coverage, combined: CC.combine(qa, coverage) }));
    return { html, text: DF.renderedText(html) };
}

describe('the printed checklist', () => {
    it('does not print the internal QA issue list, but keeps the validation status', () => {
        const { text } = print('surveillance');
        expect(text).not.toMatch(/Checklist QA validation/i);
        expect(text).not.toMatch(/Identical to the question at 4\.1/);
        expect(text).toMatch(/Checklist validation status/i);
    });

    it('does not print the Document Intelligence section', () => {
        const { text } = print('surveillance');
        expect(text).not.toMatch(/Document Intelligence/);
        expect(text).not.toMatch(/14 document\(s\) on file carry no mapping/);
        expect(CD.printItems(checklist('surveillance')).some(i => /DOCNOTE/.test(i.clause))).toBe(false);
    });

    it('does not print preparation notes inside the questions', () => {
        const { text } = print('surveillance');
        expect(text).toMatch(/Confirm the issues are current\./);
        expect(text).not.toMatch(/No validated supporting document mapped/);
        expect(text).not.toMatch(/auditor to select or confirm the document/);
    });

    it('heads the coverage panel for the audit type', () => {
        expect(print('surveillance').text).toMatch(/Coverage validation — this audit and the cycle so far/i);
        expect(print('surveillance').text).not.toMatch(/Recertification coverage validation/i);
        expect(print('recertification').text).toMatch(/Recertification coverage validation/i);
        expect(print('initial').text).toMatch(/Coverage validation/i);
    });

    it('lets a long section code wrap in its column instead of overlapping the title', () => {
        const { html } = print('surveillance');
        expect(html).not.toMatch(/tr\.section-header td:first-child\s*\{\s*white-space:\s*nowrap/);
        expect(html).toMatch(/tr\.section-header td:first-child, tr\.sub-header td:first-child \{ overflow-wrap: anywhere/);
        expect(html).toMatch(/<tr class="section-header"><td>ISO 18841:2018<\/td>/);
    });
});
