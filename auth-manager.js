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

            // PERF: Clear session monitor interval to prevent memory leaks
            if (this._sessionMonitorId) {
                clearInterval(this._sessionMonitorId);
                this._sessionMonitorId = null;
            }

            // Also clear audit logger interval if it exists
            if (window.AuditLogger?._cleanupIntervalId) {
                clearInterval(window.AuditLogger._cleanupIntervalId);
                window.AuditLogger._cleanupIntervalId = null;
            }

            // Clear dashboard stats cache
            window._dashboardStatsCache = null;

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
        const userRole = (user.role || '').toLowerCase();
        if (userRole === 'admin' || user.permissions?.includes('all')) {
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
        const userRole = (user.role || '').toLowerCase();
        if (userRole === 'admin') return true;

        // Role-based permission matrix (keys normalized to lowercase)
        const matrix = {
            'certification manager': {
                client: ['view', 'create', 'edit', 'delete'],
                audit: ['view', 'create', 'edit', 'finalize'],
                report: ['view', 'create', 'edit', 'finalize', 'download'],
                user: ['view'],
                auditor: ['view', 'assign']
            },
            'lead auditor': {
                client: ['view'],
                audit: ['view', 'edit'],
                report: ['view', 'create', 'edit'],
                user: [],
                auditor: ['view']
            },
            'auditor': {
                client: ['view'],
                audit: ['view'],
                report: ['view'],
                user: [],
                auditor: []
            },
            'technical expert': {
                client: ['view'],
                audit: ['view'],
                report: ['view'],
                user: [],
                auditor: []
            }
        };

        const rolePerms = matrix[userRole];
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

        const userRole = (user.role || '').toLowerCase();
        const roles = Array.isArray(requiredRole)
            ? requiredRole.map(r => r.toLowerCase())
            : [requiredRole.toLowerCase()];
        return roles.includes(userRole);
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
        // PERF: Store interval ID so it can be cleared on logout
        this._sessionMonitorId = setInterval(() => {
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
        // Hide sidebar and header for full-screen login experience
        const sidebar = document.getElementById('sidebar');
        const header = document.querySelector('.main-header');
        const clientSidebar = document.getElementById('client-sidebar');
        if (sidebar) sidebar.style.display = 'none';
        if (header) header.style.display = 'none';
        if (clientSidebar) clientSidebar.style.display = 'none';

        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        // Get CB settings for branding
        const cbName = window.state?.cbSettings?.cbName || 'AuditCB360';
        const cbLogo = window.state?.cbSettings?.cbLogo || '';

        contentArea.style.padding = '0';
        contentArea.style.overflow = 'hidden';

        contentArea.innerHTML = `
            <style>
                .hero-login-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    min-height: 100vh;
                    width: 100%;
                    font-family: 'Inter', 'Segoe UI', sans-serif;
                }
                .hero-left {
                    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #0d9488 100%);
                    color: white;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: 4rem 3.5rem;
                    position: relative;
                    overflow: hidden;
                }
                .hero-left::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle at 30% 70%, rgba(13,148,136,0.15) 0%, transparent 50%),
                                radial-gradient(circle at 70% 30%, rgba(59,130,246,0.1) 0%, transparent 50%);
                    animation: heroGlow 8s ease-in-out infinite alternate;
                }
                @keyframes heroGlow {
                    0% { transform: translate(0, 0); }
                    100% { transform: translate(-5%, 5%); }
                }
                .hero-left > * { position: relative; z-index: 2; }
                .hero-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    padding: 0.4rem 1rem;
                    border-radius: 999px;
                    font-size: 0.8rem;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    margin-bottom: 2rem;
                    backdrop-filter: blur(8px);
                    width: fit-content;
                }
                .hero-title {
                    font-size: 2.8rem;
                    font-weight: 800;
                    line-height: 1.15;
                    margin: 0 0 1.25rem 0;
                    letter-spacing: -0.5px;
                }
                .hero-title span {
                    background: linear-gradient(135deg, #5eead4, #38bdf8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .hero-subtitle {
                    font-size: 1.1rem;
                    color: rgba(255,255,255,0.7);
                    line-height: 1.6;
                    margin: 0 0 2.5rem 0;
                    max-width: 480px;
                }
                .hero-features {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.25rem;
                    margin-bottom: 3rem;
                }
                .hero-feature {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    padding: 1rem;
                    background: rgba(255,255,255,0.05);
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.08);
                    transition: background 0.3s, border-color 0.3s;
                }
                .hero-feature:hover {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(255,255,255,0.2);
                }
                .hero-feature-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    font-size: 1rem;
                }
                .hero-feature h4 {
                    margin: 0 0 0.25rem 0;
                    font-size: 0.9rem;
                    font-weight: 600;
                }
                .hero-feature p {
                    margin: 0;
                    font-size: 0.78rem;
                    color: rgba(255,255,255,0.55);
                    line-height: 1.4;
                }
                .hero-trust {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    padding-top: 2rem;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .hero-trust-item {
                    text-align: center;
                }
                .hero-trust-item .num {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #5eead4;
                }
                .hero-trust-item .lbl {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: rgba(255,255,255,0.5);
                    margin-top: 0.15rem;
                }
                .hero-right {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 3rem;
                    background: #f8fafc;
                    position: relative;
                }
                .login-card {
                    width: 100%;
                    max-width: 420px;
                    background: white;
                    border-radius: 16px;
                    padding: 2.5rem;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
                    border: 1px solid #e2e8f0;
                }
                .login-card .logo-area {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .login-card .logo-area img {
                    max-height: 56px;
                    margin-bottom: 0.75rem;
                }
                .login-card .logo-area .fallback-icon {
                    width: 60px;
                    height: 60px;
                    border-radius: 14px;
                    background: linear-gradient(135deg, #0d9488, #0ea5e9);
                    color: white;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.6rem;
                    margin-bottom: 0.75rem;
                }
                .login-card .logo-area h2 {
                    margin: 0;
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #0f172a;
                }
                .login-card .logo-area p {
                    margin: 0.35rem 0 0;
                    font-size: 0.85rem;
                    color: #64748b;
                }
                .login-card .form-group {
                    margin-bottom: 1.25rem;
                }
                .login-card .form-group label {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #334155;
                    margin-bottom: 0.4rem;
                }
                .login-card .form-group input {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 0.95rem;
                    background: #f8fafc;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    outline: none;
                    box-sizing: border-box;
                }
                .login-card .form-group input:focus {
                    border-color: #0d9488;
                    box-shadow: 0 0 0 3px rgba(13,148,136,0.1);
                    background: white;
                }
                .login-card .login-btn {
                    width: 100%;
                    padding: 0.85rem;
                    border: none;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #0d9488, #0ea5e9);
                    color: white;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.15s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }
                .login-card .login-btn:hover {
                    opacity: 0.92;
                    transform: translateY(-1px);
                }
                .login-card .login-btn:active {
                    transform: translateY(0);
                }
                .login-info {
                    margin-top: 1.5rem;
                    padding: 0.85rem 1rem;
                    background: #f0fdf4;
                    border-radius: 10px;
                    border: 1px solid #bbf7d0;
                    font-size: 0.82rem;
                    color: #166534;
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                    line-height: 1.5;
                }
                .hero-footer {
                    margin-top: 2rem;
                    text-align: center;
                    font-size: 0.78rem;
                    color: #94a3b8;
                }
                @media (max-width: 900px) {
                    .hero-login-container {
                        grid-template-columns: 1fr;
                    }
                    .hero-left {
                        padding: 2rem 1.5rem;
                        min-height: auto;
                    }
                    .hero-title { font-size: 1.8rem; }
                    .hero-features { grid-template-columns: 1fr; }
                    .hero-trust { flex-wrap: wrap; gap: 1rem; }
                    .hero-right { padding: 2rem 1.5rem; }
                    .login-card { padding: 1.5rem; }
                }
            </style>

            <div class="hero-login-container">
                <!-- LEFT: Product Hero -->
                <div class="hero-left">
                    <div class="hero-badge">
                        <i class="fa-solid fa-shield-check"></i>
                        ISO/IEC 17021-1 Compliant Platform
                    </div>

                    <h1 class="hero-title">
                        Manage Your<br>
                        <span>Certification Body</span><br>
                        Operations
                    </h1>

                    <p class="hero-subtitle">
                        The all-in-one platform for audit management, client certification, NCR tracking, 
                        and compliance — purpose-built for accredited Certification Bodies.
                    </p>

                    <div class="hero-features">
                        <div class="hero-feature">
                            <div class="hero-feature-icon" style="background: rgba(16,185,129,0.15); color: #34d399;">
                                <i class="fa-solid fa-list-check"></i>
                            </div>
                            <div>
                                <h4>Smart Checklists</h4>
                                <p>Auto-generated checklists from your Knowledge Base for any ISO standard</p>
                            </div>
                        </div>
                        <div class="hero-feature">
                            <div class="hero-feature-icon" style="background: rgba(59,130,246,0.15); color: #60a5fa;">
                                <i class="fa-solid fa-brain"></i>
                            </div>
                            <div>
                                <h4>AI-Powered</h4>
                                <p>AI audit scoping, risk analysis, and intelligent report generation</p>
                            </div>
                        </div>
                        <div class="hero-feature">
                            <div class="hero-feature-icon" style="background: rgba(168,85,247,0.15); color: #a78bfa;">
                                <i class="fa-solid fa-users-gear"></i>
                            </div>
                            <div>
                                <h4>Full Audit Lifecycle</h4>
                                <p>Planning, execution, reporting, NCRs, and certification decisions</p>
                            </div>
                        </div>
                        <div class="hero-feature">
                            <div class="hero-feature-icon" style="background: rgba(251,146,60,0.15); color: #fb923c;">
                                <i class="fa-solid fa-layer-group"></i>
                            </div>
                            <div>
                                <h4>Multi-Standard</h4>
                                <p>ISO 9001, 14001, 45001, 22000, 27001 and more — all in one place</p>
                            </div>
                        </div>
                    </div>

                    <div class="hero-trust">
                        <div class="hero-trust-item">
                            <div class="num">100%</div>
                            <div class="lbl">Cloud Based</div>
                        </div>
                        <div style="width: 1px; height: 36px; background: rgba(255,255,255,0.15);"></div>
                        <div class="hero-trust-item">
                            <div class="num">17021</div>
                            <div class="lbl">Compliant</div>
                        </div>
                        <div style="width: 1px; height: 36px; background: rgba(255,255,255,0.15);"></div>
                        <div class="hero-trust-item">
                            <div class="num">24/7</div>
                            <div class="lbl">Access</div>
                        </div>
                        <div style="width: 1px; height: 36px; background: rgba(255,255,255,0.15);"></div>
                        <div class="hero-trust-item">
                            <div class="num">AI</div>
                            <div class="lbl">Integrated</div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT: Login Form -->
                <div class="hero-right">
                    <div class="login-card">
                        <div class="logo-area">
                            ${cbLogo
                ? '<img src="' + cbLogo + '" alt="Logo">'
                : '<div class="fallback-icon"><i class="fa-solid fa-certificate"></i></div>'
            }
                            <h2>${window.UTILS?.escapeHtml?.(cbName) || cbName}</h2>
                            <p>Sign in to your account</p>
                        </div>

                        <form id="login-form" onsubmit="return AuthManager.handleLogin(event)">
                            <div class="form-group">
                                <label><i class="fa-solid fa-envelope" style="margin-right: 0.35rem; color: #64748b;"></i>Email</label>
                                <input type="text" id="login-username" placeholder="you@company.com" required autofocus>
                            </div>

                            <div class="form-group">
                                <label><i class="fa-solid fa-lock" style="margin-right: 0.35rem; color: #64748b;"></i>Password</label>
                                <input type="password" id="login-password" placeholder="Enter your password" required>
                            </div>

                            <button type="submit" class="login-btn">
                                <i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In
                            </button>
                        </form>

                        <div class="login-info">
                            <i class="fa-solid fa-info-circle" style="margin-top: 2px; flex-shrink: 0;"></i>
                            <div>
                                Use your registered email and password.<br>
                                <span style="color: #22c55e;">Contact your administrator if you need access.</span>
                            </div>
                        </div>
                    </div>

                    <div class="hero-footer">
                        &copy; ${new Date().getFullYear()} ${window.UTILS?.escapeHtml?.(cbName) || cbName} &bull; Powered by AuditCB360
                    </div>
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
            // Remove login overlay — handleSignIn (in supabase-client.js)
            // will show app chrome and navigate AFTER cloud data loads.
            const loginOverlay = document.getElementById('login-overlay');
            if (loginOverlay) loginOverlay.remove();

            // Clear any stale content so nothing flashes before dashboard renders
            const contentArea = document.getElementById('content-area');
            if (contentArea) contentArea.innerHTML = '<div style="text-align:center;padding:3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;color:var(--primary-color);"></i><p style="margin-top:1rem;color:#64748b;">Loading your workspace...</p></div>';
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
