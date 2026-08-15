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

    function item(id, severity, section, message, source, suggestion) {
        return { id, severity, section, message, source, suggestion };
    }

    // ── Shared helpers ──────────────────────────────────────────────────────

    const FOCUS_CLAUSE_RE = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;
    const CURRENCY_RE = /[$€£]\s?\d|\b\d+(\.\d+)?\s?(million|M)\b.*(revenue|cost|penalt)/i;
    const RECURRING_RE = /recurring|repeated weakness|persistent/i;
    const GRANTING_RE = /recommended for certification/i;

    // Narrative fields that flow through to the printed report.
    function narrativeFields(report) {
        const r = report || {};
        return {
            executiveSummary: r.executiveSummary || '',
            positiveObservations: r.positiveObservations || '',
            ofi: Array.isArray(r.ofi) ? r.ofi.join('\n') : (r.ofi || ''),
            conclusion: r.editedConclusion || r.conclusion || '',
            previousFindingsStatus: r.previousFindingsStatus || ''
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
                comment: i.comment,
                department: i.department,
                riskLikelihood: i.riskLikelihood,
                riskImpact: i.riskImpact,
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

    function hasEvidence(ncr) {
        if (!ncr) return false;
        const textEvidence = trim(ncr.evidence) || (Array.isArray(ncr.evidence) && ncr.evidence.length > 0);
        const hasImage = !!ncr.evidenceImage || (Array.isArray(ncr.evidenceImages) && ncr.evidenceImages.length > 0);
        return !!(textEvidence || hasImage);
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
                'Set the finding\'s criterionRef to the actual clause of the standard being audited.'
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
                'Assign the specific standard clause this finding relates to.'
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

        const results = { blockers: [], warnings: [], information: [] };
        const ncrs = allNCRs(report);

        try { checkB1FocusCriterion(ncrs, results); } catch (_e) { /* skip */ }
        try { checkB2Chronology({ report, auditPlan, client, stats }, results); } catch (_e) { /* skip */ }
        try { checkB3MissingEvidence(ncrs, results); } catch (_e) { /* skip */ }
        try { checkB4MissingCriterion(ncrs, results); } catch (_e) { /* skip */ }
        try { checkB5RecommendationMismatch({ report, auditPlan, stats }, results); } catch (_e) { /* skip */ }
        try { checkB6FinancialClaims(report, results); } catch (_e) { /* skip */ }
        try { checkB7RecurringWithoutHistory(report, client, results); } catch (_e) { /* skip */ }

        try { checkW1StrengthNcOverlap(ncrs, report, results); } catch (_e) { /* skip */ }
        try { checkW2RiskWithoutAssessment(ncrs, report, results); } catch (_e) { /* skip */ }
        try { checkW3DepartmentPlaceholder(ncrs, results); } catch (_e) { /* skip */ }
        try { checkW4AutoGeneratedRCA(report, results); } catch (_e) { /* skip */ }
        try { checkW5AddressInconsistency({ client, auditPlan, report, certificate: safeInput.certificate }, results); } catch (_e) { /* skip */ }
        try { checkW6UnreviewedAIContent(report, results); } catch (_e) { /* skip */ }

        try { checkInformation(report, results); } catch (_e) { /* skip */ }

        const status = results.blockers.length === 0 ? 'READY FOR AUDITOR REVIEW' : 'BLOCKED';
        return { blockers: results.blockers, warnings: results.warnings, information: results.information, status };
    }

    function checkById(reportId) {
        try {
            const report = (global.DataService && typeof global.DataService.findAuditReport === 'function')
                ? global.DataService.findAuditReport(reportId)
                : safeArr(global.state && global.state.auditReports).find((r) => String(r.id) === String(reportId));
            if (!report) {
                return { blockers: [item('B0', 'blocker', 'report', 'Report not found.', 'window.state.auditReports', 'Verify the report ID.')], warnings: [], information: [], status: 'BLOCKED' };
            }

            const planId = report.planId || report.audit_plan_id;
            const auditPlan = planId && global.DataService && typeof global.DataService.findAuditPlan === 'function'
                ? global.DataService.findAuditPlan(planId)
                : safeArr(global.state && global.state.auditPlans).find((p) => String(p.id) === String(planId));

            let client = null;
            if (global.DataService && typeof global.DataService.findClient === 'function' && report.clientId != null) {
                client = global.DataService.findClient(report.clientId);
            }
            if (!client) {
                client = safeArr(global.state && global.state.clients).find((c) =>
                    (report.clientId != null && String(c.id) === String(report.clientId))
                    || (report.client && c.name === report.client)
                );
            }

            let stats = null;
            try {
                if (global.ReportStats && typeof global.ReportStats.build === 'function') {
                    stats = global.ReportStats.build({ report, hydratedProgress: report.checklistProgress || [], auditPlan, client });
                }
            } catch (_e) { stats = null; }

            return check({ report, auditPlan, client, stats });
        } catch (_e) {
            return { blockers: [], warnings: [], information: [], status: 'READY FOR AUDITOR REVIEW' };
        }
    }

    global.ReportIntegrity = { check, checkById };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.ReportIntegrity;
    }
})(typeof window !== 'undefined' ? window : globalThis);
