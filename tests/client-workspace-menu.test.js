import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

// Reloading the app on a client URL (#client/<id>/overview) left the GLOBAL
// sidebar menu up: state.activeClientId is saved to IndexedDB with the rest of
// state, so on load the router saw "already in this client's workspace" and
// skipped building the client menu. The client's Document Center (and
// Compliance, Checklists, ...) links never appeared, and the "My Clients" list
// stayed open. renderClientDetail sets activeClientId the same way.

const GLOBAL_MENU = '<li data-module="dashboard">Dashboard</li><li data-module="clients">Clients</li><li data-module="settings">Settings</li>';
const PCC = { id: 'ca1e77a0-b661-46f7-bf4f-a0910ac1176a', name: 'PC CONNECTION, INC.' };
const LEGACY = { id: 42, name: 'Legacy Numeric Ltd' };

let rendered;
beforeAll(() => {
    globalThis.window = globalThis.window || globalThis;
    window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };
    window.UTILS = { escapeHtml: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') };
    loadScript('./client-workspace.js', { params: { module: undefined } });
});

beforeEach(() => {
    document.body.innerHTML = `
        <aside id="sidebar"><div id="cb-logo-display"></div><nav class="main-nav"><ul>${GLOBAL_MENU}</ul></nav></aside>
        <aside class="client-sidebar"></aside>
        <h2 id="page-title"></h2><div id="content-area"></div>`;
    rendered = [];
    window.renderClientModule = (id, mod) => rendered.push([String(id), mod]);
    window.showNotification = () => { };
});

const menuHashes = () => Array.from(document.querySelectorAll('.main-nav ul li[data-hash]')).map(li => li.getAttribute('data-hash'));

describe('opening a client URL shows the client menu', () => {
    it('after a reload, with activeClientId restored from storage', () => {
        // state as restored by loadState(): the client is already "active"
        window.state = { clients: [PCC], activeClientId: PCC.id };
        window.openClientRoute(PCC.id, 'overview');
        expect(menuHashes()).toContain(`client/${PCC.id}/docs`);
        expect(document.querySelector(`li[data-hash="client/${PCC.id}/docs"]`).textContent).toMatch(/Document Center/);
        expect(document.querySelector('.client-sidebar').classList.contains('hidden')).toBe(true);
        expect(rendered).toEqual([[PCC.id, 'overview']]);
    });

    it('after renderClientDetail set activeClientId from the global Clients screen', () => {
        window.state = { clients: [PCC], activeClientId: String(PCC.id) };
        window.openClientRoute(PCC.id, 'docs');
        expect(menuHashes()).toContain(`client/${PCC.id}/docs`);
        expect(rendered).toEqual([[PCC.id, 'docs']]);
    });

    it('does not rebuild the menu when moving between this client’s tabs', () => {
        window.state = { clients: [PCC], activeClientId: null };
        window.openClientRoute(PCC.id, 'overview');
        const menu = document.querySelector('.main-nav ul');
        const first = menu.firstElementChild;
        window.openClientRoute(PCC.id, 'docs');
        expect(menu.firstElementChild).toBe(first); // same nodes: not re-rendered
        expect(rendered.map(r => r[1])).toEqual(['overview', 'docs']);
    });

    it('switching to another client rebuilds the menu for that client', () => {
        window.state = { clients: [PCC, LEGACY], activeClientId: null };
        window.openClientRoute(PCC.id, 'overview');
        window.openClientRoute('42', 'overview');
        expect(menuHashes()).toContain('client/42/docs');
        expect(menuHashes()).not.toContain(`client/${PCC.id}/docs`);
        expect(window.state.activeClientId).toBe(42); // the record's own id
    });

    it('works for a client with a numeric id reached through the (string) hash', () => {
        window.state = { clients: [LEGACY], activeClientId: 42 };
        window.openClientRoute('42', 'overview');
        expect(window.isClientMenuShown(42)).toBe(true);
        expect(menuHashes()).toContain('client/42/docs');
    });
});

describe('the router uses it', () => {
    it('handleRouteChange hands client routes to openClientRoute', () => {
        const src = fs.readFileSync(path.resolve('./script.js'), 'utf8');
        const router = src.slice(src.indexOf('function handleRouteChange'), src.indexOf('function updateActiveNavItem'));
        expect(router).toMatch(/window\.openClientRoute\(clientId, subModule\)/);
    });
});
