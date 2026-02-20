/**
 * migrate-inline-handlers.js — Automated CSP Phase 2b migration.
 * 
 * Transforms inline event handlers to data-action/data-hash attributes
 * in all JS files that generate HTML templates.
 *
 * Run: node migrations/migrate-inline-handlers.js [--dry-run]
 *
 * Handles these patterns:
 *   onclick="functionName()"            → data-action="functionName"
 *   onclick="functionName('arg')"       → data-action="functionName" data-id="arg"
 *   onclick="functionName('a','b')"     → data-action="functionName" data-arg1="a" data-arg2="b"
 *   onclick="window.functionName(...)"  → data-action="functionName" ...
 *   onclick="window.location.hash='x'" → data-hash="x"
 *   onclick="renderModule('x')"         → data-action="renderModule" data-id="x"
 *   onchange="functionName()"           → data-action-change="functionName"
 *   oninput="functionName()"            → data-action-input="functionName"
 *   onmouseover="..." / onmouseout="..." → removed (use CSS :hover instead)
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.resolve(__dirname, '..');

// Files to process (all JS files with inline handlers, excluding migrations/, tools/, dist/)
const SKIP_DIRS = new Set(['migrations', 'tools', 'dist', 'node_modules', '.git', '.agent', '.gemini']);

function getJSFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getJSFiles(full));
        } else if (entry.name.endsWith('.js') && entry.name !== 'migrate-inline-handlers.js') {
            files.push(full);
        }
    }
    return files;
}

// Stats
let totalReplaced = 0;
let totalSkipped = 0;
const fileStats = {};

/**
 * Transform a single inline handler attribute to data-* equivalent.
 * Returns the replacement string, or null if it can't be auto-migrated.
 */
function transformHandler(fullMatch, eventType, handlerBody) {
    const body = handlerBody.trim();

    // ─── Pattern 1: window.location.hash = 'route' or "route" ───
    const hashMatch = body.match(/^(?:window\.)?location\.hash\s*=\s*['"]([^'"]+)['"];?$/);
    if (hashMatch) {
        return `data-hash="${hashMatch[1]}"`;
    }

    // ─── Pattern 1b: window.location.hash = '#route' ───
    const hashMatch2 = body.match(/^(?:window\.)?location\.hash\s*=\s*['"]#([^'"]+)['"];?$/);
    if (hashMatch2) {
        return `data-hash="${hashMatch2[1]}"`;
    }

    // ─── Pattern 2: event.preventDefault(); functionName() ───
    const preventMatch = body.match(/^event\.preventDefault\(\);\s*(?:window\.)?(\w+)\((.*)\);?$/);
    if (preventMatch) {
        return buildDataAction(preventMatch[1], preventMatch[2], eventType);
    }

    // ─── Pattern 3: Simple function call — functionName() or window.functionName() ───
    const funcMatch = body.match(/^(?:window\.)?(\w+)\((.*)\);?$/);
    if (funcMatch) {
        return buildDataAction(funcMatch[1], funcMatch[2], eventType);
    }

    // ─── Pattern 4: this.style or other JS expression (complex) ───
    // These can't be auto-migrated — skip
    return null;
}

/**
 * Build the data-action attribute(s) from function name + args string
 */
function buildDataAction(funcName, argsStr, eventType) {
    const actionAttr = eventType === 'onclick' ? 'data-action' :
        eventType === 'onchange' ? 'data-action-change' :
            eventType === 'oninput' ? 'data-action-input' :
                eventType === 'onsubmit' ? 'data-action-submit' : 'data-action';

    // No arguments
    if (!argsStr || argsStr.trim() === '') {
        return `${actionAttr}="${funcName}"`;
    }

    // Parse arguments — handle string literals, template literals, and variables
    const args = parseArgs(argsStr.trim());

    if (args === null) {
        // Can't parse — too complex
        return null;
    }

    if (args.length === 1) {
        return `${actionAttr}="${funcName}" data-id="${args[0]}"`;
    }

    // Multiple args
    let result = `${actionAttr}="${funcName}"`;
    args.forEach((arg, i) => {
        result += ` data-arg${i + 1}="${arg}"`;
    });
    return result;
}

/**
 * Parse a comma-separated argument string into an array of values.
 * Handles: 'string', "string", `template`, numbers, variables, this, event
 * Returns null if too complex to auto-migrate.
 */
function parseArgs(str) {
    if (!str) return [];

    const args = [];
    let current = '';
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let braceDepth = 0; // Track ${} nesting

    for (let i = 0; i < str.length; i++) {
        const ch = str[i];

        // Handle ${} inside template literals
        if (ch === '$' && str[i + 1] === '{' && inTemplate) {
            braceDepth++;
            current += ch;
            continue;
        }
        if (ch === '{' && braceDepth > 0) {
            braceDepth++;
            current += ch;
            continue;
        }
        if (ch === '}' && braceDepth > 0) {
            braceDepth--;
            current += ch;
            continue;
        }

        if (ch === "'" && !inDouble && !inTemplate && depth === 0) {
            inSingle = !inSingle;
            continue;
        }
        if (ch === '"' && !inSingle && !inTemplate && depth === 0) {
            inDouble = !inDouble;
            continue;
        }
        if (ch === '`' && !inSingle && !inDouble && depth === 0) {
            inTemplate = !inTemplate;
            continue;
        }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;

        if (ch === ',' && !inSingle && !inDouble && !inTemplate && depth === 0) {
            args.push(current.trim());
            current = '';
            continue;
        }

        current += ch;
    }

    if (current.trim()) args.push(current.trim());

    // Validate each arg — must be a reasonable value
    for (const arg of args) {
        // Allow: simple identifiers, dotted paths, numbers, true/false, this, event
        if (/^[\w.]+$/.test(arg)) continue;
        // Allow: ${...} template expressions (they stay as-is in source)
        if (/^\$\{[^}]+\}$/.test(arg)) continue;
        // Allow: UTILS.escapeHtml(${...}) — common sanitization wrapper
        if (/^\w+\.\w+\(\$\{[^}]+\}\)$/.test(arg)) continue;
        // Allow: simple concatenation like 'prefix' + var
        if (/^[\w.${}()'"\s+]+$/.test(arg) && !arg.includes('?')) continue;
        // Reject: ternaries, complex expressions, function calls with nested args
        return null;
    }

    return args;
}

/**
 * Process a single file — find and replace inline handlers.
 */
function processFile(filePath) {
    const original = fs.readFileSync(filePath, 'utf-8');
    let content = original;
    let replaced = 0;
    let skipped = 0;

    // Match inline event handler attributes
    // Handles: onclick="...", onchange="...", oninput="...", onsubmit="..."
    // Also escaped: onclick=\\"...\\" (in JSON-like strings), onclick=\\'...\\' 
    const handlerRegex = /\b(onclick|onchange|oninput|onsubmit)=(\\?")((?:(?!\\?").)*?)(\\?")/g;

    content = content.replace(handlerRegex, (fullMatch, eventType, openQuote, body, closeQuote) => {
        const result = transformHandler(fullMatch, eventType, body);
        if (result) {
            replaced++;
            return result;
        } else {
            skipped++;
            return fullMatch; // Keep original
        }
    });

    // Also handle single-quoted handlers: onclick='...'
    const singleQuoteRegex = /\b(onclick|onchange|oninput|onsubmit)=(\\?')((?:(?!\\?').)*?)(\\?')/g;
    content = content.replace(singleQuoteRegex, (fullMatch, eventType, openQuote, body, closeQuote) => {
        const result = transformHandler(fullMatch, eventType, body);
        if (result) {
            replaced++;
            return result;
        } else {
            skipped++;
            return fullMatch;
        }
    });

    // Remove onmouseover and onmouseout (should use CSS :hover)
    const hoverRegex = /\s*\b(onmouseover|onmouseout)=(\\?")((?:(?!\\?").)*?)(\\?")/g;
    const hoverMatches = content.match(hoverRegex);
    if (hoverMatches) {
        content = content.replace(hoverRegex, '');
        replaced += hoverMatches.length;
    }
    const hoverSingleRegex = /\s*\b(onmouseover|onmouseout)=(\\?')((?:(?!\\?').)*?)(\\?')/g;
    const hoverSingleMatches = content.match(hoverSingleRegex);
    if (hoverSingleMatches) {
        content = content.replace(hoverSingleRegex, '');
        replaced += hoverSingleMatches.length;
    }

    if (replaced > 0 || skipped > 0) {
        const basename = path.basename(filePath);
        fileStats[basename] = { replaced, skipped };
        console.log(`  ${replaced > 0 ? '✅' : '⚠️'} ${basename}: ${replaced} migrated, ${skipped} skipped`);
    }

    totalReplaced += replaced;
    totalSkipped += skipped;

    if (replaced > 0 && !DRY_RUN) {
        fs.writeFileSync(filePath, content, 'utf-8');
    }
}

// ─── Main ────────────────────────────────────────────────────────────
console.log(`🔄 CSP Phase 2b: Migrating inline handlers...${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

const files = getJSFiles(ROOT);
console.log(`📂 Found ${files.length} JS files to process\n`);

for (const file of files) {
    processFile(file);
}

console.log(`\n📊 Results:`);
console.log(`   Migrated:  ${totalReplaced}`);
console.log(`   Skipped:   ${totalSkipped} (complex expressions, need manual review)`);
console.log(`   Total:     ${totalReplaced + totalSkipped}`);

if (totalSkipped > 0) {
    console.log(`\n⚠️  Skipped handlers need manual review. They contain:`);
    console.log(`   - Template literals with \${} interpolation`);
    console.log(`   - Complex expressions (ternaries, concatenation)`);
    console.log(`   - Multi-statement handlers`);
}

if (DRY_RUN) {
    console.log(`\n🔍 Dry run complete. No files were modified.`);
    console.log(`   Run without --dry-run to apply changes.`);
}
