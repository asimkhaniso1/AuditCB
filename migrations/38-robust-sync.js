// ============================================
// ROBUST SYNC: PUSH LOCAL BROWSER DATA TO DATABASE
// Run this in your browser console
// ============================================

(async function robustSync() {
    console.clear();
    console.log('%c🚀 STARTING ROBUST SYNC...', 'font-size: 14px; font-weight: bold; color: #2563eb');

    // 1. Validate Local Data
    const localClients = window.state?.clients || [];
    console.log(`📊 Local Clients Found: ${localClients.length}`);

    if (localClients.length === 0) {
        console.warn('⚠️ No local clients found to sync.');
        return;
    }

    // 2. Ensure Supabase is Ready
    if (!window.SupabaseClient || !window.SupabaseClient.isInitialized) {
        console.log('🔄 Supabase not ready. Attempting to initialize...');
        try {
            // Force init check
            if (window.SupabaseConfig && window.SupabaseConfig.isConfigured()) {
                const url = window.SupabaseConfig.getUrl();
                const key = window.SupabaseConfig.getAnonKey();
                window.supabase.createClient(url, key);
                // Mock init flag if needed by app logic
                window.SupabaseClient = window.SupabaseClient || {};
                window.SupabaseClient.isInitialized = true;
                window.SupabaseClient.client = window.supabase.createClient(url, key);
                console.log('✅ Supabase manually initialized.');
            } else {
                throw new Error('Supabase Configuration Missing');
            }
        } catch (e) {
            console.error('❌ CRITICAL: Could not initialize Supabase.', e);
            console.log('👉 Please go to Settings > Database and check your config.');
            return;
        }
    }

    // 3. Sync Loop
    let successCount = 0;
    let failCount = 0;

    console.log('📤 Uploading clients...');

    for (const client of localClients) {
        // Safety fix for missing names
        const safeClient = {
            ...client,
            id: String(client.id), // Ensure string ID
            name: client.name || 'Unnamed Client', // Prevent null name
            // Remove huge properties if any
            logoUrl: (client.logoUrl && client.logoUrl.length > 1000) ? null : client.logoUrl
        };

        try {
            const { error } = await window.SupabaseClient.client
                .from('clients')
                .upsert(safeClient, { onConflict: 'id' });

            if (error) {
                // If 409 conflict on name, try one more time by appending ID to name?
                // No, just log it.
                if (error.code === '23505') { // Unique violation
                    console.warn(`   ⚠️ Conflict (Duplicate Name): "${client.name}". Skipping.`);
                    // Optional: Could delete and retry, but risking data loss.
                } else {
                    throw error;
                }
            } else {
                console.log(`   ✅ Synced: "${client.name}"`);
                successCount++;
            }
        } catch (err) {
            console.error(`   ❌ Failed: "${client.name}"`, err);
            failCount++;
        }
    }

    console.log('====================================');
    console.log(`🎉 SYNC COMPLETE`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed:  ${failCount}`);
    console.log('====================================');

    if (successCount > 0) {
        alert(`Sync Complete!\nSuccessfully uploaded ${successCount} clients.`);
        location.reload(); // Reload to reflect changes
    } else {
        alert('Sync Finished but 0 clients uploaded. Check console for details.');
    }
})();
