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

function change(el) {
    el.dispatchEvent(new window.Event('change', { bubbles: true, cancelable: true }));
}

describe('EventDelegator — data-action-change placeholder resolution', () => {
    // The click delegator resolved 'this.checked' to the element's actual
    // checked state; the change delegator's copy of that resolution list never
    // got the same line, so a checkbox wired with data-arg="this.checked" (the
    // Gap Analysis screen's "Show only gaps" and per-standard checkboxes) arrived
    // as the literal string "this.checked" — never true, 'true' or 'on', so a
    // handler comparing against those always read the box as unchecked.
    it('resolves this.checked to the real checked state, not the literal string', () => {
        const calls = [];
        window.__delegatorChangeTest = checked => calls.push(checked);
        document.body.innerHTML = '<input type="checkbox" id="c" data-action-change="__delegatorChangeTest" data-arg1="this.checked">';

        const box = document.getElementById('c');
        box.checked = true;
        change(box);
        expect(calls).toEqual([true]);

        box.checked = false;
        change(box);
        expect(calls).toEqual([true, false]);
        delete window.__delegatorChangeTest;
    });

    it('still resolves this.value alongside this.checked in the same call', () => {
        const calls = [];
        window.__delegatorChangeTest2 = (name, checked) => calls.push([name, checked]);
        document.body.innerHTML = '<input type="checkbox" id="c2" data-action-change="__delegatorChangeTest2" data-arg1="iso27001" data-arg2="this.checked">';

        const box = document.getElementById('c2');
        box.checked = true;
        change(box);

        expect(calls).toEqual([['iso27001', true]]);
        delete window.__delegatorChangeTest2;
    });

    it('still resolves this.value for a select/text input as before', () => {
        const calls = [];
        window.__delegatorChangeTest3 = value => calls.push(value);
        document.body.innerHTML = '<select id="s" data-action-change="__delegatorChangeTest3" data-arg1="this.value"><option value="a">a</option><option value="b">b</option></select>';

        const sel = document.getElementById('s');
        sel.value = 'b';
        change(sel);

        expect(calls).toEqual(['b']);
        delete window.__delegatorChangeTest3;
    });
});
