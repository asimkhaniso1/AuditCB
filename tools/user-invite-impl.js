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

        // Method 1: Try Edge Function (if deployed)
        let inviteSuccess = false;
        let userData = null;

        try {
            const { data, error } = await window.SupabaseClient.client.functions.invoke('invite-user', {
                body: {
                    email: email,
                    full_name: email.split('@')[0], // Use email username as temporary name
                    role: role,
                    send_invite_email: true
                }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            inviteSuccess = true;
            userData = data.user;
            Logger.info('User invited via Edge Function:', userData);

        } catch (edgeFunctionError) {
            Logger.warn('Edge Function not available, using direct signup:', edgeFunctionError);

            // Method 2: Fallback to direct signup with temporary password
            const tempPassword = window.PasswordUtils?.generateSecurePassword() || ('Temp' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36) + '!Aa1');

            const { data: authData, error: signUpError } = await window.SupabaseClient.client.auth.signUp({
                email: email,
                password: tempPassword,
                options: {
                    data: {
                        full_name: email.split('@')[0],
                        role: role
                    },
                    emailRedirectTo: `${window.location.origin}/#auth/callback`
                }
            });

            if (signUpError) throw signUpError;

            // Create profile
            const { error: profileError } = await window.SupabaseClient.client
                .from('profiles')
                .insert([{
                    id: authData.user.id,
                    email: email,
                    full_name: email.split('@')[0],
                    role: role,
                    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}&background=random`
                }]);

            if (profileError) {
                Logger.warn('Profile creation failed:', profileError);
            }

            inviteSuccess = true;
            userData = {
                id: authData.user.id,
                email: email,
                full_name: email.split('@')[0],
                role: role
            };

            Logger.info('User created via direct signup:', userData);
        }

        if (inviteSuccess && userData) {
            // Add to local state
            const newUser = {
                id: userData.id || Date.now(),
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
        }

    } catch (error) {
        Logger.error('Failed to invite user:', error);
        window.showNotification(
            'Failed to send invitation: ' + error.message,
            'error'
        );
    }
};

Logger.info('User invite function loaded');
