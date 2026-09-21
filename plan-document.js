// ============================================
// PLAN DOCUMENT  (window.PlanDocument)
// ============================================
// The printable audit plan, in two forms:
//   build(plan, ctx)          the CLIENT-FACING plan
//   buildInternal(plan, ctx)  the INTERNAL certification record: full duration
//                             calculation, traceability matrix, finding map,
//                             scope verification, gate result and history.
//
// Pure: data in, HTML out. Dates always come from DocFormat (written, never
// numeric); every string is decoded once and escaped once; the page furniture
// is PrintShell's, so there is no in-flow footer, no static page number and
// nothing to spill onto a blank last page.

(function (global) {
    'use strict';

    const need = function (name, file) { return global[name] || (typeof require === 'function' ? require(file) : null); };
    const DF = function () { return need('DocFormat', './doc-format.js'); };
    const PS = function () { return need('PrintShell', './print-shell.js'); };
    const API_ = function () { return need('AuditPlanIntegrity', './audit-plan-integrity.js'); };

    function arr(v) { return Array.isArray(v) ? v : []; }
    function plain(v) { return DF().decodeEntities(v == null ? '' : String(v)); }
    function t(v) { return DF().escapeHtml(plain(v)); }
    function lines(v) { return String(v == null ? '' : v).split(/\n+/).map(function (x) { return x.replace(/^\s*[•\-*]\s*/, '').trim(); }).filter(Boolean); }

    const CSS = [
        '.status-pill{display:inline-block;padding:2px 10px;border-radius:12px;font-size:8.5pt;font-weight:700;border:1px solid}',
        '.status-draft{background:#fffbeb;color:#92400e;border-color:#fcd34d}',
        '.status-approved{background:#f0fdf4;color:#166534;border-color:#86efac}',
        '.draft-note{margin:6px 0 0;font-size:8.5pt;color:#92400e}',
        '.meta-table{margin:8px 0 6px}',
        '.meta-table td{padding:5px 8px;border-bottom:1px solid #e2e8f0;width:50%;vertical-align:top;font-size:9pt}',
        '.meta-label{display:block;font-weight:700;color:#64748b;font-size:7.5pt;text-transform:uppercase;letter-spacing:.05em;margin-bottom:1px}',
        '.pd-section-title{background:#f1f5f9;padding:6px 10px;font-weight:700;font-size:9.5pt;margin:14px 0 8px;border-left:4px solid #0f2a43;letter-spacing:.02em}',
        '.scope-box{border:1px solid #cbd5e1;border-left:4px solid #0f2a43;background:#f8fafc;padding:8px 12px;font-size:9.5pt;line-height:1.55;margin:0 0 4px}',
        '.scope-meta{font-size:8.5pt;color:#475569;margin:0 0 4px}',
        'table.grid{margin:4px 0 10px}',
        'table.grid th{background:#f1f5f9;text-align:left;padding:5px 7px;border-bottom:2px solid #cbd5e1;font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:#334155}',
        'table.grid td{padding:5px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:8.5pt}',
        'table.grid td.num{text-align:right;font-variant-numeric:tabular-nums}',
        'table.agenda td{font-size:8.2pt;line-height:1.35}',
        'table.agenda td.day{white-space:nowrap}',
        'table.agenda td.day b{display:block}',
        'table.agenda td.day span{font-size:7.2pt;color:#64748b}',
        'table.agenda td.time{white-space:nowrap;font-variant-numeric:tabular-nums}',
        'table.agenda .sub{display:block;color:#64748b;font-size:7.4pt;margin-top:1px}',
        'table.agenda .req b{color:#0f2a43}',
        'table.agenda tr.lunch td{background:#f8fafc;color:#94a3b8;font-style:italic}',
        'table.agenda tr.marker td{background:#f1f5f9}',
        'table.agenda tr.consol td{background:#f8fafc}',
        '.note{font-size:8.5pt;color:#475569;margin:4px 0}',
        '.key{font-size:8pt;color:#475569;margin:2px 0 6px}',
        'ul.bul{margin:2px 0 8px;padding-left:16px}',
        'ul.bul li{margin:1px 0;font-size:9pt}',
        '.ok{color:#166534}.bad{color:#b91c1c}.warn{color:#92400e}',
        '.issue-block td{background:#fef2f2}',
        '.issue-warn td{background:#fffbeb}',
        '.mono{font-family:Consolas,"Courier New",monospace;font-size:7.6pt}'
    ].join('\n');

    function planRef(plan, ctx) {
        if (ctx && ctx.planRef) return ctx.planRef;
        return global.UTILS && global.UTILS.getPlanRef ? global.UTILS.getPlanRef(plan) : 'PLN-' + String(plan && plan.id || '').slice(0, 8);
    }

    function statusOf(plan) { return (plan && plan.documentStatus) || API_().STATUSES[0]; }
    function statusClass(s) { return /^draft/i.test(s) ? 'status-draft' : 'status-approved'; }

    // ── client-facing plan ───────────────────────────────────────────

    function agendaTable(plan, ctx) {
        const df = DF();
        const rows = arr(plan.agenda);
        const findingClause = {};
        arr(ctx.findings).forEach(function (f) { findingClause[String(f.id)] = f; });
        const body = rows.map(function (r) {
            const d = df.parseDateParts(r.date);
            const dayText = d ? df.weekdayName(r.date).slice(0, 3) + ' ' + d.d + ' ' + df.MONTHS[d.m - 1].slice(0, 3) : '';
            const dayCell = '<td class="day"><b>' + t(r.day) + '</b>' + (dayText ? '<span>' + t(dayText) + '</span>' : '') + '</td>';
            const time = '<td class="time">' + t(r.start || '') + '–' + t(r.end || '') + '</td>';
            if (r.kind === 'lunch') {
                return '<tr class="lunch">' + dayCell + time + '<td>Lunch break</td><td>—</td><td>' + t(r.dept || 'All') + '</td><td>N/A</td></tr>';
            }
            const desc = API_().describeStandards(r.standards, {});
            let req = desc.map(function (x) { return '<div class="req"><b>' + t(x.standards.join(' · ')) + '</b> ' + t(x.text) + '</div>'; }).join('');
            const fc = arr(r.findingIds).map(function (id) { return findingClause[String(id)]; }).filter(Boolean);
            if (fc.length) req += '<div class="req"><b>Previous findings</b> ' + t(fc.map(function (f) { return f.clause; }).join(', ')) + '</div>';
            if (!req) req = '<div class="req">Integrated — all standards in scope</div>';
            const proc = arr(r.processes).length ? '<span class="sub">Process: ' + arr(r.processes).map(t).join('; ') + '</span>' : '';
            const sub = r.subject ? '<span class="sub">' + t(r.subject) + '</span>' : '';
            const cls = r.kind === 'opening' || r.kind === 'closing' ? 'marker' : (r.kind === 'consolidation' ? 'consol' : '');
            return '<tr class="' + cls + '">' + dayCell + time + '<td><b>' + t(r.item) + '</b>' + sub + proc + '</td><td>' + req + '</td><td>' + t(r.dept) + '</td><td>' + t(r.auditor) + '</td></tr>';
        }).join('');
        return '<table class="grid agenda"><thead><tr><th style="width:9%">Day</th><th style="width:11%">Time</th><th style="width:28%">Activity / process</th><th style="width:22%">Requirements</th><th style="width:16%">Dept / auditee</th><th style="width:14%">Auditor</th></tr></thead><tbody>' + body + '</tbody></table>';
    }

    /**
     * @param {Object} plan
     * @param {Object} ctx {
     *   client, assigned:[{name,role}], standards:[ids], timeZone:{iana}, scope:{certificateScope, certificateNumbers},
     *   findings:[...], durationRecord, brand:{name,logoUrl}, qrUrl, planRef, classification, generatedOn }
     */
    function build(plan, ctx) {
        const c = ctx || {};
        const p = plan || {};
        const df = DF(); const shell = PS(); const ipi = API_();
        const ids = arr(c.standards);
        const stdLabels = ids.map(function (id) { return ipi.stdLabel(id); });
        const assigned = arr(c.assigned);
        const lead = assigned[0];
        const ref = planRef(p, c);
        const status = statusOf(p);
        const cyc = p.certificationCycle || {};
        const tzInfo = c.timeZone && c.timeZone.iana ? df.describeTimeZone(c.timeZone.iana, p.date) : null;
        const dur = c.durationRecord || {};
        const finalDays = Number(dur.finalDays || (p.durationCalculation && p.durationCalculation.finalDays) || p.manDays) || 0;
        const total = arr(p.selectedSites).reduce(function (n, s) { const r = arr(c.client && c.client.sites).find(function (x) { return x.name === s.name; }); return n + (Number(r && r.employees) || 0); }, 0);
        const scheduled = p.date ? df.formatDateRange(p.date, p.endDate) : 'Not yet booked';
        const findings = arr(c.findings);
        const need = findings.filter(function (f) { return f.requiresFollowUp; });
        const mappedAll = need.length > 0 && need.every(function (f) { return arr(p.agenda).some(function (r) { return arr(r.findingIds).map(String).indexOf(String(f.id)) !== -1; }); });

        const meta = function (label, value) { return '<td><span class="meta-label">' + t(label) + '</span>' + value + '</td>'; };
        const pair = function (a, b) { return '<tr>' + a + (b || '<td></td>') + '</tr>'; };
        const teamLabel = ipi.auditTeamLabel(assigned);

        const metaTable = '<table class="meta-table">'
            + pair(meta('Client', t(c.client && c.client.name || p.client)), meta('Audit standards', stdLabels.map(t).join('<br>')))
            + pair(meta('Scheduled audit', t(scheduled)), meta('Audit type', t(p.auditType || p.type)))
            + pair(meta('Recommended audit window', cyc.recommendedWindowStart ? t(df.formatDateRange(cyc.recommendedWindowStart, cyc.recommendedWindowEnd)) + ' (planning guidance)' : 'Not recorded'),
                meta('Certificate expiry', cyc.certificateExpiry ? t(df.formatDate(cyc.certificateExpiry)) : 'Not recorded'))
            + pair(meta('Audit method', t(p.auditMethod || 'Not recorded')), meta('Time zone', tzInfo ? t(tzInfo.label) : '<span class="bad">Not agreed</span>'))
            + pair(meta('Lead Auditor', t(lead ? lead.name : 'Not assigned')), meta('Audit team', t(teamLabel)))
            + pair(meta('Approved audit duration', finalDays ? t(finalDays.toFixed(1) + ' auditor-days' + (p.auditMethod ? ' (' + String(p.auditMethod).toLowerCase() + ')' : '')) : 'Not approved'),
                meta('Impartiality risk', t((p.impartialityAssessment && p.impartialityAssessment.risk) || 'None identified')))
            + '</table>'
            + (dur.effectivePersonnel ? '<p class="note">Duration basis: ' + t((p.auditType || p.type) + ' · ' + dur.effectivePersonnel.value + ' effective personnel · ' + dur.sites + ' site' + (dur.sites === 1 ? '' : 's')
                + (ids.length > 1 ? ' · integrated audit of ' + ids.length + ' standards (IMS adjustment ' + (dur.imsIntegration ? dur.imsIntegration.adjustmentPercent : 0) + '%)' : '')) + '. The full calculation is held in the certification record.</p>' : '');

        const certLine = arr(c.scope && c.scope.certificateNumbers).length
            ? '<p class="scope-meta">Certificate' + (c.scope.certificateNumbers.length > 1 ? 's' : '') + ': ' + t(c.scope.certificateNumbers.join(', ')) + (cyc.certificateExpiry ? ' · valid to ' + t(df.formatDate(cyc.certificateExpiry)) : '') + '</p>' : '';
        const scopeSection = '<div class="pd-section-title">CERTIFIED SCOPE</div>'
            + '<p class="scope-box">' + t((c.scope && c.scope.certificateScope) || p.scope || 'Not recorded') + '</p>' + certLine;

        const allocRows = arr(p.selectedSites).map(function (s) {
            const r = arr(c.client && c.client.sites).find(function (x) { return x.name === s.name; }) || {};
            const emps = Number(r.employees) || 0;
            const days = total > 0 ? emps / total * finalDays : finalDays / Math.max(1, arr(p.selectedSites).length);
            return '<tr><td>' + t(s.name) + '</td><td>' + t(r.address || '—') + '</td><td class="num">' + emps + '</td><td>' + t(assigned.map(function (a) { return a.name; }).join(', ') || '—') + '</td><td class="num"><b>' + days.toFixed(2) + '</b></td></tr>';
        }).join('');
        const allocation = '<div class="pd-section-title">AUDIT SCOPE, EFFORT &amp; ALLOCATION</div>'
            + '<table class="grid"><thead><tr><th>Site</th><th>Address</th><th style="text-align:right">Personnel</th><th>Auditor(s)</th><th style="text-align:right">Auditor-days</th></tr></thead><tbody>' + allocRows
            + '<tr><td colspan="2"><b>TOTAL</b></td><td class="num"><b>' + total + '</b></td><td></td><td class="num"><b>' + finalDays.toFixed(2) + '</b></td></tr></tbody></table>';

        const tzStatement = tzInfo ? '<p class="note">' + t(df.timeZoneStatement(c.timeZone.iana, p.date, p.endDate)) + '</p>' : '<p class="note bad">The agreed time zone has not been recorded.</p>';
        const key = '<p class="key"><b>Standards key:</b> ' + ids.map(function (id) { return t(ipi.shortLabel(id)) + ' = ' + t(ipi.stdLabel(id)); }).join(' · ') + '</p>';
        const findingLine = need.length
            ? (mappedAll ? '<p class="note"><b>Previous findings requiring follow-up: ' + need.length + '</b> — all ' + need.length + ' are scheduled in the sessions below.</p>'
                : '<p class="note bad"><b>Previous findings requiring follow-up: ' + need.length + '</b> — not every finding is scheduled; the plan cannot be approved until they are.</p>')
            : '<p class="note">No previous findings require follow-up.</p>';
        const agenda = '<div class="pd-section-title">AUDIT AGENDA / ITINERARY</div>' + tzStatement + key + findingLine + agendaTable(p, c);

        const list = function (field, title) {
            const items = lines(p[field] || p['audit' + field.charAt(0).toUpperCase() + field.slice(1)]);
            return '<div class="pd-section-title">' + title + '</div>' + (items.length ? '<ul class="bul">' + items.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul>' : '<p class="note bad">Not recorded.</p>');
        };

        const body = shell.masthead({ brandName: c.brand && c.brand.name, logoUrl: c.brand && c.brand.logoUrl, title: 'Audit Plan', subtitle: 'Ref: ' + ref + ' · ' + plain(c.client && c.client.name || p.client), qrUrl: c.qrUrl })
            + '<p style="margin:0 0 4px"><span class="status-pill ' + statusClass(status) + '">' + t(status) + '</span></p>'
            + (/^draft/i.test(status) ? '<p class="draft-note">This plan has not been approved for client issue.</p>' : '')
            + metaTable + scopeSection + allocation + agenda
            + list('objectives', 'AUDIT OBJECTIVES') + list('criteria', 'AUDIT CRITERIA') + list('methodology', 'AUDIT METHODOLOGY');

        return shell.buildDocument({
            title: 'Audit Plan - ' + plain(c.client && c.client.name || p.client),
            header: { left: plain(c.brand && c.brand.name || 'Audit360'), center: plain(c.client && c.client.name || p.client), right: ref + ' · ' + plain(p.auditType || p.type) },
            footer: { left: c.classification ? plain(c.classification) : 'Audit plan · ' + status, center: plain(scheduled) },
            bodyHtml: body, extraCss: shell.MASTHEAD_CSS + '\n' + CSS
        });
    }

    // ── internal certification record ────────────────────────────────

    function issueTable(items, cls, heading) {
        if (!items.length) return '<p class="note ok">' + t(heading) + ': none.</p>';
        return '<table class="grid"><thead><tr><th style="width:24%">' + t(heading) + '</th><th>Detail</th></tr></thead><tbody>'
            + items.map(function (i) { return '<tr class="' + cls + '"><td class="mono">' + t(i.code) + '</td><td>' + t(i.message) + '</td></tr>'; }).join('') + '</tbody></table>';
    }

    function buildInternal(plan, ctx) {
        const c = ctx || {};
        const p = plan || {};
        const df = DF(); const shell = PS(); const ipi = API_();
        const v = c.validation || { blockers: [], warnings: [], summary: {} };
        const d = c.durationRecord || {};
        const ref = planRef(p, c);
        const status = statusOf(p);
        const trace = p.traceability || c.traceability || { sessions: [], findings: [], summary: {}, checklist: { questions: [], unscheduled: [] } };
        const sum = v.summary || {};
        const f = sum.findings || { required: 0, mapped: 0, unmapped: 0 };
        const rec = sum.reconciliation || {};

        const fld = function (k, val) { return '<tr><td style="width:34%"><b>' + t(k) + '</b></td><td>' + val + '</td></tr>'; };
        const durTable = '<table class="grid"><tbody>'
            + fld('Duration methodology', t((d.methodology && d.methodology.version) || 'not recorded') + (d.methodology && d.methodology.builtInDefault ? ' <span class="warn">— ' + t(d.methodology.note) + '</span>' : ''))
            + fld('Duration basis, by standard', arr(d.basisByStandard).length ? '<table class="grid"><thead><tr><th>Standard</th><th>Band (effective personnel)</th><th style="text-align:right">Baseline</th><th>Table</th></tr></thead><tbody>'
                + d.basisByStandard.map(function (b) { return '<tr><td>' + t(b.standard) + '</td><td>' + (b.band ? t(b.band.minEmployees + '–' + (b.band.maxEmployees == null ? 'more' : b.band.maxEmployees)) : '—') + '</td><td class="num">' + b.baselineDays + '</td><td>' + (b.defaultTableUsed ? 'Audit360 default' : 'approved') + '</td></tr>'; }).join('') + '</tbody></table>' : 'Not derived')
            + fld('Effective personnel', t(d.effectivePersonnel ? d.effectivePersonnel.value + ' (' + d.effectivePersonnel.source + ')' : 'not recorded') + (d.effectivePersonnel && d.effectivePersonnel.note ? '<br><span class="warn">' + t(d.effectivePersonnel.note) + '</span>' : ''))
            + fld('Scope and complexity', t((d.scopeAndComplexity && d.scopeAndComplexity.riskLevel || 'Medium') + ' operational risk'))
            + fld('Number of sites', t(d.sites))
            + fld('Recertification adjustment', t(d.recertificationAdjustment && d.recertificationAdjustment.note || 'Not applicable'))
            + fld('Degree of IMS integration', t(d.imsIntegration ? d.imsIntegration.degree + '; adjustment ' + d.imsIntegration.adjustmentPercent + '%; rule ' + (d.imsIntegration.ruleVersion || 'not recorded') : ''))
            + fld('Team ability for an integrated audit', t(d.teamAbility && d.teamAbility.integratedAuditCapable ? 'Lead Auditor holds current competence for all standards in scope' : 'Not demonstrated'))
            + fld('Remote-audit considerations', t(d.remote ? d.remote.method + ': ' + d.remote.remoteDays + ' remote / ' + d.remote.onsiteDays + ' on-site. ' + d.remote.considerations : ''))
            + fld('Increases', arr(d.increases).length ? arr(d.increases).map(function (a) { return t(a.type + ' +' + a.days + ' d — ' + (a.justification || 'no justification')); }).join('<br>') : 'None')
            + fld('Reductions', arr(d.reductions).length ? arr(d.reductions).map(function (a) { return t(a.type + ' ' + a.days + ' d — ' + (a.justification || 'no justification')); }).join('<br>') : 'None')
            + fld('Calculation', t((d.baselineDays || 0) + ' baseline → ' + ((d.imsIntegration && d.imsIntegration.adjustmentPercent) || 0) + '% IMS → ' + ((d.increases || []).concat(d.reductions || []).reduce(function (n, a) { return n + a.days; }, 0)) + ' justified adjustment = ' + (d.calculated != null ? d.calculated : '') + ' calculated → ' + (d.finalDays || 0) + ' final auditor-days'))
            + fld('Agenda reconciliation', t((rec.scheduledHours != null ? rec.scheduledHours.toFixed(2) : '?') + ' productive auditor-hours scheduled (lunch excluded) against ' + (rec.approvedHours != null ? rec.approvedHours.toFixed(2) : '?') + ' approved') + ' <b class="' + (rec.errors && rec.errors.length ? 'bad' : 'ok') + '">' + (rec.errors && rec.errors.length ? 'DOES NOT AGREE' : 'AGREES') + '</b>')
            + fld('Approved by / on', d.approval && d.approval.approvedBy ? t(d.approval.approvedBy + ' on ' + df.formatDate(d.approval.approvedAt)) : '<b class="bad">Not approved — approver and approval date are not recorded</b>')
            + '</tbody></table>';

        const fmapRows = arr(trace.findings).map(function (m) {
            const fnd = arr(c.findings).find(function (x) { return String(x.id) === String(m.findingId); }) || {};
            return '<tr><td class="mono">' + t(m.ref || m.findingId) + '</td><td>' + t(fnd.typeLabel || m.type) + '</td><td>' + t(m.clause) + '</td><td>' + t(fnd.status || '') + '</td><td class="mono">' + t(arr(m.sessionIds).join(', ') || '—') + '</td><td>' + (m.mapped ? '<span class="ok">mapped' + (m.via && m.via !== 'clause' ? ' (' + t(m.via) + ')' : '') + '</span>' : '<b class="bad">UNMAPPED</b>') + '</td></tr>';
        }).join('');
        const findings = '<p class="note"><b>Total findings requiring follow-up: ' + f.required + ' · mapped: ' + f.mapped + ' · unmapped: ' + f.unmapped + '</b></p>'
            + (fmapRows ? '<table class="grid"><thead><tr><th>Finding</th><th>Type</th><th>Clause</th><th>Status</th><th>Session</th><th>Mapping</th></tr></thead><tbody>' + fmapRows + '</tbody></table>' : '<p class="note">No previous findings.</p>');

        const traceRows = arr(trace.sessions).map(function (s) {
            const std = arr(s.standards).map(function (e) { return '<div><b>' + t(ipi.shortLabel(e.stdId)) + '</b> ' + arr(e.titles).map(function (x) { return t(x.ref) + ' ' + t(x.title); }).join('; ') + '</div>'; }).join('');
            const times = arr(s.spans).map(function (sp) { return 'D' + sp.day + ' ' + hh(sp.start) + '–' + hh(sp.end); }).join(', ');
            return '<tr><td class="mono">' + t(s.sessionId) + '<br>' + t(times) + '</td><td>' + t(s.title) + '</td><td>' + (std || '—') + '</td><td>' + (arr(s.checklistQuestions).map(function (q) { return t(q.clause + ' ' + q.title); }).join('; ') || '—') + '</td><td class="mono">' + t(arr(s.findingIds).join(', ') || '—') + '</td><td>' + t(arr(s.processes).join('; ') || '—') + '</td><td>' + t((s.auditee && (s.auditee.person ? s.auditee.dept + ' / ' + s.auditee.person : s.auditee.dept)) || '') + '</td><td>' + t(s.auditorName || '') + ' <span class="mono">' + t(s.auditorId || '') + '</span></td></tr>';
        }).join('');
        const traceTable = '<table class="grid trace"><thead><tr><th style="width:8%">Session</th><th style="width:13%">Activity</th><th style="width:31%">Standard · clauses/controls (registry titles)</th><th style="width:19%">Checklist questions</th><th style="width:8%">Findings</th><th style="width:8%">Process</th><th style="width:6%">Auditee</th><th style="width:7%">Auditor (ID)</th></tr></thead><tbody>' + traceRows + '</tbody></table>'
            + (arr(trace.checklist && trace.checklist.unscheduled).length ? '<p class="note warn">Checklist questions not covered by any session: ' + arr(trace.checklist.unscheduled).map(function (q) { return t(q.clause + ' ' + q.title); }).join('; ') + '</p>' : '<p class="note ok">Every checklist question with a clause reference is covered by at least one agenda session.</p>');

        const sc = c.scopeCheck || {};
        const scopeRows = '<table class="grid"><tbody>'
            + fld('Certificate wording (authoritative)', t(sc.certificateScope || 'not found'))
            + fld('Plan scope', t(sc.planScope || 'not stated'))
            + fld('Exact match', sc.exact ? '<b class="ok">YES — reproduced exactly</b>' : '<b class="bad">NO</b>')
            + fld('Certificates', t(arr(sc.certificateNumbers).join(', ') || 'none'))
            + fld('Current activities not described by the certificate', arr(sc.activities && sc.activities.unlisted).length ? t(sc.activities.unlisted.join('; ')) : 'None')
            + fld('Platforms in use but not on the certificate', arr(sc.activities && sc.activities.platformsNotCertified).length ? t(sc.activities.platformsNotCertified.join(', ')) : 'None')
            + fld('Platforms on the certificate but not in current services', arr(sc.activities && sc.activities.platformsNotEvidenced).length ? t(sc.activities.platformsNotEvidenced.join(', ')) : 'None')
            + fld('Certification review', sc.activities && sc.activities.requiresCertificationReview ? '<b class="warn">REQUIRED — refer to authorised certification review</b>' : 'Not required')
            + '</tbody></table>';

        const cov = arr(c.checklists).map(function (ck) {
            const cv = ck.coverage;
            const rows = cv && cv.coverage ? arr(cv.coverage.clauses).map(function (x) { return '<tr><td>' + t(x.label) + '</td><td class="num">' + x.planned + ' / ' + x.total + '</td><td class="num">' + x.inherited + '</td><td class="num">' + x.remaining + '</td></tr>'; }).join('') : '';
            return '<div class="pd-keep"><p class="note"><b>' + t(ck.name) + '</b> — linked to ' + t(arr(ck.standardIds).map(ipi.stdLabel).join(', ') || 'no standard') + ' — <b>' + t(cv ? cv.outcomeLabel : 'Blocked — coverage could not be assessed') + '</b></p>'
                + (rows ? '<table class="grid"><thead><tr><th>Standard</th><th style="text-align:right">Planned</th><th style="text-align:right">Inherited</th><th style="text-align:right">Remaining</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') + '</div>';
        }).join('') || '<p class="note bad">No checklist linked.</p>';

        const hist = arr(p.statusHistory).map(function (h) { return '<tr><td>' + t(h.status) + '</td><td>' + t(h.by) + ' (' + t(h.role) + ')</td><td>' + t(df.formatDate(h.at)) + '</td><td>' + t(h.note || '') + '</td></tr>'; }).join('');

        const body = shell.masthead({ brandName: c.brand && c.brand.name, logoUrl: c.brand && c.brand.logoUrl, title: 'Audit Plan — Internal Certification Record', subtitle: 'Ref: ' + ref + ' · ' + plain(c.client && c.client.name || p.client) + ' · not for client issue', qrUrl: c.qrUrl })
            + '<p style="margin:0 0 4px"><span class="status-pill ' + statusClass(status) + '">' + t(status) + '</span> &nbsp; <b class="' + (v.blockers.length ? 'bad' : 'ok') + '">' + (v.blockers.length ? v.blockers.length + ' blocking issue(s) — not ready for client issue' : 'All blocking validations pass') + '</b></p>'
            + '<div class="pd-section-title">1. APPROVAL READINESS</div>' + issueTable(v.blockers, 'issue-block', 'Blocking issues') + issueTable(v.warnings, 'issue-warn', 'Warnings')
            + '<div class="pd-section-title">2. AUDIT DURATION RECORD</div>' + durTable
            + '<div class="pd-section-title">3. PREVIOUS FINDINGS — FOLLOW-UP TRACEABILITY</div>' + findings
            + '<div class="pd-section-title">4. AGENDA TRACEABILITY MATRIX</div>' + traceTable
            + '<div class="pd-section-title">5. CERTIFIED SCOPE VERIFICATION</div>' + scopeRows
            + '<div class="pd-section-title">6. CHECKLIST ASSOCIATION AND COVERAGE</div>' + cov
            + '<div class="pd-section-title">7. STATUS HISTORY</div>' + (hist ? '<table class="grid"><thead><tr><th>Status</th><th>By</th><th>Date</th><th>Note</th></tr></thead><tbody>' + hist + '</tbody></table>' : '<p class="note">No status changes recorded; the plan is in ' + t(status) + '.</p>');

        return shell.buildDocument({
            title: 'Audit Plan Internal Record - ' + plain(c.client && c.client.name || p.client),
            header: { left: plain(c.brand && c.brand.name || 'Audit360'), center: 'INTERNAL — NOT FOR CLIENT ISSUE', right: ref },
            footer: { left: 'Internal certification record', center: plain(df.formatDateRange(p.date, p.endDate)) },
            // Landscape: the traceability matrix is a wide table. Its rows may split across
            // pages - a session with many clauses is taller than the comfortable space left on
            // a page, and refusing to split left one row per page.
            landscape: true, marginTopMm: 20,
            bodyHtml: body, extraCss: shell.MASTHEAD_CSS + '\n' + CSS + '\ntable.grid table.grid{margin:0}\ntable.trace tr{break-inside:auto;page-break-inside:auto}\ntable.trace td{font-size:7.4pt;line-height:1.3}\ntable.trace td div{margin-bottom:2px}'
        });
    }

    function hh(min) { const h = Math.floor(min / 60); const m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }

    const API = { build: build, buildInternal: buildInternal, CSS: CSS };
    global.PlanDocument = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'plan-document.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);
