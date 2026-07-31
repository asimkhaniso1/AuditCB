// ============================================
// REPORT EXECUTIVE MODULE  (window.ReportExecutive)
// ============================================
// Standalone add-on for AuditCB-360's audit report builder.
// Does NOT modify any existing file — pure additive module.
//
// CONTRACT / USAGE (for the integrating session):
//   window.ReportExecutive.prepare(d)                 -> async, runs AI calls once & caches results keyed by d.report.id
//   window.ReportExecutive.sections(d)                 -> sync, returns [{key,name,desc,color,bodyHtml,charts}] for:
//                                                            'exec-summary'   EXECUTIVE SUMMARY (BOARD EDITION)
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

    const getDepartments = (d) => {
        const depts = {};
        safeArr(d && d.hydratedProgress).forEach(item => {
            const dept = (item.department && String(item.department).trim()) || 'General';
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
    const clauseTitle = (item) => (item.kbMatch && item.kbMatch.title) ? item.kbMatch.title : '';

    // ------------------------------------------------------------------
    // 1. EXECUTIVE SUMMARY (BOARD EDITION)
    // ------------------------------------------------------------------

    function buildExecSummaryPrompt(d) {
        const report = (d && d.report) || {};
        const stats = getStats(d);
        const client = (d && d.client) || {};
        const realNCs = getRealNCs(d);
        const depts = getDepartments(d);
        const deptList = Object.keys(depts).join(', ') || 'N/A';

        const ncLines = realNCs.slice(0, 25).map((i, idx) =>
            `${idx + 1}. [${(i.ncrType || 'NC').toUpperCase()}] Clause ${clauseLabel(i)}${clauseTitle(i) ? ' — ' + clauseTitle(i) : ''} (Dept: ${i.department || 'General'})`
        ).join('\n');

        return `
You are a Certification Body Lead Auditor preparing a CEO/Board-level Executive Summary for an ISO management system certification audit report. Write for senior executives who will not read the full report — they need the strategic picture in under 400 words.

Audit Context:
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
- Certification Recommendation: ${stats.recommendation || 'Pending'}
- Departments Assessed: ${deptList}

Non-Conformity Detail:
${ncLines || 'None recorded.'}

Write a JSON object with these fields (plain text, NO markdown symbols like ** or ##, use complete sentences):
{
  "outcome": "1-2 sentence overall audit outcome statement",
  "health": "1-2 sentence overall organizational health / management system maturity statement",
  "strengths": ["3-5 short bullet strings, key strengths"],
  "weaknesses": ["3-5 short bullet strings, key weaknesses"],
  "concerns": ["2-4 short bullet strings, strategic concerns for leadership"],
  "priorities": ["3-5 short bullet strings, recommended management priorities, action-oriented"],
  "recommendation": "1-2 sentence certification recommendation statement",
  "risks": "1-2 sentence forward-looking risk statement (what could jeopardize certification/performance if unaddressed)"
}
Return ONLY the raw JSON object, no markdown fences.`;
    }

    function fallbackExecSummaryData(d) {
        const report = (d && d.report) || {};
        const stats = getStats(d);
        const realNCs = getRealNCs(d);
        const depts = getDepartments(d);
        const deptEntries = Object.entries(depts);

        const strengths = [];
        const conformPct = stats.applicableCount ? Math.round((stats.conformCount / stats.applicableCount) * 100) : 0;
        if (conformPct >= 70) strengths.push(`Strong overall conformity across assessed clauses (${conformPct}% of applicable items conforming).`);
        deptEntries.filter(([, v]) => v.total > 0 && v.nc === 0).slice(0, 3).forEach(([name]) => strengths.push(`${name} demonstrated full conformity during this audit.`));
        if (!strengths.length) strengths.push('No specific department-level strengths could be isolated from available data.');

        const weaknesses = [];
        deptEntries.filter(([, v]) => v.major > 0 || v.minor > 0).sort((a, b) => (b[1].major * 2 + b[1].minor) - (a[1].major * 2 + a[1].minor)).slice(0, 4).forEach(([name, v]) =>
            weaknesses.push(`${name}: ${v.major} major and ${v.minor} minor non-conformity(ies) identified.`));
        if (!weaknesses.length) weaknesses.push('No significant departmental weaknesses identified in this audit cycle.');

        const concerns = [];
        if (stats.majorNC > 0) concerns.push(`${stats.majorNC} major non-conformity(ies) present a certification risk requiring immediate corrective action.`);
        if (stats.minorNC > 2) concerns.push(`A cluster of ${stats.minorNC} minor non-conformities suggests systemic process gaps rather than isolated incidents.`);
        if (!concerns.length) concerns.push('No material strategic concerns identified at this time.');

        const priorities = realNCs.slice(0, 5).map(i => `Address ${((i.ncrType || 'nc')).toUpperCase()} finding at clause ${clauseLabel(i)}${i.department ? ' (' + i.department + ')' : ''}.`);
        if (!priorities.length) priorities.push('Maintain current management system practices and monitor for continual improvement opportunities.');

        return {
            outcome: `The audit of ${report.client || 'the organization'} against ${report.standard || 'the applicable standard'} identified ${stats.actualNCCount || 0} non-conformity(ies) (${stats.majorNC || 0} major, ${stats.minorNC || 0} minor) and ${stats.obsOfiCount || 0} observation(s)/opportunity(ies) for improvement across ${stats.applicableCount || 0} applicable requirements.`,
            health: `Based on the ${conformPct}% conformity rate observed, the management system demonstrates ${conformPct >= 80 ? 'a mature and well-embedded' : conformPct >= 60 ? 'a developing' : 'an early-stage'} level of operational discipline.`,
            strengths,
            weaknesses,
            concerns,
            recommendation: stats.recommendation || (stats.majorNC > 0 ? 'Conditional Recommendation, pending closure of major non-conformities.' : 'Recommended for Certification.'),
            priorities,
            risks: stats.majorNC > 0
                ? 'Failure to close major non-conformities within the required timeframe may delay or jeopardize certification issuance.'
                : 'Continued monitoring of minor findings and observations is advised to prevent escalation into systemic issues.'
        };
    }

    function renderExecSummaryHtml(data) {
        const list = (arr) => safeArr(arr).map(x => `<li>${esc(x)}</li>`).join('') || '<li style="color:#94a3b8;">None identified.</li>';
        return `
<div class="b4-rule"></div>
<p style="font-size:0.95rem;line-height:1.7;color:#1e293b;"><strong>Overall Outcome:</strong> ${esc(data.outcome)}</p>
<p style="font-size:0.95rem;line-height:1.7;color:#1e293b;"><strong>Organizational Health:</strong> ${esc(data.health)}</p>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:18px 0;">
  <div class="b4-insight-card">
    <div style="font-weight:700;color:#0f2a43;text-transform:uppercase;letter-spacing:0.06em;font-size:0.78rem;margin-bottom:8px;">Key Strengths</div>
    <ul style="margin:0;padding-left:18px;font-size:0.85rem;color:#334155;line-height:1.6;">${list(data.strengths)}</ul>
  </div>
  <div class="b4-insight-card">
    <div style="font-weight:700;color:#0f2a43;text-transform:uppercase;letter-spacing:0.06em;font-size:0.78rem;margin-bottom:8px;">Key Weaknesses</div>
    <ul style="margin:0;padding-left:18px;font-size:0.85rem;color:#334155;line-height:1.6;">${list(data.weaknesses)}</ul>
  </div>
  <div class="b4-insight-card">
    <div style="font-weight:700;color:#0f2a43;text-transform:uppercase;letter-spacing:0.06em;font-size:0.78rem;margin-bottom:8px;">Strategic Concerns</div>
    <ul style="margin:0;padding-left:18px;font-size:0.85rem;color:#334155;line-height:1.6;">${list(data.concerns)}</ul>
  </div>
</div>
<p style="font-size:0.95rem;line-height:1.7;color:#1e293b;"><strong>Management Priorities:</strong></p>
<ul style="margin:4px 0 14px 0;padding-left:20px;font-size:0.9rem;color:#334155;line-height:1.7;">${list(data.priorities)}</ul>
<p style="font-size:0.95rem;line-height:1.7;color:#1e293b;"><strong>Certification Recommendation:</strong> ${esc(data.recommendation)}</p>
<p style="font-size:0.95rem;line-height:1.7;color:#1e293b;"><strong>Forward-Looking Risks:</strong> ${esc(data.risks)}</p>`;
    }

    async function generateExecutiveSummary(d) {
        const fallback = fallbackExecSummaryData(d);
        if (!window.AI_SERVICE || typeof window.AI_SERVICE.callProxyAPI !== 'function') {
            return { html: renderExecSummaryHtml(fallback) };
        }
        try {
            const prompt = buildExecSummaryPrompt(d);
            const text = await window.AI_SERVICE.callProxyAPI(prompt);
            const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
            const merged = Object.assign({}, fallback, parsed);
            return { html: renderExecSummaryHtml(merged) };
        } catch (err) {
            console.warn('[ReportExecutive] generateExecutiveSummary AI failed, using fallback:', err);
            return { html: renderExecSummaryHtml(fallback) };
        }
    }

    // ------------------------------------------------------------------
    // 2. EVIDENCE INTELLIGENCE  (deterministic)
    // ------------------------------------------------------------------

    function computeEvidenceIntel(d) {
        const items = safeArr(d && d.hydratedProgress).filter(i => i.status !== 'na');
        const total = items.length;
        let withEvidence = 0;
        const missingEvidence = [];
        const byDepartment = {};

        items.forEach(item => {
            const imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
            const dept = (item.department && String(item.department).trim()) || 'General';
            if (!byDepartment[dept]) byDepartment[dept] = { total: 0, withEvidence: 0 };
            byDepartment[dept].total++;

            const hasEvidence = !!(imgs && imgs.length);
            if (hasEvidence) {
                withEvidence++;
                byDepartment[dept].withEvidence++;
            } else {
                // "findings with no evidence" — prioritize NC items, but also flag conform items lacking evidence
                const hasFinding = item.status === 'nc' || !!(item.comment && item.comment.trim());
                if (hasFinding) {
                    missingEvidence.push({
                        clause: clauseLabel(item),
                        item: clauseTitle(item) || (item.requirement || item.description || '').substring(0, 100) || 'Untitled item',
                        department: dept,
                        status: item.status,
                        ncrType: item.ncrType || ''
                    });
                }
            }
        });

        const coveragePct = total > 0 ? Math.round((withEvidence / total) * 100) : 0;

        let qualityNote;
        if (total === 0) {
            qualityNote = 'No applicable checklist items were recorded for this audit; evidence coverage cannot be assessed.';
        } else if (coveragePct >= 80) {
            qualityNote = `Evidence collection was strong across this audit, with ${coveragePct}% of applicable items supported by documented evidence — indicating rigorous objective-evidence-based assessment practice.`;
        } else if (coveragePct >= 50) {
            qualityNote = `Evidence collection was moderate at ${coveragePct}% coverage. ${missingEvidence.length} item(s) with findings lack supporting evidence images and should be reviewed before final issuance.`;
        } else {
            qualityNote = `Evidence coverage is low at ${coveragePct}%. A significant number of findings (${missingEvidence.length}) are not backed by evidence images, which may weaken the defensibility of this report under accreditation review.`;
        }

        return { coveragePct, missingEvidence, byDepartment, qualityNote, totalApplicable: total, withEvidence };
    }

    function renderEvidenceIntelHtml(intel) {
        const rows = intel.missingEvidence.slice(0, 40).map((m, idx) => `
<tr style="background:${idx % 2 ? '#f8fafc' : 'white'};">
  <td style="padding:8px 12px;font-weight:700;">${esc(m.clause)}</td>
  <td style="padding:8px 12px;">${esc(m.item)}</td>
  <td style="padding:8px 12px;">${esc(m.department)}</td>
</tr>`).join('');

        const deptRows = Object.entries(intel.byDepartment).map(([name, v]) => {
            const pct = v.total ? Math.round((v.withEvidence / v.total) * 100) : 0;
            return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
  <div style="min-width:130px;font-size:0.82rem;color:#334155;font-weight:600;">${esc(name)}</div>
  <div class="b4-maturity-bar"><div class="b4-maturity-bar-fill" style="width:${pct}%;"></div></div>
  <div style="min-width:40px;text-align:right;font-size:0.8rem;color:#64748b;">${pct}%</div>
</div>`;
        }).join('') || '<div style="color:#94a3b8;font-size:0.85rem;">No department data available.</div>';

        return `
<div class="b4-rule"></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
  <div class="b4-kpi-card">
    <div class="b4-kpi-value">${intel.coveragePct}%</div>
    <div class="b4-kpi-label">Evidence Coverage</div>
  </div>
  <div class="b4-kpi-card">
    <div class="b4-kpi-value">${intel.withEvidence}</div>
    <div class="b4-kpi-label">Items with Evidence</div>
  </div>
  <div class="b4-kpi-card">
    <div class="b4-kpi-value" style="color:${intel.missingEvidence.length > 0 ? '#dc2626' : '#0f2a43'};">${intel.missingEvidence.length}</div>
    <div class="b4-kpi-label">Missing Evidence</div>
  </div>
</div>
<div style="font-weight:700;color:#0f2a43;text-transform:uppercase;letter-spacing:0.06em;font-size:0.78rem;margin:16px 0 10px;">Evidence Coverage by Department</div>
${deptRows}
<div style="font-weight:700;color:#0f2a43;text-transform:uppercase;letter-spacing:0.06em;font-size:0.78rem;margin:20px 0 10px;">Findings Without Supporting Evidence</div>
${intel.missingEvidence.length ? `
<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
  <thead><tr style="background:#0f2a43;color:white;text-transform:uppercase;letter-spacing:0.04em;font-size:0.72rem;">
    <th style="padding:8px 12px;text-align:left;">Clause</th><th style="padding:8px 12px;text-align:left;">Item</th><th style="padding:8px 12px;text-align:left;">Department</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>` : '<p style="color:#64748b;font-size:0.85rem;">All findings are supported by documented evidence.</p>'}
<p style="margin-top:16px;font-size:0.88rem;line-height:1.6;color:#334155;">${esc(intel.qualityNote)}</p>`;
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

    function fallbackInsights(d) {
        const stats = getStats(d);
        const realNCs = getRealNCs(d);
        const depts = getDepartments(d);
        const deptEntries = Object.entries(depts);
        const intel = computeEvidenceIntel(d);

        const risks = [];
        if (stats.majorNC > 0) risks.push(`${stats.majorNC} major non-conformity(ies) could delay certification issuance.`);
        if (intel.coveragePct < 50) risks.push('Low evidence coverage weakens the defensibility of findings under accreditation scrutiny.');
        if (stats.minorNC > 3) risks.push(`${stats.minorNC} minor non-conformities suggest possible systemic control gaps.`);
        if (!risks.length) risks.push('No significant business risks identified from this audit cycle.');

        const departments = deptEntries
            .filter(([, v]) => v.major > 0 || v.minor > 0)
            .sort((a, b) => (b[1].major * 2 + b[1].minor) - (a[1].major * 2 + a[1].minor))
            .slice(0, 4)
            .map(([name, v]) => `${name}: ${v.major} major, ${v.minor} minor finding(s).`);
        if (!departments.length) departments.push('No department currently requires elevated attention.');

        const clauseCounts = {};
        realNCs.forEach(i => { const c = clauseLabel(i).split('.').slice(0, 2).join('.'); clauseCounts[c] = (clauseCounts[c] || 0) + 1; });
        const recurring = Object.entries(clauseCounts).filter(([, c]) => c > 1).map(([c, count]) => `Clause ${c}: ${count} related findings — indicates a recurring weakness area.`);
        if (!recurring.length) recurring.push('No recurring weakness patterns detected across clauses.');

        const improvements = [];
        deptEntries.filter(([, v]) => v.total > 0 && v.nc === 0).slice(0, 4).forEach(([name]) => improvements.push(`${name} showed full conformity — a positive indicator of process maturity.`));
        if (stats.conformCount > 0) improvements.push(`${stats.conformCount} item(s) confirmed conforming, demonstrating baseline system effectiveness.`);
        if (!improvements.length) improvements.push('No specific positive improvements identified in this cycle.');

        const readiness = [];
        readiness.push(stats.recommendation || (stats.majorNC > 0 ? 'Conditional — major non-conformities must be closed first.' : 'Ready for certification recommendation.'));
        readiness.push(`Current standing: ${stats.majorNC || 0} major, ${stats.minorNC || 0} minor open item(s).`);

        const strategic = realNCs.slice(0, 4).map(i => `Prioritize closure of ${(i.ncrType || 'nc').toUpperCase()} at clause ${clauseLabel(i)}.`);
        if (intel.coveragePct < 70) strategic.push('Improve evidence-capture discipline across audit teams.');
        if (!strategic.length) strategic.push('Sustain current practices; focus on continual improvement initiatives.');

        return { risks, departments, recurring, improvements, readiness, strategic };
    }

    function buildInsightsPrompt(d) {
        const stats = getStats(d);
        const report = (d && d.report) || {};
        const realNCs = getRealNCs(d);
        const depts = getDepartments(d);
        const deptSummary = Object.entries(depts).map(([n, v]) => `${n}: total ${v.total}, conform ${v.conform}, major ${v.major}, minor ${v.minor}`).join('; ');
        const ncLines = realNCs.slice(0, 20).map((i, idx) => `${idx + 1}. [${(i.ncrType || 'NC').toUpperCase()}] ${clauseLabel(i)} (${i.department || 'General'})`).join('\n');

        return `
You are a Senior Lead Auditor generating executive insight cards for a CEO-level ISO audit report dashboard.

Context:
- Client: ${report.client || ''}
- Standard: ${report.standard || ''}
- Major NC: ${stats.majorNC || 0}, Minor NC: ${stats.minorNC || 0}, Observations: ${stats.observationCount || 0}, OFI: ${stats.ofiCount || 0}
- Department Summary: ${deptSummary || 'N/A'}
- Non-conformities:
${ncLines || 'None'}

Return ONLY a raw JSON object (no markdown fences) with these keys, each an array of 2-3 short bullet strings (plain text, no markdown):
{
  "risks": [...],        // Biggest Business Risks
  "departments": [...],  // Departments Needing Attention
  "recurring": [...],    // Recurring Weaknesses
  "improvements": [...], // Positive Improvements
  "readiness": [...],    // Certification Readiness
  "strategic": [...]     // Suggested Strategic Priorities
}`;
    }

    function renderInsightsHtml(data) {
        const cards = INSIGHT_CARD_DEFS.map(def => {
            const bullets = safeArr(data[def.key]).slice(0, 3).map(b => `<li>${esc(b)}</li>`).join('') || '<li style="color:#94a3b8;">No data available.</li>';
            return `
<div class="b4-insight-card">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
    <span style="font-size:1.1rem;">${def.icon}</span>
    <span style="font-weight:700;color:#0f2a43;text-transform:uppercase;letter-spacing:0.05em;font-size:0.76rem;">${esc(def.title)}</span>
  </div>
  <ul style="margin:0;padding-left:18px;font-size:0.85rem;color:#334155;line-height:1.6;">${bullets}</ul>
</div>`;
        }).join('');
        return `<div class="b4-rule"></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">${cards}</div>`;
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
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
            const merged = Object.assign({}, fallback, parsed);
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

        const summaryHtml = (cached && cached.summary && cached.summary.html) || renderExecSummaryHtml(fallbackExecSummaryData(d));
        const insightsHtml = (cached && cached.insights && cached.insights.html) || renderInsightsHtml(fallbackInsights(d));

        return [
            {
                key: 'exec-summary',
                name: 'EXECUTIVE SUMMARY (BOARD EDITION)',
                desc: 'CEO-level summary of audit outcome, organizational health, and strategic priorities.',
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
        const realNCs = getRealNCs(d).map(i => ({ clause: clauseLabel(i), type: i.ncrType, department: i.department || 'General', dueDate: i.caDueDate || null, comment: (i.comment || '').substring(0, 200) }));
        const obsOfi = getObsOfi(d).map(i => ({ clause: clauseLabel(i), type: i.ncrType, department: i.department || 'General' }));
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
            return 'Top risks: ' + safeArr(insights.risks).join(' | ');
        }
        if (/overdue/.test(q) && /capa|corrective|action/.test(q)) {
            const overdue = overdueCapas(d);
            if (!overdue.length) return 'No overdue corrective actions found.';
            return `${overdue.length} overdue corrective action(s): ` + overdue.map(i => `Clause ${clauseLabel(i)} (${i.department || 'General'}, due ${i.caDueDate})`).join('; ');
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
            return `${majors.length} major non-conformity(ies): ` + majors.map(i => `Clause ${clauseLabel(i)} (${i.department || 'General'})`).join('; ');
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
You are an audit intelligence assistant embedded in an ISO certification body's report preview tool. Answer the user's question about THIS audit concisely (2-5 sentences, plain text, no markdown symbols), using only the JSON context provided. If the answer requires data not present in the context, say so plainly rather than inventing facts.

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
      style="padding:8px 16px;border:none;border-radius:6px;background:#0f2a43;color:white;font-weight:600;font-size:0.82rem;cursor:pointer;">Ask</button>
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
/* ============ Big-Four Style Component Library (ReportExecutive) ============ */
.b4-kpi-card, .b4-insight-card, .b4-pill, .b4-heat-cell {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.b4-kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 20px 18px;
  text-align: center;
}
.b4-kpi-value {
  font-family: 'Outfit', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: #0f2a43;
  line-height: 1.1;
}
.b4-kpi-label {
  margin-top: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
}
.b4-pill {
  display: inline-block;
  padding: 3px 12px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #cbd5e1;
}
.b4-pill-good    { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
.b4-pill-warn    { background: #fffbeb; color: #92400e; border-color: #fde68a; }
.b4-pill-bad     { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
.b4-pill-critical{ background: #7f1d1d; color: #ffffff; border-color: #7f1d1d; }
.b4-insight-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #0f2a43;
  border-radius: 4px;
  padding: 16px 18px;
}
.b4-maturity-bar {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}
.b4-maturity-bar-fill {
  height: 100%;
  background: #0f2a43;
  border-radius: 4px;
}
.b4-heat-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 28px;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #ffffff;
  background: #94a3b8;
}
.b4-heat-cell.b4-heat-0 { background: #e2e8f0; color: #334155; }
.b4-heat-cell.b4-heat-low { background: #10b981; }
.b4-heat-cell.b4-heat-med { background: #f59e0b; }
.b4-heat-cell.b4-heat-high { background: #ef4444; }
.b4-heat-cell.b4-heat-crit { background: #7f1d1d; }
.b4-rule {
  height: 1px;
  background: #e2e8f0;
  margin: 14px 0 18px;
  border: none;
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
        bigFourCss
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
