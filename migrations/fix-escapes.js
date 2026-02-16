// Fix the nested template literal issues
// Problem: ${isAdmin ? '<button onclick="window.editSite('${client.id}', ${i})">' : ''}
// Inside a template literal, single-quoted strings can't contain ${...}
// Solution: Use the outer template literal's ${} interpolation directly
const fs = require('fs');
const file = 'clients-module-fix.js';
let content = fs.readFileSync(file, 'utf8');

// Replace patterns like:
//   ${isAdmin ? '<button class="action-btn edit" ... onclick="window.editSite('${client.id}', ${i})"...' : ''}
// With:
//   ${isAdmin ? `<button class="action-btn edit" ... onclick="window.editSite('${client.id}', ${i})"...` : ''}
// i.e., change the outer ' quotes to backticks so ${} works

let count = 0;
// Find patterns: ${isAdmin ? '...' : ''}  and change to ${isAdmin ? `...` : ''}
// Only for lines containing client.id or ${i}
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match: ${isAdmin ? '<button ...' : ''}  where the button string has ${client.id} or ${i}
    if (line.includes("${isAdmin ?") && (line.includes("${client.id}") || line.includes("${i}"))) {
        // Replace the opening ' after ? with ` and closing ' before : '' with `
        let fixed = line.replace(/\$\{isAdmin \? '(<button[^']*)\$\{client\.id\}([^']*)\$\{i\}([^']*)' : ''\}/,
            (m, before, mid, after) => {
                count++;
                return '${isAdmin ? `' + before + '${client.id}' + mid + '${i}' + after + '` : \'\'}';
            });
        if (fixed === line) {
            // Simpler pattern without ${i} (e.g., addSite only needs client.id)
            fixed = line.replace(/\$\{isAdmin \? '(<button[^']*)\$\{client\.id\}([^']*)' : ''\}/,
                (m, before, after) => {
                    count++;
                    return '${isAdmin ? `' + before + '${client.id}' + after + '` : \'\'}';
                });
        }
        lines[i] = fixed;
    }
}

// Actually this regex approach is getting too complex. Let me just directly fix the specific lines.
// Read the file fresh and do targeted replacements:
content = lines.join('\n');

// Simpler approach: Replace the specific broken patterns
// Pattern: ${isAdmin ? '<button class="action-btn edit" title="Edit" onclick="window.editSite('${client.id}', ${i})"><i class="fa-solid fa-pen"></i></button>' : ''}
// Just wrap the button HTML in backticks instead of quotes

content = content.replace(
    /\$\{isAdmin \? '<button class="action-btn edit" title="Edit" onclick="window\.editSite\('\$\{client\.id\}', \$\{i\}\)"><i class="fa-solid fa-pen"><\/i><\/button>' : ''\}/g,
    '${isAdmin ? `<button class="action-btn edit" title="Edit" onclick="window.editSite(\'${client.id}\', ${i})"><i class="fa-solid fa-pen"></i></button>` : \'\'}'
);

content = content.replace(
    /\$\{isAdmin \? '<button class="action-btn delete" title="Delete" onclick="window\.deleteSite\('\$\{client\.id\}', \$\{i\}\)"><i class="fa-solid fa-trash"><\/i><\/button>' : ''\}/g,
    '${isAdmin ? `<button class="action-btn delete" title="Delete" onclick="window.deleteSite(\'${client.id}\', ${i})"><i class="fa-solid fa-trash"></i></button>` : \'\'}'
);

content = content.replace(
    /\$\{isAdmin \? '<button class="btn btn-sm" style="background:#3b82f6;color:white;border:none;border-radius:8px;margin-top:0\.75rem" onclick="window\.addSite\('\$\{client\.id\}'\)"><i class="fa-solid fa-plus"><\/i> Add First Site<\/button>' : ''\}/g,
    '${isAdmin ? `<button class="btn btn-sm" style="background:#3b82f6;color:white;border:none;border-radius:8px;margin-top:0.75rem" onclick="window.addSite(\'${client.id}\')"><i class="fa-solid fa-plus"></i> Add First Site</button>` : \'\'}'
);

fs.writeFileSync(file, content);
console.log(`Fixed ${count} patterns (regex)`);

try {
    require('child_process').execSync('node --check clients-module-fix.js', { stdio: 'pipe' });
    console.log('Syntax OK');
} catch (e) {
    const errLines = e.stderr.toString().split('\n').slice(0, 6).join('\n');
    console.log('Still has syntax error:\n' + errLines);
}
