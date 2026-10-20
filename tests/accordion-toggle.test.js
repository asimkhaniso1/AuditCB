// window.toggleAccordion is defined once, in csp-adapters.js, and serves two
// call shapes: checklist-module.js's Checklist Library passes the clicked
// header ELEMENT (its markup sets no data-id), the Execution view passes a
// SECTION ID. execution-module-v2.js used to define a second, id-only copy that
// replaced this one once the Execution view rendered, which killed the
// library's accordions. That copy is gone; these tests pin both shapes on the
// one definition, and tests/duplicate-globals.test.js keeps a second
// definition from coming back.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;


function loadCspAdapters() {
    loadScript('./csp-adapters.js', { params: { module: undefined } });
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

describe('window.toggleAccordion (csp-adapters.js)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        loadCspAdapters();
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
