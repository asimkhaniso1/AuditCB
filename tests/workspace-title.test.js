// Client workspace page heading: the route name ("ncr-capa") printed as
// "Ncr-capa"; headings now use the sidebar's names (PC Connection, 2026-11-17).
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('./client-workspace.js'), 'utf8');

describe('workspace page heading', () => {
    it('names each section as the sidebar does', () => {
        expect(SRC).toContain("'ncr-capa': 'NCR & CAPA'");
        expect(SRC).toContain("docs: 'Document Center'");
        expect(SRC).toContain("'account-setup': 'Account Setup'");
        expect(SRC).toContain('${client.name} - ${sectionTitle}');
        expect(SRC).not.toContain('moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}');
    });
});
