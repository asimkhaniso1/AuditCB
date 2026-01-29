// ============================================
// DEBUG SETTINGS SYNC
// Paste this in browser console (F12 > Console)
// ============================================

(async function debugSettings() {
    console.log('=== 🔧 DEBUG SETTINGS ===');

    if (!window.SupabaseClient?.isInitialized) {
        console.error('❌ Supabase not initialized!');
        return;
    }

    // 1. Check current state
    console.log('\n--- Current State ---');
    console.log('settings:', window.state?.settings);
    console.log('cbSettings:', window.state?.cbSettings);
    console.log('settingsId:', window.state?.settingsId);

    // 2. Direct query to settings table
    console.log('\n--- Direct DB Query ---');
    try {
        const { data, error } = await window.SupabaseClient.client
            .from('settings')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('❌ Settings query error:', error);
        } else if (data) {
            console.log('✅ Settings data from DB:', data);
            console.log('  - id:', data.id);
            console.log('  - cb_settings:', data.cb_settings);
            console.log('  - organization:', data.organization);
            console.log('  - standards:', data.standards);
        } else {
            console.log('⚠️ No settings row found in DB');
        }
    } catch (e) {
        console.error('❌ Exception:', e);
    }

    // 3. Try manual sync
    console.log('\n--- Manual Sync ---');
    try {
        const result = await window.SupabaseClient.syncSettingsFromSupabase();
        console.log('Sync result:', result);
        console.log('cbSettings after sync:', window.state?.cbSettings);
    } catch (e) {
        console.error('❌ Sync failed:', e);
    }

    console.log('\n=== DEBUG COMPLETE ===');
})();
