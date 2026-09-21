// ============================================
// CHECKLIST DOCUMENT  (window.ChecklistDocument)
// ============================================
// Builds the printable client-specific audit checklist. Pure: everything it
// needs is passed in, so the same function serves the print window, the tests
// and the PDF QA run.
//
// WHAT THIS CORRECTS (all seen on the PC CONNECTION checklist)
//   * "Date: 21 Sept 2026" was the day the PDF was PRINTED, on a checklist for
//     an audit on 3-5 November 2026. The cover now states the SCHEDULED audit
//     and, separately, when the checklist was generated.
//   * The lifecycle was unstated. A pre-audit checklist now says
//     "Prepared — audit not started"; its items are "Not Checked".
//   * "Checklist QA validation passed" and "Coverage validated" were printed
//     beside "Coverage could not be assessed". One combined status is printed.
//   * The browser's own header, timestamp, "about:blank" and page counter were
//     on every page; the document now defines its own (see print-shell.js).
//   * Stored text that had been HTML-escaped printed literally as "&amp;".
//     Every string is decoded once and escaped once, here.
//
// CONTRACT
//   ChecklistDocument.build(checklist, ctx)   -> HTML string
//   ChecklistDocument.printItems(checklist)   -> [{clause, requirement, isHeader, level}]
//   ChecklistDocument.lifecycle(ctx)          -> {key, label}
//   ChecklistDocument.reference(checklist, ctx)
//   ChecklistDocument.validateItemStatus(status, justification) -> {ok, error}
//   ChecklistDocument.qaPanel(qa) / coveragePanel(cov, checklist) / validationBanner(combined)

(function (global) {
    'use strict';

    const DF = function () { return global.DocFormat || (typeof require === 'function' ? require('./doc-format.js') : null); };
    const PS = function () { return global.PrintShell || (typeof require === 'function' ? require('./print-shell.js') : null); };

    /** Decode text stored HTML-escaped, then escape once for output. */
    function t(v) {
        const d = DF();
        return d.escapeHtml(d.decodeEntities(v == null ? '' : String(v)));
    }
    function plain(v) { const d = DF(); return d.decodeEntities(v == null ? '' : String(v)); }
    function arr(v) { return Array.isArray(v) ? v : []; }
    const CSd = function () { return global.ChecklistStandards || (typeof require === 'function' ? require('./checklist-standards.js') : null); };

    /**
     * The clause column shows a run of references as a range
     * ("A.5.24 / A.5.25 / A.5.26 / A.5.27 / A.6.8" -> "A.5.24–A.5.27, A.6.8"),
     * so five-line clause cells stay readable. Display only: the stored value
     * is untouched. Anything that is not purely a list of references (a
     * pseudo-clause such as RECERT, or "9.6.2 (a)") is shown as it is.
     */
    function displayClause(value) {
        const raw = String(value == null ? '' : value).trim();
        const tokens = raw.split(/\s*(?:\/|,)\s*/).filter(Boolean);
        const isRef = function (x) { return /^(?:A\.\d+\.\d+|\d{1,2}(?:\.\d{1,2}){0,2})$/.test(x); };
        if (tokens.length < 3 || !tokens.every(isRef)) return raw;
        const cs = CSd();
        return cs && cs.compressRuns ? cs.compressRuns(tokens).replace(/, /g, ' / ') : raw;
    }

    // ── Controlled item statuses ──────────────────────────────────────
    // Before the audit every item is "Not Checked". Once it begins the auditor
    // may use these. Not Applicable is a claim that a requirement does not
    // apply, and an unsupported one is how a requirement gets skipped, so it
    // is not accepted without a stated reason.
    const ITEM_STATUSES = [
        { key: 'conform', label: 'Conforming' },
        { key: 'nc', label: 'Nonconforming' },
        { key: 'observation', label: 'Observation' },
        { key: 'ofi', label: 'Opportunity for Improvement' },
        { key: 'na', label: 'Not Applicable', requiresJustification: true },
        { key: '', label: 'Not Checked' }
    ];
    const DEFAULT_ITEM_STATUS = 'Not Checked';
    const LIFECYCLE_PREPARED = 'Prepared — audit not started';

    function validateItemStatus(status, justification) {
        const s = String(status == null ? '' : status).toLowerCase();
        const known = ITEM_STATUSES.find(function (x) { return x.key === s || x.label.toLowerCase() === s; });
        if (!known) return { ok: false, error: 'Unknown status "' + status + '".' };
        if (known.requiresJustification && !String(justification == null ? '' : justification).trim()) {
            return { ok: false, error: 'Not Applicable requires a justification.' };
        }
        return { ok: true, error: '' };
    }

    /**
     * Where the checklist is in its life. Derived from the audit's own record,
     * never asserted by the print.
     */
    function lifecycle(ctx) {
        const c = ctx || {};
        const report = c.report;
        const status = String((report && report.status) || '').toLowerCase();
        if (/final|publish|approved|issued/.test(status)) return { key: 'completed', label: 'Audit completed' };
        if (report && arr(report.checklistProgress).some(function (p) { return p && p.status; })) return { key: 'in-progress', label: 'Audit in progress' };
        return { key: 'prepared', label: LIFECYCLE_PREPARED };
    }

    /** CHK-<client initials>-<year>-<nn>, stable for a given checklist. */
    function reference(checklist, ctx) {
        const c = ctx || {};
        if (checklist && checklist.reference) return String(checklist.reference);
        const d = DF();
        const initials = String((checklist && (checklist.clientName || c.clientName)) || (c.client && c.client.name) || '')
            .replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).map(function (w) { return w[0].toUpperCase(); }).join('').slice(0, 3) || 'XX';
        const p = d.parseDateParts((c.plan && c.plan.date) || (checklist && (checklist.createdAt || checklist.updatedAt)));
        const year = p ? p.y : new Date().getFullYear();
        const list = arr(c.siblings).filter(function (x) { return x && (x.clientId === checklist.clientId || x.clientName === checklist.clientName); })
            .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
        const idx = Math.max(0, list.findIndex(function (x) { return String(x.id) === String(checklist.id); }));
        return 'CHK-' + initials + '-' + year + '-' + String(idx + 1).padStart(2, '0');
    }

    /** The checklist's questions in print order, from either data shape. */
    function printItems(checklist) {
        const out = [];
        const ck = checklist || {};
        if (arr(ck.clauses).length) {
            ck.clauses.forEach(function (main) {
                out.push({ clause: main.mainClause || main.clause, requirement: main.title || main.requirement, isHeader: true, level: 1 });
                arr(main.subClauses).forEach(function (sub) {
                    const nested = function (o) {
                        if (!o.items || !o.items[0]) return null;
                        return o.items[0].requirement || o.items[0].text || o.items[0].title;
                    };
                    if (sub.items && sub.items.length) {
                        const subTitle = sub.title || sub.requirement || sub.text || '';
                        // A scope-driven item carries the exact standard(s) and
                        // clause(s) it tests in `citation`, so the criterion is
                        // on the record rather than inferred from a bare number
                        // that means different things in different standards.
                        out.push({ clause: sub.clause, requirement: sub.citation ? subTitle + ' — ' + sub.citation : subTitle, isHeader: true, level: 2 });
                        sub.items.forEach(function (item) {
                            out.push({ clause: item.clause, requirement: item.requirement || item.text || item.title || '' });
                        });
                    } else {
                        out.push({ clause: sub.clause, requirement: sub.requirement || sub.title || sub.requirement_text || sub.text || nested(sub) || '' });
                    }
                });
            });
        } else if (arr(ck.items).length) {
            return ck.items.map(function (i) { return { clause: i.clause, requirement: i.requirement || i.text || i.title || '' }; });
        }
        return out;
    }

    // ── Validation panels ─────────────────────────────────────────────

    function qaPanel(qa) {
        if (!qa) return '';
        if (qa.ok) {
            return '<div class="qa-panel qa-pass">'
                + '<h2>Checklist QA validation <span class="qa-scope">(internal consistency of the questions)</span></h2>'
                + '<p><strong>Passed.</strong> ' + qa.itemCount + ' questions. Every clause and control cited belongs to a standard in the audit scope; no duplicate, contradictory or out-of-scope requirements were found.</p>'
                + '</div>';
        }
        const cls = qa.blocking ? 'qa-fail' : 'qa-warn';
        const order = { critical: 0, warning: 1, info: 2 };
        const rows = arr(qa.issues).slice().sort(function (a, b) { return order[a.severity] - order[b.severity]; }).slice(0, 25)
            .map(function (i) { return '<li><span class="qa-tag qa-tag-' + t(i.severity) + '">' + t(i.severity) + '</span>' + (i.itemRef ? '<strong>' + t(i.itemRef) + '</strong> — ' : '') + t(i.message) + '</li>'; }).join('');
        const hidden = arr(qa.issues).length - Math.min(arr(qa.issues).length, 25);
        const summary = (global.ChecklistQA && global.ChecklistQA.summarize) ? global.ChecklistQA.summarize(qa) : '';
        return '<div class="qa-panel ' + cls + '">'
            + '<h2>Checklist QA validation <span class="qa-scope">(internal consistency of the questions)</span></h2>'
            + '<p><strong>' + t(summary) + '</strong>' + (qa.blocking ? ' Resolve the critical items before the checklist is used as an audit record.' : '') + '</p>'
            + '<ul>' + rows + '</ul>' + (hidden > 0 ? '<p style="margin-top:6px;">…and ' + hidden + ' further item(s).</p>' : '') + '</div>';
    }

    function annexALabel(ct) {
        if (!ct.soaDriven) return ct.soaDocument ? 'assumed — SoA document on file could not be read' : 'assumed, no SoA supplied';
        if (ct.soaSource === 'document') return 'per SoA — ' + (ct.soaDocument && ct.soaDocument.name ? ct.soaDocument.name : 'document on file');
        return 'per SoA';
    }

    /**
     * The cycle-coverage panel. Leads with the OUTCOME label — "validated"
     * appears only for the two outcomes that assessed coverage — and reports
     * each standard's figures as planned in this audit, inherited from earlier
     * audits in the cycle, and remaining.
     */
    function coveragePanel(cov, checklist) {
        if (!cov) {
            return '<div class="qa-panel qa-cov qa-fail"><h2>Recertification coverage validation</h2>'
                + '<p><strong>Blocked — coverage could not be assessed.</strong> The coverage pass did not run. This is an internal error; it is not a finding about the audit.</p></div>';
        }
        const c = cov.coverage || {};
        const outcome = cov.outcome || (cov.blocking ? 'failed' : 'passed');
        const cls = outcome === 'blocked' || outcome === 'failed' ? 'qa-fail' : (outcome === 'passed-with-notes' ? 'qa-warn' : 'qa-pass');
        const label = (global.ChecklistCoverage && global.ChecklistCoverage.OUTCOMES && global.ChecklistCoverage.OUTCOMES[outcome]) || outcome;
        const rows = [];
        arr(c.clauses).forEach(function (cl) {
            rows.push('<tr><td>' + t(cl.label) + ' — requirements</td><td>' + cl.planned + ' / ' + cl.total + '</td><td>' + cl.inherited + '</td><td>' + cl.remaining + '</td></tr>');
        });
        arr(c.controls).forEach(function (ct) {
            rows.push('<tr><td>' + t(ct.label) + ' — Annex A applicable (' + t(annexALabel(ct)) + ')</td><td>' + ct.planned + ' / ' + ct.pool + '</td><td>' + ct.inherited + '</td><td>' + ct.remaining + '</td></tr>');
        });
        if (c.processes && c.processes.total) {
            rows.push('<tr><td>Critical processes</td><td>—</td><td>' + c.processes.covered + ' / ' + c.processes.total + ' over the cycle</td><td>' + (c.processes.total - c.processes.covered) + '</td></tr>');
        }
        if (c.integrated && c.integrated.standards > 1) {
            rows.push('<tr class="cov-total"><td>Integrated view — ' + c.integrated.standards + ' standards</td><td>' + c.integrated.planned + ' / ' + c.integrated.requirements + '</td><td>' + c.integrated.inherited + '</td><td>' + c.integrated.remaining + '</td></tr>');
        }
        const order = { critical: 0, warning: 1, info: 2 };
        const list = arr(cov.issues).slice().sort(function (a, b) { return order[a.severity] - order[b.severity]; }).slice(0, 20)
            .map(function (i) { return '<li><span class="qa-tag qa-tag-' + t(i.severity) + '">' + t(i.severity === 'critical' ? (outcome === 'blocked' ? 'internal error' : 'gap') : i.severity) + '</span>' + t(i.message) + '</li>'; }).join('');
        const cycle = c.cycle || {};
        const d = DF();
        const resolved = Object.keys((checklist && checklist.resolvedIssues) || {}).map(function (k) { return checklist.resolvedIssues[k]; });
        const disp = resolved.length
            ? '<p style="margin-top:8px;"><strong>Dispositioned by the auditor:</strong></p><ul>' + resolved.map(function (r) {
                return '<li>' + t(r.note || r.action) + ' <em>(' + t(r.by || '') + (r.at ? ', ' + t(d.formatDate(r.at) || r.at) : '') + ')</em></li>'; }).join('') + '</ul>'
            : '';
        const cycleText = (cycle.start && cycle.end) ? 'Certification cycle ' + d.formatDateRange(cycle.start, cycle.end) + (cycle.anchored ? ' (anchored on ' + t(cycle.anchored) + ')' : '')
            + ', ' + (cycle.priorAudits || 0) + ' prior audit(s) on file, ' + (cycle.priorChecklists || 0) + ' of their checklists read for coverage.' : '';
        return '<div class="qa-panel qa-cov ' + cls + '">'
            + '<h2>Recertification coverage validation</h2>'
            + '<p><strong>' + t(label) + '.</strong> ' + t(cycleText) + '</p>'
            + (rows.length ? '<table class="cov-table"><thead><tr><th>Coverage by standard</th><th>Planned this audit</th><th>Inherited from cycle</th><th>Remaining</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' : '')
            + (list ? '<ul>' + list + '</ul>' : '') + disp
            + '<p class="cov-note">Annex A controls are selected risk-based from the applicable set — the Statement of Applicability, the risk assessment, changes since the previous audit, incidents and previous audit results. Auditing every control at every audit is not required; covering the applicable set across the certification cycle is.</p>'
            + '</div>';
    }

    /** The single status line for the whole checklist. */
    function validationBanner(combined) {
        if (!combined) return '';
        const cls = combined.outcome === 'blocked' || combined.outcome === 'failed' ? 'qa-fail' : (combined.outcome === 'passed-with-notes' ? 'qa-warn' : 'qa-pass');
        return '<div class="qa-panel ' + cls + ' pd-keep"><h2>Checklist validation status</h2><p><strong>' + t(combined.label) + '</strong>'
            + (combined.reasons && combined.reasons.length ? ' ' + t(combined.reasons.join(' ')) : '') + '</p></div>';
    }

    // ── The document ──────────────────────────────────────────────────

    function css(brand) {
        // The rules the existing print tests pin (brand-coloured section
        // headers, green/amber/red status panels) keep their exact form.
        return [
            '.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 22px;margin:2px 0 10px}',
            '.meta-grid div{font-size:9pt;color:#475569}',
            '.meta-grid strong{color:#0f172a}',
            '.badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 8.5pt; font-weight: 600; }',
            '.badge-green { background: #dcfce7; color: #166534; }',
            '.badge-blue { background: ' + brand.tint + '; color: ' + brand.text + '; }',
            'table.items{margin-top:8px;table-layout:fixed}',
            'table.items th { background: ' + brand.deep + '; color: #f8fafc; padding: 7px 10px; text-align: left; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }',
            'table.items td { padding: 7px 10px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 9pt; overflow-wrap: break-word; }',
            'table.items td.clause { font-weight: 700; background: #f8fafc; color: #334155; font-family: Consolas, "Courier New", monospace; font-size: 8.5pt; }',
            'tr.section-header td:first-child { white-space: nowrap; }',
            'table.items tr.item:nth-child(even) td:not(.clause) { background: #fafbfc; }',
            'tr.section-header td { background: ' + brand.primary + '; color: #fff; font-weight: 700; font-size: 9.5pt; border-color: ' + brand.primary + '; padding: 6px 10px; }',
            'tr.sub-header td { background: ' + brand.tint + '; color: ' + brand.text + '; font-weight: 600; font-size: 9pt; border-bottom: 2px solid ' + brand.tintBorder + '; }',
            'tr.section-header,tr.sub-header{break-after:avoid;page-break-after:avoid}',
            '.status-col { text-align: center; font-size: 8.5pt; color: #64748b; }',
            '.qa-panel { margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 12px; break-inside: avoid; }',
            '.qa-panel.qa-cov { break-inside: auto; }',
            '.qa-panel.qa-pass { border-left: 4px solid #059669; background: #f0fdf4; }',
            '.qa-panel.qa-warn { border-left: 4px solid #f59e0b; background: #fffbeb; }',
            '.qa-panel.qa-fail { border-left: 4px solid #dc2626; background: #fef2f2; }',
            '.qa-panel h2 { font-size: 9pt; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; }',
            '.qa-panel .qa-scope{text-transform:none;letter-spacing:0;font-weight:400;color:#64748b}',
            '.qa-panel p { margin: 0 0 4px 0; font-size: 9pt; color: #475569; }',
            '.qa-panel ul { margin: 4px 0 0 0; padding-left: 16px; }',
            '.qa-panel li { font-size: 8.5pt; color: #475569; margin-bottom: 2px; }',
            '.qa-tag { display: inline-block; font-size: 7pt; font-weight: 700; letter-spacing: 0.3px; padding: 1px 5px; border-radius: 8px; margin-right: 5px; text-transform: uppercase; }',
            '.qa-tag-critical { background: #fee2e2; color: #991b1b; }',
            '.qa-tag-warning { background: #fef3c7; color: #92400e; }',
            '.qa-tag-info { background: #e0f2fe; color: #075985; }',
            '.cov-table { width: 100%; border-collapse: collapse; margin: 6px 0 4px; }',
            '.cov-table th { background: transparent; color: #64748b; padding: 3px 5px; font-size: 7.5pt; text-align: left; }',
            '.cov-table td { border: none; border-bottom: 1px solid #e2e8f0; padding: 3px 5px; font-size: 8.5pt; color: #475569; }',
            '.cov-table td:not(:first-child),.cov-table th:not(:first-child) { text-align: right; width: 78px; font-variant-numeric: tabular-nums; }',
            '.cov-table tr.cov-total td{font-weight:700;color:#0f172a}',
            '.cov-note { font-size: 8pt; color: #64748b; margin-top: 5px; }',
            '.status-key{font-size:8.5pt;color:#475569;margin:8px 0 0}',
            '.status-key span{display:inline-block;margin-right:10px}',
            'tr.keep-next{break-after:avoid;page-break-after:avoid}',
            'tr.sign-row td{border:0 !important;background:#fff !important;padding:14px 4px 0;break-inside:avoid;border-top:2px solid #e2e8f0 !important}',
            '.sig-row { display: flex; justify-content: space-between; gap: 30px; margin-top: 14px; }',
            '.sig-block { flex: 1; }',
            '.sig-line { border-bottom: 1px solid #94a3b8; margin-top: 24px; }',
            '.sig-label { font-size: 8.5pt; color: #64748b; margin-top: 3px; }',
            '.sign-note { font-size: 8pt; color: #94a3b8; text-align: center; margin-top: 12px; }'
        ].join('\n');
    }

    /**
     * @param {Object} checklist
     * @param {Object} ctx {
     *   brand, cbName, logoUrl, qrUrl, plan, report, client, siblings,
     *   qa, coverage, combined, items, generatedOn, classification }
     */
    function build(checklist, ctx) {
        const c = ctx || {};
        const d = DF();
        const shell = PS();
        const ck = checklist || {};
        const items = c.items || printItems(ck);
        const brand = c.brand;
        const life = lifecycle(c);
        const ref = reference(ck, c);
        const plan = c.plan;
        const cbName = plain(c.cbName || 'ISOXPERT Audit360');
        const clientName = plain(ck.clientName || (c.client && c.client.name) || '');
        const auditType = ck.auditType ? String(ck.auditType).replace(/^./, function (m) { return m.toUpperCase(); }) : '';

        // The audit date is the SCHEDULED date. It is never today's date: a
        // checklist printed in September for a November audit must not say
        // "September". No plan / no booked dates -> say so.
        const scheduled = plan && plan.date ? d.formatDateRange(plan.date, plan.endDate) : '';
        const generated = d.formatDate(ck.createdAt || ck.updatedAt || c.generatedOn) || d.formatDate(new Date());
        const scope = ck.auditScope ? '<div><strong>Scope:</strong> ' + t(ck.auditScope) + '</div>' : '';
        const stdList = plain(ck.standard || '');
        const nItems = items.filter(function (i) { return !i.isHeader; }).length;

        const lastItems = items.length - 3;
        const rows = items.map(function (item, idx) {
            if (item.isHeader) {
                return '<tr class="' + (item.level === 2 ? 'sub-header' : 'section-header') + '"><td>' + t(displayClause(item.clause)) + '</td><td colspan="3">' + t(item.requirement) + '</td></tr>';
            }
            return '<tr class="item' + (idx >= lastItems ? ' keep-next' : '') + '"><td class="clause">' + t(displayClause(item.clause || '')) + '</td><td>' + t(item.requirement || '') + '</td>'
                + '<td class="status-col">' + DEFAULT_ITEM_STATUS + '</td><td class="evidence-col">-</td></tr>';
        }).join('');

        const body = shell.masthead({
            brandName: cbName, logoUrl: c.logoUrl, title: plain(ck.name || 'Audit Checklist'),
            subtitle: 'Audit checklist' + (auditType ? ' · ' + auditType : '') + ' · ' + ref, qrUrl: c.qrUrl
        })
            + '<div class="meta-grid">'
            + '<div><strong>Client:</strong> ' + t(clientName) + '</div>'
            + '<div><strong>Standards:</strong> <span class="badge badge-blue">' + t(stdList) + '</span></div>'
            + '<div><strong>Scheduled audit:</strong> ' + (scheduled ? t(scheduled) : 'Not yet scheduled') + '</div>'
            + '<div><strong>Audit type:</strong> ' + (auditType ? t(auditType) : '—') + '</div>'
            + '<div><strong>Checklist status:</strong> ' + t(life.label) + '</div>'
            + '<div><strong>Item status:</strong> ' + DEFAULT_ITEM_STATUS + '</div>'
            + '<div><strong>Checklist reference:</strong> ' + t(ref) + '</div>'
            + '<div><strong>Type:</strong> <span class="badge ' + (ck.type === 'global' ? 'badge-green' : 'badge-blue') + '">' + (ck.type === 'global' ? 'Global' : 'Custom') + '</span> · <strong>Items:</strong> ' + nItems + '</div>'
            + '<div><strong>Checklist generated:</strong> ' + t(generated) + '</div>'
            + scope
            + '</div>'
            + validationBanner(c.combined)
            + qaPanel(c.qa)
            + coveragePanel(c.coverage, ck)
            + '<p class="status-key"><strong>Item status key</strong> (once the audit begins): '
            + ITEM_STATUSES.map(function (s) { return '<span>' + t(s.label) + (s.requiresJustification ? ' (justification required)' : '') + '</span>'; }).join('') + '</p>'
            + '<table class="items"><thead><tr>'
            + '<th style="width:84px">Clause</th><th>Requirement</th><th style="width:74px;text-align:center">Status</th><th style="width:150px">Auditor comments / evidence</th>'
            + '</tr></thead><tbody>' + rows
            // The sign-off is the table's LAST ROW and the rows before it are
            // marked keep-with-next, so it can never be stranded alone on a page.
            + '<tr class="sign-row"><td colspan="4"><div class="sig-row">'
            + '<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Lead Auditor Signature</div></div>'
            + '<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Client Representative</div></div>'
            + '<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Date</div></div>'
            + '</div><p class="sign-note">Generated by ' + t(cbName) + ' · This is a controlled document</p></td></tr>'
            + '</tbody></table>';

        return shell.buildDocument({
            title: plain(ck.name || 'Audit Checklist'),
            header: { left: cbName, center: clientName, right: ref + (auditType ? ' · ' + auditType : '') },
            footer: { left: c.classification ? plain(c.classification) : 'Checklist generated ' + generated, center: 'Audit checklist' },
            bodyHtml: body,
            extraCss: shell.MASTHEAD_CSS + '\n' + css(brand)
        });
    }

    const API = { displayClause, ITEM_STATUSES, DEFAULT_ITEM_STATUS, LIFECYCLE_PREPARED, validateItemStatus, lifecycle, reference, printItems,
        qaPanel, coveragePanel, validationBanner, build };
    global.ChecklistDocument = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'checklist-document.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);
