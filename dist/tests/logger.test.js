import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Setup window globals
globalThis.window = globalThis.window || globalThis;
window.ErrorHandler = { log: vi.fn() };

// We need to control DEBUG_MODE, so we patch location before loading
// Default: non-localhost (production mode, DEBUG_MODE = false)
const origLocation = globalThis.location;

describe('Logger (production mode)', () => {
    let Logger;

    beforeEach(() => {
        vi.restoreAllMocks();
        // Ensure location.hostname is NOT localhost
        delete globalThis.location;
        globalThis.location = { hostname: 'app.auditcb360.com' };

        // Clear any previous Logger
        delete window.Logger;
        delete window.DEBUG_MODE;
    });

    afterEach(() => {
        globalThis.location = origLocation;
    });

    async function loadLogger() {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve('./logger.js'), 'utf8');
        eval(src);
        return window.Logger;
    }

    it('should set DEBUG_MODE to false for non-localhost', async () => {
        await loadLogger();
        expect(window.DEBUG_MODE).toBe(false);
    });

    it('debug should NOT log when DEBUG_MODE is false', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.debug('test message');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('log should NOT log when DEBUG_MODE is false', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.log('test message');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('info should always log regardless of DEBUG_MODE', async () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.info('info message');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toContain('[INFO]');
        spy.mockRestore();
    });

    it('info should support module-prefixed form', async () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.info('MyModule', 'info message');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toContain('[MyModule]');
        spy.mockRestore();
    });

    it('warn should always log regardless of DEBUG_MODE', async () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.warn('warning message');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toContain('[WARN]');
        spy.mockRestore();
    });

    it('warn should support module-prefixed form', async () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.warn('MyModule', 'warning message');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toContain('[MyModule]');
        spy.mockRestore();
    });

    it('error should always log regardless of DEBUG_MODE', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.error('error message');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toContain('[ERROR]');
        spy.mockRestore();
    });

    it('error should support module-prefixed form', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.error('MyModule', 'error details');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toContain('[MyModule]');
        spy.mockRestore();
    });

    it('error should integrate with ErrorHandler when error object provided', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        Logger = await loadLogger();
        const err = new Error('test error');
        Logger.error('TestModule', 'something failed', err);
        expect(window.ErrorHandler.log).toHaveBeenCalledWith(err, 'TestModule');
        vi.restoreAllMocks();
    });

    it('error with single arg should pass it to ErrorHandler', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        Logger = await loadLogger();
        const err = new Error('single arg error');
        Logger.error(err);
        expect(window.ErrorHandler.log).toHaveBeenCalledWith(err, 'Unknown');
        vi.restoreAllMocks();
    });
});

describe('Logger (debug mode)', () => {
    let Logger;

    beforeEach(() => {
        vi.restoreAllMocks();
        delete globalThis.location;
        globalThis.location = { hostname: 'localhost' };
        delete window.Logger;
        delete window.DEBUG_MODE;
    });

    afterEach(() => {
        globalThis.location = origLocation;
    });

    async function loadLogger() {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve('./logger.js'), 'utf8');
        eval(src);
        return window.Logger;
    }

    it('should set DEBUG_MODE to true for localhost', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        await loadLogger();
        expect(window.DEBUG_MODE).toBe(true);
        spy.mockRestore();
    });

    it('debug should log when DEBUG_MODE is true (single arg)', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.debug('debug message');
        // One call from init message, one from our debug call
        const debugCalls = spy.mock.calls.filter(c => typeof c[0] === 'string' && c[0].includes('[DEBUG]'));
        expect(debugCalls.length).toBe(1);
        spy.mockRestore();
    });

    it('debug should log with module prefix (two args)', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.debug('MyModule', 'debug info');
        const debugCalls = spy.mock.calls.filter(c => typeof c[0] === 'string' && c[0].includes('[MyModule]'));
        expect(debugCalls.length).toBe(1);
        spy.mockRestore();
    });

    it('debug should log with module prefix and data (three args)', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        Logger = await loadLogger();
        const data = { key: 'value' };
        Logger.debug('MyModule', 'debug info', data);
        const debugCalls = spy.mock.calls.filter(c => typeof c[0] === 'string' && c[0].includes('[MyModule]'));
        expect(debugCalls.length).toBe(1);
        expect(debugCalls[0][2]).toBe(data);
        spy.mockRestore();
    });

    it('log should output in debug mode', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        Logger = await loadLogger();
        Logger.log('raw log message');
        const rawCalls = spy.mock.calls.filter(c => c[0] === 'raw log message');
        expect(rawCalls.length).toBe(1);
        spy.mockRestore();
    });
});
