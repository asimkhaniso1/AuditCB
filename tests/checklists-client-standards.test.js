import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { M } from '../tools/pcc-scenario.mjs';

// SG 1888 holds ISO 9001:2015, Halal and cGMP — on its certificates and its
// site; the client record's own list still says only "ISO 9001:2015".
//  - The plan's Configure Checklists offered ISO 14001:2015 and ISO 17100:2015
//    (the "2015" matched), ISO 9001:2026, and every other client's checklist
//    under "Other / Imported".
//  - The client Checklists page showed only ISO 9001:2015, not the cGMP one.
globalThis.window = globalThis.window || globalThis;

const SG = () => ({
    id: 'sg', name: 'SG 1888 (PVT.) LTD.', standard: 'ISO 9001:2015',
    certificates: [{ id: 'C1', standard: 'ISO 9001:2015', status: 'Active' }, { id: 'C2', standard: 'Halal', status: 'Active' }, { id: 'C3', standard: 'cGMP', status: 'Active' }],
    sites: [{ name: 'Head Office', standards: 'ISO 9001:2015, Halal, cGMP' }]
});
const OTHERS = [{ id: 'ktd', name: 'KTD Select' }, { id: 'pcc', name: 'PC CONNECTION, INC.' }, { id: 'sh', name: 'Shanghai Industries (Pvt) Ltd.' }];
const CHECKLISTS = () => [
    { id: 1, name: 'ISO 14001:2015 - Initial Audit Checklist', standard: 'ISO 14001:2015', type: 'global', clauses: [] },
    { id: 2, name: 'ISO 17100:2015 - Initial Audit Checklist', standard: 'ISO 17100:2015', type: 'global', clauses: [] },
    { id: 3, name: 'ISO 9001:2015 - Initial Audit Checklist', standard: 'ISO 9001:2015', type: 'global', clauses: [] },
    { id: 4, name: 'ISO 9001:2026 - Initial Audit Checklist', standard: 'ISO 9001:2026', type: 'global', clauses: [] },
    { id: 5, name: 'GMP Guidelines Pakistan - Initial Audit Checklist', standard: 'cGMP', type: 'global', clauses: [] },
    { id: 6, name: 'GMP Guidelines Pakistan - Initial Audit Checklist', standard: 'GMP', type: 'global', clauses: [] },
    { id: 7, name: 'ISO 9001:2015 - Shanghai Industries (Pvt) Ltd. - Surveillance Audit Checklist', standard: 'ISO 9001:2015', type: 'custom', clauses: [] },
    { id: 8, name: 'KTD Select - Surveillance Audit Checklist (Client-Specific)', standard: 'ISO 9001:2015', type: 'custom', clauses: [] },
    { id: 9, name: 'PC CONNECTION, INC. - Recertification Audit Checklist (Client-Specific)', standard: 'ISO/IEC 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018', type: 'custom', clientId: 'pcc', clauses: [] },
    { id: 10, name: 'Halal Surveillance Checklist', standard: 'Halal', type: 'custom', clientId: 'sg', clientName: 'SG 1888 (PVT.) LTD.', clauses: [] },
    { id: 11, name: 'Imported cGMP checklist', standard: 'cGMP', type: 'custom', clauses: [] }
];

describe('UTILS.clientStandards / standardsOverlap', () => {
    it('reads the record, the certificates and the sites', () => {
        expect(M.UTILS.clientStandards(SG())).toEqual(['ISO 9001:2015', 'Halal', 'cGMP']);
    });
    it('ignores a withdrawn certificate', () => {
        const c = SG(); c.certificates.push({ id: 'C4', standard: 'Product Safety', status: 'Withdrawn' });
        expect(M.UTILS.clientStandards(c)).not.toContain('Product Safety');
    });
    it('matches edition-exact and keeps GMP apart from cGMP', () => {
        const held = ['ISO 9001:2015', 'Halal', 'cGMP'];
        expect(M.UTILS.standardsOverlap('ISO 14001:2015', held)).toBe(false);
        expect(M.UTILS.standardsOverlap('ISO 17100:2015', held)).toBe(false);
        expect(M.UTILS.standardsOverlap('ISO 9001:2026', held)).toBe(false);
        expect(M.UTILS.standardsOverlap('GMP', held)).toBe(false);
        expect(M.UTILS.standardsOverlap('cGMP', held)).toBe(true);
        expect(M.UTILS.standardsOverlap('ISO 9001', held)).toBe(true);
        expect(M.UTILS.standardsOverlap('ISO 9001:2015, ISO 14001:2015', held)).toBe(true);
    });
});

describe('Configure Checklists on an SG 1888 plan', () => {
    beforeAll(() => {
        window.UTILS = M.UTILS;
        window.showNotification = () => { };
        window.Sanitizer = { sanitizeText: (v) => v };
        window.Validator = {};
        (0, eval)(fs.readFileSync(path.resolve('./planning-module.js'), 'utf8'));
    });
    beforeEach(() => {
        document.body.innerHTML = '<div id="content-area"></div>';
        window.contentArea = document.getElementById('content-area');
        window.SupabaseClient = undefined;
    });
    const titles = () => Array.from(document.querySelectorAll('#content-area > .fade-in h3')).map(h => h.textContent.trim());
    const shownIds = (scope) => Array.from(document.querySelectorAll(`${scope || '#content-area'} [data-checklist-id], #content-area .checklist-main-cb`))
        .map(el => el.getAttribute('data-checklist-id') || el.getAttribute('data-id')).filter(Boolean);
    const visibleCards = () => {
        const hidden = document.getElementById('config-hidden-checklists');
        return Array.from(document.querySelectorAll('#content-area [data-checklist-id]'))
            .filter(el => !(hidden && hidden.contains(el)))
            .map(el => el.getAttribute('data-checklist-id'));
    };

    async function render(plan) {
        window.state = { clients: [SG(), ...OTHERS], checklists: CHECKLISTS(), auditPlans: [plan] };
        await window.renderConfigureChecklist(plan.id);
    }

    it('a cGMP plan offers only the cGMP checklists, and hides the rest behind Show all', async () => {
        await render({ id: 'p1', client: 'SG 1888 (PVT.) LTD.', standard: 'cGMP', selectedChecklists: [] });
        const visible = new Set(visibleCards());
        expect([...visible].sort()).toEqual(['11', '5']);
        const hidden = document.getElementById('config-hidden-checklists');
        expect(hidden.style.display).toBe('none');
        expect(document.body.textContent).toMatch(/9 checklists for other standards or other clients are hidden/);
        window.toggleHiddenPlanChecklists();
        expect(hidden.style.display).toBe('');
    });

    it('a plan without standards falls back to what the client holds; other clients’ checklists stay hidden', async () => {
        await render({ id: 'p2', client: 'SG 1888 (PVT.) LTD.', standard: '', selectedChecklists: [] });
        const visible = new Set(visibleCards());
        expect([...visible].sort()).toEqual(['10', '11', '3', '5']);
        ['1', '2', '4', '6', '7', '8', '9'].forEach(id => expect(visible.has(id)).toBe(false));
    });

    it('always shows a checklist already assigned to the plan', async () => {
        await render({ id: 'p3', client: 'SG 1888 (PVT.) LTD.', standard: 'cGMP', selectedChecklists: ['4'] });
        expect(visibleCards()).toContain('4');
    });
});

describe('client Checklists page for SG 1888', () => {
    beforeAll(() => {
        window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
        window.UTILS = M.UTILS;
        const src = fs.readFileSync(path.resolve('./checklist-module.js'), 'utf8');
        // eslint-disable-next-line no-unused-vars
        const module = undefined;
        (0, eval)(src);
    });
    it('lists global checklists for ISO 9001:2015, Halal and cGMP — not GMP, ISO 9001:2026 or other standards', () => {
        document.body.innerHTML = '<div id="content-area"></div>';
        window.contentArea = document.getElementById('content-area');
        window.state = { currentUser: { name: 'Admin', role: 'Admin' }, clients: [SG(), ...OTHERS], checklists: CHECKLISTS(), auditPlans: [], settings: { isAdmin: true } };
        window.renderChecklistLibrary('sg');
        const text = document.getElementById('content-area').textContent;
        expect(text).toMatch(/plus global checklists for ISO 9001:2015, Halal, cGMP/);
        const rows = Array.from(document.querySelectorAll('#content-area tbody tr')).map(r => r.textContent.replace(/\s+/g, ' '));
        expect(rows.some(r => /ISO 9001:2015 - Initial Audit Checklist/.test(r))).toBe(true);
        expect(rows.some(r => /GMP Guidelines Pakistan.*cGMP/.test(r))).toBe(true);
        expect(rows.some(r => /Halal Surveillance Checklist/.test(r))).toBe(true);
        expect(rows.some(r => /ISO 14001|ISO 17100|ISO 9001:2026/.test(r))).toBe(false);
        expect(rows.filter(r => /GMP Guidelines Pakistan/.test(r))).toHaveLength(1);
        expect(rows.some(r => /KTD Select|PC CONNECTION|Shanghai/.test(r))).toBe(false);
    });
});
