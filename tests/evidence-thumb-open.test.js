// Saved checklist photos would not open (PC Connection, 2026-11-18): the
// thumbnail carried data-id, so the delegator passed the URL string to
// viewEvidenceImageByUrlSelf, which read .dataset on it and threw a TypeError
// ("An unexpected error occurred"). Photos added in the session used another
// handler and opened, so only reloaded photos failed.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

let opened;
beforeEach(() => {
    window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
    loadScript('./csp-adapters.js', { params: { module: undefined } });
    opened = vi.fn();
    window.viewEvidenceImageByUrl = opened;
});

describe('viewEvidenceImageByUrlSelf', () => {
    it('opens from the element (no data-id): its src', () => {
        document.body.innerHTML = '<img src="https://x/ims-0.jpg" data-src="https://x/ims-0.jpg">';
        window.viewEvidenceImageByUrlSelf(document.querySelector('img'));
        expect(opened).toHaveBeenCalledWith('https://x/ims-0.jpg');
    });

    it('opens from a URL string (what the delegator passes when data-id is set) without throwing', () => {
        expect(() => window.viewEvidenceImageByUrlSelf('https://x/a-0.jpg')).not.toThrow();
        expect(opened).toHaveBeenCalledWith('https://x/a-0.jpg');
    });

    it('does nothing for an empty source', () => {
        window.viewEvidenceImageByUrlSelf('');
        document.body.innerHTML = '<img src="">';
        window.viewEvidenceImageByUrlSelf(document.querySelector('img'));
        expect(opened).not.toHaveBeenCalled();
    });

    it('a click on a saved checklist thumbnail opens it through the delegator', () => {
        loadScript('./event-delegator.js', { params: { module: undefined } });
        document.body.innerHTML = '<div class="ev-thumb"><img src="https://x/isms-4.jpg" data-action="viewEvidenceImageByUrlSelf" data-src="https://x/isms-4.jpg"></div>';
        document.querySelector('img').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(opened).toHaveBeenCalledWith('https://x/isms-4.jpg');
    });
});
