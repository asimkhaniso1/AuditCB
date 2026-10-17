// index.html loaded SheetJS twice: a deferred copy with SRI in <head> and a
// second, render-blocking copy without SRI further down that overwrote it.
import { describe, it, expect } from 'vitest';

const fs = await import('fs');
const path = await import('path');
const HTML = fs.readFileSync(path.resolve('./index.html'), 'utf8');

describe('index.html third-party scripts', () => {
    it('loads SheetJS exactly once, deferred and integrity-checked', () => {
        const tags = HTML.match(/<script[^>]*xlsx[^>]*><\/script>/gi) || [];
        expect(tags).toHaveLength(1);
        expect(tags[0]).toMatch(/\sdefer\b/);
        expect(tags[0]).toMatch(/\sintegrity="sha384-/);
    });
});
