import { describe, it, expect, beforeEach } from 'vitest';

// The client list (clients-list-v16.js overrides the clients-module.js version)
// sorts the whole filtered set before paging, so page 1 really is the first page
// of the chosen order.
globalThis.window = globalThis.window || globalThis;
globalThis.Logger = window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.UTILS = { escapeHtml: s => String(s == null ? '' : s) };
window.AuthManager = { canPerform: () => true };
window.DataService = { findClient: id => window.state.clients.find(c => String(c.id) === String(id)) };
window.showNotification = () => { };
window.saveData = () => { };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./clients-list-v16.js'), 'utf8');
eval(src);

// The module renders into window.contentArea; jsdom supplies the rest.
window.contentArea = document.createElement('div');

function renderAndReadNames() {
    window.renderClientsEnhanced();
    // Read the rendered cells, not the markup: innerHTML re-encodes "&" and the
    // point here is the order the user sees.
    const cells = window.contentArea.querySelectorAll('tbody tr td:first-child');
    return {
        html: window.contentArea.innerHTML,
        names: Array.from(cells).map(td => td.textContent.trim())
    };
}

const CLIENTS = [
    { id: 1, name: 'ZEPHYRS', standard: 'ISO 9001:2015', status: 'Active' },
    { id: 2, name: 'ahmed enterprises', standard: 'ISO 14001:2015', status: 'Withdrawn' },
    { id: 3, name: 'SG 1888 (PVT.) LTD.', standard: 'GMP, ISO 9001:2015', status: 'Active' },
    { id: 4, name: 'SG 200 Ltd.', standard: 'CE-Marking', status: 'Suspended' },
    { id: 5, name: 'B&K International', standard: 'ISO 9001:2015, GMP', status: 'Active' }
];

beforeEach(() => {
    window.state = {
        clients: CLIENTS.map(c => ({ ...c })),
        currentUser: { role: 'Admin' },
        clientFilterStatus: 'All',
        clientSearchTerm: '',
        clientPagination: { currentPage: 1, itemsPerPage: 50 },
        clientSort: null
    };
});

describe('deleting a duplicate client', () => {
    // Linked records carry the client NAME, so a name-based cascade would take
    // the surviving twin's audits with it.
    beforeEach(() => {
        window.state.clients = [
            { id: 'keep', name: 'B&K International', status: 'Active' },
            { id: 'copy', name: 'B&K International', status: 'Active' }
        ];
        window.state.auditPlans = [{ id: 'p1', clientId: 'keep', client: 'B&K International' }];
        window.state.auditReports = [{ id: 'r1', client: 'B&K International' }];
        window.state.auditPrograms = [];
        window.state.certificationDecisions = [];
        globalThis.confirm = () => true;
    });

    it('keeps the twin\'s records when deleting the copy', async () => {
        await window.deleteClient('copy');
        expect(window.state.clients.map(c => c.id)).toEqual(['keep']);
        expect(window.state.auditPlans).toHaveLength(1);
        expect(window.state.auditReports).toHaveLength(1);   // name-linked, so preserved
    });

    it('still cascades by name once no twin remains', async () => {
        await window.deleteClient('copy');
        await window.deleteClient('keep');
        expect(window.state.clients).toEqual([]);
        expect(window.state.auditPlans).toHaveLength(0);
        expect(window.state.auditReports).toHaveLength(0);
    });
});

describe('client list sorting', () => {
    it('opens sorted by name ascending, case-insensitively', () => {
        const { names } = renderAndReadNames();
        expect(names).toEqual(['ahmed enterprises', 'B&K International', 'SG 200 Ltd.', 'SG 1888 (PVT.) LTD.', 'ZEPHYRS']);
    });

    it('orders embedded numbers naturally (SG 200 before SG 1888)', () => {
        const { names } = renderAndReadNames();
        expect(names.indexOf('SG 200 Ltd.')).toBeLessThan(names.indexOf('SG 1888 (PVT.) LTD.'));
    });

    it('flips direction when the active column is clicked again', () => {
        window.sortClients('name');   // already the active column → becomes desc
        expect(window.state.clientSort).toEqual({ field: 'name', dir: 'desc' });
        expect(renderAndReadNames().names[0]).toBe('ZEPHYRS');

        window.sortClients('name');
        expect(window.state.clientSort).toEqual({ field: 'name', dir: 'asc' });
        expect(renderAndReadNames().names[0]).toBe('ahmed enterprises');
    });

    it('starts a newly chosen column ascending', () => {
        window.sortClients('name');
        window.sortClients('status');
        expect(window.state.clientSort).toEqual({ field: 'status', dir: 'asc' });
        const { names } = renderAndReadNames();
        expect(names[names.length - 1]).toBe('ahmed enterprises');   // Withdrawn sorts last
    });

    it('sorts the Standard column by the first badge shown', () => {
        window.sortClients('standard');
        const { names } = renderAndReadNames();
        expect(names[0]).toBe('SG 200 Ltd.');            // CE-Marking
        expect(names[1]).toBe('SG 1888 (PVT.) LTD.');    // GMP
    });

    it('returns to page 1 so a reorder cannot strand you off the end', () => {
        window.state.clientPagination = { currentPage: 3, itemsPerPage: 2 };
        window.sortClients('status');
        expect(window.state.clientPagination.currentPage).toBe(1);
    });

    it('ignores an unknown column instead of sorting by nothing', () => {
        window.sortClients('name');
        const before = { ...window.state.clientSort };
        window.sortClients('__proto__');
        expect(window.state.clientSort).toEqual(before);
    });

    it('sorts the whole set, not just the visible page', () => {
        window.state.clientPagination = { currentPage: 1, itemsPerPage: 2 };
        expect(renderAndReadNames().names).toEqual(['ahmed enterprises', 'B&K International']);
    });

    it('marks the active header for assistive tech and offers a real button', () => {
        window.sortClients('status');
        const { html } = renderAndReadNames();
        expect(html).toContain('aria-sort="ascending"');
        expect(html).toContain('<button type="button" data-action="sortClients" data-id="status"');
        expect(html).toContain('data-id="name"');   // the other columns stay sortable
    });
});
