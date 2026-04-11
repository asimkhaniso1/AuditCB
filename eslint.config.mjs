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
                DataService: 'writable',
                StateStore: 'writable',

                // Node.js (for CommonJS exports at bottom of files)
                module: 'readonly',
                require: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
            }
        },
        rules: {
            // Relaxed for existing codebase — tighten over time
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-undef': 'warn',
            'no-redeclare': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-prototype-builtins': 'off',
            'no-useless-escape': 'warn',
            'no-constant-condition': ['warn', { checkLoops: false }],
            'no-case-declarations': 'warn', // 39 instances — fix incrementally
            'no-useless-assignment': 'warn', // 14 instances — fix incrementally
            'no-self-assign': 'warn',
            'preserve-caught-error': 'off',
            'prefer-const': 'off',
        }
    },

    // ESM files (vitest config, eslint config)
    {
        files: ['**/*.mjs'],
        languageOptions: {
            sourceType: 'module'
        }
    },

    // Ignore patterns
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            'tests/**',
            '.agent/**',
            'build.js',
            'vitest.config.js',
            'tools/**',
            'api/**',
            '*.min.js',
        ]
    }
];
