import { describe, it, expect, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import fs from 'fs';
import path from 'path';

// csp-boot.js used to redirect every visitor without a localStorage flag to
// /?v=<ver>&purge=<ts>, so each first-time or private-window visit downloaded
// the whole app twice, and it wiped the Cache API on every load. Assets are
// content-hashed by build.js and index.html is served no-cache, so the reload
// is gone; the stale-URL clean-up and a one-time SW/cache cleanup remain.

function boot({ search = '', hash = '', storage = {} } = {}) {
    const navigations = [];
    const location = {
        pathname: '/',
        search,
        hash,
        assign: vi.fn(u => navigations.push(u)),
        replace: vi.fn(u => navigations.push(u)),
        reload: vi.fn(() => navigations.push('reload'))
    };
    Object.defineProperty(location, 'href', {
        get: () => location.pathname + location.search + location.hash,
        set: u => navigations.push(u)
    });
    const store = Object.assign({}, storage);
    const localStorage = {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; }
    };
    const cacheDeletes = [];
    const caches = {
        keys: vi.fn(() => Promise.resolve(['old-v18'])),
        delete: vi.fn(n => { cacheDeletes.push(n); return Promise.resolve(true); })
    };
    const unregister = vi.fn();
    const navigator = { serviceWorker: { getRegistrations: vi.fn(() => Promise.resolve([{ unregister }])) } };
    const history = { replaceState: vi.fn() };
    const win = { location, history, caches, DOMPurify: { sanitize: s => s } };
    const document = { addEventListener: () => { }, createElement: () => ({}), head: { appendChild() { } } };
    loadScript('./csp-boot.js', { params: { window: win, localStorage, navigator, caches, document, module: undefined, DOMPurify: win.DOMPurify } });
    return { navigations, location, history, caches, navigator, unregister, store, cacheDeletes };
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe('csp-boot.js — no forced reload', () => {
    it('a fresh visitor (empty localStorage) is not redirected', async () => {
        const env = boot();
        await flush();
        expect(env.navigations).toEqual([]);
        expect(env.location.assign).not.toHaveBeenCalled();
        expect(env.location.replace).not.toHaveBeenCalled();
        expect(env.location.reload).not.toHaveBeenCalled();
        expect(env.history.replaceState).not.toHaveBeenCalled();
    });

    it('cleans up old service workers and caches once, not on every load', async () => {
        const first = boot();
        await flush();
        expect(first.unregister).toHaveBeenCalledTimes(1);
        expect(first.cacheDeletes).toEqual(['old-v18']);

        const second = boot({ storage: first.store });
        await flush();
        expect(second.caches.keys).not.toHaveBeenCalled();
        expect(second.navigator.serviceWorker.getRegistrations).not.toHaveBeenCalled();
        expect(second.navigations).toEqual([]);
    });

    it('a stale ?v=…&purge=… URL is cleaned in place, keeping the hash', () => {
        const env = boot({ search: '?v=19.0&purge=1712345678901', hash: '#/clients' });
        expect(env.navigations).toEqual([]);
        expect(env.history.replaceState).toHaveBeenCalledWith(null, '', '/#/clients');
    });

    it('only the old cache-busting params are removed', () => {
        const env = boot({ search: '?foo=1&purge=2&v=19.0', storage: { 'v19.0_reloaded': 'true' } });
        expect(env.history.replaceState).toHaveBeenCalledWith(null, '', '/?foo=1');
    });

    it('a blocked localStorage does not break boot', () => {
        expect(() => {
            const win = { location: { pathname: '/', search: '', hash: '' }, history: { replaceState() { } } };
            const throwing = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
            loadScript('./csp-boot.js', { params: { window: win, localStorage: throwing, navigator: {}, caches: undefined, document: { addEventListener() { } }, module: undefined, DOMPurify: undefined } });
        }).not.toThrow();
    });
});
