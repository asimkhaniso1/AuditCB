// Technical review of PC Connection's 2026 recertification report: the
// ISO/IEC 27001 Technical Audit Pack printed five tables of blank rows, each
// captioned "To be completed during audit", in an issued report. A formal
// report prints only what was recorded.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

describe('Technical Audit Pack prints only recorded tables', () => {
    beforeEach(() => {
        delete window.ReportFrameworks;
        loadScript('./audit-frameworks.js', { params: { module: undefined } });
        loadScript('./report-frameworks.js', { params: { module: undefined } });
    });

    const report27001 = (frameworkData) => ({ standard: 'ISO/IEC 27001:2022', frameworkData });

    it('leaves the pack out when no table has data', () => {
        expect(window.ReportFrameworks.sections({ report: report27001({}) })).toEqual([]);
        expect(window.ReportFrameworks.sections({ report: report27001({ isAssetInventory: [] }) })).toEqual([]);
    });

    it('prints a recorded table and omits the empty ones', () => {
        const defs = window.AuditFrameworks.packBlockDefs;
        const cols = defs.isAssetInventory.columns;
        const row = {};
        row[cols[0]] = 'CRM database';
        const out = window.ReportFrameworks.sections({ report: report27001({ isAssetInventory: [row] }) });
        expect(out).toHaveLength(1);
        const html = out[0].bodyHtml;
        expect(html).toContain('CRM database');
        expect(html).toContain(defs.isAssetInventory.title);
        expect(html).not.toContain(defs.isAccessControl.title);
        expect(html).not.toContain('To be completed during audit');
    });
});
