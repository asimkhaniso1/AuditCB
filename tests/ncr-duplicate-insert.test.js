// Duplicate NCRs in the register (same client, audit, clause; NCR-021/025/
// 038/047/051 on clause 7.5). Covers the three ways the register gained or kept
// copies of one finding:
//   1. persistNCR() called again for a record whose INSERT had not returned an
//      id yet -> a second INSERT (back-to-back saveChecklist calls).
//   2. fetchNCRs() rebuilt the register from DB rows only, dropping a record
//      whose insert was still in flight, so the next save could not see it.
//   3. Existing copies had no way out short of hand-editing each one — the
//      duplicate review withdraws all but the record the auditor keeps.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditPlans: [] };
loadScript('./utils.js', { params: { module: undefined } });
const persistNCR = loadScript('./ncr-capa-module.js', { params: { module: undefined }, append: '\nreturn persistNCR;' });

// Minimal Supabase double: inserts resolve only when release() is called, so a
// test can hold an insert "in flight".
function fakeSupabase() {
    const rows = [];
    let nextId = 100;
    const held = [];
    const api = {
        rows, inserts: 0, updates: 0,
        release() { held.splice(0).forEach(fn => fn()); },
        from() {
            return {
                insert(payload) {
                    api.inserts++;
                    return {
                        select: () => new Promise(resolve => {
                            held.push(() => {
                                const row = Object.assign({ id: nextId++ }, payload);
                                rows.push(row);
                                resolve({ data: [row], error: null });
                            });
                        })
                    };
                },
                update(payload) {
                    api.updates++;
                    return {
                        eq: (_col, id) => {
                            const row = rows.find(r => String(r.id) === String(id));
                            if (row) Object.assign(row, payload);
                            return Promise.resolve({ error: null });
                        }
                    };
                },
                select() {
                    return { order: () => Promise.resolve({ data: rows.map(r => Object.assign({}, r)), error: null }) };
                }
            };
        }
    };
    return api;
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe('persistNCR does not insert the same record twice', () => {
    beforeEach(() => {
        window.state = { ncrs: [], auditPlans: [], capaAnalytics: {} };
        window.contentArea = { innerHTML: '' };
        window.showNotification = () => { };
    });

    it('a second persist while the first INSERT is in flight becomes an UPDATE', async () => {
        const sb = fakeSupabase();
        window.SupabaseClient = sb;
        const rec = { clientId: 'pcc', auditId: 'plan-1', clause: '7.5', severity: 'Minor', status: 'Open', description: 'Doc control' };
        window.state.ncrs.push(rec);

        const first = persistNCR(rec);
        const second = persistNCR(rec);   // e.g. Finalize -> saveChecklist right after a Save
        await flush();
        sb.release();
        await Promise.all([first, second]);

        expect(sb.inserts).toBe(1);
        expect(sb.updates).toBe(1);
        expect(sb.rows.length).toBe(1);
    });

    it('fetchNCRs keeps a local record whose insert has not returned yet', async () => {
        const sb = fakeSupabase();
        sb.rows.push({ id: 1, client_id: 'pcc', audit_id: 'plan-1', clause: '4.1', severity: 'Minor', status: 'Open', description: 'Other' });
        window.SupabaseClient = sb;
        const pending = { _sourceKey: 'exec-r1-cl-7-5', clientId: 'pcc', auditId: 'plan-1', clause: '7.5', severity: 'Minor', status: 'Open', description: 'Doc control' };
        window.state.ncrs = [pending];

        await window.fetchNCRs();

        expect(window.state.ncrs.length).toBe(2);
        expect(window.state.ncrs).toContain(pending);
    });
});

describe('duplicate review withdraws all but the kept record', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="modal-title"></div><div id="modal-body"></div><button id="modal-save"></button>`;
        window.openModal = () => { };
        window.closeModal = () => { };
        window.saveData = () => { };
        window.showNotification = () => { };
        window.confirm = () => true;
        window.contentArea = document.createElement('div');
        delete window.SupabaseClient; // persistNCR becomes a no-op
        const base = { clientId: 'pcc', clientName: 'PC Connection', auditId: 'plan-1', clause: '7.5', status: 'Open', source: 'checklist' };
        window.state = {
            auditPlans: [], capaAnalytics: {}, clients: [],
            ncrs: [
                { ...base, id: 21, severity: 'minor', description: 'An opportunity exists...', raisedDate: '2026-03-01' },
                { ...base, id: 38, severity: 'minor', description: 'An opportunity exists...', raisedDate: '2026-03-02', rootCause: 'No migration procedure' },
                { ...base, id: 51, severity: 'minor', description: 'A minor non-conformity was identified...', raisedDate: '2026-03-05' },
                { ...base, id: 70, severity: 'Major', clause: '9.2', description: 'Unrelated' }
            ]
        };
    });

    it('preselects the record with CAPA work and withdraws the rest, without deleting', async () => {
        window.openNCRDuplicateReview();
        const checked = document.querySelector('input[name="ncr-dup-keep-0"]:checked');
        expect(checked.value).toBe('38');

        await document.getElementById('modal-save').onclick();

        const byId = Object.fromEntries(window.state.ncrs.map(n => [n.id, n]));
        expect(window.state.ncrs.length).toBe(4);
        expect(byId[38].status).toBe('Open');
        expect(byId[21].status).toBe('Withdrawn');
        expect(byId[51].status).toBe('Withdrawn');
        expect(byId[21].withdrawnReason).toMatch(/Duplicate of NCR-038/);
        expect(byId[70].status).toBe('Open');
        expect(window.NCRModule.activeDuplicateGroups()).toEqual([]);
    });

    it('"keep them all" changes nothing and hides that group', async () => {
        window.openNCRDuplicateReview();
        document.querySelector('input[name="ncr-dup-keep-0"][value=""]').checked = true;

        await document.getElementById('modal-save').onclick();

        expect(window.state.ncrs.every(n => n.status === 'Open')).toBe(true);
        expect(window.NCRModule.activeDuplicateGroups()).toEqual([]);
        window.localStorage.clear();
    });
});
