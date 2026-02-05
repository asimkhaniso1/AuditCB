// ============================================
// API USAGE TRACKER MODULE
// Track Gemini API usage and estimate costs
// ============================================

const APIUsageTracker = {
    // Storage key
    STORAGE_KEY: 'auditcb_api_usage',

    // Gemini 1.5 Flash pricing (per 1M tokens)
    PRICING: {
        input: 0.075,   // $0.075 per 1M input tokens
        output: 0.30    // $0.30 per 1M output tokens
    },

    /**
     * Initialize the tracker
     */
    init() {
        if (!this.getUsageData()) {
            this.resetUsageData();
        }
        Logger.info('[APIUsageTracker] Initialized');
    },

    /**
     * Get usage data from localStorage
     */
    getUsageData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            Logger.error('[APIUsageTracker] Error reading usage data:', error);
            return null;
        }
    },

    /**
     * Save usage data to localStorage
     */
    saveUsageData(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            Logger.error('[APIUsageTracker] Error saving usage data:', error);
        }
    },

    /**
     * Reset usage data
     */
    resetUsageData() {
        const initialData = {
            version: 1,
            createdAt: new Date().toISOString(),
            totalCalls: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalEstimatedCost: 0,
            calls: [],
            byFeature: {}
        };
        this.saveUsageData(initialData);
        return initialData;
    },

    /**
     * Log an API usage event
     * @param {Object} params - Usage parameters
     * @param {string} params.feature - Feature name (e.g., 'agenda-generation', 'ncr-analysis')
     * @param {number} params.inputTokens - Number of input tokens
     * @param {number} params.outputTokens - Number of output tokens
     * @param {boolean} params.success - Whether the call was successful
     */
    logUsage({ feature, inputTokens = 0, outputTokens = 0, success = true, model = 'unknown' }) {
        const data = this.getUsageData() || this.resetUsageData();

        // Calculate cost for this call
        const inputCost = (inputTokens / 1000000) * this.PRICING.input;
        const outputCost = (outputTokens / 1000000) * this.PRICING.output;
        const totalCost = inputCost + outputCost;

        // Create call record
        const callRecord = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            feature,
            inputTokens,
            outputTokens,
            cost: totalCost,
            success
        };

        // Update totals
        data.totalCalls++;
        data.totalInputTokens += inputTokens;
        data.totalOutputTokens += outputTokens;
        data.totalEstimatedCost += totalCost;

        // Update by-feature breakdown
        if (!data.byFeature[feature]) {
            data.byFeature[feature] = {
                calls: 0,
                inputTokens: 0,
                outputTokens: 0,
                cost: 0
            };
        }
        data.byFeature[feature].calls++;
        data.byFeature[feature].inputTokens += inputTokens;
        data.byFeature[feature].outputTokens += outputTokens;
        data.byFeature[feature].cost += totalCost;

        // Store only last 500 calls to prevent excessive storage
        data.calls.push(callRecord);
        if (data.calls.length > 500) {
            data.calls = data.calls.slice(-500);
        }

        this.saveUsageData(data);

        Logger.info(`[APIUsageTracker] Logged: ${feature} - ${inputTokens + outputTokens} tokens, $${totalCost.toFixed(6)}`);

        // SYNC TO SUPABASE (Fire and Forget)
        // SYNC TO SUPABASE (Fire and Forget)
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            const user = window.state?.currentUser;

            // Map to 'audit_log' schema which uses 'details' JSONB column
            const logEntry = {
                timestamp: callRecord.timestamp, // Some setups use 'created_at' but audit_log often has 'timestamp' or relies on default
                action: 'AI_GENERATION',
                entity_type: 'AI_FEATURE',
                entity_id: feature,
                user_email: user ? (user.email || user.username || 'unknown') : 'system',
                details: {
                    input_tokens: inputTokens,
                    output_tokens: outputTokens,
                    cost: totalCost,
                    success: success,
                    model: model,
                    source: 'web_client'
                }
            };

            window.SupabaseClient.client
                .from('audit_log')
                .insert(logEntry)
                .then(({ error }) => {
                    if (error) console.warn('[APIUsageTracker] Failed to push log to Supabase:', error);
                })
                .catch(err => console.error('[APIUsageTracker] Supabase Sync Error:', err));
        }

        return callRecord;
    },

    /**
     * Estimate tokens from text (rough approximation: ~4 chars per token)
     */
    estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    },

    /**
     * Get usage summary
     */
    getSummary() {
        const data = this.getUsageData() || this.resetUsageData();
        return {
            totalCalls: data.totalCalls,
            totalInputTokens: data.totalInputTokens,
            totalOutputTokens: data.totalOutputTokens,
            totalTokens: data.totalInputTokens + data.totalOutputTokens,
            totalEstimatedCost: data.totalEstimatedCost,
            byFeature: data.byFeature,
            createdAt: data.createdAt
        };
    },

    /**
     * Get usage for a specific time period
     * @param {string} period - 'today', 'week', 'month', 'all'
     */
    getUsageByPeriod(period = 'all') {
        const data = this.getUsageData() || this.resetUsageData();
        const now = new Date();
        let startDate;

        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            default:
                return this.getSummary();
        }

        const filteredCalls = data.calls.filter(call =>
            new Date(call.timestamp) >= startDate
        );

        return {
            period,
            calls: filteredCalls.length,
            inputTokens: filteredCalls.reduce((sum, c) => sum + c.inputTokens, 0),
            outputTokens: filteredCalls.reduce((sum, c) => sum + c.outputTokens, 0),
            cost: filteredCalls.reduce((sum, c) => sum + c.cost, 0)
        };
    },

    /**
     * Get daily usage for the last N days
     */
    getDailyUsage(days = 30) {
        const data = this.getUsageData() || this.resetUsageData();
        const dailyUsage = {};
        const now = new Date();

        // Initialize last N days with zero values
        for (let i = 0; i < days; i++) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateKey = date.toISOString().split('T')[0];
            dailyUsage[dateKey] = { calls: 0, tokens: 0, cost: 0 };
        }

        // Fill in actual data
        data.calls.forEach(call => {
            const dateKey = call.timestamp.split('T')[0];
            if (dailyUsage[dateKey]) {
                dailyUsage[dateKey].calls++;
                dailyUsage[dateKey].tokens += call.inputTokens + call.outputTokens;
                dailyUsage[dateKey].cost += call.cost;
            }
        });

        return dailyUsage;
    },

    /**
     * Export usage data as JSON
     */
    exportData() {
        const data = this.getUsageData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api-usage-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (window.showNotification) {
            window.showNotification('Usage data exported successfully', 'success');
        }
    },

    /**
     * Format cost for display
     */
    formatCost(cost) {
        if (cost < 0.01) {
            return `$${cost.toFixed(4)}`;
        }
        return `$${cost.toFixed(2)}`;
    },

    /**
     * Format token count for display
     */
    formatTokens(tokens) {
        if (tokens >= 1000000) {
            return `${(tokens / 1000000).toFixed(2)}M`;
        }
        if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(1)}K`;
        }
        return tokens.toString();
    },

    /**
     * Get feature display name
     */
    getFeatureDisplayName(feature) {
        const names = {
            'agenda-generation': 'Audit Agenda AI',
            'ncr-analysis': 'NCR AI Analysis',
            'capa-suggestions': 'CAPA Suggestions',
            'knowledge-base': 'Knowledge Base AI',
            'report-generation': 'Report Generation',
            'other': 'Other'
        };
        return names[feature] || feature;
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    window.APIUsageTracker = APIUsageTracker;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => APIUsageTracker.init());
    } else {
        APIUsageTracker.init();
    }
}
