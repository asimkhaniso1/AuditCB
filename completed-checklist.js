// ============================================
// COMPLETED CHECKLIST  (window.CompletedChecklist)
// ============================================
// The audit checklist with the auditor's answers: every question in the
// order the execution view shows it, its result (Conforming, Not applicable,
// Not assessed, or the finding it raised — NCR-001, OBS-002 …), the
// auditor's notes and evidence, who was interviewed and how many screenshots
// are on file.
//
// The blank checklist (checklist-document.js) is printed from the plan before
// the audit; this one is printed from the audit record. Questions, order and
// requirement text follow the execution view exactly: the plan's question
// selection, its wording overrides, the report's saved section order and the
// questions added during the audit. Finding references come from
// window.collectAuditFindings, so they match the Findings tab and the
// findings summary.
//
// CONTRACT
//   CompletedChecklist.rows(report, plan, checklists) -> [{title, groups:[{code, title, rows:[…]}]}]
//   CompletedChecklist.build(ctx)                      -> HTML string (pure)
//   window.printCompletedChecklist(reportId)           -> opens the print window

(function (global) {
    'use strict';

    const need = function (name, file) { return global[name] || (typeof require === 'function' ? require(file) : null); };
    const DF = function () { return need('DocFormat', './doc-format.js'); };
    const PS = function () { return need('PrintShell', './print-shell.js'); };
    const FS = function () { return global.FindingsSummary || null; };

    function arr(v) { return Array.isArray(v) ? v : []; }
    function plain(v) { return DF().decodeEntities(v == null ? '' : String(v)); }
    function t(v) { return DF().escapeHtml(plain(v)); }
    function str(v) { return v == null ? '' : String(v).trim(); }
    function clean(v) { const fs = FS(); return fs && fs.clean ? fs.clean(v) : str(v); }

    function requirementOf(item) {
        const nested = item && item.items && item.items[0] ? (item.items[0].requirement || item.items[0].text || item.items[0].title) : '';
        return str(item && (item.requirement || item.text || item.title || item.requirement_text)) || str(nested);
    }

    /** The screenshots saved on a checklist answer (shared helper in findings-summary.js). */
    function evidenceOf(p) { const fs = FS(); return fs && fs.shots ? fs.shots.evidenceOf(p) : []; }

    /**
     * Every question of the audit, grouped by checklist and section, with its
     * saved answer. Mirrors renderExecutionTab's checklist case.
     */
    function rows(report, plan, checklists) {
        const r = report || {};
        const progress = {};
        arr(r.checklistProgress).forEach(function (p) {
            if (!p) return;
            progress[p.isCustom ? 'custom-' + p.itemIdx : p.checklistId + '-' + p.itemIdx] = p;
        });
        const selection = (plan && plan.selectedChecklistItems) || {};
        const overrides = (plan && plan.selectedChecklistOverrides) || {};
        const order = arr(r.clauseOrder);
        const out = [];

        arr(checklists).forEach(function (cl) {
            const allowed = selection[cl.id];
            const selective = Array.isArray(allowed) && allowed.length > 0;
            const allowedStr = selective ? allowed.map(String) : [];
            const groups = [];
            const row = function (item, itemId, qRef) {
                const ov = overrides[cl.id] && overrides[cl.id][itemId];
                return {
                    key: cl.id + '-' + itemId, checklistId: cl.id, itemIdx: itemId, questionRef: qRef,
                    clause: str(item && item.clause), requirement: str(ov) || requirementOf(item),
                    progress: progress[cl.id + '-' + itemId] || null
                };
            };
            if (arr(cl.clauses).length) {
                const clauses = cl.clauses.slice();
                if (order.length) {
                    clauses.sort(function (a, b) {
                        const pa = order.indexOf(cl.id + '-' + a.mainClause);
                        const pb = order.indexOf(cl.id + '-' + b.mainClause);
                        return (pa === -1 ? 9999 : pa) - (pb === -1 ? 9999 : pb);
                    });
                }
                clauses.forEach(function (main) {
                    const list = arr(main.subClauses)
                        .map(function (item, subIdx) { return { item: item, id: main.mainClause + '-' + subIdx }; })
                        .filter(function (o) { return !selective || allowedStr.indexOf(o.id) !== -1; })
                        .map(function (o) {
                            const qRef = global.ChecklistQuestionRef ? global.ChecklistQuestionRef.fromItemId(o.id) : null;
                            return row(o.item, o.id, qRef);
                        });
                    if (list.length) groups.push({ code: str(main.mainClause), title: str(main.title), rows: list });
                });
            } else {
                const list = arr(cl.items)
                    .map(function (item, idx) { return { item: item, idx: idx }; })
                    .filter(function (o) { return !selective || allowedStr.indexOf(String(o.idx)) !== -1; })
                    .map(function (o) { return row(o.item, o.idx, null); });
                if (list.length) groups.push({ code: '', title: '', rows: list });
            }
            if (groups.length) out.push({ title: str(cl.name) || 'Checklist', groups: groups });
        });

        const custom = arr(r.customItems).map(function (item, idx) {
            return { key: 'custom-' + idx, checklistId: 'custom', itemIdx: idx, questionRef: null, clause: str(item && item.clause),
                requirement: requirementOf(item), progress: progress['custom-' + idx] || null };
        });
        if (custom.length) out.push({ title: 'Questions added during the audit', groups: [{ code: '', title: '', rows: custom }] });
        return out;
    }

    const RESULT = {
        conform: { label: 'Conforming', cls: 'cc-conform' },
        na: { label: 'Not applicable', cls: 'cc-na' },
        '': { label: 'Not assessed', cls: 'cc-open' }
    };

    function resultOf(row, findingByKey) {
        const p = row.progress || {};
        const s = str(p.status);
        if (s === 'nc') {
            const f = findingByKey[row.key];
            const fs = FS();
            const grade = f && fs ? fs.gradeLabel(f._cat.key) : 'Finding';
            return { html: (f ? '<b>' + t(f._ref) + '</b><br>' : '') + t(grade), cls: 'cc-' + ((f && f._cat.key) || 'pending'), key: f ? f._cat.key : 'pending' };
        }
        const r = RESULT[s] || RESULT[''];
        return { html: t(r.label), cls: r.cls, key: s || 'open' };
    }

    function notesOf(row, embedded) {
        const p = row.progress || {};
        const parts = [];
        const remark = clean(p.clientEvidenceStatement || p.comment);
        const statement = clean(p.ncrDescription);
        if (remark) parts.push('<div>' + t(remark) + '</div>');
        if (statement && statement.toLowerCase() !== remark.toLowerCase()) parts.push('<div><span class="cc-k">Finding:</span> ' + t(statement) + '</div>');
        const who = [str(p.personnel), str(p.designation)].filter(Boolean).join(', ');
        const where = [str(p.department), who].filter(Boolean).join(' · ');
        if (where) parts.push('<div class="cc-sub"><span class="cc-k">Interviewed:</span> ' + t(where) + '</div>');
        const images = Array.isArray(p.evidenceImages) ? p.evidenceImages.filter(Boolean).length : (p.evidenceImage ? 1 : 0);
        if (images) parts.push('<div class="cc-sub">' + images + ' screenshot' + (images === 1 ? '' : 's') + (embedded ? ' below' : ' on file') + '</div>');
        return parts.join('') || (p.status ? '' : '<span class="cc-none">—</span>');
    }

    /**
     * The screenshots of one question, two to a row, each row its own table
     * row so a page can break between them. Captioned with the question and
     * the capture date, so a loose page still says what it shows.
     */
    function screenshotRows(row, shots) {
        if (!shots.length) return '';
        const label = row.questionRef || row.clause || 'Question';
        let out = '';
        for (let i = 0; i < shots.length; i += 2) {
            const figs = shots.slice(i, i + 2).map(function (s, j) {
                return FS().shots.figure(label, s, i + j + 1, shots.length, 'cc-shot');
            }).join('');
            out += '<tr class="cc-ev-row"><td></td><td colspan="4"><div class="cc-ev">' + figs + '</div></td></tr>';
        }
        return out;
    }

    /**
     * @param {Object} ctx  FindingsSummary.context(...) plus { sections: rows(...), reportFinal,
     *                      images: { [row.key]: [{src, capturedAt}] } — omitted = counts only }
     */
    function build(ctx) {
        const c = ctx || {};
        const df = DF(); const shell = PS(); const fs = FS();
        const sections = arr(c.sections);
        const findingByKey = {};
        arr(c.findings).forEach(function (f) {
            if (f.source !== 'checklist') return;
            findingByKey[f.sourceChecklistId === 'custom' ? 'custom-' + f.sourceItemIdx : f.sourceChecklistId + '-' + f.sourceItemIdx] = f;
        });

        const counts = { total: 0, conform: 0, nc: 0, obs: 0, ofi: 0, na: 0, open: 0 };
        const body = sections.map(function (sec) {
            const groupHtml = sec.groups.map(function (g) {
                const trs = g.rows.map(function (row) {
                    const res = resultOf(row, findingByKey);
                    const shots = arr(c.images && c.images[row.key]);
                    counts.total++;
                    if (res.key === 'conform') counts.conform++;
                    else if (res.key === 'na') counts.na++;
                    else if (res.key === 'obs') counts.obs++;
                    else if (res.key === 'ofi') counts.ofi++;
                    else if (res.key === 'open') counts.open++;
                    else counts.nc++;
                    return '<tr>'
                        + '<td class="cc-q">' + t(row.questionRef || '') + '</td>'
                        + '<td class="cc-clause">' + t(row.clause || '') + '</td>'
                        + '<td>' + t(row.requirement || '') + '</td>'
                        + '<td class="cc-res ' + res.cls + '">' + res.html + '</td>'
                        + '<td class="cc-notes">' + notesOf(row, shots.length > 0) + '</td>'
                        + '</tr>'
                        + screenshotRows(row, shots);
                }).join('');
                const head = g.code || g.title
                    ? '<tr class="cc-group"><td colspan="5">' + t([g.code, g.title].filter(Boolean).join(' · ')) + '</td></tr>' : '';
                return head + trs;
            }).join('');
            return '<h2 class="fs-h2">' + t(sec.title) + '</h2>'
                + '<table class="cc-table"><colgroup><col style="width:13mm"><col style="width:17mm"><col><col style="width:27mm"><col style="width:36%"></colgroup>'
                + '<thead><tr><th>Q</th><th>Clause</th><th>Requirement</th><th>Result</th><th>Auditor notes and evidence</th></tr></thead>'
                + '<tbody>' + groupHtml + '</tbody></table>';
        }).join('');

        const brandName = str(c.brand && c.brand.name) || 'Audit360';
        const clientName = str(c.clientName) || 'Client';
        const asAt = df.formatDate(c.generatedOn || new Date()) || '';
        const status = c.reportFinal ? 'Audit completed' : 'Audit in progress';
        const assessed = counts.total - counts.open;

        const cell = function (n, label, cls) { return '<td class="' + (cls || '') + '"><div class="fs-n">' + n + '</div><div class="fs-n-label">' + t(label) + '</div></td>'; };
        const countTable = '<table class="fs-counts"><tr>'
            + cell(assessed + ' / ' + counts.total, 'Questions assessed')
            + cell(counts.conform, 'Conforming')
            + cell(counts.nc, 'Nonconformities', counts.nc ? 'fs-c-minor' : '')
            + cell(counts.obs, 'Observations')
            + cell(counts.ofi, 'Opportunities for improvement')
            + cell(counts.na, 'Not applicable')
            + '</tr></table>';

        const meta = fs ? fs.metaTableHtml(c, [{ label: 'Record status', html: t(status + ', as at ' + asAt) }]) : '';
        const signOff = '<div class="fs-signoff pd-keep"><div class="fs-sigs cc-sign">'
            + '<div class="fs-sig"><div class="fs-sig-line"><span>Lead auditor</span>' + (c.leadAuditor ? ' <b>' + t(c.leadAuditor) + '</b>' : '') + '</div>'
            + '<div class="fs-sig-line"><span>Signature</span></div><div class="fs-sig-line"><span>Date</span></div></div>'
            + '</div><p class="fs-intro" style="margin-top:6px">This checklist is the audit team\'s working record. The audit report is the formal record of the audit and takes precedence.</p></div>';

        return shell.buildDocument({
            title: 'Completed Audit Checklist - ' + plain(clientName),
            header: { left: brandName, center: plain(clientName), right: 'Completed checklist' + (c.auditRef ? ' · ' + plain(c.auditRef) : '') },
            footer: { left: c.classification ? plain(c.classification) : 'Record as at ' + asAt, center: status },
            bodyHtml: shell.masthead({ brandName: brandName, logoUrl: c.brand && c.brand.logoUrl, title: 'Completed Audit Checklist', subtitle: 'Questions, results and auditor notes · ' + status })
                + meta + countTable + (body || '<p class="fs-intro">No checklist questions are assigned to this audit.</p>') + signOff,
            extraCss: shell.MASTHEAD_CSS + '\n' + (fs ? fs.CSS : '') + '\n' + CSS
        });
    }

    const CSS = [
        '.cc-table{font-size:8.3pt;table-layout:fixed;margin-bottom:8px}',
        '.cc-table th{background:#0f2a43;color:#fff;text-align:left;font-weight:600;padding:4px 5px;font-size:7.8pt}',
        '.cc-table td{border-bottom:.5pt solid #e2e8f0;padding:4px 5px;vertical-align:top;overflow-wrap:anywhere}',
        '.cc-group td{background:#f1f5f9;font-weight:700;color:#0f2a43;border-bottom:.6pt solid #cbd5e1}',
        '.cc-q{font-weight:700;color:#334155;white-space:nowrap}',
        '.cc-clause{color:#334155}',
        '.cc-res{font-weight:600;font-size:7.8pt}',
        '.cc-conform{color:#047857}.cc-na{color:#64748b}.cc-open{color:#94a3b8;font-weight:400;font-style:italic}',
        '.cc-major{color:#b91c1c;background:#fef2f2}.cc-minor{color:#b45309;background:#fffbeb}.cc-pending{color:#475569;background:#f1f5f9}',
        '.cc-obs{color:#6d28d9;background:#f5f3ff}.cc-ofi{color:#0e7490;background:#ecfeff}',
        '.cc-notes div+div{margin-top:2px}',
        '.cc-sub{color:#64748b;font-size:7.6pt}',
        '.cc-k{font-weight:600;color:#475569}',
        '.cc-none{color:#cbd5e1}',
        '.fs-counts .fs-n{font-size:13pt}',
        '.cc-sign{margin-top:12px}.cc-sign .fs-sig{max-width:50%}',
        '.cc-ev-row td{border-bottom:.5pt solid #e2e8f0;padding-top:0}',
        '.cc-ev{display:flex;gap:4mm;align-items:flex-start}',
        '.cc-shot{margin:0;flex:0 0 calc(50% - 2mm);min-width:0}',
        '.cc-shot img{display:block;width:100%;max-height:105mm;object-fit:contain;border:.5pt solid #cbd5e1;background:#f8fafc}',
        '.cc-shot figcaption{font-size:7pt;color:#64748b;margin-top:1.5mm}'
    ].join('\n');

    // ── Browser glue ──────────────────────────────────────────────────

    function notify(msg, type) { if (typeof global.showNotification === 'function') global.showNotification(msg, type); }

    function keyedShots(sections) {
        const byKey = {};
        arr(sections).forEach(function (sec) {
            arr(sec.groups).forEach(function (g) {
                arr(g.rows).forEach(function (row) { const list = evidenceOf(row.progress); if (list.length) byKey[row.key] = list; });
            });
        });
        return byKey;
    }
    /** Downscaled screenshots per question key (kept for callers of the old API). */
    function prepareImages(sections) { return FS().shots.prepare(keyedShots(sections)); }

    global.printCompletedChecklist = function (reportId, opts) {
        const id = reportId && typeof reportId === 'object' ? (reportId.dataset && reportId.dataset.id) : reportId;
        if (!PS() || !FS() || !global.collectAuditFindings) {
            notify('The print module is not loaded. Reload the page and try again.', 'warning');
            return null;
        }
        // Answers typed in the last few seconds are still waiting for the
        // autosave; save them first so the print shows what is on screen.
        if (global.ChecklistAutoSave && global.ChecklistAutoSave.isPending && global.ChecklistAutoSave.isPending()) global.ChecklistAutoSave.flush();
        const s = global.state || {};
        const ctx = FS().context(id, s);
        if (!ctx) { notify('Audit report not found.', 'error'); return null; }
        const plan = arr(s.auditPlans).find(function (p) { return ctx.report.planId != null && String(p.id) === String(ctx.report.planId); }) || null;
        const checklists = arr(plan && plan.selectedChecklists)
            .map(function (cid) { return arr(s.checklists).find(function (c) { return String(c.id) === String(cid); }); })
            .filter(Boolean);
        ctx.sections = rows(ctx.report, plan, checklists);
        ctx.reportFinal = ctx.report.reportStatus === 'final';
        if (!ctx.sections.length) { notify('No checklist questions are assigned to this audit.', 'info'); return null; }
        return FS().shots.printWithShots('completed checklist', keyedShots(ctx.sections), function (images) {
            ctx.images = images || undefined;
            return build(ctx);
        }, 'CompletedChecklist', opts);
    };

    const API = { rows: rows, build: build, evidenceOf: evidenceOf, prepareImages: prepareImages };
    global.CompletedChecklist = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'completed-checklist.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);
