// ============================================
// SETTINGS - USER MANAGEMENT (ESM-ready)
// Extracted from settings-module.js for maintainability
// ============================================

function getUsersHTML() {
    // No demo users - users must come from Supabase or be added manually
    const users = window.state.users || [];

    return `
    <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-users-cog" style="margin-right: 0.5rem;"></i>
                    User Management
                </h3>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${(window.AuthManager && window.AuthManager.canPerform('create', 'user')) ? `
                    <button class="btn btn-outline-primary" data-action="openInviteUserModal" aria-label="Invite user">
                        <i class="fa-solid fa-envelope"></i> Invite
                    </button>
                    <button class="btn btn-primary" data-action="openAddUserModal" aria-label="Add user">
                        <i class="fa-solid fa-user-plus"></i> Add User
                    </button>
                    ` : ''}
                </div>
            </div>
            
            <div id="users-list-container" class="table-container">
                ${renderUsersList(users)}
            </div>
        </div>
    `;
}

// Clean up demo users (keep only Supabase authenticated users)
window.cleanupDemoUsers = async function () {
    try {
        // Real Supabase user emails (from auth.users table)
        const realSupabaseEmails = [
            'asimkhaniso@gmail.com',
            'info@companycertification.com'
        ];

        const currentUsers = window.state?.users || [];

        // Filter users
        const realUsers = currentUsers.filter(user =>
            realSupabaseEmails.includes(user.email)
        );

        const demoUsers = currentUsers.filter(user =>
            !realSupabaseEmails.includes(user.email)
        );

        if (demoUsers.length === 0) {
            window.showNotification('No demo users found to clean up', 'info');
            return;
        }

        // Show confirmation dialog
        const userList = demoUsers.map(u =>
            `  • ${u.name} (${u.email || 'no email'})`
        ).join('\n');

        const confirmed = confirm(
            `Remove ${demoUsers.length} demo user(s)?\n\n` +
            `Demo users to remove:\n${userList}\n\n` +
            `Keeping ${realUsers.length} real Supabase users`
        );

        if (!confirmed) {
            return;
        }

        // Update state
        window.state.users = realUsers;
        window.saveData();

        // Refresh UI
        document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);

        window.showNotification(
            `Removed ${demoUsers.length} demo users. ${realUsers.length} real users remaining.`,
            'success'
        );

        Logger.info('Demo users cleaned up:', {
            removed: demoUsers.length,
            remaining: realUsers.length
        });

    } catch (error) {
        Logger.error('Failed to cleanup demo users:', error);
        window.showNotification('Cleanup failed: ' + error.message, 'error');
    }
};

function renderUsersList(users) {
    if (users.length === 0) {
        return `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No users found.</div>`;
    }

    return `
    <table>
            <thead>
                <tr>
                    <th style="width: 50px;"></th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr style="opacity: ${user.status === 'Inactive' ? '0.6' : '1'};">
                        <td>
                            <img src="${user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}" 
                                 style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);">
                        </td>
                        <td>
                            <strong>${window.UTILS.escapeHtml(user.name)}</strong>
                            ${user.isLocal && !user.supabaseId ? '<span style="font-size:0.65rem; color:#94a3b8; margin-left:4px; background:#f1f5f9; padding:1px 4px; border-radius:3px;" title="Created locally, not synced to Supabase">(local)</span>' : ''}
                        </td>
                        <td>${window.UTILS.escapeHtml(user.email)}</td>
                        <td><span class="badge" style="background: #e0f2fe; color: #0284c7;">${window.UTILS.escapeHtml(user.role)}</span></td>
                        <td>
                            <span class="badge" style="background: ${user.status === 'Active' ? '#dcfce7' : user.status === 'Pending' ? '#fef3c7' : '#f1f5f9'}; color: ${user.status === 'Active' ? '#166534' : user.status === 'Pending' ? '#d97706' : '#64748b'};">
                                ${user.status}
                            </span>
                        </td>
                        <td>
                            ${user.status === 'Pending' && window.state.currentUser?.role === 'Admin' ? `
                            <button class="btn btn-sm btn-success" data-action="approveUser" data-id="${user.id}" title="Approve User" style="margin-right: 0.25rem;" aria-label="Confirm">
                                <i class="fa-solid fa-check"></i> Approve
                            </button>
                            ` : ''}
                            ${(window.state.currentUser?.role === 'Admin' || window.state.currentUser?.role === 'Certification Manager') ? `
                            <button class="btn btn-sm btn-icon" data-action="editUser" data-id="${user.id}" title="Edit" aria-label="Edit">
                                <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                            </button>
                            ` : ''}
                            ${(window.state.currentUser?.role === 'Admin' || window.state.currentUser?.role === 'Certification Manager') ? `
                            <button class="btn btn-sm btn-icon" data-action="toggleUserStatus" data-id="${user.id}" title="${user.status === 'Active' ? 'Deactivate' : 'Activate'}">
                                <i class="fa-solid ${user.status === 'Active' ? 'fa-toggle-on' : 'fa-toggle-off'}" style="color: ${user.status === 'Active' ? '#16a34a' : '#cbd5e1'}; font-size: 1.2rem;"></i>
                            </button>
                            ` : ''}
                            ${(window.state.currentUser?.role === 'Admin' || window.state.currentUser?.role === 'Certification Manager') ? `
                            <button class="btn btn-sm btn-icon" data-action="sendPasswordReset" data-id="${user.email}" title="Send Password Reset">
                                <i class="fa-solid fa-key" style="color: #f59e0b;"></i>
                            </button>
                            ` : ''}
                            ${window.state.currentUser?.role === 'Admin' ? `
                            <button class="btn btn-sm btn-icon" data-action="deleteUser" data-id="${user.id}" title="Delete User" aria-label="Delete">
                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                            </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

window.openAddUserModal = function (userId = null) {
    const isEdit = !!userId;
    let user = {};
    if (isEdit) {
        user = window.state.users.find(u => String(u.id) === String(userId)) || {};
    }

    document.getElementById('modal-title').textContent = isEdit ? 'Edit User' : 'Add New User';
    document.getElementById('modal-body').innerHTML = `
    <form id="user-form">
            <div class="form-group">
                <label>Full Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="user-name" value="${user.name || ''}" required>
            </div>
            <div class="form-group">
                <label>Email Address <span style="color: var(--danger-color);">*</span></label>
                <input type="email" class="form-control" id="user-email" value="${user.email || ''}" required ${isEdit && window.state.currentUser?.role !== 'Admin' ? 'disabled' : ''}>
                ${isEdit && window.state.currentUser?.role !== 'Admin' ? '<small style="color: var(--text-secondary);">Email cannot be changed. Contact an Admin.</small>' : ''}
            </div>
            <div class="form-group">
                <label>Role <span style="color: var(--danger-color);">*</span></label>
                ${(window.state.currentUser?.role === 'Admin' || window.state.currentUser?.role === 'Certification Manager') ? `
                <select id="user-role" class="form-control" required>
                    <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    <option value="Certification Manager" ${user.role === 'Certification Manager' ? 'selected' : ''}>Certification Manager</option>
                    <option value="Lead Auditor" ${user.role === 'Lead Auditor' ? 'selected' : ''}>Lead Auditor</option>
                    <option value="Auditor" ${user.role === 'Auditor' ? 'selected' : ''}>Auditor</option>
                    <option value="Technical Expert" ${user.role === 'Technical Expert' ? 'selected' : ''}>Technical Expert</option>
                </select>
                ` : `
                <input type="text" class="form-control" id="user-role-display" value="${user.role || 'Auditor'}" readonly style="background: #f1f5f9;">
                <input type="hidden" id="user-role" value="${user.role || 'Auditor'}">
                <small style="color: var(--text-secondary);"><i class="fa-solid fa-lock"></i> Only administrators can assign roles.</small>
                `}
            </div>
            ${!isEdit ? `
            <div class="form-group">
                <label>Temporary Password <span style="color: var(--danger-color);">*</span></label>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <input type="text" class="form-control" id="user-password" value="${window.PasswordUtils?.generateSecurePassword() || crypto.getRandomValues(new Uint32Array(4)).reduce((s, v) => s + v.toString(36), '').substring(0, 16) + '!A1'}" readonly style="background: #f8fafc; font-family: monospace;">
                    <button type="button" class="btn btn-secondary" data-action="generatePassword" data-id="user-password" title="Generate new password" aria-label="Refresh">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
                <small style="color: var(--text-secondary);">Auto-generated secure password. Share this with the user.</small>
            </div>
            ` : `
            <div class="form-group">
                <label>Reset Password</label>
                <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                    <input type="password" class="form-control" id="user-new-password" placeholder="Leave blank to keep current password">
                    <button type="button" class="btn btn-secondary" data-action="togglePasswordVisibility" data-id="user-new-password" aria-label="View">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
                <small style="color: var(--text-secondary);">Enter new password only if you want to change it.</small>
            </div>
            `}
        </form>
    `;

    document.getElementById('modal-save').onclick = () => {
        saveUser(userId);
    };

    window.openModal();
};

// Helper to ensure auditor profile exists for Auditor/Lead Auditor roles
async function ensureAuditorProfile(userId, _userName) {
    if (!userId || !window.SupabaseClient?.isInitialized) return;

    try {
        // Create default auditor profile if it doesn't exist
        const { error } = await window.SupabaseClient.client
            .from('auditor_profiles')
            .upsert([{
                user_id: userId,
                // Generate default auditor number: AUD-YYYY-XXXX (random fallback)
                auditor_number: `AUD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
                experience: 0,
                availability_status: 'Available',
                max_audits_per_month: 10,
                audits_completed: 0,
                certifications: [],
                industries: [],
                standards: []
            }], {
                onConflict: 'user_id',
                ignoreDuplicates: true // Only create if missing
            });

        if (error) {
            console.warn('Auto-creating auditor profile failed (might already exist):', error.message);
        } else {
            console.debug('Auditor profile ensured successfully');
        }
    } catch (e) {
        console.warn('Error in ensureAuditorProfile:', e);
    }
}

window.saveUser = async function (userId) {
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim().toLowerCase();
    const role = document.getElementById('user-role').value;

    if (!name || (!userId && !email)) {
        window.showNotification('Please fill in all required fields', 'error');
        return;
    }

    // Email validation for new users
    if (!userId) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            window.showNotification('Please enter a valid email address', 'error');
            return;
        }

        // Check for duplicate email (case-insensitive)
        const existingUser = window.state.users?.find(u =>
            u.email?.toLowerCase() === email.toLowerCase()
        );
        if (existingUser) {
            window.showNotification('A user with this email already exists', 'warning');
            return;
        }
    }

    if (userId) {
        // Update existing user
        const user = window.state.users.find(u => u.id === userId);
        if (user) {
            const oldEmail = user.email;
            user.name = name;
            user.role = role;

            // Admin can update email
            if (window.state.currentUser?.role === 'Admin' && email) {
                user.email = email;
            }

            if (!user.avatar) {
                user.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
            }

            // Handle password update if provided
            const newPassword = document.getElementById('user-new-password')?.value;

            // Update in Supabase profiles table if available
            if (window.SupabaseClient?.isInitialized) {
                try {
                    // Update profiles table
                    const profileData = {
                        full_name: name,
                        role: role,
                        email: email,
                        avatar_url: user.avatar
                    };

                    const { error: profileError } = await window.SupabaseClient.client
                        .from('profiles')
                        .update(profileData)
                        .eq('email', oldEmail);

                    if (profileError) {
                        console.warn('Profile update warning:', profileError);
                    }

                    // Handle password if provided
                    if (newPassword && newPassword.trim()) {
                        await window.SupabaseClient.updateUserPassword(email, newPassword.trim());
                        window.showNotification('User and password updated successfully', 'success');
                    } else {
                        window.showNotification('User updated successfully', 'success');
                    }

                    // If role is Auditor or Lead Auditor, ensure profile exists
                    if (role === 'Auditor' || role === 'Lead Auditor') {
                        await ensureAuditorProfile(userId, name);
                    }
                } catch (error) {
                    Logger.error('Supabase update failed:', error);
                    window.showNotification('User updated locally (cloud sync failed)', 'warning');
                }
            } else {
                // No Supabase - just local update
                if (newPassword && newPassword.trim()) {
                    window.showNotification('User updated (password change requires Supabase)', 'info');
                } else {
                    window.showNotification('User updated successfully', 'success');
                }
            }
        }
    } else {
        // Create new user
        const defaultPassword = document.getElementById('user-password')?.value || (window.PasswordUtils?.generateSecurePassword() || 'Temp' + Date.now() + '!Aa1');

        const newUser = {
            id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: name,
            email: email,
            role: role,
            status: 'Active',
            isLocal: true, // Mark as locally created (not from Supabase auth)
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
        };

        // Add to Supabase if available
        if (window.SupabaseClient?.isInitialized) {
            try {
                // Create Supabase Auth user first
                const signUpResult = await window.SupabaseClient.signUp(email, defaultPassword, {
                    full_name: name,
                    role: role
                });

                if (signUpResult?.user) {
                    // Update user ID to match Supabase Auth ID
                    newUser.id = signUpResult.user.id;
                    newUser.supabaseId = signUpResult.user.id;
                    newUser.isLocal = false;

                    Logger.info('Supabase Auth user created:', signUpResult.user.id);
                }

                // Create/Update in profiles table
                const { error: profileError } = await window.SupabaseClient.client
                    .from('profiles')
                    .upsert([{
                        id: newUser.supabaseId || newUser.id,
                        email: email,
                        full_name: name,
                        role: role,
                        avatar_url: newUser.avatar
                    }], {
                        onConflict: 'id'
                    });

                if (profileError) {
                    console.warn('Profile creation warning:', profileError);
                }

                // If role is Auditor or Lead Auditor, auto-create auditor profile
                if (role === 'Auditor' || role === 'Lead Auditor') {
                    await ensureAuditorProfile(newUser.supabaseId || newUser.id, name);
                }

                window.showNotification(`User created successfully! Login: ${email} / Password: ${defaultPassword}`, 'success');
            } catch (error) {
                Logger.error('Supabase user creation failed:', error);
                window.showNotification('User created locally (cloud sync pending)', 'warning');
            }
        } else {
            window.showNotification('User created successfully', 'success');
        }

        window.state.users.push(newUser);
    }

    window.saveData();
    window.closeModal();
    // Refresh list
    document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);
};

window.editUser = function (userId) {
    window.openAddUserModal(userId);
};

window.toggleUserStatus = function (userId) {
    const user = window.state.users.find(u => String(u.id) === String(userId));
    if (!user) return;

    if (user.id === 1 || user.role === 'Admin') {
        // Prevent disabling the main admin for safety in this demo
        if (user.email === 'admin@companycertification.com') {
            window.showNotification('Cannot disable the main Administrator', 'warning');
            return;
        }
    }

    user.status = user.status === 'Active' ? 'Inactive' : 'Active';
    window.saveData();
    document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);
    window.showNotification(`User ${user.status === 'Active' ? 'activated' : 'deactivated'}`, 'info');
};

// Delete user permanently (Admin only)
window.deleteUser = async function (userId) {
    if (window.state.currentUser?.role !== 'Admin') {
        window.showNotification('Only administrators can delete users', 'warning');
        return;
    }

    const user = window.state.users.find(u => String(u.id) === String(userId));
    if (!user) return;

    // Prevent deleting the current user
    if (String(user.id) === String(window.state.currentUser?.id)) {
        window.showNotification('You cannot delete your own account', 'warning');
        return;
    }

    // Prevent deleting the main admin
    if (user.email === 'admin@companycertification.com' || user.email === 'info@companycertification.com') {
        window.showNotification('Cannot delete the main Administrator account', 'warning');
        return;
    }

    if (!confirm(`Are you sure you want to permanently delete user "${user.name}" (${user.email})?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        // Delete from Supabase if available
        if (window.SupabaseClient?.isInitialized) {
            // Delete from profiles table
            const { error: profileError } = await window.SupabaseClient.client
                .from('profiles')
                .delete()
                .eq('email', user.email);

            if (profileError) {
                console.warn('Profile deletion warning:', profileError);
            }

            // Note: Deleting from auth.users requires admin API
            // For now, we'll just delete from profiles and local state
            // The auth user can be deleted manually from Supabase Dashboard → Authentication → Users

            Logger.info('User deleted from profiles table:', user.email);
        }

        // Remove from local state
        window.state.users = window.state.users.filter(u => String(u.id) !== String(userId));
        window.saveData();

        // Refresh UI
        document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);

        window.showNotification(`User "${user.name}" deleted successfully`, 'success');

        // Show additional info if Supabase auth user still exists
        if (window.SupabaseClient?.isInitialized) {
            setTimeout(() => {
                window.showNotification(
                    'Note: To fully remove the user, also delete from Supabase Dashboard → Authentication → Users',
                    'info'
                );
            }, 2000);
        }
    } catch (error) {
        Logger.error('User deletion failed:', error);
        window.showNotification('Failed to delete user: ' + error.message, 'error');
    }
};



// Approve pending user account (Admin only)
window.approveUser = function (userId) {
    if (window.state.currentUser?.role !== 'Admin') {
        window.showNotification('Only administrators can approve user accounts', 'warning');
        return;
    }

    const user = window.state.users.find(u => String(u.id) === String(userId));
    if (!user) return;

    if (user.status !== 'Pending') {
        window.showNotification('User is not pending approval', 'info');
        return;
    }

    user.status = 'Active';
    window.saveData();
    document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);
    window.showNotification(`User ${user.name} has been approved and activated`, 'success');
};

// Sync users from Supabase (Cloud -> Local)
window.syncUsersFromCloud = async function () {
    try {
        if (!window.SupabaseClient?.isInitialized) {
            window.showNotification('Supabase not configured. Go to System > Defaults to set up.', 'warning');
            return;
        }
        window.showNotification('Syncing users from cloud...', 'info');
        const result = await window.SupabaseClient.syncUsersFromSupabase();
        window.showNotification(`Sync complete: ${result.added} added, ${result.updated} updated`, 'success');
        document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);
    } catch (error) {
        window.showNotification('Failed to sync: ' + error.message, 'error');
    }
};

// Sync users to Supabase (Local -> Cloud)
window.syncUsersToCloud = async function () {
    try {
        if (!window.SupabaseClient?.isInitialized) {
            window.showNotification('Supabase not configured. Go to System > Defaults to set up.', 'warning');
            return;
        }
        window.showNotification('Syncing users to cloud...', 'info');
        const result = await window.SupabaseClient.syncUsersToSupabase(window.state.users || []);
        window.showNotification(`Sync complete: ${result.success} synced, ${result.failed} failed`, 'success');
    } catch (error) {
        window.showNotification('Failed to sync: ' + error.message, 'error');
    }
};

// Send password reset email
window.sendPasswordReset = async function (email) {
    if (!confirm(`Send password reset email to ${email}?`)) return;

    try {
        // Check if Supabase is initialized
        if (!window.SupabaseClient?.isInitialized) {
            window.showNotification('Supabase is not configured. Please configure in System Settings.', 'error');
            return;
        }

        // Check if the method exists
        if (typeof window.SupabaseClient.sendPasswordResetEmail !== 'function') {
            window.showNotification('Password reset feature is not available. Please update the application.', 'error');
            Logger.error('sendPasswordResetEmail method not found on SupabaseClient');
            return;
        }

        window.showNotification('Sending password reset email...', 'info');

        await window.SupabaseClient.sendPasswordResetEmail(email);

        window.showNotification(`Password reset email sent to ${email}`, 'success');
        Logger.info('Password reset email sent to:', email);
    } catch (error) {
        Logger.error('Password reset failed:', error);
        window.showNotification('Failed to send reset email: ' + error.message, 'error');
    }
};


// Invite user (create with email invitation)
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
        window.showNotification('Creating user and sending invitation...', 'info');

        if (!window.SupabaseClient?.isInitialized) {
            throw new Error('Supabase is not configured. Please set up Supabase in System Settings.');
        }

        // Use Supabase's signUp with email confirmation
        const tempPassword = 'TempPass' + Math.random().toString(36).substring(2, 15) + '!';
        const fullName = email.split('@')[0]; // Use email username as temporary name

        const { data: authData, error: signUpError } = await window.SupabaseClient.client.auth.signUp({
            email: email,
            password: tempPassword,
            options: {
                data: {
                    full_name: fullName,
                    role: role
                },
                emailRedirectTo: `${window.location.origin}/#auth/callback`
            }
        });

        if (signUpError) {
            throw signUpError;
        }

        Logger.info('Auth user created:', authData.user.id);

        // Create profile entry
        const { error: profileError } = await window.SupabaseClient.client
            .from('profiles')
            .upsert([{
                id: authData.user.id,
                email: email,
                full_name: fullName,
                role: role,
                avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
            }], {
                onConflict: 'id'
            });

        if (profileError) {
            Logger.warn('Profile creation warning:', profileError.message);
            // Continue anyway - profile might be created by database trigger
        }

        // Add to local state
        const newUser = {
            id: authData.user.id,
            name: fullName,
            email: email,
            role: role,
            status: 'Pending', //Will be 'Active' after email confirmation
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
        };

        window.state.users.push(newUser);
        window.saveData();

        // Refresh UI
        document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);

        window.closeModal();

        // Send invitation email
        if (window.EmailService?.isAvailable()) {
            const confirmationUrl = authData.user.confirmation_url ||
                `${window.location.origin}/#auth/confirm?token=${authData.user.id}`;

            const emailResult = await window.EmailService.sendUserInvitation(
                email,
                fullName,
                role,
                confirmationUrl
            );

            if (emailResult.success) {
                window.showNotification(
                    `User created! Invitation email sent to ${email}.`,
                    'success'
                );
            } else {
                window.showNotification(
                    `User created but email failed to send. Please contact ${email} manually.`,
                    'warning'
                );
            }
        } else {
            window.showNotification(
                `User created! A confirmation email has been sent to ${email}.`,
                'success'
            );
        }

        Logger.info('User invited successfully:', newUser);

    } catch (error) {
        Logger.error('Failed to invite user:', error);

        let errorMessage = 'Failed to send invitation: ' + error.message;

        // Provide helpful error messages
        if (error.message.includes('already registered')) {
            errorMessage = 'This email is already registered. User may already have an account.';
        } else if (error.message.includes('email')) {
            errorMessage = 'Email configuration error. Please configure Supabase email settings.';
        }

        window.showNotification(errorMessage, 'error');
    }
};


// Open invite user modal
window.openInviteUserModal = function () {
    document.getElementById('modal-title').textContent = 'Invite User';
    document.getElementById('modal-body').innerHTML = `
        <form id="invite-form" data-action-submit="inviteUser">
            <div class="form-group">
                <label>Email Address <span style="color: var(--danger-color);">*</span></label>
                <input type="email" class="form-control" id="invite-email" placeholder="user@example.com" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select class="form-control" id="invite-role">
                    <option value="Auditor">Auditor</option>
                    <option value="Lead Auditor">Lead Auditor</option>
                    <option value="Technical Expert">Technical Expert</option>
                    <option value="Certification Manager">Certification Manager</option>
                    <option value="Admin">Admin</option>
                </select>
            </div>
            <div class="alert alert-info" style="margin-top: 1rem;">
                <i class="fa-solid fa-info-circle"></i>
                An invitation email will be sent to the user to set up their account.
            </div>
        </form>
    `;
    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').textContent = 'Send Invitation';
    document.getElementById('modal-save').onclick = () => {
        window.inviteUser();
    };
    window.openModal();
};

if (window.Logger) Logger.debug('Modules', 'settings-users.js loaded successfully.');

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { openAddUserModal, editUser, toggleUserStatus, approveUser, openInviteUserModal };
}
