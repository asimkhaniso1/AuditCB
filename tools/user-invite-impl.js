// ============================================
// USER INVITE IMPLEMENTATION
// ============================================
// Adds invite user functionality to settings module

window.inviteUser = async function () {
    const email = document.getElementById('invite-email').value.trim();
    const role = document.getElementById('invite-role').value;

    if (!email) {
        window.showNotification('Please enter an email address', 'error');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        window.showNotification('Please enter a valid email address', 'error');
        return;
    }

    // Check if user already exists
    const existingUser = window.state.users?.find(u => u.email === email);
    if (existingUser) {
        window.showNotification('A user with this email already exists', 'warning');
        return;
    }

    try {
        window.showNotification('Sending invitation...', 'info');

        if (!window.SupabaseClient?.isInitialized) {
            throw new Error('Supabase is not configured. Please set up Supabase in System Settings.');
        }

        // Public signup is disabled, so the invite-user edge function is the
        // only way to create a user; it also writes the profiles row.
        // callInviteUserFunction lives in settings-users.js.
        const userData = await window.callInviteUserFunction(email, email.split('@')[0], role);
        Logger.info('User invited via Edge Function:', userData);

        // Add to local state
        const newUser = {
            id: userData.id,
            name: userData.full_name || email.split('@')[0],
            email: email,
            role: role,
            status: 'Pending',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}&background=random`
        };

        window.state.users.push(newUser);
        window.saveData();

        // Refresh UI
        document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);

        window.closeModal();
        window.showNotification(
            `Invitation sent to ${email}! They will receive an email to complete registration.`,
            'success'
        );

    } catch (error) {
        Logger.error('Failed to invite user:', error);
        window.showNotification(
            'Failed to send invitation: ' + error.message,
            'error'
        );
    }
};

Logger.info('User invite function loaded');
