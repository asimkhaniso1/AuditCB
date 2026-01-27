// ============================================
// GLOBAL DATABASE INSPECTOR
// Run this in your Browser Console (F12)
// ============================================

(async function inspectDatabase() {
    console.log('%c🔍 AuditCB360 Global Database Inspector started...', 'color: #3b82f6; font-weight: bold; font-size: 14px;');

    if (!window.SupabaseClient || !window.SupabaseClient.client) {
        console.error('❌ Supabase Client not found. Please refresh the page and try again.');
        return;
    }

    const tables = [
        'clients',
        'auditors',
        'auditor_profiles',
        'audit_plans',
        'audit_reports',
        'certification_decisions',
        'checklists',
        'documents',
        'settings'
    ];

    console.log('Checking tables for data...');

    const results = {};

    for (const table of tables) {
        try {
            const { data, count, error } = await window.SupabaseClient.client
                .from(table)
                .select('*', { count: 'exact' });

            if (error) {
                console.warn(`⚠️ Error checking table "${table}":`, error.message);
                results[table] = 'Error';
            } else {
                results[table] = count || 0;
                if (count > 0) {
                    console.log(`%c✅ Found ${count} records in "${table}"`, 'color: #16a34a; font-weight: bold;');
                    if (table === 'audit_reports' || table === 'certification_decisions') {
                        console.log(`   Sample Data:`, data[0]);
                    }
                } else {
                    console.log(`⚪ Table "${table}" is empty.`);
                }
            }
        } catch (e) {
            console.error(`❌ Unexpected error checking table "${table}":`, e);
            results[table] = 'Failed';
        }
    }

    console.log('--------------------------------------------');
    console.log('%c📊 Database Summary Table:', 'font-weight: bold;');
    console.table(results);

    if (results['audit_reports'] > 0 || results['certification_decisions'] > 0) {
        console.log('%c💡 RECOVERY OPTION: We can reconstruct clients from your reports/decisions!', 'color: #f59e0b; font-weight: bold;');
    } else if (Object.values(results).every(v => v === 0)) {
        console.log('%c🆘 ALL TABLES ARE EMPTY. We must find a local backup or check Supabase Backups.', 'color: #ef4444; font-weight: bold;');
    }

    console.log('--------------------------------------------');
})();
