// The storage-lockdown migrations are run by hand in the Supabase SQL editor
// on a Free-plan project with no backups. These checks keep their safety
// properties from drifting: they only touch policies, never objects or bucket
// flags; they grant nothing to anon/public; each runs in one transaction; and
// each can be re-run.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = [
    {
        file: 'SECURE_AUDIT_IMAGES_POLICIES.sql',
        bucketRegex: "'''(audit-images|app-data|audit-logos)'''",
        expected: {
            audit_images_: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
            audit_logos_: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
            app_data_: ['SELECT']
        }
    },
    {
        file: 'SECURE_AUDIT_REPORTS_FILES_POLICIES.sql',
        bucketRegex: "'''(audit-reports|audit-files)'''",
        expected: {
            audit_reports_: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
            audit_files_: ['DELETE', 'INSERT', 'SELECT', 'UPDATE']
        }
    }
];

describe.each(MIGRATIONS)('$file', ({ file, bucketRegex, expected }) => {
    const raw = readFileSync(path.join(here, '..', 'migrations', file), 'utf8');
    // Executable SQL only: drop full-line comments (preview/rollback/optional blocks).
    const sql = raw.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
    const createPolicies = [...sql.matchAll(/CREATE POLICY\s+"([^"]+)"\s+ON storage\.objects\s+FOR\s+(\w+)\s+TO\s+(\w+)/g)]
        .map((m) => ({ name: m[1], cmd: m[2], role: m[3] }));
    const expectedCount = Object.values(expected).reduce((n, cmds) => n + cmds.length, 0);

    it('runs as one transaction', () => {
        const begin = sql.indexOf('BEGIN;');
        const commit = sql.indexOf('COMMIT;');
        expect(begin).toBeGreaterThan(-1);
        expect(commit).toBeGreaterThan(begin);
        // every change sits between BEGIN and COMMIT
        expect(sql.slice(0, begin)).not.toMatch(/\b(CREATE|DROP|UPDATE|DELETE|INSERT)\b/);
        expect(sql.slice(commit)).not.toMatch(/\b(CREATE|DROP|UPDATE|DELETE|INSERT)\b/);
    });

    it('never deletes objects or changes bucket flags', () => {
        expect(sql).not.toMatch(/DELETE\s+FROM/i);
        expect(sql).not.toMatch(/UPDATE\s+storage\./i);
        expect(sql).not.toMatch(/INSERT\s+INTO/i);
        expect(sql).not.toMatch(/\.remove\(|TRUNCATE/i);
    });

    it('only grants to authenticated', () => {
        expect(createPolicies.length).toBe(expectedCount);
        createPolicies.forEach((p) => expect(p.role).toBe('authenticated'));
        expect(sql).not.toMatch(/TO\s+(public|anon)\b/i);
    });

    it('is re-runnable: each created policy is dropped IF EXISTS first', () => {
        createPolicies.forEach((p) => {
            const drop = sql.indexOf(`DROP POLICY IF EXISTS "${p.name}" ON storage.objects;`);
            const create = sql.indexOf(`CREATE POLICY "${p.name}"`);
            expect(drop, p.name).toBeGreaterThan(-1);
            expect(drop, p.name).toBeLessThan(create);
        });
    });

    it('grants each bucket exactly the commands the app needs', () => {
        Object.entries(expected).forEach(([prefix, cmds]) => {
            const got = createPolicies.filter((p) => p.name.startsWith(prefix)).map((p) => p.cmd).sort();
            expect(got, prefix).toEqual(cmds);
        });
    });

    it('drops only public/anon policies on its own buckets, after the shared-policy guard', () => {
        const guard = sql.indexOf('RAISE EXCEPTION');
        const dropLoop = sql.indexOf("EXECUTE format('DROP POLICY %I ON storage.objects'");
        expect(guard).toBeGreaterThan(-1);
        expect(dropLoop).toBeGreaterThan(guard);
        const loop = sql.slice(guard, dropLoop);
        expect(loop).toMatch(/roles && ARRAY\['public', 'anon'\]::name\[\]/);
        expect(loop).toContain(bucketRegex);
        expect(sql.match(/EXECUTE format\('DROP POLICY/g)).toHaveLength(1);
    });
});
