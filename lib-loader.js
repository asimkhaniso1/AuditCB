// ============================================
// LIB LOADER - heavy document libraries, loaded on first use
// SheetJS (client Excel import/export), PDF.js and mammoth (knowledge-base text
// extraction) used to load on every page view: ~1.8 MB that most sessions never
// touch. Callers now `await window.LibLoader.load('<name>')` right before use.
// Same pinned URLs and SRI hashes as the old <script> tags, so the CSP
// script-src paths are unchanged.
// ============================================
(function () {
    'use strict';

    var LIBS = {
        xlsx: {
            global: 'XLSX',
            src: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
            integrity: 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw'
        },
        pdfjs: {
            global: 'pdfjsLib',
            src: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
            integrity: 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e'
        },
        mammoth: {
            global: 'mammoth',
            src: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
            integrity: 'sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz'
        }
    };

    var pending = {};

    // Resolves with the library's global; concurrent callers share one request.
    // A failed load is forgotten so the next call retries.
    function load(name) {
        var lib = LIBS[name];
        if (!lib) return Promise.reject(new Error('Unknown library: ' + name));
        if (window[lib.global]) return Promise.resolve(window[lib.global]);
        if (pending[name]) return pending[name];

        pending[name] = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            function fail(message) {
                delete pending[name];
                script.remove();
                reject(new Error(message));
            }
            script.src = lib.src;
            script.integrity = lib.integrity;
            script.crossOrigin = 'anonymous';
            script.async = true;
            script.onload = function () {
                if (window[lib.global]) resolve(window[lib.global]);
                else fail('Loaded ' + name + ' but ' + lib.global + ' is missing');
            };
            script.onerror = function () {
                fail('Could not load the ' + name + ' library. Check your connection and try again.');
            };
            document.head.appendChild(script);
        });
        return pending[name];
    }

    window.LibLoader = { load: load, LIBS: LIBS };
})();
