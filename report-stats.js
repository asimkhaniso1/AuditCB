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
            recommendation = 'Conditional Recommendation — pending closure of major non-conformities'; recColor = 'bad';
        } else if (resultCounts.minorNC > 0 || resultCounts.pendingClassification > 0) {
            auditStatus = 'Minor Non-Conformities'; statusColor = 'warn';
            recommendation = 'Recommended for Certification, subject to corrective action'; recColor = 'warn';
        } else {
            auditStatus = 'Conforming'; statusColor = 'good';
            recommendation = 'Recommended for Certification'; recColor = 'good';
        }

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

    global.ReportStats = { build, version: 1 };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.ReportStats;
    }
})(typeof window !== 'undefined' ? window : globalThis);
