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
 *                      'Document Control', Training, 'Internal Audit', overall,
 *                      interpretation } (1-5 each, interpretation is a headline string),
 *       departments: [{ name, score, maturity, findings, ncCount, riskLevel, scoreDelta, needsAttention }],
 *       clauseIntel: { mostFailed:[...], mostSuccessful:[...], recurring:[...], table:[...] },
 *       trends:      { labels, majorNC:[], minorNC:[], obs:[], ofi:[], auditScore:[], capaOpen:[] },
 *       execDashboard: { auditScore, maturityOverall, riskRating, certificationRecommendation,
 *                        businessHealth, compliancePct, controlEffectiveness, processEffectiveness,
 *                        majorNC, minorNC, obsCount, ofiCount, capaProgress,
 *                        deltas: { auditScore, maturity, compliance, majorNC, minorNC, obs, ofi, capaProgress },
 *                        hasPrior: boolean,
 *                        top5Risks:[{title,level}], top5Priorities:[string] }
 *     }
 *
 *   sections(d) -> [{ key, name, desc, color, bodyHtml, charts:[{canvasId, configJson}] }, ...]
 *     Section keys (in order): 'exec-dashboard', 'maturity', 'dept-performance',
 *     'clause-intel', 'trends' (only when prior reports exist for the client).
 *     Markup targets the shared Big-Four design system exposed by
 *     report-executive.js's bigFourCss() (.b4-kpi-card/.b4-kpi-grid/.b4-tbl/
 *     .b4-badge/.b4-bar/.b4-card/.b4-callout/.b4-chart-box, etc.) with inline-style
 *     fallbacks so markup still reads correctly if a class isn't defined.
 *     Chart configs are plain Chart.js v4 config objects pre-serialized to JSON
 *     strings so the integrator can splice them into the print-blob chart script
 *     alongside the existing c1..c7 charts.
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

    // ── Muted, desaturated "Power BI" palette (used across all Chart.js configs) ──
    const PALETTE = {
        emerald: '#4c8c6f',
        emeraldFill: 'rgba(76,140,111,0.14)',
        amber: '#b8863c',
        amberFill: 'rgba(184,134,60,0.14)',
        red: '#b0524b',
        redFill: 'rgba(176,82,75,0.14)',
        blue: '#4a6f94',
        blueFill: 'rgba(74,111,148,0.14)',
        slate: '#64748b',
        slateFill: 'rgba(100,116,139,0.12)',
        purple: '#6d6398',
        purpleFill: 'rgba(109,99,152,0.14)',
        grid: 'rgba(15,23,42,0.06)'
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

    // Minimum applicable-item sample required before a dimension/department score is
    // published as a hard number. Below this, we show "insufficient sample" rather
    // than let 1-2 items swing a headline score to 1.0 or 5.0.
    const MIN_SAMPLE_N = 3;
    // James-Stein-style shrinkage strength: larger k pulls small samples harder
    // toward the audit-wide mean; effect fades out as n grows.
    const SHRINK_K = 5;

    function shrinkToward(raw, n, mean, k) {
        if (raw == null || mean == null) return raw;
        const w = n / (n + (k == null ? SHRINK_K : k));
        return clamp(round(mean + w * (raw - mean)), 0, 100);
    }

    function pluralize(n, singular, plural) {
        const count = n || 0;
        return `${count} ${count === 1 ? singular : (plural || singular + 's')}`;
    }

    const MATURITY_INTERPRETATION = {
        1: 'Level 1 — Initial: processes are ad hoc, undocumented and dependent on individuals.',
        2: 'Level 2 — Developing: basic processes exist but are applied inconsistently across the organization.',
        3: 'Level 3 — Defined: processes are documented, standardized and communicated organization-wide.',
        4: 'Level 4 — Managed: processes are monitored and measured, with data used to drive decisions.',
        5: 'Level 5 — Optimized: continual improvement is embedded and performance reflects leading practice.'
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

        // Returns { scores: {theme:0-100|null}, counts: {theme:n} } — counts are
        // needed downstream to gate/shrink small-sample dimension scores.
        const scores = {}; const counts = {};
        THEMES.forEach((theme) => {
            const a = agg[theme];
            counts[theme] = a.applicable;
            if (a.applicable === 0) { scores[theme] = null; return; } // no data for this theme
            const base = pct(a.conforming, a.applicable);
            const penalty = a.majors * 15 + a.minors * 6;
            scores[theme] = clamp(round(base - penalty), 0, 100);
        });
        return { scores, counts };
    }

    // globalMean: audit-wide compliance % used as the shrinkage prior so tiny
    // samples (n < MIN_SAMPLE_N) can't produce false 1.0/5.0 extremes.
    function computeMaturity(themeAgg, globalMean) {
        const maturity = {};
        const meta = {};
        let sum = 0, count = 0;
        Object.entries(MATURITY_DIMENSIONS).forEach(([dim, theme]) => {
            const raw = themeAgg.scores[theme];
            const n = themeAgg.counts[theme] || 0;
            if (raw == null || n === 0) { maturity[dim] = null; meta[dim] = { n: 0, insufficient: true }; return; }
            if (n < MIN_SAMPLE_N) { maturity[dim] = null; meta[dim] = { n, insufficient: true }; return; }
            const shrunk = shrinkToward(raw, n, globalMean);
            let level = clamp(Math.ceil(shrunk / 20), 1, 5);
            if (shrunk === 0) level = 1;
            maturity[dim] = level;
            meta[dim] = { n, insufficient: false, raw, shrunk };
            sum += level; count++;
        });
        maturity.overall = count > 0 ? round(sum / count) : null;
        maturity.interpretation = maturity.overall != null ? (MATURITY_INTERPRETATION[clamp(Math.round(maturity.overall), 1, 5)] || null) : null;
        maturity.meta = meta;
        return maturity;
    }

    // globalMean: audit-wide (or prior-audit-wide) compliance % — same shrinkage
    // prior used for maturity dimensions, applied here to department scores.
    const UNASSIGNED_LABEL = 'Unassigned / Cross-functional';
    // Older releases stored the literal placeholder "Unassigned" (and "General") as a
    // department name, so those strings live in existing audit data — not just in this
    // module's fallback. Normalize them here so a board report never prints a bare
    // placeholder as if it were a real business unit.
    function normalizeDeptName(raw) {
        const s = String(raw == null ? '' : raw).trim();
        if (!s) return UNASSIGNED_LABEL;
        if (/^(unassigned|general|n\/?a|none|other)$/i.test(s)) return UNASSIGNED_LABEL;
        return s;
    }

    function departmentBreakdown(items, globalMean) {
        const byDept = {};
        items.forEach((item) => {
            const dept = normalizeDeptName(item?.department);
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
            const n = s.applicable;
            const insufficientSample = n < MIN_SAMPLE_N;
            const score = insufficientSample ? null : shrinkToward(s.complianceScore, n, globalMean);
            const maturityScore = (!insufficientSample && score != null) ? clamp(Math.ceil(score / 20) - (majors > 0 ? 1 : 0), 1, 5) : null;
            return {
                name: d.name,
                score,
                n,
                insufficientSample,
                maturity: maturityScore,
                findings: d.items.length,
                ncCount,
                majors,
                riskLevel,
                needsAttention: majors > 0 || (score != null && score < 60)
            };
        }).sort((a, b) => (b.findings || 0) - (a.findings || 0));
    }

    // Most common (mode) department name amongst a set of checklist items.
    function modeDepartment(items) {
        const counts = {};
        items.forEach((i) => {
            const dep = i?.department;
            if (!dep) return;
            counts[dep] = (counts[dep] || 0) + 1;
        });
        let best = null, bestCount = 0;
        Object.entries(counts).forEach(([dep, c]) => { if (c > bestCount) { best = dep; bestCount = c; } });
        return best;
    }

    function clauseIntelligence(items, report, allReports) {
        const byClause = {};
        items.forEach((item) => {
            const clause = item?.clause || 'General';
            if (!byClause[clause]) byClause[clause] = { clause, total: 0, conform: 0, nc: 0, major: 0, minor: 0, title: item?.kbMatch?.title || '', items: [] };
            const row = byClause[clause];
            row.items.push(item);
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
        let recurringSet = new Set();
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
                recurringSet = new Set(recurring.map((r) => r.clause));
            }
        } catch (_e) { /* defensive no-op */ }

        // Unified intelligence table: Clause / Title / Compliance% / Risk / Department / Priority / Status
        const table = rows.map((r) => {
            const compliancePct = pct(r.conform, r.total);
            const isRecurring = recurringSet.has(r.clause);
            let status = 'Conforming';
            if (isRecurring) status = 'Recurring';
            else if (r.major > 0) status = 'Critical';
            else if (r.minor > 0) status = 'Attention';

            let priority = 'Low';
            if (isRecurring || r.major > 0) priority = 'High';
            else if (r.minor >= 2) priority = 'Medium';
            else if (r.minor >= 1) priority = 'Low';
            else priority = '—';

            let risk = 'Low';
            if (r.major > 0) risk = 'High';
            else if (r.minor > 1) risk = 'Medium';
            else if (r.minor > 0) risk = 'Low';

            return {
                clause: r.clause,
                title: r.title,
                compliancePct: r.total > 0 ? compliancePct : null,
                risk,
                department: normalizeDeptName(modeDepartment(r.items)),
                priority,
                status,
                isRecurring,
                major: r.major,
                minor: r.minor
            };
        }).sort((a, b) => {
            const sevOrder = { Recurring: 0, Critical: 1, Attention: 2, Conforming: 3 };
            const sd = (sevOrder[a.status] ?? 9) - (sevOrder[b.status] ?? 9);
            if (sd !== 0) return sd;
            return (a.compliancePct ?? 100) - (b.compliancePct ?? 100);
        });

        return { mostFailed, mostSuccessful, recurring, table };
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

    const RISK_ORDER = { Low: 0, Medium: 1, High: 2, Critical: 3 };

    // Risk rating can never contradict the underlying findings: a recurring
    // finding floors it at Medium; any department already at Medium/High risk
    // floors the overall rating to match, so the headline KPI can't say "Low"
    // while a department table two sections later says "Medium"/"High".
    function deriveRiskRating(major, minor, hasRecurring, departments, auditScore) {
        let rating = riskRatingFromCounts(major, minor);
        let floor = hasRecurring ? 'Medium' : 'Low';
        const deptMax = (departments || []).reduce((max, d) => (RISK_ORDER[d.riskLevel] > RISK_ORDER[max] ? d.riskLevel : max), 'Low');
        if (RISK_ORDER[deptMax] > RISK_ORDER[floor]) floor = deptMax;
        // The headline KPI row is read as one statement: a weak overall score cannot
        // sit beside a "Low" risk rating without the report contradicting itself.
        if (typeof auditScore === 'number' && !isNaN(auditScore)) {
            const scoreFloor = auditScore < 55 ? 'High' : auditScore < 75 ? 'Medium' : 'Low';
            if (RISK_ORDER[scoreFloor] > RISK_ORDER[floor]) floor = scoreFloor;
        }
        if (RISK_ORDER[floor] > RISK_ORDER[rating]) rating = floor;
        return rating;
    }

    // Fills from the best available signal so the list is never suspiciously
    // shorter than "Top 5 Priorities" just because few items happen to be
    // typed as major/minor: major NC -> minor NC -> recurring clause -> observation.
    function buildTop5Risks(items, clauseIntel) {
        const pool = [];
        const label = (i, fallback) => (i?.kbMatch?.clause || i?.clause || 'General') + ' — ' + (i?.kbMatch?.title || i?.requirement || i?.comment || fallback);
        items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'major')
            .forEach((i) => pool.push({ title: label(i, 'Non-conformity'), level: 'Major', clause: i?.clause }));
        items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'minor')
            .forEach((i) => pool.push({ title: label(i, 'Non-conformity'), level: 'Minor', clause: i?.clause }));
        (clauseIntel?.recurring || []).forEach((r) => {
            if (pool.some((p) => p.clause === r.clause)) return; // already represented via a major/minor row
            pool.push({ title: `Clause ${r.clause}${r.title ? ' — ' + r.title : ''} (recurring from previous audit)`, level: 'Recurring', clause: r.clause });
        });
        items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'observation')
            .forEach((i) => pool.push({ title: label(i, 'Observation'), level: 'Observation', clause: i?.clause }));
        return { list: pool.slice(0, 5).map((p) => ({ title: p.title, level: p.level })), total: pool.length };
    }

    // Specific, action-oriented priorities referencing clause title + department,
    // instead of the repetitive "Address recurring gaps in Clause X — N finding(s)".
    function buildTop5Priorities(clauseIntel) {
        const rows = (clauseIntel?.table || []).filter((r) => r.status !== 'Conforming');
        const list = rows.slice(0, 5).map((r) => {
            const verb = r.status === 'Recurring' ? 'Resolve recurring gaps in' : (r.major > 0 ? 'Close major non-conformities in' : 'Address non-conformity gaps in');
            const deptPart = r.department && !String(r.department).startsWith('Unassigned') ? ` ${r.department}` : '';
            const clausePart = `Clause ${r.clause}${r.title ? ' — ' + r.title : ''}`;
            const parts = [];
            if (r.major) parts.push(pluralize(r.major, 'major NC'));
            if (r.minor) parts.push(pluralize(r.minor, 'minor NC'));
            const findingsPart = parts.length ? parts.join(', ') : 'unresolved finding';
            const recurringPart = r.isRecurring ? ', recurring from previous audit' : '';
            return `${verb}${deptPart} (${clausePart}) — ${findingsPart}${recurringPart}`;
        });
        return { list, total: rows.length };
    }

    function countNoteHtml(shownLen, total, noun) {
        if (!total) return '';
        if (total < 5) return `<div style="font-size:0.68rem;color:#94a3b8;margin-top:6px;">${pluralize(total, noun)} identified</div>`;
        if (total > shownLen) return `<div style="font-size:0.68rem;color:#94a3b8;margin-top:6px;">Showing top ${shownLen} of ${pluralize(total, noun)}</div>`;
        return '';
    }

    function businessHealthFromScore(score) {
        if (score == null) return 'Insufficient data';
        if (score >= 90) return 'Excellent';
        if (score >= 75) return 'Good';
        if (score >= 55) return 'Fair';
        return 'Needs Attention';
    }

    function capaProgressFromItems(items, ncrs) {
        const capaItems = (items || []).filter((i) => i?.status === 'nc' && !!i?.caDueDate);
        const capaNcrs = (ncrs || []).filter((n) => !!n?.caDueDate);
        const total = capaItems.length + capaNcrs.length;
        if (total === 0) return null; // no CAPA data — omit card gracefully
        const closed = capaItems.filter((i) => !!i?.caClosed).length + capaNcrs.filter((n) => !!n?.caClosed).length;
        return pct(closed, total);
    }

    function getPrevReport(report, allReports) {
        try {
            const clientId = report?.clientId;
            if (!clientId) return null;
            const prevReports = (allReports || [])
                .filter((r) => r?.clientId === clientId && String(r?.id) !== String(report?.id))
                .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
            return prevReports[0] || null;
        } catch (_e) { return null; }
    }

    function priorSnapshot(prevReport, family) {
        if (!prevReport) return null;
        try {
            const items = prevReport.checklistProgress || [];
            const s = scoreItems(items);
            const priorMean = s.applicable > 0 ? s.complianceScore : null;
            const themeAgg = themeSubscores(items, family);
            const maturity = computeMaturity(themeAgg, priorMean);
            const departments = departmentBreakdown(items, priorMean);
            const majorNC = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'major').length;
            const minorNC = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'minor').length;
            const obsCount = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'observation').length;
            const ofiCount = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'ofi').length;
            const capaProgress = capaProgressFromItems(items, prevReport.ncrs);
            return {
                auditScore: computeAuditScoreFromItems(items),
                compliancePct: s.applicable > 0 ? s.complianceScore : null,
                maturityOverall: maturity.overall,
                departments,
                majorNC, minorNC, obsCount, ofiCount, capaProgress
            };
        } catch (_e) { return null; }
    }

    function delta(curr, prev) {
        if (curr == null || prev == null) return null;
        return round(curr - prev);
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
        const globalMean = overall.applicable > 0 ? overall.complianceScore : null;
        const themeAgg = themeSubscores(items, family);
        const auditScore = computeAuditScoreFromItems(items);

        const breakdown = {};
        THEMES.forEach((t) => { breakdown[t] = themeAgg.scores[t]; });
        // Compliance / Risk / Evidence come from the aggregate item scores rather than a clause theme.
        breakdown.Compliance = overall.applicable > 0 ? overall.complianceScore : null;
        breakdown.Risk = overall.applicable > 0 ? overall.riskScore : null;
        breakdown.Evidence = overall.applicable > 0 ? overall.evidenceScore : null;

        const maturity = computeMaturity(themeAgg, globalMean);

        // Prior-audit snapshot for real trend deltas (per-metric, per-department).
        const prevReport = getPrevReport(report, allReports);
        const prior = priorSnapshot(prevReport, family);
        const prevDeptByName = {};
        (prior?.departments || []).forEach((pd) => { prevDeptByName[pd.name] = pd; });

        const departments = departmentBreakdown(items, globalMean).map((dep) => {
            const prevDep = prevDeptByName[dep.name];
            return Object.assign({}, dep, {
                scoreDelta: (prevDep && dep.score != null && prevDep.score != null) ? delta(dep.score, prevDep.score) : null,
                hasTrend: !!prevDep
            });
        }).sort((a, b) => {
            // "Unassigned / Cross-functional" always sorts last regardless of score.
            const aUn = a.name === UNASSIGNED_LABEL;
            const bUn = b.name === UNASSIGNED_LABEL;
            if (aUn !== bUn) return aUn ? 1 : -1;
            // Worst-first: needs-attention first, then ascending score.
            if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
            return (a.score ?? 100) - (b.score ?? 100);
        });

        const clauseIntel = clauseIntelligence(items, report, allReports);
        const trends = computeTrends(report, allReports, family);

        const stats = d?.stats || {};
        const majorNC = stats.majorNC ?? items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'major').length;
        const minorNC = stats.minorNC ?? items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'minor').length;
        const obsCount = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'observation').length;
        const ofiCount = items.filter((i) => i?.status === 'nc' && (i?.ncrType || '').toLowerCase() === 'ofi').length;
        const capaProgress = capaProgressFromItems(items, report.ncrs);

        const risksBuilt = buildTop5Risks(items, clauseIntel);
        const prioritiesBuilt = buildTop5Priorities(clauseIntel);
        let top5Priorities = prioritiesBuilt.list;
        if (top5Priorities.length === 0 && majorNC + minorNC === 0) {
            top5Priorities = ['Maintain current conformance levels through next surveillance cycle'];
        }

        const compliancePct = overall.applicable > 0 ? overall.complianceScore : null;
        const hasRecurring = (clauseIntel.recurring || []).length > 0;

        const execDashboard = {
            auditScore,
            maturityOverall: maturity.overall,
            riskRating: deriveRiskRating(majorNC, minorNC, hasRecurring, departments, auditScore),
            certificationRecommendation: stats.recommendation || null,
            businessHealth: businessHealthFromScore(auditScore),
            compliancePct,
            controlEffectiveness: breakdown.Operations,
            processEffectiveness: breakdown.Monitoring,
            majorNC, minorNC, obsCount, ofiCount, capaProgress,
            hasPrior: !!prior,
            deltas: {
                auditScore: prior ? delta(auditScore, prior.auditScore) : null,
                maturity: prior ? delta(maturity.overall, prior.maturityOverall) : null,
                compliance: prior ? delta(compliancePct, prior.compliancePct) : null,
                majorNC: prior ? delta(majorNC, prior.majorNC) : null,
                minorNC: prior ? delta(minorNC, prior.minorNC) : null,
                obs: prior ? delta(obsCount, prior.obsCount) : null,
                ofi: prior ? delta(ofiCount, prior.ofiCount) : null,
                capaProgress: (prior && capaProgress != null && prior.capaProgress != null) ? delta(capaProgress, prior.capaProgress) : null
            },
            top5Risks: risksBuilt.list,
            risksTotal: risksBuilt.total,
            top5Priorities,
            prioritiesTotal: prioritiesBuilt.total
        };

        return { auditScore, breakdown, maturity, departments, clauseIntel, trends, execDashboard };
    }

    // ── HTML rendering helpers ────────────────────────────────────────────────
    function scorePillHtml(score) {
        if (score == null) return '<span style="color:#94a3b8;font-size:0.8rem;">—</span>';
        const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
        const bg = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2';
        return `<span class="b4-badge" style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.8rem;font-weight:700;color:${color};background:${bg};white-space:nowrap;">${score}</span>`;
    }

    function barHtml(valuePct, color) {
        const v = clamp(valuePct == null ? 0 : valuePct, 0, 100);
        return `<div class="b4-bar" style="background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden;min-width:70px;">
            <div class="b4-bar-fill" style="width:${v}%;background:${color};height:100%;border-radius:6px;"></div>
        </div>`;
    }

    function maturityBarHtml(label, value, meta) {
        const n = meta?.n ?? 0;
        if (value == null) {
            const reason = meta?.insufficient ? `N/A — insufficient sample (n=${n})` : 'N/A';
            return `
            <div style="margin-bottom:14px;break-inside:avoid;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;font-weight:600;color:#334155;margin-bottom:4px;gap:8px;">
                    <span>${esc(label)}</span>
                    <span class="b4-badge" style="color:#94a3b8;background:#f1f5f9;padding:1px 8px;border-radius:10px;font-weight:700;font-size:0.7rem;white-space:nowrap;">${esc(reason)}</span>
                </div>
                <div class="b4-maturity-bar b4-bar" style="background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden;"><div style="width:0;height:100%;"></div></div>
            </div>`;
        }
        const v = clamp(value, 0, 5);
        const pctW = (v / 5) * 100;
        const color = v >= 4 ? '#16a34a' : v >= 3 ? '#2563eb' : v >= 2 ? '#d97706' : '#dc2626';
        return `
        <div style="margin-bottom:14px;break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;font-weight:600;color:#334155;margin-bottom:4px;gap:8px;">
                <span>${esc(label)} <span style="color:#94a3b8;font-weight:500;font-size:0.68rem;">(n=${n})</span></span>
                <span class="b4-badge" style="color:${color};background:${color}15;padding:1px 8px;border-radius:10px;font-weight:800;white-space:nowrap;">${v.toFixed(1)}/5</span>
            </div>
            <div class="b4-maturity-bar b4-bar" style="background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden;">
                <div class="b4-maturity-bar-fill b4-bar-fill" style="width:${pctW}%;background:${color};height:100%;border-radius:6px;"></div>
            </div>
        </div>`;
    }

    // Direction: 'higherBetter' | 'lowerBetter' | 'neutral'
    function trendHtml(deltaVal, direction, suffix) {
        suffix = suffix || '';
        if (deltaVal == null) {
            return '<span class="b4-kpi-trend flat" style="color:#94a3b8;font-weight:700;">— vs previous audit</span>';
        }
        const dirClass = deltaVal > 0 ? 'up' : deltaVal < 0 ? 'down' : 'flat';
        const arrow = deltaVal > 0 ? '▲' : deltaVal < 0 ? '▼' : '■';
        let color = '#64748b';
        if (direction === 'higherBetter') color = deltaVal > 0 ? '#16a34a' : deltaVal < 0 ? '#dc2626' : '#64748b';
        else if (direction === 'lowerBetter') color = deltaVal < 0 ? '#16a34a' : deltaVal > 0 ? '#dc2626' : '#64748b';
        const magnitude = Math.abs(deltaVal);
        return `<span class="b4-kpi-trend ${dirClass}" style="color:${color};font-weight:700;">${arrow} ${magnitude}${suffix} vs previous</span>`;
    }

    function kpiCardHtml(opts) {
        const { icon, label, value, suffix, sub, color, deltaVal, direction, deltaSuffix, isText } = opts;
        const valHtml = value == null
            ? '—'
            : (isText
                ? esc(String(value))
                : `${value}${suffix ? `<span style="font-size:0.95rem;font-weight:600;color:#94a3b8;">${suffix}</span>` : ''}`);
        return `
        <div class="b4-kpi-card" style="break-inside:avoid;text-align:center;padding:18px 12px;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${color};border-radius:6px;">
            ${icon ? `<div class="b4-kpi-icon" style="font-size:1rem;color:${color};margin-bottom:6px;opacity:0.85;"><i class="fa-solid ${icon}"></i></div>` : ''}
            <div class="b4-kpi-value" style="font-size:${isText ? '1.15rem' : '1.9rem'};font-weight:800;color:${color};line-height:1.15;">${valHtml}</div>
            <div class="b4-kpi-label" style="font-size:0.68rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:7px;">${esc(label)}</div>
            ${sub ? `<div class="b4-kpi-sub" style="font-size:0.7rem;color:#94a3b8;margin-top:2px;">${esc(sub)}</div>` : ''}
            <div style="margin-top:8px;font-size:0.68rem;">${trendHtml(deltaVal, direction, deltaSuffix)}</div>
        </div>`;
    }

    function riskBadgeHtml(level) {
        const map = { Critical: '#7f1d1d', High: '#dc2626', Medium: '#d97706', Low: '#16a34a', Major: '#dc2626', Minor: '#d97706' };
        const color = map[level] || '#64748b';
        return `<span class="b4-badge" style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:0.75rem;font-weight:700;color:white;background:${color};white-space:nowrap;">${esc(level || '—')}</span>`;
    }

    function statusBadgeHtml(status) {
        const map = { Recurring: '#7f1d1d', Critical: '#dc2626', Attention: '#d97706', Conforming: '#16a34a' };
        const color = map[status] || '#64748b';
        return `<span class="b4-badge" style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:0.72rem;font-weight:700;color:white;background:${color};white-space:nowrap;">${esc(status || '—')}</span>`;
    }

    function insufficientDataHtml(msg) {
        return `<div class="b4-card" style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;border:1px dashed #e2e8f0;border-radius:8px;"><i class="fa-solid fa-chart-simple" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>${esc(msg || 'Insufficient data available for this section.')}</div>`;
    }

    // ── Section builders ────────────────────────────────────────────────────
    function buildExecDashboardSection(metrics) {
        const ed = metrics.execDashboard || {};
        const dl = ed.deltas || {};
        const riskColor = { Critical: '#7f1d1d', High: '#dc2626', Medium: '#d97706', Low: '#16a34a' }[ed.riskRating] || '#64748b';

        const cards = [
            kpiCardHtml({ icon: 'fa-gauge-high', label: 'Overall Audit Score', value: ed.auditScore, suffix: '/100', color: '#2563eb', deltaVal: dl.auditScore, direction: 'higherBetter' }),
            kpiCardHtml({ icon: 'fa-certificate', label: 'Certification Recommendation', value: ed.certificationRecommendation || 'Pending', color: '#4338ca', isText: true }),
            kpiCardHtml({ icon: 'fa-layer-group', label: 'Maturity Score', value: ed.maturityOverall, suffix: '/5', color: '#7c3aed', deltaVal: dl.maturity, direction: 'higherBetter' }),
            kpiCardHtml({ icon: 'fa-check-circle', label: 'Compliance %', value: ed.compliancePct, suffix: '%', color: '#0891b2', deltaVal: dl.compliance, direction: 'higherBetter', deltaSuffix: 'pt' }),
            kpiCardHtml({ icon: 'fa-triangle-exclamation', label: 'Risk Rating', value: ed.riskRating, color: riskColor, isText: true }),
            kpiCardHtml({ icon: 'fa-circle-exclamation', label: 'Major NC', value: ed.majorNC, color: '#dc2626', deltaVal: dl.majorNC, direction: 'lowerBetter' }),
            kpiCardHtml({ icon: 'fa-circle-minus', label: 'Minor NC', value: ed.minorNC, color: '#d97706', deltaVal: dl.minorNC, direction: 'lowerBetter' }),
            kpiCardHtml({ icon: 'fa-eye', label: 'Observations', value: ed.obsCount, color: '#3b82f6', deltaVal: dl.obs, direction: 'neutral' }),
            kpiCardHtml({ icon: 'fa-lightbulb', label: 'OFIs', value: ed.ofiCount, color: '#06b6d4', deltaVal: dl.ofi, direction: 'neutral' })
        ];
        if (ed.capaProgress != null) {
            cards.push(kpiCardHtml({ icon: 'fa-list-check', label: 'CAPA Progress', value: ed.capaProgress, suffix: '%', color: '#16a34a', deltaVal: dl.capaProgress, direction: 'higherBetter', deltaSuffix: 'pt' }));
        }

        const kpis = `<div class="b4-kpi-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">${cards.join('')}</div>`;

        const risksList = (ed.top5Risks && ed.top5Risks.length)
            ? ed.top5Risks.map((r, idx) => `<li style="margin-bottom:8px;font-size:0.83rem;color:#334155;display:flex;align-items:center;justify-content:space-between;gap:10px;break-inside:avoid;">
                <span><span style="display:inline-block;width:18px;color:#94a3b8;font-weight:700;">${idx + 1}.</span>${esc(r.title)}</span>${riskBadgeHtml(r.level)}</li>`).join('')
            : '<li style="color:#94a3b8;font-size:0.85rem;">No significant risks identified</li>';

        const prioritiesList = (ed.top5Priorities && ed.top5Priorities.length)
            ? ed.top5Priorities.map((p, idx) => `<li style="margin-bottom:8px;font-size:0.83rem;color:#334155;break-inside:avoid;"><span style="display:inline-block;width:18px;color:#94a3b8;font-weight:700;">${idx + 1}.</span>${esc(p)}</li>`).join('')
            : '<li style="color:#94a3b8;font-size:0.85rem;">No priority actions identified</li>';

        const risksNote = countNoteHtml((ed.top5Risks || []).length, ed.risksTotal || (ed.top5Risks || []).length, 'risk');
        const prioritiesNote = countNoteHtml((ed.top5Priorities || []).length, ed.prioritiesTotal || (ed.top5Priorities || []).length, 'priority action');

        const lists = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:22px;">
            <div class="b4-card" style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;break-inside:avoid;">
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#dc2626;margin-bottom:10px;border-bottom:2px solid #fee2e2;padding-bottom:6px;">Top 5 Risks</div>
                <ul style="list-style:none;margin:0;padding:0;">${risksList}</ul>
                ${risksNote}
            </div>
            <div class="b4-card" style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;break-inside:avoid;">
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#2563eb;margin-bottom:10px;border-bottom:2px solid #dbeafe;padding-bottom:6px;">Top 5 Priorities</div>
                <ul style="list-style:none;margin:0;padding:0;">${prioritiesList}</ul>
                ${prioritiesNote}
            </div>
        </div>`;

        const recLine = ed.certificationRecommendation
            ? `<div class="b4-callout" style="margin-top:18px;padding:12px 16px;background:#f8fafc;border-left:4px solid #4338ca;border-radius:0 6px 6px 0;font-size:0.85rem;"><strong>Certification Recommendation:</strong> ${esc(ed.certificationRecommendation)}</div>`
            : '';

        return { bodyHtml: kpis + lists + recLine, charts: [] };
    }

    function buildMaturitySection(metrics) {
        const m = metrics.maturity || {};
        const dims = Object.keys(MATURITY_DIMENSIONS);
        const hasAny = dims.some((k) => (m.meta?.[k]?.n || 0) > 0);
        if (!hasAny) return { bodyHtml: insufficientDataHtml('No maturity data could be derived from this audit\'s checklist coverage.'), charts: [] };

        const bars = dims.map((k) => maturityBarHtml(k, m[k], m.meta?.[k])).join('');
        const headline = `<div class="b4-card" style="text-align:center;margin-bottom:22px;padding:18px;background:#f5f3ff;border-radius:10px;break-inside:avoid;">
            <div class="b4-kpi-value" style="font-size:2.3rem;font-weight:800;color:#7c3aed;line-height:1;">${m.overall != null ? m.overall.toFixed(1) : '—'}<span style="font-size:1.1rem;color:#a78bfa;">/5</span></div>
            <div style="font-size:0.72rem;color:#6d28d9;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">Overall Management System Maturity</div>
            ${m.interpretation ? `<div style="font-size:0.82rem;color:#4c1d95;margin-top:10px;font-weight:500;">${esc(m.interpretation)}</div>` : ''}
        </div>`;

        const radarLabels = dims.filter((k) => m[k] != null);
        const radarData = radarLabels.map((k) => m[k]);
        const bodyHtml = headline + `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;">
            <div>${bars}</div>
            <div class="b4-chart-box" style="background:#f8fafc;border-radius:10px;padding:14px;break-inside:avoid;">
                <canvas id="chart-maturity" style="max-height:280px;"></canvas>
            </div>
        </div>`;

        const chart = {
            canvasId: 'chart-maturity',
            configJson: JSON.stringify({
                type: 'radar',
                data: {
                    labels: radarLabels,
                    datasets: [{
                        label: 'Maturity (1-5)', data: radarData,
                        borderColor: PALETTE.purple, backgroundColor: PALETTE.purpleFill,
                        borderWidth: 1.5, pointBackgroundColor: PALETTE.purple, pointRadius: 2.5
                    }]
                },
                options: {
                    responsive: true,
                    layout: { padding: 8 },
                    plugins: { legend: { display: false } },
                    scales: { r: { beginAtZero: true, max: 5, grid: { color: PALETTE.grid }, angleLines: { color: PALETTE.grid }, ticks: { stepSize: 1, font: { size: 9 }, backdropColor: 'transparent' }, pointLabels: { font: { size: 10 } } } }
                }
            })
        };

        return { bodyHtml, charts: radarLabels.length >= 3 ? [chart] : [] };
    }

    function buildDeptPerformanceSection(metrics) {
        const depts = metrics.departments || [];
        if (!depts.length) return { bodyHtml: insufficientDataHtml('No department data available. Assign departments to checklist items to populate this section.'), charts: [] };

        const rows = depts.map((d) => {
            const hasScore = d.score != null;
            const barColor = !hasScore ? '#cbd5e1' : d.score >= 80 ? '#16a34a' : d.score >= 60 ? '#d97706' : '#dc2626';
            const rowStyle = d.needsAttention ? 'background:#fef2f2;' : '';
            const scoreCell = hasScore
                ? `<div style="display:flex;align-items:center;gap:8px;">${barHtml(d.score, barColor)}<span style="font-weight:700;color:${barColor};font-size:0.8rem;white-space:nowrap;">${Math.round(d.score)}</span></div>`
                : `<span style="color:#94a3b8;font-size:0.72rem;white-space:nowrap;">N/A (n=${d.n})</span>`;
            return `
            <tr style="${rowStyle}break-inside:avoid;">
                <td style="font-weight:600;">${d.needsAttention ? '<i class="fa-solid fa-flag" style="color:#dc2626;margin-right:6px;font-size:0.7rem;"></i>' : ''}${esc(d.name)}</td>
                <td style="text-align:center;">${d.findings}</td>
                <td style="text-align:center;">${d.ncCount}</td>
                <td style="text-align:left;min-width:130px;">${scoreCell}</td>
                <td style="text-align:center;white-space:nowrap;">${d.maturity != null ? (d.maturity.toFixed ? d.maturity.toFixed(1) : d.maturity) : '—'}/5</td>
                <td style="text-align:center;min-width:90px;white-space:nowrap;">${riskBadgeHtml(d.riskLevel)}</td>
                <td style="text-align:center;min-width:120px;white-space:nowrap;">${trendHtml(d.scoreDelta, 'higherBetter', 'pt')}</td>
            </tr>`;
        }).join('');

        const bodyHtml = `<table class="b4-tbl f-tbl" style="width:100%;border-collapse:collapse;">
            <thead><tr><th>Department</th><th style="text-align:center;width:11%;">Items</th><th style="text-align:center;width:10%;">Findings</th><th style="text-align:left;width:18%;min-width:130px;">Score</th><th style="text-align:center;width:10%;">Maturity</th><th style="text-align:center;width:11%;min-width:90px;">Risk</th><th style="text-align:center;width:16%;min-width:120px;">Trend</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div style="font-size:0.7rem;color:#94a3b8;margin-top:8px;">Sorted worst-first — departments flagged <i class="fa-solid fa-flag" style="color:#dc2626;"></i> require priority attention. Scores based on fewer than ${MIN_SAMPLE_N} sampled items are shown as N/A rather than a misleading percentage. Trend compares against the client's most recent prior audit where available.</div>`;

        return { bodyHtml, charts: [] };
    }

    function buildClauseIntelSection(metrics) {
        const ci = metrics.clauseIntel || {};
        const mostFailed = ci.mostFailed || [];
        const mostSuccessful = ci.mostSuccessful || [];
        const table = ci.table || [];

        if (!table.length) {
            return { bodyHtml: insufficientDataHtml('No clause-level intelligence could be derived from this audit.'), charts: [] };
        }

        const stripItem = (clause, title, color) => `<span class="b4-badge" style="display:inline-block;margin:0 8px 8px 0;padding:4px 10px;border-radius:14px;font-size:0.74rem;font-weight:700;color:${color};background:${color}15;border:1px solid ${color}30;">${esc(clause)}${title ? ' · ' + esc(title) : ''}</span>`;

        const failedStrip = mostFailed.length
            ? `<div style="margin-bottom:6px;">${mostFailed.map((r) => stripItem(r.clause, r.title, '#dc2626')).join('')}</div>`
            : `<div style="font-size:0.78rem;color:#94a3b8;">No failed clauses.</div>`;

        const successStrip = mostSuccessful.length
            ? `<div style="margin-bottom:6px;">${mostSuccessful.map((r) => stripItem(r.clause, r.title, '#16a34a')).join('')}</div>`
            : `<div style="font-size:0.78rem;color:#94a3b8;">No fully-conforming clauses recorded.</div>`;

        const strips = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
            <div class="b4-card" style="border:1px solid #fecaca;border-radius:8px;padding:14px;break-inside:avoid;">
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#dc2626;margin-bottom:8px;">Most Failed</div>
                ${failedStrip}
            </div>
            <div class="b4-card" style="border:1px solid #bbf7d0;border-radius:8px;padding:14px;break-inside:avoid;">
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#16a34a;margin-bottom:8px;">Strongest</div>
                ${successStrip}
            </div>
        </div>`;

        const rows = table.map((r) => `
            <tr style="${r.status === 'Recurring' ? 'background:#fef2f2;' : ''}break-inside:avoid;">
                <td style="font-family:monospace;font-weight:700;">${esc(r.clause)}</td>
                <td>${esc(r.title || '—')}</td>
                <td style="text-align:left;min-width:130px;">${r.compliancePct != null ? `<div style="display:flex;align-items:center;gap:8px;">${barHtml(r.compliancePct, r.compliancePct >= 80 ? '#16a34a' : r.compliancePct >= 60 ? '#d97706' : '#dc2626')}<span style="font-size:0.78rem;font-weight:700;white-space:nowrap;">${r.compliancePct}%</span></div>` : '—'}</td>
                <td style="text-align:center;min-width:90px;white-space:nowrap;">${riskBadgeHtml(r.risk)}</td>
                <td style="min-width:120px;">${esc(r.department)}</td>
                <td style="text-align:center;min-width:70px;white-space:nowrap;">${esc(r.priority)}</td>
                <td style="text-align:center;min-width:110px;white-space:nowrap;">${statusBadgeHtml(r.status)}${r.isRecurring ? ' <i class="fa-solid fa-rotate-left" title="Repeat finding" style="color:#7f1d1d;font-size:0.7rem;margin-left:4px;"></i>' : ''}</td>
            </tr>`).join('');

        const bodyHtml = strips + `
        <table class="b4-tbl f-tbl" style="width:100%;border-collapse:collapse;">
            <thead><tr><th style="width:9%;">Clause</th><th>Title</th><th style="width:16%;min-width:130px;">Compliance %</th><th style="text-align:center;width:9%;min-width:90px;">Risk</th><th style="width:14%;min-width:120px;">Department</th><th style="text-align:center;width:10%;min-width:70px;">Priority</th><th style="text-align:center;width:12%;min-width:110px;">Status</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div style="font-size:0.7rem;color:#94a3b8;margin-top:8px;"><i class="fa-solid fa-rotate-left" style="color:#7f1d1d;"></i> denotes a repeat finding from the client's previous audit — certification bodies weight recurrence heavily when assessing corrective action effectiveness.</div>`;

        return { bodyHtml, charts: [] };
    }

    function buildTrendsSection(metrics) {
        const t = metrics.trends || {};
        const hasHistory = Array.isArray(t.labels) && t.labels.length > 0;
        if (!hasHistory) return null; // caller omits section entirely when no history

        const lastIdx = t.labels.length - 1;
        const trendRow = (label, arr, direction, suffix) => {
            const curr = arr[lastIdx];
            const prev = arr[lastIdx - 1];
            const d = (curr != null && prev != null) ? round(curr - prev) : null;
            return `<tr><td>${esc(label)}</td><td style="text-align:center;">${curr ?? '—'}</td><td style="text-align:center;">${prev ?? '—'}</td><td style="text-align:center;">${trendHtml(d, direction, suffix)}</td></tr>`;
        };
        const compRows = trendRow('Major NC', t.majorNC, 'lowerBetter')
            + trendRow('Minor NC', t.minorNC, 'lowerBetter')
            + trendRow('Observations', t.obs, 'neutral')
            + trendRow('OFI', t.ofi, 'neutral')
            + trendRow('Audit Score', t.auditScore, 'higherBetter')
            + trendRow('Open CAPA', t.capaOpen, 'lowerBetter');

        const bodyHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px;">
            <div class="b4-chart-box" style="background:#f8fafc;border-radius:10px;padding:14px;break-inside:avoid;">
                <canvas id="chart-trend-findings" style="max-height:240px;"></canvas>
            </div>
            <div class="b4-chart-box" style="background:#f8fafc;border-radius:10px;padding:14px;break-inside:avoid;">
                <canvas id="chart-trend-score" style="max-height:240px;"></canvas>
            </div>
        </div>
        <table class="b4-tbl f-tbl" style="width:100%;border-collapse:collapse;">
            <thead><tr><th>Metric</th><th style="text-align:center;width:18%;">This Audit</th><th style="text-align:center;width:18%;">Previous Audit</th><th style="text-align:center;width:22%;">Trend</th></tr></thead>
            <tbody>${compRows}</tbody>
        </table>`;

        const lineDefaults = { borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 4, tension: 0.3 };
        const chartFindings = {
            canvasId: 'chart-trend-findings',
            configJson: JSON.stringify({
                type: 'line',
                data: {
                    labels: t.labels,
                    datasets: [
                        Object.assign({ label: 'Major NC', data: t.majorNC, borderColor: PALETTE.red, backgroundColor: PALETTE.redFill }, lineDefaults),
                        Object.assign({ label: 'Minor NC', data: t.minorNC, borderColor: PALETTE.amber, backgroundColor: PALETTE.amberFill }, lineDefaults),
                        Object.assign({ label: 'Observations', data: t.obs, borderColor: PALETTE.blue, backgroundColor: PALETTE.blueFill }, lineDefaults),
                        Object.assign({ label: 'OFI', data: t.ofi, borderColor: PALETTE.emerald, backgroundColor: PALETTE.emeraldFill }, lineDefaults)
                    ]
                },
                options: {
                    responsive: true,
                    layout: { padding: 8 },
                    plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10, boxHeight: 10, usePointStyle: true } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
                        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 9 } }, grid: { color: PALETTE.grid } }
                    }
                }
            })
        };
        const chartScore = {
            canvasId: 'chart-trend-score',
            configJson: JSON.stringify({
                type: 'line',
                data: { labels: t.labels, datasets: [Object.assign({ label: 'Audit Score', data: t.auditScore, borderColor: PALETTE.slate, backgroundColor: PALETTE.slateFill, fill: true }, lineDefaults)] },
                options: {
                    responsive: true,
                    layout: { padding: 8 },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
                        y: { beginAtZero: true, max: 100, ticks: { font: { size: 9 } }, grid: { color: PALETTE.grid } }
                    }
                }
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
