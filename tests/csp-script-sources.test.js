// script-src used to allow all of cdn.jsdelivr.net and unpkg.com, which serve
// any npm package, so an injected <script src> could load attacker code. It now
// lists exact library paths, and every CDN <script> in index.html is pinned
// with SRI. A new or bumped CDN script must update both, or it is blocked in
// production — these tests catch that before deploy.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.resolve(f), 'utf8');
const html = read('./index.html');
const vercel = JSON.parse(read('./vercel.json'));

function scriptSrc(csp) {
    const directive = csp.split(';').map(d => d.trim()).find(d => d.startsWith('script-src '));
    return directive.split(/\s+/).slice(1);
}

// CSP host-source matching: a source ending in '/' matches that path prefix,
// any other path must match exactly, and a bare origin matches everything on it.
function allowed(url, sources) {
    const u = new URL(url);
    return sources.some(s => {
        if (!s.startsWith('https://')) return false;
        const src = new URL(s);
        if (src.origin !== u.origin) return false;
        if (src.pathname === '/' && !s.endsWith('/')) return true;
        return s.endsWith('/') ? u.pathname.startsWith(src.pathname) : u.pathname === src.pathname;
    });
}

const headerCsp = vercel.headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy').value;
const metaCsp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replace(/\s+/g, ' ');

const appJs = fs.readdirSync(path.resolve('.')).filter(f => f.endsWith('.js') && f !== 'build.js' && f !== 'vitest.config.js');
// A whole URL ending in .js — not a directory such as .../libs/pdf.js/3.11.174/ in the CSP itself.
const CDN = /https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|browser\.sentry-cdn\.com)\/[^'"`\s)]+\.js(?![\w./@-])/g;
const scriptUrls = [...new Set([html, ...appJs.map(read)].flatMap(t => t.match(CDN) || []))];

describe('CSP script-src', () => {
    it('header and <meta> CSP allow the same script sources', () => {
        expect(scriptSrc(metaCsp)).toEqual(scriptSrc(headerCsp));
    });

    it('does not allow whole package CDNs', () => {
        for (const s of scriptSrc(headerCsp)) {
            expect(['https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://cdnjs.cloudflare.com']).not.toContain(s.replace(/\/$/, ''));
        }
    });

    it('allows every CDN script the app loads', () => {
        expect(scriptUrls.length).toBeGreaterThan(8);
        const sources = scriptSrc(headerCsp);
        for (const url of scriptUrls) expect(allowed(url, sources), url).toBe(true);
    });

    it('forbids framing via frame-ancestors', () => {
        expect(headerCsp).toContain("frame-ancestors 'none'");
    });
});

describe('index.html CDN scripts', () => {
    const tags = [...html.matchAll(/<script\s[^>]*src="(https:[^"]+)"[^>]*>/g)];

    it('pin an exact version and carry SRI', () => {
        // DOMPurify, supabase-js, Sentry, Chart.js (the document libraries load
        // on demand through lib-loader.js, which the CSP test above covers).
        expect(tags.length).toBeGreaterThanOrEqual(4);
        for (const [tag, src] of tags) {
            expect(src, 'unversioned CDN URL').toMatch(/\d+\.\d+\.\d+/);
            expect(tag, src).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/);
            expect(tag, src).toContain('crossorigin="anonymous"');
        }
    });
});
