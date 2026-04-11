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

                // App globals — core services (window.*)
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
                AI_SERVICE: 'writable',
                AuditLogger: 'writable',
                KB_HELPERS: 'writable',
                EvidenceDB: 'writable',
                CachedData: 'writable',

                // App globals — state & UI functions
                state: 'writable',
                saveData: 'writable',
                showNotification: 'writable',
                openModal: 'writable',
                closeModal: 'writable',
                debounce: 'readonly',

                // App globals — render functions (cross-module)
                renderClientDetail: 'writable',
                renderClientTab: 'writable',
                renderClientsEnhanced: 'writable',
                renderClientModule: 'writable',
                renderSettings: 'writable',
                renderDashboardEnhanced: 'writable',
                renderExecutionDetail: 'writable',
                renderAuditExecutionEnhanced: 'writable',
                renderChecklistLibrary: 'writable',
                renderCertificationModule: 'writable',
                renderAuditPlanningEnhanced: 'writable',
                renderAuditProgramsEnhanced: 'writable',
                renderAuditorsEnhanced: 'writable',
                renderDocumentsEnhanced: 'writable',
                renderAppealsComplaintsModule: 'writable',
                renderImpartialityModule: 'writable',
                renderManagementReviewModule: 'writable',
                renderRecordRetentionModule: 'writable',
                renderNCRCAPAModule: 'writable',
                renderExecutionTab: 'writable',

                // App globals — settings sub-tabs
                switchSettingsSubTab: 'writable',
                switchSettingsMainTab: 'writable',
                switchSettingsTab: 'writable',
                switchClientDetailTab: 'writable',

                // Browser APIs not in default globals
                pdfjsLib: 'readonly',
                mammoth: 'readonly',
                atob: 'readonly',
                prompt: 'readonly',
                onload: 'writable',
                event: 'readonly',
                File: 'readonly',
                caches: 'readonly',
                DecompressionStream: 'readonly',
                URLSearchParams: 'readonly',

                // Node.js (for CommonJS exports at bottom of files)
                module: 'readonly',
                require: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
            }
        },
        rules: {
            // Relaxed for existing codebase — tighten over time
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'no-undef': 'off', // 260+ window globals — re-enable after ES module migration
            'no-redeclare': 'off', // window globals are intentionally redeclared per-file
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
