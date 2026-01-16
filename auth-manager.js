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
        // Demo users removed - use Supabase authentication
        // If you reach this code, Supabase is not configured
        Logger.warn('Demo authentication disabled - please configure Supabase');
        window.showNotification('Please configure Supabase for authentication or contact admin', 'error');
        return null;
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
     * Granular permission check: action on resource
     * @param {string} action - e.g., 'delete', 'create', 'edit', 'view', 'finalize'
     * @param {string} resource - e.g., 'user', 'client', 'report', 'audit'
     * @returns {boolean}
     */
    canPerform: function (action, resource) {
        const user = window.state?.currentUser;
        if (!user) return false;

        // Admin bypass
        if (user.role === 'Admin') return true;

        // Role-based permission matrix
        const matrix = {
            'Certification Manager': {
                client: ['view', 'create', 'edit', 'delete'],
                audit: ['view', 'create', 'edit', 'finalize'],
                report: ['view', 'create', 'edit', 'finalize', 'download'],
                user: ['view'],
                auditor: ['view', 'assign']
            },
            'Lead Auditor': {
                client: ['view'],
                audit: ['view', 'edit'],
                report: ['view', 'create', 'edit'],
                user: [],
                auditor: ['view']
            },
            'Auditor': {
                client: ['view'],
                audit: ['view'],
                report: ['view'],
                user: [],
                auditor: []
            },
            'Technical Expert': {
                client: ['view'],
                audit: ['view'],
                report: ['view'],
                user: [],
                auditor: []
            }
        };

        const rolePerms = matrix[user.role];
        if (!rolePerms) return false;

        const resourcePerms = rolePerms[resource];
        if (!resourcePerms) return false;

        return resourcePerms.includes(action);
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
            if (!session) return;

            const timeLeft = session.expiresAt - Date.now();

            // Session expired
            if (timeLeft <= 0) {
                Logger.warn('Session expired, logging out');
                window.showNotification('Your session has expired. Please log in again.', 'warning');
                this.logout();
                return;
            }

            // Warning: 5 minutes before expiry
            const FIVE_MINUTES = 5 * 60 * 1000;
            if (timeLeft <= FIVE_MINUTES && !window._sessionWarningShown) {
                window._sessionWarningShown = true;
                this.showSessionWarning(Math.ceil(timeLeft / 60000));
            }
        }, 60000); // Check every minute

        // Extend session on user activity
        ['click', 'keypress', 'scroll'].forEach(event => {
            document.addEventListener(event, () => {
                this.extendSession();
                window._sessionWarningShown = false; // Reset warning flag on activity
            }, { passive: true, once: false });
        });
    },

    /**
     * Show session timeout warning modal
     */
    showSessionWarning: function (minutesLeft) {
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        if (!modalTitle || !modalBody) return;

        modalTitle.textContent = 'Session Expiring Soon';
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 1rem;">
                <i class="fa-solid fa-clock" style="font-size: 3rem; color: #f59e0b; margin-bottom: 1rem;"></i>
                <h4 style="margin-bottom: 0.5rem;">Your session will expire in ~${minutesLeft} minute(s)</h4>
                <p style="color: var(--text-secondary);">
                    Click "Stay Logged In" to extend your session, or you will be automatically logged out.
                </p>
            </div>
        `;

        modalSave.textContent = 'Stay Logged In';
        modalSave.style.display = 'inline-block';
        modalSave.onclick = () => {
            this.extendSession();
            window._sessionWarningShown = false;
            window.closeModal();
            window.showNotification('Session extended successfully', 'success');
        };

        window.openModal();
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

                <div style="margin-top: 2rem; padding: 1rem; background: #eff6ff; border-radius: 4px; font-size: 0.85rem; border: 1px solid #bfdbfe;">
                    <i class="fa-solid fa-info-circle" style="color: #3b82f6; margin-right: 0.5rem;"></i>
                    <strong>Login:</strong> Use your registered email and password.<br>
                    <span style="color: #64748b;">Contact admin if you need an account.</span>
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
