const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'recovery_data.json'), 'utf8'));

// Re-format settings to match the upsert structure
const settings = data.settings[0];
settings.id = 1; // Ensure ID is integer
settings.is_admin = true;

const scriptContent = `/**
 * EMERGENCY DATA RESTORATION SCRIPT (v1.0)
 * This script restores data from the Jan 22nd Manual Backup.
 */

(async function restoreData() {
    console.log('%c🚀 STARTING DATA RESTORATION...', 'color: blue; font-weight: bold; font-size: 16px;');

    if (!window.SupabaseClient) {
        console.error('❌ SupabaseClient not found. Please make sure the app is loaded.');
        return;
    }

    const backup = ${JSON.stringify({ profiles: data.profiles, clients: data.clients, settings: settings }, null, 2)};

    try {
        // 1. Restore Profiles
        console.log('Restoring Profiles...');
        for (const profile of backup.profiles) {
            const { avatar, ...cleanProfile } = profile; // Remove \r keys if any
            await window.SupabaseClient.upsert('profiles', cleanProfile);
        }
        console.log('✅ Profiles restored.');

        // 2. Restore Clients
        console.log('Restoring Clients...');
        for (const client of backup.clients) {
            const { "key_processes\\r": kp, ...cleanClient } = client;
            if (kp) cleanClient.key_processes = kp;
            await window.SupabaseClient.upsert('clients', cleanClient);
        }
        console.log('✅ Clients restored.');

        // 3. Restore Settings
        console.log('Restoring Settings...');
        await window.SupabaseClient.upsert('settings', backup.settings);
        console.log('✅ Settings restored.');

        console.log('%c🎉 RESTORATION COMPLETE!', 'color: green; font-weight: bold; font-size: 16px;');
        alert('Data restoration complete! The page will now reload.');
        window.location.reload();

    } catch (error) {
        console.error('❌ Restoration failed:', error);
        alert('Restoration failed: ' + error.message);
    }
})();
`;

fs.writeFileSync(path.join(__dirname, 'migrations', '47-restore-from-backup.js'), scriptContent);
console.log('Successfully generated migrations/47-restore-from-backup.js');
