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
 * Styling mirrors execution-reporting.js exactly: `.sh` section header /
 * `.sb` section body / `.f-tbl` tables / `.stat-grid` stat boxes, so bodyHtml
 * returned by sections() can be dropped directly into the existing report
 * shell (same id="sec-<key>" convention, same color-coded left border).
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
            immediateCause: 'Non-conformance observed at clause ' + (clause || 'N/A') + ': ' + (finding.text || finding.comment || 'requirement not fully met') + '.',
            rootCause: 'Absence of an effective process for ' + themeLabel + ', or inconsistent application of the existing process.',
            systemicCause: systemicHints.test(text)
                ? 'Indications of a systemic gap affecting ' + themeLabel + ' across multiple areas/records.'
                : 'Likely an isolated lapse rather than a systemic breakdown, pending root cause investigation by the client.',
            correctiveAction: 'Define/update the process for ' + themeLabel + ', retrain relevant personnel, and correct the identified instance(s) of non-conformance.',
            preventiveAction: 'Introduce periodic internal verification (e.g. internal audit checkpoint or management review item) for ' + themeLabel + ' to prevent recurrence.'
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
            var targetDate = f.caDueDate || addDays(baseDate, 90);
            var status = deriveStatus(Object.assign({}, f, { caDueDate: targetDate }), baseDate);
            return {
                ref: f.ref,
                risk: (f.clause ? 'Clause ' + f.clause + ' — ' : '') + (f.text || 'Non-conformance identified').substring(0, 160),
                likelihood: f.likelihood,
                impact: f.impact,
                score: f.score,
                existingControls: f.status === 'closed' ? 'Corrective action implemented and verified' : 'Corrective action pending / in progress',
                residualRisk: f.residualRisk,
                priority: f.priority,
                status: status,
                riskOwner: f.department || 'Process Owner (TBD)',
                treatmentPlan: f.rootCause.correctiveAction,
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
        // Note: underlying data may not carry a real capaStatus/verificationStatus field yet
        // (documented limitation) — deriveStatus() degrades gracefully via due-date inference,
        // and will flow the real field straight through the moment it appears in a finding.
        var closureDurations = [];
        var lifecycleCounts = { Open: 0, 'In Progress': 0, Overdue: 0, Verified: 0, Closed: 0 };
        var capaItems = scoredFindings.map(function (f) {
            var status = deriveStatus(f, baseDate);
            lifecycleCounts[status] = (lifecycleCounts[status] || 0) + 1;
            if (status === 'Closed' && f.caDueDate && baseDate) {
                var dur = daysBetween(baseDate, f.caDueDate);
                if (dur !== null) closureDurations.push(Math.abs(dur));
            }
            return {
                ref: f.ref,
                clause: f.clause,
                text: f.text,
                priority: f.priority,
                status: status,
                completion: completionPct(status)
            };
        });
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

    // ─── HTML rendering helpers (styled to match execution-reporting.js) ───

    var RISK_COLORS = { Low: '#16a34a', Medium: '#d97706', High: '#dc2626', Critical: '#7c1d3f' };
    var RISK_BG = { Low: '#f0fdf4', Medium: '#fffbeb', High: '#fef2f2', Critical: '#fdf2f8' };
    var PRIORITY_COLORS = { P1: '#dc2626', P2: '#ea580c', P3: '#d97706', P4: '#64748b' };
    // Muted, desaturated heat-map palette (Big-Four style — not neon).
    var HEAT_COLORS = { Low: '#5b8c6e', Medium: '#c08a34', High: '#b8503f', Critical: '#7f1d3f' };
    var STATUS_COLORS = {
        'Open': { color: '#991b1b', bg: '#fef2f2' },
        'In Progress': { color: '#92400e', bg: '#fffbeb' },
        'Overdue': { color: '#ffffff', bg: '#b8503f' },
        'Verified': { color: '#0e7490', bg: '#ecfeff' },
        'Closed': { color: '#065f46', bg: '#ecfdf5' }
    };
    var STATUS_COMPLETION = { 'Open': 0, 'In Progress': 50, 'Overdue': 25, 'Verified': 90, 'Closed': 100 };

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

    function pill(label, color, bg) {
        return '<span class="b4-pill b4-badge" style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;color:' + color + ';background:' + (bg || (color + '1a')) + ';border:1px solid ' + color + '33;">' + esc(label) + '</span>';
    }

    function statusPill(status) {
        var s = STATUS_COLORS[status] || STATUS_COLORS.Open;
        return pill(status, s.color, s.bg);
    }

    // Compact 1-5 pip indicator for Likelihood / Impact columns.
    function pipBar(value, max) {
        max = max || 5;
        var pips = '';
        for (var i = 1; i <= max; i++) {
            var on = i <= value;
            pips += '<span style="display:inline-block;width:8px;height:8px;margin-right:2px;border-radius:2px;background:' + (on ? '#334155' : '#e2e8f0') + ';"></span>';
        }
        return '<div style="display:inline-flex;align-items:center;" title="' + value + '/' + max + '">' + pips + '</div><div style="font-size:0.68rem;color:#64748b;">' + value + '/' + max + '</div>';
    }

    // Numeric risk-score badge, colored by band.
    function scoreBadge(score, band) {
        var color = RISK_COLORS[band] || '#64748b';
        return '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:22px;padding:0 6px;border-radius:5px;font-weight:800;font-size:0.8rem;color:#fff;background:' + color + ';">' + esc(score) + '</span>';
    }

    // Thin horizontal progress bar (falls back cleanly without .b4-bar CSS).
    function progressBar(pct, color) {
        pct = Math.max(0, Math.min(100, pct || 0));
        return '<div class="b4-bar" style="background:#e2e8f0;border-radius:4px;height:7px;width:100%;overflow:hidden;">'
            + '<div class="b4-bar-fill" style="width:' + pct + '%;height:100%;background:' + (color || '#0f2a43') + ';border-radius:4px;"></div>'
            + '</div><div style="font-size:0.68rem;color:#64748b;margin-top:2px;">' + pct + '%</div>';
    }

    function emptyState(msg) {
        return '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.9rem;"><i class="fa-solid fa-circle-check" style="margin-right:6px;"></i>' + esc(msg) + '</div>';
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
            rowsHtml += '<div style="display:flex;align-items:center;gap:4px;">';
            rowsHtml += '<div style="width:76px;font-size:0.72rem;font-weight:700;color:#475569;text-align:right;padding-right:8px;">Impact ' + (impactIdx + 1) + '</div>';
            for (var likIdx = 0; likIdx < 5; likIdx++) {
                var count = heatMatrix[impactIdx][likIdx] || 0;
                var band = bandFor((impactIdx + 1) * (likIdx + 1));
                var bg = HEAT_COLORS[band];
                var bubble = count
                    ? '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 4px;border-radius:50%;background:rgba(255,255,255,0.92);color:' + bg + ';font-weight:800;font-size:0.85rem;">' + count + '</span>'
                    : '';
                rowsHtml += '<div class="b4-heat-cell" style="flex:1;aspect-ratio:1.4;min-height:44px;background:' + bg + ';color:#fff;display:flex;align-items:center;justify-content:center;border-radius:4px;border:1px solid rgba(255,255,255,0.4);">' + bubble + '</div>';
            }
            rowsHtml += '</div>';
        }
        var likLabelsHtml = '<div style="display:flex;gap:4px;margin-top:2px;">'
            + '<div style="width:76px;"></div>'
            + [1, 2, 3, 4, 5].map(function (n) { return '<div style="flex:1;text-align:center;font-size:0.72rem;font-weight:700;color:#475569;">L' + n + '</div>'; }).join('')
            + '</div>'
            + '<div style="text-align:center;font-size:0.72rem;font-weight:700;color:#94a3b8;margin-top:4px;letter-spacing:0.04em;">LIKELIHOOD &rarr;</div>';
        var legend = '<div style="display:flex;gap:14px;margin-top:14px;flex-wrap:wrap;justify-content:center;">'
            + Object.keys(HEAT_COLORS).map(function (k) {
                return '<div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:#334155;"><span style="width:14px;height:14px;border-radius:3px;background:' + HEAT_COLORS[k] + ';display:inline-block;"></span>' + k + '</div>';
            }).join('')
            + '</div>';
        var vAxis = '<div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:0.72rem;font-weight:700;color:#94a3b8;letter-spacing:0.04em;text-align:center;padding-right:4px;">IMPACT &uarr;</div>';
        return '<div style="page-break-inside:avoid;break-inside:avoid;">'
            + '<div style="display:flex;justify-content:center;align-items:stretch;gap:4px;">' + vAxis + '<div style="max-width:520px;">' + rowsHtml + likLabelsHtml + '</div></div>'
            + legend
            + '<div style="text-align:center;font-size:0.75rem;color:#94a3b8;margin-top:6px;">Cell value = number of findings at that Likelihood &times; Impact combination</div>'
            + '</div>';
    }

    function sections(d) {
        d = d || {};
        var r = compute(d);
        var out = [];

        // 1. RISK HEAT MAP
        var findingsRows = r.scoredFindings.length
            ? r.scoredFindings.map(function (f) {
                return '<tr style="page-break-inside:avoid;break-inside:avoid;"><td style="font-family:monospace;font-weight:600;">' + esc(f.ref) + '</td>'
                    + '<td>' + esc((f.clause ? '[' + f.clause + '] ' : '') + (f.text || '').substring(0, 140)) + '</td>'
                    + '<td style="text-align:center;">' + pipBar(f.likelihood) + '</td>'
                    + '<td style="text-align:center;">' + pipBar(f.impact) + '</td>'
                    + '<td style="text-align:center;">' + scoreBadge(f.score, f.residualRisk) + '</td>'
                    + '<td style="text-align:center;">' + pill(f.residualRisk, RISK_COLORS[f.residualRisk], RISK_BG[f.residualRisk]) + '</td>'
                    + '<td style="text-align:center;">' + pill(f.priority, PRIORITY_COLORS[f.priority]) + '</td></tr>';
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
                    + '<div style="overflow-x:auto;"><table class="b4-tbl f-tbl" style="margin-top:18px;table-layout:auto;min-width:820px;"><thead><tr style="background:#fef2f2;"><th style="width:10%;">Ref</th><th style="width:34%;">Finding</th><th style="width:11%;text-align:center;">Likelihood</th><th style="width:11%;text-align:center;">Impact</th><th style="width:10%;text-align:center;">Score</th><th style="width:12%;text-align:center;">Residual Risk</th><th style="width:12%;text-align:center;">Priority</th></tr></thead><tbody>' + findingsRows + '</tbody></table></div>'
                : emptyState('No non-conformities identified — no risk items to plot.')
        });

        // 2. BUSINESS IMPACT ANALYSIS
        var impactCounts = {};
        r.scoredFindings.forEach(function (f) {
            f.businessImpacts.forEach(function (cat) { impactCounts[cat] = (impactCounts[cat] || 0) + 1; });
        });
        var impactRows = r.scoredFindings.map(function (f) {
            return '<tr style="page-break-inside:avoid;break-inside:avoid;"><td style="font-family:monospace;font-weight:600;">' + esc(f.ref) + '</td>'
                + '<td>' + esc(f.clause || '') + '</td>'
                + '<td>' + esc((f.text || '').substring(0, 120)) + '</td>'
                + '<td>' + f.businessImpacts.map(function (c) { return pill(c, '#4338ca', '#eef2ff'); }).join(' ') + '</td>'
                + '<td style="text-align:center;">' + pill(f.residualRisk, RISK_COLORS[f.residualRisk], RISK_BG[f.residualRisk]) + '</td></tr>';
        }).join('');
        var impactCats = Object.keys(impactCounts);
        var maxImpactCount = impactCats.reduce(function (m, c) { return Math.max(m, impactCounts[c]); }, 1);
        var impactSummary = impactCats.length
            ? '<div class="b4-kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px;page-break-inside:avoid;break-inside:avoid;">' + impactCats.map(function (cat) {
                return '<div class="b4-kpi-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;text-align:center;">'
                    + '<div class="b4-kpi-value" style="font-size:1.6rem;font-weight:800;color:#3730a3;">' + impactCounts[cat] + '</div>'
                    + '<div class="b4-kpi-label" style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-top:4px;">' + esc(cat) + '</div>'
                    + progressBar(Math.round(impactCounts[cat] / maxImpactCount * 100), '#4338ca')
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
                ? impactSummary + '<div style="overflow-x:auto;"><table class="b4-tbl f-tbl" style="table-layout:auto;min-width:760px;"><thead><tr style="background:#eef2ff;"><th style="width:10%;">Ref</th><th style="width:10%;">Clause</th><th style="width:34%;">Finding</th><th style="width:30%;">Impact Categories</th><th style="width:16%;text-align:center;">Residual Risk</th></tr></thead><tbody>' + impactRows + '</tbody></table></div>'
                : emptyState('No non-conformities identified — no business impact to analyze.')
        });

        // 3. ROOT CAUSE ANALYSIS
        function rcField(label, value) {
            return '<div><div style="font-size:0.66rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:3px;">' + esc(label) + '</div>'
                + '<div style="font-size:0.85rem;color:#334155;line-height:1.45;">' + esc(value) + '</div></div>';
        }
        var rcCards = r.scoredFindings.map(function (f) {
            var rc = f.rootCause;
            return '<div class="b4-card" style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:14px;background:#ffffff;page-break-inside:avoid;break-inside:avoid;">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                + '<div style="font-weight:700;color:#1e293b;">' + esc(f.ref) + (f.clause ? ' — Clause ' + esc(f.clause) : '') + '</div>'
                + pill(f.priority, PRIORITY_COLORS[f.priority])
                + '</div>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;">'
                + rcField('Immediate Cause', rc.immediateCause)
                + rcField('Root Cause', rc.rootCause)
                + rcField('Systemic Cause', rc.systemicCause)
                + '<div></div>'
                + '</div>'
                + '<div class="b4-callout" style="margin-top:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:3px solid #16a34a;border-radius:6px;padding:12px 14px;display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;">'
                + rcField('Corrective Action', rc.correctiveAction)
                + rcField('Preventive Action', rc.preventiveAction)
                + '</div>'
                + '<div style="margin-top:8px;font-size:0.68rem;color:#94a3b8;"><i class="fa-solid fa-robot" style="margin-right:4px;"></i>AI-assisted draft — auditor review required</div>'
                + '</div>';
        }).join('');
        out.push({
            key: 'root-cause',
            name: 'ROOT CAUSE ANALYSIS',
            desc: 'Rule-generated root cause scaffolding per finding (auditor-editable draft)',
            color: '#7c3aed',
            charts: [],
            bodyHtml: r.scoredFindings.length ? rcCards : emptyState('No non-conformities identified — no root cause analysis required.')
        });

        // 4. EXECUTIVE RISK REGISTER
        var registerRows = r.riskRegister.map(function (row) {
            return '<tr style="page-break-inside:avoid;break-inside:avoid;"><td style="font-family:monospace;font-weight:600;">' + esc(row.ref) + '</td>'
                + '<td>' + esc(row.risk) + '<div style="margin-top:4px;font-size:0.7rem;color:#94a3b8;"><strong>Controls:</strong> ' + esc(row.existingControls) + ' &nbsp;|&nbsp; <strong>Treatment:</strong> ' + esc(row.treatmentPlan) + '</div></td>'
                + '<td style="text-align:center;">' + pipBar(row.likelihood) + '</td>'
                + '<td style="text-align:center;">' + pipBar(row.impact) + '</td>'
                + '<td style="text-align:center;">' + scoreBadge(row.score, row.residualRisk) + '</td>'
                + '<td>' + esc(row.riskOwner) + '</td>'
                + '<td style="white-space:nowrap;">' + esc(row.reviewDate) + '</td>'
                + '<td style="text-align:center;">' + statusPill(row.status) + '</td>'
                + '<td style="text-align:center;">' + pill(row.priority, PRIORITY_COLORS[row.priority]) + '</td>'
                + '<td style="text-align:center;">' + pill(row.residualRisk, RISK_COLORS[row.residualRisk], RISK_BG[row.residualRisk]) + '</td></tr>';
        }).join('');
        out.push({
            key: 'risk-register',
            name: 'EXECUTIVE RISK REGISTER',
            desc: 'Consolidated risk register for management review',
            color: '#be185d',
            charts: [],
            bodyHtml: r.riskRegister.length
                ? '<div style="overflow-x:auto;"><table class="b4-tbl f-tbl" style="table-layout:auto;min-width:1050px;"><thead><tr style="background:#fdf2f8;"><th style="width:8%;">Ref</th><th style="width:26%;">Risk</th><th style="width:8%;text-align:center;">Likelihood</th><th style="width:8%;text-align:center;">Impact</th><th style="width:8%;text-align:center;">Risk Score</th><th style="width:12%;">Owner</th><th style="width:9%;">Target Date</th><th style="width:9%;text-align:center;">Status</th><th style="width:6%;text-align:center;">Priority</th><th style="width:9%;text-align:center;">Residual Risk</th></tr></thead><tbody>' + registerRows + '</tbody></table></div>'
                : emptyState('No risks identified during this audit.')
        });

        // 5. MANAGEMENT ACTION PLAN
        var actionRows = r.actionPlan.map(function (a) {
            return '<tr style="page-break-inside:avoid;break-inside:avoid;"><td style="text-align:center;">' + pill(a.priority, PRIORITY_COLORS[a.priority]) + '</td>'
                + '<td>' + esc(a.action) + '</td>'
                + '<td>' + esc(a.owner) + '</td>'
                + '<td style="white-space:nowrap;">' + esc(a.expectedCompletion) + '</td>'
                + '<td>' + esc(a.resources) + '</td>'
                + '<td>' + esc(a.expectedOutcome) + '</td>'
                + '<td style="text-align:center;">' + statusPill(a.status) + '</td>'
                + '<td>' + a.businessImpact.split(', ').filter(Boolean).map(function (c) { return pill(c, '#4338ca', '#eef2ff'); }).join(' ') + '</td></tr>';
        }).join('');
        out.push({
            key: 'action-plan',
            name: 'MANAGEMENT ACTION PLAN',
            desc: 'Board-ready corrective action tracker, prioritized P1 (Critical) through P4',
            color: '#dc2626',
            charts: [],
            bodyHtml: r.actionPlan.length
                ? '<div style="overflow-x:auto;"><table class="b4-tbl f-tbl" style="table-layout:auto;min-width:980px;"><thead><tr style="background:#fef2f2;"><th>Priority</th><th>Action</th><th>Owner</th><th>Expected Completion</th><th>Resources</th><th>Expected Outcome</th><th style="text-align:center;">Status</th><th>Business Impact</th></tr></thead><tbody>' + actionRows + '</tbody></table></div>'
                : emptyState('No corrective actions required for this audit.')
        });

        // 6. CAPA DASHBOARD — full lifecycle (Open / In Progress / Overdue / Verified / Closed)
        var capa = r.capa;
        var chartId = 'chart-capa';
        var hasCapaData = capa.items.length > 0;
        // Desaturated Big-Four-style palette, one shade per lifecycle status.
        var CAPA_PALETTE = { Open: '#94a3b8', 'In Progress': '#c08a34', Overdue: '#b8503f', Verified: '#5b8ca0', Closed: '#5b8c6e' };
        var capaStatBoxes = '<div class="b4-kpi-grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;page-break-inside:avoid;break-inside:avoid;">'
            + '<div class="b4-kpi-card" style="background:#0f2a43;border-color:#0f2a43;padding:12px 8px;text-align:center;border-radius:6px;">'
            + '<div class="b4-kpi-value" style="font-size:1.5rem;font-weight:800;color:#fff;">' + capa.overallCompletion + '%</div>'
            + '<div class="b4-kpi-label" style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#cbd5e1;">Overall Completion</div></div>'
            + ['Open', 'In Progress', 'Overdue', 'Verified', 'Closed'].map(function (s) {
                var c = CAPA_PALETTE[s];
                return '<div class="b4-kpi-card" style="background:#fff;border:1px solid ' + c + '55;border-top:3px solid ' + c + ';padding:12px 8px;text-align:center;border-radius:6px;">'
                    + '<div class="b4-kpi-value" style="font-size:1.4rem;font-weight:800;color:' + c + ';">' + (capa[s === 'In Progress' ? 'inProgress' : s.toLowerCase()] || 0) + '</div>'
                    + '<div class="b4-kpi-label" style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">' + s + '</div></div>';
            }).join('')
            + '</div>'
            + '<div style="display:flex;gap:14px;margin-top:10px;font-size:0.75rem;color:#64748b;flex-wrap:wrap;">'
            + '<span><strong>' + capa.repeatedFindings.length + '</strong> repeated findings</span>'
            + '<span><strong>' + (capa.avgClosureDays != null ? capa.avgClosureDays : '—') + '</strong> avg closure days</span>'
            + '</div>';
        var itemBars = capa.items.length
            ? '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">' + capa.items.map(function (it) {
                var c = CAPA_PALETTE[it.status] || '#94a3b8';
                return '<div style="page-break-inside:avoid;break-inside:avoid;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;">'
                    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">'
                    + '<div style="font-size:0.8rem;color:#334155;"><span style="font-family:monospace;font-weight:700;">' + esc(it.ref) + '</span>' + (it.clause ? ' &middot; Clause ' + esc(it.clause) : '') + '</div>'
                    + statusPill(it.status)
                    + '</div>'
                    + progressBar(it.completion, c)
                    + '</div>';
            }).join('') + '</div>'
            : '';
        var repeatedTable = capa.repeatedFindings.length
            ? '<table class="b4-tbl f-tbl" style="margin-top:16px;"><thead><tr style="background:#fffbeb;"><th style="width:14%;">Ref</th><th style="width:16%;">Clause</th><th style="width:50%;">Finding</th><th style="width:20%;text-align:center;">Priority</th></tr></thead><tbody>'
                + capa.repeatedFindings.map(function (f) {
                    return '<tr style="page-break-inside:avoid;break-inside:avoid;"><td style="font-family:monospace;font-weight:600;">' + esc(f.ref) + '</td><td>' + esc(f.clause || '') + '</td><td>' + esc((f.text || '').substring(0, 130)) + '</td><td style="text-align:center;">' + pill(f.priority || 'P3', PRIORITY_COLORS[f.priority || 'P3']) + '</td></tr>';
                }).join('') + '</tbody></table>'
            : '';
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
                        labels: ['Open', 'In Progress', 'Overdue', 'Verified', 'Closed'],
                        datasets: [{
                            data: [capa.open, capa.inProgress, capa.overdue, capa.verified, capa.closed],
                            backgroundColor: [CAPA_PALETTE.Open, CAPA_PALETTE['In Progress'], CAPA_PALETTE.Overdue, CAPA_PALETTE.Verified, CAPA_PALETTE.Closed],
                            borderWidth: 0
                        }]
                    },
                    options: { responsive: true, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
                })
            }] : [],
            bodyHtml: hasCapaData
                ? capaStatBoxes + '<div style="max-width:300px;margin:18px auto;"><canvas id="' + chartId + '"></canvas></div>' + itemBars + repeatedTable
                : emptyState('No CAPA records to display for this audit.')
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
        // Exposed rule tables for extension by other standards.
        CLAUSE_THEMES: CLAUSE_THEMES,
        BUSINESS_IMPACT_RULES: BUSINESS_IMPACT_RULES
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.ReportRisk;
    }
})(typeof window !== 'undefined' ? window : globalThis);
