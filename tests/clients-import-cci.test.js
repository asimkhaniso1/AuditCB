import { describe, it, expect, beforeEach } from 'vitest';

// clients-import.js is a browser script: give it the globals it touches at load
// time and inside importFromCCIJson, then eval it like the other module tests.
globalThis.window = globalThis.window || globalThis;
globalThis.Logger = window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.Sanitizer = {
    sanitizeText: s => (s ? String(s) : ''),
    sanitizeEmail: s => (s ? String(s).trim() : ''),
    sanitizeURL: s => (s ? String(s) : '')
};
window.UTILS = { escapeHtml: s => String(s == null ? '' : s) };
window.state = { clients: [] };
window.saveData = () => { };
window.showNotification = () => { };
window.DataService = { findClient: id => window.state.clients.find(c => c.id === id), syncClient: () => Promise.resolve() };
if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
    globalThis.crypto = { randomUUID: () => 'uuid-' + Math.random().toString(16).slice(2) };
}

const fs = await import('fs');
const path = await import('path');
// The trailing CommonJS export block names functions that live in sibling files (openNewClientModal, ...),
// so it is stripped before eval; only the window.* surface is exercised here.
const clientsImportSrc = fs.readFileSync(path.resolve('./clients-import.js'), 'utf8')
    .replace(/\nif \(typeof module !== 'undefined' && module\.exports\) \{[\s\S]*$/, '');
eval(clientsImportSrc);

const CCI = window.CCIImport;
const NOW = new Date('2026-08-21T00:00:00Z');

// Shapes lifted from the live CCI registry export (export_auditcb_clients.js).
function visiontech() {
    return {
        id: 'co-visiontech', name: 'VISIONTECH EXPORT INTERNATIONAL (PVT.) LTD.', active: true,
        country: 'Pakistan', industry: 'Healthcare & Medical',
        address: 'Plot # 3 & 4 Sector E-III, Phase-II, KEPZ, Landhi, Karachi',
        contact_name: 'Mr. Abdul Qadir', email: 'abdulqs508@gmail.com', total_employees: 50,
        certificates: [
            { id: 'k-ce', certificate_no: '26PK9004', applicable_standard: 'CE Marking', registration_date: '2026-04-28', current_issue_date: '2026-04-28', issue_end_date: '2099-04-27', validity_status: 'V', scope: 'Manufacturer of prescription eyewear and sunglasses for EU market', url_path: '/certificates/visiontech-export-international-pvt-ltd-ce-marking' },
            { id: 'k-md', certificate_no: '25PK9010', applicable_standard: 'ISO 13485-Med.Devices Mgmt.', registration_date: '2025-11-23', current_issue_date: '2025-11-23', issue_end_date: '2099-11-22', validity_status: 'V', body: 'Design &amp; manufacture of optical frames' }
        ]
    };
}
function salsoft() {
    return {
        id: 'co-salsoft', name: 'SALSOFT TECHNOLOGIES PVT LTD.', active: true, country: 'Pakistan', industry: 'IT & Technology',
        address: '47, NKCHS, Karachi', contact_name: 'Mr. Usman Ghaznavi', email: 'usman@salsoft.net', total_employees: 500,
        certificates: [
            { id: 'k-s1', certificate_no: '22PK9031', applicable_standard: 'ISO 27001-Info. Security Mgmt.', registration_date: '2022-09-16', current_issue_date: '2022-09-16', issue_end_date: '2024-09-14', validity_status: 'I', scope: 'Software development' },
            { id: 'k-s2', certificate_no: '22PK9030', applicable_standard: 'ISO 9001-Quality Management', registration_date: '2022-09-16', current_issue_date: '2023-09-16', issue_end_date: '2024-09-14', validity_status: 'V', scope: 'Software development' }
        ]
    };
}
function inactiveCo() {
    return {
        id: 'co-old', name: 'ADVANCED LABORATORIES PVT. LTD.', active: false, country: 'Pakistan',
        certificates: [{ id: 'k-old', certificate_no: '19PK9001', applicable_standard: 'ISO 9001-Quality Management', registration_date: '2019-01-01', issue_end_date: '2022-01-01', validity_status: 'I', scope: 'Lab testing' }]
    };
}

beforeEach(() => { window.state.clients = []; });

describe('CCIImport.mapCciStandard — CCI labels become the canonical app names', () => {
    it.each([
        ['ISO 9001-Quality Management', 'ISO 9001:2015'],
        ['ISO 14001-Environment Mgmt.', 'ISO 14001:2015'],
        ['ISO 45001-Health & Safety Mgmt.', 'ISO 45001:2018'],
        ['ISO 27001-Info. Security Mgmt.', 'ISO 27001:2022'],
        ['ISO 22000-Food Safety Mgmt.', 'ISO 22000:2018'],
        ['ISO 13485-Med.Devices Mgmt.', 'ISO 13485:2016'],
        ['ISO 20000-1-IT.Service Mgmt.', 'ISO 20000-1:2018'],
        ['ISO 22301-Business Cont. Mgmt.', 'ISO 22301:2019'],
        ['ISO 17100:2015', 'ISO 17100:2015'],
        ['ISO 18587:2017', 'ISO 18587:2017'],
        ['CE Marking', 'CE-Marking'],
        ['CE Marking / EU Directive', 'CE-Marking'],
        ['GMP - Good Manufacturing Practice', 'GMP'],
        ['RoHS Compliance', 'RoHS'],
        ['Halal Certification', 'Halal'],
        ['Product Safety Certification', 'Product Safety Certification'],
        ['  Food  Safety Certification ', 'Food Safety Certification'],
        ['', ''],
        [null, '']
    ])('%s → %s', (label, expected) => {
        expect(CCI.mapCciStandard(label)).toBe(expected);
    });
});

describe('CCIImport.mapCciStatus — every live validity code lands in the app vocabulary', () => {
    it('V in date is Active, V past its end date is Expired', () => {
        expect(CCI.mapCciStatus('V', '2099-01-01', NOW)).toBe('Active');
        expect(CCI.mapCciStatus('V', '2026-05-11', NOW)).toBe('Expired');
        expect(CCI.mapCciStatus('V', null, NOW)).toBe('Active');
    });
    it('I (not renewed), E and unknown codes are Expired, never Active', () => {
        expect(CCI.mapCciStatus('I', '2024-09-14', NOW)).toBe('Expired');
        expect(CCI.mapCciStatus('I', '2099-09-14', NOW)).toBe('Expired');
        expect(CCI.mapCciStatus('E', '2025-03-07', NOW)).toBe('Expired');
        expect(CCI.mapCciStatus('', '2099-01-01', NOW)).toBe('Expired');
    });
    it('S is Suspended; W and R (revoked) are Withdrawn', () => {
        expect(CCI.mapCciStatus('S', '2099-01-01', NOW)).toBe('Suspended');
        expect(CCI.mapCciStatus('W', '2099-01-01', NOW)).toBe('Withdrawn');
        expect(CCI.mapCciStatus('R', '2024-10-03', NOW)).toBe('Withdrawn');
    });
});

describe('CCIImport.websiteFromEmail — company mail domain becomes the website, free providers never do', () => {
    it.each([
        ['Rubeena@skincarepakistan.com', 'https://skincarepakistan.com'],
        ['usman@salsoft.net', 'https://salsoft.net'],
        ['info@ppf.com.pk', 'https://ppf.com.pk'],
        ['albasit_facilities786@hotmail.com', ''],
        ['abdulqs508@gmail.com', ''],
        ['someone@outlook.com', ''],
        ['not-an-email', ''],
        ['', ''],
        [null, '']
    ])('%s → %s', (email, expected) => {
        expect(CCI.websiteFromEmail(email)).toBe(expected);
    });
});

describe('CCIImport name matching — the same company spelled two ways is one client', () => {
    it.each([
        ['Visiontech Export Intl (Pvt.) Ltd.', 'VISIONTECH EXPORT INTERNATIONAL (PVT.) LTD.'],
        ['Shanghai Industries (Pvt) Ltd.', 'SHANGHAI INDUSTRIES (PVT) LTD.'],
        ['PC CONNECTION, INC.', 'PC Connection Inc'],
        ['KTD Select', 'KTD Select'],
        ['B&amp;K International', 'B&K International'],
        ['Pakistan Post Foundation', 'PAKISTAN POST FOUNDATION (Press Division)'],
        ['Overture Stars Partners', 'Overture Stars Partners Pakistan (Pvt.) Ltd.'],
        ['Al Basit Facilities', 'AL-BASIT FACILITIES MANAGEMENT (PVT.) LIMITED.'],
        ['PERAC Research & Development Foundation', 'PERAC RESEARCH & DEVELOPMENT FOUNDATION (PRD)']
    ])('"%s" matches "%s"', (a, b) => {
        expect(CCI.companyNamesMatch(a, b)).toBe(true);
    });

    it.each([
        ['SONERI CARE', 'SONERI INTERNATIONAL'],
        ['Lucky Aluminum', 'Lucky Cement'],
        ['APA GLOBAL', 'TAG GROUP OF COMPANIES'],
        ['Soneri', 'SONERI INTERNATIONAL'],                      // prefix too short to trust
        ['CCI Services - Internal Operations', 'VISIONTECH EXPORT INTERNATIONAL (PVT.) LTD.']
    ])('"%s" does not match "%s"', (a, b) => {
        expect(CCI.companyNamesMatch(a, b)).toBe(false);
    });

    it('findClientForCompany prefers the stamped cciCompanyId and skips clients bound elsewhere', () => {
        const clients = [
            { id: 1, name: 'Visiontech Export Intl (Pvt.) Ltd.', cciCompanyId: 'co-other' },
            { id: 2, name: 'Visiontech Export', cciCompanyId: 'co-visiontech' }
        ];
        expect(CCI.findClientForCompany(clients, { id: 'co-visiontech', name: 'VISIONTECH EXPORT INTERNATIONAL (PVT.) LTD.' }).id).toBe(2);
        // Same name, but client 1 belongs to a different CCI company, so no name fallback.
        expect(CCI.findClientForCompany([clients[0]], { id: 'co-new', name: 'VISIONTECH EXPORT INTERNATIONAL (PVT.) LTD.' })).toBeNull();
    });

    it('findClientForCompany refuses an ambiguous prefix match', () => {
        const clients = [{ id: 1, name: 'Pakistan Post Foundation Press' }, { id: 2, name: 'Pakistan Post Foundation Logistics' }];
        expect(CCI.findClientForCompany(clients, { name: 'Pakistan Post Foundation' })).toBeNull();
    });
});

describe('importFromCCIJson — a fresh registry export', () => {
    it('creates the client with canonical standards, dated certificates and the scope on the head office', () => {
        const result = window.importFromCCIJson({ companies: [visiontech()] }, { now: NOW });

        expect(result).toEqual({ imported: 1, updated: 0, certCount: 2, skippedInactive: 0 });
        expect(window.state.clients).toHaveLength(1);
        const c = window.state.clients[0];
        expect(c.name).toBe('VISIONTECH EXPORT INTERNATIONAL (PVT.) LTD.');
        expect(c.status).toBe('Active');
        expect(c.source).toBe('CCI');
        expect(c.cciCompanyId).toBe('co-visiontech');
        expect(c.industry).toBe('Healthcare & Medical');
        expect(c.employees).toBe(50);
        expect(c.standard).toBe('CE-Marking, ISO 13485:2016');
        expect(c.contacts[0]).toMatchObject({ name: 'Mr. Abdul Qadir', email: 'abdulqs508@gmail.com', role: 'Primary Contact' });
        expect(c.sites[0]).toMatchObject({ name: 'Head Office', country: 'Pakistan', employees: 50, standards: 'CE-Marking, ISO 13485:2016' });
        expect(c.sites[0].address).toContain('KEPZ');

        const ce = c.certificates.find(k => k.certificateNo === '26PK9004');
        expect(ce).toMatchObject({
            standard: 'CE-Marking', status: 'Active', revision: '00',
            initialDate: '2026-04-28', currentIssue: '2026-04-28', expiryDate: '2099-04-27',
            cciLabel: 'CE Marking', cciCertificateId: 'k-ce', client: c.name,
            registryUrl: 'https://companycertification.com/certificates/visiontech-export-international-pvt-ltd-ce-marking'
        });
        expect(ce.scope).toBe('Manufacturer of prescription eyewear and sunglasses for EU market');
        expect(ce.siteScopes['Head Office']).toBe(ce.scope);
        expect(ce.id).toMatch(/^CERT-/);

        const md = c.certificates.find(k => k.certificateNo === '25PK9010');
        expect(md.standard).toBe('ISO 13485:2016');
        expect(md.scope).toBe('Design & manufacture of optical frames'); // entity decoded, from `body`
    });

    it('skips inactive companies and never imports an I / date-expired certificate as Active', () => {
        const result = window.importFromCCIJson([salsoft(), inactiveCo()], { now: NOW });

        expect(result).toEqual({ imported: 1, updated: 0, certCount: 2, skippedInactive: 1 });
        expect(window.state.clients.map(c => c.name)).toEqual(['SALSOFT TECHNOLOGIES PVT LTD.']);
        const statuses = Object.fromEntries(window.state.clients[0].certificates.map(k => [k.certificateNo, k.status]));
        expect(statuses).toEqual({ '22PK9031': 'Expired', '22PK9030': 'Expired' });
    });

    it('derives the website from the company email domain, but not from a free mailbox', () => {
        window.importFromCCIJson({ companies: [salsoft(), visiontech()] }, { now: NOW });
        const sal = window.state.clients.find(c => /SALSOFT/.test(c.name));
        expect(sal.website).toBe('https://salsoft.net');
        const vt = window.state.clients.find(c => /VISIONTECH/.test(c.name));
        expect(vt.website).toBeUndefined();          // gmail address → no website invented
    });

    it('accepts flat SQL join rows (company columns repeated per certificate)', () => {
        const rows = [
            { company_name: 'SHAKIL TRADERS', country: 'Pakistan', certificate_no: '25PK9020', applicable_standard: 'Halal Certification', registration_date: '2025-01-23', issue_end_date: '2099-01-22', validity_status: 'V', body: 'Trading of spices' },
            { company_name: 'SHAKIL TRADERS', country: 'Pakistan', certificate_no: '25PK9021', applicable_standard: 'ISO 9001-Quality Management', registration_date: '2025-01-23', issue_end_date: '2099-01-22', validity_status: 'V', body: 'Trading of spices' }
        ];
        const result = window.importFromCCIJson(rows, { now: NOW });
        expect(result.imported).toBe(1);
        expect(result.certCount).toBe(2);
        const c = window.state.clients[0];
        expect(c.standard).toBe('Halal, ISO 9001:2015');
        expect(c.cciCompanyId).toBeUndefined(); // flat rows carry no trustworthy company id
    });

    it('throws on an empty export', () => {
        expect(() => window.importFromCCIJson({ companies: [] })).toThrow(/No records/);
    });
});

describe('importFromCCIJson — against clients that already exist in AuditCB', () => {
    it('updates the existing client instead of duplicating it, and only fills the gaps', () => {
        window.state.clients.push({
            id: 'vt', name: 'Visiontech Export Intl (Pvt.) Ltd.', status: 'Active', industry: 'Medical Devices',
            standard: 'ISO 13485:2016', employees: 0,
            contacts: [{ name: 'Abdul Qadir', email: '', phone: '+92 300 0000000', designation: 'GM Export' }],
            sites: [{ name: 'Landhi Plant', address: 'KEPZ Landhi', city: 'Karachi', country: '', employees: 0, standards: 'ISO 13485:2016' }],
            certificates: [{ id: 'CERT-existing', standard: 'ISO 13485:2016', certificateNo: '25PK9010', status: 'Active', revision: '02', siteScopes: { 'Landhi Plant': 'old scope' } }]
        });

        const result = window.importFromCCIJson({ companies: [visiontech()] }, { now: NOW });

        expect(result).toEqual({ imported: 0, updated: 1, certCount: 2, skippedInactive: 0 });
        expect(window.state.clients).toHaveLength(1);
        const c = window.state.clients[0];
        expect(c.name).toBe('Visiontech Export Intl (Pvt.) Ltd.');   // AuditCB spelling kept
        expect(c.cciCompanyId).toBe('co-visiontech');
        expect(c.industry).toBe('Medical Devices');                     // existing value wins
        expect(c.employees).toBe(50);                                   // gap filled
        expect(c.contacts[0]).toMatchObject({ name: 'Abdul Qadir', email: 'abdulqs508@gmail.com', phone: '+92 300 0000000', designation: 'GM Export' });
        expect(c.sites[0]).toMatchObject({ name: 'Landhi Plant', address: 'KEPZ Landhi', country: 'Pakistan', employees: 50, standards: 'ISO 13485:2016' });
        expect(c.standard).toBe('ISO 13485:2016, CE-Marking');

        // Existing certificate row is refreshed in place (same id, revision kept), scope lands on the real site name.
        const md = c.certificates.find(k => k.certificateNo === '25PK9010');
        expect(md.id).toBe('CERT-existing');
        expect(md.revision).toBe('02');
        expect(md.initialDate).toBe('2025-11-23');
        expect(md.expiryDate).toBe('2099-11-22');
        expect(md.siteScopes['Landhi Plant']).toBe('Design & manufacture of optical frames');
        expect(c.certificates).toHaveLength(2);
    });

    it('matches "Pakistan Post Foundation" to the registry entry with a division suffix', () => {
        window.state.clients.push({ id: 'ppf', name: 'Pakistan Post Foundation', status: 'Active', standard: 'ISO 9001:2015, ISO 27001:2022', contacts: [], sites: [], certificates: [] });
        const result = window.importFromCCIJson({
            companies: [{
                id: 'co-ppf', name: 'PAKISTAN POST FOUNDATION (Press Division)', active: true, country: 'Pakistan',
                certificates: [{ id: 'k-ppf', certificate_no: '26PK9009', applicable_standard: 'ISO 9001-Quality Management', registration_date: '2026-01-04', issue_end_date: '2099-01-03', validity_status: 'V', scope: 'Printing' }]
            }]
        }, { now: NOW });
        expect(result).toEqual({ imported: 0, updated: 1, certCount: 1, skippedInactive: 0 });
        expect(window.state.clients).toHaveLength(1);
        expect(window.state.clients[0].standard).toBe('ISO 9001:2015, ISO 27001:2022');
    });

    it('heals raw CCI labels left behind by the pre-mapping importer', () => {
        // The first production import ran before the label mapping existed, so
        // client.standard and site.standards hold "ISO 9001-Quality Management".
        window.state.clients.push({
            id: 'ab', name: 'AL-BASIT FACILITIES MANAGEMENT (PVT.) LIMITED.', status: 'Active',
            standard: 'ISO 9001-Quality Management', website: '',
            contacts: [{ name: 'Muhammad Amjad', email: 'albasit_facilities786@hotmail.com', role: 'Primary Contact' }],
            sites: [{ name: 'Head Office', country: 'Pakistan', standards: 'ISO 9001-Quality Management' }],
            certificates: [{ id: 'CERT-old', standard: 'ISO 9001-Quality Management', certificateNo: '22PK9016', status: 'Active', siteScopes: {} }]
        });
        const result = window.importFromCCIJson({
            companies: [{
                id: 'co-albasit', name: 'AL-BASIT FACILITIES MANAGEMENT (PVT.) LIMITED.', active: true, country: 'Pakistan',
                email: 'albasit_facilities786@hotmail.com',
                certificates: [{ id: 'k-ab', certificate_no: '22PK9016', applicable_standard: 'ISO 9001-Quality Management', registration_date: '2022-05-30', current_issue_date: '2026-05-30', issue_end_date: '2099-05-29', validity_status: 'V', scope: 'Facilities management services' }]
            }]
        }, { now: NOW });

        expect(result).toEqual({ imported: 0, updated: 1, certCount: 1, skippedInactive: 0 });
        const c = window.state.clients.find(x => x.id === 'ab');
        expect(c.standard).toBe('ISO 9001:2015');                    // label healed, no duplicate entry
        expect(c.sites[0].standards).toBe('ISO 9001:2015');
        expect(c.website).toBe('');                                  // hotmail → nothing invented
        const cert = c.certificates.find(k => k.certificateNo === '22PK9016');
        expect(c.certificates).toHaveLength(1);
        expect(cert.id).toBe('CERT-old');
        expect(cert.standard).toBe('ISO 9001:2015');
    });

    it('decodes the HTML-escaped text the pre-fix importer stored ("FD&amp;C" printing bug)', () => {
        window.state.clients.push({
            id: 'fdc', name: 'FD&amp;C (Private) Limited.', status: 'Active',
            standard: 'ISO 9001-Quality Management, ISO 14001-Environment Mgmt.',
            industry: 'IT &amp; Technology',
            contacts: [{ name: 'Mr. Shahid &amp; Co', email: '', role: 'Primary Contact' }],
            sites: [{ name: 'Head Office', address: 'F-116 SITE &amp; Annex, Karachi', country: 'Pakistan', standards: 'ISO 9001-Quality Management' }],
            certificates: []
        });
        const result = window.importFromCCIJson({
            companies: [{
                id: 'co-fdc', name: 'FD&C (Private) Limited.', active: true, country: 'Pakistan', industry: 'Manufacturing',
                certificates: [{ id: 'k-fdc', certificate_no: '22PK9017', applicable_standard: 'ISO 9001-Quality Management', registration_date: '2022-06-03', current_issue_date: '2026-06-03', issue_end_date: '2099-06-02', validity_status: 'V', scope: 'Fragrances & flavours' }]
            }]
        }, { now: NOW });

        expect(result).toEqual({ imported: 0, updated: 1, certCount: 1, skippedInactive: 0 });
        expect(window.state.clients).toHaveLength(1);
        const c = window.state.clients.find(x => x.id === 'fdc');
        expect(c.name).toBe('FD&C (Private) Limited.');
        expect(c.industry).toBe('IT & Technology');             // decoded in place, not overwritten
        expect(c.contacts[0].name).toBe('Mr. Shahid & Co');
        expect(c.sites[0].address).toBe('F-116 SITE & Annex, Karachi');
        expect(c.standard).toBe('ISO 9001:2015, ISO 14001:2015');
        expect(c.sites[0].standards).toBe('ISO 9001:2015');
        expect(c.certificates[0].scope).toBe('Fragrances & flavours');
        expect(c.certificates[0].client).toBe('FD&C (Private) Limited.');
    });

    it('is idempotent: a second import adds no certificates and picks up a status change', () => {
        window.importFromCCIJson({ companies: [visiontech()] }, { now: NOW });
        const again = visiontech();
        again.name = 'Visiontech Export International Pvt Ltd'; // registry renamed; id still matches
        again.certificates[0].validity_status = 'S';
        const result = window.importFromCCIJson({ companies: [again] }, { now: NOW });

        expect(result).toEqual({ imported: 0, updated: 1, certCount: 2, skippedInactive: 0 });
        expect(window.state.clients).toHaveLength(1);
        const c = window.state.clients[0];
        expect(c.certificates).toHaveLength(2);
        expect(c.certificates.find(k => k.certificateNo === '26PK9004').status).toBe('Suspended');
    });
});
