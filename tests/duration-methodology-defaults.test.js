import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Domain = require('../audit-planning-domain.js');

globalThis.window = globalThis.window || globalThis;
window.Logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
globalThis.Logger = window.Logger;
window.UTILS = { escapeHtml: value => String(value ?? '') };
window.AuditPlanningDomain = Domain;
window.showNotification = vi.fn();

const fs = await import('fs');
const path = await import('path');
const source = fs.readFileSync(path.resolve('./settings-module.js'), 'utf8');

describe('duration methodology starter defaults', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete window._durationMethodologyDraft;
        window.state = {
            cbSettings: {
                standardsOffered: ['ISO 9001:2015', 'ISO/IEC 27001:2022', 'ISO 22301:2019'],
                durationMethodologies: {
                    9001: {
                        name: 'Approved QMS method',
                        version: 'Rev 4',
                        sourceReference: 'CB-PRO-01',
                        approvedBy: 'Technical Manager',
                        tables: { 'Recertification': [{ minEmployees: 1, maxEmployees: null, days: 9 }] }
                    }
                }
            }
        };
        new Function(source)();
    });

    it('fills every supported standard with editable starter bands without overwriting entered rules', () => {
        window.fillBasicDurationDefaults();
        const registry = window._durationMethodologyDraft.registry;

        expect(Object.keys(registry)).toEqual(expect.arrayContaining([
            '9001', '14001', '45001', '27001', '22301', '20000-1', '22000', '13485', '50001'
        ]));
        expect(registry['9001'].tables.Recertification[0].days).toBe(9);
        expect(registry['27001'].tables['Surveillance 1']).toHaveLength(7);
        expect(registry['27001'].tables['Surveillance 1'].at(-1)).toEqual({ minEmployees: 501, maxEmployees: null, days: 2.5 });
        expect(registry['27001'].tables.Recertification.at(-1)).toEqual({ minEmployees: 501, maxEmployees: null, days: 4 });
    });

    it('keeps starter methodologies incomplete until controlled approval fields are supplied', () => {
        window.fillBasicDurationDefaults();
        const starter = window._durationMethodologyDraft.registry['22301'];

        expect(starter.starterTemplate).toBe(true);
        expect(starter.version).toBe('');
        expect(starter.sourceReference).toBe('');
        expect(starter.approvedBy).toBe('');
    });

    it('refreshes untouched starter rows but preserves a methodology after a user edits it', () => {
        window.fillBasicDurationDefaults();
        const registry = window._durationMethodologyDraft.registry;
        registry['22301'].tables.Recertification[0].days = 99;
        window.fillBasicDurationDefaults();
        expect(registry['22301'].tables.Recertification[0].days).toBe(0.5);

        window.updateDurationBand('22301', 'Recertification', 0, 'days', '1.25');
        window.fillBasicDurationDefaults();
        expect(registry['22301'].tables.Recertification[0].days).toBe(1.25);
    });
});
