import { describe, it, expect, beforeAll } from 'vitest';

// The scope-driven checklist engine, its clause/control registry and the QA
// pass that gates PDF generation. The regression these cover is the PC
// Connection recertification checklist: a three-standard ISMS/BCMS/SMS audit
// that came out as 379 items auditing ISO 9001 Customer Focus, "QMS processes",
// Design & Development (8.3) and monitoring and measuring equipment (7.1.5) —
// because getBuiltInClauses() silently returned the ISO 9001 clause set for any
// standard it did not recognise.

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
window.state = window.state || {};

const fs = await import('fs');
const path = await import('path');

const CS = (await import('../checklist-standards.js')).default || window.ChecklistStandards;
const QA = (await import('../checklist-qa.js')).default || window.ChecklistQA;
window.ChecklistStandards = CS;
window.ChecklistQA = QA;

const src = fs.readFileSync(path.resolve('./client-docs-bulk.js'), 'utf8');
eval(src);
const B = window.ClientDocsBulk;

const IMS_SCOPE = 'ISO 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018';

const CLIENT = {
    id: 'pcc',
    name: 'PC CONNECTION, INC.',
    standard: IMS_SCOPE,
    employees: '2500',
    sites: [{ name: 'Merrimack', city: 'NH' }, { name: 'Wilmington', city: 'OH' }],
    goodsServices: [
        { name: 'Managed IT Services' }, { name: 'Microsoft Cloud Services (Azure / M365 / CSP)' },
        { name: 'Service Desk Operations' }, { name: 'Information Security Management' },
        { name: 'Business Continuity & Disaster Recovery' }
    ],
    keyProcesses: [
        { name: 'Client Onboarding', category: 'Core' },
        { name: 'Service Desk Operations', category: 'Core' },
        { name: 'Incident Management', category: 'Core' },
        { name: 'Change Management', category: 'Core' },
        { name: 'Problem Management', category: 'Core' },
        { name: 'Cloud Services Operations', category: 'Core' },
        { name: 'Patch & Vulnerability Management', category: 'Core' },
        { name: 'Backup & Recovery Operations', category: 'Core' },
        { name: 'Payroll', category: 'Outsourced', owner: 'HR' }
    ]
};

/** A document set shaped like the one that produced the 379-item checklist. */
function makeDocs(n) {
    const cats = ['Quality Procedures', 'Policy', 'Records / Forms Register', 'Manual', 'Contract / Agreement'];
    return Array.from({ length: n }, (_, i) => ({
        id: `d${i}`,
        name: `Controlled Document ${i + 1}`,
        category: cats[i % cats.length],
        linkedClauses: ['4.1', '5.2', '6.2', '7.5', '8.1', '9.1'][i % 6],
        docNumber: `DOC-${100 + i}`
    }));
}

const DOCS = makeDocs(24);

function allItems(checklist) {
    return checklist.clauses.flatMap(c => c.subClauses);
}
function allText(checklist) {
    return allItems(checklist).map(s => `${s.title} ${s.requirement}`).join(' \n ');
}

describe('ChecklistStandards — the scope-gated registry', () => {
    it('resolves the three standards of an integrated engagement from one comma string', () => {
        const r = CS.resolve(IMS_SCOPE);
        expect(r.standards.map(s => s.id)).toEqual(['iso27001', 'iso22301', 'iso20000']);
        expect(r.unresolved).toEqual([]);
    });

    it('refuses to resolve a standard it does not hold — it never substitutes another', () => {
        const r = CS.resolve('ISO 9001:2015');
        expect(r.standards).toEqual([]);
        expect(r.unresolved).toEqual(['ISO 9001:2015']);
    });

    it('resolves registry ids as well as display names', () => {
        expect(CS.resolve(['iso27001', 'iso20000']).standards.map(s => s.id))
            .toEqual(['iso27001', 'iso20000']);
    });

    it('carries all 93 Annex A controls of ISO/IEC 27001:2022', () => {
        const controls = CS.controlsFor('iso27001');
        expect(controls).toHaveLength(93);
        expect(controls.filter(c => c.ref.startsWith('A.5.'))).toHaveLength(37);
        expect(controls.filter(c => c.ref.startsWith('A.6.'))).toHaveLength(8);
        expect(controls.filter(c => c.ref.startsWith('A.7.'))).toHaveLength(14);
        expect(controls.filter(c => c.ref.startsWith('A.8.'))).toHaveLength(34);
    });

    it('only ISO/IEC 27001 has controls — the others are clause-only standards', () => {
        expect(CS.controlsFor('iso22301')).toEqual([]);
        expect(CS.controlsFor('iso20000')).toEqual([]);
    });

    describe('the clause-number trap', () => {
        it('gives clause 8.3 a different meaning in each standard', () => {
            const hits = CS.lookupRef(['iso27001', 'iso22301', 'iso20000'], '8.3');
            const titles = hits.map(h => h.title);
            expect(titles).toContain('Information security risk treatment (implementation of)');
            expect(titles).toContain('Business continuity strategies and solutions');
            // ISO/IEC 20000-1 numbers its relationship requirements at 8.3.x,
            // so a bare 8.3 is not one of its clauses.
            expect(hits.every(h => !/design and development/i.test(h.title))).toBe(true);
        });

        it('numbers nonconformity differently across the three standards', () => {
            const nc = CS.clausesFor(['iso27001', 'iso22301', 'iso20000'])
                .filter(c => c.shared === CS.SHARED.IMP_NONCONFORMITY);
            expect(nc.find(c => c.stdId === 'iso27001').ref).toBe('10.2');
            expect(nc.find(c => c.stdId === 'iso22301').ref).toBe('10.1');
            expect(nc.find(c => c.stdId === 'iso20000').ref).toBe('10.1');
        });

        it('rejects an ISO 9001 clause number that no selected standard has', () => {
            // 7.1.5 monitoring and measuring resources, 8.3 design and
            // development sub-clauses — pure ISO 9001.
            expect(CS.isKnownRef('iso27001', '7.1.5')).toBe(false);
            expect(CS.isKnownRef('iso22301', '8.3.4')).toBe(false);
            expect(CS.isKnownRef('iso20000', '7.1.5')).toBe(false);
        });
    });

    describe('consolidate', () => {
        const ids = ['iso27001', 'iso22301', 'iso20000'];

        it('groups a genuinely common requirement once, citing each standard', () => {
            const { common } = CS.consolidate(ids);
            const context = common.find(g => g.shared === CS.SHARED.CONTEXT_ISSUES);
            expect(context.members).toHaveLength(3);
            expect(CS.citation(context.members))
                .toBe('ISO/IEC 27001:2022 4.1 / ISO 22301:2019 4.1 / ISO/IEC 20000-1:2018 4.1');
        });

        it('keeps standard-specific requirements out of the common set', () => {
            const { common, specific } = CS.consolidate(ids);
            const commonRefs = common.flatMap(g => g.members.map(m => `${m.stdId}::${m.ref}`));
            expect(commonRefs).not.toContain('iso27001::6.1.2');   // ISMS risk assessment
            expect(commonRefs).not.toContain('iso22301::8.2.2');   // BIA
            expect(commonRefs).not.toContain('iso20000::8.6.1');   // incident management
            expect(specific.some(c => c.stdId === 'iso22301' && c.ref === '8.2.2')).toBe(true);
        });

        it('does not consolidate a shared clause only one selected standard holds', () => {
            const { common } = CS.consolidate(['iso27001']);
            expect(common).toEqual([]);
        });
    });

    it('planScope drops the specific clauses the process themes already walk', () => {
        const p = CS.planScope(['iso27001', 'iso22301', 'iso20000']);
        expect(p.residual.length).toBeLessThan(p.specific.length);
        // Every 27001 and 22301 specific clause is walked by a theme.
        expect(p.residual.some(c => c.stdId === 'iso27001')).toBe(false);
        expect(p.residual.some(c => c.stdId === 'iso22301')).toBe(false);
    });
});

describe('buildClientChecklist — three-standard integrated recertification', () => {
    let checklist;
    beforeAll(() => {
        checklist = B.buildClientChecklist(CLIENT, DOCS, {
            auditType: 'recertification',
            standard: IMS_SCOPE,
            manDays: 12
        });
    });

    it('uses the scope-driven engine, not the document-driven one', () => {
        expect(checklist.generator).toBe('scope-driven-v2');
        expect(checklist.standardIds).toEqual(['iso27001', 'iso22301', 'iso20000']);
    });

    describe('no requirement from a standard outside the audit scope', () => {
        const FORBIDDEN = [
            [/design and development/i, 'ISO 9001 8.3 Design and development'],
            [/customer focus/i, 'ISO 9001 5.1.2 Customer focus'],
            [/\bQMS\b|quality management system/i, 'ISO 9001 quality management system'],
            [/quality (policy|objectives|manual)/i, 'ISO 9001 quality policy / objectives'],
            [/monitoring and measuring (equipment|resources)|calibrat/i, 'ISO 9001 7.1.5 measuring resources'],
            [/nonconforming outputs/i, 'ISO 9001 8.7'],
            [/production and service provision/i, 'ISO 9001 8.5'],
            [/environmental aspect|\bEMS\b/i, 'ISO 14001'],
            [/hazard identification|OH&S/i, 'ISO 45001'],
            [/\bHACCP\b/i, 'ISO 22000']
        ];
        FORBIDDEN.forEach(([re, label]) => {
            it(`does not introduce ${label}`, () => {
                expect(allText(checklist)).not.toMatch(re);
            });
        });
    });

    it('cites only clauses and controls the named standard actually contains', () => {
        allItems(checklist).forEach(item => {
            (item.refs || []).forEach(r => {
                expect(CS.isKnownRef(r.stdId, r.ref),
                    `${r.stdId} has no ${r.ref} (item: ${item.title})`).toBe(true);
            });
        });
    });

    it('consolidates the common Annex SL requirements into one question each', () => {
        const ims = checklist.clauses.find(c => c.mainClause === 'IMS');
        expect(ims).toBeTruthy();
        const context = ims.subClauses.find(s => /Understanding the organization/i.test(s.title));
        expect(context.standards).toEqual(['iso27001', 'iso22301', 'iso20000']);
        expect(context.citation).toContain('ISO/IEC 27001:2022 4.1');
        expect(context.citation).toContain('ISO 22301:2019 4.1');
        expect(context.citation).toContain('ISO/IEC 20000-1:2018 4.1');
        // Asked once, not once per standard and not once per document.
        expect(ims.subClauses.filter(s => /Understanding the organization/i.test(s.title))).toHaveLength(1);
    });

    it('keeps standard-specific requirements in their own sections', () => {
        const sections = checklist.clauses.map(c => c.mainClause);
        expect(sections).toContain('ISMS');
        expect(sections).toContain('BCMS');
        expect(sections).toContain('SMS');
        const bcms = checklist.clauses.find(c => c.mainClause === 'BCMS');
        expect(bcms.subClauses.every(s => s.standards.every(id => id === 'iso22301'))).toBe(true);
    });

    it('leads with the recertification priorities', () => {
        expect(checklist.clauses[0].mainClause).toBe('RECERT');
        const labels = checklist.clauses[0].subClauses.map(s => s.title);
        expect(labels).toContain('Previous audit findings and their corrective actions');
        expect(labels).toContain('Changes since the previous audit');
        expect(labels).toContain('Objectives, KPIs and achievement over the cycle');
        expect(labels).toContain('Internal audit programme across the cycle');
        expect(labels).toContain('Management review across the cycle');
    });

    it('samples Annex A controls rather than auditing management-system clauses only', () => {
        const annex = checklist.clauses.find(c => c.mainClause === 'A');
        expect(annex).toBeTruthy();
        const sampled = annex.subClauses.flatMap(s => s.refs.map(r => r.ref));
        expect(sampled.length).toBeGreaterThan(12);
        sampled.forEach(ref => {
            expect(ref).toMatch(/^A\.\d+\.\d+$/);
            expect(CS.isKnownRef('iso27001', ref)).toBe(true);
        });
        // Controls of one theme are sampled in one conversation, so there are
        // fewer questions than controls — and no control is asked twice.
        expect(annex.subClauses.length).toBeLessThan(sampled.length);
        expect(new Set(sampled).size).toBe(sampled.length);
    });

    it('spreads the Annex A sample across control themes, not all of A.5', () => {
        const annex = checklist.clauses.find(c => c.mainClause === 'A');
        const families = new Set(annex.subClauses.flatMap(s => s.refs.map(r => r.ref.split('.')[1])));
        expect(families.size).toBeGreaterThanOrEqual(3);
    });

    it('draws the Annex A sample from the SoA when one is supplied', () => {
        const soa = ['A.5.1', 'A.5.9', 'A.7.1', 'A.7.2', 'A.8.7', 'A.8.20'];
        const cl = B.buildClientChecklist(CLIENT, DOCS, {
            auditType: 'recertification', standard: IMS_SCOPE, manDays: 12, soaApplicable: soa
        });
        const annex = cl.clauses.find(c => c.mainClause === 'A');
        expect(annex.title).toMatch(/declared applicable in the SoA/);
        annex.subClauses.flatMap(s => s.refs.map(r => r.ref))
            .forEach(ref => expect(soa).toContain(ref));
    });

    it('keeps the process-based operational questions', () => {
        const text = allText(checklist);
        expect(text).toMatch(/incident/i);
        expect(text).toMatch(/change/i);
        expect(text).toMatch(/problem/i);
        expect(text).toMatch(/business impact analysis/i);
        expect(text).toMatch(/service level/i);
        expect(text).toMatch(/cloud/i);
        expect(text).toMatch(/supplier/i);
        expect(text).toMatch(/joiners, movers and leavers/i);
    });

    it('does not ask whether every document is controlled, one document at a time', () => {
        const controlQuestions = allItems(checklist)
            .filter(s => /current approved issue|uncontrolled cop/i.test(s.requirement));
        expect(controlQuestions.length).toBeLessThanOrEqual(1);
        const docSection = checklist.clauses.find(c => c.mainClause === 'DOC');
        expect(docSection.subClauses.length).toBeLessThanOrEqual(2);
        expect(docSection.subClauses[0].requirement).toMatch(/representative sample/i);
    });

    it('stays a practical audit sample, nowhere near the 379 items it replaced', () => {
        expect(checklist.itemCount).toBeGreaterThan(60);   // still covers three standards
        expect(checklist.itemCount).toBeLessThan(140);     // but is usable on site
        expect(checklist.itemCount).toBeLessThanOrEqual(checklist.targetItems);
    });

    it('sets length from scope and risk, not from how many documents were uploaded', () => {
        const few = B.buildClientChecklist(CLIENT, makeDocs(3), {
            auditType: 'recertification', standard: IMS_SCOPE, manDays: 12
        });
        const many = B.buildClientChecklist(CLIENT, makeDocs(120), {
            auditType: 'recertification', standard: IMS_SCOPE, manDays: 12
        });
        // 40x the documents must not meaningfully move the question count.
        expect(Math.abs(many.itemCount - few.itemCount)).toBeLessThanOrEqual(2);
    });

    it('passes its own QA validation with nothing to resolve', () => {
        expect(checklist.qa).toBeTruthy();
        expect(checklist.qa.counts.critical).toBe(0);
        expect(checklist.qa.counts.warning).toBe(0);
        expect(checklist.qa.ok).toBe(true);
    });

    it('asks each site and each theme-covered process once, not once per name', () => {
        const org = checklist.clauses.find(c => c.mainClause === 'ORG');
        const siteQuestions = org.subClauses.filter(s => /sampling plan|sites sampled/i.test(s.requirement));
        expect(siteQuestions).toHaveLength(1);
        expect(siteQuestions[0].requirement).toContain('Merrimack');
        expect(siteQuestions[0].requirement).toContain('Wilmington');
        // Incident / change / problem management are walked by the SMS themes,
        // so they get no second, blander walkthrough here.
        const walkthroughs = org.subClauses.filter(s => /walk the .* process end to end/i.test(s.requirement));
        expect(walkthroughs.every(s => !/incident|change|problem/i.test(s.title))).toBe(true);
    });
});

describe('buildClientChecklist — audit-type scaling', () => {
    it('a surveillance audit samples; it does not re-audit the standard', () => {
        const surv = B.buildClientChecklist(CLIENT, DOCS, {
            auditType: 'surveillance', standard: IMS_SCOPE, manDays: 3
        });
        const recert = B.buildClientChecklist(CLIENT, DOCS, {
            auditType: 'recertification', standard: IMS_SCOPE, manDays: 12
        });
        expect(surv.itemCount).toBeLessThan(recert.itemCount);
        expect(surv.clauses.some(c => c.mainClause === 'SURV')).toBe(true);
    });

    it('a single-standard scope generates only that standard', () => {
        const cl = B.buildClientChecklist(CLIENT, DOCS, {
            auditType: 'recertification', standardIds: ['iso27001'], manDays: 5
        });
        expect(cl.standardIds).toEqual(['iso27001']);
        allItems(cl).forEach(s => {
            (s.standards || []).forEach(id => expect(id).toBe('iso27001'));
        });
        expect(allText(cl)).not.toMatch(/business impact analysis|service level agreement/i);
    });

    it('never invents a citation — an unmappable item goes to the auditor instead', () => {
        const cl = B.buildClientChecklist(CLIENT, DOCS.concat([
            { id: 'x', name: 'Miscellaneous Working Notes', category: 'Other', linkedClauses: '' }
        ]), { auditType: 'recertification', standard: IMS_SCOPE, manDays: 12 });
        // Nothing the generator cannot map is given a citation. Such items land
        // in one of two sections: REVIEW for a question with no defensible
        // mapping, DOCNOTE for a document on file that maps to no requirement —
        // the latter is an awareness note, not a deficiency, so it is kept out
        // of the "for auditor review" section. Both carry no citation at all.
        const unmapped = cl.clauses.filter(c => c.mainClause === 'REVIEW' || c.mainClause === 'DOCNOTE');
        expect(unmapped.length).toBeGreaterThan(0);
        unmapped.forEach(section => {
            section.subClauses.forEach(s => {
                expect(s.auditorReview).toBe(true);
                expect(s.refs).toEqual([]);
                expect(s.criterionRef).toBe('');
            });
        });

        const docNote = cl.clauses.find(c => c.mainClause === 'DOCNOTE');
        expect(docNote).toBeTruthy();
        expect(docNote.subClauses[0].documentNote).toBe(true);
        // The wording must not read as a finding against the organisation.
        expect(docNote.subClauses[0].requirement).toMatch(/not a finding|implies no nonconformity/i);
    });

    it('flags a standard the registry does not hold instead of auditing it as ISO 9001', () => {
        const cl = B.buildClientChecklist(CLIENT, DOCS, {
            auditType: 'recertification',
            standard: 'ISO 27001:2022, ISO 50001:2018',
            manDays: 8
        });
        const review = cl.clauses.find(c => c.mainClause === 'REVIEW');
        const note = review.subClauses.find(s => /clause registry/i.test(s.title));
        expect(note.requirement).toContain('ISO 50001:2018');
        expect(allText(cl)).not.toMatch(/energy (review|baseline|performance indicator)/i);
    });

    it('falls back to the document-driven build for a standard outside the registry', () => {
        const cl = B.buildClientChecklist(
            { id: 'q', name: 'Acme Ltd', standard: 'ISO 9001:2015' },
            DOCS,
            { auditType: 'surveillance', standard: 'ISO 9001:2015' }
        );
        expect(cl.generator).toBeUndefined();
        expect(cl.clauses.length).toBeGreaterThan(0);
    });
});

describe('riskBasedBudget', () => {
    it('scales the sample with man-days rather than with document count', () => {
        const short = B.riskBasedBudget('recertification', ['iso27001'], 2, { band: 'medium' }, 1);
        const long = B.riskBasedBudget('recertification', ['iso27001'], 10, { band: 'medium' }, 1);
        expect(long.annexASample).toBeGreaterThan(short.annexASample);
    });

    it('samples a micro organisation more lightly than a large one', () => {
        const micro = B.riskBasedBudget('surveillance', ['iso27001'], 1, { band: 'micro' }, 1);
        const large = B.riskBasedBudget('surveillance', ['iso27001'], 1, { band: 'large' }, 1);
        expect(micro.processSample).toBeLessThan(large.processSample);
    });

    it('never lets an initial or recertification audit sample away clause coverage', () => {
        expect(B.riskBasedBudget('recertification', ['iso27001'], 1, {}, 1).coverAllClauses).toBe(true);
        expect(B.riskBasedBudget('initial', ['iso27001'], 1, {}, 1).coverAllClauses).toBe(true);
        expect(B.riskBasedBudget('surveillance', ['iso27001'], 1, {}, 1).coverAllClauses).toBe(false);
    });

    it('caps the document sample regardless of how many documents exist', () => {
        const b = B.riskBasedBudget('recertification', ['iso27001'], 30, { band: 'large' }, 12);
        expect(b.documentSample).toBeLessThanOrEqual(4);
    });
});

describe('ChecklistQA — the pass that runs before PDF generation', () => {
    const ctx = { standardIds: ['iso27001', 'iso22301', 'iso20000'], auditType: 'recertification', ceiling: 130 };

    function wrap(subClauses) {
        return { clauses: [{ mainClause: 'X', title: 'X', subClauses }] };
    }

    it('passes a clean scope-driven checklist', () => {
        const cl = B.buildClientChecklist(CLIENT, DOCS, {
            auditType: 'recertification', standard: IMS_SCOPE, manDays: 12
        });
        const r = QA.validate(cl, cl.qaContext);
        expect(r.counts.critical).toBe(0);
    });

    it('flags a clause belonging to an unselected standard', () => {
        const r = QA.validate(wrap([{
            clause: '8.3', title: 'Design and development of products and services',
            requirement: 'Verify the design and development process is planned and controlled.',
            items: [{ clause: '8.3', requirement: 'x' }]
        }]), ctx);
        const hit = r.issues.find(i => i.code === 'OUT_OF_SCOPE_STANDARD');
        expect(hit).toBeTruthy();
        expect(hit.origin).toContain('ISO 9001');
        expect(r.blocking).toBe(true);
    });

    it('flags ISO 9001 measuring-equipment and customer-focus requirements', () => {
        const r = QA.validate(wrap([
            { clause: '7.1.5', title: 'Monitoring and measuring resources', requirement: 'Confirm measuring equipment is calibrated at defined intervals.', items: [{}] },
            { clause: '5.1', title: 'Customer focus', requirement: 'Verify top management demonstrates customer focus.', items: [{}] }
        ]), ctx);
        expect(r.issues.filter(i => i.code === 'OUT_OF_SCOPE_STANDARD').length).toBeGreaterThanOrEqual(2);
    });

    it('accepts customer satisfaction when ISO/IEC 20000-1 is in scope, rejects it otherwise', () => {
        const item = [{ clause: '8.3.2', title: 'Business relationship management', requirement: 'Verify customer satisfaction is measured and acted on.', refs: [{ stdId: 'iso20000', ref: '8.3.2' }], items: [{}] }];
        const inScope = QA.validate(wrap(item), ctx);
        expect(inScope.issues.some(i => i.code === 'OUT_OF_SCOPE_STANDARD')).toBe(false);

        const outOfScope = QA.validate(wrap(item), { standardIds: ['iso27001'], auditType: 'recertification' });
        expect(outOfScope.issues.some(i => i.code === 'OUT_OF_SCOPE_STANDARD')).toBe(true);
    });

    it('flags an invalid clause reference', () => {
        const r = QA.validate(wrap([{
            clause: '12.9', title: 'Invented clause', requirement: 'Verify something.',
            refs: [{ stdId: 'iso27001', ref: '12.9' }], items: [{}]
        }]), ctx);
        expect(r.issues.some(i => i.code === 'INVALID_REF')).toBe(true);
    });

    it('flags duplicate and near-duplicate questions', () => {
        const q = 'Verify the internal audit programme covers every requirement of every certified standard over the cycle.';
        const r = QA.validate(wrap([
            { clause: '9.2', title: 'Internal audit', requirement: q, refs: [{ stdId: 'iso27001', ref: '9.2' }], items: [{}] },
            { clause: '9.2', title: 'Internal audit', requirement: q, refs: [{ stdId: 'iso22301', ref: '9.2' }], items: [{}] }
        ]), ctx);
        expect(r.issues.some(i => i.code === 'DUPLICATE_QUESTION')).toBe(true);
    });

    it('flags repeated document-control boilerplate', () => {
        const subs = Array.from({ length: 6 }, (_, i) => ({
            clause: '7.5', title: `Doc ${i}`,
            requirement: `Confirm Document ${i} is the current approved issue, available where used, and that no uncontrolled copies are in circulation.`,
            refs: [{ stdId: 'iso27001', ref: '7.5' }], items: [{}]
        }));
        const r = QA.validate(wrap(subs), ctx);
        expect(r.issues.some(i => i.code === 'REPETITIVE_BOILERPLATE')).toBe(true);
    });

    it('flags a contradictory mapping — one clause number, two meanings, no standard named', () => {
        const r = QA.validate(wrap([{
            clause: '8.3', title: 'Risk treatment or continuity strategy?',
            requirement: 'Verify the requirements of clause 8.3 are met.', items: [{}]
        }]), { standardIds: ['iso27001', 'iso22301'], auditType: 'recertification' });
        expect(r.issues.some(i => i.code === 'CONTRADICTORY_MAPPING')).toBe(true);
    });

    it('flags an excessive question count against the risk-based ceiling', () => {
        const subs = Array.from({ length: 200 }, (_, i) => ({
            clause: '7.5', title: `Q${i}`, requirement: `Distinct question number ${i} about topic ${i}.`,
            refs: [{ stdId: 'iso27001', ref: '7.5' }], items: [{}]
        }));
        const r = QA.validate(wrap(subs), Object.assign({}, ctx, { ceiling: 120 }));
        const hit = r.issues.find(i => i.code === 'EXCESSIVE_COUNT');
        expect(hit).toBeTruthy();
        expect(hit.count).toBe(200);
    });

    it('flags missing requirements of a selected standard on a recertification', () => {
        const r = QA.validate(wrap([{
            clause: '4.1', title: 'Context', requirement: 'Verify context.',
            refs: [{ stdId: 'iso27001', ref: '4.1' }], items: [{}]
        }]), ctx);
        const hit = r.issues.find(i => i.code === 'MISSING_REQUIREMENT');
        expect(hit).toBeTruthy();
        expect(hit.severity).toBe('critical');
    });

    it('flags an ISMS audit that samples no Annex A control at all', () => {
        const r = QA.validate(wrap([{
            clause: '4.1', title: 'Context', requirement: 'Verify context.',
            refs: [{ stdId: 'iso27001', ref: '4.1' }], items: [{}]
        }]), { standardIds: ['iso27001'], auditType: 'recertification' });
        expect(r.issues.some(i => i.code === 'MISSING_ANNEX_A' && i.severity === 'critical')).toBe(true);
    });

    it('records auditor hand-offs as a note rather than a failure', () => {
        const r = QA.validate(wrap([{
            clause: 'REVIEW', title: 'Unmapped', requirement: 'Determine on site.',
            refs: [], auditorReview: true, items: [{}]
        }]), { standardIds: [], auditType: 'recertification' });
        const hit = r.issues.find(i => i.code === 'AUDITOR_REVIEW');
        expect(hit.severity).toBe('info');
    });

    it('would have failed the checklist that started this — 379 items of ISO 9001', () => {
        const subs = Array.from({ length: 379 }, (_, i) => ({
            clause: i % 3 === 0 ? '8.3' : '7.1.5',
            title: i % 3 === 0 ? 'Design and development' : 'Monitoring and measuring equipment',
            requirement: `Confirm Document ${i} is the current approved issue, available where used, and that no uncontrolled copies are in circulation.`,
            items: [{}]
        }));
        const r = QA.validate(wrap(subs), Object.assign({}, ctx, { ceiling: 120 }));
        expect(r.blocking).toBe(true);
        const codes = new Set(r.issues.map(i => i.code));
        expect(codes.has('OUT_OF_SCOPE_STANDARD')).toBe(true);
        expect(codes.has('EXCESSIVE_COUNT')).toBe(true);
        expect(codes.has('REPETITIVE_BOILERPLATE')).toBe(true);
        expect(codes.has('DUPLICATE_QUESTION')).toBe(true);
    });
});

describe('Standard attribution on uploaded documents', () => {
    it('detects the standard from the document name', () => {
        const p = B.parseDocumentName('ITSMS Objectives Procedure for ISO 20000-1 (IT Service Management).docx');
        expect(B.mapStandards(p, null).ids).toEqual(['iso20000']);
    });

    it('detects a system acronym when no number is present', () => {
        expect(B.detectStandards('ISMS Access Control Policy').map(s => s.id)).toEqual(['iso27001']);
        expect(B.detectStandards('BCMS Exercise Programme').map(s => s.id)).toEqual(['iso22301']);
    });

    it('picks up every standard an integrated manual names', () => {
        const ids = B.detectStandards('Integrated Management System Manual — ISO 27001, ISO 22301 and ISO 20000-1')
            .map(s => s.id);
        expect(ids).toEqual(['iso27001', 'iso22301', 'iso20000']);
    });

    it('does not let a body cross-reference re-tag a document the name already identifies', () => {
        const parsed = B.parseDocumentName('ISMS Risk Treatment Procedure.docx');
        const content = { standards: [{ id: 'iso22301', label: 'ISO 22301:2019' }] };
        expect(B.mapStandards(parsed, content).ids).toEqual(['iso27001']);
    });

    it('reads the body only when the name says nothing', () => {
        const parsed = B.parseDocumentName('Procedure 14.docx');
        const content = { standards: [{ id: 'iso22301', label: 'ISO 22301:2019' }] };
        expect(B.mapStandards(parsed, content).ids).toEqual(['iso22301']);
    });

    describe('docCoversRef', () => {
        const smsDoc = { name: 'ITSMS Objectives', linkedClauses: '6.2', linkedStandards: 'iso20000' };
        const sharedDoc = { name: 'IMS Manual', linkedClauses: '6.2', linkedStandards: '' };

        it('counts a document only toward the standard it names', () => {
            expect(B.docCoversRef(smsDoc, 'iso20000', '6.2')).toBe(true);
            expect(B.docCoversRef(smsDoc, 'iso27001', '6.2')).toBe(false);
            expect(B.docCoversRef(smsDoc, 'iso22301', '6.2')).toBe(false);
        });

        it('counts a document that names no standard toward all of them', () => {
            expect(B.docCoversRef(sharedDoc, 'iso27001', '6.2')).toBe(true);
            expect(B.docCoversRef(sharedDoc, 'iso20000', '6.2')).toBe(true);
        });
    });

    it('gap analysis no longer credits a 20000-1 procedure to a 27001 clause', () => {
        const docs = [{ name: 'ITSMS Context Procedure', linkedClauses: '4.1', linkedStandards: 'iso20000' }];
        const clauses = [{ clause: '4.1', title: 'Context', requirement: '' }];
        expect(B.analyseDocumentGaps(clauses, docs, 'iso20000').covered).toBe(1);
        expect(B.analyseDocumentGaps(clauses, docs, 'iso27001').covered).toBe(0);
    });

    it('analyses every selected standard in one pass for an integrated system', () => {
        const docs = [
            { name: 'ISMS Context', linkedClauses: '4.1', linkedStandards: 'iso27001' },
            { name: 'ITSMS Context', linkedClauses: '4.1', linkedStandards: 'iso20000' }
        ];
        const results = B.analyseGapsForStandards(['ISO 27001:2022', 'ISO/IEC 20000-1:2018'], docs);
        expect(results).toHaveLength(2);
        expect(results[0].id).toBe('iso27001');
        expect(results[1].id).toBe('iso20000');
        results.forEach(r => expect(r.analysis.rows.find(row => row.clause === '4.1').covered).toBe(true));
    });

    it('evidence hints are matched per standard, not on the clause number alone', () => {
        const docs = [{ name: 'ITSMS Objectives Procedure', linkedClauses: '6.2', linkedStandards: 'iso20000' }];
        expect(B.evidenceHint(docs, [{ stdId: 'iso20000', ref: '6.2' }])).toContain('ITSMS Objectives Procedure');
        expect(B.evidenceHint(docs, [{ stdId: 'iso27001', ref: '6.2' }])).toBe('');
    });
});
