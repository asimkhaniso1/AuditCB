// AI evidence explanation, phase 1 (2026-11-19): one call per question with
// all its screenshots; the reply is checked before anyone sees it, and the
// result is a draft that never touches the checklist answer.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const STD = 'ISO 20000-1:2018, ISO 27001:2022, ISO 22301:2019';
const KB = { standards: [
    { name: 'ISO/IEC 27001:2022', status: 'ready', clauses: [
        { clause: 'A.5.18', title: 'Access rights', requirement: 'Access rights shall be provisioned, reviewed, modified and removed.' },
        { clause: '7.5', title: 'Documented information', requirement: 'ISMS documented information.' }] },
    { name: 'ISO 22301:2019', status: 'ready', clauses: [
        { clause: '7.5', title: 'Documented information', requirement: 'BCMS documented information.' },
        { clause: '8.2.2', title: 'Business impact analysis', requirement: 'Prioritized timeframes for resuming activities.' }] },
    { name: 'ISO/IEC 20000-1:2018', status: 'ready', clauses: [
        { clause: '7.5', title: 'Documented information', requirement: 'SMS documented information.' },
        { clause: '8.2.2', title: 'Plan the services', requirement: 'Plan the services.' }] }
] };

beforeAll(() => {
    loadScript('./utils.js', { global: true });
    loadScript('./report-stats.js', { global: true });
    loadScript('./ai-service.js', { params: { module: undefined } });
});
let AI;
beforeEach(() => {
    window.state = { knowledgeBase: KB, checklists: [], auditReports: [] };
    globalThis.state = window.state;
    AI = window.AI_SERVICE;
    window.EvidenceUtils = { compress: vi.fn(async (src) => 'data:image/jpeg;base64,' + Buffer.from(String(src).slice(0, 12)).toString('base64')) };
    window._EvidenceDB = { get: vi.fn(async (k) => (k === 'idb://evidence-1' ? 'data:image/png;base64,AAAA' : null)) };
});

const reply = (obj) => ({ text: JSON.stringify(obj), usage: { promptTokenCount: 1900, candidatesTokenCount: 260, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 700 }, { modality: 'IMAGE', tokenCount: 1200 }] }, model: 'gemini-2.0-flash' });

describe('what is sent', () => {
    it('the question, its own standard’s requirement, the remark and the screenshots', () => {
        const input = AI.evidenceInputFor({ clause: 'A.5.18', requirement: 'Sample joiners, movers and leavers.', comment: 'Q3 review seen &amp; signed', evidenceImages: ['https://x/1.png', 'idb://evidence-1'], _evIds: ['EV-12', 'EV-13'] }, { standard: STD });
        expect(input.question).toBe('Sample joiners, movers and leavers.');
        expect(input.remark).toBe('Q3 review seen & signed');
        expect(input.requirements).toEqual([{ standard: 'ISO 27001:2022', clause: 'A.5.18', title: 'Access rights', text: 'Access rights shall be provisioned, reviewed, modified and removed.' }]);
        expect(input.images).toEqual([{ evId: 'EV-12', src: 'https://x/1.png' }, { evId: 'EV-13', src: 'idb://evidence-1' }]);
    });

    it('a clause common to every standard sends each; an ambiguous one sends none', () => {
        expect(AI.evidenceInputFor({ clause: '7.5' }, { standard: STD }).requirements.map((r) => r.standard)).toEqual(['ISO 20000-1:2018', 'ISO 27001:2022', 'ISO 22301:2019']);
        expect(AI.evidenceInputFor({ clause: '8.2.2' }, { standard: STD }).requirements).toEqual([]);
        expect(AI.evidenceInputFor({ clause: '8.2.2', criterionRef: '8.2.2 (22301)' }, { standard: STD }).requirements[0].title).toBe('Business impact analysis');
    });

    it('screenshots are downscaled to 1280 px JPEG, idb:// resolved, failures and extras listed, never sent', async () => {
        const images = [{ evId: 'EV-1', src: 'https://x/a.png' }, { evId: 'EV-2', src: 'idb://evidence-1' }, { evId: 'EV-3', src: 'idb://missing' }]
            .concat([4, 5, 6, 7, 8].map((n) => ({ evId: 'EV-' + n, src: 'https://x/' + n + '.png' })));
        const prep = await AI.prepareEvidenceImages(images);
        expect(window.EvidenceUtils.compress).toHaveBeenCalledWith('https://x/a.png', { maxPx: 1280, quality: 0.7 });
        expect(window.EvidenceUtils.compress).toHaveBeenCalledWith('data:image/png;base64,AAAA', { maxPx: 1280, quality: 0.7 });
        expect(prep.sent.map((s) => s.evId)).toEqual(['EV-1', 'EV-2', 'EV-4', 'EV-5', 'EV-6', 'EV-7']);
        expect(prep.sent[0].mimeType).toBe('image/jpeg');
        expect(prep.failed.map((f) => f.evId)).toEqual(['EV-3', 'EV-8']);
    });

    it('one call per question with all its images, as JSON, logged as evidence-explanation', async () => {
        AI.callProxyAPI = vi.fn(async () => reply({ images: [], explanation: 'Image 1 shows the register.', gaps: [], suggestedAssessment: 'supports', assessmentReason: '' }));
        const input = { clause: 'A.5.18', question: 'Q', requirements: [], remark: '', images: [{ evId: 'EV-1', src: 'https://x/a.png' }, { evId: 'EV-2', src: 'https://x/b.png' }] };
        await AI.explainEvidence(input);
        expect(AI.callProxyAPI).toHaveBeenCalledTimes(1);
        const [prompt, opts] = AI.callProxyAPI.mock.calls[0];
        expect(opts).toMatchObject({ json: true, withUsage: true, feature: 'evidence-explanation' });
        expect(opts.images).toHaveLength(2);
        expect(prompt).toContain('Image 1 = EV-1; Image 2 = EV-2');
        expect(prompt).toContain('You do not decide conformity');
    });

    it('nothing to explain (no image, no remark): no call', async () => {
        AI.callProxyAPI = vi.fn();
        const out = await AI.explainEvidence({ question: 'Q', images: [], remark: '' });
        expect(out.status).toBe('nothing');
        expect(AI.callProxyAPI).not.toHaveBeenCalled();
    });
});

describe('the reply is checked before anyone sees it', () => {
    const input = { clause: '8.2.2 (22301)', question: 'Confirm the BIA sets recovery time objectives.', requirements: [], remark: 'Service Desk RTO 24h, RPO not defined', images: [{ evId: 'EV-62', src: 'https://x/bia.png' }, { evId: 'EV-63', src: 'https://x/menu.png' }] };
    const run = async (obj) => { AI.callProxyAPI = vi.fn(async () => reply(obj)); return AI.explainEvidence(input); };

    it('keeps facts found in the quoted text or the remark', async () => {
        const out = await run({
            images: [{ evId: 'EV-62', shows: 'A BIA table listing Service Desk with RTO 24 hours.', visibleText: ['Business Impact Analysis 2026', 'Service Desk', 'RTO 24 hours'], relevance: 'relevant' },
                { evId: 'EV-63', shows: 'A canteen menu.', visibleText: ['Lunch menu'], relevance: 'irrelevant' }],
            explanation: 'Image 1 shows the Business Impact Analysis 2026 with an RTO of 24 hours for the Service Desk. Image 2 is not related to the question.',
            gaps: ['RPO for the Service Desk'], suggestedAssessment: 'partially_supports', assessmentReason: 'The RPO is not shown.'
        });
        expect(out.result.explanation).toContain('Business Impact Analysis 2026');
        expect(out.result.images.map((i) => i.relevance)).toEqual(['relevant', 'irrelevant']);
        expect(out.result.suggestedAssessment).toBe('partially_supports');
        expect(out.flags).toEqual([]);
        expect(out.status).toBe('draft');
        expect(out.usage).toMatchObject({ promptTokens: 1900, imageTokens: 1200, textTokens: 700, outputTokens: 260 });
    });

    it('removes a sentence with an invented date or document, and says so', async () => {
        const out = await run({
            images: [{ evId: 'EV-62', shows: 'A BIA table.', visibleText: ['Service Desk', 'RTO 24 hours'], relevance: 'relevant' }],
            explanation: 'Image 1 shows an RTO of 24 hours for the Service Desk. The BIA was approved on 2026-03-14. It follows the Business Continuity Policy.',
            gaps: [], suggestedAssessment: 'partially_supports', assessmentReason: ''
        });
        expect(out.result.explanation).toBe('Image 1 shows an RTO of 24 hours for the Service Desk.');
        expect(out.flags.join(' ')).toContain('"2026-03-14"');
        expect(out.flags.join(' ')).toContain('"Business Continuity Policy"');
    });

    it('removes conformity wording and an unknown assessment', async () => {
        const out = await run({
            images: [{ evId: 'EV-62', shows: 'The table conforms to the requirement.', visibleText: [], relevance: 'relevant' }],
            explanation: 'The organisation is compliant with clause 8.2.2. Image 1 shows a table.',
            gaps: [], suggestedAssessment: 'conforms', assessmentReason: ''
        });
        expect(out.result.explanation).toBe('Image 1 shows a table.');
        expect(out.result.images[0].shows).toBe('');
        expect(out.result.suggestedAssessment).toBe('cannot_determine');
        expect(out.flags.some((f) => /conformity wording/.test(f))).toBe(true);
    });

    it('an image the AI skipped is listed as not described; an unknown evidence ID is mapped by order', async () => {
        const out = await run({ images: [{ evId: 'IMG-A', shows: 'A table.', visibleText: [], relevance: 'partial' }], explanation: 'Image 1 shows a table.', gaps: [], suggestedAssessment: 'insufficient', assessmentReason: '' });
        expect(out.result.images.map((i) => i.evId)).toEqual(['EV-62', 'EV-63']);
        expect(out.result.images[1].relevance).toBe('unreadable');
        expect(out.flags).toContain('EV-63: the AI did not describe this image.');
    });

    it('a reply that is not JSON yields an empty draft with a flag', async () => {
        AI.callProxyAPI = vi.fn(async () => ({ text: 'Sorry, I cannot.', usage: {}, model: 'm' }));
        const out = await AI.explainEvidence(input);
        expect(out.flags[0]).toBe('The AI reply was not valid JSON.');
        expect(out.result.explanation).toBe('');
    });
});

describe('caching', () => {
    const input = { clause: 'A.5.18', question: 'Q', requirements: [], remark: 'seen', images: [{ evId: 'EV-1', src: 'https://x/a.png' }] };

    it('unchanged inputs reuse the earlier result with no call; a changed remark or screenshot calls again', async () => {
        AI.callProxyAPI = vi.fn(async () => reply({ images: [], explanation: 'Image 1 shows a register.', gaps: [], suggestedAssessment: 'supports' }));
        const first = await AI.explainEvidence(input);
        const again = await AI.explainEvidence(input, { cached: first });
        expect(again.fromCache).toBe(true);
        expect(AI.callProxyAPI).toHaveBeenCalledTimes(1);
        await AI.explainEvidence(Object.assign({}, input, { remark: 'seen and signed' }), { cached: first });
        await AI.explainEvidence(Object.assign({}, input, { images: [{ evId: 'EV-1', src: 'https://x/b.png' }] }), { cached: first });
        expect(AI.callProxyAPI).toHaveBeenCalledTimes(3);
    });

    it('a rejected result is not reused', async () => {
        AI.callProxyAPI = vi.fn(async () => reply({ images: [], explanation: 'x.', gaps: [], suggestedAssessment: 'supports' }));
        const first = await AI.explainEvidence(input);
        await AI.explainEvidence(input, { cached: Object.assign({}, first, { status: 'rejected' }) });
        expect(AI.callProxyAPI).toHaveBeenCalledTimes(2);
    });
});

describe('it never writes to the checklist answer', () => {
    it('the answer is unchanged after building the input and explaining it', async () => {
        const item = { clause: 'A.5.18', status: '', comment: 'seen', evidenceImages: ['https://x/a.png'] };
        const before = JSON.stringify(item);
        AI.callProxyAPI = vi.fn(async () => reply({ images: [], explanation: 'Image 1 shows a register.', gaps: [], suggestedAssessment: 'supports' }));
        await AI.explainEvidence(AI.evidenceInputFor(item, { standard: 'ISO/IEC 27001:2022' }));
        expect(JSON.stringify(item)).toBe(before);
    });
});

describe('callProxyAPI options', () => {
    it('sends images and JSON to the proxy and can return usage with the text', async () => {
        loadScript('./ai-service.js', { params: { module: undefined } });
        const A = window.AI_SERVICE;
        A.proxyHeaders = async () => ({ 'Content-Type': 'application/json' });
        window.APIUsageTracker = { logUsage: vi.fn(), estimateTokens: () => 1 };
        let body;
        globalThis.fetch = vi.fn(async (url, opts) => { body = JSON.parse(opts.body); return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] }, finishReason: 'STOP' }], usage: { promptTokenCount: 10, candidatesTokenCount: 2, thoughtsTokenCount: 3 } }) }; });
        const out = await A.callProxyAPI('p', { images: [{ mimeType: 'image/jpeg', data: 'QUJD' }], json: true, withUsage: true, feature: 'evidence-explanation', temperature: 0.1 });
        expect(body).toMatchObject({ prompt: 'p', json: true, temperature: 0.1, images: [{ mimeType: 'image/jpeg', data: 'QUJD' }] });
        expect(out).toMatchObject({ text: '{"a":1}', usage: { promptTokenCount: 10 } });
        expect(window.APIUsageTracker.logUsage).toHaveBeenCalledWith(expect.objectContaining({ feature: 'evidence-explanation', inputTokens: 10, outputTokens: 5 }));
        delete globalThis.fetch;
    });
});
