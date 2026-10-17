// build.js copied every root file into dist/, so package.json, DEPLOYMENT.md,
// build.js, vercel.json, .env.example and the api/ source were publicly served.
// Only what the browser loads may ship.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const { shouldShip } = require('../tools/ship-allowlist.js');

describe('dist/ ship allowlist', () => {
    it('ships app scripts, styles, the page, images and the manifest', () => {
        for (const f of ['index.html', 'script.js', 'styles.css', 'theme.css', 'Audit360-logo.jpeg', 'favicon.ico', 'manifest.json']) {
            expect(shouldShip(f), f).toBe(true);
        }
    });

    it('does not ship tooling, docs, config or dotfiles', () => {
        for (const f of ['package.json', 'package-lock.json', 'vercel.json', 'build.js', 'vitest.config.js',
            'eslint.config.mjs', 'DEPLOYMENT.md', 'README.md', 'task.md', 'PRODUCT_SPECIFICATION.md',
            'CHANGELOG.md', '.env.example', '.gitignore']) {
            expect(shouldShip(f), f).toBe(false);
        }
    });

    it('ships every local file index.html references', () => {
        const html = fs.readFileSync(path.resolve('./index.html'), 'utf8');
        const refs = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)/g)].map(m => m[1]);
        expect(refs.length).toBeGreaterThan(50);
        for (const ref of refs) {
            expect(ref.includes('/'), `${ref} is in a subdirectory, which does not ship`).toBe(false);
            expect(shouldShip(ref), ref).toBe(true);
        }
    });
});
