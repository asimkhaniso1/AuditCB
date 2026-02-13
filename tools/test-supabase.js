// Supabase Connection Test
// Run this in browser console to diagnose issues

async function testSupabaseConnection() {
    console.log('=== SUPABASE CONNECTION TEST ===\n');

    // 1. Check if SupabaseConfig exists
    console.log('1. SupabaseConfig module:', window.SupabaseConfig ? '✅ Loaded' : '❌ Missing');

    if (window.SupabaseConfig) {
        console.log('   - URL:', window.SupabaseConfig.getUrl());
        console.log('   - Key:', window.SupabaseConfig.getAnonKey() ? '✅ Present' : '❌ Missing');
        console.log('   - Status:', window.SupabaseConfig.getStatus());
    }

    // 2. Check if SupabaseClient exists
    console.log('\n2. SupabaseClient module:', window.SupabaseClient ? '✅ Loaded' : '❌ Missing');

    if (window.SupabaseClient) {
        console.log('   - Initialized:', window.SupabaseClient.isInitialized ? '✅ Yes' : '❌ No');
        console.log('   - Client object:', window.SupabaseClient.client ? '✅ Present' : '❌ Missing');
    }

    // 3. Test actual connection
    console.log('\n3. Testing Supabase connection...');

    if (window.SupabaseClient?.isInitialized) {
        try {
            // Try to fetch from profiles table
            const { data, error } = await window.SupabaseClient.client
                .from('profiles')
                .select('*')
                .limit(1);

            if (error) {
                console.error('   ❌ Connection failed:', error.message);
                console.error('   Error details:', error);
            } else {
                console.log('   ✅ Connection successful!');
                console.log('   Data:', data);
            }
        } catch (e) {
            console.error('   ❌ Exception:', e.message);
        }
    } else {
        console.log('   ⚠️ Skipped - SupabaseClient not initialized');
    }

    // 4. Test user sync
    console.log('\n4. Testing user sync...');

    if (window.SupabaseClient?.isInitialized && window.state?.users?.length > 0) {
        try {
            const testUser = window.state.users[0];
            console.log('   Syncing user:', testUser.email);

            const result = await window.SupabaseClient.upsertUserProfile(testUser);
            console.log('   ✅ Sync successful!');
            console.log('   Result:', result);
        } catch (e) {
            console.error('   ❌ Sync failed:', e.message);
            console.error('   Error details:', e);
        }
    } else {
        console.log('   ⚠️ Skipped - No users or Supabase not initialized');
    }

    console.log('\n=== TEST COMPLETE ===');
}

// Auto-run the test
testSupabaseConnection();
