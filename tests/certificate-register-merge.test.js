import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };
globalThis.Logger = window.Logger;
const fs = await import('fs');
const path = await import('path');
eval(fs.readFileSync(path.resolve('./utils.js'), 'utf8'));
const SC = require('../supabase-client.js');

// SG 1888: the client record holds what Settings shows; the register
// (certification_decisions) still holds rows for certificates deleted here.
const own = [
    { id: 'C-9001', standard: 'ISO 9001:2015', certificateNo: '23PK9001', initialDate: '2023-02-03' },
    { id: 'C-HALAL', standard: 'Halal', certificateNo: 'CR/IHC/SG/09/24/HC' },
    { id: 'C-CGMP', standard: 'cGMP', certificateNo: '' }                                   // made by Sync Standards
];
const register = [
    { id: 'C-9001', standard: 'ISO 9001:2015', certificateNo: '23PK9001', expiryDate: '2027-02-02', siteScopes: {} },
    { id: 'C-GMP', standard: 'GMP', certificateNo: '23PK9012' },                              // deleted here
    { id: 'C-PSC', standard: 'Product Safety Certification', certificateNo: 'CR/IHC/SG/09/24/PSC' }, // deleted here
    { id: 'C-NEW', standard: 'HACCP', certificateNo: 'NEW-1' }                                 // issued in Certifications module
];

describe('loading certificates: client list merged with the register, never replaced by it', () => {
    const merged = SC.mergeRegisterCertificates(own, register, ['C-GMP', 'Product Safety Certification|CR/IHC/SG/09/24/PSC']);
    const standards = merged.map(c => c.standard);

    it('does not revive certificates deleted on the client (by id or by standard + number)', () => {
        expect(standards).not.toContain('GMP');
        expect(standards).not.toContain('Product Safety Certification');
    });

    it('keeps records the register never had (created by Sync Standards)', () => {
        expect(standards).toContain('cGMP');
    });

    it('updates a matching record from the register, without blanking fields the register lacks', () => {
        const iso = merged.find(c => c.id === 'C-9001');
        expect(iso.expiryDate).toBe('2027-02-02');
        expect(iso.initialDate).toBe('2023-02-03');
    });

    it('adds a certificate issued in the Certifications module that the client record lacks', () => {
        expect(standards).toContain('HACCP');
    });

    it('takes the register as-is for a client with no own list (legacy records)', () => {
        expect(SC.mergeRegisterCertificates([], register, []).map(c => c.id)).toEqual(['C-9001', 'C-GMP', 'C-PSC', 'C-NEW']);
    });

    it('does not mutate the inputs', () => {
        expect(own[0].expiryDate).toBeUndefined();
    });
});
