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
        if (total < 5) return `<div class="b4-footnote" style="margin-top:var(--b4-s1);">${pluralize(total, noun)} identified</div>`;
        if (total > shownLen) return `<div class="b4-footnote" style="margin-top:var(--b4-s1);">Showing top ${shownLen} of ${pluralize(total, noun)}</div>`;
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

        // Man-days: prefer explicit man-days, fall back to on-site days.
        const manDays = d?.auditPlan?.manDays;
        const onsiteDays = d?.auditPlan?.onsiteDays;
        const auditDuration = (manDays != null && manDays !== '') ? Number(manDays)
            : ((onsiteDays != null && onsiteDays !== '') ? Number(onsiteDays) : null);

        // Top business-impact category, sourced defensively from window.ReportRisk
        // (a sibling module) if it has already been loaded. Omitted gracefully
        // when unavailable so this card never fabricates data.
        let businessImpact = null;
        try {
            if (global.ReportRisk && typeof global.ReportRisk.compute === 'function') {
                const riskCompute = global.ReportRisk.compute(d);
                const counts = {};
                (riskCompute?.scoredFindings || []).forEach((f) => {
                    (f?.businessImpacts || []).forEach((cat) => { counts[cat] = (counts[cat] || 0) + 1; });
                });
                const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                if (top) businessImpact = { category: top[0], count: top[1] };
            }
        } catch (_e) { businessImpact = null; }

        const execDashboard = {
            auditScore,
            grade: gradeFromScore(auditScore),
            maturityOverall: maturity.overall,
            riskRating: deriveRiskRating(majorNC, minorNC, hasRecurring, departments, auditScore),
            certificationRecommendation: stats.recommendation || null,
            businessHealth: businessHealthFromScore(auditScore),
            compliancePct,
            controlEffectiveness: breakdown.Operations,
            processEffectiveness: breakdown.Monitoring,
            majorNC, minorNC, obsCount, ofiCount, capaProgress,
            businessImpact,
            auditDuration,
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

    // ── Design-system helpers (consume report-executive.js's bigFourCss()) ────
    // Icons come exclusively from window.ReportExecutive.icon(); guarded so a
    // missing/late-loading executive module never breaks rendering.
    function iconSafe(name, opts) {
        try {
            if (global.ReportExecutive && typeof global.ReportExecutive.icon === 'function') {
                return global.ReportExecutive.icon(name, opts);
            }
        } catch (_e) { /* defensive no-op */ }
        return '';
    }

    // Severity classification -> canonical b4-* modifier suffix ('good'|'warn'|'bad'|'neutral'|'info').
    function scoreSeverity(score, goodMin, warnMin) {
        if (score == null) return 'neutral';
        goodMin = goodMin == null ? 80 : goodMin;
        warnMin = warnMin == null ? 60 : warnMin;
        return score >= goodMin ? 'good' : score >= warnMin ? 'warn' : 'bad';
    }
    const LEVEL_SEVERITY = { Critical: 'bad', High: 'bad', Medium: 'warn', Low: 'good', Major: 'bad', Minor: 'warn', Observation: 'info' };
    function levelSeverity(level) { return LEVEL_SEVERITY[level] || 'neutral'; }
    const STATUS_SEVERITY = { Recurring: 'bad', Critical: 'bad', Attention: 'warn', Conforming: 'good' };
    function statusSeverity(status) { return STATUS_SEVERITY[status] || 'neutral'; }

    function gradeFromScore(score) {
        if (score == null) return null;
        let letter = 'D', severity = 'bad';
        if (score >= 90) { letter = 'A'; severity = 'good'; }
        else if (score >= 75) { letter = 'B'; severity = 'good'; }
        else if (score >= 60) { letter = 'C'; severity = 'warn'; }
        return { letter, score, severity };
    }

    // ── HTML rendering helpers ────────────────────────────────────────────────
    function scorePillHtml(score) {
        if (score == null) return '<span class="b4-badge b4-badge--neutral">—</span>';
        return `<span class="b4-badge b4-badge--${scoreSeverity(score)}">${score}</span>`;
    }

    function barHtml(valuePct, severity) {
        const v = clamp(valuePct == null ? 0 : valuePct, 0, 100);
        return `<div class="b4-bar"><div class="b4-bar-fill b4-bar-fill--${severity || 'info'}" style="width:${v}%;"></div></div>`;
    }

    function maturityBarHtml(label, value, meta) {
        const n = meta?.n ?? 0;
        if (value == null) {
            const reason = meta?.insufficient ? `N/A (n=${n})` : 'N/A';
            return `
            <div class="b4-bar-row" style="flex-direction:column;align-items:stretch;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--b4-s3);">
                    <span class="b4-bar-label">${esc(label)}</span>
                    <span class="b4-badge b4-badge--neutral">${esc(reason)}</span>
                </div>
                <div class="b4-maturity-bar b4-bar"><div class="b4-maturity-bar-fill" style="width:0;"></div></div>
            </div>`;
        }
        const v = clamp(value, 0, 5);
        const pctW = (v / 5) * 100;
        const sev = v >= 4 ? 'good' : v >= 3 ? 'info' : v >= 2 ? 'warn' : 'bad';
        return `
        <div class="b4-bar-row" style="flex-direction:column;align-items:stretch;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--b4-s3);">
                <span class="b4-bar-label">${esc(label)} <span class="b4-caption" style="display:inline;">(n=${n})</span></span>
                <span class="b4-badge b4-badge--${sev}">${v.toFixed(1)}/5</span>
            </div>
            <div class="b4-maturity-bar b4-bar"><div class="b4-maturity-bar-fill b4-bar-fill--${sev}" style="width:${pctW}%;"></div></div>
        </div>`;
    }

    // Direction: 'higherBetter' | 'lowerBetter' | 'neutral'
    function trendHtml(deltaVal, direction, suffix) {
        suffix = suffix || '';
        if (deltaVal == null) {
            return '<span class="b4-kpi-trend flat">vs previous audit</span>';
        }
        const dirClass = deltaVal > 0 ? 'up' : deltaVal < 0 ? 'down' : 'flat';
        const magnitude = Math.abs(deltaVal);
        return `<span class="b4-kpi-trend ${dirClass}">${magnitude}${suffix} vs previous</span>`;
    }

    function kpiCardHtml(opts) {
        const { icon, label, value, suffix, sub, severity, deltaVal, direction, deltaSuffix, isText, accent } = opts;
        const valHtml = value == null
            ? '—'
            : (isText
                ? esc(String(value))
                : `${value}${suffix ? `<span style="font-size:0.6em;font-weight:500;color:var(--b4-muted);">${suffix}</span>` : ''}`);
        const colorStyle = severity && severity !== 'neutral' ? ` style="color:var(--b4-${severity});"` : '';
        return `
        <div class="b4-kpi-card${accent ? ' b4-kpi-card--accent' : ''}">
            ${icon ? `<div class="b4-kpi-icon">${iconSafe(icon)}</div>` : ''}
            <div class="b4-kpi-value"${colorStyle}>${valHtml}</div>
            <div class="b4-kpi-label">${esc(label)}</div>
            ${sub ? `<div class="b4-kpi-sub">${esc(sub)}</div>` : ''}
            ${(deltaVal !== undefined) ? `<div>${trendHtml(deltaVal, direction, deltaSuffix)}</div>` : ''}
        </div>`;
    }

    function riskBadgeHtml(level) {
        return `<span class="b4-badge b4-badge--${levelSeverity(level)}">${esc(level || '—')}</span>`;
    }

    function statusBadgeHtml(status) {
        return `<span class="b4-badge b4-badge--${statusSeverity(status)}">${esc(status || '—')}</span>`;
    }

    function insufficientDataHtml(msg) {
        return `<div class="b4-card b4-callout--info" style="text-align:center;padding:var(--b4-s6);">${iconSafe('finding', { size: 22 })}<div class="b4-caption" style="justify-content:center;margin-top:var(--b4-s2);">${esc(msg || 'Insufficient data available for this section.')}</div></div>`;
    }

    // ── Section builders ────────────────────────────────────────────────────
    function buildExecDashboardSection(metrics) {
        const ed = metrics.execDashboard || {};
        const dl = ed.deltas || {};

        const findingsSummary = pluralize(ed.majorNC, 'major') + ', ' + pluralize(ed.minorNC, 'minor')
            + (ed.obsCount || ed.ofiCount ? ', ' + pluralize((ed.obsCount || 0) + (ed.ofiCount || 0), 'obs/OFI') : '');

        const cards = [
            kpiCardHtml({ icon: 'check', label: 'Overall Compliance', value: ed.compliancePct, suffix: '%', severity: scoreSeverity(ed.compliancePct), deltaVal: dl.compliance, direction: 'higherBetter', deltaSuffix: 'pt' }),
            kpiCardHtml({ icon: 'shield', label: 'Certification Recommendation', value: ed.certificationRecommendation || 'Pending', isText: true }),
            kpiCardHtml({ icon: 'target', label: 'Audit Grade', value: ed.grade ? ed.grade.letter : null, sub: ed.grade ? `${ed.grade.score}/100` : null, severity: ed.grade ? ed.grade.severity : 'neutral', deltaVal: dl.auditScore, direction: 'higherBetter' }),
            kpiCardHtml({ icon: 'department', label: 'Maturity Score', value: ed.maturityOverall, suffix: '/5', severity: scoreSeverity(ed.maturityOverall != null ? ed.maturityOverall * 20 : null), deltaVal: dl.maturity, direction: 'higherBetter' }),
            kpiCardHtml({ icon: 'finding', label: 'Findings Summary', value: (ed.majorNC || 0) + (ed.minorNC || 0), sub: findingsSummary, severity: (ed.majorNC || 0) > 0 ? 'bad' : (ed.minorNC || 0) > 0 ? 'warn' : 'good' }),
            kpiCardHtml({ icon: 'risk', label: 'High Risks', value: ed.riskRating, severity: levelSeverity(ed.riskRating), isText: true })
        ];
        if (ed.businessImpact) {
            cards.push(kpiCardHtml({ icon: 'alert', label: 'Business Impact', value: ed.businessImpact.count, sub: ed.businessImpact.category, severity: 'info' }));
        }
        if (ed.auditDuration != null) {
            cards.push(kpiCardHtml({ icon: 'clock', label: 'Audit Duration', value: ed.auditDuration, suffix: ' man-days' }));
        }
        if (ed.capaProgress != null) {
            cards.push(kpiCardHtml({ icon: 'capa', label: 'CAPA Progress', value: ed.capaProgress, suffix: '%', severity: scoreSeverity(ed.capaProgress), deltaVal: dl.capaProgress, direction: 'higherBetter', deltaSuffix: 'pt' }));
        }

        const kpis = `<div class="b4-kpi-grid">${cards.join('')}</div>`;

        const risksList = (ed.top5Risks && ed.top5Risks.length)
            ? ed.top5Risks.map((r, idx) => `<li style="display:flex;align-items:center;justify-content:space-between;gap:var(--b4-s3);">
                <span><span class="b4-caption" style="display:inline;">${idx + 1}.</span> ${esc(r.title)}</span>${riskBadgeHtml(r.level)}</li>`).join('')
            : '<li class="b4-muted-item">No significant risks identified</li>';

        const prioritiesList = (ed.top5Priorities && ed.top5Priorities.length)
            ? ed.top5Priorities.map((p, idx) => `<li><span class="b4-caption" style="display:inline;">${idx + 1}.</span> ${esc(p)}</li>`).join('')
            : '<li class="b4-muted-item">No priority actions identified</li>';

        const risksNote = countNoteHtml((ed.top5Risks || []).length, ed.risksTotal || (ed.top5Risks || []).length, 'risk');
        const prioritiesNote = countNoteHtml((ed.top5Priorities || []).length, ed.prioritiesTotal || (ed.top5Priorities || []).length, 'priority action');

        const lists = `
        <div class="b4-grid-2" style="margin-top:var(--b4-s5);">
            <div class="b4-card" style="break-inside:avoid;">
                <div class="b4-card-heading">${iconSafe('risk', { size: 14 })} Top Risks</div>
                <ul class="b4-bullets" style="list-style:none;padding-left:0;">${risksList}</ul>
                ${risksNote}
            </div>
            <div class="b4-card" style="break-inside:avoid;">
                <div class="b4-card-heading">${iconSafe('target', { size: 14 })} Top Priorities</div>
                <ul class="b4-bullets" style="list-style:none;padding-left:0;">${prioritiesList}</ul>
                ${prioritiesNote}
            </div>
        </div>`;

        const recLine = ed.certificationRecommendation
            ? `<div class="b4-callout b4-callout--info" style="margin-top:var(--b4-s5);"><strong>Certification Recommendation:</strong> ${esc(ed.certificationRecommendation)}</div>`
            : '';

        return { bodyHtml: kpis + lists + recLine, charts: [] };
    }

    function buildMaturitySection(metrics) {
        const m = metrics.maturity || {};
        const dims = Object.keys(MATURITY_DIMENSIONS);
        const hasAny = dims.some((k) => (m.meta?.[k]?.n || 0) > 0);
        if (!hasAny) return { bodyHtml: insufficientDataHtml('No maturity data could be derived from this audit\'s checklist coverage.'), charts: [] };

        const bars = dims.map((k) => maturityBarHtml(k, m[k], m.meta?.[k])).join('');
        const headline = `<div class="b4-card b4-kpi-card--accent" style="text-align:center;break-inside:avoid;">
            <div class="b4-kpi-value">${m.overall != null ? m.overall.toFixed(1) : '—'}<span style="font-size:0.5em;font-weight:500;color:var(--b4-muted);">/5</span></div>
            <div class="b4-kpi-label">Overall Management System Maturity</div>
            ${m.interpretation ? `<div class="b4-kpi-sub">${esc(m.interpretation)}</div>` : ''}
        </div>`;

        const radarLabels = dims.filter((k) => m[k] != null);
        const radarData = radarLabels.map((k) => m[k]);
        const bodyHtml = headline + `
        <div class="b4-grid-2" style="align-items:start;margin-top:var(--b4-s5);">
            <div>${bars}</div>
            <div class="b4-chart-box">
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
                    font: { family: 'Inter, "Segoe UI", Helvetica, Arial, sans-serif', size: 9 },
                    plugins: { legend: { display: false } },
                    scales: { r: { beginAtZero: true, max: 5, grid: { color: PALETTE.grid }, angleLines: { color: PALETTE.grid }, ticks: { stepSize: 1, font: { family: 'Inter, "Segoe UI", Helvetica, Arial, sans-serif', size: 9 }, backdropColor: 'transparent' }, pointLabels: { font: { family: 'Inter, "Segoe UI", Helvetica, Arial, sans-serif', size: 10 } } } }
                }
            })
        };

        return { bodyHtml, charts: radarLabels.length >= 3 ? [chart] : [] };
    }

    function buildDeptPerformanceSection(metrics) {
        const depts = metrics.departments || [];
        if (!depts.length) return { bodyHtml: insufficientDataHtml('No department data available. Assign departments to checklist items to populate this section.'), charts: [] };

        const cards = depts.map((d) => {
            const hasScore = d.score != null;
            const sev = hasScore ? scoreSeverity(d.score) : 'neutral';
            const scoreCell = hasScore
                ? `<div style="display:flex;align-items:center;gap:var(--b4-s2);">${barHtml(d.score, sev)}<span class="b4-badge b4-badge--${sev}">${Math.round(d.score)}</span></div>`
                : `<span class="b4-caption">N/A (n=${d.n})</span>`;
            return `
            <div class="b4-card" style="break-inside:avoid;${d.needsAttention ? 'border-left:3px solid var(--b4-bad);' : ''}">
                <div class="b4-card-heading">${d.needsAttention ? iconSafe('alert', { size: 14 }) : iconSafe('department', { size: 14 })} ${esc(d.name)}</div>
                ${scoreCell}
                <div class="b4-kpi-sub" style="margin-top:var(--b4-s2);">${pluralize(d.findings, 'item')} · ${pluralize(d.ncCount, 'finding')} · Maturity ${d.maturity != null ? (d.maturity.toFixed ? d.maturity.toFixed(1) : d.maturity) : '—'}/5</div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:var(--b4-s2);">
                    ${riskBadgeHtml(d.riskLevel)}
                    ${trendHtml(d.scoreDelta, 'higherBetter', 'pt')}
                </div>
            </div>`;
        }).join('');

        const cardsHtml = `<div class="b4-grid-3">${cards}</div>`;

        let tableHtml = '';
        if (depts.length > 6) {
            const rows = depts.map((d) => `
            <tr style="${d.needsAttention ? 'background:var(--b4-bad-bg);' : ''}break-inside:avoid;">
                <td>${esc(d.name)}</td>
                <td class="b4-num">${d.findings}</td>
                <td class="b4-num">${d.ncCount}</td>
                <td style="min-width:130px;">${d.score != null ? `<div style="display:flex;align-items:center;gap:var(--b4-s2);">${barHtml(d.score, scoreSeverity(d.score))}<span class="b4-num">${Math.round(d.score)}</span></div>` : `<span class="b4-caption">N/A (n=${d.n})</span>`}</td>
                <td class="b4-num">${d.maturity != null ? (d.maturity.toFixed ? d.maturity.toFixed(1) : d.maturity) : '—'}/5</td>
                <td style="text-align:center;">${riskBadgeHtml(d.riskLevel)}</td>
                <td style="text-align:center;">${trendHtml(d.scoreDelta, 'higherBetter', 'pt')}</td>
            </tr>`).join('');
            tableHtml = `<table class="b4-tbl" style="margin-top:var(--b4-s5);">
                <thead><tr><th>Department</th><th style="text-align:right;">Items</th><th style="text-align:right;">Findings</th><th>Score</th><th style="text-align:right;">Maturity</th><th style="text-align:center;">Risk</th><th style="text-align:center;">Trend</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
        }

        const bodyHtml = cardsHtml + tableHtml
            + `<div class="b4-footnote" style="margin-top:var(--b4-s3);">Sorted worst-first — flagged departments require priority attention. Scores based on fewer than ${MIN_SAMPLE_N} sampled items are shown as N/A rather than a misleading percentage. Trend compares against the client's most recent prior audit where available.</div>`;

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

        const rankedStrip = (rows, emptyMsg) => rows.length
            ? `<div class="b4-bullets" style="padding-left:0;list-style:none;">${rows.slice(0, 5).map((r) => `
                <div class="b4-bar-row">
                    <span class="b4-bar-label" style="min-width:170px;">${esc(r.clause)}${r.title ? ' — ' + esc(r.title) : ''}</span>
                    ${barHtml(pct(r.conform, r.total), pct(r.conform, r.total) >= 80 ? 'good' : pct(r.conform, r.total) >= 60 ? 'warn' : 'bad')}
                    ${riskBadgeHtml(r.nc > 0 ? (r.major > 0 ? 'High' : 'Low') : 'Low')}
                </div>`).join('')}</div>`
            : `<div class="b4-caption">${esc(emptyMsg)}</div>`;

        const recurring = ci.recurring || [];
        const recurringCallout = recurring.length
            ? `<div class="b4-callout b4-callout--bad" style="margin-bottom:var(--b4-s5);">
                <div class="b4-card-heading">${iconSafe('alert', { size: 14 })} Recurring Issues</div>
                <div>${recurring.map((r) => `<span class="b4-badge b4-badge--bad" style="margin:0 var(--b4-s2) var(--b4-s2) 0;">${esc(r.clause)}</span>`).join('')}</div>
            </div>`
            : '';

        const strips = `
        <div class="b4-grid-2" style="margin-bottom:var(--b4-s5);">
            <div class="b4-card" style="break-inside:avoid;">
                <div class="b4-card-heading">${iconSafe('alert', { size: 14 })} Weakest Clauses</div>
                ${rankedStrip(mostFailed, 'No failed clauses.')}
            </div>
            <div class="b4-card" style="break-inside:avoid;">
                <div class="b4-card-heading">${iconSafe('check', { size: 14 })} Strongest Clauses</div>
                ${rankedStrip(mostSuccessful, 'No fully-conforming clauses recorded.')}
            </div>
        </div>`;

        // Full table: only clauses with findings or <100% compliance, capped at 15 rows.
        const notableRows = table.filter((r) => r.status !== 'Conforming' || (r.compliancePct != null && r.compliancePct < 100));
        const omittedCount = table.length - notableRows.length;
        const shownRows = notableRows.slice(0, 15);

        const rows = shownRows.map((r) => `
            <tr style="${r.status === 'Recurring' ? 'background:var(--b4-bad-bg);' : ''}break-inside:avoid;">
                <td style="font-weight:700;">${esc(r.clause)}</td>
                <td>${esc(r.title || '—')}</td>
                <td style="min-width:130px;">${r.compliancePct != null ? `<div style="display:flex;align-items:center;gap:var(--b4-s2);">${barHtml(r.compliancePct, scoreSeverity(r.compliancePct))}<span class="b4-num">${r.compliancePct}%</span></div>` : '—'}</td>
                <td style="text-align:center;">${riskBadgeHtml(r.risk)}</td>
                <td>${esc(r.department)}</td>
                <td style="text-align:center;">${esc(r.priority)}</td>
                <td style="text-align:center;">${statusBadgeHtml(r.status)}</td>
            </tr>`).join('');

        const omittedNote = omittedCount > 0
            ? `<div class="b4-footnote" style="margin-top:var(--b4-s2);">${pluralize(omittedCount, 'fully conforming clause')} omitted for brevity.</div>`
            : '';

        const bodyHtml = strips + recurringCallout + `
        <table class="b4-tbl">
            <thead><tr><th>Clause</th><th>Title</th><th>Compliance</th><th style="text-align:center;">Risk</th><th>Department</th><th style="text-align:center;">Priority</th><th style="text-align:center;">Status</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        ${omittedNote}
        <div class="b4-footnote" style="margin-top:var(--b4-s2);">Rows marked Recurring repeat a finding from the client's previous audit — certification bodies weight recurrence heavily when assessing corrective action effectiveness.</div>`;

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
        <div class="b4-grid-2" style="margin-bottom:var(--b4-s5);">
            <div class="b4-chart-box"><canvas id="chart-trend-findings" style="max-height:240px;"></canvas></div>
            <div class="b4-chart-box"><canvas id="chart-trend-score" style="max-height:240px;"></canvas></div>
        </div>
        <table class="b4-tbl">
            <thead><tr><th>Metric</th><th style="text-align:center;">This Audit</th><th style="text-align:center;">Previous Audit</th><th style="text-align:center;">Trend</th></tr></thead>
            <tbody>${compRows}</tbody>
        </table>`;

        const chartFont = { family: 'Inter, "Segoe UI", Helvetica, Arial, sans-serif', size: 9 };
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
                    font: chartFont,
                    plugins: { legend: { position: 'bottom', labels: { font: chartFont, boxWidth: 10, boxHeight: 10, usePointStyle: true } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: chartFont } },
                        y: { beginAtZero: true, ticks: { stepSize: 1, font: chartFont }, grid: { color: PALETTE.grid, drawTicks: false } }
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
                    font: chartFont,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: chartFont } },
                        y: { beginAtZero: true, max: 100, ticks: { font: chartFont }, grid: { color: PALETTE.grid, drawTicks: false } }
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
