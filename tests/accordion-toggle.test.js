// window.toggleAccordion is defined TWICE — csp-adapters.js (element-based,
// for checklist-module.js's Checklist Library markup, which sets no data-id)
// and execution-module-v2.js (section-id-based, for the Execution view, which
// does). index.html loads execution-module-v2.js after csp-adapters.js, so the
// id-based definition won at runtime; the Checklist Library then passed a DOM
// element into getElementById(), got null, and its accordions silently stopped
// opening.
//
// Both definitions are now shape-agnostic and equivalent, so whichever loads
// last, BOTH call sites keep working. These tests run each definition against
// both shapes — that symmetry is the actual guarantee, so a future edit to one
// file can't quietly reintroduce the collision.
import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;

const fs = await import('fs');
const path = await import('path');

function loadCspAdapters() {
    eval(fs.readFileSync(path.resolve('./csp-adapters.js'), 'utf8'));
}

// execution-module-v2.js's export tail references names only ever assigned as
// window.* inside nested functions, so shadow `module` to keep that branch
// dead during eval — same approach tests/ncr-checklist-sync.test.js uses.
function loadExecutionModule() {
    const src = fs.readFileSync(path.resolve('./execution-module-v2.js'), 'utf8');
    // eslint-disable-next-line no-unused-vars
    const module = undefined;
    window.state = window.state || { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
    eval(src);
}

/** Checklist Library shape: header element, panel is the next sibling. */
function elementMarkup(initialDisplay) {
    document.body.innerHTML = `
        <div class="accordion-section">
            <div id="header" class="accordion-header">
                <span>Clause IMS</span>
                <i class="fa-solid fa-chevron-down accordion-icon" style="transform: rotate(0deg);"></i>
            </div>
            <div class="accordion-content" style="display: ${initialDisplay};">items</div>
        </div>`;
    return {
        header: document.getElementById('header'),
        content: document.querySelector('.accordion-content'),
        icon: document.querySelector('.accordion-icon')
    };
}

/** Execution view shape: panel and chevron addressed by id. */
function idMarkup(initialDisplay) {
    document.body.innerHTML = `
        <div>
            <span data-action="toggleAccordion" data-id="sec-1">Clause 9</span>
            <i class="fa-solid fa-chevron-down accordion-icon" id="icon-sec-1" style="transform: rotate(0deg);"></i>
            <div class="accordion-content" id="sec-1" style="display: ${initialDisplay};">items</div>
        </div>`;
    return {
        content: document.getElementById('sec-1'),
        icon: document.getElementById('icon-sec-1')
    };
}

const LOADERS = [
    ['csp-adapters.js', loadCspAdapters],
    ['execution-module-v2.js', loadExecutionModule]
];

LOADERS.forEach(([name, load]) => {
    describe(`window.toggleAccordion as defined by ${name}`, () => {
        beforeEach(() => {
            document.body.innerHTML = '';
            load();
        });

        it('opens a collapsed panel when handed the header ELEMENT (Checklist Library)', () => {
            const { header, content, icon } = elementMarkup('none');
            window.toggleAccordion(header);
            expect(content.style.display).toBe('block');
            expect(icon.style.transform).toBe('rotate(180deg)');
        });

        it('closes an open panel when handed the header ELEMENT', () => {
            const { header, content, icon } = elementMarkup('block');
            window.toggleAccordion(header);
            expect(content.style.display).toBe('none');
            expect(icon.style.transform).toBe('rotate(0deg)');
        });

        it('opens a collapsed panel when handed a SECTION ID (Execution view)', () => {
            const { content, icon } = idMarkup('none');
            window.toggleAccordion('sec-1');
            expect(content.style.display).toBe('block');
            expect(icon.style.transform).toBe('rotate(180deg)');
        });

        it('closes an open panel when handed a SECTION ID', () => {
            const { content, icon } = idMarkup('block');
            window.toggleAccordion('sec-1');
            expect(content.style.display).toBe('none');
            expect(icon.style.transform).toBe('rotate(0deg)');
        });

        it('round-trips: two toggles return to the starting state', () => {
            const { header, content } = elementMarkup('none');
            window.toggleAccordion(header);
            window.toggleAccordion(header);
            expect(content.style.display).toBe('none');
        });

        it('does nothing rather than throwing on an unresolvable target', () => {
            expect(() => window.toggleAccordion('no-such-id')).not.toThrow();
            expect(() => window.toggleAccordion(null)).not.toThrow();
            expect(() => window.toggleAccordion(undefined)).not.toThrow();
        });
    });
});

// The collision itself: load both files in index.html's order and confirm the
// surviving definition still serves the view that does NOT own it.
describe('load-order collision between the two toggleAccordion definitions', () => {
    it('the Checklist Library still opens after execution-module-v2.js overwrites the handler', () => {
        document.body.innerHTML = '';
        loadCspAdapters();        // index.html line 258
        loadExecutionModule();    // index.html line 278 — wins
        const { header, content } = elementMarkup('none');
        window.toggleAccordion(header);
        expect(content.style.display).toBe('block');
    });

    it('the Execution view still opens under the reverse load order', () => {
        document.body.innerHTML = '';
        loadExecutionModule();
        loadCspAdapters();        // wins in this order
        const { content } = idMarkup('none');
        window.toggleAccordion('sec-1');
        expect(content.style.display).toBe('block');
    });
});
