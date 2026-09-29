import { describe, it, expect, beforeEach, vi } from 'vitest';

globalThis.window = globalThis.window || globalThis;
globalThis.Logger = window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.state = { clients: [] };
window.saveData = () => { };
window.renderClientDetail = () => { };

const fs = await import('fs');
const path = await import('path');
eval(fs.readFileSync(path.resolve('./utils.js'), 'utf8'));
const U = window.UTILS;
eval(fs.readFileSync(path.resolve('./clients-org-setup.js'), 'utf8')
    .replace(/\nif \(typeof module !== 'undefined' && module\.exports\) \{[\s\S]*$/, ''));

describe('cGMP is its own standard', () => {
    it('does not fold cGMP into GMP', () => {
        expect(U.canonicalStandard('cGMP')).toBe('cGMP');
        expect(U.canonicalStandard('GMP')).toBe('GMP');
        expect(U.canonicalStandard('GMP - Good Manufacturing Practice')).toBe('GMP');
    });

    it('lets GMP be deselected on a site that holds cGMP', () => {
        const site = 'ISO 9001:2015, Halal, cGMP';
        expect(U.isStandardSelected(site, 'cGMP')).toBe(true);
        expect(U.isStandardSelected(site, 'GMP')).toBe(false);
    });
});

describe('Sync Standards', () => {
    let client, notes;
    beforeEach(() => {
        notes = [];
        window.showNotification = (msg, type) => notes.push({ msg, type });
        client = {
            id: 'sg', name: 'SG 1888', standard: 'ISO 9001',
            sites: [{ name: 'Head Office', standards: 'ISO 9001:2015, Halal, cGMP' }],
            certificates: [{ id: 'C1', standard: 'ISO 9001:2015' }, { id: 'C2', standard: 'Halal' }, { id: 'C3', standard: 'GMP' }]
        };
        window.state.clients = [client];
        window.DataService = { findClient: id => window.state.clients.find(c => c.id === id), syncClient: vi.fn(async () => true) };
    });

    it('creates records only for standards with none — compared by canonical name', () => {
        window.generateCertificatesFromStandards('sg');
        // "ISO 9001" and "ISO 9001:2015" are one standard; cGMP is not GMP.
        expect(client.certificates.map(c => c.standard)).toEqual(['ISO 9001:2015', 'Halal', 'GMP', 'cGMP']);
        expect(notes[0].msg).toMatch(/cGMP/);
    });

    it('says so when nothing is missing', () => {
        client.sites[0].standards = 'ISO 9001:2015, Halal';
        window.generateCertificatesFromStandards('sg');
        expect(client.certificates).toHaveLength(3);
        expect(notes[0].msg).toMatch(/already has a certificate record/);
    });
});
