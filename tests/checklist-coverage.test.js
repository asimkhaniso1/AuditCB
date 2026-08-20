// Recertification coverage validation.
//
// Two rules are under test and they pull in opposite directions, which is the
// whole point of the module:
//
//   1. a recertification is judged over the WHOLE certification cycle, so a
//      requirement covered by an earlier audit in the cycle is covered — and
//      one covered nowhere in the cycle is a gap;
//   2. Annex A is NOT audited in full at every audit. Controls are selected
//      risk-based from the applicable (SoA) set, and only the applicable set
//      as a whole is expected to have been covered by the close of the cycle.
//
// A checklist that fails either rule must not be markable Ready for Audit,
// and neither must one carrying duplicate or unmapped questions.
import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;

const fs = await import('fs');
const path = await import('path');

function loadModule(file) {
    const src = fs.readFileSync(path.resolve(file), 'utf8');
    // eslint-disable-next-line no-unused-vars
    const module = undefined;
    eval(src);
}

/** A checklist covering exactly the clause/control refs given. */
function checklistOf(refs, extra) {
    return Object.assign({
        id: 'cl-1', name: 'Recertification Audit Checklist', standard: 'ISO/IEC 27001:2022',
        standardIds: ['iso27001'], auditType: 'recertification', type: 'custom',
        clauses: [{
            mainClause: 'RECERT', title: 'Recertification',
            subClauses: refs.map((r, i) => ({
                clause: r, title: 'Question ' + (i + 1),
                requirement: 'Verify the requirement at ' + r + ' is implemented and effective.',
                refs: [{ stdId: 'iso27001', ref: r }]
            }))
        }]
    }, extra || {});
}

/** Every mandatory clause of a standard — the "fully covered" baseline. */
function allMandatory(stdId) {
    return window.ChecklistStandards.byId(stdId).clauses
        .filter(c => c.mandatory).map(c => c.ref);
}

function ctxOf(over) {
    return Object.assign({
        standardIds: ['iso27001'],
        auditType: 'recertification',
        soaApplicable: [],
        cycle: { start: '2023-08-01', end: '2026-07-31', anchored: 'certificate', stages: [] },
        priorAudits: [], priorChecklists: [], keyProcesses: [],
        findings: [], incidents: [], changes: [], riskDocs: []
    }, over || {});
}

function codes(result) {
    return result.issues.map(i => i.code);
}

describe('ChecklistCoverage.assess — requirements over the certification cycle', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    it('flags a requirement audited nowhere in the cycle, at recertification', () => {
        const mandatory = allMandatory('iso27001');
        const res = window.ChecklistCoverage.assess(
            checklistOf(mandatory.slice(0, mandatory.length - 3)), ctxOf());
        const gap = res.issues.find(i => i.code === 'CYCLE_REQUIREMENT_GAP');
        expect(gap).toBeTruthy();
        expect(gap.severity).toBe('critical');
        expect(gap.missing).toHaveLength(3);
        expect(res.blocking).toBe(true);
    });

    it('counts a requirement covered by an earlier audit in the same cycle as covered', () => {
        const mandatory = allMandatory('iso27001');
        const here = mandatory.slice(0, mandatory.length - 3);
        const earlier = checklistOf(mandatory.slice(mandatory.length - 3));
        const res = window.ChecklistCoverage.assess(
            checklistOf(here), ctxOf({ priorChecklists: [earlier] }));
        expect(codes(res)).not.toContain('CYCLE_REQUIREMENT_GAP');
    });

    it('does not turn a surveillance sample into a gap — surveillance samples, it does not re-audit', () => {
        const mandatory = allMandatory('iso27001');
        const res = window.ChecklistCoverage.assess(
            checklistOf(mandatory.slice(0, 4), { auditType: 'surveillance' }),
            ctxOf({ auditType: 'surveillance' }));
        const gap = res.issues.find(i => i.code === 'CYCLE_REQUIREMENT_GAP');
        expect(gap.severity).toBe('info');
        expect(res.blocking).toBe(false);
    });

    it('reports coverage figures for this audit and for the cycle', () => {
        const mandatory = allMandatory('iso27001');
        const res = window.ChecklistCoverage.assess(
            checklistOf(mandatory.slice(0, 5)),
            ctxOf({ priorChecklists: [checklistOf(mandatory.slice(5))] }));
        const row = res.coverage.clauses.find(c => c.stdId === 'iso27001');
        expect(row.thisAudit).toBe(5);
        expect(row.cycle).toBe(row.total);
    });
});

describe('ChecklistCoverage — risk-based Annex A selection', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    it('does not require every applicable control to be sampled at this audit', () => {
        const soa = ['A.5.1', 'A.5.9', 'A.5.15', 'A.8.8', 'A.8.13'];
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001').concat(['A.5.1'])),
            ctxOf({ soaApplicable: soa }));
        // Four of the five applicable controls are unsampled, and with no risk
        // driver pointing at any of them that is not a per-audit failure.
        expect(codes(res)).not.toContain('RISK_CONTROL_GAP');
    });

    it('requires a control a previous finding points at, by reference', () => {
        const soa = ['A.5.1', 'A.8.13'];
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001').concat(['A.5.1'])),
            ctxOf({
                soaApplicable: soa,
                findings: [{ clause: '8.1', grade: 'Minor', text: 'Backups were not restorable — A.8.13 not effective.' }]
            }));
        const gap = res.issues.find(i => i.code === 'RISK_CONTROL_GAP');
        expect(gap).toBeTruthy();
        expect(gap.severity).toBe('critical');
        expect(gap.controls.map(c => c.ref)).toContain('A.8.13');
        expect(gap.controls.find(c => c.ref === 'A.8.13').why).toContain('previous audit result');
    });

    it('reaches incident-response controls from an incident that cites no control', () => {
        const sel = window.ChecklistCoverage.riskDrivenControls(
            window.ChecklistStandards.byId('iso27001'),
            ctxOf({
                soaApplicable: ['A.5.24', 'A.5.26', 'A.7.1'],
                incidents: [{ text: 'Client complaint about an unreported security breach.' }]
            }));
        const refs = sel.required.map(r => r.ref);
        expect(refs).toContain('A.5.24');
        expect(refs).toContain('A.5.26');
        // A physical-security control is not made auditable by an incident that
        // says nothing about it.
        expect(refs).not.toContain('A.7.1');
    });

    it('never requires a control the Statement of Applicability excludes', () => {
        const sel = window.ChecklistCoverage.riskDrivenControls(
            window.ChecklistStandards.byId('iso27001'),
            ctxOf({
                soaApplicable: ['A.5.1'],
                findings: [{ clause: '', grade: 'Major', text: 'A.8.13 backup failure' }]
            }));
        expect(sel.pool.map(c => c.ref)).toEqual(['A.5.1']);
        expect(sel.required.map(r => r.ref)).not.toContain('A.8.13');
    });

    it('says which risk drivers had no data rather than assuming them', () => {
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001')), ctxOf({ soaApplicable: ['A.5.1'] }));
        const note = res.issues.find(i => i.code === 'RISK_DRIVER_UNAVAILABLE');
        expect(note.severity).toBe('info');
        expect(note.missing).toContain('previous audit result');
        expect(note.missing).toContain('incident, complaint or appeal');
    });

    it('warns, rather than assuming an SoA, when none was supplied', () => {
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001')), ctxOf());
        const w = res.issues.find(i => i.code === 'SOA_NOT_SUPPLIED');
        expect(w.severity).toBe('warning');
        expect(res.coverage.controls[0].soaDriven).toBe(false);
    });

    it('flags applicable controls sampled at no audit in the cycle, only as the cycle closes', () => {
        const soa = ['A.5.1', 'A.5.9', 'A.5.15'];
        const base = allMandatory('iso27001');
        const closing = window.ChecklistCoverage.assess(
            checklistOf(base.concat(['A.5.1'])), ctxOf({ soaApplicable: soa }));
        const gap = closing.issues.find(i => i.code === 'CYCLE_CONTROL_GAP');
        expect(gap.missing).toEqual(['A.5.9', 'A.5.15']);

        const surveillance = window.ChecklistCoverage.assess(
            checklistOf(base.concat(['A.5.1']), { auditType: 'surveillance' }),
            ctxOf({ soaApplicable: soa, auditType: 'surveillance' }));
        expect(codes(surveillance)).not.toContain('CYCLE_CONTROL_GAP');
    });

    it('counts a control sampled at an earlier audit in the cycle as covered', () => {
        const soa = ['A.5.1', 'A.5.9'];
        const base = allMandatory('iso27001');
        const res = window.ChecklistCoverage.assess(
            checklistOf(base.concat(['A.5.1'])),
            ctxOf({ soaApplicable: soa, priorChecklists: [checklistOf(['A.5.9'])] }));
        expect(codes(res)).not.toContain('CYCLE_CONTROL_GAP');
    });
});

describe('ChecklistCoverage — critical processes', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    it('flags a key process audited nowhere in the cycle', () => {
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001')),
            ctxOf({ keyProcesses: [{ name: 'Managed Detection and Response' }, { name: 'Client Onboarding' }] }));
        const gap = res.issues.find(i => i.code === 'CYCLE_PROCESS_GAP');
        expect(gap.processes).toContain('Managed Detection and Response');
        expect(res.coverage.processes.total).toBe(2);
    });

    it('counts a process walked by an earlier audit in the cycle as covered', () => {
        const earlier = checklistOf(['5.1']);
        earlier.clauses[0].subClauses[0].requirement =
            'Walk the Client Onboarding process end to end and verify it runs as planned.';
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001')),
            ctxOf({ keyProcesses: [{ name: 'Client Onboarding' }], priorChecklists: [earlier] }));
        expect(codes(res)).not.toContain('CYCLE_PROCESS_GAP');
    });
});

describe('ChecklistCoverage.readiness — the Ready for Audit gate', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    const qaWith = (issues) => ({ issues, counts: {}, itemCount: issues.length });

    it('blocks on a duplicate question', () => {
        const r = window.ChecklistCoverage.readiness({}, {
            qa: qaWith([{ code: 'NEAR_DUPLICATE', severity: 'warning', message: 'Reads as the same question as "8.2.2".', itemRef: '8.2.1', nearRef: '8.2.2' }])
        });
        expect(r.ready).toBe(false);
        expect(r.counts.duplicates).toBe(1);
    });

    it('blocks on an item carrying no clause', () => {
        const r = window.ChecklistCoverage.readiness({}, {
            qa: qaWith([{ code: 'AUDITOR_REVIEW', severity: 'info', message: '2 item(s) carry no clause citation.', itemRef: '' }])
        });
        expect(r.ready).toBe(false);
        expect(r.counts.unmapped).toBe(1);
    });

    it('blocks on a cycle coverage gap', () => {
        const r = window.ChecklistCoverage.readiness({}, {
            coverage: { issues: [{ code: 'CYCLE_REQUIREMENT_GAP', severity: 'critical', message: '3 requirement(s) audited nowhere.', itemRef: '' }] }
        });
        expect(r.ready).toBe(false);
        expect(r.counts.coverage).toBe(1);
    });

    it('lets informational notes through — they are not blockers', () => {
        const r = window.ChecklistCoverage.readiness({}, {
            qa: qaWith([{ code: 'REPETITIVE_BOILERPLATE', severity: 'warning', message: 'asked 5 times', itemRef: '7.5' }]),
            coverage: { issues: [{ code: 'RISK_DRIVER_UNAVAILABLE', severity: 'info', message: 'no incidents on file', itemRef: '' }] }
        });
        expect(r.ready).toBe(true);
        expect(r.notes).toHaveLength(2);
    });

    it('stops blocking once the auditor records a disposition for that exact issue', () => {
        const issue = { code: 'NEAR_DUPLICATE', severity: 'warning', message: 'same as 8.2.2', itemRef: '8.2.1', nearRef: '8.2.2' };
        const before = window.ChecklistCoverage.readiness({}, { qa: qaWith([issue]) });
        expect(before.ready).toBe(false);

        const checklist = { resolvedIssues: { [before.blockers[0].key]: { action: 'justified', note: 'Both questions test different sites.', by: 'Admin', at: '2026-08-20' } } };
        const after = window.ChecklistCoverage.readiness(checklist, { qa: qaWith([issue]) });
        expect(after.ready).toBe(true);
        expect(after.notes[0].resolved.note).toMatch(/different sites/);
    });

    it('a disposition recorded for one item does not clear the same issue on another', () => {
        const a = { code: 'NEAR_DUPLICATE', severity: 'warning', message: 'x', itemRef: '8.2.1', nearRef: '8.2.2' };
        const b = { code: 'NEAR_DUPLICATE', severity: 'warning', message: 'x', itemRef: '9.1', nearRef: '9.1.1' };
        const first = window.ChecklistCoverage.readiness({}, { qa: qaWith([a, b]) });
        const checklist = { resolvedIssues: { [first.blockers[0].key]: { action: 'justified', note: 'n', by: 'Admin', at: '2026-08-20' } } };
        const after = window.ChecklistCoverage.readiness(checklist, { qa: qaWith([a, b]) });
        expect(after.ready).toBe(false);
        expect(after.blockers).toHaveLength(1);
        expect(after.blockers[0].itemRef).toBe('9.1');
    });
});

describe('ChecklistCoverage.buildContext — cycle assembly from state', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
        window.state = {
            clients: [{
                id: 'c-1', name: 'PC CONNECTION, INC.',
                certificates: [{ standard: 'ISO/IEC 27001:2022', initialDate: '2023-08-01', expiryDate: '2026-07-31' }],
                keyProcesses: [{ name: 'Managed Services' }],
                documents: [{ name: 'Information Security Risk Assessment (Rev 4)', category: 'Risk' }]
            }],
            auditPlans: [
                { id: 'p-1', clientId: 'c-1', startDate: '2024-08-05', auditType: 'Surveillance 1', selectedChecklists: ['cl-prior'] },
                { id: 'p-2', clientId: 'c-1', startDate: '2026-08-20', auditType: 'Recertification', selectedChecklists: ['cl-1'] },
                { id: 'p-9', clientId: 'c-9', startDate: '2024-09-01', auditType: 'Surveillance 1', selectedChecklists: ['cl-other'] }
            ],
            checklists: [checklistOf(['5.1'], { id: 'cl-prior' }), checklistOf(['9.2'], { id: 'cl-other' })],
            ncrs: [{ auditId: 'p-1', clause: 'A.8.13', description: 'Backup restore test not evidenced' }],
            complaints: [], appeals: []
        };
    });

    it('anchors the cycle on the client certificate', () => {
        const ctx = window.ChecklistCoverage.buildContext(
            checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), { planId: 'p-2' });
        expect(ctx.cycle.start).toBe('2023-08-01');
        expect(ctx.cycle.end).toBe('2026-07-31');
    });

    it('reads the prior audit\'s checklist for coverage, and never another client\'s', () => {
        const ctx = window.ChecklistCoverage.buildContext(
            checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), { planId: 'p-2' });
        expect(ctx.priorChecklists.map(c => c.id)).toEqual(['cl-prior']);
    });

    it('picks up previous findings from the CAPA register via the plan', () => {
        const ctx = window.ChecklistCoverage.buildContext(
            checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), { planId: 'p-2' });
        expect(ctx.findings).toHaveLength(1);
        expect(ctx.findings[0].clause).toBe('A.8.13');
    });

    it('recognises the risk assessment on file as a selection driver', () => {
        const ctx = window.ChecklistCoverage.buildContext(
            checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), { planId: 'p-2' });
        expect(ctx.riskDocs).toHaveLength(1);
        expect(ctx.keyProcesses[0].name).toBe('Managed Services');
    });
});

describe('ChecklistCoverage.readiness — nothing could be validated', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    it('refuses to call an unvalidatable checklist ready', () => {
        const r = window.ChecklistCoverage.readiness({}, {
            qa: null,
            coverage: { issues: [{ code: 'COVERAGE_UNAVAILABLE', severity: 'info', message: 'not tied to a standard', itemRef: '' }] }
        });
        expect(r.ready).toBe(false);
        expect(r.blockers[0].code).toBe('VALIDATION_UNAVAILABLE');
    });

    it('does not add that blocker when the QA pass did run', () => {
        const r = window.ChecklistCoverage.readiness({}, { qa: { issues: [] }, coverage: null });
        expect(r.ready).toBe(true);
    });
});

describe('ChecklistCoverage.assess — SoA read from a client document', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    it('drives the applicable pool from the document\'s refs and stops warning that none was supplied', () => {
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001')),
            ctxOf({
                soaSource: 'document',
                soaApplicable: ['A.5.1', 'A.5.9', 'A.8.13'],
                soaDocument: { name: 'ISO27001 Statement of Applicability', revision: 'Rev 3', date: '2026-01-15', refCount: 3 }
            }));
        const row = res.coverage.controls[0];
        expect(row.pool).toBe(3);
        expect(row.soaDriven).toBe(true);
        expect(row.soaSource).toBe('document');
        expect(codes(res)).not.toContain('SOA_NOT_SUPPLIED');
        const note = res.issues.find(i => i.code === 'SOA_FROM_DOCUMENT');
        expect(note).toBeTruthy();
        expect(note.severity).toBe('info');
        expect(note.message).toMatch(/ISO27001 Statement of Applicability/);
        expect(note.message).toMatch(/3 control/);
    });

    it('reports an SoA document that yielded no control references, instead of assuming tier 1 in silence', () => {
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001')),
            ctxOf({
                soaSource: null,
                soaApplicable: [],
                soaDocument: { name: 'ISO27001 Statement of Applicability', revision: 'Rev 1', date: '', refCount: 0 }
            }));
        expect(codes(res)).not.toContain('SOA_NOT_SUPPLIED');
        const note = res.issues.find(i => i.code === 'SOA_DOCUMENT_UNREADABLE');
        expect(note).toBeTruthy();
        expect(note.severity).toBe('warning');
        expect(note.message).toMatch(/ISO27001 Statement of Applicability/);
        expect(res.coverage.controls[0].soaDriven).toBe(false);
    });
});

describe('ChecklistCoverage.buildContext — Statement of Applicability from a document', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    function stateWithDocs(documents) {
        return {
            clients: [{
                id: 'c-1', name: 'Acme ISMS Ltd',
                certificates: [{ standard: 'ISO/IEC 27001:2022', initialDate: '2023-08-01', expiryDate: '2026-07-31' }],
                keyProcesses: [], documents
            }],
            auditPlans: [], checklists: [], ncrs: [], complaints: [], appeals: []
        };
    }

    it('reads Annex A references off the current SoA document when none were pasted', () => {
        window.state = stateWithDocs([{
            name: 'ISO27001 Statement of Applicability', category: 'Other', revision: 'Rev 3', date: '2026-01-15',
            notes: 'Controls declared applicable: A.5.1, A.5.9, A.8.13.'
        }]);
        const ctx = window.ChecklistCoverage.buildContext(checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        expect(ctx.soaSource).toBe('document');
        expect(ctx.soaApplicable.slice().sort()).toEqual(['A.5.1', 'A.5.9', 'A.8.13']);
        expect(ctx.soaDocument.name).toBe('ISO27001 Statement of Applicability');
        expect(ctx.soaDocument.revision).toBe('Rev 3');
    });

    it('uses the most recent SoA document when several are on file', () => {
        window.state = stateWithDocs([
            { name: 'ISO27001 Statement of Applicability', revision: 'Rev 1', date: '2024-01-01', notes: 'Applicable: A.5.1.' },
            { name: 'ISO27001 Statement of Applicability', revision: 'Rev 2', date: '2026-01-15', notes: 'Applicable: A.5.9, A.8.13.' }
        ]);
        const ctx = window.ChecklistCoverage.buildContext(checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        expect(ctx.soaApplicable.slice().sort()).toEqual(['A.5.9', 'A.8.13']);
        expect(ctx.soaDocument.revision).toBe('Rev 2');
    });

    it('reports an SoA document that could not be read rather than silently assuming', () => {
        window.state = stateWithDocs([{
            name: 'ISO27001 Statement of Applicability', revision: 'Rev 1', date: '2026-01-15',
            notes: 'All controls in Annex A apply to the certified scope.'
        }]);
        const ctx = window.ChecklistCoverage.buildContext(checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        expect(ctx.soaSource).toBe(null);
        expect(ctx.soaApplicable).toEqual([]);
        expect(ctx.soaDocument).toBeTruthy();
        expect(ctx.soaDocument.refCount).toBe(0);
    });

    it('does not mistake a risk assessment that mentions the SoA for the SoA itself', () => {
        window.state = stateWithDocs([{
            name: 'Information Security Risk Assessment', category: 'Risk', revision: 'Rev 4', date: '2026-01-15',
            notes: 'Treatment cross-referenced against the SoA for controls A.5.1 and A.8.13.'
        }]);
        const ctx = window.ChecklistCoverage.buildContext(checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        expect(ctx.soaSource).toBe(null);
        expect(ctx.soaDocument).toBe(null);
        expect(ctx.soaApplicable).toEqual([]);
    });

    it('lets a pasted SoA win over a document on file', () => {
        window.state = stateWithDocs([{
            name: 'ISO27001 Statement of Applicability', revision: 'Rev 3', date: '2026-01-15',
            notes: 'Applicable: A.5.9, A.8.13.'
        }]);
        const checklist = checklistOf(['5.1'], {
            clientId: 'c-1', id: 'cl-1', qaContext: { standardIds: ['iso27001'], auditType: 'recertification', soaApplicable: ['A.5.1'] }
        });
        const ctx = window.ChecklistCoverage.buildContext(checklist, {});
        expect(ctx.soaSource).toBe('supplied');
        expect(ctx.soaApplicable).toEqual(['A.5.1']);
        expect(ctx.soaDocument).toBe(null);
    });

    it('counts how many client documents were actually searched for an SoA', () => {
        window.state = stateWithDocs([
            { name: 'Quality Manual', category: 'System Manual' },
            { name: 'Access Control Procedure', category: 'Quality Procedures' }
        ]);
        const ctx = window.ChecklistCoverage.buildContext(checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        expect(ctx.soaDocsChecked).toBe(2);
        expect(ctx.soaDocument).toBe(null);
    });
});

describe('ChecklistCoverage.assess — SoA gap messages name what was searched', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    // This is the live spec: real recertification output for a client with no
    // SoA on file read as generic ("no Statement of Applicability was
    // supplied") regardless of whether any documents existed to search. The
    // fix makes the count of documents actually checked part of the message.
    it('says how many documents were checked and found no match, when documents exist', () => {
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001')), ctxOf({ soaDocsChecked: 6 }));
        const w = res.issues.find(i => i.code === 'SOA_NOT_SUPPLIED');
        expect(w.message).toMatch(/6 client document/);
        expect(w.message).toMatch(/searched each document's name and category/);
    });

    it('says there are no documents at all, rather than a generic message, when the client has none', () => {
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001')), ctxOf({ soaDocsChecked: 0 }));
        const w = res.issues.find(i => i.code === 'SOA_NOT_SUPPLIED');
        expect(w.message).toMatch(/no documents on file at all/);
    });

    it('tells the auditor to paste references into the document, not to re-upload it, when found but unreadable', () => {
        const res = window.ChecklistCoverage.assess(
            checklistOf(allMandatory('iso27001')),
            ctxOf({
                soaDocsChecked: 1,
                soaDocument: { name: 'ISO27001 Statement of Applicability', revision: 'Rev 1', date: '2026-01-15', refCount: 0 }
            }));
        const w = res.issues.find(i => i.code === 'SOA_DOCUMENT_UNREADABLE');
        // Re-uploading the same or a different file cannot fix this — the
        // importer never extracts Annex A refs from a document body — so the
        // message must not send the auditor chasing a document-format fix.
        expect(w.message).not.toMatch(/replace the document/);
        expect(w.message).toMatch(/Linked ISO Clause\(s\) or Notes field/);
    });
});

describe('ChecklistCoverage.buildContext — risk documents identified from their real fields', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    function stateWithDocs(documents) {
        return {
            clients: [{ id: 'c-1', name: 'Acme ISMS Ltd', certificates: [], keyProcesses: [], documents }],
            auditPlans: [], checklists: [], ncrs: [], complaints: [], appeals: []
        };
    }

    // A client document is never given a `summary` field by either intake
    // path (client-docs-bulk.js bulk import or the manual upload form in
    // clients-module.js) — both write `notes`. Testing the wrong field name
    // means a genuinely-on-file risk assessment reads as absent whenever its
    // file name doesn't happen to say "risk" itself.
    it('finds a risk assessment identified only by its notes, not its (generic) name', () => {
        window.state = stateWithDocs([{
            name: 'Q3 Review.xlsx', category: 'Other',
            notes: 'Annual risk assessment and treatment plan for the ISMS.'
        }]);
        const ctx = window.ChecklistCoverage.buildContext(checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        expect(ctx.riskDocs).toHaveLength(1);
        expect(ctx.riskDocs[0].summary).toMatch(/risk assessment/);
    });

    it('does not read a document with no risk signal in name, category or notes as a risk document', () => {
        window.state = stateWithDocs([{ name: 'Org Chart 2026.pdf', category: 'Org Chart', notes: 'Updated headcount.' }]);
        const ctx = window.ChecklistCoverage.buildContext(checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        expect(ctx.riskDocs).toHaveLength(0);
    });
});

describe('ChecklistCoverage.buildContext — incidents scoped by the field complaints really carry', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
        window.state = {
            clients: [
                { id: 'c-1', name: 'PC CONNECTION, INC.', certificates: [{ standard: 'ISO/IEC 27001:2022', initialDate: '2023-08-01', expiryDate: '2026-07-31' }], keyProcesses: [], documents: [] },
                { id: 'c-2', name: 'Other Certified Client Ltd', certificates: [], keyProcesses: [], documents: [] }
            ],
            auditPlans: [], checklists: [], ncrs: [],
            // Complaints, per appeals-complaints-module.js openNewComplaintModal,
            // are logged with `clientName` (the option value is the client's
            // NAME) and never carry a `clientId` at all. Appeals, per
            // openNewAppealModal, DO carry clientId (the option value is
            // c.id). Both shapes are exercised here.
            complaints: [
                { clientName: 'PC CONNECTION, INC.', subject: 'Auditor conduct', description: 'Raised about site visit.', dateReceived: '2024-06-01' },
                { clientName: 'Other Certified Client Ltd', subject: 'Unrelated complaint', description: 'About the other client entirely.', dateReceived: '2024-06-02' }
            ],
            appeals: [
                { clientId: 'c-1', subject: 'NC classification appeal', description: 'Disputes a major finding.', dateReceived: '2024-07-01' }
            ]
        };
    });

    it('finds a complaint logged against this client by clientName, not clientId', () => {
        const ctx = window.ChecklistCoverage.buildContext(
            checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), { planId: 'p-none' });
        const texts = ctx.incidents.map(i => i.text).join(' | ');
        expect(texts).toMatch(/Auditor conduct/);
        expect(texts).toMatch(/NC classification appeal/);
    });

    it('never lets one client\'s complaint reach another client\'s context', () => {
        const ctxA = window.ChecklistCoverage.buildContext(
            checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        const ctxB = window.ChecklistCoverage.buildContext(
            checklistOf(['5.1'], { clientId: 'c-2', id: 'cl-2' }), {});
        expect(ctxA.incidents.map(i => i.text).join(' ')).not.toMatch(/Unrelated complaint/);
        expect(ctxB.incidents.map(i => i.text).join(' ')).not.toMatch(/Auditor conduct/);
        expect(ctxB.incidents.map(i => i.text).join(' ')).toMatch(/Unrelated complaint/);
    });
});

describe('ChecklistCoverage.buildContext — changes read from the ISO 9.6.2 client change log', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    function stateWithClient(client, plan) {
        return {
            clients: [client],
            auditPlans: plan ? [plan] : [],
            checklists: [], ncrs: [], complaints: [], appeals: []
        };
    }

    // client.compliance.changesLog (written by clients-module.js
    // addClientChangeLog, the "Log Change" button on the Compliance tab) is
    // ISO 17021-1 9.6.2's own record and exists independently of whether an
    // AI Stage 1 review — the only thing that ever wrote
    // plan.preAudit.focusPoints — was ever run for this audit.
    it('reads a change logged directly against the client, with no AI review ever run', () => {
        window.state = stateWithClient({
            id: 'c-1', name: 'Acme ISMS Ltd',
            certificates: [{ standard: 'ISO/IEC 27001:2022', initialDate: '2023-08-01', expiryDate: '2026-07-31' }],
            keyProcesses: [], documents: [],
            compliance: { changesLog: [{ date: '2024-06-01', type: 'Scope Change', description: 'Added a new cloud hosting provider, AWS eu-west-1.' }] }
        });
        const ctx = window.ChecklistCoverage.buildContext(checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        expect(ctx.changes.join(' ')).toMatch(/Scope Change/);
        expect(ctx.changes.join(' ')).toMatch(/AWS eu-west-1/);
    });

    it('excludes a logged change dated outside the certification cycle', () => {
        window.state = stateWithClient({
            id: 'c-1', name: 'Acme ISMS Ltd',
            certificates: [{ standard: 'ISO/IEC 27001:2022', initialDate: '2023-08-01', expiryDate: '2026-07-31' }],
            keyProcesses: [], documents: [],
            compliance: { changesLog: [{ date: '2020-01-01', type: 'Organization Change', description: 'Pre-cycle restructure, out of scope for this cycle.' }] }
        });
        const ctx = window.ChecklistCoverage.buildContext(checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), {});
        expect(ctx.changes.join(' ')).not.toMatch(/Pre-cycle restructure/);
    });

    it('still reads focus points from an AI Stage 1 review alongside the change log', () => {
        window.state = stateWithClient({
            id: 'c-1', name: 'Acme ISMS Ltd',
            certificates: [{ standard: 'ISO/IEC 27001:2022', initialDate: '2023-08-01', expiryDate: '2026-07-31' }],
            keyProcesses: [], documents: [],
            compliance: { changesLog: [{ date: '2024-06-01', type: 'Scope Change', description: 'New AWS hosting.' }] }
        }, { id: 'p-1', clientId: 'c-1', preAudit: { focusPoints: ['New supplier onboarded for payroll processing.'] } });
        // buildContext resolves opts.planId to a plan object via
        // DataService.findAuditPlan — the real app wires this at boot
        // (data-service.js); tests supply the same lookup directly.
        window.DataService = { findAuditPlan: (id) => (window.state.auditPlans || []).find(p => String(p.id) === String(id)) };
        const ctx = window.ChecklistCoverage.buildContext(
            checklistOf(['5.1'], { clientId: 'c-1', id: 'cl-1' }), { planId: 'p-1' });
        expect(ctx.changes.join(' ')).toMatch(/AWS hosting/);
        expect(ctx.changes.join(' ')).toMatch(/payroll processing/);
    });

    it('feeds the risk-driven control selection so a logged cloud change reaches cloud-theme controls', () => {
        const sel = window.ChecklistCoverage.riskDrivenControls(
            window.ChecklistStandards.byId('iso27001'),
            ctxOf({
                soaApplicable: ['A.5.23', 'A.7.1'],
                changes: ['Scope Change: Added a new cloud hosting provider, AWS eu-west-1.']
            }));
        const refs = sel.required.map(r => r.ref);
        expect(refs).toContain('A.5.23');
        expect(refs).not.toContain('A.7.1');
    });
});

describe('ChecklistCoverage.readiness — control-gap blockers carry what to add', () => {
    beforeEach(() => {
        window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        loadModule('./checklist-standards.js');
        loadModule('./checklist-qa.js');
        loadModule('./checklist-coverage.js');
    });

    it('carries stdId and the control refs through onto a RISK_CONTROL_GAP blocker', () => {
        const controls = [{ ref: 'A.8.13', title: 'Backup', theme: 'technical', drivers: ['finding'], why: ['previous audit result'] }];
        const r = window.ChecklistCoverage.readiness({}, {
            coverage: {
                issues: [{
                    code: 'RISK_CONTROL_GAP', severity: 'critical', itemRef: '',
                    message: '1 control(s) not sampled — A.8.13', stdId: 'iso27001', controls
                }]
            }
        });
        expect(r.blockers[0].stdId).toBe('iso27001');
        expect(r.blockers[0].controls).toEqual(controls);
    });

    it('carries stdId and the missing refs through onto a CYCLE_CONTROL_GAP blocker', () => {
        const r = window.ChecklistCoverage.readiness({}, {
            coverage: {
                issues: [{
                    code: 'CYCLE_CONTROL_GAP', severity: 'critical', itemRef: '',
                    message: '2 of 45 applicable control(s) sampled nowhere — A.5.35, A.8.3',
                    stdId: 'iso27001', missing: ['A.5.35', 'A.8.3']
                }]
            }
        });
        expect(r.blockers[0].stdId).toBe('iso27001');
        expect(r.blockers[0].missing).toEqual(['A.5.35', 'A.8.3']);
    });
});
