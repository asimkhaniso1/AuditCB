// ============================================
// MINIMAL BROWSER INSERT TEST
// Paste this in browser console (F12 > Console)
// This uses the EXACT same minimal fields as the SQL that worked
// ============================================

(async function minimalInsertTest() {
    console.log('=== 🧪 MINIMAL INSERT TEST ===');

    if (!window.SupabaseClient?.isInitialized) {
        console.error('❌ Supabase not initialized!');
        return;
    }

    // MINIMAL payload - same as SQL that worked
    const minimalClient = {
        id: 'browser-test-' + Date.now(),
        name: 'Browser Test Client',
        standard: 'ISO 9001',
        status: 'Active'
    };

    console.log('Sending minimal payload:', minimalClient);

    try {
        const { data, error } = await window.SupabaseClient.client
            .from('clients')
            .insert(minimalClient)  // Using INSERT not UPSERT
            .select();

        if (error) {
            console.error('❌ MINIMAL INSERT FAILED:', error);
            console.error('Error Code:', error.code);
            console.error('Error Message:', error.message);
            alert('FAILED: ' + error.message);
        } else {
            console.log('✅ MINIMAL INSERT SUCCEEDED!', data);
            alert('SUCCESS! Minimal insert worked. The problem is with extra fields.');

            // Now test with JSONB fields
            console.log('\n--- Testing with JSONB fields ---');
            const jsonbClient = {
                id: 'jsonb-test-' + Date.now(),
                name: 'JSONB Test Client',
                standard: 'ISO 9001',
                status: 'Active',
                contacts: [],
                sites: []
            };

            const { data: data2, error: error2 } = await window.SupabaseClient.client
                .from('clients')
                .insert(jsonbClient)
                .select();

            if (error2) {
                console.error('❌ JSONB INSERT FAILED:', error2);
                alert('JSONB test failed: ' + error2.message);
            } else {
                console.log('✅ JSONB INSERT SUCCEEDED!', data2);
                alert('JSONB also worked! Problem might be with "data" column or specific fields.');
            }
        }
    } catch (e) {
        console.error('❌ EXCEPTION:', e);
        alert('Exception: ' + e.message);
    }
})();
