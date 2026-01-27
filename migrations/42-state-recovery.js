// ============================================
// STATE RECOVERY SCRIPT
// Run this to attempt data recovery from local state
// ============================================

(function stateRecovery() {
    console.log('🔄 Attempting state recovery...');

    const localState = localStorage.getItem('auditCB360State');
    if (!localState) {
        console.warn('❌ No local state found in localStorage.');
    } else {
        const state = JSON.parse(localState);
        console.log('✅ Found state in localStorage:', state);
        if (state.clients) {
            console.log(`📦 Found ${state.clients.length} clients locally.`);
            const cci = state.clients.find(c => c.name?.includes('CCI'));
            const ppf = state.clients.find(c => c.name?.includes('Pakistan Post'));
            if (cci) console.log('🎯 Found CCI Services:', cci);
            if (ppf) console.log('🎯 Found Pakistan Post Foundation:', ppf);
        }
    }

    const sessionState = sessionStorage.getItem('auditCB360State');
    if (sessionState) {
        console.log('✅ Found state in sessionStorage:', JSON.parse(sessionState));
    }

    // Check for backups in the DB if we had a proper key (done in background)
    console.log('💡 If data is missing locally, we must check Supabase Cloud Backups next.');
})();
