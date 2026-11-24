// Previous-findings follow-up status.
//
// The report shows a per-row "Follow-up Status" table for the previous audit's
// nonconformities, in two places: the editable preview and the exported PDF.
// Both printed "Verified closed — corrective action implemented" on EVERY row,
// unconditionally, with no reference to what the prior report actually
// recorded. A report whose own narrative correctly said "Records of previous
// findings were not available for review" still asserted, row by row, that
// every previous nonconformity had been verified closed — and the preview's
// cell is contenteditable, so the auditor was handed a pre-written verification
// claim to accept rather than a status to record.
//
// Asserting a verification that did not happen is the most serious error this
// report can make, so the rule is: an unrecorded state reads as follow-up
// PLANNED, never as completed.
//
// execution-reporting.js is far too DOM-dependent to evaluate as a module here
// (no existing test does), so the helper is lifted out of the source and
// exercised directly — the same approach tests/ktd-acceptance.test.js takes
// when it reads that file.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
loadScript('./report-stats.js', { params: { module: undefined } });
const ReportStats = globalThis.window.ReportStats;

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');

/** Lift `prevFollowUpLabel` out of the source and make it callable. */
function loadPrevFollowUpLabel() {
    // Lift the constant with the function — the label reads PREV_CLOSED_STATES
    // from the enclosing scope, so extracting the function alone cannot run.
    const m = SRC.match(/const PREV_CLOSED_STATES = \[[\s\S]*?const prevFollowUpLabel = \(recorded\) => \{[\s\S]*?\n {4}\};/);
    if (!m) throw new Error('prevFollowUpLabel not found in execution-reporting.js');
    globalThis.window = globalThis.window || globalThis;
    window.UTILS = { escapeHtml: (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
    // eslint-disable-next-line no-new-func
    return new Function('window', m[0] + '\nreturn prevFollowUpLabel;')(window);
}

describe('previous findings — planned follow-up is never reported as verification', () => {
    let label;

    beforeEach(() => { label = loadPrevFollowUpLabel(); });

    it('claims verified closure only when the prior report recorded it', () => {
        expect(label('closed')).toBe('Verified closed — corrective action implemented');
        expect(label('verified')).toBe('Verified closed — corrective action implemented');
        expect(label('Closed')).toBe('Verified closed — corrective action implemented');
    });

    it('reports follow-up as PLANNED when no state was recorded', () => {
        ['', null, undefined, '   '].forEach(v => {
            const out = label(v);
            expect(out).toMatch(/Follow-up planned/i);
            expect(out).not.toMatch(/verified closed/i);
        });
    });

    it('reports an unresolved finding as open, naming the recorded state', () => {
        const out = label('in progress');
        expect(out).toMatch(/not yet verified/i);
        expect(out).toContain('in progress');
        expect(out).not.toMatch(/verified closed/i);
    });

    it('escapes a recorded state rather than injecting it as markup', () => {
        expect(label('<img src=x onerror=alert(1)>')).not.toContain('<img');
    });
});

describe('previous findings — the claim exists in exactly one place', () => {
    it('no table cell hardcodes a verification claim', () => {
        // One occurrence only: the guarded return inside prevFollowUpLabel.
        // Any second occurrence means a row builder has gone back to asserting
        // closure without consulting the prior report.
        const hits = SRC.split('Verified closed — corrective action implemented').length - 1;
        expect(hits).toBe(1);
    });

    it('both the preview and the export tables go through the shared helper', () => {
        // prevFollowUpForNC / prevFollowUpLabel are called once per row builder:
        // two in the preview table, two in the export table.
        const calls = (SRC.match(/prevFollowUpForNC\(prevReport, nc\)|prevFollowUpLabel\(ncr\.status\)/g) || []).length;
        expect(calls).toBe(4);
    });
});


// ─── Previous Findings Status: the NCR register decides ─────────────────────
// The default read closure only from the prior report's own findingStatus map
// — set at that report's issue and normally empty — so a recertification whose
// previous nonconformities were all tracked in the NCR register printed
// "Records of previous findings were not available for review." The register
// (window.state.ncrs, joined on auditId === previous plan or report id) is the
// live lifecycle store and now decides open vs verified and closed.
/** Lift `_derivePreviousFindingsStatus` (and the regex it reads) out of the source. */
function loadDerive() {
    const m = SRC.match(/const PREV_STATUS_EMPTY_RE = [^\n]*\n[\s\S]*?const _derivePreviousFindingsStatus = \(d\) => \{[\s\S]*?\n {4}\};/);
    if (!m) throw new Error('_derivePreviousFindingsStatus not found in execution-reporting.js');
    // eslint-disable-next-line no-new-func
    return new Function('window', m[0] + '\nreturn _derivePreviousFindingsStatus;');
}

describe('Previous Findings Status — read from the NCR register', () => {
    let derive;
    let win;
    const prevReport = { id: 'rep-feb', planId: 'plan-feb', client: 'Acme', date: '2026-02-17', status: 'Finalized', reportStatus: 'final',
        checklistProgress: [{ clause: '9.2', status: 'nc', ncrType: 'minor' }] };
    const d = () => ({ report: { id: 'rep-nov', client: 'Acme', previousFindingsStatus: '' }, auditPlan: { auditType: 'Recertification' }, client: { name: 'Acme' } });

    beforeEach(() => {
        // The previous report is found by ReportStats.previousReport (the real
        // module), the one lookup shared with the Previous Findings tables.
        win = { state: { auditReports: [prevReport], ncrs: [] }, ReportStats };
        derive = loadDerive()(win);
    });

    it('open register records for the previous audit read as open (the prior report recorded no status)', () => {
        win.state.ncrs = [
            { id: 21, auditId: 'plan-feb', clause: '7.5', type: 'minor', status: 'Open' },
            { id: 53, auditId: 'plan-feb', clause: '9.2', type: 'minor', status: 'Open' }
        ];
        expect(derive(d())).toBe('Previous nonconformity(ies) remain open.');
    });

    it('all register records closed or effective read as verified and closed', () => {
        win.state.ncrs = [
            { id: 21, auditId: 'plan-feb', type: 'Minor', status: 'Closed' },
            { id: 53, auditId: 'plan-feb', type: 'Minor', status: 'In Progress', carStatus: 'Effective' }
        ];
        expect(derive(d())).toBe('Previous nonconformities verified and closed.');
    });

    it('withdrawn duplicates, observations and OFIs do not count', () => {
        win.state.ncrs = [
            { id: 1, auditId: 'plan-feb', type: 'minor', status: 'Withdrawn' },
            { id: 2, auditId: 'plan-feb', type: 'Observation', status: 'Open' },
            { id: 3, auditId: 'plan-feb', type: 'ofi', status: 'Open' },
            { id: 4, auditId: 'plan-feb', type: 'minor', status: 'Closed' }
        ];
        expect(derive(d())).toBe('Previous nonconformities verified and closed.');
    });

    it('records from another audit are ignored, so the old fallback still applies', () => {
        win.state.ncrs = [{ id: 9, auditId: 'some-other-plan', type: 'major', status: 'Open' }];
        expect(derive(d())).toBe('Records of previous findings were not available for review.');
    });

    it('also joins on the previous report id', () => {
        win.state.ncrs = [{ id: 7, auditId: 'rep-feb', severity: 'Major', status: 'Open' }];
        expect(derive(d())).toBe('Previous nonconformity(ies) remain open.');
    });

    it("the auditor's own wording still wins", () => {
        win.state.ncrs = [{ id: 53, auditId: 'plan-feb', type: 'minor', status: 'Open' }];
        const data = d();
        data.report.previousFindingsStatus = 'NCR-053 (9.2) verified closed on 17 Nov 2026.';
        expect(derive(data)).toBe('NCR-053 (9.2) verified closed on 17 Nov 2026.');
    });

    it('an initial audit is still not applicable', () => {
        const data = d();
        data.auditPlan.auditType = 'Stage 2';
        expect(derive(data)).toMatch(/^Not applicable/);
    });
});
