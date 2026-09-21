// The register UI for the two finding types that carry NO mandatory corrective
// action: recording an observation's evaluation/disposition and an OFI's
// decision, and the controlled escalation of an observation to a nonconformity.
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
const fs = await import('fs');
const path = await import('path');
window.UTILS = require('../utils.js');
window.FindingWorkflow = require('../finding-workflow.js');
window.state = { ncrs: [], auditPlans: [] };
// eslint-disable-next-line no-eval
(0, eval)(fs.readFileSync(path.resolve('./ncr-capa-module.js'), 'utf8'));

let report;
beforeEach(() => {
    report = { id: 'r1', planId: 'plan-1', clientId: 'c1', client: 'PC CONNECTION, INC.', standard: 'ISO/IEC 27001:2022', date: '2025-11-18',
        checklistProgress: [
            { status: 'nc', ncrType: 'observation', clause: 'A.8.13', ncrDescription: 'Restore test not evidenced' },
            { status: 'nc', ncrType: 'ofi', clause: '9.1', ncrDescription: 'Trend the KPIs' }
        ] };
    window.state = { auditReports: [report], ncrs: [], clients: [{ id: 'c1', name: 'PC CONNECTION, INC.' }], currentUser: { name: 'Lead Auditor' }, activeClientId: null };
    window.saveData = () => { };
    window.showNotification = (m) => { window.__last = m; };
    window.closeModal = () => { };
    window.openModal = () => { };
    document.body.innerHTML = '<h2 id="modal-title"></h2><div id="modal-body"></div><button id="modal-save"></button>';
});

const html = () => document.getElementById('modal-body').innerHTML;

describe('observation response', () => {
    it('asks for evaluation, impact and disposition — and says corrective action is not required', () => {
        window.openFindingResponse('r1', 'checklistProgress', '0');
        expect(document.getElementById('modal-title').textContent).toMatch(/Observation/);
        expect(html()).toContain('Management evaluation');
        expect(html()).toContain('Risk / impact consideration');
        expect(html()).toContain('Disposition');
        expect(html()).toMatch(/Corrective action is not required/);
        expect(html()).not.toMatch(/root cause|effectiveness/i);
    });
    it('records the response on the observation, with who and when', () => {
        window.openFindingResponse('r1', 'checklistProgress', '0');
        document.getElementById('fr-eval').value = 'Reviewed by the ISM';
        document.getElementById('fr-impact').value = 'Low; backups exist';
        document.getElementById('fr-disposition').value = 'Monitor';
        document.getElementById('modal-save').onclick();
        const rec = report.checklistProgress[0];
        expect(rec).toMatchObject({ managementEvaluation: 'Reviewed by the ISM', impactConsideration: 'Low; backups exist', disposition: 'Monitor', respondedBy: 'Lead Auditor' });
        expect(window.FindingWorkflow.evaluate(Object.assign({ type: 'observation' }, rec)).complete).toBe(true);
    });
});

describe('opportunity for improvement decision', () => {
    it('asks only for a decision; rationale, action and register link are optional; no root cause or effectiveness', () => {
        window.openFindingResponse('r1', 'checklistProgress', '1');
        expect(document.getElementById('modal-title').textContent).toMatch(/Opportunity for improvement/);
        expect(html()).toContain('Rationale (optional)');
        expect(html()).toContain('Voluntary improvement action (optional)');
        expect(html()).toContain('Improvement register reference (optional)');
        expect(html()).toMatch(/No root-cause analysis or effectiveness review is required/);
    });
    it('records a rejection with no rationale', () => {
        window.openFindingResponse('r1', 'checklistProgress', '1');
        document.getElementById('fr-decision').value = 'rejected';
        document.getElementById('modal-save').onclick();
        expect(report.checklistProgress[1].ofiDecision).toBe('rejected');
        expect(report.checklistProgress[1].ofiRationale).toBeUndefined();
    });
    it('links a voluntary action to the improvement register', () => {
        window.openFindingResponse('r1', 'checklistProgress', '1');
        document.getElementById('fr-decision').value = 'accepted';
        document.getElementById('fr-action').value = 'Add KPI trending';
        document.getElementById('fr-register').value = 'IMP-2026-014';
        document.getElementById('modal-save').onclick();
        expect(report.checklistProgress[1]).toMatchObject({ ofiDecision: 'accepted', improvementAction: 'Add KPI trending', improvementRegisterRef: 'IMP-2026-014' });
    });
});

describe('escalating an observation to a nonconformity', () => {
    const answer = (...vals) => { let i = 0; window.prompt = () => vals[i++]; };
    it('never happens without objective evidence', async () => {
        answer('', 'A.8.13', 'Minor');
        await window.escalateObservationToNCR('r1', 'checklistProgress', '0');
        expect(window.state.ncrs).toEqual([]);
        expect(report.checklistProgress[0].escalatedToNcr).toBeUndefined();
        expect(window.__last).toMatch(/objective evidence is required/);
    });
    it('never happens without a named requirement', async () => {
        answer('No restore test record for 2025', '', 'Minor');
        await window.escalateObservationToNCR('r1', 'checklistProgress', '0');
        expect(window.state.ncrs).toEqual([]);
    });
    it('raises a linked NCR on evidence, in the named person’s name, and leaves the observation as it was', async () => {
        answer('No restore test record for 2025', 'A.8.13', 'Major');
        await window.escalateObservationToNCR('r1', 'checklistProgress', '0');
        expect(window.state.ncrs).toHaveLength(1);
        const ncr = window.state.ncrs[0];
        expect(ncr).toMatchObject({ clause: 'A.8.13', severity: 'Major', escalatedBy: 'Lead Auditor', status: 'Open', auditId: 'plan-1', objectiveEvidence: 'No restore test record for 2025' });
        expect(report.checklistProgress[0].escalatedToNcr).toBe(ncr.id);
        expect(report.checklistProgress[0].ncrType).toBe('observation'); // not silently converted
    });
});
