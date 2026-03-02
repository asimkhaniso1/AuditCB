import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Logger globally (password-utils.js references window.Logger)
globalThis.window = globalThis.window || globalThis;
window.Logger = { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() };

// Load PasswordUtils module
// Since it's a vanilla JS file that assigns to window, we eval it
const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./password-utils.js'), 'utf8');
eval(src);

describe('PasswordUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Note: hashPassword and verifyPassword use crypto.subtle.deriveBits (PBKDF2)
    // which is not fully supported in JSDOM. These tests require a real browser
    // environment or a Web Crypto polyfill. Run `npx vitest --environment=node`
    // with a crypto polyfill when full coverage is needed.
    describe.skip('hashPassword (requires Web Crypto)', () => {
        it('should return an object with hash and salt strings', async () => {
            const result = await window.PasswordUtils.hashPassword('TestPassword123!');
            expect(result).toHaveProperty('hash');
            expect(result).toHaveProperty('salt');
            expect(typeof result.hash).toBe('string');
            expect(typeof result.salt).toBe('string');
        });

        it('should produce salt:hash format strings', async () => {
            const result = await window.PasswordUtils.hashPassword('TestPassword123!');
            // Salt and hash should be hex strings
            expect(result.salt).toMatch(/^[a-f0-9]+$/);
            expect(result.hash).toMatch(/^[a-f0-9]+$/);
        });

        it('should produce different salts for the same password', async () => {
            const r1 = await window.PasswordUtils.hashPassword('TestPassword123!');
            const r2 = await window.PasswordUtils.hashPassword('TestPassword123!');
            expect(r1.salt).not.toBe(r2.salt);
        });

        it('should log a deprecation warning', async () => {
            await window.PasswordUtils.hashPassword('TestPassword123!');
            expect(window.Logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('deprecated')
            );
        });
    });

    describe.skip('verifyPassword (requires Web Crypto)', () => {
        it('should verify a correct password', async () => {
            const { hash, salt } = await window.PasswordUtils.hashPassword('MySecurePass!');
            const storedHash = `${salt}:${hash}`;
            const result = await window.PasswordUtils.verifyPassword('MySecurePass!', storedHash);
            expect(result).toBe(true);
        });

        it('should reject an incorrect password', async () => {
            const { hash, salt } = await window.PasswordUtils.hashPassword('MySecurePass!');
            const storedHash = `${salt}:${hash}`;
            const result = await window.PasswordUtils.verifyPassword('WrongPassword', storedHash);
            expect(result).toBe(false);
        });

        it('should log a deprecation warning', async () => {
            const { hash, salt } = await window.PasswordUtils.hashPassword('Test123!');
            vi.clearAllMocks();
            await window.PasswordUtils.verifyPassword('Test123!', `${salt}:${hash}`);
            expect(window.Logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('deprecated')
            );
        });
    });

    describe('validateStrength', () => {
        it('should rate a weak password as Weak', () => {
            const result = window.PasswordUtils.validateStrength('abc');
            expect(result.strength).toBe('Weak');
            expect(result.score).toBeLessThan(3);
        });

        it('should rate a strong password as Strong', () => {
            const result = window.PasswordUtils.validateStrength('Tr0ub4dor&3!xY');
            expect(result.strength).toBe('Strong');
            expect(result.score).toBeGreaterThanOrEqual(4);
        });

        it('should check minimum length', () => {
            const result = window.PasswordUtils.validateStrength('Ab1!');
            expect(result.checks.length).toBe(false);
        });

        it('should check for uppercase, lowercase, numbers, and special chars', () => {
            const result = window.PasswordUtils.validateStrength('Abcdef1!longpwd');
            expect(result.checks.uppercase).toBe(true);
            expect(result.checks.lowercase).toBe(true);
            expect(result.checks.number).toBe(true);
            expect(result.checks.special).toBe(true);
        });
    });

    describe('isDeprecated flag', () => {
        it('should be true', () => {
            expect(window.PasswordUtils.isDeprecated).toBe(true);
        });
    });
});
