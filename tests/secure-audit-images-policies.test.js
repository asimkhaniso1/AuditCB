// migrations/SECURE_AUDIT_IMAGES_POLICIES.sql is run by hand in the Supabase
// SQL editor on a Free-plan project with no backups. These checks keep its
// safety properties from drifting: it only touches policies, never objects or
// bucket flags; it grants nothing to anon/public; it runs in one transaction;
// and it can be re-run.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(path.join(here, '..', 'migrations', 'SECURE_AUDIT_IMAGES_POLICIES.sql'), 'utf8');
// Executable SQL only: drop full-line comments (the optional/rollback blocks).
const sql = raw.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');

const createPolicies = [...sql.matchAll(/CREATE POLICY\s+"([^"]+)"\s+ON storage\.objects\s+FOR\s+(\w+)\s+TO\s+(\w+)/g)]
    .map((m) => ({ name: m[1], cmd: m[2], role: m[3] }));

describe('SECURE_AUDIT_IMAGES_POLICIES.sql', () => {
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
        expect(createPolicies.length).toBe(9);
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

    it('gives the app what it uses: upsert on evidence and logos, read-only app-data', () => {
        const cmds = (bucket) => createPolicies.filter((p) => p.name.startsWith(bucket)).map((p) => p.cmd).sort();
        expect(cmds('audit_images_')).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
        expect(cmds('audit_logos_')).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
        expect(cmds('app_data_')).toEqual(['SELECT']);
    });

    it('drops only public/anon policies on the three buckets, after the shared-policy guard', () => {
        const guard = sql.indexOf('RAISE EXCEPTION');
        const dropLoop = sql.indexOf("EXECUTE format('DROP POLICY %I ON storage.objects'");
        expect(guard).toBeGreaterThan(-1);
        expect(dropLoop).toBeGreaterThan(guard);
        const loop = sql.slice(guard, dropLoop);
        expect(loop).toMatch(/roles && ARRAY\['public', 'anon'\]::name\[\]/);
        expect(loop).toMatch(/'''\(audit-images\|app-data\|audit-logos\)'''/);
        expect(sql.match(/EXECUTE format\('DROP POLICY/g)).toHaveLength(1);
    });
});
