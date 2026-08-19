// Client-facing hygiene guard (specification #33).
//
// The defects the certification body reported are DISPLAY-layer: text that
// reached the client document. report-integrity.js catches them in a report's
// DATA, but nothing stops a hardcoded string being reintroduced into a template
// — the original offenders were all literals sitting in the report builders.
// These tests read the report-generation sources and assert those literals stay
// gone, which is cheap, has no runtime dependencies, and fails loudly the moment
// someone pastes one back.
//
// Deliberately limited to strings that must appear NOWHERE, so the suite never
// becomes a guessing game about which occurrence was legitimate.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Every module that contributes text to the printed client report.
const CLIENT_FACING_SOURCES = [
    'execution-reporting.js',
    'report-executive.js',
    'report-findings-ops.js',
    'report-risk.js',
    'report-scoring.js',
    'report-operational.js',
    'report-frameworks.js'
];

function readSource(file) {
    return fs.readFileSync(path.resolve('./' + file), 'utf8');
}

const sources = CLIENT_FACING_SOURCES.map((f) => [f, readSource(f)]);

function expectAbsent(pattern, why) {
    sources.forEach(([file, src]) => {
        const hits = src.match(pattern);
        expect(hits, `${file} reintroduced ${pattern} — ${why}`).toBeNull();
    });
}

describe('client-facing hygiene — banned literals in report builders', () => {
    it('never prints a hardcoded corrective-action day count', () => {
        // Timeframes are certification-body scheme configuration; a literal count
        // states that the audited standard mandates one, which it does not.
        expectAbsent(
            /(Major|Minor)\s+NC\s+—\s+\d+\s+days/,
            'corrective-action timeframes must come from ReportStats.capaTimeframes'
        );
    });

    it('never narrates its own analysis limitations to the client', () => {
        expectAbsent(
            /could be isolated from available data/i,
            'exposes an internal data limitation instead of an audit fact'
        );
    });

    it('never puts internal defensibility commentary in the client report', () => {
        expectAbsent(
            /weakening defensibility|under accreditation (review|scrutiny)/i,
            'defensibility scoring is internal QA data, not client report content'
        );
    });

    it('does not render the QR code that was removed from the report', () => {
        expectAbsent(
            /Scan to (view report card|verify this report)/i,
            'the QR block was removed from the client report'
        );
    });

    it('never labels a certification-programme criterion as an ISO requirement', () => {
        // A column header claiming "ISO Requirement" cannot sit above rows that
        // may hold ISO 17021 surveillance criteria such as 9.6.2(b).
        expectAbsent(
            />\s*ISO Requirement\s*</,
            'mixed-kind criterion tables use a neutral "Requirement" header'
        );
    });
});

describe('client-facing hygiene — CSP safety', () => {
    // vercel.json's script-src has no 'unsafe-inline', so an inline handler is
    // silently dead in production. The Technical Review controls saved nothing
    // for weeks because of exactly this.
    it('uses event delegation rather than inline handlers', () => {
        const modules = CLIENT_FACING_SOURCES.concat(['execution-module-v2.js', 'ai-service.js']);
        modules.forEach((file) => {
            const src = readSource(file);
            const inline = src.match(/\son(click|change|input|submit)\s*=\s*["']/gi);
            expect(inline, `${file} uses an inline handler, which CSP blocks in production`).toBeNull();
        });
    });
});

describe('client-facing hygiene — AI prompts keep classifications distinct', () => {
    it('never asks the model for a combined observations/OFI figure', () => {
        const src = readSource('ai-service.js');
        // The shipped defect was a prompt asking for "observations/OFIs (N)",
        // which produced "4 non-conformities and 5 opportunities for improvement"
        // from an audit with 4 observations and 1 OFI.
        expect(src).not.toMatch(/observations\s*\/\s*OFIs?\s*\(/i);
    });
});
