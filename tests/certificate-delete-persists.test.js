import { describe, it, expect, beforeEach, vi } from 'vitest';

// Deleting a certification scope removed it from the browser's copy only. The
// certificate lives in the cloud copy of the client (data.certificates) and in
// certification_decisions, so the next load from the cloud brought it back.
globalThis.window = globalThis.window || globalThis;
globalThis.Logger = window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.Sanitizer = { sanitizeText: s => (s ? String(s) : ''), sanitizeEmail: s => s || '', sanitizeURL: s => s || '' };
window.state = { clients: [] };
window.saveData = () => { };
window.showNotification = () => { };
window.renderClientDetail = () => { };
if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
    globalThis.crypto = { randomUUID: () => 'uuid-' + Math.random().toString(16).slice(2) };
}

const fs = await import('fs');
const path = await import('path');
eval(fs.readFileSync(path.resolve('./utils.js'), 'utf8'));
eval(fs.readFileSync(path.resolve('./clients-import.js'), 'utf8')
    .replace(/\nif \(typeof module !== 'undefined' && module\.exports\) \{[\s\S]*$/, ''));

const flush = () => new Promise(r => setTimeout(r, 0));

describe('deleting a certification scope', () => {
    let client, notes;
    beforeEach(() => {
        notes = [];
        window.showNotification = (msg, type) => notes.push({ msg, type });
        window.confirm = () => true;
        client = {
            id: 'sg1888', name: 'SG 1888 (PVT.) LTD.',
            certificates: [
                { id: 'CERT-GMP', standard: 'GMP', initialDate: '2023-02-03' },
                { id: 'CERT-PSC', standard: 'Product Safety Certification', initialDate: '2023-09-20' },
                { id: 'CERT-HALAL', standard: 'Halal', initialDate: '2023-09-20' }
            ]
        };
        window.state.clients = [client];
        window.SupabaseClient = { isInitialized: true };
        window.DataService = {
            findClient: id => window.state.clients.find(c => c.id === id),
            syncClient: vi.fn(async () => true),
            deleteCertificate: vi.fn(async () => true)
        };
    });

    it('removes it from the cloud copy of the client and from certification_decisions', async () => {
        window.deleteCertificationScope('sg1888', 1);
        await flush();

        expect(client.certificates.map(c => c.standard)).toEqual(['GMP', 'Halal']);
        expect(window.DataService.syncClient).toHaveBeenCalledTimes(1);
        const synced = window.DataService.syncClient.mock.calls[0][0];
        expect(synced.certificates.map(c => c.id)).not.toContain('CERT-PSC');
        expect(window.DataService.deleteCertificate).toHaveBeenCalledWith('CERT-PSC', { silent: true });
    });

    it('warns when the cloud copy could not be updated, since the record would come back', async () => {
        window.DataService.syncClient = vi.fn(async () => false);
        window.deleteCertificationScope('sg1888', 1);
        await flush();
        expect(notes.some(n => n.type === 'warning' && /reappear/.test(n.msg))).toBe(true);
    });

    it('does nothing when the user cancels', async () => {
        window.confirm = () => false;
        window.deleteCertificationScope('sg1888', 1);
        await flush();
        expect(client.certificates).toHaveLength(3);
        expect(window.DataService.syncClient).not.toHaveBeenCalled();
    });
});
