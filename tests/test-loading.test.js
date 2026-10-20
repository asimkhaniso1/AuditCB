// Tests must load browser scripts through tests/helpers/load-script.js. Code run
// via eval / new Function has no script URL, so V8 coverage credits it to no
// file: coverage read ~10% with the biggest modules at 0% even though tests
// exercised them. This keeps new tests from bringing that back.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Evaluating a snippet cut out of a file (not the whole file) can't be
// attributed to the file anyway, so these stay as they are.
const SNIPPET_LOADERS = new Set(['previous-findings-status.test.js', 'report-status-consistency.test.js']);

describe('test source loading', () => {
    it('no test evaluates source with eval or new Function', () => {
        const dir = path.resolve('./tests');
        const offenders = [];
        for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.test.js') && f !== 'test-loading.test.js')) {
            if (SNIPPET_LOADERS.has(f)) continue;
            const text = fs.readFileSync(path.join(dir, f), 'utf8');
            text.split('\n').forEach((line, i) => {
                if (/^\s*\/\//.test(line)) return;
                if (/(^|[^\w.])eval\(|new Function\(/.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
            });
        }
        expect(offenders, 'use loadScript() from tests/helpers/load-script.js').toEqual([]);
    });
});
