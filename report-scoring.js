/**
 * report-scoring.js
 * ============================================================================
 * AuditCB-360 — Audit Scoring, Maturity & Trend Intelligence module.
 *
 * Standalone, framework-free companion to execution-reporting.js. Does NOT
 * modify or depend on execution-reporting.js at load time — it only reads
 * the same `d` data shape that generateAuditReport() builds and stores on
 * `window._reportPreviewData` (report, hydratedProgress, client, stats, etc.)
 * plus `window.state.auditReports` for historical trend comparison.
 *
 * Public API — window.ReportScoring:
 *
 *   compute(d) -> metrics object (pure, no DOM access, safe to call anywhere)
 *     {
 *       auditScore:  0-100 overall,
 *       breakdown:   { Compliance, Risk, Evidence, Documentation, Leadership,
 *                      Operations, Training, Monitoring, 'Continual Improvement' } (0-100 each),
 *       maturity:    { Leadership, 'Risk Management', Operations,
 *                      'Document Control', Training, 'Internal Audit', overall } (1-5 each),
 *       departments: [{ name, score, maturity, findings, ncCount, riskLevel }],
 *       clauseIntel: { mostFailed:[...], mostSuccessful:[...], recurring:[...] },
 *       trends:      { labels, majorNC:[], minorNC:[], obs:[], ofi:[], auditScore:[], capaOpen:[] },
 *       execDashboard: { auditScore, maturityOverall, riskRating, certificationRecommendation,
 *                        businessHealth, compliancePct, controlEffectiveness, processEffectiveness,
 *                        top5Risks:[{title,level}], top5Priorities:[string] }
 *     }
 *
 *   sections(d) -> [{ key, name, desc, color, bodyHtml, charts:[{canvasId, configJson}] }, ...]
 *     Section keys (in order): 'exec-dashboard', 'maturity', 'dept-performance',
 *     'clause-intel', 'trends' (only when prior reports exist for the client).
 *     HTML matches execution-reporting.js conventions (.sh/.sb/.f-tbl/stat-box/stat-grid,
 *     inline styles, Outfit font stack, same color palette). Chart configs are plain
 *     Chart.js v4 config objects pre-serialized to JSON strings so the integrator can
 *     splice them into the print-blob chart script alongside the existing c1..c7 charts.
 *
 *   sectionsPreviewToggles() -> [{ id, label, icon, color }]
 *     Matches the preview-pill array pattern used in showReportPreviewModal().
 *
 * Everything is defensive: every field access is optional-chained or guarded,
 * every section renders an "Insufficient data" fallback rather than throwing
 * or emitting broken markup when the underlying report has sparse data.
 *
 * Clause -> Theme mapping is a data table (CLAUSE_THEME_MAP) keyed by standard
 * family so other standards/annexes can be added later without touching logic.
 * The default table covers the Annex SL high-level structure (clauses 4-10),
 * which is shared by ISO 9001 / 14001 / 45001 / 27001.
 * ============================================================================
 */
(function (global) {
    'use strict';

    // ── Helpers ─────────────────────────────────────────────────────────────
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const round = (n) => Math.round((Number(n) || 0) * 10) / 10;
    const pct = (num, den) => (den > 0 ? clamp(round((num / den) * 100), 0, 100) : 0);
    const fmtDate = (v) => {
        if (!v) return '—';
        try {
            const dt = new Date(v);
            if (isNaN(dt.getTime())) return String(v);
            return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (_e) { return String(v); }
    };

    // ── Clause -> Theme mapping table (Annex SL high-level structure) ────────
    // Keyed by "standard family" so other standards can register their own map.
    // Each entry maps a clause-number *prefix* (matched against the leading
    // digits of item.clause, e.g. "7.2.1" -> matches "7.2" then "7") to a theme.
    const CLAUSE_THEME_MAP = {
        default: [
            { prefix: '4', theme: 'Documentation' },       // Context of the organization
            { prefix: '5', theme: 'Leadership' },           // Leadership & commitment
            { prefix: '6', theme: 'Risk' },                 // Planning / risk & opportunities
            { prefix: '7.1', theme: 'Operations' },         // Resources
            { prefix: '7.2', theme: 'Training' },           // Competence
            { prefix: '7.3', theme: 'Training' },           // Awareness
            { prefix: '7.4', theme: 'Operations' },         // Communication
            { prefix: '7.5', theme: 'Documentation' },      // Documented information
            { prefix: '7', theme: 'Operations' },           // fallback for 7.x
            { prefix: '8', theme: 'Operations' },            // Operation
            { prefix: '9.1', theme: 'Monitoring' },          // Monitoring, measurement, analysis
            { prefix: '9.2', theme: 'Monitoring' },          // Internal audit
            { prefix: '9.3', theme: 'Leadership' },          // Management review
            { prefix: '9', theme: 'Monitoring' },
            { prefix: '10', theme: 'Continual Improvement' } // Improvement / NC & corrective action
        ]
    };
    const THEMES = ['Compliance', 'Risk', 'Evidence', 'Documentation', 'Leadership', 'Operations', 'Training', 'Monitoring', 'Continual Improvement'];

    function themeForClause(clause, standardFamily) {
        const table = CLAUSE_THEME_MAP[standardFamily] || CLAUSE_THEME_MAP.default;
        const c = String(clause || '').trim();
        if (!c) return null;
        // try longest-prefix match first (e.g. "7.2" before "7")
        const sorted = table.slice().sort((a, b) => b.prefix.length - a.prefix.length);
        for (const row of sorted) {
            if (c === row.prefix || c.startsWith(row.prefix + '.')) return row.theme;
        }
        return null;
    }

    function standardFamily(standard) {
        const s = String(standard || '').toLowerCase();
        if (s.includes('9001')) return '9001';
        if (s.includes('14001')) return '14001';
        if (s.includes('45001')) return '45001';
        if (s.includes('27001')) return '27001';
        return 'default';
    }

    // ── Maturity dimension <- theme mapping ──────────────────────────────────
    const MATURITY_DIMENSIONS = {
        'Leadership': 'Leadership',
        'Risk Management': 'Risk',
        'Operations': 'Operations',
        'Document Control': 'Documentation',
        'Training': 'Training',
        'Internal Audit': 'Monitoring'
    };

    // ── Core scoring ──────────────────────────────────────────────────────────
    function scoreItems(items) {
        const total = items.length;
        const applicable = items.filter((i) => i?.status !== 'na');
        const conforming = items.filter((i) => i?.status === 'conform');
        const majors = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'major');
        const minors = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'minor');
        const withEvidence = items.filter((i) => i?.evidenceImage || (Array.isArray(i?.evidenceImages) && i.evidenceImages.length > 0));

        const complianceScore = pct(conforming.length, applicable.length);
        // Risk score: start at 100, penalize per major/minor NC (heavier for majors), floor at 0.
        const riskPenalty = majors.length * 12 + minors.length * 5;
        const riskScore = clamp(100 - riskPenalty, 0, 100);
        const evidenceScore = pct(withEvidence.length, applicable.length);

        return { total, applicable: applicable.length, conforming: conforming.length, majors: majors.length, minors: minors.length, complianceScore, riskScore, evidenceScore };
    }

    function themeSubscores(items, family) {
        // theme -> { applicable, conforming, majors, minors }
        const agg = {};
        THEMES.forEach((t) => { agg[t] = { applicable: 0, conforming: 0, majors: 0, minors: 0 }; });

        items.forEach((item) => {
            const theme = themeForClause(item?.clause, family);
            if (!theme || !agg[theme]) return;
            if (item?.status === 'na') return;
            agg[theme].applicable++;
            if (item?.status === 'conform') agg[theme].conforming++;
            if (item?.status === 'nc') {
                const t = (item?.ncrType || '').toLowerCase();
                if (t === 'major') agg[theme].majors++;
                else if (t === 'minor') agg[theme].minors++;
            }
        });

        const scores = {};
        THEMES.forEach((theme) => {
            const a = agg[theme];
            if (a.applicable === 0) { scores[theme] = null; return; } // no data for this theme
            const base = pct(a.conforming, a.applicable);
            const penalty = a.majors * 15 + a.minors * 6;
            scores[theme] = clamp(round(base - penalty), 0, 100);
        });
        return scores;
    }

    function computeMaturity(themeScores, items, family) {
        const maturity = {};
        let sum = 0, count = 0;
        Object.entries(MATURITY_DIMENSIONS).forEach(([dim, theme]) => {
            const raw = themeScores[theme];
            if (raw == null) { maturity[dim] = null; return; }
            // map 0-100 score -> 1-5 maturity band, roughly score/20, floor 1 if any data exists
            let level = clamp(Math.ceil(raw / 20), 1, 5);
            if (raw === 0) level = 1;
            maturity[dim] = level;
            sum += level; count++;
        });
        maturity.overall = count > 0 ? round(sum / count) : null;
        return maturity;
    }

    function departmentBreakdown(items) {
        const byDept = {};
        items.forEach((item) => {
            const dept = item?.department || 'Unassigned';
            if (!byDept[dept]) byDept[dept] = { name: dept, items: [] };
            byDept[dept].items.push(item);
        });
        return Object.values(byDept).map((d) => {
            const s = scoreItems(d.items);
            const ncCount = d.items.filter((i) => i?.status === 'nc').length;
            const majors = d.items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'major').length;
            let riskLevel = 'Low';
            if (majors > 0) riskLevel = 'High';
            else if (ncCount > 2) riskLevel = 'Medium';
            else if (ncCount > 0) riskLevel = 'Low';
            const maturityScore = clamp(Math.ceil(s.complianceScore / 20) - (majors > 0 ? 1 : 0), 1, 5);
            return {
                name: d.name,
                score: s.complianceScore,
                maturity: d.items.length ? maturityScore : null,
                findings: d.items.length,
                ncCount,
                riskLevel
            };
        }).sort((a, b) => (b.findings || 0) - (a.findings || 0));
    }

    function clauseIntelligence(items, report, allReports) {
        const byClause = {};
        items.forEach((item) => {
            const clause = item?.clause || 'General';
            if (!byClause[clause]) byClause[clause] = { clause, total: 0, conform: 0, nc: 0, major: 0, minor: 0, title: item?.kbMatch?.title || '' };
            const row = byClause[clause];
            if (item?.status === 'na') return;
            row.total++;
            if (item?.status === 'conform') row.conform++;
            if (item?.status === 'nc') {
                row.nc++;
                const t = (item?.ncrType || '').toLowerCase();
                if (t === 'major') row.major++;
                if (t === 'minor') row.minor++;
            }
        });
        const rows = Object.values(byClause);

        const mostFailed = rows.filter((r) => r.nc > 0)
            .sort((a, b) => (b.major * 2 + b.minor) - (a.major * 2 + a.minor) || b.nc - a.nc)
            .slice(0, 5);

        const mostSuccessful = rows.filter((r) => r.total > 0 && r.nc === 0 && r.conform === r.total)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // Recurring: clauses that failed in this audit AND in the most recent prior audit for same client.
        let recurring = [];
        try {
            const clientId = report?.clientId;
            const prevReports = (allReports || [])
                .filter((r) => r?.clientId === clientId && String(r?.id) !== String(report?.id))
                .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
            const prevReport = prevReports[0];
            if (prevReport) {
                const prevFailedClauses = new Set(
                    (prevReport.checklistProgress || [])
                        .filter((p) => p?.status === 'nc')
                        .map((p) => p?.clause)
                        .filter(Boolean)
                );
                recurring = rows
                    .filter((r) => r.nc > 0 && prevFailedClauses.has(r.clause))
                    .map((r) => Object.assign({}, r, { alsoFailedPrevious: true }))
                    .slice(0, 10);
            }
        } catch (_e) { /* defensive no-op */ }

        return { mostFailed, mostSuccessful, recurring };
    }

    function computeAuditScoreFromItems(items) {
        const s = scoreItems(items);
        const evidence = s.evidenceScore;
        // Weighted composite: compliance is the primary driver, risk (NC severity) second,
        // evidence quality a smaller supporting factor.
        const composite = (s.complianceScore * 0.55) + (s.riskScore * 0.35) + (evidence * 0.10);
        return clamp(round(composite), 0, 100);
    }

    function riskRatingFromCounts(major, minor) {
        if (major >= 3) return 'Critical';
        if (major >= 1) return 'High';
        if (minor >= 3) return 'Medium';
        if (minor >= 1) return 'Low';
        return 'Low';
    }

    function businessHealthFromScore(score) {
        if (score == null) return 'Insufficient data';
        if (score >= 90) return 'Excellent';
        if (score >= 75) return 'Good';
        if (score >= 55) return 'Fair';
        return 'Needs Attention';
    }

    function computeTrends(report, allReports, family) {
        const empty = { labels: [], majorNC: [], minorNC: [], obs: [], ofi: [], auditScore: [], capaOpen: [] };
        try {
            const clientId = report?.clientId;
            if (!clientId) return empty;
            const prevReports = (allReports || [])
                .filter((r) => r?.clientId === clientId && String(r?.id) !== String(report?.id))
                .sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0))
                .slice(-5);
            if (prevReports.length === 0) return empty;

            const out = { labels: [], majorNC: [], minorNC: [], obs: [], ofi: [], auditScore: [], capaOpen: [] };
            prevReports.forEach((r) => {
                const items = r.checklistProgress || [];
                const major = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'major').length;
                const minor = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'minor').length;
                const obs = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'observation').length;
                const ofi = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'ofi').length;
                const capaOpen = items.filter((i) => (i?.status === 'nc') && !!i?.caDueDate && !i?.caClosed).length
                    + (r.ncrs || []).filter((n) => !!n?.caDueDate && !n?.caClosed).length;
                out.labels.push(fmtDate(r.date || r.createdAt));
                out.majorNC.push(major);
                out.minorNC.push(minor);
                out.obs.push(obs);
                out.ofi.push(ofi);
                out.auditScore.push(computeAuditScoreFromItems(items));
                out.capaOpen.push(capaOpen);
            });
            return out;
        } catch (_e) { return empty; }
    }

    function compute(d) {
        const report = d?.report || {};
        const items = Array.isArray(d?.hydratedProgress) ? d.hydratedProgress : (Array.isArray(report.checklistProgress) ? report.checklistProgress : []);
        const family = standardFamily(report.standard || d?.auditPlan?.standard);
        const allReports = global.state?.auditReports || [];

        const overall = scoreItems(items);
        const themeScores = themeSubscores(items, family);
        const auditScore = computeAuditScoreFromItems(items);

        const breakdown = {};
        THEMES.forEach((t) => { breakdown[t] = themeScores[t]; });
        // Compliance / Risk / Evidence come from the aggregate item scores rather than a clause theme.
        breakdown.Compliance = overall.applicable > 0 ? overall.complianceScore : null;
        breakdown.Risk = overall.applicable > 0 ? overall.riskScore : null;
        breakdown.Evidence = overall.applicable > 0 ? overall.evidenceScore : null;

        const maturity = computeMaturity(themeScores, items, family);
        const departments = departmentBreakdown(items);
        const clauseIntel = clauseIntelligence(items, report, allReports);
        const trends = computeTrends(report, allReports, family);

        const stats = d?.stats || {};
        const majorNC = stats.majorNC ?? items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'major').length;
        const minorNC = stats.minorNC ?? items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'minor').length;

        const ncRanked = items
            .filter((i) => i?.status === 'nc' && ['major', 'minor'].includes((i?.ncrType || '').toLowerCase()))
            .sort((a, b) => {
                const weight = (i) => ((i?.ncrType || '').toLowerCase() === 'major' ? 2 : 1);
                return weight(b) - weight(a);
            })
            .slice(0, 5)
            .map((i) => ({
                title: (i?.kbMatch?.clause || i?.clause || 'General') + ' — ' + (i?.kbMatch?.title || i?.requirement || i?.comment || 'Non-conformity'),
                level: (i?.ncrType || 'Minor')
            }));

        const top5Priorities = clauseIntel.mostFailed.slice(0, 5).map((r) =>
            `Address recurring gaps in Clause ${r.clause}${r.title ? ' (' + r.title + ')' : ''} — ${r.nc} finding(s)`
        );
        if (top5Priorities.length === 0 && majorNC + minorNC === 0) {
            top5Priorities.push('Maintain current conformance levels through next surveillance cycle');
        }

        const execDashboard = {
            auditScore,
            maturityOverall: maturity.overall,
            riskRating: riskRatingFromCounts(majorNC, minorNC),
            certificationRecommendation: stats.recommendation || null,
            businessHealth: businessHealthFromScore(auditScore),
            compliancePct: overall.applicable > 0 ? overall.complianceScore : null,
            controlEffectiveness: breakdown.Operations,
            processEffectiveness: breakdown.Monitoring,
            top5Risks: ncRanked,
            top5Priorities
        };

        return { auditScore, breakdown, maturity, departments, clauseIntel, trends, execDashboard };
    }

    // ── HTML rendering helpers ────────────────────────────────────────────────
    function scorePillHtml(score) {
        if (score == null) return '<span style="color:#94a3b8;font-size:0.8rem;">—</span>';
        const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
        const bg = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2';
        return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.8rem;font-weight:700;color:${color};background:${bg};">${score}</span>`;
    }

    function maturityBarHtml(label, value) {
        const v = value == null ? 0 : clamp(value, 0, 5);
        const pctW = (v / 5) * 100;
        const color = v >= 4 ? '#16a34a' : v >= 3 ? '#2563eb' : v >= 2 ? '#d97706' : '#dc2626';
        return `
        <div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;font-weight:600;color:#334155;margin-bottom:4px;">
                <span>${esc(label)}</span><span style="color:${color};">${value == null ? 'N/A' : v.toFixed(1) + ' / 5'}</span>
            </div>
            <div style="background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden;">
                <div style="width:${value == null ? 0 : pctW}%;background:${color};height:100%;border-radius:6px;"></div>
            </div>
        </div>`;
    }

    function kpiCardHtml(label, value, suffix, color) {
        return `
        <div style="text-align:center;padding:20px 12px;background:white;border:1px solid #e2e8f0;border-top:4px solid ${color};border-radius:10px;">
            <div style="font-size:2.1rem;font-weight:800;color:${color};line-height:1;">${value == null ? '—' : value}${(value != null && suffix) ? `<span style="font-size:1rem;font-weight:600;color:#94a3b8;">${suffix}</span>` : ''}</div>
            <div style="font-size:0.7rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:8px;">${esc(label)}</div>
        </div>`;
    }

    function riskBadgeHtml(level) {
        const map = { Critical: '#7f1d1d', High: '#dc2626', Medium: '#d97706', Low: '#16a34a', Major: '#dc2626', Minor: '#d97706' };
        const color = map[level] || '#64748b';
        return `<span style="padding:2px 9px;border-radius:12px;font-size:0.75rem;font-weight:700;color:white;background:${color};">${esc(level || '—')}</span>`;
    }

    function insufficientDataHtml(msg) {
        return `<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-chart-simple" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>${esc(msg || 'Insufficient data available for this section.')}</div>`;
    }

    // ── Section builders ────────────────────────────────────────────────────
    function buildExecDashboardSection(metrics) {
        const ed = metrics.execDashboard || {};
        const riskColor = { Critical: '#7f1d1d', High: '#dc2626', Medium: '#d97706', Low: '#16a34a' }[ed.riskRating] || '#64748b';
        const healthColor = { Excellent: '#16a34a', Good: '#2563eb', Fair: '#d97706', 'Needs Attention': '#dc2626', 'Insufficient data': '#94a3b8' }[ed.businessHealth] || '#64748b';

        const kpis = `
        <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);">
            ${kpiCardHtml('Audit Score', ed.auditScore, '/100', '#2563eb')}
            ${kpiCardHtml('Maturity', ed.maturityOverall, '/5', '#7c3aed')}
            <div style="text-align:center;padding:20px 12px;background:white;border:1px solid #e2e8f0;border-top:4px solid ${riskColor};border-radius:10px;">
                <div style="font-size:1.4rem;font-weight:800;color:${riskColor};line-height:1;padding-top:6px;">${esc(ed.riskRating || '—')}</div>
                <div style="font-size:0.7rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:8px;">Risk Rating</div>
            </div>
            <div style="text-align:center;padding:20px 12px;background:white;border:1px solid #e2e8f0;border-top:4px solid ${healthColor};border-radius:10px;">
                <div style="font-size:1.15rem;font-weight:800;color:${healthColor};line-height:1.2;padding-top:8px;">${esc(ed.businessHealth || '—')}</div>
                <div style="font-size:0.7rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:8px;">Business Health</div>
            </div>
        </div>`;

        const risksList = (ed.top5Risks && ed.top5Risks.length)
            ? ed.top5Risks.map((r) => `<li style="margin-bottom:8px;font-size:0.85rem;color:#334155;display:flex;justify-content:space-between;gap:10px;"><span>${esc(r.title)}</span>${riskBadgeHtml(r.level)}</li>`).join('')
            : '<li style="color:#94a3b8;font-size:0.85rem;">No significant risks identified</li>';

        const prioritiesList = (ed.top5Priorities && ed.top5Priorities.length)
            ? ed.top5Priorities.map((p) => `<li style="margin-bottom:8px;font-size:0.85rem;color:#334155;">${esc(p)}</li>`).join('')
            : '<li style="color:#94a3b8;font-size:0.85rem;">No priority actions identified</li>';

        const lists = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:22px;">
            <div>
                <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#dc2626;margin-bottom:10px;border-bottom:2px solid #fee2e2;padding-bottom:6px;">Top 5 Risks</div>
                <ul style="list-style:none;margin:0;padding:0;">${risksList}</ul>
            </div>
            <div>
                <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#2563eb;margin-bottom:10px;border-bottom:2px solid #dbeafe;padding-bottom:6px;">Top 5 Priorities</div>
                <ul style="list-style:none;margin:0;padding:0;">${prioritiesList}</ul>
            </div>
        </div>`;

        const recLine = ed.certificationRecommendation
            ? `<div style="margin-top:18px;padding:12px 16px;background:#f8fafc;border-left:4px solid #4338ca;border-radius:0 6px 6px 0;font-size:0.85rem;"><strong>Certification Recommendation:</strong> ${esc(ed.certificationRecommendation)}</div>`
            : '';

        return { bodyHtml: kpis + lists + recLine, charts: [] };
    }

    function buildMaturitySection(metrics) {
        const m = metrics.maturity || {};
        const dims = Object.keys(MATURITY_DIMENSIONS);
        const hasAny = dims.some((k) => m[k] != null);
        if (!hasAny) return { bodyHtml: insufficientDataHtml('No maturity data could be derived from this audit\'s checklist coverage.'), charts: [] };

        const bars = dims.map((k) => maturityBarHtml(k, m[k])).join('');
        const headline = `<div style="text-align:center;margin-bottom:22px;padding:16px;background:#f5f3ff;border-radius:10px;">
            <div style="font-size:2.4rem;font-weight:800;color:#7c3aed;line-height:1;">${m.overall != null ? m.overall.toFixed(1) : '—'}<span style="font-size:1.1rem;color:#a78bfa;">/5</span></div>
            <div style="font-size:0.75rem;color:#6d28d9;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">Overall Management System Maturity</div>
        </div>`;

        const radarLabels = dims.filter((k) => m[k] != null);
        const radarData = radarLabels.map((k) => m[k]);
        const bodyHtml = headline + `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;">
            <div>${bars}</div>
            <div style="background:#f8fafc;border-radius:10px;padding:14px;">
                <canvas id="chart-maturity" style="max-height:280px;"></canvas>
            </div>
        </div>`;

        const chart = {
            canvasId: 'chart-maturity',
            configJson: JSON.stringify({
                type: 'radar',
                data: {
                    labels: radarLabels,
                    datasets: [{ label: 'Maturity (1-5)', data: radarData, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 2, pointBackgroundColor: '#7c3aed' }]
                },
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 5, ticks: { stepSize: 1, font: { size: 9 } }, pointLabels: { font: { size: 10 } } } } }
            })
        };

        return { bodyHtml, charts: radarLabels.length >= 3 ? [chart] : [] };
    }

    function buildDeptPerformanceSection(metrics) {
        const depts = metrics.departments || [];
        if (!depts.length) return { bodyHtml: insufficientDataHtml('No department data available. Assign departments to checklist items to populate this section.'), charts: [] };

        const rows = depts.map((d) => `
            <tr>
                <td style="font-weight:600;">${esc(d.name)}</td>
                <td style="text-align:center;">${d.findings}</td>
                <td style="text-align:center;">${d.ncCount}</td>
                <td style="text-align:center;">${scorePillHtml(d.score)}</td>
                <td style="text-align:center;">${d.maturity != null ? d.maturity.toFixed ? d.maturity.toFixed(1) : d.maturity : '—'}/5</td>
                <td style="text-align:center;">${riskBadgeHtml(d.riskLevel)}</td>
            </tr>`).join('');

        const bodyHtml = `<table class="f-tbl">
            <thead><tr><th>Department</th><th style="text-align:center;width:12%;">Items Audited</th><th style="text-align:center;width:10%;">Findings</th><th style="text-align:center;width:12%;">Score</th><th style="text-align:center;width:12%;">Maturity</th><th style="text-align:center;width:12%;">Risk</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;

        return { bodyHtml, charts: [] };
    }

    function buildClauseIntelSection(metrics) {
        const ci = metrics.clauseIntel || {};
        const mostFailed = ci.mostFailed || [];
        const mostSuccessful = ci.mostSuccessful || [];
        const recurring = ci.recurring || [];

        if (!mostFailed.length && !mostSuccessful.length && !recurring.length) {
            return { bodyHtml: insufficientDataHtml('No clause-level intelligence could be derived from this audit.'), charts: [] };
        }

        const failedTbl = mostFailed.length ? `
            <table class="f-tbl"><thead><tr><th style="width:20%;">Clause</th><th>Title</th><th style="text-align:center;width:15%;">Major</th><th style="text-align:center;width:15%;">Minor</th></tr></thead>
            <tbody>${mostFailed.map((r) => `<tr><td style="font-family:monospace;font-weight:700;color:#dc2626;">${esc(r.clause)}</td><td>${esc(r.title || '—')}</td><td style="text-align:center;">${r.major}</td><td style="text-align:center;">${r.minor}</td></tr>`).join('')}</tbody></table>`
            : insufficientDataHtml('No failed clauses recorded.');

        const successTbl = mostSuccessful.length ? `
            <table class="f-tbl"><thead><tr><th style="width:20%;">Clause</th><th>Title</th><th style="text-align:center;width:20%;">Items Verified</th></tr></thead>
            <tbody>${mostSuccessful.map((r) => `<tr><td style="font-family:monospace;font-weight:700;color:#16a34a;">${esc(r.clause)}</td><td>${esc(r.title || '—')}</td><td style="text-align:center;">${r.total}</td></tr>`).join('')}</tbody></table>`
            : insufficientDataHtml('No fully-conforming clauses recorded.');

        const recurringTbl = recurring.length ? `
            <table class="f-tbl"><thead><tr><th style="width:20%;">Clause</th><th>Title</th><th style="text-align:center;width:25%;">Status</th></tr></thead>
            <tbody>${recurring.map((r) => `<tr><td style="font-family:monospace;font-weight:700;color:#b45309;">${esc(r.clause)}</td><td>${esc(r.title || '—')}</td><td style="text-align:center;"><span style="padding:2px 9px;border-radius:12px;font-size:0.75rem;font-weight:700;color:#92400e;background:#fef3c7;">Also failed previous audit</span></td></tr>`).join('')}</tbody></table>`
            : `<div style="font-size:0.8rem;color:#94a3b8;padding:10px 0;">No recurring findings between this audit and the previous audit for this client.</div>`;

        const bodyHtml = `
        <div style="margin-bottom:22px;">
            <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#dc2626;margin-bottom:8px;">Most Failed Clauses</div>
            ${failedTbl}
        </div>
        <div style="margin-bottom:22px;">
            <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#16a34a;margin-bottom:8px;">Strongest Clauses</div>
            ${successTbl}
        </div>
        <div>
            <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#b45309;margin-bottom:8px;">Recurring Clauses</div>
            ${recurringTbl}
        </div>`;

        return { bodyHtml, charts: [] };
    }

    function buildTrendsSection(metrics) {
        const t = metrics.trends || {};
        const hasHistory = Array.isArray(t.labels) && t.labels.length > 0;
        if (!hasHistory) return null; // caller omits section entirely when no history

        const lastIdx = t.labels.length - 1;
        const compRows = `
            <tr><td>Major NC</td><td style="text-align:center;">${t.majorNC[lastIdx]}</td><td style="text-align:center;">${t.majorNC[lastIdx - 1] ?? '—'}</td></tr>
            <tr><td>Minor NC</td><td style="text-align:center;">${t.minorNC[lastIdx]}</td><td style="text-align:center;">${t.minorNC[lastIdx - 1] ?? '—'}</td></tr>
            <tr><td>Observations</td><td style="text-align:center;">${t.obs[lastIdx]}</td><td style="text-align:center;">${t.obs[lastIdx - 1] ?? '—'}</td></tr>
            <tr><td>OFI</td><td style="text-align:center;">${t.ofi[lastIdx]}</td><td style="text-align:center;">${t.ofi[lastIdx - 1] ?? '—'}</td></tr>
            <tr><td>Audit Score</td><td style="text-align:center;">${t.auditScore[lastIdx]}</td><td style="text-align:center;">${t.auditScore[lastIdx - 1] ?? '—'}</td></tr>
            <tr><td>Open CAPA</td><td style="text-align:center;">${t.capaOpen[lastIdx]}</td><td style="text-align:center;">${t.capaOpen[lastIdx - 1] ?? '—'}</td></tr>`;

        const bodyHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px;">
            <div style="background:#f8fafc;border-radius:10px;padding:14px;">
                <canvas id="chart-trend-findings" style="max-height:240px;"></canvas>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:14px;">
                <canvas id="chart-trend-score" style="max-height:240px;"></canvas>
            </div>
        </div>
        <table class="f-tbl">
            <thead><tr><th>Metric</th><th style="text-align:center;width:25%;">This Audit</th><th style="text-align:center;width:25%;">Previous Audit</th></tr></thead>
            <tbody>${compRows}</tbody>
        </table>`;

        const chartFindings = {
            canvasId: 'chart-trend-findings',
            configJson: JSON.stringify({
                type: 'line',
                data: {
                    labels: t.labels,
                    datasets: [
                        { label: 'Major NC', data: t.majorNC, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', tension: 0.3 },
                        { label: 'Minor NC', data: t.minorNC, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.3 },
                        { label: 'Observations', data: t.obs, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.3 },
                        { label: 'OFI', data: t.ofi, borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', tension: 0.3 }
                    ]
                },
                options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            })
        };
        const chartScore = {
            canvasId: 'chart-trend-score',
            configJson: JSON.stringify({
                type: 'line',
                data: { labels: t.labels, datasets: [{ label: 'Audit Score', data: t.auditScore, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', tension: 0.3, fill: true }] },
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
            })
        };

        return { bodyHtml, charts: [chartFindings, chartScore] };
    }

    function sections(d) {
        const metrics = compute(d);
        const out = [];

        const exec = buildExecDashboardSection(metrics);
        out.push({ key: 'exec-dashboard', name: 'EXECUTIVE DASHBOARD', desc: 'Score, maturity, risk rating and top priorities at a glance', color: '#4338ca', bodyHtml: exec.bodyHtml, charts: exec.charts });

        const mat = buildMaturitySection(metrics);
        out.push({ key: 'maturity', name: 'MANAGEMENT MATURITY ASSESSMENT', desc: 'Maturity level per management system dimension', color: '#7c3aed', bodyHtml: mat.bodyHtml, charts: mat.charts });

        const dept = buildDeptPerformanceSection(metrics);
        out.push({ key: 'dept-performance', name: 'DEPARTMENT PERFORMANCE', desc: 'Score, maturity and risk by department', color: '#0891b2', bodyHtml: dept.bodyHtml, charts: dept.charts });

        const clause = buildClauseIntelSection(metrics);
        out.push({ key: 'clause-intel', name: 'CLAUSE INTELLIGENCE', desc: 'Most failed, strongest and recurring clauses', color: '#dc2626', bodyHtml: clause.bodyHtml, charts: clause.charts });

        const trend = buildTrendsSection(metrics);
        if (trend) {
            out.push({ key: 'trends', name: 'TREND ANALYSIS', desc: 'Findings and score trend across prior audits for this client', color: '#059669', bodyHtml: trend.bodyHtml, charts: trend.charts });
        }

        return out;
    }

    function sectionsPreviewToggles() {
        return [
            { id: 'exec-dashboard', label: 'Exec Dashboard', icon: 'fa-gauge-high', color: '#4338ca' },
            { id: 'maturity', label: 'Maturity', icon: 'fa-layer-group', color: '#7c3aed' },
            { id: 'dept-performance', label: 'Dept Performance', icon: 'fa-building', color: '#0891b2' },
            { id: 'clause-intel', label: 'Clause Intel', icon: 'fa-magnifying-glass-chart', color: '#dc2626' },
            { id: 'trends', label: 'Trends', icon: 'fa-arrow-trend-up', color: '#059669' }
        ];
    }

    global.ReportScoring = { compute, sections, sectionsPreviewToggles };
})(window);
