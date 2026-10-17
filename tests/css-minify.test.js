// build.js minified CSS with /\s*([{}:;,>~+])\s*/g, which deleted the
// descendant space in `html[data-theme="dark"] :is(...)` and rewrote text
// inside attribute strings like [style*="position: fixed"]. Dark mode worked
// locally and broke in production. The minifier must preserve both.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const { minifyCss } = require('../tools/minify-css.js');

const read = (f) => fs.readFileSync(path.resolve(f), 'utf8');

// Every quoted attribute-selector value, e.g. [style*="position: fixed"].
function attributeSelectors(css) {
    return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\[[a-z-]+[*^$|~]?="[^"]*"\]/gi)].map(m => m[0]);
}

describe('production CSS minifier', () => {
    const theme = read('./theme.css');
    const themeMin = minifyCss(theme);

    it('keeps the descendant combinator before :is() in theme.css', () => {
        expect(themeMin).toContain(' :is(');
        // clean-css unquotes identifier values ([data-theme=dark]) — same selector.
        expect(themeMin).toMatch(/html\[data-theme="?dark"?\] :is\(/);
    });

    it('rejects input it would silently drop instead of emitting partial CSS', () => {
        expect(() => minifyCss('a{color:red}\n.b{{color:blue}')).toThrow(/CSS minification failed/);
    });

    it('keeps spaces inside attribute strings', () => {
        expect(themeMin).toContain('[style*="position: fixed"]');
        expect(themeMin).toContain('[style*="background: rgba(0"]');
    });

    it('preserves every attribute selector in theme.css and styles.css verbatim', () => {
        for (const file of ['./theme.css', './styles.css']) {
            const src = read(file);
            const min = minifyCss(src);
            const selectors = attributeSelectors(src);
            expect(selectors.length).toBeGreaterThan(0);
            for (const sel of selectors) {
                // An identifier value may lose its quotes; anything with a
                // space, colon or paren must come through exactly as written.
                const unquoted = sel.replace(/="([a-zA-Z][\w-]+)"\]$/, '=$1]');
                expect(min.includes(sel) || min.includes(unquoted), `${file}: ${sel}`).toBe(true);
            }
        }
    });

    it('still minifies', () => {
        expect(themeMin.length).toBeLessThan(theme.length * 0.8);
        expect(themeMin).not.toMatch(/\/\*/);
    });

    it('fixes the regression the old regex minifier produced', () => {
        const oldMinify = (css) => css
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s+/gm, '').replace(/\s+$/gm, '')
            .replace(/\s*\n\s*/g, '').replace(/\s{2,}/g, ' ')
            .replace(/\s*([{}:;,>~+])\s*/g, '$1')
            .replace(/;}/g, '}');
        // Guard that this test exercises the real failure, not a strawman.
        expect(oldMinify(theme)).not.toContain(' :is(');
        expect(themeMin).toContain(' :is(');
    });
});
