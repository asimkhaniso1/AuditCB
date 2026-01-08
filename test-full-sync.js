// ============================================
// SUPABASE SYNC - COMPREHENSIVE TEST SCRIPT
// ============================================
// Run this in browser console after logging in

async function testFullSupabaseSync() {
    console.log('🧪 === SUPABASE SYNC TEST SUITE ===\n');

    const results = {
        connection: false,
        userSync: false,
        clientSync: false,
        auditorSync: false,
        assignmentSync: false,
        auditPlanSync: false,
        auditReportSync: false
    };

    // Test 1: Connection
    console.log('1️⃣ Testing Supabase Connection...');
    if (window.SupabaseClient?.isInitialized) {
        console.log('   ✅ Supabase connected');
        results.connection = true;
    } else {
        console.log('   ❌ Supabase NOT connected');
        return results;
    }

    // Test 2: User Sync
    console.log('\n2️⃣ Testing User Sync...');
    try {
        const userCount = window.state.users?.length || 0;
        console.log(`   📊 Local users: ${userCount}`);

        await window.SupabaseClient.syncUsersToSupabase(window.state.users || []);
        console.log('   ✅ Users synced to Supabase');

        const userResult = await window.SupabaseClient.syncUsersFromSupabase();
        console.log(`   ✅ Users loaded from Supabase: ${userResult.added} added, ${userResult.updated} updated`);
        results.userSync = true;
    } catch (e) {
        console.log('   ❌ User sync failed:', e.message);
    }

    // Test 3: Client Sync
    console.log('\n3️⃣ Testing Client Sync...');
    try {
        const clientCount = window.state.clients?.length || 0;
        console.log(`   📊 Local clients: ${clientCount}`);

        await window.SupabaseClient.syncClientsToSupabase(window.state.clients || []);
        console.log('   ✅ Clients synced to Supabase');

        const clientResult = await window.SupabaseClient.syncClientsFromSupabase();
        console.log(`   ✅ Clients loaded from Supabase: ${clientResult.added} added, ${clientResult.updated} updated`);
        results.clientSync = true;
    } catch (e) {
        console.log('   ❌ Client sync failed:', e.message);
    }

    // Test 4: Auditor Sync
    console.log('\n4️⃣ Testing Auditor Sync...');
    try {
        const auditorCount = window.state.auditors?.length || 0;
        console.log(`   📊 Local auditors: ${auditorCount}`);

        await window.SupabaseClient.syncAuditorsToSupabase(window.state.auditors || []);
        console.log('   ✅ Auditors synced to Supabase');

        const auditorResult = await window.SupabaseClient.syncAuditorsFromSupabase();
        console.log(`   ✅ Auditors loaded from Supabase: ${auditorResult.added} added, ${auditorResult.updated} updated`);
        results.auditorSync = true;
    } catch (e) {
        console.log('   ❌ Auditor sync failed:', e.message);
    }

    // Test 5: Auditor Assignment Sync
    console.log('\n5️⃣ Testing Auditor Assignment Sync...');
    try {
        const assignmentCount = window.state.auditorAssignments?.length || 0;
        console.log(`   📊 Local assignments: ${assignmentCount}`);

        if (assignmentCount > 0) {
            await window.SupabaseClient.syncAuditorAssignmentsToSupabase(window.state.auditorAssignments);
            console.log('   ✅ Assignments synced to Supabase');
        } else {
            console.log('   ℹ️ No local assignments to sync (skipping upload)');
        }

        const assignmentResult = await window.SupabaseClient.syncAuditorAssignmentsFromSupabase();
        console.log(`   ✅ Assignments loaded from Supabase: ${assignmentResult.added} added, ${assignmentResult.updated} updated`);
        results.assignmentSync = true;
    } catch (e) {
        console.log('   ❌ Assignment sync failed:', e.message);
    }

    // Test 6: Audit Plan Sync
    console.log('\n6️⃣ Testing Audit Plan Sync...');
    try {
        const planCount = window.state.auditPlans?.length || 0;
        console.log(`   📊 Local audit plans: ${planCount}`);

        await window.SupabaseClient.syncAuditPlansToSupabase(window.state.auditPlans || []);
        console.log('   ✅ Audit plans synced to Supabase');

        const planResult = await window.SupabaseClient.syncAuditPlansFromSupabase();
        console.log(`   ✅ Audit plans loaded from Supabase: ${planResult.added} added, ${planResult.updated} updated`);
        results.auditPlanSync = true;
    } catch (e) {
        console.log('   ❌ Audit plan sync failed:', e.message);
    }

    // Test 7: Audit Report Sync
    console.log('\n7️⃣ Testing Audit Report Sync...');
    try {
        const reportCount = window.state.auditReports?.length || 0;
        console.log(`   📊 Local audit reports: ${reportCount}`);

        await window.SupabaseClient.syncAuditReportsToSupabase(window.state.auditReports || []);
        console.log('   ✅ Audit reports synced to Supabase');

        const reportResult = await window.SupabaseClient.syncAuditReportsFromSupabase();
        console.log(`   ✅ Audit reports loaded from Supabase: ${reportResult.added} added, ${reportResult.updated} updated`);
        results.auditReportSync = true;
    } catch (e) {
        console.log('   ❌ Audit report sync failed:', e.message);
    }

    // Summary
    console.log('\n📊 === TEST RESULTS ===');
    console.log(`Connection:     ${results.connection ? '✅' : '❌'}`);
    console.log(`Users:          ${results.userSync ? '✅' : '❌'}`);
    console.log(`Clients:        ${results.clientSync ? '✅' : '❌'}`);
    console.log(`Auditors:       ${results.auditorSync ? '✅' : '❌'}`);
    console.log(`Assignments:    ${results.assignmentSync ? '✅' : '❌'}`);
    console.log(`Audit Plans:    ${results.auditPlanSync ? '✅' : '❌'}`);
    console.log(`Audit Reports:  ${results.auditReportSync ? '✅' : '❌'}`);

    const passedTests = Object.values(results).filter(r => r).length;
    const totalTests = Object.keys(results).length;

    console.log(`\n🎯 Score: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests) {
        console.log('🎉 ALL TESTS PASSED! Supabase sync is working perfectly!');
    } else {
        console.log('⚠️ Some tests failed. Check errors above.');
    }

    return results;
}

// Auto-run the test
console.log('Starting Supabase sync test in 2 seconds...');
setTimeout(() => testFullSupabaseSync(), 2000);
