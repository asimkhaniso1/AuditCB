/**
 * report-operational.js — Operational Coverage & Logistics module for AuditCB-360 audit reports.
 * =============================================================================
 * Standalone, framework-free companion to execution-reporting.js. Does NOT
 * modify or depend on execution-reporting.js at load time — it only reads
 * the same `d` data shape that generateAuditReport() builds and stores on
 * window._reportPreviewData (report, hydratedProgress, client, auditPlan,
 * cbSettings, cbSite, clientLogo, cbLogo, qrCodeUrl, stats, today).
 *
 * Public API — window.ReportOperational:
 *
 *   sections(d) -> [{ key, name, desc, color, bodyHtml, charts:[{canvasId, configJson}] }, ...]
 *     Section keys (in order): 'opsCoverage', 'opsAttendance', 'opsSampling',
 *     'opsHeatmap', 'opsDistribution'. Sections with falsy bodyHtml are dropped
 *     by the caller. Every builder is wrapped in try/catch and returns '' on
 *     any error, so sections(d) itself never throws.
 *
 *   sectionsPreviewToggles() -> [{ id, label, icon, color }]
 *     Matches the preview-pill array pattern used in showReportPreviewModal()
 *     / report-scoring.js / report-risk.js.
 *
 * Markup consumes the shared Big-Four design system exposed by
 * report-executive.js's bigFourCss() (.b4-kpi-card/.b4-kpi-grid/.b4-tbl/
 * .b4-badge/.b4-card/.b4-callout/.b4-caption/.b4-eyebrow, etc.) with inline
 * -style fallbacks so markup still reads correctly if a class isn't defined.
 * Icons come exclusively from window.ReportExecutive.icon() using names that
 * exist in that module's ICON_PATHS table (department, evidence, interview,
 * site, camera, clock, document, finding, check, target, gauge, clause).
 * =============================================================================
 */
(function (global) {
    'use strict';

    // ── Helpers ─────────────────────────────────────────────────────────────
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function iconSafe(name, opts) {
        try {
            if (global.ReportExecutive && typeof global.ReportExecutive.icon === 'function') {
                return global.ReportExecutive.icon(name, opts);
            }
        } catch (_e) { /* defensive no-op */ }
        return '';
    }

    function fmtDate(v) {
        if (!v) return '—';
        try {
            var dt = new Date(v);
            if (isNaN(dt.getTime())) return String(v);
            return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (_e) { return String(v); }
    }

    var UNASSIGNED_LABEL = 'Unassigned / Cross-functional';
    // Prefer the canonical window.ReportStats.normalizeDeptName() when that
    // module has loaded (shared single source of truth across report-*.js);
    // fall back to this local copy — kept consistent with the same label —
    // so this file still works standalone if load order varies.
    function normalizeDeptName(raw) {
        try {
            if (global.ReportStats && typeof global.ReportStats.normalizeDeptName === 'function') {
                return global.ReportStats.normalizeDeptName(raw);
            }
        } catch (_e) { /* fall through to local logic */ }
        var s = String(raw == null ? '' : raw).trim();
        if (!s) return UNASSIGNED_LABEL;
        if (/^(unassigned|general|n\/?a|none|other)$/i.test(s)) return UNASSIGNED_LABEL;
        return s;
    }

    // Attendees are polymorphic: string | string[] | [{name, role, organization}].
    // Normalizes to an array of {name, role, organization}. Mirrors the coercion
    // pattern used inline in execution-reporting.js (see openingMeeting/closingMeeting
    // attendee rendering) but returns structured rows instead of a joined string.
    function coerceAttendees(att) {
        if (!att) return [];
        if (typeof att === 'string') {
            return att.split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(Boolean)
                .map(function (name) { return { name: name, role: '', organization: '' }; });
        }
        if (Array.isArray(att)) {
            return att.map(function (a) {
                if (a == null) return null;
                if (typeof a === 'object') {
                    return {
                        name: a.name || a.fullName || '',
                        role: a.role || a.title || '',
                        organization: a.organization || a.org || a.company || ''
                    };
                }
                return { name: String(a), role: '', organization: '' };
            }).filter(function (a) { return a && a.name; });
        }
        return [];
    }

    function evidenceCount(item) {
        var n = 0;
        if (item && item.evidenceImage) n++;
        if (item && Array.isArray(item.evidenceImages)) n += item.evidenceImages.length;
        return n;
    }

    function isMajorNc(item) {
        return item && item.status === 'nc' && String(item.ncrType || '').toLowerCase() === 'major';
    }
    function isMinorOrObs(item) {
        if (!item || item.status !== 'nc') return false;
        var t = String(item.ncrType || '').toLowerCase();
        return t === 'minor' || t === 'observation' || t === 'ofi';
    }

    // ── SECTION 1: AUDIT COVERAGE MATRIX ──────────────────────────────────────
    function buildCoverageSection(d) {
        var items = Array.isArray(d.hydratedProgress) ? d.hydratedProgress : [];
        var byDept = {};
        items.forEach(function (item) {
            var dept = normalizeDeptName(item && item.department);
            if (!byDept[dept]) byDept[dept] = { process: dept, department: dept, applicable: 0, total: 0, audited: 0, sampled: 0, evidenceRefs: 0, majors: 0, minorObs: 0 };
            var row = byDept[dept];
            row.total++;
            if (!item || item.status !== 'na') row.applicable++;
            if (item && item.status) row.audited++;
            if (item && (item.comment || evidenceCount(item) > 0)) row.sampled++;
            row.evidenceRefs += evidenceCount(item);
            if (isMajorNc(item)) row.majors++;
            if (isMinorOrObs(item)) row.minorObs++;
        });

        // Merge stored d.report.coverage rows over derived ones, keyed by department+process.
        var stored = (d.report && Array.isArray(d.report.coverage)) ? d.report.coverage : [];
        stored.forEach(function (s) {
            if (!s) return;
            var key = normalizeDeptName(s.department || s.process);
            var base = byDept[key] || { process: s.process || key, department: key, applicable: 0, total: 0, audited: 0, sampled: 0, evidenceRefs: 0, majors: 0, minorObs: 0 };
            byDept[key] = Object.assign({}, base, {
                process: s.process || base.process,
                applicable: s.applicable != null ? s.applicable : base.applicable,
                audited: s.audited != null ? s.audited : base.audited,
                sampled: s.sampleSize != null ? s.sampleSize : base.sampled,
                evidenceRefs: s.evidenceRefs != null ? s.evidenceRefs : base.evidenceRefs,
                resultOverride: s.result || null
            });
        });

        var deptKeys = Object.keys(byDept).sort(function (a, b) {
            if (a === UNASSIGNED_LABEL) return 1;
            if (b === UNASSIGNED_LABEL) return -1;
            return byDept[b].total - byDept[a].total;
        });
        if (!deptKeys.length) return '';

        var rows = deptKeys.map(function (key) {
            var r = byDept[key];
            var resultLabel = r.resultOverride || (r.audited === 0 ? 'Not Audited' : (r.majors > 0 ? 'Major NC Raised' : (r.minorObs > 0 ? 'Minor NC / Obs' : 'Conforming')));
            var sev = r.audited === 0 ? 'neutral' : (r.majors > 0 ? 'bad' : (r.minorObs > 0 ? 'warn' : 'good'));
            var sevSym = sev === 'good' ? '✓ ' : sev === 'warn' ? '! ' : sev === 'bad' ? '✕ ' : '';
            return '<tr>'
                + '<td style="font-weight:600;">' + esc(r.process) + '</td>'
                + '<td style="text-align:center;">' + r.applicable + '/' + r.total + '</td>'
                + '<td style="text-align:center;">' + r.audited + '</td>'
                + '<td style="text-align:center;">' + r.sampled + '</td>'
                + '<td style="text-align:center;">' + r.evidenceRefs + '</td>'
                + '<td style="text-align:center;"><span class="b4-badge b4-badge--' + sev + '">' + sevSym + esc(resultLabel) + '</span></td>'
                + '</tr>';
        }).join('');

        return '<div><table class="b4-tbl"><thead><tr>'
            + '<th style="width:26%;">Process / Department</th>'
            + '<th style="width:16%;text-align:center;">Items Applicable</th>'
            + '<th style="width:14%;text-align:center;">Audited</th>'
            + '<th style="width:14%;text-align:center;">Sampled</th>'
            + '<th style="width:12%;text-align:center;">Evidence</th>'
            + '<th style="width:18%;text-align:center;">Result</th>'
            + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
            + '<div class="b4-caption" style="margin-top:var(--b4-s2, 8px);">Coverage derived from checklist activity recorded during the audit'
            + (stored.length ? '; merged with recorded coverage entries where available.' : '.') + '</div>';
    }

    // ── SECTION 2: AUDIT ATTENDANCE REGISTER ──────────────────────────────────
    function meetingBlock(label, meeting, iconName) {
        if (!meeting) return { html: '', attendees: [] };
        var attendees = coerceAttendees(meeting.attendees);
        var notes = meeting.notes || meeting.summary || '';
        if (!meeting.date && attendees.length === 0 && !notes) return { html: '', attendees: [] };

        var attRows = attendees.length
            ? attendees.map(function (a) {
                return '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.role || '—') + '</td><td>' + esc(a.organization || '—') + '</td></tr>';
            }).join('')
            : '<tr><td colspan="3" style="text-align:center;color:var(--b4-muted,#64748b);">No attendees recorded</td></tr>';

        var html = '<div class="b4-card" style="break-inside:avoid;">'
            + '<div class="b4-card-heading">' + iconSafe(iconName, { size: 14 }) + ' ' + esc(label) + '</div>'
            + '<div class="b4-caption" style="margin-bottom:var(--b4-s2, 8px);">Date: <strong>' + esc(fmtDate(meeting.date)) + '</strong>'
            + (meeting.time ? ' &middot; Time: <strong>' + esc(meeting.time) + '</strong>' : '') + '</div>'
            + '<table class="b4-tbl b4-tbl--compact"><thead><tr><th>Name</th><th>Role</th><th>Organization</th></tr></thead><tbody>' + attRows + '</tbody></table>'
            + (notes ? '<div class="b4-callout b4-callout--info" style="margin-top:var(--b4-s2, 8px);">' + esc(notes) + '</div>' : '')
            + '</div>';
        return { html: html, attendees: attendees };
    }

    function buildAttendanceSection(d) {
        var opening = meetingBlock('Opening Meeting', d.report && d.report.openingMeeting, 'interview');
        var closing = meetingBlock('Closing Meeting', d.report && d.report.closingMeeting, 'interview');
        if (!opening.html && !closing.html) return '';

        var out = '<div class="b4-grid-2">' + (opening.html || '<div></div>') + (closing.html || '<div></div>') + '</div>';

        if (opening.attendees.length && closing.attendees.length) {
            var byName = {};
            opening.attendees.forEach(function (a) { byName[a.name] = byName[a.name] || { name: a.name, opening: false, closing: false }; byName[a.name].opening = true; });
            closing.attendees.forEach(function (a) { byName[a.name] = byName[a.name] || { name: a.name, opening: false, closing: false }; byName[a.name].closing = true; });
            var matrixRows = Object.keys(byName).sort().map(function (n) {
                var r = byName[n];
                return '<tr><td>' + esc(n) + '</td>'
                    + '<td style="text-align:center;">' + (r.opening ? '<span class="b4-badge b4-badge--good">✓ Present</span>' : '<span class="b4-caption">—</span>') + '</td>'
                    + '<td style="text-align:center;">' + (r.closing ? '<span class="b4-badge b4-badge--good">✓ Present</span>' : '<span class="b4-caption">—</span>') + '</td></tr>';
            }).join('');
            out += '<div class="b4-mt-5" style="margin-top:var(--b4-s5, 20px);"><div class="b4-card-heading">' + iconSafe('check', { size: 14 }) + ' Combined Presence Matrix</div>'
                + '<table class="b4-tbl b4-tbl--compact"><thead><tr><th>Name</th><th style="text-align:center;">Opening Meeting</th><th style="text-align:center;">Closing Meeting</th></tr></thead><tbody>' + matrixRows + '</tbody></table></div>';
        }
        return out;
    }

    // ── SECTION 3: AUDIT SAMPLING SUMMARY ─────────────────────────────────────
    function buildSamplingSection(d) {
        var items = Array.isArray(d.hydratedProgress) ? d.hydratedProgress : [];
        var stats = d.stats || {};

        var depts = {}, clauses = {}, photos = 0;
        items.forEach(function (item) {
            if (item && item.department) depts[normalizeDeptName(item.department)] = true;
            if (item && item.clause) clauses[String(item.clause).trim()] = true;
            photos += evidenceCount(item);
        });
        var findingsRaised = stats.majorNC != null && stats.minorNC != null
            ? (Number(stats.majorNC) || 0) + (Number(stats.minorNC) || 0)
            : items.filter(function (i) { return i && i.status === 'nc'; }).length;
        var sites = (d.auditPlan && Array.isArray(d.auditPlan.selectedSites) && d.auditPlan.selectedSites.length)
            || (d.client && Array.isArray(d.client.sites) && d.client.sites.length) || 1;

        var cards = [
            { icon: 'department', label: 'Departments Audited', value: Object.keys(depts).length },
            { icon: 'clause', label: 'Clauses Covered', value: Object.keys(clauses).length },
            { icon: 'finding', label: 'Findings Raised', value: findingsRaised },
            { icon: 'camera', label: 'Photos Captured', value: photos },
            { icon: 'document', label: 'Checklist Items', value: items.length },
            { icon: 'site', label: 'Sites', value: sites }
        ];

        var sampling = d.report && d.report.sampling;
        if (sampling && typeof sampling === 'object') {
            if (sampling.documentsReviewed != null) cards.push({ icon: 'document', label: 'Documents Reviewed', value: sampling.documentsReviewed });
            if (sampling.recordsSampled != null) cards.push({ icon: 'evidence', label: 'Records Sampled', value: sampling.recordsSampled });
            if (sampling.employeesInterviewed != null) cards.push({ icon: 'interview', label: 'Employees Interviewed', value: sampling.employeesInterviewed });
        }

        var kpiHtml = '<div class="b4-kpi-grid">' + cards.map(function (c) {
            return '<div class="b4-kpi-card" style="text-align:left;position:relative;padding:var(--b4-s5, 20px) var(--b4-s4, 16px);">'
                + '<div class="b4-kpi-icon" style="position:absolute;top:var(--b4-s3, 12px);right:var(--b4-s3, 12px);opacity:0.4;">' + iconSafe(c.icon, { size: 13 }) + '</div>'
                + '<div class="b4-kpi-value">' + esc(c.value) + '</div>'
                + '<div class="b4-kpi-label">' + esc(c.label) + '</div>'
                + '</div>';
        }).join('') + '</div>';

        var conform = items.filter(function (i) { return i && i.status === 'conform'; }).length;
        var nc = items.filter(function (i) { return i && i.status === 'nc'; }).length;
        var na = items.filter(function (i) { return i && i.status === 'na'; }).length;
        var chartHtml = '';
        var charts = [];
        if (conform + nc + na > 0) {
            chartHtml = '<div style="max-width:280px;margin:20px auto 0;"><canvas id="opsSamplingChart"></canvas></div>';
            charts.push({
                canvasId: 'opsSamplingChart',
                configJson: JSON.stringify({
                    type: 'doughnut',
                    data: {
                        labels: ['Conforming', 'Non-Conforming', 'Not Applicable'],
                        datasets: [{
                            data: [conform, nc, na],
                            backgroundColor: ['#4c8c6f', '#b0524b', '#94a3b8'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        cutout: '62%',
                        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 9 } } } }
                    }
                })
            });
        }

        return { html: kpiHtml + chartHtml, charts: charts };
    }

    // ── SECTION 4: AUDIT COVERAGE HEAT MAP ────────────────────────────────────
    function clauseTop(clause) {
        var m = String(clause || '').trim().match(/^(\d+)/);
        return m ? m[1] : null;
    }

    function buildHeatmapSection(d) {
        var items = Array.isArray(d.hydratedProgress) ? d.hydratedProgress : [];
        if (!items.length) return '';

        var byDept = {};
        var clauseSet = {};
        items.forEach(function (item) {
            var dept = normalizeDeptName(item && item.department);
            var top = clauseTop(item && item.clause);
            if (!top) return;
            clauseSet[top] = true;
            if (!byDept[dept]) byDept[dept] = {};
            if (!byDept[dept][top]) byDept[dept][top] = { count: 0, majors: 0, minorObs: 0, conform: 0 };
            var cell = byDept[dept][top];
            cell.count++;
            if (isMajorNc(item)) cell.majors++;
            else if (isMinorOrObs(item)) cell.minorObs++;
            else if (item && item.status === 'conform') cell.conform++;
        });

        var clauseCols = Object.keys(clauseSet).sort(function (a, b) { return Number(a) - Number(b); });
        var deptRows = Object.keys(byDept).sort(function (a, b) {
            if (a === UNASSIGNED_LABEL) return 1;
            if (b === UNASSIGNED_LABEL) return -1;
            return a.localeCompare(b);
        });
        if (!clauseCols.length || !deptRows.length) return '';

        var maxCount = 1;
        deptRows.forEach(function (dep) { clauseCols.forEach(function (c) { var cell = byDept[dep][c]; if (cell) maxCount = Math.max(maxCount, cell.count); }); });

        function cellStyle(cell) {
            if (!cell || cell.count === 0) return 'background-color:#f1f5f9;color:#94a3b8;';
            if (cell.majors > 0) {
                var intensity = 0.25 + 0.55 * (cell.count / maxCount);
                return 'background-color:rgba(176,82,75,' + intensity.toFixed(2) + ');color:#fff;font-weight:700;';
            }
            if (cell.minorObs > 0) {
                var i2 = 0.25 + 0.55 * (cell.count / maxCount);
                return 'background-color:rgba(184,134,60,' + i2.toFixed(2) + ');color:#1e293b;font-weight:700;';
            }
            var i3 = 0.18 + 0.55 * (cell.count / maxCount);
            return 'background-color:rgba(76,140,111,' + i3.toFixed(2) + ');color:#fff;font-weight:700;';
        }

        function cellSymbol(cell) {
            if (!cell || cell.count === 0) return '';
            if (cell.majors > 0) return '✕ ';
            if (cell.minorObs > 0) return '! ';
            return '✓ ';
        }

        var headerCells = clauseCols.map(function (c) { return '<th style="text-align:center;white-space:nowrap;">Clause ' + esc(c) + '</th>'; }).join('');
        var bodyRows = deptRows.map(function (dep) {
            var cells = clauseCols.map(function (c) {
                var cell = byDept[dep][c];
                return '<td style="text-align:center;' + cellStyle(cell) + '-webkit-print-color-adjust:exact;print-color-adjust:exact;">' + (cell && cell.count ? cellSymbol(cell) + cell.count : '—') + '</td>';
            }).join('');
            return '<tr><td style="font-weight:600;white-space:nowrap;">' + esc(dep) + '</td>' + cells + '</tr>';
        }).join('');

        var legend = '<div style="display:flex;gap:16px;margin-top:14px;flex-wrap:wrap;justify-content:center;">'
            + '<span class="b4-caption"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#4c8c6f;margin-right:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>✓ All conforming</span>'
            + '<span class="b4-caption"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#b8863c;margin-right:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>! Minor NC / Observation present</span>'
            + '<span class="b4-caption"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#b0524b;margin-right:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>✕ Major NC present</span>'
            + '<span class="b4-caption"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f1f5f9;border:1px solid #e2e8f0;margin-right:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>No items sampled</span>'
            + '</div>';

        return '<div style="page-break-inside:avoid;break-inside:avoid;overflow-x:auto;"><table class="b4-tbl b4-tbl--compact" style="table-layout:auto;"><thead><tr><th style="text-align:left;">Process / Department</th>' + headerCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>'
            + legend
            + '<div class="b4-caption" style="justify-content:center;margin-top:8px;">✓ Good/Low &nbsp; ! Watch/Medium &nbsp; ✕ Critical/High — cell value = number of checklist items sampled for that clause within the process; shading intensity reflects sample volume.</div>';
    }

    // ── SECTION 5: REPORT DISTRIBUTION (annex) ────────────────────────────────
    function buildDistributionSection(d) {
        var stored = d.report && Array.isArray(d.report.distribution) ? d.report.distribution : null;

        if (stored && stored.length) {
            var rows = stored.map(function (row) {
                return '<tr>'
                    + '<td>' + esc(row.name || '—') + '</td>'
                    + '<td>' + esc(row.role || '—') + '</td>'
                    + '<td>' + esc(row.organization || '—') + '</td>'
                    + '<td>' + esc(row.method || '—') + '</td>'
                    + '<td>' + esc(fmtDate(row.date)) + '</td>'
                    + '</tr>';
            }).join('');
            return '<div><table class="b4-tbl"><thead><tr><th>Name</th><th>Role</th><th>Organization</th><th>Method</th><th>Date</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
        }

        // Derive defaults from available context.
        var leadAuditor = (d.report && d.report.leadAuditor) || (d.auditPlan && d.auditPlan.leadAuditor) || null;
        var clientContact = (d.client && (d.client.contactName || (Array.isArray(d.client.contacts) && d.client.contacts[0] && (d.client.contacts[0].name || d.client.contacts[0])))) || null;
        var cbName = (d.cbSettings && (d.cbSettings.name || d.cbSettings.companyName)) || 'Certification Body';

        var defaults = [];
        if (leadAuditor) defaults.push({ name: leadAuditor, role: 'Lead Auditor', organization: cbName, method: 'Email', date: d.today });
        if (clientContact) defaults.push({ name: String(clientContact), role: 'Client Representative', organization: (d.client && d.client.name) || '—', method: 'Email', date: d.today });
        defaults.push({ name: cbName, role: 'Records Custodian', organization: 'Certification Body Records', method: 'Internal Archive', date: d.today });

        if (!defaults.length) return '';

        var defRows = defaults.map(function (row) {
            return '<tr>'
                + '<td>' + esc(row.name) + '</td>'
                + '<td>' + esc(row.role) + '</td>'
                + '<td>' + esc(row.organization) + '</td>'
                + '<td>' + esc(row.method) + '</td>'
                + '<td>' + esc(fmtDate(row.date)) + '</td>'
                + '</tr>';
        }).join('');

        return '<div><table class="b4-tbl"><thead><tr><th>Name</th><th>Role</th><th>Organization</th><th>Method</th><th>Date</th></tr></thead><tbody>' + defRows + '</tbody></table></div>'
            + '<div class="b4-callout b4-callout--info" style="margin-top:var(--b4-s3, 12px);">' + iconSafe('alert', { size: 12 }) + ' Draft distribution list — confirm recipients before issue.</div>';
    }

    // ── Public API ─────────────────────────────────────────────────────────
    function sections(d) {
        d = d || {};
        var out = [];

        try {
            var coverage = buildCoverageSection(d);
            if (coverage) out.push({ key: 'opsCoverage', name: 'AUDIT COVERAGE MATRIX', desc: 'Process-by-process breakdown of applicable, audited and sampled checklist items', color: '#1d4ed8', bodyHtml: coverage, charts: [] });
        } catch (_e) { /* defensive no-op */ }

        try {
            var attendance = buildAttendanceSection(d);
            if (attendance) out.push({ key: 'opsAttendance', name: 'AUDIT ATTENDANCE REGISTER', desc: 'Opening and closing meeting attendee records', color: '#0ea5e9', bodyHtml: attendance, charts: [] });
        } catch (_e) { /* defensive no-op */ }

        try {
            var sampling = buildSamplingSection(d);
            if (sampling && sampling.html) out.push({ key: 'opsSampling', name: 'AUDIT SAMPLING SUMMARY', desc: 'Headline sampling volume across departments, clauses and evidence', color: '#4c8c6f', bodyHtml: sampling.html, charts: sampling.charts || [] });
        } catch (_e) { /* defensive no-op */ }

        try {
            var heatmap = buildHeatmapSection(d);
            if (heatmap) out.push({ key: 'opsHeatmap', name: 'AUDIT COVERAGE HEAT MAP', desc: 'Sampling density and result by process and clause', color: '#b8863c', bodyHtml: heatmap, charts: [] });
        } catch (_e) { /* defensive no-op */ }

        try {
            var distribution = buildDistributionSection(d);
            if (distribution) out.push({ key: 'opsDistribution', name: 'REPORT DISTRIBUTION', desc: 'Annex — recipients of this report and distribution method', color: '#64748b', bodyHtml: distribution, charts: [] });
        } catch (_e) { /* defensive no-op */ }

        return out;
    }

    function sectionsPreviewToggles() {
        return [
            { id: 'opsCoverage', label: 'Coverage Matrix', icon: 'fa-solid fa-diagram-project', color: '#1d4ed8' },
            { id: 'opsAttendance', label: 'Attendance Register', icon: 'fa-solid fa-people-arrows', color: '#0ea5e9' },
            { id: 'opsSampling', label: 'Sampling Summary', icon: 'fa-solid fa-chart-pie', color: '#4c8c6f' },
            { id: 'opsHeatmap', label: 'Coverage Heat Map', icon: 'fa-solid fa-table-cells', color: '#b8863c' },
            { id: 'opsDistribution', label: 'Report Distribution', icon: 'fa-solid fa-paper-plane', color: '#64748b' }
        ];
    }

    global.ReportOperational = {
        sections: sections,
        sectionsPreviewToggles: sectionsPreviewToggles
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.ReportOperational;
    }
})(typeof window !== 'undefined' ? window : globalThis);
