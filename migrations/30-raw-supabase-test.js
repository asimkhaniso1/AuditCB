// ============================================
// RAW SUPABASE INSERT - BYPASSES ALL APP LOGIC
// Paste this in your browser console (F12 > Console)
// ============================================

(async function rawSupabaseInsert() {
    console.log('=== RAW SUPABASE INSERT TEST ===');

    // Check if Supabase is available
    if (!window.SupabaseClient?.client) {
        console.error('Supabase client not available!');
        return;
    }

    const client = window.SupabaseClient.client;

    // 1. Check current auth session
    const { data: sessionData } = await client.auth.getSession();
    console.log('1. Session:', sessionData?.session ? 'ACTIVE' : 'NO SESSION');
    if (sessionData?.session) {
        console.log('   User ID:', sessionData.session.user.id);
    }

    // 2. Try RAW INSERT with minimal data
    const testId = 'RAW_TEST_' + Date.now();
    console.log('2. Attempting RAW INSERT with id:', testId);

    const { data: insertData, error: insertError } = await client
        .from('clients')
        .insert({
            id: testId,
            name: 'Raw Test Client ' + new Date().toLocaleTimeString(),
            status: 'Active',
            standard: 'ISO 9001'
        })
        .select();

    if (insertError) {
        console.error('=== INSERT FAILED ===');
        console.error('Error code:', insertError.code);
        console.error('Error message:', insertError.message);
        console.error('Error details:', insertError.details);
        console.error('Error hint:', insertError.hint);
        console.error('Full error:', insertError);
    } else {
        console.log('=== INSERT SUCCESS ===');
        console.log('Inserted data:', insertData);

        // 3. Try to SELECT it back
        console.log('3. Verifying by SELECT...');
        const { data: selectData, error: selectError } = await client
            .from('clients')
            .select('*')
            .eq('id', testId);

        if (selectError) {
            console.error('SELECT FAILED:', selectError);
        } else {
            console.log('SELECT SUCCESS:', selectData);
        }

        // 4. Clean up
        console.log('4. Cleaning up test record...');
        await client.from('clients').delete().eq('id', testId);
        console.log('   Deleted test record');
    }

    console.log('=== END RAW TEST ===');
})();
