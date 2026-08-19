// ============================================
// EXECUTION MODULE - Reporting, AI & PDF Export
// ============================================
// Extracted from execution-module-v2.js for maintainability.
// Contains: generateAuditReport, showReportPreviewModal, charts,
//   AI analysis/polish, PDF export.

(function () {
    'use strict';

    // Render-time editorial polish for auditor free-text remarks. Does not mutate stored data.
    // Safe transforms only: whitespace, punctuation, capitalization, common typos, brand casing.
    const fmtRemark = (t) => {
        if (t == null) return '';
        let s = String(t);
        if (!s.trim()) return '';
        s = s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
        // An HTML entity in stored auditor text came from an HTML round-trip,
        // never from the auditor's keyboard. Left encoded it gets escaped again
        // downstream and prints literally ("Share Point in Place &amp; Quickbooks").
        // Decode here; the renderer escapes once afterwards, so output stays safe.
        s = s.replace(/&amp;(#\w+|[a-zA-Z]+);/g, '&$1;')
            .replace(/&(amp|#38);/gi, '&')
            .replace(/&(lt|#60);/gi, '<')
            .replace(/&(gt|#62);/gi, '>')
            .replace(/&(quot|#34);/gi, '"')
            .replace(/&(#39|apos|rsquo|#8217);/gi, "'")
            .replace(/&nbsp;/gi, ' ');
        s = s.replace(/\bscreen[\s-]?short(s?)\b/gi, (_m, p) => 'screenshot' + (p || ''));
        s = s.replace(/\bscreen[\s-]?shot(s?)\b/gi, (_m, p) => 'screenshot' + (p || ''));
        s = s.replace(/\bservice[\s-]?now\b/gi, 'ServiceNow');
        s = s.replace(/\brecomend(ed|ation|ations|s)?\b/gi, (_m, suf) => 'Recommend' + (suf || ''));
        s = s.replace(/\s+([.,;:!?])/g, '$1');
        s = s.replace(/\.{2,}/g, '.');
        s = s.replace(/([.!?])\s+([a-z])/g, (_m, p, c) => p + ' ' + c.toUpperCase());
        s = s.trim();
        if (!s) return '';
        s = s.charAt(0).toUpperCase() + s.slice(1);
        if (!/[.!?]$/.test(s)) s += '.';
        return s;
    };
    window._fmtRemark = fmtRemark;

    // Mechanical evidence-text normalization for Evidence Index / Evidence Pack
    // cells — trim, collapse whitespace, sentence-case the first letter, ensure
    // terminal punctuation. Unlike fmtRemark above, this NEVER rewrites content
    // (no typo/brand-casing fixes) — it exists purely so raw evidence notes read
    // as finished sentences without altering what the auditor recorded.
    // ReportStats.cleanEvidenceText (shared canonical source, when present) wins;
    // this is the local fallback consumed defensively when it is not yet loaded.
    const cleanEvidenceTextLocal = (raw) => {
        if (raw == null) return '';
        let s = String(raw).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (!s) return '';
        s = s.charAt(0).toUpperCase() + s.slice(1);
        if (!/[.!?]$/.test(s)) s += '.';
        return s;
    };
    const cleanEvidenceText = (raw) => {
        if (window.ReportStats && typeof window.ReportStats.cleanEvidenceText === 'function') {
            try { return window.ReportStats.cleanEvidenceText(raw); } catch (_e) { /* fall through to local */ }
        }
        return cleanEvidenceTextLocal(raw);
    };
    window._cleanEvidenceText = cleanEvidenceText;

    // ─── Methodology default text, branched by audit method (release item 5) ──
    // planning-module.js's Method select (`plan.auditMethod`, field id
    // plan-audit-method) yields exactly 'On-site' | 'Remote' | 'Hybrid' — there
    // is no separate remote/onsite boolean or auditMode field. This only supplies
    // the DEFAULT paragraph used when the auditor has left the free-text
    // auditPlan.auditMethodology blank; an absent/unrecognized auditMethod value
    // falls through to the caller's existing generic text, unchanged. Deterministic
    // templates only — no AI involved.
    const METHODOLOGY_DEFAULT_TEXT = {
        'on-site': '• Risk-based sampling of processes, records, and documentation\n• In-person interviews with management and operational personnel at all levels\n• Physical presence on-site, including a facility tour and direct observation of activities and work environment\n• On-site review of documented information and objective evidence\n• Verification of corrective actions from previous audits',
        'remote': '• Risk-based sampling of processes, records, and documentation\n• Remote interviews with management and operational personnel via video conferencing\n• Screen-shared, real-time review of records and documented information\n• Remote observation of activities and objective evidence where practicable, conducted per IAF MD4\n• Verification of corrective actions from previous audits',
        'hybrid': '• Risk-based sampling of processes, records, and documentation\n• A combination of in-person and remote (video-conferenced) interviews with management and operational personnel\n• On-site facility tour and direct observation of activities, supplemented by remote screen-shared review of records, conducted per IAF MD4\n• Review of documented information and objective evidence, gathered both on-site and remotely\n• Verification of corrective actions from previous audits'
    };
    const methodologyDefaultText = (auditPlan) => {
        const method = (auditPlan && auditPlan.auditMethod) ? String(auditPlan.auditMethod).trim().toLowerCase() : '';
        return METHODOLOGY_DEFAULT_TEXT[method] || null; // null → caller keeps its existing generic fallback
    };
    window._methodologyDefaultText = methodologyDefaultText;

    // ─── Criterion display for findings (#7) ───────────────────────────────────
    // Checklist items carried over from a Stage 1 FOCUS item (or other internal
    // tracking refs like SURV./ORG./DOC.) use an internal reference in `clause`
    // that is never a real ISO clause. When a parallel agent has resolved the real
    // clause onto `criterionRef` (criterionSource 'checklist'|'focus-carryover'),
    // show that instead. Otherwise, an internal ref with no resolved clause is a
    // visible reporting gap — flagged so it cannot pass unnoticed (the integrity
    // validator, report-integrity.js, blocks finalization on this).
    //
    // Classification (real-vs-internal) is delegated to the single shared source,
    // ReportStats.formatCriterion(), so every report module agrees on it. What
    // stays local here is presentation: the alarm-red "Criterion not assigned"
    // wording is reserved for finding contexts (NC rows, and OBS/OFI rows shown
    // as findings); conforming checklist rows, plain listings and the Evidence
    // Index get a neutral "Internal focus item … (Stage 1 carryover)" label
    // instead — an unresolved internal ref there is expected, not alarming.
    const INTERNAL_REF_PREFIX_RE = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;
    const displayCriterion = (finding, isFinding) => {
        const esc = (window.UTILS && window.UTILS.escapeHtml) ? window.UTILS.escapeHtml : (s) => String(s == null ? '' : s);
        if (!finding) return '';
        if (isFinding == null) isFinding = true; // default: existing call sites are finding rows

        const fc = (window.ReportStats && typeof window.ReportStats.formatCriterion === 'function')
            ? window.ReportStats.formatCriterion(finding)
            : null;
        const clause = finding.clause || '';
        const isInternal = fc ? fc.isInternal : INTERNAL_REF_PREFIX_RE.test(clause);

        if (!isInternal) {
            // fc.label is the real clause only (no internal-ref parenthetical) by
            // default — ReportStats.formatCriterion only surfaces the internal ref
            // when called with {showInternal:true}, which no client-facing row does.
            return esc(fc ? fc.label : clause);
        }
        // Both flags below render as a block with explicit white-space:normal +
        // overflow-wrap so they stay wrap-safe even inside a parent <td> that sets
        // white-space:nowrap for the common short-clause case (e.g. "9.2") — an
        // un-overridden nowrap span here overflowed narrow (10%) Clause columns
        // and painted over the adjacent ISO Requirement text in the printed PDF.
        if (isFinding) {
            return '<span style="color:#b91c1c;font-weight:700;display:block;white-space:normal;overflow-wrap:break-word;line-height:1.3;" title="Criterion not assigned — internal tracking reference only">Criterion not assigned<br><span style="font-weight:600;font-size:0.85em;">(' + esc(clause) + ')</span></span>';
        }
        return '<span style="color:#64748b;font-style:italic;display:block;white-space:normal;overflow-wrap:break-word;line-height:1.3;" title="Internal Stage 1 tracking reference — not a finding">Internal focus item<br><span style="font-style:normal;font-weight:600;font-size:0.85em;">' + esc(clause) + ' (Stage 1 carryover)</span></span>';
    };
    window._displayCriterion = displayCriterion;

    // ─── Adaptive table — omit columns that are empty across every row (release
    // item 7) ──────────────────────────────────────────────────────────────────
    // headers: [{label, thStyle?, tdStyle?}] in column order. bodyRows:
    // [{rowStyle?, cells:[cellHtml, ...]}] — cells align 1:1 with headers. A
    // column is dropped only when EVERY row's cell (tags stripped) reduces to a
    // blank/dash/"Not recorded"/"N/A" placeholder — never on a per-row basis. Width
    // is rebalanced evenly across surviving columns; all other cell/header styling
    // passed in is preserved unchanged. Returns {theadHtml, bodyHtml, keptCount}
    // so the caller keeps its own <table>/<tbody> wrapper and outer styling.
    const ADAPTIVE_EMPTY_CELL_TEXT = new Set(['—', '-', '', 'not recorded', 'none', 'n/a', 'na']);
    const isAdaptiveEmptyCell = (html) => {
        const text = String(html == null ? '' : html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().toLowerCase();
        return ADAPTIVE_EMPTY_CELL_TEXT.has(text);
    };
    const buildAdaptiveTable = (headers, bodyRows) => {
        const colCount = headers.length;
        let keep = headers.map(function (_, c) {
            return !bodyRows.every(function (r) { return isAdaptiveEmptyCell(r.cells[c]); });
        });
        // Never drop every column, and never touch layout when there are no rows to judge by.
        if (bodyRows.length === 0 || keep.every(function (k) { return !k; })) {
            keep = headers.map(function () { return true; });
        }
        const kept = headers.filter(function (_, c) { return keep[c]; });
        const evenPct = (100 / kept.length).toFixed(2) + '%';
        const theadHtml = '<tr>' + kept.map(function (h) {
            return '<th style="width:' + evenPct + ';' + (h.thStyle || '') + '">' + h.label + '</th>';
        }).join('') + '</tr>';
        const bodyHtml = bodyRows.map(function (r) {
            const cells = r.cells.filter(function (_, c) { return keep[c]; });
            return '<tr' + (r.rowStyle ? ' style="' + r.rowStyle + '"' : '') + '>'
                + cells.map(function (cellHtml, i) { return '<td style="' + (kept[i].tdStyle || 'padding:8px 12px;') + '">' + cellHtml + '</td>'; }).join('')
                + '</tr>';
        }).join('');
        return { theadHtml: theadHtml, bodyHtml: bodyHtml, keptCount: kept.length, colCount: colCount };
    };
    window._buildAdaptiveTable = buildAdaptiveTable;

    // ─── Canonical report identifier (release item 9) ──────────────────────────
    // The same value must appear everywhere a report ref/ID is printed: cover
    // "Report ID", the document-control block's "Document ID"/"Doc ID", and the
    // Evidence Pack / closing-page "Report Ref"/"Doc Ref" (those were pulling the
    // audit PLAN's reference via window.UTILS.getPlanRef instead of a report-
    // specific ref, while the cover/footer used an unrelated 'RPT-'+id scheme —
    // two different values for what reads as one identifier). Reuses getPlanRef's
    // existing {initials}-{year}-{seq} composition, swapping its 'PLN-' prefix
    // for 'AR-' (Audit Report), rather than inventing a new numbering scheme.
    // Falls back to the pre-existing 'RPT-' + id-prefix convention (also used by
    // the QR verify-card payload above) only when no plan is linked.
    // NOTE: does not touch "Plan Reference" fields (audit-info table, Annexure A)
    // — those are genuinely about the audit plan, not this report document.
    const reportRef = (d) => {
        if (d && d.auditPlan && window.UTILS && typeof window.UTILS.getPlanRef === 'function') {
            const planRef = window.UTILS.getPlanRef(d.auditPlan);
            if (planRef) return planRef.replace(/^PLN-/, 'AR-');
        }
        return 'RPT-' + String((d && d.report && d.report.id) || '').substring(0, 8);
    };
    window._reportRef = reportRef;

    // ─── Client logo resolution ────────────────────────────────────────────────
    // client.logoUrl is only ever set by a manual upload in Account Setup, so
    // clients with a website on file still printed the dashed "Client Logo"
    // placeholder. Fall back to the site's favicon (Google's s2 service, 128px)
    // derived from client.website — CSP img-src allows any https: image, so it
    // renders both in-app and in the print window. An uploaded logo always wins.
    const resolveClientLogoUrl = (client) => {
        if (!client) return '';
        if (client.logoUrl) return client.logoUrl;
        const site = String(client.website || '').trim();
        if (!site) return '';
        try {
            const host = new URL(/^https?:\/\//i.test(site) ? site : 'https://' + site).hostname;
            if (host) return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=128';
        } catch (_e) { /* malformed website value — no fallback */ }
        return '';
    };
    window._resolveClientLogoUrl = resolveClientLogoUrl;

    // Formal criterion cell for CAPA / NCR-register style tables (Corrective
    // Action Requirements, NCR Register) — these list confirmed NCs only, so
    // always finding context. Leads with the real clause in the accreditation-
    // formal style "ISO 9001:2015 — Clause 9.2". Client-facing: the internal
    // tracking reference is never shown here, even when one exists on the
    // finding — internal refs are reserved for the Audit Trails "Internal
    // focus items" list and the two non-finding/finding fallback labels below.
    // An unresolved internal ref (no real clause resolved) keeps the same
    // alarm wording as displayCriterion's finding-context branch.
    const formalCriterionCell = (finding, standard) => {
        const esc = (window.UTILS && window.UTILS.escapeHtml) ? window.UTILS.escapeHtml : (s) => String(s == null ? '' : s);
        if (!finding) return '';
        const fc = (window.ReportStats && typeof window.ReportStats.formatCriterion === 'function')
            ? window.ReportStats.formatCriterion(finding)
            : null;
        const clause = finding.clause || '';
        const isInternal = fc ? fc.isInternal : INTERNAL_REF_PREFIX_RE.test(clause);
        if (isInternal) {
            // Wrap-safe/compact — see the matching note in displayCriterion above.
            return '<span style="color:#b91c1c;font-weight:700;display:block;white-space:normal;overflow-wrap:break-word;line-height:1.3;" title="Criterion not assigned — internal tracking reference only">Criterion not assigned<br><span style="font-weight:600;font-size:0.85em;">(' + esc(clause) + ')</span></span>';
        }
        const real = fc ? fc.real : clause;
        const stdPrefix = standard ? esc(standard) + ' — ' : '';
        return '<div>' + stdPrefix + 'Clause ' + esc(real) + '</div>';
    };
    window._formalCriterionCell = formalCriterionCell;

    // Build the list of revision-history rows to render on the cover page.
    // Does NOT mutate the report — pure read helper used by both the preview modal and PDF export.
    // Version bumps now happen ONLY at finalize/re-issue time (see ai-service.js
    // finalizeAndPublish), recorded to report.issueLog[]. Legacy report.revisionHistory
    // (from the old +0.1-per-export scheme) is still honored for older reports.
    // If neither is present, synthesize a single placeholder row so the table is never
    // empty (draft reports show a "not yet issued" row, final reports show 1.0).
    const getRevisionRows = (report, todayStr) => {
        if (Array.isArray(report.revisionHistory) && report.revisionHistory.length > 0) {
            return report.revisionHistory;
        }
        if (Array.isArray(report.issueLog) && report.issueLog.length > 0) {
            return report.issueLog.map(entry => ({
                ver: entry.version,
                date: (entry.at ? new Date(entry.at).toLocaleDateString() : (report.date || todayStr)),
                author: entry.by || report.leadAuditor || 'Lead Auditor',
                desc: entry.action === 'reissued' ? 'Revised and re-issued' : 'Initial issue'
            }));
        }
        const isFinal = report.reportStatus === 'final';
        return [{
            ver: isFinal ? '1.0' : 'Draft',
            date: report.date || todayStr,
            author: report.leadAuditor || 'Lead Auditor',
            desc: isFinal ? 'Initial issue' : 'Draft — not yet issued'
        }];
    };
    window._getRevisionRows = getRevisionRows;

    // Whether the report has REAL revision-history entries to show (release item
    // 6) — true only for report.revisionHistory or report.issueLog rows actually
    // recorded. getRevisionRows() above synthesizes a single "Rev 0 / Draft"
    // placeholder row so its own return value is never empty; that placeholder
    // must not by itself force the Document Revision History block to render —
    // it stays suppressed until the report has been through its first issue.
    const hasActualRevisionHistory = (report) => {
        if (!report) return false;
        return (Array.isArray(report.revisionHistory) && report.revisionHistory.length > 0)
            || (Array.isArray(report.issueLog) && report.issueLog.length > 0);
    };
    window._hasActualRevisionHistory = hasActualRevisionHistory;

    // Deprecated: version no longer bumps on export. Kept as a harmless no-op in case
    // any other module still calls it. Versioning now lives in ai-service.js
    // finalizeAndPublish, which appends to report.issueLog[] on finalize/re-issue only.
    const bumpRevisionHistoryOnFinalExport = () => { /* no-op — see report.issueLog */ };
    window._bumpRevisionHistoryOnFinalExport = bumpRevisionHistoryOnFinalExport;

    // Roles permitted to finalize/re-issue or change report status. Mirrors the gate
    // enforced inside ai-service.js finalizeAndPublish — kept in one place here so both
    // the toggle button and the finalize action agree on who may act.
    const REPORT_ISSUANCE_ROLES = ['Lead Auditor', 'Admin', 'Certification Manager'];
    const hasIssuanceRole = () => {
        try {
            if (window.AuthManager && typeof window.AuthManager.hasRole === 'function') {
                return !!window.AuthManager.hasRole(REPORT_ISSUANCE_ROLES);
            }
        } catch (_e) { /* fall through */ }
        return true; // AuthManager not wired in this environment — fail open rather than lock out.
    };

    // Toggle a report's status. Only FINALIZE (ai-service.js finalizeAndPublish) may
    // move a report INTO 'final' — that is the sole path that bumps version, writes
    // issuedSnapshot, and clears the DRAFT watermark logic. This toggle may only revert
    // a final report back to 'draft' (e.g. to correct something before re-issuing).
    window.toggleReportStatus = function () {
        const d = window._reportPreviewData;
        if (!d || !d.report) return;
        if (!hasIssuanceRole()) {
            window.showNotification && window.showNotification('You do not have permission to change report status.', 'error');
            return;
        }
        if (d.report.reportStatus === 'final') {
            if (!confirm('Revert this report to DRAFT? Re-issuing afterwards will require finalizing again.')) return;
            d.report.reportStatus = 'draft';
        } else {
            window.showNotification && window.showNotification('Use "Finalize & Publish" to issue this report as FINAL.', 'info');
            return;
        }
        if (typeof window.saveData === 'function') window.saveData();
        window.showReportPreviewModal();
    };

    // ─── Finding Status editor (report.findingStatus[clause|department]) ──────
    // Closes the dead read path in report-findings-ops.js findingLifecycle, which
    // already reads d.report.findingStatus[key].status.
    const FINDING_STATUS_OPTIONS = [
        { value: 'open', label: 'Open' },
        { value: 'corrected_during_audit', label: 'Corrected During Audit' },
        { value: 'verified', label: 'Verified' },
        { value: 'pending_verification', label: 'Pending Verification' },
        { value: 'closed', label: 'Closed' },
        { value: 'escalated', label: 'Escalated' }
    ];
    window._FINDING_STATUS_OPTIONS = FINDING_STATUS_OPTIONS;

    window.updateFindingStatus = function (key, value) {
        const d = window._reportPreviewData;
        if (!d || !d.report || !key) return;
        if (!d.report.findingStatus || typeof d.report.findingStatus !== 'object') d.report.findingStatus = {};
        d.report.findingStatus[key] = {
            status: value,
            date: new Date().toISOString(),
            by: (window.state && window.state.currentUser && window.state.currentUser.name) || d.report.leadAuditor || 'Unknown'
        };
        if (typeof window.saveData === 'function') window.saveData();
    };

    // ─── Technical Review block (report.technicalReview) ──────────────────────
    // Structured replacement for the old contenteditable-only technicalReviewer
    // string. Legacy report.technicalReviewer is still read as a fallback wherever
    // technicalReview is absent (historical reports).
    window.updateTechnicalReview = function (field, value) {
        const d = window._reportPreviewData;
        if (!d || !d.report || !field) return;
        if (!d.report.technicalReview || typeof d.report.technicalReview !== 'object') {
            d.report.technicalReview = { reviewer: d.report.technicalReviewer || '', outcome: '', date: '', notes: '' };
        }
        d.report.technicalReview[field] = value;
        if (typeof window.saveData === 'function') window.saveData();
    };
    // data-action-input adapter (the input delegation passes (el, dataset, e),
    // not positional args) — the field name rides on data-tr-field.
    window.updateTechnicalReviewField = function (el) {
        if (!el || !el.dataset) return;
        window.updateTechnicalReview(el.dataset.trField, el.value);
    };

    // Resolve the display values for the technical review block, honoring the legacy
    // string field when the structured object hasn't been recorded yet.
    const resolveTechnicalReview = (report) => {
        if (report.technicalReview && typeof report.technicalReview === 'object') {
            return {
                reviewer: report.technicalReview.reviewer || '',
                outcome: report.technicalReview.outcome || '',
                date: report.technicalReview.date || '',
                notes: report.technicalReview.notes || '',
                isLegacy: false
            };
        }
        if (report.technicalReviewer) {
            return { reviewer: report.technicalReviewer, outcome: '', date: '', notes: '', isLegacy: true };
        }
        return { reviewer: '', outcome: '', date: '', notes: '', isLegacy: true };
    };
    window._resolveTechnicalReview = resolveTechnicalReview;

    // ─── Recommendation single-source ──────────────────────────────────────────
    // report.recommendation (manual radio) is authoritative whenever the auditor has
    // set it. stats.recommendation (auto-derived from NC counts) is shown only as a
    // small "system-derived" caption so the two never contradict on the printed page.
    const resolveRecommendation = (report, stats) => {
        const manual = report && report.recommendation;
        const auto = stats && stats.recommendation;
        return {
            primary: manual || auto || 'Pending',
            isManual: !!manual,
            auto: auto || '',
            showAutoCaption: !!manual && !!auto && manual !== auto
        };
    };
    window._resolveRecommendation = resolveRecommendation;

    // Detect whether a FINAL report's content has drifted since it was issued, so the
    // preview + PDF can surface a "MODIFIED SINCE ISSUE" banner. Uses the cheap djb2
    // fingerprint exposed by ai-service.js (window._reportContentHash).
    window._isModifiedSinceIssue = function (d) {
        try {
            if (!d || !d.report || d.report.reportStatus !== 'final') return false;
            const snap = d.report.issuedSnapshot;
            if (!snap || !snap.contentHash || typeof window._reportContentHash !== 'function') return false;
            const rs = d.stats && d.stats.rs;
            const statsSummaryNow = rs ? {
                majorNC: rs.majorNC, minorNC: rs.minorNC, observationCount: rs.observationCount,
                ofiCount: rs.ofiCount, coveragePct: rs.coveragePct, conformityPct: rs.conformityPct,
                recommendation: rs.recommendation
            } : null;
            const currentHash = window._reportContentHash(d.report, statsSummaryNow);
            return currentHash !== snap.contentHash;
        } catch (_e) { return false; }
    };

    window.generateAuditReport = async function (reportId) {
        const report = window.DataService.findAuditReport(reportId);
        if (!report) {
            window.showNotification('Report not found', 'error');
            return;
        }

        // 1. Hydrate Checklist Data (Clause & Requirements) - using shared helper
        const hydratedProgress = (report.checklistProgress || []).map(item => {
            let clause = item.clause;
            let requirement = item.requirement;

            // Use shared helper for clause/requirement resolution if data is missing
            if ((!requirement || !clause) && item.checklistId) {
                const resolved = window.KB_HELPERS.resolveChecklistClause(item, window.state.checklists || []);
                if (resolved.clauseText) clause = resolved.clauseText;
                if (resolved.reqText) requirement = resolved.reqText;
            }

            // ALWAYS look up KB standard requirement (not just as fallback)
            const kbMatch = window.KB_HELPERS.lookupKBRequirement(clause, report.standard);

            return {
                ...item,
                clause: clause || item.clause || item.sectionName || 'General Requirement',
                requirement: requirement || item.text || item.requirement || item.description || 'Requirement details not available',
                kbMatch: kbMatch,
                comment: item.comment || ''
            };
        });

        // Resolve all idb:// evidence URLs to data URLs (screen captures stored in IndexedDB).
        // Each unique image is compressed/thumbnailed exactly ONCE and cached in _evImgCache,
        // then reused everywhere it's embedded (main report thumbs, gallery index, evidence pack).
        const _evImgCache = new Map(); // original resolved dataUrl -> {full, thumb}
        const resolveUrl = async (url) => {
            if (!url || typeof url !== 'string' || !url.startsWith('idb://')) return url;
            try {
                const dataUrl = await EvidenceDB.get(url);
                return dataUrl || '';
            } catch (_e) { return ''; }
        };
        const getEvVariants = async (dataUrl) => {
            if (!dataUrl) return { full: dataUrl, thumb: dataUrl };
            if (_evImgCache.has(dataUrl)) return _evImgCache.get(dataUrl);
            let full = dataUrl, thumb = dataUrl;
            try {
                if (window.EvidenceUtils?.compress) full = await window.EvidenceUtils.compress(dataUrl, { maxPx: 1600, quality: 0.75 }) || dataUrl;
            } catch (_e) { full = dataUrl; }
            try {
                if (window.EvidenceUtils?.thumb) thumb = await window.EvidenceUtils.thumb(dataUrl, { maxPx: 320, quality: 0.7 }) || full;
            } catch (_e) { thumb = full; }
            const variants = { full, thumb };
            _evImgCache.set(dataUrl, variants);
            return variants;
        };
        for (const item of hydratedProgress) {
            // Snapshot the pre-resolution keys (idb:// URLs or as-captured URLs) so the
            // evidence indexer below can match them against EvidenceUtils.getEvidenceIndex()
            // and reuse the same EV-IDs assigned at capture time, instead of renumbering.
            item._origEvKeys = {
                single: item.evidenceImage || null,
                list: Array.isArray(item.evidenceImages) ? item.evidenceImages.slice() : []
            };
            if (item.evidenceImage) {
                item.evidenceImage = await resolveUrl(item.evidenceImage);
                if (item.evidenceImage) {
                    const v = await getEvVariants(item.evidenceImage);
                    item.evidenceImageThumb = v.thumb;
                }
            }
            if (Array.isArray(item.evidenceImages)) {
                item.evidenceImages = await Promise.all(item.evidenceImages.map(resolveUrl));
                item.evidenceImages = item.evidenceImages.filter(u => !!u);
                const variants = await Promise.all(item.evidenceImages.map(getEvVariants));
                item.evidenceImages = variants.map(v => v.full);
                item.evidenceThumbs = variants.map(v => v.thumb);
            }
        }
        // Also resolve NCR evidence images
        if (report.ncrs) {
            for (const ncr of report.ncrs) {
                if (ncr.evidenceImage) {
                    ncr.evidenceImage = await resolveUrl(ncr.evidenceImage);
                    if (ncr.evidenceImage) {
                        const v = await getEvVariants(ncr.evidenceImage);
                        ncr.evidenceImageThumb = v.thumb;
                    }
                }
            }
        }

        // Build EV id index. Preferred: window.EvidenceUtils.getEvidenceIndex(), which carries
        // the EV-IDs assigned at capture time (keyed by the pre-resolution idb:// key), so
        // capture-time EV-IDs match printed ones within a session. Falls back to positional
        // numbering only when the capture-time index is empty or a given image has no match in it.
        const _evIndex = []; // [{evId, itemRef, image, thumb, comment, clause, dept, findingRef, capturedAt, location}]
        (function buildEvidenceIndex() {
            const captureIdx = (window.EvidenceUtils && typeof window.EvidenceUtils.getEvidenceIndex === 'function')
                ? (window.EvidenceUtils.getEvidenceIndex() || []) : [];
            const evIdByKey = {};
            let maxCaptureNum = 0;
            captureIdx.forEach((e) => {
                if (e && e.idbKey && e.evId) {
                    evIdByKey[e.idbKey] = e.evId;
                    const m = /(\d+)$/.exec(e.evId);
                    if (m) maxCaptureNum = Math.max(maxCaptureNum, parseInt(m[1], 10));
                }
            });
            const usedIds = new Set();
            let n = maxCaptureNum;
            const nextId = () => {
                let id;
                do { id = 'EV-' + String(++n).padStart(2, '0'); } while (usedIds.has(id));
                return id;
            };
            hydratedProgress.forEach((item) => {
                const imgs = Array.isArray(item.evidenceImages) && item.evidenceImages.length ? item.evidenceImages : (item.evidenceImage ? [item.evidenceImage] : []);
                const thumbs = Array.isArray(item.evidenceThumbs) && item.evidenceThumbs.length ? item.evidenceThumbs : (item.evidenceImageThumb ? [item.evidenceImageThumb] : []);
                const origKeys = (item._origEvKeys && item._origEvKeys.list.length) ? item._origEvKeys.list : (item._origEvKeys && item._origEvKeys.single ? [item._origEvKeys.single] : []);
                if (!imgs.length) return;
                item._evIds = [];
                imgs.forEach((img, i) => {
                    const origKey = origKeys[i];
                    let evId = (origKey && evIdByKey[origKey]) ? evIdByKey[origKey] : null;
                    if (!evId) evId = nextId();
                    usedIds.add(evId);
                    item._evIds.push(evId);
                    _evIndex.push({
                        evId,
                        image: img,
                        thumb: thumbs[i] || img,
                        comment: item.comment || '',
                        clause: item.clause || '',
                        criterionRef: item.criterionRef || null,
                        criterionSource: item.criterionSource || null,
                        dept: item.department || item.deptName || '',
                        findingRef: item.status === 'nc' ? (item.ncrType || 'NC') : (item.status || ''),
                        capturedAt: item.evidenceCapturedAt || item.capturedAt || '',
                        location: item.evidenceLocation || item.location || ''
                    });
                });
            });
            report._evidenceIndexBuilt = _evIndex;
        })();

        // Attempt to get client details for address/logo if available
        const client = window.state.clients.find(c => c.name === report.client) || {};
        // Uploaded logo, else favicon derived from client.website, else blank.
        const _clientLogo = resolveClientLogoUrl(client);

        // Get audit plan reference
        const auditPlan = report.planId ? window.DataService.findAuditPlan(report.planId) : null;

        // Enrich report with plan/client data if missing
        if (auditPlan) {
            if (!report.leadAuditor) {
                // Try plan.lead first, then first team member
                if (auditPlan.lead) {
                    const leadAuditor = window.state.auditors?.find(a => String(a.id) === String(auditPlan.lead));
                    report.leadAuditor = leadAuditor ? leadAuditor.name : auditPlan.lead;
                } else if (auditPlan.teamIds?.length) {
                    const leadAuditor = window.state.auditors?.find(a => String(a.id) === String(auditPlan.teamIds[0]));
                    report.leadAuditor = leadAuditor ? leadAuditor.name : '';
                } else if (auditPlan.team?.length) {
                    report.leadAuditor = typeof auditPlan.team[0] === 'object' ? auditPlan.team[0].name : auditPlan.team[0];
                }
            }
            if (!report.auditType) report.auditType = auditPlan.type || auditPlan.auditType || '';
        }
        if (!client.certificationScope) {
            // Pull scope from client certificates siteScopes (Scopes & Certs tab)
            const matchingCert = (client.certificates || []).find(c => (c.standard || '').toLowerCase() === (report.standard || '').toLowerCase());
            if (matchingCert && matchingCert.siteScopes) {
                // Combine all site scopes into one string
                const scopeValues = Object.entries(matchingCert.siteScopes).filter(([_k, v]) => v).map(([siteName, scopeText]) => siteName + ': ' + scopeText);
                client.certificationScope = scopeValues.length === 1 ? Object.values(matchingCert.siteScopes)[0] : scopeValues.join('; ') || '';
            }
            if (!client.certificationScope) {
                client.certificationScope = matchingCert?.scope || auditPlan?.scope || client.scope || '';
            }
            // Final fallback: build scope from goodsServices
            if (!client.certificationScope && client.goodsServices && client.goodsServices.length > 0) {
                client.certificationScope = client.goodsServices.map(g => g.name + (g.description ? ': ' + g.description : '')).join(', ');
            }
        }

        // CB Settings (real data, no fake info)
        const cbSettings = window.state.cbSettings || {};
        const cbSite = (cbSettings.cbSites || [])[0] || {};

        // Calculate stats
        const totalItems = hydratedProgress.length;
        const ncItems = hydratedProgress.filter(i => i.status === 'nc');
        const conformityItems = hydratedProgress.filter(i => i.status === 'conform');
        const naItems = hydratedProgress.filter(i => i.status === 'na');
        // Blank/undefined status = not yet assessed (counts against coverage, excluded from conformity)
        const notAssessedItems = hydratedProgress.filter(i => !i.status);
        const majorNC = ncItems.filter(i => (i.ncrType || '').toLowerCase() === 'major').length;
        const minorNC = ncItems.filter(i => (i.ncrType || '').toLowerCase() === 'minor').length;
        const observationCount = ncItems.filter(i => (i.ncrType || '').toLowerCase() === 'observation').length;
        const ofiCount = ncItems.filter(i => (i.ncrType || '').toLowerCase() === 'ofi').length;
        // NC items with no ncrType classified yet (neither major/minor/observation/ofi)
        const pendingClassificationCount = ncItems.filter(i => {
            const t = (i.ncrType || '').toLowerCase();
            return t !== 'major' && t !== 'minor' && t !== 'observation' && t !== 'ofi';
        }).length;
        // Actual NC count = major + minor + pending classification (excludes observations & OFIs,
        // which are advisories and must never inflate the NC/conformity math)
        const actualNCCount = majorNC + minorNC + pendingClassificationCount;
        // OBS/OFI combined count (advisories — do not reduce conformity)
        const obsOfiCount = observationCount + ofiCount;

        // NC breakdown by clause group (for bar chart) — majors/minors only, advisories excluded.
        // Internal refs (FOCUS.x / SURV.x / ORG.x / DOC.x carryover items) are never mixed into
        // the numeric ISO clause buckets — they get their own "Internal focus items" bucket.
        const INTERNAL_REF_RE = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;
        const ncByClause = {};
        ncItems.forEach(item => {
            const t = (item.ncrType || '').toLowerCase();
            if (t !== 'major' && t !== 'minor') return;
            const clauseStr = item.criterionRef || item.clause || '';
            const g = (!item.criterionRef && INTERNAL_REF_RE.test(item.clause || ''))
                ? 'Internal focus items'
                : (clauseStr.split('.')[0] || '?');
            ncByClause[g] = (ncByClause[g] || 0) + 1;
        });

        // Persist corrective-action due dates ONCE, computed from the audit end date (falling back
        // to the report date, then today). Previously these were recomputed from `new Date()` at
        // every export, so regenerating the PDF silently shifted every NC's due date. Now the date
        // is calculated the first time and stored on the record (checklist item / NCR) so later
        // exports reuse it.
        (function persistCorrectiveDueDates() {
            const baseDateStr = report.endDate || report.date || null;
            const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
            const baseValid = !isNaN(baseDate.getTime());
            const dueFrom = (days) => {
                const dt = new Date((baseValid ? baseDate : new Date()).getTime());
                dt.setDate(dt.getDate() + days);
                return dt.toISOString().split('T')[0];
            };
            let changed = false;
            (report.checklistProgress || []).forEach(item => {
                if (item.status !== 'nc') return;
                const typ = (item.ncrType || '').toLowerCase();
                if (typ !== 'major' && typ !== 'minor') return;
                if (!item.caDueDate) {
                    item.caDueDate = dueFrom(typ === 'major' ? 30 : 90);
                    changed = true;
                }
            });
            (report.ncrs || []).forEach(ncr => {
                if (!ncr.caDueDate) {
                    const typ = (ncr.type || 'Minor').toLowerCase();
                    ncr.caDueDate = dueFrom(typ === 'major' ? 30 : 90);
                    changed = true;
                }
            });
            if (changed && window.DataService?.syncAuditReport) {
                try {
                    window.DataService.syncAuditReport(reportId, {
                        checklistProgress: report.checklistProgress || [],
                        ncrs: report.ncrs || []
                    });
                } catch (_e) { /* noop */ }
            }
        })();

        const applicableCount = totalItems - naItems.length;
        // ISO 17021-1 style status (not percentage-based)
        let auditStatus, statusColor;
        if (majorNC > 0) { auditStatus = 'Action Required'; statusColor = '#dc2626'; }
        else if (minorNC > 0) { auditStatus = 'Satisfactory with Minor Issues'; statusColor = '#d97706'; }
        else { auditStatus = 'Satisfactory'; statusColor = '#16a34a'; }

        // Preferred: shared ReportStats module (single source of truth across all report agents).
        // Legacy fallback: compute the same corrected semantics inline if the module isn't loaded.
        const rs = (window.ReportStats && typeof window.ReportStats.build === 'function')
            ? window.ReportStats.build({ report, hydratedProgress, auditPlan, client })
            : null;

        // Recommendation: audit-type-aware, deterministic — never AI, never a fixed
        // "Recommended for Certification" regardless of audit type (a surveillance
        // audit must never print that certification-granting phrase). Prefer the
        // shared ReportStats.recommendationText computation; fall back to the same
        // logic inline only when the module failed to load.
        const REC_COLOR_HEX = { bad: '#dc2626', warn: '#d97706', good: '#16a34a', neutral: '#64748b' };
        let recommendation, recColor;
        if (rs && rs.recommendation) {
            recommendation = rs.recommendation;
            recColor = REC_COLOR_HEX[rs.recColor] || '#16a34a';
        } else if (window.ReportStats && typeof window.ReportStats.recommendationText === 'function') {
            const auditTypeForRec = report.auditType || auditPlan?.type || auditPlan?.auditType || '';
            recommendation = window.ReportStats.recommendationText(auditTypeForRec, { majorNC, minorNC });
            recColor = majorNC > 0 ? '#dc2626' : (minorNC > 0 ? '#d97706' : '#16a34a');
        } else if (majorNC > 0) { recommendation = 'Conditional Recommendation'; recColor = '#d97706'; }
        else { recommendation = 'Recommended for Certification'; recColor = '#16a34a'; }

        const assessedCount = conformityItems.length + actualNCCount + obsOfiCount;
        const notAssessedCount = rs ? rs.resultCounts.notAssessed : notAssessedItems.length;
        const coveragePct = rs ? rs.coveragePct
            : (applicableCount > 0 ? Math.round((assessedCount / applicableCount) * 100) : null);
        const conformityDenom = conformityItems.length + actualNCCount;
        const conformityPct = rs ? rs.conformityPct
            : (conformityDenom > 0 ? Math.round((conformityItems.length / conformityDenom) * 100) : null);

        // `ncCount` = majors + minors + pending classification ONLY (never inflated by obs/ofi).
        // `advisoryCount` tracks observations + OFIs separately so downstream UI never conflates them.
        const stats = {
            totalItems, ncCount: actualNCCount, actualNCCount,
            conformCount: conformityItems.length, naCount: naItems.length,
            majorNC, minorNC, pendingClassificationCount,
            observationCount, ofiCount, obsOfiCount, advisoryCount: obsOfiCount,
            notAssessedCount, ncByClause, applicableCount, assessedCount,
            coveragePct, conformityPct,
            auditStatus, statusColor, recommendation, recColor,
            rs
        };

        // QR Code: links to a self-contained, non-confidential Report Card page (#verify hash route).
        // Scanning opens the app at that hash, which renders the card without exposing scope, findings, or personal data.
        const cbName = cbSettings.cbName || (cbSettings.cbSites || [])[0]?.name || cbSettings.name || '';
        // Logo: only include if it's a public http(s) URL — skip data: URIs (too large for QR payload).
        const cbLogo = (typeof cbSettings.logoUrl === 'string' && /^https?:\/\//i.test(cbSettings.logoUrl))
            ? cbSettings.logoUrl : '';
        const accBody = cbSettings.accreditationBody || '';
        const accNum = cbSettings.accreditationNumber || '';
        const datesText = (report.date || '') + (report.endDate ? ' to ' + report.endDate : '');
        const cardPayload = {
            v: 1,
            cb: cbName,
            logo: cbLogo,
            accBody,
            accNum,
            email: cbSettings.cbEmail || '',
            client: report.client || '',
            standard: report.standard || '',
            type: report.auditType || auditPlan?.auditType || 'Initial',
            dates: datesText,
            ref: reportRef({ auditPlan, report }),
            status: auditStatus,
            statusColor,
            major: majorNC,
            minor: minorNC,
            obs: observationCount,
            ofi: ofiCount,
            outcome: recommendation,
            outcomeColor: recColor
        };
        // URL-safe base64: +/= → -_<stripped>. Some scanners and routers mishandle raw '+' in URL hashes.
        const cardB64 = window.btoa(unescape(encodeURIComponent(JSON.stringify(cardPayload))))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const cardHash = '#verify=' + cardB64;
        // Resolve base URL. Scanners only auto-link http(s) URLs that resolve publicly — a QR
        // pointing at file://, localhost, or 192.168.x.x leads scanners to a dead address.
        // Fallback chain: explicit publicReportUrl → current origin (if public) → cbWebsite → sentinel.
        const isPublicOrigin = (function () {
            const origin = window.location.origin || '';
            if (!/^https?:\/\//i.test(origin)) return false;
            try {
                const host = new URL(origin).hostname;
                if (!host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false;
                if (/^192\.168\./.test(host)) return false;
                if (/^10\./.test(host)) return false;
                if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
                return true;
            } catch (_e) { return false; }
        })();
        const normalizeBase = (u) => u.replace(/[#?].*$/, '').replace(/\/+$/, '/');
        const explicitBase = (cbSettings.publicReportUrl && /^https?:\/\//i.test(cbSettings.publicReportUrl))
            ? normalizeBase(cbSettings.publicReportUrl) : '';
        const originBase = isPublicOrigin
            ? (window.location.origin + window.location.pathname) : '';
        const cbWebsiteBase = (cbSettings.cbWebsite && /^https?:\/\//i.test(cbSettings.cbWebsite))
            ? normalizeBase(cbSettings.cbWebsite) + '/' : '';
        const resolvedBase = explicitBase || originBase || cbWebsiteBase || 'https://audit-cb.example/';
        const usingFallback = !explicitBase && !originBase && !cbWebsiteBase;
        const cardUrl = resolvedBase + cardHash;
        // Use ecc=L (lowest error correction) for higher data density since this URL is dense
        // and the report is printed/PDF'd at high resolution where errors are unlikely.
        // Rendered at <=120px in the report, so request 200x200 instead of 400x400 to cut embedded payload size.
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=2&ecc=L&data=${encodeURIComponent(cardUrl)}`;
        try { console.info('[Report Card QR] URL:', cardUrl, '(base:', resolvedBase + ')'); } catch (_e) { /* noop */ }
        if (usingFallback) {
            try { console.warn('[Report Card QR] Using sentinel fallback URL. Configure cbSettings.cbWebsite or cbSettings.publicReportUrl so scanned QRs resolve to a real address.'); } catch (_e) { /* noop */ }
        }

        // Store data for preview & export
        window._reportPreviewData = {
            report, hydratedProgress, client, auditPlan, cbSettings, cbSite,
            clientLogo: resolveClientLogoUrl(client),
            cbLogo: cbSettings.logoUrl || '',
            qrCodeUrl,
            cardUrl,
            qrFallback: usingFallback,
            stats,
            today: new Date().toLocaleDateString('en-GB')
        };

        // Warm the AI executive-summary/insights cache in the background so export
        // uses AI content when ready; export never waits on this (fallbacks otherwise).
        if (window.ReportExecutive?.prepare) {
            try { window.ReportExecutive.prepare(window._reportPreviewData).catch(function () { }); } catch (_e) { /* noop */ }
        }

        // Show Report Preview & Edit modal
        window.showReportPreviewModal();

    };

    // ============================================
    // REPORT PREVIEW & EDIT MODAL
    // ============================================
    window.showReportPreviewModal = function () {
        const d = window._reportPreviewData;
        if (!d) return;

        // Risk/maturity dashboard: weight majors higher than minors so a single Major NC
        // can't be masked by an otherwise-clean checklist. ncCount here is already
        // major+minor+pending (advisories excluded) per the stats fix above.
        const _majorNC = d.stats.majorNC || 0;
        const _ncCount = d.stats.ncCount || 0;
        const _riskLevel = (_majorNC > 0 || _ncCount > 3) ? 'HIGH' : (_ncCount > 0 ? 'MEDIUM' : 'LOW');
        const _riskColor = _riskLevel === 'HIGH' ? '#ef4444' : _riskLevel === 'MEDIUM' ? '#f59e0b' : '#10b981';
        // Ad-hoc "maturity" star rating removed — it was a raw-NC-count guess that
        // contradicted report-scoring's gated maturity engine. The KPI card below
        // now shows the findings-count summary instead, with an explicit
        // "(analytical indicator)" sub-label since it is engine-derived, not audited.

        // Remove existing overlay
        const existing = document.getElementById('report-preview-overlay');
        if (existing) existing.remove();

        const sections = [
            { id: 'audit-info', label: 'Audit Info', icon: 'fa-clipboard-list', color: '#2563eb' },
            { id: 'audit-programme', label: 'Audit Programme', icon: 'fa-calendar-days', color: '#0ea5e9' },
            ...((d.client && Array.isArray(d.client.sites) && d.client.sites.length > 1) ? [{ id: 'multi-site', label: 'Multi-Site Sampling', icon: 'fa-map-location-dot', color: '#16a34a' }] : []),
            { id: 'objectives', label: 'Objectives & Methodology', icon: 'fa-bullseye', color: '#0891b2' },
            { id: 'summary', label: 'Summary', icon: 'fa-file-lines', color: '#059669' },
            { id: 'charts', label: 'Charts', icon: 'fa-chart-pie', color: '#7c3aed' },
            { id: 'conformance', label: 'Conformance', icon: 'fa-circle-check', color: '#059669' },
            { id: 'audit-trails', label: 'Audit Trails', icon: 'fa-route', color: '#0ea5e9' },
            { id: 'prev-findings', label: 'Prev Findings', icon: 'fa-history', color: '#6366f1' },
            { id: 'obs', label: 'Observations', icon: 'fa-eye', color: '#8b5cf6' },
            { id: 'ofi', label: 'OFI', icon: 'fa-lightbulb', color: '#06b6d4' },
            { id: 'findings', label: 'Findings', icon: 'fa-triangle-exclamation', color: '#dc2626' },
            { id: 'ncrs', label: 'NCRs', icon: 'fa-clipboard-check', color: '#ea580c' },
            { id: 'corrective', label: 'Corrective Actions', icon: 'fa-wrench', color: '#be185d' },
            { id: 'changes', label: 'Changes', icon: 'fa-clock-rotate-left', color: '#78716c' },
            { id: 'mgmt-effectiveness', label: 'Mgmt Effectiveness', icon: 'fa-gauge-high', color: '#0e7490' },
            { id: 'conclusion', label: 'Conclusion', icon: 'fa-gavel', color: '#4338ca' },
            { id: 'signature', label: 'Signature', icon: 'fa-signature', color: '#1e293b' },
            { id: 'distribution', label: 'Distribution', icon: 'fa-share-nodes', color: '#0d9488' },
            { id: 'annexures', label: 'Annexures', icon: 'fa-paperclip', color: '#9333ea' }
        ]
            .concat((window.ReportExecutive && window.ReportExecutive.sectionsPreviewToggles) ? window.ReportExecutive.sectionsPreviewToggles() : [])
            .concat((window.ReportScoring && window.ReportScoring.sectionsPreviewToggles) ? window.ReportScoring.sectionsPreviewToggles() : [])
            .concat((window.ReportRisk && window.ReportRisk.sectionsPreviewToggles) ? window.ReportRisk.sectionsPreviewToggles() : [])
            .concat((window.ReportOperational && window.ReportOperational.sectionsPreviewToggles) ? window.ReportOperational.sectionsPreviewToggles() : [])
            .concat((window.ReportFindingsOps && window.ReportFindingsOps.sectionsPreviewToggles) ? window.ReportFindingsOps.sectionsPreviewToggles() : [])
            .concat((window.ReportFrameworks && window.ReportFrameworks.sectionsPreviewToggles) ? window.ReportFrameworks.sectionsPreviewToggles() : []);

        // Sections whose preview toggle starts unchecked (opt-in annexes).
        const DEFAULT_OFF = ['carForms'];
        // Persisted toggle choices (report.reportConfig.sectionToggles) take priority over
        // the always-reset default so re-opening the preview keeps what was chosen last time.
        const _persistedToggles = (d.report.reportConfig && d.report.reportConfig.sectionToggles) || null;
        window._reportSectionState = {};
        sections.forEach(s => {
            if (_persistedToggles && Object.prototype.hasOwnProperty.call(_persistedToggles, s.id)) {
                window._reportSectionState[s.id] = !!_persistedToggles[s.id];
            } else {
                window._reportSectionState[s.id] = !s.hide && DEFAULT_OFF.indexOf(s.id) < 0;
            }
        });

        // Annex master toggles (#3): default formal always on; evidence on (NC evidence
        // traceability); analytics/capa off. Persisted at report.reportConfig.annexes.
        const _annexToggles = Object.assign({ analytics: false, evidence: true, capa: false }, (d.report.reportConfig && d.report.reportConfig.annexes) || {});
        window._reportAnnexState = _annexToggles;

        // ─── Audit Programme (3-year certification cycle) — preview data ──
        // Single computation shared with the export path via ReportStats.buildProgramme:
        // anchors on the client's certificate, overlays real history, and never
        // fabricates Stage 1/2 dates when there is nothing to anchor on.
        const pvStandard = d.report.standard || d.auditPlan?.standard || 'ISO Standard';
        const EDIT_ID_BY_STAGE = { s1: 'rp-prog-s1', s2: 'rp-prog-s2', sv1: 'rp-prog-sv1', sv2: 'rp-prog-sv2', recert: 'rp-prog-recert' };
        const pvProgramme = (window.ReportStats && typeof window.ReportStats.buildProgramme === 'function')
            ? window.ReportStats.buildProgramme({ client: d.client, auditPlan: d.auditPlan, report: d.report, allReports: (window.state && window.state.auditReports) || [] })
            : { stages: [], anchored: 'audit-date-fallback', issues: ['Certification programme module unavailable.'], anchorDate: null, nextAudit: null };
        const pvProgrammeStages = pvProgramme.stages.map((s) => Object.assign({}, s, { editId: EDIT_ID_BY_STAGE[s.id] || ('rp-prog-' + s.id) }));
        const programmeAnchorCaption = (programme) => {
            const dt = programme.anchorDate ? new Date(programme.anchorDate) : null;
            const fmtDate = dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString('en-GB') : '';
            if (programme.anchored === 'certificate') return 'anchored on the initial certification date of ' + fmtDate;
            if (programme.anchored === 'history') return 'based on recorded audit history' + (fmtDate ? ' (earliest record ' + fmtDate + ')' : '');
            return 'prior stage dates unavailable — no certificate on file';
        };
        window._programmeAnchorCaption = programmeAnchorCaption;

        // ─── Multi-site sampling — preview data ────────────────────────────
        const pvAllSites = (d.client && Array.isArray(d.client.sites)) ? d.client.sites : [];
        const pvIsMultiSite = pvAllSites.length > 1;
        const pvMatchingCert = pvIsMultiSite ? (d.client.certificates || []).find(c => (c.standard || '').toLowerCase() === pvStandard.toLowerCase()) : null;
        const pvSiteScopes = (pvMatchingCert && pvMatchingCert.siteScopes) ? pvMatchingCert.siteScopes : {};
        const pvSampledSiteNames = (function () {
            const sel = d.auditPlan?.selectedSites;
            if (Array.isArray(sel) && sel.length > 0) return sel.map(s => (typeof s === 'object' ? s.name : s));
            return pvAllSites.length ? [pvAllSites[0].name] : [];
        })();

        // Sidebar row (replaces the old pill cloud): the row itself navigates —
        // clicking it scrolls the preview to that section — while the leading
        // checkbox is the include/exclude toggle (innermost data-action wins in
        // the event delegator, so the two don't fight). Row id stays 'pill-<id>'
        // because toggleReportSection targets it.
        const pill = (s) => `<div class="rp-side-item ${s.hide ? '' : 'active'}" id="pill-${s.id}" style="--sec-color:${s.color};" data-action="scrollToReportSection" data-arg1="${s.id}" title="Jump to ${s.label}">`
            + `<input type="checkbox" ${s.hide ? '' : 'checked'} data-action="toggleReportSection" data-arg1="${s.id}" data-arg2="${s.color}" aria-label="Include ${s.label}" title="Include / exclude ${s.label}">`
            + `<i class="fa-solid ${s.icon}"></i><span>${s.label}</span></div>`;

        // Helper: render all evidence images for a checklist item (preview mode)
        const renderEvThumbs = (item) => {
            const imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
            if (!imgs.length) return '';
            return `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${imgs.map(url => `<img src="${url}" data-ev-thumb="1" style="height:50px;border-radius:4px;border:1px solid #e2e8f0;cursor:pointer;" data-action="open" data-arg1="${url}" data-arg2="_blank">`).join('')}</div>`;
        };

        const ncRows = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() !== 'observation' && (i.ncrType || '').toLowerCase() !== 'ofi').map((item, idx) => {
            const clause = displayCriterion(item);
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            const sevRaw = (item.ncrType || '').toLowerCase();
            // Blank/unrecognized ncrType on an NC item = pending classification, not silently "Minor".
            const sev = sevRaw === 'major' ? 'Major' : sevRaw === 'minor' ? 'Minor' : 'Minor †';
            const sevStyle = sevRaw === 'major' ? 'background:#fee2e2;color:#991b1b' : 'background:#fef3c7;color:#92400e';
            // Key must match report-findings-ops.js buildFindingLifecycleSection exactly:
            // raw item.clause (not the kbMatch-resolved display clause) + department.
            const fsKey = String(item.clause || '') + '|' + String(item.department || '');
            const fsCurrent = (d.report.findingStatus && d.report.findingStatus[fsKey] && d.report.findingStatus[fsKey].status) || 'open';
            const fsSelect = `<select data-action-change="updateFindingStatus" data-arg1="${window.UTILS.escapeHtml(fsKey)}" data-arg2="this.value" style="width:100%;padding:5px 6px;border-radius:6px;border:1px solid #cbd5e1;font-size:0.78rem;background:white;">${FINDING_STATUS_OPTIONS.map(o => `<option value="${o.value}" ${o.value === fsCurrent ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
            return `<tr style="background:${idx % 2 ? '#f8fafc' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;${sevStyle};">${sev}</span></td><td style="padding:10px 14px;color:#334155;">${fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>'}${renderEvThumbs(item)}</td><td style="padding:10px 14px;">${fsSelect}</td></tr>`;
        }).join('');
        const ncPendingFootnote = d.hydratedProgress.some(i => i.status === 'nc' && !i.ncrType) ? '<div style="margin-top:6px;font-size:0.75rem;color:#94a3b8;">† Pending classification — recorded as NC but severity not yet assigned; shown under Minor pending review.</div>' : '';

        // OBS rows (Observations only)
        const obsOnlyRows = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() === 'observation').map((item, idx) => {
            const clause = displayCriterion(item);
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return `<tr style="background:${idx % 2 ? '#f5f3ff' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#ede9fe;color:#6d28d9;">OBS</span></td><td style="padding:10px 14px;color:#334155;">${fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>'}${renderEvThumbs(item)}</td></tr>`;
        }).join('');

        // OFI rows (Opportunities for Improvement only)
        const ofiOnlyRows = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() === 'ofi').map((item, idx) => {
            const clause = displayCriterion(item);
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return `<tr style="background:${idx % 2 ? '#f0fbff' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#e0f7fa;color:#0891b2;">OFI</span></td><td style="padding:10px 14px;color:#334155;">${fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>'}${renderEvThumbs(item)}</td></tr>`;
        }).join('');

        // Conformance rows (items with comments or evidence)
        const conformRows = d.hydratedProgress.filter(i => i.status === 'conform').map((item, idx) => {
            const clause = displayCriterion(item, false);
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return `<tr style="background:${idx % 2 ? '#f0fdf4' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#dcfce7;color:#166534;"><i class="fa-solid fa-check" style="margin-right:4px;"></i>Conform</span></td><td style="padding:10px 14px;color:#334155;">${fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>'}${renderEvThumbs(item)}</td></tr>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.id = 'report-preview-overlay';
        overlay.innerHTML = `
        <style>
            #report-preview-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:rgba(15,23,42,0.7);display:flex;justify-content:center;padding:16px;backdrop-filter:blur(4px);}
            .rp-modal{background:#f8fafc;border-radius:16px;width:100%;max-width:1280px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.3);}
            .rp-header{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:20px 28px;}
            .rp-body{display:flex;flex:1;min-height:0;}
            .rp-sidebar{width:272px;flex-shrink:0;background:white;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;min-height:0;}
            .rp-side-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px 8px;font-size:0.72rem;font-weight:700;color:#64748b;letter-spacing:0.06em;}
            .rp-side-head button{border:none;background:none;color:#2563eb;font-size:0.72rem;font-weight:600;cursor:pointer;padding:2px 4px;}
            .rp-side-count{background:#eff6ff;color:#1d4ed8;border-radius:10px;padding:1px 8px;margin-left:6px;font-size:0.7rem;}
            .rp-side-list{flex:1;overflow-y:auto;overflow-x:hidden;padding:0 8px 8px;}
            .rp-side-item{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:8px;font-size:0.82rem;font-weight:600;color:#334155;cursor:pointer;user-select:none;border-left:3px solid transparent;margin-bottom:1px;}
            .rp-side-item:hover{background:#f1f5f9;}
            .rp-side-item i.fa-solid{width:16px;text-align:center;color:#94a3b8;font-size:0.8rem;flex-shrink:0;}
            .rp-side-item span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            /* styles.css globals style EVERY input as a full-width padded form
               field (width:100%;padding:.625rem;border;margin-bottom:1rem) and
               every label as display:block — which turned these checkboxes into
               giant rounded boxes and shoved the row labels out of the sidebar.
               Reset explicitly; specificity (.rp-sidebar input[...]) beats the
               bare element selectors. */
            .rp-sidebar input[type=checkbox]{width:15px;height:15px;flex:0 0 auto;padding:0;margin:0;border:none;border-radius:3px;background:none;box-shadow:none;accent-color:var(--sec-color,#2563eb);cursor:pointer;}
            .rp-sidebar label{margin-bottom:0;font-size:0.78rem;}
            .rp-side-item.active{border-left-color:var(--sec-color,#2563eb);}
            .rp-side-item.active i.fa-solid{color:var(--sec-color,#2563eb);}
            .rp-side-item:not(.active){color:#94a3b8;}
            .rp-side-item:not(.active) span{text-decoration:line-through;text-decoration-color:#cbd5e1;}
            .rp-side-parts{border-top:1px solid #e2e8f0;padding:10px 14px 12px;background:#f8fafc;}
            .rp-side-parts-title{font-size:0.68rem;font-weight:700;color:#64748b;letter-spacing:0.06em;margin-bottom:7px;}
            .rp-side-parts label{display:flex;align-items:center;gap:7px;font-size:0.78rem;color:#334155;padding:3px 0;cursor:pointer;}
            @media(max-width:900px){.rp-sidebar{display:none;}}
            .rp-content{flex:1;overflow-y:auto;padding:16px 28px;min-width:0;}
            .rp-sec{background:white;border-radius:10px;margin-bottom:14px;border:1px solid #e2e8f0;overflow:hidden;}
            .rp-sec-hdr{display:flex;align-items:center;padding:11px 16px;cursor:pointer;gap:10px;font-weight:600;color:white;font-size:0.92rem;}
            .rp-sec-body{padding:14px 16px;border-top:1px solid #e2e8f0;}
            .rp-sec-body.collapsed{display:none;}
            .rp-footer{padding:14px 28px;background:white;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;}
            .rp-edit{min-height:60px;line-height:1.7;color:#334155;outline:none;padding:8px;border:1px dashed transparent;border-radius:6px;cursor:text;}
            .rp-edit:hover{border-color:#cbd5e1;background:#f8fafc;}
            .rp-edit:focus{border-color:#2563eb;background:#f8fafc;}
        </style>
        <div class="rp-modal">
            ${window._isModifiedSinceIssue(d) ? `<div style="background:#dc2626;color:white;text-align:center;padding:10px 16px;font-weight:700;font-size:0.85rem;letter-spacing:0.3px;">&#9888; MODIFIED SINCE ISSUE — this final report has changed since it was last issued (v${d.report.issuedSnapshot && d.report.issuedSnapshot.version}). Re-issue via Finalize &amp; Publish before distributing.</div>` : ''}
            <div class="rp-header">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h2 style="margin:0 0 4px;font-size:1.25rem;"><i class="fa-solid fa-file-pdf" style="margin-right:8px;"></i>Report Preview & Edit</h2>
                        <div style="opacity:0.8;font-size:0.88rem;">${d.report.client} — ${d.report.standard || 'ISO Standard'}</div>
                    </div>
                    <button data-action="removeElement" data-id="report-preview-overlay" style="background:rgba(255,255,255,0.15);border:none;color:white;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1rem;" aria-label="Close"><i class="fa-solid fa-times"></i></button>
                </div>
            </div>
            <div class="rp-body">
            <div class="rp-sidebar">
                <div class="rp-side-head">
                    <span>SECTIONS<span class="rp-side-count">${sections.length}</span></span>
                    <span>
                        <button type="button" data-action="expandAllSections" title="Expand all sections">Expand All</button>
                        <button type="button" data-action="collapseAllSections" title="Collapse all sections">Collapse All</button>
                    </span>
                </div>
                <div class="rp-side-list">
                    ${sections.map(s => pill(s)).join('')}
                </div>
                <div class="rp-side-parts">
                    <div class="rp-side-parts-title">REPORT PARTS</div>
                    <label style="font-weight:600;color:#0f172a;"><input type="checkbox" checked disabled> Formal Certification Report</label>
                    <label><input type="checkbox" id="annex-toggle-analytics" ${_annexToggles.analytics ? 'checked' : ''} data-action="toggleReportAnnex" data-arg1="analytics"> Management Analytics Annex</label>
                    <label><input type="checkbox" id="annex-toggle-evidence" ${_annexToggles.evidence ? 'checked' : ''} data-action="toggleReportAnnex" data-arg1="evidence"> Evidence Annex</label>
                    <label><input type="checkbox" id="annex-toggle-capa" ${_annexToggles.capa ? 'checked' : ''} data-action="toggleReportAnnex" data-arg1="capa"> CAPA Annex</label>
                </div>
            </div>
            <div class="rp-content">
                <!-- COVER PAGE -->
                <div style="background:white;border-radius:12px;padding:3rem 2.5rem;margin-bottom:2rem;position:relative;min-height:600px;border:2px solid #e2e8f0;">
                    <!-- CB Branding Header -->
                    <div style="text-align:center;margin-bottom:3rem;">
                        ${d.cbLogo ? `
                        <img src="${d.cbLogo}" alt="CB Logo" style="height:80px;object-fit:contain;margin-bottom:1rem;">
                        ` : `
                        <div style="width:80px;height:80px;margin:0 auto 1rem;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(37,99,235,0.3);">
                            <i class="fa-solid fa-certificate" style="color:white;font-size:2.5rem;"></i>
                        </div>
                        `}
                        <h1 style="margin:0 0 0.5rem;font-size:1.8rem;color:#1e293b;font-weight:700;">${d.cbName || 'ISOXPERT Audit360'}</h1>
                        <div style="font-size:0.95rem;color:#64748b;font-weight:500;">ISO Certification Body</div>
                        <div style="width:60px;height:3px;background:linear-gradient(90deg,#2563eb,#7c3aed);margin:1.5rem auto;border-radius:2px;"></div>
                    </div>
                    
                    <!-- Report Title -->
                    <div style="text-align:center;margin-bottom:3rem;">
                        <div style="font-size:0.85rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:0.75rem;">Audit Report</div>
                        <h2 style="margin:0 0 1rem;font-size:2rem;color:#0f172a;font-weight:800;line-height:1.3;">${d.report.client}</h2>
                        <div style="display:inline-block;padding:8px 20px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:2px solid #3b82f6;border-radius:25px;color:#1d4ed8;font-weight:700;font-size:1rem;">
                            ${d.report.standard || 'ISO Standard'}
                        </div>
                    </div>
                    
                    <!-- Client Logo -->
                    <div style="text-align:center;margin:2rem 0;">
                        ${d.clientLogo ? `
                        <img src="${d.clientLogo}" alt="Client Logo" style="height:100px;object-fit:contain;">
                        ` : `
                        <div style="width:120px;height:120px;margin:0 auto;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.5rem;">
                            <i class="fa-solid fa-building" style="font-size:2rem;color:#94a3b8;"></i>
                            <div style="font-size:0.7rem;color:#94a3b8;font-weight:600;">Client Logo</div>
                        </div>
                        `}
                    </div>
                    
                    <!-- Audit Details Grid -->
                    <div style="margin:3rem 0;background:#f8fafc;padding:2rem;border-radius:12px;border-left:4px solid #2563eb;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Type</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;">${d.auditPlan?.type || 'Certification Audit'}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Date</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;">${d.report.date || '—'}${d.report.endDate ? ' — ' + d.report.endDate : ''}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Lead Auditor</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;">${d.report.leadAuditor || '—'}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Report ID</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;font-family:monospace;">${reportRef(d)}</div>
                            </div>
                            ${d.auditPlan?.team && d.auditPlan.team.length > 1 ? `
                            <div style="grid-column:span 2;">
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Team</div>
                                <div style="font-size:0.95rem;color:#1e293b;font-weight:600;">${d.auditPlan.team.join(', ')}</div>
                            </div>` : ''}
                            ${d.auditPlan?.scope ? `
                            <div style="grid-column:span 2;">
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Scope</div>
                                <div style="font-size:0.9rem;color:#334155;line-height:1.5;">${typeof d.auditPlan.scope === 'string' ? d.auditPlan.scope : (d.client?.goodsServices || []).map(g => g.name).join(', ') || 'As per certification scope'}</div>
                            </div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Document Control Footer — normal flow, NOT absolutely
                         positioned: pinned to bottom:2rem it painted straight
                         over the audit-details grid / revision table whenever
                         the cover content grew past min-height. -->
                    <div style="margin-top:2.5rem;border-top:2px solid #e2e8f0;padding-top:1.5rem;">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;font-size:0.8rem;color:#64748b;">
                            <div>
                                <strong style="color:#1e293b;">Document ID:</strong> ${reportRef(d)}
                            </div>
                            <div style="text-align:center;">
                                <strong style="color:#1e293b;">Status:</strong> ${d.report.recommendation || 'Draft'}
                            </div>
                            <div style="text-align:right;">
                                <strong style="color:#1e293b;">Classification:</strong> Confidential
                            </div>
                        </div>
                        ${window._hasActualRevisionHistory(d.report) ? `
                        <div style="margin-top:1rem;">
                            <div style="font-size:0.75rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;">Document Revision History</div>
                            <table style="width:100%;font-size:0.75rem;border-collapse:collapse;">
                                <thead><tr style="background:#f1f5f9;"><th style="padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Ver</th><th style="padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Date</th><th style="padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Author</th><th style="padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Description</th></tr></thead>
                                <tbody>
                                    ${window._getRevisionRows(d.report, d.today).map(r => `<tr><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;">${r.ver}</td><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;">${r.date}</td><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;">${r.author}</td><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;">${r.desc}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>` : ''}
                        <div style="margin-top:0.75rem;padding:0.75rem;background:#fef3c7;border-radius:6px;text-align:center;font-size:0.75rem;color:#92400e;">
                            <i class="fa-solid fa-lock" style="margin-right:0.25rem;"></i>
                            <strong>Confidential Document</strong> — For authorized use only. This report is the property of ${d.cbName || 'the Certification Body'}.
                        </div>
                    </div>
                </div>
                
                <!-- Report Sections -->
                <!-- 1: Audit Info -->
                <div class="rp-sec" id="sec-audit-info">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">1</span>AUDIT INFORMATION<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <table style="width:100%;font-size:0.86rem;border-collapse:collapse;">
                            <tr><td style="padding:7px 12px;width:35%;color:#64748b;font-weight:600;">Client</td><td style="padding:7px 12px;">${d.report.client}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Industry</td><td style="padding:7px 12px;">${d.client.industry || '—'}</td></tr>
                            <tr><td style="padding:7px 12px;color:#64748b;font-weight:600;">Certification Scope</td><td style="padding:7px 12px;">${d.client.certificationScope || '—'}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Standard</td><td style="padding:7px 12px;">${d.report.standard || d.auditPlan?.standard || '—'}</td></tr>
                            <tr><td style="padding:7px 12px;color:#64748b;font-weight:600;">Audit Type</td><td style="padding:7px 12px;">${d.auditPlan?.auditType || 'Initial'}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Dates</td><td style="padding:7px 12px;">${d.report.date || '—'} ${d.report.endDate ? '→ ' + d.report.endDate : ''}</td></tr>
                            <tr><td style="padding:7px 12px;color:#64748b;font-weight:600;">Lead Auditor</td><td style="padding:7px 12px;">${d.report.leadAuditor || '—'}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Location</td><td style="padding:7px 12px;">${(function () { var s = (d.client.sites && d.client.sites[0]) || {}; return [d.client.address || s.address, d.client.city || s.city, d.client.province, d.client.country || s.country].filter(Boolean).join(', ') || '—'; })()}</td></tr>
                ${(() => {
                const locAddr = [d.client.address, d.client.city, d.client.province, d.client.country].filter(Boolean).join(', ');
                const addrFallback = locAddr ? `<div style="padding:16px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;text-align:center;"><i class="fa-solid fa-map-location-dot" style="font-size:1.5rem;color:#64748b;margin-bottom:6px;display:block;"></i><div style="color:#334155;font-size:0.9rem;font-weight:600;">${locAddr}</div></div>` : '';
                if (d.client.latitude && d.client.longitude) {
                    return `<tr><td colspan="2" style="padding:8px 12px;"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${(parseFloat(d.client.longitude) - 0.015).toFixed(4)},${(parseFloat(d.client.latitude) - 0.008).toFixed(4)},${(parseFloat(d.client.longitude) + 0.015).toFixed(4)},${(parseFloat(d.client.latitude) + 0.008).toFixed(4)}&layer=mapnik&marker=${d.client.latitude},${d.client.longitude}" style="width:100%;height:140px;border:none;border-radius:8px;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"></iframe><div style="display:none;">${addrFallback}</div></td></tr>`;
                }
                if (locAddr) {
                    return `<tr><td colspan="2" style="padding:8px 12px;">${addrFallback}</td></tr>`;
                }
                return '';
            })()}
                        </table>
                    </div>
                </div>
                <!-- Audit Programme -->
                <div class="rp-sec" id="sec-audit-programme">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;"><i class="fa-solid fa-calendar-days"></i></span>AUDIT PROGRAMME<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;" title="Click to edit"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="font-size:0.82rem;color:#64748b;margin-bottom:0.75rem;">3-year certification cycle, ${programmeAnchorCaption(pvProgramme)}.</div>
                        ${pvProgramme.issues && pvProgramme.issues.length ? `<div style="font-size:0.78rem;color:#92400e;background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 10px;margin-bottom:0.75rem;border-radius:4px;">${pvProgramme.issues.map(i => window.UTILS.escapeHtml(i)).join('<br>')}</div>` : ''}
                        <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
                            <thead><tr style="background:#f0f9ff;"><th style="padding:7px 12px;text-align:left;">Audit Stage</th><th style="padding:7px 12px;text-align:left;">Planned Timing</th><th style="padding:7px 12px;text-align:left;">Focus & Scope</th><th style="padding:7px 12px;text-align:center;">Status</th></tr></thead>
                            <tbody>
                            ${pvProgrammeStages.map(s => {
        const statusBg = s.status === 'Completed' ? '#dcfce7' : (s.status === 'This audit' ? '#dbeafe' : ((s.status === 'Unknown' || s.status === 'Requires scheduling') ? '#fef3c7' : '#f1f5f9'));
        const statusFg = s.status === 'Completed' ? '#166534' : (s.status === 'This audit' ? '#1d4ed8' : ((s.status === 'Unknown' || s.status === 'Requires scheduling') ? '#92400e' : '#64748b'));
        return `<tr style="border-top:1px solid #f1f5f9;"><td style="padding:7px 12px;font-weight:600;">${s.label}</td><td style="padding:7px 12px;">${s.timing}</td><td style="padding:7px 12px;"><div id="${s.editId}" class="rp-edit" contenteditable="true">${s.def}</div></td><td style="padding:7px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:${statusBg};color:${statusFg};">${s.status}</span></td></tr>`;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ${pvIsMultiSite ? `
                <!-- Multi-Site Sampling -->
                <div class="rp-sec" id="sec-multi-site">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#16a34a,#15803d);" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;"><i class="fa-solid fa-map-location-dot"></i></span>MULTI-SITE SAMPLING<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;" title="Click to edit"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
                            <thead><tr style="background:#f0fdf4;"><th style="padding:7px 12px;text-align:left;">Site</th><th style="padding:7px 12px;text-align:left;">Address</th><th style="padding:7px 12px;text-align:left;">Scope at Site</th><th style="padding:7px 12px;text-align:center;">Sampled This Audit</th></tr></thead>
                            <tbody>
                            ${pvAllSites.map(s => {
        const addr = [s.address, s.city, s.country].filter(Boolean).join(', ') || '—';
        const scope = pvSiteScopes[s.name] || d.client.certificationScope || '—';
        const sampled = pvSampledSiteNames.indexOf(s.name) !== -1;
        return `<tr style="border-top:1px solid #f1f5f9;"><td style="padding:7px 12px;font-weight:600;">${s.name}</td><td style="padding:7px 12px;">${addr}</td><td style="padding:7px 12px;">${scope}</td><td style="padding:7px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;${sampled ? 'background:#dcfce7;color:#166534;' : 'background:#f1f5f9;color:#64748b;'}">${sampled ? 'Yes' : 'No'}</span></td></tr>`;
    }).join('')}
                            </tbody>
                        </table>
                        <div id="rp-site-sampling-note" class="rp-edit" contenteditable="true" style="margin-top:0.75rem;">Site sampling conducted in accordance with IAF MD 1.</div>
                    </div>
                </div>` : ''}
                <!-- Objectives, Criteria & Methodology (from Plan) -->
                <div class="rp-sec" id="sec-objectives">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#0891b2,#0e7490);" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">2</span>AUDIT OBJECTIVES, CRITERIA & METHODOLOGY<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;" title="Click to edit"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5rem;">
                            <div>
                                <h4 style="margin:0 0 0.75rem;font-size:0.9rem;color:#0891b2;"><i class="fa-solid fa-bullseye" style="margin-right:0.4rem;"></i>Audit Objectives</h4>
                                <div id="rp-objectives" class="rp-edit" contenteditable="true" style="white-space:pre-line;line-height:1.7;font-size:0.88rem;">${d.auditPlan?.auditObjectives || '• Determine conformity of the management system with audit criteria\n• Evaluate the ability of the management system to ensure compliance with statutory, regulatory and contractual requirements\n• Evaluate the effectiveness of the management system in meeting its specified objectives\n• Identify areas for potential improvement of the management system'}</div>
                            </div>
                            <div>
                                <h4 style="margin:0 0 0.75rem;font-size:0.9rem;color:#6366f1;"><i class="fa-solid fa-scale-balanced" style="margin-right:0.4rem;"></i>Audit Criteria</h4>
                                <div id="rp-criteria" class="rp-edit" contenteditable="true" style="white-space:pre-line;line-height:1.7;font-size:0.88rem;">${d.auditPlan?.auditCriteria || '• ' + (d.report.standard || 'Applicable ISO standard(s)') + '\n• Organization management system documentation\n• Applicable legal and regulatory requirements\n• Previous audit findings and corrective action records'}</div>
                            </div>
                            <div>
                                <h4 style="margin:0 0 0.75rem;font-size:0.9rem;color:#0d9488;"><i class="fa-solid fa-microscope" style="margin-right:0.4rem;"></i>Audit Methodology</h4>
                                <div id="rp-methodology" class="rp-edit" contenteditable="true" style="white-space:pre-line;line-height:1.7;font-size:0.88rem;">${d.auditPlan?.auditMethodology || methodologyDefaultText(d.auditPlan) || '• Risk-based sampling of processes, records, and documentation\n• Interviews with management and operational personnel at all levels\n• Observation of activities and work environment on-site\n• Review of documented information and objective evidence\n• Verification of corrective actions from previous audits'}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- 2: Exec Summary -->
                <div class="rp-sec" id="sec-summary">
                    <div class="rp-sec-hdr" style="border-left-color:#059669;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">2</span>EXECUTIVE SUMMARY<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;" title="Click to edit"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div id="rp-exec-summary" class="rp-edit" contenteditable="true">${(function () {
                            // AI-drafted summaries arrive as one long block; print splits
                            // them into 2-3 sentence paragraphs, so the editable preview
                            // should read the same way — seed it with <p> breaks (innerHTML
                            // is re-read on export and formatRichText strips markup first).
                            const raw = d.report.executiveSummary || '';
                            if (!raw) return '<em style="color:#94a3b8;">Click to add executive summary...</em>';
                            if (/<p[\s>]/i.test(raw) || raw.indexOf('\n') !== -1 || raw.length < 300) return raw;
                            const sentences = raw.split(/(?<=[.!?])\s+/);
                            if (sentences.length <= 3) return raw;
                            const paras = []; let cur = [];
                            for (let i = 0; i < sentences.length; i++) {
                                cur.push(sentences[i]);
                                if (cur.length >= 2 && (cur.length >= 3 || (i < sentences.length - 1 && /^(The |While |Overall|In |During |Furthermore|Additionally|Moreover|However|Based |Addressing|This )/.test(sentences[i + 1])))) {
                                    paras.push(cur.join(' ')); cur = [];
                                }
                            }
                            if (cur.length) paras.push(cur.join(' '));
                            return paras.map(p => '<p style="margin:0 0 10px 0;">' + p + '</p>').join('');
                        })()}</div>
                        
                        <!-- AI-Visual Insights Section -->
                        ${(d.report.positiveObservations || d.report.ofi) ? `
                        <div style="margin-top:2rem;padding:1.5rem;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:12px;border:2px solid #0ea5e9;">
                            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
                                <div style="width:48px;height:48px;background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:12px;display:flex;align-items:center;justify-content:center;">
                                    <i class="fa-solid fa-brain" style="color:white;font-size:1.5rem;"></i>
                                </div>
                                <div>
                                    <h3 style="margin:0;color:#075985;font-size:1.1rem;">AI-Powered Audit Insights</h3>
                                    <div style="color:#0c4a6e;font-size:0.85rem;opacity:0.8;">Analysis for ${d.report.client} — ${d.report.standard || 'ISO Audit'}</div>
                                </div>
                            </div>
                            
                            <!-- Risk & Compliance Dashboard -->
                            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;">
                                <!-- Overall Risk Score -->
                                <div style="text-align:center;padding:1rem;background:white;border-radius:10px;border-left:4px solid ${_riskColor};">
                                    <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Risk Level</div>
                                    <div style="font-size:1.8rem;font-weight:800;color:${_riskColor};">
                                        ${_riskLevel}
                                    </div>
                                    <div style="font-size:0.7rem;color:#94a3b8;margin-top:0.25rem;">${d.stats.ncCount} NC Found</div>
                                </div>
                                
                                <!-- Audit Status -->
                                <div style="text-align:center;padding:1rem;background:white;border-radius:10px;border-left:4px solid ${d.stats.statusColor};">
                                    <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Status</div>
                                    <div style="font-size:1rem;font-weight:700;color:${d.stats.statusColor};line-height:1.3;padding:0.25rem 0;">
                                        ${d.stats.auditStatus}
                                    </div>
                                    <div style="font-size:0.7rem;color:#94a3b8;margin-top:0.25rem;">per ISO 17021-1</div>
                                </div>
                                
                                <!-- Coverage, not Conformity — Conformity % is reserved for the Analytics
                                     Dashboard annex (see PDF export), so this exec-summary tile only ever
                                     shows Coverage, which is fine in a formal context as long as it always
                                     carries its one-line definition (release item 3 support). -->
                                <div style="text-align:center;padding:1rem;background:white;border-radius:10px;border-left:4px solid #8b5cf6;">
                                    <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Coverage</div>
                                    <div style="font-size:1.8rem;font-weight:800;color:#8b5cf6;">
                                        ${d.stats.coveragePct === null || d.stats.coveragePct === undefined ? '—' : d.stats.coveragePct + '%'}
                                    </div>
                                    <div style="font-size:0.7rem;color:#94a3b8;margin-top:0.25rem;">items assessed ÷ applicable items, excl. N/A</div>
                                </div>
                            </div>
                            
                            <!-- Positive Observations (Icon Cards) -->
                            ${d.report.positiveObservations ? `
                            <div style="background:white;padding:1.25rem;border-radius:10px;margin-bottom:1rem;border-left:4px solid #10b981;">
                                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                                    <i class="fa-solid fa-circle-check" style="color:#10b981;font-size:1.25rem;"></i>
                                    <h4 style="margin:0;color:#166534;font-size:1rem;">Strengths Identified</h4>
                                </div>
                                <div id="rp-positive-obs" class="rp-edit" contenteditable="true" style="color:#15803d;font-size:0.9rem;line-height:1.7;">
                                    ${(function () {
                        let t = d.report.positiveObservations;
                        let items;
                        if (t.includes('\n')) {
                            items = t.split(/\n+/).map(s => s.replace(/^\s*\d+[-.)]\s*/, '').trim()).filter(Boolean);
                        } else {
                            // Flat text: split on sequential "N. " at sentence boundaries
                            let parts = t.match(/(?:^|(?<=\.\s))\d+\.\s[\s\S]*?(?=(?:\.\s)\d+\.\s|$)/g);
                            if (parts && parts.length > 1) {
                                items = parts.map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
                            } else {
                                items = [t.replace(/^\s*\d+\.\s*/, '').trim()];
                            }
                        }
                        return items.map((obs, idx) => `
                                        <div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;align-items:start;">
                                            <div style="min-width:32px;height:32px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem;">${idx + 1}</div>
                                            <div style="flex:1;padding-top:0.25rem;">${obs}</div>
                                        </div>
                                        `).join('');
                    })()}
                                </div>
                            </div>
                            ` : ''}
                            
                            <!-- Opportunities for Improvement (Icon Cards) -->
                            ${d.report.ofi ? `
                            <div style="background:white;padding:1.25rem;border-radius:10px;border-left:4px solid #f59e0b;">
                                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                                    <i class="fa-solid fa-lightbulb" style="color:#f59e0b;font-size:1.25rem;"></i>
                                    <h4 style="margin:0;color:#854d0e;font-size:1rem;">Improvement Opportunities</h4>
                                </div>
                                <div id="rp-ofi" class="rp-edit" contenteditable="true" style="color:#92400e;font-size:0.9rem;line-height:1.7;">
                                    ${(function () {
                        let t = d.report.ofi;
                        let items;
                        if (Array.isArray(t)) {
                            items = t;
                        } else if (t.includes('\n')) {
                            items = t.split(/\n+/).map(s => s.replace(/^\s*\d+[-.)]\s*/, '').trim()).filter(Boolean);
                        } else {
                            let parts = t.match(/(?:^|(?<=\.\s))\d+\.\s[\s\S]*?(?=(?:\.\s)\d+\.\s|$)/g);
                            if (parts && parts.length > 1) {
                                items = parts.map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
                            } else {
                                items = [t.replace(/^\s*\d+\.\s*/, '').trim()];
                            }
                        }
                        return items.map((ofi, _idx) => `
                                        <div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;align-items:start;">
                                            <div style="min-width:32px;height:32px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem;">
                                                <i class="fa-solid fa-arrow-up" style="font-size:0.75rem;"></i>
                                            </div>
                                            <div style="flex:1;padding-top:0.25rem;">${typeof ofi === 'string' ? ofi : ofi}</div>
                                        </div>
                                        `).join('');
                    })()}
                                </div>
                            </div>
                            ` : ''}
                            
                            <!-- AI Confidence Footer -->
                            <div style="margin-top:1rem;padding:0.75rem;background:rgba(255,255,255,0.6);border-radius:8px;text-align:center;">
                                <div style="font-size:0.75rem;color:#64748b;">
                                    <i class="fa-solid fa-robot" style="margin-right:0.25rem;"></i>
                                    AI-Powered Analysis • Client Context: ${d.report.client} • Standard: ${d.report.standard || 'ISO'}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <!-- 3: Analytics & Insights -->
                <div class="rp-sec" id="sec-charts">
                    <div class="rp-sec-hdr" style="border-left-color:#7c3aed;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">3</span>ANALYTICS & INSIGHTS<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <!-- KPI Metrics Dashboard -->
                        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:2rem;">
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,${d.stats.statusColor},${d.stats.statusColor});border-radius:10px;color:white;">
                                <div style="font-size:0.95rem;font-weight:700;line-height:1.25;padding:4px 0;">${d.stats.auditStatus}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">AUDIT STATUS</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.majorNC}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">MAJOR NC</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.minorNC}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">MINOR NC</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.observationCount}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">OBSERVATIONS</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#06b6d4,#0891b2);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.ofiCount}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">OFI</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#64748b,#475569);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.totalItems}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">TOTAL CHECKS</div>
                            </div>
                        </div>
                        
                        <!-- Charts Grid -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;">Compliance Distribution</h4>
                                <canvas id="compliance-pie-chart" style="max-height:250px;"></canvas>
                            </div>
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;">Severity Breakdown</h4>
                                <canvas id="severity-bar-chart" style="max-height:250px;"></canvas>
                            </div>
                        </div>
                        
                        <!-- Findings by Main Clause Chart -->
                        <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                            <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;">Findings by ISO Clause (Main Clauses)</h4>
                            <canvas id="clause-findings-chart" style="max-height:300px;"></canvas>
                        </div>
                        
                        <!-- Department-based Analysis Chart -->
                        <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;margin-top:1.5rem;">
                            <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;"><i class="fa-solid fa-building" style="margin-right:0.5rem;color:#6366f1;"></i>Findings by Department</h4>
                            <canvas id="dept-findings-chart" style="max-height:300px;"></canvas>
                        </div>
                        
                        <!-- Personnel Workload & Department Compliance Charts -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.5rem;">
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;"><i class="fa-solid fa-user-tie" style="margin-right:0.5rem;color:#ea580c;"></i>Personnel Workload</h4>
                                <canvas id="personnel-workload-chart" style="max-height:250px;"></canvas>
                            </div>
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;"><i class="fa-solid fa-chart-radar" style="margin-right:0.5rem;color:#0891b2;"></i>Compliance by Department</h4>
                                <canvas id="dept-compliance-radar" style="max-height:250px;"></canvas>
                            </div>
                        </div>
                        
                        <!-- Department Summary Table -->
                        <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;margin-top:1.5rem;">
                            <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;"><i class="fa-solid fa-table-cells" style="margin-right:0.5rem;color:#7c3aed;"></i>Department Summary</h4>
                            <table style="width:100%;font-size:0.82rem;border-collapse:collapse;">
                                <thead><tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Department</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Personnel</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Items</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Conform</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">NC</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Status</th></tr></thead>
                                <tbody>${(() => {
                const deptMap = {};
                d.hydratedProgress.forEach(i => {
                    const dept = i.department || 'Unassigned';
                    if (!deptMap[dept]) deptMap[dept] = { personnel: new Set(), items: 0, conform: 0, nc: 0 };
                    if (i.personnel) deptMap[dept].personnel.add(i.personnel);
                    deptMap[dept].items++;
                    if (i.status === 'conform') deptMap[dept].conform++;
                    else if (i.status === 'nc') {
                        // Only count Major/Minor as NCs; observations/OFI are separate
                        const t = (i.ncrType || '').toLowerCase();
                        if (t === 'major' || t === 'minor') deptMap[dept].nc++;
                    }
                });
                // Filter out Unassigned if it has no items, otherwise relabel
                if (deptMap['Unassigned'] && deptMap['Unassigned'].items === 0) delete deptMap['Unassigned'];
                return Object.entries(deptMap).sort((a, b) => a[0].localeCompare(b[0])).map(([dept, data]) => {
                    const statusTxt = data.nc === 0 ? 'Satisfactory' : 'Minor Issues';
                    const statusColor = data.nc === 0 ? '#16a34a' : '#d97706';
                    return '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:500;">' + dept + '</td><td style="padding:8px 12px;text-align:center;">' + data.personnel.size + '</td><td style="padding:8px 12px;text-align:center;">' + data.items + '</td><td style="padding:8px 12px;text-align:center;color:#16a34a;font-weight:600;">' + data.conform + '</td><td style="padding:8px 12px;text-align:center;color:#dc2626;font-weight:600;">' + data.nc + '</td><td style="padding:8px 12px;text-align:center;white-space:nowrap;"><span style="display:inline-block;padding:3px 12px;border-radius:20px;font-weight:700;font-size:0.75rem;background:' + statusColor + '15;color:' + statusColor + ';white-space:nowrap;">' + statusTxt + '</span></td></tr>';
                }).join('');
            })()}</tbody>
                            </table>
                        </div>
                        
                        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
                        <script>
                        (function() {
                            // Wait for Chart.js to load
                            setTimeout(() => {
                                if (typeof Chart === 'undefined') {
                                    console.error('Chart.js failed to load');
                                    return;
                                }
                                
                                // 1. Compliance Pie Chart — 5 slices
                                const pieCtx = document.getElementById('compliance-pie-chart');
                                if (pieCtx) {
                                    new Chart(pieCtx.getContext('2d'), {
                                        type: 'doughnut',
                                        data: {
                                            labels: ['Conforming', 'Major NC', 'Minor NC', 'OBS / OFI', 'N/A'],
                                            datasets: [{
                                                data: [${d.stats.conformCount}, ${d.stats.majorNC}, ${d.stats.minorNC}, ${d.stats.observationCount + d.stats.ofiCount}, ${d.stats.naCount}],
                                                backgroundColor: ['#10b981', '#dc2626', '#f59e0b', '#8b5cf6', '#94a3b8'],
                                                borderWidth: 2,
                                                borderColor: '#ffffff'
                                            }]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            cutout: '55%',
                                            plugins: {
                                                legend: { 
                                                    position: 'bottom',
                                                    labels: { font: { size: 11 }, padding: 10, usePointStyle: true, pointStyle: 'circle' }
                                                },
                                                tooltip: {
                                                    callbacks: {
                                                        label: (context) => {
                                                            const total = ${d.stats.totalItems};
                                                            const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
                                                            return context.label + ': ' + context.parsed + ' (' + pct + '%)';
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    });
                                }
                                
                                // 2. Severity Bar Chart — 4 categories
                                const sevCtx = document.getElementById('severity-bar-chart');
                                if (sevCtx) {
                                    new Chart(sevCtx.getContext('2d'), {
                                        type: 'bar',
                                        data: {
                                            labels: ['Major NC', 'Minor NC', 'Observations', 'OFI'],
                                            datasets: [{
                                                label: 'Count',
                                                data: [${d.stats.majorNC}, ${d.stats.minorNC}, ${d.stats.observationCount}, ${d.stats.ofiCount}],
                                                backgroundColor: ['#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4'],
                                                borderWidth: 0,
                                                borderRadius: 6
                                            }]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                                legend: { display: false }
                                            },
                                            scales: {
                                                y: { 
                                                    beginAtZero: true,
                                                    ticks: { stepSize: 1 }
                                                }
                                            }
                                        }
                                    });
                                }
                                
                                // 3. Findings by Main Clause Chart
                                const clauseCtx = document.getElementById('clause-findings-chart');
                                if (clauseCtx) {
                                    // Group findings by main clause (e.g., 4.x -> 4, 5.x -> 5)
                                    const clauseData = {};
                                    const allItems = ${JSON.stringify(d.hydratedProgress.map(i => ({
                clause: i.criterionRef || i.kbMatch?.clause || i.clause || '—',
                rawClause: i.clause || '',
                hasCriterionRef: !!i.criterionRef,
                status: i.status,
                ncrType: (i.ncrType || '').toLowerCase()
            })))};
                                    const INTERNAL_REF_RE_CHART = /^(FOCUS|SURV|ORG|DOC)([.\\s]|$)/i;
                                    allItems.forEach(item => {
                                        const mainClause = (!item.hasCriterionRef && INTERNAL_REF_RE_CHART.test(item.rawClause)) ? 'Internal focus items' : item.clause.split('.')[0]; // Extract main clause (e.g., "4" from "4.1.2")
                                        if (!clauseData[mainClause]) {
                                            clauseData[mainClause] = { major: 0, minor: 0, obs: 0, ofi: 0, ok: 0 };
                                        }
                                        
                                        if (item.status === 'nc') {
                                            if (item.ncrType === 'major') clauseData[mainClause].major++;
                                            else if (item.ncrType === 'minor') clauseData[mainClause].minor++;
                                            else if (item.ncrType === 'ofi') clauseData[mainClause].ofi++;
                                            else clauseData[mainClause].obs++;
                                        } else if (item.status === 'conform') {
                                            clauseData[mainClause].ok++;
                                        }
                                    });
                                    
                                    // Sort clauses numerically
                                    const sortedClauses = Object.keys(clauseData).sort((a, b) => {
                                        const numA = parseInt(a, 10) || 999;
                                        const numB = parseInt(b, 10) || 999;
                                        return numA - numB;
                                    });
                                    
                                    new Chart(clauseCtx.getContext('2d'), {
                                        type: 'bar',
                                        data: {
                                            labels: sortedClauses.map(c => 'Clause ' + c),
                                            datasets: [
                                                {
                                                    label: 'Major NC',
                                                    data: sortedClauses.map(c => clauseData[c].major),
                                                    backgroundColor: '#dc2626',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'Minor NC',
                                                    data: sortedClauses.map(c => clauseData[c].minor),
                                                    backgroundColor: '#f59e0b',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'Observations',
                                                    data: sortedClauses.map(c => clauseData[c].obs),
                                                    backgroundColor: '#8b5cf6',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'OFI',
                                                    data: sortedClauses.map(c => clauseData[c].ofi),
                                                    backgroundColor: '#06b6d4',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'Conforming',
                                                    data: sortedClauses.map(c => clauseData[c].ok),
                                                    backgroundColor: '#10b981',
                                                    stack: 'findings'
                                                }
                                            ]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                                legend: { 
                                                    position: 'bottom',
                                                    labels: { font: { size: 11 }, padding: 10, usePointStyle: true, pointStyle: 'circle' }
                                                },
                                                tooltip: {
                                                    mode: 'index',
                                                    intersect: false
                                                }
                                            },
                                            scales: {
                                                x: { stacked: true },
                                                y: { 
                                                    stacked: true,
                                                    beginAtZero: true,
                                                    ticks: { stepSize: 1 }
                                                }
                                            }
                                        }
                                    });
                                }

                                // 4. Department-based Chart
                                const deptCtx = document.getElementById('dept-findings-chart');
                                if (deptCtx) {
                                    const deptData = {};
                                    const deptItems = ${JSON.stringify(d.hydratedProgress.map(i => ({
                department: i.department || 'Unassigned',
                status: i.status,
                ncrType: (i.ncrType || '').toLowerCase()
            })))};
                                    deptItems.forEach(item => {
                                        const dept = item.department || 'Unassigned';
                                        if (!deptData[dept]) deptData[dept] = { ok: 0, major: 0, minor: 0, obs: 0, ofi: 0, na: 0 };
                                        if (item.status === 'conform') deptData[dept].ok++;
                                        else if (item.status === 'na') deptData[dept].na++;
                                        else if (item.status === 'nc') {
                                            if (item.ncrType === 'major') deptData[dept].major++;
                                            else if (item.ncrType === 'observation') deptData[dept].obs++;
                                            else if (item.ncrType === 'ofi') deptData[dept].ofi++;
                                            else deptData[dept].minor++;
                                        }
                                    });
                                    const deptLabels = Object.keys(deptData).filter(d => d !== 'Unassigned').sort();
                                    if (deptData['Unassigned'] && (deptData['Unassigned'].ok + deptData['Unassigned'].major + deptData['Unassigned'].minor + deptData['Unassigned'].obs + deptData['Unassigned'].ofi) > 0) {
                                        deptLabels.push('Unassigned');
                                    }
                                    if (deptLabels.length > 0) {
                                        new Chart(deptCtx.getContext('2d'), {
                                            type: 'bar',
                                            data: {
                                                labels: deptLabels,
                                                datasets: [
                                                    { label: 'Conforming', data: deptLabels.map(d => deptData[d].ok), backgroundColor: '#10b981', stack: 'dept' },
                                                    { label: 'Major NC', data: deptLabels.map(d => deptData[d].major), backgroundColor: '#dc2626', stack: 'dept' },
                                                    { label: 'Minor NC', data: deptLabels.map(d => deptData[d].minor), backgroundColor: '#f59e0b', stack: 'dept' },
                                                    { label: 'Observations', data: deptLabels.map(d => deptData[d].obs), backgroundColor: '#8b5cf6', stack: 'dept' },
                                                    { label: 'OFI', data: deptLabels.map(d => deptData[d].ofi), backgroundColor: '#06b6d4', stack: 'dept' }
                                                ]
                                            },
                                            options: {
                                                indexAxis: 'y',
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: {
                                                    legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, usePointStyle: true, pointStyle: 'circle' } }
                                                },
                                                scales: {
                                                    x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
                                                    y: { stacked: true }
                                                }
                                            }
                                        });
                                    } else {
                                        deptCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-building" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>No department data yet. Use AI Auto Map to assign departments.</div>';
                                    }
                                }

                                // 5. Personnel Workload Chart
                                const persCtx = document.getElementById('personnel-workload-chart');
                                if (persCtx) {
                                    const persData = {};
                                    const persItems = ${JSON.stringify(d.hydratedProgress.map(i => ({
                personnel: i.personnel || '',
                status: i.status
            })))};
                                    persItems.forEach(item => {
                                        if (!item.personnel) return;
                                        if (!persData[item.personnel]) persData[item.personnel] = { conform: 0, nc: 0, na: 0 };
                                        if (item.status === 'conform') persData[item.personnel].conform++;
                                        else if (item.status === 'nc') persData[item.personnel].nc++;
                                        else if (item.status === 'na') persData[item.personnel].na++;
                                    });
                                    const persLabels = Object.keys(persData).sort((a, b) => {
                                        const ta = persData[a].conform + persData[a].nc + persData[a].na;
                                        const tb = persData[b].conform + persData[b].nc + persData[b].na;
                                        return tb - ta;
                                    }).slice(0, 10);
                                    if (persLabels.length > 0) {
                                        new Chart(persCtx.getContext('2d'), {
                                            type: 'bar',
                                            data: {
                                                labels: persLabels,
                                                datasets: [
                                                    { label: 'Conform', data: persLabels.map(p => persData[p].conform), backgroundColor: '#10b981', stack: 'pers' },
                                                    { label: 'NC', data: persLabels.map(p => persData[p].nc), backgroundColor: '#ef4444', stack: 'pers' },
                                                    { label: 'N/A', data: persLabels.map(p => persData[p].na), backgroundColor: '#94a3b8', stack: 'pers' }
                                                ]
                                            },
                                            options: {
                                                indexAxis: 'y',
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8, usePointStyle: true, pointStyle: 'circle' } } },
                                                scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, y: { stacked: true, ticks: { font: { size: 10 } } } }
                                            }
                                        });
                                    } else {
                                        persCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-user-tie" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>No personnel data yet. Use AI Auto Map to assign personnel.</div>';
                                    }
                                }

                                // 6. Compliance by Department Radar
                                const radarCtx = document.getElementById('dept-compliance-radar');
                                if (radarCtx) {
                                    const rDeptData = {};
                                    const rItems = ${JSON.stringify(d.hydratedProgress.map(i => ({
                department: i.department || '',
                status: i.status
            })))};
                                    rItems.forEach(item => {
                                        if (!item.department) return;
                                        if (!rDeptData[item.department]) rDeptData[item.department] = { total: 0, conform: 0 };
                                        rDeptData[item.department].total++;
                                        if (item.status === 'conform') rDeptData[item.department].conform++;
                                    });
                                    const rLabels = Object.keys(rDeptData).sort();
                                    if (rLabels.length >= 3) {
                                        new Chart(radarCtx.getContext('2d'), {
                                            type: 'radar',
                                            data: {
                                                labels: rLabels,
                                                datasets: [{
                                                    label: 'Conformance %',
                                                    data: rLabels.map(d => rDeptData[d].total > 0 ? Math.round((rDeptData[d].conform / rDeptData[d].total) * 100) : 0),
                                                    borderColor: '#6366f1',
                                                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                                    borderWidth: 2,
                                                    pointBackgroundColor: '#6366f1',
                                                    pointRadius: 4
                                                }]
                                            },
                                            options: {
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: { legend: { display: false } },
                                                scales: {
                                                    r: {
                                                        beginAtZero: true,
                                                        max: 100,
                                                        ticks: { stepSize: 25, font: { size: 10 }, backdropColor: 'transparent' },
                                                        pointLabels: { font: { size: 10 } },
                                                        grid: { color: '#e2e8f0' },
                                                        angleLines: { color: '#e2e8f0' }
                                                    }
                                                }
                                            }
                                        });
                                    } else {
                                        radarCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-chart-radar" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>Need at least 3 departments for radar chart.</div>';
                                    }
                                }
                            }, 300);
                        })();
                        </script>
                    </div>
                </div>
                <!-- 4: Conformance Verification -->
                <div class="rp-sec" id="sec-conformance">
                    <div class="rp-sec-hdr" style="border-left-color:#10b981;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">4</span>CONFORMANCE VERIFICATION (${d.stats.conformCount})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f0fdf4;"><th style="padding:10px 14px;text-align:left;width:12%;">Clause</th><th style="padding:10px 14px;text-align:left;width:40%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:12%;">Status</th><th style="padding:10px 14px;text-align:left;width:40%;">Evidence & Remarks</th></tr></thead>
                            <tbody>${conformRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No conformance evidence recorded</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
                <!-- Previous Findings Status -->
                <div class="rp-sec" id="sec-prev-findings">
                    <div class="rp-sec-hdr" style="border-left-color:#6366f1;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;"><i class="fa-solid fa-history"></i></span>PREVIOUS FINDINGS STATUS<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        ${(function () {
                            // Look for previous reports for the same client
                            const allReports = window.state?.auditReports || [];
                            const prevReports = allReports
                                .filter(r => r.clientId === d.report.clientId && String(r.id) !== String(d.report.id))
                                .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
                            const prevReport = prevReports[0];
                            const prevFindingsNarrative = '<div style="margin-top:12px;"><div style="font-size:0.8rem;font-weight:600;color:#3730a3;margin-bottom:6px;">Previous Findings Status (editable)</div><div id="rp-prev-findings" class="rp-edit" contenteditable="true" style="min-height:40px;line-height:1.7;">' + (d.report.previousFindingsStatus || 'Nonconformities and observations from the previous audit were reviewed. All corrective actions were verified as effectively implemented unless otherwise stated below.') + '</div></div>';
                            if (!prevReport) {
                                return '<div style="text-align:center;padding:20px;color:#94a3b8;"><i class="fa-solid fa-info-circle" style="margin-right:6px;"></i>No previous audit reports found for this client. Enter the previous findings status manually below.</div>' + prevFindingsNarrative;
                            }
                            // Extract NCs from previous report
                            const prevNCs = (prevReport.checklistProgress || [])
                                .filter(p => p.status === 'nc' && (p.ncrType || '').toLowerCase() !== 'observation' && (p.ncrType || '').toLowerCase() !== 'ofi');
                            const prevNCRs = prevReport.ncrs || [];
                            if (prevNCs.length === 0 && prevNCRs.length === 0) {
                                return '<div style="padding:12px;background:#f0fdf4;border-radius:8px;color:#166534;"><i class="fa-solid fa-circle-check" style="margin-right:6px;"></i><strong>Previous Audit (' + (prevReport.date || '—') + '):</strong> No non-conformities were raised. Certification was recommended.</div>' + prevFindingsNarrative;
                            }
                            let rows = '';
                            prevNCs.forEach(function (nc, i) {
                                rows += '<tr><td style="font-family:monospace;font-weight:600;color:#6366f1;">PREV-' + (i + 1) + '</td><td>' + (nc.clauseRef || nc.clause || '') + '</td><td><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;' + ((nc.ncrType || '').toLowerCase() === 'major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + (nc.ncrType || 'Minor') + '</span></td><td contenteditable="true" style="cursor:text;min-width:150px;">Verified closed — corrective action implemented</td></tr>';
                            });
                            prevNCRs.forEach(function (ncr, i) {
                                rows += '<tr><td style="font-family:monospace;font-weight:600;color:#6366f1;">PREV-' + (prevNCs.length + i + 1) + '</td><td>' + (ncr.clause || '') + '</td><td><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;' + ((ncr.type || '').toLowerCase() === 'major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + (ncr.type || 'Minor') + '</span></td><td contenteditable="true" style="cursor:text;min-width:150px;">Verified closed — corrective action implemented</td></tr>';
                            });
                            return '<div style="margin-bottom:12px;padding:10px 14px;background:#eef2ff;border-radius:8px;font-size:0.88rem;color:#3730a3;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:6px;"></i><strong>Previous Audit:</strong> ' + (prevReport.date || '—') + ' | ' + (prevReport.standard || d.report.standard || '') + ' | ' + (prevNCs.length + prevNCRs.length) + ' NC(s) raised</div>'
                                + '<table style="width:100%;font-size:0.84rem;border-collapse:collapse;"><thead><tr style="background:#eef2ff;"><th style="padding:10px 14px;text-align:left;width:12%;">Ref</th><th style="padding:10px 14px;text-align:left;width:20%;">Clause</th><th style="padding:10px 14px;text-align:left;width:12%;">Type</th><th style="padding:10px 14px;text-align:left;width:56%;">Follow-up Status (click to edit)</th></tr></thead><tbody>' + rows + '</tbody></table>';
                        })()}
                    </div>
                </div>
                <!-- 5: Observations -->
                ${obsOnlyRows ? `
                <div class="rp-sec" id="sec-obs">
                    <div class="rp-sec-hdr" style="border-left-color:#7c3aed;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">5</span>OBSERVATIONS (${d.stats.observationCount})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f5f3ff;"><th style="padding:10px 14px;text-align:left;width:12%;">Clause</th><th style="padding:10px 14px;text-align:left;width:40%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:12%;">Type</th><th style="padding:10px 14px;text-align:left;width:40%;">Details</th></tr></thead>
                            <tbody>${obsOnlyRows}</tbody>
                        </table>
                    </div>
                </div>` : ''}
                <!-- 6: OFI -->
                ${ofiOnlyRows ? `
                <div class="rp-sec" id="sec-ofi">
                    <div class="rp-sec-hdr" style="border-left-color:#06b6d4;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">6</span>OPPORTUNITIES FOR IMPROVEMENT (${d.stats.ofiCount})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#ecfeff;"><th style="padding:10px 14px;text-align:left;width:12%;">Clause</th><th style="padding:10px 14px;text-align:left;width:40%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:12%;">Type</th><th style="padding:10px 14px;text-align:left;width:40%;">Recommendation</th></tr></thead>
                            <tbody>${ofiOnlyRows}</tbody>
                        </table>
                    </div>
                </div>` : ''}
                <!-- 7: Findings -->
                <div class="rp-sec" id="sec-findings">
                    <div class="rp-sec-hdr" style="border-left-color:#dc2626;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">7</span>FINDING DETAILS (${d.stats.ncCount})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f1f5f9;"><th style="padding:10px 14px;text-align:left;width:10%;">Clause</th><th style="padding:10px 14px;text-align:left;width:33%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:10%;">Severity</th><th style="padding:10px 14px;text-align:left;width:32%;">Evidence & Remarks</th><th style="padding:10px 14px;text-align:left;width:15%;">Finding Status</th></tr></thead>
                            <tbody>${ncRows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;">No non-conformities found</td></tr>'}</tbody>
                        </table>
                        ${ncPendingFootnote}
                    </div>
                </div>
                ${(d.report.ncrs || []).length > 0 ? `
                <!-- 7: NCRs -->
                <div class="rp-sec" id="sec-ncrs">
                    <div class="rp-sec-hdr" style="border-left-color:#ea580c;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">8</span>NCR REGISTER (${d.report.ncrs.length})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">${d.report.ncrs.map(ncr => '<div style="padding:10px;border-left:4px solid ' + ((ncr.type || '').toLowerCase() === 'major' ? '#dc2626' : '#f59e0b') + ';background:' + ((ncr.type || '').toLowerCase() === 'major' ? '#fef2f2' : '#fffbeb') + ';border-radius:0 6px 6px 0;margin-bottom:8px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:0.85rem;"><div><strong>' + (ncr.type || '') + '</strong> — ' + formalCriterionCell(ncr, d.report.standard || d.auditPlan?.standard || '') + '</div><span style="color:#64748b;font-size:0.8rem;white-space:nowrap;">' + (ncr.createdAt ? new Date(ncr.createdAt).toLocaleDateString() : '') + '</span></div><div style="color:#334155;font-size:0.85rem;margin-top:4px;">' + fmtRemark(ncr.description) + '</div></div>').join('')}</div>
                </div>` : ''}
                <!-- Corrective Action Requirements -->
                ${(d.stats.ncCount) > 0 ? `
                <div class="rp-sec" id="sec-corrective">
                    <div class="rp-sec-hdr" style="border-left-color:#be185d;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">9</span>CORRECTIVE ACTION REQUIREMENTS<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#fdf2f8;"><th style="padding:10px 14px;text-align:left;width:10%;">NC Ref</th><th style="padding:10px 14px;text-align:left;width:10%;">Clause</th><th style="padding:10px 14px;text-align:left;width:10%;">Type</th><th style="padding:10px 14px;text-align:left;width:35%;">Corrective Action Required</th><th style="padding:10px 14px;text-align:left;width:15%;">Due Date</th><th style="padding:10px 14px;text-align:left;width:20%;">Verification Method</th></tr></thead>
                            <tbody>${(() => {
                    const dueFromType = (typ) => { const t = (typ || '').toLowerCase(); const dt = new Date(); dt.setDate(dt.getDate() + (t === 'major' ? 30 : 90)); return dt.toISOString().split('T')[0]; };
                    let allNCs;
                    if (d.stats.rs && Array.isArray(d.stats.rs.uniqueFindings)) {
                        // Shared numbering (F-01, F-02, ...) so this table agrees with the Findings
                        // section and risk sections — no independent, conflicting ref sequence.
                        allNCs = d.stats.rs.uniqueFindings
                            .filter(f => (f.severity || '').toLowerCase() !== 'observation' && (f.severity || '').toLowerCase() !== 'ofi')
                            .map(f => ({
                                ref: f.id,
                                clause: f.clause || '',
                                criterionRef: f.criterionRef || null,
                                criterionSource: f.criterionSource || null,
                                type: f.severity || 'Minor',
                                desc: f.comment || f.statement || '',
                                dueDate: f.caDueDate || dueFromType(f.severity)
                            }));
                    } else {
                        // Legacy fallback: union checklist NC items + report.ncrs with independent numbering.
                        const ncItems = (d.report.checklistProgress || []).filter(p => p.status === 'nc' && (p.ncrType || '').toLowerCase() !== 'observation' && (p.ncrType || '').toLowerCase() !== 'ofi');
                        const ncrItems = d.report.ncrs || [];
                        allNCs = [...ncItems.map((item, i) => ({
                            ref: 'NCR-' + String(d.report.id).substring(0, 6) + '-' + (i + 1),
                            clause: item.clauseRef || item.clause || item.id,
                            criterionRef: item.criterionRef || null,
                            criterionSource: item.criterionSource || null,
                            type: item.ncrType || item.severity || 'Minor',
                            desc: item.ncrDescription || item.comment || item.requirement || '',
                            dueDate: item.caDueDate || dueFromType(item.ncrType)
                        })), ...ncrItems.map((ncr, i) => ({
                            ref: 'NCR-' + String(d.report.id).substring(0, 6) + '-' + (ncItems.length + i + 1),
                            clause: ncr.clause || '',
                            criterionRef: ncr.criterionRef || null,
                            criterionSource: ncr.criterionSource || null,
                            type: ncr.type || 'Minor',
                            desc: ncr.description || '',
                            dueDate: ncr.caDueDate || dueFromType(ncr.type)
                        }))];
                    }
                    if (allNCs.length === 0) return '<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8;">No corrective actions required</td></tr>';
                    const carStandard = d.report.standard || d.auditPlan?.standard || '';
                    return allNCs.map(nc => '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 14px;font-weight:600;font-family:monospace;color:#be185d;">' + nc.ref + '</td><td style="padding:10px 14px;">' + formalCriterionCell(nc, carStandard) + '</td><td style="padding:10px 14px;"><span style="padding:2px 10px;border-radius:20px;font-size:0.78rem;font-weight:600;' + ((nc.type || '').toLowerCase() === 'major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + nc.type + '</span></td><td style="padding:10px 14px;" contenteditable="true" class="rp-edit">Root cause analysis and corrective action required for: ' + (nc.desc || '').substring(0, 120) + '</td><td style="padding:10px 14px;font-weight:600;color:#be185d;">' + nc.dueDate + '</td><td style="padding:10px 14px;" contenteditable="true" class="rp-edit">Document review & follow-up audit</td></tr>').join('');
                })()}</tbody>
                        </table>
                        <div style="margin-top:1rem;padding:0.75rem;background:#fef2f8;border-radius:8px;font-size:0.82rem;color:#9d174d;"><i class="fa-solid fa-clock" style="margin-right:0.4rem;"></i><strong>Timeframes:</strong> Major NC — 30 days | Minor NC — 90 days from report issuance</div>
                    </div>
                </div>` : ''}
                <!-- 8: Meetings -->
                <div class="rp-sec" id="sec-meetings">
                    <div class="rp-sec-hdr" style="border-left-color:#0891b2;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">9</span>CLOSING MEETING<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="padding:12px;background:#eff6ff;border-radius:8px;"><strong style="color:#1d4ed8;"><i class="fa-solid fa-pen" style="font-size:0.6rem;margin-right:4px;opacity:0.5;"></i>Closing Meeting</strong><div style="font-size:0.85rem;color:#334155;margin-top:6px;">Date: ${d.report.closingMeeting?.date || '—'}</div><div style="font-size:0.85rem;color:#334155;">Attendees: ${(() => { const att = d.report.closingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(a => typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a).filter(Boolean).join(', ') || '—'; return String(att); })()}</div><div id="rp-closing-summary" class="rp-edit" contenteditable="true" style="margin-top:6px;font-size:0.85rem;min-height:30px;">${d.report.closingMeeting?.summary || '<em style="color:#94a3b8;">Click to add closing meeting summary...</em>'}</div></div>
                    </div>
                </div>
                <!-- Changes Since Last Audit -->
                <div class="rp-sec" id="sec-changes">
                    <div class="rp-sec-hdr" style="border-left-color:#78716c;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">11</span>CHANGES SINCE LAST AUDIT<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div id="rp-changes" class="rp-edit" contenteditable="true" style="min-height:40px;line-height:1.7;">${d.report.changesSinceLastAudit || 'No significant changes to the management system scope, documentation, or organizational structure have been reported since the last audit.'}</div>
                    </div>
                </div>
                <!-- Management System Effectiveness -->
                <div class="rp-sec" id="sec-mgmt-effectiveness">
                    <div class="rp-sec-hdr" style="border-left-color:#0e7490;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;"><i class="fa-solid fa-gauge-high"></i></span>MANAGEMENT SYSTEM EFFECTIVENESS<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#ecfeff;"><th style="padding:10px 14px;text-align:left;width:38%;">Process</th><th style="padding:10px 14px;text-align:left;width:62%;">Effectiveness Status (click to edit)</th></tr></thead>
                            <tbody>
                                <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">Internal Audit Programme</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;" id="rp-eff-internal-audit" class="rp-edit" contenteditable="true">${d.report.effInternalAudit || 'Implemented and effective; conforms to the requirements of the standard.'}</td></tr>
                                <tr style="background:#f8fafc;"><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">Management Review</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;" id="rp-eff-mgmt-review" class="rp-edit" contenteditable="true">${d.report.effMgmtReview || 'Implemented and effective; conforms to the requirements of the standard.'}</td></tr>
                                <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">Handling of Complaints</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;" id="rp-eff-complaints" class="rp-edit" contenteditable="true">${d.report.effComplaints || 'Implemented and effective; conforms to the requirements of the standard.'}</td></tr>
                                <tr style="background:#f8fafc;"><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">Use of Certification Marks / Logo</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;" id="rp-eff-marks" class="rp-edit" contenteditable="true">${d.report.effMarks || (/initial|stage/.test(String(d.auditPlan?.auditType || '').toLowerCase()) || !d.auditPlan?.auditType ? 'Not applicable — initial certification audit.' : 'Usage verified as conforming to CB rules.')}</td></tr>
                                <tr><td style="padding:8px 14px;font-weight:600;">Legal &amp; Regulatory Compliance</td><td style="padding:8px 14px;" id="rp-eff-legal" class="rp-edit" contenteditable="true">${d.report.effLegal || 'Implemented and effective; conforms to the requirements of the standard.'}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- 7: Conclusion -->
                <div class="rp-sec" id="sec-conclusion">
                    <div class="rp-sec-hdr" style="border-left-color:#4338ca;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">10</span>AUDIT CONCLUSION<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="margin-bottom:10px;">${(function () {
                            const rec = resolveRecommendation(d.report, d.stats);
                            return '<strong style="color:#334155;">Recommendation:</strong> <span style="margin-left:6px;padding:4px 14px;border-radius:20px;font-weight:700;font-size:0.82rem;' + (rec.primary === 'Recommended' ? 'background:#dcfce7;color:#166534;' : rec.primary === 'Not Recommended' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + rec.primary + '</span>'
                                + (rec.showAutoCaption ? ' <span style="margin-left:8px;font-size:0.72rem;color:#94a3b8;font-style:italic;">(system-derived: ' + rec.auto + ')</span>' : '');
                        })()}</div>
                        ${(function () {
                            // Risk Assessment auto-callout
                            const ncClauses = (d.report.checklistProgress || [])
                                .filter(p => p.status === 'nc' && p.ncrType && p.ncrType.toLowerCase() !== 'observation' && p.ncrType.toLowerCase() !== 'ofi')
                                .map(p => p.clauseRef || p.clause || '').filter(Boolean);
                            const ncrClauses = (d.report.ncrs || []).map(n => n.clause || '').filter(Boolean);
                            const allRiskClauses = [...new Set([...ncClauses, ...ncrClauses])];
                            if (allRiskClauses.length === 0) return '';
                            return '<div style="margin-bottom:14px;padding:14px;background:#fef2f2;border-radius:10px;border-left:4px solid #dc2626;"><div style="font-size:0.82rem;font-weight:700;color:#991b1b;margin-bottom:6px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>RISK AREAS IDENTIFIED</div><div style="font-size:0.85rem;color:#7f1d1d;line-height:1.6;">The following clause areas have been identified as requiring management attention due to non-conformity findings: <strong>' + allRiskClauses.join(', ') + '</strong>. These areas should be prioritized for corrective action and root cause analysis to prevent recurrence.</div></div>';
                        })()}
                        <div id="rp-conclusion" class="rp-edit" contenteditable="true">${d.report.conclusion || ('Based on the audit findings, the audit team concludes that the organization\'s management system has been assessed against the applicable standard requirements. ' + (d.stats.rs && d.stats.rs.recommendation ? d.stats.rs.recommendation : d.stats.recommendation || '') + ' Click to edit this conclusion.')}</div>
                        <div style="margin-top:14px;"><strong style="color:#334155;font-size:0.85rem;">Unresolved Issues / Diverging Opinions:</strong> <span id="rp-unresolved" class="rp-edit" contenteditable="true" style="margin-left:6px;">${d.report.unresolvedIssues || 'None. All findings were acknowledged by the auditee at the closing meeting.'}</span></div>
                        <p style="font-style:italic;font-size:0.78rem;color:#64748b;margin-top:12px;">This audit was conducted through a sampling process of the available information. Consequently, nonconformities may exist which have not been identified within this report.</p>
                    </div>
                </div>
                <!-- Signature Block -->
                <div class="rp-sec" id="sec-signature">
                    <div class="rp-sec-hdr" style="border-left-color:#1e293b;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">14</span>SIGNATURE & ATTESTATION<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;">
                            <div style="padding:1.5rem;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                                <div style="font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem;font-weight:600;">Lead Auditor</div>
                                <div style="font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:0.5rem;">${d.auditPlan?.team?.[0] || d.report.leadAuditor || 'Lead Auditor Name'}</div>
                                <div style="border-bottom:2px solid #1e293b;width:100%;margin:1.5rem 0 0.5rem;"></div>
                                <div style="font-size:0.8rem;color:#64748b;">Signature</div>
                                <div style="margin-top:1rem;font-size:0.85rem;color:#475569;">Date: <span id="rp-sig-date" contenteditable="true" class="rp-edit" style="font-weight:600;">${new Date().toLocaleDateString('en-GB')}</span></div>
                            </div>
                            <div style="padding:1.5rem;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                                <div style="font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem;font-weight:600;">Technical Reviewer / Certification Manager</div>
                                ${(function () {
                                    const tr = resolveTechnicalReview(d.report);
                                    // CSP has no 'unsafe-inline' for scripts, so inline
                                    // oninput/onchange never fire in production — these
                                    // fields silently saved nothing. Delegated instead.
                                    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:0.5rem;">
                                        <input type="text" id="rp-tr-reviewer" value="${window.UTILS.escapeHtml(tr.reviewer)}" placeholder="Reviewer name" data-action-input="updateTechnicalReviewField" data-tr-field="reviewer" style="padding:6px 8px;border-radius:6px;border:1px solid #cbd5e1;font-size:0.9rem;font-weight:700;color:#1e293b;">
                                        <select id="rp-tr-outcome" data-action-change="updateTechnicalReview" data-arg1="outcome" data-arg2="this.value" style="padding:6px 8px;border-radius:6px;border:1px solid #cbd5e1;font-size:0.85rem;">
                                            <option value="" ${!tr.outcome ? 'selected' : ''}>Outcome — pending</option>
                                            <option value="Approved" ${tr.outcome === 'Approved' ? 'selected' : ''}>Approved</option>
                                            <option value="Returned" ${tr.outcome === 'Returned' ? 'selected' : ''}>Returned</option>
                                        </select>
                                    </div>
                                    <textarea id="rp-tr-notes" placeholder="Technical review notes (optional)" data-action-input="updateTechnicalReviewField" data-tr-field="notes" style="width:100%;min-height:44px;padding:6px 8px;border-radius:6px;border:1px solid #cbd5e1;font-size:0.82rem;color:#475569;resize:vertical;">${window.UTILS.escapeHtml(tr.notes)}</textarea>`;
                                })()}
                                <div style="border-bottom:2px solid #1e293b;width:100%;margin:1rem 0 0.5rem;"></div>
                                <div style="font-size:0.8rem;color:#64748b;">Signature</div>
                                <div style="margin-top:1rem;font-size:0.85rem;color:#475569;">Date: <input type="date" id="rp-reviewer-date" value="${resolveTechnicalReview(d.report).date || ''}" data-action-change="updateTechnicalReview" data-arg1="date" data-arg2="this.value" style="font-weight:600;border:1px solid #cbd5e1;border-radius:6px;padding:3px 6px;"></div>
                            </div>
                        </div>
                        <div style="margin-top:1.5rem;padding:1rem;background:#f0f9ff;border-radius:8px;font-size:0.82rem;color:#0c4a6e;text-align:center;"><i class="fa-solid fa-shield-halved" style="margin-right:0.5rem;"></i>This report is confidential and intended solely for the audited organization, the certification body, and the accreditation body.</div>
                    </div>
                </div>
                <!-- Distribution List -->
                <div class="rp-sec" id="sec-distribution">
                    <div class="rp-sec-hdr" style="border-left-color:#0d9488;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;"><i class="fa-solid fa-share-nodes"></i></span>DISTRIBUTION LIST<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="margin-bottom:12px;font-size:0.85rem;color:#64748b;">This report is distributed to the following parties. Unauthorized distribution is prohibited. <em style="color:#0d9488;">(Click any cell below to edit)</em></div>
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f0fdfa;"><th style="padding:10px 14px;text-align:left;width:5%;">#</th><th style="padding:10px 14px;text-align:left;width:30%;">Recipient</th><th style="padding:10px 14px;text-align:left;width:25%;">Role</th><th style="padding:10px 14px;text-align:left;width:25%;">Organization</th><th style="padding:10px 14px;text-align:left;width:15%;">Format</th></tr></thead>
                            <tbody id="rp-distribution" class="rp-edit">
                                <tr><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">1</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">${d.report.leadAuditor || 'Lead Auditor'}</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Lead Auditor</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">${d.cbName || 'Certification Body'}</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Original</td></tr>
                                <tr style="background:#f8fafc;"><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">2</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">${resolveTechnicalReview(d.report).reviewer || 'Technical Reviewer'}</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Technical Reviewer</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">${d.cbName || 'Certification Body'}</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Copy</td></tr>
                                <tr><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">3</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">${d.report.client}</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Client Representative</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">${d.report.client}</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Copy</td></tr>
                                <tr style="background:#f8fafc;"><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">4</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Certification Records</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">File / Archive</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">${d.cbName || 'Certification Body'}</td><td contenteditable="true" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Archive</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- Annexures -->
                <div class="rp-sec" id="sec-annexures">
                    <div class="rp-sec-hdr" style="border-left-color:#9333ea;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;"><i class="fa-solid fa-paperclip"></i></span>ANNEXURES / APPENDICES<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div id="rp-annexures" class="rp-edit" contenteditable="true" style="min-height:80px;line-height:1.8;color:#334155;">
                            <div style="font-weight:600;margin-bottom:8px;">Annexure A — Audit Plan Reference</div>
                            <div style="margin-bottom:6px;">• Plan Reference: ${d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : 'N/A'}</div>
                            <div style="margin-bottom:12px;">• Standard: ${d.report.standard || 'ISO Standard'}</div>
                            <div style="font-weight:600;margin-bottom:8px;">Annexure B — Checklist Summary</div>
                            <div style="margin-bottom:6px;">• Total Items Audited: ${d.stats.totalItems}</div>
                            <div style="margin-bottom:6px;">• Conforming: ${d.stats.conformCount} | NC: ${d.stats.ncCount} | Observations: ${d.stats.observationCount} | OFI: ${d.stats.ofiCount}</div>
                            <div style="margin-bottom:12px;">• N/A Items: ${d.stats.naCount}</div>
                            <div style="font-weight:600;margin-bottom:8px;">Annexure C — Additional Documents</div>
                            <div style="color:#94a3b8;font-style:italic;">Click to add any additional supporting documents, certificates, or reference materials</div>
                        </div>
                    </div>
                </div>
            </div>
            </div><!-- /rp-body -->
            ${(window.ReportExecutive && window.ReportExecutive.renderAssistantPanel) ? window.ReportExecutive.renderAssistantPanel() : ''}
            <div class="rp-footer">
                <div style="font-size:0.82rem;color:#64748b;max-width:46%;"><i class="fa-solid fa-info-circle" style="margin-right:4px;"></i>${sections.filter(s => !s.hide).length} sections • Click any section to edit • Changes reflect in PDF<br><span style="color:#94a3b8;">In the print dialog: turn "Headers and footers" OFF and "Background graphics" ON for correct output.</span></div>
                <div style="display:flex;gap:10px;align-items:center;">
                    <button data-action="removeElement" data-id="report-preview-overlay" style="padding:10px 20px;border-radius:8px;border:1px solid #cbd5e1;background:white;font-weight:600;cursor:pointer;color:#475569;">Cancel</button>
                    <button id="ai-polish-btn" data-action="polishNotesWithAI" style="padding:10px 20px;border-radius:8px;border:2px solid #0ea5e9;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);font-weight:600;cursor:pointer;color:#0369a1;" aria-label="Auto-generate"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px;"></i>Polish Notes with AI</button>
                    <button data-action="toggleReportStatus" id="rp-status-toggle" style="padding:10px 16px;border-radius:20px;border:2px solid ${(d.report.reportStatus === 'final') ? '#059669' : '#f59e0b'};background:${(d.report.reportStatus === 'final') ? '#ecfdf5' : '#fffbeb'};color:${(d.report.reportStatus === 'final') ? '#059669' : '#b45309'};font-weight:700;cursor:pointer;" aria-label="Toggle report status" title="Click to switch between Draft and Final. Draft exports show a DRAFT watermark and do not advance the revision history."><i class="fa-solid ${(d.report.reportStatus === 'final') ? 'fa-circle-check' : 'fa-pen'}" style="margin-right:6px;"></i>${(d.report.reportStatus === 'final') ? 'FINAL' : 'DRAFT'}</button>
                    <button data-action="exportEvidencePack" data-arg1="${d.report.id}" style="padding:10px 20px;border-radius:8px;border:1px solid #c2410c;background:#fff7ed;color:#c2410c;font-weight:600;cursor:pointer;" aria-label="Evidence Pack PDF"><i class="fa-solid fa-images" style="margin-right:6px;"></i>Evidence Pack (PDF)</button>
                    <button data-action="exportReportPDF" style="padding:10px 24px;border-radius:8px;border:none;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.3);" aria-label="Export PDF"><i class="fa-solid fa-file-pdf" style="margin-right:6px;"></i>Export PDF</button>
                </div>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Charts: <script> inside innerHTML doesn't execute — init programmatically
        window._initPreviewCharts = function () {
            const d = window._reportPreviewData;
            if (!d) return;

            function renderCharts() {
                // 1. Compliance Pie
                const pieCtx = document.getElementById('compliance-pie-chart');
                if (pieCtx) {
                    new Chart(pieCtx.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: ['Conforming', 'Non-Conformity', 'Observations/OFI', 'Not Assessed', 'N/A'],
                            datasets: [{ data: [d.stats.conformCount, d.stats.ncCount, d.stats.obsOfiCount, d.stats.notAssessedCount, d.stats.naCount], backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#94a3b8', '#cbd5e1'], borderWidth: 0 }]
                        },
                        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } } }
                    });
                }
                // 2. Severity Bar
                const sevCtx = document.getElementById('severity-bar-chart');
                if (sevCtx) {
                    new Chart(sevCtx.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: ['Major NC', 'Minor NC', 'Observations'],
                            datasets: [{ label: 'Count', data: [d.stats.majorNC, d.stats.minorNC, d.stats.observationCount], backgroundColor: ['#dc2626', '#f59e0b', '#fbbf24'], borderWidth: 0 }]
                        },
                        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
                    });
                }
                // 3. Findings by Clause
                const clauseCtx = document.getElementById('clause-findings-chart');
                if (clauseCtx) {
                    const clauseData = {};
                    d.hydratedProgress.forEach(item => {
                        const clause = item.criterionRef || item.kbMatch?.clause || item.clause || '—';
                        const mainClause = (!item.criterionRef && INTERNAL_REF_PREFIX_RE.test(item.clause || '')) ? 'Internal focus items' : clause.split('.')[0];
                        if (!clauseData[mainClause]) clauseData[mainClause] = { major: 0, minor: 0, obs: 0, ok: 0 };
                        if (item.status === 'nc') {
                            const t = (item.ncrType || '').toLowerCase();
                            if (t === 'major') clauseData[mainClause].major++;
                            else if (t === 'minor' || !t) clauseData[mainClause].minor++; // pending classification counted as minor here
                            else if (t === 'observation' || t === 'ofi') clauseData[mainClause].obs++;
                        } else if (item.status === 'conform') {
                            clauseData[mainClause].ok++;
                        }
                    });
                    const sorted = Object.keys(clauseData).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                    if (sorted.length) {
                        new Chart(clauseCtx.getContext('2d'), {
                            type: 'bar',
                            data: {
                                labels: sorted.map(c => 'Clause ' + c),
                                datasets: [
                                    { label: 'Major NC', data: sorted.map(c => clauseData[c].major), backgroundColor: '#dc2626', stack: 'f' },
                                    { label: 'Minor NC', data: sorted.map(c => clauseData[c].minor), backgroundColor: '#f59e0b', stack: 'f' },
                                    { label: 'Observations', data: sorted.map(c => clauseData[c].obs), backgroundColor: '#fbbf24', stack: 'f' },
                                    { label: 'Conforming', data: sorted.map(c => clauseData[c].ok), backgroundColor: '#10b981', stack: 'f' }
                                ]
                            },
                            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } } }
                        });
                    }
                }

                // 4. Department Findings Chart
                const deptCtx = document.getElementById('dept-findings-chart');
                if (deptCtx) {
                    const deptData = {};
                    d.hydratedProgress.forEach(item => {
                        const dept = item.department || '';
                        if (!dept) return;
                        if (!deptData[dept]) deptData[dept] = { major: 0, minor: 0, obs: 0, conform: 0 };
                        if (item.status === 'nc') {
                            if ((item.ncrType || '').toLowerCase() === 'major') deptData[dept].major++;
                            else if ((item.ncrType || '').toLowerCase() === 'minor') deptData[dept].minor++;
                            else deptData[dept].obs++;
                        } else if (item.status === 'conform') {
                            deptData[dept].conform++;
                        }
                    });
                    const deptLabels = Object.keys(deptData).sort();
                    if (deptLabels.length > 0) {
                        new Chart(deptCtx.getContext('2d'), {
                            type: 'bar',
                            data: {
                                labels: deptLabels,
                                datasets: [
                                    { label: 'Major NC', data: deptLabels.map(dl => deptData[dl].major), backgroundColor: '#dc2626', stack: 'd' },
                                    { label: 'Minor NC', data: deptLabels.map(dl => deptData[dl].minor), backgroundColor: '#f59e0b', stack: 'd' },
                                    { label: 'Observations', data: deptLabels.map(dl => deptData[dl].obs), backgroundColor: '#fbbf24', stack: 'd' },
                                    { label: 'Conforming', data: deptLabels.map(dl => deptData[dl].conform), backgroundColor: '#10b981', stack: 'd' }
                                ]
                            },
                            options: { responsive: true, indexAxis: 'y', plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8, usePointStyle: true, pointStyle: 'circle' } } }, scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, y: { stacked: true } } }
                        });
                    } else {
                        deptCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-building" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>No department data. Use AI Auto Map to assign departments.</div>';
                    }
                }

                // 5. Personnel Workload Chart
                const persCtx = document.getElementById('personnel-workload-chart');
                if (persCtx) {
                    const persData = {};
                    d.hydratedProgress.forEach(item => {
                        if (!item.personnel) return;
                        if (!persData[item.personnel]) persData[item.personnel] = { conform: 0, nc: 0, na: 0 };
                        if (item.status === 'conform') persData[item.personnel].conform++;
                        else if (item.status === 'nc') persData[item.personnel].nc++;
                        else if (item.status === 'na') persData[item.personnel].na++;
                    });
                    const persLabels = Object.keys(persData).sort((a, b) => {
                        return (persData[b].conform + persData[b].nc + persData[b].na) - (persData[a].conform + persData[a].nc + persData[a].na);
                    }).slice(0, 10);
                    if (persLabels.length > 0) {
                        new Chart(persCtx.getContext('2d'), {
                            type: 'bar',
                            data: {
                                labels: persLabels,
                                datasets: [
                                    { label: 'Conform', data: persLabels.map(p => persData[p].conform), backgroundColor: '#10b981', stack: 'p' },
                                    { label: 'NC', data: persLabels.map(p => persData[p].nc), backgroundColor: '#ef4444', stack: 'p' },
                                    { label: 'N/A', data: persLabels.map(p => persData[p].na), backgroundColor: '#94a3b8', stack: 'p' }
                                ]
                            },
                            options: { indexAxis: 'y', responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8, usePointStyle: true, pointStyle: 'circle' } } }, scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, y: { stacked: true, ticks: { font: { size: 10 } } } } }
                        });
                    } else {
                        persCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-user-tie" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>No personnel data. Use AI Auto Map to assign personnel.</div>';
                    }
                }

                // 6. Compliance by Department Radar
                const radarCtx = document.getElementById('dept-compliance-radar');
                if (radarCtx) {
                    const rDeptData = {};
                    d.hydratedProgress.forEach(item => {
                        if (!item.department) return;
                        if (!rDeptData[item.department]) rDeptData[item.department] = { total: 0, conform: 0 };
                        rDeptData[item.department].total++;
                        if (item.status === 'conform') rDeptData[item.department].conform++;
                    });
                    const rLabels = Object.keys(rDeptData).sort();
                    if (rLabels.length >= 3) {
                        new Chart(radarCtx.getContext('2d'), {
                            type: 'radar',
                            data: {
                                labels: rLabels,
                                datasets: [{
                                    label: 'Conformance %',
                                    data: rLabels.map(rl => rDeptData[rl].total > 0 ? Math.round((rDeptData[rl].conform / rDeptData[rl].total) * 100) : 0),
                                    borderColor: '#6366f1',
                                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                    borderWidth: 2,
                                    pointBackgroundColor: '#6366f1'
                                }]
                            },
                            options: { responsive: true, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { stepSize: 25, font: { size: 9 } }, pointLabels: { font: { size: 10 } } } } }
                        });
                    } else {
                        radarCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-chart-radar" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>Need 3+ departments for radar chart. Use AI Auto Map.</div>';
                    }
                }
            }

            // Load Chart.js if not already loaded
            if (typeof Chart !== 'undefined') {
                renderCharts();
            } else {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
                s.onload = renderCharts;
                document.head.appendChild(s);
            }
        };

        // Init charts after DOM settles
        setTimeout(() => window._initPreviewCharts(), 300);
    };

    // Persist preview toggle choices to report.reportConfig so re-opening the preview
    // (or exporting) remembers what the auditor selected, instead of always resetting.
    const _persistReportConfig = function () {
        const d = window._reportPreviewData;
        if (!d || !d.report) return;
        try {
            d.report.reportConfig = d.report.reportConfig || {};
            d.report.reportConfig.sectionToggles = Object.assign({}, window._reportSectionState || {});
            d.report.reportConfig.annexes = Object.assign({}, window._reportAnnexState || {});
            if (window.DataService && typeof window.DataService.syncAuditReport === 'function') {
                window.DataService.syncAuditReport(d.report.id, { reportConfig: d.report.reportConfig });
            } else if (typeof window.saveData === 'function') {
                window.saveData();
            }
        } catch (_e) { /* noop — persistence is best-effort, preview state still updates */ }
    };
    window._persistReportConfig = _persistReportConfig;

    // Sidebar include/exclude toggle. The row keeps the historical 'pill-<id>'
    // element id; styling is class-driven (.rp-side-item[.active] + --sec-color)
    // so this only flips state, the class, the checkbox, and the section.
    window.toggleReportSection = function (id, _color) {
        const row = document.getElementById('pill-' + id);
        const sec = document.getElementById('sec-' + id);
        if (!row) return;
        const nowActive = !row.classList.contains('active');
        window._reportSectionState[id] = nowActive;
        row.classList.toggle('active', nowActive);
        const cb = row.querySelector('input[type=checkbox]');
        if (cb) cb.checked = nowActive;
        if (sec) sec.style.display = nowActive ? '' : 'none';
        _persistReportConfig();
    };

    // Sidebar row click: scroll the preview pane to that section.
    window.scrollToReportSection = function (id) {
        const sec = document.getElementById('sec-' + id);
        if (sec && sec.style.display !== 'none') sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Annex master toggle checkbox (Management Analytics / Evidence / CAPA annexes).
    // CSP-safe: wired via data-action, not inline onclick.
    window.toggleReportAnnex = function (group) {
        if (!window._reportAnnexState) window._reportAnnexState = {};
        window._reportAnnexState[group] = !window._reportAnnexState[group];
        const cb = document.getElementById('annex-toggle-' + group);
        if (cb) cb.checked = !!window._reportAnnexState[group];
        _persistReportConfig();
    };

    // ============================================
    // AI AUTO-CLASSIFY & POLISH (Combined: classify severity + refine notes)
    // ============================================
    window.runFollowUpAIAnalysis = async function (reportId) {
        const btn = document.getElementById('btn-ai-classify');
        if (!btn) return;

        // Get the report and standard
        const reports = window.state?.auditReports || JSON.parse(localStorage.getItem('audit_reports') || '[]');
        const report = reports.find(r => String(r.id) === String(reportId));
        if (!report) { window.showNotification('Report not found.', 'error'); return; }

        const standardName = report.standard || '';
        const _checklistProgress = report.checklistProgress || [];

        // Check AI service availability
        if (!window.AI_SERVICE) {
            window.showNotification('AI Service not available.', 'warning');
            return;
        }

        // Show loading state
        const originalBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Classifying & Polishing...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            // STEP 1: Collect all findings from the DOM
            const findingCards = document.querySelectorAll('.review-severity');
            const findings = [];
            findingCards.forEach(select => {
                const fid = select.dataset.findingId;
                const textarea = document.querySelector('.review-remarks[data-finding-id="' + fid + '"]');
                const remarkText = textarea?.value || '';
                const card = select.closest('.card');
                const clauseEl = card?.querySelector('[style*="font-weight: 700"]');
                const clause = clauseEl?.textContent?.match(/[\d.]+/)?.[0] || '';

                const descEl = card?.querySelector('[style*="color: #334155"]') || card?.querySelector('[style*="color:#334155"]');
                const reqEl = card?.querySelector('[style*="color: var(--primary-color)"]');
                const descText = descEl?.textContent?.trim() || '';
                const reqText = reqEl?.parentElement?.textContent?.trim() || '';
                findings.push({
                    id: fid,
                    clause: clause,
                    status: select.value,
                    comment: remarkText,
                    remarks: remarkText,
                    type: select.value,
                    description: descText || reqText,
                    requirement: reqText
                });
            });

            if (findings.length === 0) {
                window.showNotification('No findings to process.', 'info');
                btn.innerHTML = originalBtnHtml;
                btn.disabled = false;
                btn.style.opacity = '1';
                return;
            }

            let classifyCount = 0;
            let polishCount = 0;
            let generateCount = 0;

            // STEP 2: Severity classification is PRESERVED as-is (set by auditor/senior reviewer)
            // AI does NOT change severity — it only polishes text below

            // STEP 2.5: AI Generate Conformance Text (for findings with empty remarks)
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Generating conformance text...';
            if (window.AI_SERVICE.generateConformanceText) {
                try {
                    const emptyFindings = findings.filter(f => !f.comment || f.comment.trim().length < 5);
                    if (emptyFindings.length > 0) {
                        const generated = await window.AI_SERVICE.generateConformanceText(emptyFindings, standardName);
                        if (generated && Array.isArray(generated)) {
                            generated.forEach((result, i) => {
                                if (result.comment && result._aiGenerated) {
                                    const textarea = document.querySelector('.review-remarks[data-finding-id="' + emptyFindings[i].id + '"]');
                                    if (textarea) {
                                        textarea.value = result.comment;
                                        // Also update the finding object for later save
                                        const origIdx = findings.findIndex(f => f.id === emptyFindings[i].id);
                                        if (origIdx >= 0) findings[origIdx].comment = result.comment;
                                        generateCount++;
                                        // Flash blue for generated items
                                        textarea.style.transition = 'background 0.3s';
                                        textarea.style.background = '#eff6ff';
                                        setTimeout(() => { textarea.style.background = ''; }, 3000);
                                    }
                                }
                            });
                        }
                    }
                } catch (genErr) {
                    console.warn('Conformance text generation error (continuing with polish):', genErr);
                }
            }

            // STEP 3: AI Polish Notes (refine raw text to professional language)
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Polishing notes...';
            if (window.AI_SERVICE.refineAuditNotes) {
                try {
                    const toPolish = findings.filter(f => f.comment && f.comment.trim());
                    if (toPolish.length > 0) {
                        const refined = await window.AI_SERVICE.refineAuditNotes(toPolish, standardName);
                        if (refined && Array.isArray(refined)) {
                            refined.forEach((result, i) => {
                                if (result.comment && result.comment !== toPolish[i].comment) {
                                    const textarea = document.querySelector('.review-remarks[data-finding-id="' + toPolish[i].id + '"]');
                                    if (textarea) {
                                        textarea.value = result.comment;
                                        polishCount++;
                                        // Flash green for polished items
                                        textarea.style.transition = 'background 0.3s';
                                        textarea.style.background = '#f0fdf4';
                                        setTimeout(() => { textarea.style.background = ''; }, 2500);
                                    }
                                }
                            });
                        }
                    }
                } catch (polishErr) {
                    console.warn('Polish error:', polishErr);
                }
            }

            // STEP 4: Auto-save to DB by updating the report object and persisting
            findingCards.forEach(select => {
                const fid = select.dataset.findingId;
                const newType = select.value;
                const textarea = document.querySelector('.review-remarks[data-finding-id="' + fid + '"]');
                const remarks = textarea?.value || '';

                if (fid.startsWith('checklist-')) {
                    const idx = parseInt(fid.replace('checklist-', ''), 10);
                    if (report.checklistProgress && report.checklistProgress[idx]) {
                        report.checklistProgress[idx].ncrType = newType;
                        if (remarks) report.checklistProgress[idx].comment = remarks;
                    }
                } else if (fid.startsWith('ncr-')) {
                    const idx = parseInt(fid.replace('ncr-', ''), 10);
                    if (report.ncrs && report.ncrs[idx]) {
                        report.ncrs[idx].type = newType;
                        if (remarks) report.ncrs[idx].description = remarks;
                    }
                }
            });

            // Persist to localStorage
            const existingReports = JSON.parse(localStorage.getItem('audit_reports') || '[]');
            const rIdx = existingReports.findIndex(r => r.id === reportId);
            if (rIdx !== -1) {
                existingReports[rIdx] = report;
                localStorage.setItem('audit_reports', JSON.stringify(existingReports));
            }

            // Persist to Supabase
            if (window.SupabaseClient?.db?.upsert) {
                try {
                    await window.SupabaseClient.db.upsert('audit_reports', {
                        id: String(reportId),
                        checklist_progress: report.checklistProgress || [],
                        ncrs: report.ncrs || [],
                        data: report || {}
                    });
                } catch (dbErr) {
                    console.warn('DB save after AI classify:', dbErr);
                }
            }

            // Success UI
            const parts = [];
            if (classifyCount) parts.push(classifyCount + ' classified');
            if (generateCount) parts.push(generateCount + ' generated');
            if (polishCount) parts.push(polishCount + ' polished');
            btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 0.5rem;"></i> Done! ' + (parts.join(', ') || 'No changes');
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            window.showNotification('AI: ' + (parts.join(', ') || 'No changes needed') + '. All saved.', 'success');

        } catch (error) {
            console.error('AI Classify & Polish error:', error);
            btn.innerHTML = originalBtnHtml;
            window.showNotification('AI processing failed: ' + error.message, 'error');
        }

        // Reset button after 4s
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> AI Auto-Classify & Polish';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.background = 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)';
        }, 4000);
    };

    // ============================================
    // POLISH NOTES WITH AI (Refine raw notes into professional audit language)
    // ============================================
    window.polishNotesWithAI = async function () {
        const d = window._reportPreviewData;
        if (!d) return;
        const btn = document.getElementById('ai-polish-btn');
        if (!btn) return;

        // Check if AI service is available
        if (!window.AI_SERVICE?.refineAuditNotes) {
            window.showNotification('AI Service not available. Please check your API configuration.', 'warning');
            return;
        }

        // Show loading state
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Polishing Notes...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            const standardName = d.report.standard || d.auditPlan?.standard || '';
            // Step 1: Generate AI text for conformance items with empty comments
            if (d.hydratedProgress && d.hydratedProgress.length > 0 && window.AI_SERVICE.generateConformanceText) {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Generating conformance text...';
                try {
                    const emptyConformItems = d.hydratedProgress
                        .map((item, idx) => ({ ...item, _hpIdx: idx }))
                        .filter(item => item.status === 'conform' && (!item.comment || item.comment.trim().length < 5));

                    if (emptyConformItems.length > 0) {
                        const conformFindings = emptyConformItems.map(item => ({
                            id: `conform-${item._hpIdx}`,
                            clause: item.kbMatch ? item.kbMatch.clause : item.clause,
                            status: 'conform',
                            type: 'conform',
                            description: (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || ''),
                            comment: item.comment || '',
                            requirement: (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || '')
                        }));

                        const generated = await window.AI_SERVICE.generateConformanceText(conformFindings, standardName);
                        if (generated && Array.isArray(generated)) {
                            generated.forEach((result, i) => {
                                if (result.comment && result._aiGenerated) {
                                    const hpIdx = emptyConformItems[i]._hpIdx;
                                    d.hydratedProgress[hpIdx].comment = result.comment;
                                    d.hydratedProgress[hpIdx]._aiGenerated = true;
                                }
                            });
                        }
                    }
                } catch (conformErr) {
                    console.warn('Conformance text generation error (continuing with polish):', conformErr);
                }
            }

            // Step 2: Refine/polish all checklist progress notes
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Polishing Notes...';
            if (d.hydratedProgress && d.hydratedProgress.length > 0) {
                const refined = await window.AI_SERVICE.refineAuditNotes(d.hydratedProgress, standardName);
                d.hydratedProgress = refined;
            }

            // Refine NCR descriptions
            if (d.report.ncrs && d.report.ncrs.length > 0) {
                const ncrFindings = d.report.ncrs.map(n => ({
                    clause: n.clause,
                    status: 'nc',
                    type: n.type,
                    comment: n.description || '',
                    remarks: n.description || ''
                }));
                const refinedNCRs = await window.AI_SERVICE.refineAuditNotes(ncrFindings, standardName);
                d.report.ncrs = d.report.ncrs.map((ncr, i) => ({
                    ...ncr,
                    description: refinedNCRs[i]?.comment || ncr.description,
                    _originalDescription: ncr.description
                }));
            }

            // Step 3: Generate AI-powered conclusion
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Generating conclusion...';
            try {
                const ncTotal = d.stats.ncCount;
                const obsTotal = d.stats.observationCount + d.stats.ofiCount;
                const _conformRate = d.stats.complianceScore;
                // Deterministic recommendation sentence — never AI-authored. The prompt
                // instructs the model to reproduce it verbatim so the certification
                // decision language stays audit-type-correct (e.g. a surveillance audit
                // must never read "Recommended for Certification").
                const deterministicRec = (d.stats.rs && d.stats.rs.recommendation) || d.stats.recommendation || 'Certification recommendation pending.';
                const conclusionPrompt = `You are a Senior Lead Auditor at a top-tier Certification Body. Write a formal audit conclusion (150-200 words) for the following audit:

Client: ${d.report.client}
Standard: ${standardName}
Audit Type: ${d.auditPlan?.auditType || d.auditPlan?.type || 'Certification Audit'}
Items Audited: ${d.stats.totalItems} | Conforming: ${d.stats.conformCount} | NC: ${ncTotal} (${d.stats.majorNC} Major, ${d.stats.minorNC} Minor) | Observations: ${obsTotal}
Recommendation: ${d.report.recommendation || 'Pending'}
Deterministic recommendation sentence (mandatory, audit-type-verified — reproduce this recommendation wording verbatim; do not rephrase it): "${deterministicRec}"

CRITICAL RULES — CCI Gold Standard:
- Do NOT use percentage scoring or compliance percentages
- Use legally defensible, accreditation-ready language
- Follow ISO 17021 certification body reporting requirements
- The final sentence of the conclusion MUST be exactly the deterministic recommendation sentence above, reproduced verbatim — do not rephrase, summarize, or substitute your own wording for it

Instructions:
1. State whether the management system has demonstrated conformity with the standard
2. Reference the number of non-conformities and observations raised
3. ${ncTotal > 0 ? 'State that corrective actions must be submitted within the specified timeframes' : 'Note that no non-conformities were identified'}
4. Conclude the conclusion with the deterministic recommendation sentence above, verbatim
5. Use measured, authoritative language befitting 30+ years of audit experience

Return ONLY the conclusion text, no JSON, no formatting.`;

                const response = await window.AI_SERVICE.callProxyAPI(conclusionPrompt);
                const conclusionText = window.AI_SERVICE.extractTextFromResponse ? window.AI_SERVICE.extractTextFromResponse(response) : (typeof response === 'string' ? response : '');
                if (conclusionText && conclusionText.trim().length > 50) {
                    const conclusionEl = document.getElementById('rp-conclusion');
                    if (conclusionEl) {
                        conclusionEl.innerHTML = conclusionText.trim();
                        conclusionEl.style.background = '#f0fdf4';
                        conclusionEl.style.borderColor = '#22c55e';
                        setTimeout(() => { conclusionEl.style.background = ''; conclusionEl.style.borderColor = ''; }, 3000);
                    }
                }
            } catch (conclusionErr) {
                console.warn('AI conclusion generation error (continuing):', conclusionErr);
            }

            // Update the findings table in the preview if visible
            const findingsBody = document.getElementById('findings-table-body');
            if (findingsBody && d.hydratedProgress) {
                const items = d.hydratedProgress.filter(i => i.status !== 'pending');
                findingsBody.innerHTML = items.map((item, idx) => {
                    const clause = displayCriterion(item, item.status === 'nc');
                    const sevRaw = item.status === 'nc' ? (item.ncrType || 'NC') : item.status === 'observation' ? 'OBS' : 'OK';
                    const sev = sevRaw;
                    const sevLc = String(sevRaw).toLowerCase();
                    const sevColor = sevLc === 'major' ? '#dc2626' : (sevLc === 'minor' || sevLc === 'nc') ? '#f59e0b' : sevLc === 'obs' ? '#3b82f6' : '#10b981';
                    return '<tr style="background:' + (idx % 2 ? '#f8fafc' : 'white') + ';"><td style="padding:8px 12px;font-weight:600;">' + clause + '</td><td style="padding:8px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:10px;font-size:0.75rem;font-weight:700;color:' + sevColor + ';">' + sev + '</span></td><td style="padding:8px 12px;color:#334155;font-size:0.88rem;line-height:1.6;">' + (fmtRemark(item.comment) || '-') + '</td></tr>';
                }).join('');
            }

            // Also refresh the conformance table to show AI-generated remarks
            const conformSec = document.querySelector('#sec-conformance .rp-sec-body tbody');
            if (conformSec && d.hydratedProgress) {
                const renderEvThumbs = (item) => {
                    const imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
                    if (!imgs.length) return '';
                    return '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">' + imgs.map(src => '<img src="' + src + '" data-ev-thumb="1" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0;cursor:pointer;" data-action="openImageInNewTab">').join('') + '</div>';
                };
                const conformItems = d.hydratedProgress.filter(i => i.status === 'conform');
                conformSec.innerHTML = conformItems.map((item, idx) => {
                    const clause = displayCriterion(item, false);
                    const title = item.kbMatch ? item.kbMatch.title : '';
                    const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
                    return '<tr style="background:' + (idx % 2 ? '#f0fdf4' : 'white') + ';"><td style="padding:10px 14px;font-weight:700;">' + clause + '</td><td style="padding:10px 14px;">' + (title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req) + '</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#dcfce7;color:#166534;"><i class="fa-solid fa-check" style="margin-right:4px;"></i>Conform</span></td><td style="padding:10px 14px;color:#334155;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks</span>') + renderEvThumbs(item) + '</td></tr>';
                }).join('') || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No conformance evidence recorded</td></tr>';
            }

            // Success state
            btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right:6px;"></i>Notes Polished!';
            btn.style.background = 'linear-gradient(135deg,#f0fdf4,#dcfce7)';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#166534';
            btn.style.opacity = '1';

            const totalRefined = (d.hydratedProgress?.filter(i => i._originalComment || i._aiGenerated)?.length || 0) + (d.report.ncrs?.filter(n => n._originalDescription)?.length || 0);
            window.showNotification(`AI polished ${totalRefined} auditor notes into professional language!`, 'success');

            // Allow re-polish after 3 seconds
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.background = 'linear-gradient(135deg,#f0f9ff,#e0f2fe)';
                btn.style.borderColor = '#0ea5e9';
                btn.style.color = '#0369a1';
            }, 3000);

        } catch (error) {
            console.error('AI Polish Error:', error);
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            btn.style.opacity = '1';
            window.showNotification('AI polish failed: ' + error.message, 'error');
        }
    };

    // ============================================
    // POLISH SINGLE FINDING NOTE (Per-finding AI refinement)
    // ============================================
    window.polishSingleNote = async function (btn) {
        if (!btn || btn.disabled) return;
        const findingId = btn.getAttribute('data-finding-id');
        if (!findingId) return;

        // Find the textarea in the same parent
        const textarea = btn.parentElement.querySelector('textarea.review-remarks');
        if (!textarea || !textarea.value.trim()) {
            window.showNotification('No remarks to polish. Write some notes first.', 'info');
            return;
        }

        if (!window.AI_SERVICE?.refineAuditNotes) {
            window.showNotification('AI Service not available.', 'warning');
            return;
        }

        // Save original and show loading
        const originalText = textarea.value;
        const originalBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:0.7rem;"></i> Polishing...';
        btn.disabled = true;
        btn.style.opacity = '0.6';

        try {
            // Get clause context from the finding card
            const card = btn.closest('.review-finding-card, [data-finding-id]') || btn.parentElement.parentElement;
            const clauseEl = card?.querySelector('[style*="font-weight: 700"], [style*="font-weight:700"]');
            const clause = clauseEl?.textContent?.trim() || '';

            // Get standard name
            const d = window._reportPreviewData || {};
            const standardName = d?.report?.standard || d?.auditPlan?.standard || '';

            // Build single finding for AI
            const finding = [{
                clause: clause,
                status: 'finding',
                comment: originalText,
                remarks: originalText
            }];

            const refined = await window.AI_SERVICE.refineAuditNotes(finding, standardName);

            if (refined[0]?.comment && refined[0].comment !== originalText) {
                textarea.value = refined[0].comment;
                textarea.style.transition = 'background 0.3s';
                textarea.style.background = '#f0fdf4';
                setTimeout(() => { textarea.style.background = ''; }, 2000);

                // Success state
                btn.innerHTML = '<i class="fa-solid fa-check" style="font-size:0.7rem;"></i> Polished!';
                btn.style.background = '#dcfce7';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#166534';
            } else {
                btn.innerHTML = originalBtnHtml;
                window.showNotification('Notes already look professional!', 'info');
            }
        } catch (error) {
            console.error('Single note polish error:', error);
            textarea.value = originalText;
            btn.innerHTML = originalBtnHtml;
            window.showNotification('AI polish failed. Try again.', 'error');
        }

        // Reset button after 3s
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" style="font-size:0.7rem;"></i>Polish with AI';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.background = '#f0f9ff';
            btn.style.borderColor = '#0ea5e9';
            btn.style.color = '#0369a1';
        }, 3000);
    };

    // ============================================
    // EXPORT REPORT PDF (Premium ISO-Compliant)
    // ============================================
    // EVIDENCE PACK — a separate print blob carrying the full-resolution evidence images that
    // were removed from the main report to keep its size bounded. Same report reference/EV ids
    // as the main report's Evidence Index table, so the two documents cross-reference cleanly.
    // ============================================
    window.exportEvidencePack = function (_reportId) {
        const d = window._reportPreviewData;
        if (!d) { window.showNotification && window.showNotification('Open the report preview first.', 'warning'); return; }
        const evIdx = (d.report._evidenceIndexBuilt || []);
        if (evIdx.length === 0) {
            window.showNotification ? window.showNotification('No evidence images recorded for this report.', 'info') : alert('No evidence images recorded for this report.');
            return;
        }
        const esc = window.UTILS && window.UTILS.escapeHtml ? window.UTILS.escapeHtml : function (s) { return String(s == null ? '' : s); };
        const fmtWhen = function (v) {
            if (!v) return 'Not recorded';
            const dt = new Date(v);
            return isNaN(dt.getTime()) ? 'Not recorded' : dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        };
        // "Report Ref" on the Evidence Pack must match the main report's canonical
        // ref, not the audit plan's — this was previously pulling getPlanRef
        // directly (a different value from the cover/footer's Report ID).
        const planRef = reportRef(d);
        const cbName = (d.cbSettings && d.cbSettings.cbName) || '';
        const standard = d.report.standard || (d.auditPlan && d.auditPlan.standard) || 'ISO Standard';

        const cards = evIdx.map(function (ev) {
            return '<div class="ep-card page-break">'
                + '<div class="ep-card-hdr"><span class="ep-id">' + esc(ev.evId) + '</span><span class="ep-ref">Report Ref: ' + esc(planRef) + '</span></div>'
                + '<img src="' + ev.image + '" class="ep-img" alt="Evidence ' + esc(ev.evId) + '">'
                + '<table class="ep-meta">'
                +   '<tr><td>Description</td><td>' + esc(cleanEvidenceText(ev.comment) || 'Not recorded') + '</td></tr>'
                +   '<tr><td>Clause / Requirement</td><td>' + esc(ev.clause || 'Not recorded') + '</td></tr>'
                +   '<tr><td>Related Finding</td><td>' + esc(ev.findingRef || 'Not recorded') + '</td></tr>'
                +   '<tr><td>Department / Site</td><td>' + esc(ev.dept || 'Not recorded') + '</td></tr>'
                +   '<tr><td>Captured</td><td>' + esc(fmtWhen(ev.capturedAt)) + '</td></tr>'
                +   '<tr><td>Location</td><td>' + esc(ev.location || 'Not recorded') + '</td></tr>'
                +   '<tr><td>Uploaded By</td><td>' + esc(ev.uploadedBy || d.report.leadAuditor || 'Not recorded') + '</td></tr>'
                + '</table>'
                + '</div>';
        }).join('');

        const packHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
            + '<title>Evidence Pack — ' + esc(d.report.client || '') + '</title>'
            + '<style>'
            + "*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;background:white;}"
            + '@page{size:A4;margin:18mm 14mm;}'
            + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page-break{page-break-before:always;}}'
            + '.ep-cover{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border-top:6px solid #c2410c;padding:60px;}'
            + '.ep-cover h1{font-size:2.2rem;color:#0f172a;letter-spacing:1px;}'
            + '.ep-cover p{color:#64748b;margin-top:10px;}'
            + '.ep-conf{margin-top:40px;padding:10px 20px;background:#fff7ed;color:#c2410c;font-weight:700;border-radius:8px;font-size:0.8rem;letter-spacing:0.05em;}'
            + '.ep-card{padding:24px;}'
            + '.ep-card-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:0.78rem;color:#64748b;font-weight:700;}'
            + '.ep-id{background:#c2410c;color:white;padding:3px 10px;border-radius:6px;font-size:0.82rem;}'
            + '.ep-img{width:100%;max-height:420px;object-fit:contain;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;}'
            + '.ep-meta{width:100%;margin-top:14px;border-collapse:collapse;font-size:0.85rem;}'
            + '.ep-meta td{padding:8px 10px;border-bottom:1px solid #eef2f6;vertical-align:top;}'
            + '.ep-meta td:first-child{width:24%;color:#64748b;font-weight:600;text-transform:uppercase;font-size:0.7rem;letter-spacing:0.04em;}'
            + '</style></head><body>'
            + '<div class="ep-cover">'
            + '<h1>EVIDENCE PACK</h1>'
            + '<p>' + esc(standard) + ' &mdash; ' + esc(d.report.client || '') + '</p>'
            + '<p>Report Ref: ' + esc(planRef) + '</p>'
            + '<div class="ep-conf">CONFIDENTIAL &mdash; issued with, and referencing, the corresponding audit report</div>'
            + '</div>'
            + cards
            + '</body></html>';

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), packHtml], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank');
        if (!win) {
            URL.revokeObjectURL(blobUrl);
            window.showNotification ? window.showNotification('Pop-up blocked. Please allow pop-ups for this site.', 'warning') : alert('Pop-up blocked. Please allow pop-ups for this site.');
            return;
        }
        setTimeout(function () { try { win.print(); } catch (_e) { /* noop */ } }, 800);
        setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 60000);
    };

    window.exportReportPDF = function () {
        const d = window._reportPreviewData;
        if (!d) return;

        // ─── Build-time evidence thumbnails ─────────────────────────────────
        // The main report must never embed full-resolution evidence (older
        // findings predate the capture-time thumb pipeline, so they carry only
        // 1600px evidenceImages — ~125KB each printed at 80px, and the print-
        // window downscale pass can lose the race against print). Backfill
        // item.evidenceThumbs here, once, BEFORE building the HTML —
        // renderEvThumbsPdf already prefers thumbs, so the print document
        // simply never contains the full-res versions.
        if (window.EvidenceUtils && typeof window.EvidenceUtils.thumb === 'function') {
            const pendingThumbs = [];
            (d.hydratedProgress || []).forEach(function (item) {
                if (!item) return;
                const fulls = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
                if (!fulls.length) return;
                // A "thumb" identical to its full image means thumbnailing failed
                // earlier and fell back to the original (getEvVariants swallows the
                // error) — that is exactly the case worth retrying here, so only
                // skip when every thumb genuinely differs from its source.
                const thumbsOk = Array.isArray(item.evidenceThumbs)
                    && item.evidenceThumbs.length === fulls.length
                    && item.evidenceThumbs.every(function (t, i) { return t && t !== fulls[i]; });
                if (thumbsOk) return;
                pendingThumbs.push(
                    Promise.all(fulls.slice(0, 4).map(function (u) {
                        return Promise.resolve(window.EvidenceUtils.thumb(u, { maxPx: 480, quality: 0.72 }))
                            .then(function (t) { return t || u; })
                            .catch(function () { return u; });
                    })).then(function (thumbs) { item.evidenceThumbs = thumbs; })
                );
            });
            if (pendingThumbs.length) {
                if (window.showNotification) window.showNotification('Optimizing evidence images for export…', 'info');
                Promise.all(pendingThumbs).then(function () {
                    if (typeof window.saveData === 'function') window.saveData();
                    window.exportReportPDF();
                });
                return;
            }
        }

        const en = window._reportSectionState || {};
        // Report status ('draft'|'final') controls the DRAFT watermark. Version bumps no
        // longer happen on export — only finalizeAndPublish (ai-service.js) bumps version,
        // recorded to report.issueLog[].
        if (!d.report.reportStatus) d.report.reportStatus = 'draft';
        const revisionRows = window._getRevisionRows(d.report, d.today);
        const technicalReviewForDist = resolveTechnicalReview(d.report);
        // Distribution list: capture the operator's edits to the contenteditable tbody,
        // sanitized to strip anything but simple table/text markup, falling back to the
        // original default rows if the region was never touched (or was cleared out).
        const defaultDistributionRows =
            '<tr><td>1</td><td style="font-weight:600;">' + (d.report.leadAuditor || 'Lead Auditor') + '</td><td>Lead Auditor</td><td>' + (d.cbName || 'Certification Body') + '</td><td>Original</td></tr>'
            + '<tr><td>2</td><td style="font-weight:600;">' + (technicalReviewForDist.reviewer || 'Technical Reviewer') + '</td><td>Technical Reviewer</td><td>' + (d.cbName || 'Certification Body') + '</td><td>Copy</td></tr>'
            + '<tr><td>3</td><td style="font-weight:600;">' + d.report.client + '</td><td>Client Representative</td><td>' + d.report.client + '</td><td>Copy</td></tr>'
            + '<tr><td>4</td><td>Certification Records</td><td>File / Archive</td><td>' + (d.cbName || 'Certification Body') + '</td><td>Archive</td></tr>';
        let editedDistribution = document.getElementById('rp-distribution')?.innerHTML || '';
        editedDistribution = editedDistribution.replace(/&nbsp;/g, ' ').trim();
        if (editedDistribution && window.Sanitizer && window.Sanitizer.sanitizeHTML) {
            editedDistribution = window.Sanitizer.sanitizeHTML(editedDistribution, {
                ALLOWED_TAGS: ['tr', 'td', 'th', 'span', 'strong', 'em', 'b', 'i', 'br'],
                ALLOWED_ATTR: ['style', 'colspan', 'rowspan']
            });
        }
        // Guard against a tbody left with only whitespace/empty tags after sanitization
        const distributionRows = (editedDistribution && editedDistribution.replace(/<[^>]*>/g, '').trim())
            ? editedDistribution : defaultDistributionRows;
        let editedSummary = document.getElementById('rp-exec-summary')?.innerHTML || d.report.executiveSummary || '';
        editedSummary = editedSummary.replace(/<em[^>]*>Click to add executive summary[^<]*<\/em>/gi, '').trim();
        let editedConclusion = document.getElementById('rp-conclusion')?.innerHTML || d.report.conclusion || '';
        // Strip placeholder text that leaks from contenteditable
        editedConclusion = editedConclusion.replace(/Click to edit this conclusion\.?/gi, '').trim();
        const editedPositiveObs = document.getElementById('rp-positive-obs')?.innerHTML || d.report.positiveObservations || '';
        const editedOfi = document.getElementById('rp-ofi')?.innerHTML || (Array.isArray(d.report.ofi) ? d.report.ofi.join('\n') : (d.report.ofi || ''));
        const editedOpeningNotes = document.getElementById('rp-opening-notes')?.innerText || d.report.openingMeeting?.notes || '';
        let editedClosingSummary = document.getElementById('rp-closing-summary')?.innerText || d.report.closingMeeting?.summary || '';
        editedClosingSummary = editedClosingSummary.replace(/Click to add closing meeting summary[.]*/gi, '').trim();
        // Capture new editable fields
        const editedObjectives = document.getElementById('rp-objectives')?.innerText || d.auditPlan?.auditObjectives || '';
        const editedCriteria = document.getElementById('rp-criteria')?.innerText || d.auditPlan?.auditCriteria || '';
        const editedMethodology = document.getElementById('rp-methodology')?.innerText || d.auditPlan?.auditMethodology || '';
        const editedChanges = document.getElementById('rp-changes')?.innerText || d.report.changesSinceLastAudit || '';
        // Audit type helpers — drives PREVIOUS FINDINGS STATUS and MANAGEMENT SYSTEM
        // EFFECTIVENESS section defaults (ISO 17021-1 §9.4.8 / Big-CB practice).
        const auditTypeStr = String(d.auditPlan?.auditType || '').toLowerCase();
        const isSurveillanceOrRecert = /surveillance|recert/.test(auditTypeStr);
        const isInitialOrStage = /initial|stage/.test(auditTypeStr) || !auditTypeStr;
        let editedPrevFindings = document.getElementById('rp-prev-findings')?.innerText || d.report.previousFindingsStatus || '';
        editedPrevFindings = editedPrevFindings.replace(/Click to edit[^.]*\.?/gi, '').trim();
        const editedUnresolved = document.getElementById('rp-unresolved')?.innerText || d.report.unresolvedIssues || 'None. All findings were acknowledged by the auditee at the closing meeting.';
        const editedEffInternalAudit = document.getElementById('rp-eff-internal-audit')?.innerText || d.report.effInternalAudit || 'Implemented and effective; conforms to the requirements of the standard.';
        const editedEffMgmtReview = document.getElementById('rp-eff-mgmt-review')?.innerText || d.report.effMgmtReview || 'Implemented and effective; conforms to the requirements of the standard.';
        const editedEffComplaints = document.getElementById('rp-eff-complaints')?.innerText || d.report.effComplaints || 'Implemented and effective; conforms to the requirements of the standard.';
        const editedEffMarks = document.getElementById('rp-eff-marks')?.innerText || d.report.effMarks || (isInitialOrStage ? 'Not applicable — initial certification audit.' : 'Usage verified as conforming to CB rules.');
        const editedEffLegal = document.getElementById('rp-eff-legal')?.innerText || d.report.effLegal || 'Implemented and effective; conforms to the requirements of the standard.';
        const technicalReview = resolveTechnicalReview(d.report);
        const editedReviewerName = technicalReview.reviewer || '';
        const editedSigDate = document.getElementById('rp-sig-date')?.innerText || new Date().toLocaleDateString('en-GB');
        const editedReviewerDate = document.getElementById('rp-reviewer-date')?.value || technicalReview.date || '';
        const modifiedSinceIssue = window._isModifiedSinceIssue(d);
        const editedProgS1 = document.getElementById('rp-prog-s1')?.innerText || '';
        const editedProgS2 = document.getElementById('rp-prog-s2')?.innerText || '';
        const editedProgSv1 = document.getElementById('rp-prog-sv1')?.innerText || '';
        const editedProgSv2 = document.getElementById('rp-prog-sv2')?.innerText || '';
        const editedProgRecert = document.getElementById('rp-prog-recert')?.innerText || '';
        const editedSiteSamplingNote = document.getElementById('rp-site-sampling-note')?.innerText || '';
        const _formatText = (text) => { if (!text) return ''; return text.replace(/\\n/g, '<br>').replace(/\n/g, '<br>').replace(/\*\*\*([^*]+)\*\*\*/g, '<strong>$1</strong>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\(Clause ([^)]+)\)/g, '<em style="font-size:0.9em;color:#059669;">(Clause $1)</em>'); };
        // Rich text formatter for PDF: handles numbered lists, bullets, paragraphing, markdown
        const formatRichText = (text, color) => {
            if (!text) return '';
            const clr = color || '#334155';
            // Normalize HTML from contenteditable
            let t = text.replace(/&nbsp;/g, ' ')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?(div|p|li|ul|ol)[^>]*>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\(Clause ([^)]+)\)/g, '<em style="font-size:0.9em;color:#059669;">(Clause $1)</em>')
                .trim();
            // Detect numbered items: "1. ...", "2) ...", "3- ..."
            let numbered = t.split(/(?:^|\n)\s*(\d+)[.):-]\s*/);
            if (numbered.length > 2) {
                let items = [];
                for (let i = 1; i < numbered.length; i += 2) {
                    let txt = (numbered[i + 1] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    if (txt) items.push(txt);
                }
                if (items.length > 0) {
                    return items.map((obs, idx) =>
                        '<div style="display:flex;gap:10px;margin-bottom:12px;align-items:flex-start;">'
                        + '<div style="min-width:26px;height:26px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.78rem;flex-shrink:0;">' + (idx + 1) + '</div>'
                        + '<div style="flex:1;padding-top:2px;color:' + clr + ';">' + obs + '</div></div>'
                    ).join('');
                }
            }
            // Detect bullet items: "- ...", "• ...", "▸ ..."
            let lines = t.split(/\n+/).filter(s => s.trim().length > 0);
            let bulletLines = lines.filter(s => /^\s*[-\u2022\u2023\u25B8\u25E6\u2013\u2014•]\s/.test(s));
            if (bulletLines.length > 1 && bulletLines.length >= lines.length * 0.5) {
                return lines.map(line => {
                    let isBullet = /^\s*[-\u2022\u2023\u25B8\u25E6\u2013\u2014•]\s*/.test(line);
                    let txt = line.replace(/^\s*[-\u2022\u2023\u25B8\u25E6\u2013\u2014•]\s*/, '').trim();
                    if (isBullet) {
                        return '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">'
                            + '<div style="min-width:8px;height:8px;background:' + clr + ';border-radius:50%;margin-top:7px;flex-shrink:0;opacity:0.6;"></div>'
                            + '<div style="flex:1;color:' + clr + ';">' + txt + '</div></div>';
                    }
                    return '<div style="margin-bottom:10px;color:' + clr + ';font-weight:600;">' + txt + '</div>';
                }).join('');
            }
            // Default: paragraph mode — split on double newlines or treat single newlines as line breaks
            if (lines.length > 1) {
                return lines.map(para => '<p style="margin:0 0 10px 0;color:' + clr + ';">' + para.trim() + '</p>').join('');
            }
            // Single block of text — split into paragraphs every 2-3 sentences for readability
            if (t.length > 200) {
                let sentences = t.split(/(?<=[.!?])\s+/);
                if (sentences.length > 3) {
                    let paras = [];
                    let current = [];
                    for (let i = 0; i < sentences.length; i++) {
                        current.push(sentences[i]);
                        // Break every 2-3 sentences, preferring breaks at topic transitions
                        if (current.length >= 2 && (current.length >= 3 || (i < sentences.length - 1 && /^(The |While |Overall|In |During |Furthermore|Additionally|Moreover|However|Based |Addressing|This )/.test(sentences[i + 1])))) {
                            paras.push(current.join(' '));
                            current = [];
                        }
                    }
                    if (current.length > 0) paras.push(current.join(' '));
                    if (paras.length > 1) {
                        return paras.map(p => '<p style="margin:0 0 12px 0;text-align:justify;color:' + clr + ';">' + p.trim() + '</p>').join('');
                    }
                }
            }
            return '<span style="color:' + clr + ';">' + t + '</span>';
        };
        const formatPositiveObs = (text) => {
            if (!text) return '';
            // Normalize HTML: convert block-level tags and <br> to newlines, strip remaining tags
            let t = text.replace(/&nbsp;/g, ' ')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?(div|p|li|ul|ol)[^>]*>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .trim();
            let items = [];
            // Try numbered splitting: "1. ...", "2) ...", "3- ..."
            let numbered = t.split(/(?:^|\n)\s*(\d+)[.):-]\s*/);
            if (numbered.length > 2) {
                for (let i = 1; i < numbered.length; i += 2) {
                    let txt = (numbered[i + 1] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    if (txt) items.push(txt);
                }
            } else {
                // Fall back to splitting on newlines
                items = t.split(/\n+/).map(s => s.replace(/^\s*[-\u2022\u2023\u25E6]\s*/, '').trim()).filter(s => s.length > 3);
            }
            if (items.length === 0) items = [t.replace(/\n/g, ' ').trim()];
            return items.map((obs, idx) => '<div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">'
                + '<div style="min-width:24px;height:24px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.72rem;flex-shrink:0;margin-top:1px;">' + (idx + 1) + '</div>'
                + '<div style="flex:1;line-height:1.55;">' + obs + '</div></div>').join('');
        };
        const formatOfi = (text) => {
            if (!text) return '';
            let t = text.replace(/&nbsp;/g, ' ')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?(div|p|li|ul|ol)[^>]*>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .trim();
            let items = [];
            let numbered = t.split(/(?:^|\n)\s*(\d+)[.):-]\s*/);
            if (numbered.length > 2) {
                for (let i = 1; i < numbered.length; i += 2) {
                    let txt = (numbered[i + 1] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    if (txt) items.push(txt);
                }
            } else {
                items = t.split(/\n+/).map(s => s.replace(/^\s*[-•‣◦]\s*/, '').trim()).filter(s => s.length > 3);
            }
            if (items.length === 0) items = [t.replace(/\n/g, ' ').trim()];
            return items.map((ofi) => '<div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">'
                + '<div style="min-width:24px;height:24px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;margin-top:1px;"><i class="fa-solid fa-arrow-up" style="font-size:0.7rem;"></i></div>'
                + '<div style="flex:1;line-height:1.6;color:#92400e;">' + ofi + '</div></div>').join('');
        };
        // Note: printWindow opened later via Blob URL (after reportHtml is built)
        // to bypass parent page CSP that blocks inline scripts.
        const clauseLabels = Object.keys(d.stats.ncByClause).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        const clauseValues = clauseLabels.map(k => d.stats.ncByClause[k]);
        const standard = d.report.standard || d.auditPlan?.standard || 'ISO Standard';
        const cbName = d.cbSettings.cbName || '';
        const cbEmail = d.cbSettings.cbEmail || '';
        const _cbSiteAddr = d.cbSite.address ? (d.cbSite.address + ', ' + (d.cbSite.city || '') + ' ' + (d.cbSite.country || '')).trim() : '';
        // Helper: render all evidence images for PDF (string concat)
        let renderEvThumbsPdf = function (item) {
            // Main report uses THUMB variants (small, compressed) — full-res images live only in the Evidence Pack.
            let thumbs = item.evidenceThumbs || (item.evidenceImageThumb ? [item.evidenceImageThumb] : (item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : [])));
            if (!thumbs.length) return '';
            let limited = thumbs.slice(0, 2);
            let extra = thumbs.length > 2 ? ' <span style="font-size:0.75rem;color:#64748b;">(+' + (thumbs.length - 2) + ' more in Evidence Pack)</span>' : '';
            let evIds = (item._evIds && item._evIds.length) ? '<div style="margin-top:3px;font-size:0.68rem;color:#64748b;">' + item._evIds.join(', ') + '</div>' : '';
            return '<div class="ev-inline">' + limited.map(function (url) { return '<img src="' + url + '" style="height:80px;max-width:140px;border-radius:4px;border:1px solid #e2e8f0;object-fit:cover;">'; }).join('') + extra + evIds + '</div>';
        };
        const ncRowsHtml = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() !== 'observation' && (i.ncrType || '').toLowerCase() !== 'ofi').map((item, idx) => {
            const clause = displayCriterion(item);
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            const sevRaw2 = (item.ncrType || '').toLowerCase();
            const sev = sevRaw2 === 'major' ? 'Major' : sevRaw2 === 'minor' ? 'Minor' : 'Minor †';
            const sevBg = sevRaw2 === 'major' ? '#fee2e2' : '#fef3c7';
            const sevFg = sevRaw2 === 'major' ? '#991b1b' : '#92400e';
            const fsKey2 = String(item.clause || '') + '|' + String(item.department || '');
            const fsEntry = d.report.findingStatus && d.report.findingStatus[fsKey2];
            const fsLabelMap = { open: 'Open', corrected_during_audit: 'Corrected During Audit', verified: 'Verified', pending_verification: 'Pending Verification', closed: 'Closed', escalated: 'Escalated' };
            const fsBadge = fsEntry && fsEntry.status ? '<div style="margin-top:6px;"><span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:0.7rem;font-weight:700;background:#eef2ff;color:#3730a3;">Status: ' + (fsLabelMap[fsEntry.status] || fsEntry.status) + '</span></div>' : '';
            return '<tr style="background:' + (idx % 2 ? '#f8fafc' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:' + sevBg + ';color:' + sevFg + ';">' + sev + '</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + fsBadge + '</td></tr>';
        }).join('');

        // OBS rows for PDF (Observations only)
        const obsOnlyRowsHtml = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() === 'observation').map((item, idx) => {
            const clause = displayCriterion(item);
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return '<tr style="background:' + (idx % 2 ? '#f5f3ff' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#ede9fe;color:#6d28d9;">OBS</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + '</td></tr>';
        }).join('');

        // OFI rows for PDF (Opportunities for Improvement only)
        const ofiOnlyRowsHtml = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() === 'ofi').map((item, idx) => {
            const clause = displayCriterion(item);
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return '<tr style="background:' + (idx % 2 ? '#f0fbff' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#e0f7fa;color:#0891b2;">OFI</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + '</td></tr>';
        }).join('');

        // Conformance rows for PDF (items with comments or evidence)
        const conformRowsHtml = d.hydratedProgress.filter(i => i.status === 'conform' && (i.comment || i.evidenceImage || (i.evidenceImages && i.evidenceImages.length))).map((item, idx) => {
            const clause = displayCriterion(item, false);
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return '<tr style="background:' + (idx % 2 ? '#f0fdf4' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#dcfce7;color:#166534;">Conform</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + '</td></tr>';
        }).join('');

        // Build clause/area performance analysis
        const clauseAreaNames = { '4': 'Context of the Organization', '5': 'Leadership', '6': 'Planning', '7': 'Support', '8': 'Operation', '9': 'Performance Evaluation', '10': 'Improvement' };
        const areaStats = {};
        (d.hydratedProgress || []).forEach(function (item) {
            let clause = (item.kbMatch ? item.kbMatch.clause : item.clause) || '';
            let mainC = clause.split('.')[0];
            if (!mainC || !clauseAreaNames[mainC]) return;
            if (!areaStats[mainC]) areaStats[mainC] = { conform: 0, minor: 0, major: 0, obs: 0, ofi: 0 };
            if (item.status === 'conform') areaStats[mainC].conform++;
            else if (item.status === 'nc') {
                let t = (item.ncrType || '').toLowerCase();
                if (t === 'major') areaStats[mainC].major++;
                else if (t === 'minor') areaStats[mainC].minor++;
                else if (t === 'observation') areaStats[mainC].obs++;
                else if (t === 'ofi') areaStats[mainC].ofi++;
                else areaStats[mainC].minor++;
            }
        });
        let areaSortedKeys = Object.keys(areaStats).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
        let areaTableRows = areaSortedKeys.map(function (k) {
            let s = areaStats[k]; var total = s.conform + s.minor + s.major + s.obs + s.ofi;
            let hasIssue = s.major > 0 || s.minor > 0;
            let statusBg = hasIssue ? (s.major > 0 ? '#fee2e2' : '#fef3c7') : '#dcfce7';
            let statusFg = hasIssue ? (s.major > 0 ? '#991b1b' : '#92400e') : '#166534';
            let statusTxt = hasIssue ? (s.major > 0 ? 'Needs Action' : 'Minor Issues') : 'Satisfactory';
            return '<tr><td style="padding:8px 12px;font-weight:600;">Clause ' + k + '</td><td style="padding:8px 12px;">' + clauseAreaNames[k] + '</td><td style="padding:8px 12px;text-align:center;">' + total + '</td><td style="padding:8px 12px;text-align:center;color:#166534;">' + s.conform + '</td><td style="padding:8px 12px;text-align:center;color:#dc2626;">' + (s.major + s.minor) + '</td><td style="padding:8px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:' + statusBg + ';color:' + statusFg + ';">' + statusTxt + '</span></td></tr>';
        }).join('');
        let areaTableHtml = areaSortedKeys.length > 0 ? '<div style="margin-top:16px;page-break-before:always;"><div style="font-size:0.88rem;font-weight:700;color:#1e293b;margin-bottom:8px;">Clause Area Performance Overview</div><table class="info-tbl" style="width:100%;font-size:0.82rem;"><thead><tr style="background:#f1f5f9;"><th style="padding:8px 12px;text-align:left;">Clause</th><th style="padding:8px 12px;text-align:left;">Area</th><th style="padding:8px 12px;text-align:center;">Checked</th><th style="padding:8px 12px;text-align:center;">Conform</th><th style="padding:8px 12px;text-align:center;">NC</th><th style="padding:8px 12px;text-align:center;">Status</th></tr></thead><tbody>' + areaTableRows + '</tbody></table></div>' : '';
        // Serialize area stats for chart script
        let areaChartData = JSON.stringify({ keys: areaSortedKeys, names: areaSortedKeys.map(function (k) { return clauseAreaNames[k]; }), conform: areaSortedKeys.map(function (k) { return areaStats[k].conform; }), nc: areaSortedKeys.map(function (k) { return areaStats[k].major + areaStats[k].minor; }), obs: areaSortedKeys.map(function (k) { return areaStats[k].obs; }), ofi: areaSortedKeys.map(function (k) { return areaStats[k].ofi; }) });

        // Fold a set of internal tracking refs (FOCUS.1, FOCUS.2, … ORG, DOC) into
        // a compact display string, collapsing consecutive numeric runs per prefix
        // — e.g. {FOCUS.1..FOCUS.8, ORG, DOC} -> "FOCUS.1–FOCUS.8, ORG, DOC".
        // Reusable across any Annex-SL-style standard; not tied to a clause set.
        const foldInternalRefs = function (refs) {
            const byPrefix = {};
            const bare = [];
            refs.forEach(function (r) {
                const m = /^(FOCUS|SURV|ORG|DOC)(?:[.\s](\d+))?$/i.exec(String(r || '').trim());
                if (!m) { bare.push(String(r || '').trim()); return; }
                const prefix = m[1].toUpperCase();
                if (m[2] == null) { bare.push(prefix); return; }
                (byPrefix[prefix] = byPrefix[prefix] || []).push(parseInt(m[2], 10));
            });
            const parts = [];
            Object.keys(byPrefix).sort().forEach(function (prefix) {
                const nums = Array.from(new Set(byPrefix[prefix])).sort(function (a, b) { return a - b; });
                let i = 0;
                const runs = [];
                while (i < nums.length) {
                    let j = i;
                    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
                    runs.push(i === j ? (prefix + '.' + nums[i]) : (prefix + '.' + nums[i] + '–' + prefix + '.' + nums[j]));
                    i = j + 1;
                }
                parts.push(runs.join(', '));
            });
            const bareUnique = Array.from(new Set(bare)).filter(Boolean).sort();
            return parts.concat(bareUnique).join(', ');
        };

        // ─── AUDIT TRAILS: checklist items grouped by department/area ────
        // Shows, per department, which personnel were interviewed, which clauses were
        // sampled there, how many items were checked, and the worst outcome found.
        // Real clauses and internal FOCUS/SURV/ORG/DOC tracking refs are tracked
        // and displayed separately — mixing them in one list misrepresents the
        // internal refs as if they were standard clauses.
        const auditTrailsBodyRows = (function () {
            const groups = {};
            const order = [];
            (d.hydratedProgress || []).forEach(function (item) {
                const dept = (window.ReportStats && window.ReportStats.normalizeDeptName)
                    ? window.ReportStats.normalizeDeptName(item.department)
                    : ((item.department && String(item.department).trim()) || 'Unassigned / Cross-functional');
                if (!groups[dept]) { groups[dept] = { personnel: new Set(), clauses: new Set(), internalRefs: new Set(), count: 0, worst: 'conform' }; order.push(dept); }
                const g = groups[dept];
                if (item.personnel) String(item.personnel).split(/[,;]/).map(function (p) { return p.trim(); }).filter(Boolean).forEach(function (p) { g.personnel.add(p); });
                const rawClause = (item.kbMatch ? item.kbMatch.clause : item.clause) || item.clause;
                if (rawClause) {
                    if (item.criterionRef) {
                        g.clauses.add(String(item.criterionRef));
                    } else if (INTERNAL_REF_PREFIX_RE.test(String(rawClause))) {
                        g.internalRefs.add(String(rawClause));
                    } else {
                        g.clauses.add(String(rawClause));
                    }
                }
                g.count++;
                // Worst-status ranking: major NC > minor NC > observation > conforming
                const rank = { major: 3, minor: 2, observation: 1, conform: 0 };
                let itemRank = 0;
                if (item.status === 'nc') {
                    const t = (item.ncrType || '').toLowerCase();
                    if (t === 'major') itemRank = rank.major;
                    else if (t === 'minor') itemRank = rank.minor;
                    else if (t === 'observation') itemRank = rank.observation;
                    else itemRank = rank.minor; // unclassified NC treated as minor for worst-case display
                }
                if (itemRank > (rank[g.worst] || 0)) {
                    g.worst = itemRank === rank.major ? 'major' : itemRank === rank.minor ? 'minor' : itemRank === rank.observation ? 'observation' : 'conform';
                }
            });
            const worstLabel = { major: 'Major NC', minor: 'Minor NC', observation: 'Observation', conform: 'Conforming' };
            const worstStyle = {
                major: 'background:#fee2e2;color:#991b1b;',
                minor: 'background:#fef3c7;color:#92400e;',
                observation: 'background:#ede9fe;color:#5b21b6;',
                conform: 'background:#dcfce7;color:#166534;'
            };
            return order.map(function (dept, idx) {
                const g = groups[dept];
                const clausesSorted = Array.from(g.clauses).sort(function (a, b) {
                    return parseFloat(a) - parseFloat(b) || a.localeCompare(b);
                });
                const personnelTxt = g.personnel.size ? Array.from(g.personnel).join(', ') : '<span style="color:#94a3b8;">Not recorded</span>';
                const internalTxt = foldInternalRefs(Array.from(g.internalRefs));
                let clausesTxt = '';
                if (clausesSorted.length) clausesTxt += '<div>Clauses: ' + window.UTILS.escapeHtml(clausesSorted.join(', ')) + '</div>';
                if (internalTxt) clausesTxt += '<div style="color:#64748b;font-size:0.85em;' + (clausesSorted.length ? 'margin-top:2px;' : '') + '">Internal focus items: ' + window.UTILS.escapeHtml(internalTxt) + '</div>';
                if (!clausesTxt) clausesTxt = '—';
                return {
                    rowStyle: 'background:' + (idx % 2 ? '#fafbfc' : 'white') + ';',
                    cells: [
                        window.UTILS.escapeHtml(dept),
                        personnelTxt,
                        clausesTxt,
                        String(g.count),
                        '<span style="display:inline-block;white-space:nowrap;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;' + worstStyle[g.worst] + '">' + worstLabel[g.worst] + '</span>'
                    ]
                };
            });
        })();

        // Audit trail as a chronological timeline — the sequence of areas covered,
        // who was interviewed and what each pass concluded. Complements the table
        // above (which stays for auditor/accreditation traceability).
        const auditTrailTimelineHtml = (function () {
            const groups = {};
            const order = [];
            (d.hydratedProgress || []).forEach(function (item) {
                const dept = (window.ReportStats && window.ReportStats.normalizeDeptName)
                    ? window.ReportStats.normalizeDeptName(item.department)
                    : ((item.department && String(item.department).trim()) || 'Unassigned / Cross-functional');
                if (!groups[dept]) { groups[dept] = { personnel: new Set(), clauses: new Set(), count: 0, nc: 0, major: 0 }; order.push(dept); }
                const g = groups[dept];
                if (item.personnel) String(item.personnel).split(/[,;]/).map(function (p) { return p.trim(); }).filter(Boolean).forEach(function (p) { g.personnel.add(p); });
                const clause = (item.kbMatch ? item.kbMatch.clause : item.clause) || item.clause;
                if (clause) g.clauses.add(String(clause));
                g.count++;
                if (item.status === 'nc') {
                    const t = (item.ncrType || '').toLowerCase();
                    if (t === 'major' || t === 'minor' || !t) g.nc++;
                    if (t === 'major') g.major++;
                }
            });
            if (!order.length) return '';
            return '<div class="b4-timeline" style="position:relative;padding-left:22px;">'
                + order.map(function (dept) {
                    const g = groups[dept];
                    const tone = g.major ? 'bad' : g.nc ? 'warn' : 'good';
                    const dot = tone === 'bad' ? '#b91c1c' : tone === 'warn' ? '#b45309' : '#15803d';
                    const outcome = g.major ? (g.major + ' major finding' + (g.major > 1 ? 's' : ''))
                        : g.nc ? (g.nc + ' finding' + (g.nc > 1 ? 's' : '') + ' raised')
                            : 'No findings raised';
                    const people = g.personnel.size ? Array.from(g.personnel).join(', ') : 'Personnel not recorded';
                    return '<div class="b4-timeline-item ' + tone + '" style="position:relative;padding:0 0 20px 18px;border-left:1px solid #e7ecf1;break-inside:avoid;">'
                        + '<span style="position:absolute;left:-5px;top:3px;width:9px;height:9px;border-radius:50%;background:' + dot + ';box-shadow:0 0 0 3px #fff;"></span>'
                        + '<div style="font-weight:700;color:#0f2a43;font-size:0.88rem;">' + window.UTILS.escapeHtml(dept) + '</div>'
                        + '<div style="font-size:0.75rem;color:#64748b;margin-top:2px;">' + window.UTILS.escapeHtml(people) + '</div>'
                        + '<div style="font-size:0.78rem;color:#475569;margin-top:5px;">' + g.count + ' item' + (g.count > 1 ? 's' : '') + ' sampled across ' + g.clauses.size + ' clause' + (g.clauses.size === 1 ? '' : 's') + ' · <span style="color:' + dot + ';font-weight:600;">' + outcome + '</span></div>'
                        + '</div>';
                }).join('')
                + '</div>';
        })();

        // ─── Unified section numbering ────────────────────────────────────
        // Single source of truth for section identity, order, presence, and badge number.
        // Body and TOC both read from secMap so numbering is always synchronized.
        const evidenceItemsCount = (d.hydratedProgress || []).reduce(function (acc, it) {
            return acc + (it.evidenceImages ? it.evidenceImages.length : (it.evidenceImage ? 1 : 0));
        }, 0) + (d.report.ncrs || []).filter(function (n) { return n.evidenceImage; }).length;
        const hasEvidence = evidenceItemsCount > 0;
        const hasNcrs = (d.report.ncrs || []).length > 0;
        const hasCorrective = (d.stats.ncCount) > 0;
        // auditTypeStr / isSurveillanceOrRecert / isInitialOrStage computed earlier in this
        // function (see editedPrevFindings block) — reused here for section presence.
        // Previous-findings follow-up rows, sourced from the prior audit report for this client (if any).
        const prevFindingsRowsHtml = (function () {
            const allReports = window.state?.auditReports || [];
            const prevReports = allReports
                .filter(function (r) { return r.clientId === d.report.clientId && String(r.id) !== String(d.report.id); })
                .sort(function (a, b) { return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt); });
            const prevReport = prevReports[0];
            if (!prevReport) return '';
            const prevNCs = (prevReport.checklistProgress || [])
                .filter(function (p) { return p.status === 'nc' && (p.ncrType || '').toLowerCase() !== 'observation' && (p.ncrType || '').toLowerCase() !== 'ofi'; });
            const prevNCRs = prevReport.ncrs || [];
            if (prevNCs.length === 0 && prevNCRs.length === 0) return '';
            let rows = '';
            prevNCs.forEach(function (nc, i) {
                rows += '<tr><td style="font-family:monospace;font-weight:600;color:#6366f1;">PREV-' + (i + 1) + '</td><td>' + (nc.clauseRef || nc.clause || '') + '</td><td style="text-align:center;"><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;' + ((nc.ncrType || '').toLowerCase() === 'major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + (nc.ncrType || 'Minor') + '</span></td><td>Verified closed — corrective action implemented</td></tr>';
            });
            prevNCRs.forEach(function (ncr, i) {
                rows += '<tr><td style="font-family:monospace;font-weight:600;color:#6366f1;">PREV-' + (prevNCs.length + i + 1) + '</td><td>' + (ncr.clause || '') + '</td><td style="text-align:center;"><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;' + ((ncr.type || '').toLowerCase() === 'major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + (ncr.type || 'Minor') + '</span></td><td>Verified closed — corrective action implemented</td></tr>';
            });
            return rows;
        })();
        // ─── Audit Programme (3-year certification cycle) ────────────────
        // Single computation shared with the preview path via ReportStats.buildProgramme
        // (anchors on the client's certificate, overlays real audit history, never
        // fabricates Stage 1/2 dates when there's nothing to anchor on).
        const EDIT_ID_BY_STAGE_EXPORT = { s1: 'rp-prog-s1', s2: 'rp-prog-s2', sv1: 'rp-prog-sv1', sv2: 'rp-prog-sv2', recert: 'rp-prog-recert' };
        const auditProgramme = (window.ReportStats && typeof window.ReportStats.buildProgramme === 'function')
            ? window.ReportStats.buildProgramme({ client: d.client, auditPlan: d.auditPlan, report: d.report, allReports: (window.state && window.state.auditReports) || [] })
            : { stages: [], anchored: 'audit-date-fallback', issues: ['Certification programme module unavailable.'], anchorDate: null, nextAudit: null };
        const programmeStages = auditProgramme.stages.map(function (s) {
            return Object.assign({}, s, { editId: EDIT_ID_BY_STAGE_EXPORT[s.id] || ('rp-prog-' + s.id) });
        });
        const programmeAnchorCaptionExport = function (programme) {
            const dt = programme.anchorDate ? new Date(programme.anchorDate) : null;
            const fmtDate = dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString('en-GB') : '';
            if (programme.anchored === 'certificate') return 'anchored on the initial certification date of ' + fmtDate;
            if (programme.anchored === 'history') return 'based on recorded audit history' + (fmtDate ? ' (earliest record ' + fmtDate + ')' : '');
            return 'prior stage dates unavailable — no certificate on file';
        };
        // ─── Multi-site sampling ──────────────────────────────────────────
        const allSites = (d.client && Array.isArray(d.client.sites)) ? d.client.sites : [];
        const isMultiSite = allSites.length > 1;
        const matchingSiteCert = isMultiSite ? (d.client.certificates || []).find(function (c) { return (c.standard || '').toLowerCase() === (d.report.standard || d.auditPlan?.standard || '').toLowerCase(); }) : null;
        const siteScopesMap = (matchingSiteCert && matchingSiteCert.siteScopes) ? matchingSiteCert.siteScopes : {};
        const sampledSiteNames = (function () {
            const sel = d.auditPlan?.selectedSites;
            if (Array.isArray(sel) && sel.length > 0) return sel.map(function (s) { return (typeof s === 'object' ? s.name : s); });
            // Fall back to the primary/head office site if nothing explicit was selected.
            return allSites.length ? [allSites[0].name] : [];
        })();
        const sectionDefs = [
            { key: 'audit-info',   name: 'AUDIT INFORMATION',                  desc: 'Organization details, scope, audit team and dates',     color: '#2563eb', present: en['audit-info'] !== false },
            { key: 'audit-programme', name: 'AUDIT PROGRAMME',                 desc: '3-year certification cycle plan and current status',    color: '#0ea5e9', present: en['audit-programme'] !== false },
            { key: 'multi-site',   name: 'MULTI-SITE SAMPLING',                desc: 'Sampling plan across client sites for this audit',      color: '#16a34a', present: en['multi-site'] !== false && isMultiSite },
            { key: 'objectives',   name: 'OBJECTIVES, CRITERIA &amp; METHODOLOGY', desc: 'Audit objectives, criteria and methodology',         color: '#0891b2', present: en['objectives'] !== false },
            { key: 'summary',      name: 'AUDIT SUMMARY &amp; OPENING MEETING', desc: 'Audit narrative, opening meeting record and positive observations', color: '#059669', present: en['summary'] !== false },
            { key: 'charts',       name: 'ANALYTICS DASHBOARD',                desc: 'Compliance charts, KPIs and clause-based breakdown',    color: '#7c3aed', present: en['charts'] !== false },
            { key: 'conformance',  name: 'CONFORMANCE VERIFICATION',           desc: 'Verified conforming items with supporting evidence',    color: '#10b981', present: en['conformance'] !== false && !!conformRowsHtml },
            { key: 'audit-trails', name: 'AUDIT TRAILS',                       desc: 'Areas sampled, personnel interviewed and clauses covered', color: '#0ea5e9', present: en['audit-trails'] !== false && auditTrailsBodyRows.length > 0 },
            { key: 'prev-findings',name: 'PREVIOUS FINDINGS STATUS',           desc: 'Follow-up status of findings from previous audit',      color: '#6366f1', present: en['prev-findings'] !== false && isSurveillanceOrRecert },
            { key: 'obs',          name: 'OBSERVATIONS',                       desc: 'Audit observations noted during assessment',            color: '#7c3aed', present: !!obsOnlyRowsHtml },
            { key: 'ofi',          name: 'OPPORTUNITIES FOR IMPROVEMENT',      desc: 'Opportunities for improvement identified',              color: '#f59e0b', present: !!(ofiOnlyRowsHtml || editedOfi) },
            { key: 'findings',     name: 'FINDING DETAILS',                    desc: 'Detailed non-conformity findings with evidence',        color: '#dc2626', present: en['findings'] !== false },
            { key: 'ncrs',         name: 'NCR REGISTER',                       desc: 'Formal NCR register with severity classifications',     color: '#ea580c', present: en['ncrs'] !== false && hasNcrs },
            { key: 'corrective',   name: 'CORRECTIVE ACTION REQUIREMENTS',     desc: 'Required corrective actions with due dates',            color: '#be185d', present: hasCorrective && en['corrective'] !== false },
            { key: 'changes',      name: 'CHANGES SINCE LAST AUDIT',           desc: 'Changes to management system since last audit',         color: '#78716c', present: en['changes'] !== false },
            { key: 'mgmt-effectiveness', name: 'MANAGEMENT SYSTEM EFFECTIVENESS', desc: 'Effectiveness of key management system processes',   color: '#0e7490', present: en['mgmt-effectiveness'] !== false },
            { key: 'conclusion',   name: 'AUDIT CONCLUSION &amp; RECOMMENDATION', desc: 'Closing meeting, certification recommendation',      color: '#4338ca', present: en['conclusion'] !== false },
            { key: 'signature',    name: 'SIGNATURE &amp; ATTESTATION',        desc: 'Signatures and attestation',                            color: '#1e293b', present: en['signature'] !== false },
            { key: 'distribution', name: 'DISTRIBUTION LIST',                  desc: 'Controlled distribution of this report',                color: '#0d9488', present: en['distribution'] !== false },
            { key: 'annexures',    name: 'ANNEXURES &amp; APPENDICES',         desc: 'Supporting documents and appendices',                   color: '#9333ea', present: en['annexures'] !== false },
            { key: 'evidence',     name: 'EVIDENCE INDEX',                     desc: 'Indexed photographic evidence collected during the audit', color: '#c2410c', present: hasEvidence }
        ];
        // ─── Formal report vs optional annexes (#3) ────────────────────────
        // The formal certification report (numbered 1..N) is the ISO 17021 deliverable.
        // Everything analytical/evidentiary/CAPA-working-doc is an OPTIONAL annex the
        // certification decision does not depend on — gated by report.reportConfig.annexes,
        // physically separated behind a divider page, and numbered A.n/B.n/C.n so it can
        // never be mistaken for part of the formal report's numbering.
        const SECTION_GROUPS = {
            'audit-info': 'formal', 'audit-programme': 'formal', 'multi-site': 'formal',
            'objectives': 'formal', 'summary': 'formal', 'conformance': 'formal',
            'audit-trails': 'formal', 'prev-findings': 'formal', 'obs': 'formal', 'ofi': 'formal',
            'findings': 'formal', 'ncrs': 'formal', 'corrective': 'formal', 'changes': 'formal',
            'mgmt-effectiveness': 'formal', 'conclusion': 'formal', 'signature': 'formal',
            'distribution': 'formal', 'exec-summary': 'formal',
            'exec-dashboard': 'analytics', 'exec-insights': 'analytics', 'charts': 'analytics',
            'maturity': 'analytics', 'dept-performance': 'analytics', 'clause-intel': 'analytics',
            'trends': 'analytics', 'risk-heatmap': 'analytics', 'business-impact': 'analytics',
            'root-cause': 'analytics', 'risk-register': 'analytics', 'action-plan': 'analytics',
            'capa-dashboard': 'analytics', 'opsCoverage': 'analytics', 'opsAttendance': 'analytics',
            'opsSampling': 'analytics', 'opsHeatmap': 'analytics', 'reqMatrix': 'analytics',
            'findingLifecycle': 'analytics',
            'evidence-intel': 'evidence', 'evidenceTrace': 'evidence', 'evidence': 'evidence',
            'fwPack': 'evidence', 'annexures': 'evidence',
            'carForms': 'capa'
            // 'opsDistribution' deliberately absent — duplicate of 'distribution', dropped entirely.
        };
        const groupOf = function (key) { return SECTION_GROUPS[key] || 'formal'; };
        const reportConfigAnnexes = Object.assign(
            { analytics: false, evidence: true, capa: false },
            (d.report.reportConfig && d.report.reportConfig.annexes) || {}
        );
        const annexEnabled = function (group) { return group === 'formal' ? true : !!reportConfigAnnexes[group]; };

        const secMapRef = { map: {}, badge: function () { return ''; } };
        const allModuleSections = []
            .concat(
                (window.ReportExecutive && window.ReportExecutive.sections) ? window.ReportExecutive.sections(d) : [],
                (window.ReportScoring && window.ReportScoring.sections) ? window.ReportScoring.sections(d) : [],
                (window.ReportRisk && window.ReportRisk.sections) ? window.ReportRisk.sections(d) : [],
                (window.ReportOperational && window.ReportOperational.sections) ? window.ReportOperational.sections(d) : [],
                (window.ReportFindingsOps && window.ReportFindingsOps.sections) ? window.ReportFindingsOps.sections(d) : [],
                (window.ReportFrameworks && window.ReportFrameworks.sections) ? window.ReportFrameworks.sections(d) : []
            )
            // opsDistribution dropped entirely — duplicate of the formal Distribution List.
            .filter(function (s) { return s && s.bodyHtml && en[s.key] !== false && s.key !== 'opsDistribution'; })
            // Disabled annexes are simply excluded from the print HTML.
            .filter(function (s) { return annexEnabled(groupOf(s.key)); });
        // Preserve the intended reading order within the executive-briefing/analytics group.
        const FRONT_ORDER = ['exec-summary', 'exec-dashboard', 'exec-insights'];
        const sortFront = function (arr) {
            return arr.slice().sort(function (a, b) {
                const ia = FRONT_ORDER.indexOf(a.key), ib = FRONT_ORDER.indexOf(b.key);
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            });
        };
        const modFormalFront = allModuleSections.filter(function (s) { return groupOf(s.key) === 'formal'; });
        // ─── Executive summary consolidation (#4) ──────────────────────────
        // exec-summary is the SINGLE executive summary in the formal report — prepend a
        // compact facts table built engine-side (no report-executive.js edit needed) so a
        // reader gets audit type/standard/scope/dates/team/counts/recommendation at a glance.
        (function () {
            const execSummarySec = modFormalFront.find(function (s) { return s.key === 'exec-summary'; });
            if (!execSummarySec) return;
            const stats = d.stats || {};
            const rs = stats.rs || {};
            const client = d.client || {};
            const report = d.report || {};
            const plan = d.auditPlan || {};
            const esc = window.UTILS && window.UTILS.escapeHtml ? window.UTILS.escapeHtml : function (s) { return String(s == null ? '' : s); };
            const sites = (Array.isArray(client.sites) && client.sites.length)
                ? client.sites.map(function (s) { return s.name; }).filter(Boolean).join(', ')
                : ([client.address, client.city].filter(Boolean).join(', ') || '—');
            const team = (Array.isArray(plan.team) && plan.team.length) ? plan.team.join(', ') : (report.leadAuditor || '—');
            const prevStatus = report.previousFindingsStatus ? 'Reviewed — see Previous Findings Status section' : '—';
            const recommendation = (rs && rs.recommendation) || stats.recommendation || '—';
            const row = function (label, value) {
                return '<tr><td style="padding:6px 12px;color:#64748b;font-weight:600;width:34%;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em;vertical-align:top;">' + esc(label) + '</td><td style="padding:6px 12px;font-size:0.85rem;color:#1e293b;">' + (value || '—') + '</td></tr>';
            };
            const factsTable = '<div style="margin-bottom:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 4px;">'
                + '<table style="width:100%;border-collapse:collapse;">'
                + row('Audit Type', esc(plan.auditType || plan.type || report.auditType || 'Initial'))
                + row('Standard', esc(report.standard || plan.standard || '—'))
                + row('Scope', esc(report.scope || plan.scope || client.certificationScope || '—'))
                + row('Sites / Locations', esc(sites))
                + row('Audit Dates', esc((report.date || '—') + (report.endDate ? ' — ' + report.endDate : '')))
                + row('Audit Team', esc(team))
                + row('Major NC / Minor NC / Observations / OFI', (stats.majorNC || 0) + ' / ' + (stats.minorNC || 0) + ' / ' + (stats.observationCount || 0) + ' / ' + (stats.ofiCount || 0))
                + (stats.coveragePct != null ? row('Audit Coverage', esc(stats.coveragePct + '%'
                    + (rs.coverageInputs ? ' (' + rs.coverageInputs.assessed + ' of ' + rs.coverageInputs.applicable + ' applicable items assessed; N/A excluded)' : ''))) : '')
                + row('Previous NC Status', prevStatus)
                + row('Recommendation', esc(recommendation))
                + '</table></div>';
            execSummarySec.bodyHtml = factsTable + (execSummarySec.bodyHtml || '');
        })();
        const modAnalyticsMods = sortFront(allModuleSections.filter(function (s) { return groupOf(s.key) === 'analytics'; }));
        const modEvidenceMods = allModuleSections.filter(function (s) { return groupOf(s.key) === 'evidence'; });
        const modCapaMods = allModuleSections.filter(function (s) { return groupOf(s.key) === 'capa'; });
        const modChartEntries = allModuleSections.reduce(function (acc, s) { return acc.concat(s.charts || []); }, []);
        // Splice the formal-group module sections (exec-summary) at the front, ahead of
        // AUDIT INFORMATION — the only module content that stays inside the formal report.
        (function () {
            const toDefs = function (arr) { return arr.map(function (s) { return { key: s.key, name: s.name, desc: s.desc, color: s.color, present: true }; }); };
            const anchor = function (key, fallback) {
                const i = sectionDefs.findIndex(function (s) { return s.key === key; });
                return i < 0 ? fallback : i;
            };
            sectionDefs.splice.apply(sectionDefs, [anchor('audit-info', 0), 0].concat(toDefs(modFormalFront)));
        })();
        // charts / annexures / evidence are annex-group built-ins — gate their presence on
        // the matching annex toggle in addition to their existing presence logic.
        (function () {
            const gate = function (key, group) {
                const def = sectionDefs.find(function (s) { return s.key === key; });
                if (def) def.present = def.present && annexEnabled(group);
            };
            gate('charts', 'analytics');
            gate('annexures', 'evidence');
            gate('evidence', 'evidence');
        })();
        // Shared renderer for a module section's body.
        // annexLabel (e.g. 'A') prints a small eyebrow above the section title so a
        // reader flipping straight to a page (skipping the divider) still sees this is
        // annex content, not part of the formal certification report — running header
        // stays static ('AUDIT REPORT') per-page switching is impractical with the
        // thead/tfoot repeating-header approach, so the label lives here instead.
        // Sections that always open a fresh page. Kept deliberately small —
        // everything else flows, so the report doesn't waste half-empty pages.
        // The executive summary is the report's front page after the contents
        // page and must not share a page with the revision-history block.
        const SECTION_STARTS_PAGE = { 'exec-summary': true };
        const renderModSections = function (arr, annexLabel) {
            return arr.map(function (s) {
                if (!secMapRef.map[s.key]) return '';
                const eyebrow = annexLabel ? '<div style="font-size:0.62rem;letter-spacing:0.08em;color:#cbd5e1;text-transform:uppercase;margin-bottom:2px;">Annex ' + annexLabel + '</div>' : '';
                const breakCls = SECTION_STARTS_PAGE[s.key] ? ' page-break' : '';
                return '<div id="sec-' + s.key + '" class="sh' + breakCls + '" style="border-left-color:' + s.color + ';flex-direction:column;align-items:flex-start;gap:2px;">' + eyebrow + '<div style="display:flex;align-items:center;gap:12px;width:100%;">' + secMapRef.badge(s.key) + s.name + '</div></div><div class="sb">' + s.bodyHtml + '</div>';
            }).join('');
        };
        // Section category colors: subtle audience-based coding instead of a
        // different hue per section. Executive=blue, Management=slate, Risk=red
        // accent, Evidence=green, Certification=navy, Annex=neutral.
        const SECTION_CATEGORY_COLOR = {
            'exec-summary': '#1d4ed8', 'exec-dashboard': '#1d4ed8', 'exec-insights': '#1d4ed8',
            'audit-info': '#475569', 'audit-programme': '#475569', 'multi-site': '#475569',
            'objectives': '#475569', 'summary': '#475569', 'charts': '#475569',
            'maturity': '#475569', 'dept-performance': '#475569', 'clause-intel': '#475569',
            'trends': '#475569', 'changes': '#475569', 'mgmt-effectiveness': '#475569',
            'risk-heatmap': '#b91c1c', 'business-impact': '#b91c1c', 'root-cause': '#b91c1c',
            'risk-register': '#b91c1c', 'action-plan': '#b91c1c', 'capa-dashboard': '#b91c1c',
            'findings': '#b91c1c', 'ncrs': '#b91c1c', 'corrective': '#b91c1c',
            'obs': '#b91c1c', 'ofi': '#b91c1c',
            'conformance': '#15803d', 'audit-trails': '#15803d', 'prev-findings': '#15803d',
            'evidence-intel': '#15803d', 'evidence': '#15803d',
            'conclusion': '#0f2a43', 'signature': '#0f2a43',
            'distribution': '#64748b', 'annexures': '#64748b',
            // Universal Audit Framework v2.0 — Management=slate, Findings=red, Annex=neutral
            'opsCoverage': '#475569', 'opsAttendance': '#475569', 'opsSampling': '#475569',
            'opsHeatmap': '#475569', 'reqMatrix': '#475569',
            'findingLifecycle': '#b91c1c', 'carForms': '#b91c1c',
            'evidenceTrace': '#15803d', 'opsDistribution': '#64748b', 'fwPack': '#0f2a43'
        };
        sectionDefs.forEach(function (s) { if (SECTION_CATEGORY_COLOR[s.key]) s.color = SECTION_CATEGORY_COLOR[s.key]; });
        // ─── Two-pass numbering: formal report 1..N, each annex A.n/B.n/C.n ──────
        const secMap = {};
        const formalDefs = sectionDefs.filter(function (s) { return groupOf(s.key) === 'formal'; });
        let _secCounter = 0;
        formalDefs.forEach(function (s) { if (s.present) { _secCounter++; secMap[s.key] = { num: _secCounter, name: s.name, desc: s.desc, color: s.color, group: 'formal' }; } });
        const numberAnnex = function (letter, items) {
            let n = 0;
            items.forEach(function (it) {
                if (it.present === false) return;
                n++;
                secMap[it.key] = { num: letter + '.' + n, name: it.name, desc: it.desc, color: it.color, group: it.group };
            });
        };
        const toAnnexItem = function (s, group) { return { key: s.key, name: s.name, desc: s.desc, color: s.color, present: true, group: group }; };
        const analyticsItems = sectionDefs.filter(function (s) { return s.key === 'charts'; }).map(function (s) { return Object.assign({}, s, { group: 'analytics' }); })
            .concat(modAnalyticsMods.map(function (s) { return toAnnexItem(s, 'analytics'); }));
        const evidenceItems = sectionDefs.filter(function (s) { return s.key === 'annexures'; }).map(function (s) { return Object.assign({}, s, { group: 'evidence' }); })
            .concat(modEvidenceMods.map(function (s) { return toAnnexItem(s, 'evidence'); }))
            .concat(sectionDefs.filter(function (s) { return s.key === 'evidence'; }).map(function (s) { return Object.assign({}, s, { group: 'evidence' }); }));
        const capaItems = modCapaMods.map(function (s) { return toAnnexItem(s, 'capa'); });
        if (annexEnabled('analytics')) numberAnnex('A', analyticsItems);
        if (annexEnabled('evidence')) numberAnnex('B', evidenceItems);
        if (annexEnabled('capa')) numberAnnex('C', capaItems);
        const sBadge = function (key) {
            const m = secMap[key]; if (!m) return '';
            const wide = /\./.test(String(m.num)) ? 'min-width:28px;width:auto;padding:0 4px;border-radius:6px;' : '';
            return '<span class="sn" style="background:' + m.color + ';' + wide + '">' + m.num + '</span>';
        };
        // Divider page for an annex — reuses the TOC-page pattern so it reads as a
        // genuine section break, not just another header row.
        const annexDivider = function (label, title, disclaimer) {
            return '<div class="toc page-break" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;min-height:60vh;page-break-after:always;break-after:page;">'
                + '<div style="font-size:0.78rem;letter-spacing:0.18em;color:#64748b;text-transform:uppercase;font-weight:600;margin-bottom:10px;">Annex ' + label + '</div>'
                + '<div style="font-size:1.6rem;font-weight:800;color:#0f172a;margin-bottom:18px;">' + title + '</div>'
                + '<div class="toc-line"></div>'
                + '<div style="max-width:520px;font-size:0.85rem;color:#475569;line-height:1.6;margin-top:18px;">' + disclaimer + '</div>'
                + '</div>';
        };
        // Late-bound refs so renderModSections (defined above secMap) can use them.
        secMapRef.map = secMap;
        secMapRef.badge = sBadge;

        const reportHtml = '<!DOCTYPE html><html lang="en"><head>'
            + '<meta charset="UTF-8">'
            + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
            + '<title>Audit Report — ' + d.report.client + '</title>'
            + '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">'
            + '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'
            + '<style>'
            + "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');"
            + '*{margin:0;padding:0;box-sizing:border-box;}'
            + "body{font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;background:white;max-width:1050px;margin:0 auto;font-size:11pt;line-height:1.6;}"
            + '@media print{'
            // Pagination fix: @page margin-box content (@top-left etc.) and counter(pages) are
            // not implemented by Chrome's print engine, so those rules were dead code. Instead
            // we run .rpt-hdr/.rpt-ftr as fixed-position elements that repeat on every printed
            // page (Chrome DOES support position:fixed repeating across pages), with body
            // padding so content never underlaps them. "Page X of Y" is not achievable this way
            // (no live page count in Chrome print CSS) — the footer shows report ref + confidentiality
            // classification instead of a fake/static page count.
            +   'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:10pt;padding-top:0;padding-bottom:0;}'
            +   '.rpt-hdr,.rpt-ftr{display:flex !important;}'
            +   '.page-break{page-break-before:always;}'
            +   '.no-print{display:none !important;}'
            +   '.section-card,tr,thead{break-inside:avoid;}'
            +   'thead{display:table-header-group;}'
            +   'tfoot{display:table-footer-group;}'
            +   '.sh{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;page-break-after:avoid;break-after:avoid;page-break-inside:avoid;break-inside:avoid;}'
            +   '.sb{page-break-before:avoid;break-before:avoid;}'
            // Major reading milestones start on a fresh page rather than being
            // wedged under whatever preceded them: Objectives, Criteria &
            // Methodology (4), Audit Summary & Opening Meeting (5), Audit
            // Conclusion & Recommendation (15) and Signature & Attestation (16).
            // Targeted by section KEY, not by the printed number — the
            // numbering shifts with whichever sections are enabled.
            // A forced break on a box already at a page boundary is ignored by
            // the fragmentation spec, so this cannot introduce blank pages.
            +   '#sec-objectives,#sec-summary,#sec-conclusion,#sec-signature{page-break-before:always;break-before:page;}'
            +   (d.report.reportStatus === 'draft' ? '.watermark{display:flex !important;}' : '')
            +   '.toc-item{break-inside:avoid;page-break-inside:avoid;}'
            // Print-quality guarantees: no orphan/widow lines, headings keep their
            // first block, tables never leave a lone header row, charts never clip.
            +   'p,li,td{orphans:3;widows:3;}'
            +   'h1,h2,h3,h4{break-after:avoid;page-break-after:avoid;}'
            +   'table{break-inside:auto;}'
            +   '.chart-box,.b4-chart-box,canvas,img{break-inside:avoid;page-break-inside:avoid;max-width:100% !important;}'
            +   '.b4-kpi-card,.b4-card,.b4-callout,.b4-insight-card,.ev-card{break-inside:avoid;page-break-inside:avoid;}'
            // Paper has no scrollbars: neutralize inline scroll containers so content
            // reflows instead of clipping (class-based overflow like .watermark and
            // .b4-bar keep their clipping), and no table may exceed the page width.
            +   '.sb [style*="overflow-x"],.sb [style*="overflow:auto"],.sb [style*="overflow: auto"]{overflow:visible !important;}'
            +   '.sb table{max-width:100% !important;min-width:0 !important;width:100% !important;table-layout:fixed;}'
            // The whole report rides inside one td of the .rpt-running wrapper
            // table. That table is AUTO layout, so a single over-wide descendant
            // (a nowrap line, an inline min-width, a grid track's min-content
            // floor) silently widened the entire document past the A4 content
            // box and Chrome clipped EVERY page on the right — cover title,
            // table columns and narrative all cut mid-word. Fixed layout makes
            // the wrapper obey its width:100% regardless of content, and the
            // screen-only 1050px body cap must not leak into print.
            +   'body{max-width:none !important;width:auto !important;}'
            +   '.rpt-running{table-layout:fixed !important;width:100% !important;}'
            +   '.rpt-running > tbody > tr > td{min-width:0;}'
            // Grid tracks: 1fr's implicit min-content floor lets one long token
            // push a grid past the page; minmax(0,1fr) keeps tracks equal and
            // clamped so text wraps instead of widening the page.
            +   '.stat-grid{grid-template-columns:repeat(4,minmax(0,1fr)) !important;}'
            +   '.chart-grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}'
            +   '.ev-grid{grid-template-columns:repeat(3,minmax(0,1fr)) !important;}'
            +   '.sb [style*="min-width"]{min-width:0 !important;}'
            // For long-text findings tables, avoid mid-row splits per-row (readability) while still
            // letting the table itself break across pages (table{break-inside:auto} above already
            // allows that) — this is the pragmatic choice over per-row height thresholds, which
            // Chrome's print engine can't evaluate reliably at layout time anyway.
            +   '.f-tbl td{max-height:none;}'
            // Cover page: on screen it fills the viewport (min-height:100vh) with
            // the doc-control block pinned to its bottom. In print, 100vh is the
            // PAGE box — taller than the usable flow area once the @page margins
            // and the repeating header/footer rows are subtracted — so the pinned
            // block sat below the page and Chrome pushed it onto page 2 alone.
            // In print the cover sizes to its content and the doc-control block
            // returns to normal flow directly beneath it, with an explicit break
            // so the contents page still starts on page 2.
            +   '.cover{min-height:0 !important;height:auto !important;padding:24px 40px 28px !important;page-break-after:always;break-after:page;}'
            +   '.cover-doc{position:static !important;left:auto !important;right:auto !important;bottom:auto !important;width:100%;margin-top:28px;}'
            +   '@page{size:A4;margin:20mm 14mm 16mm 14mm;}'
            + '}'
            // The running header is 18mm tall with 3mm of vertical padding, so its
            // content box is only ~12mm (≈34px). A 36px logo did not fit and was
            // clipped along with the text beside it; 24px sits inside the box with
            // room for descenders. min-width:0 + ellipsis lets a long certification
            // body name truncate cleanly instead of being sliced mid-glyph by
            // overflow:hidden.
            // The running header/footer are rows of a table that wraps the whole
            // report, NOT position:fixed elements. Measured in Chrome: a fixed element
            // in print anchors to the page CONTENT BOX (inside the @page margins) and a
            // negative offset does not escape into the margin — it wraps by the page-area
            // height, so top:-20mm painted the header at ~261mm, i.e. straight through the
            // body text. thead/table-header-group repeats per page and reserves its space
            // in flow, so content genuinely starts below it on every page.
            + '.rpt-running{width:100%;border-collapse:collapse;}'
            + '.rpt-running > thead > tr > td,.rpt-running > tfoot > tr > td,.rpt-running > tbody > tr > td{padding:0;}'
            + '.rpt-hdr{display:none;height:16mm;background:white;color:#1e293b;padding:2mm 0;align-items:center;justify-content:space-between;font-size:0.72rem;line-height:1.25;border-bottom:1px solid #e2e8f0;overflow:hidden;}'
            + '.rpt-hdr-left{display:flex;align-items:center;gap:8px;font-weight:700;font-size:0.78rem;color:#1e3a5f;max-width:34%;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}'
            + '.rpt-hdr-left span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}'
            + '.rpt-hdr-logo{height:24px;max-width:140px;object-fit:contain;border-radius:3px;flex-shrink:0;}'
            + '.rpt-hdr-logo-fallback{width:24px;height:24px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:#1d4ed8;}'
            + '.rpt-hdr-center{text-align:center;flex:1;font-size:0.68rem;color:#475569;letter-spacing:0.3px;text-transform:uppercase;}'
            + '.rpt-hdr-right{text-align:right;font-size:0.68rem;color:#64748b;}'
            // Status pills are inline spans carrying vertical padding. On an inline
            // box that padding does not grow the line box, so the coloured
            // background bled over the rows above and below wherever a cell wrapped
            // to more than one line. inline-block makes the padding count toward
            // layout. Matched on the shared border-radius rather than a class
            // because the pills are built inline in ~30 row templates.
            + 'td span[style*="border-radius:12px"],td span[style*="border-radius: 12px"],'
            + 'td span[style*="border-radius:999px"],th span[style*="border-radius:12px"]'
            + '{display:inline-block;line-height:1.3;vertical-align:middle;white-space:nowrap;}'
            + '.rpt-ftr{display:none;height:12mm;border-top:2px solid #1d4ed8;padding:2mm 0;align-items:center;justify-content:space-between;font-size:0.65rem;color:#64748b;background:white;}'
            + '.rpt-ftr-left{font-weight:500;color:#1e3a5f;font-size:0.65rem;max-width:35%;}'
            + '.rpt-ftr-center{flex:1;text-align:center;font-size:0.58rem;color:#94a3b8;font-style:italic;padding:0 6px;}'
            + '.rpt-ftr-right{text-align:right;font-weight:700;color:#1e3a5f;font-size:0.68rem;white-space:nowrap;}'
            // Consulting-deliverable cover: flat, restrained, no gradient wash.
            + '.cover{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:#fbfcfd;border-top:6px solid #0f2a43;padding:88px 56px;position:relative;}'
            + '.cover-line{width:64px;height:3px;background:#0f2a43;border-radius:0;margin:0 auto 32px;}'
            + '.sh{background:#0f2a43;color:#ffffff;padding:14px 22px;font-weight:700;font-size:0.95rem;letter-spacing:0.06em;display:flex;align-items:center;gap:12px;border-radius:6px 6px 0 0;margin-top:34px;border-left:4px solid #1d4ed8;}'
            + '.sn{background:#0f2a43;color:white;width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:0.74rem;font-weight:700;flex-shrink:0;}'
            + '.sb{padding:26px 24px 28px;border:1px solid #e7ecf1;border-top:none;border-radius:0 0 6px 6px;margin-bottom:8px;}'
            + '.sb > * + *{margin-top:18px;}.sb table + table{margin-top:22px;}'
            + '.info-tbl{width:100%;border-collapse:collapse;}.info-tbl td{padding:10px 14px;border-bottom:1px solid #eef2f6;font-size:0.86rem;line-height:1.5;}.info-tbl td:first-child{width:28%;color:#64748b;font-weight:500;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;}.info-tbl tr:nth-child(even){background:#fafbfc;}'
            // Consulting-grade table: airy rows, hairline rules only, eyebrow header.
            // word-break stays normal so short words like "Medium" never fragment;
            // only genuinely unbreakable tokens (long refs/URLs) are allowed to break.
            + '.f-tbl{width:100%;border-collapse:collapse;font-size:0.85rem;table-layout:fixed;}'
            + '.f-tbl th{background:transparent;color:#64748b;font-weight:700;text-align:left;padding:9px 14px 7px;border-bottom:1px solid #cbd5e1;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.07em;}'
            + '.f-tbl td{padding:11px 14px;border-bottom:1px solid #eef2f6;vertical-align:top;word-break:normal;overflow-wrap:anywhere;line-height:1.5;}'
            + '.f-tbl tbody tr:nth-child(even){background:#fafbfc;}.f-tbl tbody tr{break-inside:avoid;}'
            + '.f-tbl td .badge,.f-tbl td .pill,.f-tbl td .b4-badge,.f-tbl td .b4-pill,.f-tbl td span[style*="border-radius"]{white-space:nowrap;}'
            + '.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}'
            + '.stat-box{text-align:center;padding:16px 10px;border-radius:10px;border-bottom:3px solid transparent;}'
            + '.stat-val{font-size:1.8rem;font-weight:700;line-height:1;margin-bottom:4px;}'
            + '.stat-lbl{font-size:0.72rem;color:#64748b;font-weight:500;text-transform:uppercase;}'
            + '.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;}'
            + '.chart-box{background:white;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;}'
            + '.chart-box canvas{max-height:200px;max-width:100%;}'
            + '.chart-title{font-size:0.8rem;font-weight:700;color:#1e293b;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.3px;}'
            + '.ev-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}.ev-card{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;break-inside:avoid;}.ev-card img{width:100%;height:160px;object-fit:cover;}.ev-cap{padding:8px 12px;font-size:0.78rem;}.ev-cap strong{display:block;color:#1e293b;margin-bottom:2px;}.ev-cap span{color:#64748b;}'
            // Contents page: two columns of tight rows rather than one column of
            // 34px medallions with a description each, which ran the section list
            // over two pages. Square index chips and a hairline rule read as a
            // report contents page rather than a dashboard.
            + '.toc{padding:22px 34px;}.toc-title{font-size:1.35rem;font-weight:700;color:#0f172a;letter-spacing:-0.2px;margin-bottom:2px;}.toc-sub{font-size:0.8rem;color:#64748b;margin-bottom:12px;}.toc-line{width:44px;height:2px;background:#1d4ed8;border-radius:1px;margin-bottom:16px;}'
            + '.toc-list{column-count:2;column-gap:30px;}'
            + '.toc-item{display:flex;align-items:baseline;gap:10px;padding:5px 0;border-bottom:1px dotted #e2e8f0;text-decoration:none;color:inherit;break-inside:avoid;-webkit-column-break-inside:avoid;}'
            + '.toc-num{min-width:19px;height:16px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:0.62rem;color:white;flex-shrink:0;font-variant-numeric:tabular-nums;}'
            + '.toc-item-body{flex:1;min-width:0;}.toc-item-title{font-weight:600;font-size:0.8rem;color:#1e293b;line-height:1.3;}'
            + '.toc-item-desc{font-size:0.68rem;color:#94a3b8;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
            + 'footer{display:none;}'
            + '.content{padding:0 32px;}'
            + '.callout{padding:12px 16px;border-radius:8px;margin-top:14px;font-size:0.88rem;line-height:1.7;}'
            + '.ev-inline{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}.ev-inline img{height:80px;max-width:140px;border-radius:4px;border:1px solid #e2e8f0;object-fit:cover;}'
            + '.watermark{display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;justify-content:center;align-items:center;overflow:hidden;}.watermark span{transform:rotate(-35deg);font-size:72pt;font-weight:700;color:rgba(148,163,184,0.05);letter-spacing:8px;white-space:nowrap;font-family:Inter,"Segoe UI",Helvetica,Arial,sans-serif;text-align:center;user-select:none;}body{position:relative;z-index:1;}'
            + ((window.ReportExecutive && window.ReportExecutive.bigFourCss) ? window.ReportExecutive.bigFourCss() : '')
            + '</style></head><body>'
            + (d.report.reportStatus === 'draft'
                ? '<div class="watermark"><span style="color:rgba(220,38,38,0.14);">DRAFT</span></div>'
                : (modifiedSinceIssue
                    ? '<div class="watermark"><span style="color:rgba(220,38,38,0.16);font-size:48pt;">MODIFIED SINCE ISSUE</span></div>'
                    : '<div class="watermark"><span>CONFIDENTIAL</span></div>'))
            + (modifiedSinceIssue ? '<div class="no-print" style="position:sticky;top:0;left:0;right:0;background:#dc2626;color:white;text-align:center;padding:10px 16px;font-weight:700;font-size:0.85rem;letter-spacing:0.3px;z-index:1001;">&#9888; MODIFIED SINCE ISSUE — this final report has changed since it was last issued (v' + (d.report.issuedSnapshot && d.report.issuedSnapshot.version) + '). Re-issue via Finalize &amp; Publish before distributing.</div>' : '')
            // Everything printable lives in one table so the header/footer rows repeat
            // per page and reserve their own space in flow (see .rpt-running above).
            + '<table class="rpt-running"><thead><tr><td>'
            + '<div class="rpt-hdr"><div class="rpt-hdr-left">' + (d.cbLogo ? '<img src="' + d.cbLogo + '" class="rpt-hdr-logo" alt="Logo">' : '<div class="rpt-hdr-logo-fallback"></div><span>' + (cbName || 'Certification Body') + '</span>') + '</div><div class="rpt-hdr-center"><div style="font-size:0.62rem;line-height:1.3;margin-bottom:2px;">' + standard + '</div><div style="font-size:0.72rem;font-weight:700;letter-spacing:0.5px;">AUDIT REPORT</div></div><div class="rpt-hdr-right">Audit360 &mdash; ' + reportRef(d) + '</div></div>'
            + '</td></tr></thead><tfoot><tr><td>'
            + '<div class="rpt-ftr"><div class="rpt-ftr-left">Confidential &mdash; ' + (d.report.reportStatus === 'draft' ? 'Draft' : 'Final') + '</div><div class="rpt-ftr-center">This document is confidential and intended solely for the audited organization.<br>Unauthorized copying or distribution is prohibited.</div><div class="rpt-ftr-right">Generated by Audit360</div></div>'
            + '</td></tr></tfoot><tbody><tr><td>'
            + '<div class="no-print" style="position:fixed;top:20px;right:20px;z-index:1000;display:flex;gap:8px;">'
            + '<button data-action="print" style="background:linear-gradient(135deg,#1d4ed8,#1d4ed8);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:500;box-shadow:0 4px 12px rgba(37,99,235,0.3);" aria-label="Download"><i class="fa fa-download" style="margin-right:6px;"></i>Download PDF</button>'
            + '<button data-action="close" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:500;">Close</button></div>'
            // COVER PAGE
            + '<div class="cover">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;position:absolute;top:40px;left:0;right:0;padding:0 50px;">'
            + (d.cbLogo ? '<img src="' + d.cbLogo + '" style="height:60px;object-fit:contain;" alt="CB Logo">' : '<div></div>')
            // QR only prints when it resolves to a real, working address. In the
            // fallback state (no publicReportUrl/live origin/cbWebsite configured)
            // it encodes the sentinel https://audit-cb.example/ placeholder, which
            // will never resolve — a dead QR handed to the client is worse than no
            // QR at all, and the only warning about it (below) is print-hidden.
            + (d.qrFallback ? '<div></div>' : (function () {
                let qrHost;
                try { qrHost = new URL(d.cardUrl).host; } catch (_e) { qrHost = ''; }
                return '<div style="text-align:center;max-width:160px;">'
                    + '<img src="' + d.qrCodeUrl + '" style="height:120px;width:120px;display:block;margin:0 auto;" alt="Scan to verify">'
                    + '<div style="font-size:0.58rem;color:#64748b;margin-top:4px;letter-spacing:0.2px;font-weight:500;">Scan to view report card</div>'
                    + (qrHost ? '<div style="font-size:0.52rem;color:#94a3b8;margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;">' + window.UTILS.escapeHtml(qrHost) + '</div>' : '')
                    + '</div></div>';
            })())
            + '<div style="margin-top:40px;"></div>'
            + '<div class="cover-line"></div>'
            + '<h1 style="font-size:2.8rem;font-weight:700;color:#0f172a;letter-spacing:1px;">AUDIT REPORT</h1>'
            + '<p style="font-size:1.15rem;color:#64748b;margin-top:8px;">' + standard + '</p>'
            + '<div style="margin-top:50px;">'
            + (d.clientLogo ? '<img src="' + d.clientLogo + '" style="height:60px;object-fit:contain;margin-bottom:16px;" alt="Client">' : '')
            + '<div style="font-size:2rem;font-weight:700;color:#1d4ed8;">' + d.report.client + '</div>'
            + (d.client.industry ? '<div style="font-size:1rem;color:#64748b;margin-top:6px;">' + d.client.industry + '</div>' : '') + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 40px;max-width:480px;text-align:left;margin-top:50px;">'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:500;text-transform:uppercase;">Report Date</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.report.date || '—') + (d.report.endDate ? ' — ' + d.report.endDate : '') + '</div></div>'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:500;text-transform:uppercase;">Report ID</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + reportRef(d) + '</div></div>'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:500;text-transform:uppercase;">Lead Auditor</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.report.leadAuditor || '—') + '</div></div>'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:500;text-transform:uppercase;">Audit Type</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.auditPlan?.auditType || 'Initial') + '</div></div>'
            + (d.auditPlan?.team && d.auditPlan.team.length > 1 ? '<div style="grid-column:span 2;"><div style="font-size:0.78rem;color:#94a3b8;font-weight:500;text-transform:uppercase;">Audit Team</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + d.auditPlan.team.join(', ') + '</div></div>' : '')
            + '</div>'
            + '<div class="cover-doc" style="position:absolute;bottom:50px;left:50px;right:50px;border-top:2px solid #cbd5e1;padding-top:16px;">'
            + '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:#64748b;"><span><strong>Doc ID:</strong> ' + reportRef(d) + '</span><span><strong>Status:</strong> ' + ((d.report.reportStatus === 'final') ? 'Final' : 'Draft') + '</span><span><strong>Classification:</strong> Confidential</span></div>'
            + '</div>'
            + '</div>'
            // TABLE OF CONTENTS — formal report first, then each enabled annex under
            // its own heading, driven by the same secMap numbering used in the body.
            // Document Revision History is folded in here as a compact block (rather
            // than its own page-break in the cover's footer) — on its own it was
            // landing on an almost-empty page in the exported PDF.
            + (function () {
                const tocLink = function (s) {
                    const num = secMap[s.key].num;
                    return '<a href="#sec-' + s.key + '" class="toc-item">'
                        + '<div class="toc-num" style="background:' + s.color + ';">' + num + '</div>'
                        + '<div class="toc-item-body"><div class="toc-item-title">' + s.name + '</div>'
                        + '<div class="toc-item-desc">' + s.desc + '</div></div></a>';
                };
                const formalTocItems = formalDefs.filter(function (s) { return s.present; }).map(tocLink);
                const analyticsTocItems = annexEnabled('analytics') ? analyticsItems.filter(function (s) { return s.present !== false; }).map(tocLink) : [];
                const evidenceTocItems = annexEnabled('evidence') ? evidenceItems.filter(function (s) { return s.present !== false; }).map(tocLink) : [];
                const capaTocItems = annexEnabled('capa') ? capaItems.map(tocLink) : [];
                const totalCount = formalTocItems.length + analyticsTocItems.length + evidenceTocItems.length + capaTocItems.length;
                if (totalCount === 0) return '';
                const annexHeading = function (label, title) {
                    return '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;break-inside:avoid;">Annex ' + label + ' — ' + title + '</div>';
                };
                // Only renders when the report has real revision entries (release item 6) —
                // getRevisionRows() synthesizes a placeholder "Rev 0 / Draft" row so its
                // return is never empty, but that placeholder alone must not force this
                // block onto the page before the report's first issue.
                const revisionHistoryBlock = !hasActualRevisionHistory(d.report) ? '' : '<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;break-inside:avoid;page-break-inside:avoid;">'
                    + '<div style="font-size:0.66rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Document Revision History</div>'
                    + '<table style="width:100%;font-size:0.66rem;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th style="padding:4px 8px;text-align:left;">Ver</th><th style="padding:4px 8px;text-align:left;">Date</th><th style="padding:4px 8px;text-align:left;">Author</th><th style="padding:4px 8px;text-align:left;">Description</th></tr></thead><tbody>'
                    + revisionRows.map(r => '<tr><td style="padding:3px 8px;border-bottom:1px solid #e2e8f0;">' + r.ver + '</td><td style="padding:3px 8px;border-bottom:1px solid #e2e8f0;">' + r.date + '</td><td style="padding:3px 8px;border-bottom:1px solid #e2e8f0;">' + r.author + '</td><td style="padding:3px 8px;border-bottom:1px solid #e2e8f0;">' + r.desc + '</td></tr>').join('')
                    + '</tbody></table></div>';
                return '<div class="toc page-break"><div class="toc-title">Contents</div>'
                    + '<div class="toc-sub">' + d.report.client + ' — ' + standard + '</div>'
                    + '<div class="toc-line"></div>'
                    + '<div class="toc-list">'
                    + formalTocItems.join('')
                    + (analyticsTocItems.length ? annexHeading('A', 'Management Analytics') + analyticsTocItems.join('') : '')
                    + (evidenceTocItems.length ? annexHeading('B', 'Evidence') + evidenceTocItems.join('') : '')
                    + (capaTocItems.length ? annexHeading('C', 'Corrective Action Forms') + capaTocItems.join('') : '')
                    + '</div>'
                    + '<div style="margin-top:14px;padding-top:8px;border-top:1px solid #f1f5f9;text-align:right;font-size:0.68rem;color:#94a3b8;">'
                    + totalCount + ' sections</div>'
                    + revisionHistoryBlock
                    + '</div>';
            })()
            + '<div class="content">'
            // Formal report front matter — only the exec-summary module (formal group)
            + renderModSections(modFormalFront)
            // SECTION: AUDIT INFORMATION
            + (secMap['audit-info'] ? '<div id="sec-audit-info" class="sh" style="border-left-color:#1d4ed8;">' + sBadge('audit-info') + 'AUDIT INFORMATION</div><div class="sb"><table class="info-tbl">'
                + '<tr><td>Client Name</td><td><strong>' + d.report.client + '</strong></td></tr>'
                + '<tr><td>Industry</td><td>' + (d.client.industry || '—') + '</td></tr>'
                + '<tr><td>Certification Scope</td><td>' + (d.client.certificationScope || '—') + '</td></tr>'
                + '<tr><td>Number of Employees</td><td>' + (d.client.employees || d.client.numberOfEmployees || '—') + '</td></tr>'
                + '<tr><td>Audit Standard</td><td>' + standard + '</td></tr>'
                + '<tr><td>Audit Type</td><td>' + (d.auditPlan?.auditType || 'Initial') + '</td></tr>'
                + '<tr><td>Audit Dates</td><td>' + (d.report.date || '—') + (d.report.endDate ? ' → ' + d.report.endDate : '') + '</td></tr>'
                + '<tr><td>Lead Auditor</td><td>' + (d.report.leadAuditor || '—') + '</td></tr>'
                + '<tr><td>Audit Method</td><td>' + (d.auditPlan?.auditMethod || 'On-site') + '</td></tr>'
                + (function () {
                    var s = (d.client.sites && d.client.sites[0]) || {};
                    // Master-data values are hand-entered and frequently carry a
                    // trailing comma or stray whitespace; joining them raw printed
                    // "306 Camars Drive,, Warminster". Trim separators off each part
                    // and drop duplicates before joining.
                    var parts = [d.client.address || s.address, d.client.city || s.city, d.client.province || s.province, d.client.country || s.country]
                        .map(function (p) { return String(p == null ? '' : p).replace(/[\s,]+$/, '').replace(/^[\s,]+/, '').trim(); })
                        .filter(Boolean);
                    var seen = {};
                    var addr = parts.filter(function (p) { var k = p.toLowerCase(); if (seen[k]) return false; seen[k] = true; return true; }).join(', ') || '—';
                    return '<tr><td>Audit Location</td><td>' + addr + '</td></tr>';
                })()
                + '<tr><td>Plan Reference</td><td>' + (d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : 'Not Linked') + '</td></tr>'
                + '</table>'
                + (d.client.goodsServices && d.client.goodsServices.length > 0 ? '<div style="margin-top:10px;font-size:0.85rem;color:#334155;"><strong>Goods & Services:</strong> ' + d.client.goodsServices.map(g => g.name + (g.category ? ' (' + g.category + ')' : '')).join(', ') + '</div>' : '')
                + (d.client.keyProcesses && d.client.keyProcesses.length > 0 ? '<div style="margin-top:6px;font-size:0.85rem;color:#334155;"><strong>Key Processes:</strong> ' + d.client.keyProcesses.map(p => (p.name || p)).join(', ') + '</div>' : '')
                + '</div>' : '')
            // SECTION: AUDIT PROGRAMME
            + (secMap['audit-programme'] ? '<div id="sec-audit-programme" class="sh" style="border-left-color:#0ea5e9;">' + sBadge('audit-programme') + 'AUDIT PROGRAMME</div><div class="sb">'
                + '<div style="font-size:0.85rem;color:#475569;margin-bottom:12px;">Planned audit activities across the 3-year certification cycle, ' + programmeAnchorCaptionExport(auditProgramme) + '.</div>'
                + (auditProgramme.issues && auditProgramme.issues.length ? '<div style="font-size:0.8rem;color:#92400e;background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:12px;border-radius:4px;">' + auditProgramme.issues.map(function (i) { return window.UTILS.escapeHtml(i); }).join('<br>') + '</div>' : '')
                + '<table class="f-tbl"><thead><tr style="background:#eff6ff;"><th style="width:22%;">Audit Stage</th><th style="width:14%;">Planned Timing</th><th style="width:44%;">Focus &amp; Scope</th><th style="width:20%;text-align:center;">Status</th></tr></thead><tbody>'
                + programmeStages.map(function (s) {
                    const editedMap = { 'rp-prog-s1': editedProgS1, 'rp-prog-s2': editedProgS2, 'rp-prog-sv1': editedProgSv1, 'rp-prog-sv2': editedProgSv2, 'rp-prog-recert': editedProgRecert };
                    const editedTxt = editedMap[s.editId] || s.def;
                    const statusBg = s.status === 'Completed' ? '#ecfdf5' : (s.status === 'This audit' ? '#eff6ff' : ((s.status === 'Unknown' || s.status === 'Requires scheduling') ? '#fffbeb' : '#f1f5f9'));
                    const statusFg = s.status === 'Completed' ? '#15803d' : (s.status === 'This audit' ? '#1d4ed8' : ((s.status === 'Unknown' || s.status === 'Requires scheduling') ? '#92400e' : '#64748b'));
                    return '<tr><td style="font-weight:700;">' + s.label + '</td><td>' + s.timing + '</td><td>' + editedTxt + '</td><td style="text-align:center;"><span style="padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:' + statusBg + ';color:' + statusFg + ';">' + s.status + '</span></td></tr>';
                }).join('')
                + '</tbody></table></div>' : '')
            // SECTION: MULTI-SITE SAMPLING
            + (secMap['multi-site'] ? '<div id="sec-multi-site" class="sh" style="border-left-color:#15803d;">' + sBadge('multi-site') + 'MULTI-SITE SAMPLING</div><div class="sb">'
                + '<table class="f-tbl"><thead><tr style="background:#ecfdf5;"><th style="width:20%;">Site</th><th style="width:30%;">Address</th><th style="width:35%;">Scope at Site</th><th style="width:15%;text-align:center;">Sampled This Audit</th></tr></thead><tbody>'
                + allSites.map(function (s) {
                    const addr = [s.address, s.city, s.country].filter(Boolean).join(', ') || '—';
                    const scope = siteScopesMap[s.name] || d.client.certificationScope || '—';
                    const sampled = sampledSiteNames.indexOf(s.name) !== -1;
                    return '<tr><td style="font-weight:700;">' + s.name + '</td><td>' + addr + '</td><td>' + scope + '</td><td style="text-align:center;"><span style="padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;' + (sampled ? 'background:#ecfdf5;color:#15803d;' : 'background:#f1f5f9;color:#64748b;') + '">' + (sampled ? 'Yes' : 'No') + '</span></td></tr>';
                }).join('')
                + '</tbody></table>'
                + '<div style="margin-top:12px;color:#334155;font-size:0.88rem;line-height:1.6;">' + (editedSiteSamplingNote || 'Site sampling conducted in accordance with IAF MD 1.') + '</div>'
                + '</div>' : '')
            // SECTION: OBJECTIVES, CRITERIA & METHODOLOGY
            + (secMap['objectives'] ? '<div id="sec-objectives" class="sh" style="border-left-color:#475569;">' + sBadge('objectives') + 'AUDIT OBJECTIVES, CRITERIA &amp; METHODOLOGY</div><div class="sb">'
                + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">'
                + '<div><h4 style="margin:0 0 8px;font-size:0.9rem;color:#475569;">Audit Objectives</h4><div style="white-space:pre-line;line-height:1.7;font-size:0.88rem;color:#334155;">' + (editedObjectives || '• Determine conformity of the management system with audit criteria\n• Evaluate the ability of the management system to ensure compliance with statutory, regulatory and contractual requirements\n• Evaluate the effectiveness of the management system in meeting its specified objectives\n• Identify areas for potential improvement of the management system') + '</div></div>'
                + '<div><h4 style="margin:0 0 8px;font-size:0.9rem;color:#1d4ed8;">Audit Criteria</h4><div style="white-space:pre-line;line-height:1.7;font-size:0.88rem;color:#334155;">' + (editedCriteria || '• ' + standard + '\n• Organization management system documentation\n• Applicable legal and regulatory requirements\n• Previous audit findings and corrective action records') + '</div></div>'
                + '<div><h4 style="margin:0 0 8px;font-size:0.9rem;color:#475569;">Audit Methodology</h4><div style="white-space:pre-line;line-height:1.7;font-size:0.88rem;color:#334155;">' + (editedMethodology || methodologyDefaultText(d.auditPlan) || '• Risk-based sampling of processes, records, and documentation\n• Interviews with management and operational personnel\n• Observation of activities and work environment on-site\n• Review of documented information and objective evidence') + '</div></div>'
                + '</div></div>' : '')
            // SECTION: EXECUTIVE SUMMARY
            + (secMap['summary'] ? '<div id="sec-summary" class="sh" style="border-left-color:#059669;">' + sBadge('summary') + 'AUDIT SUMMARY &amp; OPENING MEETING</div><div class="sb">'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">'
                + '<div style="padding:10px 14px;background:#eff6ff;border-radius:8px;border-left:3px solid #1d4ed8;"><div style="font-size:0.72rem;color:#64748b;font-weight:500;text-transform:uppercase;">Audit Type</div><div style="font-size:0.9rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.auditPlan?.auditType || 'Initial') + '</div></div>'
                + '<div style="padding:10px 14px;background:#f8fafc;border-radius:8px;border-left:3px solid #475569;"><div style="font-size:0.72rem;color:#64748b;font-weight:500;text-transform:uppercase;">Audit Dates</div><div style="font-size:0.9rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.report.date || '—') + (d.report.endDate ? ' — ' + d.report.endDate : '') + '</div></div>'
                + '<div style="padding:10px 14px;background:#eff6ff;border-radius:8px;border-left:3px solid #1d4ed8;"><div style="font-size:0.72rem;color:#64748b;font-weight:500;text-transform:uppercase;">Duration</div><div style="font-size:0.9rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (function () { var md = d.auditPlan?.manDays || d.auditPlan?.man_days || '—'; var method = (d.auditPlan?.auditMethod || '').toLowerCase(); var suffix = method === 'remote' ? ' (Remote Audit)' : (method === 'hybrid' ? ' (Hybrid)' : (d.auditPlan?.onsiteDays ? ' (' + d.auditPlan.onsiteDays + ' On-site)' : '')); return md + ' Man-Days' + suffix; })() + '</div></div>'
                + '<div style="padding:10px 14px;background:#f8fafc;border-radius:8px;border-left:3px solid #475569;"><div style="font-size:0.72rem;color:#64748b;font-weight:500;text-transform:uppercase;">Method</div><div style="font-size:0.9rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.auditPlan?.auditMethod || 'On-site') + '</div></div></div>'
                + '<div style="color:#334155;font-size:0.92rem;line-height:1.55;">' + (formatRichText(editedSummary) || '<em>No executive summary recorded.</em>') + '</div>'
                + areaTableHtml
                + '<div style="padding:16px;background:#ecfdf5;border-radius:10px;margin-top:14px;border-left:4px solid #475569;"><strong style="color:#475569;font-size:0.9rem;">Opening Meeting</strong><table class="info-tbl" style="margin-top:8px;"><tr><td style="width:20%;">Date</td><td>' + (d.report.openingMeeting?.date || '—') + '</td></tr><tr><td>Attendees</td><td>' + (function () { var att = d.report.openingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(function (a) { return typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a; }).filter(Boolean).join(', ') || '—'; return String(att); })() + '</td></tr>' + (editedOpeningNotes ? '<tr><td>Notes</td><td>' + fmtRemark(editedOpeningNotes) + '</td></tr>' : '') + '</table></div>'
                + (editedPositiveObs ? '<div style="margin-top:20px;padding:14px 16px;background:#ecfdf5;border-radius:10px;border-left:4px solid #15803d;break-inside:avoid;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><h4 style="margin:0;color:#15803d;font-size:0.95rem;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;">Positive Observations</h4></div><div style="color:#15803d;font-size:0.9rem;line-height:1.6;">' + formatPositiveObs(editedPositiveObs) + '</div></div>' : '')
                + '</div>' : '')
            // SECTION: CONFORMANCE VERIFICATION
            + (secMap['conformance'] ? '<div id="sec-conformance" class="sh" style="border-left-color:#15803d;">' + sBadge('conformance') + 'CONFORMANCE VERIFICATION</div><div class="sb" style="padding:0;"><table class="f-tbl"><thead><tr style="background:#ecfdf5;"><th style="width:10%;">Clause</th><th style="width:30%;">ISO Requirement</th><th style="width:12%;text-align:center;">Status</th><th style="width:48%;">Evidence &amp; Remarks</th></tr></thead><tbody>' + conformRowsHtml + '</tbody></table></div>' : '')
            // SECTION: AUDIT TRAILS
            + (secMap['audit-trails'] ? '<div id="sec-audit-trails" class="sh" style="border-left-color:#0ea5e9;">' + sBadge('audit-trails') + 'AUDIT TRAILS</div><div class="sb">'
                + (auditTrailTimelineHtml ? '<div style="margin-bottom:22px;">' + auditTrailTimelineHtml + '</div>' : '')
                + (function () {
                    // Personnel Interviewed / Clauses Covered are the columns most likely to be
                    // "Not recorded"/"—" across every area — buildAdaptiveTable drops whichever
                    // is empty for all rows (Area, Items Sampled and Result always stay).
                    const atTable = buildAdaptiveTable([
                        { label: 'Area / Process', tdStyle: 'padding:11px 14px;font-weight:700;' },
                        { label: 'Personnel Interviewed', tdStyle: 'padding:11px 14px;color:#334155;' },
                        { label: 'Clauses Covered', tdStyle: 'padding:11px 14px;color:#334155;' },
                        { label: 'Items Sampled', thStyle: 'text-align:center;', tdStyle: 'padding:11px 14px;text-align:center;' },
                        { label: 'Result', thStyle: 'text-align:center;', tdStyle: 'padding:11px 14px;text-align:center;' }
                    ], auditTrailsBodyRows);
                    return '<table class="f-tbl"><thead>' + atTable.theadHtml + '</thead><tbody>' + atTable.bodyHtml + '</tbody></table>';
                })()
                + '</div>' : '')
            // SECTION: PREVIOUS FINDINGS STATUS
            + (secMap['prev-findings'] ? '<div id="sec-prev-findings" class="sh" style="border-left-color:#1d4ed8;">' + sBadge('prev-findings') + 'PREVIOUS FINDINGS STATUS</div><div class="sb">'
                + (prevFindingsRowsHtml
                    ? '<div style="margin-bottom:12px;padding:10px 14px;background:#eff6ff;border-radius:8px;font-size:0.88rem;color:#1d4ed8;">Nonconformities and observations raised at the previous audit were reviewed for effective closure.</div>'
                        + '<table class="f-tbl"><thead><tr style="background:#eff6ff;"><th style="width:14%;">Ref</th><th style="width:18%;">Clause</th><th style="width:12%;text-align:center;">Type</th><th style="width:56%;">Follow-up Status</th></tr></thead><tbody>' + prevFindingsRowsHtml + '</tbody></table>'
                    : '<div style="color:#334155;font-size:0.92rem;line-height:1.55;">' + (editedPrevFindings || 'Nonconformities and observations from the previous audit were reviewed. All corrective actions were verified as effectively implemented unless otherwise stated below.') + '</div>')
                + '</div>' : '')
            // SECTION: OBSERVATIONS
            + (secMap['obs'] ? '<div id="sec-obs" class="sh" style="border-left-color:#1d4ed8;">' + sBadge('obs') + 'OBSERVATIONS</div><div class="sb" style="padding:0;"><table class="f-tbl"><thead><tr style="background:#eff6ff;"><th style="width:10%;">Clause</th><th style="width:30%;">ISO Requirement</th><th style="width:12%;text-align:center;">Type</th><th style="width:48%;">Details</th></tr></thead><tbody>' + obsOnlyRowsHtml + '</tbody></table></div>' : '')
            // SECTION: OPPORTUNITIES FOR IMPROVEMENT (narrative + table)
            + (secMap['ofi'] ? '<div id="sec-ofi" class="sh" style="border-left-color:#b45309;">' + sBadge('ofi') + 'OPPORTUNITIES FOR IMPROVEMENT</div><div class="sb">'
                + (editedOfi ? '<div style="padding:14px 16px;background:#fffbeb;border-radius:10px;border-left:4px solid #b45309;margin-bottom:' + (ofiOnlyRowsHtml ? '14px' : '0') + ';">' + formatOfi(editedOfi) + '</div>' : '')
                + (ofiOnlyRowsHtml ? '<table class="f-tbl"><thead><tr style="background:#f1f5f9;"><th style="width:10%;">Clause</th><th style="width:30%;">ISO Requirement</th><th style="width:12%;text-align:center;">Type</th><th style="width:48%;">Recommendation</th></tr></thead><tbody>' + ofiOnlyRowsHtml + '</tbody></table>' : '')
                + '</div>' : '')
            // SECTION: FINDING DETAILS
            + (secMap['findings'] ? '<div id="sec-findings" class="sh" style="border-left-color:#b91c1c;">' + sBadge('findings') + 'FINDING DETAILS</div><div class="sb" style="padding:0;"><table class="f-tbl"><thead><tr><th style="width:10%;">Clause</th><th style="width:30%;">ISO Requirement</th><th style="width:12%;text-align:center;">Severity</th><th style="width:48%;">Evidence &amp; Remarks</th></tr></thead><tbody>' + (ncRowsHtml || '<tr><td colspan="4" style="padding:24px;text-align:center;color:#94a3b8;">No findings recorded.</td></tr>') + '</tbody></table></div>' : '')
            // SECTION: NCR REGISTER
            + (secMap['ncrs'] ? '<div id="sec-ncrs" class="sh" style="border-left-color:#b91c1c;">' + sBadge('ncrs') + 'NCR REGISTER</div><div class="sb">' + d.report.ncrs.map(ncr => '<div style="padding:14px 18px;border-left:4px solid ' + ((ncr.type || '').toLowerCase() === 'major' ? '#b91c1c' : '#b45309') + ';background:' + ((ncr.type || '').toLowerCase() === 'major' ? '#fef2f2' : '#fffbeb') + ';border-radius:0 8px 8px 0;margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div style="font-size:0.95rem;"><strong>' + (ncr.type || '') + '</strong> — ' + formalCriterionCell(ncr, standard) + '</div><span style="color:#64748b;font-size:0.82rem;white-space:nowrap;">' + (ncr.createdAt ? new Date(ncr.createdAt).toLocaleDateString() : '') + '</span></div><div style="color:#334155;font-size:0.9rem;margin-top:8px;line-height:1.7;">' + fmtRemark(ncr.description) + '</div>' + (ncr.evidenceImage ? '<div style="margin-top:8px;"><img src="' + (ncr.evidenceImageThumb || ncr.evidenceImage) + '" style="max-height:120px;border-radius:6px;border:1px solid #e2e8f0;"></div>' : '') + '</div>').join('') + '</div>' : '')

            // SECTION: CORRECTIVE ACTION REQUIREMENTS
            + (secMap['corrective'] ? '<div id="sec-corrective" class="sh" style="border-left-color:#be185d;">' + sBadge('corrective') + 'CORRECTIVE ACTION REQUIREMENTS</div><div class="sb">'
                + '<table class="info-tbl" style="table-layout:fixed;"><thead><tr style="background:#f8fafc;"><th style="width:15%;">NC Ref</th><th style="width:9%;">Clause</th><th style="width:9%;">Type</th><th style="width:32%;">Corrective Action Required</th><th style="width:15%;">Due Date</th><th style="width:20%;">Verification</th></tr></thead><tbody>'
                + (function () {
                    // Due dates are computed & persisted once in generateAuditReport (from the audit
                    // end date) and stored as item.caDueDate / ncr.caDueDate. Reuse that stored value
                    // here so regenerating the PDF does not shift due dates. Fall back to computing
                    // from today only for legacy records that predate persistence.
                    var fallbackDue = function (typ) { var due = new Date(); due.setDate(due.getDate() + ((typ || '').toLowerCase() === 'major' ? 30 : 90)); return due.toISOString().split('T')[0]; };
                    var ncItems = (d.report.checklistProgress || []).filter(function (p) { return p.status === 'nc' && (p.ncrType || '').toLowerCase() !== 'observation' && (p.ncrType || '').toLowerCase() !== 'ofi'; }); var ncrItems = d.report.ncrs || []; var rows = ''; ncItems.forEach(function (item, i) { var typRaw = (item.ncrType || '').toLowerCase(); var typ = typRaw === 'major' ? 'Major' : typRaw === 'minor' ? 'Minor' : 'Minor †'; var dueStr = item.caDueDate || fallbackDue(item.ncrType); rows += '<tr><td style="font-family:monospace;font-weight:500;color:#475569;white-space:nowrap;">NCR-' + String(d.report.id).substring(0, 6) + '-' + (i + 1) + '</td><td>' + formalCriterionCell({ clause: item.clauseRef || item.clause || '', criterionRef: item.criterionRef || null, criterionSource: item.criterionSource || null }, standard) + '</td><td><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:500;' + (typRaw === 'major' ? 'background:#fef2f2;color:#b91c1c;' : 'background:#fffbeb;color:#b45309;') + '">' + typ + '</span></td><td>Root cause analysis and corrective action required</td><td style="font-weight:500;color:#475569;white-space:nowrap;">' + dueStr + '</td><td>Document review & follow-up</td></tr>'; }); ncrItems.forEach(function (ncr, i) { var typRaw = (ncr.type || '').toLowerCase(); var typ = typRaw === 'major' ? 'Major' : (ncr.type || 'Minor'); var dueStr = ncr.caDueDate || fallbackDue(ncr.type); rows += '<tr><td style="font-family:monospace;font-weight:500;color:#475569;white-space:nowrap;">NCR-' + String(d.report.id).substring(0, 6) + '-' + (ncItems.length + i + 1) + '</td><td>' + formalCriterionCell(ncr, standard) + '</td><td><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:500;' + (typRaw === 'major' ? 'background:#fef2f2;color:#b91c1c;' : 'background:#fffbeb;color:#b45309;') + '">' + typ + '</span></td><td>Root cause analysis and corrective action required</td><td style="font-weight:500;color:#475569;white-space:nowrap;">' + dueStr + '</td><td>Document review & follow-up</td></tr>'; }); return rows; })()
                + '</tbody></table>'
                + '<div style="margin-top:12px;padding:10px;background:#f1f5f9;border-radius:8px;font-size:0.82rem;color:#475569;"><strong>Timeframes:</strong> Major NC — 30 days | Minor NC — 90 days from report issuance</div>'
                + '</div>' : '')
            // SECTION: CHANGES SINCE LAST AUDIT
            + (secMap['changes'] ? '<div id="sec-changes" class="sh" style="border-left-color:#78716c;">' + sBadge('changes') + 'CHANGES SINCE LAST AUDIT</div><div class="sb">'
                + '<div style="color:#334155;font-size:0.92rem;line-height:1.55;">' + (editedChanges || 'No significant changes to the management system scope, documentation, or organizational structure have been reported since the last audit.') + '</div>'
                + '</div>' : '')
            // SECTION: MANAGEMENT SYSTEM EFFECTIVENESS
            + (secMap['mgmt-effectiveness'] ? '<div id="sec-mgmt-effectiveness" class="sh" style="border-left-color:#475569;">' + sBadge('mgmt-effectiveness') + 'MANAGEMENT SYSTEM EFFECTIVENESS</div><div class="sb" style="padding:0;">'
                + '<table class="f-tbl"><thead><tr style="background:#f1f5f9;"><th style="width:38%;">Process</th><th style="width:62%;">Effectiveness Status</th></tr></thead><tbody>'
                + '<tr><td style="font-weight:500;">Internal Audit Programme</td><td>' + editedEffInternalAudit + '</td></tr>'
                + '<tr><td style="font-weight:500;">Management Review</td><td>' + editedEffMgmtReview + '</td></tr>'
                + '<tr><td style="font-weight:500;">Handling of Complaints</td><td>' + editedEffComplaints + '</td></tr>'
                + '<tr><td style="font-weight:500;">Use of Certification Marks / Logo</td><td>' + editedEffMarks + '</td></tr>'
                + '<tr><td style="font-weight:500;">Legal &amp; Regulatory Compliance</td><td>' + editedEffLegal + '</td></tr>'
                + '</tbody></table></div>' : '')
            // SECTION: AUDIT CONCLUSION & RECOMMENDATION
            + (secMap['conclusion'] ? '<div id="sec-conclusion" class="sh" style="border-left-color:#1d4ed8;">' + sBadge('conclusion') + 'AUDIT CONCLUSION &amp; RECOMMENDATION</div><div class="sb">'
                + (function () {
                    const rec = resolveRecommendation(d.report, d.stats);
                    // rec.showAutoCaption (manual vs auto-derived recommendation mismatch) is
                    // surfaced to CB staff in the preview/edit modal only — "system-derived" is
                    // internal terminology and must never reach the client-facing PDF.
                    return '<div style="margin-bottom:16px;"><strong style="color:#334155;">Certification Recommendation:</strong> <span style="margin-left:8px;padding:5px 18px;border-radius:20px;font-weight:700;font-size:0.88rem;' + (rec.primary === 'Recommended' ? 'background:#ecfdf5;color:#15803d;' : rec.primary === 'Not Recommended' ? 'background:#fef2f2;color:#b91c1c;' : 'background:#fffbeb;color:#b45309;') + '">' + rec.primary + '</span></div>';
                })()
                + '<div style="color:#334155;font-size:0.92rem;line-height:1.55;">' + formatRichText(editedConclusion) + '</div>'
                + '<div style="padding:16px;background:#eff6ff;border-radius:10px;margin-top:16px;border-left:4px solid #1d4ed8;"><strong style="color:#1d4ed8;font-size:0.9rem;">Closing Meeting</strong><table class="info-tbl" style="margin-top:8px;"><tr><td style="width:20%;">Date</td><td>' + (d.report.closingMeeting?.date || '—') + '</td></tr><tr><td>Attendees</td><td>' + (function () { var att = d.report.closingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(function (a) { return typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a; }).filter(Boolean).join(', ') || '—'; return String(att); })() + '</td></tr><tr><td>Summary</td><td>' + (fmtRemark(editedClosingSummary) || '—') + '</td></tr><tr><td>Unresolved Issues / Diverging Opinions</td><td>' + editedUnresolved + '</td></tr></table></div>'
                + '<p style="font-style:italic;font-size:0.8rem;color:#64748b;margin-top:16px;">This audit was conducted through a sampling process of the available information. Consequently, nonconformities may exist which have not been identified within this report.</p>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0;">'
                + '<div style="text-align:center;"><div style="border-bottom:1px solid #94a3b8;padding-bottom:8px;margin-bottom:6px;">&nbsp;</div><div style="font-size:0.85rem;color:#64748b;">Lead Auditor Signature</div><div style="font-size:0.88rem;color:#1e293b;font-weight:500;margin-top:4px;">' + (d.report.leadAuditor || '') + '</div></div>'
                + '<div style="text-align:center;"><div style="border-bottom:1px solid #94a3b8;padding-bottom:8px;margin-bottom:6px;">&nbsp;</div><div style="font-size:0.85rem;color:#64748b;">Client Representative</div></div></div></div>' : '')
            // SECTION: SIGNATURE & ATTESTATION
            + (secMap['signature'] ? '<div id="sec-signature" class="sh" style="border-left-color:#1e293b;">' + sBadge('signature') + 'SIGNATURE &amp; ATTESTATION</div><div class="sb">'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;">'
                + '<div style="padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;font-weight:500;">Lead Auditor</div><div style="font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:6px;">' + (d.auditPlan?.team?.[0] || d.report.leadAuditor || '') + '</div><div style="border-bottom:2px solid #1e293b;width:100%;margin:24px 0 6px;"></div><div style="font-size:0.8rem;color:#64748b;">Signature</div><div style="margin-top:12px;font-size:0.85rem;color:#475569;">Date: ' + (editedSigDate || d.today) + '</div></div>'
                + '<div style="padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;font-weight:500;">Technical Reviewer / Certification Manager</div><div style="font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:6px;">' + (editedReviewerName || (technicalReview.isLegacy && !editedReviewerName ? 'Not recorded' : '____________________')) + '</div>' + (technicalReview.outcome ? '<div style="font-size:0.82rem;font-weight:700;margin-bottom:6px;color:' + (technicalReview.outcome === 'Approved' ? '#15803d' : '#b91c1c') + ';">Outcome: ' + technicalReview.outcome + '</div>' : '') + (technicalReview.notes ? '<div style="font-size:0.78rem;color:#64748b;margin-bottom:6px;">' + window.UTILS.escapeHtml(technicalReview.notes) + '</div>' : '') + '<div style="border-bottom:2px solid #1e293b;width:100%;margin:24px 0 6px;"></div><div style="font-size:0.8rem;color:#64748b;">Signature</div><div style="margin-top:12px;font-size:0.85rem;color:#475569;">Date: ' + (editedReviewerDate || '____________________') + '</div></div>'
                + '</div>'
                + '<div style="margin-top:20px;padding:12px;background:#eff6ff;border-radius:8px;font-size:0.82rem;color:#475569;text-align:center;">This report is confidential and intended solely for the audited organization, the certification body, and the accreditation body. Unauthorized copying or distribution is prohibited.</div>'
                + '</div>' : '')
            // SECTION: DISTRIBUTION LIST
            + (secMap['distribution'] ? '<div id="sec-distribution" class="sh" style="border-left-color:#0d9488;">' + sBadge('distribution') + 'DISTRIBUTION LIST</div><div class="sb">'
                + '<div style="margin-bottom:10px;font-size:0.85rem;color:#64748b;">This report is distributed to the following parties. Unauthorized distribution is prohibited.</div>'
                + '<table class="info-tbl"><thead><tr style="background:#f8fafc;"><th style="width:5%;">#</th><th style="width:30%;">Recipient</th><th style="width:25%;">Role</th><th style="width:25%;">Organization</th><th style="width:15%;">Format</th></tr></thead><tbody>'
                + distributionRows
                + '</tbody></table></div>' : '')
            // ═══ END OF FORMAL CERTIFICATION REPORT — everything below is an optional,
            // separately-toggled annex (report.reportConfig.annexes) that does NOT form
            // part of the certification decision. ═══
            // ANNEX A — MANAGEMENT ANALYTICS
            + (annexEnabled('analytics') && analyticsItems.some(function (it) { return it.present !== false; })
                ? annexDivider('A', 'MANAGEMENT ANALYTICS', 'This annex contains Audit360 analytical indicators provided for management insight only. It does not form part of the certification decision.')
                : '')
            // SECTION: ANALYTICS DASHBOARD
            + (secMap['charts'] ? '<div id="sec-charts" class="sh" style="border-left-color:#1d4ed8;flex-direction:column;align-items:flex-start;gap:2px;"><div style="font-size:0.62rem;letter-spacing:0.08em;color:#cbd5e1;text-transform:uppercase;">Annex A</div><div style="display:flex;align-items:center;gap:12px;width:100%;">' + sBadge('charts') + 'ANALYTICS DASHBOARD</div></div><div class="sb">'
                + '<div class="stat-grid">'
                + '<div class="stat-box" style="background:' + d.stats.statusColor + '14;border-color:' + d.stats.statusColor + ';"><div class="stat-val" style="font-size:0.95rem;line-height:1.25;color:' + d.stats.statusColor + ';">' + d.stats.auditStatus + '</div><div class="stat-lbl">Certification Status</div></div>'
                + '<div class="stat-box" style="background:#fef2f2;border-color:#dc2626;"><div class="stat-val" style="color:#dc2626;">' + d.stats.majorNC + '</div><div class="stat-lbl">Major NC</div></div>'
                + '<div class="stat-box" style="background:#fffbeb;border-color:#b45309;"><div class="stat-val" style="color:#b45309;">' + d.stats.minorNC + (d.stats.pendingClassificationCount ? ' †' : '') + '</div><div class="stat-lbl">Minor NC</div></div>'
                + '<div class="stat-box" style="background:#eff6ff;border-color:#1d4ed8;"><div class="stat-val" style="color:#1d4ed8;">' + d.stats.observationCount + '</div><div class="stat-lbl">Observations</div></div>'
                + '<div class="stat-box" style="background:#f1f5f9;border-color:#475569;"><div class="stat-val" style="color:#475569;">' + d.stats.ofiCount + '</div><div class="stat-lbl">OFI</div></div>'
                + '<div class="stat-box" style="background:#f8fafc;border-color:#94a3b8;"><div class="stat-val" style="color:#64748b;">' + d.stats.notAssessedCount + '</div><div class="stat-lbl">Not Assessed</div></div></div>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0;">'
                + '<div class="stat-box" style="background:#ecfdf5;border-color:#059669;"><div class="stat-val" style="color:#059669;">' + (d.stats.coveragePct === null || d.stats.coveragePct === undefined ? '—' : d.stats.coveragePct + '%') + '</div><div class="stat-lbl">Audit Coverage %</div></div>'
                + '<div class="stat-box" style="background:#eef2ff;border-color:#4338ca;"><div class="stat-val" style="color:#4338ca;">' + (d.stats.conformityPct === null || d.stats.conformityPct === undefined ? '—' : d.stats.conformityPct + '%') + '</div><div class="stat-lbl">Conformity %</div></div></div>'
                + '<div style="font-size:0.76rem;color:#64748b;line-height:1.5;margin-bottom:16px;padding:8px 12px;background:#f8fafc;border-radius:6px;">' + (d.stats.rs?.methodologyNote || 'Coverage = items assessed (conform + NC + advisories) ÷ applicable items (excludes N/A). Conformity = conform ÷ (conform + NC); observations and OFIs are advisories and do not reduce conformity.') + '</div>'
                + (d.stats.rs?.reconciliation?.length ? '<div class="b4-card b4-callout b4-callout--warn" style="margin-bottom:16px;"><strong style="display:block;margin-bottom:4px;">Data Quality Notes</strong><ul style="margin:0;padding-left:18px;">' + d.stats.rs.reconciliation.map(function (r) { return '<li>' + (r.message || r.code || '') + '</li>'; }).join('') + '</ul></div>' : '')
                + '<div class="chart-grid"><div class="chart-box"><div class="chart-title">Findings Breakdown</div><canvas id="chart-doughnut"></canvas></div>'
                + '<div class="chart-box"><div class="chart-title">NC by Clause Section</div><canvas id="chart-clause"></canvas></div></div>'
                + '<div class="chart-grid" style="grid-template-columns:1fr;margin-top:16px;"><div class="chart-box"><div class="chart-title">Area Performance</div><canvas id="chart-area"></canvas></div></div>'
                + '</div>' : '')
            + renderModSections(modAnalyticsMods, 'A')
            // ANNEX B — EVIDENCE
            + (annexEnabled('evidence') && evidenceItems.some(function (it) { return it.present !== false; })
                ? annexDivider('B', 'EVIDENCE', 'This annex contains supporting evidence records for traceability. It does not form part of the certification decision.')
                : '')
            // SECTION: ANNEXURES
            + (secMap['annexures'] ? '<div id="sec-annexures" class="sh" style="border-left-color:#9333ea;flex-direction:column;align-items:flex-start;gap:2px;"><div style="font-size:0.62rem;letter-spacing:0.08em;color:#cbd5e1;text-transform:uppercase;">Annex B</div><div style="display:flex;align-items:center;gap:12px;width:100%;">' + sBadge('annexures') + 'ANNEXURES &amp; APPENDICES</div></div><div class="sb">'
                + '<div style="line-height:1.55;color:#334155;">'
                + '<div style="font-weight:700;margin-bottom:6px;">Annexure A — Audit Plan Reference</div>'
                + '<div style="margin-bottom:4px;">• Plan Reference: ' + (d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : 'N/A') + '</div>'
                + '<div style="margin-bottom:12px;">• Standard: ' + standard + '</div>'
                + '<div style="font-weight:700;margin-bottom:6px;">Annexure B — Checklist Summary</div>'
                + '<div style="margin-bottom:4px;">• Total Items Audited: ' + d.stats.totalItems + '</div>'
                + '<div style="margin-bottom:4px;">• Conforming: ' + d.stats.conformCount + ' | NC: ' + (d.stats.ncCount) + ' | Observations: ' + d.stats.observationCount + ' | OFI: ' + d.stats.ofiCount + '</div>'
                + '<div style="margin-bottom:12px;">• N/A Items: ' + d.stats.naCount + '</div>'
                + '</div></div>' : '')
            // Auditor-facing evidence analytics (evidence-intel, evidenceTrace, fwPack)
            + renderModSections(modEvidenceMods, 'B')
            // SECTION: EVIDENCE INDEX (text-only — no images embedded in main report).
            // Full-resolution photographic evidence is issued separately via the Evidence Pack
            // (window.exportEvidencePack) to keep the main report's blob size bounded. This
            // removes what was previously an unbounded, full-res image gallery.
            + (function () {
                if (!secMap['evidence']) return '';
                const evIdx = (d.report._evidenceIndexBuilt || []).concat(
                    // Include NCR-only evidence not already attached to a checklist item.
                    (d.report.ncrs || []).filter(function (n) { return n.evidenceImage && !n._evIndexed; }).map(function (ncr) {
                        return { evId: 'EV-NCR-' + (ncr.id || ''), image: ncr.evidenceImage, comment: '', clause: ncr.clause || '', criterionRef: ncr.criterionRef || null, criterionSource: ncr.criterionSource || null, dept: '', findingRef: ncr.type || 'NC', capturedAt: '', location: '' };
                    })
                );
                if (evIdx.length === 0) return '';
                const fmtWhen = function (v) {
                    if (!v) return 'Not recorded';
                    const dt = new Date(v);
                    return isNaN(dt.getTime()) ? 'Not recorded' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                };
                const esc = window.UTILS && window.UTILS.escapeHtml ? window.UTILS.escapeHtml : function (s) { return String(s == null ? '' : s); };
                // Department / Finding Ref / Captured are frequently blank on evidence
                // captured outside a checklist item — buildAdaptiveTable drops whichever
                // of those (never EV ID/Description/Clause) is empty on every exhibit.
                const evTdStyle = 'padding:8px 12px;';
                const evHeaders = [
                    { label: 'EV ID', tdStyle: evTdStyle + 'font-weight:700;white-space:nowrap;' },
                    { label: 'Description', tdStyle: evTdStyle },
                    { label: 'Clause', tdStyle: evTdStyle },
                    { label: 'Department', tdStyle: evTdStyle },
                    { label: 'Finding Ref', tdStyle: evTdStyle },
                    { label: 'Captured', tdStyle: evTdStyle }
                ];
                const evBodyRows = evIdx.map(function (ev, idx) {
                    const desc = cleanEvidenceText(ev.comment);
                    const descExcerpt = desc ? (desc.length > 90 ? desc.slice(0, 90).trim() + '…' : desc) : 'Not recorded';
                    // Evidence Index is a traceability listing, not a findings table —
                    // an unresolved internal ref here is a neutral fact, not an alarm.
                    const clauseCell = ev.clause ? displayCriterion(ev, false) : 'Not recorded';
                    return {
                        rowStyle: 'background:' + (idx % 2 ? '#f8fafc' : 'white') + ';',
                        cells: [
                            esc(ev.evId),
                            esc(descExcerpt),
                            clauseCell,
                            esc(ev.dept || 'Not recorded'),
                            esc(ev.findingRef || 'Not recorded'),
                            esc(fmtWhen(ev.capturedAt)) + (ev.location ? ' · ' + esc(String(ev.location).slice(0, 30)) : '')
                        ]
                    };
                });
                const evTable = buildAdaptiveTable(evHeaders, evBodyRows);
                return '<div id="sec-evidence" class="sh" style="border-left-color:#c2410c;">' + sBadge('evidence') + (secMap['evidence'] ? secMap['evidence'].name : 'EVIDENCE INDEX') + '</div><div class="sb">'
                    + '<table class="f-tbl"><thead>' + evTable.theadHtml + '</thead><tbody>' + evTable.bodyHtml + '</tbody></table>'
                    + '<div style="margin-top:14px;font-size:0.82rem;color:#64748b;text-align:center;font-style:italic;">' + evIdx.length + ' evidence exhibit(s) indexed. Full evidence images are issued separately in the Evidence Pack (same report reference).</div>'
                    + '</div>';
            })()
            // ANNEX C — CORRECTIVE ACTION FORMS
            + (annexEnabled('capa') && capaItems.length
                ? annexDivider('C', 'CORRECTIVE ACTION FORMS', 'This annex contains CAPA working documents; it supplements but does not replace the formal Corrective Action Requirements section and does not form part of the certification decision.')
                : '')
            + renderModSections(modCapaMods, 'C')
            + '</div>'
            // CLOSING PAGE — the report ends confidently, board-presentation style.
            + (function () {
                const nextStage = (function () {
                    // Read directly from the shared programme computation's nextAudit —
                    // the first stage strictly after "This audit" with a date that is
                    // actually after the current audit date. A 'Planned' stage whose date
                    // has collapsed onto/before the current audit (e.g. a certificate
                    // expiry inside the audit month) is never printed as if it were valid;
                    // buildProgramme relabels it 'Requires scheduling' and nextAudit skips it.
                    const na = auditProgramme && auditProgramme.nextAudit;
                    if (na && na.label && na.timing) return na.label + ' — ' + na.timing;
                    return 'To be scheduled in accordance with the certification programme';
                })();
                const row = function (label, value) {
                    return value ? '<tr><td style="padding:9px 14px;color:#64748b;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;font-weight:500;width:40%;">' + label + '</td><td style="padding:9px 14px;color:#0f2a43;font-weight:500;font-size:0.9rem;">' + value + '</td></tr>' : '';
                };
                return '<div class="page-break" style="min-height:88vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:60px 40px;">'
                    + '<div style="width:64px;height:3px;background:#0f2a43;margin-bottom:34px;"></div>'
                    + '<div style="font-size:0.78rem;letter-spacing:0.18em;color:#64748b;text-transform:uppercase;font-weight:500;margin-bottom:10px;">Audit Completed</div>'
                    + '<div style="font-size:1.5rem;font-weight:700;color:#0f2a43;margin-bottom:6px;">' + d.report.client + '</div>'
                    + '<div style="font-size:0.9rem;color:#475569;margin-bottom:30px;">' + standard + '</div>'
                    + (function () {
                        const rec = resolveRecommendation(d.report, d.stats);
                        const color = rec.isManual ? (rec.primary === 'Recommended' ? '#15803d' : rec.primary === 'Not Recommended' ? '#b91c1c' : '#b45309') : d.stats.recColor;
                        // "system-derived" is internal terminology (see resolveRecommendation) —
                        // never printed to the client; the spacer keeps the layout unchanged.
                        return '<div style="display:inline-block;padding:10px 26px;border:1px solid ' + color + ';border-radius:6px;color:' + color + ';font-weight:700;font-size:0.95rem;margin-bottom:8px;">' + rec.primary + '</div>'
                            + '<div style="margin-bottom:26px;"></div>';
                    })()
                    + '<table style="border-collapse:collapse;width:100%;max-width:460px;text-align:left;border-top:1px solid #e7ecf1;border-bottom:1px solid #e7ecf1;margin-bottom:32px;">'
                    + row('Audit Reference', String(d.report.id))
                    + row('Report Status', (d.report.reportStatus === 'final' ? 'Final — Issued' : 'Draft — not yet issued'))
                    + row('Lead Auditor', d.report.leadAuditor || '')
                    + row('Next Audit', nextStage)
                    + row('Contact', (cbName || '') + (cbEmail ? ' · ' + cbEmail : ''))
                    + '</table>'
                    + (d.qrCodeUrl && !d.qrFallback ? '<img src="' + d.qrCodeUrl + '" alt="Verification QR" style="width:84px;height:84px;margin-bottom:12px;">' + '<div style="font-size:0.68rem;color:#94a3b8;margin-bottom:26px;">Scan to verify this report</div>' : '')
                    + '<div style="font-size:0.85rem;color:#475569;max-width:440px;line-height:1.6;">Thank you for the professional cooperation extended to the audit team. This report has been prepared in accordance with ' + standard + ' requirements; distribution is limited to authorized recipients listed herein.</div>'
                    + '<div style="margin-top:26px;font-size:0.72rem;color:#94a3b8;">Doc Ref: ' + reportRef(d) + ' · Issue Date: ' + d.today + '</div>'
                    + '</div>';
            })();

        // Build chart init script SEPARATELY (will become its own Blob URL to bypass inline-script CSP)
        const chartScriptCode = ''
            + 'function rc(){'
            // One typeface across every chart: set Chart.js global defaults before
            // any chart is constructed so per-config font objects only vary size.
            + 'if(window.Chart&&Chart.defaults){Chart.defaults.font.family="Inter, Segoe UI, Helvetica, Arial, sans-serif";Chart.defaults.font.size=9;Chart.defaults.color="#475569";}'
            + 'var c1=document.getElementById("chart-doughnut");'
            + 'if(c1)new Chart(c1,{type:"doughnut",data:{labels:["Conformity","Minor NC","Major NC","Observations","OFI","Not Assessed"],datasets:[{data:[' + d.stats.conformCount + ',' + d.stats.minorNC + ',' + d.stats.majorNC + ',' + d.stats.observationCount + ',' + d.stats.ofiCount + ',' + d.stats.notAssessedCount + '],backgroundColor:["#15803d","#b45309","#b91c1c","#1d4ed8","#0891b2","#94a3b8"],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:"bottom",labels:{font:{size:11}}}}}});'
            + 'var c2=document.getElementById("chart-clause");'
            + 'if(c2)new Chart(c2,{type:"bar",data:{labels:' + JSON.stringify(clauseLabels.map(l => 'Clause ' + l)) + ',datasets:[{label:"NCs",data:' + JSON.stringify(clauseValues) + ',backgroundColor:"#1d4ed8",borderRadius:4}]},options:{responsive:true,indexAxis:"y",plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{stepSize:1}}}}});'
            + 'var c3=document.getElementById("chart-findings");'
            + 'if(c3)new Chart(c3,{type:"pie",data:{labels:["Conform","Non-Conformity","Observations/OFI","N/A"],datasets:[{data:[' + d.stats.conformCount + ',' + d.stats.actualNCCount + ',' + d.stats.obsOfiCount + ',' + d.stats.naCount + '],backgroundColor:["#15803d","#b91c1c","#1d4ed8","#94a3b8"],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:"bottom",labels:{font:{size:11}}}}}});'
            + 'var c4=document.getElementById("chart-area");'
            + 'if(c4){var ad=' + areaChartData + ';new Chart(c4,{type:"bar",data:{labels:ad.names,datasets:[{label:"Conform",data:ad.conform,backgroundColor:"#15803d",borderRadius:3},{label:"NC",data:ad.nc,backgroundColor:"#b91c1c",borderRadius:3},{label:"OBS",data:ad.obs,backgroundColor:"#1d4ed8",borderRadius:3},{label:"OFI",data:ad.ofi,backgroundColor:"#b45309",borderRadius:3}]},options:{responsive:true,indexAxis:"y",plugins:{legend:{position:"bottom",labels:{font:{size:10}}}},scales:{x:{stacked:true,beginAtZero:true,ticks:{stepSize:1}},y:{stacked:true,ticks:{font:{size:9}}}}}});}'
            // Chart 5: Department Findings
            + 'var c5=document.getElementById("chart-dept");'
            + 'if(c5){var dd=' + JSON.stringify((function () { var deptData = {}; (d.hydratedProgress || []).forEach(function (item) { var dept = item.department || ''; if (!dept) return; if (!deptData[dept]) deptData[dept] = { major: 0, minor: 0, obs: 0, conform: 0 }; if (item.status === 'nc') { var t = (item.ncrType || '').toLowerCase(); if (t === 'major') deptData[dept].major++; else if (t === 'minor') deptData[dept].minor++; else deptData[dept].obs++; } else if (item.status === 'conform') deptData[dept].conform++; }); var labels = Object.keys(deptData).sort(); return { labels: labels, major: labels.map(function (l) { return deptData[l].major; }), minor: labels.map(function (l) { return deptData[l].minor; }), obs: labels.map(function (l) { return deptData[l].obs; }), conform: labels.map(function (l) { return deptData[l].conform; }) }; })()) + ';'
            + 'if(dd.labels.length>0){new Chart(c5,{type:"bar",data:{labels:dd.labels,datasets:[{label:"Major NC",data:dd.major,backgroundColor:"#b91c1c",stack:"d"},{label:"Minor NC",data:dd.minor,backgroundColor:"#b45309",stack:"d"},{label:"OBS",data:dd.obs,backgroundColor:"#b45309",stack:"d"},{label:"Conform",data:dd.conform,backgroundColor:"#15803d",stack:"d"}]},options:{responsive:true,indexAxis:"y",plugins:{legend:{position:"bottom",labels:{font:{size:10}}}},scales:{x:{stacked:true,beginAtZero:true,ticks:{stepSize:1}},y:{stacked:true,ticks:{font:{size:9}}}}}});}else{var pB5=c5.closest(".chart-box");if(pB5)pB5.style.display="none";}}'
            // Chart 6: Personnel Workload
            + 'var c6=document.getElementById("chart-workload");'
            + 'if(c6){var pd=' + JSON.stringify((function () { var persData = {}; (d.hydratedProgress || []).forEach(function (item) { if (!item.personnel) return; if (!persData[item.personnel]) persData[item.personnel] = { conform: 0, nc: 0, na: 0 }; if (item.status === 'conform') persData[item.personnel].conform++; else if (item.status === 'nc') persData[item.personnel].nc++; else if (item.status === 'na') persData[item.personnel].na++; }); var labels = Object.keys(persData).sort(function (a, b) { return (persData[b].conform + persData[b].nc + persData[b].na) - (persData[a].conform + persData[a].nc + persData[a].na); }).slice(0, 10); return { labels: labels, conform: labels.map(function (p) { return persData[p].conform; }), nc: labels.map(function (p) { return persData[p].nc; }), na: labels.map(function (p) { return persData[p].na; }) }; })()) + ';'
            + 'if(pd.labels.length>0){new Chart(c6,{type:"bar",data:{labels:pd.labels,datasets:[{label:"Conform",data:pd.conform,backgroundColor:"#15803d",stack:"p"},{label:"NC",data:pd.nc,backgroundColor:"#b91c1c",stack:"p"},{label:"N/A",data:pd.na,backgroundColor:"#94a3b8",stack:"p"}]},options:{responsive:true,indexAxis:"y",plugins:{legend:{position:"bottom",labels:{font:{size:10}}}},scales:{x:{stacked:true,beginAtZero:true,ticks:{stepSize:1}},y:{stacked:true,ticks:{font:{size:9}}}}}});}else{var pB6=c6.closest(".chart-box");if(pB6)pB6.style.display="none";}}'
            // Chart 7: Compliance Radar
            + 'var c7=document.getElementById("chart-radar");'
            + 'if(c7){var rd=' + JSON.stringify((function () { var rData = {}; (d.hydratedProgress || []).forEach(function (item) { if (!item.department) return; if (!rData[item.department]) rData[item.department] = { total: 0, conform: 0 }; rData[item.department].total++; if (item.status === 'conform') rData[item.department].conform++; }); var labels = Object.keys(rData).sort(); return { labels: labels, data: labels.map(function (l) { return rData[l].total > 0 ? Math.round((rData[l].conform / rData[l].total) * 100) : 0; }) }; })()) + ';'
            + 'if(rd.labels.length>=3){new Chart(c7,{type:"radar",data:{labels:rd.labels,datasets:[{label:"Conformance %",data:rd.data,borderColor:"#1d4ed8",backgroundColor:"rgba(67,56,202,0.12)",borderWidth:2,pointBackgroundColor:"#1d4ed8"}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{r:{beginAtZero:true,max:100,ticks:{stepSize:25,font:{size:9}},pointLabels:{font:{size:10}}}}}});}else{var pBox=c7.closest(".chart-box");if(pBox)pBox.style.display="none";var pGrid=c7.closest(".chart-grid");if(pGrid)pGrid.style.display="none";}}'
            + modChartEntries.map(function (ch, i) {
                return 'var mc' + i + '=document.getElementById(' + JSON.stringify(ch.canvasId) + ');if(mc' + i + ')try{new Chart(mc' + i + ',' + ch.configJson + ');}catch(e){}';
            }).join('')
            + 'window._chartsReady=false;'
            // Rasterize each chart canvas as a JPEG (not PNG) to cut embedded payload size — charts are
            // photographic-free flat vector renders, so JPEG at 0.85 is visually lossless here but far
            // smaller than PNG. JPEG has no alpha channel, so the canvas is first drawn onto a white-backed
            // offscreen canvas at device scale to avoid black-background artifacts.
            // Chart.js sizes its backing store at devicePixelRatio, so an 800x500
            // chart box rasterised at 1600x1000 — roughly 130KB of JPEG each, and
            // ~2MB of a 4.7MB report, for images printed about 200px tall. Cap the
            // long edge at 800px: still ~2x the printed size at 300dpi, a quarter
            // of the pixels.
            + 'setTimeout(function(){document.querySelectorAll("canvas").forEach(function(cv){try{'
            +   'var CAP=800;var sc=Math.min(1,CAP/Math.max(cv.width||1,cv.height||1));'
            +   'var off=document.createElement("canvas");off.width=Math.max(1,Math.round(cv.width*sc));off.height=Math.max(1,Math.round(cv.height*sc));'
            +   'var octx=off.getContext("2d");octx.fillStyle="#ffffff";octx.fillRect(0,0,off.width,off.height);'
            +   'octx.imageSmoothingQuality="high";octx.drawImage(cv,0,0,off.width,off.height);'
            +   'var im=document.createElement("img");im.src=off.toDataURL("image/jpeg",0.82);im.style.maxWidth="100%";im.style.maxHeight=cv.style.maxHeight||"200px";im.style.objectFit="contain";cv.parentNode.replaceChild(im,cv);'
            + '}catch(e){}});'
            // Evidence photos and logos are embedded at capture resolution but printed
            // at 24-80px. Select every <img>, NOT img[data-ev-thumb]: that attribute is
            // only emitted on the in-app UI thumbnails (:669, :2296) and matches nothing
            // in this exported document, so this pass silently downscaled zero images and
            // full-resolution photos stayed embedded. Images actually present here are
            // .ev-inline (:2698), report-findings-ops.js:409, and the CB/client logos.
            // Two hardening points measured off a real 3.7MB export that still carried
            // 1600x1000 evidence JPEGs:
            //  (1) an <img> not yet decoded at this point has naturalWidth 0 and was
            //      silently skipped at full resolution — so the pass now awaits
            //      decode() on every image first, and only then flags _chartsReady
            //      (the print trigger), so printing can't race the downscale;
            //  (2) shown*3 measures the SCREEN layout, which can exceed the printed
            //      box many times over — so thumbnail contexts (.ev-inline, table
            //      cells) get a hard 480px cap and everything else caps at 1000px,
            //      plenty for the widest printable box at 300dpi.
            +   'var _imgs=Array.prototype.slice.call(document.querySelectorAll("img"));'
            +   'Promise.all(_imgs.map(function(im){return (im.decode?im.decode():Promise.resolve()).catch(function(){});})).then(function(){'
            +   '_imgs.forEach(function(im){try{'
            +     'if(!im.naturalWidth||im.naturalWidth<=400)return;'
            +     'var shown=Math.round((im.getBoundingClientRect().width||im.clientWidth||0));'
            +     'var cap=(im.closest&&im.closest(".ev-inline,td"))?480:1000;'
            +     'var target=Math.min(cap,Math.max(320,shown*3));if(target>=im.naturalWidth)return;'
            +     'var s=target/im.naturalWidth;'
            +     'var oc=document.createElement("canvas");oc.width=Math.round(im.naturalWidth*s);oc.height=Math.round(im.naturalHeight*s);'
            +     'var ox=oc.getContext("2d");ox.fillStyle="#ffffff";ox.fillRect(0,0,oc.width,oc.height);'
            +     'ox.imageSmoothingQuality="high";ox.drawImage(im,0,0,oc.width,oc.height);'
            +     'im.src=oc.toDataURL("image/jpeg",0.8);'
            + '}catch(e){}});'
            // Chrome keeps painting an <img>'s OLD bitmap until the swapped-in
            // src finishes decoding — a print snapshot taken in that window
            // embeds the ORIGINAL full-res JPEGs (measured: a 4.76MB export with
            // all 17 evidence shots still at 1600px). So the ready flag is only
            // raised after every swapped image has decoded its new resource.
            + 'Promise.all(_imgs.map(function(im){return (im.decode?im.decode():Promise.resolve()).catch(function(){});})).then(function(){window._chartsReady=true;});});},2500);'
            + '}function _waitForChart(){if(typeof Chart!=="undefined"){rc();}else{setTimeout(_waitForChart,100);}}_waitForChart();'
            // Wire up data-action buttons (Download PDF, Close) — parent's event delegator does not run in this window.
            // The print action is GATED on _chartsReady: an early click printed the
            // document before the chart/evidence downscale passes finished, embedding
            // full-resolution images (the 4.76MB export). If preparation somehow never
            // completes, print anyway after 15s rather than dead-ending the button.
            + 'document.addEventListener("click",function(ev){'
            + 'var t=ev.target.closest("[data-action]");if(!t)return;'
            + 'var a=t.getAttribute("data-action");'
            + 'if(a==="print"){ev.preventDefault();'
            +   'if(window._chartsReady){window.print();return;}'
            +   'if(t._waiting)return;t._waiting=true;'
            +   'var lbl=t.innerHTML;t.innerHTML="Optimizing images…";'
            +   'var t0=Date.now();var iv=setInterval(function(){'
            +     'if(window._chartsReady||Date.now()-t0>15000){clearInterval(iv);t.innerHTML=lbl;t._waiting=false;window.print();}'
            +   '},200);'
            + '}'
            + 'else if(a==="close"){ev.preventDefault();window.close();}'
            + '});';

        // Append script via external Blob URL (not inline) to comply with parent CSP
        const chartScriptBlob = new Blob([chartScriptCode], { type: 'application/javascript' });
        const chartScriptUrl = URL.createObjectURL(chartScriptBlob);
        // Normalize every section header to its category color (headers carry
        // hardcoded per-section hues from earlier iterations; one uniform surface
        // + category accent replaces them).
        const reportHtmlColored = reportHtml.replace(
            /<div id="sec-([a-z0-9-]+)" class="sh" style="[^"]*">/g,
            function (m, key) {
                const c = (secMap[key] && secMap[key].color) || '#475569';
                return '<div id="sec-' + key + '" class="sh" style="border-left-color:' + c + ';">';
            }
        );
        const reportHtmlFinal = reportHtmlColored + '</td></tr></tbody></table>'
            + '<script src="' + chartScriptUrl + '"></script></body></html>';

        // Open via Blob URL. Chart script is also a Blob URL (loaded via <script src>)
        // so it works even when parent page CSP disallows inline scripts.
        // BOM ensures browsers interpret as UTF-8 even if charset header missing.
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), reportHtmlFinal], { type: 'text/html;charset=utf-8' });
        // Size guardrail: warn before opening an oversized print blob (mostly driven by embedded
        // evidence images / charts). Limit is configurable via cbSettings.reportLimits.mainMb.
        const blobSizeMB = blob.size / 1048576;
        const mainMbLimit = (d.cbSettings && d.cbSettings.reportLimits && d.cbSettings.reportLimits.mainMb) || 5;
        if (blobSizeMB > mainMbLimit) {
            const proceed = window.confirm('Report is ' + blobSizeMB.toFixed(1) + ' MB (limit ' + mainMbLimit + ' MB). Consider excluding sections or using the Evidence Pack. Continue?');
            if (!proceed) { return; }
        }
        const blobUrl = URL.createObjectURL(blob);
        const printWindow = window.open(blobUrl, '_blank');
        if (!printWindow) {
            URL.revokeObjectURL(blobUrl);
            window.showNotification('Pop-up blocked. Please allow pop-ups for this site.', 'warning');
            return;
        }
        // Trigger print once charts render and convert to images
        function _attemptPrint(attempts) {
            try {
                if (printWindow.window && printWindow.window._chartsReady) {
                    printWindow.print();
                } else if (attempts < 90) {
                    // A big report (dozens of charts + evidence images) can take
                    // well over the old 10s cap to rasterize charts and downscale
                    // images — printing before _chartsReady embeds the ORIGINAL
                    // full-resolution images (measured: 4.76MB instead of ~2MB).
                    // Wait up to 45s before the print-anyway fallback.
                    setTimeout(function () { _attemptPrint(attempts + 1); }, 500);
                } else {
                    // Timeout fallback — print anyway
                    printWindow.print();
                }
            } catch (e) { console.warn('Print failed:', e); }
        }
        setTimeout(function () { _attemptPrint(0); }, 1000);
        setTimeout(function () {
            URL.revokeObjectURL(blobUrl);
            URL.revokeObjectURL(chartScriptUrl);
        }, 60000);
        const overlay = document.getElementById('report-preview-overlay');
        if (overlay) overlay.remove();
    };

    window.openCreateReportModal = openCreateReportModal;
    window.openEditReportModal = openEditReportModal;


})();

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateAuditReport: window.generateAuditReport, showReportPreviewModal: window.showReportPreviewModal, toggleReportSection: window.toggleReportSection, exportReportPDF: window.exportReportPDF, exportEvidencePack: window.exportEvidencePack, runFollowUpAIAnalysis: window.runFollowUpAIAnalysis, polishNotesWithAI: window.polishNotesWithAI, polishSingleNote: window.polishSingleNote };
}
