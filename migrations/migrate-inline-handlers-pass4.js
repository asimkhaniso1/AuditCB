/**
 * migrate-inline-handlers-pass4.js — Final targeted migration for remaining 53 handlers.
 *
 * Run: node migrations/migrate-inline-handlers-pass4.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.resolve(__dirname, '..');

let totalReplaced = 0;
let totalSkipped = 0;

const PATTERNS = [
    // ─── clients-module-fix.js: oninput="window._orgTableSearch(this, 'x')" ───
    // 5 instances — the script treated "(this, " as complex, but event-delegator can pass el
    {
        name: 'org-table-search',
        regex: /oninput="window\._orgTableSearch\(this,\s*'([^']+)'\)"/g,
        replace: (m, table) => `data-action-input="_orgTableSearch" data-id="${table}"`
    },
    // ─── clients-module-fix.js: window._orgViewItem('Type', {key:'val',...}) ───
    // These pass JSON-like objects. We'll encode the type as data-arg1 and put JSON in data-arg2
    {
        name: 'org-view-item',
        regex: /onclick="window\._orgViewItem\('([^']+)',(\{[^}]+\})\)"/g,
        replace: (m, type, jsonStr) => {
            // Encode the JSON object as a data attribute (it stays as template code in the source)
            return `data-action="_orgViewItemFromData" data-arg1="${type}" data-arg2="${jsonStr.replace(/"/g, '&quot;')}"`;
        }
    },
    // ─── clients-module-fix.js: window._orgPrintItem('Type',{key:'val',...}) ───
    {
        name: 'org-print-item',
        regex: /onclick="window\._orgPrintItem\('([^']+)',(\{[^}]+\})\)"/g,
        replace: (m, type, jsonStr) => {
            return `data-action="_orgPrintItemFromData" data-arg1="${type}" data-arg2="${jsonStr.replace(/"/g, '&quot;')}"`;
        }
    },
    // ─── clients-module-fix.js geolocation (escaped quotes variant) ───
    {
        name: 'geolocation-escaped',
        regex: /onclick="navigator\.geolocation\.getCurrentPosition\(function\(pos\)\{document\.getElementById\(\\'([^'\\]+)\\'\)\.value=pos\.coords\.latitude\.toFixed\(4\)\+\\', \\'\+pos\.coords\.longitude\.toFixed\(4\)\}\)"/g,
        replace: (m, id) => `data-action="getGeolocation" data-id="${id}"`
    },
    // ─── execution-module-v2.js: toggle display with text update (view notes toggle) ───
    {
        name: 'toggle-notes-display',
        regex: /onclick="var el=document\.getElementById\('orig-note-\$\{uniqueId\}'\);el\.style\.display=el\.style\.display==='none'\?'block':'none';this\.querySelector\('span'\)\.textContent=el\.style\.display==='none'\?'View Original Notes'[^"]*"/g,
        replace: () => `data-action="toggleOrigNotes" data-id="\${uniqueId}"`
    },
    // ─── execution-module-v2.js: toggle criteria display ───
    // "const el = document.getElementById('criteria-${uniqueId}'); el.style.display = el.style.display === 'none' ? 'block' : 'none'"
    {
        name: 'toggle-criteria',
        regex: /onclick="const el = document\.getElementById\('criteria-\$\{uniqueId\}'\); el\.style\.display = el\.style\.display === 'none' \? 'block' \: 'none'"/g,
        replace: () => `data-action="toggleDisplay" data-id="criteria-\${uniqueId}"`
    },
    // ─── execution-module-v2.js: viewEvidenceImageByUrl(this.src || '${safeSrc}') ───
    {
        name: 'view-evidence-image',
        regex: /onclick="window\.viewEvidenceImageByUrl\(this\.src \|\| '(\$\{[^}]+\})'\)"/g,
        replace: (m, src) => `data-action="viewEvidenceImageByUrlSelf" data-id="${src}"`
    },
    // ─── execution-module-v2.js: onchange guard-call with &&  ───
    // "window._autoFillPersonnel && window._autoFillPersonnel('${uniqueId}')"
    {
        name: 'guard-call-change',
        regex: /onchange="window\.(\w+)\s*&&\s*window\.\1\('([^']*)'\)"/g,
        replace: (m, fn, arg) => `data-action-change="${fn}" data-id="${arg}"`
    },
    // ─── execution-module-v2.js: click tab with &quot; ───
    // document.querySelector('.tab-btn[data-tab=&quot;meetings&quot;]')?.click()
    {
        name: 'click-tab-entity',
        regex: /onclick="document\.querySelector\('\.tab-btn\[data-tab=&quot;([^&]+)&quot;\]'\)\?\.click\(\)"/g,
        replace: (m, tab) => `data-action="clickTab" data-id="${tab}"`
    },
    // ─── execution-module-v2.js: state mutation + saveData (3 identical) ───
    // "window.state.auditReports.find(r => String(r.id) === String('${report.id}')).recommendation = this.value; window.saveData();"
    {
        name: 'set-recommendation',
        regex: /onchange="window\.state\.auditReports\.find\(r\s*=>\s*String\(r\.id\)\s*===\s*String\('(\$\{[^}]+\})'\)\)\.recommendation\s*=\s*this\.value;\s*window\.saveData\(\);?"/g,
        replace: (m, reportId) => `data-action-change="setReportRecommendation" data-id="${reportId}"`
    },
    // ─── execution-module-v2.js: gallery main src swap ───
    {
        name: 'gallery-src',
        regex: /onclick="document\.getElementById\('ev-gallery-main'\)\.src='[^"]*"/g,
        replace: () => `data-action="setGalleryMainSrc"`
    },
    // ─── checklist-module.js: conditional display onchange ───
    // "document.getElementById('checklist-client-group').style.display = this.value === 'custom' ? 'block' : 'none'"
    {
        name: 'toggle-custom-display',
        regex: /onchange="document\.getElementById\('([^']+)'\)\.style\.display\s*=\s*this\.value\s*===\s*'([^']+)'\s*\?\s*'block'\s*:\s*'none'"/g,
        replace: (m, id, val) => `data-action-change="toggleElementIfValue" data-id="${id}" data-arg1="${val}"`
    },
    // ─── checklist-module.js: accordion toggle with icon rotation ───
    {
        name: 'accordion-toggle',
        regex: /onclick="this\.nextElementSibling\.style\.display\s*=\s*this\.nextElementSibling\.style\.display\s*===\s*'none'\s*\?\s*'block'\s*:\s*'none';\s*this\.querySelector\('[^']+'\)\.style\.transform[^"]*"/g,
        replace: () => `data-action="toggleAccordion"`
    },
    {
        name: 'accordion-toggle-sub',
        regex: /onclick="const c=this\.nextElementSibling; c\.style\.display=c\.style\.display==='none'\?'block':'none'; this\.querySelector\('\.sub-icon'\)\.style\.transform=c\.style\.display==='none'\?'rotate\(0deg\)':'rotate\(90deg\)';?"/g,
        replace: () => `data-action="toggleSubAccordion"`
    },
    // ─── clients-module.js: checkbox toggle styling ───
    {
        name: 'checkbox-toggle-style',
        regex: /onchange="this\.parentElement\.classList\.toggle\('active',\s*this\.checked\);\s*this\.nextElementSibling\.style\.borderColor\s*=[^"]+"/g,
        replace: () => `data-action-change="toggleCheckboxStyle"`
    },
    // ─── clients-module.js: date formatting ───
    // "this.previousElementSibling.value = new Date(this.value).toLocaleDateString('en-GB', ...)"
    {
        name: 'format-date-prev',
        regex: /onchange="this\.previousElementSibling\.value\s*=\s*new Date\(this\.value\)\.toLocaleDateString\('en-GB',\s*\{day:'2-digit',month:'short',year:'numeric'\}\); this\.previousElementSibling\.dispatchEvent\(new Event\('change'\)\)"/g,
        replace: () => `data-action-change="formatDatePrev"`
    },
    // ─── clients-module.js:4361 updateCertField + autoFillExpiry ───
    {
        name: 'update-cert-field',
        regex: /onchange="window\.updateCertField\('(\$\{[^}]+\})',\s*(\$\{[^}]+\}),\s*'([^']+)',\s*this\.value\);\s*window\.autoFillExpiry\(this\)"/g,
        replace: (m, clientId, idx, field) => `data-action-change="updateCertFieldAndExpiry" data-arg1="${clientId}" data-arg2="${idx}" data-arg3="${field}"`
    },
    // ─── clients-module.js: finalize org setup ───
    {
        name: 'finalize-org',
        regex: /onclick="window\.showNotification\('Organization setup finalized successfully!',\s*'success'\);\s*window\.switchClientDetailTab\('(\$\{[^}]+\})',\s*'scopes'\)"/g,
        replace: (m, clientId) => `data-action="finalizeOrgSetup" data-id="${clientId}"`
    },
    // ─── advanced-modules.js and clients-module.js: if(this.files[0]) { ───
    {
        name: 'file-change-if',
        regex: /onchange="if\(this\.files\[0\]\)\s*\{\s*$/gm,
        replace: null // Cannot be migrated with regex — complex multi-line
    },
    // ─── clients-module.js: uploadCompanyProfileDoc('${client.id}', this.files[0]) ───
    // Already handles data-file pattern? Let's check — these use this.files[0]
    {
        name: 'upload-doc-files',
        regex: /onchange="window\.uploadCompanyProfileDoc\('(\$\{[^}]+\})',\s*this\.files\[0\]\)"/g,
        replace: (m, clientId) => `data-action-change="uploadCompanyProfileDoc" data-id="${clientId}" data-file="true"`
    },
    // ─── ncr-capa-module.js: state set + re-render ───
    {
        name: 'ncr-toggle-closed',
        regex: /onchange="window\.state\.showClosedCAPAs\s*=\s*this\.checked;\s*renderNCRCAPAModuleContent\(window\.state\.ncrContextClientId\);?"/g,
        replace: () => `data-action-change="toggleClosedCAPAs"`
    },
    // ─── planning-module.js: IIFE toggle ───
    {
        name: 'planning-iife-toggle',
        regex: /onclick="\(function\(el\)\{\s*var body\s*=\s*el\.closest\('\.card'\)\.querySelector\('\.client-docs-body'\)[^"]*"/g,
        replace: () => `data-action="toggleClientDocsBody"`
    },
    // ─── script.js: multi-statement navigation ───
    {
        name: 'script-navigate-auditor',
        regex: /onclick="state\.currentModule\s*=\s*'auditors';\s*renderAuditors\(\);\s*setTimeout\(\(\)\s*=>\s*renderAuditorDetail\((\$\{[^}]+\})\),\s*100\);?"/g,
        replace: (m, id) => `data-action="navigateToAuditorDetail" data-id="${id}"`
    },
    // ─── settings-module.js: confirm + clear logs ───
    {
        name: 'clear-logs-confirm',
        regex: /onclick="if\(confirm\('Clear all activity logs\?'\)\)\s*\{\s*window\.AuditTrail\?\.clear\(\);\s*window\.switchSettingsSubTab\('system',\s*'activity-log'\);\s*\}"/g,
        replace: () => `data-action="clearActivityLogs"`
    },
    // ─── settings-module.js: window.APIUsageTracker.exportData() ───
    {
        name: 'api-usage-export',
        regex: /onclick="window\.APIUsageTracker\.exportData\(\)"/g,
        replace: () => `data-action="APIUsageTracker_exportData"`
    },
    // ─── data-migration.js: window.DataMigration.handleClearData() / reloadFromCloud() ───
    {
        name: 'data-migration-methods',
        regex: /onclick="window\.(DataMigration)\.(\w+)\(\)"/g,
        replace: (m, obj, method) => `data-action="${obj}_${method}"`
    },
    // ─── auditor-form-module.js: skill value update ───
    {
        name: 'skill-value-update',
        regex: /onchange="document\.getElementById\('skill-val-\$\{skill\.toLowerCase\(\)\}'\)\.textContent\s*=\s*\(this\.value\s*===\s*'excellent'\s*\?\s*'5\/5'\s*:\s*this\.value\s*===\s*'good'\s*\?\s*'4\/5'\s*:\s*'3\/5'\)"/g,
        replace: () => `data-action-change="updateSkillValue"`
    },
    // ─── certifications-module.js: complex clipboard with backtick ───
    {
        name: 'cert-clipboard-complex',
        regex: /onclick="navigator\.clipboard\.writeText\([^)]+\);\s*window\.showNotification\('Copied to clipboard!',\s*'success'\);?"/g,
        replace: () => `data-action="copyCertEmbed"`
    },
    // ─── client-workspace.js: renderCreateAuditPlanForm with complex escaped arg ───
    {
        name: 'render-create-audit-plan',
        regex: /onclick="window\.renderCreateAuditPlanForm\('[^"]*$/gm,
        replace: null // too complex, needs manual
    },
];

function processFile(filePath) {
    const original = fs.readFileSync(filePath, 'utf-8');
    let content = original;
    let replaced = 0;
    let skipped = 0;

    for (const pattern of PATTERNS) {
        if (!pattern.replace) continue;
        const matches = content.match(pattern.regex);
        if (!matches) continue;

        content = content.replace(pattern.regex, (...args) => {
            const result = pattern.replace(...args);
            if (result) {
                replaced++;
                return result;
            }
            skipped++;
            return args[0];
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

console.log(`🔄 CSP Phase 2b Pass 4: Final migration...${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

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
console.log(`📂 Processing ${files.length} JS files\n`);
for (const file of files) processFile(file);

console.log(`\n📊 Results:`);
console.log(`   Migrated:  ${totalReplaced}`);
console.log(`   Skipped:   ${totalSkipped}`);
if (DRY_RUN) console.log(`\n🔍 Dry run complete. No files were modified.`);
