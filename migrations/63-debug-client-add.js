// ============================================
// COMPREHENSIVE CLIENT ADD DEBUG
// Paste this in browser console (F12 > Console)
// This will test the EXACT save path and show the error
// ============================================

(async function debugClientAdd() {
    console.log('=== 🔍 COMPREHENSIVE CLIENT ADD DEBUG ===');

    // Step 1: Check Supabase initialization
    console.log('\n--- STEP 1: Supabase Status ---');
    console.log('  SupabaseClient exists:', !!window.SupabaseClient);
    console.log('  isInitialized:', window.SupabaseClient?.isInitialized);
    console.log('  client object:', !!window.SupabaseClient?.client);

    if (!window.SupabaseClient?.isInitialized) {
        console.error('❌ STOP: Supabase is NOT initialized!');
        return;
    }

    // Step 2: Check current user
    console.log('\n--- STEP 2: Current User ---');
    console.log('  state.currentUser:', window.state?.currentUser);
    // Try to get session
    const { data: sessionData } = await window.SupabaseClient.client.auth.getSession();
    console.log('  Supabase session:', sessionData?.session ? 'Active' : 'None');

    // Step 3: Build a minimal test payload
    console.log('\n--- STEP 3: Test Client Object ---');
    const testClient = {
        id: String(Date.now()),
        name: 'Debug Test ' + new Date().toLocaleTimeString(),
        standard: 'ISO 9001',
        status: 'Active',
        type: 'New',
        website: null,
        employees: 10,
        shifts: 'No',
        industry: null,
        contacts: [],
        sites: [],
        departments: [],
        designations: [],
        goodsServices: [],
        keyProcesses: [],
        contactPerson: null,
        nextAudit: null,
        lastAudit: null,
        logoUrl: null,
        createdBy: window.state?.currentUser?.id || null
    };
    console.log('  Payload:', JSON.stringify(testClient, null, 2));

    // Step 4: Try direct Supabase insert (bypass upsertClient function)
    console.log('\n--- STEP 4: Direct Supabase Insert ---');
    const dbPayload = {
        id: testClient.id,
        name: testClient.name,
        standard: testClient.standard,
        status: testClient.status,
        type: testClient.type,
        website: testClient.website,
        employees: testClient.employees,
        shifts: testClient.shifts,
        industry: testClient.industry,
        contacts: testClient.contacts,
        sites: testClient.sites,
        departments: testClient.departments,
        designations: testClient.designations,
        goods_services: testClient.goodsServices,
        key_processes: testClient.keyProcesses,
        contact_person: testClient.contactPerson,
        next_audit: testClient.nextAudit,
        last_audit: testClient.lastAudit,
        logo_url: testClient.logoUrl,
        created_by: testClient.createdBy,
        updated_at: new Date().toISOString()
    };
    console.log('  DB Payload:', JSON.stringify(dbPayload, null, 2));

    try {
        const { data, error } = await window.SupabaseClient.client
            .from('clients')
            .upsert(dbPayload, { onConflict: 'id' })
            .select();

        if (error) {
            console.error('❌ INSERT FAILED:', error);
            console.error('  Error Code:', error.code);
            console.error('  Error Message:', error.message);
            console.error('  Error Details:', error.details);
            console.error('  Error Hint:', error.hint);
            alert('INSERT FAILED: ' + error.message);
        } else {
            console.log('✅ INSERT SUCCEEDED:', data);
            alert('SUCCESS! Client added. Check the Clients page.');
        }
    } catch (e) {
        console.error('❌ EXCEPTION:', e);
        alert('EXCEPTION: ' + e.message);
    }

    console.log('\n=== 🔍 DEBUG COMPLETE ===');
})();
