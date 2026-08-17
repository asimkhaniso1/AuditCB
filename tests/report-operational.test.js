import { describe, it, expect } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditReports: [] };
window.ReportExecutive = { icon: () => '', bigFourCss: () => '' };

const fs = await import('fs');
const path = await import('path');
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
