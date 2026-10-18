// SheetJS, PDF.js and mammoth used to load on every page view (~1.8 MB), and
// html2pdf (~0.9 MB) loaded though nothing called it. They now load on first
// use through lib-loader.js, with the same pinned URLs and SRI hashes.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (f) => fs.readFileSync(path.resolve(f), 'utf8');
const LOADER = read('./lib-loader.js');

function freshLoader() {
    delete window.LibLoader;
    for (const g of ['XLSX', 'pdfjsLib', 'mammoth']) delete window[g];
    document.head.querySelectorAll('script').forEach(s => s.remove());
    new Function(LOADER)();
    return window.LibLoader;
}

const injected = () => [...document.head.querySelectorAll('script')];

describe('LibLoader', () => {
    let loader;
    beforeEach(() => { loader = freshLoader(); });

    it('resolves at once when the library is already present', async () => {
        window.XLSX = { read: () => {} };
        await expect(loader.load('xlsx')).resolves.toBe(window.XLSX);
        expect(injected()).toHaveLength(0);
    });

    it('injects one pinned script with SRI, shared by concurrent callers', async () => {
        const a = loader.load('xlsx');
        const b = loader.load('xlsx');
        expect(a).toBe(b);
        const [script] = injected();
        expect(injected()).toHaveLength(1);
        expect(script.src).toBe(loader.LIBS.xlsx.src);
        expect(script.integrity).toBe(loader.LIBS.xlsx.integrity);
        expect(script.crossOrigin).toBe('anonymous');
        window.XLSX = { ok: true };
        script.onload();
        await expect(a).resolves.toEqual({ ok: true });
    });

    it('rejects with a readable message on failure, then retries', async () => {
        const first = loader.load('pdfjs');
        injected()[0].onerror();
        await expect(first).rejects.toThrow(/Could not load the pdfjs library/);
        expect(injected()).toHaveLength(0);
        loader.load('pdfjs');
        expect(injected()).toHaveLength(1);
    });

    it('rejects when the script loads but its global is missing', async () => {
        const p = loader.load('mammoth');
        injected()[0].onload();
        await expect(p).rejects.toThrow(/mammoth is missing/);
    });

    it('rejects unknown names', async () => {
        await expect(loader.load('nope')).rejects.toThrow(/Unknown library/);
    });

    it('pins every library with sha384 SRI', () => {
        for (const [name, lib] of Object.entries(loader.LIBS)) {
            expect(lib.src, name).toMatch(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/[^/]+\/\d+\.\d+\.\d+\//);
            expect(lib.integrity, name).toMatch(/^sha384-[A-Za-z0-9+/=]{64}$/);
        }
    });
});

describe('index.html first load', () => {
    const html = read('./index.html');

    it('no longer loads the document libraries or html2pdf up front', () => {
        for (const lib of ['xlsx.full.min.js', 'pdf.min.js', 'mammoth.browser.min.js', 'html2pdf']) {
            expect(html, lib).not.toContain(lib);
        }
    });

    it('loads lib-loader.js before the modules that call it', () => {
        const order = [...html.matchAll(/<script src="\.\/([^"?]+)/g)].map(m => m[1]);
        const at = order.indexOf('lib-loader.js');
        expect(at).toBeGreaterThan(-1);
        expect(at).toBeLessThan(order.indexOf('clients-import.js'));
        expect(at).toBeLessThan(order.indexOf('settings-kb.js'));
    });
});

describe('call sites load on demand', () => {
    beforeEach(() => {
        freshLoader();
        window.state = { clients: [] };
        window.showNotification = vi.fn();
        window.closeModal = vi.fn();
        window.AuthManager = { canPerform: () => true };
    });

    it('client Excel import tells the user when SheetJS cannot load', async () => {
        new Function(read('./clients-import.js'))();
        window.LibLoader.load = vi.fn(() => Promise.reject(new Error('Could not load the xlsx library.')));
        await window.importClientsFromExcel(new File(['x'], 'clients.xlsx'));
        expect(window.LibLoader.load).toHaveBeenCalledWith('xlsx');
        expect(window.showNotification).toHaveBeenCalledWith('Could not load the xlsx library.', 'error');
    });

    it('CSV import does not load SheetJS', async () => {
        new Function(read('./clients-import.js'))();
        window.LibLoader.load = vi.fn();
        await window.importClientsFromExcel(new File(['Name\nAcme'], 'clients.csv'));
        expect(window.LibLoader.load).not.toHaveBeenCalled();
    });

    it('setup template download and setup import load SheetJS first', async () => {
        new Function(read('./clients-import.js'))();
        window.LibLoader.load = vi.fn(() => Promise.reject(new Error('offline')));
        await window.downloadAccountSetupTemplate('Acme');
        await window.processAccountSetupImport('c1', { files: [new File(['x'], 'setup.xlsx')] });
        expect(window.LibLoader.load.mock.calls).toEqual([['xlsx'], ['xlsx']]);
    });

    it('knowledge-base PDF extraction loads PDF.js and degrades to null if it cannot', async () => {
        new Function(read('./settings-kb.js'))();
        window.LibLoader.load = vi.fn(() => Promise.reject(new Error('offline')));
        const text = await window.extractTextFromFile(new File(['%PDF'], 'std.pdf', { type: 'application/pdf' }));
        expect(window.LibLoader.load).toHaveBeenCalledWith('pdfjs');
        expect(text).toBeNull();
    });
});
