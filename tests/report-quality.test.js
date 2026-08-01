import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [] };
window.ReportExecutive = { icon: () => '', bigFourCss: () => '' };

const fs = await import('fs');
const path = await import('path');

function loadModule(file) {
    const src = fs.readFileSync(path.resolve(file), 'utf8');
    eval(src);
}

loadModule('./report-stats.js');
loadModule('./report-findings-ops.js');
loadModule('./report-operational.js');

function checklistItem(overrides) {
    return Object.assign({
        clause: '8.5',
        department: 'Production',
        status: 'conform',
        requirement: 'Verify process control records are maintained',
        comment: ''
    }, overrides);
}

function buildD(hydratedProgress, extra) {
    return Object.assign({
        report: { id: 'r1', planId: 'plan-1', ncrs: [] },
        hydratedProgress,
        auditPlan: { id: 'plan-1' },
        client: {},
        stats: {}
    }, extra);
}

describe('Report quality — findings-ops + operational sections', () => {
    beforeEach(() => {
        window.state = { ncrs: [] };
    });

    it('findingLifecycle excludes advisories, includes majors', () => {
        const hydratedProgress = [
            checklistItem({ clause: '4.1', status: 'nc', ncrType: 'observation', comment: 'OBSERVATION_COMMENT_TEXT' }),
            checklistItem({ clause: '4.2', status: 'nc', ncrType: 'ofi', comment: 'OFI_COMMENT_TEXT' }),
            checklistItem({ clause: '8.5', status: 'nc', ncrType: 'major', comment: 'MAJOR_COMMENT_TEXT' })
        ];
        const d = buildD(hydratedProgress);
        const sections = window.ReportFindingsOps.sections(d);
        const lifecycle = sections.find((s) => s.key === 'findingLifecycle');
        expect(lifecycle).toBeDefined();
        expect(lifecycle.bodyHtml).not.toContain('OBSERVATION_COMMENT_TEXT');
        expect(lifecycle.bodyHtml).not.toContain('OFI_COMMENT_TEXT');
        expect(lifecycle.bodyHtml).toContain('8.5');
    });

    describe('carForms', () => {
        it('emits one page-break-before block per major/minor NC', () => {
            const hydratedProgress = [
                checklistItem({ clause: '8.5', status: 'nc', ncrType: 'major' }),
                checklistItem({ clause: '9.2', status: 'nc', ncrType: 'minor' })
            ];
            const d = buildD(hydratedProgress);
            const sections = window.ReportFindingsOps.sections(d);
            const carForms = sections.find((s) => s.key === 'carForms');
            expect(carForms).toBeDefined();
            const matches = carForms.bodyHtml.match(/page-break-before/g) || [];
            expect(matches.length).toBe(2);
        });

        it('produces no carForms section when there are zero NCs', () => {
            const hydratedProgress = [checklistItem({ status: 'conform' })];
            const d = buildD(hydratedProgress);
            const sections = window.ReportFindingsOps.sections(d);
            expect(sections.find((s) => s.key === 'carForms')).toBeUndefined();
        });

        it('observations never produce a CAR form', () => {
            const hydratedProgress = [checklistItem({ status: 'nc', ncrType: 'observation' })];
            const d = buildD(hydratedProgress);
            const sections = window.ReportFindingsOps.sections(d);
            expect(sections.find((s) => s.key === 'carForms')).toBeUndefined();
        });

        it('contains no <img> tags (logo removed in Stage 3)', () => {
            const hydratedProgress = [checklistItem({ status: 'nc', ncrType: 'major' })];
            const d = buildD(hydratedProgress);
            const sections = window.ReportFindingsOps.sections(d);
            const carForms = sections.find((s) => s.key === 'carForms');
            expect(carForms).toBeDefined();
            expect(carForms.bodyHtml).not.toMatch(/<img/i);
        });
    });

    it('evidenceTrace prefers evidenceThumbs over evidenceImages when both present', () => {
        const thumbUrl = 'data:image/png;base64,THUMBDATA';
        const fullUrl = 'data:image/png;base64,FULLDATA';
        const hydratedProgress = [
            checklistItem({
                status: 'nc',
                ncrType: 'major',
                evidenceThumbs: [thumbUrl],
                evidenceImages: [fullUrl]
            })
        ];
        const d = buildD(hydratedProgress);
        const sections = window.ReportFindingsOps.sections(d);
        const evidence = sections.find((s) => s.key === 'evidenceTrace');
        expect(evidence).toBeDefined();
        expect(evidence.bodyHtml).toContain(thumbUrl);
        expect(evidence.bodyHtml).not.toContain(fullUrl);
    });

    it('opsCoverage bodyHtml contains grayscale result symbols', () => {
        const hydratedProgress = [
            checklistItem({ clause: '8.5', status: 'conform' }),
            checklistItem({ clause: '9.2', status: 'nc', ncrType: 'major' }),
            checklistItem({ clause: '9.3', status: 'nc', ncrType: 'minor' })
        ];
        const d = buildD(hydratedProgress);
        const sections = window.ReportOperational.sections(d);
        const coverage = sections.find((s) => s.key === 'opsCoverage');
        expect(coverage).toBeDefined();
        const hasSymbol = /✓|✕|!/.test(coverage.bodyHtml);
        expect(hasSymbol).toBe(true);
    });

    describe('sections never throw and drop cleanly', () => {
        it('empty hydratedProgress returns an array of well-formed sections without throwing', () => {
            const d = buildD([]);
            expect(() => window.ReportFindingsOps.sections(d)).not.toThrow();
            expect(() => window.ReportOperational.sections(d)).not.toThrow();

            const findingsSections = window.ReportFindingsOps.sections(d);
            const opsSections = window.ReportOperational.sections(d);
            expect(Array.isArray(findingsSections)).toBe(true);
            expect(Array.isArray(opsSections)).toBe(true);

            [...findingsSections, ...opsSections].forEach((s) => {
                expect(s).toHaveProperty('key');
                expect(s).toHaveProperty('name');
                expect(s).toHaveProperty('bodyHtml');
            });
        });

        it('handles malformed/null-ish d gracefully', () => {
            expect(() => window.ReportFindingsOps.sections({})).not.toThrow();
            expect(() => window.ReportOperational.sections({})).not.toThrow();
            expect(() => window.ReportFindingsOps.sections(null)).not.toThrow();
            expect(() => window.ReportOperational.sections(null)).not.toThrow();
        });
    });
});
