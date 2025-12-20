window.CONSTANTS = {
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
        TECHNICAL_EXPERT: 'Technical Expert'
    },
    RECOMMENDATIONS: {
        RECOMMEND: 'Recommend Certification',
        CONDITIONAL: 'Conditional Certification (pending closure of NCs)',
        DO_NOT_RECOMMEND: 'Do Not Recommend'
    },
    COLORS: {
        PRIMARY: 'var(--primary-color)',
        SECONDARY: 'var(--secondary-color)',
        SUCCESS: 'var(--success-color)',
        DANGER: 'var(--danger-color)',
        WARNING: 'var(--warning-color)',
        INFO: 'var(--info-color)'
    }
};
