// Client-side wrapper for invite-user Edge Function

window.inviteUserToSupabase = async function (email, fullName, role) {
    try {
        if (!window.SupabaseClient?.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        // Call the Edge Function
        const { data, error } = await window.SupabaseClient.client.functions.invoke('invite-user', {
            body: {
                email: email,
                full_name: fullName,
                role: role,
                send_invite_email: true
            }
        });

        if (error) {
            throw error;
        }

        if (data.error) {
            throw new Error(data.error);
        }

        Logger.info('User invited successfully:', data.user);
        return data.user;

    } catch (error) {
        Logger.error('Failed to invite user:', error);
        throw error;
    }
};

// Alternative: Use Supabase's built-in signup (no Edge Function needed)
window.signUpUserDirectly = async function (email, password, fullName, role) {
    try {
        if (!window.SupabaseClient?.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        // Sign up the user
        const { data: authData, error: authError } = await window.SupabaseClient.client.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    role: role
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`
            }
        });

        if (authError) {
            throw authError;
        }

        // Create profile entry
        const { error: profileError } = await window.SupabaseClient.client
            .from('profiles')
            .insert([{
                id: authData.user.id,
                email: email,
                full_name: fullName,
                role: role,
                avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
            }]);

        if (profileError) {
            Logger.error('Profile creation failed:', profileError);
            // User auth created but profile failed - they can still login
            // Profile will be created on first login via trigger
        }

        Logger.info('User signed up successfully:', authData.user);
        return authData.user;

    } catch (error) {
        Logger.error('Failed to sign up user:', error);
        throw error;
    }
};

Logger.info('User invite utilities loaded');
