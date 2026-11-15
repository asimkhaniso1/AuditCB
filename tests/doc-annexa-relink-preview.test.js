import { describe, it, expect, beforeAll } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { B, M } from '../tools/pcc-scenario.mjs';

// Three problems on PC Connection's Document Center (2026-11-15):
//  1. "Asset Management Procedure" showed no clause after Re-link clauses: the
//     proposal (ISO/IEC 20000-1 8.2.5) was listed but left UNTICKED, because
//     only bulk-imported documents were pre-ticked.
//  2. "Access Control Procedure" linked to nothing: access control is an
//     ISO/IEC 27001 Annex A control, not a clause 4-10 requirement, and Annex A
//     was only ever linked from explicit references or the SoA.
//  3. The line under each document read "Company Confidential Page 1 of 8
//     Access Control Procedure Table of Contents ........".

const ALL = ['iso27001', 'iso22301', 'iso20000'];
const map = (title, targets) => B.mapClausesByStandard({ title }, null, targets || ALL);

describe('Annex A controls from a document’s name (ISO/IEC 27001 only)', () => {
    it('links the Access Control Procedure to the access-control controls', () => {
        const r = map('Access Control Procedure');
        expect(r.byStandard.iso27001).toEqual(['A.5.15', 'A.5.16', 'A.5.18', 'A.8.2', 'A.8.3', 'A.8.5']);
        expect(r.byStandard.iso22301).toEqual([]);
        expect(r.byStandard.iso20000).toEqual([]);
    });

    it('gives the Asset Management Procedure 8.2.5 in 20000-1 and A.5.9-A.5.11 in 27001', () => {
        const r = map('Asset Management Procedure');
        expect(r.byStandard.iso20000).toEqual(['8.2.5']);
        expect(r.byStandard.iso27001).toEqual(['A.5.9', 'A.5.10', 'A.5.11']);
        expect(r.clauses).toEqual(['8.2.5', 'A.5.9', 'A.5.10', 'A.5.11']); // clauses before Annex A
    });

    it('adds Annex A beside the clauses a name already gives, and only for 27001', () => {
        expect(map('Change Management Procedure').byStandard).toEqual({ iso27001: ['6.3', 'A.8.32'], iso22301: ['6.3'], iso20000: ['8.5.1'] });
        expect(map('Business Continuity and Disaster Recovery Process').byStandard.iso27001).toEqual(['A.5.29', 'A.5.30']);
        expect(map('Backup Policy', ['iso27001']).clauses).toEqual(['5.2', 'A.8.13']);
        // a client without 27001 gets no Annex A links
        expect(map('Access Control Procedure', ['iso22301', 'iso20000']).clauses).toEqual([]);
        expect(B.mapClauses({ title: 'Access Control Procedure' })).toEqual([]);
    });

    it('does not read Annex A from words that are not the document’s subject', () => {
        ['Awareness Procedure', 'Availability Plan', 'Internal Audit Procedure', 'Management Review Minutes'].forEach(t => {
            expect(map(t).clauses.filter(c => /^A\./.test(c)), t).toEqual([]);
        });
    });

    it('every control the rules name exists in ISO/IEC 27001:2022 Annex A', () => {
        const refs = B.ANNEX_A_TITLE_RULES.flatMap(r => r.controls);
        expect(refs.length).toBeGreaterThan(40);
        refs.forEach(ref => expect(M.CS.isKnownRef('iso27001', ref), ref).toBe(true));
    });

    it('Annex A links do not change the clause-level gap analysis', () => {
        const clauses = [{ clause: '5.1', title: 'Leadership' }, { clause: '8.2', title: 'Risk assessment' }];
        const docs = [{ name: 'Access Control Procedure', linkedClauses: 'A.5.15, A.8.2', clauseMap: { iso27001: ['A.5.15', 'A.8.2'] } }];
        const res = B.analyseGapsForStandards(['ISO/IEC 27001:2022'], docs)[0];
        expect(res.analysis.rows.every(r => !r.docs.length)).toBe(true);
        // and directly: A.8.2 is not clause 8.2, A.5.15 is not 5.1
        expect(B.docCoversRef(docs[0], 'iso27001', '8.2')).toBe(false);
        expect(B.docCoversRef(docs[0], 'iso27001', '5.1')).toBe(false);
        void clauses;
    });
});

describe('Re-link clauses pre-ticks a proposal that only adds links', () => {
    const client = { standard: 'ISO 27001:2022, ISO 22301:2019, ISO 20000-1:2018' };

    it('a document with no links and no headings, not hand-added, is ticked', () => {
        const doc = { name: 'Asset Management Procedure', category: 'Quality Procedures', linkedClauses: '' };
        const row = Object.assign({ doc }, B.relinkDocumentClauses(doc, { clientStandard: client.standard }));
        expect(row.changed).toBe(true);
        expect(row.proposed).toContain('8.2.5');
        expect(row.removes).toEqual([]);
        expect(B.relinkPreselect(row)).toBe(true);
    });

    it('a proposal that removes links still waits for the auditor unless it was read from a bulk-imported file', () => {
        const removing = { proposed: ['7.5'], removes: ['4.1'] };
        expect(B.relinkPreselect(Object.assign({ doc: { source: 'manual' }, basis: 'file' }, removing))).toBe(false);
        expect(B.relinkPreselect(Object.assign({ doc: { source: 'bulk-import' }, basis: 'headings' }, removing))).toBe(false);
        expect(B.relinkPreselect(Object.assign({ doc: { source: 'bulk-import' }, basis: 'file' }, removing))).toBe(true);
        expect(B.relinkPreselect({ doc: {}, proposed: [], removes: [] })).toBe(false);
        // hand-added documents never start ticked, even for an addition
        expect(B.relinkPreselect({ doc: { source: 'manual' }, basis: 'file', proposed: ['8.2.5'], removes: [] })).toBe(false);
    });

    it('an unlinked document is offered its links even when its headings read as ISO-numbered', () => {
        const doc = { name: 'Asset Management Procedure', linkedClauses: '', headings: [{ clause: '4.1', text: 'Context of the organization' }, { clause: '5.2', text: 'Policy' }, { clause: '7.5', text: 'Documented information' }] };
        const row = B.relinkDocumentClauses(doc, { clientStandard: client.standard });
        expect(row.proposed).toContain('8.2.5');
        expect(row.changed).toBe(true);
        // a document that already has links keeps the old rule: not offered on ISO-numbered headings alone
        const linked = Object.assign({}, doc, { linkedClauses: '4.1, 5.2, 7.5' });
        expect(B.relinkDocumentClauses(linked, { clientStandard: client.standard }).numbering).toBe(row.numbering);
    });
});

describe('the summary line under a document', () => {
    it('drops the running header, page numbers, the title and contents leaders', () => {
        expect(B.notePreview('Company Confidential Page 1 of 8 Access Control Procedure Table of Contents Table of Contents .................. ............ .........', 'Access Control Procedure')).toBe('');
        expect(B.notePreview('Company Confidential Page 1 of 17 8/26/2026 Business Continuity & Disaster Recovery Process Connection Managed Services Provider Version 8.1', 'Business Continuity and Disaster Recovery Process'))
            .toBe('8/26/2026 Business Continuity & Disaster Recovery Process Connection Managed Services Provider Version 8.1');
    });

    it('keeps a "Sections in document" note and real text, and shortens long text on a word', () => {
        expect(B.notePreview('Sections in document: 1 Purpose; 2 Scope', 'X')).toBe('Sections in document: 1 Purpose; 2 Scope');
        const long = B.notePreview('This procedure defines how user accounts are requested, approved, reviewed and removed. '.repeat(5), 'Access Control Procedure', 60);
        expect(long.length).toBeLessThanOrEqual(61);
        expect(long.endsWith('…')).toBe(true);
    });

    it('the Document Center renders the cleaned line, escaped, and none when nothing is left', () => {
        globalThis.window = globalThis.window || globalThis;
        window.UTILS = M.UTILS;
        window.ClientDocsBulk = B;
        window.AuthManager = { canPerform: () => false };
        window.state = Object.assign({ checklists: [], auditPlans: [], auditReports: [] }, window.state || {});
        const render = loadScript('./clients-module.js', { params: { module: undefined }, append: '\nreturn getClientDocumentsHTML;' });
        const host = document.createElement('div');
        host.innerHTML = render({ id: 'c1', name: 'PCC', documents: [
            { id: 'd1', name: 'Access Control Procedure', category: 'Quality Procedures', date: '2026-11-11', notes: 'Company Confidential Page 1 of 8 Access Control Procedure Table of Contents ........ ........' },
            { id: 'd2', name: 'Awareness Procedure', category: 'Quality Procedures', date: '2026-11-11', notes: 'Company Confidential Page 1 of 6 <img src=x onerror=alert(1)> awareness training for all staff' }
        ] });
        const text = host.textContent;
        expect(text).not.toMatch(/Company Confidential|Page 1 of|Table of Contents/);
        expect(host.querySelector('img')).toBeNull();
        expect(text).toContain('<img src=x onerror=alert(1)> awareness training for all staff');
        expect(host.querySelectorAll('.fa-sticky-note').length).toBe(1); // the first document has no preview left
    });
});
