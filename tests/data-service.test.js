import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup window globals
globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
window.saveData = vi.fn();
window.showNotification = vi.fn();
window.openModal = vi.fn();
window.state = {
    clients: [
        { id: '1', name: 'Acme Corp', sites: [] },
        { id: '2', name: 'Globex Inc', sites: [] },
        { id: 42, name: 'Numeric ID Corp', sites: [] }
    ],
    auditReports: [
        { id: 'r1', client: 'Acme Corp', status: 'Draft' },
        { id: 'r2', client: 'Globex Inc', status: 'Published' }
    ],
    auditPlans: [
        { id: 'p1', clientId: '1', standard: 'ISO 9001:2015' }
    ]
};

// Mock SupabaseClient
window.SupabaseClient = {
    isInitialized: true,
    upsertClient: vi.fn().mockResolvedValue(true),
    upsertAuditReport: vi.fn().mockResolvedValue(true),
    upsertCertificate: vi.fn().mockResolvedValue(true),
    deleteCertificate: vi.fn().mockResolvedValue(true),
    syncSettingsToSupabase: vi.fn().mockResolvedValue(true),
    syncChecklistsToSupabase: vi.fn().mockResolvedValue(true),
    syncAuditorAssignmentsToSupabase: vi.fn().mockResolvedValue(true),
    deleteAuditorAssignment: vi.fn().mockResolvedValue(true)
};

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./data-service.js'), 'utf8');
eval(src);

describe('DataService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('findClient', () => {
        it('should find client by string ID', () => {
            const client = window.DataService.findClient('1');
            expect(client).toBeDefined();
            expect(client.name).toBe('Acme Corp');
        });

        it('should find client by numeric ID via string coercion', () => {
            const client = window.DataService.findClient(42);
            expect(client).toBeDefined();
            expect(client.name).toBe('Numeric ID Corp');
        });

        it('should return undefined for non-existent ID', () => {
            expect(window.DataService.findClient('999')).toBeUndefined();
        });
    });

    describe('findAuditReport', () => {
        it('should find report by ID', () => {
            const report = window.DataService.findAuditReport('r1');
            expect(report).toBeDefined();
            expect(report.client).toBe('Acme Corp');
        });

        it('should return undefined for missing report', () => {
            expect(window.DataService.findAuditReport('missing')).toBeUndefined();
        });
    });

    describe('findAuditPlan', () => {
        it('should find plan by ID', () => {
            const plan = window.DataService.findAuditPlan('p1');
            expect(plan).toBeDefined();
            expect(plan.standard).toBe('ISO 9001:2015');
        });
    });

    describe('syncClient', () => {
        it('should save locally and sync to Supabase', async () => {
            const client = { id: '1', name: 'Acme Corp' };
            const result = await window.DataService.syncClient(client);
            expect(result).toBe(true);
            expect(window.saveData).toHaveBeenCalledOnce();
            expect(window.SupabaseClient.upsertClient).toHaveBeenCalledWith(client);
        });

        it('should skip saveData when saveLocal is false', async () => {
            const client = { id: '1', name: 'Acme Corp' };
            await window.DataService.syncClient(client, { saveLocal: false });
            expect(window.saveData).not.toHaveBeenCalled();
            expect(window.SupabaseClient.upsertClient).toHaveBeenCalled();
        });

        it('should return false when Supabase is not ready', async () => {
            window.SupabaseClient.isInitialized = false;
            const result = await window.DataService.syncClient({ id: '1' });
            expect(result).toBe(false);
            expect(window.SupabaseClient.upsertClient).not.toHaveBeenCalled();
            window.SupabaseClient.isInitialized = true;
        });

        it('should handle sync failure gracefully', async () => {
            window.SupabaseClient.upsertClient.mockRejectedValueOnce(new Error('Network error'));
            const result = await window.DataService.syncClient({ id: '1' });
            expect(result).toBe(false);
            expect(window.showNotification).toHaveBeenCalledWith(
                expect.stringContaining('Cloud sync failed'),
                'warning'
            );
        });

        it('should suppress notification when silent', async () => {
            window.SupabaseClient.upsertClient.mockRejectedValueOnce(new Error('fail'));
            await window.DataService.syncClient({ id: '1' }, { silent: true });
            expect(window.showNotification).not.toHaveBeenCalled();
        });
    });

    describe('syncSettings', () => {
        it('should call syncSettingsToSupabase', async () => {
            const result = await window.DataService.syncSettings();
            expect(result).toBe(true);
            expect(window.SupabaseClient.syncSettingsToSupabase).toHaveBeenCalled();
        });
    });

    describe('deleteAuditorAssignment', () => {
        it('should pass auditorId and clientId to Supabase', async () => {
            await window.DataService.deleteAuditorAssignment('a1', 'c1');
            expect(window.SupabaseClient.deleteAuditorAssignment).toHaveBeenCalledWith('a1', 'c1');
        });

        it('should not call saveData (delete is saveLocal: false)', async () => {
            await window.DataService.deleteAuditorAssignment('a1', 'c1');
            expect(window.saveData).not.toHaveBeenCalled();
        });
    });

    describe('isSupabaseReady', () => {
        it('should return true when initialized', () => {
            expect(window.DataService.isSupabaseReady()).toBe(true);
        });

        it('should return false when not initialized', () => {
            window.SupabaseClient.isInitialized = false;
            expect(window.DataService.isSupabaseReady()).toBe(false);
            window.SupabaseClient.isInitialized = true;
        });

        it('should return false when SupabaseClient is null', () => {
            const saved = window.SupabaseClient;
            window.SupabaseClient = null;
            expect(window.DataService.isSupabaseReady()).toBe(false);
            window.SupabaseClient = saved;
        });
    });

    describe('openFormModal', () => {
        it('should set modal title and body', () => {
            // Setup DOM mock
            const title = { textContent: '' };
            const body = { innerHTML: '' };
            const save = { style: { display: '' }, onclick: null };
            const origGetById = document.getElementById;
            document.getElementById = vi.fn((id) => {
                if (id === 'modal-title') return title;
                if (id === 'modal-body') return body;
                if (id === 'modal-save') return save;
                return null;
            });

            const handler = vi.fn();
            window.DataService.openFormModal('Test Title', '<p>body</p>', handler);

            expect(title.textContent).toBe('Test Title');
            expect(body.innerHTML).toBe('<p>body</p>');
            expect(save.onclick).toBe(handler);
            expect(window.openModal).toHaveBeenCalled();

            document.getElementById = origGetById;
        });

        it('should hide save button when no handler provided', () => {
            const save = { style: { display: '' }, onclick: null };
            const origGetById = document.getElementById;
            document.getElementById = vi.fn((id) => {
                if (id === 'modal-title') return { textContent: '' };
                if (id === 'modal-body') return { innerHTML: '' };
                if (id === 'modal-save') return save;
                return null;
            });

            window.DataService.openFormModal('Info', '<p>read only</p>');
            expect(save.style.display).toBe('none');

            document.getElementById = origGetById;
        });
    });
});
