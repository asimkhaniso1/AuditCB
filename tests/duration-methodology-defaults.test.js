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
window.saveData = vi.fn();
window.DataService = { syncSettings: vi.fn().mockResolvedValue(true) };

const fs = await import('fs');
const path = await import('path');
const source = fs.readFileSync(path.resolve('./settings-module.js'), 'utf8');

describe('duration methodology starter defaults', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.DataService.syncSettings.mockResolvedValue(true);
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

    it('saves incomplete starter methodologies as drafts without activating them', async () => {
        window.fillBasicDurationDefaults();
        await window.saveDurationMethodologyDrafts();

        expect(window.state.cbSettings.durationMethodologyDrafts['27001'].starterTemplate).toBe(true);
        expect(window.state.cbSettings.durationMethodologies['27001']).toBeUndefined();
        expect(window.saveData).toHaveBeenCalled();
        expect(window.DataService.syncSettings).toHaveBeenCalled();
    });

    it('activates complete duration tables without requiring document-control fields', async () => {
        window.fillBasicDurationDefaults();
        window.switchSettingsSubTab = vi.fn();
        await window.saveDurationMethodologies();

        const activated = window.state.cbSettings.durationMethodologies['27001'];
        expect(window._durationMethodologyValidationErrors).toEqual([]);
        expect(activated.version).toMatch(/^Configuration /);
        expect(activated.approvedBy).toBe('System');
        expect(activated.sourceReference).toBe('');
        expect(window.showNotification).toHaveBeenLastCalledWith(
            'Duration rules saved and ready to use.',
            'success'
        );
    });

    it('applies common approval details only after explicit confirmation', () => {
        window.fillBasicDurationDefaults();
        document.body.innerHTML = `
            <input id="duration-bulk-version" value="Rev 03">
            <input id="duration-bulk-source" value="CB-PRO-DUR-01">
            <input id="duration-bulk-approver" value="Technical Manager">
            <input id="duration-bulk-include-ims" type="checkbox">
            <input id="duration-bulk-confirm" type="checkbox" checked>
        `;

        window.applyBulkDurationApproval();

        const method = window._durationMethodologyDraft.registry['27001'];
        expect(method.version).toBe('Rev 03');
        expect(method.sourceReference).toBe('CB-PRO-DUR-01');
        expect(method.approvedBy).toBe('Technical Manager');
        expect(method.starterTemplate).toBe(false);
    });

    it('can replace an incomplete approved table with complete starter bands for re-approval', () => {
        window._durationMethodologyDraft = {
            registry: {
                27001: {
                    name: 'ISO 27001 rules', version: 'Rev 1', sourceReference: 'PROC-1', approvedBy: 'Manager',
                    tables: { Recertification: [{ minEmployees: 1, maxEmployees: 250, days: 2 }] }
                }
            },
            ims: null
        };

        window.replaceDurationWithStarterBands('27001');
        const method = window._durationMethodologyDraft.registry['27001'];

        expect(method.tables.Recertification).toHaveLength(7);
        expect(method.tables.Recertification.at(-1).maxEmployees).toBeNull();
        expect(method.version).toBe('');
        expect(method.approvedBy).toBe('');
        expect(method.starterTemplate).toBe(true);
    });

    it('blocks activation when an employee-band gap would leave a client without a duration row', async () => {
        const complete = [
            { minEmployees: 1, maxEmployees: 250, days: 1 },
            { minEmployees: 300, maxEmployees: null, days: 2 }
        ];
        window._durationMethodologyDraft = {
            registry: {
                27001: {
                    name: 'ISO 27001 rules', version: 'Rev 1', sourceReference: 'PROC-1', approvedBy: 'Manager',
                    tables: {
                        'Surveillance 1': structuredClone(complete),
                        'Surveillance 2': structuredClone(complete),
                        Recertification: structuredClone(complete)
                    }
                }
            },
            ims: null
        };

        await window.saveDurationMethodologies();

        expect(window._durationMethodologyValidationErrors).toContain('27001 Recertification: employee bands contain a gap before 300.');
        expect(window.state.cbSettings.durationMethodologies['27001']).toBeUndefined();
        expect(window.state.cbSettings.durationMethodologyDrafts['27001']).toBeDefined();
    });

    it('automatically backfills empty stages in older saved drafts without replacing populated stages', async () => {
        window._durationMethodologyDraft = {
            registry: {
                22301: {
                    name: 'ISO 22301 rules', version: 'Rev 1', sourceReference: '', approvedBy: '',
                    tables: {
                        'Surveillance 1': [],
                        'Surveillance 2': [{ minEmployees: 1, maxEmployees: null, days: 9 }]
                    }
                }
            },
            ims: null
        };

        await window.saveDurationMethodologyDrafts();
        const method = window._durationMethodologyDraft.registry['22301'];

        expect(method.tables['Surveillance 1']).toHaveLength(7);
        expect(method.tables['Surveillance 2']).toEqual([{ minEmployees: 1, maxEmployees: null, days: 9 }]);
        expect(method.tables.Recertification).toHaveLength(7);
        expect(method.starterTemplate).toBe(true);
    });
});
