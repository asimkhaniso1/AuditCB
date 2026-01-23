// ============================================
// DIRECT CLIENT ADD - BYPASS ALL FORM LOGIC
// Paste this in your browser console (F12 > Console)
// This will add a test client directly
// ============================================

(async function addTestClient() {
    console.log('=== DIRECT CLIENT ADD ===');

    // 1. Create a test client object
    const testClient = {
        id: String(Date.now()),
        name: 'Console Test Client ' + new Date().toLocaleTimeString(),
        standard: 'ISO 9001',
        status: 'Active',
        industry: 'Manufacturing',
        website: '',
        contacts: [{ name: 'Test Contact', email: 'test@test.com' }],
        sites: [{ name: 'Head Office', city: 'Test City' }],
        employees: 50,
        shifts: 'No'
    };

    console.log('1. Test client object:', testClient);

    // 2. Add to local state
    if (!window.state.clients) {
        window.state.clients = [];
    }
    window.state.clients.push(testClient);
    console.log('2. Added to local state. Total clients:', window.state.clients.length);

    // 3. Save to localStorage
    try {
        localStorage.setItem('auditCB360State', JSON.stringify(window.state));
        console.log('3. Saved to localStorage ✓');
    } catch (e) {
        console.error('3. localStorage save FAILED:', e);
    }

    // 4. Upsert to Supabase
    if (window.SupabaseClient?.isInitialized) {
        try {
            console.log('4. Attempting Supabase upsert...');
            const result = await window.SupabaseClient.upsertClient(testClient);
            console.log('4. Supabase upsert result:', result);
        } catch (e) {
            console.error('4. Supabase upsert FAILED:', e);
        }
    } else {
        console.log('4. Supabase not initialized, skipping cloud save');
    }

    // 5. Refresh the page to see the client
    console.log('=== DONE ===');
    console.log('Client should now be in your state. Refreshing sidebar...');

    // Try to refresh the sidebar
    if (window.renderClientSidebar) {
        window.renderClientSidebar();
    }

    // Or refresh the clients page
    if (window.renderClientsEnhanced) {
        window.renderClientsEnhanced();
    }

    console.log('Check your sidebar - if you see the client, the core save works!');
    console.log('If not, refresh the page (F5) and check the Clients page.');
})();
