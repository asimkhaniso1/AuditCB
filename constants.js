// ============================================
// CONSTANTS MODULE (ESM-ready)
// ============================================
// Structured as a standalone const + window export.
// Ready for ES module migration — add `export default CONSTANTS`
// once all script tags are converted to type="module".

const CONSTANTS = {
    STATUS: {
        DRAFT: 'Draft',
        IN_PROGRESS: 'In Progress',
        IN_REVIEW: 'In Review',
        APPROVED: 'Approved',
        PUBLISHED: 'Published',
        FINALIZED: 'Finalized',
        OPEN: 'Open',
        CLOSED: 'Closed',
        COMPLETED: 'Completed',
        FAIL: 'Fail',
        PASS: 'Pass',
        CONFORM: 'conform',
        NC: 'nc',
        NA: 'na'
    },
    CERT_STATUS: {
        VALID: 'Valid',
        SUSPENDED: 'Suspended',
        WITHDRAWN: 'Withdrawn'
    },
    NCR_TYPES: {
        MAJOR: 'major',
        MINOR: 'minor',
        OBSERVATION: 'observation',
        OFI: 'ofi',
        PENDING: 'pending_classification'
    },
    // ISO 17021-1:2015 Classification Matrix
    NCR_CRITERIA: {
        MAJOR: {
            description: "Non-conformity that affects the capability of the management system to achieve the intended results.",
            triggers: [
                "Total breakdown of a system or process",
                "Absence of a required procedure/process",
                "Failure to address a statutory/regulatory requirement",
                "Significant number of minor NCs in one area (Systemic failure)"
            ]
        },
        MINOR: {
            description: "Non-conformity that does not affect the capability of the management system to achieve the intended results.",
            triggers: [
                "Single/isolated lapse in following a procedure",
                "Documentation error not affecting outcome",
                "Process is generally effective but had a specific deviation"
            ]
        }
    },
    ROLES: {
        LEAD_AUDITOR: 'Lead Auditor',
        AUDITOR: 'Auditor',
        TECHNICAL_EXPERT: 'Technical Expert',
        CERTIFICATION_MANAGER: 'Certification Manager'
    },
    RECOMMENDATIONS: {
        RECOMMEND: 'Recommend Certification',
        CONDITIONAL: 'Conditional Certification (pending closure of NCs)',
        DO_NOT_RECOMMEND: 'Do Not Recommend'
    },
    AUDIT_TYPES: [
        'Stage 1 (Documentation Review)',
        'Stage 2 (Implementation Audit)',
        'Surveillance',
        'Recertification',
        'Special/Follow-up',
        'Transfer'
    ],
    AUDIT_SCOPES: [
        'Full System',
        'Process-specific',
        'Department-specific',
        'Site-specific',
        'Multi-site'
    ],
    COLORS: {
        PRIMARY: 'var(--primary-color)',
        SECONDARY: 'var(--secondary-color)',
        SUCCESS: 'var(--success-color)',
        DANGER: 'var(--danger-color)',
        WARNING: 'var(--warning-color)',
        INFO: 'var(--info-color)',
        // Semantic hex colors (Slate palette)
        TEXT_PRIMARY: '#1e293b',
        TEXT_SECONDARY: '#475569',
        TEXT_MUTED: '#64748b',
        BORDER: '#e2e8f0',
        BG_SURFACE: '#f8fafc',
        BG_MUTED: '#f1f5f9',
        // NCR severity colors
        MAJOR: '#dc2626',
        MINOR: '#d97706',
        OBSERVATION: '#8b5cf6',
        OFI: '#06b6d4',
        CONFORM: '#10b981',
        ACCENT: '#3b82f6'
    },
    NCR_COLORS: {
        major: '#dc2626',
        minor: '#d97706',
        observation: '#8b5cf6',
        ofi: '#06b6d4',
        pending_classification: '#94a3b8'
    },
    Z_INDEX: {
        DROPDOWN: 100,
        MODAL: 9999,
        MODAL_OVERLAY: 9998,
        TOAST: 10000,
        TOOLTIP: 10001
    }
};

// Window export (used by all existing code)
window.CONSTANTS = CONSTANTS;

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONSTANTS;
}
