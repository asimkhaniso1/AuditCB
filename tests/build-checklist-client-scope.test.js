import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { M } from '../tools/pcc-scenario.mjs';

// Build Checklist (from client documents) listed the whole clause registry
// under "Audit scope — standards": ISO/IEC 27001, ISO 22301, ISO/IEC 20000-1,
// ISO 14001 and ISO 45001 for SG 1888, which holds ISO 9001:2015, Halal and
// cGMP. The list is gated by the client's Applicable Standards.
const DOC = [{ id: 'd1', name: 'Quality Manual', docNumber: 'QM-01' }];
const SG = () => ({
    id: 'sg', name: 'SG 1888 (PVT.) LTD.', standard: 'ISO 9001:2015', documents: DOC,
    certificates: [{ standard: 'ISO 9001:2015' }, { standard: 'Halal' }, { standard: 'cGMP' }],
    sites: [{ name: 'Head Office', standards: 'ISO 9001:2015, Halal, cGMP' }]
});

let html;
function open(client, presetStandard) {
    html = '';
    window.UTILS = M.UTILS;
    window.state = { clients: [client], auditPlans: [] };
    window.DataService = {
        findClient: (id) => (String(id) === String(client.id) ? client : null),
        findAuditPlan: () => null,
        openFormModal: (_title, body) => { html = body; document.body.innerHTML = body; }
    };
    window.buildChecklistFromClientDocs(client.id, 'surveillance', presetStandard);
}
const offered = () => Array.from(document.querySelectorAll('.cldoc-std')).map(cb => cb.value);
const ticked = () => Array.from(document.querySelectorAll('.cldoc-std:checked')).map(cb => cb.value);

describe('Build Checklist — audit scope is the client’s standards', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('SG 1888 is offered ISO 9001 only, with Halal and cGMP named as schemes', () => {
        open(SG());
        expect(offered()).toEqual(['iso9001']);
        expect(ticked()).toEqual(['iso9001']);
        expect(html).toMatch(/Halal, cGMP<\/strong> have no validated clause set/);
        expect(html).not.toMatch(/27001|22301|20000-1|14001|45001/);
        expect(document.getElementById('cldoc-soa')).toBeNull();   // no ISO 27001 -> no SoA field
    });

    it('reads standards held only on the certificates or the site', () => {
        const c = SG(); c.standard = ''; c.certificates = [{ standard: 'ISO 14001:2015' }]; c.sites = [{ standards: 'ISO 45001:2018' }];
        open(c);
        expect(offered().sort()).toEqual(['iso14001', 'iso45001']);
    });

    it('an integrated ISMS client keeps all three, and the SoA field', () => {
        const c = { id: 'pcc', name: 'PC CONNECTION, INC.', standard: 'ISO/IEC 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018', documents: DOC };
        open(c);
        expect(offered().sort()).toEqual(['iso20000', 'iso22301', 'iso27001']);
        expect(document.getElementById('cldoc-soa')).toBeTruthy();
    });

    it('a client with no standards recorded still sees the registry', () => {
        open({ id: 'n', name: 'New Client', documents: DOC });
        expect(offered().length).toBe(M.CS.all().length);
        expect(ticked()).toEqual([]);
    });
});

describe('client Checklists area — standard pick-lists follow the client', () => {
    const fs = require('fs');
    const path = require('path');
    let loaded = false;
    function setup(scope) {
        window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
        window.UTILS = M.UTILS;
        window.showNotification = () => { };
        if (!loaded) { (0, eval)(fs.readFileSync(path.resolve('./checklist-module.js'), 'utf8')); loaded = true; }
        document.body.innerHTML = '<div id="content-area"></div>';
        window.contentArea = document.getElementById('content-area');
        window.state = {
            currentUser: { name: 'Admin', role: 'Admin' }, settings: { isAdmin: true }, auditPlans: [],
            cbSettings: { availableStandards: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'GMP', 'Halal', 'cGMP'] },
            clients: [SG(), { id: 'n', name: 'New Client' }],
            checklists: [{ id: 1, name: 'Old one', standard: 'ISO 14001:2015', type: 'custom', clientId: 'sg', clauses: [] }]
        };
        window.renderChecklistLibrary(scope);
    }
    const values = (sel) => Array.from(document.querySelectorAll(sel + ' option')).map(o => o.value || o.textContent.trim()).filter(v => v && v !== 'all');

    it('the filter and the editor list SG 1888’s three standards, not the CB’s whole list', () => {
        setup('sg');
        expect(values('#checklist-filter-standard')).toEqual(['ISO 9001:2015', 'Halal', 'cGMP']);
        window.renderChecklistEditor();
        expect(values('#checklist-standard').filter(v => !/select/i.test(v))).toEqual(['ISO 9001:2015', 'Halal', 'cGMP']);
    });

    it('editing keeps the standard already on the checklist selectable', () => {
        setup('sg');
        window.renderChecklistEditor(1);
        expect(values('#checklist-standard')).toContain('ISO 14001:2015');
    });

    it('the global library and a client with no standards keep the full list', () => {
        setup(null);
        expect(values('#checklist-filter-standard')).toHaveLength(6);
        setup('n');
        expect(values('#checklist-filter-standard')).toHaveLength(6);
    });
});
