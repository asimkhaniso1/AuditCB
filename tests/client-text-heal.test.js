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

describe('DataMigration.describeDuplicates — which copy is safe to delete', () => {
    it('puts the record carrying audit work first, and flags the other as empty', () => {
        window.state = {
            clients: [
                { id: 'import-copy', name: 'Pakistan Post Foundation', certificates: [{ standard: 'ISO 9001:2015' }], sites: [{ name: 'Head Office' }] },
                { id: 'original', name: 'PAKISTAN POST FOUNDATION', certificates: [], sites: [] }
            ],
            auditPlans: [{ clientId: 'original', client: 'PAKISTAN POST FOUNDATION' }],
            auditReports: [{ clientId: 'original' }],
            ncrs: [], auditPrograms: []
        };

        const groups = window.DataMigration.describeDuplicates();
        expect(groups).toHaveLength(1);
        const [keep, drop] = groups[0];
        expect(keep.id).toBe('original');
        expect(keep.hasHistory).toBe(true);
        expect(keep.plans).toBe(1);
        expect(keep.reports).toBe(1);
        expect(drop.id).toBe('import-copy');
        expect(drop.hasHistory).toBe(false);
    });

    it('falls back to the richer record when neither carries audit work', () => {
        window.state = {
            clients: [
                { id: 'thin', name: 'FD&C (Private) Limited.', certificates: [], sites: [] },
                { id: 'rich', name: 'FD&C (Private) Limited.', certificates: [{ standard: 'ISO 9001:2015' }, { standard: 'ISO 14001:2015' }], sites: [{ name: 'Head Office' }] }
            ],
            auditPlans: [], auditReports: [], ncrs: [], auditPrograms: []
        };
        const [keep, drop] = window.DataMigration.describeDuplicates()[0];
        expect(keep.id).toBe('rich');
        expect(keep.certificates).toBe(2);
        expect(drop.id).toBe('thin');
    });

    it('counts name-linked work against both twins rather than guessing', () => {
        window.state = {
            clients: [{ id: 'a', name: 'B&K International' }, { id: 'b', name: 'B&K International' }],
            auditPlans: [{ client: 'B&K International' }],
            auditReports: [], ncrs: [], auditPrograms: []
        };
        const group = window.DataMigration.describeDuplicates()[0];
        expect(group.every(c => c.plans === 1)).toBe(true);
        expect(group.every(c => c.hasHistory)).toBe(true);
    });

    it('reports nothing when every client name is unique', () => {
        window.state = { clients: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], auditPlans: [] };
        expect(window.DataMigration.describeDuplicates()).toEqual([]);
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
        expect(notices[0]).toContain('duplicate client name(s)');
        expect(notices[0]).toContain('B&K International');
    });
});
