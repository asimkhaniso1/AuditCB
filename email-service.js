// ============================================
// EMAIL SERVICE MODULE
// ============================================
// Handles transactional email delivery
// Configuration based on: audit.companycertification.com

const EmailService = {
    // Configuration
    config: {
        domain: 'audit.companycertification.com',
        fromName: 'AuditCB360 System',
        fromEmail: 'notifications@audit.companycertification.com',
        replyTo: 'support@audit.companycertification.com',
        enabled: true, // Set to true to "send" (simulate/log)
        // In production, these would connect to a backend API/SMTP service
        smtpHost: 'mail.audit.companycertification.com',
        smtpPort: 587
    },

    /**
     * Send an email (Simulation/Console Log for now)
     * In production, this would `fetch` to a backend endpoint like /api/send-email
     */
    send: async function (to, subject, htmlContent, templateId = null) {
        if (!this.config.enabled) return;

        Logger.info(`[EmailService] Sending to ${to}...`);

        const emailData = {
            to: to,
            from: `${this.config.fromName} <${this.config.fromEmail}>`,
            subject: subject,
            html: htmlContent,
            templateId: templateId,
            timestamp: new Date().toISOString()
        };

        // Simulate network delay
        await new Promise(r => setTimeout(r, 800));

        // LOGGING (Since we don't have a real backend yet)
        console.groupCollapsed(`📧 EMAIL SENT: ${subject}`);
        console.log(`To: ${to}`);
        console.log(`From: ${emailData.from}`);
        console.log(`Subject: ${subject}`);
        console.log('--- Content ---');
        console.log(htmlContent.replace(/<[^>]*>/g, ' ').substring(0, 100) + '...');
        console.groupEnd();

        Logger.info(`[EmailService] Successfully sent email to ${to}`);

        // Log to Audit Trail
        if (window.AuditTrail) {
            window.AuditTrail.log('email_sent', 'system', {
                recipient: to,
                subject: subject
            });
        }

        return true;
    },

    /**
     * Send User Invite
     */
    sendInvite: async function (user, tempPassword) {
        const loginUrl = `https://${this.config.domain}/#login`;

        const subject = 'Welcome to AuditCB360 - Account Created';
        const html = `
            <h2>Welcome, ${user.name}!</h2>
            <p>An account has been created for you on the AuditCB360 platform.</p>
            <p><strong>Username:</strong> ${user.email}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p>Please log in and change your password immediately.</p>
            <br>
            <a href="${loginUrl}" style="background:#3b82f6;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Login Now</a>
            <br><br>
            <small>If the button doesn't work, copy this link: ${loginUrl}</small>
        `;

        return this.send(user.email, subject, html, 'invite_user');
    },

    /**
     * Send Password Reset
     */
    sendPasswordReset: async function (email, resetToken) {
        // In a real app, resetToken would be part of the URL
        // Here we just simulate sending the temporary code or link
        const resetLink = `https://${this.config.domain}/#reset-password?token=${resetToken}`;

        const subject = 'Password Reset Request';
        const html = `
            <h2>Password Reset</h2>
            <p>We received a request to reset your password.</p>
            <p>Click the link below to verify your email and set a new password:</p>
            <br>
            <a href="${resetLink}" style="background:#ef4444;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a>
            <br><br>
            <small>This link expires in 30 minutes.</small>
        `;

        return this.send(email, subject, html, 'password_reset');
    },

    /**
     * Send Audit Assignment Notification
     */
    sendAssignment: async function (auditorEmail, clientName, auditDate) {
        const subject = `New Audit Assignment: ${clientName}`;
        const html = `
            <h2>New Assignment</h2>
            <p>You have been assigned to an audit.</p>
            <ul>
                <li><strong>Client:</strong> ${clientName}</li>
                <li><strong>Date:</strong> ${auditDate}</li>
            </ul>
            <p>Please log in to review the audit plan.</p>
        `;

        return this.send(auditorEmail, subject, html, 'audit_assigned');
    },

    /**
     * Send Report Published Notification (to Client)
     */
    sendReportPublished: async function (clientEmail, clientName, reportId) {
        const downloadLink = `https://${this.config.domain}/#report/${reportId}`;

        const subject = `Audit Report Available: ${clientName}`;
        const html = `
            <h2>Audit Report Published</h2>
            <p>Dear ${clientName},</p>
            <p>Your audit report (ID: ${reportId}) has been finalized and published.</p>
            <p>You can view and download it from the portal.</p>
            <br>
            <a href="${downloadLink}" style="background:#10b981;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">View Report</a>
        `;

        return this.send(clientEmail, subject, html, 'report_published');
    }
};

// Export
window.EmailService = EmailService;

Logger.info('EmailService module loaded', EmailService.config);
