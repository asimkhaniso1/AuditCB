// Review recorded outside the agenda is part of the calculated duration, so
// the plan editor puts only the rest into the agenda. PC Connection's 2026
// plan: 4.5 days calculated, 3 reviewed before the audit, 1.5 in the agenda.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

describe('plan editor: agenda duration net of review outside the agenda', () => {
    beforeAll(() => {
        globalThis.window = globalThis.window || globalThis;
        window.showNotification = () => { };
        window.Sanitizer = { sanitizeText: (v) => v };
        window.Validator = {};
        window.state = { auditPlans: [], clients: [], auditors: [], cbSettings: {} };
        loadScript('./planning-module.js', { global: true });
    });

    beforeEach(() => {
        document.body.innerHTML = [
            '<input id="plan-baseline-days" value="4.5">', '<input id="plan-ims-adjustment" value="0">',
            '<input id="plan-justified-adjustment" value="0">', '<input id="plan-review-days" value="0">',
            '<select id="plan-audit-method"><option value="Remote" selected>Remote</option></select>',
            '<input id="plan-remote-days" value="0">', '<input id="plan-onsite-days" value="0">', '<input id="plan-mandays" value="">'
        ].join('');
    });

    it('without review time the agenda carries the whole calculated duration', () => {
        window.recalculateDurationAllocation();
        expect(document.getElementById('plan-mandays').value).toBe('4.5');
    });

    it('review time is taken out of the agenda, not added to it', () => {
        document.getElementById('plan-review-days').value = '3';
        window.recalculateDurationAllocation();
        expect(document.getElementById('plan-mandays').value).toBe('1.5');
        expect(document.getElementById('plan-remote-days').value).toBe('1.5');
    });
});
