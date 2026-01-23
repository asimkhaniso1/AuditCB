// ============================================
// DEBUG WRAPPER FOR SAVE NEW CLIENT
// Paste this in your browser console (F12 > Console)
// Then try to add a new client
// ============================================

(function () {
    console.log('=== INSTALLING DEBUG WRAPPER ===');

    // Wrap the original saveNewClient function
    const originalSave = window.saveNewClient;

    window.saveNewClient = function () {
        console.log('=== saveNewClient CALLED ===');

        try {
            // Check current user
            console.log('1. Current User:', window.state?.currentUser);
            console.log('   Role:', window.state?.currentUser?.role);

            // Check if clients array exists
            console.log('2. Clients array exists:', Array.isArray(window.state?.clients));
            console.log('   Current count:', window.state?.clients?.length);

            // Check Supabase
            console.log('3. Supabase initialized:', window.SupabaseClient?.isInitialized);

            // Check form elements
            const name = document.getElementById('client-name')?.value;
            const standards = Array.from(document.querySelectorAll('input[name="client_standards"]:checked')).map(cb => cb.value);
            console.log('4. Form data:');
            console.log('   Name:', name);
            console.log('   Standards selected:', standards);

            // Check validators
            console.log('5. Validator available:', typeof window.Validator);
            console.log('   Sanitizer available:', typeof window.Sanitizer);

            // Now call the original
            console.log('6. Calling original saveNewClient...');
            const result = originalSave.apply(this, arguments);
            console.log('7. Original returned:', result);

            return result;
        } catch (error) {
            console.error('=== ERROR IN saveNewClient ===');
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            window.showNotification('Debug: ' + error.message, 'error');
        }
    };

    // Also wrap upsertClient
    if (window.SupabaseClient?.upsertClient) {
        const originalUpsert = window.SupabaseClient.upsertClient.bind(window.SupabaseClient);

        window.SupabaseClient.upsertClient = async function (client) {
            console.log('=== upsertClient CALLED ===');
            console.log('Client data being sent:', JSON.stringify(client, null, 2));

            try {
                const result = await originalUpsert(client);
                console.log('upsertClient SUCCESS:', result);
                return result;
            } catch (error) {
                console.error('=== ERROR IN upsertClient ===');
                console.error('Error:', error);
                throw error;
            }
        };
    }

    console.log('=== DEBUG WRAPPER INSTALLED ===');
    console.log('Now try to add a new client and check the console output.');
})();
