import { describe, it, expect } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditReports: [] };
window.ReportExecutive = { icon: () => '', bigFourCss: () => '' };

const fs = await import('fs');
const path = await import('path');
// report-stats.js loaded first — report-operational.js's canonicalStats()
// prefers window.ReportStats.build() (the canonical single source) the same
// way report-executive.js's getStats() does, falling back to legacy d.stats
// only if ReportStats never loaded.
eval(fs.readFileSync(path.resolve('./report-stats.js'), 'utf8'));
const src = fs.readFileSync(path.resolve('./report-operational.js'), 'utf8');
eval(src);

function opsSection(key, d) {
    const secs = window.ReportOperational.sections(d);
    return secs.find((s) => s.key === key);
}

describe('ReportOperational — empty-column suppression', () => {
    it('drops the Role/Organization columns from the attendance register when every attendee has neither', () => {
        const d = {
            report: {
                openingMeeting: { date: '2026-01-05', attendees: ['Alice Auditor', 'Bob Buyer'] }
            }
        };
        const sec = opsSection('opsAttendance', d);
        expect(sec).toBeTruthy();
        expect(sec.bodyHtml).toContain('<th>Name</th>');
        expect(sec.bodyHtml).not.toContain('<th>Role</th>');
        expect(sec.bodyHtml).not.toContain('<th>Organization</th>');
        expect(sec.bodyHtml).toContain('Alice Auditor');
    });

    it('keeps the Role/Organization columns when at least one attendee has a value recorded', () => {
        const d = {
            report: {
                openingMeeting: {
                    date: '2026-01-05',
                    attendees: [
                        { name: 'Alice Auditor', role: 'Lead Auditor', organization: 'Audit360' },
                        { name: 'Bob Buyer', role: '', organization: '' }
                    ]
                }
            }
        };
        const sec = opsSection('opsAttendance', d);
        expect(sec.bodyHtml).toContain('<th>Role</th>');
        expect(sec.bodyHtml).toContain('<th>Organization</th>');
        expect(sec.bodyHtml).toContain('Lead Auditor');
    });

    it('the "No attendees recorded" placeholder row still spans the full (unsuppressed) column count', () => {
        const d = { report: { openingMeeting: { date: '2026-01-05', notes: 'Meeting held, no formal sign-in.' } } };
        const sec = opsSection('opsAttendance', d);
        expect(sec.bodyHtml).toContain('colspan="3"');
        expect(sec.bodyHtml).toContain('No attendees recorded');
    });

    it('coverage matrix renders normally (no spurious suppression of numeric/badge columns)', () => {
        const d = {
            hydratedProgress: [
                { status: 'conform', clause: '8.5', department: 'Production' },
                { status: 'nc', ncrType: 'minor', clause: '9.2', department: 'Quality', comment: 'gap noted' }
            ]
        };
        const sec = opsSection('opsCoverage', d);
        expect(sec).toBeTruthy();
        expect(sec.bodyHtml).toContain('Process / Department');
        expect(sec.bodyHtml).toContain('Items Applicable');
        expect(sec.bodyHtml).toContain('Result');
    });
});

// Task B: "Findings Raised" is a headline count and must never drift from
// the canonical ReportStats dataset the rest of the report reads (Executive
// Summary, Management System Effectiveness, Certification Recommendation).
describe('ReportOperational — Sampling Summary "Findings Raised" reads the canonical count', () => {
    const progress = () => [
        { status: 'nc', ncrType: 'minor', clause: '9.2', department: 'Quality' },
        { status: 'nc', ncrType: 'minor', clause: '7.2', department: 'Human Resources' },
        { status: 'nc', ncrType: 'observation', clause: '8.1', department: 'Production' },
        { status: 'nc', ncrType: 'observation', clause: '8.4', department: 'Purchasing' },
        { status: 'nc', ncrType: 'ofi', clause: '6.1', department: 'Quality' },
        { status: 'conform', clause: '4.1', department: 'Management' }
    ];

    function findingsRaisedValue(bodyHtml) {
        const m = bodyHtml.match(/<div class="b4-kpi-value">(\d+)<\/div><div class="b4-kpi-label">Findings Raised<\/div>/);
        return m ? Number(m[1]) : null;
    }

    it('counts major+minor NCs only — Observations and OFIs (also status:\'nc\') are never folded in', () => {
        // No d.stats supplied at all — canonicalStats() must fall through to
        // window.ReportStats.build(), not the old "count every status==='nc'
        // item" fallback, which would have read 4 here (2 NC + 1 Obs + 1 OFI)
        // instead of the correct 2.
        const d = { hydratedProgress: progress(), report: { checklistProgress: progress() } };
        const sec = opsSection('opsSampling', d);
        expect(sec).toBeTruthy();
        expect(findingsRaisedValue(sec.bodyHtml)).toBe(2);
    });

    it('a stale legacy d.stats never overrides the canonical figure', () => {
        const d = { hydratedProgress: progress(), report: { checklistProgress: progress() }, stats: { majorNC: 9, minorNC: 9 } };
        const sec = opsSection('opsSampling', d);
        expect(findingsRaisedValue(sec.bodyHtml)).toBe(2);
    });
});
