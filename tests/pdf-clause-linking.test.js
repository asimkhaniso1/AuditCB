// Client-document clause linking for integrated management systems.
//
// A 65-document ISO/IEC 27001 + ISO 22301 + ISO/IEC 20000-1 client showed 35
// gaps in the document gap analysis, nearly all false:
//  - PDF text was joined into one line per page, so no heading was ever read
//    and clause links came from file-name keywords alone;
//  - a manual with unnumbered section titles was only readable through its
//    contents page, which was never parsed;
//  - clause numbers were ISO 9001 numbers for every standard ("incident" ->
//    8.2, which in 27001 is risk assessment; improvement -> 10.1/10.3, which in
//    22301 is nonconformity).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
loadScript('./client-docs-bulk.js', { params: { module: undefined } });
window.state = window.state || {};
loadScript('./settings-kb.js');

const B = window.ClientDocsBulk;
const IMS = 'ISO 27001:2022, ISO 22301:2019, ISO 20000-1:2018';

// The contents page of an integrated manual whose section titles carry no numbers.
const IMS_MANUAL_TEXT = [
    'Integrated Management System Manual',
    'Table of Contents ........................................ 1',
    'Change History ........................................... 4',
    '1. Purpose ............................................... 5',
    '2. Scope ................................................. 5',
    'Understanding the Organization and its Context ........... 8',
    'Determining the Scope of the ITMS, BCMS and ISMS ......... 9',
    'Leadership and Commitment ................................ 10',
    'Organizational Roles, Responsibilities and Authorities .... 11',
    'Actions to Address Risks and Opportunities ............... 11',
    'Quality Objectives and Planning to Achieve Them .......... 12',
    'Competence ............................................... 14',
    'Awareness ................................................ 14',
    'Communication ............................................ 15',
    'Control of Documented Information ........................ 15',
    'Operational Planning and Control ......................... 16',
    'Monitoring, Measurement, Analysis and Evaluation ......... 23',
    'Internal Audit ........................................... 24',
    'Management Review ........................................ 24',
    'Improvement .............................................. 25',
    'Nonconformity and Corrective Action ...................... 26',
    'Purpose',
    'This manual describes the ITMS, BCMS and ISMS of the organization.'
].join('\n');

describe('pdfTextFromItems — PDF pages keep their lines', () => {
    it('breaks a line at hasEOL and when the baseline moves', () => {
        const items = [
            { str: '1. Purpose', transform: [1, 0, 0, 1, 72, 700], hasEOL: true },
            { str: 'This procedure', transform: [1, 0, 0, 1, 72, 680] },
            { str: 'applies to all staff.', transform: [1, 0, 0, 1, 150, 680] },
            { str: '2. Scope', transform: [1, 0, 0, 1, 72, 650] }
        ];
        expect(window.pdfTextFromItems(items)).toBe('1. Purpose\nThis procedure applies to all staff.\n2. Scope');
    });

    it('keeps superscripts and kerned runs on the same line', () => {
        const items = [
            { str: 'ISO', transform: [1, 0, 0, 1, 72, 700] },
            { str: '®', transform: [1, 0, 0, 1, 90, 701.5] },
            { str: '27001', transform: [1, 0, 0, 1, 96, 700] }
        ];
        expect(window.pdfTextFromItems(items)).toBe('ISO ® 27001');
    });

    it('ignores items without text and tolerates missing positions', () => {
        expect(window.pdfTextFromItems([{ str: 'A', hasEOL: true }, null, { str: 'B' }])).toBe('A\nB');
        expect(window.pdfTextFromItems([])).toBe('');
    });
});

describe('parseContentMeta — contents pages', () => {
    it('reads unnumbered contents entries as headings, without the dot leaders', () => {
        const meta = B.parseContentMeta(IMS_MANUAL_TEXT);
        const texts = meta.topicHeadings.map(h => h.text);
        expect(texts).toContain('Leadership and Commitment');
        expect(texts).toContain('Nonconformity and Corrective Action');
        expect(texts.every(t => !/\.{3}/.test(t))).toBe(true);
    });

    it('keeps every contents entry for mapping, past the 30 stored headings', () => {
        const toc = Array.from({ length: 40 }, (_, i) => `Section topic ${i + 1} ....... ${i + 2}`).concat(['Internal Audit ........ 50']);
        const meta = B.parseContentMeta(toc.join('\n'));
        expect(meta.headings.length).toBeLessThanOrEqual(30);
        expect(meta.topicHeadings.map(h => h.text)).toContain('Internal Audit');
    });

    it('does not read a title-block owner field as the document subject', () => {
        const meta = B.parseContentMeta('Generative Artificial Intelligence Policy\nPolicy Owner: Legal Department\nBody text.');
        expect(meta.titleLines).toEqual(['Generative Artificial Intelligence Policy']);
    });

    it('does not take a bare chapter number as a clause reference', () => {
        expect(B.findExplicitClauseRefs('Objectives support clause 8 and clause 9.2 of ISO/IEC 20000-1.')).toEqual(['9.2']);
    });
});

describe('mapClausesByStandard — clause numbers per standard', () => {
    const name = n => B.parseDocumentName(n);

    it('maps an integrated manual\'s contents page to clauses 4-10 for every standard', () => {
        const parsed = name('Integrated Management System Manual.pdf');
        const meta = B.parseContentMeta(IMS_MANUAL_TEXT);
        const m = B.mapClausesByStandard(parsed, meta, B.clauseTargets(['iso27001', 'iso22301', 'iso20000'], ''));
        // The manual has both an improvement and a corrective-action section,
        // so every standard ends with the same list and no per-standard map.
        expect(m.byStandard).toBeNull();
        expect(m.clauses).toEqual(expect.arrayContaining(['4.1', '4.3', '4.4', '5.1', '5.3', '6.1', '6.2', '7.2', '7.5', '8.1', '9.1', '9.2', '9.3', '10.1', '10.2']));
    });

    it('keeps a per-standard map when the numbers differ between standards', () => {
        const meta = B.parseContentMeta(['Improvement Manual', 'Continual Improvement ........ 3', 'Improvement Programme ...... 4'].join('\n'));
        const m = B.mapClausesByStandard(name('Improvement Manual.pdf'), meta, ['iso27001', 'iso22301']);
        expect(m.byStandard.iso27001).toContain('10.1');
        expect(m.byStandard.iso27001).not.toContain('10.2');
        expect(m.byStandard.iso22301).toContain('10.2');
        expect(m.byStandard.iso22301).not.toContain('10.1');
        expect(m.clauses).toEqual(expect.arrayContaining(['10.1', '10.2']));
    });

    it('numbers an incident procedure for ISO/IEC 20000-1 only, never as 27001 risk assessment', () => {
        const parsed = name('Incident Management Process SOP.pdf');
        const m = B.mapClausesByStandard(parsed, null, B.clauseTargets([], IMS));
        expect(m.byStandard.iso20000).toContain('8.6.1');
        expect(m.byStandard.iso27001).not.toContain('8.2');
        expect(m.byStandard.iso22301).not.toContain('8.4');
        expect(m.clauses).not.toContain('8.2');
    });

    it('maps continual improvement to 10.1 in 27001 and 10.2 in 22301 and 20000-1', () => {
        const parsed = name('Improvement Procedure.pdf');
        expect(B.mapClausesByStandard(parsed, null, ['iso27001']).clauses).toEqual(['10.1']);
        expect(B.mapClausesByStandard(parsed, null, ['iso22301']).clauses).toEqual(['10.2']);
        expect(B.mapClausesByStandard(parsed, null, ['iso20000']).clauses).toEqual(['10.2']);
    });

    it('maps ISO 22301 operational documents to their clause 8 sub-clauses', () => {
        const map = n => B.mapClausesByStandard(name(n), null, ['iso22301']).clauses;
        expect(map('Business Impact Analysis Procedure.pdf')).toContain('8.2.2');
        expect(map('Risk Assessment Procedure_22301.pdf')).toContain('8.2.3');
        expect(map('Evaluation of Business Continuity Procedures.pdf')).toContain('8.6');
        expect(map('Incident Response Procedure.pdf')).toContain('8.4');
    });

    it('maps the SoA and a 27001 risk procedure to risk assessment and treatment', () => {
        expect(B.mapClausesByStandard(name('Statement of Applicability (SoA).pdf'), null, ['iso27001']).clauses)
            .toEqual(expect.arrayContaining(['6.1.3', '8.3']));
        expect(B.mapClausesByStandard(name('Risk Assessment Procedure_27001.pdf'), null, ['iso27001']).clauses)
            .toEqual(expect.arrayContaining(['6.1.2', '8.2']));
    });

    it('maps ISO/IEC 20000-1 change management to 8.5.1, not 6.3', () => {
        const c = B.mapClausesByStandard(name('Configuration and Change Management SOP.pdf'), null, ['iso20000']).clauses;
        expect(c).toEqual(expect.arrayContaining(['8.2.6', '8.5.1']));
        expect(c).not.toContain('6.3');
    });

    it('credits one clearly titled section of a long BC/DR process', () => {
        const text = ['Business Continuity and Disaster Recovery Process',
            '1 Introduction', '2 Business Continuity', '2.1 Business Impact Analysis', '2.2 Business Continuity Strategy',
            '3 Managed Assets', '3.1 Backup Vault', '3.2 Plan Overview', '3.3 Business Continuity Plan Testing and Exercises',
            '4 Emergency Response', '4.1 Alert and Escalation', '4.2 Plan Invocation', '5 Damage Assessment', '6 Terms and Definitions'].join('\n');
        const c = B.mapClausesByStandard(name('Business Continuity and Disaster Recovery Process.pdf'), B.parseContentMeta(text), ['iso22301']).clauses;
        expect(c).toEqual(expect.arrayContaining(['8.2.2', '8.3', '8.4', '8.5']));
    });

    it('does not credit every procedure with 5.3 for its Roles and Responsibilities section', () => {
        const text = ['Access Control Procedure', '1 Purpose', '2 Scope', '3 Roles and Responsibilities', '4 User Registration', '5 Password Rules'].join('\n');
        const c = B.mapClausesByStandard(name('Access Control Procedure.pdf'), B.parseContentMeta(text), ['iso27001']).clauses;
        expect(c).not.toContain('5.3');
    });

    it('leaves ISO 9001-family numbering as it was', () => {
        const parsed = name('Incident Reporting Procedure.docx');
        expect(B.mapClausesByStandard(parsed, null, ['iso45001']).clauses).toEqual(B.mapClauses(parsed, null));
        expect(B.mapClausesByStandard(parsed, null, []).clauses).toEqual(B.mapClauses(parsed, null));
        expect(B.mapClauses(parsed, null)).toContain('8.2');
    });

    it('returns a plain list when every standard numbers the document the same', () => {
        const m = B.mapClausesByStandard(name('Internal Audit Procedure.pdf'), null, ['iso27001', 'iso22301', 'iso20000']);
        expect(m.byStandard).toBeNull();
        expect(m.clauses).toEqual(['9.2']);
    });
});

describe('docCoversRef — per-standard clause maps', () => {
    const doc = {
        name: 'Integrated Management System Manual', linkedStandards: '',
        linkedClauses: '10.1, 10.2',
        clauseMap: { iso27001: ['10.1'], iso22301: ['10.2'] }
    };

    it('reads the standard\'s own list when the document has one', () => {
        expect(B.docCoversRef(doc, 'iso27001', '10.1')).toBe(true);
        expect(B.docCoversRef(doc, 'iso27001', '10.2')).toBe(false);
        expect(B.docCoversRef(doc, 'iso22301', '10.1')).toBe(false);
        expect(B.docCoversRef(doc, 'iso22301', '10.2')).toBe(true);
    });

    it('falls back to linkedClauses for a standard outside the map, and for older documents', () => {
        expect(B.docCoversRef(doc, 'iso20000', '10.1')).toBe(true);
        expect(B.docCoversRef({ name: 'Old', linkedClauses: '9.2' }, 'iso27001', '9.2')).toBe(true);
    });
});

describe('relinkDocumentClauses — documents imported without headings', () => {
    it('proposes per-standard links from a re-read file', () => {
        const doc = { name: 'Integrated Management System Manual', category: 'System Manual', linkedStandards: 'iso27001, iso22301, iso20000', linkedClauses: '', source: 'bulk-import' };
        const meta = B.parseContentMeta(IMS_MANUAL_TEXT);
        const r = B.relinkDocumentClauses(doc, { meta, clientStandard: IMS });
        expect(r.changed).toBe(true);
        expect(r.proposed).toEqual(expect.arrayContaining(['4.3', '9.2', '9.3']));
        expect(r.proposed).toEqual(expect.arrayContaining(['10.1', '10.2']));
        expect(r.headings.length).toBeGreaterThan(0);
    });

    it('still leaves a hand-linked document with no headings alone', () => {
        expect(B.relinkDocumentClauses({ name: 'Scope statement', linkedClauses: '4.3' }).changed).toBe(false);
    });
});

describe('rereadStoredDocument', () => {
    beforeEach(() => {
        window.extractTextFromFile = vi.fn(async () => IMS_MANUAL_TEXT);
    });

    it('downloads the stored file and parses it with line breaks kept', async () => {
        const download = vi.fn(async () => ({ data: new Blob(['%PDF']), error: null }));
        window.SupabaseClient = { isInitialized: true, client: { storage: { from: vi.fn(() => ({ download })) } } };
        const meta = await B.rereadStoredDocument({ storagePath: 'clients/c1/123_IMS_Manual.pdf', fileName: 'IMS Manual.pdf' });
        expect(download).toHaveBeenCalledWith('clients/c1/123_IMS_Manual.pdf');
        const [file, opts] = window.extractTextFromFile.mock.calls[0];
        expect(file.type).toBe('application/pdf');
        expect(opts).toEqual({ preserveLines: true });
        expect(meta.topicHeadings.length).toBeGreaterThan(10);
    });

    it('returns null without a stored file, a session or a readable type', async () => {
        window.SupabaseClient = { isInitialized: false };
        expect(await B.rereadStoredDocument({ storagePath: 'clients/c1/a.pdf', fileName: 'a.pdf' })).toBeNull();
        window.SupabaseClient = { isInitialized: true, client: { storage: { from: () => ({ download: async () => ({ data: null, error: new Error('x') }) }) } } };
        expect(await B.rereadStoredDocument({ storagePath: 'clients/c1/a.pdf', fileName: 'a.pdf' })).toBeNull();
        expect(await B.rereadStoredDocument({ fileName: 'a.pdf' })).toBeNull();
        expect(await B.rereadStoredDocument({ storagePath: 'clients/c1/a.xlsx', fileName: 'a.xlsx' })).toBeNull();
    });
});
