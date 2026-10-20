import { describe, it, expect, beforeAll } from 'vitest';
import { buildScenario, M } from '../tools/pcc-scenario.mjs';

// Layout of the client-facing audit plan: section order, the per-day agenda
// tables and the key that replaces values every row used to repeat. None of
// this may change what the plan says — only where and how often it says it.
const { DF, PD } = M;
const clone = (o) => JSON.parse(JSON.stringify(o));
const text = (html) => DF.renderedText(html).replace(/\s+/g, ' ');
const sectionTitles = (html) => [...html.matchAll(/<div class="pd-section-title"><span class="no">(\d+)<\/span>([^<]+)<\/div>/g)].map(m => m[1] + ' ' + DF.decodeEntities(m[2]));

let base;
beforeAll(async () => { base = await buildScenario(); });

describe('client audit plan layout', () => {
    it('puts objectives, scope and criteria, team, and methodology before the agenda', () => {
        expect(sectionTitles(base.html)).toEqual([
            '1 AUDIT OBJECTIVES', '2 AUDIT SCOPE & CRITERIA', '3 AUDIT TEAM, SITES & DURATION', '4 AUDIT METHODOLOGY', '5 AUDIT AGENDA / ITINERARY'
        ]);
        const at = (s) => base.html.indexOf(s);
        expect(at('class="meta-table"')).toBeLessThan(at('AUDIT OBJECTIVES'));
        expect(at('Certified scope')).toBeLessThan(at('Audit criteria'));
        expect(at('AUDIT METHODOLOGY')).toBeLessThan(at('class="grid agenda"'));
    });

    it('prints one agenda table per day, each headed by its day and date', () => {
        const days = [...new Set(base.plan.agenda.map(r => r.day))];
        const tables = base.html.match(/<table class="grid agenda">/g) || [];
        expect(tables).toHaveLength(days.length);
        const bands = [...base.html.matchAll(/<tr class="dayband"><th colspan="\d">([^<]+)<span class="dd">([^<]+)<\/span>/g)].map(m => m[1] + ' ' + m[2]);
        expect(bands[0]).toBe('Day 1 ' + DF.weekdayName(base.plan.agenda[0].date) + ' ' + DF.formatDate(base.plan.agenda[0].date));
        // The day band sits in the thead, so it repeats with the column headings on a continuation page.
        expect(base.html).toMatch(/<thead><tr class="dayband">[\s\S]*?<th>Time<\/th>[\s\S]*?<\/thead>/);
    });

    it('keeps every agenda value: time, activity, requirements and auditee', () => {
        const t = text(base.html);
        base.plan.agenda.forEach(r => {
            expect(t).toContain(r.start + '–' + r.end);
            expect(t).toContain(DF.decodeEntities(r.item));
            expect(t).toContain(DF.decodeEntities(r.dept));
            M.IPI.describeStandards(r.standards, {}).forEach(x => expect(t).toContain(x.standards.join(' · ') + ' ' + x.text));
        });
    });

    it('names a sole auditor once instead of on every row', () => {
        expect(base.html).not.toMatch(/<td class="who">/);
        expect(text(base.html)).toContain('Auditor: every session is conducted by Muhammad Asim Khan (Lead Auditor).');
    });

    it('gives each auditor a short identifier, with a legend, when sessions are shared', () => {
        const plan = clone(base.plan);
        let i = 0;
        plan.agenda.forEach(r => { if (r.kind === 'session') r.auditor = (i++ % 2) ? 'Sarah Thompson' : 'Muhammad Asim Khan'; });
        const assigned = base.ctx.assigned.concat([{ name: 'Sarah Thompson', role: 'Auditor' }]);
        const html = PD.build(plan, Object.assign({}, base.ctx, { assigned }));
        expect(text(html)).toContain('Auditors: MAK = Muhammad Asim Khan (Lead Auditor) · ST = Sarah Thompson (Auditor)');
        expect(html).toContain('<td class="who">ST</td>');
        expect(html).toContain('<td class="who">MAK</td>');
        expect(html).toContain('<td class="who">N/A</td>'); // lunch
    });

    it('marks meetings, lunch and auditor-only time apart from the sessions', () => {
        expect(base.html).toMatch(/<tr class="marker"><td class="time">[^<]+<\/td><td><b>Opening meeting/);
        expect(base.html).toMatch(/<tr class="marker"><td class="time">[^<]+<\/td><td><b>Closing meeting/);
        expect(base.html).toMatch(/<tr class="lunch"><td class="time">[^<]+<\/td><td colspan="2">Lunch break<\/td>/);
        expect(base.html).toMatch(/<tr class="consol">[\s\S]*?<span class="tag">Auditor only<\/span>/);
    });

    it('stays free of static page numbers and print defects', () => {
        expect(M.PS.lint(base.html)).toEqual([]);
    });
});

describe('time zone labels', () => {
    it('labels the UK in winter and summer by name, without a doubled offset', () => {
        expect(DF.describeTimeZone('Europe/London', '2026-11-05').label).toBe('Greenwich Mean Time (GMT, UTC+00:00)');
        expect(DF.describeTimeZone('Europe/London', '2026-07-06').label).toBe('British Summer Time (BST, UTC+01:00)');
    });
    it('writes a zero offset as UTC+00:00', () => {
        expect(DF.describeTimeZone('UTC', '2026-11-05').offset).toBe('UTC+00:00');
    });
});
