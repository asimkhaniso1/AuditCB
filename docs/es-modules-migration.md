# ES Modules Migration Guide

## Overview

This guide documents the strategy for incrementally migrating AuditCB-360 from `window.*` globals to ES modules (`import`/`export`).

## Current Architecture

- **72 JS files** loaded via `<script>` tags in `index.html`
- All modules export to `window.*` (e.g., `window.UTILS = UTILS`)
- Dependencies are implicit — files assume globals are available in load order
- No bundler — files served individually by Vercel

## Migration Strategy: Dual-Mode Pattern

To avoid a big-bang migration, convert files one at a time using this pattern:

### Before (current)
```javascript
// utils.js
const UTILS = {
    escapeHtml(str) { /* ... */ },
    formatDate(date) { /* ... */ }
};
window.UTILS = UTILS;
```

### After (dual-mode)
```javascript
// utils.js — ES module with backward-compatible window export
const UTILS = {
    escapeHtml(str) { /* ... */ },
    formatDate(date) { /* ... */ }
};

// ES module export (for new code and tests)
export default UTILS;
export const { escapeHtml, formatDate } = UTILS;

// Backward-compatible window export (for existing code)
if (typeof window !== 'undefined') {
    window.UTILS = UTILS;
}
```

### In consuming files (gradual adoption)
```javascript
// New code uses imports
import UTILS from './utils.js';
// OR
import { escapeHtml, formatDate } from './utils.js';

// Old code continues to use window.UTILS — still works
```

## Prerequisites

1. **Add `type="module"` to script tags** — Changes execution to strict mode and deferred by default
2. **Or add a bundler (Vite)** — Resolves imports at build time, outputs browser-compatible bundles

### Recommended: Vite Bundler Approach
```bash
npm install -D vite
```

Add to `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Create `vite.config.js`:
```javascript
export default {
    build: {
        rollupOptions: {
            input: './index.html'
        }
    }
};
```

## Migration Priority Order

Convert in dependency order (leaf modules first):

| Priority | File | Reason |
|----------|------|--------|
| 1 | `constants.js` | Zero dependencies |
| 2 | `utils.js` | Only depends on constants |
| 3 | `debounce.js` | Zero dependencies |
| 4 | `logger.js` | Zero dependencies |
| 5 | `password-utils.js` | Zero dependencies |
| 6 | `validation.js` | Depends on utils |
| 7 | `safe-dom.js` | Depends on DOMPurify |
| 8 | `error-handler.js` | Depends on logger |
| ... | Feature modules | Depend on utilities above |
| Last | `script.js` | Main entry point, imports everything |

## Rules During Migration

1. **Always keep `window.*` exports** until ALL consumers use `import`
2. **Convert tests first** — Tests already use `import` (Vitest)
3. **One file per PR** — Isolate risk
4. **Run full test suite** after each conversion
5. **Update `index.html`** script tags to `type="module"` only when using native ESM (not needed with Vite)

## Estimated Effort

- **Utility modules (1-8)**: ~1 hour each, low risk
- **Feature modules**: ~2-4 hours each, medium risk
- **Main entry (`script.js`)**: ~1 day, high risk — requires all dependencies converted first
- **Full migration**: ~2-3 weeks of focused effort
