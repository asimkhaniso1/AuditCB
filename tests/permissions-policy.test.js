// The site's Permissions-Policy turned the microphone, camera and location off
// for the whole app, so voice dictation failed with "not-allowed" (PC Connection
// audit, 2026-11-17), the evidence camera button could not open the camera and
// evidence carried no location. They are allowed for the app's own origin only;
// payment stays off.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const vercel = JSON.parse(fs.readFileSync(path.resolve('./vercel.json'), 'utf8'));
const SRC = fs.readFileSync(path.resolve('./execution-module-v2.js'), 'utf8');

const policy = () => {
    for (const block of vercel.headers || []) {
        for (const h of block.headers || []) if (h.key === 'Permissions-Policy') return h.value;
    }
    return null;
};

describe('Permissions-Policy', () => {
    it('allows microphone, camera and location for this origin only', () => {
        const p = policy();
        expect(p).toContain('microphone=(self)');
        expect(p).toContain('camera=(self)');
        expect(p).toContain('geolocation=(self)');
        expect(p).not.toMatch(/\*/);
    });

    it('keeps payment off', () => {
        expect(policy()).toContain('payment=()');
    });
});

describe('dictation error message', () => {
    it('explains a blocked microphone instead of printing "not-allowed"', () => {
        expect(SRC).toContain("'not-allowed': 'Microphone blocked. Click the lock icon in the address bar, allow Microphone for this site, then try again.'");
    });
});
