// Fix unquoted client.id in all JS files where it causes runtime errors
const fs = require('fs');
const path = require('path');

const files = [
    'clients-module.js',
    'client-workspace.js',
    'clients-detail.js',
    'clients-module-fix.js'
];

files.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
        console.log(`SKIP: ${file} does not exist`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let count = 0;

    // Fix onclick="funcName(${client.id})" -> onclick="funcName('${client.id}')"
    // Match: word chars followed by (${client.id}) NOT already quoted
    content = content.replace(/(\w+)\(\$\{client\.id\}\)/g, (match, funcName) => {
        // Skip function definitions and variable assignments
        if (['function', 'const', 'let', 'var', 'return', 'if', 'while'].includes(funcName)) return match;
        // Skip if already in a quoted context (check doesn't have surrounding quotes)
        count++;
        return `${funcName}('\${client.id}')`;
    });

    // Fix onclick="funcName(${client.id}, ...)" -> onclick="funcName('${client.id}', ...)"
    content = content.replace(/(\w+)\(\$\{client\.id\},\s*/g, (match, funcName) => {
        if (['function', 'const', 'let', 'var', 'return', 'if', 'while'].includes(funcName)) return match;
        count++;
        return `${funcName}('\${client.id}', `;
    });

    // Fix onclick="funcName(..., ${client.id})" -> onclick="funcName(..., '${client.id}')"
    content = content.replace(/,\s*\$\{client\.id\}\)/g, (match) => {
        count++;
        return `, '\${client.id}')`;
    });

    if (count > 0) {
        fs.writeFileSync(fullPath, content);
        console.log(`${file}: Fixed ${count} references`);
    } else {
        console.log(`${file}: No fixes needed`);
    }

    // Verify syntax
    try {
        require('child_process').execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
        console.log(`  Syntax OK`);
    } catch (e) {
        console.log(`  SYNTAX ERROR: ${e.stderr.toString().trim()}`);
    }
});
