// ============================================
// PASSWORD UTILITIES MODULE (ESM-ready)
// ============================================
// Provides password hashing and validation using Web Crypto API

const PasswordUtils = {
    // PBKDF2 configuration
    ITERATIONS: 100000,
    KEY_LENGTH: 256, // bits
    SALT_LENGTH: 16, // bytes

    /** @deprecated Client-side password hashing is deprecated. Use Supabase Auth for production authentication. */
    isDeprecated: true,

    /**
     * Hash a password using PBKDF2 with a random salt
     * @param {string} password - Plain text password
     * @param {Uint8Array} [existingSalt] - Optional existing salt (for verification)
     * @returns {Promise<{hash: string, salt: string}>} - Hex strings for hash and salt
     */
    async hashPassword(password, existingSalt = null) {
        if (window.Logger) Logger.warn('PasswordUtils.hashPassword() is deprecated — use Supabase Auth for production.');
        try {
            const encoder = new TextEncoder();
            const salt = existingSalt || crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));

            // Import password as a CryptoKey
            const keyMaterial = await crypto.subtle.importKey(
                'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
            );

            // Derive bits using PBKDF2
            const derivedBits = await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt, iterations: this.ITERATIONS, hash: 'SHA-256' },
                keyMaterial,
                this.KEY_LENGTH
            );

            const hashHex = Array.from(new Uint8Array(derivedBits))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            const saltHex = Array.from(salt)
                .map(b => b.toString(16).padStart(2, '0')).join('');

            // Return combined format: salt:hash
            return saltHex + ':' + hashHex;
        } catch (error) {
            Logger.error('Password hashing failed:', error);
            throw new Error('Failed to hash password');
        }
    },

    /**
     * @deprecated Use Supabase Auth for production. Retained for offline/demo only.
     * Verify a password against a stored hash
     */
    async verifyPassword(password, storedHash) {
        if (window.Logger) Logger.warn('PasswordUtils.verifyPassword() is deprecated — use Supabase Auth for production.');
        try {
            if (storedHash.includes(':')) {
                // New PBKDF2 format: salt_hex:hash_hex
                const [saltHex, expectedHash] = storedHash.split(':');
                const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
                const result = await this.hashPassword(password, salt);
                const [, computedHash] = result.split(':');
                return computedHash === expectedHash;
            } else {
                // Legacy SHA-256 format (backward compatibility)
                const encoder = new TextEncoder();
                const data = encoder.encode(password);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashHex = Array.from(new Uint8Array(hashBuffer))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
                return hashHex === storedHash;
            }
        } catch (error) {
            Logger.error('Password verification failed:', error);
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
     * Generate a cryptographically secure random password
     * @param {number} length - Password length (default 16)
     * @returns {string} - Random password meeting all strength requirements
     */
    generateSecurePassword(length = 16) {
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const digits = '0123456789';
        const special = '!@#$%&*_+-=?';
        const all = upper + lower + digits + special;

        // Use crypto API for secure randomness
        const randomValues = new Uint32Array(length);
        crypto.getRandomValues(randomValues);

        // Guarantee at least one of each category
        const password = [
            upper[randomValues[0] % upper.length],
            lower[randomValues[1] % lower.length],
            digits[randomValues[2] % digits.length],
            special[randomValues[3] % special.length]
        ];

        // Fill remaining with random chars from full set
        for (let i = 4; i < length; i++) {
            password.push(all[randomValues[i] % all.length]);
        }

        // Shuffle using Fisher-Yates with secure random
        const shuffleValues = new Uint32Array(password.length);
        crypto.getRandomValues(shuffleValues);
        for (let i = password.length - 1; i > 0; i--) {
            const j = shuffleValues[i] % (i + 1);
            [password[i], password[j]] = [password[j], password[i]];
        }

        return password.join('');
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

// Window export (used by all existing code)
window.PasswordUtils = PasswordUtils;

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PasswordUtils;
}
