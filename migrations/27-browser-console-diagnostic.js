// ============================================
// BROWSER CONSOLE DIAGNOSTIC
// Copy and paste this entire block into your browser's Developer Console (F12 > Console)
// ============================================

(async function debugClientAccess() {
    console.log('=== CLIENT ACCESS DIAGNOSTIC ===');

    // 1. Check if Supabase is initialized
    console.log('1. Supabase initialized:', window.SupabaseClient?.isInitialized);

    // 2. Get current session
    const session = await window.SupabaseClient?.client?.auth?.getSession();
    console.log('2. Current session:', session?.data?.session ? 'ACTIVE' : 'NO SESSION');

    if (session?.data?.session) {
        console.log('   User ID:', session.data.session.user.id);
        console.log('   Email:', session.data.session.user.email);
    }

    // 3. Check app state
    console.log('3. App state currentUser:', window.state?.currentUser);
    console.log('   Role:', window.state?.currentUser?.role);

    // 4. Try to fetch clients directly
    console.log('4. Attempting direct client fetch...');
    try {
        const { data, error } = await window.SupabaseClient.client
            .from('clients')
            .select('*')
            .limit(5);

        if (error) {
            console.error('   ERROR:', error.message, error.code, error.hint);
        } else {
            console.log('   SUCCESS! Clients fetched:', data?.length || 0);
            console.log('   Client names:', data?.map(c => c.name));
        }
    } catch (e) {
        console.error('   EXCEPTION:', e.message);
    }

    // 5. Try to insert a test client
    console.log('5. Attempting test client INSERT...');
    try {
        const { data: insertData, error: insertError } = await window.SupabaseClient.client
            .from('clients')
            .insert({ id: 'TEST_' + Date.now(), name: 'Console Test Client', status: 'Active', standard: 'ISO 9001' })
            .select();

        if (insertError) {
            console.error('   INSERT ERROR:', insertError.message, insertError.code);
        } else {
            console.log('   INSERT SUCCESS! Created:', insertData);
            // Clean up
            if (insertData?.[0]?.id) {
                await window.SupabaseClient.client.from('clients').delete().eq('id', insertData[0].id);
                console.log('   (Test client deleted)');
            }
        }
    } catch (e) {
        console.error('   INSERT EXCEPTION:', e.message);
    }

    console.log('=== END DIAGNOSTIC ===');
})();
