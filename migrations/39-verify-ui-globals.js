// ============================================
// UI FUNCTION DIAGNOSTIC
// Run this in your browser console to check if buttons are broken
// ============================================

(function checkGlobals() {
    console.clear();
    console.log('%c🔍 CHECKING UI FUNCTIONS...', 'font-size: 14px; color: #2563eb; font-weight: bold;');

    const checks = [
        { name: 'window.renderAddClient', type: 'function' },
        { name: 'window.renderEditClient', type: 'function' },
        { name: 'window.renderSettings', type: 'function' },
        { name: 'window.renderClientsEnhanced', type: 'function' },
        { name: 'window.state', type: 'object' },
        { name: 'window.state.currentUser', type: 'object' }
    ];

    let errors = 0;

    checks.forEach(check => {
        const val = window[check.name.replace('window.', '')];
        const type = typeof val;

        // Deep check for nested properties if needed
        let status = '✅ OK';
        if (check.name.includes('.')) {
            const parts = check.name.split('.');
            let curr = window;
            for (let i = 1; i < parts.length; i++) {
                if (curr) curr = curr[parts[i]];
            }
            if (typeof curr !== check.type) {
                status = `❌ MISSING (Got ${typeof curr})`;
                errors++;
            }
        } else {
            if (type !== check.type) {
                status = `❌ MISSING (Got ${type})`;
                errors++;
            }
        }

        console.log(`${status.padEnd(10)} ${check.name}`);
    });

    console.log('-----------------------------------');

    // Check Event Listeners on "Add Client" button if it exists
    const addBtn = document.getElementById('btn-new-client');
    if (addBtn) {
        console.log('🔘 "Add Client" Button: FOUND in DOM');
        console.log('   (Click listeners cannot be inspected easily, but we can test click)');
        // Optional: addBtn.click(); // Don't auto-click
    } else {
        console.warn('⚠️ "Add Client" Button: NOT FOUND in DOM (Is the client list loaded?)');
    }

    if (errors === 0) {
        console.log('%c🎉 ALL CHECKS PASSED!', 'color: green; font-weight: bold;');
        console.log('If buttons still fail, it might be an overlay issue or logical error inside the function.');
    } else {
        console.error(`%c❌ FOUND ${errors} ISSUES.`, 'color: red; font-weight: bold;');
        console.log('The missing functions usually mean a syntax error in clients-module.js or settings-module.js prevented them from loading.');
    }
})();
