import { describe, it, expect, beforeEach } from 'vitest';
import { B } from '../tools/pcc-scenario.mjs';

// Re-uploading PC Connection's folder (2026-11-15) listed all 65 files as
// "Already on file" — and all 65 ticked after Select all. Import pushed every
// ticked row as a NEW document, so it would have duplicated the whole set.
// Now Select all never ticks a second copy in the same batch, and importing a
// file already on file updates that document: its stored file, headings and
// clause links are refreshed; its id, name, category, date and recorded
// standard are kept; clauses an auditor linked by hand are merged, not lost.

const IMS = 'ISO 27001:2022, ISO 22301:2019, ISO 20000-1:2018';
let client; let notes;

function mount() {
    globalThis.window = globalThis.window || globalThis;
    notes = [];
    window.showNotification = (m, t) => notes.push([t, m]);
    window.saveData = () => { };
    window.closeModal = () => { };
    window.SupabaseClient = null;
    window.AuthManager = { canPerform: () => true };
    window.extractTextFromFile = undefined;
    window.state = Object.assign(window.state || {}, { currentUser: { name: 'Cara Manager', role: 'Admin' } });
    window.DataService = {
        findClient: () => client,
        openFormModal: (_t, body) => { document.body.innerHTML = `<div class="modal-content"><div id="modal-body">${body}</div></div>`; }
    };
}

async function upload(names) {
    window.openBulkDocumentUpload(client.id);
    window.handleBulkDocsInput({ files: names.map(n => new File(['x'], n, { type: 'application/pdf' })) });
    for (let i = 0; i < 200 && !document.querySelector('[data-action="confirmBulkDocImport"]'); i++) await new Promise(r => setTimeout(r, 5));
    expect(document.querySelector('[data-action="confirmBulkDocImport"]')).not.toBeNull();
}
const statusTexts = () => Array.from(document.querySelectorAll('#bulk-doc-body tr')).map(tr => tr.textContent).join(' | ');

beforeEach(() => {
    client = {
        id: 'pcc', name: 'PC CONNECTION, INC.', standard: IMS, documents: [
            { id: 'd-access', name: 'Access Control Procedure', category: 'Quality Procedures', date: '2026-11-11', linkedClauses: '', notes: 'Company Confidential Page 1 of 8', source: 'bulk-import', storagePath: '' },
            { id: 'd-hand', name: 'Incident Response Procedure', category: 'Quality Procedures', date: '2024-12-03', linkedClauses: '8.4', linkedStandards: 'iso22301', notes: 'Typed by the auditor', source: 'manual' }
        ]
    };
    mount();
});

describe('re-uploading files that are already on file', () => {
    it('marks them "On file — tick to update" and leaves them unticked', async () => {
        await upload(['Access Control Procedure.pdf', 'Incident Response Procedure.pdf']);
        expect(statusTexts()).toMatch(/On file — tick to update/);
        expect(document.querySelectorAll('[data-action-change="toggleBulkDocRow"]:checked').length).toBe(0);
    });

    it('Select all ticks them but never a second copy of a file in the same batch', async () => {
        await upload(['Access Control Procedure.pdf', 'Backup Policy.pdf', 'Backup Policy (1).pdf', 'Backup Policy.pdf']);
        window.toggleAllBulkDocs('1');
        const rows = Array.from(document.querySelectorAll('#bulk-doc-body tbody tr'));
        const ticked = rows.filter(tr => tr.querySelector('input[type="checkbox"]')?.checked).map(tr => tr.textContent);
        expect(ticked.some(t => /Duplicate in batch/.test(t))).toBe(false);
        expect(ticked.some(t => /On file/.test(t))).toBe(true);
    });

    it('importing updates the document on file instead of adding a copy', async () => {
        await upload(['Access Control Procedure.pdf', 'Supplier Management Procedure for ISO 27001.pdf']);
        window.toggleAllBulkDocs('1');
        await window.confirmBulkDocImport(client.id);
        expect(client.documents).toHaveLength(3); // one updated, one added
        const access = client.documents.filter(d => d.name === 'Access Control Procedure');
        expect(access).toHaveLength(1);
        expect(access[0]).toMatchObject({ id: 'd-access', category: 'Quality Procedures', date: '2026-11-11', updatedBy: 'Cara Manager' });
        // a bulk-imported document takes the fresh mapping (Annex A from its name)
        expect(access[0].linkedClauses).toBe('A.5.15, A.5.16, A.5.18, A.8.2, A.8.3, A.8.5');
        expect(document.body.textContent).toMatch(/1 document added · 1 updated/);
        expect(notes.pop()).toEqual(['success', 'PC CONNECTION, INC.: 1 document(s) added, 1 updated']);
    });

    it('a hand-added document keeps its links and notes, merged with the new ones', async () => {
        await upload(['Incident Response Procedure.pdf']);
        window.toggleAllBulkDocs('1');
        await window.confirmBulkDocImport(client.id);
        expect(client.documents).toHaveLength(2);
        const hand = client.documents.find(d => d.id === 'd-hand');
        expect(hand.linkedStandards).toBe('iso22301'); // the recorded standard is kept
        expect(hand.linkedClauses.split(', ')).toContain('8.4');
        expect(hand.notes).toBe('Typed by the auditor');
        expect(hand.date).toBe('2024-12-03');
    });

    it('unticked rows that are on file are left alone', async () => {
        const before = JSON.stringify(client.documents);
        await upload(['Access Control Procedure.pdf', 'Backup Policy.pdf']);
        // tick only the new one
        const rows = Array.from(document.querySelectorAll('#bulk-doc-body tbody tr'));
        const newIdx = rows.findIndex(tr => /Backup Policy/.test(tr.innerHTML) && /New/.test(tr.textContent));
        window.toggleBulkDocRow(String(newIdx), true);
        await window.confirmBulkDocImport(client.id);
        expect(JSON.stringify(client.documents.slice(0, 2))).toBe(before);
        expect(client.documents).toHaveLength(3);
    });
});

describe('updateExistingDocument', () => {
    it('stores the new file and per-standard map on a bulk-imported document', () => {
        const doc = { id: 'x', name: 'Change Management Procedure', category: 'Procedures', date: '2025-01-01', linkedClauses: '4.1, 4.2', source: 'bulk-import', storagePath: '' };
        B.updateExistingDocument(doc, {
            clauses: '6.3, 8.5.1, A.8.32', clauseMap: { iso27001: ['6.3', 'A.8.32'], iso20000: ['8.5.1'] }, standardIds: '', headings: [{ text: 'Purpose' }],
            notes: 'fresh', revision: 'Rev 3', file: { name: 'Change Management Procedure.pdf' }, ext: 'pdf', sizeMB: '0.20', path: 'PCC/Change Management Procedure.pdf'
        }, { path: 'clients/pcc/1_Change.pdf', url: '' }, 'Cara');
        expect(doc).toMatchObject({
            id: 'x', category: 'Procedures', date: '2025-01-01', linkedClauses: '6.3, 8.5.1, A.8.32', clauseMap: { iso27001: ['6.3', 'A.8.32'], iso20000: ['8.5.1'] },
            storagePath: 'clients/pcc/1_Change.pdf', fileName: 'Change Management Procedure.pdf', revision: 'Rev 3', notes: 'fresh', type: 'PDF', updatedBy: 'Cara'
        });
    });

    it('keeps the old stored file when the new one was not stored', () => {
        const doc = { id: 'x', name: 'N', linkedClauses: '', source: 'bulk-import', storagePath: 'clients/pcc/old.pdf', fileName: 'old.pdf' };
        B.updateExistingDocument(doc, { clauses: '7.5', file: { name: 'new.pdf' } }, null, 'Cara');
        expect(doc.storagePath).toBe('clients/pcc/old.pdf');
        expect(doc.fileName).toBe('old.pdf');
        expect(doc.linkedClauses).toBe('7.5');
    });

    it('merges a hand-linked clause into every standard of the new map', () => {
        const doc = { id: 'h', name: 'N', linkedClauses: '9.2', source: 'manual' };
        B.updateExistingDocument(doc, { clauses: '6.3, 8.5.1', clauseMap: { iso27001: ['6.3'], iso20000: ['8.5.1'] } }, null, 'Cara');
        expect(doc.clauseMap).toEqual({ iso27001: ['6.3', '9.2'], iso20000: ['8.5.1', '9.2'] });
        expect(doc.linkedClauses).toBe('6.3, 8.5.1, 9.2');
    });
});
