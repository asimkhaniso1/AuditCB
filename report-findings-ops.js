/**
 * report-findings-ops.js — Findings Operations module for AuditCB-360 audit reports.
 * =============================================================================
 * CONTRACT (window.ReportFindingsOps)
 * -----------------------------------------------------------------------------
 * Standalone vanilla JS. Does NOT modify any other file (does not require
 * report-risk.js, report-executive.js or report-scoring.js — it only reads
 * window.ReportExecutive.icon()/bigFourCss() if present, and replicates the
 * CAPA-join logic from report-risk.js's linkedCapaRecords() locally so this
 * file has zero hard dependency on load order).
 *
 * Public API:
 *   ReportFindingsOps.sections(d)              -> Array<SectionDef>
 *   ReportFindingsOps.sectionsPreviewToggles()  -> Array<{id,label,icon,color}>
 *
 * `d` shape (same object generateAuditReport() builds in execution-reporting.js):
 *   { report, hydratedProgress, client, auditPlan, cbSettings, cbSite,
 *     clientLogo, cbLogo, qrCodeUrl, stats, today }
 *   hydratedProgress items: { clause, requirement, comment, status:'nc'|'conform'|'na',
 *     ncrType:'major'|'minor'|'observation'|'ofi', department, evidenceImage,
 *     evidenceImages[], caDueDate, kbMatch }
 *
 * Sections (key / name):
 *   reqMatrix        APPLICABLE REQUIREMENTS MATRIX
 *   findingLifecycle FINDING STATUS LIFECYCLE
 *   evidenceTrace    EVIDENCE TRACEABILITY
 *   carForms         CORRECTIVE ACTION REQUEST FORMS (optional / toggle-off by default)
 *
 * Every section body is built inside its own try/catch and returns '' (dropped
 * by the integrator) on any error — sections(d) itself never throws.
 * =============================================================================
 */
(function (global) {
    'use strict';

    // ─── Utilities ──────────────────────────────────────────────────────────

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function safeArr(a) { return Array.isArray(a) ? a : []; }

    function icon(name, opts) {
        try {
            if (global.ReportExecutive && typeof global.ReportExecutive.icon === 'function') {
                return global.ReportExecutive.icon(name, opts);
            }
        } catch (e) { /* noop */ }
        return '';
    }

    // ─── Empty-column suppression ───────────────────────────────────────────
    // When every row of a rendered column is a "nothing recorded" placeholder
    // ('—', '', 'Not recorded', 'N/A'), the column carries no information and
    // is dropped entirely (header + every cell) rather than printed as a wall
    // of dashes. Styling is otherwise untouched — this only removes whole
    // <th>/<td> pairs from tables built via column definitions.
    var EMPTY_CELL_VALUES = ['—', '', 'Not recorded', 'N/A'];
    function isEmptyCellHtml(html) {
        var text = String(html == null ? '' : html).replace(/<[^>]*>/g, '').trim();
        return EMPTY_CELL_VALUES.indexOf(text) !== -1;
    }
    // cols: [{ header: '<th>...</th>', cell: fn(row) -> '<td>...</td>' }]
    // rows: data rows passed to each cell fn. Returns the filtered <thead>
    // cells and <tbody> rows as ready-to-splice HTML strings.
    function buildSuppressedTable(cols, rows) {
        var cellsByRow = rows.map(function (r) { return cols.map(function (c) { return c.cell(r); }); });
        var keep = cols.map(function (_, i) {
            if (!rows.length) return true; // nothing to judge emptiness against — keep all columns
            return cellsByRow.some(function (rowCells) { return !isEmptyCellHtml(rowCells[i]); });
        });
        var theadHtml = cols.filter(function (_, i) { return keep[i]; }).map(function (c) { return c.header; }).join('');
        var rowsHtml = cellsByRow.map(function (rowCells) {
            return '<tr style="break-inside:avoid;">' + rowCells.filter(function (_, i) { return keep[i]; }).join('') + '</tr>';
        }).join('');
        return { theadHtml: theadHtml, rowsHtml: rowsHtml, colCount: keep.filter(Boolean).length };
    }

    function truncate(s, maxLen) {
        var t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
        if (!maxLen || t.length <= maxLen) return t;
        var cut = t.slice(0, maxLen - 1);
        var lastSpace = cut.lastIndexOf(' ');
        if (lastSpace > maxLen * 0.6) cut = cut.slice(0, lastSpace);
        return cut.replace(/[\s,:;.\-]+$/, '') + '…';
    }

    function fmtDate(s) {
        if (!s) return '—';
        var dt = new Date(s);
        if (isNaN(dt.getTime())) return esc(String(s));
        return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // Criterion-safe clause display — an internal FOCUS/SURV/ORG/DOC reference
    // must never be presented as the finding's clause in a formal table.
    // Default label is the real clause only (e.g. "9.2") — no FOCUS/SURV/ORG/DOC
    // parenthetical. See ReportStats.formatCriterion() contract.
    function criterionCell(item) {
        try {
            if (global.ReportStats && typeof global.ReportStats.formatCriterion === 'function') {
                return esc(global.ReportStats.formatCriterion(item).label || '—');
            }
        } catch (e) { /* noop */ }
        var clause = String((item && item.clause) || '').trim();
        var ref = String((item && item.criterionRef) || '').trim();
        if (ref) return esc(ref);
        if (/^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i.test(clause)) return esc('internal ref ' + clause);
        return esc(clause || '—');
    }

    // ─── Local CAPA join (replicates report-risk.js linkedCapaRecords) ────────
    // Primary match: register entry's auditId === this report's audit plan id.
    // Secondary match: same clientId + clause matches a finding clause in this
    // report + raisedDate falls within the audit window (+/- 7 days tolerance).
    // Records already matched primarily are never double-counted.

    function findingClauseSet(hydratedProgress) {
        var set = {};
        safeArr(hydratedProgress).forEach(function (item) {
            if (!item) return;
            if (item.status === 'nc' && item.clause) set[String(item.clause).trim()] = true;
        });
        return set;
    }

    function linkedCapaRecordsLocal(d) {
        try {
            var ncrs = ((global.state && global.state.ncrs) || []).filter(function (n) {
                return n && n.status !== 'Withdrawn';
            });
            if (!ncrs || !ncrs.length) return [];

            var planId = (d && d.report && d.report.planId) || (d && d.auditPlan && d.auditPlan.id) || null;
            var clientId = d && d.report && d.report.clientId;
            var findingClauses = findingClauseSet(d && d.hydratedProgress);

            var baseDate = (d && d.report && (d.report.date || d.report.createdAt)) || null;
            var auditStart = (d && d.auditPlan && (d.auditPlan.startDate || d.auditPlan.date)) || baseDate;
            var auditEnd = (d && d.auditPlan && (d.auditPlan.endDate || d.auditPlan.date)) || baseDate;
            var startTime = auditStart ? new Date(auditStart).getTime() : null;
            var endTime = auditEnd ? new Date(auditEnd).getTime() : null;
            if (startTime !== null && isNaN(startTime)) startTime = null;
            if (endTime !== null && isNaN(endTime)) endTime = null;
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

    // Build a clause -> [capa records] index for fast per-finding lookup.
    function buildCapaIndex(d) {
        var idx = {};
        linkedCapaRecordsLocal(d).forEach(function (rec) {
            if (!rec || !rec.clause) return;
            var key = String(rec.clause).trim();
            if (!idx[key]) idx[key] = [];
            idx[key].push(rec);
        });
        return idx;
    }

    // Pick the most relevant CAPA record for a given clause (most recently raised).
    function bestCapaFor(capaIndex, clause) {
        var list = capaIndex[String(clause || '').trim()];
        if (!list || !list.length) return null;
        var best = list[0];
        list.forEach(function (r) {
            var bt = best.raisedDate ? new Date(best.raisedDate).getTime() : 0;
            var rt = r.raisedDate ? new Date(r.raisedDate).getTime() : 0;
            if (rt > bt) best = r;
        });
        return best;
    }

    // ─── Badges ─────────────────────────────────────────────────────────────

    var SEVERITY_SYMBOL = { good: '✓ ', warn: '! ', bad: '✕ ' };

    function badge(text, sev) {
        var sym = SEVERITY_SYMBOL[sev] || '';
        return '<span class="b4-badge b4-badge--' + esc(sev || 'neutral') + '">' + sym + esc(text) + '</span>';
    }

    function resultBadgeSeverity(status) {
        if (status === 'nc') return 'bad';
        if (status === 'conform') return 'good';
        if (status === 'na') return 'neutral';
        return 'neutral';
    }

    function ncrTypeSeverity(t) {
        var v = String(t || '').toLowerCase();
        if (v === 'major') return 'bad';
        if (v === 'minor') return 'warn';
        return 'info';
    }

    var LIFECYCLE_LABELS = {
        open: 'Open',
        corrected_during_audit: 'Corrected During Audit',
        verified: 'Verified',
        pending_verification: 'Pending Verification',
        closed: 'Closed',
        escalated: 'Escalated'
    };
    var LIFECYCLE_SEVERITY = {
        open: 'bad',
        escalated: 'bad',
        pending_verification: 'warn',
        corrected_during_audit: 'warn',
        verified: 'good',
        closed: 'good'
    };
    var LIFECYCLE_COLOR = {
        open: '#dc2626',
        escalated: '#dc2626',
        pending_verification: '#d97706',
        corrected_during_audit: '#d97706',
        verified: '#059669',
        closed: '#059669'
    };

    // ─── Section 1: APPLICABLE REQUIREMENTS MATRIX ─────────────────────────

    function clauseAuditedAndResult(hydratedProgress, ref) {
        var refStr = String(ref || '').trim();
        var matches = safeArr(hydratedProgress).filter(function (item) {
            if (!item || !item.clause) return false;
            var c = String(item.clause).trim();
            return c === refStr || c.indexOf(refStr) === 0 || refStr.indexOf(c) === 0;
        });
        if (!matches.length) return { audited: false, result: null };
        // Worst status wins: nc > na > conform
        var worst = null;
        matches.forEach(function (item) {
            if (item.status === 'nc') worst = 'nc';
            else if (item.status === 'na' && worst !== 'nc') worst = 'na';
            else if (!worst) worst = item.status || 'conform';
        });
        return { audited: true, result: worst };
    }

    function resultBadgeHtml(auditedInfo) {
        if (!auditedInfo.audited) return badge('Not sampled', 'neutral');
        var status = auditedInfo.result;
        var label = status === 'nc' ? 'Nonconformity' : status === 'na' ? 'Not Applicable' : status === 'conform' ? 'Conforming' : 'Not sampled';
        return badge(label, resultBadgeSeverity(status));
    }

    function buildReqMatrixSection(d) {
        var hydratedProgress = (d && d.hydratedProgress) || [];
        var groups = [];
        var usedFallback = false;

        try {
            if (global.AuditFrameworks && typeof global.AuditFrameworks.requirementSourcesFor === 'function') {
                var sources = global.AuditFrameworks.requirementSourcesFor(d && d.report, d && d.auditPlan);
                if (Array.isArray(sources) && sources.length) {
                    groups = sources;
                }
            }
        } catch (e) { /* fall through to fallback */ }

        if (!groups.length) {
            usedFallback = true;
            var seen = {};
            var items = [];
            safeArr(hydratedProgress).forEach(function (item) {
                if (!item || !item.clause) return;
                var key = String(item.clause).trim();
                if (!key || seen[key]) return;
                seen[key] = true;
                items.push({
                    ref: key,
                    title: (item.kbMatch && item.kbMatch.title) || item.requirement || '',
                    mandatory: true
                });
            });
            if (items.length) {
                groups = [{ type: 'iso-clause', label: 'ISO Clause Requirements', items: items }];
            }
        }

        if (!groups.length) return '';

        var TYPE_LABELS = {
            'iso-clause': 'ISO Clause Requirements',
            legal: 'Legal Requirements',
            customer: 'Customer Requirements',
            regulatory: 'Regulatory Requirements',
            contract: 'Contractual Requirements',
            internal: 'Internal Requirements',
            industry: 'Industry Requirements'
        };

        var blocks = groups.map(function (group) {
            if (!group || !Array.isArray(group.items) || !group.items.length) return '';
            var label = group.label || TYPE_LABELS[group.type] || 'Requirements';
            var isIso = group.type === 'iso-clause';
            var rows = group.items.map(function (it) {
                if (!it) return '';
                var applicable = it.mandatory === false ? 'No' : 'Yes';
                var auditedInfo = isIso ? clauseAuditedAndResult(hydratedProgress, it.ref) : { audited: false, result: null };
                var auditedLabel = isIso ? (auditedInfo.audited ? 'Yes' : 'No') : '—';
                var resultHtml = isIso ? resultBadgeHtml(auditedInfo) : badge('Not sampled', 'neutral');
                return '<tr style="break-inside:avoid;">'
                    + '<td style="font-weight:700;white-space:nowrap;">' + esc(it.ref || '—') + '</td>'
                    + '<td>' + esc(it.title || '—') + '</td>'
                    + '<td style="text-align:center;">' + esc(applicable) + '</td>'
                    + '<td style="text-align:center;">' + esc(auditedLabel) + '</td>'
                    + '<td style="text-align:center;">' + resultHtml + '</td>'
                    + '</tr>';
            }).join('');
            if (!rows) return '';
            return '<h4 class="b4-subhead" style="margin-top:var(--b4-s5);">' + esc(label) + '</h4>'
                + '<table class="b4-tbl">'
                + '<thead><tr><th>Ref</th><th>Requirement</th><th style="text-align:center;">Applicable</th><th style="text-align:center;">Audited</th><th style="text-align:center;">Result</th></tr></thead>'
                + '<tbody>' + rows + '</tbody>'
                + '</table>';
        }).filter(Boolean).join('');

        if (!blocks) return '';

        var note = usedFallback
            ? '<div class="b4-footnote" style="margin-top:var(--b4-s2);">Matrix derived from clauses sampled during this audit; a full requirement-source mapping (legal, customer, contractual) was not available for this report.</div>'
            : '';

        return blocks + note;
    }

    // ─── Section 2: FINDING STATUS LIFECYCLE ───────────────────────────────

    function deriveLifecycleStatus(d, item, capaIndex, storedKey) {
        try {
            var stored = d && d.report && d.report.findingStatus && d.report.findingStatus[storedKey];
            if (stored && stored.status && LIFECYCLE_LABELS[stored.status]) return stored.status;
        } catch (e) { /* ignore */ }

        var capa = bestCapaFor(capaIndex, item.clause);
        if (!capa) return 'open';

        var status = String(capa.status || '').toLowerCase();
        var effectiveness = String(capa.effectiveness || '').toLowerCase();
        if (status === 'closed' || effectiveness === 'effective') return 'closed';
        if (capa.verifiedDate) return 'verified';
        if (capa.correctiveAction) return 'pending_verification';
        if (capa.correction) {
            var cDate = capa.correctionDate || capa.raisedDate;
            if (cDate) {
                var raised = capa.raisedDate ? new Date(capa.raisedDate).toDateString() : null;
                var corrected = new Date(cDate).toDateString();
                if (raised && corrected === raised) return 'corrected_during_audit';
            }
            return 'corrected_during_audit';
        }
        return 'open';
    }

    function buildFindingLifecycleSection(d) {
        var hydratedProgress = (d && d.hydratedProgress) || [];
        // Real NCs only (major/minor). Pending-classification items are shown
        // with a badge; advisories (observation/ofi) have their own OBS/OFI
        // sections elsewhere and are excluded entirely here.
        var findings = safeArr(hydratedProgress).filter(function (item) {
            if (!item || item.status !== 'nc') return false;
            var t = String(item.ncrType || '').toLowerCase();
            return /^(major|minor)$/.test(t) || t === 'pending_classification';
        });
        if (!findings.length) return '';

        var capaIndex = buildCapaIndex(d);
        var counts = {};
        Object.keys(LIFECYCLE_LABELS).forEach(function (k) { counts[k] = 0; });

        // Pass 1: derive each finding's lifecycle row info and tally the
        // distribution-bar counts (unaffected by column suppression below).
        var rowInfo = findings.map(function (item, i) {
            var ref = 'F-' + String(i + 1).padStart(2, '0');
            var key = String(item.clause || '') + '|' + String(item.department || '');
            var status = deriveLifecycleStatus(d, item, capaIndex, key);
            counts[status] = (counts[status] || 0) + 1;

            var capa = bestCapaFor(capaIndex, item.clause);
            var isPending = String(item.ncrType || '').toLowerCase() === 'pending_classification';
            var severity = isPending ? 'Pending Classification' : (item.ncrType || '—');

            return { item: item, ref: ref, status: status, capa: capa, severity: severity };
        });

        var lifecycleCols = [
            { header: '<th>Ref</th>', cell: function (r) { return '<td style="font-weight:700;">' + esc(r.ref) + '</td>'; } },
            { header: '<th>Clause</th>', cell: function (r) { return '<td>' + criterionCell(r.item) + '</td>'; } },
            { header: '<th>Dept</th>', cell: function (r) { return '<td>' + esc(r.item.department || '—') + '</td>'; } },
            { header: '<th style="text-align:center;">Severity</th>', cell: function (r) { return '<td style="text-align:center;">' + badge(r.severity, ncrTypeSeverity(r.severity)) + '</td>'; } },
            { header: '<th style="text-align:center;">Status</th>', cell: function (r) { return '<td style="text-align:center;">' + badge(LIFECYCLE_LABELS[r.status] || r.status, LIFECYCLE_SEVERITY[r.status] || 'neutral') + '</td>'; } },
            { header: '<th>CAPA Ref</th>', cell: function (r) { return '<td>' + esc(r.capa && r.capa.id != null ? String(r.capa.id) : '—') + '</td>'; } },
            { header: '<th>Due Date</th>', cell: function (r) { return '<td>' + fmtDate(r.item.caDueDate || (r.capa && r.capa.dueDate)) + '</td>'; } }
        ];
        var table = buildSuppressedTable(lifecycleCols, rowInfo);

        var total = findings.length;
        var barSegments = Object.keys(LIFECYCLE_LABELS).map(function (k) {
            var n = counts[k] || 0;
            if (!n) return '';
            var pct = Math.max(4, Math.round((n / total) * 100));
            return '<div style="flex:' + n + ' 0 0;background:' + LIFECYCLE_COLOR[k] + ';color:#fff;text-align:center;padding:6px 4px;font-size:10px;font-weight:700;min-width:' + pct + '%;">'
                + esc(LIFECYCLE_LABELS[k]) + ' (' + n + ')</div>';
        }).join('');

        var distBar = '<div style="display:flex;width:100%;border-radius:4px;overflow:hidden;margin-bottom:var(--b4-s5);">' + barSegments + '</div>';

        return distBar
            + '<table class="b4-tbl">'
            + '<thead><tr>' + table.theadHtml + '</tr></thead>'
            + '<tbody>' + table.rowsHtml + '</tbody>'
            + '</table>';
    }

    // ─── Section 3: EVIDENCE TRACEABILITY ──────────────────────────────────

    function evidenceThumbHtml(url) {
        if (!url || typeof url !== 'string') return '';
        if (url.indexOf('data:') !== 0 && url.indexOf('http') !== 0) return '';
        return '<img src="' + esc(url) + '" style="width:48px;height:48px;object-fit:cover;border-radius:3px;margin:1px;border:1px solid var(--b4-border,#ddd);" />';
    }

    function buildEvidenceTraceSection(d) {
        var hydratedProgress = (d && d.hydratedProgress) || [];
        // Real NCs only (major/minor); pending-classification shown with badge;
        // advisories excluded entirely (they have their own OBS/OFI sections).
        var items = safeArr(hydratedProgress).filter(function (item) {
            if (!item || item.status !== 'nc') return false;
            var t = String(item.ncrType || '').toLowerCase();
            return /^(major|minor)$/.test(t) || t === 'pending_classification';
        });
        if (!items.length) return '';

        var capaIndex = buildCapaIndex(d);
        var hasEvidenceMeta = typeof global._evidenceMeta !== 'undefined' && global._evidenceMeta;

        var rowInfo = items.map(function (item, i) {
            var ref = 'F-' + String(i + 1).padStart(2, '0');
            var isPending = String(item.ncrType || '').toLowerCase() === 'pending_classification';
            // _evidenceMeta is keyed by the checklist item's uniqueId (NOT the
            // image id), with fields capturedAt (NOT timestamp) and optional location.
            var itemKey = item.uniqueId != null ? item.uniqueId : (item.id != null ? item.id : null);
            var itemMeta = (hasEvidenceMeta && itemKey != null) ? global._evidenceMeta[itemKey] : null;
            var imgs = safeArr(item.evidenceThumbs).length ? item.evidenceThumbs : (safeArr(item.evidenceImages).length ? item.evidenceImages : (item.evidenceImage ? [item.evidenceImage] : []));
            var thumbs = imgs.slice(0, 3).map(function (img) {
                var url = (img && img.url) || (img && img.dataUrl) || (typeof img === 'string' ? img : '');
                var thumb = evidenceThumbHtml(url);
                if (thumb && itemMeta) {
                    var metaLine = [itemMeta.capturedAt ? fmtDate(itemMeta.capturedAt) : '', itemMeta.location ? esc(itemMeta.location) : ''].filter(Boolean).join(' · ');
                    return '<div style="display:inline-block;text-align:center;">' + thumb + (metaLine ? '<div style="font-size:0.72rem;color:var(--b4-muted,#666);">' + metaLine + '</div>' : '') + '</div>';
                }
                return thumb;
            }).join('');
            var evidenceCell = (imgs.length ? '(' + imgs.length + ') ' : '(0) ') + thumbs;

            var capa = bestCapaFor(capaIndex, item.clause);
            var source = (item.kbMatch && item.kbMatch.sourceLabel) || 'ISO Clause';

            return { item: item, ref: ref, isPending: isPending, evidenceCell: evidenceCell, capa: capa, source: source };
        });

        var evidenceCols = [
            { header: '<th>Ref</th>', cell: function (r) { return '<td style="font-weight:700;">' + esc(r.ref) + (r.isPending ? ' ' + badge('Pending Classification', 'info') : '') + '</td>'; } },
            { header: '<th>Clause</th>', cell: function (r) { return '<td>' + criterionCell(r.item) + '</td>'; } },
            { header: '<th>Requirement</th>', cell: function (r) { return '<td>' + esc(truncate(r.item.requirement, 90) || '—') + '</td>'; } },
            { header: '<th>Dept</th>', cell: function (r) { return '<td>' + esc(r.item.department || '—') + '</td>'; } },
            { header: '<th>Evidence</th>', cell: function (r) { return '<td>' + r.evidenceCell + '</td>'; } },
            { header: '<th>Auditor Note</th>', cell: function (r) { return '<td>' + esc(truncate(r.item.comment, 80) || '—') + '</td>'; } },
            { header: '<th>CAPA ID</th>', cell: function (r) { return '<td>' + esc(r.capa && r.capa.id != null ? String(r.capa.id) : '—') + '</td>'; } },
            { header: '<th>Source</th>', cell: function (r) { return '<td>' + esc(r.source) + '</td>'; } }
        ];
        var table = buildSuppressedTable(evidenceCols, rowInfo);

        return '<table class="b4-tbl">'
            + '<thead><tr>' + table.theadHtml + '</tr></thead>'
            + '<tbody>' + table.rowsHtml + '</tbody>'
            + '</table>';
    }

    // ─── Section 4: CORRECTIVE ACTION REQUEST FORMS ────────────────────────

    function ruledLine(value, lines) {
        lines = lines || 3;
        if (value) return '<div style="white-space:pre-wrap;padding:6px 0;">' + esc(value) + '</div>';
        var out = '';
        for (var i = 0; i < lines; i++) {
            out += '<div style="border-bottom:1px solid var(--b4-border,#ccc);height:20px;"></div>';
        }
        return out;
    }

    function signatureLine(label) {
        return '<div style="flex:1;min-width:150px;">'
            + '<div style="border-bottom:1px solid #333;height:32px;"></div>'
            + '<div style="font-size:10px;color:var(--b4-muted,#666);margin-top:2px;">' + esc(label) + '</div>'
            + '</div>';
    }

    function buildOneCarForm(d, item, index, capaIndex) {
        var carNo = 'CAR-' + String(index + 1).padStart(2, '0');
        var capa = bestCapaFor(capaIndex, item.clause);
        var classification = String(item.ncrType || '').toLowerCase() === 'major' ? 'Major' : 'Minor';
        var reportRef = (d && d.report && (d.report.reportNumber || d.report.id)) || '—';
        var reportDate = fmtDate(d && d.report && d.report.date);
        var header = '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:16px;">'
            + '<div style="display:flex;align-items:center;gap:12px;"><div><div style="font-size:16px;font-weight:800;letter-spacing:0.5px;">AUDIT360 — CORRECTIVE ACTION REQUEST</div>'
            + '<div style="font-size:11px;color:var(--b4-muted,#666);">Report ' + esc(String(reportRef)) + ' · ' + reportDate + '</div></div></div>'
            + '<div style="text-align:right;"><div style="font-weight:700;">' + esc(carNo) + '</div>' + badge(classification, classification === 'Major' ? 'bad' : 'warn') + '</div>'
            + '</div>';

        var partA = '<h4 class="b4-subhead">PART A — NONCONFORMITY</h4>'
            + '<table class="b4-tbl" style="margin-bottom:var(--b4-s4);">'
            + '<tbody>'
            + '<tr><td style="font-weight:700;width:160px;">Criterion</td><td>' + criterionCell(item) + '</td></tr>'
            + '<tr><td style="font-weight:700;">Requirement</td><td>' + esc(item.requirement || '—') + '</td></tr>'
            + '<tr><td style="font-weight:700;">Statement of Nonconformity</td><td>' + esc(item.comment || '—') + '</td></tr>'
            + '<tr><td style="font-weight:700;">Objective Evidence</td><td>' + esc((safeArr(item.evidenceImages).length || item.evidenceImage) ? (safeArr(item.evidenceImages).length || 1) + ' evidence item(s) attached (see Evidence Traceability section)' : 'See auditor notes') + '</td></tr>'
            + '<tr><td style="font-weight:700;">Raised By / Date</td><td>' + esc((d && d.report && d.report.leadAuditor) || (capa && capa.raisedBy) || '—') + ' / ' + fmtDate((d && d.report && d.report.date) || (capa && capa.raisedDate)) + '</td></tr>'
            + '</tbody></table>';

        var partB = '<h4 class="b4-subhead">PART B — ROOT CAUSE &amp; CORRECTION</h4>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:var(--b4-s4);">'
            + '<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--b4-muted,#666);margin-bottom:2px;">Correction (immediate fix)</div>' + ruledLine(capa && capa.correction) + '</div>'
            + '<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--b4-muted,#666);margin-bottom:2px;">Root Cause</div>' + ruledLine(capa && capa.rootCause) + '</div>'
            + '<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--b4-muted,#666);margin-bottom:2px;">Corrective Action</div>' + ruledLine(capa && capa.correctiveAction) + '</div>'
            + '<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--b4-muted,#666);margin-bottom:2px;">Responsible / Due Date</div>' + ruledLine((capa && capa.capaResponsible) ? capa.capaResponsible + (capa.dueDate ? ' — due ' + fmtDate(capa.dueDate) : '') : (item.caDueDate ? 'Due ' + fmtDate(item.caDueDate) : ''), 1) + '</div>'
            + '</div>';

        var partC = '<h4 class="b4-subhead">PART C — VERIFICATION &amp; CLOSURE</h4>'
            + '<table class="b4-tbl" style="margin-bottom:var(--b4-s5);">'
            + '<tbody>'
            + '<tr><td style="font-weight:700;width:160px;">Verification Method</td><td>' + esc((capa && capa.verificationMethod) || '—') + '</td></tr>'
            + '<tr><td style="font-weight:700;">Verified By / Date</td><td>' + esc((capa && capa.verifiedBy) || '—') + ' / ' + fmtDate(capa && capa.verifiedDate) + '</td></tr>'
            + '<tr><td style="font-weight:700;">Effectiveness</td><td>' + esc((capa && capa.effectiveness) || 'Pending assessment') + '</td></tr>'
            + '</tbody></table>'
            + '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:24px;">'
            + signatureLine('Auditee Representative')
            + signatureLine('Lead Auditor')
            + signatureLine('Date')
            + '</div>';

        return '<div style="page-break-before:always;break-before:page;">' + header + partA + partB + partC + '</div>';
    }

    function buildCarFormsSection(d) {
        var hydratedProgress = (d && d.hydratedProgress) || [];
        var majors = safeArr(hydratedProgress).filter(function (item) {
            if (!item || item.status !== 'nc') return false;
            var t = String(item.ncrType || '').toLowerCase();
            return t === 'major' || t === 'minor';
        });
        if (!majors.length) return '';

        var capaIndex = buildCapaIndex(d);
        return majors.map(function (item, i) { return buildOneCarForm(d, item, i, capaIndex); }).join('');
    }

    // ─── sections() / sectionsPreviewToggles() ─────────────────────────────

    function safeSection(fn, d) {
        try {
            return fn(d) || '';
        } catch (e) {
            return '';
        }
    }

    function sections(d) {
        var out = [];

        var reqMatrixHtml = safeSection(buildReqMatrixSection, d);
        if (reqMatrixHtml) {
            out.push({ key: 'reqMatrix', name: 'APPLICABLE REQUIREMENTS MATRIX', desc: 'All applicable requirement sources mapped to audit coverage and result', color: '#0f766e', bodyHtml: reqMatrixHtml, charts: [] });
        }

        var lifecycleHtml = safeSection(buildFindingLifecycleSection, d);
        if (lifecycleHtml) {
            out.push({ key: 'findingLifecycle', name: 'FINDING STATUS LIFECYCLE', desc: 'Status distribution and per-finding lifecycle tracking through to closure', color: '#b45309', bodyHtml: lifecycleHtml, charts: [] });
        }

        var evidenceHtml = safeSection(buildEvidenceTraceSection, d);
        if (evidenceHtml) {
            out.push({ key: 'evidenceTrace', name: 'EVIDENCE TRACEABILITY', desc: 'Finding-to-evidence chain with linked CAPA references', color: '#1d4ed8', bodyHtml: evidenceHtml, charts: [] });
        }

        var carFormsHtml = safeSection(buildCarFormsSection, d);
        if (carFormsHtml) {
            out.push({ key: 'carForms', name: 'CORRECTIVE ACTION REQUEST FORMS', desc: 'One formal CAR form per major/minor nonconformity, print-ready', color: '#991b1b', bodyHtml: carFormsHtml, charts: [] });
        }

        return out;
    }

    function sectionsPreviewToggles() {
        return [
            { id: 'reqMatrix', label: 'Requirements Matrix', icon: 'fa-list-check', color: '#0f766e' },
            { id: 'findingLifecycle', label: 'Finding Lifecycle', icon: 'fa-timeline', color: '#b45309' },
            { id: 'evidenceTrace', label: 'Evidence Traceability', icon: 'fa-camera-retro', color: '#1d4ed8' },
            { id: 'carForms', label: 'CAR Forms', icon: 'fa-file-signature', color: '#991b1b' }
        ];
    }

    global.ReportFindingsOps = { sections: sections, sectionsPreviewToggles: sectionsPreviewToggles };
})(window);
