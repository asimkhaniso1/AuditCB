import { describe, it, expect } from 'vitest';
import { M } from '../tools/pcc-scenario.mjs';

// Language Services UK Limited holds one certificate per standard, each with
// the scope of ITS standard. The plan gate compared all six wordings with one
// another and blocked approval: "The active certificates carry different scope
// wording (6 variants)". Different standards having different scopes is normal;
// only two active certificates for the SAME standard that disagree conflict.
const { IPI, PD } = M;

const SCOPES = {
    'ISO 27001:2022': 'Management of information security risks across ERP, CRM, client data, and project records.',
    'ISO 14001:2015': 'Environmental management of translation and interpreting services.',
    'ISO 9001:2015': 'Provision of translation, interpreting and localisation services.',
    'ISO 17100:2015': 'Translation services.',
    'ISO 18841:2018': 'Interpreting services.',
    'ISO 18587:2017': 'Post-editing of machine translation output.'
};
const NOS = { 'ISO 27001:2022': '25UK9003', 'ISO 14001:2015': '25UK9002', 'ISO 9001:2015': '25UK9001', 'ISO 17100:2015': '25UK9004', 'ISO 18841:2018': '25UK9006', 'ISO 18587:2017': '25UK9005' };
const cert = (standard, scope, no) => ({ id: standard, standard, certificateNo: no || NOS[standard], status: 'Active', scope: scope == null ? SCOPES[standard] : scope });
const STDS = Object.keys(SCOPES);
const client = (certs) => ({ name: 'LSUK', sites: [{ name: 'Head Office', employees: 10 }], certificates: certs });
const plan = { standard: STDS.join(', '), certificationCycle: { standards: STDS }, selectedSites: [{ name: 'Head Office' }] };
const check = (certs, p) => IPI.checkScope({ plan: p || {}, client: client(certs), standards: IPI.standardIdsOf(plan), schemes: IPI.schemesOf(plan) });
const codes = (r) => r.issues.map(i => i.code);

describe('certified scope with one certificate per standard', () => {
    it('does not treat each standard having its own scope as a conflict', () => {
        const r = check(STDS.map(s => cert(s)));
        expect(codes(r)).not.toContain('SCOPE_CERTIFICATES_DIFFER');
        expect(r.scopes).toHaveLength(6);
        expect(r.scopes.find(x => x.standards.includes('ISO 17100:2015'))).toEqual({ text: 'Translation services.', standards: ['ISO 17100:2015'], certificateNumbers: ['25UK9004'] });
    });

    it('states every wording, each beside its standard and certificate, in the plan scope', () => {
        const r = check(STDS.map(s => cert(s)));
        const lines = r.certificateScope.split('\n');
        expect(lines).toHaveLength(6);
        expect(lines).toContain('ISO 18587:2017 (25UK9005): Post-editing of machine translation output.');
        expect(lines[0]).toBe('ISO/IEC 27001:2022 (25UK9003): ' + SCOPES['ISO 27001:2022']);
        // A plan saved with that scope matches exactly.
        expect(check(STDS.map(s => cert(s)), { scope: r.certificateScope, selectedSites: plan.selectedSites }).exact).toBe(true);
    });

    it('accepts a plan saved before this change (its scope is the first certificate’s wording) until it is saved again', () => {
        const r = check(STDS.map(s => cert(s)), { scope: SCOPES['ISO 27001:2022'], selectedSites: plan.selectedSites });
        expect(r.exact).toBe(true);
        expect(codes(r)).not.toContain('SCOPE_MISMATCH');
        // Wording that is on no certificate is still a mismatch.
        const bad = check(STDS.map(s => cert(s)), { scope: 'Translation and interpreting.', selectedSites: plan.selectedSites });
        expect(codes(bad)).toContain('SCOPE_MISMATCH');
    });

    it('still blocks two active certificates for the SAME standard that disagree', () => {
        const certs = STDS.map(s => cert(s)).concat([cert('ISO 9001:2015', 'Translation services only.', '25UK9101')]);
        const r = check(certs);
        const issue = r.issues.find(i => i.code === 'SCOPE_CERTIFICATES_DIFFER');
        expect(issue.message).toBe('The active ISO 9001:2015 certificates carry different scope wording (2 variants); the authoritative wording needs certification-manager confirmation.');
        expect(r.issues.filter(i => i.code === 'SCOPE_CERTIFICATES_DIFFER')).toHaveLength(1);
    });

    it('keeps a single shared wording exactly as before', () => {
        const r = check(STDS.map(s => cert(s, 'One scope for all.')));
        expect(r.certificateScope).toBe('One scope for all.');
        expect(r.scopes).toHaveLength(1);
        expect(r.scopes[0].certificateNumbers).toHaveLength(6);
    });

    it('prints each scope beside its standard and certificate in the client plan', () => {
        const scope = check(STDS.map(s => cert(s)));
        const html = PD.build({ client: 'LSUK', auditType: 'Surveillance 1', agenda: [] }, { client: client([]), standards: [], schemes: [], scope, assigned: [] });
        expect(html).toContain('<table class="grid scope-table">');
        expect(html).toContain('<tr><td>ISO 17100:2015</td><td>25UK9004</td><td>Translation services.</td></tr>');
        expect(html).not.toContain('class="scope-box"');
    });
});
