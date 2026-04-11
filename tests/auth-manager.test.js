import { describe, it, expect, vi, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
window.ErrorHandler = { log: vi.fn(), handle: vi.fn() };
window.showNotification = vi.fn();
window.state = { currentUser: null };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./auth-manager.js'), 'utf8');
eval(src);

describe('AuthManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.state = { currentUser: null };
        AuthManager._loginAttempts = 0;
        AuthManager._lockoutUntil = null;
    });

    describe('validatePasswordStrength', () => {
        it('should reject short passwords', () => {
            const result = AuthManager.validatePasswordStrength('Ab1!');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('At least 8 characters');
        });

        it('should reject passwords without uppercase', () => {
            const result = AuthManager.validatePasswordStrength('abcdef1!');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('One uppercase letter');
        });

        it('should reject passwords without numbers', () => {
            const result = AuthManager.validatePasswordStrength('Abcdefgh!');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('One number');
        });

        it('should reject passwords without special characters', () => {
            const result = AuthManager.validatePasswordStrength('Abcdef12');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('One special character');
        });

        it('should accept valid passwords', () => {
            const result = AuthManager.validatePasswordStrength('SecureP@ss1');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should accept passwords with various special chars', () => {
            expect(AuthManager.validatePasswordStrength('Test1234!').valid).toBe(true);
            expect(AuthManager.validatePasswordStrength('Test1234@').valid).toBe(true);
            expect(AuthManager.validatePasswordStrength('Test1234#').valid).toBe(true);
            expect(AuthManager.validatePasswordStrength('Test1234$').valid).toBe(true);
        });
    });

    describe('hasRole', () => {
        it('should return false when no user logged in', () => {
            expect(AuthManager.hasRole('admin')).toBe(false);
        });

        it('should match single role (case-insensitive)', () => {
            window.state.currentUser = { role: 'Admin' };
            expect(AuthManager.hasRole('admin')).toBe(true);
            expect(AuthManager.hasRole('Admin')).toBe(true);
            expect(AuthManager.hasRole('ADMIN')).toBe(true);
        });

        it('should match from array of roles', () => {
            window.state.currentUser = { role: 'Lead Auditor' };
            expect(AuthManager.hasRole(['admin', 'lead auditor'])).toBe(true);
        });

        it('should return false for non-matching role', () => {
            window.state.currentUser = { role: 'Auditor' };
            expect(AuthManager.hasRole('admin')).toBe(false);
        });

        it('should handle missing role gracefully', () => {
            window.state.currentUser = { name: 'Test' };
            expect(AuthManager.hasRole('admin')).toBe(false);
        });
    });

    describe('canPerform', () => {
        it('should return false when no user logged in', () => {
            expect(AuthManager.canPerform('view', 'client')).toBe(false);
        });

        it('should allow everything for Admin', () => {
            window.state.currentUser = { role: 'Admin' };
            expect(AuthManager.canPerform('view', 'client')).toBe(true);
            expect(AuthManager.canPerform('delete', 'client')).toBe(true);
            expect(AuthManager.canPerform('create', 'settings')).toBe(true);
        });

        it('should map resource aliases correctly', () => {
            window.state.currentUser = { role: 'Admin' };
            // Both 'client' and 'clients' should work
            expect(AuthManager.canPerform('view', 'client')).toBe(true);
            expect(AuthManager.canPerform('view', 'clients')).toBe(true);
        });
    });

    describe('rate limiting', () => {
        it('should not be locked out initially', () => {
            expect(AuthManager.isLockedOut()).toBeFalsy();
        });

        it('should lock out after 5 failed attempts', () => {
            for (let i = 0; i < 5; i++) {
                AuthManager.recordFailedAttempt();
            }
            expect(AuthManager.isLockedOut()).toBeTruthy();
        });

        it('should return minutes remaining when locked', () => {
            AuthManager._lockoutUntil = Date.now() + 10 * 60 * 1000; // 10 min from now
            const remaining = AuthManager.isLockedOut();
            expect(remaining).toBeGreaterThan(0);
            expect(remaining).toBeLessThanOrEqual(10);
        });

        it('should unlock after lockout expires', () => {
            AuthManager._lockoutUntil = Date.now() - 1000; // expired
            expect(AuthManager.isLockedOut()).toBeFalsy();
            expect(AuthManager._loginAttempts).toBe(0); // reset
        });
    });

    describe('requireAuth', () => {
        it('should return false when no user', () => {
            expect(AuthManager.requireAuth(() => true)).toBe(false);
        });

        it('should execute callback when user is authenticated', () => {
            window.state.currentUser = { role: 'Admin' };
            const cb = vi.fn(() => 'result');
            expect(AuthManager.requireAuth(cb)).toBe('result');
            expect(cb).toHaveBeenCalledOnce();
        });

        it('should return true without callback when authenticated', () => {
            window.state.currentUser = { role: 'Admin' };
            expect(AuthManager.requireAuth(null)).toBe(true);
        });
    });
});
