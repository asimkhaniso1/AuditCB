// index.html loaded SheetJS twice: a deferred copy with SRI in <head> and a
// second, render-blocking copy without SRI further down that overwrote it.
// SheetJS now loads only on demand, through lib-loader.js (one pinned,
// integrity-checked source; see tests/lib-loader.test.js).
import { describe, it, expect } from 'vitest';

const fs = await import('fs');
const path = await import('path');
const HTML = fs.readFileSync(path.resolve('./index.html'), 'utf8');
const LOADER = fs.readFileSync(path.resolve('./lib-loader.js'), 'utf8');

describe('index.html third-party scripts', () => {
    it('does not load SheetJS from index.html at all', () => {
        expect(HTML.match(/<script[^>]*xlsx[^>]*><\/script>/gi) || []).toHaveLength(0);
    });

    it('has exactly one integrity-checked SheetJS source, in lib-loader.js', () => {
        expect(LOADER.match(/xlsx\.full\.min\.js/g)).toHaveLength(1);
        expect(LOADER).toMatch(/xlsx\.full\.min\.js',\s*integrity: 'sha384-/);
    });
});
