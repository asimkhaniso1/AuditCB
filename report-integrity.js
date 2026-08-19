/**
 * report-integrity.js — Report Integrity Validator for AuditCB-360.
 * =============================================================================
 * Pure, side-effect-free pre-issuance checks for an audit report. Consumed by
 * ai-service.js (finalizeAndPublish gate) and rendered by a UI panel elsewhere
 * (execution-module-v2.js — not this file's concern).
 *
 * Public API — window.ReportIntegrity:
 *   check({report, auditPlan, client, stats}) -> {blockers:[], warnings:[], information:[], status}
 *   checkById(reportId) -> same shape, resolving report/plan/client/stats itself
 *
 * Every result item: {id, severity: 'blocker'|'warning'|'info', section, message, source, suggestion}
 * `status` is 'READY FOR AUDITOR REVIEW' when there are zero blockers, else 'BLOCKED'.
 *
 * Designed to run standalone in Node (via `eval` in tests) or in the browser.
 * Every rule degrades gracefully — missing input data means the rule is
 * skipped rather than throwing or false-positiving.
 * =============================================================================
 */
(function (global) {
    'use strict';

    const trim = (s) => String(s == null ? '' : s).trim();
    const safeArr = (a) => (Array.isArray(a) ? a : []);
    const lower = (s) => trim(s).toLowerCase();

    function item(id, severity, section, message, source, suggestion, ref) {
        const out = { id, severity, section, message, source, suggestion };
        // `ref` locates the offending record so a UI can offer a direct fix
        // (e.g. "Set criterion" on a finding). Omitted for rules that concern
        // the report as a whole.
        if (ref) out.ref = ref;
        return out;
    }

    function findingRef(ncr, idx) {
        return {
            kind: 'finding',
            index: idx,
            clause: (ncr && ncr.clause) || '',
            source: (ncr && ncr._source) || 'checklist',
            checklistId: ncr && ncr.checklistId,
            itemIdx: ncr && ncr.itemIdx
        };
    }

    // ── Shared helpers ──────────────────────────────────────────────────────

    const FOCUS_CLAUSE_RE = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;
    const CURRENCY_RE = /[$€£]\s?\d|\b\d+(\.\d+)?\s?(million|M)\b.*(revenue|cost|penalt)/i;
    const RECURRING_RE = /recurring|repeated weakness|persistent/i;
    const GRANTING_RE = /recommended for certification/i;
    // Internal tracking reference (FOCUS/SURV/ORG/DOC) masquerading as a real
    // standard Clause reference inside free-text narrative — e.g. "Clause FOCUS.2".
    const NARRATIVE_INTERNAL_CLAUSE_RE = /Clauses?\s+(FOCUS|SURV|ORG|DOC)[.\s]/i;
    // Secondary/unsanctioned certification-verdict language that must never appear
    // in the formal narrative — the only certification decision is the deterministic
    // recommendation sentence (ReportStats.recommendationText).
    const BANNED_FORMAL_PHRASES = [
        /certifiable with targeted fixes/i,
        /overall health verdict/i,
        /fundamental soundness/i
    ];

    // Broad maturity / consultancy register in a FORMAL narrative. These are a
    // warning, not a blocker: unlike a second certification verdict they are
    // wording rather than a competing conclusion, and they typically survive in
    // narrative text drafted before the AI guardrails existed — the auditor
    // should reword or regenerate, not be locked out of issuing.
    const MATURITY_LANGUAGE = [
        /foundational (level|integrity|soundness)/i,
        /enhanced maturity|maturity (level|journey)/i,
        /strategic (integration|alignment|value)/i,
        /operational (resilience|friction)/i,
        /process degradation/i
    ];

    // Observation items (advisory, not major/minor) — kept separate from
    // allNCRs() which is major/minor only, for the pseudo-criterion warning.
    function allObservations(report) {
        return safeArr(report && report.checklistProgress)
            .filter((i) => i && lower(i.status) === 'nc' && lower(i.ncrType) === 'observation')
            .map((i) => ({ clause: i.clause || '', criterionRef: i.criterionRef, _source: 'checklist' }));
    }

    // Narrative fields that flow through to the printed report.
    function narrativeFields(report) {
        const r = report || {};
        return {
            executiveSummary: r.executiveSummary || '',
            positiveObservations: r.positiveObservations || '',
            ofi: Array.isArray(r.ofi) ? r.ofi.join('\n') : (r.ofi || ''),
            conclusion: r.editedConclusion || r.conclusion || '',
            previousFindingsStatus: r.previousFindingsStatus || '',
            changesSinceLastAudit: r.changesSinceLastAudit || ''
        };
    }

    function allNCRs(report) {
        const fromChecklist = safeArr(report && report.checklistProgress)
            .filter((i) => i && i.status === 'nc' && ['major', 'minor'].includes(lower(i.ncrType)))
            .map((i) => ({
                clause: i.clause || '',
                ncrType: i.ncrType,
                criterionRef: i.criterionRef,
                criterionSource: i.criterionSource,
                evidence: i.evidence,
                evidenceImage: i.evidenceImage,
                evidenceImages: i.evidenceImages,
                comment: i.comment || i.ncrDescription,
                department: i.department,
                riskLikelihood: i.riskLikelihood,
                riskImpact: i.riskImpact,
                checklistId: i.checklistId,
                itemIdx: i.itemIdx,
                requirement: i.requirement,
                _source: 'checklist'
            }));
        const fromManual = safeArr(report && report.ncrs)
            .filter((n) => n && /^major|minor$/i.test(lower(n.type || n.ncrType || n.severity)))
            .map((n) => ({
                clause: n.clause || '',
                ncrType: n.type || n.ncrType || n.severity,
                criterionRef: n.criterionRef,
                criterionSource: n.criterionSource,
                evidence: n.evidence,
                evidenceImage: n.evidenceImage,
                evidenceImages: n.evidenceImages,
                comment: n.comment || n.description,
                department: n.department,
                riskLikelihood: n.riskLikelihood,
                riskImpact: n.riskImpact,
                _source: 'manual'
            }));
        return fromChecklist.concat(fromManual);
    }

    // A checklist finding has no dedicated "evidence" text field in the
    // execution UI — the auditor records the objective evidence in the
    // finding's own remarks. Treating only `evidence`/images as evidence
    // therefore blocked every photo-less checklist NC even when the auditor
    // had written a full evidence statement. A substantive remark counts;
    // a stub ("n/a", "see notes") does not.
    const EVIDENCE_STUB_RE = /^(n\/?a|none|tbc|tbd|see notes?|as above|-{1,3})\.?$/i;
    const MIN_EVIDENCE_NARRATIVE = 25;
    function hasEvidence(ncr) {
        if (!ncr) return false;
        const textEvidence = trim(ncr.evidence) || (Array.isArray(ncr.evidence) && ncr.evidence.length > 0);
        const hasImage = !!ncr.evidenceImage || (Array.isArray(ncr.evidenceImages) && ncr.evidenceImages.length > 0);
        const narrative = trim(ncr.comment);
        const hasNarrative = narrative.length >= MIN_EVIDENCE_NARRATIVE && !EVIDENCE_STUB_RE.test(narrative);
        return !!(textEvidence || hasImage || hasNarrative);
    }

    function hasPriorFinalizedReport(client, report) {
        const reports = safeArr(global.state && global.state.auditReports);
        const clientKey = (report && (report.clientId != null ? String(report.clientId) : null))
            || (client && client.id != null ? String(client.id) : null);
        const clientName = (report && report.client) || (client && client.name) || null;
        return reports.some((r) => {
            if (!r || String(r.id) === String(report && report.id)) return false;
            const rClientKey = r.clientId != null ? String(r.clientId) : null;
            const matchesClient = (clientKey && rClientKey && rClientKey === clientKey)
                || (clientName && r.client && trim(r.client).toLowerCase() === trim(clientName).toLowerCase());
            if (!matchesClient) return false;
            return r.status === (global.CONSTANTS && global.CONSTANTS.STATUS && global.CONSTANTS.STATUS.FINALIZED)
                || r.status === 'Finalized'
                || r.reportStatus === 'final';
        });
    }

    // ── Blocker rules ────────────────────────────────────────────────────────

    function checkB1FocusCriterion(ncrs, results) {
        ncrs.forEach((ncr, idx) => {
            if (!FOCUS_CLAUSE_RE.test(trim(ncr.clause))) return;
            if (trim(ncr.criterionRef)) return; // real clause reference present
            results.blockers.push(item(
                'B1-' + idx,
                'blocker',
                'findings',
                `Finding on clause "${ncr.clause}" uses a placeholder/checklist tag rather than a real standard clause, and no criterionRef is set.`,
                ncr._source === 'manual' ? 'manual NCR register' : 'checklist finding',
                'Set the finding\'s criterionRef to the actual clause of the standard being audited.',
                findingRef(ncr, idx)
            ));
        });
    }

    // B1 refinement: an internal tracking reference (FOCUS/SURV/ORG/DOC) presented
    // as if it were a real standard "Clause" inside free narrative text — distinct
    // from checkB1FocusCriterion, which only looks at structured finding.clause.
    function checkB1NarrativeInternalRef(report, results) {
        const narrative = narrativeFields(report);
        Object.keys(narrative).forEach((key) => {
            const text = narrative[key];
            if (!text || !NARRATIVE_INTERNAL_CLAUSE_RE.test(text)) return;
            results.blockers.push(item(
                'B1n-' + key,
                'blocker',
                'narrative',
                `Narrative (${key}) presents an internal tracking reference as a standard "Clause" (e.g. "Clause FOCUS.2") — internal refs are not real clauses.`,
                'report.' + key,
                'Replace the internal reference with the real standard clause (via criterionRef), or reword to avoid calling it a "Clause".'
            ));
        });
    }

    function checkB2Chronology(input, results) {
        const { report, auditPlan, client, stats } = input;
        try {
            if (global.ReportStats && typeof global.ReportStats.buildProgramme === 'function') {
                const allReports = safeArr(global.state && global.state.auditReports);
                const programme = global.ReportStats.buildProgramme({ client, auditPlan, report, allReports });
                safeArr(programme && programme.issues).forEach((issue, idx) => {
                    const msg = typeof issue === 'string' ? issue : (issue && issue.message) || 'Programme chronology issue detected.';
                    results.blockers.push(item(
                        'B2-' + idx,
                        'blocker',
                        'programme',
                        msg,
                        'ReportStats.buildProgramme',
                        'Verify the certification programme timeline (stage order, surveillance/recert dates) before issuing.'
                    ));
                });
                return;
            }
        } catch (_e) { /* fall through to minimal local check */ }

        // Minimal local fallback when buildProgramme is unavailable.
        const auditTypeStr = lower((auditPlan && auditPlan.auditType) || (report && report.auditType));
        const isSurvOrRecert = /surveillance|recert/.test(auditTypeStr);
        if (!isSurvOrRecert) return;
        const hasCertificate = !!(client && Array.isArray(client.certificates) && client.certificates.length > 0)
            || !!(stats && stats.hasCertificate);
        const hasPrior = hasPriorFinalizedReport(client, report);
        if (!hasCertificate && !hasPrior) {
            results.blockers.push(item(
                'B2-fallback',
                'blocker',
                'programme',
                'Programme chronology cannot be substantiated: no certificate on file and no prior finalized report exists for this client.',
                'local chronology fallback (ReportStats.buildProgramme unavailable)',
                'Confirm certification history for this client, or link the correct audit plan/certificate.'
            ));
        }
    }

    function checkB3MissingEvidence(ncrs, results) {
        ncrs.forEach((ncr, idx) => {
            if (hasEvidence(ncr)) return;
            results.blockers.push(item(
                'B3-' + idx,
                'blocker',
                'findings',
                `${ncr.ncrType || 'Non-conformity'} finding on clause "${ncr.clause || '(no clause)'}" has no evidence text or evidence images recorded.`,
                ncr._source === 'manual' ? 'manual NCR register' : 'checklist finding',
                'Attach objective evidence (text description and/or photo) to substantiate the finding.'
            ));
        });
    }

    function checkB4MissingCriterion(ncrs, results) {
        ncrs.forEach((ncr, idx) => {
            if (trim(ncr.clause) || trim(ncr.criterionRef)) return;
            results.blockers.push(item(
                'B4-' + idx,
                'blocker',
                'findings',
                'A non-conformity finding has no clause and no criterionRef set.',
                ncr._source === 'manual' ? 'manual NCR register' : 'checklist finding',
                'Assign the specific standard clause this finding relates to.',
                findingRef(ncr, idx)
            ));
        });
    }

    function checkB5RecommendationMismatch(input, results) {
        const { report, auditPlan, stats } = input;
        const auditTypeStr = lower((auditPlan && auditPlan.auditType) || (report && report.auditType));
        const isSurveillance = /surveillance/.test(auditTypeStr);
        const isRecert = /recert/.test(auditTypeStr);
        if (!isSurveillance && !isRecert) return;

        let derivedRecText = '';
        try {
            if (global.ReportStats && typeof global.ReportStats.recommendationText === 'function') {
                const counts = stats || {};
                derivedRecText = global.ReportStats.recommendationText(auditTypeStr, counts) || '';
            }
        } catch (_e) { /* ignore, fall through to manual field only */ }

        const manualRec = trim(report && report.recommendation);
        const narrative = narrativeFields(report);
        const textsToScan = [narrative.conclusion, derivedRecText].filter(Boolean);

        const grantingFound = textsToScan.some((t) => GRANTING_RE.test(t));
        if (grantingFound) {
            results.blockers.push(item(
                'B5',
                'blocker',
                'recommendation',
                `Report recommendation/conclusion text uses certification-granting language ("Recommended for Certification") but the audit type is ${isSurveillance ? 'surveillance' : 'recertification'}.`,
                'report.conclusion / ReportStats.recommendationText',
                'Use surveillance/recertification-appropriate recommendation wording, not initial-certification granting language.'
            ));
            return;
        }

        // W8: manual radio value is just 'Recommended' but doesn't match derived type-specific wording.
        if (manualRec && derivedRecText && lower(manualRec) === 'recommended' && lower(manualRec) !== lower(derivedRecText)) {
            results.warnings.push(item(
                'W8',
                'warning',
                'recommendation',
                `Manually selected recommendation ("${manualRec}") does not match the type-specific derived recommendation text ("${derivedRecText}").`,
                'report.recommendation vs ReportStats.recommendationText',
                'Confirm the recommendation wording matches the audit type before issuing.'
            ));
        }
    }

    function checkB6FinancialClaims(report, results) {
        if (report && report.financialClaimsConfirmed === true) return;
        const narrative = narrativeFields(report);
        Object.keys(narrative).forEach((key) => {
            const text = narrative[key];
            if (!text) return;
            const hasCurrency = CURRENCY_RE.test(text);
            const hasPhrase = /revenue at risk/i.test(text) || /contractual penalt/i.test(text);
            if (!hasCurrency && !hasPhrase) return;
            results.blockers.push(item(
                'B6-' + key,
                'blocker',
                'narrative',
                `Financial claim requires auditor-entered evidence source (found in ${key}).`,
                'report.' + key,
                'Confirm the financial figure is auditor-verified, then set report.financialClaimsConfirmed = true, or remove the claim.'
            ));
        });
    }

    // B6-style scan extended with banned formal phrases: a secondary/unsanctioned
    // certification verdict or unsupported evaluative claim slipping into the
    // formal narrative (the only certification decision is the deterministic
    // recommendation sentence — see ReportStats.recommendationText).
    function checkB6BannedPhrases(report, results) {
        const narrative = narrativeFields(report);
        Object.keys(narrative).forEach((key) => {
            const text = narrative[key];
            if (!text) return;
            const hit = BANNED_FORMAL_PHRASES.some((re) => re.test(text));
            if (!hit) return;
            results.blockers.push(item(
                'B6p-' + key,
                'blocker',
                'narrative',
                `Narrative (${key}) contains a secondary certification verdict / unsupported evaluative claim in formal narrative.`,
                'report.' + key,
                'Remove the informal verdict language; the only certification decision is the deterministic recommendation sentence.'
            ));
        });
    }

    // W10 — maturity/consultancy register in a formal narrative.
    function checkW10MaturityLanguage(report, results) {
        const narrative = narrativeFields(report);
        Object.keys(narrative).forEach((key) => {
            const text = narrative[key];
            if (!text) return;
            const hit = MATURITY_LANGUAGE.find((re) => re.test(text));
            if (!hit) return;
            const phrase = (text.match(hit) || [''])[0];
            results.warnings.push(item(
                'W10-' + key,
                'warning',
                'narrative',
                `Narrative (${key}) uses broad maturity/consultancy wording ("${phrase}") rather than evidence-based audit language.`,
                'report.' + key,
                'Reword to state what the evidence showed, or regenerate the narrative — maturity commentary belongs in the analytics annex.'
            ));
        });
    }

    // W11 — a narrative naming a city that is not the client's master site.
    // The header pulls the address from master data, so a stale city surviving
    // in drafted prose contradicts the report's own Audit Location.
    function checkW11NarrativeLocation(report, client, results) {
        const site = client && Array.isArray(client.sites) && client.sites[0];
        const masterCity = trim(site && site.city);
        if (!masterCity) return;
        const narrative = narrativeFields(report);
        // Only look at "in <City>" / "at <City>" style mentions followed by a
        // state/country or sentence end, so ordinary prose isn't scanned for
        // every capitalised word.
        const cityMention = /\b(?:in|at)\s+([A-Z][A-Za-z.-]+(?:\s[A-Z][A-Za-z.-]+)?)\s*,\s*[A-Z]{2}\b/g;
        Object.keys(narrative).forEach((key) => {
            const text = narrative[key];
            if (!text) return;
            let m;
            const seen = {};
            while ((m = cityMention.exec(text)) !== null) {
                const found = trim(m[1]);
                if (!found || seen[found.toLowerCase()]) continue;
                seen[found.toLowerCase()] = true;
                if (found.toLowerCase() === masterCity.toLowerCase()) continue;
                results.warnings.push(item(
                    'W11-' + key,
                    'warning',
                    'narrative',
                    `Narrative (${key}) places the audit in "${found}", but the client's master site record is in "${masterCity}".`,
                    'report.' + key + ' vs client.sites[0].city',
                    'Correct the narrative (or the site master record) so the report does not contradict its own Audit Location.'
                ));
            }
        });
    }

    function checkB7RecurringWithoutHistory(report, client, results) {
        const narrative = narrativeFields(report);
        const hasPrior = hasPriorFinalizedReport(client, report);
        if (hasPrior) return;
        Object.keys(narrative).forEach((key) => {
            const text = narrative[key];
            if (!text || !RECURRING_RE.test(text)) return;
            results.blockers.push(item(
                'B7-' + key,
                'blocker',
                'narrative',
                `Narrative (${key}) describes a finding as recurring/repeated/persistent, but no prior finalized report exists for this client to substantiate that history.`,
                'report.' + key,
                'Either remove the recurrence claim or link the prior audit report that establishes the history.'
            ));
        });
    }

    // B8: NCs exist but the report has no standard/version recorded anywhere.
    function checkB8MissingStandard(report, auditPlan, ncrs, results) {
        if (!ncrs.length) return;
        const standard = trim((report && report.standard) || (auditPlan && auditPlan.standard));
        if (standard) return;
        results.blockers.push(item(
            'B8',
            'blocker',
            'report',
            'Non-conformities were raised but the report has no standard/version recorded (report.standard / auditPlan.standard).',
            'report.standard / auditPlan.standard',
            'Set the standard and version (e.g. "ISO 9001:2015") on the report or audit plan before issuing.'
        ));
    }

    // B9: next-audit/recertification chronology. Distinct, explicitly-identified
    // rule on top of B2's generic programme-issue pass-through — catches both a
    // textual chronology issue and the silent case of nextAudit being null while
    // the programme still has stages nominally 'Planned' (a data contradiction).
    function checkB9NextAuditChronology(input, results) {
        const { report, auditPlan, client } = input;
        try {
            if (!(global.ReportStats && typeof global.ReportStats.buildProgramme === 'function')) return;
            const allReports = safeArr(global.state && global.state.auditReports);
            const programme = global.ReportStats.buildProgramme({ client, auditPlan, report, allReports });
            const chronoIssues = safeArr(programme && programme.issues).filter((issue) => {
                const msg = typeof issue === 'string' ? issue : (issue && issue.message) || '';
                return /not after the current audit/i.test(msg);
            });
            const hasPlannedRemaining = safeArr(programme && programme.stages).some((s) => s.status === 'Planned');
            if (chronoIssues.length === 0 && !(programme && programme.nextAudit == null && hasPlannedRemaining)) return;
            const msg = chronoIssues.length
                ? (typeof chronoIssues[0] === 'string' ? chronoIssues[0] : chronoIssues[0].message)
                : 'The certification programme has no valid next audit / recertification date after the current audit.';
            results.blockers.push(item(
                'B9',
                'blocker',
                'programme',
                msg,
                'ReportStats.buildProgramme',
                'Correct the certificate expiry date or the certification programme stage dates before issuing.'
            ));
        } catch (_e) { /* skip */ }
    }

    // B10: no certification recommendation can be resolved from anywhere.
    function checkB10MissingRecommendation(input, results) {
        const { report, stats } = input;
        const manualRec = trim(report && report.recommendation);
        const narrative = narrativeFields(report);
        let derived = '';
        try {
            if (stats && stats.recommendation) derived = stats.recommendation;
        } catch (_e) { /* ignore */ }
        if (manualRec || derived || trim(narrative.conclusion)) return;
        results.blockers.push(item(
            'B10',
            'blocker',
            'recommendation',
            'No certification recommendation could be resolved (report.recommendation, ReportStats recommendation, and conclusion are all empty).',
            'report.recommendation / ReportStats.build().recommendation / report.conclusion',
            'Set an explicit recommendation, or ensure ReportStats.build() / recommendationText produces one before issuing.'
        ));
    }

    // ── Warning rules ────────────────────────────────────────────────────────

    function checkW1StrengthNcOverlap(ncrs, report, results) {
        const narrative = narrativeFields(report);
        const strengthsText = (narrative.executiveSummary + '\n' + narrative.positiveObservations).toLowerCase();
        if (!strengthsText.trim()) return;
        const clausesSeen = new Set();
        ncrs.forEach((ncr) => {
            const clause = trim(ncr.clause);
            if (!clause || clausesSeen.has(clause)) return;
            // Match the clause number as a standalone token to avoid partial-number false positives.
            const re = new RegExp('(^|[^0-9.])' + clause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^0-9]|$)');
            if (re.test(strengthsText)) {
                clausesSeen.add(clause);
                results.warnings.push(item(
                    'W1-' + clause,
                    'warning',
                    'narrative',
                    `Clause "${clause}" appears both in the open NC list and in strengths-related narrative (Executive Summary / Positive Observations).`,
                    'report.executiveSummary / positiveObservations',
                    'Verify wording distinguishes the strength from the open NC.'
                ));
            }
        });
    }

    function checkW2RiskWithoutAssessment(ncrs, report, results) {
        const annexes = report && report.reportConfig && report.reportConfig.annexes;
        const riskEnabled = !!(annexes && (annexes.risk || annexes.riskAnnex || annexes.riskAssessment));
        if (!riskEnabled) return;
        ncrs.forEach((ncr, idx) => {
            if (ncr.riskLikelihood != null && ncr.riskImpact != null) return;
            results.warnings.push(item(
                'W2-' + idx,
                'warning',
                'risk',
                `Finding on clause "${ncr.clause || '(no clause)'}" is missing riskLikelihood/riskImpact while the risk annex is enabled.`,
                ncr._source === 'manual' ? 'manual NCR register' : 'checklist finding',
                'Risk ratings are derived indicators; no formal risk assessment recorded.'
            ));
        });
    }

    function checkW3DepartmentPlaceholder(ncrs, results) {
        ncrs.forEach((ncr, idx) => {
            if (lower(ncr.department) !== 'general') return;
            results.warnings.push(item(
                'W3-' + idx,
                'warning',
                'findings',
                `Finding on clause "${ncr.clause || '(no clause)'}" has department set to the placeholder value "General".`,
                ncr._source === 'manual' ? 'manual NCR register' : 'checklist finding',
                'Assign the specific department/function responsible for this finding.'
            ));
        });
    }

    function checkW4AutoGeneratedRCA(report, results) {
        const rcaEnabled = !!(report && report.reportConfig && report.reportConfig.rcaSection);
        if (!rcaEnabled) return;
        const registerAll = safeArr(global.state && global.state.ncrs);
        const clientKey = report && report.clientId != null ? String(report.clientId) : null;
        const linked = registerAll.filter((n) => {
            if (!n) return false;
            if (report && report.planId != null && n.auditId != null && String(n.auditId) === String(report.planId)) return true;
            if (clientKey && n.clientId != null && String(n.clientId) === clientKey) return true;
            return false;
        });
        linked.forEach((rec) => {
            if (rec.rootCause) return; // has an entry
            results.warnings.push(item(
                'W4-' + (rec.id || rec.ncrNumber || Math.random()),
                'warning',
                'capa',
                `CAPA register record ${rec.ncrNumber || rec.id || ''} has no root cause entry while the RCA section is enabled on this report.`,
                'window.state.ncrs',
                'Ensure the auditee/auditor enters a root cause rather than leaving it rule-generated or blank.'
            ));
        });
    }

    function checkW5AddressInconsistency(input, results) {
        const { client, auditPlan, report, certificate } = input;
        try {
            if (global.DataService && typeof global.DataService.checkAddressConsistency === 'function') {
                const issues = global.DataService.checkAddressConsistency({ client, auditPlan, report, certificate }) || [];
                issues.forEach((iss, idx) => {
                    // A full city-level mismatch (the audit plan location doesn't
                    // reference the master site's city at all) is a distinct,
                    // more severe warning than a generic address-format drift —
                    // kept out of the plain W5-N sequence and carrying all three
                    // recorded values (site master / plan / report).
                    if (iss.code === 'city_mismatch') {
                        results.warnings.push(item(
                            'W5c-' + idx,
                            'warning',
                            'client-data',
                            iss.message || `City-level address mismatch detected for field "${iss.field}".`,
                            'DataService.checkAddressConsistency',
                            `Confirm the correct audit site: site master "${iss.siteMaster}" vs audit plan "${iss.plan}" vs report "${iss.report || '(not recorded)'}".`
                        ));
                        return;
                    }
                    results.warnings.push(item(
                        'W5-' + idx,
                        'warning',
                        'client-data',
                        iss.message || `Address inconsistency detected for field "${iss.field}".`,
                        'DataService.checkAddressConsistency',
                        'Verify the site/report/certificate address matches the master client record (client.sites[0]).'
                    ));
                });
            }
        } catch (_e) { /* skip on error — defensive consumption */ }
    }

    function checkW6UnreviewedAIContent(report, results) {
        safeArr(report && report.checklistProgress).forEach((it, idx) => {
            if (!it || it._aiGenerated !== true || it._auditorConfirmed === true) return;
            results.warnings.push(item(
                'W6-item-' + idx,
                'warning',
                'ai-content',
                `Checklist item at index ${idx} contains AI-generated text that has not been confirmed by the auditor.`,
                'checklistProgress[].{_aiGenerated,_auditorConfirmed}',
                'Review and confirm the AI-drafted text before issuing.'
            ));
        });
        const aiContent = (report && report.aiContent) || {};
        Object.keys(aiContent).forEach((key) => {
            const entry = aiContent[key];
            if (!entry || entry.status === 'approved') return;
            results.warnings.push(item(
                'W6-' + key,
                'warning',
                'ai-content',
                `AI-generated content for "${key}" has not been approved (status: ${entry.status || 'unknown'}).`,
                'report.aiContent',
                'Review and approve this AI-generated content before issuing.'
            ));
        });
    }

    // W7: an observation carries a stated pseudo-criterion (an internal
    // FOCUS/SURV/ORG/DOC tracking reference) with no criterionRef resolved —
    // advisory-severity version of B1, kept as a warning since observations
    // don't block issuance the way major/minor findings do.
    function checkW7ObservationPseudoCriterion(report, results) {
        allObservations(report).forEach((obs, idx) => {
            if (trim(obs.criterionRef)) return;
            if (!FOCUS_CLAUSE_RE.test(trim(obs.clause))) return;
            results.warnings.push(item(
                'W7-' + idx,
                'warning',
                'findings',
                `Observation on internal reference "${obs.clause}" has a stated pseudo-criterion but no resolved criterionRef.`,
                'checklistProgress[].observation',
                'Resolve the observation to a real standard clause via criterionRef, or leave the reference unclaused.'
            ));
        });
    }

    // W9: audit coverage below the 70% sampling-sufficiency threshold. (W8 is
    // already used by checkB5RecommendationMismatch.)
    function checkW9LowCoverage(stats, results) {
        if (!stats || stats.coveragePct == null || stats.coveragePct === undefined) return;
        if (Number(stats.coveragePct) >= 70) return;
        results.warnings.push(item(
            'W9',
            'warning',
            'coverage',
            `Audit coverage is ${stats.coveragePct}%, below the 70% sampling-sufficiency threshold.`,
            'ReportStats.build().coveragePct',
            'Confirm sampling was sufficient, or complete outstanding checklist items before issuing.'
        ));
    }

    // ── Phase A rules: one authoritative dataset -> every report section ─────
    // These enforce that what the printed report SAYS agrees with the validated
    // findings dataset, and that internal machinery never reaches the client.

    // Text an auditor wrote that is printed verbatim in the client report.
    function clientFacingComments(report) {
        return safeArr(report && report.checklistProgress)
            .map((i) => trim(i && (i.comment || i.ncrDescription)))
            .filter(Boolean);
    }

    // Internal machinery that must never appear in a client-facing document:
    // system provenance captions, AI/mapping confidence, defensibility scoring.
    const INTERNAL_METADATA_PATTERNS = [
        /system-derived/i,
        /mapping confidence/i,
        /defensibility/i,
        /\bAI[-\s]?(generated|confidence|suggested)\b/i,
        /confidence\s*[:=]\s*(high|medium|low)\b/i
    ];

    function checkB11InternalMetadata(report, results) {
        const narrative = narrativeFields(report);
        Object.keys(narrative).forEach((key) => {
            const text = narrative[key];
            if (!text) return;
            const hit = INTERNAL_METADATA_PATTERNS.find((re) => re.test(text));
            if (!hit) return;
            const phrase = (text.match(hit) || [''])[0];
            results.blockers.push(item(
                'B11-' + key,
                'blocker',
                'narrative',
                `Narrative (${key}) exposes internal system metadata ("${phrase}") in client-facing text.`,
                'report.' + key,
                'Remove the internal caption — provenance, AI/mapping confidence and defensibility scoring are internal QA data, not client report content.'
            ));
        });
    }

    // An affirmative claim of on-site activity. Negated mentions ("no on-site
    // verification was performed") are legitimate on a remote audit, so the
    // preceding words are checked before flagging.
    const ONSITE_CLAIM_RE = /\b(?:on[-\s]?site\s+(?:observation|verification|visit|inspection|walkthrough|tour|review|audit)|observation of activities and work environment on[-\s]?site|conducted on[-\s]?site|attended on[-\s]?site)\b/gi;
    const ONSITE_NEGATION_RE = /\b(?:no|not|without|never|excluded|remote(?:ly)?|in lieu of|instead of)\b[^.]{0,40}$/i;

    function checkB12AuditMethodContradiction(input, results) {
        const { report, auditPlan } = input;
        const method = lower((auditPlan && auditPlan.auditMethod) || (report && report.auditMethod));
        if (!method || !/remote/.test(method) || /hybrid/.test(method)) return;
        const narrative = narrativeFields(report);
        Object.keys(narrative).forEach((key) => {
            const text = narrative[key];
            if (!text) return;
            let m;
            ONSITE_CLAIM_RE.lastIndex = 0;
            while ((m = ONSITE_CLAIM_RE.exec(text)) !== null) {
                const preceding = text.slice(Math.max(0, m.index - 60), m.index);
                if (ONSITE_NEGATION_RE.test(preceding)) continue;
                results.blockers.push(item(
                    'B12-' + key,
                    'blocker',
                    'narrative',
                    `Audit method is recorded as Remote, but the narrative (${key}) claims on-site activity ("${trim(m[0])}").`,
                    'report.' + key + ' vs auditPlan.auditMethod',
                    'State the methodology actually used — interviews, remote review of documented information and objective evidence, and remote observation through ICT where applicable.'
                ));
                break; // one finding per narrative field is enough to act on
            }
        });
    }

    // Counts asserted in prose must match the validated findings dataset.
    // Observations and OFIs are distinct classifications and are never summed.
    // ReportStats.build() returns counts NESTED (resultCounts.majorNC,
    // advisories.observation), while callers that assemble their own summary
    // object use flat names (majorNC, observationCount). Reading only the flat
    // names against a built dataset yields 0 for everything, which would make
    // B13 fire a false blocker on every report that states any count — so both
    // shapes are read, and a dataset carrying neither is treated as
    // "cannot verify" rather than "everything is zero".
    function normalizedCounts(stats) {
        if (!stats) return null;
        const rc = stats.resultCounts || {};
        const adv = stats.advisories || {};
        const pick = (flat, nested) => {
            const f = Number(flat);
            if (flat != null && !isNaN(f)) return f;
            const n = Number(nested);
            if (nested != null && !isNaN(n)) return n;
            return null;
        };
        const major = pick(stats.majorNC, rc.majorNC);
        const minor = pick(stats.minorNC, rc.minorNC);
        const observations = pick(stats.observationCount, adv.observation);
        const ofi = pick(stats.ofiCount, adv.ofi);
        if (major === null && minor === null && observations === null && ofi === null) return null;
        return { major: major || 0, minor: minor || 0, observations: observations || 0, ofi: ofi || 0 };
    }

    function checkB13NarrativeCounts(input, results) {
        const { report, stats } = input;
        const counts = normalizedCounts(stats);
        if (!counts) return;
        const ncTotal = counts.major + counts.minor;
        const expectations = [
            { re: /(\d+)\s+(?:minor\s+)?non-?conformit(?:y|ies)/gi, actual: ncTotal, label: 'nonconformities' },
            { re: /(\d+)\s+opportunit(?:y|ies)\s+for\s+improvement/gi, actual: counts.ofi, label: 'opportunities for improvement' },
            { re: /(\d+)\s+observations?\b/gi, actual: counts.observations, label: 'observations' }
        ];
        const narrative = narrativeFields(report);
        Object.keys(narrative).forEach((key) => {
            const text = narrative[key];
            if (!text) return;
            expectations.forEach((exp) => {
                let m;
                exp.re.lastIndex = 0;
                while ((m = exp.re.exec(text)) !== null) {
                    const stated = parseInt(m[1], 10);
                    if (isNaN(stated) || stated === exp.actual) continue;
                    results.blockers.push(item(
                        'B13-' + key + '-' + exp.label.replace(/\s+/g, '-'),
                        'blocker',
                        'narrative',
                        `Narrative (${key}) states ${stated} ${exp.label}, but the validated findings dataset records ${exp.actual}.`,
                        'report.' + key + ' vs ReportStats',
                        'Restate the counts from the audit dataset. Observations and opportunities for improvement are separate classifications and must not be combined.'
                    ));
                    break;
                }
            });
        });
    }

    // Every NC must be attributable to a real clause, otherwise the Clause Area
    // Performance table cannot account for it and its totals silently disagree
    // with the report's own NC count.
    function checkB14ClauseReconciliation(ncrs, results) {
        if (!ncrs.length) return;
        const unattributable = ncrs.filter((ncr) => {
            const resolved = trim(ncr.criterionRef) || trim(ncr.clause);
            if (!resolved) return true;
            return !trim(ncr.criterionRef) && FOCUS_CLAUSE_RE.test(trim(ncr.clause));
        });
        if (!unattributable.length) return;
        results.blockers.push(item(
            'B14',
            'blocker',
            'findings',
            `Clause-level totals cannot reconcile: ${unattributable.length} of ${ncrs.length} nonconformity(ies) have no real standard clause, so the Clause Area Performance table cannot account for them.`,
            'checklistProgress[] / report.ncrs[] vs clause performance table',
            'Assign a validated standard clause to every nonconformity so the sum of clause-level NCs equals the report NC total.'
        ));
    }

    // Controlled organization data must not be contradicted by field notes.
    function controlledEmployeeCount(client) {
        if (!client) return null;
        const siteTotal = safeArr(client.sites).reduce((acc, s) => acc + (parseInt(s && s.employees, 10) || 0), 0);
        if (siteTotal > 0) return siteTotal;
        const direct = parseInt(client.employees, 10);
        return isNaN(direct) ? null : direct;
    }

    // Headcounts asserted anywhere in the audit's own text. Tolerates the
    // misspellings common in field notes ("8 now total emplyees").
    function statedEmployeeCounts(report) {
        const re = /\b(\d{1,6})\s+(?:now\s+)?(?:total\s+)?empl\w*/gi;
        const narrative = narrativeFields(report);
        const sources = clientFacingComments(report)
            .concat(Object.keys(narrative).map((k) => narrative[k]));
        const found = [];
        sources.forEach((text) => {
            if (!text) return;
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(text)) !== null) {
                const n = parseInt(m[1], 10);
                if (!isNaN(n) && found.indexOf(n) === -1) found.push(n);
            }
        });
        return found;
    }

    function checkW12EmployeeCount(report, client, results) {
        const controlled = controlledEmployeeCount(client);
        if (!controlled) return;
        statedEmployeeCounts(report).forEach((stated) => {
            if (stated === controlled) return;
            results.warnings.push(item(
                'W12-' + stated,
                'warning',
                'client-data',
                `Audit evidence refers to ${stated} employees, but the controlled organization profile records ${controlled}.`,
                'checklistProgress[].comment / report narrative vs client.sites[].employees',
                'Confirm the current headcount with the auditee and update the organization profile, or correct the note — controlled organization data and the report must agree.'
            ));
        });
    }

    // W16 — "Changes Since Last Audit" must not assert stability while the
    // audit's own evidence shows a controlled organization datum has moved.
    // The no-changes sentence is a RENDER-TIME DEFAULT: when the auditor leaves
    // the field empty the client still reads "No significant changes...", so an
    // empty field counts as the assertion having been made.
    const NO_CHANGES_RE = /no\s+(significant\s+)?changes?\b/i;

    function checkW16ChangesContradiction(report, client, results) {
        const stated = trim(report && report.changesSinceLastAudit);
        const assertsNoChanges = !stated || NO_CHANGES_RE.test(stated);
        if (!assertsNoChanges) return;

        const controlled = controlledEmployeeCount(client);
        if (!controlled) return;
        const differing = statedEmployeeCounts(report).filter((n) => n !== controlled);
        if (!differing.length) return;

        results.warnings.push(item(
            'W16',
            'warning',
            'changes',
            `Changes Since Last Audit reports no significant change, but audit evidence indicates the headcount may have moved from ${controlled} to ${differing[0]}.`,
            'report.changesSinceLastAudit vs audit evidence / client organization profile',
            'Whether a change is significant is the auditor\'s determination — confirm the headcount and either record the change or confirm it is not significant.'
        ));
    }

    // Design/development activity in the certified scope alongside an 8.3
    // exclusion is a scope/applicability conflict the auditor must justify.
    const DESIGN_SCOPE_RE = /\b(design|development|engineering|new product)\b/i;
    const DESIGN_EXCLUDED_RE = /\bno\s+design\b|design\s*(&|and)?\s*development\s+(is\s+)?not\s+applicable|not\s+applicable[^.]{0,20}\bdesign\b/i;

    function checkW13DesignApplicability(report, client, auditPlan, results) {
        const scopeText = [
            client && client.certificationScope,
            client && client.industry,
            safeArr(client && client.goodsServices).map((g) => (g && (g.name || g)) || '').join(', '),
            auditPlan && auditPlan.scope,
            report && report.scope
        ].filter(Boolean).join(' ');
        if (!DESIGN_SCOPE_RE.test(scopeText)) return;

        const excludedInComments = clientFacingComments(report).some((c) => DESIGN_EXCLUDED_RE.test(c));
        const excludedInChecklist = safeArr(report && report.checklistProgress).some((i) => {
            if (!i) return false;
            const cl = trim(i.clause) || trim(i.criterionRef);
            return /^8\.3(\.|$)/.test(cl) && /^(na|n\/a|not[_\s-]?applicable|excluded)$/i.test(trim(i.status));
        });
        const excludedInScope = DESIGN_EXCLUDED_RE.test(trim(report && report.exclusions));
        if (!excludedInComments && !excludedInChecklist && !excludedInScope) return;

        results.warnings.push(item(
            'W13',
            'warning',
            'applicability',
            'Potential scope/applicability conflict: the certified activities indicate design and development activity while clause 8.3 has been treated as not applicable.',
            'client.certificationScope / goodsServices vs clause 8.3 applicability',
            'Record the auditor\'s explicit justification for the exclusion, or assess clause 8.3 — applicability is an auditor decision and cannot be inferred automatically.'
        ));
    }

    // A surveillance/recertification report must say something meaningful about
    // the previous cycle's findings; a blank or dash is not a status.
    const EMPTY_STATUS_RE = /^(—|-{1,3}|n\/?a|none|nil|\.)?$/i;

    function checkW14PreviousFindings(report, auditPlan, results) {
        const auditTypeStr = lower((auditPlan && auditPlan.auditType) || (report && report.auditType));
        if (!/surveillance|recert|follow/.test(auditTypeStr)) return;
        const status = trim(report && report.previousFindingsStatus);
        if (status && !EMPTY_STATUS_RE.test(status)) return;
        results.warnings.push(item(
            'W14',
            'warning',
            'previous-findings',
            'Previous Findings Status is blank on a surveillance/recertification report, where the status of the previous cycle\'s nonconformities is expected.',
            'report.previousFindingsStatus',
            'State the actual position — no previous nonconformities requiring follow-up, previous NCs verified and closed, previous NC(s) remain open, or records unavailable for reviewer attention.'
        ));
    }

    // The next audit event must be described as the stage the certification
    // programme actually schedules next.
    function checkW15NextAuditType(input, results) {
        const { report, auditPlan, client } = input;
        try {
            if (!(global.ReportStats && typeof global.ReportStats.buildProgramme === 'function')) return;
            const allReports = safeArr(global.state && global.state.auditReports);
            const programme = global.ReportStats.buildProgramme({ client, auditPlan, report, allReports });
            const nextLabel = lower((programme && programme.nextAudit && (programme.nextAudit.label || programme.nextAudit.type)) || '');
            if (!/recert/.test(nextLabel)) return;
            const narrative = narrativeFields(report);
            Object.keys(narrative).forEach((key) => {
                const text = narrative[key];
                if (!text || !/next\s+surveillance\s+audit/i.test(text)) return;
                results.warnings.push(item(
                    'W15-' + key,
                    'warning',
                    'programme',
                    `Narrative (${key}) refers to the next event as a surveillance audit, but the certification programme schedules recertification next.`,
                    'report.' + key + ' vs ReportStats.buildProgramme',
                    'Refer to the next audit by the stage the certification cycle actually schedules.'
                ));
            });
        } catch (_e) { /* skip */ }
    }

    // ── Editorial rules ─────────────────────────────────────────────────────
    // Presentation-only issues that never block issuance: they mark text that
    // still reads as a raw field note rather than a client-facing statement.
    const RAW_NOTE_MAX_WORDS = 6;
    const EDITORIAL_SAMPLE_LIMIT = 8;

    function looksLikeRawNote(text) {
        const t = trim(text);
        if (!t || t.length > 120) return false;
        const words = t.split(/\s+/).filter(Boolean);
        if (words.length > RAW_NOTE_MAX_WORDS) return false;
        // A short line that never resolves into a sentence.
        return !/[.!?]$/.test(t) || /^[a-z]/.test(t);
    }

    function checkE1RawAuditorNotes(report, results) {
        let emitted = 0;
        safeArr(report && report.checklistProgress).forEach((i, idx) => {
            if (emitted >= EDITORIAL_SAMPLE_LIMIT) return;
            const text = trim(i && (i.comment || i.ncrDescription));
            if (!looksLikeRawNote(text)) return;
            emitted++;
            results.editorial.push(item(
                'E1-' + idx,
                'editorial',
                'narrative',
                `Checklist item ${idx + 1} prints the raw field note "${text}" as client-facing evidence.`,
                'checklistProgress[' + idx + '].comment',
                'Rewrite as a client-facing evidence statement describing what was reviewed and what it demonstrated, without adding facts the evidence does not support.'
            ));
        });
    }

    // ── Advisory classification integrity (#16) and CB impartiality (#17) ────

    // Every advisory the report carries, with the classification it was filed
    // under. Observations and OFIs are distinct classifications: an Observation
    // is a noteworthy audit condition that is not a nonconformity; an OFI is a
    // potential improvement the organization may consider.
    function advisoryItems(report) {
        const out = [];
        safeArr(report && report.checklistProgress).forEach((i, idx) => {
            if (!i || lower(i.status) !== 'nc') return;
            const t = lower(i.ncrType);
            if (t !== 'observation' && t !== 'ofi') return;
            const text = trim(i.comment || i.ncrDescription);
            if (text) out.push({ kind: t, text, idx, label: t === 'ofi' ? 'OFI' : 'Observation' });
        });
        return out;
    }

    // W17 — an advisory whose narrative contradicts the classification it was
    // filed under: an Observation that describes itself as an opportunity for
    // improvement (or the reverse) reports the same thing under two names.
    const CALLS_ITSELF_OFI_RE = /\bopportunit(?:y|ies)\s+for\s+improvement\b/i;
    const CALLS_ITSELF_OBSERVATION_RE = /\b(?:an?\s+)?observation\s+(?:was|is)\s+(?:made|noted|raised|identified)\b/i;

    function checkW17AdvisoryClassification(report, results) {
        advisoryItems(report).forEach((a) => {
            const misfiled = a.kind === 'observation'
                ? CALLS_ITSELF_OFI_RE.test(a.text)
                : CALLS_ITSELF_OBSERVATION_RE.test(a.text);
            if (!misfiled) return;
            const claimed = a.kind === 'observation' ? 'an opportunity for improvement' : 'an observation';
            results.warnings.push(item(
                'W17-' + a.idx,
                'warning',
                'findings',
                `An item filed as ${a.label} describes itself as ${claimed}, so the same issue is presented under two classifications.`,
                'checklistProgress[' + a.idx + ']',
                'Either reclassify the item or reword it so the narrative matches the classification — an Observation is a noteworthy condition, an OFI is a potential improvement.'
            ));
        });
    }

    // W18 — substantially the same issue raised under more than one
    // classification. Jaccard overlap on meaningful tokens: no dependency, and
    // deliberately conservative so ordinary shared audit vocabulary does not
    // trip it — this asks the auditor to look, it does not merge anything.
    const SIMILARITY_STOPWORDS = new Set([
        'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'at', 'by', 'with', 'is',
        'was', 'were', 'are', 'be', 'been', 'that', 'this', 'it', 'as', 'not', 'no', 'has', 'have',
        'had', 'but', 'from', 'their', 'its', 'organization', 'organisation', 'audit', 'auditor'
    ]);
    const SIMILARITY_THRESHOLD = 0.6;
    const MIN_SIMILARITY_TOKENS = 5;

    function meaningfulTokens(text) {
        return new Set(
            lower(text).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
                .filter((w) => w.length > 2 && !SIMILARITY_STOPWORDS.has(w))
        );
    }

    function jaccard(a, b) {
        let shared = 0;
        a.forEach((t) => { if (b.has(t)) shared++; });
        const union = a.size + b.size - shared;
        return union > 0 ? shared / union : 0;
    }

    function checkW18DuplicateAdvisories(report, ncrs, results) {
        const entries = advisoryItems(report).concat(
            ncrs.map((n, idx) => ({
                kind: 'nc', label: 'nonconformity', idx: 'nc-' + idx, text: trim(n.comment)
            })).filter((n) => n.text)
        ).map((e) => Object.assign({}, e, { tokens: meaningfulTokens(e.text) }))
            .filter((e) => e.tokens.size >= MIN_SIMILARITY_TOKENS);

        const reported = {};
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                const a = entries[i];
                const b = entries[j];
                if (a.kind === b.kind) continue; // same classification is not a cross-filing
                if (jaccard(a.tokens, b.tokens) < SIMILARITY_THRESHOLD) continue;
                const key = a.idx + '|' + b.idx;
                if (reported[key]) continue;
                reported[key] = true;
                results.warnings.push(item(
                    'W18-' + a.idx + '-' + b.idx,
                    'warning',
                    'findings',
                    `The same issue appears to be reported both as ${a.label} and as ${b.label}.`,
                    'checklistProgress[] / report.ncrs[]',
                    'Confirm these are genuinely separate issues — the same finding should not be reported twice under different classifications.'
                ));
            }
        }
    }

    // W19 — a certification body determines conformity; it does not design the
    // solution. Prescribing the corrective action compromises impartiality, so
    // advisories must stay neutral ("the organization may consider ...").
    const PRESCRIPTIVE_PATTERNS = [
        /\b(?:must|shall|should|needs?\s+to|is\s+required\s+to|has\s+to)\s+(?:implement|establish|create|develop|introduce|adopt|purchase|procure|hire|appoint|revise|rewrite|redesign|install|deploy)\b/i,
        /\bwe\s+recommend\b/i,
        /\byou\s+(?:should|must|need\s+to)\b/i,
        /\bit\s+is\s+recommended\s+that\s+the\s+organi[sz]ation\s+(?:implement|establish|create|develop|adopt)\b/i
    ];

    function checkW19ConsultancyLanguage(report, results) {
        advisoryItems(report).forEach((a) => {
            const hit = PRESCRIPTIVE_PATTERNS.find((re) => re.test(a.text));
            if (!hit) return;
            const phrase = trim((a.text.match(hit) || [''])[0]);
            results.warnings.push(item(
                'W19-' + a.idx,
                'warning',
                'findings',
                `${a.label} prescribes a solution ("${phrase}"), which crosses from auditing into consultancy.`,
                'checklistProgress[' + a.idx + ']',
                'State the condition observed and leave the remedy to the organization — neutral wording such as "the organization may consider ..." preserves certification-body impartiality.'
            ));
        });
    }

    // I1-I4 information items

    function checkInformation(report, results) {
        const annexes = (report && report.reportConfig && report.reportConfig.annexes) || {};
        if (annexes.analytics) {
            results.information.push(item('I1', 'info', 'annexes', 'Analytics annex is enabled for this report.', 'report.reportConfig.annexes.analytics', 'No action required.'));
        }
        if (annexes.scores || annexes.showScores) {
            results.information.push(item('I2', 'info', 'annexes', 'Scores are displayed in the analytics annex.', 'report.reportConfig.annexes', 'No action required.'));
        }
        if (annexes.maturity || annexes.maturityAnalytics) {
            results.information.push(item('I3', 'info', 'annexes', 'Maturity analytics are displayed for this report.', 'report.reportConfig.annexes', 'No action required.'));
        }
        const disabledCount = Object.keys(annexes).filter((k) => annexes[k] === false).length;
        if (disabledCount > 0) {
            results.information.push(item('I4', 'info', 'annexes', `${disabledCount} report section(s) are disabled.`, 'report.reportConfig.annexes', 'Confirm this is intentional before issuing.'));
        }
    }

    // ── Main entry point ────────────────────────────────────────────────────

    function check(input) {
        const safeInput = input || {};
        const report = safeInput.report || {};
        const client = safeInput.client || null;
        const auditPlan = safeInput.auditPlan || null;
        const stats = safeInput.stats || null;

        // `editorial` is presentation-only (spelling, raw notes, formatting): it
        // is reported for correction but never blocks issuance.
        const results = { blockers: [], warnings: [], information: [], editorial: [] };
        const ncrs = allNCRs(report);

        try { checkB1FocusCriterion(ncrs, results); } catch (_e) { /* skip */ }
        try { checkB1NarrativeInternalRef(report, results); } catch (_e) { /* skip */ }
        try { checkB2Chronology({ report, auditPlan, client, stats }, results); } catch (_e) { /* skip */ }
        try { checkB3MissingEvidence(ncrs, results); } catch (_e) { /* skip */ }
        try { checkB4MissingCriterion(ncrs, results); } catch (_e) { /* skip */ }
        try { checkB5RecommendationMismatch({ report, auditPlan, stats }, results); } catch (_e) { /* skip */ }
        try { checkB6FinancialClaims(report, results); } catch (_e) { /* skip */ }
        try { checkB6BannedPhrases(report, results); } catch (_e) { /* skip */ }
        try { checkB7RecurringWithoutHistory(report, client, results); } catch (_e) { /* skip */ }
        try { checkB8MissingStandard(report, auditPlan, ncrs, results); } catch (_e) { /* skip */ }
        try { checkB9NextAuditChronology({ report, auditPlan, client }, results); } catch (_e) { /* skip */ }
        try { checkB10MissingRecommendation({ report, stats }, results); } catch (_e) { /* skip */ }

        try { checkW1StrengthNcOverlap(ncrs, report, results); } catch (_e) { /* skip */ }
        try { checkW2RiskWithoutAssessment(ncrs, report, results); } catch (_e) { /* skip */ }
        try { checkW3DepartmentPlaceholder(ncrs, results); } catch (_e) { /* skip */ }
        try { checkW4AutoGeneratedRCA(report, results); } catch (_e) { /* skip */ }
        try { checkW5AddressInconsistency({ client, auditPlan, report, certificate: safeInput.certificate }, results); } catch (_e) { /* skip */ }
        try { checkW6UnreviewedAIContent(report, results); } catch (_e) { /* skip */ }
        try { checkW7ObservationPseudoCriterion(report, results); } catch (_e) { /* skip */ }
        try { checkW9LowCoverage(stats, results); } catch (_e) { /* skip */ }
        try { checkW10MaturityLanguage(report, results); } catch (_e) { /* skip */ }
        try { checkW11NarrativeLocation(report, client, results); } catch (_e) { /* skip */ }

        // Phase A — report says what the validated dataset says, and internal
        // machinery stays out of the client document.
        try { checkB11InternalMetadata(report, results); } catch (_e) { /* skip */ }
        try { checkB12AuditMethodContradiction({ report, auditPlan }, results); } catch (_e) { /* skip */ }
        try { checkB13NarrativeCounts({ report, stats }, results); } catch (_e) { /* skip */ }
        try { checkB14ClauseReconciliation(ncrs, results); } catch (_e) { /* skip */ }
        try { checkW12EmployeeCount(report, client, results); } catch (_e) { /* skip */ }
        try { checkW13DesignApplicability(report, client, auditPlan, results); } catch (_e) { /* skip */ }
        try { checkW14PreviousFindings(report, auditPlan, results); } catch (_e) { /* skip */ }
        try { checkW15NextAuditType({ report, auditPlan, client }, results); } catch (_e) { /* skip */ }
        try { checkW16ChangesContradiction(report, client, results); } catch (_e) { /* skip */ }
        try { checkW17AdvisoryClassification(report, results); } catch (_e) { /* skip */ }
        try { checkW18DuplicateAdvisories(report, ncrs, results); } catch (_e) { /* skip */ }
        try { checkW19ConsultancyLanguage(report, results); } catch (_e) { /* skip */ }
        try { checkE1RawAuditorNotes(report, results); } catch (_e) { /* skip */ }

        try { checkInformation(report, results); } catch (_e) { /* skip */ }

        const status = results.blockers.length === 0 ? 'READY FOR AUDITOR REVIEW' : 'BLOCKED';
        return {
            blockers: results.blockers,
            warnings: results.warnings,
            information: results.information,
            editorial: results.editorial,
            status
        };
    }

    function checkById(reportId) {
        try {
            const report = (global.DataService && typeof global.DataService.findAuditReport === 'function')
                ? global.DataService.findAuditReport(reportId)
                : safeArr(global.state && global.state.auditReports).find((r) => String(r.id) === String(reportId));
            if (!report) {
                return { blockers: [item('B0', 'blocker', 'report', 'Report not found.', 'window.state.auditReports', 'Verify the report ID.')], warnings: [], information: [], editorial: [], status: 'BLOCKED' };
            }

            const planId = report.planId || report.audit_plan_id;
            const auditPlan = planId && global.DataService && typeof global.DataService.findAuditPlan === 'function'
                ? global.DataService.findAuditPlan(planId)
                : safeArr(global.state && global.state.auditPlans).find((p) => String(p.id) === String(planId));

            // Client resolution must not fail quietly: an unresolved client has
            // no certificates, which made the chronology rule report "no
            // certificate on file" for clients that plainly have one. Try every
            // identifier the report and its plan carry, by id then by name.
            const clientIds = [report.clientId, auditPlan && auditPlan.clientId].filter((v) => v != null);
            const clientNames = [report.client, report.clientName, auditPlan && auditPlan.client, auditPlan && auditPlan.clientName]
                .map((v) => trim(v)).filter(Boolean);
            let client = null;
            if (global.DataService && typeof global.DataService.findClient === 'function') {
                for (let i = 0; i < clientIds.length && !client; i++) {
                    client = global.DataService.findClient(clientIds[i]);
                }
            }
            if (!client) {
                const clients = safeArr(global.state && global.state.clients);
                client = clients.find((c) => clientIds.some((id) => String(c.id) === String(id)))
                    || clients.find((c) => clientNames.some((n) => trim(c.name).toLowerCase() === n.toLowerCase()))
                    || null;
            }

            let stats = null;
            try {
                if (global.ReportStats && typeof global.ReportStats.build === 'function') {
                    stats = global.ReportStats.build({ report, hydratedProgress: report.checklistProgress || [], auditPlan, client });
                }
            } catch (_e) { stats = null; }

            return check({ report, auditPlan, client, stats });
        } catch (_e) {
            return { blockers: [], warnings: [], information: [], editorial: [], status: 'READY FOR AUDITOR REVIEW' };
        }
    }

    global.ReportIntegrity = { check, checkById };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.ReportIntegrity;
    }
})(typeof window !== 'undefined' ? window : globalThis);
