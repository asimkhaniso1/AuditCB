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

        it('should include audit team roles', () => {
            expect(CONSTANTS.ROLES.LEAD_AUDITOR).toBe('Lead Auditor');
            expect(CONSTANTS.ROLES.AUDITOR).toBe('Auditor');
            expect(CONSTANTS.ROLES.TECHNICAL_EXPERT).toBe('Technical Expert');
        });
    });

    describe('NCR_TYPES', () => {
        it('should have all NCR classification types', () => {
            expect(CONSTANTS.NCR_TYPES.MAJOR).toBe('major');
            expect(CONSTANTS.NCR_TYPES.MINOR).toBe('minor');
            expect(CONSTANTS.NCR_TYPES.OBSERVATION).toBe('observation');
            expect(CONSTANTS.NCR_TYPES.OFI).toBe('ofi');
            expect(CONSTANTS.NCR_TYPES.PENDING).toBe('pending_classification');
        });
    });

    describe('NCR_COLORS', () => {
        it('should have a color for each NCR type', () => {
            Object.keys(CONSTANTS.NCR_TYPES).forEach(key => {
                const typeValue = CONSTANTS.NCR_TYPES[key];
                expect(CONSTANTS.NCR_COLORS[typeValue]).toBeDefined();
            });
        });

        it('should have valid hex color format', () => {
            Object.values(CONSTANTS.NCR_COLORS).forEach(color => {
                expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
            });
        });
    });

    describe('Z_INDEX', () => {
        it('should maintain visual stacking order', () => {
            const z = CONSTANTS.Z_INDEX;
            expect(z.DROPDOWN).toBeLessThan(z.MODAL_OVERLAY);
            expect(z.MODAL_OVERLAY).toBeLessThan(z.MODAL);
            expect(z.MODAL).toBeLessThan(z.TOAST);
            expect(z.TOAST).toBeLessThan(z.TOOLTIP);
        });
    });

    describe('COLORS', () => {
        it('should have CSS variable references for theme colors', () => {
            expect(CONSTANTS.COLORS.PRIMARY).toContain('var(');
            expect(CONSTANTS.COLORS.DANGER).toContain('var(');
        });

        it('should have semantic hex colors', () => {
            expect(CONSTANTS.COLORS.TEXT_PRIMARY).toMatch(/^#[0-9a-f]{6}$/);
            expect(CONSTANTS.COLORS.BORDER).toMatch(/^#[0-9a-f]{6}$/);
            expect(CONSTANTS.COLORS.MAJOR).toMatch(/^#[0-9a-f]{6}$/);
        });
    });

    describe('AUDIT_TYPES', () => {
        it('should include ISO 17021 audit types', () => {
            expect(CONSTANTS.AUDIT_TYPES.some(t => t.includes('Stage 1'))).toBe(true);
            expect(CONSTANTS.AUDIT_TYPES.some(t => t.includes('Stage 2'))).toBe(true);
            expect(CONSTANTS.AUDIT_TYPES.some(t => t.includes('Surveillance'))).toBe(true);
            expect(CONSTANTS.AUDIT_TYPES.some(t => t.includes('Recertification'))).toBe(true);
        });
    });

    describe('NCR_CRITERIA', () => {
        it('should define MAJOR and MINOR with descriptions and triggers', () => {
            expect(CONSTANTS.NCR_CRITERIA.MAJOR.description).toBeDefined();
            expect(CONSTANTS.NCR_CRITERIA.MAJOR.triggers.length).toBeGreaterThan(0);
            expect(CONSTANTS.NCR_CRITERIA.MINOR.description).toBeDefined();
            expect(CONSTANTS.NCR_CRITERIA.MINOR.triggers.length).toBeGreaterThan(0);
        });
    });
});
