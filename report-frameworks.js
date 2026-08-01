// ============================================
// REPORT FRAMEWORKS MODULE  (window.ReportFrameworks)
// ============================================
// Standalone add-on for AuditCB-360's audit report builder.
// Does NOT modify any existing file — pure additive module.
// Depends on window.AuditFrameworks (audit-frameworks.js) for data; renders using the
// same b4-* design system consumed by report-executive.js / report-scoring.js.
//
// CONTRACT:
//   window.ReportFrameworks.sections(d)               -> sync, [{key,name,desc,color,bodyHtml,charts}]
//                                                          returns [] when no framework matches d.report/d.auditPlan
//   window.ReportFrameworks.sectionsPreviewToggles()   -> [{id,label,icon,color}]
//
// DATA SHAPE ASSUMED:
//   d.report                       {standard, audit_type|auditType, frameworkData?{[blockId]: Array<object>}, ...}
//   d.auditPlan                    {standard, ...}
//
// Defensive coding: sync, pure, never throws; tolerates missing/partial `d`.

(function (global) {
    'use strict';

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const safeArr = (a) => Array.isArray(a) ? a : [];

    function renderRow(row, columns) {
        // row is an object keyed loosely by column name/index; we render values positionally.
        const values = Array.isArray(row)
            ? row
            : columns.map((col) => {
                if (row && Object.prototype.hasOwnProperty.call(row, col)) return row[col];
                // fallback: try a loose key match (case/space-insensitive)
                if (row) {
                    const key = Object.keys(row).find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === col.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    if (key) return row[key];
                }
                return '';
            });
        return `<tr>${values.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`;
    }

    function renderEmptyRows(colCount, n) {
        const cells = Array.from({ length: colCount }, () => '<td>&nbsp;</td>').join('');
        return Array.from({ length: n }, () => `<tr>${cells}</tr>`).join('');
    }

    function renderBlock(blockId, def, dataForBlock) {
        if (!def) return '';
        const cols = def.columns || [];
        const theadHtml = `<thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`;

        const rows = safeArr(dataForBlock);
        let bodyRows, footer;
        if (rows.length) {
            bodyRows = rows.map((r) => renderRow(r, cols)).join('');
            footer = '';
        } else {
            bodyRows = renderEmptyRows(cols.length, 4);
            footer = `<div class="b4-caption">To be completed during audit</div>` +
                (def.hint ? `<div class="b4-caption">${esc(def.hint)}</div>` : '');
        }

        return `
        <div class="b4-eyebrow">${esc(def.title || blockId)}</div>
        <table class="b4-tbl">
            ${theadHtml}
            <tbody>${bodyRows}</tbody>
        </table>
        ${footer}`;
    }

    function sections(d) {
        try {
            if (!global.AuditFrameworks || typeof global.AuditFrameworks.resolve !== 'function') return [];

            const report = (d && d.report) || {};
            const auditPlan = (d && d.auditPlan) || {};

            const matched = global.AuditFrameworks.resolve(report, auditPlan);
            if (!matched || !matched.length) return [];

            const blockIds = [];
            const seenBlocks = new Set();
            matched.forEach((fw) => {
                safeArr(fw.packSections).forEach((bId) => {
                    if (!seenBlocks.has(bId)) { seenBlocks.add(bId); blockIds.push(bId); }
                });
            });

            if (!blockIds.length) return [];

            const packBlockDefs = global.AuditFrameworks.packBlockDefs || {};
            const frameworkData = (report && report.frameworkData) || {};

            const label = matched.map((fw) => fw.label).join(' / ');
            const blocksHtml = blockIds.map((bId) => renderBlock(bId, packBlockDefs[bId], frameworkData[bId])).join('<div style="height:var(--b4-s5);"></div>');

            const bodyHtml = `<div class="b4-caption" style="margin-bottom:var(--b4-s4);">Framework-specific evidence tables applicable to this audit's scope: ${esc(label)}.</div>${blocksHtml}`;

            return [{
                key: 'fwPack',
                name: `${label} — TECHNICAL AUDIT PACK`.toUpperCase(),
                desc: 'Framework-specific technical evidence tables applicable to the audited scope',
                color: '#0f2a43',
                bodyHtml,
                charts: []
            }];
        } catch (e) {
            return [];
        }
    }

    function sectionsPreviewToggles() {
        return [
            { id: 'fwPack', label: 'Technical Audit Pack', icon: 'fa-solid fa-layer-group', color: '#0f2a43' }
        ];
    }

    global.ReportFrameworks = { sections, sectionsPreviewToggles };
})(window);
