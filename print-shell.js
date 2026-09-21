// ============================================
// PRINT SHELL  (window.PrintShell)
// ============================================
// The one place a controlled, printable A4 document is assembled. Used by the
// audit plan and the audit checklist so neither can drift back to browser
// defaults.
//
// WHAT WAS WRONG
// --------------
// Both documents were opened in a blank popup and printed with no page rules,
// so the browser drew its own header (date, document title) and footer
// ("about:blank", "1/6") on every page — evidence that nothing controlled the
// page. The plan also carried an IN-FLOW footer reading "Page 1 of 1". A
// browser cannot know the final page count while laying out flow content, so
// that text was a constant; and being in flow at the end of the document, it
// spilled onto a sixth, almost empty, page.
//
// HOW IT IS FIXED
// ---------------
// Running headers and footers are CSS page-margin boxes (@top-left,
// @bottom-right …) with counter(page) and counter(pages). Measured in Chrome
// 153 with the print dialog's default "Headers and footers" ON: defining margin
// boxes makes the browser drop its own decoration entirely, and the count is
// computed by the print engine from the real layout, so "Page X of Y" is
// always true. Nothing about the page count is written by us, and there is no
// footer element in the flow to overflow onto a new page.
//
// CONTRACT
//   PrintShell.buildDocument(opts)  -> full HTML string
//   PrintShell.masthead(opts)       -> HTML for a document's title block
//   PrintShell.lint(html)           -> [{code, message}]  static defects (empty = clean)
//   PrintShell.open(html, opts)     -> Window|null   (browser only)

(function (global) {
    'use strict';

    const DF = function () { return global.DocFormat || (typeof require === 'function' ? require('./doc-format.js') : null); };

    function esc(v) {
        const d = DF();
        return d ? d.escapeHtml(v) : String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** A value safe inside a CSS string literal: quotes, backslashes and newlines neutralised. */
    function cssString(v) {
        return '"' + String(v == null ? '' : v)
            .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')
            .replace(/</g, '\\3C ') + '"';
    }

    /** Trim a header/footer string so a margin box never wraps or clips mid-glyph. */
    function fit(text, max) {
        const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
        return s.length > max ? s.slice(0, Math.max(0, max - 1)).trimEnd() + '\u2026' : s;
    }

    const BASE_CSS = [
        '*{box-sizing:border-box}',
        'html{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
        'body{margin:0;padding:0;font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;color:#1e293b;font-size:9.5pt;line-height:1.45;background:#fff}',
        // On screen the popup is a preview: give it a page-like column.
        '@media screen{body{max-width:190mm;margin:0 auto;padding:12mm 8mm}}',
        '.print-bar{text-align:right;margin-bottom:10px}',
        '.print-bar button{padding:9px 24px;cursor:pointer;background:#0f2a43;color:#fff;border:0;border-radius:6px;font-weight:600;font-size:13px}',
        '@media print{.print-bar{display:none !important}}',
        // Pagination rules shared by every document.
        'h1,h2,h3,h4,.pd-section-title{break-after:avoid;page-break-after:avoid}',
        'thead{display:table-header-group}',
        'tr,.pd-keep{break-inside:avoid;page-break-inside:avoid}',
        'table{border-collapse:collapse;width:100%}',
        'p,li{orphans:3;widows:3}',
        'img{max-width:100%}',
        // Nothing may add height after the last real element.
        'body>*:last-child{margin-bottom:0 !important}'
    ].join('\n');

    /**
     * @param {Object} o
     * @param {string} o.title            document.title — becomes the default PDF file name; never printed
     * @param {string} o.bodyHtml
     * @param {string} [o.extraCss]
     * @param {Object} o.header           { left, center, right }
     * @param {Object} o.footer           { left, center }   (right is always "Page X of Y")
     * @param {number} [o.marginTopMm=22] @param {number} [o.marginBottomMm=20] @param {number} [o.marginSideMm=14]
     * @param {boolean} [o.printBar=true]
     * @param {boolean} [o.landscape=false] wide tables (the internal traceability matrix)
     */
    function buildDocument(o) {
        const opt = o || {};
        const h = opt.header || {};
        const f = opt.footer || {};
        const top = opt.marginTopMm || 22;
        const bottom = opt.marginBottomMm || 20;
        const side = opt.marginSideMm || 14;
        const box = 'font:7.5pt "Segoe UI","Helvetica Neue",Arial,sans-serif;color:#475569;';
        const rule = 'border-bottom:0.5pt solid #94a3b8;padding-bottom:2.2mm;';
        const ruleTop = 'border-top:0.5pt solid #94a3b8;padding-top:2.2mm;';

        const page = [
            '@page{size:A4' + (opt.landscape ? ' landscape' : '') + ';margin:' + top + 'mm ' + side + 'mm ' + bottom + 'mm ' + side + 'mm;',
            '  @top-left{content:' + cssString(fit(h.left, 46)) + ';' + box + rule + 'vertical-align:bottom;font-weight:700;color:#0f2a43;width:34%}',
            '  @top-center{content:' + cssString(fit(h.center, 44)) + ';' + box + rule + 'vertical-align:bottom;text-align:center;width:32%}',
            '  @top-right{content:' + cssString(fit(h.right, 44)) + ';' + box + rule + 'vertical-align:bottom;text-align:right;width:34%}',
            // Same 34/32/34 split as the header: the three boxes then abut, so the
            // rule above the footer is one continuous line rather than segments.
            '  @bottom-left{content:' + cssString(fit(f.left, 56)) + ';' + box + ruleTop + 'vertical-align:top;width:34%}',
            '  @bottom-center{content:' + cssString(fit(f.center, 44)) + ';' + box + ruleTop + 'vertical-align:top;text-align:center;width:32%}',
            '  @bottom-right{content:"Page " counter(page) " of " counter(pages);' + box + ruleTop + 'vertical-align:top;text-align:right;font-weight:700;color:#0f2a43;width:34%}',
            '}'
        ].join('\n');

        return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">'
            + '<meta name="viewport" content="width=device-width, initial-scale=1">'
            + '<title>' + esc(opt.title || 'Document') + '</title>'
            + '<style>\n' + page + '\n' + BASE_CSS + '\n' + (opt.extraCss || '') + '\n</style></head><body>'
            + (opt.printBar === false ? '' : '<div class="print-bar"><button type="button" data-action="print" data-print="1">Print / Save PDF</button></div>')
            + (opt.bodyHtml || '')
            + '</body></html>';
    }

    /**
     * The title block at the head of a document: brand, title, reference and a
     * QR code whose payload carries a verification URL only — no client name,
     * so nothing identifying is sent to the QR image service.
     */
    function masthead(o) {
        const m = o || {};
        return '<div class="pd-masthead">'
            + '<div class="pd-mast-left">'
            + (m.logoUrl ? '<img class="pd-logo" src="' + esc(m.logoUrl) + '" alt="' + esc(m.brandName || '') + '">' : '')
            + '<div class="pd-brand">' + esc(m.brandName || '') + '</div>'
            + '<h1 class="pd-title">' + esc(m.title || '') + '</h1>'
            + (m.subtitle ? '<div class="pd-subtitle">' + esc(m.subtitle) + '</div>' : '')
            + '</div>'
            + (m.qrUrl ? '<div class="pd-mast-right"><img class="pd-qr" src="' + esc(m.qrUrl) + '" alt="Verification QR code"></div>' : '')
            + '</div>';
    }

    const MASTHEAD_CSS = [
        '.pd-masthead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-top:3mm;padding-bottom:9px;margin-bottom:12px;border-bottom:2.2pt solid #0f2a43}',
        '.pd-logo{max-height:34px;max-width:170px;object-fit:contain;display:block;margin-bottom:5px}',
        '.pd-brand{font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:600}',
        '.pd-title{margin:2px 0 3px;font-size:17pt;line-height:1.2;color:#0f172a}',
        '.pd-subtitle{font-size:9.5pt;color:#475569}',
        '.pd-qr{width:70px;height:70px;border:.5pt solid #cbd5e1;border-radius:4px}'
    ].join('\n');

    /**
     * Static checks on a document about to be printed. These are the defects
     * that shipped: they can be found without a browser, so they fail a test
     * (and the issue gate) rather than a client's PDF.
     */
    function lint(html) {
        const s = String(html == null ? '' : html);
        const problems = [];
        const add = function (code, message) { problems.push({ code: code, message: message }); };
        const dfm = DF();

        if (!/@page\s*\{/.test(s)) add('NO_PAGE_RULE', 'No @page rule: the browser will choose its own margins and decorations.');
        if (!/counter\(page\)/.test(s) || !/counter\(pages\)/.test(s)) {
            add('NO_PAGE_COUNTER', 'The footer does not use counter(page) and counter(pages); "Page X of Y" cannot be accurate.');
        }
        const body = s.replace(/<style[\s\S]*?<\/style>/gi, '');
        if (/\bPage\s+\d+\s+of\s+\d+\b/i.test(body)) add('STATIC_PAGE_NUMBER', 'A fixed "Page N of M" string is in the document body.');
        if (/position\s*:\s*fixed/i.test(s)) add('FIXED_FOOTER', 'position:fixed elements repeat unpredictably in print and can overlap content.');
        if (/<script\b/i.test(s)) add('INLINE_SCRIPT', 'Inline <script> is blocked by the site CSP and cannot be relied on to print.');
        if (/<title>[^<]*about:blank/i.test(s)) add('TITLE_ARTIFACT', 'The document title is a browser placeholder.');
        if (/min-height\s*:\s*100vh/i.test(s)) add('VIEWPORT_HEIGHT', 'min-height:100vh forces an extra page when combined with print margins.');
        if (/class="[^"]*\b(?:footer|doc-footer)\b[^"]*"/i.test(body)) add('FLOW_FOOTER', 'A footer element is in the document flow; it will trail onto a blank page.');
        if (dfm) {
            const text = dfm.renderedText(s);
            const entities = dfm.findRawEntities(text);
            if (entities.length) add('RAW_ENTITY', 'Raw HTML entit' + (entities.length > 1 ? 'ies' : 'y') + ' would print literally: ' + entities.slice(0, 5).join(' '));
            const dates = dfm.findUnwrittenDates(text);
            if (dates.length) add('UNWRITTEN_DATE', 'Numeric date' + (dates.length > 1 ? 's' : '') + ' in client-facing text: ' + dates.slice(0, 5).map(function (d) { return d.text; }).join(', '));
            const art = dfm.findBrowserArtifacts(text);
            if (art.length) add('BROWSER_ARTIFACT', 'Browser print decoration text present: ' + art.join(', '));
        }
        return problems;
    }

    /**
     * Open the document in a preview window. Browser only. The Print button is
     * wired from HERE — the popup cannot carry a script of its own under the
     * site CSP — and printing waits for images (QR, logo) so they are not
     * missing from the PDF.
     */
    function open(html, opts) {
        const o = opts || {};
        const win = global.open('', '_blank');
        if (!win) return null;
        win.document.write(html);
        win.document.close();
        const pendingImages = function () {
            return Array.prototype.slice.call(win.document.images || []).filter(function (img) { return !img.complete; });
        };
        const doPrint = function () {
            try { win.focus(); } catch (_e) { /* best effort */ }
            win.print();
        };
        // Wait for the QR code and logo so they are not missing from the PDF —
        // but do not defer when there is nothing to wait for.
        const print = function () {
            const pending = pendingImages();
            if (!pending.length) { doPrint(); return; }
            Promise.all(pending.map(function (img) {
                return new Promise(function (resolve) {
                    img.addEventListener('load', resolve, { once: true });
                    img.addEventListener('error', resolve, { once: true });
                });
            })).then(doPrint);
        };
        const wire = function () {
            const btn = win.document.querySelector('[data-action="print"]');
            if (!btn) return false;
            btn.addEventListener('click', function (e) { e.preventDefault(); print(); });
            return true;
        };
        if (!wire()) win.addEventListener('load', wire);
        if (o.autoPrint) print();
        return win;
    }

    const API = { buildDocument, masthead, MASTHEAD_CSS, BASE_CSS, cssString, fit, lint, open };
    global.PrintShell = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'print-shell.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);
