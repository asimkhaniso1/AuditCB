// Correctness-defect fixes made to the CAPA side of ncr-capa-module.js during
// the KTD Select duplication/leak review:
//
//   1. carStatusOptionsHTML's hideVerdicts option — editNCR/updateCAPAProgress's
//      general status dropdown could previously flip a record straight to
//      'Closed'/'Effective' with none of the evidence window.verifyCAPA
//      records (verificationMethod/effectiveness/verifiedBy/verifiedDate). A
//      CAPA could be "closed" with no record of who verified it worked.
//   2. resolveAuditRef — the register/CAPA-tracker rows had no way to show
//      WHICH audit engagement raised a finding, which is what let a genuine
//      multi-audit history read as duplication.
//   3. printNCRRegister — printed the register without excluding Withdrawn
//      (superseded/duplicate) records, unlike every on-screen view.
//   4. verifyCAPA's "Not Effective" branch — left the legacy `status` field
//      stranded at its pre-verification value instead of re-deriving it from
//      the new carStatus, the way every other carStatus-setting site in this
//      file already does.
import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditPlans: [] };

const fs = await import('fs');
const path = await import('path');
const utilsSrc = fs.readFileSync(path.resolve('./utils.js'), 'utf8');
// eslint-disable-next-line no-eval
eval(utilsSrc);
const src = fs.readFileSync(path.resolve('./ncr-capa-module.js'), 'utf8');
// eslint-disable-next-line no-eval
eval(src);

function ncr(overrides) {
    return Object.assign({
        id: 'ncr-1',
        clientId: 'client-1',
        auditId: 'audit-1',
        clause: '8.5.2',
        description: 'Sample finding',
        severity: 'Minor',
        status: 'Open',
        raisedDate: '2026-01-01'
    }, overrides);
}

// CSP: script-src has no 'unsafe-inline', so an onkeyup="..." attribute is
// silently blocked at runtime — the register's Search box did nothing.
// getNCRRegisterHTML/filterNCRs are module-scoped with no window export, and
// (unlike a real classic-script page load) this eval-based test harness runs
// the source in strict mode, where a top-level `function` declaration is
// confined to the eval's own scope rather than leaking out — so, per this
// suite's established pattern for exactly this situation (see
// lifecycle.test.js's overdue-predicate check), this asserts against the
// source text directly rather than invoking the function.
describe('NCR Register Search field has no inline event handler', () => {
    it('the register\'s Search input uses delegated data-action-input, not an inline onkeyup handler', () => {
        expect(src).toMatch(/id="filter-search"[^>]*data-action-input="filterNCRs"/);
        expect(src).not.toMatch(/id="filter-search"[^>]*onkeyup=/);
        // The file has no other inline DOM-event-handler attribute either —
        // this was the last one (see the task's brief for the sibling fix in
        // settings-kb.js).
        expect(src).not.toMatch(/\bon(click|change|keyup|keydown|input|blur|submit|focus)\s*=\s*"/);
    });

    it('filterNCRs is declared with no top-level IIFE wrapper around it, so a real classic-script page load (index.html loads this file without type="module") attaches it to window the way every other data-action-change="filterNCRs" control on this same filter bar already relies on', () => {
        expect(src).toMatch(/^function filterNCRs\(\)/m);
        // Guard against a future refactor silently wrapping the file in an
        // IIFE, which would break that window-attachment assumption for
        // filterNCRs and every other un-exported top-level function here.
        expect(src.trimStart().startsWith('(function')).toBe(false);
    });
});

describe('carStatusOptionsHTML — hideVerdicts blocks closing/effective-marking from the general status dropdown', () => {
    it('offers Effective and Closed by default (no opts) — unchanged behavior for any other caller', () => {
        const html = window.NCRModule.carStatusOptionsHTML('Draft');
        expect(html).toContain('value="Effective"');
        expect(html).toContain('value="Closed"');
    });

    it('drops Effective and Closed from the offered choices when hideVerdicts is set', () => {
        const html = window.NCRModule.carStatusOptionsHTML('In Progress', { hideVerdicts: true });
        expect(html).not.toContain('value="Effective"');
        expect(html).not.toContain('value="Closed"');
        // Every other stage remains selectable — only the two verification
        // verdicts are gated behind window.verifyCAPA.
        expect(html).toContain('value="Reopened"');
        expect(html).toContain('value="Withdrawn"');
        expect(html).toContain('value="Ineffective"');
        expect(html).toContain('value="Verification Pending"');
    });

    it('still offers the record\'s CURRENT value even under hideVerdicts, so an already-verified record does not lose its own option', () => {
        const closedHtml = window.NCRModule.carStatusOptionsHTML('Closed', { hideVerdicts: true });
        expect(closedHtml).toContain('value="Closed" selected');

        const effectiveHtml = window.NCRModule.carStatusOptionsHTML('Effective', { hideVerdicts: true });
        expect(effectiveHtml).toContain('value="Effective" selected');
    });
});

describe('window.NCRModule.resolveAuditRef', () => {
    beforeEach(() => {
        window.state = { ncrs: [], auditPlans: [] };
    });

    it('labels the record with its linked audit plan\'s type and date', () => {
        window.state.auditPlans = [{ id: 'plan-1', auditType: 'Surveillance', date: '2026-08-12' }];
        const rec = ncr({ auditId: 'plan-1' });
        expect(window.NCRModule.resolveAuditRef(rec)).toBe('Surveillance — ' + window.UTILS.formatDate('2026-08-12'));
    });

    it('falls back to plan.type when auditType is absent', () => {
        window.state.auditPlans = [{ id: 'plan-1', type: 'Recertification', startDate: '2026-03-01' }];
        const rec = ncr({ auditId: 'plan-1' });
        expect(window.NCRModule.resolveAuditRef(rec)).toBe('Recertification — ' + window.UTILS.formatDate('2026-03-01'));
    });

    it('falls back to the raised date alone when no linked audit plan is on file', () => {
        const rec = ncr({ auditId: 'no-such-plan', raisedDate: '2026-02-01' });
        expect(window.NCRModule.resolveAuditRef(rec)).toBe(window.UTILS.formatDate('2026-02-01'));
    });

    it('falls back to "-" when there is neither a linked plan nor a raised date', () => {
        const rec = ncr({ auditId: null, raisedDate: '' });
        expect(window.NCRModule.resolveAuditRef(rec)).toBe('-');
    });

    it('two records for the same client on different audits resolve to two different labels — the missing signal that made real history look like duplication', () => {
        window.state.auditPlans = [
            { id: 'plan-sv1', auditType: 'Surveillance', date: '2025-08-15' },
            { id: 'plan-sv2', auditType: 'Surveillance', date: '2026-08-12' }
        ];
        const older = ncr({ id: 'ncr-072', auditId: 'plan-sv1' });
        const newer = ncr({ id: 'ncr-077', auditId: 'plan-sv2' });
        expect(window.NCRModule.resolveAuditRef(older)).not.toBe(window.NCRModule.resolveAuditRef(newer));
    });
});

describe('printNCRRegister excludes Withdrawn records, matching every on-screen view', () => {
    beforeEach(() => {
        window.state = { ncrs: [], auditPlans: [], activeClientId: null, ncrContextClientId: null };
    });

    it('never writes a Withdrawn (superseded/duplicate) record into the printed page', () => {
        window.state.ncrs = [
            ncr({ id: 'ncr-live', status: 'Open', description: 'Live finding still requiring action' }),
            ncr({ id: 'ncr-dupe', status: 'Withdrawn', description: 'Superseded duplicate finding', withdrawnReason: 'Duplicate of ncr-live' })
        ];

        let written = '';
        const fakePrintWindow = {
            document: {
                write: (html) => { written += html; },
                close: () => { }
            }
        };
        const originalOpen = window.open;
        window.open = () => fakePrintWindow;
        try {
            window.printNCRRegister();
        } finally {
            window.open = originalOpen;
        }

        expect(written).toContain('Live finding still requiring action');
        expect(written).not.toContain('Superseded duplicate finding');
    });
});

describe('verifyCAPA — "Not Effective" branch re-derives legacy status from the new carStatus', () => {
    beforeEach(() => {
        window.state = { ncrs: [], auditPlans: [], currentUser: { name: 'A. Auditor' } };
        window.contentArea = { innerHTML: '' };
        document.body.innerHTML = '<div id="modal-title"></div><div id="modal-body"></div><button id="modal-save"></button>';
        window.openModal = () => { };
        window.closeModal = () => { };
        window.showNotification = () => { };
        delete window.SupabaseClient; // persistNCR() becomes a no-op without it
    });

    it('advances status off the stale pre-verification value instead of stranding it', async () => {
        const rec = ncr({ id: 'ncr-verify', status: 'Verification', carStatus: 'Verification Pending', capaImplementedDate: '2026-04-01' });
        window.state.ncrs = [rec];

        window.verifyCAPA('ncr-verify');
        document.getElementById('ver-eff').value = 'Not Effective';
        await document.getElementById('modal-save').onclick();

        expect(rec.carStatus).toBe('Ineffective');
        // Was left at 'Verification' before this fix — the exact state that
        // kept the register's status badge reading "awaiting verification"
        // and kept the Verify button showing on a record that had in fact
        // already failed verification.
        expect(rec.status).toBe(window.NCRModule.legacyStatusFromCar('Ineffective'));
        expect(rec.status).not.toBe('Verification');
    });

    it('a subsequent "Effective" verification still closes the record cleanly', async () => {
        const rec = ncr({ id: 'ncr-verify-2', status: 'Verification', carStatus: 'Verification Pending', capaImplementedDate: '2026-04-01' });
        window.state.ncrs = [rec];

        window.verifyCAPA('ncr-verify-2');
        document.getElementById('ver-eff').value = 'Effective';
        await document.getElementById('modal-save').onclick();

        expect(rec.status).toBe('Closed');
        expect(rec.carStatus).toBe('Closed');
    });
});
