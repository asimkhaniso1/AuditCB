// ============================================
// CLIENTS DETAIL MODULE (Split from clients-module.js)
// ============================================
// Handles client detail view and tab navigation
// Loaded AFTER clients-module.js - fixes bugs in original

// Fix: Override switchClientDetailTab with corrected version
window.switchClientDetailTab = function (clientId, tabName) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Call original renderClientTab (defined in clients-module.js)
    if (typeof renderClientTab === 'function') {
        renderClientTab(client, tabName);
    }
};

// Additional client detail utilities can be added here
// This module allows incremental refactoring without breaking existing code

Logger.info('Clients Detail module loaded (split version)');
