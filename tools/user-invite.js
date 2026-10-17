// Client-side wrapper for invite-user Edge Function
//
// Public signup is disabled, so there is no browser-side signup path: the
// edge function is the only way to create a user. callInviteUserFunction
// lives in settings-users.js.

window.inviteUserToSupabase = async function (email, fullName, role) {
    try {
        if (!window.SupabaseClient?.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        const user = await window.callInviteUserFunction(email, fullName, role);
        Logger.info('User invited successfully:', user);
        return user;

    } catch (error) {
        Logger.error('Failed to invite user:', error);
        throw error;
    }
};

Logger.info('User invite utilities loaded');
