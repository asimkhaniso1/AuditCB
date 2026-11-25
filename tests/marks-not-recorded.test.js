// Technical review of PC Connection's 2026 recertification: use of
// certification marks was never recorded, yet an empty box printed "Usage
// verified as conforming to CB rules." — a verification nobody made.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');

beforeAll(() => {
    loadScript('./utils.js', { global: true });
    loadScript('./report-stats.js', { global: true });
    loadScript('./report-integrity.js', { params: { module: undefined } });
});
beforeEach(() => {
    window.state = { auditReports: [], clients: [], auditPlans: [], ncrs: [] };
    globalThis.state = window.state;
});

const w35 = (report, auditType) => window.ReportIntegrity.check({ report, auditPlan: { id: 'p1', auditType }, client: {} })
    .warnings.filter((w) => w.id === 'W35');

describe('use of certification marks', () => {
    it('the report never claims a verification as its default', () => {
        expect(SRC).not.toContain('Usage verified as conforming to CB rules.');
        // Preview box and export both fall back to "Not recorded." outside an initial audit.
        expect((SRC.match(/'Not recorded\.'\)/g) || []).length).toBe(2);
    });

    it('flags a recertification or surveillance report with nothing recorded', () => {
        expect(w35({ id: 'r1' }, 'Recertification')).toHaveLength(1);
        expect(w35({ id: 'r1', effMarks: '' }, 'Surveillance 1')).toHaveLength(1);
        expect(w35({ id: 'r1', effMarks: 'Not recorded.' }, 'Recertification')).toHaveLength(1);
    });

    it('accepts a recorded result, and does not apply to an initial audit', () => {
        expect(w35({ id: 'r1', effMarks: 'Website reviewed; no certification mark found.' }, 'Recertification')).toHaveLength(0);
        expect(w35({ id: 'r1' }, 'Initial Certification Stage 2')).toHaveLength(0);
    });
});
