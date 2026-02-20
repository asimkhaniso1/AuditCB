const fs = require('fs');
const path = require('path');

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];

    // Simple CSV parser that handles quoted commas
    const parseLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (line[i] === '"') {
                inQuotes = !inQuotes;
            } else if (line[i] === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += line[i];
            }
        }
        result.push(current);
        return result;
    };

    const headers = parseLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const obj = {};
        headers.forEach((h, index) => {
            let val = values[index] || '';
            // Try to parse JSON if it looks like it
            if (val.startsWith('[') || val.startsWith('{')) {
                try {
                    val = JSON.parse(val);
                } catch (e) { /* intentional: keep as string if not valid JSON */ }
            }
            obj[h] = val;
        });
        data.push(obj);
    }
    return data;
}

const recoveryData = {
    clients: parseCSV(path.join(__dirname, 'clients_rows.csv')),
    profiles: parseCSV(path.join(__dirname, 'profiles_rows.csv')),
    settings: parseCSV(path.join(__dirname, 'settings_rows.csv'))
};

fs.writeFileSync(path.join(__dirname, 'recovery_data.json'), JSON.stringify(recoveryData, null, 2));
console.log('Successfully created recovery_data.json');
