import { describe, it, expect, vi, beforeEach } from 'vitest';

// Load debounce module
globalThis.window = globalThis.window || globalThis;

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./debounce.js'), 'utf8');
eval(src);

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('should be defined on window', () => {
        expect(typeof window.debounce).toBe('function');
    });

    it('should delay function execution', () => {
        const fn = vi.fn();
        const debounced = window.debounce(fn, 300);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(300);
        expect(fn).toHaveBeenCalledOnce();
    });

    it('should reset delay on rapid calls', () => {
        const fn = vi.fn();
        const debounced = window.debounce(fn, 300);

        debounced();
        vi.advanceTimersByTime(200);
        debounced(); // reset timer
        vi.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledOnce();
    });

    it('should pass arguments to the underlying function', () => {
        const fn = vi.fn();
        const debounced = window.debounce(fn, 100);

        debounced('arg1', 'arg2');
        vi.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should use default wait of 300ms', () => {
        const fn = vi.fn();
        const debounced = window.debounce(fn);

        debounced();
        vi.advanceTimersByTime(299);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledOnce();
    });
});

describe('throttle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('should be defined on window', () => {
        expect(typeof window.throttle).toBe('function');
    });

    it('should execute immediately on first call', () => {
        const fn = vi.fn();
        const throttled = window.throttle(fn, 300);

        throttled();
        expect(fn).toHaveBeenCalledOnce();
    });

    it('should ignore calls during throttle period', () => {
        const fn = vi.fn();
        const throttled = window.throttle(fn, 300);

        throttled();
        throttled();
        throttled();
        expect(fn).toHaveBeenCalledOnce();
    });

    it('should allow calls after throttle period', () => {
        const fn = vi.fn();
        const throttled = window.throttle(fn, 300);

        throttled();
        expect(fn).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(300);
        throttled();
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to the underlying function', () => {
        const fn = vi.fn();
        const throttled = window.throttle(fn, 100);

        throttled('a', 'b');
        expect(fn).toHaveBeenCalledWith('a', 'b');
    });
});
