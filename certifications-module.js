
// ============================================
// AUDITCB360 - CERTIFICATION MODULE
// ============================================

// Initialize Certifications State if missing
if (!window.state.certifications) {
    window.state.certifications = [
        {
            id: 'CERT-2024-001',
            client: 'Tech Solutions Ltd',
            standard: 'ISO 9001:2015',
            issueDate: '2024-01-15',
            expiryDate: '2027-01-14',
            status: 'Valid',
            scope: 'Software Development and IT Services including Cloud Infrastructure Management.',
            history: [{ date: '2024-01-15', action: 'Initial Certification', user: 'Admin' }]
        },
        {
            id: 'CERT-2024-002',
            client: 'Global Manufacturing',
            standard: 'ISO 14001:2015',
            issueDate: '2024-02-10',
            expiryDate: '2027-02-09',
            status: 'Valid',
            scope: 'Manufacturing of Automotive Parts and Assembly Operations.',
            history: [{ date: '2024-02-10', action: 'Initial Certification', user: 'Admin' }]
        }
    ];
}

function renderCertificationModule() {
    const contentArea = document.getElementById('content-area');
    const certs = window.state.certifications;

    // Find audit reports that are finalized but don't have a certificate yet (Pending Decision)
    // Simplified logic: Check if report is finalized & recommendation is 'Recommend Certification'
    const pendingDecisions = window.state.auditReports.filter(r =>
        r.status === window.CONSTANTS.STATUS.FINALIZED &&
        [window.CONSTANTS.RECOMMENDATIONS.RECOMMEND, window.CONSTANTS.RECOMMENDATIONS.CONDITIONAL].includes(r.recommendation) &&
        !certs.find(c => c.client === r.client && c.issueDate === r.date)
    );

    contentArea.innerHTML = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin-bottom: 0.5rem;" onclick="toggleCertAnalytics()" style="cursor: pointer;">
                        Certification Management
                         <i class="fa-solid ${window.state.showCertAnalytics !== false ? 'fa-angle-down' : 'fa-angle-right'}" style="font-size: 0.8em; color: var(--text-secondary); margin-left: 0.5rem;"></i>
                    </h2>
                    <p style="color: var(--text-secondary);">Manage issuance, surveillance, and renewal of ISO certificates.</p>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-secondary" onclick="window.printCertificateRegister()"><i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Print Register</button>
                    <button class="btn btn-primary" onclick="openIssueCertificateModal()"><i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Manual Issue</button>
                </div>
            </div>

            ${window.state.showCertAnalytics !== false ? `
            <div class="fade-in" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <!-- Active Certificates -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-certificate"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Active Certificates</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${certs.filter(c => c.status === window.CONSTANTS.CERT_STATUS.VALID).length}</div>
                    </div>
                </div>

                <!-- Pending Decisions -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-hourglass-half"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Pending Decisions</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${pendingDecisions.length}</div>
                    </div>
                </div>

                 <!-- Suspended/Withdrawn -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                         <i class="fa-solid fa-ban"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Suspended/Withdrawn</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${certs.filter(c => [window.CONSTANTS.CERT_STATUS.SUSPENDED, window.CONSTANTS.CERT_STATUS.WITHDRAWN].includes(c.status)).length}</div>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Tabs -->
            <div style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" onclick="switchCertTab(this, 'active-certs')">Active Certificates (${certs.filter(c => c.status === window.CONSTANTS.CERT_STATUS.VALID).length})</button>
                <button class="tab-btn" onclick="switchCertTab(this, 'pending-certs')">Pending Decisions (${pendingDecisions.length})</button>
                <button class="tab-btn" onclick="switchCertTab(this, 'suspended-certs')">Suspended/Withdrawn</button>
            </div>

            <!-- Tab Content: Active Certificates -->
            <div id="active-certs" class="cert-tab-content">
                <div class="card">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Certificate ID</th>
                                    <th>Client</th>
                                    <th>Standard</th>
                                    <th>Issue Date</th>
                                    <th>Expiry Date</th>
                                    <th>Status</th>
                                    <th style="text-align: right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${certs.filter(c => c.status === window.CONSTANTS.CERT_STATUS.VALID).map(cert => `
                                    <tr>
                                        <td><strong>${cert.id}</strong></td>
                                        <td>${cert.client}</td>
                                        <td><span class="badge bg-blue">${cert.standard}</span></td>
                                        <td>${cert.issueDate}</td>
                                        <td>${cert.expiryDate}</td>
                                        <td><span class="badge bg-green">${cert.status}</span></td>
                                        <td  style="text-align: right;">
                                            <button class="btn btn-sm btn-icon" onclick="viewCertificate('${cert.id}')" title="View/Print"><i class="fa-solid fa-eye"></i></button>
                                            <button class="btn btn-sm btn-icon" onclick="openCertActionModal('${cert.id}')" title="Suspend/Withdraw"><i class="fa-solid fa-gavel"></i></button>
                                        </td>
                                    </tr>
                                `).join('') || '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">No active certificates found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Pending Decisions -->
            <div id="pending-certs" class="cert-tab-content" style="display: none;">
                <div class="card">
                    <p style="margin-bottom: 1rem; color: var(--text-secondary);">The following audits have been finalized and recommended for certification. Please review and issue certificates.</p>
                    <div class="table-container">
                         <table>
                            <thead>
                                <tr>
                                    <th>Audit Report ID</th>
                                    <th>Client</th>
                                    <th>Audit Date</th>
                                    <th>Recommendation</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pendingDecisions.map(r => `
                                    <tr>
                                        <td>REP-${r.id}</td>
                                        <td>${r.client}</td>
                                        <td>${r.date}</td>
                                        <td><span style="color: var(--success-color); font-weight: 600;">${r.recommendation}</span></td>
                                        <td>
                                            <button class="btn btn-primary btn-sm" onclick="openIssueCertificateModal('${r.id}')">
                                                <i class="fa-solid fa-certificate" style="margin-right: 0.5rem;"></i> Issue Certificate
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') || '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">No pending certification decisions.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
             
             <!-- Tab Content: Suspended -->
             <div id="suspended-certs" class="cert-tab-content" style="display: none;">
                 <div class="card">
                     <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Certificate ID</th>
                                    <th>Client</th>
                                    <th>Standard</th>
                                    <th>Status</th>
                                    <th>Reason</th>
                                    <th style="text-align: right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${certs.filter(c => c.status !== window.CONSTANTS.CERT_STATUS.VALID).map(cert => `
                                    <tr>
                                        <td><strong>${cert.id}</strong></td>
                                        <td>${cert.client}</td>
                                        <td><span class="badge bg-blue">${cert.standard}</span></td>
                                        <td><span class="badge" style="background: ${cert.status === window.CONSTANTS.CERT_STATUS.SUSPENDED ? 'orange' : 'red'}; color: white;">${cert.status}</span></td>
                                        <td>${cert.statusReason || 'N/A'}</td>
                                        <td style="text-align: right;">
                                            <button class="btn btn-sm btn-icon" onclick="viewCertificate('${cert.id}')" title="View History"><i class="fa-solid fa-history"></i></button>
                                            ${cert.status === window.CONSTANTS.CERT_STATUS.SUSPENDED ? `<button class="btn btn-sm btn-success" onclick="restoreCertificate('${cert.id}')" title="Restore"><i class="fa-solid fa-undo"></i> Restore</button>` : ''}
                                        </td>
                                    </tr>
                                `).join('') || '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">No suspended or withdrawn certificates.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
        </div>
    `;
}

window.switchCertTab = function (btn, tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.cert-tab-content').forEach(c => c.style.display = 'none');

    btn.classList.add('active');
    document.getElementById(tabId).style.display = 'block';
};

window.openIssueCertificateModal = function (reportId) {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    let prefillClient = '';
    let prefillStandard = '';
    let prefillScope = '';
    let auditDate = '';

    // Find report data
    if (reportId) {
        const report = state.auditReports.find(r => r.id == reportId);
        if (report) {
            prefillClient = report.client;
            auditDate = report.date;

            // Try to find plan for accurate scope/standard
            const plan = state.auditPlans.find(p => p.client === report.client);
            if (plan) {
                prefillScope = plan.scope;
                prefillStandard = plan.standard;
            } else {
                // Fallback to client data
                const client = state.clients.find(c => c.name === prefillClient);
                if (client) prefillStandard = client.standard;
            }
        }
    }

    modalTitle.textContent = 'Issue ISO Certificate';
    modalBody.innerHTML = `
        <form id="cert-issue-form">
            <div class="form-group">
                <label>Certificate ID (Auto-generated)</label>
                <input type="text" class="form-control" id="cert-id" value="CERT-${new Date().getFullYear()}-${String(state.certifications.length + 1).padStart(3, '0')}" readonly>
            </div>
            <div class="form-group">
                <label>Client Organization</label>
                <select class="form-control" id="cert-client" ${prefillClient ? 'disabled' : ''}>
                    <option value="">-- Select Client --</option>
                    ${state.clients.map(c => `<option value="${c.name}" ${c.name === prefillClient ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Standard</label>
                <select class="form-control" id="cert-standard">
                     ${["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018"].map(std =>
        `<option value="${std}" ${prefillStandard.includes(std) ? 'selected' : ''}>${std}</option>`
    ).join('')}
                </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Issue Date</label>
                    <input type="date" class="form-control" id="cert-issue-date" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                    <label>Expiry Date (3 Years)</label>
                    <input type="date" class="form-control" id="cert-expiry-date" value="${new Date(new Date().setFullYear(new Date().getFullYear() + 3)).toISOString().split('T')[0]}" required>
                </div>
            </div>
             <div class="form-group">
                <label>Certification Scope (Critical)</label>
                <textarea class="form-control" id="cert-scope" rows="4" placeholder="Enter the precise scope of certification...">${prefillScope}</textarea>
            </div>
            
            <!-- ISO 17021-1 Decision Fields -->
            <div style="background: #eff6ff; padding: 1rem; border-radius: 8px; border: 1px solid #bfdbfe; margin-top: 1rem;">
                <h4 style="margin: 0 0 1rem 0; font-size: 0.95rem; color: #1d4ed8;">
                    <i class="fa-solid fa-shield-halved"></i> ISO 17021-1 Certification Decision
                </h4>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Decision Justification <span style="color: #dc2626;">*</span></label>
                    <textarea class="form-control" id="cert-justification" rows="3" placeholder="Document the basis for the certification decision, including review of audit findings, NC closure evidence, and overall system effectiveness..." required></textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label>Decision Maker (Competent Reviewer)</label>
                        <input type="text" class="form-control" id="cert-reviewer" value="${state.currentUser?.name || 'Certification Manager'}" readonly>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label>Independent of Audit Team?</label>
                        <select class="form-control" id="cert-independent">
                            <option value="yes" selected>Yes - Not part of audit team</option>
                            <option value="no">No - Was involved in audit</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top: 1rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="checkbox" id="cert-nc-verified" required>
                        <span>I confirm all non-conformities have been closed with objective evidence</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-top: 0.5rem;">
                        <input type="checkbox" id="cert-scope-verified" required>
                        <span>I confirm the scope accurately reflects the certified activities</span>
                    </label>
                </div>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        // 1. Define Fields
        const fieldIds = {
            client: 'cert-client',
            issueDate: 'cert-issue-date',
            expiryDate: 'cert-expiry-date',
            scope: 'cert-scope',
            justification: 'cert-justification',
            independent: 'cert-independent'
        };

        // 2. Define Rules
        const rules = {
            client: [{ rule: 'required', fieldName: 'Client' }],
            issueDate: [{ rule: 'required', fieldName: 'Issue Date' }],
            expiryDate: [{ rule: 'required', fieldName: 'Expiry Date' }],
            scope: [
                { rule: 'required', fieldName: 'Scope' },
                { rule: 'length', min: 10, max: 1000, fieldName: 'Scope' },
                { rule: 'noHtmlTags' }
            ],
            justification: [
                { rule: 'required', fieldName: 'Justification' },
                { rule: 'noHtmlTags' }
            ]
        };

        // 3. Validate
        const result = Validator.validateFormElements(fieldIds, rules);
        // Custom Checkboxes
        const ncVerified = document.getElementById('cert-nc-verified').checked;
        const scopeVerified = document.getElementById('cert-scope-verified').checked;

        if (!result.valid) {
            Validator.displayErrors(result.errors, fieldIds);
            window.showNotification('Please fix the form errors', 'error');
            return;
        }

        if (!ncVerified || !scopeVerified) {
            window.showNotification('Please confirm NC closure and scope verification!', 'error');
            return;
        }

        Validator.clearErrors(fieldIds);

        // 4. Sanitize & Collect
        const clientIdx = document.getElementById('cert-client').selectedIndex;
        const clientName = document.getElementById('cert-client').options[clientIdx].text;
        const standard = document.getElementById('cert-standard').value;
        const issueDate = document.getElementById('cert-issue-date').value;
        const expiryDate = document.getElementById('cert-expiry-date').value;

        const scope = Sanitizer.sanitizeText(document.getElementById('cert-scope').value);
        const justification = Sanitizer.sanitizeText(document.getElementById('cert-justification').value);
        const reviewer = document.getElementById('cert-reviewer').value; // Readonly, safe
        const independent = document.getElementById('cert-independent').value;

        const newCert = {
            id: document.getElementById('cert-id').value,
            client: prefillClient || document.getElementById('cert-client').value,
            standard: standard,
            issueDate: issueDate,
            expiryDate: expiryDate,
            status: window.CONSTANTS.CERT_STATUS.VALID,
            scope: scope,
            // ISO 17021-1 Decision Record
            decisionRecord: {
                justification: justification,
                decisionMaker: reviewer,
                independentOfAudit: independent === 'yes',
                ncClosureVerified: ncVerified,
                scopeVerified: scopeVerified,
                decisionDate: new Date().toISOString().split('T')[0]
            },
            history: [{ date: new Date().toISOString().split('T')[0], action: 'Initial Certification', user: reviewer }]
        };

        state.certifications.push(newCert);
        window.saveData();
        window.closeModal();
        renderCertificationModule();
        // Also pop up the certificate immediately
        window.viewCertificate(newCert.id);
        window.showNotification('Certificate issued successfully', 'success');
    };
};

window.viewCertificate = function (certId) {
    const cert = state.certifications.find(c => c.id === certId);
    if (!cert) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Certificate - ${cert.id}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:wght@300;400;700&display=swap');
                body { margin: 0; padding: 0; background: #f0f0f0; display: flex; justify-content: center; font-family: 'Lato', sans-serif; }
                .cert-frame { width: 1000px; height: 700px; padding: 40px; background: white; margin: 40px; position: relative; border: 20px solid #2c3e50; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
                .cert-inner-border { width: 100%; height: 100%; border: 2px solid #aaa; display: flex; flex-direction: column; align-items: center; text-align: center; background-image: radial-gradient(circle at center, rgba(255,255,255,0) 0%, rgba(240,240,240,0.2) 100%); }
                .cert-header { margin-top: 40px; font-family: 'Cinzel', serif; font-size: 3rem; color: #2c3e50; font-weight: 700; letter-spacing: 2px; }
                .cert-subtitle { font-size: 1.2rem; margin-top: 10px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 3px; }
                .cert-body { margin-top: 50px; width: 80%; }
                .cert-presented { font-size: 1.1rem; color: #7f8c8d; margin-bottom: 20px; }
                .cert-client { font-size: 2.5rem; font-weight: 700; color: #1a252f; margin-bottom: 30px; border-bottom: 1px solid #ddd; padding-bottom: 10px; display: inline-block; }
                .cert-text { font-size: 1.1rem; line-height: 1.6; color: #34495e; margin-bottom: 30px; }
                .cert-standard { font-size: 2rem; font-weight: 700; color: #c0392b; margin: 20px 0; font-family: 'Cinzel', serif; }
                .cert-scope { font-style: italic; font-size: 1.1rem; color: #555; background: #f9f9f9; padding: 15px; border-radius: 5px; }
                .cert-footer { margin-top: auto; margin-bottom: 50px; width: 80%; display: flex; justify-content: space-between; align-items: flex-end; }
                .signature-line { border-top: 1px solid #333; width: 200px; margin-top: 10px; }
                .seal { width: 120px; height: 120px; border-radius: 50%; border: 3px double #c0392b; color: #c0392b; display: flex; align-items: center; justify-content: center; font-family: 'Cinzel', serif; font-weight: 700; transform: rotate(-15deg); opacity: 0.8; font-size: 0.9rem; text-align: center; }
                .meta-info { position: absolute; bottom: 10px; right: 20px; font-size: 0.7rem; color: #aaa; }
                
                @media print {
                    body { background: none; margin: 0; }
                    .cert-frame { margin: 0; border: 10px solid #2c3e50; width: 100%; height: 100vh; box-shadow: none; box-sizing: border-box; }
                }
            </style>
        </head>
        <body>
            <div class="cert-frame">
                <div class="cert-inner-border">
                    <div class="cert-header">Certificate of Registration</div>
                    <div class="cert-subtitle">AuditCB360 Certification Body</div>
                    
                    <div class="cert-body">
                        <div class="cert-presented">This is to certify that the Management System of:</div>
                        <div class="cert-client">${cert.client}</div>
                        
                        <div class="cert-text">has been assessed and found to constitute with the requirements of:</div>
                        <div class="cert-standard">${cert.standard}</div>
                        
                        <div class="cert-scope"><strong>Scope of Certification:</strong><br>${cert.scope}</div>
                    </div>
                    
                    <div class="cert-footer">
                        <div style="text-align: center;">
                            <div style="font-family: 'Mrs Saint Delafield', cursive; font-size: 1.5rem;">C. Executive</div>
                            <div class="signature-line"></div>
                            <div>Chief Executive Officer</div>
                        </div>
                        
                        <div class="seal">
                            OFFICIAL<br>SEAL<br>2025
                        </div>
                        
                        <div style="text-align: center;">
                            <div><strong>Date of Issue:</strong> ${cert.issueDate}</div>
                            <div><strong>Valid Util:</strong> ${cert.expiryDate}</div>
                            <div><strong>Certificate No:</strong> ${cert.id}</div>
                        </div>
                    </div>
                </div>
                <div class="meta-info">This certificate remains the property of AuditCB360 and must be returned upon request. Verify validity at auditcb360.com/verify</div>
            </div>
            <script>
                // Auto print
                setTimeout(() => window.print(), 500);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

window.openCertActionModal = function (certId) {
    const cert = state.certifications.find(c => c.id === certId);
    if (!cert) return;

    // Simple prompt for now
    const action = prompt("Enter action (suspend/withdraw):", "suspend");
    if (!action) return;

    const reason = prompt("Enter reason for " + action + ":");
    if (!reason) return;

    if (action.toLowerCase() === 'suspend') {
        cert.status = window.CONSTANTS.CERT_STATUS.SUSPENDED;
    } else if (action.toLowerCase() === 'withdraw') {
        cert.status = window.CONSTANTS.CERT_STATUS.WITHDRAWN;
    } else {
        return; // invalid
    }
    cert.statusReason = reason;
    cert.history.push({ date: new Date().toISOString().split('T')[0], action: action, user: 'Admin', reason: reason });

    window.saveData();
    renderCertificationModule();
};

window.restoreCertificate = function (certId) {
    const cert = state.certifications.find(c => c.id === certId);
    if (confirm('Are you sure you want to restore this certificate to Valid status?')) {
        cert.status = window.CONSTANTS.CERT_STATUS.VALID;
        cert.history.push({ date: new Date().toISOString().split('T')[0], action: 'Restored', user: 'Admin' });
        window.saveData();
        renderCertificationModule();
    }
};

window.printCertificateRegister = function () {
    const certs = window.state.certifications;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Certificate Register</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
                h1 { text-align: center; color: #2c3e50; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f8f9fa; font-weight: 600; color: #2c3e50; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .status-valid { color: green; font-weight: bold; }
                .status-suspended { color: orange; font-weight: bold; }
                .status-withdrawn { color: red; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>Certificate Register</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>Certificate ID</th>
                        <th>Client Organization</th>
                        <th>Standard</th>
                        <th>Status</th>
                        <th>Issue Date</th>
                        <th>Expiry Date</th>
                        <th>Scope</th>
                    </tr>
                </thead>
                <tbody>
                    ${certs.map(c => `
                        <tr>
                            <td>${c.id}</td>
                            <td>${c.client}</td>
                            <td>${c.standard}</td>
                            <td class="status-${c.status.toLowerCase()}">${c.status}</td>
                            <td>${c.issueDate}</td>
                            <td>${c.expiryDate}</td>
                            <td>${c.scope}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <script>setTimeout(() => window.print(), 500);</script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// Helper for toggle
window.toggleCertAnalytics = function () {
    if (window.state.showCertAnalytics === undefined) window.state.showCertAnalytics = true;
    window.state.showCertAnalytics = !window.state.showCertAnalytics;
    renderCertificationModule();
};
