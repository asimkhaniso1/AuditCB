/**
 * report-risk.js — Risk & CAPA Analysis module for AuditCB-360 audit reports.
 * =============================================================================
 * CONTRACT (window.ReportRisk)
 * -----------------------------------------------------------------------------
 * This file is standalone vanilla JS. It does NOT modify any other file. It is
 * additive: another integration pass is expected to require this script and
 * wire its output into execution-reporting.js's section pipeline.
 *
 * Consumes the same `d` data object built by generateAuditReport() in
 * execution-reporting.js:
 *   - d.report.checklistProgress: hydrated checklist items, each optionally
 *     carrying { clause|clauseRef, kbMatch, department, status, ncrType,
 *     comment, caDueDate }. Findings are items where status === 'nc' and
 *     ncrType is Major/Minor (not 'observation'/'ofi').
 *   - d.report.ncrs: formal NCR register entries, each optionally carrying
 *     { clause, type, department, comment|description, caDueDate }.
 *   - d.stats: { majorNC, minorNC, ... } aggregate counts.
 *   - d.report.clientId / d.report.id / d.report.date: used to look up prior
 *     audit reports for the same client (window.state.auditReports) to
 *     detect repeated findings, mirroring the prevFindingsRowsHtml pattern
 *     used in execution-reporting.js.
 *
 * Public API:
 *   ReportRisk.scoreFinding(finding) -> ScoredFinding
 *   ReportRisk.compute(d)            -> RiskComputation
 *   ReportRisk.sections(d)           -> Array<SectionDef>
 *   ReportRisk.sectionsPreviewToggles() -> Array<{id,label,icon,color}>
 *
 * All scoring is deterministic, rule-table driven, and offline (no network /
 * AI calls). Rule tables are exported as data constants (CLAUSE_THEMES,
 * IMPACT_KEYWORDS, BUSINESS_IMPACT_RULES) so other standards / clause sets
 * can extend them without touching the scoring logic.
 *
 * Styling consumes the shared Big-Four design system (window.ReportExecutive
 * .bigFourCss() `b4-*` classes + window.ReportExecutive.icon()) — no ad-hoc
 * colors/fonts of its own — so bodyHtml returned by sections() can be dropped
 * directly into the existing report shell (same id="sec-<key>" convention,
 * same color-coded left border).
 * =============================================================================
 */
(function (global) {
    'use strict';

    // ─── Rule tables (extendable per-standard) ─────────────────────────────

    // Clause "theme" classification — used for impact scoring, business impact
    // tagging and root-cause draft templates. Keyed by clause number prefix.
    var CLAUSE_THEMES = [
        { test: /^4(\.|$)/, theme: 'context of the organization', impactBoost: 0 },
        { test: /^5(\.|$)/, theme: 'leadership and commitment', impactBoost: 1 },
        { test: /^6(\.|$)/, theme: 'planning and risk management', impactBoost: 1 },
        { test: /^7\.5/, theme: 'documented information control', impactBoost: 0, tag: 'documented info' },
        { test: /^7(\.|$)/, theme: 'resource and competence management', impactBoost: 0 },
        { test: /^8\.4/, theme: 'control of externally provided processes and suppliers', impactBoost: 2, tag: 'supplier' },
        { test: /^8\.2/, theme: 'customer requirements determination', impactBoost: 1, tag: 'customer' },
        { test: /^8(\.|$)/, theme: 'operational planning and control', impactBoost: 2 },
        { test: /^9(\.|$)/, theme: 'performance evaluation and monitoring', impactBoost: 1 },
        { test: /^10(\.|$)/, theme: 'nonconformity and continual improvement', impactBoost: 1 },
        { test: /legal|complian|regulat/i, theme: 'legal and regulatory compliance', impactBoost: 2, tag: 'legal' }
    ];

    function clauseTheme(clauseRef) {
        var c = String(clauseRef || '').trim();
        for (var i = 0; i < CLAUSE_THEMES.length; i++) {
            if (CLAUSE_THEMES[i].test.test(c)) return CLAUSE_THEMES[i];
        }
        return { theme: 'general management system requirements', impactBoost: 0 };
    }

    // Keyword → business impact category rules. First match per category wins;
    // multiple categories can fire for one finding.
    var BUSINESS_IMPACT_RULES = [
        { cat: 'Financial', kw: /financ|cost|budget|invoice|revenue|payment|pricing/i },
        { cat: 'Operational', kw: /process|procedure|documented info|operation|production|workflow|equipment|maintenance/i },
        { cat: 'Regulatory', kw: /legal|regulat|complian|statutory|law|permit|license/i },
        { cat: 'Cybersecurity', kw: /data|information security|cyber|access control|password|breach|it system/i },
        { cat: 'Legal', kw: /contract|liability|legal|litigation|clause 8\.4|supplier agreement/i },
        { cat: 'Reputation', kw: /brand|reputation|public|media|complaint|image/i },
        { cat: 'Customer Satisfaction', kw: /customer|client|satisfaction|complaint|feedback|service level/i },
        { cat: 'Supply Chain', kw: /supplier|vendor|procurement|outsourc|external provider|purchas/i },
        { cat: 'Business Continuity', kw: /continuity|disaster|backup|resilien|downtime|disruption/i }
    ];

    // ─── Utilities ──────────────────────────────────────────────────────────

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // ─── cleanFindingText ───────────────────────────────────────────────────
    // Turns raw checklist/NCR text (often an evidence-request instruction, e.g.
    // "Show backup logs and recent restore test results. [Ref: ISMS-PRD-003
    // Business Continuity Management Procedure + backup/restore evidence]")
    // into a concise noun-phrase finding description suitable for report
    // display. DISPLAY-ONLY — never mutates the underlying data; callers keep
    // using the raw f.text/f.comment for anything that isn't rendering.
    //
    // Rules (applied in order):
    //   1. Strip every bracketed "[Ref: ...]" (or "[...]") segment.
    //   2. Drop a leading imperative checklist lead-in verb phrase (Show/Verify/
    //      Check/Confirm/Provide/Demonstrate/Ensure/Describe/Explain/Review...),
    //      including a trailing "that"/"whether" if present, so the remainder
    //      reads as a noun phrase.
    //   3. Collapse whitespace, trim stray leading punctuation and a trailing
    //      period-only artifact.
    //   4. Capitalize the first letter.
    //   5. Optionally cap to maxLen chars with an ellipsis (word-boundary safe)
    //      — used for table cells; full text is left uncapped for cards.
    var CHECKLIST_LEADIN = /^(show|verify|verify that|check|confirm|confirm that|provide|demonstrate|ensure|ensure that|describe|explain|review|observe|inspect|examine|validate|assess)\b\s*(that|whether)?\s*/i;

    function cleanFindingText(raw, maxLen) {
        var text = String(raw == null ? '' : raw);
        // 1. Strip bracketed reference segments, e.g. "[Ref: ISMS-PRD-003 ...]".
        text = text.replace(/\s*\[[^\]]*\]\s*/g, ' ');
        // 2. Drop imperative checklist lead-ins (repeat once in case of nested lead-ins).
        text = text.replace(CHECKLIST_LEADIN, '');
        text = text.replace(CHECKLIST_LEADIN, '');
        // 3. Collapse whitespace, trim stray punctuation.
        text = text.replace(/\s+/g, ' ').trim();
        text = text.replace(/^[\s,:;.\-]+/, '').replace(/[\s]+$/, '');
        if (!text) text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
        // 4. Capitalize first letter.
        if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
        // 5. Cap length for table cells (word-boundary safe ellipsis).
        if (maxLen && text.length > maxLen) {
            var cut = text.slice(0, maxLen - 1);
            var lastSpace = cut.lastIndexOf(' ');
            if (lastSpace > maxLen * 0.6) cut = cut.slice(0, lastSpace);
            text = cut.replace(/[\s,:;.\-]+$/, '') + '…';
        }
        return text;
    }

    function addDays(dateStr, days) {
        var base = dateStr ? new Date(dateStr) : new Date();
        if (isNaN(base.getTime())) base = new Date();
        var dt = new Date(base.getTime());
        dt.setDate(dt.getDate() + days);
        return dt.toISOString().split('T')[0];
    }

    function daysBetween(a, b) {
        var da = new Date(a), db = new Date(b);
        if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
        return Math.round((db.getTime() - da.getTime()) / 86400000);
    }

    function normalizeFinding(raw, source, index) {
        // Normalizes checklistProgress items and ncrs entries into one shape.
        var clause = raw.clauseRef || raw.clause || '';
        var text = raw.comment || raw.description || raw.finding || '';
        var type = (raw.ncrType || raw.type || 'Minor');
        return {
            ref: (source === 'ncr' ? 'NCR-' : 'CL-') + (index + 1),
            clause: clause,
            department: raw.department || raw.riskOwner || '',
            ncrType: type,
            text: text,
            caDueDate: raw.caDueDate || null,
            status: raw.status || raw.capaStatus || raw.verificationStatus || null,
            _raw: raw
        };
    }

    function collectFindings(d) {
        // Prefer the hydrated items (they carry resolved kbMatch/evidence); fall back to
        // the raw stored progress so this still works if hydration was skipped.
        var hydrated = (d && d.hydratedProgress) || [];
        var checklist = hydrated.length ? hydrated : ((d && d.report && d.report.checklistProgress) || []);
        var ncrs = (d && d.report && d.report.ncrs) || [];
        var out = [];
        checklist.forEach(function (item, i) {
            if (!item) return;
            var status = (item.status || '').toLowerCase();
            var ncrType = (item.ncrType || '').toLowerCase();
            if (status === 'nc' && ncrType && ncrType !== 'observation' && ncrType !== 'ofi') {
                out.push(normalizeFinding(item, 'checklist', i));
            }
        });
        ncrs.forEach(function (ncr, i) {
            if (!ncr) return;
            out.push(normalizeFinding(ncr, 'ncr', i));
        });
        return out;
    }

    // ─── linkedCapaRecords ──────────────────────────────────────────────────
    // Joins the live NCR/CAPA register (window.state.ncrs) to this report.
    // Primary match: register entry's auditId === this report's audit plan id.
    // Secondary match: same clientId + clause matches a finding in this report
    // + raisedDate falls within the audit period (or has no date). Records
    // already matched primarily are never double-counted.
    function linkedCapaRecords(d) {
        try {
            var ncrs = (global.state && global.state.ncrs) || [];
            if (!ncrs || !ncrs.length) return [];

            var planId = (d && d.report && d.report.planId) || (d && d.auditPlan && d.auditPlan.id) || null;
            var clientId = d && d.report && d.report.clientId;
            var findingClauses = {};
            collectFindings(d).forEach(function (f) {
                if (f.clause) findingClauses[String(f.clause).trim()] = true;
            });

            var baseDate = (d && d.report && (d.report.date || d.report.createdAt)) || null;
            var auditStart = (d && d.auditPlan && (d.auditPlan.startDate || d.auditPlan.date)) || baseDate;
            var auditEnd = (d && d.auditPlan && (d.auditPlan.endDate || d.auditPlan.date)) || baseDate;
            var startTime = auditStart ? new Date(auditStart).getTime() : null;
            var endTime = auditEnd ? new Date(auditEnd).getTime() : null;
            if (startTime !== null && isNaN(startTime)) startTime = null;
            if (endTime !== null && isNaN(endTime)) endTime = null;
            // Widen window slightly to tolerate same-day audits / date-only precision.
            if (startTime !== null) startTime -= 7 * 86400000;
            if (endTime !== null) endTime += 7 * 86400000;

            var matched = [];
            var matchedIds = {};

            ncrs.forEach(function (n) {
                if (!n) return;
                if (planId != null && n.auditId != null && String(n.auditId) === String(planId)) {
                    matched.push(n);
                    if (n.id != null) matchedIds[String(n.id)] = true;
                }
            });

            ncrs.forEach(function (n) {
                if (!n) return;
                if (n.id != null && matchedIds[String(n.id)]) return;
                if (clientId == null || n.clientId == null || String(n.clientId) !== String(clientId)) return;
                if (!n.clause || !findingClauses[String(n.clause).trim()]) return;
                if (n.raisedDate) {
                    var rt = new Date(n.raisedDate).getTime();
                    if (!isNaN(rt)) {
                        if (startTime !== null && rt < startTime) return;
                        if (endTime !== null && rt > endTime) return;
                    }
                }
                matched.push(n);
                if (n.id != null) matchedIds[String(n.id)] = true;
            });

            return matched;
        } catch (e) {
            return [];
        }
    }

    // Derives lifecycle status for a REAL register record from its actual
    // status / effectiveness / verifiedDate fields (not inferred from due date
    // alone, except for the Overdue case which genuinely depends on today vs due).
    function realCapaStatus(rec) {
        var status = String((rec && rec.status) || '').toLowerCase();
        var effectiveness = String((rec && rec.effectiveness) || '').toLowerCase();
        if (status === 'closed' || effectiveness === 'effective') return 'Closed';
        if (rec && rec.verifiedDate) return 'Verified';
        var due = rec && rec.dueDate ? new Date(rec.dueDate) : null;
        var today = new Date();
        if (due && !isNaN(due.getTime()) && due < today && status !== 'closed') return 'Overdue';
        if (rec && (rec.correctiveAction || rec.capaImplementedDate)) return 'In Progress';
        return 'Open';
    }

    // ─── scoreFinding ───────────────────────────────────────────────────────

    function scoreFinding(finding) {
        finding = finding || {};
        var text = String(finding.text || finding.comment || '').toLowerCase();
        var clause = finding.clause || finding.clauseRef || '';
        var ncrType = String(finding.ncrType || finding.type || 'Minor');
        var theme = clauseTheme(clause);

        // Likelihood (1-5): base by severity, then adjust for systemic/recurrence wording.
        var likelihood = /major/i.test(ncrType) ? 4 : /minor/i.test(ncrType) ? 3 : 2;
        var systemicHints = /(multiple|repeated|recurring|no process|no procedure|not implemented|systemic|widespread|several instances)/i;
        if (systemicHints.test(text)) likelihood = Math.min(5, likelihood + 1);
        if (finding.isRepeat) likelihood = Math.min(5, likelihood + 1);
        likelihood = Math.max(1, Math.min(5, likelihood));

        // Impact (1-5): base by severity, adjusted by clause theme weight.
        var impact = /major/i.test(ncrType) ? 4 : /minor/i.test(ncrType) ? 2 : 1;
        impact = Math.max(1, Math.min(5, impact + (theme.impactBoost || 0)));
        if (/major/i.test(ncrType) && (theme.impactBoost || 0) >= 2) impact = 5;

        var score = likelihood * impact;
        var residualRisk = score <= 4 ? 'Low' : score <= 9 ? 'Medium' : score <= 15 ? 'High' : 'Critical';
        var priority = residualRisk === 'Critical' ? 'P1' : residualRisk === 'High' ? 'P2' : residualRisk === 'Medium' ? 'P3' : 'P4';

        // Business impacts
        var businessImpacts = [];
        var searchText = text + ' ' + clause;
        BUSINESS_IMPACT_RULES.forEach(function (rule) {
            if (rule.kw.test(searchText)) businessImpacts.push(rule.cat);
        });
        if (theme.tag === 'supplier' && businessImpacts.indexOf('Supply Chain') === -1) businessImpacts.push('Supply Chain');
        if (theme.tag === 'legal' && businessImpacts.indexOf('Regulatory') === -1) businessImpacts.push('Regulatory');
        if (theme.tag === 'documented info' && businessImpacts.indexOf('Operational') === -1) businessImpacts.push('Operational');
        if (businessImpacts.length === 0) businessImpacts.push('Operational');

        // Root cause scaffold (draft templates — auditor-editable)
        var themeLabel = theme.theme;
        var rootCause = {
            immediateCause: 'Non-conformance observed at clause ' + (clause || 'N/A') + ': ' + cleanFindingText(finding.text || finding.comment || 'requirement not fully met') + '.',
            rootCause: 'Working hypothesis: the organization\'s process for ' + themeLabel + ' is either not fully defined or not consistently applied in practice — pending confirmation by the client\'s own root-cause investigation.',
            systemicCause: systemicHints.test(text)
                ? 'Evidence points to a systemic gap in ' + themeLabel + ' affecting multiple areas or records, rather than a one-off lapse.'
                : 'Current evidence points to an isolated lapse rather than a systemic breakdown, pending the client\'s own root-cause investigation.',
            correctiveAction: 'Define or update the process governing ' + themeLabel + ', retrain the relevant personnel, and correct the identified instance(s) of non-conformance.',
            preventiveAction: 'Introduce periodic internal verification (e.g. an internal audit checkpoint or management review item) for ' + themeLabel + ' to prevent recurrence.'
        };

        return {
            likelihood: likelihood,
            impact: impact,
            score: score,
            residualRisk: residualRisk,
            priority: priority,
            businessImpacts: businessImpacts,
            rootCause: rootCause
        };
    }

    // ─── compute ────────────────────────────────────────────────────────────

    function findRepeatedFindings(d, findings) {
        var repeated = [];
        try {
            var allReports = (global.state && global.state.auditReports) || [];
            var clientId = d && d.report && d.report.clientId;
            var thisId = d && d.report && d.report.id;
            var prevReports = allReports
                .filter(function (r) { return r && r.clientId === clientId && String(r.id) !== String(thisId); })
                .sort(function (a, b) { return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0); });
            if (!prevReports.length) return { repeated: repeated, byClause: {} };
            var prevClauses = {};
            prevReports.forEach(function (r) {
                (r.checklistProgress || []).forEach(function (p) {
                    if (p && p.status === 'nc' && p.ncrType && !/observation|ofi/i.test(p.ncrType)) {
                        var c = p.clauseRef || p.clause;
                        if (c) prevClauses[c] = true;
                    }
                });
                (r.ncrs || []).forEach(function (n) {
                    if (n && n.clause) prevClauses[n.clause] = true;
                });
            });
            findings.forEach(function (f) {
                if (f.clause && prevClauses[f.clause]) repeated.push(f);
            });
            return { repeated: repeated, byClause: prevClauses };
        } catch (e) {
            return { repeated: repeated, byClause: {} };
        }
    }

    function compute(d) {
        d = d || {};
        var rawFindings = collectFindings(d);
        var repeatInfo = findRepeatedFindings(d, rawFindings);
        var repeatedRefs = {};
        repeatInfo.repeated.forEach(function (f) { repeatedRefs[f.ref] = true; });

        var scoredFindings = rawFindings.map(function (f) {
            f.isRepeat = !!repeatedRefs[f.ref];
            var scored = scoreFinding(f);
            return Object.assign({}, f, scored);
        });

        // Join to the live NCR/CAPA register and attach the best-matching real
        // record (by clause) to each scored finding as f.capaRecord, so the
        // Root Cause and Risk Register sections can prefer real auditor data.
        var linked = linkedCapaRecords(d);
        var recordsByClause = {};
        linked.forEach(function (rec) {
            var c = rec && rec.clause ? String(rec.clause).trim() : '';
            if (!c) return;
            (recordsByClause[c] = recordsByClause[c] || []).push(rec);
        });
        var claimedRecordIds = {};
        scoredFindings.forEach(function (f) {
            var c = f.clause ? String(f.clause).trim() : '';
            var pool = c ? (recordsByClause[c] || []) : [];
            var rec = pool.find(function (r) { return !(r.id != null && claimedRecordIds[String(r.id)]); });
            if (rec) {
                f.capaRecord = rec;
                if (rec.id != null) claimedRecordIds[String(rec.id)] = true;
            }
        });

        // Heat matrix: 5x5, rows = impact (1-5, index 0 = impact 1), cols = likelihood (1-5)
        var heatMatrix = [];
        for (var i = 0; i < 5; i++) { heatMatrix.push([0, 0, 0, 0, 0]); }
        scoredFindings.forEach(function (f) {
            var row = Math.max(1, Math.min(5, f.impact)) - 1;
            var col = Math.max(1, Math.min(5, f.likelihood)) - 1;
            heatMatrix[row][col]++;
        });

        var baseDate = (d.report && (d.report.date || d.report.createdAt)) || null;
        var riskRegister = scoredFindings.map(function (f) {
            var rec = f.capaRecord;
            var targetDate = (rec && rec.dueDate) || f.caDueDate || addDays(baseDate, 90);
            var status = rec ? realCapaStatus(rec) : deriveStatus(Object.assign({}, f, { caDueDate: targetDate }), baseDate);
            return {
                ref: f.ref,
                risk: (f.clause ? 'Clause ' + f.clause + ' — ' : '') + cleanFindingText(f.text || 'Non-conformance identified', 160),
                likelihood: f.likelihood,
                impact: f.impact,
                score: f.score,
                existingControls: (rec && (rec.correction || rec.correctiveAction)) || (f.status === 'closed' ? 'Corrective action implemented and verified' : 'Corrective action pending / in progress'),
                residualRisk: f.residualRisk,
                priority: f.priority,
                status: status,
                riskOwner: (rec && rec.capaResponsible) || f.department || 'Process Owner (TBD)',
                treatmentPlan: (rec && rec.correctiveAction) || f.rootCause.correctiveAction,
                reviewDate: targetDate
            };
        });

        var priorityOrder = { P1: 0, P2: 1, P3: 2, P4: 3 };
        var actionPlan = scoredFindings.slice().sort(function (a, b) {
            return (priorityOrder[a.priority] - priorityOrder[b.priority]) || (b.score - a.score);
        }).map(function (f) {
            var dueDate = f.caDueDate || addDays(baseDate, /major/i.test(f.ncrType) ? 30 : 90);
            return {
                priority: f.priority,
                action: f.rootCause.correctiveAction,
                owner: f.department || 'Process Owner (TBD)',
                dueDate: dueDate,
                expectedCompletion: dueDate,
                resources: 'Process owner time, training materials, documentation update',
                expectedOutcome: 'Elimination of the identified non-conformance and reduction of residual risk to Low/Medium',
                status: deriveStatus(Object.assign({}, f, { caDueDate: dueDate }), baseDate),
                businessImpact: f.businessImpacts.join(', ')
            };
        });

        // CAPA dashboard stats — full lifecycle: Open / In Progress / Overdue / Verified / Closed.
        // When the live NCR/CAPA register (window.state.ncrs) has records linked to this
        // report, those are authoritative (source: 'register'). Otherwise fall back to the
        // due-date-inference degrade path (source: 'inferred') so the report never implies
        // register data it doesn't have.
        var today = new Date();
        var capaItems, lifecycleCounts, closureDurations, overdueItems, capaSource;

        if (linked.length > 0) {
            capaSource = 'register';
            lifecycleCounts = { Open: 0, 'In Progress': 0, Overdue: 0, Verified: 0, Closed: 0 };
            closureDurations = [];
            overdueItems = [];
            capaItems = linked.map(function (rec, idx) {
                var status = realCapaStatus(rec);
                lifecycleCounts[status] = (lifecycleCounts[status] || 0) + 1;
                if ((status === 'Closed' || status === 'Verified') && rec.raisedDate) {
                    var endDate = rec.verifiedDate || rec.correctionDate;
                    if (endDate) {
                        var dur = daysBetween(rec.raisedDate, endDate);
                        if (dur !== null) closureDurations.push(Math.abs(dur));
                    }
                }
                if (status === 'Overdue') {
                    var due = rec.dueDate ? new Date(rec.dueDate) : null;
                    var daysOverdue = (due && !isNaN(due.getTime())) ? Math.max(0, Math.round((today.getTime() - due.getTime()) / 86400000)) : null;
                    overdueItems.push({
                        ref: 'CAPA-' + (rec.id != null ? rec.id : idx + 1),
                        clause: rec.clause || '',
                        text: rec.description || '',
                        owner: rec.capaResponsible || 'Process Owner (TBD)',
                        dueDate: rec.dueDate || null,
                        daysOverdue: daysOverdue
                    });
                }
                return {
                    ref: 'CAPA-' + (rec.id != null ? rec.id : idx + 1),
                    clause: rec.clause || '',
                    text: rec.description || '',
                    priority: rec.severity || '',
                    status: status,
                    completion: completionPct(status)
                };
            });
        } else {
            capaSource = 'inferred';
            closureDurations = [];
            overdueItems = [];
            lifecycleCounts = { Open: 0, 'In Progress': 0, Overdue: 0, Verified: 0, Closed: 0 };
            capaItems = scoredFindings.map(function (f) {
                var status = deriveStatus(f, baseDate);
                lifecycleCounts[status] = (lifecycleCounts[status] || 0) + 1;
                if (status === 'Closed' && f.caDueDate && baseDate) {
                    var dur = daysBetween(baseDate, f.caDueDate);
                    if (dur !== null) closureDurations.push(Math.abs(dur));
                }
                if (status === 'Overdue') {
                    var due2 = f.caDueDate ? new Date(f.caDueDate) : null;
                    var daysOverdue2 = (due2 && !isNaN(due2.getTime())) ? Math.max(0, Math.round((today.getTime() - due2.getTime()) / 86400000)) : null;
                    overdueItems.push({
                        ref: f.ref,
                        clause: f.clause || '',
                        text: f.text || '',
                        owner: f.department || 'Process Owner (TBD)',
                        dueDate: f.caDueDate || null,
                        daysOverdue: daysOverdue2
                    });
                }
                return {
                    ref: f.ref,
                    clause: f.clause,
                    text: f.text,
                    priority: f.priority,
                    status: status,
                    completion: completionPct(status),
                    dueDate: f.caDueDate || null
                };
            });
        }

        var avgClosureDays = closureDurations.length
            ? Math.round(closureDurations.reduce(function (a, b) { return a + b; }, 0) / closureDurations.length)
            : null;
        var overallCompletion = capaItems.length
            ? Math.round(capaItems.reduce(function (sum, it) { return sum + it.completion; }, 0) / capaItems.length)
            : 0;

        var capa = {
            open: lifecycleCounts.Open,
            inProgress: lifecycleCounts['In Progress'],
            overdue: lifecycleCounts.Overdue,
            verified: lifecycleCounts.Verified,
            closed: lifecycleCounts.Closed,
            overallCompletion: overallCompletion,
            avgClosureDays: avgClosureDays,
            items: capaItems,
            linkedCount: linked.length,
            source: capaSource,
            overdueItems: overdueItems,
            repeatedFindings: repeatInfo.repeated.map(function (f) {
                var sf = scoredFindings.find(function (s) { return s.ref === f.ref; });
                return sf || f;
            }),
            verificationPending: lifecycleCounts.Verified
        };

        return {
            scoredFindings: scoredFindings,
            heatMatrix: heatMatrix,
            riskRegister: riskRegister,
            actionPlan: actionPlan,
            capa: capa
        };
    }

    // ─── HTML rendering helpers ─────────────────────────────────────────────
    // Consumes the shared Big-Four design system (window.ReportExecutive.bigFourCss()
    // b4-* classes + window.ReportExecutive.icon()). No ad-hoc colors/fonts here —
    // only class names + genuinely dynamic inline properties (bar widths, pip states).

    var STATUS_COMPLETION = { 'Open': 0, 'In Progress': 50, 'Overdue': 25, 'Verified': 90, 'Closed': 100 };

    // Safe wrapper around window.ReportExecutive.icon() — falls back to '' if the
    // executive module hasn't loaded yet, so this file never depends on load order.
    function iconSafe(name, opts) {
        try {
            return (global.ReportExecutive && typeof global.ReportExecutive.icon === 'function')
                ? global.ReportExecutive.icon(name, opts)
                : '';
        } catch (e) {
            return '';
        }
    }

    // Risk-band → heat-cell class (reused for both the heat map and any numeric
    // score badge, so "band color" is expressed in exactly one place).
    function bandHeatClass(band) {
        return { Low: 'b4-heat-low', Medium: 'b4-heat-med', High: 'b4-heat-high', Critical: 'b4-heat-crit' }[band] || 'b4-heat-0';
    }

    // Risk-band → badge. Critical uses the solid b4-pill-critical treatment (the
    // system's only "alarm" variant); everything else is a standard b4-badge.
    function bandBadge(band) {
        if (band === 'Critical') return '<span class="b4-pill b4-pill-critical">' + esc(band) + '</span>';
        var cls = { Low: 'good', Medium: 'warn', High: 'bad' }[band] || 'neutral';
        return '<span class="b4-badge b4-badge--' + cls + '">' + esc(band) + '</span>';
    }

    function priorityBadge(p) {
        if (p === 'P1') return '<span class="b4-pill b4-pill-critical">P1</span>';
        var cls = { P2: 'bad', P3: 'warn', P4: 'neutral' }[p] || 'neutral';
        return '<span class="b4-badge b4-badge--' + cls + '">' + esc(p) + '</span>';
    }

    // Short, plain-language interpretation for a residual-risk band — drawn
    // directly from the existing Low/Medium/High/Critical bands (no invented
    // benchmarks), so a reader can see "Requires attention" / "Managed" next
    // to the badge instead of having to infer meaning from the color alone.
    function riskBandInterpretation(band) {
        return { Low: 'Managed', Medium: 'Monitor', High: 'Requires attention', Critical: 'Immediate action' }[band] || '';
    }

    // Same idea for priority (P1-P4) summaries.
    function priorityInterpretation(p) {
        return { P1: 'Immediate action', P2: 'Requires attention', P3: 'Monitor', P4: 'Managed' }[p] || '';
    }

    function statusBadge(status) {
        if (status === 'Overdue') return '<span class="b4-pill b4-pill-critical">Overdue</span>';
        var cls = { Open: 'bad', 'In Progress': 'warn', Verified: 'info', Closed: 'good' }[status] || 'neutral';
        return '<span class="b4-badge b4-badge--' + cls + '">' + esc(status) + '</span>';
    }

    function tagBadge(label) {
        return '<span class="b4-badge b4-badge--info">' + esc(label) + '</span>';
    }

    function freeBadge(label) {
        return label ? '<span class="b4-badge b4-badge--neutral">' + esc(label) + '</span>' : '&mdash;';
    }

    function completionVariant(status) {
        return { Closed: 'good', Verified: 'good', 'In Progress': 'warn', Overdue: 'bad' }[status];
    }

    function refCell(ref) {
        return '<td style="font-family:monospace;font-weight:700;">' + esc(ref) + '</td>';
    }

    // Derives a lifecycle status (Open / In Progress / Overdue / Verified / Closed)
    // for a finding. Prefers explicit capaStatus/verificationStatus/status fields
    // (already folded into f.status by normalizeFinding); falls back to a
    // due-date-based inference so the dashboard degrades gracefully when the
    // underlying data has no real CAPA status field yet.
    function deriveStatus(f, baseDate) {
        var raw = String((f && f.status) || '').toLowerCase();
        if (/closed|complete/.test(raw)) return 'Closed';
        if (/verif/.test(raw)) return 'Verified';
        if (/progress|in.?work/.test(raw)) return 'In Progress';
        // Unrecognized/absent explicit status — fall back to due-date inference.
        var due = f && f.caDueDate ? new Date(f.caDueDate) : null;
        var today = new Date();
        if (due && !isNaN(due.getTime()) && due < today) return 'Overdue';
        return 'Open';
    }

    function completionPct(status) {
        return STATUS_COMPLETION.hasOwnProperty(status) ? STATUS_COMPLETION[status] : 0;
    }

    // Compact 1-5 pip indicator for Likelihood / Impact columns. Not a system
    // component (no b4- equivalent exists); uses design tokens via CSS custom
    // properties rather than hardcoded hex so it still tracks the palette.
    function pipBar(value, max) {
        max = max || 5;
        var pips = '';
        for (var i = 1; i <= max; i++) {
            var on = i <= value;
            pips += '<span style="display:inline-block;width:8px;height:8px;margin-right:2px;border-radius:2px;background:' + (on ? 'var(--b4-navy)' : 'var(--b4-line)') + ';"></span>';
        }
        return '<div style="display:inline-flex;align-items:center;" title="' + value + '/' + max + '">' + pips + '</div><div class="b4-caption" style="justify-content:center;">' + value + '/' + max + '</div>';
    }

    // Numeric risk-score badge — reuses the heat-cell component (same band colors
    // as the heat map) instead of a bespoke badge.
    function scoreBadge(score, band) {
        return '<span class="b4-heat-cell ' + bandHeatClass(band) + '">' + esc(score) + '</span>';
    }

    // Thin horizontal progress bar built from the system's b4-bar / b4-bar-fill.
    // Only the width % is dynamic/inline; color comes from a b4-bar-fill--variant class.
    function progressBar(pct, variant) {
        pct = Math.max(0, Math.min(100, pct || 0));
        var fillCls = 'b4-bar-fill' + (variant ? ' b4-bar-fill--' + variant : '');
        return '<div class="b4-bar"><div class="' + fillCls + '" style="width:' + pct + '%;"></div></div><div class="b4-caption" style="margin-top:2px;">' + pct + '%</div>';
    }

    function emptyState(msg) {
        return '<div class="b4-caption" style="justify-content:center;padding:24px;">' + iconSafe('check', { size: 14 }) + ' ' + esc(msg) + '</div>';
    }

    function renderHeatmap(heatMatrix) {
        // rows = impact 5..1 (top = highest impact), cols = likelihood 1..5
        function bandFor(score) {
            if (score <= 4) return 'Low';
            if (score <= 9) return 'Medium';
            if (score <= 15) return 'High';
            return 'Critical';
        }
        var rowsHtml = '';
        for (var impactIdx = 4; impactIdx >= 0; impactIdx--) {
            rowsHtml += '<div style="display:flex;align-items:center;gap:6px;">';
            rowsHtml += '<div class="b4-caption" style="width:78px;justify-content:flex-end;font-weight:700;">Impact ' + (impactIdx + 1) + '</div>';
            for (var likIdx = 0; likIdx < 5; likIdx++) {
                var count = heatMatrix[impactIdx][likIdx] || 0;
                var band = bandFor((impactIdx + 1) * (likIdx + 1));
                // b4-heat-cell--lg is the design system's enlarged print-size variant
                // (min 64x64, 12pt) — used here instead of duplicating those dimensions inline.
                rowsHtml += '<div class="b4-heat-cell b4-heat-cell--lg ' + bandHeatClass(band) + '" style="flex:1;border-radius:6px;">' + (count || '') + '</div>';
            }
            rowsHtml += '</div>';
        }
        var likLabelsHtml = '<div style="display:flex;gap:6px;margin-top:4px;">'
            + '<div style="width:78px;"></div>'
            + [1, 2, 3, 4, 5].map(function (n) { return '<div class="b4-caption" style="flex:1;justify-content:center;font-weight:700;">L' + n + '</div>'; }).join('')
            + '</div>'
            + '<div class="b4-eyebrow" style="justify-content:center;margin-top:6px;">Likelihood &rarr;</div>';
        var legend = '<div style="display:flex;gap:14px;margin-top:16px;flex-wrap:wrap;justify-content:center;">'
            + ['Low', 'Medium', 'High', 'Critical'].map(function (band) {
                return '<span class="b4-caption">' + bandBadge(band) + '&nbsp;' + esc(riskBandInterpretation(band)) + '</span>';
            }).join('')
            + '</div>';
        var vAxis = '<div class="b4-eyebrow" style="writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;padding-right:4px;">Impact &uarr;</div>';
        return '<div style="page-break-inside:avoid;break-inside:avoid;">'
            + '<div style="display:flex;justify-content:center;align-items:stretch;gap:6px;">' + vAxis + '<div style="max-width:600px;flex:1;">' + rowsHtml + likLabelsHtml + '</div></div>'
            + legend
            + '<div class="b4-caption" style="justify-content:center;margin-top:8px;">Cell value = number of findings at that Likelihood &times; Impact combination</div>'
            + '</div>';
    }

    function sections(d) {
        d = d || {};
        var r = compute(d);
        var out = [];

        // 1. RISK HEAT MAP — the visually dominant risk page. Trimmed to
        // Ref / Finding / L / I / Residual / Priority per the brief so it breathes.
        var findingsRows = r.scoredFindings.length
            ? r.scoredFindings.map(function (f) {
                return '<tr style="page-break-inside:avoid;break-inside:avoid;">' + refCell(f.ref)
                    + '<td>' + esc((f.clause ? '[' + f.clause + '] ' : '') + cleanFindingText(f.text, 90)) + '</td>'
                    + '<td style="text-align:center;">' + pipBar(f.likelihood) + '</td>'
                    + '<td style="text-align:center;">' + pipBar(f.impact) + '</td>'
                    + '<td style="text-align:center;">' + bandBadge(f.residualRisk) + '</td>'
                    + '<td style="text-align:center;">' + priorityBadge(f.priority) + '</td></tr>';
            }).join('')
            : '';
        out.push({
            key: 'risk-heatmap',
            name: 'RISK HEAT MAP',
            desc: 'Likelihood vs impact heat map of audit findings',
            color: '#dc2626',
            charts: [],
            bodyHtml: r.scoredFindings.length
                ? renderHeatmap(r.heatMatrix)
                    + '<div class="b4-mt-6" style="overflow-x:auto;"><table class="b4-tbl" style="min-width:680px;"><thead><tr><th style="width:12%;">Ref</th><th style="width:44%;">Finding</th><th style="width:11%;text-align:center;">L</th><th style="width:11%;text-align:center;">I</th><th style="width:11%;text-align:center;">Residual</th><th style="width:11%;text-align:center;">Priority</th></tr></thead><tbody>' + findingsRows + '</tbody></table></div>'
                : emptyState('Current audit results do not indicate risks likely to affect certification status, customer delivery, or regulatory compliance in the short term.')
        });

        // 2. BUSINESS IMPACT ANALYSIS
        var impactCounts = {};
        r.scoredFindings.forEach(function (f) {
            f.businessImpacts.forEach(function (cat) { impactCounts[cat] = (impactCounts[cat] || 0) + 1; });
        });
        var impactRows = r.scoredFindings.map(function (f) {
            return '<tr style="page-break-inside:avoid;break-inside:avoid;">' + refCell(f.ref)
                + '<td>' + esc(f.clause || '') + '</td>'
                + '<td>' + esc(cleanFindingText(f.text, 90)) + '</td>'
                + '<td>' + f.businessImpacts.map(tagBadge).join(' ') + '</td>'
                + '<td style="text-align:center;">' + bandBadge(f.residualRisk) + '</td></tr>';
        }).join('');
        var impactCats = Object.keys(impactCounts);
        var maxImpactCount = impactCats.reduce(function (m, c) { return Math.max(m, impactCounts[c]); }, 1);
        var impactSummary = impactCats.length
            ? '<div class="b4-kpi-grid b4-mb-4" style="page-break-inside:avoid;break-inside:avoid;">' + impactCats.map(function (cat) {
                return '<div class="b4-kpi-card">'
                    + '<div class="b4-kpi-value">' + impactCounts[cat] + '</div>'
                    + '<div class="b4-kpi-label">' + esc(cat) + '</div>'
                    + progressBar(Math.round(impactCounts[cat] / maxImpactCount * 100), 'info')
                    + '</div>';
            }).join('') + '</div>'
            : '';
        out.push({
            key: 'business-impact',
            name: 'BUSINESS IMPACT ANALYSIS',
            desc: 'Findings categorized by business impact area',
            color: '#4338ca',
            charts: [],
            bodyHtml: r.scoredFindings.length
                ? impactSummary + '<div style="overflow-x:auto;"><table class="b4-tbl" style="min-width:760px;"><thead><tr><th style="width:10%;">Ref</th><th style="width:10%;">Clause</th><th style="width:34%;">Finding</th><th style="width:30%;">Impact Categories</th><th style="width:16%;text-align:center;">Residual Risk</th></tr></thead><tbody>' + impactRows + '</tbody></table></div>'
                : emptyState('No findings from this audit are assessed as carrying a material business impact at this time.')
        });

        // 3. ROOT CAUSE ANALYSIS — each finding as a vertical logical flow:
        // Finding -> Immediate Cause -> Root Cause -> Business Impact ->
        // Corrective Action -> Preventive Action. Built on the system's b4-timeline
        // component, which already draws the connector line + step dots.
        function flowStep(label, value, variant) {
            return '<div class="b4-timeline-item' + (variant ? ' ' + variant : '') + '">'
                + '<div class="b4-eyebrow" style="margin-bottom:2px;">' + esc(label) + '</div>'
                + '<div class="b4-body" style="margin-bottom:0;">' + esc(value) + '</div>'
                + '</div>';
        }
        var rcCards = r.scoredFindings.map(function (f) {
            var rec = f.capaRecord;
            var hasReal = !!(rec && (rec.rootCause || rec.correctiveAction || rec.correction));
            var rc = f.rootCause;
            var immediateCause = (rec && rec.correction) || rc.immediateCause;
            var rootCauseText = (rec && rec.rootCause) || rc.rootCause;
            var correctiveActionText = (rec && rec.correctiveAction) || rc.correctiveAction;
            var provenance = hasReal
                ? '<div class="b4-caption b4-mt-2">' + iconSafe('check', { size: 12 }) + 'Recorded by auditor' + (rec.raisedBy ? ' (' + esc(rec.raisedBy) + ')' : '') + '</div>'
                : '<div class="b4-caption b4-mt-2">' + iconSafe('finding', { size: 12 }) + 'Working hypothesis (rule-generated draft) — auditor review required</div>';
            var chain = '<div class="b4-timeline">'
                + flowStep('Finding', (f.clause ? 'Clause ' + f.clause + ' — ' : '') + cleanFindingText(f.text || 'Non-conformance identified'))
                + flowStep(hasReal && rec.correction ? 'Correction' : 'Immediate Cause', immediateCause)
                + flowStep('Root Cause', rootCauseText, 'warn')
                + flowStep('Business Impact', f.businessImpacts.join(', '))
                + flowStep('Corrective Action', correctiveActionText, 'good')
                + flowStep('Preventive Action', rc.preventiveAction, 'good')
                + '</div>';
            return '<div class="b4-card b4-mb-4' + (f.priority === 'P1' ? ' b4-card--flagged' : '') + '" style="page-break-inside:avoid;break-inside:avoid;">'
                + '<div class="b4-card-heading" style="justify-content:space-between;">'
                + '<span>' + esc(f.ref) + (f.clause ? ' — Clause ' + esc(f.clause) : '') + '</span>'
                + priorityBadge(f.priority)
                + '</div>'
                + chain
                + provenance
                + '</div>';
        }).join('');
        out.push({
            key: 'root-cause',
            name: 'ROOT CAUSE ANALYSIS',
            desc: 'Rule-generated root cause scaffolding per finding (auditor-editable draft)',
            color: '#7c3aed',
            charts: [],
            bodyHtml: r.scoredFindings.length ? rcCards : emptyState('No non-conformities were identified during this audit, so no root-cause investigation is required.')
        });

        // 4. EXECUTIVE RISK REGISTER — treatment plans that repeat verbatim across
        // rows (a common effect of the rule-driven drafting) are rendered once as
        // a shared note instead of being restated in every row (item 6, reduce repetition).
        var planCounts = {};
        r.riskRegister.forEach(function (row) { planCounts[row.treatmentPlan] = (planCounts[row.treatmentPlan] || 0) + 1; });
        var sharedPlans = [];
        var planIndex = {};
        Object.keys(planCounts).forEach(function (p) {
            if (planCounts[p] > 1) { planIndex[p] = sharedPlans.length + 1; sharedPlans.push(p); }
        });
        var registerRows = r.riskRegister.map(function (row) {
            var treatmentHtml = planIndex[row.treatmentPlan]
                ? 'Treatment: see note ' + planIndex[row.treatmentPlan]
                : 'Treatment: ' + esc(row.treatmentPlan);
            return '<tr style="page-break-inside:avoid;break-inside:avoid;">' + refCell(row.ref)
                + '<td>' + esc(row.risk) + '<div class="b4-caption b4-mt-1">Controls: ' + esc(row.existingControls) + ' &middot; ' + treatmentHtml + '</div></td>'
                + '<td style="text-align:center;">' + pipBar(row.likelihood) + '</td>'
                + '<td style="text-align:center;">' + pipBar(row.impact) + '</td>'
                + '<td style="text-align:center;">' + scoreBadge(row.score, row.residualRisk) + '</td>'
                + '<td>' + esc(row.riskOwner) + '</td>'
                + '<td style="white-space:nowrap;">' + esc(row.reviewDate) + '</td>'
                + '<td style="text-align:center;">' + statusBadge(row.status) + '</td>'
                + '<td style="text-align:center;">' + priorityBadge(row.priority) + '</td>'
                + '<td style="text-align:center;">' + bandBadge(row.residualRisk) + '<div class="b4-caption">' + esc(riskBandInterpretation(row.residualRisk)) + '</div></td></tr>';
        }).join('');
        var registerNotes = sharedPlans.length
            ? '<div class="b4-callout b4-callout--info b4-mt-3"><div class="b4-eyebrow">Shared Treatment Plans</div><ol class="b4-bullets">'
                + sharedPlans.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('')
                + '</ol></div>'
            : '';
        out.push({
            key: 'risk-register',
            name: 'EXECUTIVE RISK REGISTER',
            desc: 'Consolidated risk register for management review',
            color: '#be185d',
            charts: [],
            bodyHtml: r.riskRegister.length
                ? '<div style="overflow-x:auto;"><table class="b4-tbl" style="min-width:1050px;"><thead><tr><th style="width:8%;">Ref</th><th style="width:26%;">Risk</th><th style="width:8%;text-align:center;">Likelihood</th><th style="width:8%;text-align:center;">Impact</th><th style="width:8%;text-align:center;">Risk Score</th><th style="width:12%;">Owner</th><th style="width:9%;">Target Date</th><th style="width:9%;text-align:center;">Status</th><th style="width:6%;text-align:center;">Priority</th><th style="width:9%;text-align:center;">Residual Risk</th></tr></thead><tbody>' + registerRows + '</tbody></table></div>' + registerNotes
                : emptyState('Current audit results do not indicate risks likely to affect certification status, customer delivery, or regulatory compliance in the short term.')
        });

        // 5. MANAGEMENT ACTION PLAN — "Resources" / "Expected Outcome" are drawn
        // from a shared template and are frequently identical across every row;
        // when they are, show them once as a note instead of repeating the
        // sentence per row (item 6, reduce repetition).
        function commonValue(rows, key) {
            if (!rows.length) return null;
            var first = rows[0][key];
            for (var i = 1; i < rows.length; i++) { if (rows[i][key] !== first) return null; }
            return first;
        }
        var sharedResources = commonValue(r.actionPlan, 'resources');
        var sharedOutcome = commonValue(r.actionPlan, 'expectedOutcome');
        var actionRows = r.actionPlan.map(function (a) {
            var tds = '<td style="text-align:center;">' + priorityBadge(a.priority) + '<div class="b4-caption">' + esc(priorityInterpretation(a.priority)) + '</div></td>'
                + '<td>' + esc(a.action) + '</td>'
                + '<td>' + esc(a.owner) + '</td>'
                + '<td style="white-space:nowrap;">' + esc(a.expectedCompletion) + '</td>';
            if (!sharedResources) tds += '<td>' + esc(a.resources) + '</td>';
            if (!sharedOutcome) tds += '<td>' + esc(a.expectedOutcome) + '</td>';
            tds += '<td style="text-align:center;">' + statusBadge(a.status) + '</td>'
                + '<td>' + a.businessImpact.split(', ').filter(Boolean).map(tagBadge).join(' ') + '</td>';
            return '<tr style="page-break-inside:avoid;break-inside:avoid;">' + tds + '</tr>';
        }).join('');
        var actionHead = '<th>Priority</th><th>Action</th><th>Owner</th><th>Expected Completion</th>'
            + (sharedResources ? '' : '<th>Resources</th>')
            + (sharedOutcome ? '' : '<th>Expected Outcome</th>')
            + '<th style="text-align:center;">Status</th><th>Business Impact</th>';
        var actionNotes = (sharedResources || sharedOutcome)
            ? '<div class="b4-callout b4-callout--info b4-mb-3">'
                + (sharedResources ? '<div class="b4-caption"><strong>Resources (all items):</strong>&nbsp;' + esc(sharedResources) + '</div>' : '')
                + (sharedOutcome ? '<div class="b4-caption b4-mt-1"><strong>Expected outcome (all items):</strong>&nbsp;' + esc(sharedOutcome) + '</div>' : '')
                + '</div>'
            : '';
        out.push({
            key: 'action-plan',
            name: 'MANAGEMENT ACTION PLAN',
            desc: 'Board-ready corrective action tracker, prioritized P1 (Critical) through P4',
            color: '#dc2626',
            charts: [],
            bodyHtml: r.actionPlan.length
                ? actionNotes + '<div style="overflow-x:auto;"><table class="b4-tbl" style="min-width:820px;"><thead><tr>' + actionHead + '</tr></thead><tbody>' + actionRows + '</tbody></table></div>'
                : emptyState('No corrective actions are required based on this audit\'s results.')
        });

        // 6. CAPA DASHBOARD — full lifecycle (Open / In Progress / Overdue / Verified /
        // Closed). Scan-first: KPI tiles + chart on top, then ONE consolidated table
        // (Ref / Clause / Finding / Priority / Status / Aging / Completion) — no prose.
        var capa = r.capa;
        var chartId = 'chart-capa';
        var hasCapaData = capa.items.length > 0;
        var isInferred = capa.source === 'inferred';
        // Canvas fillStyle can't resolve CSS custom properties, so the chart palette
        // is a literal copy of the b4-good/warn/bad(critical)/info/neutral token values.
        var CAPA_PALETTE = { Open: '#475569', 'In Progress': '#b45309', Overdue: '#7f1d1d', Verified: '#1d4ed8', Closed: '#15803d' };
        var CAPA_STATUSES = ['Open', 'In Progress', 'Overdue', 'Verified', 'Closed'];
        // In inferred mode (no linked NCR/CAPA register records) the completion-%
        // headline KPI and per-item progress bars are dropped — with no register
        // records to anchor them, a 0%/red "zero progress" visual reads as an
        // alarming lifecycle claim the data doesn't support. Register mode keeps
        // the full completion picture.
        var capaKpis = '<div class="b4-kpi-grid" style="page-break-inside:avoid;break-inside:avoid;">'
            + (isInferred ? '' : '<div class="b4-kpi-card b4-kpi-card--accent"><div class="b4-kpi-value">' + capa.overallCompletion + '<span class="b4-kpi-value-unit">%</span></div><div class="b4-kpi-label">Overall Completion</div></div>')
            + CAPA_STATUSES.map(function (s) {
                var val = capa[s === 'In Progress' ? 'inProgress' : s.toLowerCase()] || 0;
                return '<div class="b4-kpi-card"><div class="b4-kpi-value">' + val + '</div><div class="b4-kpi-label">' + s + '</div></div>';
            }).join('')
            + '</div>'
            + '<div class="b4-caption b4-mt-2">'
            + '<span><strong>' + capa.repeatedFindings.length + '</strong> repeated findings</span>'
            + (isInferred ? '' : '&nbsp;&middot;&nbsp;<span><strong>' + (capa.avgClosureDays != null ? capa.avgClosureDays : '—') + '</strong> avg closure days</span>')
            + '</div>'
            + (capa.source === 'register'
                ? '<div class="b4-caption b4-mt-1">' + iconSafe('shield', { size: 12 }) + capa.linkedCount + ' CAPA record' + (capa.linkedCount === 1 ? '' : 's') + ' linked from the NCR/CAPA register</div>'
                : '<div class="b4-callout b4-callout--info b4-mt-2">' + iconSafe('info', { size: 12 }) + 'CAPA lifecycle tracking begins when corrective action records are linked in the NCR/CAPA register. Status shown is inferred from corrective-action due dates.</div>');
        // Aging: real day-counts are only available for Overdue items today (via
        // capa.overdueItems.daysOverdue, computed from compute()'s dueDate handling).
        // Open/In-Progress items don't carry raisedDate/dueDate in the compute()
        // item shape, so they show '—' rather than a fabricated number — see notes.
        var overdueByRef = {};
        capa.overdueItems.forEach(function (o) { overdueByRef[o.ref] = o; });
        var capaRows = capa.items.map(function (it) {
            var od = overdueByRef[it.ref];
            var aging = od ? (od.daysOverdue != null ? od.daysOverdue + 'd overdue' : '—') : '—';
            var lastCell = isInferred
                ? '<td style="white-space:nowrap;">' + esc(it.dueDate || '—') + '</td>'
                : '<td style="min-width:140px;">' + progressBar(it.completion, completionVariant(it.status)) + '</td>';
            return '<tr style="page-break-inside:avoid;break-inside:avoid;">' + refCell(it.ref)
                + '<td>' + esc(it.clause || '') + '</td>'
                + '<td>' + esc(cleanFindingText(it.text, 90)) + '</td>'
                + '<td style="text-align:center;">' + freeBadge(it.priority) + '</td>'
                + '<td style="text-align:center;">' + statusBadge(it.status) + '</td>'
                + '<td style="text-align:center;white-space:nowrap;">' + esc(aging) + '</td>'
                + lastCell + '</tr>';
        }).join('');
        var capaTableHead = '<th style="width:12%;">Ref</th><th style="width:12%;">Clause</th><th style="width:28%;">Finding</th><th style="width:10%;text-align:center;">Priority</th><th style="width:12%;text-align:center;">Status</th><th style="width:10%;text-align:center;">Aging</th>'
            + (isInferred ? '<th style="width:16%;">Due Date</th>' : '<th style="width:16%;">Completion</th>');
        out.push({
            key: 'capa-dashboard',
            name: 'CAPA DASHBOARD',
            desc: 'Corrective and preventive action status overview across the full lifecycle',
            color: '#16a34a',
            charts: hasCapaData ? [{
                id: chartId,
                configJson: JSON.stringify({
                    type: 'doughnut',
                    data: {
                        labels: CAPA_STATUSES,
                        datasets: [{
                            data: [capa.open, capa.inProgress, capa.overdue, capa.verified, capa.closed],
                            backgroundColor: CAPA_STATUSES.map(function (s) { return CAPA_PALETTE[s]; }),
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        cutout: '62%',
                        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 9 } } } }
                    }
                })
            }] : [],
            bodyHtml: hasCapaData
                ? capaKpis + '<div style="max-width:280px;margin:16px auto;"><canvas id="' + chartId + '"></canvas></div>'
                    + '<div style="overflow-x:auto;" class="b4-mt-5"><table class="b4-tbl" style="min-width:800px;"><thead><tr>' + capaTableHead + '</tr></thead><tbody>' + capaRows + '</tbody></table></div>'
                : emptyState('No corrective/preventive actions are open for this audit.')
        });

        return out;
    }

    function sectionsPreviewToggles() {
        return [
            { id: 'risk-heatmap', label: 'Risk Heat Map', icon: 'fa-solid fa-fire', color: '#dc2626' },
            { id: 'business-impact', label: 'Business Impact', icon: 'fa-solid fa-briefcase', color: '#4338ca' },
            { id: 'root-cause', label: 'Root Cause Analysis', icon: 'fa-solid fa-magnifying-glass', color: '#7c3aed' },
            { id: 'risk-register', label: 'Risk Register', icon: 'fa-solid fa-clipboard-list', color: '#be185d' },
            { id: 'action-plan', label: 'Action Plan', icon: 'fa-solid fa-list-check', color: '#dc2626' },
            { id: 'capa-dashboard', label: 'CAPA Dashboard', icon: 'fa-solid fa-gauge-high', color: '#16a34a' }
        ];
    }

    global.ReportRisk = {
        scoreFinding: scoreFinding,
        compute: compute,
        sections: sections,
        sectionsPreviewToggles: sectionsPreviewToggles,
        linkedCapaRecords: linkedCapaRecords,
        // Exposed rule tables for extension by other standards.
        CLAUSE_THEMES: CLAUSE_THEMES,
        BUSINESS_IMPACT_RULES: BUSINESS_IMPACT_RULES
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.ReportRisk;
    }
})(typeof window !== 'undefined' ? window : globalThis);
