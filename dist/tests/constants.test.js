import { describe, it, expect } from 'vitest';

// Load constants module
globalThis.window = globalThis.window || globalThis;
const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./constants.js'), 'utf8');
eval(src);

describe('CONSTANTS', () => {
    it('should be defined on window', () => {
        expect(window.CONSTANTS).toBeDefined();
    });

    describe('STATUS', () => {
        it('should have required status values', () => {
            const { STATUS } = window.CONSTANTS;
            expect(STATUS).toBeDefined();
            expect(STATUS.DRAFT).toBeDefined();
            expect(STATUS.IN_PROGRESS).toBeDefined();
            expect(STATUS.FINALIZED).toBeDefined();
        });

        it('should have string values', () => {
            const { STATUS } = window.CONSTANTS;
            Object.values(STATUS).forEach(val => {
                expect(typeof val).toBe('string');
            });
        });
    });

    describe('ROLES', () => {
        it('should have defined role values', () => {
            const { ROLES } = window.CONSTANTS;
            expect(ROLES).toBeDefined();
            expect(Object.keys(ROLES).length).toBeGreaterThan(0);
        });
    });
});
