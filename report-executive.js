// ============================================
// REPORT EXECUTIVE MODULE  (window.ReportExecutive)
// ============================================
// Standalone add-on for AuditCB-360's audit report builder.
// Does NOT modify any existing file — pure additive module.
//
// CONTRACT / USAGE (for the integrating session):
//   window.ReportExecutive.prepare(d)                 -> async, runs AI calls once & caches results keyed by d.report.id
//   window.ReportExecutive.sections(d)                 -> sync, returns [{key,name,desc,color,bodyHtml,charts}] for:
//                                                            'exec-summary'   EXECUTIVE SUMMARY (leads with an Audit Outcome Summary block)
//                                                            'evidence-intel' EVIDENCE INTELLIGENCE
//                                                            'exec-insights'  EXECUTIVE INSIGHTS
//   window.ReportExecutive.sectionsPreviewToggles()     -> [{id,label,icon,color}] matching the app's existing
//                                                            preview-toggle pill pattern (see execution-reporting.js sections[])
//   window.ReportExecutive.generateExecutiveSummary(d)  -> async {html}  (also cached internally by prepare)
//   window.ReportExecutive.computeEvidenceIntel(d)      -> sync  {coveragePct, missingEvidence, byDepartment, qualityNote}
//   window.ReportExecutive.generateExecutiveInsights(d) -> async {html} (6 insight cards)
//   window.ReportExecutive.askAuditAI(question, d)      -> async string (answer text)
//   window.ReportExecutive.renderAssistantPanel()       -> string (HTML for a chat panel; NOT for the printed PDF)
//   window.ReportExecutive.handleAsk()                  -> wired to the assistant panel's Ask button
//   window.ReportExecutive.bigFourCss()                 -> string (CSS component library)
//
// DATA SHAPE ASSUMED (from window._reportPreviewData / the `d` param, per execution-reporting.js):
//   d.report            {id, client, standard, auditType, date, endDate, reportStatus, ncrs[], checklistProgress[], ...}
//   d.hydratedProgress[] {clause, requirement, comment, status('nc'|'conform'|'na'), ncrType('major'|'minor'|'observation'|'ofi'),
//                          department, evidenceImage, evidenceImages[], kbMatch{clause,title,requirement}}
//   d.client            {name, industry, sites[], departments[], ...}
//   d.auditPlan         {type, scope, ...}
//   d.stats             {totalItems, ncCount, actualNCCount, conformCount, naCount, majorNC, minorNC,
//                          observationCount, ofiCount, obsOfiCount, ncByClause{}, applicableCount,
//                          auditStatus, statusColor, recommendation, recColor}
//
// AI WRAPPER REUSED: window.AI_SERVICE.callProxyAPI(prompt, options) — the exact same low-level call used by
// polishNotesWithAI / runFollowUpAIAnalysis / polishSingleNote / draftExecutiveSummary in ai-service.js and
// execution-reporting.js. It POSTs to /api/gemini (server-side Gemini proxy, model fallback list built in),
// with a direct-Gemini fallback using a client-stored key (window.state.settings.geminiApiKey /
// localStorage 'geminiApiKey') if the proxy is unreachable. We call it exactly the same way (raw prompt
// string in, raw text out) and treat ANY failure as non-fatal — every AI entry point below has a
// deterministic template fallback so report generation/export is never blocked by AI availability.
//
// Defensive coding: every function tolerates missing/partial `d`, empty arrays, and AI/network failures.

(function () {
    'use strict';

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const safeArr = (a) => Array.isArray(a) ? a : [];

    // ------------------------------------------------------------------
    // Inline outline icon set — the ONLY icon language in the printed report.
    // Stroke-based, currentColor, 1.5 stroke width, outline style, 14px default in body context.
    // Exported names (reference for other report-*.js modules — do not rename):
    //   audit, risk, department, evidence, capa, observation, finding, management, trend,
    //   clause, shield, check, alert, clock, target, document, interview, site, camera,
    //   gauge, arrow-up, arrow-down
    // ------------------------------------------------------------------
    const ICON_PATHS = {
        audit: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
        risk: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86l-8.5 14.7A1.5 1.5 0 0 0 3.07 21h17.86a1.5 1.5 0 0 0 1.28-2.44l-8.5-14.7a1.5 1.5 0 0 0-2.62 0z"/>',
        department: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>',
        evidence: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-4.5-4.5L9 18"/>',
        capa: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
        observation: '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>',
        finding: '<circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
        management: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
        trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
        clause: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        check: '<path d="M20 6L9 17l-5-5"/>',
        alert: '<path d="M10.29 3.86l-8.5 14.7A1.5 1.5 0 0 0 3.07 21h17.86a1.5 1.5 0 0 0 1.28-2.44l-8.5-14.7a1.5 1.5 0 0 0-2.62 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
        document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/><path d="M9 9h1"/>',
        interview: '<path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M2 21v-1a6 6 0 0 1 6-6h0"/><path d="M16 12a4 4 0 1 0 0-8"/><path d="M14 21v-1a6 6 0 0 0-4.5-5.8"/><path d="M22 21v-1a6 6 0 0 0-6-6"/>',
        site: '<path d="M3 21h18"/><path d="M6 21V10l6-6 6 6v11"/><path d="M10 21v-6h4v6"/>',
        camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
        gauge: '<path d="M12 21a9 9 0 1 0-9-9"/><path d="M12 12l4-4"/><path d="M12 21v-3"/>',
        'arrow-up': '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
        'arrow-down': '<path d="M12 5v14"/><path d="M18 13l-6 6-6-6"/>'
    };
    function icon(name, opts) {
        const size = (opts && opts.size) || 14;
        const cls = (opts && opts.cls) || '';
        const paths = ICON_PATHS[name] || ICON_PATHS.finding;
        return `<svg class="b4-icon${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    }

    // Cache of prepared async results, keyed by report id (falls back to a fixed key if no id present).
    const _cache = {};
    const cacheKey = (d) => 'rpt_' + (d && d.report && (d.report.id != null) ? String(d.report.id) : 'default');

    // ------------------------------------------------------------------
    // Shared data-derivation helpers
    // ------------------------------------------------------------------

    const getStats = (d) => (d && d.stats) || {};

    const getNCList = (d) => safeArr(d && d.hydratedProgress).filter(i => i.status === 'nc');

    const getRealNCs = (d) => getNCList(d).filter(i => {
        const t = (i.ncrType || '').toLowerCase();
        return t === 'major' || t === 'minor';
    });

    const getObsOfi = (d) => getNCList(d).filter(i => {
        const t = (i.ncrType || '').toLowerCase();
        return t === 'observation' || t === 'ofi';
    });

    const UNASSIGNED_LABEL = 'Unassigned / Cross-functional';
    const getDepartments = (d) => {
        const depts = {};
        safeArr(d && d.hydratedProgress).forEach(item => {
            const dept = (item.department && String(item.department).trim()) || UNASSIGNED_LABEL;
            if (!depts[dept]) depts[dept] = { total: 0, conform: 0, nc: 0, major: 0, minor: 0, hasEvidence: 0 };
            depts[dept].total++;
            if (item.status === 'conform') depts[dept].conform++;
            if (item.status === 'nc') {
                depts[dept].nc++;
                const t = (item.ncrType || '').toLowerCase();
                if (t === 'major') depts[dept].major++;
                if (t === 'minor') depts[dept].minor++;
            }
            const imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
            if (imgs && imgs.length) depts[dept].hasEvidence++;
        });
        return depts;
    };

    const clauseLabel = (item) => (item.kbMatch && item.kbMatch.clause) ? item.kbMatch.clause : (item.clause || 'General');

    // ------------------------------------------------------------------
    // Finding-text hygiene: strip "[Ref: ...]" bracketed content and imperative
    // checklist phrasing ("Show...", "Verify...", "Check...") wherever finding
    // text is printed in an executive context, and cap length so it reads as a
    // noun-phrase summary rather than raw checklist copy.
    // ------------------------------------------------------------------
    function cleanFindingText(s, maxLen) {
        let t = String(s == null ? '' : s);
        t = t.replace(/\[Ref:[^\]]*\]/gi, ' ');
        t = t.replace(/^\s*(show|verify|check|confirm|ensure|demonstrate|provide|review|assess|evaluate)\b[:\s\-]*/i, '');
        t = t.replace(/\s{2,}/g, ' ').trim();
        const cap = maxLen || 90;
        if (t.length > cap) t = t.slice(0, Math.max(0, cap - 1)).trim() + '…';
        return t;
    }

    const clauseTitle = (item) => cleanFindingText((item.kbMatch && item.kbMatch.title) ? item.kbMatch.title : '', 90);

    // ------------------------------------------------------------------
    // Criterion / department safety helpers — prevent "Clause FOCUS.x" and
    // "(General)" from ever reaching printed narrative text. Prefer the
    // canonical window.ReportStats helpers when present (shared source of
    // truth being introduced alongside this module); fall back to an
    // equivalent local implementation otherwise so this module never depends
    // on load order.
    // ------------------------------------------------------------------
    const CRITERION_INTERNAL_RX = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;

    function formatCriterionFallback(finding) {
        const f = finding || {};
        const rawClause = (f.clause != null ? f.clause : (f.kbMatch && f.kbMatch.clause)) || '';
        const criterionRef = f.criterionRef || '';
        const isInternalPrefix = CRITERION_INTERNAL_RX.test(String(rawClause || ''));
        if (criterionRef) {
            return { label: isInternalPrefix ? `${criterionRef} (${rawClause})` : String(criterionRef), isInternal: false };
        }
        if (isInternalPrefix) {
            return { label: `internal audit reference ${rawClause} (criterion to be assigned)`, isInternal: true };
        }
        return { label: rawClause || 'the applicable clause', isInternal: false };
    }

    function formatCriterion(finding) {
        try {
            if (window.ReportStats && typeof window.ReportStats.formatCriterion === 'function') {
                const r = window.ReportStats.formatCriterion(finding);
                if (r && r.label) return r;
            }
        } catch (_e) { /* fall through to local fallback */ }
        return formatCriterionFallback(finding);
    }

    // Full narrative-ready phrase for a finding's clause/criterion, safe to
    // embed directly into a sentence. Never produces "Clause FOCUS.x": an
    // internal working reference without an assigned criterion is described
    // as an internal audit reference, never as a "Clause".
    function clauseText(finding) {
        const c = formatCriterion(finding);
        if (c.isInternal) return c.label;
        return /^clause\b/i.test(c.label) ? c.label : `Clause ${c.label}`;
    }

    function normalizeDept(name) {
        try {
            if (window.ReportStats && typeof window.ReportStats.normalizeDeptName === 'function') {
                return window.ReportStats.normalizeDeptName(name);
            }
        } catch (_e) { /* fall through to local fallback */ }
        const s = String(name == null ? '' : name).trim();
        if (!s || /^(unassigned|general|n\/?a|none|other)$/i.test(s)) return UNASSIGNED_LABEL;
        return s;
    }

    function hasGenuineContent(arr) {
        return safeArr(arr).some(s => String(s == null ? '' : s).trim().length > 0);
    }

    // ------------------------------------------------------------------
    // 1. EXECUTIVE SUMMARY / AUDIT OUTCOME SUMMARY
    // ------------------------------------------------------------------

    function buildExecSummaryPrompt(d) {
        const report = (d && d.report) || {};
        const stats = getStats(d);
        const client = (d && d.client) || {};
        const realNCs = getRealNCs(d);
        const depts = getDepartments(d);
        const deptList = Object.keys(depts).join(', ') || 'N/A';

        const ncLines = realNCs.slice(0, 25).map((i, idx) =>
            `${idx + 1}. [${(i.ncrType || 'NC').toUpperCase()}] ${clauseText(i)}${clauseTitle(i) ? ' — ' + clauseTitle(i) : ''} (Dept: ${normalizeDept(i.department)})`
        ).join('\n');

        return `
You are an ISO management-system audit reporting assistant. Produce factual, evidence-bound narrative fields for THIS audit's executive summary, for the client's senior management, using only the data provided below. Do not invent, assume, or infer any fact not present in the Audit Data or Non-Conformity Detail sections. Do not produce an overall certification verdict or recommendation yourself — that is sourced elsewhere, verbatim, from the certification decision record.

Voice rules (strict):
- Report counts and evidence-based statements only. Never characterize the management system's overall "health", "soundness", "resilience", or "maturity" in subjective terms, and never render a one-line verdict.
- Banned words — do not use any of these anywhere, in any form, alone or combined with another word: "soundness", "fundamental", "health", "resilience", "verdict", "certifiable". Also banned phrases: "demonstrates compliance", "it is recommended that", "the audit was conducted", "in accordance with the requirements of", "it is important to note", "overall, the organization has demonstrated", "generally robust and well-maintained", "in conclusion", "moving forward". Banned: any sentence that could be pasted into a different company's report unchanged.
- Use plain audit language: requirement -> objective evidence -> evaluation -> finding. State only what the audit evidence supports.
- EVERY paragraph-level field (businessImpact, risks, forwardOutlook) MUST contain at least one concrete quantified reference — a count, a clause, or a named department — pulled from the data below. A sentence with no number, clause, or department name is not acceptable.
- Never write the word "Clause" immediately before an internal audit working reference (anything starting with FOCUS, SURV, ORG, or DOC) — those are not final ISO clause citations. Reuse clause/reference text exactly as it already appears in the Non-Conformity Detail list below; never re-derive or reformat a clause reference yourself.
- Never state or estimate financial figures, revenue, penalties, customer loss, cost, contract exposure, or reputational damage. Consequences may reference ONLY certification-process outcomes — e.g. closure timelines, certification decision status, or the scope of verification at the next audit — never business, commercial, or financial outcomes.
- Never claim a finding is "recurring", "repeated", "systemic", or a "pattern" — recurrence can only be stated if the data below explicitly identifies that the same clause failed in a prior audit. If no prior-audit data is provided, describe multiple related findings only by count or as a concentration within this audit, never as a trend across audits.
- Never state a corrective-action requirement as an absolute condition of keeping certification (e.g. do not write "is required to maintain certification" or "must be closed to maintain certification"). State only that findings require corrective action and closure through the certification body's corrective-action process.
- Never list a department or clause under "strengths" if that same department or clause also appears in the Non-Conformity Detail list below.
- For each bullet list (strengths, findings, concerns): identify only genuinely DISTINCT points — do not restate the same underlying theme in different words to pad the list. Cap each list at 3 bullets maximum. "concerns" may be an empty array if there is nothing genuinely distinct beyond what "findings" already covers — it is better to return fewer bullets, or none, than several that repeat one theme.
- No hedging beyond what the evidence supports, but do not overstate certainty either — take a clear position grounded strictly in the data above. Quantify wherever possible (percentages, counts, timeframes).
- Write in plain, declarative sentences a senior manager reads in 90 seconds. No jargon, no markdown symbols.

Audit Data:
- Client: ${report.client || client.name || 'the organization'}
- Standard: ${report.standard || 'ISO Standard'}
- Audit Type: ${report.auditType || 'Audit'}
- Date: ${report.date || ''}
- Total Checklist Items Assessed: ${stats.totalItems || 0} (Applicable: ${stats.applicableCount || 0})
- Conformities: ${stats.conformCount || 0}
- Major Non-Conformities: ${stats.majorNC || 0}
- Minor Non-Conformities: ${stats.minorNC || 0}
- Observations: ${stats.observationCount || 0}
- Opportunities for Improvement: ${stats.ofiCount || 0}
- Departments Assessed: ${deptList}

Non-Conformity Detail:
${ncLines || 'None recorded.'}

Write a JSON object with these fields (plain text, NO markdown symbols like ** or ##, use complete sentences, reference real numbers/clauses/departments from above, using clause references exactly as formatted in the Non-Conformity Detail list):
{
  "strengths": ["up to 3 short bullet strings, each a genuinely distinct key strength, cite departments/clauses — never a department or clause that also appears in the Non-Conformity Detail list above"],
  "findings": ["up to 3 short bullet strings, each a genuinely distinct key finding, cite departments/clauses — do not repeat the same theme worded differently"],
  "concerns": ["0 to 3 short bullet strings, each a genuinely distinct concern for management beyond what 'findings' already covers, framed only in certification-process terms (closure timelines, verification scope) — never financial or commercial terms; return an empty array if there is nothing genuinely distinct to add"],
  "businessImpact": "1-2 sentence statement on the certification-process implications of the findings with at least one number/clause/department (e.g. effect on closure timeline or scope of the next audit) — never a financial, revenue, or commercial figure",
  "risks": "1-2 sentence forward-looking risk statement with at least one number/clause/department — certification-process consequences only (e.g. what could delay closure or affect the scope of verification at the next audit); never revenue, cost, penalties, or customer/business impact",
  "forwardOutlook": "1-2 sentence statement on forward readiness/confidence heading into the next audit stage, citing at least one number/clause/department"
}
Return ONLY the raw JSON object, no markdown fences.`;
    }

    function fallbackExecSummaryData(d) {
        const stats = getStats(d);
        const depts = getDepartments(d);
        const deptEntries = Object.entries(depts);

        const strengths = [];
        const conformPct = computeConformPct(d, stats) ?? 0;
        if (conformPct >= 70) strengths.push(`Strong overall conformity across assessed clauses (${conformPct}% of applicable items conforming).`);
        deptEntries.filter(([, v]) => v.total > 0 && v.nc === 0).slice(0, 3).forEach(([name]) => strengths.push(`${name} demonstrated full conformity during this audit.`));
        if (!strengths.length) strengths.push('No specific department-level strengths could be isolated from available data.');

        const findings = [];
        deptEntries.filter(([, v]) => v.major > 0 || v.minor > 0).sort((a, b) => (b[1].major * 2 + b[1].minor) - (a[1].major * 2 + a[1].minor)).slice(0, 4).forEach(([name, v]) =>
            findings.push(`${name}: ${v.major} major and ${v.minor} minor non-conformity(ies) identified.`));
        if (!findings.length) findings.push('No significant departmental weaknesses identified in this audit cycle.');

        // Genuinely distinct concerns only — no filler placeholder pushed here.
        // An empty array is the honest answer when there is nothing beyond
        // what "findings" already covers; the render layer hides the card.
        const concerns = [];
        if (stats.majorNC > 0) concerns.push(`${stats.majorNC} major non-conformity(ies) present a certification risk requiring immediate corrective action.`);
        if (stats.minorNC > 2) concerns.push(`Multiple minor nonconformities (${stats.minorNC}) were identified across processes; collectively they warrant a review of the underlying controls.`);

        return {
            strengths,
            findings,
            concerns,
            businessImpact: stats.majorNC > 0
                ? `Unresolved major findings (${stats.majorNC}) put the certification decision and closure timeline at risk; each week of delay extends the scope of verification required at the next audit stage.`
                : `Current audit results do not indicate risks likely to affect certification status or the verification scope of the next audit stage.`,
            risks: stats.majorNC > 0
                ? 'Failure to close major non-conformities within the required timeframe may delay or jeopardize certification issuance.'
                : 'Continued monitoring of minor findings and observations is advised to prevent them from compounding into a broader pattern of control gaps.',
            forwardOutlook: stats.majorNC > 0
                ? `Certification remains achievable on the current timeline if the ${stats.majorNC} major finding(s) above are closed within the corrective-action window; the audit team has moderate confidence in readiness pending that closure.`
                : conformPct >= 80
                    ? `The management system is on a stable trajectory toward the next audit stage; the audit team has high confidence in continued conformity if current controls are sustained.`
                    : `The management system is progressing toward the maturity expected at the next audit stage; sustained attention to the findings above will support continued readiness.`
        };
    }

    function renderExecSummaryHtml(data, glance, brief) {
        const list = (arr) => safeArr(arr).map(x => `<li>${esc(x)}</li>`).join('') || `<li class="b4-muted-item">None identified.</li>`;
        const g = glance || {};
        const briefHtml = brief ? renderAuditOutcomeSummary(brief) : '';
        const showConcerns = hasGenuineContent(data.concerns);

        return `
${briefHtml}
<div class="b4-glance-strip">
  <div class="b4-glance-item">
    <div class="b4-eyebrow">Audit Coverage</div>
    <div class="b4-glance-value">${g.coveragePct != null ? g.coveragePct + '%' : '—'}</div>
  </div>
  <div class="b4-glance-item">
    <div class="b4-eyebrow">Findings</div>
    <div class="b4-glance-value">${g.majorNC || 0}<span class="b4-glance-unit">MAJOR</span> &nbsp;/&nbsp; ${g.minorNC || 0}<span class="b4-glance-unit">MINOR</span></div>
  </div>
</div>

<div class="b4-grid-2" style="margin:var(--b4-s5) 0;">
  <div class="b4-card b4-callout b4-callout--info">
    <div class="b4-eyebrow">${icon('shield')} Business Impact</div>
    <p class="b4-body" style="margin:0;">${esc(data.businessImpact || '')}</p>
  </div>
  <div class="b4-card b4-callout b4-callout--warn">
    <div class="b4-eyebrow">${icon('alert')} Forward-Looking Risk</div>
    <p class="b4-body" style="margin:0;">${esc(data.risks || '')}</p>
  </div>
</div>

${showConcerns ? `
<div class="b4-card b4-insight-card" style="margin-bottom:var(--b4-s4);">
  <div class="b4-card-heading">${icon('risk')} Key Concerns</div>
  <ul class="b4-bullets b4-bullets--wide">${list(data.concerns)}</ul>
</div>` : ''}

${data.forwardOutlook ? `
<div class="b4-rule"></div>
<div class="b4-eyebrow">${icon('trend')} Forward Readiness &amp; Confidence</div>
<p class="b4-body" style="margin:0;">${esc(data.forwardOutlook)}</p>` : ''}`;
    }

    // Prefers the canonical window.ReportStats conformityPct (blank-status
    // excluded, advisories treated as conforming-with-comment) when the module
    // is available; falls back to conform+advisories over assessed, blank-excluded.
    function computeConformPct(d, stats) {
        try {
            if (window.ReportStats && typeof window.ReportStats.build === 'function') {
                const ds = window.ReportStats.build(d || {});
                if (ds && ds.conformityPct != null) return ds.conformityPct;
            }
        } catch (_e) { /* fall through to legacy calc */ }
        const items = safeArr(d && d.hydratedProgress).filter(i => i.status && i.status !== 'na');
        if (!items.length) return null;
        const conform = items.filter(i => i.status === 'conform').length;
        const advisories = items.filter(i => i.status === 'nc' && ['observation', 'ofi'].includes((i.ncrType || '').toLowerCase())).length;
        return Math.round(((conform + advisories) / items.length) * 100);
    }

    // Coverage: assessed applicable items / total applicable items (blank-status
    // items reduce coverage; 'na' items are excluded from both sides).
    function computeCoveragePct(d) {
        try {
            if (window.ReportStats && typeof window.ReportStats.build === 'function') {
                const ds = window.ReportStats.build(d || {});
                if (ds && ds.coveragePct != null) return ds.coveragePct;
            }
        } catch (_e) { /* fall through */ }
        const all = safeArr(d && d.hydratedProgress).filter(i => i.status !== 'na');
        if (!all.length) return null;
        const assessed = all.filter(i => !!i.status).length;
        return Math.round((assessed / all.length) * 100);
    }

    function buildGlance(d) {
        const stats = getStats(d);
        const coveragePct = computeCoveragePct(d);
        return {
            coveragePct,
            majorNC: stats.majorNC || 0,
            minorNC: stats.minorNC || 0
        };
    }

    // Dedupe near-identical bullets (same leading theme worded differently) and cap list length.
    function dedupeCap(arr, max) {
        const out = [];
        const seenThemes = new Set();
        safeArr(arr).forEach(raw => {
            const s = String(raw == null ? '' : raw).trim();
            if (!s) return;
            const theme = s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').slice(0, 4).join(' ');
            if (seenThemes.has(theme)) return;
            seenThemes.add(theme);
            out.push(s);
        });
        return out.slice(0, max || 3);
    }

    const BULLET_FIELDS = ['strengths', 'findings', 'concerns'];
    function capExecSummaryLists(data) {
        const out = Object.assign({}, data);
        BULLET_FIELDS.forEach(f => { out[f] = dedupeCap(out[f], 3); });
        return out;
    }

    // ------------------------------------------------------------------
    // Audit Outcome Summary — compact, row-based block that leads the
    // exec-summary section body in the formal certification report.
    // Derived honestly from the same data driving the narrative below it;
    // nothing here is invented. Exactly one certification conclusion is
    // ever shown (stats.recommendation, verbatim) — no separate AI-authored
    // verdict or recommendation is generated for this block.
    // ------------------------------------------------------------------

    // Next audit-programme milestone, derived from the current audit type and
    // the report date (or an explicit next-audit date on d.auditPlan, if present).
    // Returns null (row omitted) when there isn't enough data to derive it honestly.
    function computeNextMilestone(d) {
        const report = (d && d.report) || {};
        const auditPlan = (d && d.auditPlan) || {};
        const type = String(report.auditType || auditPlan.type || auditPlan.auditType || '').toLowerCase();
        const baseDateStr = report.endDate || report.date;
        if (!baseDateStr) return null;
        const baseDate = new Date(baseDateStr);
        if (isNaN(baseDate.getTime())) return null;

        let stage = null, monthsOffset = 12;
        if (/stage\s*1/.test(type)) { stage = 'Stage 2 Audit'; monthsOffset = 1; }
        else if (/stage\s*2/.test(type)) { stage = 'Surveillance Audit 1'; monthsOffset = 12; }
        else if (/surveillance\s*2/.test(type)) { stage = 'Recertification Audit'; monthsOffset = 12; }
        else if (/surveillance/.test(type)) { stage = 'Surveillance Audit 2'; monthsOffset = 12; }
        else if (/recert/.test(type)) { stage = 'Surveillance Audit 1 (new cycle)'; monthsOffset = 12; }
        else return null;

        let nextDate = null;
        const explicit = auditPlan.nextAuditDate || auditPlan.nextDate || auditPlan.surveillanceDate || auditPlan.nextSurveillanceDate;
        if (explicit) {
            const dd = new Date(explicit);
            if (!isNaN(dd.getTime())) nextDate = dd;
        }
        if (!nextDate) {
            nextDate = new Date(baseDate.getTime());
            nextDate.setMonth(nextDate.getMonth() + monthsOffset);
        }
        if (isNaN(nextDate.getTime())) return null;
        return { stage, date: nextDate.toISOString().slice(0, 10) };
    }

    function truncate(s, max) {
        const t = String(s == null ? '' : s).trim();
        return t.length > max ? t.slice(0, max - 1).trim() + '…' : t;
    }

    // Deterministic evidence-bound conclusion sentence: factual counts,
    // followed by the certification recommendation verbatim. Never AI-authored
    // — guarantees the recommendation shown here always matches stats.recommendation
    // exactly and never drifts into subjective "health"/"verdict" language.
    function buildFactualConclusion(d, stats) {
        const total = stats.totalItems || stats.applicableCount || 0;
        const conform = stats.conformCount || 0;
        const major = stats.majorNC || 0;
        const minor = stats.minorNC || 0;
        const obs = stats.observationCount || 0;
        const ofi = stats.ofiCount || 0;
        const coveragePct = computeCoveragePct(d);

        const parts = [`${conform} conforming`];
        if (major > 0) parts.push(`${major} major nonconformit${major === 1 ? 'y' : 'ies'}`);
        parts.push(`${minor} minor nonconformit${minor === 1 ? 'y' : 'ies'}`);
        parts.push(`${obs} observation${obs === 1 ? '' : 's'}`);
        parts.push(`${ofi} opportunit${ofi === 1 ? 'y' : 'ies'} for improvement`);
        const last = parts.pop();
        const countsText = parts.length ? parts.join(', ') + ' and ' + last : last;

        let sentence = `The audit assessed ${total} checklist item${total === 1 ? '' : 's'} within the sampled scope: ${countsText}.`;
        if (coveragePct != null && coveragePct < 100) {
            sentence += ` Objective-evidence coverage across assessed items was ${coveragePct}%.`;
        }
        const recommendation = String(stats.recommendation || '').trim();
        return recommendation ? `${sentence} ${recommendation}` : sentence;
    }

    // Deterministic corrective-action sentence — never phrased as an absolute
    // condition of keeping certification; closure happens through the
    // certification body's corrective-action process.
    function buildCorrectiveActionText(stats) {
        const major = stats.majorNC || 0;
        const minor = stats.minorNC || 0;
        const total = major + minor;
        if (!total) return 'No open nonconformities were identified during this audit; no corrective action is required at this time.';
        const labelParts = [];
        if (major) labelParts.push(`${major} major`);
        if (minor) labelParts.push(`${minor} minor`);
        const noun = total === 1 ? 'nonconformity' : 'nonconformities';
        const verb = total === 1 ? 'requires' : 'require';
        return `The ${labelParts.join(' and ')} ${noun} ${verb} corrective action and satisfactory closure in accordance with the certification body's corrective-action process.`;
    }

    function buildAuditOutcomeSummary(d, data) {
        const stats = getStats(d);
        const report = (d && d.report) || {};

        const conclusion = buildFactualConclusion(d, stats);

        let strengths = dedupeCap(data.strengths, 3).map(s => truncate(cleanFindingText(s, 140), 140));
        if (!strengths.length) strengths = ['No specific department-level strengths could be isolated from available data.'];

        let findings = dedupeCap(data.findings, 4).map(s => truncate(cleanFindingText(s, 140), 140));
        if (!findings.length) findings = ['No significant findings identified in this audit cycle.'];

        const previousFindingsStatus = (report.previousFindingsStatus && String(report.previousFindingsStatus).trim()) || '—';

        const correctiveAction = buildCorrectiveActionText(stats);

        const recommendation = stats.recommendation || 'Certification decision pending.';

        const milestone = computeNextMilestone(d);
        const nextAudit = milestone ? `${milestone.stage} — ${milestone.date}` : '—';

        return { conclusion, strengths, findings, previousFindingsStatus, correctiveAction, recommendation, nextAudit };
    }

    function renderAuditOutcomeSummary(s) {
        const li = (arr) => safeArr(arr).map(x => `<li>${esc(x)}</li>`).join('');

        return `
<div class="b4-board-brief">
  <div class="b4-board-brief-head">
    <div class="b4-eyebrow">${icon('shield')} Audit Outcome Summary</div>
  </div>
  <div class="b4-board-brief-row">
    <div class="b4-board-brief-label">${icon('finding', { size: 13 })} Overall Conclusion</div>
    <div class="b4-board-brief-value">${esc(s.conclusion)}</div>
  </div>
  <div class="b4-board-brief-row">
    <div class="b4-board-brief-label">${icon('check', { size: 13 })} Key Strengths</div>
    <ul class="b4-bullets b4-board-brief-list">${li(s.strengths)}</ul>
  </div>
  <div class="b4-board-brief-row">
    <div class="b4-board-brief-label">${icon('alert', { size: 13 })} Key Findings</div>
    <ul class="b4-bullets b4-board-brief-list">${li(s.findings)}</ul>
  </div>
  <div class="b4-board-brief-row">
    <div class="b4-board-brief-label">${icon('clock', { size: 13 })} Previous Findings Status</div>
    <div class="b4-board-brief-value">${esc(s.previousFindingsStatus)}</div>
  </div>
  <div class="b4-board-brief-row">
    <div class="b4-board-brief-label">${icon('capa', { size: 13 })} Corrective Action Requirements</div>
    <div class="b4-board-brief-value">${esc(s.correctiveAction)}</div>
  </div>
  <div class="b4-board-brief-row">
    <div class="b4-board-brief-label">${icon('check', { size: 13 })} Certification Recommendation</div>
    <div class="b4-board-brief-value">${esc(s.recommendation)}</div>
  </div>
  <div class="b4-board-brief-row">
    <div class="b4-board-brief-label">${icon('clock', { size: 13 })} Next Audit</div>
    <div class="b4-board-brief-value">${esc(s.nextAudit)}</div>
  </div>
</div>
<div class="b4-rule"></div>`;
    }

    // Cross-checks AI-authored "strengths" against the real NC list before it
    // is ever merged/rendered: a department or clause that appears in the
    // non-conformity list must never also be cited as a strength — the model
    // has no reliable self-check against the data it was given, so this is
    // enforced in code, not just via prompt instruction.
    function buildNCExclusionSet(d) {
        const realNCs = getRealNCs(d);
        const depts = new Set();
        const clauses = new Set();
        realNCs.forEach(i => {
            const dep = (i.department && String(i.department).trim()) || '';
            if (dep) depts.add(dep.toLowerCase());
            const cl = clauseLabel(i);
            if (cl && cl !== 'General') clauses.add(String(cl).toLowerCase());
        });
        return { depts, clauses };
    }

    function filterStrengthsAgainstNCs(d, strengths) {
        const excl = buildNCExclusionSet(d);
        if (!excl.depts.size && !excl.clauses.size) return safeArr(strengths);
        return safeArr(strengths).filter(s => {
            const low = String(s == null ? '' : s).toLowerCase();
            for (const dep of excl.depts) { if (dep && low.indexOf(dep) !== -1) return false; }
            for (const cl of excl.clauses) { if (cl && low.indexOf(cl) !== -1) return false; }
            return true;
        });
    }

    async function generateExecutiveSummary(d) {
        const fallback = fallbackExecSummaryData(d);
        if (!window.AI_SERVICE || typeof window.AI_SERVICE.callProxyAPI !== 'function') {
            const capped = capExecSummaryLists(fallback);
            return { html: renderExecSummaryHtml(capped, buildGlance(d), buildAuditOutcomeSummary(d, capped)) };
        }
        try {
            const prompt = buildExecSummaryPrompt(d);
            const text = await window.AI_SERVICE.callProxyAPI(prompt);
            const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
            if (Array.isArray(parsed.strengths)) parsed.strengths = filterStrengthsAgainstNCs(d, parsed.strengths);
            const merged = capExecSummaryLists(Object.assign({}, fallback, parsed));
            return { html: renderExecSummaryHtml(merged, buildGlance(d), buildAuditOutcomeSummary(d, merged)) };
        } catch (err) {
            console.warn('[ReportExecutive] generateExecutiveSummary AI failed, using fallback:', err);
            const capped = capExecSummaryLists(fallback);
            return { html: renderExecSummaryHtml(capped, buildGlance(d), buildAuditOutcomeSummary(d, capped)) };
        }
    }

    // ------------------------------------------------------------------
    // 2. EVIDENCE INTELLIGENCE  (deterministic)
    // ------------------------------------------------------------------

    // Heuristic: an item reads as a "document review" touchpoint if its comment/evidence
    // text references reviewing records/documents rather than an observed activity.
    const DOC_REVIEW_RX = /\b(document|procedure|record|policy|manual|register|log|form|report|certificate)s?\b.{0,20}\b(review|reviewed|verified|checked|examined|inspected|sighted|seen)\b|\b(review|reviewed|verified|checked|examined)\b.{0,20}\b(document|procedure|record|policy|manual|register|log|form|report|certificate)s?\b/i;

    function computeEvidenceIntel(d) {
        // Exclude both 'na' and blank/not-assessed items from the applicable set.
        const items = safeArr(d && d.hydratedProgress).filter(i => i.status && i.status !== 'na');
        const total = items.length;
        let withEvidence = 0;
        let totalPhotos = 0;
        let docsReviewed = 0;
        const personnelSet = new Set();
        const missingEvidence = [];
        const evidenced = [];
        const byDepartment = {};

        items.forEach(item => {
            const imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
            const dept = normalizeDept(item.department);
            if (!byDepartment[dept]) byDepartment[dept] = { total: 0, withEvidence: 0 };
            byDepartment[dept].total++;

            totalPhotos += (imgs && imgs.length) || 0;

            // personnel is stored as a comma/semicolon-separated string on checklist
            // items (see audit-trails in execution-reporting.js); tolerate arrays too.
            const personnel = Array.isArray(item.personnel)
                ? item.personnel
                : String(item.personnel || '').split(/[,;]/);
            personnel.forEach(p => {
                const name = (p && (p.name || p)) ? String(p.name || p).trim() : '';
                if (name) personnelSet.add(name.toLowerCase());
            });

            const commentText = String(item.comment || '');
            if (DOC_REVIEW_RX.test(commentText)) docsReviewed++;

            const hasEvidence = !!(imgs && imgs.length);
            if (hasEvidence) {
                withEvidence++;
                byDepartment[dept].withEvidence++;
                evidenced.push({
                    clause: clauseLabel(item),
                    title: clauseTitle(item) || cleanFindingText(item.requirement || '', 90),
                    department: dept,
                    status: item.status,
                    ncrType: item.ncrType || '',
                    comment: cleanFindingText(item.comment || '', 160),
                    imageCount: imgs.length,
                    timestamp: item.timestamp || item.capturedAt || item.date || null
                });
            } else {
                // "findings with no evidence" — only genuine non-conformities are
                // findings; a conforming item with a comment is a noted remark,
                // not a finding, and must not appear in this table.
                const hasFinding = item.status === 'nc';
                if (hasFinding) {
                    missingEvidence.push({
                        clause: clauseLabel(item),
                        item: clauseTitle(item) || cleanFindingText(item.requirement || item.description || '', 90) || 'Untitled item',
                        department: dept,
                        status: item.status,
                        ncrType: item.ncrType || ''
                    });
                }
            }
        });

        const coveragePct = total > 0 ? Math.round((withEvidence / total) * 100) : 0;
        const interviewCount = personnelSet.size;

        let qualityNote;
        if (total === 0) {
            qualityNote = 'No applicable items recorded — coverage cannot be assessed.';
        } else if (coveragePct >= 80) {
            qualityNote = `Objective evidence is well-documented at ${coveragePct}% coverage.`;
        } else if (coveragePct >= 50) {
            qualityNote = `Coverage is moderate at ${coveragePct}%; ${missingEvidence.length} finding(s) need supporting evidence before issuance.`;
        } else {
            qualityNote = `Coverage is low at ${coveragePct}%, weakening defensibility of ${missingEvidence.length} finding(s) under accreditation review.`;
        }

        return {
            coveragePct, missingEvidence, evidenced, byDepartment, qualityNote,
            totalApplicable: total, withEvidence,
            documentsReviewed: docsReviewed,
            interviewCount,
            photoCount: totalPhotos
        };
    }

    function renderEvidenceIntelHtml(intel) {
        const rows = intel.missingEvidence.slice(0, 40).map(m => `
<tr>
  <td><strong>${esc(m.clause)}</strong></td>
  <td>${esc(m.item)}</td>
  <td>${esc(m.department)}</td>
  <td>${m.status === 'nc' ? `<span class="b4-badge b4-badge--${m.ncrType === 'major' ? 'bad' : 'warn'}">${m.ncrType === 'major' ? '✕ ' : '! '}${esc((m.ncrType || 'nc').toUpperCase())}</span>` : `<span class="b4-badge b4-badge--neutral">${esc(m.status || '')}</span>`}</td>
</tr>`).join('');

        const deptRows = Object.entries(intel.byDepartment).map(([name, v]) => {
            const pct = v.total ? Math.round((v.withEvidence / v.total) * 100) : 0;
            const sev = pct >= 80 ? 'good' : pct >= 50 ? 'warn' : 'bad';
            return `<div class="b4-bar-row">
  <div class="b4-bar-label">${esc(name)}</div>
  <div class="b4-bar"><div class="b4-bar-fill b4-bar-fill--${sev}" style="width:${pct}%;"></div></div>
  <div class="b4-bar-pct">${pct}%</div>
</div>`;
        }).join('') || '<div class="b4-muted-item">No department data available.</div>';

        // richer evidence samples — show a small gallery of captured evidence with whatever metadata exists
        const sampleCards = intel.evidenced.slice(0, 6).map(e => `
<div class="b4-card b4-evidence-card">
  <div class="b4-evidence-card-head">
    <span class="b4-badge b4-badge--${e.status === 'nc' ? (e.ncrType === 'major' ? 'bad' : 'warn') : 'good'}">${e.status === 'nc' ? (e.ncrType === 'major' ? '✕ ' : '! ') : '✓ '}${esc(e.status === 'nc' ? (e.ncrType || 'NC').toUpperCase() : 'CONFORM')}</span>
    <span class="b4-caption">${icon('evidence', { size: 13 })} ${e.imageCount} image${e.imageCount === 1 ? '' : 's'}</span>
  </div>
  <div class="b4-card-heading" style="margin-top:6px;">${icon('clause', { size: 14 })} ${esc(e.clause)}</div>
  ${e.title ? `<div class="b4-caption">${esc(e.title)}</div>` : ''}
  <div class="b4-caption" style="margin-top:4px;">${icon('department', { size: 13 })} ${esc(e.department)}${e.timestamp ? ` &middot; ${icon('clock', { size: 13 })} ${esc(e.timestamp)}` : ''}</div>
  ${e.comment ? `<p class="b4-body" style="margin-top:6px;">${esc(e.comment)}</p>` : ''}
</div>`).join('');

        // Core KPIs always shown; derivable-only KPIs (documents/interviews/photos) are
        // omitted gracefully when the underlying signal is zero across the whole audit.
        const extraKpis = [];
        if (intel.documentsReviewed > 0) {
            extraKpis.push(`
  <div class="b4-kpi-card">
    <div class="b4-kpi-icon">${icon('document')}</div>
    <div class="b4-kpi-value">${intel.documentsReviewed}</div>
    <div class="b4-kpi-label">Documents Reviewed</div>
  </div>`);
        }
        if (intel.interviewCount > 0) {
            extraKpis.push(`
  <div class="b4-kpi-card">
    <div class="b4-kpi-icon">${icon('interview')}</div>
    <div class="b4-kpi-value">${intel.interviewCount}</div>
    <div class="b4-kpi-label">Interviews</div>
  </div>`);
        }
        if (intel.photoCount > 0) {
            extraKpis.push(`
  <div class="b4-kpi-card">
    <div class="b4-kpi-icon">${icon('camera')}</div>
    <div class="b4-kpi-value">${intel.photoCount}</div>
    <div class="b4-kpi-label">Photos</div>
  </div>`);
        }

        return `
<div class="b4-rule"></div>
<div class="b4-kpi-grid">
  <div class="b4-kpi-card b4-kpi-card--accent">
    <div class="b4-kpi-icon">${icon('evidence')}</div>
    <div class="b4-kpi-value">${intel.coveragePct}%</div>
    <div class="b4-kpi-label">Evidence Coverage</div>
  </div>
  <div class="b4-kpi-card">
    <div class="b4-kpi-icon">${icon('check')}</div>
    <div class="b4-kpi-value">${intel.withEvidence}</div>
    <div class="b4-kpi-label">Items with Evidence</div>
  </div>
  <div class="b4-kpi-card">
    <div class="b4-kpi-icon">${icon('alert')}</div>
    <div class="b4-kpi-value" style="color:${intel.missingEvidence.length > 0 ? 'var(--b4-bad)' : 'var(--b4-navy)'};">${intel.missingEvidence.length}</div>
    <div class="b4-kpi-label">Missing Evidence</div>
  </div>${extraKpis.join('')}
</div>
<p class="b4-caption" style="margin-top:var(--b4-s3);">${esc(intel.qualityNote)}</p>

<div class="b4-section-title" style="margin-top:var(--b4-s5);">Evidence Coverage by Department</div>
<div class="b4-card">${deptRows}</div>

${sampleCards ? `
<div class="b4-section-title" style="margin-top:var(--b4-s5);">${icon('evidence')} Evidence Samples</div>
<div class="b4-grid-3">${sampleCards}</div>` : ''}

<div class="b4-section-title" style="margin-top:var(--b4-s5);">Findings Without Supporting Evidence</div>
${intel.missingEvidence.length ? `
<table class="b4-tbl">
  <thead><tr>
    <th>Clause</th><th>Item</th><th>Department</th><th>Status</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>` : '<div class="b4-callout b4-callout--good">All findings are supported by documented evidence.</div>'}`;
    }

    // ------------------------------------------------------------------
    // 3. EXECUTIVE INSIGHTS
    // ------------------------------------------------------------------

    const INSIGHT_CARD_DEFS = [
        { key: 'risks', title: 'Biggest Business Risks', icon: '&#9888;' },
        { key: 'departments', title: 'Departments Needing Attention', icon: '&#127970;' },
        { key: 'recurring', title: 'Recurring Weaknesses', icon: '&#128257;' },
        { key: 'improvements', title: 'Positive Improvements', icon: '&#9989;' },
        { key: 'readiness', title: 'Certification Readiness', icon: '&#127942;' },
        { key: 'strategic', title: 'Suggested Strategic Priorities', icon: '&#127919;' }
    ];

    // Genuine cross-audit recurrence: a clause only counts as "recurring" when
    // it failed (major/minor) in THIS audit AND in the most recent prior
    // finalized audit for the same client/standard. Mirrors the pattern used
    // by report-scoring.js's clauseIntelligence(). Returns null when no prior
    // finalized audit exists for this client — callers must retitle/reword
    // rather than claim recurrence in that case.
    function computeGenuineRecurrence(d) {
        try {
            const report = (d && d.report) || {};
            const clientId = report.clientId;
            if (!clientId) return null;
            const allReports = (window.state && window.state.auditReports) || [];
            const prevReports = allReports
                .filter(r => r && r.clientId === clientId && String(r.id) !== String(report.id) &&
                    r.reportStatus === 'final' && (!report.standard || r.standard === report.standard))
                .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
            const prevReport = prevReports[0];
            if (!prevReport) return null;

            const prevFailedClauses = new Set(
                (prevReport.checklistProgress || [])
                    .filter(p => p && p.status === 'nc' && ['major', 'minor'].includes(String(p.ncrType || '').toLowerCase()))
                    .map(p => p.clause)
                    .filter(Boolean)
            );

            const clauseCounts = {};
            getRealNCs(d).forEach(i => {
                const c = i.clause || (i.kbMatch && i.kbMatch.clause) || '';
                if (!c) return;
                clauseCounts[c] = (clauseCounts[c] || 0) + 1;
            });
            const recurringClauses = Object.entries(clauseCounts)
                .filter(([c]) => prevFailedClauses.has(c))
                .map(([clause, count]) => ({ clause, count }));

            return { hasPrior: true, recurringClauses };
        } catch (_e) {
            return null;
        }
    }

    // Confidence is "High" when a card is grounded directly in counted findings/register
    // data (real NC counts, department tallies, evidence coverage numbers); "Moderate"
    // when the card is heuristic/derived (pattern inference, forward-looking judgment).
    // Priority reflects urgency: Immediate (major NCs / certification-affecting),
    // Near-term (minor NCs / clustered gaps), Monitor (no material open item).
    function fallbackInsights(d) {
        const stats = getStats(d);
        const realNCs = getRealNCs(d);
        const depts = getDepartments(d);
        const deptEntries = Object.entries(depts);
        const intel = computeEvidenceIntel(d);

        const recurrenceData = computeGenuineRecurrence(d);

        const risks = [];
        if (stats.majorNC > 0) risks.push(`${stats.majorNC} major non-conformity(ies) could delay certification issuance.`);
        if (intel.coveragePct < 50) risks.push('Low evidence coverage weakens the defensibility of findings under accreditation scrutiny.');
        if (stats.minorNC > 3) {
            if (recurrenceData && recurrenceData.hasPrior && recurrenceData.recurringClauses.length) {
                risks.push(`${stats.minorNC} minor non-conformities include ${recurrenceData.recurringClauses.length} clause(s) that also failed in the client's prior audit — a genuine recurrence pattern.`);
            } else {
                risks.push(`${stats.minorNC} minor non-conformities were identified across processes; collectively they warrant a review of the underlying controls.`);
            }
        }
        if (!risks.length) risks.push('Current audit results do not indicate risks likely to affect certification status or the verification scope of the next audit stage.');

        const departments = deptEntries
            .filter(([, v]) => v.major > 0 || v.minor > 0)
            .sort((a, b) => (b[1].major * 2 + b[1].minor) - (a[1].major * 2 + a[1].minor))
            .slice(0, 4)
            .map(([name, v]) => `${name}: ${v.major} major, ${v.minor} minor finding(s).`);
        if (!departments.length) departments.push('No department currently requires elevated attention.');
        const worstDept = deptEntries.filter(([, v]) => v.major > 0 || v.minor > 0).sort((a, b) => (b[1].major * 2 + b[1].minor) - (a[1].major * 2 + a[1].minor))[0];

        // Recurring card: only use "recurring" language when a prior finalized
        // audit for this client actually shows the same clause failing again.
        // Absent that data, retitle as a same-audit concentration — never imply
        // a cross-audit trend the report can't back up.
        var recurring, recurringPairsLen, recurringTitle;
        if (recurrenceData && recurrenceData.hasPrior) {
            recurringPairsLen = recurrenceData.recurringClauses.length;
            recurring = recurrenceData.recurringClauses.map(({ clause, count }) =>
                `${clauseText({ clause })}: ${count} finding(s) this audit, and also failed in the client's prior audit.`);
            if (!recurring.length) recurring.push('No clauses failed in both this audit and the client\'s prior audit.');
            recurringTitle = 'Recurring Weaknesses';
        } else {
            const clauseCounts = {};
            realNCs.forEach(i => { const c = clauseLabel(i).split('.').slice(0, 2).join('.'); clauseCounts[c] = (clauseCounts[c] || 0) + 1; });
            const concentrationPairs = Object.entries(clauseCounts).filter(([, c]) => c > 1);
            recurringPairsLen = concentrationPairs.length;
            recurring = concentrationPairs.map(([c, count]) => `${clauseText({ clause: c })}: ${count} findings in this audit.`);
            if (!recurring.length) recurring.push('No clause concentrations detected in this audit.');
            recurringTitle = 'Clause Concentrations (this audit)';
        }

        const improvements = [];
        deptEntries.filter(([, v]) => v.total > 0 && v.nc === 0).slice(0, 4).forEach(([name]) => improvements.push(`${name} showed full conformity — a positive indicator of process maturity.`));
        if (stats.conformCount > 0) improvements.push(`${stats.conformCount} item(s) confirmed conforming, supporting baseline system effectiveness.`);
        if (!improvements.length) improvements.push('No specific positive improvements identified in this cycle.');

        const readiness = [];
        readiness.push(stats.recommendation || (stats.majorNC > 0 ? 'Conditional — major non-conformities must be closed first.' : 'Ready for certification recommendation.'));
        readiness.push(`Current standing: ${stats.majorNC || 0} major, ${stats.minorNC || 0} minor open item(s).`);

        const strategic = realNCs.slice(0, 4).map(i => `Prioritize closure of ${(i.ncrType || 'nc').toUpperCase()} at ${clauseText(i)}.`);
        if (intel.coveragePct < 70) strategic.push('Improve evidence-capture discipline across audit teams.');
        if (!strategic.length) strategic.push('Sustain current practices; focus on continual improvement initiatives.');

        return {
            risks: {
                bullets: risks,
                confidence: 'High',
                priority: stats.majorNC > 0 ? 'Immediate' : (stats.minorNC > 3 ? 'Near-term' : 'Monitor'),
                recommendation: stats.majorNC > 0
                    ? `Direct an executive owner to close the ${stats.majorNC} major finding(s) above before the certification decision is finalized.`
                    : 'Maintain current risk-monitoring cadence; no elevated management action required this cycle.'
            },
            departments: {
                bullets: departments,
                confidence: worstDept ? 'High' : 'Moderate',
                priority: worstDept && worstDept[1].major > 0 ? 'Immediate' : (worstDept ? 'Near-term' : 'Monitor'),
                recommendation: worstDept
                    ? `Direct ${worstDept[0]} leadership to root-cause its open finding(s), not just remediate symptoms.`
                    : 'No department currently requires elevated management attention.'
            },
            recurring: {
                title: recurringTitle,
                bullets: recurring,
                confidence: recurringPairsLen ? 'High' : 'Moderate',
                priority: recurringPairsLen ? 'Near-term' : 'Monitor',
                recommendation: recurringPairsLen
                    ? ((recurrenceData && recurrenceData.hasPrior)
                        ? 'Commission a root-cause review of the recurring clause area(s) above rather than closing each finding in isolation.'
                        : 'Review the clause concentration(s) above at the next management review; a prior-audit comparison will be available from the next audit cycle.')
                    : 'Continue routine clause-level trend monitoring at each management review.'
            },
            improvements: {
                bullets: improvements,
                confidence: 'High',
                priority: 'Monitor',
                recommendation: 'Recognize and sustain the practices behind these results at the next management review.'
            },
            readiness: {
                bullets: readiness,
                confidence: 'High',
                priority: stats.majorNC > 0 ? 'Immediate' : 'Monitor',
                recommendation: stats.majorNC > 0
                    ? 'Confirm a corrective-action closure date before scheduling the next audit stage.'
                    : 'Proceed with scheduling the next audit stage on the standard cycle.'
            },
            strategic: {
                bullets: strategic,
                confidence: 'Moderate',
                priority: intel.coveragePct < 70 ? 'Near-term' : 'Monitor',
                recommendation: intel.coveragePct < 70
                    ? 'Set a minimum evidence-capture standard for audit teams ahead of the next cycle.'
                    : 'Continue current continual-improvement initiatives; no additional management action required.'
            }
        };
    }

    function buildInsightsPrompt(d) {
        const stats = getStats(d);
        const report = (d && d.report) || {};
        const realNCs = getRealNCs(d);
        const depts = getDepartments(d);
        const deptSummary = Object.entries(depts).map(([n, v]) => `${n}: total ${v.total}, conform ${v.conform}, major ${v.major}, minor ${v.minor}`).join('; ');
        const ncLines = realNCs.slice(0, 20).map((i, idx) => `${idx + 1}. [${(i.ncrType || 'NC').toUpperCase()}] ${clauseText(i)} (${normalizeDept(i.department)})`).join('\n');

        const recurrenceData = computeGenuineRecurrence(d);
        let priorAuditLines = 'Not available — no prior finalized audit found for this client/standard.';
        if (recurrenceData && recurrenceData.hasPrior) {
            priorAuditLines = recurrenceData.recurringClauses.length
                ? `Prior finalized audit exists. Clauses that failed both then and in this audit: ${recurrenceData.recurringClauses.map(r => clauseText({ clause: r.clause })).join(', ')}.`
                : 'Prior finalized audit exists for this client, but no clause that failed previously failed again in this audit.';
        }

        return `
You are an ISO management-system audit reporting assistant generating executive insight cards for an audit report dashboard, using only the data provided below. Each bullet must be specific and decision-oriented — cite real numbers, clause numbers, and department names from the data. No hedging, no generic filler ("it is important to note", "overall", "the organization demonstrates compliance"). Banned phrases, do not use any of these anywhere: "demonstrates compliance", "it is recommended that", "the audit was conducted", "in accordance with the requirements of". Also banned anywhere, alone or combined with another word: "soundness", "fundamental", "health", "resilience", "verdict", "certifiable". Use plain audit language: requirement -> objective evidence -> evaluation -> finding.
- Never state or estimate financial figures, revenue, penalties, customer loss, cost, contract exposure, or reputational damage. Frame consequences only in certification-process terms (closure timelines, verification scope at the next audit).
- Never claim a finding, weakness, or clause is "recurring," "repeated," "systemic," or part of a "pattern" across audits unless the Prior-Audit Comparison line below explicitly shows it failed previously too. Absent that, describe same-audit clusters only as a count or "concentration within this audit."
- Never write the word "Clause" immediately before an internal audit working reference (anything starting with FOCUS, SURV, ORG, or DOC). Reuse clause references exactly as formatted in the Non-conformities list below; never re-derive or reformat one yourself.
- Never state a corrective-action requirement as an absolute condition of keeping certification (e.g. do not write "is required to maintain certification"). State only that findings require corrective action and closure through the certification body's corrective-action process.

Context:
- Client: ${report.client || ''}
- Standard: ${report.standard || ''}
- Major NC: ${stats.majorNC || 0}, Minor NC: ${stats.minorNC || 0}, Observations: ${stats.observationCount || 0}, OFI: ${stats.ofiCount || 0}
- Department Summary: ${deptSummary || 'N/A'}
- Non-conformities:
${ncLines || 'None'}
- Prior-Audit Comparison: ${priorAuditLines}

For each key, return an object with: "bullets" (2-3 short plain-text bullet strings, no markdown), "confidence" (exactly "High" if the bullets are grounded directly in counted findings/register data from above, or "Moderate" if they are heuristic/derived judgment), "priority" (exactly "Immediate", "Near-term", or "Monitor" reflecting real urgency), and "recommendation" (one bolded-lead-in-ready sentence of management guidance, e.g. "Direct an executive owner to close the 2 major findings above before the certification decision is finalized.").

Return ONLY a raw JSON object (no markdown fences) shaped exactly like this:
{
  "risks": { "bullets": [...], "confidence": "High"|"Moderate", "priority": "Immediate"|"Near-term"|"Monitor", "recommendation": "..." },
  "departments": { "bullets": [...], "confidence": "...", "priority": "...", "recommendation": "..." },
  "recurring": { "bullets": [...], "confidence": "...", "priority": "...", "recommendation": "..." },
  "improvements": { "bullets": [...], "confidence": "...", "priority": "...", "recommendation": "..." },
  "readiness": { "bullets": [...], "confidence": "...", "priority": "...", "recommendation": "..." },
  "strategic": { "bullets": [...], "confidence": "...", "priority": "...", "recommendation": "..." }
}`;
    }

    const INSIGHT_ICON_MAP = { risks: 'risk', departments: 'department', recurring: 'trend', improvements: 'check', readiness: 'target', strategic: 'shield' };

    const PRIORITY_BADGE_CLASS = { 'Immediate': 'b4-badge--bad', 'Near-term': 'b4-badge--warn', 'Monitor': 'b4-badge--neutral' };
    const PRIORITY_BADGE_SYMBOL = { 'Immediate': '✕ ', 'Near-term': '! ' };
    const CONFIDENCE_BADGE_CLASS = { 'High': 'b4-badge--info', 'Moderate': 'b4-badge--neutral' };

    // Normalize one AI/fallback insight entry into {bullets,confidence,priority,recommendation},
    // tolerating a legacy plain-array shape from either source. `title` is
    // always taken from the deterministic fallback — it reflects whether
    // genuine cross-audit recurrence data exists, which the AI has no
    // reliable way to self-report, so it is never AI-controlled.
    function normalizeInsightEntry(raw, fallbackEntry) {
        const fb = fallbackEntry || { bullets: [], confidence: 'Moderate', priority: 'Monitor', recommendation: '' };
        if (!raw) return fb;
        if (Array.isArray(raw)) return Object.assign({}, fb, { bullets: raw, title: fb.title });
        return {
            title: fb.title,
            bullets: (Array.isArray(raw.bullets) && raw.bullets.length) ? raw.bullets : fb.bullets,
            confidence: (raw.confidence === 'High' || raw.confidence === 'Moderate') ? raw.confidence : fb.confidence,
            priority: (raw.priority === 'Immediate' || raw.priority === 'Near-term' || raw.priority === 'Monitor') ? raw.priority : fb.priority,
            recommendation: raw.recommendation || fb.recommendation
        };
    }

    function renderInsightsHtml(data) {
        const cards = INSIGHT_CARD_DEFS.map(def => {
            const entry = (data && data[def.key]) || { bullets: [], confidence: 'Moderate', priority: 'Monitor', recommendation: '' };
            const bulletItems = safeArr(entry.bullets).slice(0, 3).map(b => `<li>${esc(cleanFindingText(b, 140))}</li>`).join('') || '<li class="b4-muted-item">No data available.</li>';
            const confClass = CONFIDENCE_BADGE_CLASS[entry.confidence] || 'b4-badge--neutral';
            const prioClass = PRIORITY_BADGE_CLASS[entry.priority] || 'b4-badge--neutral';
            return `
<div class="b4-card b4-insight-card">
  <div class="b4-card-heading">${icon(INSIGHT_ICON_MAP[def.key] || 'finding')} ${esc(entry.title || def.title)}</div>
  <div class="b4-badge-row">
    <span class="b4-badge ${confClass}">${esc(entry.confidence || 'Moderate')} Confidence</span>
    <span class="b4-badge ${prioClass}">${PRIORITY_BADGE_SYMBOL[entry.priority] || ''}${esc(entry.priority || 'Monitor')}</span>
  </div>
  <ul class="b4-bullets">${bulletItems}</ul>
  ${entry.recommendation ? `<p class="b4-body b4-insight-rec"><strong>Management recommendation:</strong> ${esc(cleanFindingText(entry.recommendation, 180))}</p>` : ''}
</div>`;
        }).join('');
        return `<div class="b4-rule"></div><div class="b4-grid-2 b4-grid-2--roomy">${cards}</div>`;
    }

    async function generateExecutiveInsights(d) {
        const fallback = fallbackInsights(d);
        if (!window.AI_SERVICE || typeof window.AI_SERVICE.callProxyAPI !== 'function') {
            return { html: renderInsightsHtml(fallback) };
        }
        try {
            const prompt = buildInsightsPrompt(d);
            const text = await window.AI_SERVICE.callProxyAPI(prompt);
            const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) || {};
            const merged = {};
            INSIGHT_CARD_DEFS.forEach(def => { merged[def.key] = normalizeInsightEntry(parsed[def.key], fallback[def.key]); });
            return { html: renderInsightsHtml(merged) };
        } catch (err) {
            console.warn('[ReportExecutive] generateExecutiveInsights AI failed, using fallback:', err);
            return { html: renderInsightsHtml(fallback) };
        }
    }

    // ------------------------------------------------------------------
    // 4. sections() / prepare()
    // ------------------------------------------------------------------

    async function prepare(d) {
        const key = cacheKey(d);
        try {
            const [summary, insights] = await Promise.all([
                generateExecutiveSummary(d),
                generateExecutiveInsights(d)
            ]);
            _cache[key] = { summary, insights, ts: Date.now() };
        } catch (err) {
            console.warn('[ReportExecutive] prepare() failed, sections will use fallback rendering:', err);
        }
        return _cache[key];
    }

    function sections(d) {
        const key = cacheKey(d);
        const cached = _cache[key];
        const intel = computeEvidenceIntel(d);

        const summaryHtml = (cached && cached.summary && cached.summary.html) || (function () {
            const capped = capExecSummaryLists(fallbackExecSummaryData(d));
            return renderExecSummaryHtml(capped, buildGlance(d), buildAuditOutcomeSummary(d, capped));
        })();
        const insightsHtml = (cached && cached.insights && cached.insights.html) || renderInsightsHtml(fallbackInsights(d));

        return [
            {
                key: 'exec-summary',
                name: 'EXECUTIVE SUMMARY',
                desc: 'Evidence-based summary of audit outcome, findings, and certification recommendation.',
                color: '#0f2a43',
                bodyHtml: summaryHtml,
                charts: []
            },
            {
                key: 'evidence-intel',
                name: 'EVIDENCE INTELLIGENCE',
                desc: 'Coverage analysis of objective evidence supporting audit findings.',
                color: '#0e7490',
                bodyHtml: renderEvidenceIntelHtml(intel),
                charts: []
            },
            {
                key: 'exec-insights',
                name: 'EXECUTIVE INSIGHTS',
                desc: 'Six key insight cards derived from audit data — risks, departments, trends, readiness.',
                color: '#7c3aed',
                bodyHtml: insightsHtml,
                charts: []
            }
        ];
    }

    function sectionsPreviewToggles() {
        return [
            { id: 'exec-summary', label: 'Exec Summary', icon: 'fa-chess-king', color: '#0f2a43' },
            { id: 'evidence-intel', label: 'Evidence Intel', icon: 'fa-magnifying-glass-chart', color: '#0e7490' },
            { id: 'exec-insights', label: 'Exec Insights', icon: 'fa-lightbulb', color: '#7c3aed' }
        ];
    }

    // ------------------------------------------------------------------
    // 5. askAuditAI / assistant panel
    // ------------------------------------------------------------------

    function buildAskContext(d) {
        const report = (d && d.report) || {};
        const stats = getStats(d);
        const realNCs = getRealNCs(d).map(i => ({ clause: formatCriterion(i).label, type: i.ncrType, department: normalizeDept(i.department), dueDate: i.caDueDate || null, comment: (i.comment || '').substring(0, 200) }));
        const obsOfi = getObsOfi(d).map(i => ({ clause: formatCriterion(i).label, type: i.ncrType, department: normalizeDept(i.department) }));
        const depts = getDepartments(d);
        return {
            client: report.client,
            standard: report.standard,
            auditType: report.auditType,
            date: report.date,
            stats,
            nonConformities: realNCs,
            observationsAndOfi: obsOfi,
            departments: depts
        };
    }

    function overdueCapas(d) {
        const today = new Date();
        return getRealNCs(d).filter(i => {
            if (!i.caDueDate) return false;
            const due = new Date(i.caDueDate);
            return !isNaN(due.getTime()) && due < today;
        });
    }

    function fallbackAsk(question, d) {
        const q = (question || '').toLowerCase();
        const stats = getStats(d);
        const report = (d && d.report) || {};

        if (/summar/.test(q)) {
            return `Audit of ${report.client || 'the organization'} against ${report.standard || 'the applicable standard'}: ${stats.actualNCCount || 0} non-conformity(ies) (${stats.majorNC || 0} major, ${stats.minorNC || 0} minor), ${stats.obsOfiCount || 0} observation(s)/OFI. Recommendation: ${stats.recommendation || 'Pending review'}.`;
        }
        if (/top\s*(five|5|three|3)?\s*risk/.test(q) || /biggest risk/.test(q)) {
            const insights = fallbackInsights(d);
            return 'Top risks: ' + safeArr(insights.risks && insights.risks.bullets).join(' | ');
        }
        if (/overdue/.test(q) && /capa|corrective|action/.test(q)) {
            const overdue = overdueCapas(d);
            if (!overdue.length) return 'No overdue corrective actions found.';
            return `${overdue.length} overdue corrective action(s): ` + overdue.map(i => `${clauseText(i)} (${normalizeDept(i.department)}, due ${i.caDueDate})`).join('; ');
        }
        if (/department/.test(q) && /(attention|worst|risk|concern)/.test(q)) {
            const depts = getDepartments(d);
            const worst = Object.entries(depts).filter(([, v]) => v.major > 0 || v.minor > 0).sort((a, b) => (b[1].major * 2 + b[1].minor) - (a[1].major * 2 + a[1].minor))[0];
            if (!worst) return 'No department currently requires elevated attention.';
            return `${worst[0]} needs the most attention: ${worst[1].major} major and ${worst[1].minor} minor non-conformity(ies).`;
        }
        if (/evidence/.test(q)) {
            const intel = computeEvidenceIntel(d);
            return `Evidence coverage is ${intel.coveragePct}% (${intel.withEvidence} of ${intel.totalApplicable} applicable items). ${intel.missingEvidence.length} finding(s) lack supporting evidence.`;
        }
        if (/major/.test(q) && /nc|non.?conform/.test(q)) {
            const majors = getRealNCs(d).filter(i => (i.ncrType || '').toLowerCase() === 'major');
            if (!majors.length) return 'No major non-conformities were raised in this audit.';
            return `${majors.length} major non-conformity(ies): ` + majors.map(i => `${clauseText(i)} (${normalizeDept(i.department)})`).join('; ');
        }
        return `I can answer questions about this audit's non-conformities, observations, departments, evidence coverage, and CAPA due dates. Try: "summarize this audit", "top five risks", "overdue CAPAs", or "which department needs attention".`;
    }

    async function askAuditAI(question, d) {
        if (!question || !String(question).trim()) return 'Please enter a question about this audit.';
        const fallback = fallbackAsk(question, d);
        if (!window.AI_SERVICE || typeof window.AI_SERVICE.callProxyAPI !== 'function') {
            return fallback;
        }
        try {
            const context = buildAskContext(d);
            const prompt = `
You are an audit intelligence assistant embedded in an ISO certification body's report preview tool. Answer the user's question about THIS audit concisely (2-5 sentences, plain text, no markdown symbols), using only the JSON context provided. If the answer requires data not present in the context, say so plainly rather than inventing facts. Never state or estimate financial figures, revenue, penalties, customer loss, cost, or reputational damage. Never describe a finding as "recurring," "repeated," or "systemic" unless the context explicitly shows it also failed in a prior audit. Reuse the "clause" values from the JSON context exactly as given; never prepend the word "Clause" to a value that already reads as an internal audit reference (e.g. "internal audit reference FOCUS.2 (criterion to be assigned)"). Never state a corrective-action requirement as an absolute condition of keeping certification.

Audit Context (JSON):
${JSON.stringify(context).substring(0, 6000)}

User Question: ${question}

Answer:`;
            const text = await window.AI_SERVICE.callProxyAPI(prompt);
            const cleaned = String(text || '').replace(/```/g, '').trim();
            return cleaned || fallback;
        } catch (err) {
            console.warn('[ReportExecutive] askAuditAI AI failed, using fallback:', err);
            return fallback;
        }
    }

    function renderAssistantPanel() {
        return `
<div id="report-ai-assistant" class="b4-insight-card" style="max-width:100%;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
    <span style="font-size:1.05rem;">&#129302;</span>
    <span style="font-weight:700;color:#0f2a43;text-transform:uppercase;letter-spacing:0.05em;font-size:0.78rem;">Ask About This Audit</span>
  </div>
  <div style="display:flex;gap:8px;">
    <input type="text" id="report-ai-ask-input" placeholder="e.g. top five risks, overdue CAPAs, which department needs attention"
      style="flex:1;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.85rem;font-family:inherit;">
    <button type="button" data-action="reportExecutiveAsk"
      style="padding:8px 16px;border:none;border-radius:6px;background:#0f2a43;color:white;font-weight:700;font-size:0.82rem;cursor:pointer;">Ask</button>
  </div>
  <div id="report-ai-ask-answer" style="margin-top:12px;font-size:0.85rem;line-height:1.6;color:#334155;min-height:20px;"></div>
</div>`;
    }

    async function handleAsk() {
        const input = document.getElementById('report-ai-ask-input');
        const answerEl = document.getElementById('report-ai-ask-answer');
        if (!input || !answerEl) return;
        const question = input.value;
        if (!question || !question.trim()) return;

        answerEl.innerHTML = '<span style="color:#94a3b8;">Thinking&hellip;</span>';
        const d = window._reportPreviewData;
        try {
            const answer = await askAuditAI(question, d);
            answerEl.textContent = answer;
        } catch (err) {
            answerEl.textContent = 'Sorry, I could not process that question right now.';
        }
    }

    // ------------------------------------------------------------------
    // 6. Big-Four style CSS component library
    // ------------------------------------------------------------------

    function bigFourCss() {
        return `
/* ============================================================
   Big-Four Style Component Library (ReportExecutive)
   Executive-consulting design system: Deloitte/PwC/EY/KPMG-grade,
   Fluent/Notion/Stripe/Linear influenced. Print-safe, no gradients,
   no heavy shadows. Extends — never breaks — existing b4-* classes.
   ============================================================ */

/* ---------- Design tokens ---------- */
:root, .b4-scope {
  --b4-font: 'Inter','Segoe UI',Helvetica,Arial,sans-serif;
  --b4-navy: #0f2a43;
  --b4-navy-2: #16324e;
  --b4-ink: #1e293b;
  --b4-muted: #64748b;
  --b4-line: #e7ecf1;
  --b4-line-2: #eef1f5;
  --b4-surface: #ffffff;
  --b4-surface-2: #f8fafc;

  --b4-good: #15803d;
  --b4-good-bg: #ecfdf5;
  --b4-good-line: #a7d9bb;
  --b4-warn: #b45309;
  --b4-warn-bg: #fffbeb;
  --b4-warn-line: #f3d99a;
  --b4-bad: #b91c1c;
  --b4-bad-bg: #fef2f2;
  --b4-bad-line: #f1b7b7;
  --b4-info: #1d4ed8;
  --b4-info-bg: #eff6ff;
  --b4-info-line: #bcd2f7;
  --b4-neutral: #475569;
  --b4-neutral-bg: #f1f5f9;
  --b4-neutral-line: #d7dee6;

  /* spacing scale */
  --b4-s1: 4px;
  --b4-s2: 8px;
  --b4-s3: 12px;
  --b4-s4: 16px;
  --b4-s5: 24px;
  --b4-s6: 36px;

  /* geometry */
  --b4-radius: 6px;
  --b4-radius-kpi: 10px;
  --b4-hairline: 1px solid var(--b4-line);

  /* typography scale (print-first, pt-based) — exactly 3 weights: 400 / 500 / 700 */
  --b4-fs-title: 24pt;      /* report title, 700 */
  --b4-fs-section: 13pt;    /* section heading, 700 uppercase tracked */
  --b4-fs-subhead: 11pt;    /* subheading, 700 */
  --b4-fs-body: 9.75pt;     /* body, 400, line-height 1.55 */
  --b4-fs-tbl-head: 8.75pt;  /* table header, 700 uppercase */
  --b4-fs-tbl-body: 9pt;    /* table content, 400 */
  --b4-fs-caption: 8pt;     /* caption, 400 muted */
  --b4-fs-footnote: 7pt;    /* footnote */

  --b4-fw-regular: 400;
  --b4-fw-medium: 500;
  --b4-fw-bold: 700;
}

/* ---------- Print safety ---------- */
.b4-kpi-card, .b4-insight-card, .b4-card, .b4-pill, .b4-badge, .b4-heat-cell,
.b4-callout, .b4-highlight, .b4-tbl, .b4-bar-fill, .b4-maturity-bar-fill {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ---------- Typography scale ---------- */
.b4-scope, .b4-scope * { font-family: var(--b4-font); }

.b4-page-title {
  font-family: var(--b4-font);
  font-size: var(--b4-fs-title);
  font-weight: var(--b4-fw-bold);
  line-height: 1.2;
  color: var(--b4-navy);
  margin: 0 0 var(--b4-s3);
}
.b4-section-title {
  font-family: var(--b4-font);
  font-size: var(--b4-fs-section);
  font-weight: var(--b4-fw-bold);
  line-height: 1.3;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--b4-navy);
  margin: 0 0 var(--b4-s3);
  break-after: avoid;
}
.b4-card-heading {
  font-family: var(--b4-font);
  font-size: var(--b4-fs-subhead);
  font-weight: var(--b4-fw-bold);
  line-height: 1.35;
  color: var(--b4-navy);
  display: flex;
  align-items: center;
  gap: var(--b4-s2);
  margin: 0 0 var(--b4-s2);
  break-after: avoid;
}
.b4-body {
  font-size: var(--b4-fs-body);
  font-weight: var(--b4-fw-regular);
  line-height: 1.55;
  color: var(--b4-ink);
  margin: 0 0 var(--b4-s2);
}
.b4-caption {
  font-size: var(--b4-fs-caption);
  font-weight: var(--b4-fw-regular);
  line-height: 1.5;
  color: var(--b4-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.b4-footnote {
  font-size: var(--b4-fs-footnote);
  font-weight: var(--b4-fw-regular);
  line-height: 1.5;
  color: var(--b4-muted);
}
.b4-eyebrow {
  font-size: var(--b4-fs-tbl-head);
  font-weight: var(--b4-fw-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--b4-muted);
  display: flex;
  align-items: center;
  gap: var(--b4-s2);
  margin: 0 0 var(--b4-s2);
}

/* ---------- Spacing utilities ---------- */
.b4-mt-1{margin-top:var(--b4-s1)} .b4-mt-2{margin-top:var(--b4-s2)} .b4-mt-3{margin-top:var(--b4-s3)}
.b4-mt-4{margin-top:var(--b4-s4)} .b4-mt-5{margin-top:var(--b4-s5)} .b4-mt-6{margin-top:var(--b4-s6)}
.b4-mb-1{margin-bottom:var(--b4-s1)} .b4-mb-2{margin-bottom:var(--b4-s2)} .b4-mb-3{margin-bottom:var(--b4-s3)}
.b4-mb-4{margin-bottom:var(--b4-s4)} .b4-mb-5{margin-bottom:var(--b4-s5)} .b4-mb-6{margin-bottom:var(--b4-s6)}
.b4-stack > * + * { margin-top: var(--b4-s4); }

.b4-rule {
  height: 1px;
  background: var(--b4-line);
  margin: var(--b4-s3) 0 var(--b4-s5);
  border: none;
}

/* ---------- Grids ---------- */
.b4-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--b4-s4); }
.b4-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--b4-s4); }
.b4-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--b4-s4); }

/* ---------- Icons ---------- */
.b4-icon { flex: 0 0 auto; vertical-align: -3px; color: currentColor; }
.b4-eyebrow .b4-icon, .b4-caption .b4-icon { color: var(--b4-muted); }
.b4-card-heading .b4-icon { color: var(--b4-navy); }
/* tolerate legacy <i class="fa-..."> usage from other modules */
.b4-card-heading i[class*="fa-"], .b4-eyebrow i[class*="fa-"] { color: inherit; margin-right: 4px; }

/* ---------- KPI cards ---------- */
.b4-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--b4-s4);
}
.b4-kpi-card {
  background: var(--b4-surface);
  border: var(--b4-hairline);
  border-radius: var(--b4-radius-kpi);
  padding: var(--b4-s4) var(--b4-s4);
  text-align: center;
  position: relative;
  break-inside: avoid;
}
.b4-kpi-card--accent { border-left: 3px solid var(--b4-navy); }
.b4-kpi-icon {
  color: var(--b4-navy);
  opacity: 0.55;
  margin-bottom: var(--b4-s2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.b4-kpi-value {
  font-family: var(--b4-font);
  font-size: 22pt;
  font-weight: var(--b4-fw-bold);
  color: var(--b4-navy);
  line-height: 1.1;
}
.b4-kpi-label {
  margin-top: var(--b4-s1);
  font-size: var(--b4-fs-caption);
  font-weight: var(--b4-fw-bold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--b4-muted);
}
.b4-kpi-sub {
  margin-top: var(--b4-s1);
  font-size: var(--b4-fs-caption);
  font-weight: var(--b4-fw-regular);
  color: var(--b4-muted);
}
.b4-kpi-trend {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--b4-fs-caption);
  font-weight: var(--b4-fw-bold);
  margin-top: var(--b4-s1);
}
.b4-kpi-trend.up   { color: var(--b4-good); }
.b4-kpi-trend.down { color: var(--b4-bad); }
.b4-kpi-trend.flat { color: var(--b4-muted); }
.b4-kpi-trend.up::before   { content: "\\25B2"; }
.b4-kpi-trend.down::before { content: "\\25BC"; }
.b4-kpi-trend.flat::before { content: "\\25A0"; font-size: 7pt; }

@media print {
  .b4-kpi-grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
}

/* ---------- Badges (canonical) — .b4-pill* are IDENTICAL-rendering aliases ---------- */
.b4-badge, .b4-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: var(--b4-fs-tbl-head);
  font-weight: var(--b4-fw-medium);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  background: var(--b4-neutral-bg);
  color: var(--b4-neutral);
  border: none;
}
.b4-badge--good, .b4-pill-good {
  background: var(--b4-good-bg); color: var(--b4-good); font-weight: var(--b4-fw-medium);
  border-left: 2px solid var(--b4-good);
}
.b4-badge--warn, .b4-pill-warn {
  background: var(--b4-warn-bg); color: var(--b4-warn); font-weight: var(--b4-fw-medium);
  border-left: 3px solid var(--b4-warn);
}
.b4-badge--bad, .b4-pill-bad {
  background: var(--b4-bad-bg); color: var(--b4-bad); font-weight: var(--b4-fw-bold);
  border-left: 4px solid var(--b4-bad);
}
.b4-badge--info, .b4-pill-info {
  background: var(--b4-info-bg); color: var(--b4-info); font-weight: var(--b4-fw-medium);
  border-left: 2px solid var(--b4-info);
}
.b4-badge--neutral, .b4-pill-neutral {
  background: var(--b4-neutral-bg); color: var(--b4-neutral); font-weight: var(--b4-fw-medium);
}
.b4-badge--critical, .b4-pill-critical {
  background: #7f1d1d; color: #ffffff; font-weight: var(--b4-fw-bold);
  border-left: 4px solid #5c1414;
}

/* ---------- Tables — .b4-tbl is the ONLY table style ---------- */
.b4-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--b4-fs-tbl-body);
  font-weight: var(--b4-fw-regular);
}
.b4-tbl thead th {
  text-align: left;
  padding: 10px 14px;
  font-size: var(--b4-fs-tbl-head);
  font-weight: var(--b4-fw-bold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--b4-muted);
  border-bottom: 1px solid #cbd5e1;
  background: transparent;
}
.b4-tbl tbody td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--b4-line-2);
  color: var(--b4-ink);
  vertical-align: top;
  font-weight: var(--b4-fw-regular);
}
.b4-tbl tbody tr:nth-child(odd) td { background: #fafbfc; }
.b4-tbl tbody tr:last-child td { border-bottom: none; }
.b4-tbl .b4-num { text-align: right; font-variant-numeric: tabular-nums; }
.b4-tbl .b4-badge, .b4-tbl .b4-pill { white-space: nowrap; }

/* ---------- Cards / callouts ---------- */
.b4-card {
  background: var(--b4-surface);
  border: var(--b4-hairline);
  border-radius: var(--b4-radius);
  padding: var(--b4-s4);
  break-inside: avoid;
}
.b4-insight-card {
  background: var(--b4-surface);
  border: var(--b4-hairline);
  border-left: 3px solid var(--b4-navy);
  border-radius: var(--b4-radius);
  padding: var(--b4-s4);
  break-inside: avoid;
}
.b4-callout {
  border-radius: var(--b4-radius);
  padding: var(--b4-s4);
  border: var(--b4-hairline);
  border-left: 2px solid var(--b4-neutral);
  background: var(--b4-surface-2);
  break-inside: avoid;
}
/* Monochrome-safe severity cue: left-border thickness scales with severity so it still
   reads under grayscale printing even if color reproduction is lost. */
.b4-callout--good { background: var(--b4-good-bg); border-color: var(--b4-good-line); border-left: 2px solid var(--b4-good); }
.b4-callout--info { background: var(--b4-info-bg); border-color: var(--b4-info-line); border-left: 2px solid var(--b4-info); }
.b4-callout--warn { background: var(--b4-warn-bg); border-color: var(--b4-warn-line); border-left: 3px solid var(--b4-warn); }
.b4-callout--bad  { background: var(--b4-bad-bg);  border-color: var(--b4-bad-line);  border-left: 4px solid var(--b4-bad); font-weight: var(--b4-fw-medium); }

.b4-highlight {
  border-radius: 8px;
  padding: var(--b4-s5);
  border: var(--b4-hairline);
  background: var(--b4-surface-2);
  break-inside: avoid;
}
.b4-highlight--neutral { background: var(--b4-surface-2); border-color: var(--b4-line); }
.b4-highlight--b4-good, .b4-highlight--good { background: var(--b4-good-bg); border-color: var(--b4-good-line); border-left: 2px solid var(--b4-good); }
.b4-highlight--b4-warn, .b4-highlight--warn { background: var(--b4-warn-bg); border-color: var(--b4-warn-line); border-left: 3px solid var(--b4-warn); }
.b4-highlight--b4-bad,  .b4-highlight--bad  { background: var(--b4-bad-bg);  border-color: var(--b4-bad-line);  border-left: 4px solid var(--b4-bad); }
.b4-highlight--b4-info, .b4-highlight--info { background: var(--b4-info-bg); border-color: var(--b4-info-line); border-left: 2px solid var(--b4-info); }
.b4-highlight-title {
  font-family: var(--b4-font);
  font-size: var(--b4-fs-section);
  font-weight: var(--b4-fw-bold);
  color: var(--b4-navy);
  margin: 2px 0 var(--b4-s3);
  break-after: avoid;
}

.b4-bullets {
  margin: 0;
  padding-left: 18px;
  font-size: var(--b4-fs-body);
  font-weight: var(--b4-fw-regular);
  color: var(--b4-ink);
  line-height: 1.55;
}
.b4-bullets li { min-width: 0; white-space: normal; word-break: normal; overflow-wrap: break-word; }
.b4-bullets li + li { margin-top: 4px; }
.b4-bullets--wide { column-gap: var(--b4-s5); }
.b4-muted-item { color: #94a3b8; list-style: none; margin-left: -18px; }

/* screen-only affordance — never printed */
@media screen and not print {
  .b4-card, .b4-kpi-card, .b4-insight-card, .b4-callout, .b4-highlight, .b4-chart-box {
    box-shadow: 0 1px 2px rgba(15, 42, 67, 0.05);
  }
}

/* ---------- "At a glance" strip (top-of-section executive readout) ---------- */
.b4-glance-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--b4-s4);
  border: 1px solid var(--b4-line);
  border-radius: 8px;
  background: var(--b4-surface);
  padding: var(--b4-s4) var(--b4-s5);
}
.b4-glance-item { min-width: 0; }
.b4-glance-value {
  font-family: var(--b4-font);
  font-size: 15pt;
  font-weight: var(--b4-fw-bold);
  color: var(--b4-navy);
  line-height: 1.25;
  white-space: normal;
  overflow-wrap: break-word;
}
.b4-glance-value--sm { font-size: var(--b4-fs-subhead); font-weight: var(--b4-fw-bold); }
.b4-glance-value--b4-good, .b4-glance-value--good { color: var(--b4-good); }
.b4-glance-value--b4-warn, .b4-glance-value--warn { color: var(--b4-warn); }
.b4-glance-value--b4-bad,  .b4-glance-value--bad  { color: var(--b4-bad); }
.b4-glance-unit { font-size: var(--b4-fs-footnote); font-weight: var(--b4-fw-bold); color: var(--b4-muted); margin-left: 2px; letter-spacing: 0.04em; }

@media print {
  .b4-glance-strip { grid-template-columns: repeat(4, 1fr); break-inside: avoid; }
}

/* Print tables: nine columns on a 180mm page left the prose columns squeezed to
   their minimum, wrapping "Define or update the process..." one word per line
   and running rows down the page. Uppercase headers with 0.07em letter-spacing
   and 14px side padding were claiming that width for columns holding a pip or a
   date. Tightening both hands the slack back to the text columns — on a
   nine-column table it returns roughly 25mm of usable width — and stops long
   headings such as LIKELIHOOD / IMPACT colliding with their neighbours. */
@media print {
  .b4-tbl thead th {
    padding: 6px 7px;
    letter-spacing: 0.02em;
    line-height: 1.2;
    overflow-wrap: break-word;
  }
  .b4-tbl tbody td {
    padding: 6px 7px;
    overflow-wrap: break-word;
  }
  /* Columns holding only a pip, badge, score or date should take what they need
     and no more, so the remaining width goes to the prose. */
  .b4-tbl td:has(> .b4-pill), .b4-tbl td:has(> .b4-badge) { white-space: nowrap; width: 1%; }
}

/* ---------- Audit Outcome Summary (top of exec-summary body) ---------- */
.b4-board-brief {
  border: 1px solid var(--b4-line);
  border-left: 3px solid var(--b4-navy);
  border-radius: 8px;
  background: var(--b4-surface-2);
  padding: var(--b4-s4) var(--b4-s5);
  break-inside: avoid;
  page-break-inside: avoid;
}
.b4-board-brief-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--b4-s3);
  margin-bottom: var(--b4-s3);
  flex-wrap: wrap;
}
.b4-board-brief-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: var(--b4-s4);
  align-items: start;
  padding: var(--b4-s2) 0;
}
.b4-board-brief-row + .b4-board-brief-row { border-top: 1px solid var(--b4-line-2); }
.b4-board-brief-label {
  font-size: var(--b4-fs-caption);
  font-weight: var(--b4-fw-bold);
  color: var(--b4-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.b4-board-brief-value {
  font-size: var(--b4-fs-body);
  font-weight: var(--b4-fw-medium);
  color: var(--b4-ink);
  line-height: 1.5;
}
.b4-board-brief-list {
  margin: 0;
  padding-left: 16px;
  font-size: var(--b4-fs-body);
  color: var(--b4-ink);
  line-height: 1.5;
}
.b4-board-brief-list li + li { margin-top: 3px; }
@media print {
  .b4-board-brief { break-inside: avoid; page-break-inside: avoid; }
}

/* ---------- Insight card badges (confidence / priority) ---------- */
.b4-badge-row { display: flex; gap: var(--b4-s2); margin: 2px 0 var(--b4-s3); flex-wrap: wrap; }
.b4-insight-rec {
  margin-top: var(--b4-s3);
  padding-top: var(--b4-s3);
  border-top: 1px solid var(--b4-line-2);
}
.b4-grid-2--roomy { gap: var(--b4-s5); }

.b4-evidence-card { padding: var(--b4-s3) var(--b4-s4); }
.b4-evidence-card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--b4-s2); }

/* ---------- Data viz support ---------- */
.b4-bar-row { display: flex; align-items: center; gap: var(--b4-s3); padding: 6px 0; }
.b4-bar-row + .b4-bar-row { border-top: 1px solid var(--b4-line-2); }
.b4-bar-row--stacked { flex-direction: column; align-items: stretch; gap: 4px; }
.b4-heat-cell--lg { min-width: 64px; min-height: 64px; font-size: 12pt; }
.b4-card--flagged { border-left: 3px solid var(--b4-bad); }
.b4-kpi-value-unit { font-size: 0.5em; font-weight: var(--b4-fw-medium); color: var(--b4-muted); margin-left: 2px; }
.b4-bar-label { min-width: 140px; font-size: var(--b4-fs-tbl-body); color: var(--b4-ink); font-weight: var(--b4-fw-medium); }
.b4-bar-pct { min-width: 40px; text-align: right; font-size: var(--b4-fs-tbl-body); color: var(--b4-muted); font-variant-numeric: tabular-nums; }
.b4-bar {
  flex: 1;
  height: 8px;
  background: var(--b4-line);
  border-radius: 4px;
  overflow: hidden;
}
.b4-bar-fill { height: 100%; background: var(--b4-navy); border-radius: 4px; }
.b4-bar-fill--good { background: var(--b4-good); }
.b4-bar-fill--warn { background: var(--b4-warn); }
.b4-bar-fill--bad  { background: var(--b4-bad); }
.b4-bar-fill--info { background: var(--b4-info); }

.b4-maturity-bar {
  flex: 1;
  height: 8px;
  background: var(--b4-line);
  border-radius: 4px;
  overflow: hidden;
}
.b4-maturity-bar-fill {
  height: 100%;
  background: var(--b4-navy);
  border-radius: 4px;
}

.b4-heat-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 28px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 9pt;
  font-weight: 700;
  color: #ffffff;
  background: var(--b4-neutral);
}
/* Tinted cells (background tint + tone border + dark count) read sharper in print
   than solid saturated blocks, and survive monochrome via border weight. */
.b4-heat-cell.b4-heat-0 { background: var(--b4-surface); border: 1px solid var(--b4-line); color: var(--b4-line-2); }
.b4-heat-cell.b4-heat-low { background: var(--b4-good-bg); border: 1px solid var(--b4-good-line); color: var(--b4-good); }
.b4-heat-cell.b4-heat-med { background: var(--b4-warn-bg); border: 1px solid var(--b4-warn-line); color: var(--b4-warn); }
.b4-heat-cell.b4-heat-high { background: var(--b4-bad-bg); border: 2px solid var(--b4-bad-line); color: var(--b4-bad); }
.b4-heat-cell.b4-heat-crit { background: #7f1d1d; border: 2px solid #7f1d1d; color: #ffffff; }
.b4-tbl--compact th { padding: 7px 8px; font-size: 8.75pt; }
.b4-tbl--compact td { padding: 8px 8px; font-size: 9pt; }
.b4-tbl--compact .b4-badge, .b4-tbl--compact .b4-pill { font-size: 9pt; padding: 2px 6px; }

.b4-chart-box {
  border: 1px solid var(--b4-line);
  border-radius: 6px;
  background: var(--b4-surface);
  padding: var(--b4-s4);
}
.b4-chart-box-caption {
  margin-top: var(--b4-s2);
  font-size: 9pt;
  color: var(--b4-muted);
  text-align: center;
}

.b4-timeline { position: relative; margin: var(--b4-s4) 0; padding-left: 22px; }
.b4-timeline::before {
  content: "";
  position: absolute;
  left: 5px; top: 4px; bottom: 4px;
  width: 1px;
  background: var(--b4-line);
}
.b4-timeline-item { position: relative; padding-bottom: var(--b4-s5); }
.b4-timeline-item:last-child { padding-bottom: 0; }
.b4-timeline-item::before {
  content: "";
  position: absolute;
  left: -22px; top: 3px;
  width: 9px; height: 9px;
  border-radius: 50%;
  background: var(--b4-navy);
  border: 2px solid var(--b4-surface);
  box-shadow: 0 0 0 1px var(--b4-line);
}
.b4-timeline-item.good::before { background: var(--b4-good); }
.b4-timeline-item.warn::before { background: var(--b4-warn); }
.b4-timeline-item.bad::before  { background: var(--b4-bad); }
.b4-timeline-item-date { font-size: var(--b4-fs-caption); font-weight: var(--b4-fw-bold); text-transform: uppercase; letter-spacing: 0.05em; color: var(--b4-muted); }
.b4-timeline-item-title { font-size: var(--b4-fs-subhead); font-weight: var(--b4-fw-bold); color: var(--b4-navy); margin: 2px 0; break-after: avoid; }
.b4-timeline-item-body { font-size: var(--b4-fs-tbl-body); font-weight: var(--b4-fw-regular); color: var(--b4-ink); line-height: 1.55; }

/* ---------- Print quality: no orphaned headings, no shadows, atomic blocks ---------- */
h1, h2, h3, h4, .b4-page-title, .b4-section-title, .b4-card-heading, .b4-highlight-title, .b4-timeline-item-title {
  break-after: avoid;
}
.b4-kpi-grid, .b4-grid-2, .b4-grid-3, .b4-grid-4, .b4-glance-strip {
  break-inside: avoid;
}
@media print {
  .b4-card, .b4-kpi-card, .b4-insight-card, .b4-callout, .b4-highlight, .b4-chart-box, .b4-evidence-card {
    box-shadow: none !important;
    break-inside: avoid;
  }
}
`;
    }

    // ------------------------------------------------------------------
    // Export
    // ------------------------------------------------------------------

    window.ReportExecutive = {
        generateExecutiveSummary,
        computeEvidenceIntel,
        generateExecutiveInsights,
        prepare,
        sections,
        sectionsPreviewToggles,
        askAuditAI,
        renderAssistantPanel,
        handleAsk,
        bigFourCss,
        icon
    };

    // CSP-safe wiring: inline handlers are blocked (no 'unsafe-inline' in script-src),
    // so the Ask button routes through the app's data-action delegator, and Enter-to-ask
    // is a document-level listener scoped to the assistant input.
    window.reportExecutiveAsk = handleAsk;
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target && e.target.id === 'report-ai-ask-input') handleAsk();
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = window.ReportExecutive;
    }
})();
