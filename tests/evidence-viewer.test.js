// The evidence viewer has controls.
//
// A checklist thumbnail opened a lightbox showing one image and a close button:
// no way to step to the item's next screenshot, no count, no zoom. Reviewing PC
// Connection's 2026 recertification evidence (a screenshot of its internal audit
// report, among others) the auditor could not see past the first image or read
// the document in it. The Review & Submit viewer's thumbnail strip had a broken
// attribute and did not switch images either.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

const IMGS = ['https://x/ev-1.jpg', 'https://x/ev-2.jpg', 'https://x/ev-3.jpg'];
const viewer = () => document.getElementById('evidence-viewer');
const label = () => viewer().querySelector('.ev-viewer-label').textContent;
const shown = () => viewer().querySelector('img').getAttribute('src');
const btn = (name) => Array.from(viewer().querySelectorAll('button')).find((b) => b.getAttribute('aria-label').startsWith(name));
const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

beforeEach(() => {
    document.body.innerHTML = '';
    window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
    window.showNotification = () => { };
    // execution-evidence.js re-exports this global from execution-list.js.
    globalThis.renderExecutionDetail = window.renderExecutionDetail = () => { };
    loadScript('./execution-evidence.js', { params: { module: undefined } });
    loadScript('./csp-adapters.js', { params: { module: undefined } });
    window.EvidenceViewer.close();
});

describe('EvidenceViewer', () => {
    it('shows a count and steps through the images with the buttons and the arrow keys', () => {
        window.EvidenceViewer.open(IMGS, 0);
        expect(label()).toBe('Evidence 1 of 3');
        expect(shown()).toBe(IMGS[0]);
        btn('Next image').click();
        expect([label(), shown()]).toEqual(['Evidence 2 of 3', IMGS[1]]);
        key('ArrowLeft');
        key('ArrowLeft');
        expect([label(), shown()]).toEqual(['Evidence 3 of 3', IMGS[2]]); // wraps round
    });

    it('zooms in to 100% for reading and back to Fit', () => {
        window.EvidenceViewer.open(IMGS, 0);
        const zoomText = () => Array.from(viewer().querySelectorAll('span')).map((s) => s.textContent).find((t) => /Fit|%/.test(t));
        expect(zoomText()).toBe('Fit');
        btn('Zoom in').click();
        expect(zoomText()).toBe('100%');
        key('+');
        expect(zoomText()).toBe('150%');
        btn('Fit to window').click();
        expect(zoomText()).toBe('Fit');
    });

    it('closes with Esc and with the Close button', () => {
        window.EvidenceViewer.open(IMGS, 1);
        key('Escape');
        expect(viewer()).toBeNull();
        window.EvidenceViewer.open(IMGS, 1);
        btn('Close').click();
        expect(viewer()).toBeNull();
        expect(window.EvidenceViewer.isOpen()).toBe(false);
    });

    it('has no previous/next controls for a single image', () => {
        window.EvidenceViewer.open([IMGS[0]], 0);
        expect(label()).toBe('Evidence 1 of 1');
        expect(btn('Next image')).toBeUndefined();
    });
});

describe('every entry point opens it, with the item\'s other images', () => {
    const strip = () => {
        document.body.innerHTML = '<div id="evidence-preview-cl1-9-1">'
            + IMGS.map((s) => '<div class="ev-thumb"><img src="' + s + '" data-action="viewEvidenceImageByUrlSelf" data-src="' + s + '"></div>').join('')
            + '<div class="ev-thumb"><img src="" data-idb-key="idb://pending"></div></div>';
    };

    it('a checklist thumbnail opens at that image, among its item\'s images', () => {
        strip();
        window.viewEvidenceImageByUrlSelf(document.querySelectorAll('.ev-thumb img')[1]);
        expect([label(), shown()]).toEqual(['Evidence 2 of 3', IMGS[1]]); // the still-loading thumbnail is skipped
    });

    it('a thumbnail URL finds its strip too', () => {
        strip();
        window.viewEvidenceImageByUrl(IMGS[2]);
        expect(label()).toBe('Evidence 3 of 3');
    });

    it('Review & Submit "View Evidence" opens all of the finding\'s images', () => {
        window._evidenceCache = { 'checklist-4': IMGS };
        window.viewEvidenceImageDirect('checklist-4');
        expect(label()).toBe('Evidence 1 of 3');
        btn('Next image').click();
        expect(shown()).toBe(IMGS[1]);
    });

    it('an image URL with a quote cannot break the viewer', () => {
        window.EvidenceViewer.open(['https://x/a"onerror="alert(1).jpg'], 0);
        expect(viewer().querySelector('img').getAttribute('onerror')).toBeNull();
    });
});
