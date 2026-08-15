import { describe, it, expect } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditReports: [] };
window.ReportExecutive = { icon: () => '', bigFourCss: () => '' };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./report-risk.js'), 'utf8');
eval(src);

describe('ReportRisk theme classification', () => {
    it('classifies an internal-audit finding to an internal-audit/monitoring theme, not resource-and-competence, even when its clause id falls under the "7.x" bucket', () => {
        const theme = window.ReportRisk.classifyTheme(
            'Internal audits were not conducted at the planned intervals required by the audit programme',
            '7.2'
        );
        expect(theme.theme).toMatch(/internal audit|monitoring/i);
        expect(theme.theme).not.toBe('resource and competence management');
    });

    it('scoreFinding root-causes an internal-audit finding (CL-21 style) with an internal-audit theme, not resource-and-competence', () => {
        const finding = {
            ref: 'CL-21',
            clause: '7.2',
            ncrType: 'Major',
            text: 'The organization has not implemented an internal audit programme; no internal audits have been conducted this cycle.'
        };
        const scored = window.ReportRisk.scoreFinding(finding);
        expect(scored).toBeTruthy();
        expect(scored.rootCause.rootCause).toMatch(/internal audit|monitoring/i);
        expect(scored.rootCause.rootCause).not.toMatch(/resource and competence management/i);
    });

    it('falls back to the clause-number table when the finding text is empty', () => {
        const theme = window.ReportRisk.classifyTheme('', '7.2');
        expect(theme.theme).toBe('resource and competence management');
    });

    it('falls back to the clause-number table when the finding text is uninformative (no keyword match)', () => {
        const theme = window.ReportRisk.classifyTheme('Not done.', '9.1');
        expect(theme.theme).toBe('performance evaluation and monitoring');
    });

    it('keeps CLAUSE_THEMES available as the fallback table (not deleted)', () => {
        expect(Array.isArray(window.ReportRisk.CLAUSE_THEMES)).toBe(true);
        expect(window.ReportRisk.CLAUSE_THEMES.some((t) => t.theme === 'resource and competence management')).toBe(true);
    });

    it('still classifies a genuine competence/training finding as resource-and-competence', () => {
        const theme = window.ReportRisk.classifyTheme(
            'Training records show operators lack the required competence certifications',
            '7.2'
        );
        expect(theme.theme).toBe('resource and competence management');
    });

    it('scoreFinding only scores real major/minor non-conformities (unchanged contract)', () => {
        expect(window.ReportRisk.scoreFinding({ clause: '9.2', ncrType: 'Observation', text: 'Internal audit note' })).toBeNull();
    });
});
