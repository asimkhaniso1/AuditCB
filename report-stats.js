/**
 * report-stats.js — Canonical dataset builder for AuditCB-360 audit reports.
 * =============================================================================
 * Standalone, framework-free companion module. Does NOT modify any other
 * file. Provides a single pure, synchronous, never-throwing function that
 * every other report-*.js module (and execution-reporting.js /
 * execution-module-v2.js) can consume as the single source of truth for
 * result counts, coverage/conformity percentages, unique findings,
 * advisories, CAPA rollups, department/clause breakdowns, and headline
 * audit status — instead of every module recounting `hydratedProgress`
 * with its own (and sometimes inconsistent) rules.
 *
 * Public API — window.ReportStats:
 *   build({report, hydratedProgress, auditPlan, client}) -> dataset
 *   version: 1
 *
 * Classification rules (the whole point of this module):
 *   - item.status === '' or missing  -> notAssessed. Never counted as
 *     applicable-assessed, never conforming, never NC.
 *   - item.status === 'na'           -> excluded from BOTH coverage and
 *     conformity denominators entirely.
 *   - item.status === 'nc' with ncrType 'major'/'minor'      -> real NC.
 *   - item.status === 'nc' with ncrType blank/unrecognized   -> counted in
 *     the NC bucket as 'pendingClassification' AND flagged in
 *     `reconciliation` as an unclassified finding.
 *   - item.status === 'nc' with ncrType 'observation'/'ofi'  -> advisory.
 *     Advisories are ASSESSED and ASSESSED-CONFORMING for conformity
 *     purposes (they do not reduce conformityPct), but they are not
 *     literal 'conform' items either — tracked separately.
 *   - item.status === 'conform' (with or without a leftover ncrType)
 *     -> conform. ncrType is ignored in this case.
 *
 *   applicable  = totalItems - na
 *   assessed    = conform + majorNC + minorNC + pendingClassification + advisories.total
 *   coveragePct   = round(assessed / applicable * 100); null if applicable === 0
 *   conformityPct = round((assessed - majorNC - minorNC - pendingClassification) / assessed * 100);
 *                   null if assessed === 0
 *                   (i.e. only real NCs reduce conformity — advisories are
 *                   "conforming with comment")
 * =============================================================================
 */
(function (global) {
    'use strict';

    const round = (n) => Math.round(Number(n) || 0);
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const pct = (num, den) => (den > 0 ? clamp(round((num / den) * 100), 0, 100) : null);
    const safeArr = (a) => (Array.isArray(a) ? a : []);
    const trim = (s) => String(s == null ? '' : s).trim();

    const UNASSIGNED_LABEL = 'Unassigned / Cross-functional';
    function normalizeDeptName(raw) {
        const s = trim(raw);
        if (!s) return UNASSIGNED_LABEL;
        if (/^(unassigned|general|n\/?a|none|other)$/i.test(s)) return UNASSIGNED_LABEL;
        return s;
    }

    function itemHasEvidence(item) {
        return !!(item && (item.evidenceImage || (Array.isArray(item.evidenceImages) && item.evidenceImages.length > 0)));
    }

    function evidenceCount(item) {
        if (!item) return 0;
        if (Array.isArray(item.evidenceImages)) return item.evidenceImages.length;
        return item.evidenceImage ? 1 : 0;
    }

    // Classifies a single checklist item into exactly one bucket.
    // Returns one of: 'notAssessed' | 'na' | 'conform' | 'majorNC' | 'minorNC'
    //                | 'pendingClassification' | 'observation' | 'ofi'
    function classifyItem(item) {
        const status = trim(item && item.status).toLowerCase();
        if (!status) return 'notAssessed';
        if (status === 'na') return 'na';
        if (status === 'conform') return 'conform';
        if (status === 'nc') {
            const t = trim(item && item.ncrType).toLowerCase();
            if (t === 'major') return 'majorNC';
            if (t === 'minor') return 'minorNC';
            if (t === 'observation') return 'observation';
            if (t === 'ofi') return 'ofi';
            return 'pendingClassification';
        }
        // Unrecognized status string — treat conservatively as not assessed
        // rather than guessing a classification that could misstate conformity.
        return 'notAssessed';
    }

    function severityFromBucket(bucket) {
        if (bucket === 'majorNC') return 'major';
        if (bucket === 'minorNC') return 'minor';
        if (bucket === 'pendingClassification') return 'pending_classification';
        return null;
    }

    const CHECKLIST_LEADIN = /^(show|verify|verify that|check|confirm|confirm that|provide|demonstrate|ensure|ensure that|describe|explain|review|observe|inspect|examine|validate|assess)\b\s*(that|whether)?\s*/i;
    function cleanText(raw, maxLen) {
        let text = String(raw == null ? '' : raw);
        text = text.replace(/\s*\[[^\]]*\]\s*/g, ' ');
        text = text.replace(CHECKLIST_LEADIN, '');
        text = text.replace(/\s+/g, ' ').trim();
        text = text.replace(/^[\s,:;.\-]+/, '');
        if (!text) text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
        if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
        if (maxLen && text.length > maxLen) {
            const cut = text.slice(0, maxLen - 1);
            const lastSpace = cut.lastIndexOf(' ');
            text = (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,:;.\-]+$/, '') + '…';
        }
        return text;
    }

    function daysBetween(a, b) {
        const da = new Date(a), db = new Date(b);
        if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
        return Math.round((db.getTime() - da.getTime()) / 86400000);
    }

    // Best-effort audit date window, widened by ±7 days per report-risk.js's
    // linkedCapaRecords convention, used to sanity-bound register matches.
    function auditWindow(report, auditPlan) {
        const baseDate = (report && (report.date || report.createdAt)) || null;
        const startRaw = (auditPlan && (auditPlan.startDate || auditPlan.date)) || baseDate;
        const endRaw = (auditPlan && (auditPlan.endDate || auditPlan.date)) || baseDate;
        let startTime = startRaw ? new Date(startRaw).getTime() : null;
        let endTime = endRaw ? new Date(endRaw).getTime() : null;
        if (startTime != null && isNaN(startTime)) startTime = null;
        if (endTime != null && isNaN(endTime)) endTime = null;
        if (startTime != null) startTime -= 7 * 86400000;
        if (endTime != null) endTime += 7 * 86400000;
        return { startTime, endTime };
    }

    function dateWithinWindow(dateStr, win) {
        if (!dateStr) return true; // no date on record — don't exclude, just can't confirm
        const t = new Date(dateStr).getTime();
        if (isNaN(t)) return true;
        if (win.startTime != null && t < win.startTime) return false;
        if (win.endTime != null && t > win.endTime) return false;
        return true;
    }

    // ─── Deterministic, audit-type-aware certification recommendation ──────────
    // Never AI-generated. base sentence keyed off the audit type string, suffix
    // keyed off NC severity. A surveillance audit must never read "Recommended
    // for Certification" — only initial/Stage 2 audits grant certification.
    function recommendationText(auditType, counts) {
        const majorNC = (counts && Number(counts.majorNC)) || 0;
        const minorNC = (counts && Number(counts.minorNC)) || 0;
        const t = trim(auditType).toLowerCase();

        let base;
        if (/stage\s*1|stage1/.test(t)) {
            base = 'Progression to Stage 2 is recommended';
        } else if (/stage\s*2|stage2|initial/.test(t)) {
            base = 'Recommended for certification';
        } else if (/surveillance/.test(t)) {
            base = 'Continued certification is recommended';
        } else if (/re-?cert/.test(t)) {
            base = 'Recertification is recommended';
        } else {
            base = 'Certification recommendation';
        }

        let suffix;
        if (majorNC > 0) {
            suffix = ' subject to satisfactory closure of the identified nonconformities, including verification of implemented corrective actions for major nonconformities.';
        } else if (minorNC > 0) {
            suffix = ' subject to satisfactory closure of applicable nonconformities.';
        } else {
            suffix = '.';
        }
        return base + suffix;
    }

    // ─── Single-source criterion formatter ─────────────────────────────────────
    // Internal tracking references (FOCUS.n / SURV.n / ORG / DOC — Stage 1
    // carryover pseudo-clauses, never real standard clauses) need one shared
    // definition of "what do we show for this finding's criterion" so every
    // consumer (execution-reporting.js's displayCriterion, report-executive.js's
    // narrative generation, CAPA/NCR renders) agrees. Pure, never throws.
    //   - criterionRef present            -> real clause leads the label;
    //                                        real = criterionRef.
    //   - no criterionRef, clause looks   -> unresolved internal reference;
    //     like FOCUS/SURV/ORG/DOC            isInternal = true, real = null.
    //   - otherwise                       -> clause is already a real/plain
    //                                        reference; used as-is.
    const FOCUS_REF_RE = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;
    function formatCriterion(finding) {
        const f = finding || {};
        const clause = trim(f.clause);
        const criterionRef = trim(f.criterionRef);
        if (criterionRef) {
            const isCarryover = clause && FOCUS_REF_RE.test(clause) && clause.toLowerCase() !== criterionRef.toLowerCase();
            return {
                label: isCarryover ? (criterionRef + ' (' + clause + ')') : criterionRef,
                isInternal: false,
                real: criterionRef
            };
        }
        if (clause && FOCUS_REF_RE.test(clause)) {
            return { label: 'internal ref ' + clause, isInternal: true, real: null };
        }
        return { label: clause, isInternal: false, real: clause || null };
    }

    // ─── Certification-cycle programme — single computation for preview + export ──
    // Anchors the 3-year cycle on the client's certificate (not the current audit
    // date), overlays real historical audits for this client+standard so completed
    // stages show their actual dates/types, and never fabricates Stage 1/2 dates
    // when there is neither a certificate nor history to anchor on.
    function buildProgramme(input) {
        try {
            return buildProgrammeInner(input || {});
        } catch (_e) {
            return { stages: [], anchored: 'audit-date-fallback', issues: ['Unable to compute certification programme.'], nextAudit: null };
        }
    }

    const STAGE_DEFS = [
        { id: 's1', label: 'Stage 1', offset: 0, def: 'Readiness review — documentation, context, scope confirmation', typeTest: /stage\s*1|stage1/i },
        { id: 's2', label: 'Stage 2 (Initial Certification)', offset: 0, def: 'Full system implementation audit', typeTest: /stage\s*2|stage2|initial/i },
        { id: 'sv1', label: 'Surveillance 1', offset: 12, def: 'Key processes, use of marks, changes, previous findings follow-up', typeTest: /surveillance\s*1|sv1|1st\s*surveillance|first\s*surveillance/i },
        { id: 'sv2', label: 'Surveillance 2', offset: 24, def: 'Key processes, use of marks, changes, previous findings follow-up', typeTest: /surveillance\s*2|sv2|2nd\s*surveillance|second\s*surveillance/i },
        { id: 'recert', label: 'Recertification', offset: 36, def: 'Full system re-assessment over the certification cycle', typeTest: /re-?cert/i }
    ];

    function classifyAuditType(t) {
        const s = trim(t).toLowerCase();
        if (/stage\s*1|stage1/.test(s)) return 's1';
        if (/stage\s*2|stage2|initial/.test(s)) return 's2';
        if (/surveillance\s*1|sv1|1st\s*surveillance|first\s*surveillance/.test(s)) return 'sv1';
        if (/surveillance\s*2|sv2|2nd\s*surveillance|second\s*surveillance/.test(s)) return 'sv2';
        if (/re-?cert/.test(s)) return 'recert';
        if (/surveillance/.test(s)) return 'sv1'; // generic "Surveillance" defaults to SV1
        return 's2'; // default to Stage 2 / Initial
    }

    function parseDateSafe(v) {
        if (!v) return null;
        const dt = new Date(v);
        return isNaN(dt.getTime()) ? null : dt;
    }

    function buildProgrammeInner(input) {
        const client = input.client || {};
        const auditPlan = input.auditPlan || {};
        const report = input.report || {};
        const allReports = safeArr(input.allReports);

        const standard = report.standard || auditPlan.standard || '';
        const currentTypeStr = auditPlan.auditType || auditPlan.type || report.auditType || 'Initial';
        let currentStageId = classifyAuditType(currentTypeStr);

        const issues = [];

        // Anchor: prefer the matching client certificate; else fall back to the
        // current audit's own date (only used for the audit-date-fallback path).
        const certs = safeArr(client.certificates);
        const cert = certs.find((c) => trim(c.standard).toLowerCase() === trim(standard).toLowerCase()) || certs[0] || null;
        const certStart = cert ? (parseDateSafe(cert.initialDate) || parseDateSafe(cert.issueDate)) : null;
        const certExpiry = cert ? parseDateSafe(cert.expiryDate) : null;

        // History: real audits for this client+standard, finalized/approved/published,
        // mirroring the filter used by planning-module.js:2744-2780 (clientId+standard+status)
        // without importing that module.
        const clientId = report.clientId != null ? report.clientId : client.id;
        const history = allReports.filter((r) => {
            if (!r || String(r.id) === String(report.id)) return false;
            if (clientId == null || r.clientId == null || String(r.clientId) !== String(clientId)) return false;
            if (standard && trim(r.standard).toLowerCase() !== trim(standard).toLowerCase()) return false;
            const status = trim(r.reportStatus || r.status).toLowerCase();
            return status === 'final' || status === 'finalized' || status === 'approved' || status === 'published';
        }).sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));

        const auditDateStr = report.date || auditPlan.startDate || auditPlan.date || null;
        const auditDate = parseDateSafe(auditDateStr) || new Date();

        let anchored;
        let baseDate;
        if (certStart) {
            anchored = 'certificate';
            baseDate = certStart;
        } else if (history.length > 0) {
            anchored = 'history';
            baseDate = parseDateSafe(history[0].date || history[0].createdAt) || auditDate;
        } else {
            anchored = 'audit-date-fallback';
            baseDate = auditDate;
        }

        // A generic "Surveillance" audit type carries no cycle-year. When a real
        // anchor exists, slot the current audit into the surveillance visit nearest
        // its own date (two years after initial certification = Surveillance 2).
        if (currentStageId === 'sv1' && anchored !== 'audit-date-fallback'
            && !/surveillance\s*1|sv1|1st\s*surveillance|first\s*surveillance/i.test(currentTypeStr)) {
            const sv1Due = new Date(baseDate.getTime()); sv1Due.setMonth(sv1Due.getMonth() + 12);
            const sv2Due = new Date(baseDate.getTime()); sv2Due.setMonth(sv2Due.getMonth() + 24);
            if (Math.abs(auditDate - sv2Due) < Math.abs(auditDate - sv1Due)) currentStageId = 'sv2';
        }
        const currentStageIdx = STAGE_DEFS.findIndex((s) => s.id === currentStageId);

        const fmt = (dt) => dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        const offsetDate = (offset) => { const dt = new Date(baseDate.getTime()); dt.setMonth(dt.getMonth() + offset); return dt; };
        const monthYear = (offset) => fmt(offsetDate(offset));
        // recertDate is the precise anchor (certificate expiry when known) used for
        // chronology comparisons; recertTiming is its display string. Kept separate
        // so month/year formatting never masks a same-month chronology conflict.
        const recertDate = certExpiry || offsetDate(36);
        const recertTiming = certExpiry ? ('by ' + fmt(certExpiry)) : monthYear(36);

        // Match history records to stage slots by their own audit type.
        const historyByStage = {};
        history.forEach((r) => {
            const sid = classifyAuditType(r.auditType || (r.auditPlan && r.auditPlan.type));
            if (!historyByStage[sid]) historyByStage[sid] = r;
        });

        // Only flag missing anchor data from Surveillance onward (idx >= 2): a
        // Stage 1 or Stage 2/Initial audit legitimately has no certificate or
        // prior history yet — that's the normal case for a brand-new client, not
        // a data-integrity problem. Surveillance/recertification audits, by
        // contrast, are only ever scheduled against an existing certificate, so
        // having neither one on file there is a genuine gap worth flagging.
        const noAnchor = anchored === 'audit-date-fallback' && currentStageIdx > 1;
        if (noAnchor) {
            issues.push('No certificate or audit history on file; prior stage dates unavailable.');
        }

        // rawDates[stageId] holds the precise Date behind each stage's display
        // `timing` string (or null when genuinely unknown) — used below for
        // chronology comparisons that must not be fooled by month/year rounding.
        const rawDates = {};
        const stages = STAGE_DEFS.map((s, i) => {
            const isCurrent = s.id === currentStageId;
            const histRec = historyByStage[s.id];
            let timing, status, source, rawDate;

            if (isCurrent) {
                timing = fmt(auditDate);
                status = 'This audit';
                source = 'current';
                rawDate = auditDate;
            } else if (histRec) {
                rawDate = parseDateSafe(histRec.date || histRec.createdAt) || auditDate;
                timing = fmt(rawDate);
                status = 'Completed';
                source = 'history';
            } else if (i < currentStageIdx) {
                // A stage prior to the current one with no matching history record.
                if (noAnchor || (anchored === 'audit-date-fallback' && !certStart && history.length === 0)) {
                    timing = '—';
                    status = 'Unknown';
                    source = 'unknown';
                    rawDate = null;
                } else {
                    rawDate = s.id === 'recert' ? recertDate : offsetDate(s.offset);
                    timing = s.id === 'recert' ? recertTiming : monthYear(s.offset);
                    status = 'Completed';
                    source = anchored;
                }
            } else {
                rawDate = s.id === 'recert' ? recertDate : offsetDate(s.offset);
                timing = s.id === 'recert' ? recertTiming : monthYear(s.offset);
                status = 'Planned';
                source = anchored;
            }

            rawDates[s.id] = rawDate;
            return { id: s.id, label: s.label, timing, status, source, def: s.def };
        });

        // Chronology rule: a stage still awaiting its visit ('Planned') whose
        // computed date lands on or before the current audit date is an
        // impossible/unreliable programme (e.g. a certificate expiry that falls
        // before or during the audit that is meant to keep it alive). Flag it and
        // relabel the stage rather than silently inventing a different date.
        stages.forEach((s) => {
            if (s.status !== 'Planned') return;
            const dt = rawDates[s.id];
            if (dt && !isNaN(dt.getTime()) && dt.getTime() <= auditDate.getTime()) {
                issues.push('Next required audit/recertification (' + s.label + ' — ' + s.timing + ') is not after the current audit date — the certification programme or certificate expiry needs correction.');
                s.status = 'Requires scheduling';
            }
        });

        // nextAudit: the first stage strictly after the current one with a valid,
        // future-dated timing. null (with the issue above present) when the
        // programme cannot substantiate a next audit date.
        let nextAudit = null;
        for (let i = currentStageIdx + 1; i < stages.length; i++) {
            const dt = rawDates[stages[i].id];
            if (dt && !isNaN(dt.getTime()) && dt.getTime() > auditDate.getTime()) {
                nextAudit = stages[i];
                break;
            }
        }

        // Chronology sanity checks.
        const withDates = stages
            .map((s, i) => ({ i, s, dt: parseDateSafe(s.timing !== '—' ? s.timing : null) }))
            .filter((x) => x.dt);
        for (let i = 1; i < withDates.length; i++) {
            if (withDates[i].dt < withDates[i - 1].dt) {
                issues.push('Stage dates are out of chronological order (' + withDates[i - 1].s.label + ' after ' + withDates[i].s.label + ').');
            }
        }
        if (currentStageIdx >= 2 && certStart && auditDate < certStart) {
            issues.push('Surveillance/recertification audit is dated before the certification start date.');
        }
        const currentCount = stages.filter((s) => s.status === 'This audit').length;
        if (currentCount !== 1) {
            issues.push('Current audit does not match exactly one programme stage — check the audit type against the certification cycle.');
        }

        return { stages, anchored, issues, anchorDate: baseDate ? baseDate.toISOString() : null, nextAudit };
    }

    function safeMinimalDataset() {
        return {
            resultCounts: { conform: 0, majorNC: 0, minorNC: 0, na: 0, notAssessed: 0, pendingClassification: 0 },
            advisories: { observation: 0, ofi: 0, total: 0 },
            totals: { totalItems: 0, applicable: 0, assessed: 0 },
            coveragePct: null,
            conformityPct: null,
            uniqueFindings: [],
            clauseRefsAffected: 0,
            advisoryItems: [],
            carRollup: { raised: 0, confirmed: 0, awaitingResponse: 0, carsCreated: 0, inProgress: 0, awaitingVerification: 0, verified: 0, closed: 0 },
            byDepartment: {},
            byClauseTop: {},
            auditStatus: 'Insufficient Data',
            statusColor: 'neutral',
            recommendation: null,
            recColor: 'neutral',
            methodologyNote: 'Insufficient checklist data was available to compute coverage or conformity for this audit.',
            reconciliation: []
        };
    }

    function build(input) {
        try {
            return buildInner(input || {});
        } catch (_e) {
            return safeMinimalDataset();
        }
    }

    function buildInner(input) {
        const report = input.report || {};
        const auditPlan = input.auditPlan || {};
        const items = Array.isArray(input.hydratedProgress) && input.hydratedProgress.length
            ? input.hydratedProgress
            : safeArr(report.checklistProgress);

        // ── Pass 1: classify every item, accumulate counts + per-dept/clause aggregates ──
        const resultCounts = { conform: 0, majorNC: 0, minorNC: 0, na: 0, notAssessed: 0, pendingClassification: 0 };
        const advisories = { observation: 0, ofi: 0, total: 0 };
        const byDepartment = {};
        const byClauseTop = {};

        function deptAgg(name) {
            if (!byDepartment[name]) byDepartment[name] = { total: 0, assessed: 0, conform: 0, majorNC: 0, minorNC: 0, advisories: 0, notAssessed: 0, evidence: 0 };
            return byDepartment[name];
        }
        function clauseAgg(clause) {
            if (!byClauseTop[clause]) byClauseTop[clause] = { total: 0, assessed: 0, conform: 0, majorNC: 0, minorNC: 0, advisories: 0 };
            return byClauseTop[clause];
        }

        items.forEach((item) => {
            if (!item) return;
            const bucket = classifyItem(item);
            const dept = normalizeDeptName(item.department);
            const clause = trim(item.clause) || 'General';
            const dAgg = deptAgg(dept);
            const cAgg = clauseAgg(clause);
            dAgg.total++;
            cAgg.total++;
            if (itemHasEvidence(item)) dAgg.evidence++;

            switch (bucket) {
                case 'notAssessed':
                    resultCounts.notAssessed++;
                    dAgg.notAssessed++;
                    break;
                case 'na':
                    resultCounts.na++;
                    break;
                case 'conform':
                    resultCounts.conform++;
                    dAgg.assessed++; dAgg.conform++;
                    cAgg.assessed++; cAgg.conform++;
                    break;
                case 'majorNC':
                    resultCounts.majorNC++;
                    dAgg.assessed++; dAgg.majorNC++;
                    cAgg.assessed++; cAgg.majorNC++;
                    break;
                case 'minorNC':
                    resultCounts.minorNC++;
                    dAgg.assessed++; dAgg.minorNC++;
                    cAgg.assessed++; cAgg.minorNC++;
                    break;
                case 'pendingClassification':
                    resultCounts.pendingClassification++;
                    dAgg.assessed++;
                    cAgg.assessed++;
                    break;
                case 'observation':
                    advisories.observation++; advisories.total++;
                    dAgg.assessed++; dAgg.advisories++;
                    cAgg.assessed++; cAgg.advisories++;
                    break;
                case 'ofi':
                    advisories.ofi++; advisories.total++;
                    dAgg.assessed++; dAgg.advisories++;
                    cAgg.assessed++; cAgg.advisories++;
                    break;
                default:
                    resultCounts.notAssessed++;
                    dAgg.notAssessed++;
            }
        });

        const totalItems = items.length;
        const applicable = totalItems - resultCounts.na;
        const assessed = resultCounts.conform + resultCounts.majorNC + resultCounts.minorNC
            + resultCounts.pendingClassification + advisories.total;

        const coveragePct = applicable > 0 ? pct(assessed, applicable) : null;
        const conformityPct = assessed > 0
            ? pct(assessed - resultCounts.majorNC - resultCounts.minorNC - resultCounts.pendingClassification, assessed)
            : null;

        // ── Pass 2: unique findings (majors/minors/pending) with register/manual merge ──
        const win = auditWindow(report, auditPlan);
        const clientId = report.clientId;
        const planId = report.planId != null ? report.planId : (auditPlan && auditPlan.id != null ? auditPlan.id : null);
        const registerAll = safeArr(global.state && global.state.ncrs);

        // Register records linked to this audit: primary by auditId===planId,
        // secondary by clientId + matching clause + within audit window.
        const findingClauseSet = new Set();
        const rawFindingItems = [];
        items.forEach((item, idx) => {
            if (!item) return;
            const bucket = classifyItem(item);
            if (bucket === 'majorNC' || bucket === 'minorNC' || bucket === 'pendingClassification') {
                findingClauseSet.add(trim(item.clause));
                rawFindingItems.push({ item, idx, bucket });
            }
        });

        const linkedRegister = [];
        const claimedIds = {};
        registerAll.forEach((n) => {
            if (!n) return;
            if (planId != null && n.auditId != null && String(n.auditId) === String(planId)) {
                linkedRegister.push(n);
                if (n.id != null) claimedIds[String(n.id)] = true;
            }
        });
        registerAll.forEach((n) => {
            if (!n) return;
            if (n.id != null && claimedIds[String(n.id)]) return;
            if (clientId == null || n.clientId == null || String(n.clientId) !== String(clientId)) return;
            if (!n.clause || !findingClauseSet.has(trim(n.clause))) return;
            if (!dateWithinWindow(n.raisedDate, win)) return;
            const sevOk = /^major|minor$/i.test(trim(n.severity || n.type));
            if (!sevOk) return;
            linkedRegister.push(n);
            if (n.id != null) claimedIds[String(n.id)] = true;
        });

        // Manual entries (report.ncrs) — major/minor only, matched against
        // checklist findings by clause+department; unmatched become extra findings.
        const manualNcrs = safeArr(report.ncrs).filter((n) => n && /^major|minor$/i.test(trim(n.type || n.ncrType || n.severity)));

        const registerByClause = {};
        linkedRegister.forEach((rec) => {
            const c = trim(rec.clause);
            if (!c) return;
            (registerByClause[c] = registerByClause[c] || []).push(rec);
        });
        const claimedRegisterIds = {};

        function buildFindingKey(item, idx) {
            const checklistId = item.checklistId || item.id;
            return checklistId != null ? `${checklistId}|${idx}` : `${trim(item.clause)}|${normalizeDeptName(item.department)}|${idx}`;
        }

        const findingsPre = rawFindingItems.map(({ item, idx, bucket }) => {
            const clause = trim(item.clause) || 'General';
            const dept = normalizeDeptName(item.department);
            const sources = ['checklist'];
            let capaRef = null;

            const regPool = registerByClause[clause] || [];
            const regMatch = regPool.find((r) => !(r.id != null && claimedRegisterIds[String(r.id)]));
            if (regMatch) {
                sources.push('register');
                if (regMatch.id != null) { claimedRegisterIds[String(regMatch.id)] = true; capaRef = regMatch.id; }
            }

            const manualMatchIdx = manualNcrs.findIndex((n) => n && trim(n.clause) === clause && !n._statsClaimed);
            if (manualMatchIdx !== -1) {
                manualNcrs[manualMatchIdx]._statsClaimed = true;
                if (sources.indexOf('manual') === -1) sources.push('manual');
            }

            return {
                key: buildFindingKey(item, idx),
                clause,
                // Carried through so any consumer (CAPA/NCR register renders,
                // narrative generation) can resolve the real standard clause via
                // ReportStats.formatCriterion() instead of printing `clause` raw —
                // `clause` alone can be an internal FOCUS/SURV/ORG/DOC reference.
                criterionRef: item.criterionRef || null,
                criterionSource: item.criterionSource || null,
                department: dept,
                severity: severityFromBucket(bucket),
                statement: cleanText(item.requirement || item.description || '', 120),
                comment: cleanText(item.comment || '', 200),
                evidenceCount: evidenceCount(item),
                caDueDate: item.caDueDate || null,
                sources,
                capaRef
            };
        });

        // Unmatched manual NCRs (major/minor) become additional findings.
        manualNcrs.forEach((n, i) => {
            if (n._statsClaimed) return;
            const clause = trim(n.clause) || 'General';
            const dept = normalizeDeptName(n.department);
            const sev = /major/i.test(trim(n.type || n.ncrType || n.severity)) ? 'major' : 'minor';
            const regPool = registerByClause[clause] || [];
            const regMatch = regPool.find((r) => !(r.id != null && claimedRegisterIds[String(r.id)]));
            const sources = ['manual'];
            let capaRef = null;
            if (regMatch) {
                sources.push('register');
                if (regMatch.id != null) { claimedRegisterIds[String(regMatch.id)] = true; capaRef = regMatch.id; }
            }
            findingsPre.push({
                key: `manual|${clause}|${dept}|${i}`,
                clause,
                criterionRef: n.criterionRef || null,
                criterionSource: n.criterionSource || null,
                department: dept,
                severity: sev,
                statement: cleanText(n.description || n.comment || '', 120),
                comment: cleanText(n.comment || n.description || '', 200),
                evidenceCount: 0,
                caDueDate: n.caDueDate || null,
                sources,
                capaRef
            });
        });

        // Stable sort by (clause, department), assign F-01... ids.
        findingsPre.sort((a, b) => (a.clause || '').localeCompare(b.clause || '', undefined, { numeric: true })
            || (a.department || '').localeCompare(b.department || ''));
        const uniqueFindings = findingsPre.map((f, i) => Object.assign({ id: 'F-' + String(i + 1).padStart(2, '0') }, f));

        const clauseRefsAffected = new Set(uniqueFindings.map((f) => f.clause)).size;

        // ── Advisory items (observation/ofi) ──
        let advCounter = { observation: 0, ofi: 0 };
        const advisoryItems = [];
        items.forEach((item) => {
            if (!item) return;
            const bucket = classifyItem(item);
            if (bucket !== 'observation' && bucket !== 'ofi') return;
            advCounter[bucket]++;
            advisoryItems.push({
                id: (bucket === 'observation' ? 'OBS-' : 'OFI-') + String(advCounter[bucket]).padStart(2, '0'),
                type: bucket,
                clause: trim(item.clause) || 'General',
                department: normalizeDeptName(item.department),
                comment: cleanText(item.comment || '', 200),
                evidenceCount: evidenceCount(item)
            });
        });

        // ── CAPA rollup ──
        function registerStatus(rec) {
            const status = trim(rec.status).toLowerCase();
            if (status === 'closed') return 'closed';
            if (rec.verifiedDate) return 'verified';
            if (/verif/.test(status)) return 'verified';
            if (/progress/.test(status)) return 'inProgress';
            return null;
        }
        let carsCreated = 0, inProgress = 0, awaitingVerification = 0, verified = 0, closed = 0;
        const linkedForFindings = uniqueFindings.filter((f) => f.capaRef != null);
        carsCreated = linkedForFindings.length;
        linkedRegister.forEach((rec) => {
            if (rec.id == null || !claimedRegisterIds[String(rec.id)]) return; // only records actually attached to a finding
            const st = registerStatus(rec);
            if (st === 'closed') closed++;
            else if (st === 'verified') { verified++; }
            if (/verification/i.test(trim(rec.status))) awaitingVerification++;
            if (st === 'inProgress') inProgress++;
        });
        const raised = uniqueFindings.length;
        const carRollup = {
            raised,
            confirmed: uniqueFindings.filter((f) => f.severity !== 'pending_classification').length,
            awaitingResponse: Math.max(0, raised - carsCreated),
            carsCreated,
            inProgress,
            awaitingVerification,
            verified,
            closed
        };

        // ── Headline status / recommendation ──
        let auditStatus, statusColor, recommendation, recColor;
        if (resultCounts.majorNC > 0) {
            auditStatus = 'Non-Conformities Identified'; statusColor = 'bad';
            recColor = 'bad';
        } else if (resultCounts.minorNC > 0 || resultCounts.pendingClassification > 0) {
            auditStatus = 'Minor Non-Conformities'; statusColor = 'warn';
            recColor = 'warn';
        } else {
            auditStatus = 'Conforming'; statusColor = 'good';
            recColor = 'good';
        }
        const auditTypeForRec = report.auditType || auditPlan.type || auditPlan.auditType || '';
        recommendation = recommendationText(auditTypeForRec, { majorNC: resultCounts.majorNC, minorNC: resultCounts.minorNC });

        const methodologyNote = 'Coverage measures the share of applicable checklist items (excluding Not Applicable) that '
            + 'have been assessed. Conformity measures, of those assessed items, the share with no confirmed major or minor '
            + 'non-conformity — advisory items (observations and opportunities for improvement) are treated as conforming '
            + 'with comment and do not reduce the conformity score, while unclassified "nc" items are counted against '
            + 'conformity pending classification.';

        // ── Reconciliation checks ──
        const reconciliation = [];
        if (resultCounts.pendingClassification > 0) {
            reconciliation.push({ code: 'unclassified_finding', message: `${resultCounts.pendingClassification} finding(s) are marked non-conforming without a Major/Minor/Observation/OFI classification.` });
        }
        const ncSum = resultCounts.majorNC + resultCounts.minorNC + advisories.observation + advisories.ofi + resultCounts.pendingClassification;
        const ncItemCount = items.filter((i) => i && trim(i.status).toLowerCase() === 'nc').length;
        if (ncSum !== ncItemCount) {
            reconciliation.push({ code: 'nc_count_mismatch', message: `Sum of classified NC/advisory items (${ncSum}) does not match total items marked non-conforming (${ncItemCount}).` });
        }
        if (resultCounts.notAssessed > 0) {
            reconciliation.push({ code: 'coverage_gap', message: `${resultCounts.notAssessed} checklist item(s) have no recorded status and are excluded from coverage and conformity.` });
        }
        // Duplicate detection: a manual NCR that matched a checklist finding is fine;
        // flag only if the same clause+department appears as more than one *unmatched*
        // manual entry alongside an existing checklist finding (would double count in a naive rollup).
        const seenComboForDup = {};
        findingsPre.forEach((f) => {
            const combo = f.clause + '|' + f.department;
            seenComboForDup[combo] = (seenComboForDup[combo] || 0) + (f.sources.length > 1 ? 0 : 1);
        });
        Object.keys(seenComboForDup).forEach((combo) => {
            if (seenComboForDup[combo] > 1) {
                reconciliation.push({ code: 'possible_duplicate_finding', message: `Multiple unmatched findings share clause/department "${combo}" — verify these are not duplicate records.` });
            }
        });

        return {
            resultCounts,
            advisories,
            totals: { totalItems, applicable, assessed },
            coveragePct,
            conformityPct,
            uniqueFindings,
            clauseRefsAffected,
            advisoryItems,
            carRollup,
            byDepartment,
            byClauseTop,
            auditStatus,
            statusColor,
            recommendation,
            recColor,
            methodologyNote,
            reconciliation
        };
    }

    global.ReportStats = {
        build,
        version: 1,
        normalizeDeptName,
        UNASSIGNED_LABEL,
        recommendationText,
        buildProgramme,
        formatCriterion
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.ReportStats;
    }
})(typeof window !== 'undefined' ? window : globalThis);
