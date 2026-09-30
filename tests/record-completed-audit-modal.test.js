import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

// Record Completed Audit used three browser prompts. It is now a form in the
// app's modal — Audit Stage, Audit Date, Audit Source (CCI / Third-Party),
// Auditor / Organization, Evidence and Notes — and what it saves is the
// lifecycle event the cycle calculation reads: the milestone ticks, the stage
// moves on, and the record's source, auditor and evidence travel with it.
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');

globalThis.window = globalThis.window || globalThis;
globalThis.Logger = window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.state = { clients: [] };
window.saveData = () => { };
window.renderClientDetail = () => { };

const fs = await import('fs');
const path = await import('path');
eval(fs.readFileSync(path.resolve('./utils.js'), 'utf8'));
// Indirect eval: loaded as a global script, so its helpers are reachable.
(0, eval)(fs.readFileSync(path.resolve('./clients-org-setup.js'), 'utf8')
    .replace(/\nif \(typeof module !== 'undefined' && module\.exports\) \{[\s\S]*$/, ''));

const HALAL = { id: 'C-HALAL', standard: 'Halal', certificateNo: 'CR/IHC/SG/09/24/HC', status: 'Active', initialDate: '2024-09-14', currentIssue: '2025-09-14', expiryDate: '2026-09-13' };

function mountModal() {
    document.body.innerHTML = `
        <div id="modal-overlay" class="hidden"><h3 id="modal-title"></h3><div id="modal-body"></div>
        <button id="modal-cancel">Cancel</button><button id="modal-save">Save</button></div>`;
}
const set = (id, value) => { const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('change')); };
const attach = (files) => Object.defineProperty(document.getElementById('completion-evidence'), 'files', { value: files, configurable: true });
const flush = () => new Promise(r => setTimeout(r, 0));

describe('Record Completed Audit modal', () => {
    let client, notes, uploads, synced;
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-30T09:00:00'));
        notes = []; uploads = []; synced = [];
        client = { id: 'sg', name: 'SG 1888 (PVT.) LTD.', certificates: [JSON.parse(JSON.stringify(HALAL))], certificationLifecycleEvents: [] };
        window.state = {
            clients: [client], auditReports: [], auditPlans: [], cbSettings: {},
            auditors: [{ name: 'Hassan Javed.' }],
            currentUser: { name: 'Admin User', role: 'Certification Manager' }
        };
        window.AuditPlanningDomain = Domain;
        window.ReportStats = ReportStats;
        window.showNotification = (msg, type) => notes.push({ msg, type });
        window.openModal = () => document.getElementById('modal-overlay').classList.remove('hidden');
        window.closeModal = () => document.getElementById('modal-overlay').classList.add('hidden');
        window.renderClientOrgSetup = vi.fn();
        window.prompt = vi.fn(() => { throw new Error('browser prompt used'); });
        window.confirm = vi.fn(() => { throw new Error('browser confirm used'); });
        window.SupabaseClient = {
            isInitialized: true,
            syncClientsToSupabase: async (list) => { synced.push(...list); },
            client: { storage: { from: () => ({ upload: async (p, file) => { uploads.push({ p, file }); return { data: { path: p }, error: null }; } }) } }
        };
        mountModal();
    });

    it('opens a form, not a browser prompt, with every field and S2 suggested once S1 is done', () => {
        client.certificationLifecycleEvents.push({ id: 'e1', certificateId: 'C-HALAL', type: 'surveillance-1-completed', occurredAt: '2025-09-10T00:00:00.000Z', metadata: {} });
        window.recordCompletedCertificationAudit('sg', 0);
        expect(window.prompt).not.toHaveBeenCalled();
        expect(document.getElementById('modal-title').textContent).toBe('Record Completed Audit');
        expect(Array.from(document.querySelectorAll('#completion-stage option')).map(o => o.textContent)).toEqual(['S1 — Surveillance 1', 'S2 — Surveillance 2', 'Recert — Recertification']);
        expect(document.getElementById('completion-stage').value).toBe('Surveillance 2');
        expect(Array.from(document.querySelectorAll('#completion-source option')).map(o => o.textContent)).toEqual(['CCI', 'Third-Party']);
        ['completion-date', 'completion-auditor', 'completion-evidence', 'completion-notes'].forEach(id => expect(document.getElementById(id)).toBeTruthy());
        expect(document.getElementById('completion-date').max).toBe('2026-09-30');
        expect(document.getElementById('modal-overlay').classList.contains('hidden')).toBe(false);
    });

    it('requires the date', async () => {
        window.recordCompletedCertificationAudit('sg', 0);
        document.getElementById('modal-save').click();
        await flush();
        expect(client.certificationLifecycleEvents).toHaveLength(0);
        expect(notes.pop().msg).toMatch(/date the audit was performed/);
    });

    it('requires the organization for a third-party audit, before uploading anything', async () => {
        window.recordCompletedCertificationAudit('sg', 0);
        set('completion-date', '2025-09-10');
        set('completion-source', 'third-party');
        expect(document.getElementById('completion-auditor-label').textContent).toMatch(/Organization/);
        attach([new File(['x'], 'report.pdf', { type: 'application/pdf' })]);
        document.getElementById('modal-save').click();
        await flush();
        expect(uploads).toHaveLength(0);
        expect(client.certificationLifecycleEvents).toHaveLength(0);
        expect(notes.pop().msg).toMatch(/Name the organization/);
    });

    it('saves a third-party S1 with evidence, and the cycle ticks S1 and moves to S2', async () => {
        window.recordCompletedCertificationAudit('sg', 0);
        set('completion-stage', 'Surveillance 1');
        set('completion-date', '2025-09-10');
        set('completion-source', 'third-party');
        set('completion-auditor', 'Previous CB Ltd');
        set('completion-notes', 'Transfer audit report ref TR-118');
        attach([new File(['%PDF'], 'S1 report.pdf', { type: 'application/pdf' })]);
        document.getElementById('modal-save').click();
        await flush(); await flush();

        expect(uploads).toHaveLength(1);
        expect(uploads[0].p).toMatch(/^lifecycle-evidence\/sg\/\d+_S1_report\.pdf$/);
        const [event] = client.certificationLifecycleEvents;
        expect(event).toMatchObject({ certificateId: 'C-HALAL', type: 'surveillance-1-completed', stage: 'Surveillance 1', reason: 'Transfer audit report ref TR-118' });
        expect(event.metadata).toMatchObject({ category: 'completion', source: 'third-party', auditor: 'Previous CB Ltd' });
        expect(event.metadata.evidence).toEqual([expect.objectContaining({ name: 'S1 report.pdf', path: uploads[0].p })]);
        expect(synced).toEqual([client]);
        expect(document.getElementById('modal-overlay').classList.contains('hidden')).toBe(true);
        expect(notes.pop()).toMatchObject({ type: 'success' });

        const cs = ReportStats.cycleState({ client, standard: 'Halal', certificate: client.certificates[0], allReports: [], allPlans: [], today: '2026-09-30' });
        expect(cs.completed.s1).toBe(true);
        expect(cs.stage).toBe('Surveillance 2');
        expect(cs.completionRecords.s1).toMatchObject({ source: 'third-party', auditor: 'Previous CB Ltd', note: 'Transfer audit report ref TR-118' });
        expect(cs.completionRecords.s1.evidence).toHaveLength(1);
    });

    it('a CCI S2 moves the stage on to Recertification', async () => {
        client.certificationLifecycleEvents.push({ id: 'e1', certificateId: 'C-HALAL', type: 'surveillance-1-completed', occurredAt: '2025-09-10T00:00:00.000Z', metadata: {} });
        window.recordCompletedCertificationAudit('sg', 0);
        set('completion-date', '2026-09-25');
        set('completion-auditor', 'Hassan Javed.');
        document.getElementById('modal-save').click();
        await flush(); await flush();
        expect(uploads).toHaveLength(0);
        const cs = ReportStats.cycleState({ client, standard: 'Halal', certificate: client.certificates[0], allReports: [], allPlans: [], today: '2026-09-30' });
        expect(cs.completed.s2).toBe(true);
        expect(cs.stage).toBe('Recertification');
        expect(cs.completionRecords.s2).toMatchObject({ source: 'cci', auditor: 'Hassan Javed.' });
    });

    it('warns in the form, not with a browser confirm, when the date is before this cycle', () => {
        window.recordCompletedCertificationAudit('sg', 0);
        set('completion-date', '2024-01-10');
        const note = document.getElementById('completion-cycle-note');
        expect(note.style.display).toBe('');
        expect(note.textContent).toMatch(/before the current cycle/);
        expect(window.confirm).not.toHaveBeenCalled();
    });

    it('does not save when an evidence upload fails', async () => {
        window.SupabaseClient.client.storage.from = () => ({ upload: async () => ({ data: null, error: { message: 'bucket full' } }) });
        window.recordCompletedCertificationAudit('sg', 0);
        set('completion-date', '2025-09-10');
        attach([new File(['x'], 'r.pdf')]);
        document.getElementById('modal-save').click();
        await flush(); await flush();
        expect(client.certificationLifecycleEvents).toHaveLength(0);
        expect(notes.pop().msg).toMatch(/bucket full/);
        expect(document.getElementById('modal-save').disabled).toBe(false);
    });

    it('lists the source, auditor and evidence under Audits performed', () => {
        client.certificationLifecycleEvents.push({ id: 'e9', certificateId: 'C-HALAL', type: 'surveillance-1-completed', occurredAt: '2025-09-10T00:00:00.000Z', user: 'Admin', reason: 'ref 1', metadata: { source: 'third-party', auditor: 'Previous CB <Ltd>', evidence: [{ name: 'r.pdf', path: 'lifecycle-evidence/sg/1_r.pdf' }] } });
        document.body.innerHTML = certificateCompletionsHTML(client, client.certificates[0], 0);
        expect(document.body.textContent).toMatch(/Third-party: Previous CB <Ltd>/);
        const btn = document.querySelector('[data-action="openCompletionEvidence"]');
        expect(btn.dataset.arg2).toBe('e9');
        expect(btn.textContent).toMatch(/r\.pdf/);
    });
});

describe('Domain.createCompletionRecord — source, auditor and evidence', () => {
    const base = { user: 'Asim', role: 'Certification Manager', settings: {}, milestone: 'Surveillance 1', performedAt: '2025-07-10', now: '2026-09-30' };
    it('defaults to a CCI audit and keeps older callers working', () => {
        expect(Domain.createCompletionRecord(base)).toMatchObject({ source: 'cci', auditor: '', evidence: [] });
    });
    it('keeps only stored evidence files', () => {
        const r = Domain.createCompletionRecord({ ...base, evidence: [{ name: 'a.pdf', path: 'p/a.pdf' }, { name: 'nothing' }, null] });
        expect(r.evidence).toEqual([{ name: 'a.pdf', path: 'p/a.pdf', url: null, size: null, type: null }]);
    });
});
