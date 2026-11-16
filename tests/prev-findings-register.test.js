// Previous Findings Status on a surveillance/recertification report.
//
// The default read closure only from the prior report's own findingStatus
// map — set at that report's issue and normally empty — so a recertification
// whose previous nonconformities were all tracked in the NCR register printed
// "Records of previous findings were not available for review." The register
// (window.state.ncrs, joined on auditId === previous plan or report id) is the
// live lifecycle store and now decides open vs verified and closed.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const REP_SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');

/** Lift `_derivePreviousFindingsStatus` (and the regex it reads) out of the source. */
function loadDerive() {
    const m = REP_SRC.match(/const PREV_STATUS_EMPTY_RE = [^\n]*\n[\s\S]*?const _derivePreviousFindingsStatus = \(d\) => \{[\s\S]*?\n {4}\};/);
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
        win = { state: { auditReports: [prevReport], ncrs: [] } };
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
