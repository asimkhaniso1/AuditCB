// Document gap analysis — which clauses it checks, and how it counts them.
//
// For PC Connection (27001 + 22301 + 20000-1) the analysis showed 5 gaps of
// which one was real: a heading clause counted beside its own sub-clauses
// ("8.4 Supply and demand" and 8.4.1), and "General" sub-clauses whose
// requirements were all evidenced. Worse, the Knowledge Base clause lists it
// checked against were truncated (20000-1 stopped at 8.4.1), so the service
// management processes were never checked at all.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
const CS = (await import('../checklist-standards.js')).default || window.ChecklistStandards;
window.ChecklistStandards = CS;
loadScript('./client-docs-bulk.js', { params: { module: undefined } });
const B = window.ClientDocsBulk;

const doc = (name, clauses, std) => ({ name, linkedClauses: clauses, linkedStandards: std || '' });

describe('analyseDocumentGaps — heading clauses', () => {
    const clauses = [{ clause: '8.4', title: 'Supply and demand' }, { clause: '8.4.1', title: 'Budgeting' },
        { clause: '8.4.2', title: 'Demand management' }, { clause: '8.4.3', title: 'Capacity management' }];

    it('counts one missing topic once, on its sub-clauses', () => {
        const a = B.analyseDocumentGaps(clauses, [], 'iso20000');
        expect(a.rows.map(r => r.clause)).toEqual(['8.4.1', '8.4.2', '8.4.3']);
        expect(a.gaps).toBe(3);
    });

    it('still lets a document linked to the heading cover its sub-clauses', () => {
        const a = B.analyseDocumentGaps(clauses, [doc('Supply and Demand Procedure', '8.4', 'iso20000')], 'iso20000');
        expect(a.gaps).toBe(0);
    });

    it('keeps a heading clause listed on its own', () => {
        const a = B.analyseDocumentGaps([{ clause: '8.4', title: 'Supply and demand' }], [doc('Supplier Eval', '8.4.1')]);
        expect(a.rows.map(r => r.clause)).toEqual(['8.4']);
        expect(a.covered).toBe(1);
    });
});

describe('analyseDocumentGaps — "General" sub-clauses', () => {
    const bcms = [{ clause: '8.2.1', title: 'General' }, { clause: '8.2.2', title: 'Business impact analysis' }, { clause: '8.2.3', title: 'Risk assessment' }];

    it('credits a General clause when every requirement beside it is evidenced', () => {
        const docs = [doc('BIA Procedure', '8.2.2', 'iso22301'), doc('Risk Assessment Procedure 22301', '8.2.3', 'iso22301')];
        const a = B.analyseDocumentGaps(bcms, docs, 'iso22301');
        const general = a.rows.find(r => r.clause === '8.2.1');
        expect(general.covered).toBe(true);
        expect(general.coveredVia).toEqual(['8.2.2', '8.2.3']);
        expect(general.docs.map(d => d.name)).toEqual(['BIA Procedure', 'Risk Assessment Procedure 22301']);
        expect(a.gaps).toBe(0);
    });

    it('leaves it a gap while any of those requirements is not evidenced', () => {
        const a = B.analyseDocumentGaps(bcms, [doc('BIA Procedure', '8.2.2', 'iso22301')], 'iso22301');
        expect(a.rows.find(r => r.clause === '8.2.1').covered).toBe(false);
        expect(a.gaps).toBe(2);
    });

    it('does not infer a .1 clause that is a requirement in its own right', () => {
        const sms = [{ clause: '8.2.1', title: 'Service delivery' }, { clause: '8.2.2', title: 'Plan the services' }];
        const a = B.analyseDocumentGaps(sms, [doc('Service Management Plan', '8.2.2', 'iso20000')], 'iso20000');
        expect(a.rows.find(r => r.clause === '8.2.1').covered).toBe(false);
    });
});

describe('clausesForStandard — an incomplete Knowledge Base list does not hide clauses', () => {
    const std = CS.resolve('ISO 20000-1:2018').standards[0];
    beforeEach(() => {
        window.KB_HELPERS = { normalizeStdName: (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '') };
    });

    it('uses the registry, and says why, when the KB list is missing registry clauses', () => {
        const truncated = std.clauses.filter(c => !/^8\.[5-7]|^8\.4\.[23]|^9\.4/.test(c.ref)).map(c => ({ clause: c.ref, title: c.title }));
        window.state = { knowledgeBase: { standards: [{ name: 'ISO 20000-1:2018', status: 'ready', clauses: truncated }] } };
        const r = B.clausesForStandard('ISO 20000-1:2018');
        expect(r.clauses.map(c => c.clause)).toEqual(std.clauses.map(c => c.ref));
        expect(r.source).toMatch(/^Clause registry/);
        expect(r.source).toMatch(/Knowledge Base list for ISO 20000-1:2018 is missing \d+ clauses/);
        expect(r.kbIncomplete.missing).toContain('8.6.1');
    });

    it('keeps a complete KB list, including one that splits clauses further', () => {
        const full = std.clauses.flatMap(c => c.ref === '8.4.3'
            ? [{ clause: '8.4.3.1', title: 'Capacity a' }, { clause: '8.4.3.2', title: 'Capacity b' }]
            : [{ clause: c.ref, title: c.title }]);
        window.state = { knowledgeBase: { standards: [{ name: 'ISO 20000-1:2018', status: 'ready', clauses: full }] } };
        const r = B.clausesForStandard('ISO 20000-1:2018');
        expect(r.source).toBe('Knowledge Base — ISO 20000-1:2018');
        expect(r.clauses).toBe(full);
    });

    it('lists which registry clauses a KB list lacks', () => {
        expect(B.kbMissingRegistryRefs([{ clause: '4.1' }], { clauses: [{ ref: '4.1' }, { ref: '4.2' }] })).toEqual(['4.2']);
        expect(B.kbMissingRegistryRefs([{ clause: '8.4.2.1' }], { clauses: [{ ref: '8.4.2' }] })).toEqual([]);
    });
});

// PC Connection's live documents (headings as stored, 2026-11-14). Both have a
// "Capacity Management" section; the frequency threshold dropped it, so
// ISO/IEC 20000-1 8.4.3 read as a gap although the client supplied it.
const AVAILABILITY_PLAN = {
    name: 'Availability Plan', docNumber: 'PLN', category: 'Other', linkedStandards: 'iso20000', linkedClauses: '8.7.1',
    headings: [['1', 'Introduction'], ['2', 'Objectives'], ['3', 'Scope'], ['4', 'Availability Management Process'],
        ['4.1', 'Availability Planning'], ['4.2', 'Monitoring and Measurement'], ['4.3', 'Incident Management'],
        ['4.4', 'Problem Management'], ['4.5', 'Capacity Management'], ['5', 'Roles and Responsibilities'],
        ['6', 'Tools and Technology'], ['7', 'Reporting and Communication'], ['8', 'Continuous Improvement'], ['9', 'Conclusion']]
        .map(([clause, text]) => ({ clause, text }))
};
const CI_SOP = {
    name: 'Continual Improvement and Process Optimization SOP', docNumber: 'PRC', category: 'Quality Procedures', linkedStandards: '',
    linkedClauses: '8.2.2, 8.3.3, 10.1, 10.2',
    headings: [['1', 'Change History'], ['2', 'Introduction'], ['3', 'Continual Improvement Workflow Summary'],
        ['4', 'Data Collection and Analysis Records Management'], ['5', 'Capacity Management'],
        ['5.1.1', 'Business Capacity Roles and Responsibilities'], ['5.1.2', 'Business Capacity RACI Chart'],
        ['5.1.3', 'Quantify Business Impacts'], ['5.1.4', 'Review Service Level Agreements'],
        ['5.1.5', 'Determine if Changes are Required'], ['5.1.6', 'Develop and Agree Service Level Requirements'],
        ['5.2.1', 'Create & Distribute Capacity Reports Workflow'], ['5.2.2', 'Roles and Responsibilities'],
        ['5.2.3', 'Define or Validate Requirements'], ['5.2.4', 'Define or Validate Audience'], ['5.2.5', 'Identify Data Sources'],
        ['5.2.6', 'Gather & Analyze Data'], ['5.2.7', 'Produce Report'], ['5.2.8', 'Distribute Report'],
        ['6', 'Process Automation'], ['7', 'Terms and Definitions']].map(([clause, text]) => ({ clause, text }))
};
const PCC_STANDARD = 'ISO 27001:2022, ISO 22301:2019, ISO 20000-1:2018';

describe('capacity management — a section of its own links ISO/IEC 20000-1 8.4.3', () => {
    it('re-links the Availability Plan to 8.4.3 beside 8.7.1', () => {
        const r = B.relinkDocumentClauses(AVAILABILITY_PLAN, { clientStandard: PCC_STANDARD });
        expect(r.proposed).toContain('8.4.3');
        expect(r.proposed).toContain('8.7.1');
        expect(r.changed).toBe(true);
    });

    it('re-links the Continual Improvement SOP to 8.4.3 for 20000-1 only', () => {
        const r = B.relinkDocumentClauses(CI_SOP, { clientStandard: PCC_STANDARD });
        // Its section numbers are its own: "5.2.2 Roles and Responsibilities"
        // under section 5 is not ISO clause 5, so 5.1.1-5.2.8 are not clauses.
        expect(r.numbering).toBe('internal');
        expect(r.proposed.filter(c => /^5\./.test(c))).toEqual([]);
        expect(r.proposedMap.iso20000).toEqual(['8.3.3', '8.4.3', '10.2']);
        // Capacity is an Annex A control in 27001 and nothing in 22301.
        expect(r.proposedMap.iso27001 || []).not.toContain('8.4.3');
        expect(r.proposedMap.iso22301 || []).not.toContain('8.4.3');
    });

    it('closes the 8.4.3 gap once the documents carry the link', () => {
        const std = CS.resolve('ISO 20000-1:2018').standards[0];
        const clauses = std.clauses.map(c => ({ clause: c.ref, title: c.title }));
        const proposed = B.relinkDocumentClauses(AVAILABILITY_PLAN, { clientStandard: PCC_STANDARD }).proposed;
        const relinked = Object.assign({}, AVAILABILITY_PLAN, { linkedClauses: proposed.join(', ') });
        expect(B.analyseDocumentGaps(clauses, [AVAILABILITY_PLAN], 'iso20000').rows.find(r => r.clause === '8.4.3').covered).toBe(false);
        expect(B.analyseDocumentGaps(clauses, [relinked], 'iso20000').rows.find(r => r.clause === '8.4.3').covered).toBe(true);
    });

    it('does not read capacity into a heading that only mentions it in passing', () => {
        const doc = { name: 'Network Procedure', category: 'Other', linkedStandards: 'iso20000', headings: [
            { clause: '1', text: 'Scope' }, { clause: '2', text: 'Bandwidth capacity of links' }, { clause: '3', text: 'Routing' }] };
        expect(B.relinkDocumentClauses(doc, { clientStandard: PCC_STANDARD }).proposed).not.toContain('8.4.3');
    });
});

describe('gap action — names the audit the document is due before', () => {
    const client = { id: 'pcc', name: 'PC CONNECTION, INC.', certificates: [
        { standard: 'ISO 20000-1:2018', status: 'Active', initialDate: '2020-12-16', currentIssue: '2025-12-16', expiryDate: '2026-12-15' }] };
    const recert = { clientId: 'pcc', auditType: 'Recertification', date: '2026-11-17', endDate: '2026-11-19', status: 'Scheduled' };
    const pastSurv = { clientId: 'pcc', auditType: 'Surveillance', date: '2026-02-17', status: 'Completed' };
    beforeEach(() => { window.UTILS = undefined; window.ReportStats = undefined; });

    it('asks a recertification client for it before the Recertification audit, not Stage 2', () => {
        const next = B.nextAuditForGaps(client, [pastSurv, recert], '2026-11-14');
        expect(next).toEqual({ label: 'the Recertification audit', date: '2026-11-17', source: 'plan' });
        const text = B.gapRequestText(next);
        expect(text).toBe('No documented information supplied — request before the Recertification audit (2026-11-17)');
        expect(text).not.toMatch(/Stage 2/);
    });

    it('still names an audit that is under way today', () => {
        expect(B.nextAuditForGaps(client, [recert], '2026-11-18').source).toBe('plan');
    });

    it('ignores completed and cancelled plans and plans of other clients', () => {
        const other = { clientId: 'x', auditType: 'Stage 2', date: '2026-12-01', status: 'Scheduled' };
        const cancelled = Object.assign({}, recert, { status: 'Cancelled' });
        expect(B.nextAuditForGaps(client, [pastSurv, other, cancelled], '2026-11-14').label).toBe('the next audit');
    });

    it('matches a plan by client name when it carries no id', () => {
        const byName = { client: 'pc connection, inc. ', auditType: 'Surveillance 2', date: '2026-12-01', status: 'Draft' };
        expect(B.nextAuditForGaps({ name: 'PC CONNECTION, INC.' }, [byName], '2026-11-14').label).toBe('the Surveillance 2 audit');
    });

    it('uses the certification cycle stage when nothing is scheduled', () => {
        window.ReportStats = { cycleState: () => ({ stage: 'Surveillance 1' }) };
        expect(B.nextAuditForGaps(client, [], '2026-11-14')).toEqual({ label: 'the Surveillance 1 audit', date: null, source: 'cycle' });
    });

    it('keeps Stage 2 for a client seeking initial certification', () => {
        const applicant = { id: 'new', name: 'Applicant Ltd', certificates: [] };
        expect(B.gapRequestText(B.nextAuditForGaps(applicant, [], '2026-11-14')))
            .toBe('No documented information supplied — request before Stage 2');
        const stage2 = { clientId: 'new', auditType: 'Stage 2', date: '2026-12-02', status: 'Scheduled' };
        expect(B.nextAuditForGaps(applicant, [stage2], '2026-11-14').label).toBe('Stage 2');
    });

    it('treats a withdrawn certificate as no certificate', () => {
        const lapsed = { id: 'l', name: 'L', certificates: [{ standard: 'ISO 9001:2015', status: 'Withdrawn' }] };
        expect(B.nextAuditForGaps(lapsed, [], '2026-11-14').label).toBe('Stage 2');
    });
});
