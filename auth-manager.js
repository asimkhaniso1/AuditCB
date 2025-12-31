// ============================================
// AUTHENTICATION MODULE
// ============================================
// Basic authentication system with role-based access control
// TODO: Replace with proper backend authentication (Firebase Auth, Auth0, etc.)

const AuthManager = {

    // Session storage key
    SESSION_KEY: 'auditCB360_session',
    SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 hours in milliseconds

    /**
     * Initialize authentication system
     */
    init: function () {
        Logger.info('Initializing AuthManager...');

        // Check for existing session
        const session = this.getSession();
        if (session && this.isSessionValid(session)) {
            this.restoreSession(session);
            Logger.info('Session restored for user:', session.user.name);
        } else {
            this.clearSession();
            Logger.info('No valid session found');
        }

        // Setup session timeout checker
        this.setupSessionMonitor();
    },

    /**
     * Login user
     * Uses Supabase if configured, falls back to demo auth
     * @param {string} username 
     * @param {string} password 
     * @returns {Object} User object or null
     */
    login: async function (username, password) {
        try {
            Logger.info('Login attempt for:', username);

            // Try Supabase authentication first if available
            if (window.SupabaseClient?.isInitialized) {
                Logger.info('Using Supabase authentication');
                try {
                    const data = await window.SupabaseClient.signIn(username, password);
                    if (data && window.state.currentUser) {
                        return window.state.currentUser;
                    }
                } catch (supabaseError) {
                    Logger.warn('Supabase auth failed, falling back to demo:', supabaseError.message);
                }
            }

            // Fallback to demo authentication
            Logger.warn('Using demo authentication');
            return this.loginDemo(username, password);
        } catch (error) {
            ErrorHandler.handle(error, 'Login');
            return null;
        }
    },

    /**
     * Demo login (for development/testing)
     */
    loginDemo: function (username, password) {
        // DEMO USERS - Only used when Supabase is not configured
        const demoUsers = [
            {
                id: 1,
                username: 'admin',
                password: 'admin123', // TODO: NEVER store passwords in plain text!
                name: 'Admin User',
                email: 'admin@auditcb360.com',
                role: 'Admin',
                permissions: ['all']
            },
            {
                id: 2,
                username: 'manager',
                password: 'manager123',
                name: 'Certification Manager',
                email: 'manager@auditcb360.com',
                role: 'Certification Manager',
                permissions: ['view_all', 'edit_clients', 'approve_reports', 'manage_auditors']
            },
            {
                id: 3,
                username: 'auditor',
                password: 'auditor123',
                name: 'Lead Auditor',
                email: 'auditor@auditcb360.com',
                role: 'Lead Auditor',
                permissions: ['view_assigned', 'edit_reports', 'create_ncr']
            },
            {
                id: 4,
                username: 'viewer',
                password: 'viewer123',
                name: 'Report Viewer',
                email: 'viewer@auditcb360.com',
                role: 'Auditor',
                permissions: ['view_assigned']
            }
        ];

        // Find user
        const user = demoUsers.find(u =>
            u.username === username && u.password === password
        );

        if (!user) {
            Logger.warn('Login failed: Invalid credentials');
            window.showNotification('Invalid username or password', 'error');
            return null;
        }

        // Create session
        const session = {
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                permissions: user.permissions
            },
            loginTime: Date.now(),
            expiresAt: Date.now() + this.SESSION_TIMEOUT,
            token: this.generateToken() // Simple token for demo
        };

        // Save session
        this.saveSession(session);

        // Update app state
        window.state.currentUser = session.user;

        Logger.info('Demo login successful for:', user.name);
        window.showNotification(`Welcome, ${user.name}!`, 'success');

        return session.user;
    },

    /**
     * Logout current user
     */
    logout: function () {
        try {
            const userName = window.state?.currentUser?.name || 'User';

            this.clearSession();

            // Clear app state
            window.state.currentUser = null;

            Logger.info('User logged out:', userName);
            window.showNotification('Logged out successfully', 'info');

            // Redirect to login
            this.showLoginScreen();
        } catch (error) {
            ErrorHandler.handle(error, 'Logout');
        }
    },

    /**
     * Check if user has permission
     * @param {string|Array} requiredPermission 
     * @returns {boolean}
     */
    hasPermission: function (requiredPermission) {
        const user = window.state?.currentUser;

        if (!user) {
            Logger.warn('Permission check failed: No user logged in');
            return false;
        }

        // Admin has all permissions
        if (user.role === 'Admin' || user.permissions?.includes('all')) {
            return true;
        }

        // Check specific permissions
        const permissions = Array.isArray(requiredPermission)
            ? requiredPermission
            : [requiredPermission];

        return permissions.some(perm => user.permissions?.includes(perm));
    },

    /**
     * Check if user has role
     * @param {string|Array} requiredRole 
     * @returns {boolean}
     */
    hasRole: function (requiredRole) {
        const user = window.state?.currentUser;

        if (!user) {
            Logger.warn('Role check failed: No user logged in');
            return false;
        }

        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        return roles.includes(user.role);
    },

    /**
     * Require authentication for operation
     */
    requireAuth: function (callback, requiredPermission = null) {
        if (!window.state?.currentUser) {
            window.showNotification('Please log in to continue', 'warning');
            this.showLoginScreen();
            return false;
        }

        if (requiredPermission && !this.hasPermission(requiredPermission)) {
            window.showNotification('You do not have permission to perform this action', 'error');
            Logger.warn('Permission denied:', requiredPermission);
            return false;
        }

        if (typeof callback === 'function') {
            return callback();
        }

        return true;
    },

    /**
     * Generate simple token (for demo - use JWT in production)
     */
    generateToken: function () {
        return 'demo_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
    },

    /**
     * Save session to storage
     */
    saveSession: function (session) {
        try {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        } catch (error) {
            Logger.error('Failed to save session:', error);
        }
    },

    /**
     * Get session from storage
     */
    getSession: function () {
        try {
            const sessionData = sessionStorage.getItem(this.SESSION_KEY);
            return sessionData ? JSON.parse(sessionData) : null;
        } catch (error) {
            Logger.error('Failed to get session:', error);
            return null;
        }
    },

    /**
     * Clear session
     */
    clearSession: function () {
        sessionStorage.removeItem(this.SESSION_KEY);
    },

    /**
     * Check if session is valid
     */
    isSessionValid: function (session) {
        if (!session || !session.expiresAt) {
            return false;
        }

        if (Date.now() > session.expiresAt) {
            Logger.info('Session expired');
            return false;
        }

        return true;
    },

    /**
     * Restore session
     */
    restoreSession: function (session) {
        window.state.currentUser = session.user;
    },

    /**
     * Setup session monitoring
     */
    setupSessionMonitor: function () {
        // Check session every minute
        setInterval(() => {
            const session = this.getSession();
            if (session && !this.isSessionValid(session)) {
                Logger.warn('Session expired, logging out');
                window.showNotification('Your session has expired. Please log in again.', 'warning');
                this.logout();
            }
        }, 60000); // Check every minute

        // Extend session on user activity
        ['click', 'keypress', 'scroll'].forEach(event => {
            document.addEventListener(event, () => {
                this.extendSession();
            }, { passive: true, once: false });
        });
    },

    /**
     * Extend session timeout
     */
    extendSession: function () {
        const session = this.getSession();
        if (session && this.isSessionValid(session)) {
            session.expiresAt = Date.now() + this.SESSION_TIMEOUT;
            this.saveSession(session);
        }
    },

    /**
     * Show login screen
     */
    showLoginScreen: function () {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <div style="max-width: 400px; margin: 100px auto; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <i class="fa-solid fa-certificate" style="font-size: 3rem; color: var(--primary-color);"></i>
                    <h2 style="margin-top: 1rem;">AuditCB360</h2>
                    <p style="color: var(--text-secondary);">Please log in to continue</p>
                </div>

                <form id="login-form" onsubmit="return AuthManager.handleLogin(event)">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="login-username" class="form-control" required autofocus>
                    </div>

                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="login-password" class="form-control" required>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        <i class="fa-solid fa-sign-in-alt"></i> Log In
                    </button>
                </form>

                <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 4px; font-size: 0.85rem;">
                    <strong>Demo Accounts:</strong><br>
                    <code>admin / admin123</code> - Full access<br>
                    <code>manager / manager123</code> - Certification Manager<br>
                    <code>auditor / auditor123</code> - Lead Auditor<br>
                    <code>viewer / viewer123</code> - View only
                </div>
            </div>
        `;
    },

    /**
     * Handle login form submission
     */
    handleLogin: async function (event) {
        event.preventDefault();

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const user = await this.login(username, password);

        if (user) {
            // Redirect to dashboard
            window.location.hash = 'dashboard';
            window.renderModule('dashboard');
        }

        return false;
    },

    /**
     * Get current user
     */
    getCurrentUser: function () {
        return window.state?.currentUser || null;
    },

    /**
     * Check if user is logged in
     */
    isLoggedIn: function () {
        return !!window.state?.currentUser;
    }
};

// Export to window
window.AuthManager = AuthManager;

// Auto-initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AuthManager.init());
} else {
    AuthManager.init();
}

Logger.info('AuthManager module loaded');
