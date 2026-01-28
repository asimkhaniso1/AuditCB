/**
 * FINAL INJECTION SCRIPT (v50)
 * Purpose: Insert Clients ONLY.
 * Usage: Copy & Paste into specific Console.
 */

(async function injectClients() {
    console.log('💉 STARTING FINAL CLIENT INJECTION...');

    const clients = [
        {
            "id": "1767868038354",
            "name": "Pakistan Post Foundation",
            "standard": "ISO 9001:2015, ISO 27001:2022",
            "status": "Active",
            "website": "https://ppf.com.pk/divisions/",
            "employees": "100",
            "industry": "Press",
            "created_at": "2026-01-12 08:23:34.213052+00",
            "updated_at": "2026-01-22 10:44:23.096462+00"
        },
        {
            "id": "1768406734791",
            "name": "CCI Services",
            "standard": "ISO 9001:2015",
            "status": "Active",
            "website": "https://cciservices.com",
            "employees": "50",
            "industry": "Services",
            "created_at": "2026-01-18 10:00:00.000000+00",
            "updated_at": "2026-01-22 11:33:00.000000+00"
        },
        {
            "id": "1767868038355",
            "name": "TechFlow Solutions",
            "standard": "ISO 27001:2022",
            "status": "Active",
            "website": "https://techflow.io",
            "employees": "250",
            "industry": "Technology",
            "created_at": "2026-01-15 09:15:00.000000+00",
            "updated_at": "2026-01-22 10:00:00.000000+00"
        }
    ];

    try {
        if (!window.SupabaseClient) {
            alert('❌ ERROR: Supabase Client not found.\nRefresh page and try again immediately.');
            return;
        }

        // 1. Insert Clients
        const { error } = await window.SupabaseClient.from('clients').upsert(clients, { onConflict: 'id' });

        if (error) {
            console.error('Insert Failed:', error);
            alert('❌ INSERT FAILED:\n' + error.message);
        } else {
            console.log('✅ 3 Clients Injected.');
            alert('✅ SUCCESS: 3 Clients Restored!\n\nThe dashboard should now populate.\nClick OK to reload.');
            window.location.reload();
        }

    } catch (e) {
        console.error('Script Error:', e);
        alert('❌ SCRIPT CRASHED: ' + e.message);
    }
})();
