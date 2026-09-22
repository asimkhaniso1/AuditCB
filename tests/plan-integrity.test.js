import { describe, it, expect, beforeAll } from 'vitest';
import { buildScenario, M } from '../tools/pcc-scenario.mjs';
import { CERT_SCOPE, STANDARDS, NCRS, CLIENT_ID } from './fixtures/pcc-connection.mjs';

const { DF, IPI, CS, FW, PD } = M;
const IDS = ['iso27001', 'iso22301', 'iso20000'];
const codes = (v) => v.blockers.map(b => b.code);
const nonLunch = (rows) => rows.filter(r => r.kind !== 'lunch');
const clone = (o) => JSON.parse(JSON.stringify(o));

let base; // the PC CONNECTION scenario as it stands (duration not yet approved)
let approved; // the same, with a duration approval stamped (a human decision)
beforeAll(async () => {
    base = await buildScenario();
    approved = await buildScenario({ approve: true });
});

/** Re-run the gate on a mutated copy of the plan. */
function gateWith(scn, mutate, ctxMutate) {
    const plan = clone(scn.plan);
    mutate && mutate(plan);
    const ctx = Object.assign({}, scn.ctx, { auditors: scn.auditors, client: scn.client });
    ctxMutate && ctxMutate(ctx);
    // A test may inject its own HTML (or null to skip the document checks);
    // otherwise the gate judges the plan document exactly as it would print.
    const html = ctx.html !== undefined ? ctx.html : PD.build(plan, Object.assign({}, scn.ctx, { findings: ctx.findings || scn.ctx.findings }));
    const lint = ctx.lint !== undefined ? ctx.lint : (html == null ? [] : M.PS.lint(html));
    return IPI.validate(plan, Object.assign({}, ctx, { html, lint, hoursPerDay: 8, findings: ctx.findings || scn.ctx.findings }));
}

// ═════════════════════════════════════════════════════════════════════
describe('the corrected plan passes every blocking validation once the human decisions are made', () => {
    it('with the duration approved there is no blocker at all', () => {
        expect(approved.validation.blockers).toEqual([]);
    });

    it('without that approval the ONLY blocker is the duration approval — a decision for the certification manager', () => {
        expect(codes(base.validation)).toEqual(['DURATION_NOT_APPROVED']);
    });

    it('the document is honest about it: Draft — Internal Review, not approved for client issue', () => {
        expect(base.html).toContain('Draft \u2014 Internal Review');
        expect(base.html).toContain('This plan has not been approved for client issue.');
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('auditor assignment', () => {
    it('assigns the Lead Auditor to every auditable agenda row, by name and by ID', () => {
        const rows = nonLunch(base.plan.agenda);
        expect(rows.length).toBeGreaterThan(20);
        rows.forEach(r => {
            expect(r.auditor).toBe('Muhammad Asim Khan');
            expect(r.auditorId).toBe('aud-mak');
        });
    });

    it('lunch breaks show N/A and nothing else', () => {
        const lunches = base.plan.agenda.filter(r => r.kind === 'lunch');
        expect(lunches).toHaveLength(3);
        lunches.forEach(r => { expect(r.auditor).toBe('N/A'); expect(r.auditorId).toBeNull(); });
    });

    it('never falls back to "Other", "None", "TBD" or a blank anywhere in the client document', () => {
        const text = DF.renderedText(base.html);
        expect(text).not.toMatch(/\bOther\b/);
        expect(text).not.toMatch(/Audit team\s*:?\s*None/i);
        expect(text).not.toMatch(/\bTBD\b/);
        nonLunch(base.plan.agenda).forEach(r => expect(IPI.isPlaceholderAuditor(r.auditor)).toBe(false));
    });

    it('says "Lead Auditor only" for a team of one — never "None"', () => {
        expect(IPI.auditTeamLabel(base.asm.team.assigned)).toBe('Lead Auditor only');
        expect(base.html).toMatch(/Audit team<\/span>Lead Auditor only/);
    });

    it('lists the other members when there is a team', () => {
        const label = IPI.auditTeamLabel([{ name: 'A', role: 'Lead Auditor' }, { name: 'B', role: 'Auditor' }, { name: 'C', role: 'Technical Expert' }]);
        expect(label).toBe('B, C (Technical Expert)');
    });

    it('resolves the name from the auditor RECORD', () => {
        expect(base.asm.team.assigned[0]).toMatchObject({ id: 'aud-mak', name: 'Muhammad Asim Khan', role: 'Lead Auditor', resolved: true });
    });

    describe('blocks finalization when', () => {
        const rowIdx = 3;
        it('an auditable row has no auditor', () => {
            const v = gateWith(base, p => { p.agenda[rowIdx].auditor = ''; p.agenda[rowIdx].auditorId = null; });
            expect(v.blockers.find(b => b.code === 'AUDITOR_MISSING' && b.row === rowIdx + 1)).toBeTruthy();
        });
        it('a placeholder is used — Other, None, TBD', () => {
            ['Other', 'None', 'TBD'].forEach(name => {
                const v = gateWith(base, p => { p.agenda[rowIdx].auditor = name; });
                const b = v.blockers.find(x => x.code === 'AUDITOR_PLACEHOLDER');
                expect(b, name).toBeTruthy();
                expect(b.message).toContain(`Agenda row ${rowIdx + 1}`);
                expect(b.message).toContain(name);
            });
        });
        it('"All Team" is used but only one auditor is assigned', () => {
            const v = gateWith(base, p => { p.agenda[rowIdx].auditor = 'All Team'; });
            expect(codes(v)).toContain('AUDITOR_PLACEHOLDER');
        });
        it('the auditor is not one assigned to the plan', () => {
            const v = gateWith(base, p => { p.agenda[rowIdx].auditor = 'Someone Else'; });
            expect(v.blockers.find(b => b.code === 'AUDITOR_UNRESOLVED').message).toMatch(/not an auditor assigned to this plan/);
        });
        it('a row has no auditor ID — the auditor is not linked to a record', () => {
            const v = gateWith(base, p => { p.agenda[rowIdx].auditorId = null; });
            expect(v.blockers.find(b => b.code === 'AUDITOR_UNRESOLVED').message).toMatch(/no auditor ID/);
        });
        it('the plan\u2019s own auditor record cannot be resolved', () => {
            const v = gateWith(base, () => { }, ctx => { ctx.auditors = []; });
            expect(codes(v)).toContain('AUDITOR_UNRESOLVED');
        });
        it('an auditor is scheduled beyond their allocation', () => {
            const v = gateWith(base, p => { p.teamAllocations = [{ auditor: 'Muhammad Asim Khan', days: 2 }]; });
            expect(v.blockers.find(b => b.code === 'AUDITOR_OVERALLOCATED').message).toMatch(/24\.00 hours but is allocated 16\.00/);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('clause and control references come from the controlled registry', () => {
    const rowFor = (blockId) => base.plan.agenda.find(r => r.sessionId && base.plan.traceability.sessions.find(s => s.sessionId === r.sessionId).blockId === blockId);
    const refsOf = (blockId, stdId) => (rowFor(blockId).standards.find(e => e.stdId === stdId) || { refs: [] }).refs;
    const titleOf = (stdId, ref) => IPI.refTitle(stdId, ref);

    it('every reference on every row is a requirement of a standard in scope', () => {
        base.plan.agenda.forEach(r => (r.standards || []).forEach(e => {
            expect(IDS).toContain(e.stdId);
            e.refs.forEach(ref => expect(CS.isKnownRef(e.stdId, ref), `${e.stdId} ${ref}`).toBe(true));
        }));
    });

    describe('ISO/IEC 27001:2022', () => {
        it('information-security incident management is A.5.24\u2013A.5.28 and A.6.8 \u2014 never 8.16', () => {
            const refs = refsOf('incident', 'iso27001');
            expect(refs).toEqual(['A.5.24', 'A.5.25', 'A.5.26', 'A.5.27', 'A.5.28', 'A.6.8']);
            expect(base.plan.agenda.some(r => (r.standards || []).some(e => e.stdId === 'iso27001' && e.refs.includes('8.16')))).toBe(false);
            expect(IPI.describeStandards(rowFor('incident').standards).find(d => d.standards.includes('27001')).text).toBe('A.5.24\u2013A.5.28, A.6.8');
        });
        it('risk assessment and treatment cite 6.1.2, 6.1.3, 8.2 and 8.3', () => {
            expect(refsOf('isms-risk-soa', 'iso27001')).toEqual(expect.arrayContaining(['6.1.2', '6.1.3', '8.2', '8.3']));
        });
        it('technical vulnerability management is A.8.8 with its supporting controls', () => {
            expect(refsOf('vuln-crypto', 'iso27001')).toEqual(expect.arrayContaining(['A.8.8', 'A.5.7', 'A.8.9']));
        });
        it('backup, logging and monitoring are A.8.13\u2013A.8.16', () => {
            expect(refsOf('backup-logging', 'iso27001')).toEqual(['A.8.13', 'A.8.14', 'A.8.15', 'A.8.16']);
        });
        it('preserves the A. prefix on every Annex A control, in lists and in ranges', () => {
            base.plan.agenda.forEach(r => (r.standards || []).filter(e => e.stdId === 'iso27001').forEach(e => e.refs.forEach(ref => {
                expect(ref).toMatch(/^(A\.\d+\.\d+|\d{1,2}(\.\d{1,2}){0,2})$/);
                expect(/^5\.\d|^6\.\d{1,2}$|^8\.\d{2}$/.test(ref) && Number(ref.split('.')[1]) > 3 && !ref.startsWith('A.') ? ref : '').toBe('');
            })));
            expect(IPI.compressRefs(['A.5.24', 'A.5.25', 'A.5.26', 'A.6.8'])).toBe('A.5.24\u2013A.5.26, A.6.8');
            expect(IPI.compressRefs(['A.5.1', 'A.5.2'])).toBe('A.5.1, A.5.2'); // two consecutive are listed, not ranged
        });
    });

    describe('ISO 22301:2019', () => {
        it('uses the standard\u2019s own numbers and titles', () => {
            expect(titleOf('iso22301', '8.2.2')).toBe('Business impact analysis');
            expect(titleOf('iso22301', '8.2.3')).toBe('Risk assessment');
            expect(titleOf('iso22301', '8.3')).toBe('Business continuity strategies and solutions');
            expect(titleOf('iso22301', '8.4')).toBe('Business continuity plans and procedures');
            expect(titleOf('iso22301', '8.5')).toBe('Exercise programme');
            expect(titleOf('iso22301', '8.6')).toBe('Evaluation of business continuity documentation and capabilities');
        });
        it('schedules BIA at 8.2.2, strategies at 8.3, plans at 8.4, exercises at 8.5 and evaluation at 8.6', () => {
            expect(refsOf('bcms-bia-risk', 'iso22301')).toEqual(['8.2.2', '8.2.3']);
            expect(refsOf('bcms-strategy-plans', 'iso22301')).toEqual(expect.arrayContaining(['8.3', '8.4']));
            expect(refsOf('bcms-exercise', 'iso22301')).toEqual(['8.5', '8.6']);
        });
        it('does not call BIA-and-strategies "8.2", plans "8.3" or exercises "8.4"', () => {
            expect(CS.isKnownRef('iso22301', '8.2')).toBe(false);
            expect(refsOf('bcms-bia-risk', 'iso22301')).not.toContain('8.2');
            expect(refsOf('bcms-exercise', 'iso22301')).not.toContain('8.4');
            expect(refsOf('bcms-strategy-plans', 'iso22301').filter(r => r === '8.3')).toHaveLength(1); // 8.3 is strategies, once
        });
    });

    describe('ISO/IEC 20000-1:2018', () => {
        it('maps change 8.5.1, release 8.5.3, incident 8.6.1, request 8.6.2, problem 8.6.3, availability 8.7.1, continuity 8.7.2, reporting 9.4', () => {
            const all = uniqRefs('iso20000');
            ['8.5.1', '8.5.3', '8.6.1', '8.6.2', '8.6.3', '8.7.1', '8.7.2', '9.4', '8.3.2', '8.3.3', '8.3.4', '8.4.1', '8.4.2', '8.4.3'].forEach(r => expect(all, r).toContain(r));
        });
        it('never uses 8.15 for change management', () => {
            expect(CS.isKnownRef('iso20000', '8.15')).toBe(false);
            expect(uniqRefs('iso20000')).not.toContain('8.15');
            expect(refsOf('sms-change-release-config', 'iso20000')).toContain('8.5.1');
        });
        it('takes titles from the registry, not from a list typed into a brief', () => {
            // The brief labelled 8.2.4/8.2.5/8.2.6 "SMS planning / control of parties / service catalogue".
            // In ISO/IEC 20000-1:2018 they are service catalogue / asset / configuration management;
            // control of parties is 8.2.3 and planning the SMS is 6.3. The registry is the authority.
            expect(titleOf('iso20000', '8.2.3')).toBe('Control of parties involved in the service lifecycle');
            expect(titleOf('iso20000', '8.2.4')).toBe('Service catalogue management');
            expect(titleOf('iso20000', '8.2.5')).toBe('Asset management');
            expect(titleOf('iso20000', '8.2.6')).toBe('Configuration management');
            expect(titleOf('iso20000', '6.3')).toBe('Plan the service management system');
        });
    });

    function uniqRefs(stdId) {
        return [...new Set(base.plan.agenda.flatMap(r => (r.standards || []).filter(e => e.stdId === stdId).flatMap(e => e.refs)))];
    }

    describe('a reference the registry does not hold is rejected', () => {
        it('the five wrong labels the previous agenda carried', () => {
            const bad = [
                ['8.16 Information security incident management (ISO 27001:2022)', 'INVALID_CLAUSE'],
                ['8.15 Change management (ISO 20000-1:2018)', 'INVALID_CLAUSE'],
                ['8.2 Business impact analysis and business continuity strategies (ISO 22301:2019)', 'INVALID_CLAUSE'],
                ['8.3 Business continuity plans and procedures (ISO 22301:2019)', 'CLAUSE_TITLE_MISMATCH'],
                ['8.4 Business continuity exercises and tests (ISO 22301:2019)', 'CLAUSE_TITLE_MISMATCH']
            ];
            bad.forEach(([text, code]) => {
                const problems = IPI.scanFreeText(text, IDS);
                expect(problems.map(p => p.code), text).toEqual([code]);
            });
        });
        it('accepts a correct free-text label', () => {
            expect(IPI.scanFreeText('8.6.1 Incident management (ISO/IEC 20000-1:2018)', IDS)).toEqual([]);
            expect(IPI.scanFreeText('A.5.24 Information security incident management planning and preparation', IDS)).toEqual([]);
        });
        it('the gate names the exact row of a legacy free-text agenda', () => {
            const v = gateWith(base, p => {
                p.agenda = [{ day: 'Day 1', time: '09:00 - 10:00', start: '09:00', end: '10:00', item: '8.16 Information security incident management (ISO 27001:2022)', dept: 'IT', auditor: 'Muhammad Asim Khan', auditorId: 'aud-mak' }].concat(p.agenda.map(r => Object.assign({}, r, { standards: r.standards })));
            });
            const b = v.blockers.find(x => x.code === 'INVALID_CLAUSE');
            expect(b.row).toBe(1);
            expect(b.message).toContain('"8.16"');
        });
        it('a structured row citing a control from another standard is rejected', () => {
            const v = gateWith(base, p => { p.agenda[3].standards = [{ stdId: 'iso20000', refs: ['8.15'] }]; });
            expect(v.blockers.find(b => b.code === 'INVALID_CLAUSE').message).toMatch(/8\.15.*not a requirement of ISO\/IEC 20000-1:2018/);
        });
        it('the template itself is validated: building for each standard alone never throws or invents', () => {
            IDS.forEach(id => {
                const built = IPI.buildAgenda({ plan: { date: '2026-11-03', endDate: '2026-11-05', auditMethod: 'Remote' }, standards: [id], finalDays: 2, hoursPerDay: 8, assigned: base.asm.team.assigned, client: base.client, findings: [] });
                expect(built.errors).toEqual([]);
                built.rows.forEach(r => (r.standards || []).forEach(e => { expect(e.stdId).toBe(id); e.refs.forEach(ref => expect(CS.isKnownRef(id, ref)).toBe(true)); }));
            });
        });
        it('refuses to build for a standard the registry does not hold', () => {
            const built = IPI.buildAgenda({ plan: { date: '2026-11-03', endDate: '2026-11-05' }, standards: ['iso9001'], finalDays: 3, assigned: base.asm.team.assigned, client: base.client, findings: [] });
            expect(built.rows).toEqual([]);
            expect(built.errors.join(' ')).toMatch(/no controlled agenda template/i);
        });
    });

    describe('standard edition', () => {
        it('blocks an edition that is not the certified one', () => {
            const v = gateWith(base, p => { p.standard = 'ISO 27001:2013, ISO 22301:2019, ISO 20000-1:2018'; });
            expect(v.blockers.find(b => b.code === 'EDITION_MISMATCH').message).toMatch(/27001:2013.*ISO\/IEC 27001:2022/);
        });
        it('blocks criteria citing the wrong edition', () => {
            const v = gateWith(base, p => { p.criteria = p.criteria.replace('ISO/IEC 27001:2022', 'ISO/IEC 27001:2013'); });
            expect(codes(v)).toContain('EDITION_MISMATCH');
        });
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('agenda structure', () => {
    const rows = () => base.plan.agenda;
    it('every entry has day, start, end, activity, requirement or integrated subject, auditee and auditor', () => {
        rows().forEach((r, i) => {
            expect(r.day, `row ${i + 1}`).toMatch(/^Day \d$/);
            expect(r.start).toMatch(/^\d\d:\d\d$/);
            expect(r.end).toMatch(/^\d\d:\d\d$/);
            expect(r.item.length).toBeGreaterThan(3);
            expect(r.dept.length).toBeGreaterThan(0);
            expect(r.auditor.length).toBeGreaterThan(0);
            if (r.kind === 'session') expect(r.standards.length).toBeGreaterThan(0);
        });
    });
    it('opens with the opening meeting and ends with the closing meeting \u2014 the final client-facing activity', () => {
        expect(rows()[0].kind).toBe('opening');
        expect(rows().at(-1).kind).toBe('closing');
    });
    it('gives the auditors explicit time to consolidate before the closing meeting, with no auditee interviews', () => {
        const last3 = rows().slice(-2);
        expect(last3[0].kind).toBe('consolidation');
        expect(last3[0].dept).toMatch(/no auditee interviews/i);
        expect(last3[0].item).toMatch(/objective evidence.*findings.*conclusions.*closing-meeting preparation/i);
    });
    it('has no floating catch-all row after the closing meeting, and none untimed', () => {
        expect(rows().some(r => /Management system clauses and operational controls/i.test(r.item))).toBe(false);
        rows().forEach(r => expect(DF.parseDateParts(r.date)).toBeTruthy());
        expect(codes(base.validation)).not.toContain('UNTIMED_ROW');
        expect(codes(base.validation)).not.toContain('ACTIVITY_AFTER_CLOSING');
    });
    it('covers the core processes, and names only processes the client actually runs', () => {
        const scheduled = base.plan.agenda.flatMap(r => r.processes || []).join(' | ').toLowerCase();
        ['client onboarding', 'assessment and design tools', 'service desk operations', 'incident management', 'problem management', 'change management',
            'cloud services operations', 'patch & vulnerability management', 'backup & recovery operations', 'performance monitoring & reporting',
            'continual improvement and process optimization'].forEach(p => expect(scheduled, p).toContain(p));
        expect(codes(base.validation)).not.toContain('PROCESS_OUTSIDE_BOUNDARY');
    });
    it('visibly covers the recertification, IMS, and per-standard priorities', () => {
        expect(base.validation.warnings.filter(w => w.code === 'AGENDA_COVERAGE_GAP')).toEqual([]);
    });

    describe('is blocked when', () => {
        it('the opening meeting is missing', () => {
            expect(codes(gateWith(base, p => { p.agenda = p.agenda.filter(r => r.kind !== 'opening'); }))).toContain('OPENING_MISSING');
        });
        it('the auditor-consolidation period is missing', () => {
            expect(codes(gateWith(base, p => { p.agenda = p.agenda.filter(r => r.kind !== 'consolidation'); }))).toContain('CONSOLIDATION_MISSING');
        });
        it('the closing meeting is missing', () => {
            expect(codes(gateWith(base, p => { p.agenda = p.agenda.filter(r => r.kind !== 'closing'); }))).toContain('CLOSING_MISSING');
        });
        it('an activity is scheduled after the closing meeting, naming the row', () => {
            const v = gateWith(base, p => { p.agenda.push({ day: 'Day 3', date: '2026-11-05', start: '17:30', end: '18:00', time: '17:30 \u2013 18:00', item: 'Extra interview', dept: 'IT', auditor: 'Muhammad Asim Khan', auditorId: 'aud-mak', kind: 'session', standards: [] }); });
            const b = v.blockers.find(x => x.code === 'ACTIVITY_AFTER_CLOSING');
            expect(b.row).toBe(base.plan.agenda.length + 1);
        });
        it('a row is untimed', () => {
            const v = gateWith(base, p => { p.agenda.push({ day: 'Day 1', item: 'Management system clauses and operational controls', dept: 'All', auditor: 'Muhammad Asim Khan', auditorId: 'aud-mak' }); });
            expect(codes(v)).toContain('UNTIMED_ROW');
        });
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('previous findings', () => {
    it('retrieves all eight from the register, typed', () => {
        expect(base.asm.findings).toHaveLength(8);
        expect(base.asm.findings.every(f => f.type === 'nonconformity')).toBe(true);
        expect(base.asm.findings.every(f => f.source === 'register')).toBe(true);
    });
    it('maps every one to an agenda session, keeping each finding ID', () => {
        const mapped = new Set(base.plan.agenda.flatMap(r => r.findingIds));
        NCRS.forEach(n => expect(mapped.has(n.id), n.id).toBe(true));
        expect(base.plan.traceability.summary).toMatchObject({ findingsRequiringFollowUp: 8, findingsMapped: 8, findingsUnmapped: 0 });
        expect(base.validation.summary.findings).toEqual({ required: 8, mapped: 8, unmapped: 0, total: 8 });
    });
    it('groups findings that share a process and auditee, without losing any ID', () => {
        const ctxSession = base.plan.traceability.sessions.find(s => s.blockId === 'context-leadership');
        expect(ctxSession.findingIds.sort()).toEqual(['NCR-PCC-01', 'NCR-PCC-02', 'NCR-PCC-03']);
        const backup = base.plan.traceability.sessions.find(s => s.blockId === 'backup-logging');
        expect(backup.findingIds.sort()).toEqual(['NCR-PCC-07', 'NCR-PCC-08']);
    });
    it('a bare parent clause (10) lands in the session that covers 10.1 and 10.2', () => {
        const m = base.plan.traceability.findings.find(f => f.clause === '10');
        const s = base.plan.traceability.sessions.find(x => x.sessionId === m.sessionIds[0]);
        expect(s.blockId).toBe('improvement');
    });
    it('restores an A.8.8 follow-up when the register holds one', async () => {
        const s = await buildScenario({ mutate: ({ state }) => state.ncrs.push({ id: 'NCR-PCC-09', ncrNumber: 'PCC-F9', clientId: CLIENT_ID, auditId: 'plan-pcc-s2-2025', clause: 'A.8.8', type: 'minor', status: 'Open', description: 'Patch backlog', standards: ['ISO/IEC 27001:2022'] }) });
        expect(s.asm.findings).toHaveLength(9);
        const vuln = s.plan.traceability.sessions.find(x => x.blockId === 'vuln-crypto');
        expect(vuln.findingIds).toEqual(['NCR-PCC-09']);
        expect(s.validation.summary.findings).toMatchObject({ required: 9, mapped: 9, unmapped: 0 });
    });
    it('attaches a finding no session covers to its topic session and states why', async () => {
        const s = await buildScenario({ mutate: ({ state }) => state.ncrs.push({ id: 'NCR-PCC-10', clientId: CLIENT_ID, auditId: 'plan-pcc-s2-2025', clause: 'A.7.4', type: 'minor', status: 'Open', description: 'CCTV gap', standards: ['ISO/IEC 27001:2022'] }) });
        const m = s.plan.traceability.findings.find(f => f.findingId === 'NCR-PCC-10');
        expect(m.mapped).toBe(true);
        expect(m.via).toBe('added-to-isms-risk-soa');
    });
    it('includes observations and opportunities for improvement as findings, typed and not flattened to NC — but only nonconformities are scheduled', async () => {
        const s = await buildScenario({ mutate: ({ state }) => state.ncrs.push(
            { id: 'OBS-1', clientId: CLIENT_ID, auditId: 'plan-pcc-s2-2025', clause: '7.2', type: 'observation', status: 'Open', description: 'Competence records thin' },
            { id: 'OFI-1', clientId: CLIENT_ID, auditId: 'plan-pcc-s2-2025', clause: '9.1', type: 'ofi', description: 'Trend the KPIs' }) });
        const types = Object.fromEntries(s.asm.findings.map(f => [f.id, f.type]));
        expect(types['OBS-1']).toBe('observation');
        expect(types['OFI-1']).toBe('ofi');
        // Present in the findings list (the register holds them), but they do
        // not force an agenda session: only the 8 nonconformities do.
        expect(s.asm.findings).toHaveLength(10);
        expect(s.asm.findings.find(f => f.id === 'OBS-1').requiresFollowUp).toBe(false);
        expect(s.asm.findings.find(f => f.id === 'OFI-1').requiresFollowUp).toBe(false);
        expect(s.plan.traceability.summary.findingsRequiringFollowUp).toBe(8);
        expect(s.validation.summary.findings).toMatchObject({ required: 8, unmapped: 0 });
        // Never scheduled into any agenda session and never named by the gate.
        const mapped = new Set(s.plan.agenda.flatMap(r => r.findingIds));
        expect(mapped.has('OBS-1')).toBe(false);
        expect(mapped.has('OFI-1')).toBe(false);
        expect(s.validation.blockers.some(b => b.code === 'FINDING_UNMAPPED' && /OBS-1|OFI-1/.test(b.message))).toBe(false);
    });
    it('does not count a closed, effectiveness-verified nonconformity, or a withdrawn record, as needing follow-up', async () => {
        const s = await buildScenario({ mutate: ({ state }) => {
            state.ncrs[0] = Object.assign(state.ncrs[0], { status: 'Closed', effectiveness: 'Verified', verifiedDate: '2026-06-01' });
            state.ncrs[1].status = 'Withdrawn';
        } });
        expect(s.asm.findings).toHaveLength(7);
        expect(s.validation.summary.findings.required).toBe(6);
    });
    it('reads report-recorded findings the register does not hold, without duplicating ones it does', async () => {
        const s = await buildScenario({ mutate: ({ state }) => {
            state.auditReports = [{ id: 'r1', planId: 'plan-pcc-s2-2025', clientId: CLIENT_ID, client: 'PC CONNECTION, INC.', date: '2025-11-18',
                checklistProgress: [{ status: 'nc', ncrType: 'minor', clause: '4.1', ncrDescription: 'Previous finding against clause 4.1' }, { status: 'nc', ncrType: 'minor', clause: '6.3', ncrDescription: 'Change not assessed' }] }];
        } });
        expect(s.asm.findings).toHaveLength(9); // 8 register + the one report-only 6.3
        expect(s.asm.findings.filter(f => f.clause === '4.1')).toHaveLength(1);
    });

    describe('approval is blocked when a required finding is unmapped', () => {
        it('names the finding', () => {
            const v = gateWith(base, p => { p.agenda.forEach(r => { r.findingIds = (r.findingIds || []).filter(id => id !== 'NCR-PCC-08'); }); });
            const b = v.blockers.find(x => x.code === 'FINDING_UNMAPPED');
            expect(b.findingId).toBe('NCR-PCC-08');
            expect(b.message).toMatch(/PCC-F8.*clause A\.8\.13/);
            expect(v.summary.findings).toMatchObject({ required: 8, mapped: 7, unmapped: 1 });
        });
        it('the document does not claim all findings are scheduled', () => {
            const plan = clone(base.plan);
            plan.agenda.forEach(r => { r.findingIds = []; });
            const html = PD.build(plan, base.ctx);
            expect(html).toContain('not every finding is scheduled');
            expect(html).not.toContain('are scheduled in the sessions below');
        });
        it('the document states the claim only when it is true', () => {
            expect(base.html).toMatch(/Previous findings requiring follow-up: 8<\/b> \u2014 all 8 are scheduled/);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('audit duration', () => {
    const rec = () => base.validation.summary.reconciliation;
    it('reconciles: the agenda schedules exactly the approved auditor-days, with lunch excluded', () => {
        expect(rec().scheduledHours).toBe(24);
        expect(rec().approvedHours).toBe(24);
        expect(rec().valid).toBe(true);
        const withLunch = base.plan.agenda.reduce((h, r) => h + (DF && (M.IPI.reconcileDuration({ rows: [r], finalDays: 1 }).scheduledHours)), 0);
        expect(withLunch).toBe(24); // the three lunch rows contribute nothing
    });
    it('does not change the three-day duration on its own', () => {
        expect(base.plan.durationCalculation.finalDays).toBe(3);
        expect(base.asm.durationRecord.finalDays).toBe(3);
        expect(base.asm.durationRecord.baselineDays).toBe(3);
    });
    it('records the full basis for the certification file', () => {
        const r = base.asm.durationRecord;
        expect(r.basisByStandard).toHaveLength(3);
        r.basisByStandard.forEach(b => { expect(b.baselineDays).toBe(3); expect(b.band).toMatchObject({ minEmployees: 251, maxEmployees: 500 }); });
        expect(r.effectivePersonnel.value).toBe(300);
        expect(r.effectivePersonnel.organisationTotal).toBe(3000);
        expect(r.effectivePersonnel.note).toMatch(/3000.*differs.*300.*certification-manager confirmation/);
        expect(r.sites).toBe(1);
        expect(r.imsIntegration).toMatchObject({ standards: 3, adjustmentPercent: 0 });
        expect(r.recertificationAdjustment.applied).toBe(true);
        expect(r.remote).toMatchObject({ method: 'Remote', remoteDays: 3, onsiteDays: 0 });
        expect(r.increases).toEqual([]);
        expect(r.reductions).toEqual([]);
        expect(r.methodology.builtInDefault).toBe(true);
        expect(r.methodology.note).toMatch(/starter table and not a certification-body-approved methodology/);
        expect(r.approval).toEqual({ approvedBy: null, approvedAt: null });
    });
    it('shows a concise summary to the client and keeps the calculation in the internal record', () => {
        expect(base.html).toContain('3.0 auditor-days (remote)');
        expect(base.html).not.toMatch(/baseline\s*\u2192/);
        expect(base.internal).toMatch(/3 baseline \u2192 0% IMS \u2192 0 justified adjustment = 3 calculated \u2192 3 final auditor-days/);
        expect(base.internal).toContain('Not approved');
    });
    it('blocks approval while the duration is unapproved, and clears once it is', () => {
        expect(codes(base.validation)).toContain('DURATION_NOT_APPROVED');
        expect(codes(approved.validation)).not.toContain('DURATION_NOT_APPROVED');
    });
    describe('blocks approval when the agenda and the approved duration disagree', () => {
        it('a shorter approved duration', () => {
            const v = gateWith(base, p => { p.durationCalculation.finalDays = 2; p.manDays = 2; });
            expect(v.blockers.find(b => b.code === 'DURATION_MISMATCH').message).toMatch(/24\.00.*2 auditor-day\(s\).*16\.00/);
        });
        it('an auditor double-booked', () => {
            const v = gateWith(base, p => { const r = clone(p.agenda[1]); p.agenda.splice(2, 0, r); });
            expect(codes(v)).toContain('DOUBLE_BOOKED');
        });
        it('a working day that is too long', () => {
            const v = gateWith(base, p => { p.agenda[8].end = '20:30'; p.agenda[8].time = '16:45 \u2013 20:30'; });
            expect(codes(v)).toContain('DAY_TOO_LONG');
        });
        it('a session outside the scheduled dates', () => {
            const v = gateWith(base, p => { p.agenda[3].date = '2026-11-09'; });
            expect(v.blockers.find(b => b.code === 'OUTSIDE_SCHEDULED_DATES').message).toContain('2026-11-09');
        });
    });
    it('the planning domain’s own reconciliation also excludes lunch — by kind or by its text on a legacy row', () => {
        const rows = [
            { day: 'Day 1', time: '09:00 - 12:00', item: 'Audit', auditor: 'A' },
            { day: 'Day 1', time: '12:00 - 13:00', item: 'Lunch Break', auditor: 'All' },
            { day: 'Day 1', time: '13:00 - 14:00', item: 'x', kind: 'lunch', auditor: 'A' },
            { day: 'Day 1', time: '14:00 - 19:00', item: 'Audit', auditor: 'A' }
        ];
        const r = M.Domain.reconcileAgenda({ agenda: rows, finalAuditorDays: 1, hoursPerDay: 8, team: ['A'] });
        expect(r.scheduledAuditorHours).toBe(8);
        expect(r.valid).toBe(true);
    });
    it('rescales the agenda to the approved duration for another engagement', () => {
        const built = IPI.buildAgenda({ plan: { date: '2026-11-03', endDate: '2026-11-04', auditMethod: 'Remote' }, standards: IDS, finalDays: 2, hoursPerDay: 8, assigned: base.asm.team.assigned, client: base.client, findings: [] });
        expect(IPI.reconcileDuration({ rows: built.rows, finalDays: 2 }).scheduledHours).toBe(16);
        expect(built.rows.at(-1).kind).toBe('closing');
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('dates, window and expiry', () => {
    it('writes every client-facing date in words', () => {
        const text = DF.renderedText(base.html);
        expect(text).toContain('3\u20135 November 2026');
        expect(text).toContain('16 September\u201315 November 2026');
        expect(text).toContain('15 December 2026');
        expect(DF.findUnwrittenDates(text)).toEqual([]);
    });
    it('blocks a schedule outside the approved window', () => {
        const v = gateWith(base, p => { p.date = '2026-12-01'; p.endDate = '2026-12-03'; });
        expect(v.blockers.find(b => b.code === 'OUTSIDE_WINDOW').message).toMatch(/1.3 December 2026.*16 September.15 November 2026/);
    });
    it('blocks a schedule that runs past certificate expiry', () => {
        const v = gateWith(base, p => { p.endDate = '2026-12-20'; });
        expect(v.blockers.find(b => b.code === 'AFTER_EXPIRY').message).toContain('15 December 2026');
    });
    it('accepts an outside-window schedule only with an authorised recorded override', () => {
        const v = gateWith(base, p => { p.date = '2026-11-16'; p.endDate = '2026-11-18'; p.agenda.forEach(r => { r.date = ''; }); p.overrides = [{ category: 'window', user: 'CM', role: 'Certification Manager', reason: 'Client availability' }]; });
        expect(codes(v)).not.toContain('OUTSIDE_WINDOW');
    });
    it('blocks a numeric date anywhere in the rendered document, quoting it', () => {
        const v = gateWith(base, () => { }, ctx => { ctx.html = null; });
        expect(codes(v)).not.toContain('AMBIGUOUS_DATE');
        const plan = clone(base.plan);
        plan.methodology += '\n\u2022 Kick-off on 03/11/2026';
        const html = PD.build(plan, base.ctx);
        const out = IPI.validate(plan, Object.assign({}, base.ctx, { html, lint: M.PS.lint(html), hoursPerDay: 8 }));
        expect(out.blockers.find(b => b.code === 'AMBIGUOUS_DATE').text).toBe('03/11/2026');
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('time zone', () => {
    it('states the zone verified for the audit dates: EST on 3\u20135 November 2026', () => {
        expect(base.html).toContain('Eastern Standard Time (EST, UTC\u221205:00)');
        expect(DF.renderedText(base.html)).toContain('All agenda times are shown in the client site\u2019s local time zone: Eastern Standard Time (EST, UTC\u221205:00).');
        expect(base.asm.timeZone).toMatchObject({ iana: 'America/New_York', source: 'site-location', confirmed: true });
    });
    it('blocks a remote audit whose zone cannot be established', () => {
        const v = gateWith(base, p => { p.timeZone = null; }, ctx => { ctx.client = Object.assign({}, base.client, { country: 'Brazil', address: 'Somewhere', sites: [{ name: 'Head Office', employees: 300 }] }); });
        expect(v.blockers.find(b => b.code === 'TIMEZONE_MISSING').message).toMatch(/remote international audit/);
    });
    it('is satisfied by a zone an authorised user agreed on the plan', () => {
        const v = gateWith(base, p => { p.timeZone = { iana: 'Asia/Karachi', source: 'plan-agreed', agreedBy: 'CM' }; }, ctx => { ctx.client = Object.assign({}, base.client, { country: 'Brazil', address: 'Somewhere', sites: [{ name: 'Head Office', employees: 300 }] }); });
        expect(codes(v)).not.toContain('TIMEZONE_MISSING');
    });
    it('does not require one for an on-site audit', () => {
        const v = gateWith(base, p => { p.auditMethod = 'On-site'; p.timeZone = null; }, ctx => { ctx.client = Object.assign({}, base.client, { country: 'Brazil', address: 'Somewhere', sites: [{ name: 'Head Office', employees: 300 }] }); });
        expect(codes(v)).not.toContain('TIMEZONE_MISSING');
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('certified scope', () => {
    it('reproduces the active certificate\u2019s wording exactly \u2014 unexpanded, unshortened, unreworded', () => {
        expect(base.asm.scope.certificateScope).toBe(CERT_SCOPE);
        expect(base.plan.scope).toBe(CERT_SCOPE);
        expect(base.asm.scope.exact).toBe(true);
        expect(DF.renderedText(base.html)).toContain(CERT_SCOPE);
        expect(base.asm.scope.certificateNumbers).toEqual(['22US9019', '22US9020', '22US9021']);
    });
    it('blocks client issue when the plan scope differs from the certificate by even a phrase', () => {
        const v = gateWith(base, p => { p.scope = CERT_SCOPE.replace('IT services', 'managed IT services'); });
        const b = v.blockers.find(x => x.code === 'SCOPE_MISMATCH');
        expect(b.certificateScope).toBe(CERT_SCOPE);
        expect(b.planScope).toContain('managed IT services');
    });
    it('blocks when the plan states no scope', () => {
        expect(codes(gateWith(base, p => { p.scope = ''; p.criteria = ''; }))).toContain('SCOPE_MISSING');
    });
    it('blocks when the certificates carry different wording, rather than choosing one', () => {
        const v = gateWith(base, () => { }, ctx => { ctx.client = clone(base.client); ctx.client.certificates[1].scope += ' Also managed services.'; });
        expect(codes(v)).toContain('SCOPE_CERTIFICATES_DIFFER');
    });
    it('reads the scope embedded in legacy audit criteria', () => {
        const legacy = { criteria: `ISO 27001:2022; the approved certification scope (${CERT_SCOPE}); the organization's documented management system; and more.` };
        const r = IPI.checkScope({ plan: legacy, client: base.client, standards: IDS });
        expect(r.exact).toBe(true);
        expect(r.embedded).toBe(true);
    });
    it('flags current activities that differ from the certificate for authorised certification review \u2014 without deciding which is right', () => {
        const a = base.asm.scope.activities;
        expect(a.requiresCertificationReview).toBe(true);
        expect(a.unlisted).toEqual(expect.arrayContaining(['Managed IT Services', 'Service Desk Operations']));
        expect(a.platformsNotCertified.sort()).toEqual(['CSP', 'M365']);
        expect(a.platformsNotEvidenced.sort()).toEqual(['AWS', 'GCP']);
        const w = base.validation.warnings.find(x => x.code === 'SCOPE_ACTIVITIES_DIFFER');
        expect(w.requiresCertificationReview).toBe(true);
        expect(base.internal).toMatch(/REQUIRED.*authorised certification review/);
    });
    it('blocks a site that is not a client site, and a process the client does not run', () => {
        expect(codes(gateWith(base, p => { p.selectedSites = [{ name: 'Annex Building' }]; }))).toContain('SITE_MISMATCH');
        const s = IPI.checkScope({ plan: base.plan, client: base.client, standards: IDS, processes: ['Payroll'] });
        expect(s.issues.map(i => i.code)).toContain('PROCESS_OUTSIDE_BOUNDARY');
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('objectives, criteria and methodology', () => {
    it('are complete: every required element is stated', () => {
        expect(IPI.checkNarratives(base.plan, IDS)).toEqual([]);
    });
    it('objectives: conformity with all three standards, effectiveness, continued fulfilment, findings and changes, scope suitability, recertification decision', () => {
        const o = base.plan.objectives;
        expect(o).toMatch(/conformity.*ISO\/IEC 27001:2022, ISO 22301:2019 and ISO\/IEC 20000-1:2018/);
        ['effectiveness', 'continued fulfilment', 'previous findings', 'significant changes', 'suitability and relevance of the certification scope', 'recertification decision']
            .forEach(t => expect(o.toLowerCase()).toContain(t));
    });
    it('criteria: correct editions, exact scope, documented system, legal/regulatory/contractual, programme requirements, sites', () => {
        const c = base.plan.criteria;
        STANDARDS.forEach(s => expect(c).toContain(s));
        ['exactly as stated on the certificate', 'documented management system', 'legal, statutory, regulatory and contractual', 'certification-programme requirements', 'Head Office']
            .forEach(t => expect(c).toContain(t));
    });
    it('methodology: remote method, secure tools, interviews, records, observation, risk-based sampling, findings, changes, and the sampling limitation', () => {
        const m = base.plan.methodology.toLowerCase();
        ['remote audit', 'secure communication', 'interviews', 'documented information and records', 'observation where possible', 'risk-based sampling', 'previous finding', 'significant changes', 'does not remove the mandatory audit activities']
            .forEach(t => expect(m).toContain(t));
    });
    it('blocks an incomplete narrative, naming the missing element', () => {
        const v = gateWith(base, p => { p.objectives = '\u2022 Determine conformity of the management system'; });
        expect(v.blockers.filter(b => b.code === 'NARRATIVE_INCOMPLETE').map(b => b.message).join(' ')).toMatch(/do not state effectiveness/);
        expect(codes(gateWith(base, p => { p.methodology = ''; }))).toContain('NARRATIVE_MISSING');
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('checklist association and coverage gate the plan', () => {
    it('blocks a checklist not linked to every applicable standard', () => {
        const v = gateWith(base, () => { }, ctx => { ctx.checklists = [Object.assign({}, base.ctx.checklists[0], { standardIds: ['iso27001'] })]; });
        const b = v.blockers.filter(x => x.code === 'CHECKLIST_NOT_LINKED').map(x => x.standard);
        expect(b).toEqual(['iso22301', 'iso20000']);
    });
    it('blocks when coverage could not be assessed', () => {
        const v = gateWith(base, () => { }, ctx => { ctx.checklists = [Object.assign({}, base.ctx.checklists[0], { coverage: null })]; });
        expect(codes(v)).toContain('COVERAGE_NOT_ASSESSED');
    });
    it('blocks coverage gaps without an authorised disposition, and accepts one with', () => {
        const failed = Object.assign({}, base.coverage, { outcome: 'failed', counts: { critical: 2, warning: 0, info: 0 } });
        const ctxFn = ctx => { ctx.checklists = [Object.assign({}, base.ctx.checklists[0], { coverage: failed })]; };
        expect(codes(gateWith(base, () => { }, ctxFn))).toContain('COVERAGE_GAP');
        const ok = gateWith(base, p => { p.coverageDispositions = [{ checklistId: base.checklist.id, by: 'CM', role: 'Certification Manager', reason: 'Accepted for next cycle' }]; }, ctxFn);
        expect(codes(ok)).not.toContain('COVERAGE_GAP');
    });
    it('blocks a plan with no checklist', () => {
        expect(codes(gateWith(base, () => { }, ctx => { ctx.checklists = []; }))).toContain('CHECKLIST_MISSING');
    });
    it('the plan\u2019s clause set and the checklist\u2019s agree: every checklist question is scheduled', () => {
        expect(base.plan.traceability.checklist.unscheduled).toEqual([]);
        const scheduled = new Set(base.plan.traceability.sessions.flatMap(s => s.checklistQuestions.map(q => q.clause + '|' + q.title)));
        const qs = base.plan.traceability.checklist.questions.filter(q => q.clause && !/^(RECERT|FOCUS|DOC|REVIEW|DOCNOTE)/i.test(q.clause));
        expect(qs.length).toBeGreaterThan(50);
        qs.forEach(q => expect(scheduled.has(q.clause + '|' + q.title), q.clause + ' ' + q.title).toBe(true));
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('text hygiene and page furniture in the client document', () => {
    it('decodes legacy HTML-escaped agenda text instead of printing "&amp;"', () => {
        const plan = clone(base.plan);
        plan.agenda[9].dept = 'Patch &amp;amp; Vulnerability Management';
        plan.agenda[9].item = 'Backup &amp; Recovery';
        const html = PD.build(plan, base.ctx);
        const text = DF.renderedText(html);
        expect(text).toContain('Patch & Vulnerability Management');
        expect(text).toContain('Backup & Recovery');
        expect(DF.findRawEntities(text)).toEqual([]);
    });
    it('the gate catches a raw entity that survives into the rendered text', () => {
        const v = gateWith(base, () => { }, ctx => { ctx.html = '<p>Patch &amp;amp; Vulnerability</p><style>@page{@bottom-right{content:"Page " counter(page) " of " counter(pages)}}</style>'; });
        expect(v.blockers.find(b => b.code === 'RAW_ENTITY').message).toContain('&amp;');
    });
    it('the gate catches "Audit Team: None" and browser decoration', () => {
        const html = '<p>Audit Team: None</p><p>about:blank</p>';
        const v = gateWith(base, () => { }, ctx => { ctx.html = html; });
        expect(codes(v)).toEqual(expect.arrayContaining(['AUDIT_TEAM_NONE', 'BROWSER_ARTIFACT']));
    });
    it('the gate rejects static page numbers and in-flow footers', () => {
        const html = '<div class="footer">Page 1 of 1</div>';
        const v = gateWith(base, () => { }, ctx => { ctx.html = html; ctx.lint = M.PS.lint(html); });
        expect(codes(v)).toEqual(expect.arrayContaining(['INCORRECT_PAGINATION', 'TRAILING_BLANK_PAGE_RISK']));
    });
    it('the client plan and the checklist carry controlled page furniture and nothing static', () => {
        [base.html, base.checklistHtml, base.internal].forEach(h => {
            expect(M.PS.lint(h)).toEqual([]);
            expect(h).toContain('counter(page)');
            expect(h).toContain('counter(pages)');
            expect(h).not.toMatch(/Page\s+\d+\s+of\s+\d+/);
            expect(h).not.toMatch(/<script/i);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════
describe('document status workflow', () => {
    const CM = 'Certification Manager';
    it('has the four statuses, in order', () => {
        expect(IPI.STATUSES).toEqual(['Draft \u2014 Internal Review', 'Approved for Client Issue', 'Issued to Client', 'Client Acknowledged']);
    });
    it('blocks client issue while any validation fails, and lists the blockers', () => {
        const r = IPI.canTransition(IPI.STATUSES[0], IPI.STATUSES[1], { role: CM, validation: base.validation, plan: base.plan });
        expect(r.allowed).toBe(false);
        expect(r.reason).toMatch(/1 blocking issue\(s\) must be resolved first/);
        expect(r.blockers.map(b => b.code)).toEqual(['DURATION_NOT_APPROVED']);
    });
    it('allows approval when the gate is clean and the role is authorised', () => {
        expect(IPI.canTransition(IPI.STATUSES[0], IPI.STATUSES[1], { role: CM, validation: approved.validation, plan: approved.plan })).toEqual({ allowed: true });
        expect(approved.plan.documentStatus).toBe('Approved for Client Issue');
    });
    it('only authorised roles may approve or issue', () => {
        ['Auditor', 'Lead Auditor', 'Client', ''].forEach(role => {
            const r = IPI.canTransition(IPI.STATUSES[0], IPI.STATUSES[1], { role, validation: approved.validation, plan: approved.plan });
            expect(r.allowed, role).toBe(false);
            expect(r.reason).toMatch(/Only Admin, Certification Manager, Cert Manager may approve/);
        });
        expect(IPI.canTransition(IPI.STATUSES[1], IPI.STATUSES[2], { role: 'Auditor', validation: approved.validation, plan: approved.plan }).allowed).toBe(false);
        expect(IPI.canTransition(IPI.STATUSES[1], IPI.STATUSES[2], { role: 'Admin', validation: approved.validation, plan: approved.plan }).allowed).toBe(true);
    });
    it('cannot skip a status', () => {
        expect(IPI.canTransition(IPI.STATUSES[0], IPI.STATUSES[2], { role: 'Admin', validation: approved.validation }).allowed).toBe(false);
    });
    it('refuses to issue a plan that changed after it was approved', () => {
        const edited = clone(approved.plan);
        edited.agenda[3].item += ' (edited)';
        const r = IPI.canTransition(IPI.STATUSES[1], IPI.STATUSES[2], { role: CM, validation: approved.validation, plan: edited });
        expect(r.allowed).toBe(false);
        expect(r.reason).toMatch(/changed after approval/);
    });
    it('client acknowledgement needs a named person', () => {
        expect(IPI.canTransition(IPI.STATUSES[2], IPI.STATUSES[3], { role: CM, validation: approved.validation }).allowed).toBe(false);
        expect(IPI.canTransition(IPI.STATUSES[2], IPI.STATUSES[3], { role: CM, validation: approved.validation, acknowledgedBy: 'K. Mason' }).allowed).toBe(true);
    });
    it('returning to draft is always allowed', () => {
        expect(IPI.canTransition(IPI.STATUSES[2], IPI.STATUSES[0], { role: 'Auditor' }).allowed).toBe(true);
    });
});
