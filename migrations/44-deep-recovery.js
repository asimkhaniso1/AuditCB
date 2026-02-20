// ============================================
// DEEP RECOVERY SCRIPT (v2 - with Cloud Push)
// Run this in your Browser Console (F12)
// ============================================

(function deepRecovery() {
    console.log('%c🕵️‍♂️ AuditCB360 Deep Forensic Recovery started...', 'color: #9333ea; font-weight: bold; font-size: 14px;');

    const keys = Object.keys(localStorage);
    console.log('Available keys in localStorage:', keys);

    const mainKey = 'auditCB360State';
    const rawData = localStorage.getItem(mainKey);

    if (!rawData) {
        console.warn('❌ Key "auditCB360State" not found.');
    } else {
        try {
            const data = JSON.parse(rawData);
            console.log('✅ Found State Object. Version:', data.version);

            if (data.clients && data.clients.length > 0) {
                console.log(`%c✨ SUCCESS! Found ${data.clients.length} clients in local storage.`, 'color: #16a34a; font-weight: bold;');
                console.table(data.clients.map(c => ({ id: c.id, name: c.name, status: c.status })));

                // FORCE RECOVERY ACTION
                window.RECOVER_DATA = function () {
                    console.log('🚀 Forcing recovery into current session...');
                    window.state.clients = data.clients;
                    window.state.auditors = data.auditors || [];
                    window.state.auditPlans = data.auditPlans || [];
                    window.saveData();
                    console.log('✅ Data pushed to current session and saved to disk.');
                    console.log('%c👉 To push this data to the CLOUD now, type FORCE_CLOUD_PUSH() and press Enter.', 'color: #3b82f6; font-weight: bold; font-size: 1.1em;');
                };

                // CLOUD PUSH ACTION
                window.FORCE_CLOUD_PUSH = async function () {
                    if (!window.SupabaseClient?.isInitialized) {
                        console.error('❌ Supabase not initialized.');
                        return;
                    }
                    console.log('☁️ Pushing recovered data to cloud...');
                    try {
                        await window.SupabaseClient.syncClientsToSupabase(window.state.clients);
                        if (window.state.auditors?.length > 0) {
                            await window.SupabaseClient.syncAuditorsToSupabase(window.state.auditors);
                        }
                        if (window.showNotification) window.showNotification('Data successfully pushed to cloud!', 'success');
                        console.log('✅ Cloud push complete. Refresh the Supabase Dashboard to see your data!');
                    } catch (e) {
                        console.error('❌ Cloud push failed:', e);
                    }
                };

                console.log('%c👉 To restore this data locally, type RECOVER_DATA() here and press Enter.', 'background: #1e293b; color: #38ef7d; padding: 5px; border-radius: 4px;');
            } else {
                console.warn('⚠️ Found state object, but "clients" array is empty.');
            }
        } catch (e) {
            console.error('❌ Failed to parse local state:', e);
        }
    }

    // Search for other potential backups
    keys.forEach(key => {
        if (key.includes('auditCB') && key !== mainKey) {
            console.log(`🔍 Found potential secondary key: "${key}"`);
            try {
                const val = JSON.parse(localStorage.getItem(key));
                if (val.clients) console.log(`   -> contains ${val.clients.length} clients.`);
            } catch (e) { /* best-effort parse for diagnostic display */ }
        }
    });

    console.log('--------------------------------------------');
    console.log('💡 Note: If you have data on a DIFFERENT browser or computer, go there and run this script!');
})();
