/**
 * build.js — Minifies all JS files for production deployment.
 * Run: node build.js
 *
 * Copies the entire project to dist/, then minifies all .js files in-place.
 * Vercel serves from dist/ after running `npm run build`.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const DIST = path.join(__dirname, 'dist');

// Files/dirs to skip when copying to dist
const SKIP = new Set(['dist', 'node_modules', '.git', '.agent', '.gemini', 'migrations', 'docs', 'tools', 'supabase']);

// 1. Clean dist
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

// 2. Copy files to dist (excluding skipped dirs)
function copyRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        if (SKIP.has(entry.name)) continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('📦 Copying files to dist/...');
copyRecursive(SRC, DIST);

// Also copy api/ directory (needed for Vercel serverless functions)
const apiSrc = path.join(SRC, 'api');
const apiDest = path.join(DIST, 'api');
if (fs.existsSync(apiSrc)) {
    fs.mkdirSync(apiDest, { recursive: true });
    copyRecursive(apiSrc, apiDest);
}

// 3. Minify all JS files in dist
const jsFiles = [];
function findJS(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Skip api/ — Vercel serverless functions should not be minified
            if (entry.name === 'api') continue;
            findJS(fullPath);
        } else if (entry.name.endsWith('.js')) {
            jsFiles.push(fullPath);
        }
    }
}

findJS(DIST);

console.log(`🔧 Minifying ${jsFiles.length} JS files...`);

let totalOriginal = 0;
let totalMinified = 0;
let errors = 0;

for (const file of jsFiles) {
    const original = fs.statSync(file).size;
    totalOriginal += original;

    try {
        execSync(`npx terser "${file}" --compress --mangle -o "${file}"`, {
            stdio: 'pipe',
            timeout: 30000
        });
        const minified = fs.statSync(file).size;
        totalMinified += minified;
        const savings = Math.round((1 - minified / original) * 100);
        console.log(`  ✅ ${path.basename(file)}: ${Math.round(original / 1024)}KB → ${Math.round(minified / 1024)}KB (${savings}% smaller)`);
    } catch (e) {
        errors++;
        totalMinified += original; // Count original size on error
        console.warn(`  ⚠️ ${path.basename(file)}: minification failed, kept original`);
    }
}

console.log(`\n📊 Results:`);
console.log(`   Original: ${Math.round(totalOriginal / 1024)}KB`);
console.log(`   Minified: ${Math.round(totalMinified / 1024)}KB`);
console.log(`   Savings:  ${Math.round((1 - totalMinified / totalOriginal) * 100)}%`);
if (errors) console.log(`   Errors:   ${errors}`);
console.log('✅ Build complete! Output in dist/');
