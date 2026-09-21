// ============================================
// FINDING WORKFLOW  (window.FindingWorkflow)
// ============================================
// What each kind of audit finding OBLIGES the organisation to do — defined
// once, so the checklist wording, the previous-finding follow-up in the audit
// plan and the register cannot disagree.
//
// WHY THIS FILE EXISTS
// --------------------
// The recertification checklist told the auditor to "review every
// nonconformity, observation and opportunity for improvement … verify root
// cause analysis, action taken, evidence of implementation and the
// organisation's own verification of effectiveness". That is the corrective
// action requirement of a NONCONFORMITY (ISO/IEC 27001 10.2, ISO 22301 10.1,
// ISO/IEC 20000-1 10.1) applied to findings that carry no such obligation.
// Auditing an observation for a root cause the organisation never had to
// establish manufactures nonconformities out of advice.
//
//   Nonconformity            failure to fulfil a requirement; corrective action
//                            is MANDATORY, with cause evaluation and an
//                            effectiveness review.
//   Observation              something the auditor noted that is not (yet) a
//                            failure to fulfil a requirement. The organisation
//                            evaluates it and records a disposition. No CAPA.
//   Opportunity for          a suggestion. The organisation may accept it,
//   improvement              reject it (a rationale is welcome, not required)
//                            or fold it into its improvement register. No CAPA,
//                            no root cause, no effectiveness check — unless the
//                            organisation VOLUNTARILY opens a formal
//                            corrective-action record.
//
// An observation can become a nonconformity only on objective evidence that a
// requirement was not fulfilled, by a named person, leaving the original
// observation linked. It is never converted silently.
//
// CONTRACT
//   FindingWorkflow.normalizeType(raw)            -> 'nonconformity'|'observation'|'ofi'|'unknown'
//   FindingWorkflow.treatment(type)               -> {label, capaMandatory, steps[], optional[], ...}
//   FindingWorkflow.evaluate(finding)             -> {type, complete, missing[], canClose, ...}
//   FindingWorkflow.requiresFollowUp(finding)     -> boolean
//   FindingWorkflow.escalateObservation(f, input) -> nonconformity record (throws without objective evidence)
//   FindingWorkflow.recordOfiDecision(f, input)   -> updated ofi
//   FindingWorkflow.PREVIOUS_FINDINGS_REQUIREMENT -> checklist wording

(function (global) {
    'use strict';

    const TYPES = { NC: 'nonconformity', OBS: 'observation', OFI: 'ofi', UNKNOWN: 'unknown' };

    function str(v) { return String(v == null ? '' : v).trim(); }
    function has(v) { return str(v) !== ''; }

    /** Map every spelling the app stores (severity, ncrType, badge text) to a type. */
    function normalizeType(raw) {
        const t = str(raw && typeof raw === 'object' ? (raw.type || raw.ncrType || raw.severity || raw.findingType) : raw).toLowerCase();
        if (!t) return TYPES.UNKNOWN;
        if (/^(major|minor|nc|ncr|nonconformity|non-conformity|non conformity|nonconform)/.test(t)) return TYPES.NC;
        if (/^(obs|observation)/.test(t)) return TYPES.OBS;
        if (/^(ofi|opportunit)/.test(t)) return TYPES.OFI;
        return TYPES.UNKNOWN;
    }

    // ── What each type requires ───────────────────────────────────────
    // `fields` are the register fields that evidence a step (any one satisfies
    // it). `ifApplicable` steps are required only where they apply — an
    // immediate reaction is not always possible (a past lapse cannot be
    // "contained"), and the standards say "where applicable".
    const TREATMENT = {
        nonconformity: {
            label: 'Nonconformity',
            capaMandatory: true,
            standardRefs: 'ISO/IEC 27001:2022 10.2 · ISO 22301:2019 10.1 · ISO/IEC 20000-1:2018 10.1',
            steps: [
                { id: 'reaction', label: 'Immediate reaction and containment', fields: ['immediateReaction', 'containment'], ifApplicable: true },
                { id: 'correction', label: 'Correction of the nonconformity', fields: ['correction'] },
                { id: 'cause-evaluation', label: 'Evaluation of the need to eliminate the cause', fields: ['causeEvaluation', 'rootCause'] },
                { id: 'root-cause', label: 'Cause / root-cause analysis appropriate to the issue', fields: ['rootCause'] },
                { id: 'corrective-action', label: 'Corrective action', fields: ['correctiveAction'] },
                { id: 'implementation', label: 'Evidence of implementation', fields: ['implementationEvidence', 'capaImplementedDate'] },
                { id: 'effectiveness', label: 'Review of effectiveness', fields: ['effectiveness', 'verifiedDate'] },
                { id: 'closure', label: 'Closure decision by authorised personnel', fields: ['closureDecisionBy', 'verifiedBy'] },
                { id: 'records', label: 'Documented information retained', fields: ['recordsRetained', 'closureDecisionBy', 'verifiedBy'] }
            ],
            optional: []
        },
        observation: {
            label: 'Observation',
            capaMandatory: false,
            standardRefs: '',
            steps: [
                { id: 'management-evaluation', label: 'Management evaluation', fields: ['managementEvaluation'] },
                { id: 'impact', label: 'Risk / impact consideration', fields: ['impactConsideration', 'riskConsideration'] },
                { id: 'disposition', label: 'Disposition (accept, monitor, act)', fields: ['disposition'] }
            ],
            optional: [
                { id: 'voluntary-action', label: 'Improvement, preventive or risk-treatment action', fields: ['voluntaryAction', 'improvementAction'] }
            ],
            escalation: 'Becomes a nonconformity only on objective evidence that a requirement was not fulfilled.'
        },
        ofi: {
            label: 'Opportunity for improvement',
            capaMandatory: false,
            standardRefs: '',
            steps: [
                { id: 'decision', label: 'Organisation’s decision: accept or reject the suggestion', fields: ['ofiDecision'] }
            ],
            optional: [
                { id: 'rationale', label: 'Rationale for rejecting (optional)', fields: ['ofiRationale'] },
                { id: 'voluntary-action', label: 'Voluntary improvement action', fields: ['improvementAction', 'voluntaryAction'] },
                { id: 'register-link', label: 'Link to the improvement register', fields: ['improvementRegisterRef'] }
            ],
            note: 'Root-cause analysis and effectiveness verification are not required unless the organisation voluntarily opens a formal corrective-action record.'
        }
    };

    function treatment(type) {
        return TREATMENT[normalizeType(type)] || null;
    }

    /**
     * Wording for the "previous findings" question on a recertification
     * checklist. States each type's own treatment and does not attribute the
     * corrective-action requirement to findings that carry none.
     */
    const PREVIOUS_FINDINGS_REQUIREMENT = 'Review all findings raised during previous audits in the certification cycle. '
        + 'For nonconformities, verify correction, evaluation of cause, corrective action, implementation and effectiveness. '
        + 'For observations and opportunities for improvement, verify management evaluation, disposition and any voluntary actions taken. '
        + 'Confirm whether any issue has recurred or developed into a nonconformity.';

    // Shorter forms used by the plan agenda and traceability records.
    const FOLLOW_UP_FOCUS = {
        nonconformity: 'Verify correction, cause evaluation, corrective action, implementation and effectiveness.',
        observation: 'Verify management evaluation, risk/impact consideration and disposition; confirm it has not recurred or become a nonconformity.',
        ofi: 'Verify the organisation’s decision and any voluntary improvement action; confirm no related nonconformity has arisen.'
    };

    function satisfied(step, finding) {
        const f = finding || {};
        if (step.fields.some(function (k) { return has(f[k]); })) return true;
        return false;
    }

    function closedStatus(finding) {
        return /^(closed|verified|withdrawn|cancelled|complete|completed|effective)/i.test(str(finding && (finding.carStatus || finding.status)));
    }

    /**
     * Where a finding stands against ITS OWN type's requirements — never
     * against another type's.
     *
     * @returns {{type:string, label:string, capaMandatory:boolean, required:Array, missing:Array,
     *            optionalDone:Array, complete:boolean, canClose:boolean, notes:string[]}}
     */
    function evaluate(finding) {
        const type = normalizeType(finding);
        const t = TREATMENT[type];
        if (!t) {
            return { type: type, label: 'Unclassified', capaMandatory: false, required: [], missing: [], optionalDone: [], complete: false, canClose: false,
                notes: ['The finding has no recognised type, so its requirements cannot be evaluated. Classify it before follow-up.'] };
        }
        const f = finding || {};
        // A formally opened corrective-action record on an OFI is a voluntary
        // decision by the organisation — from then on it is held to the NC steps.
        const formal = type === TYPES.OFI && (f.formalCorrectiveActionOpened === true);
        const steps = formal ? t.steps.concat(TREATMENT.nonconformity.steps.filter(function (s) { return s.id !== 'reaction' && s.id !== 'records'; })) : t.steps;
        const required = steps.map(function (s) { return Object.assign({ done: satisfied(s, f) }, s); });
        const missing = required.filter(function (s) { return !s.done && !s.ifApplicable; });
        const optionalDone = t.optional.filter(function (s) { return satisfied(s, f); });
        const notes = [];
        if (type === TYPES.NC && has(f.rootCause) === false && has(f.causeEvaluation) === false) {
            notes.push('Cause has not been evaluated.');
        }
        if (type !== TYPES.NC && !formal) {
            notes.push('Corrective action, root-cause analysis and effectiveness verification are not required for this finding type.');
        }
        if (type === TYPES.OBS && f.escalatedToNcr) notes.push('Escalated to nonconformity ' + f.escalatedToNcr + '.');
        const complete = missing.length === 0;
        // An NC may be closed only when every mandatory step is evidenced AND an
        // authorised person has recorded the decision.
        const canClose = type === TYPES.NC ? (complete && has(f.closureDecisionBy || f.verifiedBy)) : complete;
        return { type: type, label: t.label, capaMandatory: t.capaMandatory, required: required, missing: missing,
            optionalDone: optionalDone, complete: complete, canClose: canClose, formalCorrectiveActionOpened: formal, notes: notes };
    }

    /**
     * Does this finding still need looking at during the next audit?
     * A nonconformity is settled only when closed AND its effectiveness was
     * reviewed. An observation or OFI is settled once the organisation has
     * evaluated / decided it. Anything unclassified or without a recorded
     * status is treated as open — absence of a record is not closure.
     */
    function requiresFollowUp(finding) {
        const f = finding || {};
        const type = normalizeType(f);
        if (/^withdrawn|^cancel/i.test(str(f.status))) return false;
        if (type === TYPES.NC) {
            const settled = closedStatus(f) && (has(f.effectiveness) || has(f.verifiedDate) || /verified|effective/i.test(str(f.carStatus || f.status)));
            return !settled;
        }
        if (type === TYPES.OBS) return !(has(f.disposition) && has(f.managementEvaluation));
        if (type === TYPES.OFI) return !has(f.ofiDecision);
        return true;
    }

    /**
     * Raise a nonconformity from an observation. Refuses without objective
     * evidence, a named requirement and a named person: converting advice into
     * a failure by default is the error this whole module exists to prevent.
     */
    function escalateObservation(observation, input) {
        const o = observation || {};
        const i = input || {};
        if (normalizeType(o) !== TYPES.OBS) throw new Error('Only an observation can be escalated to a nonconformity.');
        if (!has(i.objectiveEvidence)) throw new Error('Escalation requires objective evidence that a requirement was not fulfilled.');
        if (!has(i.requirementRef)) throw new Error('Escalation requires the requirement that was not fulfilled.');
        if (!has(i.escalatedBy)) throw new Error('Escalation must be made by a named person.');
        const severity = /major/i.test(str(i.severity)) ? 'major' : 'minor';
        return {
            type: 'nonconformity',
            severity: severity,
            ncrType: severity,
            clause: str(i.requirementRef),
            description: str(i.description) || str(o.description),
            objectiveEvidence: str(i.objectiveEvidence),
            escalatedFrom: o.id != null ? String(o.id) : (o.ref || null),
            escalatedBy: str(i.escalatedBy),
            escalatedAt: i.escalatedAt || new Date().toISOString(),
            status: 'Open',
            auditId: o.auditId || null,
            clientId: o.clientId || null
        };
    }

    /** Record the organisation's decision on an OFI. Rationale is optional. */
    function recordOfiDecision(ofi, input) {
        const o = ofi || {};
        const i = input || {};
        if (normalizeType(o) !== TYPES.OFI) throw new Error('Only an opportunity for improvement takes this decision.');
        const decision = str(i.decision).toLowerCase();
        if (['accepted', 'rejected', 'deferred'].indexOf(decision) === -1) throw new Error('Decision must be accepted, rejected or deferred.');
        const out = Object.assign({}, o, { ofiDecision: decision, ofiDecidedBy: str(i.decidedBy), ofiDecidedAt: i.decidedAt || new Date().toISOString() });
        if (has(i.rationale)) out.ofiRationale = str(i.rationale);
        if (has(i.action)) out.improvementAction = str(i.action);
        if (has(i.improvementRegisterRef)) out.improvementRegisterRef = str(i.improvementRegisterRef);
        return out;
    }

    const API = { TYPES, TREATMENT, FOLLOW_UP_FOCUS, PREVIOUS_FINDINGS_REQUIREMENT,
        normalizeType, treatment, evaluate, requiresFollowUp, escalateObservation, recordOfiDecision };
    global.FindingWorkflow = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'finding-workflow.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);
