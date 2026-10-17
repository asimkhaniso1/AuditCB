// Every root *.js file is a classic <script> sharing one global namespace, so
// when two files define the same global (top-level `function X` or
// `window.X = function/object`), the last one loaded silently wins and the
// other copy is dead code that still gets edited. tools/check-duplicate-globals.js
// finds those; this test fails on any that is not in
// tools/duplicate-globals-allowlist.json (with a reason).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { findDuplicateGlobals, collectDefinitions, listBrowserScripts } = require('../tools/check-duplicate-globals.js');

function describeDuplicate({ name, defs }) {
    return `${name}: ${defs.map(d => `${d.file}:${d.line}`).join(', ')}`;
}

describe('duplicate global definitions across browser scripts', () => {
    const result = findDuplicateGlobals();

    it('scans the shipped root scripts and skips build tooling', () => {
        const files = listBrowserScripts();
        expect(files).toContain('script.js');
        expect(files).toContain('clients-org-setup.js');
        expect(files).not.toContain('build.js');
        expect(files).not.toContain('vitest.config.js');
    });

    it('has no non-allowlisted duplicate (last-loaded copy wins; delete or rename the other)', () => {
        expect(result.duplicates.map(describeDuplicate)).toEqual([]);
    });

    it('has no stale allowlist entries', () => {
        expect(result.stale).toEqual([]);
    });
});

describe('collectDefinitions', () => {
    const names = (src) => collectDefinitions(src, 'x.js').map(d => d.name).sort();

    it('counts top-level and top-level-block function declarations', () => {
        expect(names('function a() {}\n{ function b() {} }\nif (1) { function c() {} }')).toEqual(['a', 'b', 'c']);
    });

    it('ignores functions declared inside other functions or IIFEs', () => {
        expect(names('function a() { function inner() {} }\n(function () { function local() {} })();')).toEqual(['a']);
    });

    it('counts window.X assignments of functions, objects, classes and same-file bindings', () => {
        const src = [
            'window.f = function () {};',
            'window.g = () => 1;',
            "window['h'] = {};",
            'window.k = class {};',
            'function m() {}',
            'window.m = m;',
            'window.n = window.n || { shim: true };',
        ].join('\n');
        expect(names(src)).toEqual(['f', 'g', 'h', 'k', 'm', 'm', 'n']);
    });

    it('ignores plain state writes and re-exports of names defined in other files', () => {
        expect(names("window.currentTab = 'a';\nwindow.count = 3;\nwindow.other = otherFileFn;")).toEqual([]);
    });

    it('marks assignments that only run when their enclosing function is called', () => {
        const [def] = collectDefinitions('function render() { window.later = function () {}; }', 'x.js')
            .filter(d => d.name === 'later');
        expect(def.atLoad).toBe(false);
        expect(def.inside).toBe('render@1');
    });
});
