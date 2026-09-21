// Prints the corrected documents through a real Chrome, with the print dialog's
// default "Headers and footers" LEFT ON, and asserts on the resulting PDF — the
// only place page count, "Page X of Y", blank pages and browser decoration can
// truly be checked. Skipped where Chrome or Python+PyMuPDF are unavailable; the
// static equivalents (PrintShell.lint and the gate) always run elsewhere.

import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildScenario } from '../tools/pcc-scenario.mjs';

const CHROME = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].find(p => fs.existsSync(p));
const py = ['python', 'python3'].find(cmd => spawnSync(cmd, ['-c', 'import fitz'], { encoding: 'utf8' }).status === 0);
const can = !!CHROME && !!py;

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'audit360-pdf-'));
function qa(html, name) {
    const src = path.join(work, name + '.html');
    fs.writeFileSync(src, html);
    const json = path.join(work, name + '.json');
    const r = spawnSync(py, [path.resolve('tools/pdf_qa.py'), src, path.join(work, 'out'), '--name', name, '--json', json], { encoding: 'utf8', timeout: 240000 });
    return { status: r.status, out: r.stdout + r.stderr, report: fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, 'utf8')) : null };
}
const passed = (rep, check) => (rep.checks.find(c => c.check.startsWith(check)) || {}).ok;

describe.skipIf(!can)('the corrected documents, printed by Chrome with browser headers/footers ON', () => {
    let s; let plan; let checklist; let internal;
    beforeAll(async () => {
        s = await buildScenario();
        plan = qa(s.html, 'plan');
        checklist = qa(s.checklistHtml, 'checklist');
        internal = qa(s.internal, 'internal');
    }, 600000);

    it('the audit plan passes every PDF check', () => {
        expect(plan.out).toContain('PASS');
        expect(plan.status).toBe(0);
    });
    it('the checklist passes every PDF check', () => {
        expect(checklist.out).toContain('PASS');
        expect(checklist.status).toBe(0);
    });
    it('the internal record passes every PDF check', () => {
        expect(internal.status).toBe(0);
    });

    it('prints "Page N of Y" correctly on every page, where Y is the real page count', () => {
        [plan, checklist, internal].forEach(r => expect(passed(r.report, 'Page X of Y'), r.out).toBe(true));
        expect(plan.report.pages).toBeGreaterThanOrEqual(3);
        const text = fs.readFileSync(path.join(work, 'out', 'plan.txt'), 'utf8');
        expect(text).toContain(`Page ${plan.report.pages} of ${plan.report.pages}`);
        expect(text).not.toContain('Page 1 of 1');
    });
    it('has no blank or near-blank page, and no trailing blank page', () => {
        [plan, checklist, internal].forEach(r => expect(passed(r.report, 'No blank'), r.out).toBe(true));
    });
    it('carries no browser header, footer, timestamp, page counter or "about:blank"', () => {
        [plan, checklist, internal].forEach(r => expect(passed(r.report, 'No browser'), r.out).toBe(true));
        const text = fs.readFileSync(path.join(work, 'out', 'plan.txt'), 'utf8');
        expect(text).not.toMatch(/about:blank/);
    });
    it('has no raw HTML entity and no numeric date in the extracted text', () => {
        [plan, checklist].forEach(r => { expect(passed(r.report, 'No raw HTML'), r.out).toBe(true); expect(passed(r.report, 'No numeric'), r.out).toBe(true); });
    });
    it('prints the agenda table header on every continuation page', () => {
        const text = fs.readFileSync(path.join(work, 'out', 'plan.txt'), 'utf8');
        const pages = text.split('=====PAGE=====').slice(1); // pages after the first carry table rows
        const withRows = pages.filter(p => /Day \d/.test(p));
        expect(withRows.length).toBeGreaterThan(0);
        withRows.forEach(p => expect(p).toMatch(/DAY[\s\S]*TIME[\s\S]*ACTIVITY/i));
    });
    it('the checklist header repeats on continuation pages', () => {
        const text = fs.readFileSync(path.join(work, 'out', 'checklist.txt'), 'utf8');
        const pages = text.split('=====PAGE=====').slice(2, 6);
        pages.forEach(p => expect(p).toMatch(/CLAUSE[\s\S]*REQUIREMENT[\s\S]*STATUS/));
    });
    it('shows the scheduled audit and the written time zone in the PDF', () => {
        const text = fs.readFileSync(path.join(work, 'out', 'plan.txt'), 'utf8');
        expect(text).toContain('3\u20135 November 2026');
        expect(text).toMatch(/Eastern Standard Time \(EST, UTC.05:00\)/);
        expect(fs.readFileSync(path.join(work, 'out', 'checklist.txt'), 'utf8')).toContain('Scheduled audit: 3\u20135 November 2026');
    });
});

describe.skipIf(!can)('the harness fails on the old defects (so the checks above are not vacuous)', () => {
    it('flags browser decoration, a static page number, a spill-over footer page and a raw entity', () => {
        const rows = Array.from({ length: 30 }, (_, i) => `<tr><td>Day 1</td><td>Patch &amp;amp; Vulnerability ${i}</td></tr>`).join('');
        const old = `<!doctype html><html><head><title>Audit Plan</title><style>body{font:12pt Arial;padding:40px}td{padding:8px}
            .footer{margin-top:50px;padding-top:20px;border-top:1px solid #ccc}</style></head><body>
            <h1>AUDIT PLAN</h1><p>Scheduled 03/11/2026 \u2013 05/11/2026</p><table>${rows}</table>
            <div class="footer">Generated by Audit360 \u2022 Page 1 of 1</div></body></html>`;
        const r = qa(old, 'olddefect');
        expect(r.status).toBe(1);
        const failed = r.report.checks.filter(c => !c.ok).map(c => c.check);
        expect(failed.join(' | ')).toMatch(/Page X of Y/);
        expect(failed.join(' | ')).toMatch(/browser header/i);
        expect(failed.join(' | ')).toMatch(/raw HTML/i);
        expect(failed.join(' | ')).toMatch(/numeric/i);
    }, 240000);
});

describe('environment', () => {
    it.skipIf(can)('note: Chrome or Python+PyMuPDF not found; PDF-level checks skipped', () => {
        expect(can).toBe(false);
    });
});
