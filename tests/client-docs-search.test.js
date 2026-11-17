// Client Documents: search by name or number (PC Connection, 2026-11-17).
// 65 documents in one long table had no way to find one. Each document now has
// a number (#) and a search box filters by number, name, revision, category and
// linked clauses; a document's details row and notes row hide and show together.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
globalThis.Logger = window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.UTILS = { escapeHtml: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
window.AuthManager = { canPerform: () => true };
window.showNotification = () => { };
window.saveData = () => { };
window.state = { clients: [], auditPlans: [], checklists: [] };
loadScript('./clients-module.js', { params: { module: undefined }, append: '\nwindow.__getClientDocumentsHTML = getClientDocumentsHTML;' });

const client = { id: 'c1', name: 'PC CONNECTION, INC.', documents: [
    { id: 'd1', name: 'Access Control Procedure', category: 'Quality Procedures', linkedClauses: 'A.5.15, A.5.16, A.8.5', date: '2026-11-11', type: 'PDF', notes: 'Sections in document: 1 Purpose' },
    { id: 'd2', name: 'Asset Management Procedure', category: 'Quality Procedures', linkedClauses: 'A.5.9, A.5.10', date: '2026-11-11', type: 'PDF', notes: 'Sections in document: 1 Purpose' },
    { id: 'd3', name: 'Audit Plan for IT Service Management', category: 'Other', linkedClauses: '9.2', date: '2026-11-11', type: 'PDF' },
    { id: 'd4', name: 'Incident Management Process SOP', category: 'Quality Procedures', revision: 'Rev 8.1', linkedClauses: '8.3.3, 8.6.1', date: '2026-08-06', type: 'PDF' }
] };

const visible = () => Array.from(document.querySelectorAll('#client-docs-table .client-doc-group'))
    .filter(g => g.style.display !== 'none').map(g => g.getAttribute('data-doc-no'));
const search = (q) => { const el = document.getElementById('client-docs-search'); el.value = q; return window.filterClientDocuments(el); };

beforeEach(() => { document.body.innerHTML = window.__getClientDocumentsHTML(client); });

describe('client documents search', () => {
    it('numbers the documents and shows the search box', () => {
        expect(document.getElementById('client-docs-search')).not.toBeNull();
        const nums = Array.from(document.querySelectorAll('#client-docs-table .client-doc-group')).map(g => g.querySelector('td').textContent.trim());
        expect(nums).toEqual(['1', '2', '3', '4']);
        expect(document.getElementById('client-docs-count').textContent).toBe('4 documents');
    });

    it('finds by name, every word must match, any case', () => {
        expect(search('procedure')).toBe(3);
        expect(search('ASSET management')).toBe(1);
        expect(visible()).toEqual(['2']);
        expect(document.getElementById('client-docs-count').textContent).toBe('1 of 4 documents');
    });

    it('a number on its own finds that document', () => {
        search('3');
        expect(visible()).toEqual(['3']);
    });

    it('finds by clause, revision and category', () => {
        search('A.5.16'); expect(visible()).toEqual(['1']);
        search('9.2'); expect(visible()).toEqual(['3']);
        search('rev 8.1'); expect(visible()).toEqual(['4']);
        search('other'); expect(visible()).toEqual(['3']);
    });

    it('hides a document\'s notes row with it, says when nothing matches, and clears', () => {
        search('zzz');
        expect(visible()).toEqual([]);
        expect(document.getElementById('client-docs-none').style.display).toBe('block');
        const group1 = document.querySelector('.client-doc-group[data-doc-no="1"]');
        expect(group1.querySelectorAll('tr').length).toBe(2);
        search('');
        expect(visible()).toEqual(['1', '2', '3', '4']);
        expect(document.getElementById('client-docs-none').style.display).toBe('none');
    });
});
