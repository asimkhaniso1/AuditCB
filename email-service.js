// ============================================
// EMAIL SERVICE - Client-Side Wrapper
// ============================================
// Provides a simple interface for sending emails via Supabase Edge Function

window.EmailService = {
    /**
     * Send user invitation email
     */
    sendUserInvitation: async function (email, fullName, role, confirmationUrl) {
        try {
            if (!window.SupabaseClient?.isInitialized) {
                Logger.warn('Supabase not initialized, cannot send email');
                return { success: false, error: 'Supabase not configured' };
            }

            const { data, error } = await window.SupabaseClient.client.functions.invoke('send-email', {
                body: {
                    type: 'user_invitation',
                    to: email,
                    data: {
                        full_name: fullName,
                        role: role,
                        confirmation_url: confirmationUrl,
                        organization: window.state.settings?.cbName || 'Company Certification',
                        user_id: window.state.currentUser?.id
                    }
                }
            });

            if (error) throw error;

            Logger.info('User invitation email sent:', email);
            return { ...data, success: true };

        } catch (error) {
            Logger.error('Failed to send invitation email:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Send audit assignment notification
     */
    sendAuditAssignment: async function (auditorEmail, auditorName, clientName, auditDetails) {
        try {
            if (!window.SupabaseClient?.isInitialized) {
                Logger.warn('Supabase not initialized, cannot send email');
                return { success: false, error: 'Supabase not configured' };
            }

            const { data, error } = await window.SupabaseClient.client.functions.invoke('send-email', {
                body: {
                    type: 'audit_assignment',
                    to: auditorEmail,
                    data: {
                        auditor_name: auditorName,
                        client_name: clientName,
                        standard: auditDetails.standard,
                        scheduled_date: auditDetails.scheduledDate,
                        role: auditDetails.role || 'Auditor',
                        audit_url: `${window.location.origin}/#audit-execution?id=${auditDetails.auditId}`,
                        user_id: window.state.currentUser?.id
                    }
                }
            });

            if (error) throw error;

            Logger.info('Audit assignment email sent:', auditorEmail);
            return { ...data, success: true };

        } catch (error) {
            Logger.error('Failed to send audit assignment email:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Send report approval/rejection notification
     */
    sendReportApproval: async function (auditorEmail, auditorName, clientName, status, comments, reportId) {
        try {
            if (!window.SupabaseClient?.isInitialized) {
                Logger.warn('Supabase not initialized, cannot send email');
                return { success: false, error: 'Supabase not configured' };
            }

            const { data, error } = await window.SupabaseClient.client.functions.invoke('send-email', {
                body: {
                    type: 'report_approval',
                    to: auditorEmail,
                    data: {
                        auditor_name: auditorName,
                        client_name: clientName,
                        status: status, // 'Approved' or 'Rejected'
                        comments: comments,
                        report_url: `${window.location.origin}/#reporting-detail?id=${reportId}`,
                        user_id: window.state.currentUser?.id
                    }
                }
            });

            if (error) throw error;

            Logger.info('Report approval email sent:', auditorEmail);
            return { ...data, success: true };

        } catch (error) {
            Logger.error('Failed to send report approval email:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Send certificate issuance notification
     */
    sendCertificateIssued: async function (clientEmail, clientName, certificateDetails) {
        try {
            if (!window.SupabaseClient?.isInitialized) {
                Logger.warn('Supabase not initialized, cannot send email');
                return { success: false, error: 'Supabase not configured' };
            }

            const { data, error } = await window.SupabaseClient.client.functions.invoke('send-email', {
                body: {
                    type: 'certificate_issued',
                    to: clientEmail,
                    data: {
                        client_name: clientName,
                        certificate_number: certificateDetails.number,
                        issue_date: certificateDetails.issueDate,
                        expiry_date: certificateDetails.expiryDate,
                        standard: certificateDetails.standard,
                        certificate_url: certificateDetails.downloadUrl || `${window.location.origin}/#certificates`,
                        user_id: window.state.currentUser?.id
                    }
                }
            });

            if (error) throw error;

            Logger.info('Certificate issuance email sent:', clientEmail);
            return { ...data, success: true };

        } catch (error) {
            Logger.error('Failed to send certificate email:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Check if email service is available
     */
    isAvailable: function () {
        return window.SupabaseClient?.isInitialized === true;
    }
};

Logger.info('Email Service loaded');
