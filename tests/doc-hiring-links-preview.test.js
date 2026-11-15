import { describe, it, expect } from 'vitest';
import { B } from '../tools/pcc-scenario.mjs';

// PC Connection's Document Center after PR #70 (2026-11-15):
//  - "Hiring and New Starters Procedure" linked to nothing; hiring determines
//    competence on entry (7.2) and, in ISO/IEC 27001, is screening and terms
//    of employment (A.6.1, A.6.2).
//  - Its BCMS copy, "Hiring and New Starters Procedure (Business Continuity
//    Management", was numbered for every standard on the client, so the label
//    read as a business continuity TOPIC (20000-1 8.7.2, 27001 A.5.29-A.5.30).
//    The label names the STANDARD.
//  - Previews still read "Change History 1. Objective 2. Scope": a revision
//    table heading and the contents list, not a summary.

const IMS = 'ISO 27001:2022, ISO 22301:2019, ISO 20000-1:2018';
const relink = (name, extra) => B.relinkDocumentClauses(Object.assign({ name, linkedClauses: '' }, extra || {}), { clientStandard: IMS });

describe('hiring and leavers procedures', () => {
    it('a hiring procedure is competence (7.2) everywhere, plus screening and terms of employment in 27001', () => {
        const r = relink('Hiring and New Starters Procedure');
        expect(r.proposedMap).toEqual({ iso27001: ['7.2', 'A.6.1', 'A.6.2'], iso22301: ['7.2'], iso20000: ['7.2'] });
        expect(r.changed).toBe(true);
        expect(relink('Recruitment Procedure').proposed).toContain('7.2');
    });

    it('a leavers procedure is termination responsibilities and return of assets (27001)', () => {
        expect(relink('Leavers Checklist').proposedMap.iso27001).toEqual(['A.5.11', 'A.6.5']);
    });

    it('customer onboarding is not HR onboarding', () => {
        expect(relink('Customer Onboarding Procedure').proposed).toEqual([]);
    });
});

describe('a "(Business Continuity Management" label names the standard', () => {
    it('is tagged ISO 22301 and numbered only for it, without business-continuity topics', () => {
        const r = relink('Hiring and New Starters Procedure (Business Continuity Management');
        expect(r.proposedStandards).toEqual(['iso22301']);
        expect(r.proposed).toEqual(['7.2']);
        expect(r.proposedMap).toBeNull();
        expect(B.mapStandards({ title: 'Access Control Procedure (Information Security Management)' }).ids).toEqual(['iso27001']);
        expect(B.mapStandards({ title: 'Incident Procedure (IT Service Management)' }).ids).toEqual(['iso20000']);
    });

    it('a standard already stored on the document is kept, and nothing is proposed for it', () => {
        const r = relink('Hiring and New Starters Procedure (Business Continuity Management', { linkedStandards: 'iso27001' });
        expect(r.proposedStandards).toEqual([]);
        expect(r.proposed).toEqual(['7.2', 'A.5.29', 'A.5.30', 'A.6.1', 'A.6.2']);
    });

    it('a business continuity document is still a business continuity topic', () => {
        expect(B.mapStandards({ title: 'Business Continuity and Disaster Recovery Process' }).ids).toEqual([]);
        expect(relink('Business Continuity and Disaster Recovery Process').proposedMap.iso22301).toEqual(['8.4']);
    });

    it('applying the re-link (the real dialog) records the standard on a document that had none', async () => {
        globalThis.window = globalThis.window || globalThis;
        const doc = { name: 'Hiring and New Starters Procedure (Business Continuity Management', linkedClauses: '', source: 'bulk-import' };
        const client = { id: 'c1', name: 'PCC', standard: IMS, documents: [doc] };
        window.DataService = { findClient: () => client, openFormModal: (_title, body) => { document.body.innerHTML = `<div id="modal-body">${body}</div>`; } };
        window.saveData = () => { };
        window.closeModal = () => { };
        window.showNotification = () => { };
        window.SupabaseClient = null;
        window.renderClientDetail = undefined;
        await window.openRelinkDocumentClauses('c1');
        const box = document.querySelector('.relink-pick');
        expect(box).not.toBeNull();
        expect(box.checked).toBe(true);
        window.applyRelinkDocumentClauses();
        expect(doc.linkedClauses).toBe('7.2');
        expect(doc.linkedStandards).toBe('iso22301');
        // and the gap analysis then counts it for 22301 only
        expect(B.docCoversRef(doc, 'iso22301', '7.2')).toBe(true);
        expect(B.docCoversRef(doc, 'iso27001', '7.2')).toBe(false);
    });
});

describe('recovered references (a name from an old checklist, no file)', () => {
    it('say "Not on file" instead of "—", and do not repeat the banner on every row', async () => {
        const { loadScript } = await import('./helpers/load-script.js');
        const { M } = await import('../tools/pcc-scenario.mjs');
        globalThis.window = globalThis.window || globalThis;
        window.UTILS = M.UTILS;
        window.ClientDocsBulk = B;
        window.AuthManager = { canPerform: () => false };
        window.state = Object.assign({ checklists: [], auditPlans: [], auditReports: [] }, window.state || {});
        const render = loadScript('./clients-module.js', { params: { module: undefined }, append: '\nreturn getClientDocumentsHTML;' });
        const host = document.createElement('div');
        // A recovered row, shaped as recoverClientDocumentReferences builds it.
        host.innerHTML = render({ id: 'c1', name: 'PCC', documents: [
            { id: 'r1', name: 'ITSMS Objectives Procedure for ISO 20000-1 (IT Service Management)', category: 'Recovered reference', recovered: true, date: '', notes: 'Reference recovered from the generated checklist. Re-upload the file if the attachment is required.' }
        ] });
        expect(host.textContent).toContain('Not on file — re-upload to link');
        expect(host.textContent).not.toContain('Reference recovered from the generated checklist');
        expect(host.querySelectorAll('.fa-sticky-note').length).toBe(0);
    });
});

describe('the summary line drops revision-table headings and bare contents lists', () => {
    it('hides a note that is only "Change History 1. Objective 2. Scope"', () => {
        expect(B.notePreview('Hiring and New Starters Procedure Change History 1. Objective 2. Scope', 'Hiring and New Starters Procedure (Business Continuity Management')).toBe('');
        expect(B.notePreview('Change History 1. Scope 2. Responsibilities', 'Hiring and New Starters Procedure')).toBe('');
        expect(B.notePreview('Revision History 1. Purpose 2. Scope 3. Roles and Responsibilities', 'X Procedure')).toBe('');
    });

    it('keeps real text, including text after a numbered heading', () => {
        const policy = '11/22/2023 Title: Category: Employment Policy Owner: Legal Department Date Issued: 11/22/2023 PURPOSE PC Connection recognizes that';
        expect(B.notePreview(policy, 'Generative Artificial Intelligence Policy')).toBe(policy);
        expect(B.notePreview('1. Objective This procedure defines how new starters are screened before access is granted.', 'Hiring and New Starters Procedure'))
            .toBe('1. Objective This procedure defines how new starters are screened before access is granted.');
    });
});
