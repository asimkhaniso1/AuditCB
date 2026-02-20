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

// 3b. Minify all CSS files in dist (no extra dependency needed)
const cssFiles = [];
function findCSS(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) findCSS(fullPath);
        else if (entry.name.endsWith('.css')) cssFiles.push(fullPath);
    }
}
findCSS(DIST);

let cssOriginal = 0, cssMinified = 0;
console.log(`\n🎨 Minifying ${cssFiles.length} CSS files...`);
for (const file of cssFiles) {
    const original = fs.statSync(file).size;
    cssOriginal += original;
    try {
        let css = fs.readFileSync(file, 'utf8');
        // Remove comments
        css = css.replace(/\/\*[\s\S]*?\*\//g, '');
        // Remove leading/trailing whitespace per line
        css = css.replace(/^\s+/gm, '').replace(/\s+$/gm, '');
        // Collapse multiple whitespace/newlines
        css = css.replace(/\s*\n\s*/g, '').replace(/\s{2,}/g, ' ');
        // Remove spaces around selectors/braces
        css = css.replace(/\s*([{}:;,>~+])\s*/g, '$1');
        // Remove trailing semicolons before }
        css = css.replace(/;}/g, '}');
        fs.writeFileSync(file, css, 'utf8');
        const minified = fs.statSync(file).size;
        cssMinified += minified;
        const savings = Math.round((1 - minified / original) * 100);
        console.log(`  ✅ ${path.basename(file)}: ${Math.round(original / 1024)}KB → ${Math.round(minified / 1024)}KB (${savings}% smaller)`);
    } catch (e) {
        cssMinified += original;
        console.warn(`  ⚠️ ${path.basename(file)}: minification failed`);
    }
}

console.log(`\n📊 Results:`);
console.log(`   JS  — Original: ${Math.round(totalOriginal / 1024)}KB, Minified: ${Math.round(totalMinified / 1024)}KB, Savings: ${Math.round((1 - totalMinified / totalOriginal) * 100)}%`);
console.log(`   CSS — Original: ${Math.round(cssOriginal / 1024)}KB, Minified: ${Math.round(cssMinified / 1024)}KB, Savings: ${cssOriginal ? Math.round((1 - cssMinified / cssOriginal) * 100) : 0}%`);
console.log(`   Total Bundle: ${Math.round((totalMinified + cssMinified) / 1024)}KB`);
if (errors) console.log(`   JS Errors: ${errors}`);

// 4. Add content-hash cache busting to index.html
const crypto = require('crypto');
const indexPath = path.join(DIST, 'index.html');
if (fs.existsSync(indexPath)) {
    console.log('\n🔗 Adding content-hash cache busting...');
    let html = fs.readFileSync(indexPath, 'utf8');
    let replacements = 0;

    // Replace ?v=ANYTHING with ?h=CONTENT_HASH for local JS and CSS files
    html = html.replace(/(?:src|href)="\.\/([^"]+?)(?:\?v=[^"]*)?"/g, (match, filePath) => {
        const fullPath = path.join(DIST, filePath);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath);
            const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
            const attr = match.startsWith('src') ? 'src' : 'href';
            replacements++;
            return `${attr}="./${filePath}?h=${hash}"`;
        }
        return match;
    });

    fs.writeFileSync(indexPath, html, 'utf8');
    console.log(`   ✅ Updated ${replacements} file references with content hashes`);

    // 5. Minify HTML
    const htmlBefore = html.length;
    // Remove HTML comments (but keep conditional comments)
    html = html.replace(/<!--(?!\[)[\s\S]*?-->/g, '');
    // Collapse whitespace between tags
    html = html.replace(/>\s+</g, '><');
    // Remove leading whitespace on lines
    html = html.replace(/^\s+/gm, '');
    // Collapse blank lines
    html = html.replace(/\n{2,}/g, '\n');
    fs.writeFileSync(indexPath, html, 'utf8');
    const htmlAfter = html.length;
    console.log(`   ✅ HTML minified: ${Math.round(htmlBefore / 1024)}KB → ${Math.round(htmlAfter / 1024)}KB (${Math.round((1 - htmlAfter / htmlBefore) * 100)}% smaller)`);
}

console.log('\n✅ Build complete! Output in dist/');
