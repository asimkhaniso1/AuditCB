import { describe, it, expect, beforeEach } from 'vitest';

// DataMigration.healClientText repairs records written by older builds: text that
// was HTML-escaped before being stored, and certification-registry standard
// labels that never matched the app's own names.
globalThis.window = globalThis.window || globalThis;
globalThis.Logger = window.Logger = { debug() { }, info() { }, warn() { }, error() { } };

const fs = await import('fs');
const path = await import('path');
eval(fs.readFileSync(path.resolve('./utils.js'), 'utf8'));
const dataMigrationSrc = fs.readFileSync(path.resolve('./data-migration.js'), 'utf8')
    .replace(/\nif \(typeof module !== 'undefined' && module\.exports\) \{[\s\S]*$/, '');
eval(dataMigrationSrc);

const DM = window.DataMigration;

function escapedClient() {
    return {
        id: 'bk', name: 'B&amp;K International', status: 'Active',
        industry: 'Personal Care &amp; Cosmetics',
        standard: 'ISO 9001-Quality Management, GMP - Good Manufacturing Practice',
        contacts: [{ name: 'Khawaja Atif &amp; Sons', email: 'atif@bk.com', role: 'Primary Contact' }],
        sites: [{ name: 'Head Office', address: 'Amber Pride, Block-6 PECHS &amp; Annex', city: 'Karachi', country: 'Pakistan', standards: 'ISO 9001-Quality Management' }],
        certificates: [{
            id: 'CERT-1', certificateNo: '22PK9038', standard: 'ISO 9001-Quality Management', status: 'Active',
            scope: 'Manufacture &amp; supply of cosmetics', siteScopes: { 'Head Office': 'Manufacture &amp; supply of cosmetics' }
        }]
    };
}

beforeEach(() => { window.state = { clients: [] }; });

describe('UTILS.decodeEntities', () => {
    it('decodes one layer', () => {
        expect(window.UTILS.decodeEntities('B&amp;K International')).toBe('B&K International');
        expect(window.UTILS.decodeEntities('Tom &quot;T&quot; &#039;s &lt;b&gt;')).toBe('Tom "T" \'s <b>');
    });

    it('decodes text escaped repeatedly by successive saves', () => {
        expect(window.UTILS.decodeEntities('B&amp;amp;K International')).toBe('B&K International');
        expect(window.UTILS.decodeEntities('B&amp;amp;amp;K International')).toBe('B&K International');
        expect(window.UTILS.decodeEntities('S.J. &amp;amp; G. FAZUL ELLAHIE')).toBe('S.J. & G. FAZUL ELLAHIE');
    });

    it('leaves clean text, non-strings and ampersand-free text untouched', () => {
        expect(window.UTILS.decodeEntities('FD&C (Private) Limited.')).toBe('FD&C (Private) Limited.');
        expect(window.UTILS.decodeEntities('Bluebird Paint')).toBe('Bluebird Paint');
        expect(window.UTILS.decodeEntities(null)).toBe(null);
        expect(window.UTILS.decodeEntities(42)).toBe(42);
    });
});

describe('DataMigration.healClientText', () => {
    it('decodes every escaped field and canonicalises the standards', () => {
        const c = escapedClient();
        const result = DM.healClientText([c]);

        expect(result.changed).toEqual([c]);
        expect(result.decoded).toBe(1);
        expect(result.relabelled).toBe(1);

        expect(c.name).toBe('B&K International');
        expect(c.industry).toBe('Personal Care & Cosmetics');
        expect(c.contacts[0].name).toBe('Khawaja Atif & Sons');
        expect(c.sites[0].address).toBe('Amber Pride, Block-6 PECHS & Annex');
        expect(c.standard).toBe('ISO 9001:2015, GMP');
        expect(c.sites[0].standards).toBe('ISO 9001:2015');
        expect(c.certificates[0].standard).toBe('ISO 9001:2015');
        expect(c.certificates[0].scope).toBe('Manufacture & supply of cosmetics');
        expect(c.certificates[0].siteScopes['Head Office']).toBe('Manufacture & supply of cosmetics');
    });

    it('is idempotent — a second pass reports nothing changed', () => {
        const c = escapedClient();
        DM.healClientText([c]);
        const second = DM.healClientText([c]);
        expect(second.changed).toEqual([]);
        expect(second.decoded).toBe(0);
        expect(second.relabelled).toBe(0);
    });

    it('leaves an already-clean client alone', () => {
        const clean = {
            id: 'ok', name: 'Bluebird Paint Industries (PVT.) LTD.', standard: 'ISO 9001:2015',
            contacts: [{ name: 'Mr. Khan' }], sites: [{ name: 'Head Office', standards: 'ISO 9001:2015' }],
            certificates: [{ standard: 'ISO 9001:2015', scope: 'Paint manufacture' }]
        };
        expect(DM.healClientText([clean]).changed).toEqual([]);
    });

    it('survives odd records without throwing', () => {
        expect(() => DM.healClientText([null, undefined, {}, { name: 'x' }])).not.toThrow();
        expect(DM.healClientText(null).changed).toEqual([]);
    });

    it('does not recurse forever on a self-referencing record', () => {
        const c = escapedClient();
        c.self = c;
        expect(() => DM.healClientText([c])).not.toThrow();
        expect(c.name).toBe('B&K International');
    });
});

describe('DataMigration.findDuplicateClients', () => {
    it('pairs the escaped record with the clean twin an import created', () => {
        const groups = DM.findDuplicateClients([
            { id: 1, name: 'B&amp;K International' },
            { id: 2, name: 'B&K International' },
            { id: 3, name: 'Bluebird Paint Industries (PVT.) LTD.' }
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].map(c => c.id)).toEqual([1, 2]);
    });

    it('ignores case and punctuation differences, and reports nothing when unique', () => {
        expect(DM.findDuplicateClients([
            { id: 1, name: 'VISIONTECH EXPORT INTERNATIONAL (PVT.) LTD.' },
            { id: 2, name: 'Visiontech Export International Pvt Ltd' }
        ])).toHaveLength(1);
        expect(DM.findDuplicateClients([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])).toEqual([]);
    });
});

describe('DataMigration.healClientTextAndSync', () => {
    it('pushes only the repaired clients and warns about the duplicates it reveals', () => {
        const synced = [];
        const notices = [];
        window.DataService = { syncClient: c => { synced.push(c.name); return Promise.resolve(); } };
        window.saveData = () => { };
        window.showNotification = msg => notices.push(msg);
        window.state.clients = [escapedClient(), { id: 'bk2', name: 'B&K International', standard: 'ISO 9001:2015' }];

        const result = window.DataMigration.healClientTextAndSync();

        expect(result.changed).toHaveLength(1);
        expect(synced).toEqual(['B&K International']);
        expect(result.duplicates).toHaveLength(1);
        expect(notices[0]).toContain('Duplicate clients found');
        expect(notices[0]).toContain('B&K International');
    });
});
