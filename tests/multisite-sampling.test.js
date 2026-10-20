import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Domain = require('../audit-planning-domain.js');
const fs = require('fs');
const path = require('path');

// The planning form's "Multi-Site Sampling" button opens a modal whose
// Calculate button called calculateMultiSiteSample() after the function had
// been deleted as dead code — every click threw a ReferenceError.
describe('calculateMultiSiteSample (IAF MD 1)', () => {
    const calc = Domain.calculateMultiSiteSample;

    it('takes the square root of the site count at medium risk', () => {
        expect(calc(16, 'Medium', false, false)).toEqual({ baseSample: 4, adjustedSample: 4, percentage: 25 });
        expect(calc(10, 'Medium', false, false)).toEqual({ baseSample: 4, adjustedSample: 4, percentage: 40 });
    });

    it('scales by risk and site factors', () => {
        expect(calc(9, 'Medium', false, false).adjustedSample).toBe(3);
        expect(calc(9, 'High', false, false).adjustedSample).toBe(4);
        expect(calc(9, 'High', true, true).adjustedSample).toBe(5);
    });

    it('never samples below 25% of sites', () => {
        expect(calc(100, 'Low', false, false).adjustedSample).toBe(25);
    });

    it('never samples more sites than exist', () => {
        expect(calc(2, 'High', true, true)).toEqual({ baseSample: 2, adjustedSample: 2, percentage: 100 });
    });

    it('returns zeros for no sites instead of dividing by zero', () => {
        expect(calc(0, 'Medium', false, false)).toEqual({ baseSample: 0, adjustedSample: 0, percentage: 0 });
        expect(calc(NaN, 'Medium', false, false)).toEqual({ baseSample: 0, adjustedSample: 0, percentage: 0 });
    });
});

describe('multi-site sampling modal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
        window.AuditPlanningDomain = Domain;
        window.DataService = {
            openFormModal: (title, html) => { document.body.innerHTML = html; }
        };
        // Evaluated as the browser does: a plain script, no CommonJS module.
        // eslint-disable-next-line no-new-func
        loadScript('./advanced-modules.js', { params: { module: undefined } });
    });

    afterEach(() => {
        vi.useRealTimers();
        delete window.DataService;
        delete window.lastCalculatedSample;
    });

    it('calculates a sample when the form is submitted', () => {
        window.openMultiSiteSamplingCalculatorModal();
        vi.advanceTimersByTime(150);

        document.getElementById('modal-total-sites').value = '16';
        document.getElementById('modal-site-risk').value = 'Medium';
        const form = document.getElementById('modal-multisite-form');
        expect(() => form.dispatchEvent(new window.Event('submit', { cancelable: true }))).not.toThrow();

        expect(document.getElementById('modal-result-count').textContent).toBe('4');
        expect(document.getElementById('modal-calc-results').style.display).toBe('block');
        expect(window.lastCalculatedSample).toBe(4);
    });
});
