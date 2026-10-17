/**
 * ship-allowlist.js — decides which root files build.js copies into dist/.
 *
 * build.js used to copy every root file except a few directories, so
 * package.json, package-lock.json, DEPLOYMENT.md, task.md, build.js,
 * vercel.json, .env.example and the api/*.js source were all publicly served
 * from https://audit360.isoxpert.com/. Only what the browser loads ships now:
 * root-level scripts, styles, pages, images and the web manifest. Nothing in
 * a subdirectory ships (Vercel builds api/ functions from the project root,
 * not from dist/).
 */
const path = require('path');

const SHIP_EXTENSIONS = new Set(['.js', '.css', '.html', '.jpeg', '.jpg', '.png', '.svg', '.ico', '.webp']);

// Root files with a shippable extension that are build/test tooling, not app code.
const TOOLING = new Set(['build.js', 'vitest.config.js']);

// Non-code files the browser requests.
const EXTRA = new Set(['manifest.json']);

function shouldShip(name) {
    if (name.startsWith('.')) return false;
    if (TOOLING.has(name)) return false;
    if (EXTRA.has(name)) return true;
    return SHIP_EXTENSIONS.has(path.extname(name).toLowerCase());
}

module.exports = { shouldShip };
