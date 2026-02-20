// ============================================
// CERTIFICATE MANAGEMENT MODULE
// ============================================
// Handles certificate generation, tracking, and lifecycle management

/**
 * Generate certificate from finalized audit report
 * @param {string} reportId - The audit report ID
 * @returns {object} Certificate object
 */
window.generateCertificate = function (reportId) {
    const report = window.state.auditReports?.find(r => String(r.id) === String(reportId));
    if (!report) {
        window.showNotification('Report not found', 'error');
        return null;
    }

    const plan = window.state.auditPlans?.find(p => String(p.id) === String(report.auditPlanId));
    const client = window.state.clients?.find(c => String(c.id) === String(plan?.clientId || report.clientId));

    if (!plan || !client) {
        window.showNotification('Associated audit plan or client not found', 'error');
        return null;
    }

    // Generate certificate number
    const year = new Date().getFullYear();
    const cbSettings = window.state.cbSettings || {};
    const cbPrefix = cbSettings.cbName?.substring(0, 3).toUpperCase() || 'CB';
    const standardCode = plan.standard?.includes('9001') ? 'QMS' :
        plan.standard?.includes('14001') ? 'EMS' :
            plan.standard?.includes('45001') ? 'OHSMS' :
                plan.standard?.includes('22000') ? 'FSMS' : 'CERT';

    const existingCerts = (window.state.certificates || []).filter(c => c.certificateNumber?.startsWith(`${cbPrefix}-${year}`));
    const sequence = String(existingCerts.length + 1).padStart(3, '0');
    const certificateNumber = `${cbPrefix}-${year}-${standardCode}-${sequence}`;

    // Calculate expiration (3 years from issue)
    const issueDate = new Date();
    const expirationDate = new Date(issueDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 3);

    // Generate QR code data (verification URL)
    const qrData = `https://verify.auditcb.com/cert/${certificateNumber}`;

    const certificate = {
        id: `CERT-${Date.now()}`,
        clientId: client.id,
        clientName: client.name,
        auditPlanId: plan.id,
        reportId: report.id,
        standard: plan.standard,
        scope: plan.scope || client.scope || '',
        certificationDate: issueDate.toLocaleDateString('en-CA'),
        expirationDate: expirationDate.toLocaleDateString('en-CA'),
        issueDate: issueDate.toLocaleDateString('en-CA'),
        status: 'Valid',
        certificateNumber: certificateNumber,
        pdfUrl: null, // Will be populated after PDF upload
        qrCode: qrData,
        accreditationBody: cbSettings.accreditationBody || 'ANAB',
        accreditationNumber: cbSettings.accreditationNumber || '',
        issuedBy: window.state.currentUser?.name || 'Certification Manager'
    };

    return certificate;
};

/**
 * Export certificate as PDF
 * @param {string} certId - Certificate ID
 */
window.exportCertificatePDF = function (certId) {
    const cert = window.state.certificates?.find(c => String(c.id) === String(certId));
    if (!cert) {
        window.showNotification('Certificate not found', 'error');
        return;
    }

    const client = window.state.clients?.find(c => String(c.id) === String(cert.clientId));
    const cbSettings = window.state.cbSettings || {};

    const printWindow = window.open('', '_blank');

    const reportHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Certificate - ${cert.certificateNumber}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Georgia', serif; 
            background: white;
            padding: 40px;
        }
        .certificate {
            border: 20px solid #1e3a8a;
            border-image: linear-gradient(135deg, #1e3a8a, #3b82f6) 1;
            padding: 60px;
            position: relative;
            min-height: 800px;
            background: linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%);
        }
        .certificate::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" font-size="48" fill="%23e2e8f0" opacity="0.1" text-anchor="middle" transform="rotate(-45 100 100)">CERTIFIED</text></svg>');
            background-repeat: repeat;
            opacity: 0.1;
            pointer-events: none;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 40px;
        }
        .logo {
            font-size: 48px;
            color: #1e3a8a;
            margin-bottom: 10px;
        }
        .cb-name {
            font-size: 32px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 5px;
        }
        .accreditation {
            font-size: 14px;
            color: #64748b;
            margin-top: 10px;
        }
        .title {
            text-align: center;
            font-size: 42px;
            font-weight: bold;
            color: #1e3a8a;
            margin: 30px 0;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .subtitle {
            text-align: center;
            font-size: 18px;
            color: #475569;
            margin-bottom: 40px;
        }
        .content {
            font-size: 16px;
            line-height: 2;
            color: #1e293b;
            margin: 30px 0;
        }
        .content p {
            margin: 15px 0;
        }
        .highlight {
            font-weight: bold;
            color: #1e3a8a;
        }
        .cert-details {
            background: #f1f5f9;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
        }
        .cert-details table {
            width: 100%;
            border-collapse: collapse;
        }
        .cert-details td {
            padding: 8px 0;
        }
        .cert-details td:first-child {
            font-weight: bold;
            width: 40%;
            color: #475569;
        }
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 60px;
        }
        .signature {
            text-align: center;
            flex: 1;
        }
        .signature-line {
            border-top: 2px solid #1e293b;
            margin: 40px 20px 10px 20px;
            padding-top: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            font-size: 12px;
            color: #64748b;
        }
        .qr-code {
            position: absolute;
            bottom: 60px;
            right: 60px;
            text-align: center;
        }
        .qr-code img {
            width: 80px;
            height: 80px;
        }
        .qr-code p {
            font-size: 10px;
            margin-top: 5px;
            color: #64748b;
        }
        @media print {
            body { padding: 0; }
            .certificate { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="certificate">
        <!-- Header -->
        <div class="header">
            <div class="logo">
                <i class="fa-solid fa-certificate"></i>
            </div>
            <div class="cb-name">${cbSettings.cbName || 'AuditCB360'}</div>
            ${cert.accreditationBody ? `
                <div class="accreditation">
                    Accredited by ${cert.accreditationBody}
                    ${cert.accreditationNumber ? `| Accreditation No: ${cert.accreditationNumber}` : ''}
                </div>
            ` : ''}
        </div>

        <!-- Title -->
        <div class="title">Certificate of Conformity</div>
        <div class="subtitle">${cert.standard}</div>

        <!-- Content -->
        <div class="content">
            <p style="text-align: center; font-size: 18px; margin-bottom: 30px;">
                This is to certify that
            </p>
            
            <p style="text-align: center; font-size: 28px; font-weight: bold; color: #1e3a8a; margin: 20px 0;">
                ${client?.name || cert.clientName}
            </p>
            
            ${client?.address ? `
                <p style="text-align: center; font-size: 14px; color: #64748b; margin-bottom: 30px;">
                    ${client.address}
                </p>
            ` : ''}

            <p style="text-align: center; margin: 30px 0;">
                has been assessed and found to conform to the requirements of
            </p>

            <p style="text-align: center; font-size: 20px; font-weight: bold; color: #1e3a8a; margin: 20px 0;">
                ${cert.standard}
            </p>

            <p style="text-align: center; margin: 30px 0;">
                for the following scope of certification:
            </p>

            <p style="text-align: center; font-style: italic; color: #475569; padding: 20px; background: #f8fafc; border-radius: 8px;">
                ${cert.scope || 'No scope specified'}
            </p>
        </div>

        <!-- Certificate Details -->
        <div class="cert-details">
            <table>
                <tr>
                    <td>Certificate Number:</td>
                    <td><strong>${cert.certificateNumber}</strong></td>
                </tr>
                <tr>
                    <td>Certification Date:</td>
                    <td>${new Date(cert.certificationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                <tr>
                    <td>Valid Until:</td>
                    <td>${new Date(cert.expirationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
            </table>
        </div>

        <!-- Signature Section -->
        <div class="signature-section">
            <div class="signature">
                <div class="signature-line">
                    ${cert.issuedBy}
                </div>
                <div style="font-size: 12px; color: #64748b;">Certification Manager</div>
            </div>
        </div>

        <!-- QR Code -->
        <div class="qr-code">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(cert.qrCode)}" alt="QR Code">
            <p>Scan to verify</p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>${cbSettings.cbEmail || 'info@auditcb.com'} | ${cbSettings.cbPhone || ''}</p>
            <p>This certificate remains the property of ${cbSettings.cbName || 'the certification body'} and must be returned upon request.</p>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
    </script>
</body>
</html>`;

    printWindow.document.write(reportHTML);
    printWindow.document.close();
};

/**
 * Render certificates registry
 */
window.renderCertificates = function () {
    const certificates = window.state.certificates || [];

    // Calculate status for each certificate
    const today = new Date();
    const certificatesWithStatus = certificates.map(cert => {
        const expDate = new Date(cert.expirationDate);
        const daysUntilExpiry = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

        let displayStatus = cert.status;
        let statusColor = '#10b981'; // green

        if (cert.status === 'Revoked') {
            statusColor = '#6b7280';
        } else if (cert.status === 'Suspended') {
            statusColor = '#f59e0b';
        } else if (expDate < today) {
            displayStatus = 'Expired';
            statusColor = '#ef4444';
        } else if (daysUntilExpiry <= 90) {
            displayStatus = 'Expiring Soon';
            statusColor = '#f59e0b';
        }

        return {
            ...cert,
            displayStatus,
            statusColor,
            daysUntilExpiry
        };
    });

    const html = `
        <div class="fade-in">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h2 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fa-solid fa-certificate" style="color: #1e3a8a;"></i>
                        Certificate Registry
                    </h2>
                    <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0;">
                        Manage and track all issued certificates
                    </p>
                </div>
            </div>

            <!-- Stats Cards -->
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;">
                    <div style="font-size: 2rem; font-weight: bold;">${certificatesWithStatus.filter(c => c.displayStatus === 'Valid').length}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Valid</div>
                </div>
                <div class="card" style="text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
                    <div style="font-size: 2rem; font-weight: bold;">${certificatesWithStatus.filter(c => c.displayStatus === 'Expiring Soon').length}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Expiring Soon</div>
                </div>
                <div class="card" style="text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                    <div style="font-size: 2rem; font-weight: bold;">${certificatesWithStatus.filter(c => c.displayStatus === 'Expired').length}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Expired</div>
                </div>
                <div class="card" style="text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
                    <div style="font-size: 2rem; font-weight: bold;">${certificatesWithStatus.filter(c => c.status === 'Suspended').length}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Suspended</div>
                </div>
                <div class="card" style="text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white;">
                    <div style="font-size: 2rem; font-weight: bold;">${certificatesWithStatus.filter(c => c.status === 'Revoked').length}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Revoked</div>
                </div>
            </div>

            <!-- Certificates Table -->
            <div class="card">
                ${certificates.length === 0 ? `
                    <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <i class="fa-solid fa-certificate" style="font-size: 4rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                        <p style="font-size: 1.1rem; margin: 0;">No certificates issued yet</p>
                        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Certificates will appear here when audit reports are finalized</p>
                    </div>
                ` : `
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 1rem; text-align: left; font-weight: 600;">Certificate #</th>
                                <th style="padding: 1rem; text-align: left; font-weight: 600;">Client</th>
                                <th style="padding: 1rem; text-align: left; font-weight: 600;">Standard</th>
                                <th style="padding: 1rem; text-align: left; font-weight: 600;">Issued</th>
                                <th style="padding: 1rem; text-align: left; font-weight: 600;">Expires</th>
                                <th style="padding: 1rem; text-align: left; font-weight: 600;">Status</th>
                                <th style="padding: 1rem; text-align: center; font-weight: 600;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${certificatesWithStatus.map(cert => `
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 1rem;">
                                        <strong>${cert.certificateNumber}</strong>
                                    </td>
                                    <td style="padding: 1rem;">${cert.clientName}</td>
                                    <td style="padding: 1rem;">
                                        <span style="font-size: 0.85rem; color: #64748b;">${cert.standard}</span>
                                    </td>
                                    <td style="padding: 1rem;">${new Date(cert.issueDate).toLocaleDateString()}</td>
                                    <td style="padding: 1rem;">
                                        ${new Date(cert.expirationDate).toLocaleDateString()}
                                        ${cert.daysUntilExpiry > 0 && cert.daysUntilExpiry <= 90 ? `
                                            <span style="font-size: 0.75rem; color: #f59e0b; display: block;">(${cert.daysUntilExpiry} days)</span>
                                        ` : ''}
                                    </td>
                                    <td style="padding: 1rem;">
                                        <span style="padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; background: ${cert.statusColor}20; color: ${cert.statusColor};">
                                            ${cert.displayStatus}
                                        </span>
                                    </td>
                                    <td style="padding: 1rem; text-align: center;">
                                        <button class="btn btn-sm btn-outline-primary" data-action="exportCertificatePDF" data-id="${cert.id}" title="Export PDF">
                                            <i class="fa-solid fa-file-pdf"></i>
                                        </button>
                                        ${cert.status !== 'Revoked' && cert.displayStatus !== 'Expired' ? `
                                            <button class="btn btn-sm btn-outline-secondary" data-action="suspendCertificate" data-id="${cert.id}" title="${cert.status === 'Suspended' ? 'Reinstate' : 'Suspend'}">
                                                <i class="fa-solid fa-${cert.status === 'Suspended' ? 'play' : 'pause'}"></i>
                                            </button>
                                            <button class="btn btn-sm btn-outline-danger" data-action="revokeCertificate" data-id="${cert.id}" title="Revoke">
                                                <i class="fa-solid fa-ban"></i>
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;
};

/**
 * Suspend or reinstate certificate
 * @param {string} certId - Certificate ID
 */
window.suspendCertificate = function (certId) {
    const cert = window.state.certificates?.find(c => String(c.id) === String(certId));
    if (!cert) return;

    if (cert.status === 'Suspended') {
        if (confirm('Reinstate this certificate?')) {
            cert.status = 'Valid';
            window.saveState();
            window.showNotification('Certificate reinstated', 'success');
            window.renderCertificates();
        }
    } else {
        if (confirm('Suspend this certificate? It can be reinstated later.')) {
            cert.status = 'Suspended';
            window.saveState();
            window.showNotification('Certificate suspended', 'success');
            window.renderCertificates();
        }
    }
};

/**
 * Revoke certificate
 * @param {string} certId - Certificate ID
 */
window.revokeCertificate = function (certId) {
    const cert = window.state.certificates?.find(c => String(c.id) === String(certId));
    if (!cert) return;

    if (confirm('Revoke this certificate? This action cannot be undone.')) {
        cert.status = 'Revoked';
        window.saveState();
        window.showNotification('Certificate revoked', 'success');
        window.renderCertificates();
    }
};

// Initialize certificates array in state if not exists
if (!window.state.certificates) {
    window.state.certificates = [];
}
