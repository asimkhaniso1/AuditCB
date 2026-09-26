import { describe, it, expect, beforeEach, vi } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = window.state || {};
window.state.knowledgeBase = { standards: [], sops: [], policies: [], marketing: [] };
window.switchSettingsSubTab = () => {};

const fs = await import('fs');
const path = await import('path');
const utils = await import('../utils.js');
window.UTILS = window.UTILS || utils.default || utils;
const source = fs.readFileSync(path.resolve('./settings-kb.js'), 'utf8');
new Function(source)();

const STANDARD = {
    id: 1771, name: 'ISO 20000-1:2018', fileName: 'ISO_IEC_20000-1_2018.pdf', uploadDate: '2026-02-17', status: 'ready',
    clauses: [{ clause: '4.1', title: 'Understanding the organization and its context', content: 'x' }],
    cloudPath: 'standard/1771_ISO_IEC_20000-1_2018.pdf', cloudUrl: 'https://example.supabase.co/storage/v1/object/public/documents/standard/1771.pdf'
};

function mountModal() {
    document.body.innerHTML = '<h3 id="modal-title"></h3><div id="modal-body"></div><div id="modal-save"></div><div id="modal-overlay"></div>';
}

describe('Knowledge Base analysis — view the linked source file', () => {
    let notes;
    beforeEach(() => {
        notes = [];
        window.showNotification = (msg, type) => notes.push({ msg, type });
        window.openModal = () => {};
        window.state.auditReports = [];
        window.state.knowledgeBase = { standards: [JSON.parse(JSON.stringify(STANDARD))], sops: [], policies: [], marketing: [] };
        mountModal();
    });

    it('offers a View File button when the entry has a stored file', () => {
        window.viewKBAnalysis(STANDARD.id);
        const btn = document.querySelector('#modal-body [data-action="openKBFile"]');
        expect(btn).toBeTruthy();
        expect(btn.dataset.id).toBe(String(STANDARD.id));
        expect(btn.textContent).toMatch(/View File/);
    });

    it('says so instead of a dead button when no file was stored', () => {
        window.state.knowledgeBase.standards[0].cloudPath = null;
        window.state.knowledgeBase.standards[0].cloudUrl = null;
        window.viewKBAnalysis(STANDARD.id);
        expect(document.querySelector('#modal-body [data-action="openKBFile"]')).toBeNull();
        expect(document.getElementById('modal-body').textContent).toMatch(/No file stored/);
    });

    it('opens a signed URL for the stored path (bucket may be private)', async () => {
        const tab = { opener: 'x', location: { href: '' }, close: vi.fn() };
        window.open = vi.fn(() => tab);
        const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://signed.example/file.pdf?token=t' }, error: null }));
        window.SupabaseClient = { isInitialized: true, client: { storage: { from: vi.fn(() => ({ createSignedUrl })) } } };

        await window.openKBFile(STANDARD.id);

        expect(window.open).toHaveBeenCalledWith('', '_blank');   // opened before the await, so not popup-blocked
        expect(window.SupabaseClient.client.storage.from).toHaveBeenCalledWith('documents');
        expect(createSignedUrl).toHaveBeenCalledWith(STANDARD.cloudPath, 600);
        expect(tab.location.href).toBe('https://signed.example/file.pdf?token=t');
        expect(tab.opener).toBeNull();
    });

    it('falls back to the URL saved at upload when a signed URL cannot be made', async () => {
        const tab = { opener: null, location: { href: '' }, close: vi.fn() };
        window.open = vi.fn(() => tab);
        window.SupabaseClient = { isInitialized: false };
        await window.openKBFile(STANDARD.id);
        expect(tab.location.href).toBe(STANDARD.cloudUrl);
    });

    it('warns and opens nothing when the entry has no file', async () => {
        window.state.knowledgeBase.standards[0].cloudPath = null;
        window.state.knowledgeBase.standards[0].cloudUrl = null;
        window.open = vi.fn();
        await window.openKBFile(STANDARD.id);
        expect(window.open).not.toHaveBeenCalled();
        expect(notes[0].type).toBe('warning');
    });
});
