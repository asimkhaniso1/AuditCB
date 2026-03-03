import { describe, it, expect, vi, beforeEach } from 'vitest';

// Load ErrorHandler module
globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
window.showNotification = vi.fn();
window.state = { currentUser: { email: 'test@example.com', role: 'admin' } };
window.Sentry = { captureException: vi.fn(), setContext: vi.fn() };
window.location = { href: 'http://localhost:8080' };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./error-handler.js'), 'utf8');
eval(src);

describe('ErrorHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should log the error', () => {
            const error = new Error('Test error');
            window.ErrorHandler.handle(error, 'TestContext');
            expect(window.Logger.error).toHaveBeenCalled();
        });

        it('should show notification when showToUser is true', () => {
            const error = new Error('Test error');
            window.ErrorHandler.handle(error, 'TestContext', true);
            expect(window.showNotification).toHaveBeenCalled();
        });

        it('should not show notification when showToUser is false', () => {
            const error = new Error('Test error');
            window.ErrorHandler.handle(error, 'TestContext', false);
            expect(window.showNotification).not.toHaveBeenCalled();
        });

        it('should report to Sentry', () => {
            const error = new Error('Test error');
            window.ErrorHandler.handle(error, 'TestContext');
            expect(window.Sentry.captureException).toHaveBeenCalledWith(
                error,
                expect.objectContaining({ tags: { context: 'TestContext' } })
            );
        });

        it('should return false', () => {
            const result = window.ErrorHandler.handle(new Error('test'), 'ctx');
            expect(result).toBe(false);
        });
    });

    describe('getUserMessage', () => {
        it('should return quota message for QuotaExceededError', () => {
            const error = new Error('Storage full');
            error.name = 'QuotaExceededError';
            const msg = window.ErrorHandler.getUserMessage(error, 'save');
            expect(msg).toContain('Storage');
        });

        it('should return context-specific message for save', () => {
            const msg = window.ErrorHandler.getUserMessage(new Error('fail'), 'save');
            expect(msg).toContain('save');
        });

        it('should return context-specific message for load', () => {
            const msg = window.ErrorHandler.getUserMessage(new Error('fail'), 'load');
            expect(msg).toContain('load');
        });

        it('should handle null error gracefully', () => {
            const msg = window.ErrorHandler.getUserMessage(null, 'test');
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
        });

        it('should return default message for unknown context', () => {
            const msg = window.ErrorHandler.getUserMessage(new Error('x'), 'UnknownContext');
            expect(msg).toContain('UnknownContext');
        });
    });

    describe('reportError', () => {
        it('should call Sentry.captureException', () => {
            const error = new Error('Test');
            window.ErrorHandler.reportError(error, 'Module');
            expect(window.Sentry.captureException).toHaveBeenCalledWith(
                error,
                { tags: { context: 'Module' } }
            );
        });

        it('should set Sentry context with metadata', () => {
            window.ErrorHandler.reportError(new Error('Test'), 'Module');
            expect(window.Sentry.setContext).toHaveBeenCalledWith(
                'error_context',
                expect.objectContaining({
                    module: 'Module',
                    user: 'test@example.com'
                })
            );
        });
    });

    describe('validateOperation', () => {
        it('should pass when no requirements', () => {
            expect(window.ErrorHandler.validateOperation('test')).toBe(true);
        });

        it('should throw when auth required but no user', () => {
            const savedUser = window.state.currentUser;
            window.state.currentUser = null;
            expect(() => {
                window.ErrorHandler.validateOperation('test', { requireAuth: true });
            }).toThrow();
            window.state.currentUser = savedUser;
        });

        it('should throw when role mismatch', () => {
            expect(() => {
                window.ErrorHandler.validateOperation('test', { requiredRole: 'superadmin' });
            }).toThrow();
        });

        it('should pass when role matches', () => {
            expect(
                window.ErrorHandler.validateOperation('test', { requiredRole: 'admin' })
            ).toBe(true);
        });
    });

    describe('safeSync', () => {
        it('should return function result on success', () => {
            const result = window.ErrorHandler.safeSync(() => 42, 'test');
            expect(result).toBe(42);
        });

        it('should return fallback on error', () => {
            const result = window.ErrorHandler.safeSync(() => { throw new Error('fail'); }, 'test', 'default');
            expect(result).toBe('default');
        });
    });
});
