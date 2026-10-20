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
        '.status-line{margin:0 0 6px;display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px}',
        '.status-pill{display:inline-block;padding:1px 10px;border-radius:12px;font-size:8.5pt;font-weight:700;border:1px solid}',
        '.status-draft{background:#fffbeb;color:#92400e;border-color:#fcd34d}',
        '.status-approved{background:#f0fdf4;color:#166534;border-color:#86efac}',
        '.draft-note{margin:0;font-size:8.5pt;color:#92400e}',
        // Client information: two label/value pairs per row.
        '.meta-table{margin:2px 0 4px;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1}',
        '.meta-table td{padding:4px 8px 4px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:8.8pt;line-height:1.35}',
        '.meta-table tr:last-child td{border-bottom:0}',
        '.meta-table td.mk{width:19%;padding-top:5px}',
        '.meta-table td.mv{width:31%;padding-right:14px}',
        '.meta-label{display:block;font-weight:700;color:#64748b;font-size:7.2pt;text-transform:uppercase;letter-spacing:.05em;line-height:1.35}',
        // Section headings: a rule and a number, not a shaded band.
        '.pd-section-title{display:flex;align-items:center;gap:7px;color:#0f2a43;font-weight:700;font-size:9.5pt;letter-spacing:.05em;margin:12px 0 5px;padding:0 0 3px;border-bottom:1.2pt solid #0f2a43}',
        '.pd-section-title .no{display:inline-block;min-width:17px;padding:1px 4px;text-align:center;background:#0f2a43;color:#fff;border-radius:3px;font-size:8pt;letter-spacing:0;line-height:1.3}',
        '.pd-subhead{font-weight:700;font-size:8.2pt;color:#0f2a43;text-transform:uppercase;letter-spacing:.05em;margin:8px 0 2px;break-after:avoid;page-break-after:avoid}',
        '.scope-box{border-left:3px solid #0f2a43;background:#f8fafc;padding:6px 10px;font-size:9pt;line-height:1.5;margin:0 0 3px}',
        '.scope-meta{font-size:8.2pt;color:#475569;margin:0 0 2px}',
        'table.grid{margin:4px 0 10px}',
        'table.grid th{background:#f1f5f9;text-align:left;padding:5px 7px;border-bottom:2px solid #cbd5e1;font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:#334155}',
        'table.grid td{padding:5px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:8.5pt}',
        'table.grid td.num,table.grid th.num{text-align:right;font-variant-numeric:tabular-nums}',
        'table.scope-table{table-layout:fixed;margin:2px 0 3px}',
        'table.scope-table td{font-size:8.4pt;line-height:1.4;padding:4px 7px;overflow-wrap:break-word}',
        // Agenda: one table per day so each day carries its own heading band,
        // repeated with the column headings when the day runs onto a new page.
        'table.agenda{table-layout:fixed;margin:0 0 8px}',
        'table.agenda th,table.agenda td{padding:3px 6px;line-height:1.3;overflow-wrap:break-word}',
        'table.agenda td{font-size:8pt}',
        'table.agenda th{font-size:7.2pt;padding-top:4px;padding-bottom:4px;white-space:nowrap}',
        'table.agenda tr.dayband th{background:#0f2a43;color:#fff;font-size:8.6pt;text-transform:none;letter-spacing:.02em;padding:4px 7px;border-bottom:0}',
        'table.agenda tr.dayband .dd{font-weight:400;margin-left:6px;color:#dbe4ee}',
        'table.agenda tbody tr:nth-child(even) td{background:#f8fafc}',
        'table.agenda td.time{white-space:nowrap;font-variant-numeric:tabular-nums;color:#334155}',
        'table.agenda td.who{text-align:center;font-weight:600;color:#334155}',
        'table.agenda .sub{display:block;color:#64748b;font-size:7.4pt;margin-top:1px}',
        'table.agenda .req{margin:0}',
        'table.agenda .req b{color:#0f2a43}',
        'table.agenda .own{color:#64748b;font-style:italic}',
        'table.agenda tr.marker td{background:#eaf0f6 !important;border-bottom-color:#b8c9db}',
        'table.agenda tr.marker td:first-child{border-left:3px solid #0f2a43}',
        'table.agenda tr.consol td{background:#fff !important}',
        'table.agenda tr.consol td:first-child{border-left:3px dashed #94a3b8}',
        'table.agenda tr.lunch td{background:#fff !important;color:#94a3b8;font-style:italic;padding-top:2px;padding-bottom:2px}',
        'table.agenda tr.lunch td:first-child{border-left:3px solid #e2e8f0}',
        '.tag{display:inline-block;margin-left:5px;padding:0 5px;border:1px solid #cbd5e1;border-radius:3px;font-size:6.6pt;font-weight:700;font-style:normal;letter-spacing:.05em;text-transform:uppercase;color:#475569;vertical-align:1px}',
        '.agenda-key{margin:0 0 6px;font-size:8pt;color:#475569}',
        '.agenda-key p{margin:0 0 2px}',
        '.note{font-size:8.5pt;color:#475569;margin:4px 0}',
        '.key{font-size:8pt;color:#475569;margin:2px 0 6px}',
        'ul.bul{margin:2px 0 6px;padding-left:16px}',
        'ul.bul li{margin:0 0 1px;font-size:8.8pt;line-height:1.4}',
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

    /**
     * The compact code a standard is cited by in the agenda: the registry's
     * short label ("27001"), or the number of an ISO standard outside the
     * registry ("ISO 17100:2015" -> "17100"). Anything else keeps its full name.
     */
    function schemeCodes(ids, schemes) {
        const ipi = API_();
        const taken = arr(ids).map(function (id) { return ipi.shortLabel(id); });
        const out = {};
        arr(schemes).forEach(function (s) {
            const m = plain(s).match(/^ISO(?:\/IEC)?(?:\/TS)?\s+(\d+(?:-\d+)?)\b/i);
            const code = m ? m[1] : plain(s);
            out[s] = taken.indexOf(code) === -1 ? code : plain(s);
            taken.push(out[s]);
        });
        return out;
    }

    /** Short identifiers for the people named in the agenda: "Muhammad Asim Khan" -> "MAK". */
    function auditorCodes(names) {
        const out = {}; const used = {};
        arr(names).forEach(function (n) {
            const words = plain(n).replace(/[^A-Za-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
            let code = words.slice(0, 3).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || plain(n);
            if (used[code]) { let i = 2; while (used[code + i]) i++; code += i; }
            used[code] = true;
            out[n] = code;
        });
        return out;
    }

    function isGroupAuditor(name) { return /^(?:all(?: team)?|n\/a|—|-)?$/i.test(plain(name).trim()); }

    /**
     * Who the agenda names, and whether one column is needed for them. When one
     * person conducts every session the column only repeats that name, so it is
     * stated once above the agenda instead.
     */
    function agendaPeople(rows, assigned) {
        const names = [];
        arr(rows).forEach(function (r) {
            if (r.kind === 'lunch' || isGroupAuditor(r.auditor)) return;
            if (names.indexOf(r.auditor) === -1) names.push(r.auditor);
        });
        const roleOf = function (n) { const a = arr(assigned).find(function (x) { return x.name === n; }); return a && a.role ? a.role : ''; };
        const ordered = arr(assigned).map(function (a) { return a.name; }).filter(function (n) { return names.indexOf(n) !== -1; })
            .concat(names.filter(function (n) { return !arr(assigned).some(function (a) { return a.name === n; }); }));
        const groupRows = arr(rows).some(function (r) { return r.kind !== 'lunch' && isGroupAuditor(r.auditor) && plain(r.auditor).trim(); });
        return { names: ordered, codes: auditorCodes(ordered), roleOf: roleOf, column: ordered.length > 1 || groupRows };
    }

    function agendaTable(plan, ctx, scopeSchemes, people, codes) {
        const df = DF();
        const rows = arr(plan.agenda);
        const findingClause = {};
        arr(ctx.findings).forEach(function (f) { findingClause[String(f.id)] = f; });
        // Rows saved before schemes travelled with the row recover them from the
        // session's traceability record, else (a topic session) from its title.
        const traced = {};
        arr(plan.traceability && plan.traceability.sessions).forEach(function (s) { if (s && s.sessionId) traced[s.sessionId] = arr(s.schemes); });
        const withAuditor = people.column;
        const span = withAuditor ? 5 : 4;
        const cols = withAuditor
            ? '<colgroup><col style="width:11%"><col style="width:35%"><col style="width:28%"><col style="width:16%"><col style="width:10%"></colgroup>'
            : '<colgroup><col style="width:11%"><col style="width:39%"><col style="width:31%"><col style="width:19%"></colgroup>';
        const head = '<tr><th>Time</th><th>Activity / process</th><th>Requirements</th><th>Dept / auditee</th>' + (withAuditor ? '<th style="text-align:center">Auditor</th>' : '') + '</tr>';
        const whoCell = function (name) {
            if (!withAuditor) return '';
            const n = plain(name).trim();
            const label = !n ? '—' : /^n\/a$/i.test(n) ? 'N/A' : (/^all(?: team)?$/i.test(n) ? 'All' : (people.codes[name] || n));
            return '<td class="who">' + t(label) + '</td>';
        };

        const renderRow = function (r) {
            const time = '<td class="time">' + t(r.start || '') + '–' + t(r.end || '') + '</td>';
            if (r.kind === 'lunch') {
                return '<tr class="lunch">' + time + '<td colspan="2">Lunch break</td><td>' + t(r.dept || 'All') + '</td>' + whoCell('N/A') + '</tr>';
            }
            const desc = API_().describeStandards(r.standards, {});
            let req = desc.map(function (x) { return '<div class="req"><b>' + t(x.standards.join(' · ')) + '</b> ' + t(x.text) + '</div>'; }).join('');
            // A standard with no clause registry is audited against its own
            // requirements; no clause number is invented for it. The key above
            // the agenda says so once, rather than on every row.
            const schemes = arr(r.schemes).length ? arr(r.schemes) : arr(traced[r.sessionId]).length ? arr(traced[r.sessionId])
                : arr(scopeSchemes).filter(function (n) { return plain(r.item).replace(/^\[(?:Remote|On-site)\]\s*/, '').indexOf(n + ':') === 0; });
            if (schemes.length) req += '<div class="req"><b>' + t(schemes.map(function (s) { return codes[s] || s; }).join(' · ')) + '</b> <span class="own">own requirements</span></div>';
            const fc = arr(r.findingIds).map(function (id) { return findingClause[String(id)]; }).filter(Boolean);
            if (fc.length) req += '<div class="req"><b>Previous findings</b> ' + t(fc.map(function (f) { return f.clause; }).join(', ')) + '</div>';
            if (!req) req = '<div class="req">Integrated — all standards in scope</div>';
            const proc = arr(r.processes).length ? '<span class="sub">Process: ' + arr(r.processes).map(t).join('; ') + '</span>' : '';
            const sub = r.subject ? '<span class="sub">' + t(r.subject) + '</span>' : '';
            const cls = r.kind === 'opening' || r.kind === 'closing' ? 'marker' : (r.kind === 'consolidation' ? 'consol' : '');
            const tag = r.kind === 'consolidation' ? '<span class="tag">Auditor only</span>' : '';
            return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + time + '<td><b>' + t(r.item) + '</b>' + tag + sub + proc + '</td><td>' + req + '</td><td>' + t(r.dept) + '</td>' + whoCell(r.auditor) + '</tr>';
        };

        // Rows arrive in schedule order; consecutive rows of one day form a group.
        const groups = [];
        rows.forEach(function (r) {
            const key = String(r.day || '') + '|' + String(r.date || '');
            const last = groups[groups.length - 1];
            if (last && last.key === key) last.rows.push(r);
            else groups.push({ key: key, day: r.day, date: r.date, rows: [r] });
        });
        return groups.map(function (g) {
            const d = df.parseDateParts(g.date);
            const when = d ? df.weekdayName(g.date) + ' ' + df.formatDate(g.date) : '';
            const band = '<tr class="dayband"><th colspan="' + span + '">' + t(g.day || 'Agenda') + (when ? '<span class="dd">' + t(when) + '</span>' : '') + '</th></tr>';
            return '<table class="grid agenda">' + cols + '<thead>' + band + head + '</thead><tbody>' + g.rows.map(renderRow).join('') + '</tbody></table>';
        }).join('');
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
        // Every standard in scope, including those the clause registry does not hold.
        const schemes = Array.isArray(c.schemes) ? c.schemes : ipi.schemesOf(p);
        const stdLabels = ipi.scopeLabels(ids, schemes);
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

        // Two label/value pairs per row; a value that needs the width spans it.
        const meta = function (label, value) { return '<td class="mk"><span class="meta-label">' + t(label) + '</span></td><td class="mv">' + value + '</td>'; };
        const wide = function (label, value) { return '<tr><td class="mk"><span class="meta-label">' + t(label) + '</span></td><td class="mv" colspan="3">' + value + '</td></tr>'; };
        const pair = function (a, b) { return '<tr>' + a + (b || '<td class="mk"></td><td class="mv"></td>') + '</tr>'; };
        const teamLabel = ipi.auditTeamLabel(assigned);

        const metaTable = '<table class="meta-table">'
            + pair(meta('Client', t(c.client && c.client.name || p.client)), meta('Audit type', t(p.auditType || p.type)))
            + wide('Audit standards', stdLabels.map(t).join(' · '))
            + pair(meta('Scheduled audit', t(scheduled)), meta('Audit method', t(p.auditMethod || 'Not recorded')))
            + pair(meta('Recommended audit window', cyc.recommendedWindowStart ? t(df.formatDateRange(cyc.recommendedWindowStart, cyc.recommendedWindowEnd)) + ' (planning guidance)' : 'Not recorded'),
                meta('Certificate expiry', cyc.certificateExpiry ? t(df.formatDate(cyc.certificateExpiry)) : 'Not recorded'))
            + pair(meta('Lead Auditor', t(lead ? lead.name : 'Not assigned')), meta('Audit team', t(teamLabel)))
            + pair(meta('Approved audit duration', finalDays ? t(finalDays.toFixed(1) + ' auditor-days' + (p.auditMethod ? ' (' + String(p.auditMethod).toLowerCase() + ')' : '')) : 'Not approved'),
                meta('Time zone', tzInfo ? t(tzInfo.label) : '<span class="bad">Not agreed</span>'))
            + wide('Impartiality risk', t((p.impartialityAssessment && p.impartialityAssessment.risk) || 'None identified'))
            + '</table>';

        let n = 0;
        const section = function (title) { n += 1; return '<div class="pd-section-title"><span class="no">' + n + '</span>' + title + '</div>'; };
        const bullets = function (field) {
            const items = lines(p[field] || p['audit' + field.charAt(0).toUpperCase() + field.slice(1)]);
            return items.length ? '<ul class="bul">' + items.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul>' : '<p class="note bad">Not recorded.</p>';
        };

        const objectives = section('AUDIT OBJECTIVES') + bullets('objectives');

        const certLine = arr(c.scope && c.scope.certificateNumbers).length
            ? '<p class="scope-meta">Certificate' + (c.scope.certificateNumbers.length > 1 ? 's' : '') + ': ' + t(c.scope.certificateNumbers.join(', ')) + (cyc.certificateExpiry ? ' · valid to ' + t(df.formatDate(cyc.certificateExpiry)) : '') + '</p>' : '';
        // A client holding one certificate per standard has one scope per
        // certificate: each is reproduced exactly, beside its standard.
        const scopeList = arr(c.scope && c.scope.scopes);
        const scopeBody = scopeList.length > 1
            ? '<table class="grid scope-table"><colgroup><col style="width:24%"><col style="width:14%"><col style="width:62%"></colgroup>'
                + '<thead><tr><th>Standard</th><th>Certificate</th><th>Certified scope</th></tr></thead><tbody>'
                + scopeList.map(function (x) { return '<tr><td>' + x.standards.map(t).join('<br>') + '</td><td>' + (x.certificateNumbers.map(t).join('<br>') || '—') + '</td><td>' + t(x.text) + '</td></tr>'; }).join('')
                + '</tbody></table>'
                + (cyc.certificateExpiry ? '<p class="scope-meta">Certificates valid to ' + t(df.formatDate(cyc.certificateExpiry)) + '</p>' : '')
            : '<p class="scope-box">' + t((c.scope && c.scope.certificateScope) || p.scope || 'Not recorded') + '</p>' + certLine;
        const scopeSection = section('AUDIT SCOPE &amp; CRITERIA')
            + '<div class="pd-subhead">Certified scope</div>' + scopeBody
            + '<div class="pd-subhead">Audit criteria</div>' + bullets('criteria');

        const allocRows = arr(p.selectedSites).map(function (s) {
            const r = arr(c.client && c.client.sites).find(function (x) { return x.name === s.name; }) || {};
            const emps = Number(r.employees) || 0;
            const days = total > 0 ? emps / total * finalDays : finalDays / Math.max(1, arr(p.selectedSites).length);
            return '<tr><td>' + t(s.name) + '</td><td>' + t(r.address || '—') + '</td><td class="num">' + emps + '</td><td>' + t(assigned.map(function (a) { return a.name; }).join(', ') || '—') + '</td><td class="num"><b>' + days.toFixed(2) + '</b></td></tr>';
        }).join('');
        const allocation = section('AUDIT TEAM, SITES &amp; DURATION')
            + '<table class="grid"><colgroup><col style="width:15%"><col style="width:36%"><col style="width:12%"><col style="width:21%"><col style="width:16%"></colgroup>'
            + '<thead><tr><th>Site</th><th>Address</th><th class="num">Personnel</th><th>Auditor(s)</th><th class="num">Auditor-days</th></tr></thead><tbody>' + allocRows
            + '<tr><td colspan="2"><b>TOTAL</b></td><td class="num"><b>' + total + '</b></td><td></td><td class="num"><b>' + finalDays.toFixed(2) + '</b></td></tr></tbody></table>'
            + (dur.effectivePersonnel ? '<p class="note">Duration basis: ' + t((p.auditType || p.type) + ' · ' + dur.effectivePersonnel.value + ' effective personnel · ' + dur.sites + ' site' + (dur.sites === 1 ? '' : 's')
                + (stdLabels.length > 1 ? ' · integrated audit of ' + stdLabels.length + ' standards (IMS adjustment ' + (dur.imsIntegration ? dur.imsIntegration.adjustmentPercent : 0) + '%)' : '')) + '. The full calculation is held in the certification record.</p>' : '');

        const methodology = section('AUDIT METHODOLOGY') + bullets('methodology');

        // Agenda key: everything the rows would otherwise repeat, said once.
        const codes = schemeCodes(ids, schemes);
        const people = agendaPeople(p.agenda, assigned);
        const tzStatement = tzInfo ? '<p>' + t(df.timeZoneStatement(c.timeZone.iana, p.date, p.endDate)) + '</p>' : '<p class="bad">The agreed time zone has not been recorded.</p>';
        const keyItems = ids.map(function (id) { return t(ipi.shortLabel(id)) + ' = ' + t(ipi.stdLabel(id)); })
            .concat(schemes.map(function (s) { return codes[s] === plain(s) ? t(s) : t(codes[s]) + ' = ' + t(s); }));
        const key = '<p><b>Standards key:</b> ' + keyItems.join(' · ')
            + (schemes.length ? '. <span class="own">Own requirements</span>: audited against the standard’s own requirements; no clause numbers are cited.' : '') + '</p>';
        const roleSuffix = function (nm) { const r = people.roleOf(nm); return r ? ' (' + r + ')' : ''; };
        const auditorLine = people.column
            ? '<p><b>Auditors:</b> ' + people.names.map(function (nm) { return t(people.codes[nm]) + ' = ' + t(nm + roleSuffix(nm)); }).join(' · ') + '</p>'
            : (people.names.length === 1 ? '<p><b>Auditor:</b> every session is conducted by ' + t(people.names[0] + roleSuffix(people.names[0])) + '.</p>' : '');
        const findingLine = need.length
            ? (mappedAll ? '<p><b>Previous findings requiring follow-up: ' + need.length + '</b> — all ' + need.length + ' are scheduled in the sessions below.</p>'
                : '<p class="bad"><b>Previous findings requiring follow-up: ' + need.length + '</b> — not every finding is scheduled; the plan cannot be approved until they are.</p>')
            : '<p>No previous findings require follow-up.</p>';
        const agenda = section('AUDIT AGENDA / ITINERARY')
            + '<div class="agenda-key">' + tzStatement + key + auditorLine + findingLine + '</div>'
            + agendaTable(p, c, schemes, people, codes);

        const body = shell.masthead({ brandName: c.brand && c.brand.name, logoUrl: c.brand && c.brand.logoUrl, title: 'Audit Plan', subtitle: 'Ref: ' + ref + ' · ' + plain(c.client && c.client.name || p.client), qrUrl: c.qrUrl })
            + '<p class="status-line"><span class="status-pill ' + statusClass(status) + '">' + t(status) + '</span>'
            + (/^draft/i.test(status) ? '<span class="draft-note">This plan has not been approved for client issue.</span>' : '') + '</p>'
            + metaTable + objectives + scopeSection + allocation + methodology + agenda;

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
            + fld('Certificate wording (authoritative)', sc.certificateScope ? t(sc.certificateScope).replace(/\n/g, '<br>') : 'not found')
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
