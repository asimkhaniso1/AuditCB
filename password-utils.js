// ============================================
// PASSWORD UTILITIES MODULE
// ============================================
// Provides password hashing and validation using Web Crypto API

const PasswordUtils = {
    /**
     * Hash a password using SHA-256
     * @param {string} password - Plain text password
     * @returns {Promise<string>} - Hex string hash
     */
    async hashPassword(password) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (error) {
            console.error('Password hashing failed:', error);
            throw new Error('Failed to hash password');
        }
    },

    /**
     * Verify a password against a hash
     * @param {string} password - Plain text password to verify
     * @param {string} hash - Stored hash to compare against
     * @returns {Promise<boolean>} - True if password matches
     */
    async verifyPassword(password, hash) {
        try {
            const passwordHash = await this.hashPassword(password);
            return passwordHash === hash;
        } catch (error) {
            console.error('Password verification failed:', error);
            return false;
        }
    },

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {object} - Validation result with checks, score, and strength
     */
    validateStrength(password) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };

        const passedChecks = Object.values(checks).filter(Boolean).length;

        let strength = 'Weak';
        let color = '#ef4444'; // red

        if (passedChecks >= 4) {
            strength = 'Strong';
            color = '#10b981'; // green
        } else if (passedChecks >= 3) {
            strength = 'Medium';
            color = '#f59e0b'; // orange
        }

        return {
            checks,
            score: passedChecks,
            strength,
            color,
            isValid: checks.length && passedChecks >= 3 // Minimum: 8 chars + 2 other requirements
        };
    },

    /**
     * Get password requirements as HTML
     * @returns {string} - HTML string with requirements
     */
    getRequirementsHTML() {
        return `
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                <p style="margin: 0 0 0.25rem 0; font-weight: 500;">Password Requirements:</p>
                <ul style="margin: 0; padding-left: 1.5rem;">
                    <li>At least 8 characters</li>
                    <li>At least one uppercase letter</li>
                    <li>At least one lowercase letter</li>
                    <li>At least one number</li>
                    <li>At least one special character</li>
                </ul>
            </div>
        `;
    },

    /**
     * Show password strength indicator
     * @param {string} password - Password to check
     * @param {string} containerId - ID of container to show indicator
     */
    showStrengthIndicator(password, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!password) {
            container.innerHTML = '';
            return;
        }

        const result = this.validateStrength(password);

        container.innerHTML = `
            <div style="margin-top: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                    <div style="flex: 1; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden;">
                        <div style="height: 100%; width: ${(result.score / 5) * 100}%; background: ${result.color}; transition: all 0.3s;"></div>
                    </div>
                    <span style="font-size: 0.85rem; font-weight: 500; color: ${result.color};">${result.strength}</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">
                    ${result.checks.length ? '✓' : '✗'} 8+ characters
                    ${result.checks.uppercase ? '✓' : '✗'} Uppercase
                    ${result.checks.lowercase ? '✓' : '✗'} Lowercase
                    ${result.checks.number ? '✓' : '✗'} Number
                    ${result.checks.special ? '✓' : '✗'} Special char
                </div>
            </div>
        `;
    }
};

// Export to window
window.PasswordUtils = PasswordUtils;

console.log('PasswordUtils module loaded');
