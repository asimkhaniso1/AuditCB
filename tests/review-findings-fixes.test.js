// Regressions from the 2026-11-15 review of the PC CONNECTION audit pack:
// the checklist's six-year "cycle", BC/DR filed under backup, numeric dates in
// the pre-audit record, every document matched to every review item, a
// Stage 1/2 prompt for a recertification, and internal audit given to the
// risk owner.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };

const load = (f) => loadScript(f, { params: { module: undefined } });

describe('checklist coverage: the current three-year cycle', () => {
    beforeAll(() => {
        load('./report-stats.js');
        load('./checklist-standards.js');
        load('./checklist-qa.js');
        load('./checklist-coverage.js');
    });
    const checklist = {
        id: 'cl-1', clientId: 'c-1', standard: 'ISO/IEC 27001:2022', standardIds: ['iso27001'], auditType: 'recertification', type: 'custom',
        clauses: [{ mainClause: 'RECERT', subClauses: [{ clause: '5.1', requirement: 'Verify 5.1', refs: [{ stdId: 'iso27001', ref: '5.1' }] }] }]
    };
    const stateWith = (cert, plan) => ({
        clients: [{ id: 'c-1', name: 'PC CONNECTION, INC.', certificates: [cert], keyProcesses: [], documents: [] }],
        auditPlans: plan ? [plan] : [], auditReports: [], checklists: [checklist], ncrs: [], complaints: [], appeals: []
    });

    it('a client first certified in 2020 is in the 2023-2026 cycle at its 2026 recertification', () => {
        const plan = { id: 'p-r', clientId: 'c-1', date: '2026-11-17', auditType: 'Recertification', selectedChecklists: ['cl-1'] };
        window.state = stateWith({ standard: 'ISO/IEC 27001:2022', initialDate: '2020-12-16', currentIssue: '2025-12-16', expiryDate: '2026-12-15' }, plan);
        window.DataService = { findAuditPlan: (id) => (String(id) === 'p-r' ? plan : null) };
        const ctx = window.ChecklistCoverage.buildContext(checklist, { planId: 'p-r', now: '2026-11-15' });
        expect(ctx.cycle.start).toBe('2023-12-16');
        expect(ctx.cycle.end).toBe('2026-12-15');
        delete window.DataService;
    });

    it('a recertification after the cycle end still closes that cycle', () => {
        window.state = stateWith({ standard: 'ISO/IEC 27001:2022', initialDate: '2023-08-01', expiryDate: '2026-07-31' });
        const ctx = window.ChecklistCoverage.buildContext(checklist, { now: '2026-11-15' });
        expect(ctx.cycle.start).toBe('2023-08-01');
        expect(ctx.cycle.end).toBe('2026-07-31');
    });
});

describe('checklist builder and pre-audit document mapping', () => {
    let B;
    beforeAll(() => {
        window.DocFormat = require('../doc-format.js');
        window.PreAuditDocument = require('../pre-audit-document.js');
        load('./client-docs-bulk.js');
        B = window.ClientDocsBulk;
    });

    it('a process named for continuity is audited in the BCMS section, not under backup', () => {
        const themes = [{ id: 'isms-backup', label: 'Backup, logging and monitoring' }, { id: 'bcms-plans', label: 'Business continuity plans' }];
        expect(B.themeCoveringProcess('Business Continuity & Disaster Recovery', themes).id).toBe('bcms-plans');
        expect(B.themeCoveringProcess('Backup & Recovery Operations', themes).id).toBe('isms-backup');
    });

    it('matches documents by name and clause, not by their generic headings', () => {
        const boiler = [{ text: 'Scope' }, { text: 'Responsibilities' }, { text: 'Documents and records' }, { text: 'Policy' }];
        const docs = [
            { name: 'Incident Response Procedure', linkedClauses: '8.4', headings: boiler },
            { name: 'Supplier Management Procedure', linkedClauses: '8.4', headings: boiler },
            { name: 'Integrated Management System Manual', linkedClauses: '4.3', headings: boiler }
        ];
        const scope = B.mapDocumentsToStage1(docs).find(m => m.id === 'scope');
        expect(scope.docs.map(d => d.name)).toEqual(['Integrated Management System Manual']);
        const leadership = B.mapDocumentsToStage1(docs).find(m => m.id === 'leadership');
        expect(leadership.docs).toHaveLength(0);
    });

    it('names at most eight documents per evidence line, documents named for the item first', () => {
        const docs = Array.from({ length: 12 }, (_, i) => ({ name: 'Ops Record ' + (i + 1), linkedClauses: '9.2' }))
            .concat([{ name: 'Internal Audit Programme 2026' }]);
        const ia = B.mapDocumentsToStage1(docs).find(m => m.id === 'internal_audit');
        expect(ia.docs).toHaveLength(13);
        expect(ia.docs[0].name).toBe('Internal Audit Programme 2026');
        expect(ia.line).toMatch(/; and 5 more on file$/);
    });

    it('the AI review prompt for a remote recertification never mentions Stage 1 or Stage 2 as this audit', () => {
        const plan = { auditType: 'Recertification', type: 'Recertification', auditMethod: 'Remote', standard: 'ISO 27001:2022' };
        const prompt = B.buildStage1Prompt({ name: 'PC CONNECTION, INC.', sites: [{}] }, plan, '- IMS Manual');
        expect(prompt).toContain('before the Recertification audit (remote)');
        expect(prompt).toContain('Remote Audit Readiness');
        expect(prompt).not.toMatch(/ready for Stage 2|before the Stage 2 audit|on-site audit/);
        const initial = B.buildStage1Prompt({ name: 'X', sites: [{}] }, { auditType: 'Stage 1' }, '');
        expect(initial).toContain('Stage 1 documentation review before the Stage 2 audit');
    });
});

describe('pre-audit record writes saved dates out', () => {
    it('converts numeric dates in AI summaries and notes, and passes the print lint', () => {
        const DF = require('../doc-format.js');
        globalThis.DocFormat = DF;
        globalThis.PrintShell = require('../print-shell.js');
        const PAD = require('../pre-audit-document.js');
        const plan = {
            id: 'p', client: 'PC CONNECTION, INC.', auditType: 'Recertification', auditMethod: 'Remote', date: '2026-11-17', endDate: '2026-11-19',
            preAudit: {
                status: 'Complete', completedDate: '2026-11-15', readinessDecision: 'Ready', notes: 'Checked on 2026-11-15.',
                aiSummary: { documentsUpdated: ['Statement of Applicability (SoA) · dated 2023-07-09'] },
                documentReview: { scope: { status: 'ok', notes: 'IMS Manual issued 2026-08-07' } }
            }
        };
        const html = PAD.build(plan, { client: { name: 'PC CONNECTION, INC.' }, brand: { name: 'CB' } });
        expect(html).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
        expect(html).toContain('dated ' + DF.formatDate('2023-07-09'));
        expect(globalThis.PrintShell.lint(html)).toEqual([]);
    });
});

describe('agenda: internal audit goes to the management system manager', () => {
    it('the internal-audit session is not assigned to the risk owner', () => {
        const src = require('fs').readFileSync('./audit-plan-integrity.js', 'utf8');
        const line = src.split('\n').find(l => /id: 'internal-audit'/.test(l));
        expect(line).toMatch(/auditee: SM\.ims/);
        expect(src).toMatch(/ims: 'Management system manager'/);
    });
});
