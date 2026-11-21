// Evidence mapping check (PC Connection, 2026-11-20): 19 of 118 screenshots
// sat under a different question from the one they supported. The check
// proposes where each belongs; only what the auditor chooses is moved.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import fs from 'fs';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

beforeAll(() => {
    loadScript('./utils.js', { global: true });
    loadScript('./report-stats.js', { global: true });
    loadScript('./ai-service.js', { params: { module: undefined } });
    loadScript('./evidence-mapping.js', { params: { module: undefined } });
});

const img = (n) => 'https://x.supabase.co/storage/v1/object/public/audit-images/ncr-evidence/cl1-' + n + '.jpg';
let report;
let AI;
let EM;
let realMap;
let realMatch;
let realVerify;
beforeEach(() => {
    AI = window.AI_SERVICE;
    EM = window.EvidenceMapping;
    EM.forget();
    realMap = realMap || AI.mapEvidence;
    AI.mapEvidence = realMap;
    realMatch = realMatch || AI.matchEvidenceToQuestions;
    realVerify = realVerify || AI.verifyEvidenceFor;
    // The search for questions with no screenshot is off unless a test turns
    // it on: the screen then falls back to the "also supports" lists.
    AI.matchEvidenceToQuestions = vi.fn(async () => { throw new Error('off in this test'); });
    AI.verifyEvidenceFor = vi.fn(async () => { throw new Error('off in this test'); });
    report = { id: 'r1', checklistProgress: [
        { checklistId: 'cl1', itemIdx: 'A-0', clause: 'A.5.26', status: 'conform', requirement: 'Review incidents and security events across the period.', comment: '',
            evidenceImages: [img('chg')], evidenceImage: img('chg'), evidenceCapturedAtList: ['2026-11-18T13:28:10.112Z'], evidenceCapturedAt: '2026-11-18T13:28:10.112Z' },
        { checklistId: 'cl1', itemIdx: 'A-1', clause: '8.5.1', status: 'conform', requirement: 'Sample changes including one emergency change: approval, testing and review.', comment: 'Azure Service',
            evidenceImages: [img('ops1'), img('ops2')], evidenceCapturedAtList: ['2026-11-18T15:01:00.000Z', '2026-11-18T15:02:00.000Z'], evidenceCapturedAt: '2026-11-18T15:01:00.000Z', _evIds: ['EV-01', 'EV-02'], evidenceThumbs: ['t1', 't2'] },
        { checklistId: 'cl1', itemIdx: 'A-2', clause: 'A.8.32', status: '', requirement: 'Sample A.8.32 Change management.' },
        { checklistId: 'cl1', itemIdx: 'A-3', clause: '8.4.1', status: 'conform', requirement: 'Verify service costs are budgeted and tracked.', comment: 'Its done annually.', evidenceImage: img('policy') },
        { isCustom: true, itemIdx: 0, clause: 'A.6.7', status: 'conform', requirement: 'Sample A.6.7 Remote working.' }
    ] };
    window.state = { auditReports: [report], checklists: [], currentUser: { name: 'Lead Auditor' } };
    globalThis.state = window.state;
    window.EvidenceUtils = { compress: vi.fn(async (src) => 'data:image/jpeg;base64,' + Buffer.from(String(src).slice(-12)).toString('base64')) };
    window.showNotification = vi.fn();
    window.saveChecklist = vi.fn();
    window.runReportIntegrityCheck = vi.fn();
    window.closeModal = vi.fn();
    window.DataService = { openFormModal: (title, html, onSave) => { document.body.innerHTML = '<h2 id="t">' + title + '</h2>' + html; window.__save = onSave; } };
});

const reply = (obj) => ({ text: JSON.stringify(obj), usage: { promptTokenCount: 4000, candidatesTokenCount: 200 }, model: 'gemini-2.0-flash-lite' });
const QUESTIONS = [
    { n: 1, clause: 'A.5.26', text: 'Review incidents and security events across the period.' },
    { n: 2, clause: '8.5.1', text: 'Sample changes including one emergency change.' },
    { n: 3, clause: 'A.8.32', text: 'Sample A.8.32 Change management.' }
];
const INPUT = { current: QUESTIONS[0], questions: QUESTIONS, images: [{ evId: 'Image 1', src: img('chg') }, { evId: 'Image 2', src: img('b') }] };

describe('the AI call', () => {
    it('sends the question the screenshots are under and every question on the checklist, on the evidence model only', async () => {
        AI.callProxyAPI = vi.fn(async () => reply({ images: [] }));
        await AI.mapEvidence(INPUT);
        expect(AI.callProxyAPI).toHaveBeenCalledTimes(1);
        const [prompt, opts] = AI.callProxyAPI.mock.calls[0];
        expect(prompt).toContain('FILED UNDER item 1 (A.5.26)');
        expect(prompt).toContain('2 | 8.5.1 | Sample changes including one emergency change.');
        expect(prompt).toContain('You do not decide conformity');
        expect(prompt).toContain('Be conservative with "none"');
        expect(prompt).toContain('Never give a clause number');
        expect(opts).toMatchObject({ json: true, withUsage: true, feature: 'evidence-mapping', models: ['gemini-2.0-flash-lite'] });
        expect(opts.images).toHaveLength(2);
    });

    it('tries once more when the reply cannot be read, then says so instead of calling the images unreadable', async () => {
        AI.callProxyAPI = vi.fn()
            .mockResolvedValueOnce({ text: '{"images":[{"evId":"Image 1","shows":"A li', usage: {}, model: 'm' })
            .mockResolvedValueOnce(reply({ images: [{ evId: 'Image 1', shows: 'A list.', here: 'direct', bestItem: 1 }, { evId: 'Image 2', shows: 'A list.', here: 'direct', bestItem: 1 }] }));
        const out = await AI.mapEvidence(INPUT);
        expect(AI.callProxyAPI).toHaveBeenCalledTimes(2);
        expect(out.images.map((i) => i.fit)).toEqual(['fits', 'fits']);
        AI.callProxyAPI = vi.fn(async () => ({ text: 'not json', usage: {}, model: 'm' }));
        await expect(AI.mapEvidence(INPUT)).rejects.toThrow('The AI reply could not be read.');
        expect(AI.callProxyAPI).toHaveBeenCalledTimes(2);
    });

    it('sends nothing when no screenshot can be loaded', async () => {
        window.EvidenceUtils.compress = vi.fn(async () => { throw new Error('403'); });
        AI.callProxyAPI = vi.fn();
        const out = await AI.mapEvidence(INPUT);
        expect(out.status).toBe('nothing');
        expect(out.imagesFailed).toHaveLength(2);
        expect(AI.callProxyAPI).not.toHaveBeenCalled();
    });
});

describe('the reply is checked before it becomes a proposal', () => {
    const run = async (images) => { AI.callProxyAPI = vi.fn(async () => reply({ images })); return AI.mapEvidence(INPUT); };
    const im = (evId, here, bestItem, extra) => Object.assign({ evId, shows: 'A list.', visibleText: [], here, bestItem, alsoItems: [], reason: '' }, extra);

    it('proposes a move only for an image rated "none" where it is, to a question on the checklist', async () => {
        const out = await run([
            im('Image 1', 'none', 2, { shows: 'A Change Requests list with approval status.', visibleText: ['Change Requests', 'Emergency', 'Approved'], alsoItems: [3, 2, 99], reason: 'It lists Change Requests with their approval.' }),
            im('Image 2', 'direct', 1, { shows: 'An incident ticket.', visibleText: ['Incident'] })
        ]);
        expect(out.images[0]).toMatchObject({ here: 'none', fit: 'fits_better_elsewhere', betterItem: 2, alsoItems: [3], shows: 'A Change Requests list with approval status.' });
        expect(out.images[1]).toMatchObject({ here: 'direct', fit: 'fits', betterItem: null, alsoItems: [] });
        expect(out.flags).toEqual([]);
    });

    it('an image that fits where it is stays, even when another question matches it better', async () => {
        const out = await run([im('Image 1', 'partial', 2, { alsoItems: [3] }), im('Image 2', 'direct', 3)]);
        expect(out.images.map((i) => [i.fit, i.betterItem, i.alsoItems])).toEqual([['fits', null, [2, 3]], ['fits', null, [3]]]);
    });

    it('takes item numbers only: a clause number or a question off the checklist proposes nothing', async () => {
        const out = await run([
            im('Image 1', 'none', 42),
            im('Image 2', 'none', '8.5.1', { alsoItems: ['A.8.32', '3', 1] })
        ]);
        expect(out.images.map((i) => [i.fit, i.betterItem, i.alsoItems])).toEqual([['fits', null, []], ['fits', null, [3]]]);
        expect(out.flags.filter((f) => f.includes('not on this checklist'))).toHaveLength(2);
    });

    it('rated "none" with no better question: not evidence for any question; "none" but best where it is: left alone', async () => {
        const out = await run([im('Image 1', 'none', null), im('Image 2', 'none', 1)]);
        expect(out.images.map((i) => i.fit)).toEqual(['unrelated', 'fits']);
    });

    it('a reply with no rating proposes nothing', async () => {
        const out = await run([{ evId: 'Image 1', shows: 'A list.', bestItem: 2 }, im('Image 2', 'maybe', 2)]);
        expect(out.images.map((i) => [i.here, i.fit, i.betterItem])).toEqual([['direct', 'fits', null], ['direct', 'fits', null]]);
    });

    it('reads nothing from an unreadable image, and says so when an image is not described', async () => {
        const out = await run([im('Image 1', 'unreadable', 2, { shows: 'Change log', visibleText: ['x'], alsoItems: [3], reason: 'r' })]);
        expect(out.images[0]).toEqual({ evId: 'Image 1', shows: 'Text not legible.', visibleText: [], here: 'unreadable', fit: 'unreadable', betterItem: null, alsoItems: [], reason: '' });
        expect(out.images[1].fit).toBe('unreadable');
        expect(out.flags.join(' ')).toContain('Image 2: the AI did not describe this image.');
    });

    it('matches a reply with no image id by its position', async () => {
        const out = await run([im('', 'none', 2), im('', 'direct', 1)]);
        expect(out.images.map((i) => i.evId + ':' + i.fit)).toEqual(['Image 1:fits_better_elsewhere', 'Image 2:fits']);
    });

    it('keeps a description that names the document: a Non-Conformity Register is not a judgement', async () => {
        const out = await run([
            im('Image 1', 'none', 2, { shows: 'A Non-Conformity Register listing non-conformities and corrective action plans.', visibleText: ['Non-Conformity Register'], reason: 'It lists non-conformities with their corrective actions.' }),
            im('Image 2', 'direct', 1, { shows: 'A dashboard headed Fully compliant devices.', visibleText: ['Fully compliant devices'] })
        ]);
        expect(out.images[0].shows).toBe('A Non-Conformity Register listing non-conformities and corrective action plans.');
        expect(out.images[0].reason).toBe('It lists non-conformities with their corrective actions.');
        expect(out.images[1].shows).toBe('A dashboard headed Fully compliant devices.');
        expect(out.flags).toEqual([]);
    });

    it('removes conformity wording and names the AI did not quote from the screenshot', async () => {
        const out = await run([
            im('Image 1', 'none', 2, { shows: 'The Access Control Policy is shown.', visibleText: ['Change Requests'], reason: 'This shows the process is compliant.' }),
            im('Image 2', 'direct', 1, { shows: 'An incident ticket.' })
        ]);
        expect(out.images[0].shows).toBe('');
        expect(out.images[0].reason).toBe('');
        expect(out.images[0].betterItem).toBe(2);
        expect(out.flags).toHaveLength(2);
    });
});

describe('what is checked', () => {
    it('numbers the questions as the auditor sees them and keys them like the checklist merge', () => {
        const q = EM.questionIndex(report);
        expect(q.map((x) => x.n + ':' + x.key + ':' + x.clause)).toEqual(['1:cl1-A-0:A.5.26', '2:cl1-A-1:8.5.1', '3:cl1-A-2:A.8.32', '4:cl1-A-3:8.4.1', '5:custom-0:A.6.7']);
    });

    it('one group per question with screenshots, split at six, including a lone legacy image', () => {
        report.checklistProgress[1].evidenceImages = [1, 2, 3, 4, 5, 6, 7].map((n) => img('o' + n));
        const b = EM.batches(report);
        expect(b.map((x) => x.n + ':' + x.images.length)).toEqual(['1:1', '2:6', '2:1', '4:1']);
        expect(b[2].images[0].evId).toBe('Image 7');
        expect(EM.totals(report)).toEqual({ images: 9, questions: 3 });
    });

    it('builds one row per screenshot, and a failed call leaves its screenshots unchecked', async () => {
        AI.mapEvidence = vi.fn(async (input) => {
            if (input.current.n === 2) throw new Error('quota');
            if (input.current.n === 1) return { images: [{ evId: 'Image 1', shows: 'A Change Requests list.', fit: 'fits_better_elsewhere', betterItem: 2, alsoItems: [3], reason: 'It lists changes.' }], imagesFailed: [], flags: [] };
            return { images: [], imagesFailed: [{ evId: 'Image 1', reason: 'Could not be loaded (403); not sent.' }], flags: [] };
        });
        const progress = vi.fn();
        const res = await EM.check(report, { onProgress: progress });
        expect(res.calls).toBe(3);
        expect(res.failedCalls).toBe(1);
        expect(progress).toHaveBeenLastCalledWith(3, 3);
        expect(res.rows.map((r) => r.from.n + ':' + r.fit)).toEqual(['1:fits_better_elsewhere', '2:unchecked', '2:unchecked', '4:unchecked']);
        expect(res.rows[0].to).toMatchObject({ n: 2, key: 'cl1-A-1', clause: '8.5.1', empty: false });
        // Item 3 has no screenshot of its own.
        expect(res.rows[0].also).toEqual([expect.objectContaining({ key: 'cl1-A-2', empty: true })]);
        expect(res.rows[1].error).toBe('quota');
        expect(res.rows[3].error).toContain('403');
        // The whole checklist goes with every call, so the AI can only name a real question.
        expect(AI.mapEvidence.mock.calls[0][0].questions).toHaveLength(5);
        const p = EM.proposals(res.rows);
        expect([p.move.length, p.unchecked.length, p.fits.length]).toEqual([1, 3, 0]);
    });

    it('stops when asked', async () => {
        AI.mapEvidence = vi.fn(async () => ({ images: [], imagesFailed: [], flags: [] }));
        const res = await EM.check(report, { shouldStop: () => true });
        expect(res.stopped).toBe(true);
        expect(AI.mapEvidence).not.toHaveBeenCalled();
    });
});

describe('moving a screenshot', () => {
    it('Move takes it, with its capture time, to the other question and records where it came from', () => {
        const res = EM.apply(report, [{ src: img('chg'), fromKey: 'cl1-A-0', toKey: 'cl1-A-1', mode: 'move' }]);
        expect(res).toEqual({ moved: 1, copied: 0, skipped: 0 });
        const [from, to] = report.checklistProgress;
        expect(from.evidenceImages).toEqual([]);
        expect(from.evidenceImage).toBe('');
        expect(from.evidenceCapturedAt).toBe('');
        expect(to.evidenceImages).toEqual([img('ops1'), img('ops2'), img('chg')]);
        expect(to.evidenceCapturedAtList).toEqual(['2026-11-18T15:01:00.000Z', '2026-11-18T15:02:00.000Z', '2026-11-18T13:28:10.112Z']);
        expect(to.evidenceCapturedAt).toBe('2026-11-18T15:01:00.000Z');
        expect(to.evidenceRemapLog[0]).toMatchObject({ mode: 'move', from: 'cl1-A-0', fromClause: 'A.5.26', file: 'cl1-chg.jpg', by: 'Lead Auditor' });
        // Report-time copies no longer line up with the list: dropped, rebuilt later.
        expect(to._evIds).toBeUndefined();
        expect(to.evidenceThumbs).toBeUndefined();
        // Results and remarks are untouched.
        expect(report.checklistProgress.map((i) => i.status)).toEqual(['conform', 'conform', '', 'conform', 'conform']);
        expect(to.comment).toBe('Azure Service');
    });

    it('Also attach leaves the original where it is, and works for a question with no screenshots yet', () => {
        const res = EM.apply(report, [
            { src: img('chg'), fromKey: 'cl1-A-0', toKey: 'cl1-A-2', mode: 'copy' },
            { src: img('policy'), fromKey: 'cl1-A-3', toKey: 'custom-0', mode: 'move' }
        ]);
        expect(res).toEqual({ moved: 1, copied: 1, skipped: 0 });
        expect(report.checklistProgress[0].evidenceImages).toEqual([img('chg')]);
        expect(report.checklistProgress[2]).toMatchObject({ evidenceImages: [img('chg')], evidenceImage: img('chg'), evidenceCapturedAt: '2026-11-18T13:28:10.112Z' });
        // A lone legacy evidenceImage moves too.
        expect(report.checklistProgress[3]).toMatchObject({ evidenceImages: [], evidenceImage: '' });
        expect(report.checklistProgress[4].evidenceImages).toEqual([img('policy')]);
    });

    it('skips a screenshot that is no longer under the question it was checked under', () => {
        const before = JSON.stringify(report.checklistProgress);
        const res = EM.apply(report, [
            { src: img('gone'), fromKey: 'cl1-A-0', toKey: 'cl1-A-1', mode: 'move' },
            { src: img('chg'), fromKey: 'cl1-A-0', toKey: 'cl1-nope', mode: 'move' },
            { src: img('chg'), fromKey: 'cl1-A-0', toKey: 'cl1-A-0', mode: 'move' },
            { src: img('chg'), fromKey: 'cl1-A-0', toKey: 'cl1-A-1', mode: 'delete' }
        ]);
        expect(res).toEqual({ moved: 0, copied: 0, skipped: 4 });
        expect(JSON.stringify(report.checklistProgress)).toBe(before);
    });

    it('never attaches the same screenshot twice', () => {
        EM.apply(report, [{ src: img('chg'), fromKey: 'cl1-A-0', toKey: 'cl1-A-1', mode: 'copy' }]);
        EM.apply(report, [{ src: img('chg'), fromKey: 'cl1-A-0', toKey: 'cl1-A-1', mode: 'move' }]);
        expect(report.checklistProgress[1].evidenceImages.filter((s) => s === img('chg'))).toHaveLength(1);
        expect(report.checklistProgress[0].evidenceImages).toEqual([]);
    });

    it('names the questions a move would leave with no screenshot', () => {
        const h = EM.hollowAfter(report, [
            { src: img('chg'), fromKey: 'cl1-A-0', toKey: 'cl1-A-1', mode: 'move' },
            { src: img('ops1'), fromKey: 'cl1-A-1', toKey: 'cl1-A-2', mode: 'move' },
            { src: img('policy'), fromKey: 'cl1-A-3', toKey: 'custom-0', mode: 'copy' }
        ]);
        expect(h).toEqual([{ n: 1, clause: 'A.5.26', remark: false }]);
    });
});

describe('the review screen', () => {
    const proposal = () => ({
        images: [{ evId: 'Image 1', shows: 'A Change Requests list.', fit: 'fits_better_elsewhere', betterItem: 2, alsoItems: [3], reason: 'It lists changes with approvals.' }],
        imagesFailed: [], flags: []
    });
    const start = async () => {
        window.openEvidenceMapping('r1');
        document.getElementById('em-start').click();
        await vi.waitFor(() => expect(document.querySelector('.em-choice')).not.toBeNull());
    };
    beforeEach(() => {
        AI.mapEvidence = vi.fn(async (input) => (input.current.n === 1 ? proposal() : { images: input.images.map((im) => ({ evId: im.evId, shows: 'A dashboard.', fit: 'fits', betterItem: null, alsoItems: [], reason: '' })), imagesFailed: [], flags: [] }));
    });

    it('says what will be sent, and sends nothing until the auditor starts it', () => {
        window.openEvidenceMapping('r1');
        expect(document.body.textContent).toContain('4 screenshots on 3 questions will be sent to the AI service twice, in 6 requests. It takes about 1 minute.');
        expect(document.body.textContent).toContain('A move that both checks agree on is marked Strong');
        expect(document.body.textContent).toContain('Nothing moves unless you choose it and press Save.');
        expect(window.__save).toBeNull();
        expect(AI.mapEvidence).not.toHaveBeenCalled();
    });

    it('every proposal starts as "Leave where it is"; Save with nothing chosen writes nothing', async () => {
        await start();
        expect(document.getElementById('t').textContent).toBe('Evidence mapping — 1 to review');
        expect(document.body.textContent).toContain('4 screenshots checked: 3 fit the question they are under, 1 may belong with another question (1 strong).');
        const choice = document.querySelector('.em-choice');
        expect(choice.value).toBe('');
        expect(Array.from(choice.options).map((o) => o.textContent)).toEqual(['Leave where it is', 'Move to item 2 · 8.5.1', 'Also attach to item 2 · 8.5.1', 'Also attach to item 3 · A.8.32']);
        const before = JSON.stringify(report.checklistProgress);
        window.__save();
        expect(JSON.stringify(report.checklistProgress)).toBe(before);
        expect(window.saveChecklist).not.toHaveBeenCalled();
        expect(window.showNotification).toHaveBeenCalledWith('Nothing was chosen, so nothing was moved.', 'info');
    });

    it('warns which question is left empty, then Save moves the chosen screenshot through saveChecklist once', async () => {
        await start();
        const choice = document.querySelector('.em-choice');
        choice.value = 'move:cl1-A-1';
        choice.dispatchEvent(new Event('change', { bubbles: true }));
        expect(document.getElementById('em-hollow').textContent).toBe('After these moves, item 1 (A.5.26, no remark either) would have no screenshot of its own.');
        window.__save();
        expect(report.checklistProgress[0].evidenceImages).toEqual([]);
        expect(report.checklistProgress[1].evidenceImages).toContain(img('chg'));
        expect(window.saveChecklist).toHaveBeenCalledTimes(1);
        expect(window.saveChecklist).toHaveBeenCalledWith('r1');
        expect(window.runReportIntegrityCheck).toHaveBeenCalledWith('r1');
        expect(window.showNotification).toHaveBeenCalledWith('Screenshots: moved 1.', 'success');
    });

    it('shows the same results again without another call until a screenshot moves', async () => {
        await start();
        const calls = AI.mapEvidence.mock.calls.length;
        window.openEvidenceMapping('r1');
        expect(document.querySelector('.em-choice')).not.toBeNull();
        expect(AI.mapEvidence.mock.calls.length).toBe(calls);
        document.querySelector('.em-choice').value = 'copy:cl1-A-2';
        window.__save();
        window.openEvidenceMapping('r1');
        expect(document.getElementById('em-start')).not.toBeNull();
    });

    it('lists a question with no screenshot once, with at most two screenshots from elsewhere that also support it', async () => {
        report.checklistProgress[1].evidenceImages = [img('ops1'), img('ops2'), img('ops3')];
        report.checklistProgress[4].status = 'not_sampled';
        AI.mapEvidence = vi.fn(async (input) => ({
            // Item 1's screenshot also supports item 2 (has its own: not listed).
            // Item 2's three all also support item 3 (none) and item 5 (not sampled: not listed).
            images: input.images.map((image, k) => ({ evId: image.evId, shows: 'A dashboard.', here: k === 2 ? 'direct' : 'partial', fit: 'fits', betterItem: null, alsoItems: input.current.n === 1 ? [2] : (input.current.n === 2 ? [3, 5] : []), reason: 'It shows the change.' })),
            imagesFailed: [], flags: []
        }));
        await start();
        expect(document.getElementById('t').textContent).toBe('Evidence mapping — 0 to review');
        expect(document.body.textContent).toContain('item 3 · A.8.32 has no screenshot of its own: Sample A.8.32 Change management. (2 of 3 shown)');
        const rows = Array.from(document.querySelectorAll('.em-row'));
        expect(rows).toHaveLength(2);
        // The directly fitting one comes first.
        expect(rows[0].querySelector('img').getAttribute('src')).toBe(img('ops3'));
        expect(Array.from(rows[0].querySelector('.em-choice').options).map((o) => o.textContent)).toEqual(['Leave where it is', 'Also attach to item 3 · A.8.32']);
        expect(document.body.textContent).toContain('5 screenshots checked: 5 fit the question they are under.');
        rows[0].querySelector('.em-choice').value = 'copy:cl1-A-2';
        window.__save();
        expect(report.checklistProgress[2].evidenceImages).toEqual([img('ops3')]);
        expect(report.checklistProgress[1].evidenceImages).toHaveLength(3);
        expect(window.showNotification).toHaveBeenCalledWith('Screenshots: attached 1 to another question.', 'success');
    });

    it('escapes what the AI wrote', async () => {
        AI.mapEvidence = vi.fn(async (input) => (input.current.n === 1
            ? { images: [{ evId: 'Image 1', shows: '<img src=x onerror=alert(1)>', fit: 'fits_better_elsewhere', betterItem: 2, alsoItems: [], reason: '<b>r</b>' }], imagesFailed: [], flags: [] }
            : { images: [], imagesFailed: [], flags: [] }));
        await start();
        expect(document.querySelector('.em-row img[src="x"]')).toBeNull();
        expect(document.querySelector('.em-row b')).toBeNull();
    });

    it('has nothing to do without screenshots', () => {
        report.checklistProgress.forEach((i) => { delete i.evidenceImages; delete i.evidenceImage; });
        window.openEvidenceMapping('r1');
        expect(window.showNotification).toHaveBeenCalledWith('No screenshots are attached to this checklist.', 'info');
    });
});

describe('two checks of every screenshot', () => {
    const move = (to, extra) => Object.assign({ evId: 'Image 1', shows: 'A Change Requests list.', here: 'none', fit: 'fits_better_elsewhere', betterItem: to, alsoItems: [], reason: 'It lists changes.' }, extra);
    const fits = (evId, also) => ({ evId, shows: 'A dashboard.', here: 'direct', fit: 'fits', betterItem: null, alsoItems: also || [], reason: '' });
    // What each of the two readings says about item 1's screenshot; the rest fit.
    const twice = (first, second) => {
        let seen = 0;
        window.AI_SERVICE.mapEvidence = vi.fn(async (input) => {
            if (input.current.n !== 1) return { images: input.images.map((i) => fits(i.evId)), imagesFailed: [], flags: [] };
            const reading = seen++ === 0 ? first : second;
            if (reading instanceof Error) throw reading;
            return { images: [reading], imagesFailed: [], flags: [] };
        });
    };
    const row1 = async () => (await window.EvidenceMapping.check(report, { passes: 2, concurrency: 1 })).rows[0];

    it('asks twice, every screenshot once before any is read again', async () => {
        twice(move(2), move(2));
        const res = await window.EvidenceMapping.check(report, { passes: 2, concurrency: 1 });
        expect(res.calls).toBe(6);
        expect(res.passes).toBe(2);
        expect(window.AI_SERVICE.mapEvidence.mock.calls.map((c) => c[0].current.n)).toEqual([1, 2, 4, 1, 2, 4]);
        expect(res.rows).toHaveLength(4);
    });

    it('a move both checks agree on is strong', async () => {
        twice(move(2), move(2));
        expect(await row1()).toMatchObject({ fit: 'fits_better_elsewhere', strength: 'strong', doubt: '', alt: null, to: { key: 'cl1-A-1' } });
    });

    it('a move only one check proposes is possible, and says why', async () => {
        twice(move(2), fits('Image 1'));
        expect(await row1()).toMatchObject({ fit: 'fits_better_elsewhere', strength: 'possible', doubt: 'Not every check proposed a move.' });
        twice(fits('Image 1'), move(2));
        expect(await row1()).toMatchObject({ fit: 'fits_better_elsewhere', strength: 'possible', to: { key: 'cl1-A-1' } });
    });

    it('two different questions: possible, with the other one kept as an alternative', async () => {
        twice(move(2), move(3));
        expect(await row1()).toMatchObject({ strength: 'possible', doubt: 'The checks proposed different questions.', to: { key: 'cl1-A-1' }, alt: { key: 'cl1-A-2' } });
    });

    it('one check failed: a single reading is never strong', async () => {
        twice(move(2), new Error('quota'));
        expect(await row1()).toMatchObject({ fit: 'fits_better_elsewhere', strength: 'possible', doubt: 'Only one check gave a reading.' });
        twice(new Error('quota'), new Error('quota'));
        expect(await row1()).toMatchObject({ fit: 'unchecked', error: 'quota' });
    });

    it('both say it fits: it fits, and a question both named as also supported is marked', async () => {
        twice(fits('Image 1', [3]), fits('Image 1', [3, 5]));
        const row = await row1();
        expect(row.fit).toBe('fits');
        expect(row.also.map((p) => p.key + ':' + p.agreed)).toEqual(['cl1-A-2:true', 'custom-0:false']);
    });

    it('a single check carries no strength at all', async () => {
        twice(move(2), move(2));
        const res = await window.EvidenceMapping.check(report, { concurrency: 1 });
        expect(res.calls).toBe(3);
        expect(res.rows[0].strength).toBe('');
        expect(window.EvidenceMapping.proposals(res.rows).strong).toHaveLength(0);
    });

    describe('on the review screen', () => {
        const start = async () => {
            window.openEvidenceMapping('r1');
            document.getElementById('em-start').click();
            await vi.waitFor(() => expect(document.querySelector('.em-choice')).not.toBeNull());
        };

        it('strong rows come first with a badge, and "Accept all strong" sets only those to Move', async () => {
            // Item 1: both checks agree. Item 4: only the first proposes a move.
            const seen = {};
            window.AI_SERVICE.mapEvidence = vi.fn(async (input) => {
                const n = input.current.n;
                seen[n] = (seen[n] || 0) + 1;
                if (n === 1) return { images: [move(2)], imagesFailed: [], flags: [] };
                if (n === 4) return { images: [seen[n] === 1 ? move(5, { shows: 'A policy.' }) : fits('Image 1')], imagesFailed: [], flags: [] };
                return { images: input.images.map((i) => fits(i.evId)), imagesFailed: [], flags: [] };
            });
            await start();
            expect(document.body.textContent).toContain('2 may belong with another question (1 strong)');
            expect(document.body.textContent).toContain('Strong means every check proposed the same question.');
            const rows = Array.from(document.querySelectorAll('.em-row'));
            expect(rows.map((r) => r.querySelector('.em-strength').textContent)).toEqual(['STRONG', 'POSSIBLE']);
            expect(rows[1].textContent).toContain('Not every check proposed a move.');
            const choices = rows.map((r) => r.querySelector('.em-choice'));
            expect(choices.map((c) => c.value)).toEqual(['', '']);
            const accept = document.getElementById('em-accept-strong');
            expect(accept.textContent).toBe('Accept all strong (1)');
            accept.click();
            expect(choices.map((c) => c.value)).toEqual(['move:cl1-A-1', '']);
            expect(document.getElementById('em-accepted').textContent).toBe('1 set to Move. Press Save to apply them.');
            // The "left empty" warning follows the bulk choice too.
            expect(document.getElementById('em-hollow').textContent).toContain('item 1 (A.5.26, no remark either)');
            // Nothing has moved yet.
            expect(report.checklistProgress[0].evidenceImages).toEqual([img('chg')]);
            document.getElementById('em-clear').click();
            expect(choices.map((c) => c.value)).toEqual(['', '']);
            accept.click();
            window.__save();
            expect(report.checklistProgress[0].evidenceImages).toEqual([]);
            expect(report.checklistProgress[3].evidenceImage).toBe(img('policy'));
            expect(window.showNotification).toHaveBeenCalledWith('Screenshots: moved 1.', 'success');
        });

        it('offers the other check’s question when the two differ, and no Accept button without a strong row', async () => {
            let seen = 0;
            window.AI_SERVICE.mapEvidence = vi.fn(async (input) => {
                if (input.current.n !== 1) return { images: input.images.map((i) => fits(i.evId)), imagesFailed: [], flags: [] };
                return { images: [move(seen++ === 0 ? 2 : 3)], imagesFailed: [], flags: [] };
            });
            await start();
            expect(document.getElementById('em-accept-strong')).toBeNull();
            const choice = document.querySelector('.em-choice');
            expect(Array.from(choice.options).map((o) => o.textContent)).toEqual(['Leave where it is', 'Move to item 2 · 8.5.1', 'Also attach to item 2 · 8.5.1', 'Move to item 3 · A.8.32']);
            expect(document.querySelector('.em-row').textContent).toContain('The checks proposed different questions. The other was item 3 · A.8.32.');
        });
    });
});

describe('evidence for questions with no screenshot', () => {
    const SHOTS = [
        { id: 'S1', item: 1, clause: 'A.5.26', shows: 'A Change Requests list with approvals.' },
        { id: 'S2', item: 2, clause: '8.5.1', shows: 'A list of Azure resources.' }
    ];
    const GAPS = [
        { n: 3, clause: 'A.8.32', text: 'Sample A.8.32 Change management. Pre-audit gap: no documented information was on file.' },
        { n: 5, clause: 'A.6.7', text: 'Sample A.6.7 Remote working.' }
    ];

    describe('step 1: which screenshots fit, from their descriptions', () => {
        beforeEach(() => { AI.matchEvidenceToQuestions = realMatch; });

        it('one text call with every such question and every screenshot, and no planning notes', async () => {
            AI.callProxyAPI = vi.fn(async () => reply({ matches: [] }));
            await AI.matchEvidenceToQuestions({ questions: GAPS, screenshots: SHOTS });
            expect(AI.callProxyAPI).toHaveBeenCalledTimes(1);
            const [prompt, opts] = AI.callProxyAPI.mock.calls[0];
            expect(prompt).toContain('3 | A.8.32 | Sample A.8.32 Change management.');
            expect(prompt).not.toContain('Pre-audit gap');
            expect(prompt).toContain('S1 | filed under item 1 (A.5.26) | A Change Requests list with approvals.');
            expect(prompt).toContain('Be strict.');
            expect(opts.images).toBeUndefined();
            expect(opts).toMatchObject({ json: true, feature: 'evidence-mapping', models: ['gemini-2.0-flash-lite'] });
        });

        it('keeps only questions that were asked and screenshots that exist, three at most', async () => {
            AI.callProxyAPI = vi.fn(async () => reply({ matches: [
                { item: 3, screenshots: ['S1', 'S9', 'S1', 'S2', 'S2'] },
                { item: 42, screenshots: ['S1'] },
                { item: '5', screenshots: 'S2' }
            ] }));
            const out = await AI.matchEvidenceToQuestions({ questions: GAPS, screenshots: SHOTS });
            expect(out.matches).toEqual([{ n: 3, ids: ['S1', 'S2'] }, { n: 5, ids: [] }]);
        });

        it('makes no call with nothing to match, and says so when the reply cannot be read', async () => {
            AI.callProxyAPI = vi.fn(async () => ({ text: 'oops', usage: {}, model: 'm' }));
            expect((await AI.matchEvidenceToQuestions({ questions: [], screenshots: SHOTS })).matches).toEqual([]);
            expect(AI.callProxyAPI).not.toHaveBeenCalled();
            await expect(AI.matchEvidenceToQuestions({ questions: GAPS, screenshots: SHOTS })).rejects.toThrow('could not be read');
        });
    });

    describe('step 2: each candidate against the image', () => {
        beforeEach(() => { AI.verifyEvidenceFor = realVerify; });
        const input = { question: GAPS[0], images: [{ evId: 'S1', src: img('chg') }, { evId: 'S2', src: img('ops1') }] };

        it('sends the one question with the candidate images', async () => {
            AI.callProxyAPI = vi.fn(async () => reply({ images: [] }));
            await AI.verifyEvidenceFor(input);
            const [prompt, opts] = AI.callProxyAPI.mock.calls[0];
            expect(prompt).toContain('QUESTION — item 3 (A.8.32):');
            expect(prompt).not.toContain('Pre-audit gap');
            expect(prompt).toContain('Image 1 = S1; Image 2 = S2');
            expect(prompt).toContain('only if an auditor answering this question would attach it');
            expect(opts.images).toHaveLength(2);
        });

        it('an image that is not rated, or rated oddly, counts as none; a judgement is not kept as the reason', async () => {
            AI.callProxyAPI = vi.fn(async () => reply({ images: [
                { evId: 'S1', support: 'direct', visibleText: ['Change Requests'], reason: 'It lists Change Requests with their approval status.' }
            ] }));
            let out = await AI.verifyEvidenceFor(input);
            expect(out.images).toEqual([{ evId: 'S1', support: 'direct', reason: 'It lists Change Requests with their approval status.' }, { evId: 'S2', support: 'none', reason: '' }]);
            AI.callProxyAPI = vi.fn(async () => reply({ images: [
                { evId: '', support: 'definitely', reason: 'x' },
                { evId: '', support: 'partial', visibleText: [], reason: 'This shows the control is compliant.' }
            ] }));
            out = await AI.verifyEvidenceFor(input);
            expect(out.images).toEqual([{ evId: 'S1', support: 'none', reason: 'x' }, { evId: 'S2', support: 'partial', reason: '' }]);
        });
    });

    describe('the search', () => {
        const rowsFor = async () => {
            AI.mapEvidence = vi.fn(async (input) => ({ images: input.images.map((image) => ({ evId: image.evId, shows: 'Screenshot of item ' + input.current.n + '.', here: 'direct', fit: 'fits', betterItem: null, alsoItems: [], reason: '' })), imagesFailed: [], flags: [] }));
            return (await EM.check(report, { concurrency: 1 })).rows;
        };

        it('asks only about assessed questions with no screenshot, and offers only direct evidence', async () => {
            report.checklistProgress.push({ checklistId: 'cl1', itemIdx: 'A-9', clause: 'A.7.2', status: 'not_sampled', requirement: 'Sample A.7.2 Physical entry.' });
            const rows = await rowsFor();
            AI.matchEvidenceToQuestions = vi.fn(async (input) => ({ matches: input.questions.map((q) => ({ n: q.n, ids: q.n === 3 ? ['S1', 'S2'] : (q.n === 5 ? ['S4'] : []) })) }));
            AI.verifyEvidenceFor = vi.fn(async (input) => ({ images: input.images.map((image) => ({ evId: image.evId, support: input.question.n === 3 && image.evId === 'S1' ? 'direct' : 'partial', reason: 'It lists changes with approvals.' })) }));
            const res = await EM.findGapEvidence(report, rows);
            // Item 3 (no status yet) and item 5 are asked about; the not-sampled item 6 is not.
            expect(AI.matchEvidenceToQuestions.mock.calls[0][0].questions.map((q) => q.n)).toEqual([3, 5]);
            expect(AI.matchEvidenceToQuestions.mock.calls[0][0].screenshots).toHaveLength(4);
            expect(AI.verifyEvidenceFor).toHaveBeenCalledTimes(2);
            expect(res.gaps).toHaveLength(1);
            expect(res.gaps[0].target).toMatchObject({ n: 3, key: 'cl1-A-2' });
            expect(res.gaps[0].rows.map((r) => [r.src, r.from.n, r.reason])).toEqual([[img('chg'), 1, 'It lists changes with approvals.']]);
            // Item 5 had a candidate, but only partly fitting: nothing is offered.
            expect(res.none.map((x) => x.n)).toEqual([5]);
        });

        it('leaves a question a proposed move would already fill to that move', async () => {
            const rows = await rowsFor();
            rows[0] = Object.assign({}, rows[0], { fit: 'fits_better_elsewhere', to: { n: 3, key: 'cl1-A-2', clause: 'A.8.32', text: 't' } });
            AI.matchEvidenceToQuestions = vi.fn(async (input) => ({ matches: input.questions.map((q) => ({ n: q.n, ids: [] })) }));
            await EM.findGapEvidence(report, rows);
            expect(AI.matchEvidenceToQuestions.mock.calls[0][0].questions.map((q) => q.n)).toEqual([5]);
        });

        it('a failed search offers nothing and reports the error', async () => {
            const rows = await rowsFor();
            const res = await EM.findGapEvidence(report, rows);
            expect(res).toEqual({ gaps: [], none: [], error: 'off in this test' });
        });
    });

    it('on the review screen: the evidence found, why, and the questions nothing supports', async () => {
        AI.mapEvidence = vi.fn(async (input) => ({ images: input.images.map((image) => ({ evId: image.evId, shows: 'Screenshot of item ' + input.current.n + '.', here: 'direct', fit: 'fits', betterItem: null, alsoItems: input.current.n === 2 ? [5] : [], reason: 'Its own question.' })), imagesFailed: [], flags: [] }));
        AI.matchEvidenceToQuestions = vi.fn(async (input) => ({ matches: input.questions.map((q) => ({ n: q.n, ids: q.n === 3 ? ['S1'] : [] })) }));
        AI.verifyEvidenceFor = vi.fn(async (input) => ({ images: input.images.map((image) => ({ evId: image.evId, support: 'direct', reason: 'It lists changes with approvals.' })) }));
        window.openEvidenceMapping('r1');
        expect(document.body.textContent).toContain('Each question with no screenshot is then searched for across all of them');
        document.getElementById('em-start').click();
        await vi.waitFor(() => expect(document.querySelector('.em-choice')).not.toBeNull());
        expect(document.body.textContent).toContain('Questions with no screenshot: evidence found under another question');
        expect(document.body.textContent).toContain('item 3 · A.8.32 has no screenshot of its own');
        // The by-product "also supports" (item 2's screenshots for item 5) is no longer offered.
        const rows = Array.from(document.querySelectorAll('.em-row'));
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent).toContain('Why: It lists changes with approvals.');
        expect(document.getElementById('em-none').textContent).toBe('No screenshot in this audit supports: item 5 · A.6.7');
        rows[0].querySelector('.em-choice').value = 'copy:cl1-A-2';
        window.__save();
        expect(report.checklistProgress[2].evidenceImages).toEqual([img('chg')]);
        expect(report.checklistProgress[0].evidenceImages).toEqual([img('chg')]);
    });
});

describe('where it lives', () => {
    it('a bar on the Report Integrity panel, loaded after the AI service', () => {
        expect(fs.readFileSync('execution-module-v2.js', 'utf8')).toContain('data-action="openEvidenceMapping"');
        expect(fs.readFileSync('index.html', 'utf8')).toMatch(/fix-findings\.js[^"]*" defer><\/script>\s*<script src="\.\/evidence-mapping\.js/);
    });
});
