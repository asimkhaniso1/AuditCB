#!/usr/bin/env node
/**
 * check-duplicate-globals.js — finds global names defined in more than one
 * browser script.
 *
 * Every root *.js file the browser loads is a classic <script>, so a top-level
 * `function X` and a `window.X = ...` share one namespace: when two files
 * define the same name, whichever file runs LAST silently wins and the other
 * copy is dead code. Fixes made to the dead copy never take effect, so the
 * copies drift apart (e.g. one checking canPerform('create') and the other
 * canPerform('edit')).
 *
 * A "definition" here is:
 *   - a `function X() {}` declaration that is not inside any function — at
 *     the top level, or in a top-level block / if / try (classic scripts are
 *     sloppy mode, so a block-level declaration there still creates a global), or
 *   - `window.X = <value>` / `window['X'] = <value>` anywhere in the file,
 *     where <value> is a function, class or object literal, a name bound in
 *     the same file to one of those (`window.X = X` after `function X`), or a
 *     fallback `window.X || <one of those>` (boot shims).
 *
 * Plain state writes are excluded on purpose: `window.currentTab = 'a'` in
 * two files is state, not a duplicated implementation.
 *
 * Intentional duplicates (boot shims that are replaced once the real module
 * loads, deliberate overrides) go in tools/duplicate-globals-allowlist.json as
 * { "name": "reason" }. A reason is required.
 *
 * Usage: node tools/check-duplicate-globals.js [--json]
 * Exit code 1 when a non-allowlisted duplicate exists.
 */
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const { shouldShip } = require('./ship-allowlist.js');

const ROOT = path.resolve(__dirname, '..');
const ALLOWLIST_PATH = path.join(__dirname, 'duplicate-globals-allowlist.json');

/** Root *.js files that ship to the browser (same rule build.js uses). */
function listBrowserScripts(root = ROOT) {
    return fs.readdirSync(root, { withFileTypes: true })
        .filter(e => e.isFile() && e.name.endsWith('.js') && shouldShip(e.name))
        .map(e => e.name)
        .sort();
}

function isWindow(node) {
    return node && node.type === 'Identifier' && node.name === 'window';
}

/** Returns the property name for `window.X` / `window['X']`, else null. */
function windowPropName(node) {
    if (!node || node.type !== 'MemberExpression' || !isWindow(node.object)) return null;
    if (!node.computed && node.property.type === 'Identifier') return node.property.name;
    if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
        return node.property.value;
    }
    return null;
}

const DEFINING_VALUE_TYPES = new Set([
    'FunctionExpression', 'ArrowFunctionExpression', 'ClassExpression', 'ObjectExpression'
]);

/**
 * Unwraps `window.A = window.B = function () {}` chains and `window.X || ...`
 * fallbacks, then reports whether the right-hand side defines behaviour.
 * `bindings` holds names bound in this file to a function/class/object.
 */
function definesBehaviour(name, value, bindings) {
    let v = value;
    while (v && v.type === 'AssignmentExpression' && v.operator === '=') v = v.right;
    if (v && v.type === 'LogicalExpression' && (v.operator === '||' || v.operator === '??')
        && windowPropName(v.left) === name) {
        v = v.right;
    }
    if (!v) return false;
    if (DEFINING_VALUE_TYPES.has(v.type)) return true;
    return v.type === 'Identifier' && bindings.has(v.name);
}

/** Names bound anywhere in the file to a function, class or object literal. */
function collectBindings(ast) {
    const names = new Set();
    (function walk(node) {
        if (!node || typeof node.type !== 'string') return;
        if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) {
            names.add(node.id.name);
        } else if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier'
            && node.init && DEFINING_VALUE_TYPES.has(node.init.type)) {
            names.add(node.id.name);
        }
        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'range') continue;
            const child = node[key];
            if (Array.isArray(child)) child.forEach(walk);
            else if (child && typeof child.type === 'string') walk(child);
        }
    })(ast);
    return names;
}

/** Best-effort name for a function node, for report output. */
function functionLabel(node, parent) {
    if (node.id) return node.id.name;
    if (parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
    if (parent && parent.type === 'AssignmentExpression') {
        return windowPropName(parent.left) || (parent.left.property && parent.left.property.name) || 'function';
    }
    if (parent && parent.type === 'Property' && parent.key) return parent.key.name || parent.key.value;
    if (parent && parent.type === 'CallExpression') return 'callback';
    return 'function';
}

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/**
 * Collects definitions in one file's source.
 * Each entry: { name, file, line, kind: 'function' | 'window', atLoad }
 * atLoad is true when the definition runs while the script is evaluated
 * (top level or inside an IIFE), false when it sits inside a function that
 * only runs when called later.
 */
function collectDefinitions(source, file) {
    const ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'script', loc: true });
    const defs = [];
    const bindings = collectBindings(ast);

    // atLoad tracks whether the code being visited runs at script evaluation;
    // inside names the nearest enclosing function that only runs when called;
    // inFunction is true anywhere inside a function body (IIFEs included).
    function visit(node, parent, atLoad, inside, inFunction) {
        if (!node || typeof node.type !== 'string') return;

        if (node.type === 'FunctionDeclaration' && node.id && !inFunction) {
            defs.push({ name: node.id.name, file, line: node.loc.start.line, kind: 'function', atLoad: true });
        }

        let childAtLoad = atLoad;
        let childInside = inside;
        const childInFunction = inFunction || FUNCTION_TYPES.has(node.type);
        if (FUNCTION_TYPES.has(node.type)) {
            const isIIFE = parent && parent.type === 'CallExpression' && parent.callee === node;
            childAtLoad = atLoad && isIIFE;
            if (!isIIFE) childInside = `${functionLabel(node, parent)}@${node.loc.start.line}`;
        }

        if (node.type === 'AssignmentExpression' && node.operator === '=') {
            const name = windowPropName(node.left);
            if (name) {
                if (definesBehaviour(name, node.right, bindings)) {
                    const def = { name, file, line: node.loc.start.line, kind: 'window', atLoad };
                    if (!atLoad) def.inside = inside;
                    defs.push(def);
                }
            }
        }

        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'range' || key === 'parent') continue;
            const child = node[key];
            if (Array.isArray(child)) {
                for (const c of child) if (c && typeof c.type === 'string') visit(c, node, childAtLoad, childInside, childInFunction);
            } else if (child && typeof child.type === 'string') {
                visit(child, node, childAtLoad, childInside, childInFunction);
            }
        }
    }
    visit(ast, null, true, null, false);
    return defs;
}

function loadAllowlist(file = ALLOWLIST_PATH) {
    if (!fs.existsSync(file)) return {};
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = {};
    for (const [name, reason] of Object.entries(raw)) {
        if (name.startsWith('$')) continue; // "$comment" etc.
        if (typeof reason !== 'string' || !reason.trim()) {
            throw new Error(`duplicate-globals allowlist: "${name}" needs a reason`);
        }
        list[name] = reason;
    }
    return list;
}

/**
 * Scans the browser scripts and returns
 * { duplicates: [{ name, files: [...defs] }], allowed: [...], stale: [...] }
 * duplicates excludes allowlisted names; stale lists allowlist entries that
 * are no longer duplicated (so the allowlist cannot rot).
 */
function findDuplicateGlobals({ root = ROOT, allowlist = loadAllowlist() } = {}) {
    const byName = new Map();
    for (const file of listBrowserScripts(root)) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        for (const def of collectDefinitions(source, file)) {
            if (!byName.has(def.name)) byName.set(def.name, []);
            byName.get(def.name).push(def);
        }
    }

    const duplicates = [];
    const allowed = [];
    for (const [name, defs] of byName) {
        const files = new Set(defs.map(d => d.file));
        if (files.size < 2) continue;
        const entry = { name, defs };
        if (Object.prototype.hasOwnProperty.call(allowlist, name)) allowed.push(entry);
        else duplicates.push(entry);
    }
    duplicates.sort((a, b) => a.name.localeCompare(b.name));
    const stale = Object.keys(allowlist).filter(n => !allowed.some(a => a.name === n));
    return { duplicates, allowed, stale };
}

function formatEntry({ name, defs }) {
    const where = defs.map(d => `    ${d.file}:${d.line} (${d.kind}${d.atLoad ? '' : `, runs inside ${d.inside}`})`);
    return `  ${name}\n${where.join('\n')}`;
}

if (require.main === module) {
    const result = findDuplicateGlobals();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        if (result.duplicates.length) {
            console.error(`Duplicate global definitions (${result.duplicates.length}) — the last-loaded copy wins, the others are dead:`);
            console.error(result.duplicates.map(formatEntry).join('\n'));
        }
        if (result.stale.length) {
            console.error(`Allowlist entries that are no longer duplicated (remove them): ${result.stale.join(', ')}`);
        }
        if (!result.duplicates.length && !result.stale.length) {
            console.log(`No duplicate globals (${result.allowed.length} allowlisted).`);
        }
    }
    process.exit(result.duplicates.length || result.stale.length ? 1 : 0);
}

module.exports = { findDuplicateGlobals, collectDefinitions, listBrowserScripts, loadAllowlist };
