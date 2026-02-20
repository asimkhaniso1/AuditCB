/**
 * migrate-inline-handlers-pass3.js — Targeted manual migration for remaining 110 handlers.
 * 
 * These are the complex handlers that the generic regex couldn't handle.
 * Each pattern group has a specific regex and transformation.
 *
 * Run: node migrations/migrate-inline-handlers-pass3.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.resolve(__dirname, '..');

let totalReplaced = 0;
let totalSkipped = 0;

/**
 * Pattern-specific replacements. Each entry:
 *   regex: matches the full onclick="..." (or onchange="...") attribute
 *   replace: function(match, ...groups) => replacement string
 */
const PATTERNS = [
    // ─── P1: this.nextElementSibling.classList.toggle('collapsed') ───
    // 14 instances in execution-module-v2.js, planning-module.js
    {
        name: 'toggle-next-collapsed',
        regex: /onclick="this\.nextElementSibling\.classList\.toggle\('collapsed'\)"/g,
        replace: () => 'data-action="toggleNextCollapsed"'
    },
    // ─── P2: this.nextElementSibling.classList.toggle('hidden') ───
    {
        name: 'toggle-next-hidden',
        regex: /onclick="this\.nextElementSibling\.classList\.toggle\('hidden'\)"/g,
        replace: () => 'data-action="toggleNextHidden"'
    },
    // ─── P3: this.closest('.card').querySelector('.items-list').classList.toggle('hidden') ───
    {
        name: 'toggle-card-items',
        regex: /onclick="this\.closest\('\.card'\)\.querySelector\('\.items-list'\)\.classList\.toggle\('hidden'\)"/g,
        replace: () => 'data-action="toggleCardItems"'
    },
    // ─── P4: this.parentElement.parentElement.style.display='none' ───
    {
        name: 'hide-grandparent',
        regex: /onclick="this\.parentElement\.parentElement\.style\.display='none'"/g,
        replace: () => 'data-action="hideGrandparent"'
    },
    // ─── P5: event.stopPropagation(); this.parentElement.parentElement.remove() ───
    {
        name: 'stop-remove-grandparent',
        regex: /onclick="event\.stopPropagation\(\);\s*this\.parentElement\.parentElement\.remove\(\);?"/g,
        replace: () => 'data-action="removeGrandparent" data-stop-prop="true"'
    },
    // ─── P6: event.stopPropagation(); (standalone) ───
    {
        name: 'stop-propagation-only',
        regex: /onclick="event\.stopPropagation\(\);?\s*"/g,
        replace: () => 'data-action="stopProp"'
    },
    // ─── P7: navigator.clipboard.writeText('${...}').then(...) ───
    {
        name: 'clipboard-copy',
        regex: /onclick="navigator\.clipboard\.writeText\('?\$\{([^}]+)\}'?\)\.then\(\(\)\s*=>\s*window\.showNotification\('([^']+)',\s*'success'\)\)"/g,
        replace: (m, expr, msg) => `data-action="copyToClipboard" data-id="\${${expr}}" data-arg1="${msg}"`
    },
    // Clipboard with backtick-escaped content
    {
        name: 'clipboard-copy-complex',
        regex: /onclick="navigator\.clipboard\.writeText\([^)]+\);\s*window\.showNotification\('([^']+)',\s*'success'\);?"/g,
        replace: (m, msg) => `data-action="copyToClipboardSelf" data-arg1="${msg}"`
    },
    // ─── P8: navigator.geolocation.getCurrentPosition ───
    {
        name: 'geolocation-fill',
        regex: /onclick="(?:event\.preventDefault\(\);\s*)?navigator\.geolocation\.getCurrentPosition\((?:function\(pos\)\{|pos\s*=>\s*\{\s*)document\.getElementById\(['\\\\"]+([^'\\\\"]+)['\\\\"]+\)\.value\s*=\s*pos\.coords\.latitude\.toFixed\(4\)\s*\+\s*',\s*'\s*\+\s*pos\.coords\.longitude\.toFixed\(4\);?\s*\}?\);?"/g,
        replace: (m, targetId) => `data-action="getGeolocation" data-id="${targetId}"`
    },
    // ─── P9: window.location.hash = '...'; setTimeout(() => ...click(), N) ───
    {
        name: 'hash-then-click-tab',
        regex: /onclick="window\.location\.hash\s*=\s*'([^']+)';\s*setTimeout\(\(\)\s*=>\s*document\.querySelector\([^)]+\)\?\.click\(\),\s*\d+\);?"/g,
        replace: (m, hash) => `data-action="hashThenClickTab" data-hash="${hash}" data-arg1="scopes"`
    },
    // ─── P10: this.closest('#shortcut-help-overlay').remove() ───
    {
        name: 'close-overlay',
        regex: /onclick="this\.closest\('#([^']+)'\)\.remove\(\)"/g,
        replace: (m, id) => `data-action="removeElement" data-id="${id}"`
    },
    // ─── P11: this.closest('tr').remove() ───
    {
        name: 'remove-table-row',
        regex: /onclick="this\.closest\('tr'\)\.remove\(\)"/g,
        replace: () => 'data-action="removeClosestTR"'
    },
    // ─── P12: window.fn && window.fn('${id}') — guard-call pattern ───
    {
        name: 'guard-call',
        regex: /onclick="window\.(\w+)\s*&&\s*window\.\1\('(\$\{[^}]+\})'\)"/g,
        replace: (m, fn, id) => `data-action="${fn}" data-id="${id}"`
    },
    // ─── P13: fn('${val}', this.files[0]) — file upload ───
    {
        name: 'file-upload-change',
        regex: /onchange="window\.(\w+)\('(\$\{[^}]+\})',\s*this\.files\[0\]\)"/g,
        replace: (m, fn, id) => `data-action-change="${fn}" data-id="${id}" data-file="true"`
    },
    // ─── P14: if(this.files[0]) { (file select) ───
    {
        name: 'file-select-if',
        regex: /onchange="if\(this\.files\[0\]\)\s*\{/g,
        replace: null // skip — too complex, needs manual
    },
    // ─── P15: document.getElementById('x').classList.toggle('hidden') ───
    {
        name: 'toggle-by-id',
        regex: /onclick="document\.getElementById\('([^']+)'\)\.classList\.toggle\('hidden'\)"/g,
        replace: (m, id) => `data-action="toggleHidden" data-id="${id}"`
    },
    // ─── P16: document.getElementById('x').value = expr ───
    {
        name: 'set-value-by-id',
        regex: /onclick="document\.getElementById\('([^']+)'\)\.value\s*=\s*window\.PasswordUtils\.generateSecurePassword\(\)"/g,
        replace: (m, id) => `data-action="generatePassword" data-id="${id}"`
    },
    // ─── P17: Toggle password visibility ───
    {
        name: 'toggle-password',
        regex: /onclick="document\.getElementById\('([^']+)'\)\.type\s*=\s*document\.getElementById\('\1'\)\.type\s*===\s*'password'\s*\?\s*'text'\s*:\s*'password'"/g,
        replace: (m, id) => `data-action="togglePasswordVisibility" data-id="${id}"`
    },
    // ─── P18: DataMigration / SupabaseConfig method calls ───
    {
        name: 'object-method',
        regex: /onclick="(\w+)\.(\w+)\(\)"/g,
        replace: (m, obj, method) => `data-action="${obj}_${method}"`
    },
    // ─── P19: switchSettingsMainTab('x', this) ───
    {
        name: 'switch-settings-tab',
        regex: /onclick="switchSettingsMainTab\('([^']+)',\s*this\)"/g,
        replace: (m, tab) => `data-action="switchSettingsMainTab" data-id="${tab}"`
    },
    // ─── P20: switchCertTab(this, 'x') ───
    {
        name: 'switch-cert-tab',
        regex: /onclick="switchCertTab\(this,\s*'([^']+)'\)"/g,
        replace: (m, tab) => `data-action="switchCertTab" data-id="${tab}"`
    },
    // ─── P21: window.open(this.src, '_blank') ───
    {
        name: 'open-image',
        regex: /onclick="window\.open\(this\.src,\s*['\\\\']+_blank['\\\\']+\)"/g,
        replace: () => 'data-action="openImageInNewTab"'
    },
    // ─── P22: document.querySelectorAll('.rp-sec-body').forEach(b=>b.classList.remove/add('collapsed')) ───
    {
        name: 'expand-all-sections',
        regex: /onclick="document\.querySelectorAll\('\.rp-sec-body'\)\.forEach\(b=>b\.classList\.remove\('collapsed'\)\)"/g,
        replace: () => 'data-action="expandAllSections"'
    },
    {
        name: 'collapse-all-sections',
        regex: /onclick="document\.querySelectorAll\('\.rp-sec-body'\)\.forEach\(b=>b\.classList\.add\('collapsed'\)\)"/g,
        replace: () => 'data-action="collapseAllSections"'
    },
    // ─── P23: window.AuditTrail?.exportCSV() ───
    {
        name: 'optional-chain-call',
        regex: /onclick="window\.(\w+)\?\.(\w+)\(\)"/g,
        replace: (m, obj, method) => `data-action="${obj}_${method}"`
    },
    // ─── P24: renderModule calls with quote-wrapped args ───
    {
        name: 'render-module',
        regex: /onclick="window\.renderModule\('([^']+)'\)"/g,
        replace: (m, mod) => `data-action="renderModule" data-id="${mod}"`
    },
    // ─── P25: NotificationManager method calls ───
    {
        name: 'notification-mgr',
        regex: /onclick="NotificationManager\.(\w+)\(([^)]*)\)"/g,
        replace: (m, method, args) => {
            if (!args || args.trim() === '') return `data-action="NotificationManager_${method}"`;
            // Try to extract simple args
            const parts = args.split(',').map(a => a.trim());
            if (parts.length === 1) return `data-action="NotificationManager_${method}" data-id="${parts[0]}"`;
            if (parts.length === 2) return `data-action="NotificationManager_${method}" data-arg1="${parts[0]}" data-arg2="${parts[1]}"`;
            return null;
        }
    },
    // ─── P26: ClientModals method calls ───
    {
        name: 'client-modals',
        regex: /onclick="ClientModals\.(\w+)\(\)"/g,
        replace: (m, method) => `data-action="ClientModals_${method}"`
    },
];

function processFile(filePath) {
    const original = fs.readFileSync(filePath, 'utf-8');
    let content = original;
    let replaced = 0;
    let skipped = 0;

    for (const pattern of PATTERNS) {
        if (!pattern.replace) continue; // Skip patterns marked for manual

        const matches = content.match(pattern.regex);
        if (!matches) continue;

        content = content.replace(pattern.regex, (...args) => {
            const result = pattern.replace(...args);
            if (result) {
                replaced++;
                return result;
            }
            skipped++;
            return args[0]; // keep original
        });
    }

    if (replaced > 0 || skipped > 0) {
        const basename = path.basename(filePath);
        console.log(`  ${replaced > 0 ? '✅' : '⚠️'} ${basename}: ${replaced} migrated, ${skipped} skipped`);
    }

    totalReplaced += replaced;
    totalSkipped += skipped;

    if (replaced > 0 && !DRY_RUN) {
        fs.writeFileSync(filePath, content, 'utf-8');
    }
}

// ─── Main ────────────────────────────────────────────────────────────
console.log(`🔄 CSP Phase 2b Pass 3: Targeted migration...${DRY_RUN ? ' (DRY RUN)' : ''}\\n`);

const SKIP_DIRS = new Set(['migrations', 'tools', 'dist', 'node_modules', '.git', '.agent', '.gemini']);
function getJSFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...getJSFiles(full));
        else if (entry.name.endsWith('.js')) files.push(full);
    }
    return files;
}

const files = getJSFiles(ROOT);
console.log(`📂 Processing ${files.length} JS files\\n`);

for (const file of files) {
    processFile(file);
}

console.log(`\\n📊 Results:`);
console.log(`   Migrated:  ${totalReplaced}`);
console.log(`   Skipped:   ${totalSkipped}`);

if (DRY_RUN) {
    console.log(`\\n🔍 Dry run complete. No files were modified.`);
}
