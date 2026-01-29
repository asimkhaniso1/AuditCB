// ============================================
// BYPASS FORM - ADD CLIENT DIRECTLY
// Paste this in browser console (F12 > Console)
// This completely bypasses the form and validation
// ============================================

(async function bypassFormAddClient() {
    console.log('=== 🚀 BYPASSING FORM - DIRECT ADD ===');

    // Create a proper client object
    const newClient = {
        id: String(Date.now()),
        name: 'Direct Add Test ' + new Date().toLocaleTimeString(),
        standard: 'ISO 9001',
        status: 'Active',
        type: 'New',
        industry: 'Manufacturing',
        website: '',
        contacts: [{ name: 'Test Contact', email: 'test@example.com', phone: '123456' }],
        sites: [{ name: 'Head Office', city: 'Test City', country: 'Pakistan' }],
        employees: 50,
        shifts: 'No',
        departments: [],
        designations: [],
        goodsServices: [],
        keyProcesses: [],
        logoUrl: ''
    };

    console.log('1. Created client object:', newClient);

    // Add to local state
    if (!window.state.clients) {
        window.state.clients = [];
    }
    window.state.clients.push(newClient);
    console.log('2. Added to local state. Total:', window.state.clients.length);

    // Save to localStorage
    try {
        window.saveData();
        console.log('3. Saved to localStorage ✓');
    } catch (e) {
        console.error('3. localStorage save failed:', e);
    }

    // Sync to Supabase using upsertClient
    if (window.SupabaseClient?.isInitialized) {
        try {
            console.log('4. Calling upsertClient...');
            const result = await window.SupabaseClient.upsertClient(newClient);
            console.log('4. upsertClient result:', result);
            alert('✅ SUCCESS! Client added to both local state and Supabase!');
        } catch (e) {
            console.error('4. upsertClient FAILED:', e);
            alert('❌ Supabase sync failed: ' + e.message);
        }
    } else {
        console.log('4. Supabase not initialized');
        alert('⚠️ Added locally only - Supabase not connected');
    }

    // Refresh the view
    if (window.renderClientsEnhanced) {
        window.renderClientsEnhanced();
        console.log('5. Refreshed clients view');
    }

    console.log('=== DONE ===');
})();
