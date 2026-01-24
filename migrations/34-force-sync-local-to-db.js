// ============================================
// FORCE SYNC: PUSH LOCAL BROWSER DATA TO DATABASE
// Paste this in your browser console to separate the local data to Supabase
// ============================================

(async function forceSyncToSupabase() {
    console.log('=== STARTING FORCE SYNC ===');

    // 1. Get local clients
    const localClients = window.state?.clients || [];
    console.log(`1. Found ${localClients.length} clients in local browser cache`);

    if (localClients.length === 0) {
        console.warn('No local clients found to sync!');
        return;
    }

    // 2. Check Supabase connection
    if (!window.SupabaseClient?.isInitialized) {
        console.error('Supabase client not initialized!');
        return;
    }

    console.log('2. Syncing to Supabase...');
    let successCount = 0;
    let failCount = 0;

    // 3. Upload each client
    for (const client of localClients) {
        try {
            console.log(`   Uploading: ${client.name}...`);

            // Ensure ID is string
            const safeClient = { ...client, id: String(client.id) };

            await window.SupabaseClient.upsertClient(safeClient);
            console.log(`   ✅ Success: ${client.name}`);
            successCount++;
        } catch (error) {
            console.error(`   ❌ Failed: ${client.name}`, error);
            failCount++;
        }
    }

    console.log('=== SYNC COMPLETE ===');
    console.log(`Total: ${localClients.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    if (successCount > 0) {
        console.log('🎉 Your data is now safe in the database!');
        console.log('Verify by checking the Supabase Table Editor.');
    }
})();
