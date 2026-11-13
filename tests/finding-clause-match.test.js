// Previous findings are scheduled into agenda sessions by clause number.
// PC Connection's open nonconformity was recorded against "7.5 (Integrated)";
// compared exactly, that never equalled a session's "7.5", so the finding was
// reported as "not scheduled in any agenda session" however the agenda was
// rebuilt.
import { describe, it, expect } from 'vitest';
import { M } from '../tools/pcc-scenario.mjs';

const { IPI } = M;

const session = (id, stdRefs) => ({
    kind: 'session', sessionId: id, blockId: id, findingIds: [],
    standards: Object.entries(stdRefs).map(([stdId, refs]) => ({ stdId, refs }))
});

describe('mapFindings — clause labels do not stop a finding being scheduled', () => {
    const ALL = ['iso27001', 'iso22301', 'iso20000'];

    it('schedules "7.5 (Integrated)" into the session covering 7.5', () => {
        const sessions = [
            session('s-context', { iso27001: ['4.1'], iso22301: ['4.1'], iso20000: ['4.1'] }),
            session('s-docs', { iso27001: ['7.5'], iso22301: ['7.5'], iso20000: ['7.5'] })
        ];
        const map = IPI.mapFindings([{ id: '21', ref: '21', clause: '7.5 (Integrated)', type: 'nonconformity', standards: ALL }], sessions);
        expect(map[0].mapped).toBe(true);
        expect(map[0].sessionIds).toEqual(['s-docs']);
        expect(sessions[1].findingIds).toContain('21');
    });

    it('reads the clause number out of other recorded forms', () => {
        const sessions = [session('s-ops', { iso27001: ['8.1'], iso20000: ['8.5.1'] }), session('s-annex', { iso27001: ['A.5.15'] })];
        const find = (clause, standards) => IPI.mapFindings([{ id: 'f', clause, standards }], sessions)[0];
        expect(find('8.5.1 - Change management', ['iso20000']).sessionIds).toEqual(['s-ops']);
        expect(find('A.5.15 Access control', ['iso27001']).sessionIds).toEqual(['s-annex']);
        expect(find('8.1(a)', ['iso27001']).sessionIds).toEqual(['s-ops']);
    });

    it('does not read 7.55 as 7.5', () => {
        const sessions = [session('s-docs', { iso27001: ['7.5'] })];
        expect(IPI.mapFindings([{ id: 'f', clause: '7.55', standards: ['iso27001'] }], sessions)[0].mapped).toBe(false);
    });

    it('still respects the finding\'s standards', () => {
        const sessions = [session('s-docs', { iso20000: ['7.5'] })];
        expect(IPI.mapFindings([{ id: 'f', clause: '7.5 (ISMS)', standards: ['iso27001'] }], sessions)[0].sessionIds).not.toContain('s-docs');
    });

    it('records the bare clause number on the mapping record', () => {
        const sessions = [session('s-docs', { iso27001: ['7.5'] })];
        expect(IPI.mapFindings([{ id: 'f', clause: '7.5 (Integrated)', standards: ['iso27001'] }], sessions)[0].clause).toBe('7.5');
    });
});
