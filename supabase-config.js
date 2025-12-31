// ============================================
// SUPABASE CONFIGURATION MODULE
// ============================================
// Centralized Supabase configuration management

const SupabaseConfig = {

    /**
     * Get Supabase URL
     */
    getUrl: function () {
        // Try window environment (set by build process or manually)
        if (window.__SUPABASE_URL__) {
            return window.__SUPABASE_URL__;
        }

        // Try localStorage (manual configuration)
        const stored = localStorage.getItem('supabase_url');
        if (stored) {
            return stored;
        }

        // Try state settings
        if (window.state?.settings?.supabaseUrl) {
            return window.state.settings.supabaseUrl;
        }

        return null;
    },

    /**
     * Get Supabase anon key
     */
    getAnonKey: function () {

        // Try window environment (set by build process)
        if (window.__SUPABASE_ANON_KEY__) {
            return window.__SUPABASE_ANON_KEY__;
        }

        // Try localStorage (manual configuration)
        const stored = localStorage.getItem('supabase_anon_key');
        if (stored) {
            return stored;
        }

        // Try state settings
        if (window.state?.settings?.supabaseAnonKey) {
            return window.state.settings.supabaseAnonKey;
        }

        return null;
    },

    /**
     * Check if Supabase is configured
     */
    isConfigured: function () {
        const url = this.getUrl();
        const key = this.getAnonKey();
        return !!(url && key);
    },

    /**
     * Save configuration to localStorage
     */
    saveConfig: function (url, anonKey) {
        try {
            if (url) {
                localStorage.setItem('supabase_url', url);
            }
            if (anonKey) {
                localStorage.setItem('supabase_anon_key', anonKey);
            }

            // Also save to state settings
            if (!window.state.settings) {
                window.state.settings = {};
            }
            window.state.settings.supabaseUrl = url;
            window.state.settings.supabaseAnonKey = anonKey;

            if (window.saveData) {
                window.saveData();
            }

            Logger.info('Supabase configuration saved');
            return true;
        } catch (error) {
            Logger.error('Failed to save Supabase configuration:', error);
            return false;
        }
    },

    /**
     * Clear configuration
     */
    clearConfig: function () {
        try {
            localStorage.removeItem('supabase_url');
            localStorage.removeItem('supabase_anon_key');

            if (window.state?.settings) {
                delete window.state.settings.supabaseUrl;
                delete window.state.settings.supabaseAnonKey;
            }

            if (window.saveData) {
                window.saveData();
            }

            Logger.info('Supabase configuration cleared');
            return true;
        } catch (error) {
            Logger.error('Failed to clear Supabase configuration:', error);
            return false;
        }
    },

    /**
     * Test connection to Supabase
     */
    testConnection: async function () {
        const url = this.getUrl();
        const key = this.getAnonKey();

        if (!url || !key) {
            return {
                success: false,
                error: 'Supabase URL and anon key are required'
            };
        }

        try {
            // Try to create a client and test connection
            const { createClient } = supabase;
            const client = createClient(url, key);

            // Test by getting session (doesn't require auth)
            const { data, error } = await client.auth.getSession();

            if (error && error.message.includes('Invalid')) {
                return {
                    success: false,
                    error: 'Invalid Supabase credentials'
                };
            }

            return {
                success: true,
                message: 'Successfully connected to Supabase'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to connect to Supabase'
            };
        }
    },

    /**
     * Get configuration status
     */
    getStatus: function () {
        const url = this.getUrl();
        const key = this.getAnonKey();

        return {
            configured: this.isConfigured(),
            url: url ? this.maskUrl(url) : null,
            keyConfigured: !!key,
            source: this.getConfigSource()
        };
    },

    /**
     * Mask URL for display
     */
    maskUrl: function (url) {
        if (!url) return null;
        try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.hostname}`;
        } catch {
            return url.substring(0, 20) + '...';
        }
    },

    /**
     * Get configuration source
     */
    getConfigSource: function () {
        if (window.__SUPABASE_URL__) {
            return 'Build Environment';
        }
        if (localStorage.getItem('supabase_url')) {
            return 'localStorage (Manual)';
        }
        if (window.state?.settings?.supabaseUrl) {
            return 'Settings';
        }
        return 'Not Configured';
    },

    /**
     * Show configuration UI
     */
    showConfigUI: function () {
        const status = this.getStatus();

        const html = `
            <div class="supabase-config">
                <h3><i class="fa-solid fa-database"></i> Supabase Configuration</h3>

                <div class="config-status" style="background: ${status.configured ? '#d4edda' : '#f8d7da'}; 
                     padding: 1rem; border-radius: 4px; margin-bottom: 1rem; border: 1px solid ${status.configured ? '#c3e6cb' : '#f5c6cb'};">
                    <strong>Status:</strong> ${status.configured ? '✅ Configured' : '❌ Not Configured'}<br>
                    ${status.url ? `<strong>URL:</strong> ${status.url}<br>` : ''}
                    ${status.keyConfigured ? `<strong>Key:</strong> ✅ Configured<br>` : ''}
                    <strong>Source:</strong> ${status.source}
                </div>

                <form id="supabase-config-form" onsubmit="return SupabaseConfig.handleSave(event)">
                    <div class="form-group">
                        <label>Supabase URL</label>
                        <input type="url" id="supabase-url" class="form-control" 
                               placeholder="https://your-project.supabase.co"
                               value="${status.url || ''}" required>
                        <small>Your Supabase project URL</small>
                    </div>

                    <div class="form-group">
                        <label>Supabase Anon Key</label>
                        <input type="password" id="supabase-anon-key" class="form-control" 
                               placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                               value="${status.keyConfigured ? '••••••••••••••••' : ''}" required>
                        <small>Your Supabase anon/public key</small>
                    </div>

                    <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                        <button type="button" onclick="SupabaseConfig.handleTest()" class="btn btn-secondary">
                            <i class="fa-solid fa-plug"></i> Test Connection
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fa-solid fa-save"></i> Save Configuration
                        </button>
                        ${status.configured ? `
                            <button type="button" onclick="SupabaseConfig.handleClear()" class="btn btn-danger">
                                <i class="fa-solid fa-trash"></i> Clear
                            </button>
                        ` : ''}
                    </div>
                </form>

                <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                    <strong>How to get your credentials:</strong>
                    <ol style="margin: 0.5rem 0 0 1.5rem;">
                        <li>Go to <a href="https://supabase.com/dashboard" target="_blank">Supabase Dashboard</a></li>
                        <li>Select your project</li>
                        <li>Go to Settings → API</li>
                        <li>Copy "Project URL" and "anon public" key</li>
                    </ol>
                </div>
            </div>
        `;

        if (window.openModal) {
            window.openModal('Supabase Configuration', html, null, null);
        } else {
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                SafeDOM.setHTML(contentArea, html);
            }
        }
    },

    /**
     * Handle save from UI
     */
    handleSave: function (event) {
        event.preventDefault();

        const url = document.getElementById('supabase-url').value.trim();
        const key = document.getElementById('supabase-anon-key').value.trim();

        if (!url || !key) {
            window.showNotification('Please provide both URL and anon key', 'error');
            return false;
        }

        // Don't update key if it's the masked value
        const actualKey = key === '••••••••••••••••' ? this.getAnonKey() : key;

        if (this.saveConfig(url, actualKey)) {
            window.showNotification('Supabase configuration saved! Reloading...', 'success');

            // Reload to reinitialize Supabase client
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            window.showNotification('Failed to save configuration', 'error');
        }

        return false;
    },

    /**
     * Handle test connection from UI
     */
    handleTest: async function () {
        const url = document.getElementById('supabase-url').value.trim();
        const key = document.getElementById('supabase-anon-key').value.trim();

        if (!url || !key) {
            window.showNotification('Please provide both URL and anon key', 'error');
            return;
        }

        // Temporarily save for testing
        const actualKey = key === '••••••••••••••••' ? this.getAnonKey() : key;
        this.saveConfig(url, actualKey);

        window.showNotification('Testing connection...', 'info');

        const result = await this.testConnection();

        if (result.success) {
            window.showNotification(result.message, 'success');
        } else {
            window.showNotification('Connection failed: ' + result.error, 'error');
        }
    },

    /**
     * Handle clear from UI
     */
    handleClear: function () {
        if (!confirm('Are you sure you want to clear Supabase configuration? The app will use localStorage instead.')) {
            return;
        }

        if (this.clearConfig()) {
            window.showNotification('Configuration cleared. Reloading...', 'info');
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }
};

// Export to window
window.SupabaseConfig = SupabaseConfig;

Logger.info('SupabaseConfig module loaded');
