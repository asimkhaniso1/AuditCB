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
