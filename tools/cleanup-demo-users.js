/**
 * CLEANUP SCRIPT - Remove Demo Users
 * 
 * This script will remove local-only demo users and keep only 
 * the real Supabase authenticated users.
 * 
 * Run this in the browser console on your app:
 * audit.companycertification.com
 */

(async function cleanupDemoUsers() {
    console.log('🧹 Starting Demo User Cleanup...');

    // Real Supabase user emails (based on your Supabase Auth screenshot)
    const realSupabaseEmails = [
        'asimkhaniso@gmail.com',
        'info@companycertification.com'
    ];

    // Get current users from state
    const currentUsers = window.state?.users || [];
    console.log('📊 Current users:', currentUsers.length);

    // Filter to keep only real Supabase users
    const realUsers = currentUsers.filter(user =>
        realSupabaseEmails.includes(user.email)
    );

    // Users to be removed
    const removedUsers = currentUsers.filter(user =>
        !realSupabaseEmails.includes(user.email)
    );

    console.log('✅ Keeping real users:', realUsers.length);
    console.log('   - ' + realUsers.map(u => u.email).join('\n   - '));

    console.log('❌ Removing demo users:', removedUsers.length);
    console.log('   - ' + removedUsers.map(u => `${u.name} (${u.email || 'no email'})`).join('\n   - '));

    // Confirm before proceeding
    const confirmed = confirm(
        `Remove ${removedUsers.length} demo user(s)?\n\n` +
        `Keeping:\n${realUsers.map(u => `  • ${u.name} (${u.email})`).join('\n')}\n\n` +
        `Removing:\n${removedUsers.map(u => `  • ${u.name} (${u.email || 'no email'})`).join('\n')}`
    );

    if (!confirmed) {
        console.log('❌ Cleanup cancelled by user');
        return;
    }

    // Update state
    window.state.users = realUsers;

    // Save to localStorage
    if (window.saveData) {
        window.saveData();
        console.log('💾 Data saved to localStorage');
    } else {
        localStorage.setItem('auditCB360_state', JSON.stringify(window.state));
        console.log('💾 Data saved manually to localStorage');
    }

    // Refresh the UI
    if (window.location.hash.includes('settings')) {
        // Refresh user list if on settings page
        const container = document.getElementById('users-list-container');
        if (container && window.renderUsersList) {
            container.innerHTML = window.renderUsersList(window.state.users);
        }
    }

    console.log('✅ Cleanup complete!');
    console.log(`📊 Users remaining: ${window.state.users.length}`);

    // Show success message
    if (window.showNotification) {
        window.showNotification(
            `Removed ${removedUsers.length} demo users. ${realUsers.length} real users remaining.`,
            'success'
        );
    }

    return {
        removed: removedUsers.length,
        remaining: realUsers.length,
        users: window.state.users
    };
})();
