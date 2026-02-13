/**
 * CDN Fallback Loader
 * Attempts to load scripts from CDN, falls back to local copies if CDN fails
 */

(function () {
    'use strict';

    /**
     * Load script with fallback
     * @param {string} cdnUrl - Primary CDN URL
     * @param {string} fallbackUrl - Local fallback URL
     * @param {string} testVariable - Global variable to test if script loaded
     * @param {function} callback - Callback after successful load
     */
    window.loadScriptWithFallback = function (cdnUrl, fallbackUrl, testVariable, callback) {
        const script = document.createElement('script');
        script.src = cdnUrl;

        script.onload = function () {
            // Verify script actually loaded by checking for expected global
            if (testVariable && !window[testVariable]) {
                console.warn(`CDN loaded but ${testVariable} not found, trying fallback...`);
                loadFallback();
            } else {
                console.log('✓ Loaded from CDN:', cdnUrl);
                if (callback) callback();
            }
        };

        script.onerror = function () {
            console.warn('CDN failed, loading fallback:', fallbackUrl);
            loadFallback();
        };

        function loadFallback() {
            if (!fallbackUrl) {
                console.error('No fallback available for:', cdnUrl);
                if (callback) callback();
                return;
            }

            const fallbackScript = document.createElement('script');
            fallbackScript.src = fallbackUrl;
            fallbackScript.onload = function () {
                console.log('✓ Loaded from fallback:', fallbackUrl);
                if (callback) callback();
            };
            fallbackScript.onerror = function () {
                console.error('Both CDN and fallback failed for:', cdnUrl);
                if (callback) callback();
            };
            document.head.appendChild(fallbackScript);
        }

        document.head.appendChild(script);
    };

    /**
     * Load critical libraries with fallbacks
     */
    window.loadCriticalLibraries = function (callback) {
        const libraries = [
            {
                name: 'DOMPurify',
                cdn: 'https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js',
                fallback: 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.8/purify.min.js',
                test: 'DOMPurify'
            },
            {
                name: 'Chart.js',
                cdn: 'https://cdn.jsdelivr.net/npm/chart.js',
                fallback: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
                test: 'Chart'
            }
        ];

        let loaded = 0;
        const total = libraries.length;

        function checkComplete() {
            loaded++;
            if (loaded === total && callback) {
                callback();
            }
        }

        libraries.forEach(lib => {
            loadScriptWithFallback(lib.cdn, lib.fallback, lib.test, checkComplete);
        });
    };

    console.log('CDN Fallback Loader initialized');
})();
