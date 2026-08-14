import { describe, it, expect, beforeAll, afterEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };

const fs = await import('fs');
const path = await import('path');

beforeAll(() => {
    const src = fs.readFileSync(path.resolve('./event-delegator.js'), 'utf8');
    eval(src);
});

afterEach(() => {
    document.body.innerHTML = '';
});

function click(el) {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('EventDelegator — anchors carrying data-action', () => {
    // An <a href="#"> used to run its action and then navigate to '#', and the
    // resulting hash change re-rendered the router back to the default view, so
    // clicking the date in the audit plans table appeared to do nothing.
    it('suppresses navigation for a placeholder href so the action survives', () => {
        const fired = [];
        window.__delegatorTest = id => fired.push(id);
        document.body.innerHTML = '<a id="a" href="#" data-action="__delegatorTest" data-id="PLAN1">2026-08-14</a>';

        const el = document.getElementById('a');
        const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
        el.dispatchEvent(event);

        expect(fired).toEqual(['PLAN1']);
        expect(event.defaultPrevented).toBe(true);
        delete window.__delegatorTest;
    });

    it('suppresses navigation for a javascript: href', () => {
        const fired = [];
        window.__delegatorTest = id => fired.push(id);
        document.body.innerHTML = '<a id="a" href="javascript:void(0)" data-action="__delegatorTest" data-id="P2">x</a>';

        const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
        document.getElementById('a').dispatchEvent(event);

        expect(fired).toEqual(['P2']);
        expect(event.defaultPrevented).toBe(true);
        delete window.__delegatorTest;
    });

    it('leaves a real link free to navigate', () => {
        const fired = [];
        window.__delegatorTest = id => fired.push(id);
        document.body.innerHTML = '<a id="a" href="#client/abc/plans" data-action="__delegatorTest" data-id="P3">x</a>';

        const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
        document.getElementById('a').dispatchEvent(event);

        expect(fired).toEqual(['P3']);
        expect(event.defaultPrevented).toBe(false);
        delete window.__delegatorTest;
    });

    it('does not touch non-anchor action targets', () => {
        const fired = [];
        window.__delegatorTest = id => fired.push(id);
        document.body.innerHTML = '<button id="b" data-action="__delegatorTest" data-id="P4">x</button>';

        const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
        document.getElementById('b').dispatchEvent(event);

        expect(fired).toEqual(['P4']);
        expect(event.defaultPrevented).toBe(false);
        delete window.__delegatorTest;
    });

    it('still dispatches when the click lands on a child of the action element', () => {
        const fired = [];
        window.__delegatorTest = id => fired.push(id);
        document.body.innerHTML = '<a href="#" data-action="__delegatorTest" data-id="P5"><i id="icon"></i></a>';

        click(document.getElementById('icon'));

        expect(fired).toEqual(['P5']);
        delete window.__delegatorTest;
    });
});
