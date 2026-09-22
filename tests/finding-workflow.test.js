import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const FW = require('../finding-workflow.js');
const CS = require('../checklist-standards.js');

describe('finding types are told apart', () => {
    it('maps every spelling the app stores to one of three types', () => {
        ['major', 'minor', 'Major NC', 'nc', 'NCR', 'Nonconformity'].forEach(v => expect(FW.normalizeType(v)).toBe('nonconformity'));
        ['observation', 'OBS', 'Observation'].forEach(v => expect(FW.normalizeType(v)).toBe('observation'));
        ['ofi', 'OFI', 'Opportunity for improvement'].forEach(v => expect(FW.normalizeType(v)).toBe('ofi'));
        expect(FW.normalizeType('')).toBe('unknown');
        expect(FW.normalizeType({ ncrType: 'major' })).toBe('nonconformity');
        expect(FW.normalizeType({ type: 'OFI' })).toBe('ofi');
    });
});

describe('nonconformity — corrective action is mandatory', () => {
    const full = {
        type: 'minor', status: 'Closed',
        immediateReaction: 'Access revoked', correction: 'Accounts removed', rootCause: 'Leaver checklist not triggered',
        causeEvaluation: 'Systemic — affects all leavers', correctiveAction: 'Automate HR-to-IAM trigger',
        implementationEvidence: 'Change CHG-1042', capaImplementedDate: '2026-03-01',
        effectiveness: 'No recurrence in 6 months', verifiedDate: '2026-09-01', verifiedBy: 'Lead Auditor',
        closureDecisionBy: 'Certification Manager'
    };

    it('requires correction, cause, corrective action, implementation, effectiveness and closure', () => {
        const ids = FW.treatment('major').steps.map(s => s.id);
        ['correction', 'cause-evaluation', 'root-cause', 'corrective-action', 'implementation', 'effectiveness', 'closure', 'records']
            .forEach(id => expect(ids).toContain(id));
        expect(FW.treatment('minor').capaMandatory).toBe(true);
    });

    it('reports exactly which mandatory steps are missing', () => {
        const ev = FW.evaluate({ type: 'minor', correction: 'Fixed', rootCause: 'Process gap' });
        expect(ev.complete).toBe(false);
        expect(ev.missing.map(s => s.id)).toEqual(expect.arrayContaining(['corrective-action', 'implementation', 'effectiveness', 'closure']));
        expect(ev.missing.map(s => s.id)).not.toContain('correction');
    });

    it('does not require an immediate reaction where none applies', () => {
        const ev = FW.evaluate(Object.assign({}, full, { immediateReaction: '', containment: '' }));
        expect(ev.missing.map(s => s.id)).not.toContain('reaction');
    });

    it('may be closed only when every step is evidenced and an authorised person decided', () => {
        expect(FW.evaluate(full).canClose).toBe(true);
        expect(FW.evaluate(Object.assign({}, full, { closureDecisionBy: '', verifiedBy: '' })).canClose).toBe(false);
        expect(FW.evaluate(Object.assign({}, full, { effectiveness: '', verifiedDate: '' })).canClose).toBe(false);
    });

    it('stays a follow-up item until closed AND effectiveness reviewed', () => {
        expect(FW.requiresFollowUp({ type: 'minor', status: 'Open' })).toBe(true);
        expect(FW.requiresFollowUp({ type: 'minor', status: 'Closed' })).toBe(true);
        expect(FW.requiresFollowUp(full)).toBe(false);
    });
});

describe('observation — optional-action workflow', () => {
    it('requires evaluation, impact consideration and a disposition — and no CAPA', () => {
        const t = FW.treatment('observation');
        expect(t.capaMandatory).toBe(false);
        expect(t.steps.map(s => s.id)).toEqual(['management-evaluation', 'impact', 'disposition']);
        expect(t.optional.map(s => s.id)).toEqual(['voluntary-action']);
    });

    it('is not held to root-cause or effectiveness requirements', () => {
        const ev = FW.evaluate({ type: 'observation', managementEvaluation: 'Reviewed', impactConsideration: 'Low', disposition: 'Monitor' });
        expect(ev.complete).toBe(true);
        expect(ev.missing).toEqual([]);
        const ids = ev.required.map(s => s.id);
        expect(ids).not.toContain('root-cause');
        expect(ids).not.toContain('effectiveness');
        expect(ev.notes.join(' ')).toMatch(/not required for this finding type/i);
    });

    it('never forces a scheduled agenda session — only a nonconformity does', () => {
        expect(FW.requiresFollowUp({ type: 'observation' })).toBe(false);
        expect(FW.requiresFollowUp({ type: 'observation', managementEvaluation: 'x', disposition: 'Accepted' })).toBe(false);
    });

    it('is never converted to a nonconformity silently', () => {
        const obs = { id: 'OBS-4', type: 'observation', description: 'Backup restore test not evidenced' };
        expect(() => FW.escalateObservation(obs, { requirementRef: 'A.8.13', escalatedBy: 'Lead Auditor' })).toThrow(/objective evidence/i);
        expect(() => FW.escalateObservation(obs, { objectiveEvidence: 'No restore record', escalatedBy: 'Lead Auditor' })).toThrow(/requirement/i);
        expect(() => FW.escalateObservation(obs, { objectiveEvidence: 'No restore record', requirementRef: 'A.8.13' })).toThrow(/named person/i);
    });

    it('escalates on objective evidence and keeps the link to the observation', () => {
        const obs = { id: 'OBS-4', type: 'observation', description: 'Backup restore test not evidenced', auditId: 'plan-1' };
        const nc = FW.escalateObservation(obs, { objectiveEvidence: 'No restore test record for 2025', requirementRef: 'A.8.13', escalatedBy: 'Lead Auditor' });
        expect(nc.type).toBe('nonconformity');
        expect(nc.escalatedFrom).toBe('OBS-4');
        expect(nc.escalatedBy).toBe('Lead Auditor');
        expect(nc.clause).toBe('A.8.13');
        expect(FW.normalizeType(nc)).toBe('nonconformity');
    });

    it('will not escalate a finding that is not an observation', () => {
        expect(() => FW.escalateObservation({ type: 'ofi' }, { objectiveEvidence: 'x', requirementRef: '1', escalatedBy: 'y' })).toThrow(/only an observation/i);
    });
});

describe('opportunity for improvement — optional-action workflow', () => {
    it('needs only the organisation’s decision; rationale, action and register link are optional', () => {
        const t = FW.treatment('ofi');
        expect(t.capaMandatory).toBe(false);
        expect(t.steps.map(s => s.id)).toEqual(['decision']);
        expect(t.optional.map(s => s.id)).toEqual(['rationale', 'voluntary-action', 'register-link']);
    });

    it('may be rejected without a rationale', () => {
        const rejected = FW.recordOfiDecision({ type: 'ofi' }, { decision: 'rejected', decidedBy: 'Quality Manager' });
        expect(rejected.ofiDecision).toBe('rejected');
        expect(rejected.ofiRationale).toBeUndefined();
        expect(FW.evaluate(rejected).complete).toBe(true);
        expect(FW.requiresFollowUp(rejected)).toBe(false);
    });

    it('never forces a scheduled agenda session, decided or not', () => {
        expect(FW.requiresFollowUp({ type: 'ofi' })).toBe(false);
    });

    it('records a voluntary action and improvement-register link when the organisation chooses to', () => {
        const accepted = FW.recordOfiDecision({ type: 'ofi' }, { decision: 'accepted', action: 'Add restore drill', improvementRegisterRef: 'IMP-2026-014', rationale: 'Worth doing' });
        expect(accepted.improvementAction).toBe('Add restore drill');
        expect(accepted.improvementRegisterRef).toBe('IMP-2026-014');
        expect(FW.evaluate(accepted).optionalDone.map(s => s.id)).toEqual(expect.arrayContaining(['voluntary-action', 'register-link']));
    });

    it('does not require root cause or effectiveness — until a formal corrective action is voluntarily opened', () => {
        const plain = FW.evaluate({ type: 'ofi', ofiDecision: 'accepted' });
        expect(plain.required.map(s => s.id)).not.toContain('root-cause');
        expect(plain.complete).toBe(true);

        const formal = FW.evaluate({ type: 'ofi', ofiDecision: 'accepted', formalCorrectiveActionOpened: true });
        expect(formal.formalCorrectiveActionOpened).toBe(true);
        expect(formal.required.map(s => s.id)).toContain('root-cause');
        expect(formal.complete).toBe(false);
    });

    it('rejects an undefined decision', () => {
        expect(() => FW.recordOfiDecision({ type: 'ofi' }, { decision: 'maybe' })).toThrow(/accepted, rejected or deferred/);
        expect(() => FW.recordOfiDecision({ type: 'observation' }, { decision: 'accepted' })).toThrow(/opportunity for improvement/);
    });
});

describe('previous-finding checklist wording', () => {
    const WORDING = 'Review all findings raised during previous audits in the certification cycle. For nonconformities, verify correction, evaluation of cause, corrective action, implementation and effectiveness. For observations and opportunities for improvement, verify management evaluation, disposition and any voluntary actions taken. Confirm whether any issue has recurred or developed into a nonconformity.';

    it('uses the exact required sentence', () => {
        expect(FW.PREVIOUS_FINDINGS_REQUIREMENT).toBe(WORDING);
    });

    it('is the wording the checklist registry ships — one source of truth', () => {
        const prev = CS.RECERT_PRIORITIES.find(p => p.id === 'prev-findings');
        expect(prev.prompt).toBe(FW.PREVIOUS_FINDINGS_REQUIREMENT);
    });

    it('no longer applies corrective-action verification to every finding type', () => {
        const prev = CS.RECERT_PRIORITIES.find(p => p.id === 'prev-findings');
        expect(prev.prompt).not.toMatch(/every nonconformity, observation and opportunity/i);
        expect(prev.prompt).not.toMatch(/Verify root cause analysis, action taken/i);
        expect(prev.prompt).toMatch(/For observations and opportunities for improvement, verify management evaluation, disposition/);
    });
});
