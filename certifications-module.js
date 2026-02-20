
// ============================================
// AUDITCB360 - CERTIFICATION MODULE
// ============================================

// Initialize Certifications State if missing
if (!window.state.certifications) {
    window.state.certifications = [];
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
                    <h2 style="margin-bottom: 0.5rem;" data-action="toggleCertAnalytics" style="cursor: pointer;">
                        Certification Management
                         <i class="fa-solid ${window.state.showCertAnalytics !== false ? 'fa-angle-down' : 'fa-angle-right'}" style="font-size: 0.8em; color: var(--text-secondary); margin-left: 0.5rem;"></i>
                    </h2>
                    <p style="color: var(--text-secondary);">Manage issuance, surveillance, and renewal of ISO certificates.</p>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-secondary" data-action="printCertificateRegister"><i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Print Register</button>
                    <button class="btn btn-primary" data-action="openIssueCertificateModal"><i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Manual Issue</button>
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
                <button class="tab-btn active" data-action="switchCertTab" data-id="active-certs">Active Certificates (${certs.filter(c => c.status === window.CONSTANTS.CERT_STATUS.VALID).length})</button>
                <button class="tab-btn" data-action="switchCertTab" data-id="pending-certs">Pending Decisions (${pendingDecisions.length})</button>
                <button class="tab-btn" data-action="switchCertTab" data-id="suspended-certs">Suspended/Withdrawn</button>
                <button class="tab-btn" data-action="switchCertTab" data-id="public-directory"><i class="fa-solid fa-globe" style="margin-right: 0.5rem;"></i>Public Directory</button>
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
                                        <td><strong>${window.UTILS.escapeHtml(cert.id)}</strong></td>
                                        <td>${window.UTILS.escapeHtml(cert.client)}</td>
                                        <td><span class="badge bg-blue">${window.UTILS.escapeHtml(cert.standard)}</span></td>
                                        <td>${window.UTILS.escapeHtml(cert.issueDate)}</td>
                                        <td>${window.UTILS.escapeHtml(cert.expiryDate)}</td>
                                        <td><span class="badge bg-green">${window.UTILS.escapeHtml(cert.status)}</span></td>
                                        <td  style="text-align: right;">
                                            <button class="btn btn-sm btn-icon" data-action="viewCertificate" data-id="${cert.id}" title="View/Print"><i class="fa-solid fa-eye"></i></button>
                                            <button class="btn btn-sm btn-icon" data-action="editCertificate" data-id="${cert.id}" title="Edit Details"><i class="fa-solid fa-pen"></i></button>
                                            <button class="btn btn-sm btn-icon" data-action="openCertActionModal" data-id="${cert.id}" title="Suspend/Withdraw"><i class="fa-solid fa-gavel"></i></button>
                                            <button class="btn btn-sm btn-icon btn-danger" data-action="deleteCertificate" data-id="${cert.id}" title="Delete Permanent"><i class="fa-solid fa-trash"></i></button>
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
                                        <td>REP-${window.UTILS.escapeHtml(String(r.id))}</td>
                                        <td>${window.UTILS.escapeHtml(r.client)}</td>
                                        <td>${window.UTILS.escapeHtml(r.date)}</td>
                                        <td><span style="color: var(--success-color); font-weight: 600;">${window.UTILS.escapeHtml(r.recommendation)}</span></td>
                                        <td>
                                            <button class="btn btn-primary btn-sm" data-action="openIssueCertificateModal" data-id="${r.id}">
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
                                        <td><strong>${window.UTILS.escapeHtml(cert.id)}</strong></td>
                                        <td>${window.UTILS.escapeHtml(cert.client)}</td>
                                        <td><span class="badge bg-blue">${window.UTILS.escapeHtml(cert.standard)}</span></td>
                                        <td><span class="badge" style="background: ${cert.status === window.CONSTANTS.CERT_STATUS.SUSPENDED ? 'orange' : 'red'}; color: white;">${window.UTILS.escapeHtml(cert.status)}</span></td>
                                        <td>${window.UTILS.escapeHtml(cert.statusReason || 'N/A')}</td>
                                        <td style="text-align: right;">
                                            <button class="btn btn-sm btn-icon" data-action="viewCertificate" data-id="${cert.id}" title="View History"><i class="fa-solid fa-history"></i></button>
                                            ${cert.status === window.CONSTANTS.CERT_STATUS.SUSPENDED ? `<button class="btn btn-sm btn-success" data-action="restoreCertificate" data-id="${cert.id}" title="Restore"><i class="fa-solid fa-undo"></i> Restore</button>` : ''}
                                        </td>
                                    </tr>
                                `).join('') || '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">No suspended or withdrawn certificates.</td></tr>'}
                            </tbody>
                        </table>
                </div>
             </div>

             <!-- Tab Content: Public Directory (ISO 17021 Clause 9.3) -->
             <div id="public-directory" class="cert-tab-content" style="display: none;">
                 <div class="card">
                     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                         <div>
                             <h3 style="margin: 0 0 0.5rem 0;"><i class="fa-solid fa-globe" style="margin-right: 0.5rem; color: #0284c7;"></i>Public Certified Clients Directory</h3>
                             <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">ISO 17021-1 Clause 9.3 - Publicly accessible directory of certified clients</p>
                         </div>
                         <div style="display: flex; gap: 0.5rem;">
                             <button class="btn btn-secondary btn-sm" data-action="exportPublicDirectory">
                                 <i class="fa-solid fa-download" style="margin-right: 0.5rem;"></i>Export CSV
                             </button>
                             <button class="btn btn-primary btn-sm" data-action="generateEmbedCode">
                                 <i class="fa-solid fa-code" style="margin-right: 0.5rem;"></i>Generate Embed
                             </button>
                         </div>
                     </div>
             
                     <!-- Privacy Controls -->
                     <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                         <h4 style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: var(--text-secondary);">
                             <i class="fa-solid fa-shield-halved" style="margin-right: 0.5rem;"></i>Privacy Controls
                         </h4>
                         <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;">
                             <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem;">
                                 <input type="checkbox" id="show-cert-id" checked data-action-change="updatePublicDirectory">
                                 <span>Certificate ID</span>
                             </label>
                             <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem;">
                                 <input type="checkbox" id="show-client" checked data-action-change="updatePublicDirectory">
                                 <span>Client Name</span>
                             </label>
                             <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem;">
                                 <input type="checkbox" id="show-standard" checked data-action-change="updatePublicDirectory">
                                 <span>Standard</span>
                             </label>
                             <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem;">
                                 <input type="checkbox" id="show-scope" checked data-action-change="updatePublicDirectory">
                                 <span>Scope</span>
                             </label>
                             <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem;">
                                 <input type="checkbox" id="show-issue-date" checked data-action-change="updatePublicDirectory">
                                 <span>Issue Date</span>
                             </label>
                             <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem;">
                                 <input type="checkbox" id="show-expiry-date" checked data-action-change="updatePublicDirectory">
                                 <span>Expiry Date</span>
                             </label>
                             <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem;">
                                 <input type="checkbox" id="show-active-only" checked data-action-change="updatePublicDirectory">
                                 <span>Active Only</span>
                             </label>
                         </div>
                     </div>
             
                     <!-- Directory Table -->
                     <div id="public-directory-table" class="table-container">
                         <!-- Populated by updatePublicDirectory() -->
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

    // Initialize Public Directory when tab is opened
    if (tabId === 'public-directory') {
        setTimeout(() => window.updatePublicDirectory(), 100);
    }
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
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
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
                    ${state.clients.map(c => `<option value="${window.UTILS.escapeHtml(c.name)}" ${c.name === prefillClient ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
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
                    <label>Expiry Date</label>
                    <input type="date" class="form-control" id="cert-expiry-date" value="${new Date(new Date().setDate(new Date().getDate() + 364)).toISOString().split('T')[0]}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Certification Scope (Critical)</label>
                <textarea class="form-control" id="cert-scope" rows="4" placeholder="Enter the precise scope of certification...">${window.UTILS.escapeHtml(prefillScope)}</textarea>
            </div>

             <!-- Site Selection -->
            <div class="form-group" id="site-selection-container" style="display: none; background: #f8fafc; padding: 1rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 1rem;">
                <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; display: block;">Covered Sites (Select all that apply)</label>
                <div id="cert-sites-list" style="display: grid; gap: 0.5rem;">
                    <!-- Sites will be injected here via JS -->
                </div>
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

    // Logic to handle Client Change -> Populate Sites
    const clientSelect = document.getElementById('cert-client');
    const sitesContainer = document.getElementById('site-selection-container');
    const sitesList = document.getElementById('cert-sites-list');
    const scopeInput = document.getElementById('cert-scope');

    function loadSitesForClient(clientName) {
        const client = state.clients.find(c => c.name === clientName);
        sitesList.innerHTML = ''; // Clear

        if (client && client.sites && client.sites.length > 0) {
            sitesContainer.style.display = 'block';
            client.sites.forEach((site, index) => {
                const siteId = `site-${index}`;
                // Default check 'Head Office' or first site
                const isChecked = index === 0;

                const div = document.createElement('div');
                div.style.cssText = 'display: flex; align-items: start; gap: 0.5rem; font-size: 0.9rem;';
                div.innerHTML = `
                    <input type="checkbox" id="${siteId}" value="${index}" ${isChecked ? 'checked' : ''} style="margin-top: 4px;">
                    <label for="${siteId}" style="cursor: pointer; line-height: 1.4;">
                        <strong>${window.UTILS.escapeHtml(site.name)}</strong><br>
                        <span style="color: var(--text-secondary); font-size: 0.85rem;">${window.UTILS.escapeHtml(site.address)}, ${window.UTILS.escapeHtml(site.city)}</span>
                    </label>
                `;
                sitesList.appendChild(div);

                // Add listener to update scope
                div.querySelector('input').addEventListener('change', updateScopeFromSites);
            });
            // Initial update if scope is empty
            if (!scopeInput.value.trim()) {
                updateScopeFromSites();
            }
        } else {
            sitesContainer.style.display = 'none';
        }
    }

    function updateScopeFromSites() {
        const client = state.clients.find(c => c.name === clientSelect.value);
        if (!client || !client.sites) return;

        const selectedIndices = Array.from(sitesList.querySelectorAll('input:checked')).map(input => parseInt(input.value));
        const selectedSites = client.sites.filter((_, i) => selectedIndices.includes(i));

        if (selectedSites.length > 0) {
            const baseScope = "Activities performed at: " + selectedSites.map(s => `${s.name} (${s.city})`).join(', ');
            scopeInput.value = baseScope;
        }
    }

    // Attach Listener
    if (clientSelect) {
        clientSelect.addEventListener('change', (e) => {
            loadSitesForClient(e.target.value);
        });
    }

    // Trigger immediately if client prefilled
    if (prefillClient) {
        // Wait for modal to be potentially in DOM or just run it
        // Since we building string, we run this AFTER openModal usually, but here we are modifying the function body
        // We need to run this *after* the HTML is in the DOM.
    }

    // Note: The original code does `contentArea.innerHTML = html` or similar, but this is a modal.
    // The previous code block ended with `window.openModal()`.
    // We need to execute the listeners AFTER the modal content is set.

    // Changing the logic: We inject the HTML into the modal container first.
    // The original code uses `modalBody.innerHTML = ...`. 
    // So we should execute our logic AFTER that assignment.

    window.openModal('certificate-action-modal');

    // Make sure we run logic after modal is open and elements exist
    setTimeout(() => {
        if (prefillClient) loadSitesForClient(prefillClient);
    }, 100);


    // Auto-update expiry date when issue date changes
    const issueDateInput = document.getElementById('cert-issue-date');
    if (issueDateInput) {
        issueDateInput.addEventListener('change', window.updateCertExpiryDate);
    }

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

        // Capture Selected Sites
        const selectedSiteIndices = Array.from(document.querySelectorAll('#cert-sites-list input:checked')).map(input => parseInt(input.value));
        const activeClient = state.clients.find(c => c.name === document.getElementById('cert-client').value) || {};
        const sitesCovered = (activeClient.sites || []).filter((_, i) => selectedSiteIndices.includes(i));

        const newCert = {
            id: document.getElementById('cert-id').value,
            client: prefillClient || document.getElementById('cert-client').value,
            standard: standard,
            issueDate: issueDate,
            expiryDate: expiryDate,
            status: window.CONSTANTS.CERT_STATUS.VALID,
            scope: scope,
            sitesCovered: sitesCovered,
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

        // Sync to Supabase
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            window.SupabaseClient.upsertCertificate(newCert)
                .then(() => window.showNotification('Certificate saved to cloud', 'success'))
                .catch(err => {
                    console.error('Sync failed:', err);
                    window.showNotification(`Saved locally, but Cloud Sync Failed: ${err.message || JSON.stringify(err)}`, 'error');
                });
        }

        window.closeModal();
        renderCertificationModule();
        // Also pop up the certificate immediately
        window.viewCertificate(newCert.id);
        window.showNotification('Certificate issued successfully', 'success');
    };
};

window.deleteCertificate = function (certId) {
    if (confirm('Are you sure you want to permanently delete this certificate? This action cannot be undone.')) {
        // Remove locally
        window.state.certifications = window.state.certifications.filter(c => String(c.id) !== String(certId));
        window.saveData();

        // Remove from Cloud
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            window.SupabaseClient.deleteCertificate(certId).then(() => {
                window.showNotification('Certificate deleted from cloud', 'success');
            }).catch(err => {
                console.error('Delete failed:', err);
                window.showNotification('Deleted locally but cloud delete failed', 'warning');
            });
        }

        renderCertificationModule();
    }
};

window.viewCertificate = function (certId) {
    const cert = state.certifications.find(c => String(c.id) === String(certId));
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
                        <div class="cert-client">${window.UTILS.escapeHtml(cert.client)}</div>
                        
                        <div class="cert-text">has been assessed and found to constitute with the requirements of:</div>
                        <div class="cert-standard">${window.UTILS.escapeHtml(cert.standard)}</div>
                        
                        <div class="cert-scope"><strong>Scope of Certification:</strong><br>${window.UTILS.escapeHtml(cert.scope)}</div>
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
                            <div><strong>Date of Issue:</strong> ${window.UTILS.escapeHtml(cert.issueDate)}</div>
                            <div><strong>Valid Util:</strong> ${window.UTILS.escapeHtml(cert.expiryDate)}</div>
                            <div><strong>Certificate No:</strong> ${window.UTILS.escapeHtml(cert.id)}</div>
                        </div>
                    </div>
                </div>
                <div class="meta-info">This certificate remains the property of AuditCB360 and must be returned upon request. Verify validity at audit.companycertification.com/verify</div>
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
    const cert = state.certifications.find(c => String(c.id) === String(certId));
    if (!cert) return;

    document.getElementById('modal-title').textContent = 'Suspend/Withdraw Certificate';
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 8px;">
            <strong>Certificate:</strong> ${window.UTILS.escapeHtml(cert.id)}<br>
            <strong>Client:</strong> ${window.UTILS.escapeHtml(cert.client)}
        </div>
        <form id="cert-action-form">
            <div class="form-group">
                <label>Action <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="cert-action-type" required>
                    <option value="suspend">Suspend Certificate</option>
                    <option value="withdraw">Withdraw Certificate</option>
                </select>
            </div>
            <div class="form-group">
                <label>Reason <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="cert-action-reason" rows="3" required placeholder="Enter reason for this action..."></textarea>
            </div>
            <div class="form-group">
                <label>Effective Date</label>
                <input type="date" class="form-control" id="cert-action-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
            
            <hr style="margin: 1.5rem 0;">
            
            <h4 style="margin-bottom: 1rem; color: #0369a1;">
                <i class="fa-solid fa-building-columns" style="margin-right: 0.5rem;"></i>
                Accreditation Body Notification (ISO 17021 Clause 9.6)
            </h4>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="ab-notified" style="width: 18px; height: 18px;">
                    <span>AB has been notified of this action</span>
                </label>
            </div>
            <div class="form-group">
                <label>AB Notification Date</label>
                <input type="date" class="form-control" id="ab-notification-date">
            </div>
            <div class="form-group">
                <label>AB Reference/Notes</label>
                <input type="text" class="form-control" id="ab-reference" placeholder="e.g., Email ref, letter number...">
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const action = document.getElementById('cert-action-type').value;
        const reason = document.getElementById('cert-action-reason').value.trim();
        const effectiveDate = document.getElementById('cert-action-date').value;
        const abNotified = document.getElementById('ab-notified').checked;
        const abNotificationDate = document.getElementById('ab-notification-date').value;
        const abReference = document.getElementById('ab-reference').value.trim();

        if (!reason) {
            window.showNotification('Please enter a reason', 'error');
            return;
        }

        if (action === 'suspend') {
            cert.status = window.CONSTANTS.CERT_STATUS.SUSPENDED;
        } else if (action === 'withdraw') {
            cert.status = window.CONSTANTS.CERT_STATUS.WITHDRAWN;
        }

        cert.statusReason = reason;
        cert.statusEffectiveDate = effectiveDate;
        cert.abNotified = abNotified;
        cert.abNotificationDate = abNotificationDate || null;
        cert.abReference = abReference || null;

        cert.history.push({
            date: new Date().toISOString().split('T')[0],
            action: action,
            user: 'Admin',
            reason: reason,
            abNotified: abNotified,
            abNotificationDate: abNotificationDate
        });

        window.saveData();
        window.closeModal();
        renderCertificationModule();
        window.showNotification(`Certificate ${action}ed successfully`, 'success');
    };

    window.openModal();
};

window.restoreCertificate = function (certId) {
    const cert = state.certifications.find(c => String(c.id) === String(certId));
    if (confirm('Are you sure you want to restore this certificate to Valid status?')) {
        cert.status = window.CONSTANTS.CERT_STATUS.VALID;
        cert.history.push({ date: new Date().toISOString().split('T')[0], action: 'Restored', user: 'Admin' });
        window.saveData();
        renderCertificationModule();
    }
};

window.editCertificate = function (certId) {
    const cert = state.certifications.find(c => String(c.id) === String(certId));
    if (!cert) return;

    document.getElementById('modal-title').textContent = 'Edit Certificate Details';
    document.getElementById('modal-body').innerHTML = `
        <div style="background: #eff6ff; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; border: 1px solid #bfdbfe;">
             <strong>Certificate:</strong> ${window.UTILS.escapeHtml(cert.id)}<br>
             <strong>Client:</strong> ${window.UTILS.escapeHtml(cert.client)}
        </div>
        <form id="cert-edit-form">
            <div class="form-group">
                <label>Standard</label>
                <select class="form-control" id="edit-cert-standard">
                     ${["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018"].map(std =>
        `<option value="${std}" ${cert.standard === std ? 'selected' : ''}>${std}</option>`
    ).join('')}
                </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Issue Date</label>
                    <input type="date" class="form-control" id="edit-cert-issue" value="${cert.issueDate}">
                </div>
                <div class="form-group">
                    <label>Expiry Date</label>
                    <input type="date" class="form-control" id="edit-cert-expiry" value="${cert.expiryDate}">
                </div>
            </div>
            <div class="form-group">
                <label>Certification Scope</label>
                <textarea class="form-control" id="edit-cert-scope" rows="4">${window.UTILS.escapeHtml(cert.scope)}</textarea>
            </div>
            <div class="form-group">
                <label>Reason for Modification <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="edit-cert-reason" placeholder="e.g., Scope expansion, Typo correction" required>
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = () => {
        const standard = document.getElementById('edit-cert-standard').value;
        const issueDate = document.getElementById('edit-cert-issue').value;
        const expiryDate = document.getElementById('edit-cert-expiry').value;
        const scope = document.getElementById('edit-cert-scope').value.trim();
        const reason = document.getElementById('edit-cert-reason').value.trim();

        if (!reason || !scope) {
            window.showNotification('Scope and Reason are required', 'error');
            return;
        }

        cert.standard = standard;
        cert.issueDate = issueDate;
        cert.expiryDate = expiryDate;
        cert.scope = scope;

        cert.history.push({
            date: new Date().toISOString().split('T')[0],
            action: 'Certificate Maintained/Edited',
            user: window.state.currentUser?.name || 'Admin',
            reason: reason,
            changes: `Updated scope/details`
        });

        window.saveData();
        window.closeModal();
        renderCertificationModule();
        window.showNotification('Certificate details updated', 'success');
    };

    window.openModal();
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
            <p>Generated on: ${window.UTILS.formatDate(new Date())}</p>
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
                            <td>${window.UTILS.escapeHtml(c.id)}</td>
                            <td>${window.UTILS.escapeHtml(c.client)}</td>
                            <td>${window.UTILS.escapeHtml(c.standard)}</td>
                            <td class="status-${(c.status || '').toLowerCase()}">${window.UTILS.escapeHtml(c.status)}</td>
                            <td>${window.UTILS.escapeHtml(c.issueDate)}</td>
                            <td>${window.UTILS.escapeHtml(c.expiryDate)}</td>
                            <td>${window.UTILS.escapeHtml(c.scope)}</td>
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

// ============================================
// PUBLIC DIRECTORY (ISO 17021 Clause 9.3)
// ============================================

window.updatePublicDirectory = function () {
    const certs = window.state.certifications || [];
    const clients = window.state.clients || [];
    const showCertId = document.getElementById('show-cert-id')?.checked;
    const showClient = document.getElementById('show-client')?.checked;
    const showStandard = document.getElementById('show-standard')?.checked;
    const showScope = document.getElementById('show-scope')?.checked;
    const showIssueDate = document.getElementById('show-issue-date')?.checked;
    const showExpiryDate = document.getElementById('show-expiry-date')?.checked;
    const showActiveOnly = document.getElementById('show-active-only')?.checked;

    // Get internal client names to exclude
    const internalClientNames = clients.filter(c => c.type === 'internal').map(c => c.name);

    // Filter certificates - exclude internal clients and optionally filter by status
    let filteredCerts = certs.filter(c => !internalClientNames.includes(c.client));
    if (showActiveOnly) {
        filteredCerts = filteredCerts.filter(c => c.status === window.CONSTANTS.CERT_STATUS.VALID);
    }

    // Build table HTML
    let tableHTML = '<table><thead><tr>';
    if (showCertId) tableHTML += '<th>Certificate ID</th>';
    if (showClient) tableHTML += '<th>Client Organization</th>';
    if (showStandard) tableHTML += '<th>Standard</th>';
    tableHTML += '<th>Location</th>'; // Always show location as per ISO requirement (implied)
    if (showScope) tableHTML += '<th>Scope</th>';
    if (showIssueDate) tableHTML += '<th>Issue Date</th>';
    if (showExpiryDate) tableHTML += '<th>Expiry Date</th>';
    tableHTML += '</tr></thead><tbody>';

    filteredCerts.forEach(cert => {
        // Find client location
        const clientObj = clients.find(c => c.name === cert.client);
        let location = 'Unknown';
        if (clientObj && clientObj.sites && clientObj.sites.length > 0) {
            const site = clientObj.sites[0];
            location = [site.city, site.country].filter(Boolean).join(', ');
        }

        tableHTML += '<tr>';
        if (showCertId) tableHTML += `<td><strong>${window.UTILS.escapeHtml(cert.id)}</strong></td>`;
        if (showClient) tableHTML += `<td>${window.UTILS.escapeHtml(cert.client)}</td>`;
        if (showStandard) tableHTML += `<td><span class="badge bg-blue">${window.UTILS.escapeHtml(cert.standard)}</span></td>`;
        tableHTML += `<td>${window.UTILS.escapeHtml(location)}</td>`;
        if (showScope) tableHTML += `<td style="max-width: 300px;">${window.UTILS.escapeHtml((cert.scope || '').substring(0, 100))}${cert.scope && cert.scope.length > 100 ? '...' : ''}</td>`;
        if (showIssueDate) tableHTML += `<td>${window.UTILS.escapeHtml(cert.issueDate)}</td>`;
        if (showExpiryDate) tableHTML += `<td>${window.UTILS.escapeHtml(cert.expiryDate)}</td>`;
        tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';

    const container = document.getElementById('public-directory-table');
    if (container) {
        container.innerHTML = tableHTML;
    }
};

window.exportPublicDirectory = function () {
    const certs = window.state.certifications || [];
    const clients = window.state.clients || [];
    const showActiveOnly = document.getElementById('show-active-only')?.checked;

    // Get internal client names to exclude
    const internalClientNames = clients.filter(c => c.type === 'internal').map(c => c.name);

    // Filter out internal clients
    let filteredCerts = certs.filter(c => !internalClientNames.includes(c.client));
    if (showActiveOnly) {
        filteredCerts = filteredCerts.filter(c => c.status === window.CONSTANTS.CERT_STATUS.VALID);
    }

    // Build CSV
    let csv = 'Certificate ID,Client Organization,Standard,Location,Scope,Issue Date,Expiry Date,Status\n';
    filteredCerts.forEach(cert => {
        // Find client location
        const clientObj = clients.find(c => c.name === cert.client);
        let location = 'Unknown';
        if (clientObj && clientObj.sites && clientObj.sites.length > 0) {
            const site = clientObj.sites[0];
            location = [site.city, site.country].filter(Boolean).join(', '); // Sanitize CSV if needed, but simple join is usually safe for city/country
            if (location.includes(',')) location = `"${location}"`;
        }

        const row = [
            cert.id,
            cert.client,
            cert.standard,
            location,
            `"${(cert.scope || '').replace(/"/g, '""')}"`, // Escape quotes in scope
            cert.issueDate,
            cert.expiryDate,
            cert.status
        ].join(',');
        csv += row + '\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `certified-clients-directory-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    window.showNotification('Directory exported successfully', 'success');
};

window.generateEmbedCode = function () {
    const certs = window.state.certifications || [];
    const clients = window.state.clients || [];
    const showActiveOnly = document.getElementById('show-active-only')?.checked;

    // Get internal client names to exclude
    const internalClientNames = clients.filter(c => c.type === 'internal').map(c => c.name);

    // Filter out internal clients
    let filteredCerts = certs.filter(c => !internalClientNames.includes(c.client));
    if (showActiveOnly) {
        filteredCerts = filteredCerts.filter(c => c.status === window.CONSTANTS.CERT_STATUS.VALID);
    }

    // Generate HTML embed code
    let embedHTML = `<!-- Certified Clients Directory - Generated ${window.UTILS.formatDate(new Date())} -->
<div style="font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto;">
    <h2 style="color: #0284c7; margin-bottom: 1rem;">
        <span style="margin-right: 0.5rem;">🌐</span>Certified Clients Directory
    </h2>
    <table style="width: 100%; border-collapse: collapse; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <thead>
            <tr style="background: #f1f5f9;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1;">Certificate ID</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1;">Organization</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1;">Standard</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1;">Location</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1;">Valid Until</th>
            </tr>
        </thead>
        <tbody>`;

    filteredCerts.forEach((cert, index) => {
        // Find client location
        const clientObj = clients.find(c => c.name === cert.client);
        let location = 'Unknown';
        if (clientObj && clientObj.sites && clientObj.sites.length > 0) {
            const site = clientObj.sites[0];
            location = [site.city, site.country].filter(Boolean).join(', ');
        }

        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        embedHTML += `
            <tr style="background: ${bgColor};">
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${cert.id}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${cert.client}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${cert.standard}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${location}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${cert.expiryDate}</td>
            </tr>`;
    });

    embedHTML += `
        </tbody>
    </table>
    <p style="color: #64748b; font-size: 0.875rem; margin-top: 1rem;">
        Last updated: ${window.UTILS.formatDate(new Date())} | Total certified clients: ${filteredCerts.length}
    </p>
</div>`;

    // Show in modal
    document.getElementById('modal-title').textContent = 'Embed Code - Public Directory';
    document.getElementById('modal-body').innerHTML = `
        <p style="margin-bottom: 1rem; color: var(--text-secondary);">Copy the HTML code below and paste it into your website:</p>
        <textarea readonly style="width: 100%; height: 300px; font-family: monospace; font-size: 0.85rem; padding: 1rem; border: 1px solid var(--border-color); border-radius: 4px;">${embedHTML}</textarea>
        <button class="btn btn-secondary" data-action="copyCertEmbed" style="margin-top: 1rem;">
            <i class="fa-solid fa-copy" style="margin-right: 0.5rem;"></i>Copy to Clipboard
        </button>
    `;
    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
};

window.updateCertExpiryDate = function () {
    const issueDateInput = document.getElementById('cert-issue-date');
    const expiryDateInput = document.getElementById('cert-expiry-date');

    if (!issueDateInput || !expiryDateInput) return;

    const issueDate = new Date(issueDateInput.value);
    if (isNaN(issueDate.getTime())) {
        expiryDateInput.value = '';
        return;
    }

    // Calculate expiry date: Issue Date + 364 days
    const expiryDate = new Date(issueDate);
    expiryDate.setDate(issueDate.getDate() + 364);

    // Format to YYYY-MM-DD
    expiryDateInput.value = expiryDate.toISOString().split('T')[0];
};
