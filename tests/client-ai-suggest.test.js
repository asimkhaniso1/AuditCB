import { describe, it, expect } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./client-ai-suggest.js'), 'utf8');
eval(src);

const S = window.ClientAISuggest;

const client = {
    id: 'c1',
    name: 'KTD Select',
    industry: 'Electronics Manufacturing',
    standard: 'ISO 9001:2015',
    employees: 120,
    website: 'https://ktdselect.example',
    sites: [{ name: 'Head Office', city: 'Karachi', country: 'Pakistan', employees: 120 }],
    departments: [{ name: 'Production' }],
    designations: [{ title: 'Quality Manager' }],
    goodsServices: [{ name: 'Wire Harnesses', category: 'Product' }],
    keyProcesses: [{ name: 'Assembly', category: 'Core' }],
    documents: [{ name: 'Counterfeit Parts Prevention', linkedClauses: '8.4, 8.5' }]
};

describe('ClientAISuggest', () => {
    describe('buildContext', () => {
        it('includes the identifying facts about the client', () => {
            const ctx = S.buildContext(client);
            expect(ctx).toContain('KTD Select');
            expect(ctx).toContain('Electronics Manufacturing');
            expect(ctx).toContain('ISO 9001:2015');
            expect(ctx).toContain('Head Office, Karachi');
        });

        it('lists what is already recorded so the model does not repeat it', () => {
            const ctx = S.buildContext(client);
            expect(ctx).toContain('Departments already recorded: Production');
            expect(ctx).toContain('Wire Harnesses (Product)');
            expect(ctx).toContain('Key processes already recorded: Assembly [Core]');
        });

        it('carries the bulk-imported documents and their clause mapping', () => {
            expect(S.buildContext(client)).toContain('Counterfeit Parts Prevention [clauses 8.4, 8.5]');
        });

        it('appends website text when a scan was run', () => {
            const ctx = S.buildContext(client, 'We manufacture custom cable assemblies for aerospace.');
            expect(ctx).toContain('read from the client\'s website');
            expect(ctx).toContain('custom cable assemblies');
        });

        it('omits sections the client has no data for', () => {
            const ctx = S.buildContext({ name: 'Bare Co' });
            expect(ctx).toBe('Company: Bare Co');
        });

        it('caps very long website text', () => {
            const ctx = S.buildContext(client, 'x'.repeat(50000));
            expect(ctx.length).toBeLessThan(20000);
        });
    });

    describe('buildPrompt', () => {
        it('asks for the right entity and count', () => {
            const prompt = S.buildPrompt(client, 'goods', 'CONTEXT HERE', 12, '');
            expect(prompt).toContain('up to 12 Goods & Services');
            expect(prompt).toContain('CONTEXT HERE');
            expect(prompt).toContain('JSON array');
        });

        it('carries the kind-specific guidance', () => {
            expect(S.buildPrompt(client, 'processes', 'ctx', 8, '')).toContain('Outsourced');
        });

        it('includes the auditor\'s extra instruction when given', () => {
            const prompt = S.buildPrompt(client, 'processes', 'ctx', 8, 'focus on the harness line');
            expect(prompt).toContain('focus on the harness line');
        });

        it('leaves no empty instruction line when none is given', () => {
            expect(S.buildPrompt(client, 'processes', 'ctx', 8, '')).not.toContain('Additional instruction');
        });

        it('tells the model not to invent specifics', () => {
            expect(S.buildPrompt(client, 'goods', 'ctx', 8, '')).toContain('Never invent');
        });
    });

    describe('parseSuggestions', () => {
        it('parses a bare JSON array', () => {
            expect(S.parseSuggestions('[{"name":"Welding"}]')).toEqual([{ name: 'Welding' }]);
        });

        it('parses a fenced JSON array', () => {
            const out = S.parseSuggestions('```json\n[{"name":"Welding"}]\n```');
            expect(out).toHaveLength(1);
        });

        it('parses an array wrapped in commentary', () => {
            const out = S.parseSuggestions('Here you go:\n[{"name":"Welding"},{"name":"Plating"}]\nHope that helps.');
            expect(out).toHaveLength(2);
        });

        it('returns empty for malformed JSON rather than throwing', () => {
            expect(S.parseSuggestions('[{"name": ]')).toEqual([]);
        });

        it('returns empty for a non-array response', () => {
            expect(S.parseSuggestions('{"name":"Welding"}')).toEqual([]);
        });

        it('returns empty for nothing at all', () => {
            expect(S.parseSuggestions('')).toEqual([]);
        });

        it('drops non-object entries', () => {
            expect(S.parseSuggestions('["Welding", {"name":"Plating"}]')).toEqual([{ name: 'Plating' }]);
        });
    });

    describe('dedupeAgainstExisting', () => {
        const keyOf = item => item.name;

        it('flags a suggestion the client already has', () => {
            const out = S.dedupeAgainstExisting([{ name: 'Assembly' }], [{ name: 'assembly' }], keyOf);
            expect(out[0]._existing).toBe(true);
        });

        it('ignores punctuation and spacing when comparing', () => {
            const out = S.dedupeAgainstExisting([{ name: 'Wire-Harnesses' }], [{ name: 'wire harnesses' }], keyOf);
            expect(out[0]._existing).toBe(true);
        });

        it('drops duplicates inside the batch itself', () => {
            const out = S.dedupeAgainstExisting([{ name: 'Welding' }, { name: 'welding' }], [], keyOf);
            expect(out).toHaveLength(1);
        });

        it('drops entries with no usable key', () => {
            expect(S.dedupeAgainstExisting([{ name: '' }, { name: '   ' }], [], keyOf)).toHaveLength(0);
        });

        it('marks genuinely new suggestions as new', () => {
            const out = S.dedupeAgainstExisting([{ name: 'Plating' }], [{ name: 'Assembly' }], keyOf);
            expect(out[0]._existing).toBe(false);
        });

        it('uses the kind\'s own key accessor', () => {
            const out = S.dedupeAgainstExisting(
                [{ title: 'Quality Manager' }],
                [{ title: 'Quality Manager' }],
                S.KINDS.designations.keyOf
            );
            expect(out[0]._existing).toBe(true);
        });
    });

    describe('KINDS', () => {
        it('covers the four Account Setup lists', () => {
            expect(Object.keys(S.KINDS).sort()).toEqual(['departments', 'designations', 'goods', 'processes']);
        });

        it('writes to the client fields the rest of the app reads', () => {
            expect(S.KINDS.processes.field).toBe('keyProcesses');
            expect(S.KINDS.goods.field).toBe('goodsServices');
            expect(S.KINDS.designations.field).toBe('designations');
            expect(S.KINDS.departments.field).toBe('departments');
        });

        it('gives every kind a key accessor that matches its columns', () => {
            Object.values(S.KINDS).forEach(cfg => {
                const sample = {};
                cfg.columns.forEach(c => { sample[c.key] = c.key; });
                expect(cfg.keyOf(sample)).toBeTruthy();
            });
        });
    });
});
