const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'recovery_data.json'), 'utf8'));

// Re-format settings to match the UUID schema and avoid ID conflicts
const settings = data.settings[0];
// Use a fixed valid UUID for the main settings row instead of an integer
settings.id = '00000000-0000-0000-0000-000000000001';
settings.is_admin = true;

const scriptContent = `/**
 * EMERGENCY DATA RESTORATION SCRIPT (v1.1)
 * FIXED: UUID type mismatch and Settings conflict target.
 */

(async function restoreData() {
    console.log('%c🚀 STARTING CORRECTED DATA RESTORATION...', 'color: blue; font-weight: bold; font-size: 16px;');

    if (!window.SupabaseClient) {
        console.error('❌ SupabaseClient not found. Please make sure the app is loaded.');
        return;
    }

    const backup = ${JSON.stringify({ profiles: data.profiles, clients: data.clients, settings: settings }, null, 2)};

    try {
        // 1. Restore Profiles
        console.log('Restoring Profiles...');
        for (const profile of backup.profiles) {
            const { avatar, ...cleanProfile } = profile;
            // Ensure ID is a valid UUID (stored as string in JSON)
            await window.SupabaseClient.upsert('profiles', cleanProfile, { onConflict: 'id' });
        }
        console.log('✅ Profiles restored.');

        // 2. Restore Clients
        console.log('Restoring Clients...');
        for (const client of backup.clients) {
            const { "key_processes\\r": kp, ...cleanClient } = client;
            if (kp) cleanClient.key_processes = kp;
            // Client IDs are strings in the JSON, should work with upsert
            await window.SupabaseClient.upsert('clients', cleanClient, { onConflict: 'id' });
        }
        console.log('✅ Clients restored.');

        // 3. Restore Settings
        console.log('Restoring Settings (Targeting key column)...');
        // The settings table uses 'key' as a unique constraint, not 'id'
        await window.SupabaseClient.upsert('settings', backup.settings, { onConflict: 'key' });
        console.log('✅ Settings restored.');

        console.log('%c🎉 RESTORATION COMPLETE!', 'color: green; font-weight: bold; font-size: 16px;');
        alert('Data restoration complete! The page will now reload.');
        window.location.reload();

    } catch (error) {
        console.error('❌ Restoration failed:', error);
        alert('Restoration failed: ' + (error.message || JSON.stringify(error)));
    }
})();
`;

fs.writeFileSync(path.join(__dirname, 'migrations', '47-restore-from-backup.js'), scriptContent);
console.log('Successfully generated migrations/47-restore-from-backup.js');
