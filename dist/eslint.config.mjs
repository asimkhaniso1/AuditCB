import js from '@eslint/js';

export default [
    // Base recommended rules
    js.configs.recommended,

    // Global config for all JS files
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
                Blob: 'readonly',
                FileReader: 'readonly',
                FormData: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                Uint8Array: 'readonly',
                Uint32Array: 'readonly',
                ArrayBuffer: 'readonly',
                crypto: 'readonly',
                confirm: 'readonly',
                alert: 'readonly',
                Event: 'readonly',
                HTMLElement: 'readonly',
                MutationObserver: 'readonly',
                IntersectionObserver: 'readonly',
                ResizeObserver: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                history: 'readonly',
                Image: 'readonly',
                performance: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                customElements: 'readonly',
                indexedDB: 'readonly',

                // Libraries loaded via CDN
                XLSX: 'readonly',
                DOMPurify: 'readonly',
                Sentry: 'readonly',
                Chart: 'readonly',

                // App globals (window.*)
                Logger: 'writable',
                DEBUG_MODE: 'writable',
                CONSTANTS: 'writable',
                UTILS: 'writable',
                SafeDOM: 'writable',
                Sanitizer: 'writable',
                Validator: 'writable',
                ErrorHandler: 'writable',
                PasswordUtils: 'writable',
                EventManager: 'writable',
                AuthManager: 'writable',
                SupabaseClient: 'writable',
                NotificationManager: 'writable',
                EmailService: 'writable',
                DataMigration: 'writable',
                StateStore: 'writable',
            }
        },
        rules: {
            // Relaxed for existing codebase — tighten over time
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-undef': 'warn', // Warn first, error later
            'no-redeclare': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-prototype-builtins': 'off',
            'no-useless-escape': 'warn',
            'no-constant-condition': ['warn', { checkLoops: false }],
            'prefer-const': 'off', // Too many changes needed
        }
    },

    // Ignore patterns
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            'tests/**',
            'build.js',
            'vitest.config.js',
            'tools/**',
            '*.min.js',
        ]
    }
];
