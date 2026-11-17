// The NCR & CAPA register showed a stale copy (PC Connection, 2026-11-17).
// NCR-053 (9.2) was reclassified Minor -> Observation in the database, but the
// CAPA Tracker in an open tab, and in a freshly reloaded one, still read Minor
// due 02/06/2026: the register is restored from this browser's cache on load,
// the sign-in data load did not include it, and the NCR & CAPA screen fetched
// only when the cache was empty. Saving that stale record from Update would
// have written Minor and the old due date back.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditPlans: [] };
loadScript('./utils.js', { params: { module: undefined } });
const renderNCRCAPAModule = loadScript('./ncr-capa-module.js', { params: { module: undefined }, append: '\nreturn renderNCRCAPAModule;' });

const dbRow = (over) => Object.assign({
    id: 53, client_id: 'c1', audit_id: 'feb', client_name: 'PC CONNECTION, INC.', clause: '9.2 (Integrated)',
    severity: 'observation', due_date: null, status: 'Open', car_status: null, description: 'Clause 9.2 requires internal audits'
}, over || {});

function supabaseWith(rows) {
    return { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) };
}

const cached = () => ({ id: 53, clientId: 'c1', auditId: 'feb', clientName: 'PC CONNECTION, INC.', clause: '9.2 (Integrated)', severity: 'minor', dueDate: '2026-06-02', status: 'Open', carStatus: null, description: 'Clause 9.2 requires internal audits' });
const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
    window.state = { ncrs: [cached()], auditPlans: [], capaAnalytics: {}, clients: [] };
    window.contentArea = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(window.contentArea);
    window.showNotification = () => { };
    window.SupabaseClient = supabaseWith([dbRow()]);
});

describe('the register is refreshed from the database', () => {
    it('fetchNCRs replaces a stale cached record and reports the change', async () => {
        expect(await window.fetchNCRs()).toBe(true);
        expect(window.state.ncrs[0]).toMatchObject({ id: 53, severity: 'observation', dueDate: null });
        expect(await window.fetchNCRs()).toBe(false); // nothing new the second time
    });

    it('opening NCR & CAPA with a cached register still refreshes it', async () => {
        renderNCRCAPAModule();
        expect(document.getElementById('ncr-content')).not.toBeNull(); // the cached copy shows at once
        await flush(); await flush();
        expect(window.state.ncrs[0].severity).toBe('observation');
    });

    it('a refresh that changes nothing does not redraw the screen', async () => {
        window.state.ncrs = [Object.assign(cached(), { severity: 'observation', dueDate: null, raisedBy: undefined })];
        await window.fetchNCRs(); // normalise to the mapped shape
        renderNCRCAPAModule();
        await flush(); await flush();
        const content = document.getElementById('ncr-content');
        content.setAttribute('data-marker', 'kept');
        await window.fetchNCRs();
        expect(document.getElementById('ncr-content').getAttribute('data-marker')).toBe('kept');
    });

    it('a failed fetch keeps the cached register', async () => {
        window.SupabaseClient = { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: null, error: new Error('offline') }) }) }) };
        const err = vi.spyOn(console, 'error').mockImplementation(() => { });
        expect(await window.fetchNCRs()).toBe(false);
        expect(window.state.ncrs[0].severity).toBe('minor');
        err.mockRestore();
    });

    it('the sign-in data load includes the register', () => {
        const src = fs.readFileSync(path.resolve('./supabase-client.js'), 'utf8');
        const block = src.slice(src.indexOf('await Promise.allSettled(['), src.indexOf(']);', src.indexOf('await Promise.allSettled([')));
        expect(block).toContain('window.fetchNCRs()');
    });
});
