// ============================================
// CLIENTS MODULE - Import/Export, Certificates & Setup
// Extracted from clients-module.js for maintainability
// Contains: getClientOrgSetupHTML, renderWizardStep, setSetupWizardStep,
//   getClientCertificatesHTML, generateCertificatesFromStandards,
//   certificate CRUD, import/export templates, logo upload,
//   auditor assignments, getClientSettingsHTML
// ============================================


    // ============================================
    // BULK IMPORT / EXPORT FUNCTIONS
    // ============================================

    function getClientOrgSetupHTML(client) {
        // Initialize wizard step if not exists
        if (!client._wizardStep) client._wizardStep = 1;
        const currentStep = client._wizardStep;

        const steps = [
            { id: 1, title: 'Org Context', icon: 'fa-building', color: '#6366f1' },
            { id: 2, title: 'Sites', icon: 'fa-map-location-dot', color: '#ec4899' },
            { id: 3, title: 'Departments', icon: 'fa-sitemap', color: '#8b5cf6' },
            { id: 4, title: 'Designations', icon: 'fa-id-badge', color: '#84cc16' },
            { id: 5, title: 'Personnel', icon: 'fa-address-book', color: '#10b981' },
            { id: 6, title: 'Goods/Services', icon: 'fa-boxes-stacked', color: '#f59e0b' },
            { id: 7, title: 'Key Processes', icon: 'fa-diagram-project', color: '#06b6d4' }
        ];

        const progressWidth = ((currentStep - 1) / (steps.length - 1)) * 100;

        return `
        <div class="wizard-container fade-in" style="background: #fff; border-radius: 12px; overflow: hidden;">
            <!-- Wizard Header / Progress -->
            <div style="background: #f8fafc; padding: 2rem; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; position: relative; max-width: 800px; margin-left: auto; margin-right: auto;">
                    <!-- Background Line -->
                    <div style="position: absolute; top: 24px; left: 0; right: 0; height: 3px; background: #e2e8f0; z-index: 1;"></div>
                    <!-- Active Progress Line -->
                    <div style="position: absolute; top: 24px; left: 0; width: ${progressWidth}%; height: 3px; background: var(--primary-color); z-index: 2; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                    
                    ${steps.map(step => `
                        <div style="position: relative; z-index: 3; display: flex; flex-direction: column; align-items: center; cursor: pointer;" data-action="setSetupWizardStep" data-arg1="${client.id}" data-arg2="${step.id}">
                            <div style="width: 50px; height: 50px; border-radius: 50%; background: ${currentStep >= step.id ? 'var(--primary-color)' : '#fff'}; border: 3px solid ${currentStep >= step.id ? 'var(--primary-color)' : '#e2e8f0'}; color: ${currentStep >= step.id ? '#fff' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: all 0.3s ease; box-shadow: ${currentStep === step.id ? '0 0 0 4px rgba(79, 70, 229, 0.2)' : 'none'};">
                                <i class="fa-solid ${step.icon}"></i>
                            </div>
                            <span style="margin-top: 0.75rem; font-size: 0.85rem; font-weight: ${currentStep === step.id ? '600' : '500'}; color: ${currentStep >= step.id ? 'var(--text-primary)' : '#94a3b8'};">${step.title}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="text-align: center;">
                    <h2 style="margin: 0; font-size: 1.5rem; color: var(--primary-color);">${steps[currentStep - 1].title}${currentStep === 1 ? '' : ' Setup'}</h2>
                    <p style="color: var(--text-secondary); margin-top: 0.5rem; font-size: 0.9rem;">
                        ${currentStep === 1 ? 'Define the objects and context of the client group.' : `Step ${currentStep} of ${steps.length}: Finalize organization boundaries and entities.`}
                    </p>
                </div>
            </div>

            <!-- Wizard Content -->
            <div id="org-setup-content" style="padding: 2rem; min-height: 400px; background: #fff;">
                ${getClientOrgSetupHTML.renderWizardStep(client, currentStep)}
            </div>

            <!-- Wizard Footer / Navigation -->
            <div style="padding: 1.5rem 2rem; background: #f8fafc; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <button class="btn btn-secondary" data-action="setSetupWizardStep" data-arg1="${client.id}" data-arg2="${currentStep - 1}" ${currentStep === 1 ? 'disabled' : ''} aria-label="Back">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Previous
                </button>
                
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">
                        ${currentStep === steps.length ? '<i class="fa-solid fa-check-circle" style="color: #10b981; margin-right: 0.5rem;"></i> Setup Complete' : `Next: ${steps[currentStep]?.title || ''}`}
                    </span>
                    ${currentStep < steps.length ? `
                        <button class="btn btn-primary" data-action="setSetupWizardStep" data-arg1="${client.id}" data-arg2="${currentStep + 1}">
                            Next Stage <i class="fa-solid fa-arrow-right" style="margin-left: 0.5rem;"></i>
                        </button>
                    ` : `
                        <button class="btn btn-primary" data-action="finalizeOrgSetup" data-id="${client.id}">
                            Finalize & View Scopes <i class="fa-solid fa-flag-checkered" style="margin-left: 0.5rem;"></i>
                        </button>
                    `}
                </div>
            </div>
        </div>

        <div style="margin-top: 1.5rem; padding: 1rem; background: #fffbeb; border-radius: 8px; border: 1px solid #fde68a; display: flex; gap: 1rem; align-items: center;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i class="fa-solid fa-shield-check"></i>
            </div>
            <p style="margin: 0; font-size: 0.85rem; color: #92400e; line-height: 1.5;">
                <strong>Certification Standard Notice:</strong> As a Certification Manager, ensuring the accuracy of sites, departments, and personnel 
                is a mandatory requirement under <strong>ISO/IEC 17021-1</strong>. This data directly influences the audit duration and sampling plan.
            </p>
        </div>
    `;
    }

    getClientOrgSetupHTML.renderWizardStep = function (client, step) {
        step = parseInt(step, 10) || 1; // DOM data-arg2 returns strings; switch needs numbers
        switch (step) {
            case 1: return getClientProfileHTML(client);
            case 2: return getClientSitesHTML(client);
            case 3: return getClientDepartmentsHTML(client);
            case 4: return getClientDesignationsHTML(client);
            case 5: return getClientContactsHTML(client);
            case 6: return getClientGoodsServicesHTML(client);
            case 7: return getClientKeyProcessesHTML(client);
            default: return getClientProfileHTML(client);
        }
    };

    window.setSetupWizardStep = function (clientId, step) {
        step = parseInt(step, 10); // DOM data-arg2 returns strings
        if (step < 1 || step > 7 || isNaN(step)) return;
        const client = window.DataService.findClient(clientId);
        if (client) {
            client._wizardStep = step;
            const tabContent = document.getElementById('tab-content');
            if (tabContent) {
                tabContent.innerHTML = getClientOrgSetupHTML(client);
                // Re-initialize any components if needed
                window.saveData(); // Save step progress
            }
        }
    };

    function getClientCertificatesHTML(client) {
        const certs = client.certificates || [];
        const allStandards = new Set();

        // Collect all standards from client global and sites
        if (client.standard) client.standard.split(',').map(s => s.trim()).forEach(s => allStandards.add(s));
        if (client.sites) {
            client.sites.forEach(site => {
                if (site.standards) site.standards.split(',').map(s => s.trim()).forEach(s => allStandards.add(s));
            });
        }

        if (certs.length === 0 && allStandards.size > 0) {
            return `
            <div class="fade-in" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-certificate" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                <h3>Initialize Certification Records</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                    Detected standards: ${Array.from(allStandards).join(', ')}.<br>
                    Click below to generate certificate records for these standards to manage scopes and revisions.
                </p>
                <button class="btn btn-primary" data-action="generateCertificatesFromStandards" data-id="${client.id}" aria-label="Auto-generate">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Records
                </button>
            </div>
        `;
        }

        return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-certificate" style="margin-right: 0.5rem;"></i> Certification Scopes & History
                </h3>
                <button class="btn btn-secondary btn-sm" data-action="generateCertificatesFromStandards" data-id="${client.id}" aria-label="Sync">
                    <i class="fa-solid fa-sync" style="margin-right: 0.25rem;"></i> Sync Standards
                </button>
            </div>
            
            ${certs.map((cert, index) => {
            // Find sites relevant to this standard
            const relevantSites = (client.sites || []).filter(s =>
                (s.standards && s.standards.includes(cert.standard)) ||
                (!s.standards && client.standard && client.standard.includes(cert.standard)) // Fallback if site has no standards defined but client does
            );

            return `
                <div class="card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary-color);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                        <div>
                            <span class="badge" style="background: var(--primary-color); color: white; font-size: 0.9rem; margin-bottom: 0.5rem;">${cert.standard}</span>
                            <div style="font-size: 1.1rem; font-weight: 600; margin-top: 0.5rem;">
                                Cert #: <input type="text" value="${cert.certificateNo || ''}" 
                                    style="border: 1px solid #ccc; padding: 2px 5px; border-radius: 4px; width: 150px;"
                                    data-action-change="updateCertField" data-arg1="${client.id}" data-arg2="${index}" data-arg3="certificateNo" data-arg4="this.value">
                            </div>
                        </div>
                        <div style="text-align: right;">
                             <button class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem; margin-right: 0.5rem;" data-action="viewCertRevisionHistory" data-arg1="${client.id}" data-arg2="${index}" title="View revision history for this certification" aria-label="History">
                                <i class="fa-solid fa-history"></i> Revision History
                             </button>
                             <button class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem; color: var(--danger-color); border-color: var(--danger-color);" data-action="deleteCertificationScope" data-arg1="${client.id}" data-arg2="${index}" title="Remove this certification scope" aria-label="Delete">
                                <i class="fa-solid fa-trash"></i>
                             </button>
                             <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                Current Rev: <strong>${cert.revision || '00'}</strong>
                             </div>
                        </div>
                    </div>

                    <!-- Main Scope (Hidden/Removed per request) -->
                    <!-- 
                    <div style="margin-bottom: 1.5rem;">
                        <label style="font-weight: 600; color: var(--text-secondary); font-size: 0.85rem;">Global / Main Scope Text (Fallback)</label>
                        <textarea class="form-control" rows="2" 
                            data-action-change="updateCertField" data-arg1="${client.id}" data-arg2="${index}" data-arg3="scope" data-arg4="this.value"
                            placeholder="Enter the main scope statement...">${cert.scope || ''}</textarea>
                    </div> 
                    -->

                    <!-- Site Specific Scopes -->
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 6px;">
                        <h4 style="margin: 0 0 1rem 0; font-size: 1rem; color: var(--primary-color);">
                            <i class="fa-solid fa-location-dot"></i> Site-Specific Scopes (Annex)
                        </h4>
                        ${relevantSites.length > 0 ? `
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="text-align: left; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 0.5rem; width: 25%;">Site</th>
                                    <th style="padding: 0.5rem;">Scope of Activity (For this Standard)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${relevantSites.map(site => {
                const siteScope = (cert.siteScopes && cert.siteScopes[site.name])
                    ? cert.siteScopes[site.name]
                    : (cert.scope || ''); // Default to global scope if empty
                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 0.75rem 0.5rem; vertical-align: top;">
                                            <strong>${site.name}</strong><br>
                                            <span style="font-size: 0.8rem; color: #64748b;">${site.city}, ${site.country}</span>
                                        </td>
                                        <td style="padding: 0.75rem 0.5rem;">
                                            <textarea class="form-control" rows="2" 
                                                style="font-size: 0.9rem;"
                                                data-action-change="updateSiteScope" data-arg1="${client.id}" data-arg2="${index}" data-arg3="${site.name}" data-arg4="this.value"
                                                placeholder="Define specific scope for this site...">${siteScope}</textarea>
                                        </td>
                                    </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                        ` : '<p style="font-style: italic; color: #94a3b8;">No sites linked to this standard.</p>'}
                    </div>

                    <div style="margin-top: 1rem; display: flex; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                         <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                            <div>
                                <label style="font-size: 0.8rem;">Initial Date</label>
                                <div style="display: flex; gap: 4px;">
                                    <input type="text" class="form-control" value="${cert.initialDate || ''}" placeholder="e.g. 15-Mar-2024" style="flex: 1;" data-action-change="updateCertField" data-arg1="${client.id}" data-arg2="${index}" data-arg3="initialDate" data-arg4="this.value">
                                    <input type="date" style="width: 36px; padding: 0 4px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; opacity: 0.5;" title="Pick date" data-action-change="formatDatePrev">
                                </div>
                            </div>
                            <div>
                                <label style="font-size: 0.8rem;">Current Issue</label>
                                <div style="display: flex; gap: 4px;">
                                    <input type="text" class="form-control cert-current-issue" value="${cert.currentIssue || ''}" placeholder="e.g. 15-Mar-2025" style="flex: 1;" data-action-change="updateCertFieldAndExpiry" data-arg1="${client.id}" data-arg2="${index}" data-arg3="currentIssue">
                                    <input type="date" style="width: 36px; padding: 0 4px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; opacity: 0.5;" title="Pick date" data-action-change="formatDatePrev">
                                </div>
                            </div>
                            <div>
                                <label style="font-size: 0.8rem;">Expiry Date</label>
                                <div style="display: flex; gap: 4px;">
                                    <input type="text" class="form-control cert-expiry" value="${cert.expiryDate || ''}" placeholder="e.g. 14-Mar-2027" style="flex: 1;" data-action-change="updateCertField" data-arg1="${client.id}" data-arg2="${index}" data-arg3="expiryDate" data-arg4="this.value">
                                    <input type="date" style="width: 36px; padding: 0 4px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; opacity: 0.5;" title="Pick date" data-action-change="formatDatePrev">
                                </div>
                            </div>
                         </div>
                         <div style="display: flex; align-items: flex-end;">
                            <button class="btn btn-primary" data-action="saveCertificateDetails" data-id="${client.id}" aria-label="Save">
                                <i class="fa-solid fa-save"></i> Save Changes
                            </button>
                         </div>
                    </div>
                </div>
                `;
        }).join('')}
        </div>
    `;
    }

    window.generateCertificatesFromStandards = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        const allStandards = new Set();
        if (client.standard) client.standard.split(',').map(s => s.trim()).forEach(s => allStandards.add(s));
        if (client.sites) {
            client.sites.forEach(site => {
                if (site.standards) site.standards.split(',').map(s => s.trim()).forEach(s => allStandards.add(s));
            });
        }

        if (!client.certificates) client.certificates = [];

        allStandards.forEach(std => {
            if (!client.certificates.find(c => c.standard === std)) {
                client.certificates.push({
                    id: 'CERT-' + Date.now() + '-' + Math.floor(Math.random() * 10000), // Generate ID
                    standard: std,
                    certificateNo: '',
                    status: 'Active',
                    revision: '00',
                    scope: client.scope || '', // Default global scope
                    siteScopes: {}
                });
            }
        });

        window.DataService.syncClient(client);
        renderClientDetail(clientId);
        // Switch to scopes tab
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="scopes"]')?.click();
        }, 100);
        window.showNotification('Certificate records generated');
    };

    window.updateCertField = function (clientId, certIndex, field, value) {
        const client = window.DataService.findClient(clientId);
        if (client && client.certificates && client.certificates[certIndex]) {
            client.certificates[certIndex][field] = value;
            // Autosave turned off to allow bulk edits, but for single inputs we might want to save?
            // Let's rely on the explicit "Save" button for major changes, but keep local state updated.
        }
    };

    // Auto-fill Expiry Date = Current Issue + 364 days
    window.autoFillExpiry = function (currentIssueEl) {
        try {
            const val = currentIssueEl.value;
            if (!val) return;
            const d = new Date(val);
            if (isNaN(d.getTime())) return;
            d.setDate(d.getDate() + 364);
            const formatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            // Find the expiry input in the same card
            const card = currentIssueEl.closest('.card');
            if (!card) return;
            const expiryEl = card.querySelector('.cert-expiry');
            if (expiryEl) {
                expiryEl.value = formatted;
                expiryEl.dispatchEvent(new Event('change'));
            }
        } catch (e) { console.warn('autoFillExpiry:', e); }
    };

    window.updateSiteScope = function (clientId, certIndex, siteName, value) {
        const client = window.DataService.findClient(clientId);
        if (client && client.certificates && client.certificates[certIndex]) {
            if (!client.certificates[certIndex].siteScopes) {
                client.certificates[certIndex].siteScopes = {};
            }
            client.certificates[certIndex].siteScopes[siteName] = value;
        }
    };

    window.saveCertificateDetails = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        // Save locally first
        window.saveData();

        // Sync to Supabase
        if (window.SupabaseClient?.isInitialized) {
            const syncPromises = [];

            // 1. Sync the CLIENT object (so data.certificates JSONB persists dates)
            syncPromises.push(
                window.DataService.syncClient(client, { saveLocal: false, silent: true })
            );

            // 2. Sync individual certs to certification_decisions table
            if (client.certificates && client.certificates.length > 0) {
                let successCount = 0;
                const certPromises = client.certificates.map((cert, i) => {
                    if (!cert.client) cert.client = client.name;

                    // SELF-HEAL: If cert has no ID (legacy bug), generate one now
                    if (!cert.id) {
                        cert.id = 'CERT-' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '-' + i;
                    }

                    return window.SupabaseClient.upsertCertificate(cert)
                        .then(() => successCount++)
                        .catch(err => console.error(`Failed to save cert ${cert.id}:`, err));
                });

                syncPromises.push(
                    Promise.all(certPromises).then(() => {
                        if (successCount > 0) {
                            window.showNotification(`Saved ${successCount} certificates successfully`, 'success');
                        } else {
                            window.showNotification('Failed to save certificates to cloud', 'error');
                        }
                    })
                );
            }

            Promise.all(syncPromises).catch(error => {
                console.error('Save Certificate Error:', error);
                window.showNotification('Cloud save failed: ' + (error.message || 'Unknown error'), 'error');
            });
        } else {
            // Fallback for local-only
            window.showNotification('Certificate details saved locally', 'success');
        }
    };

    window.viewCertRevisionHistory = function (clientId, certIndex) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.certificates || !client.certificates[certIndex]) return;

        const cert = client.certificates[certIndex];
        const history = cert.revisionHistory || [];

        document.getElementById('modal-title').textContent = `Revision History - ${cert.standard}`;
        document.getElementById('modal-body').innerHTML = `
        \u003cdiv style="margin-bottom: 1rem;"\u003e
            \u003cp\u003e\u003cstrong\u003eCertificate:\u003c/strong\u003e ${cert.certificateNo || 'Not assigned'}\u003c/p\u003e
            \u003cp\u003e\u003cstrong\u003eCurrent Revision:\u003c/strong\u003e ${cert.revision || '00'}\u003c/p\u003e
        \u003c/div\u003e
        
        ${history.length > 0 ? `
            \u003cdiv class="table-container"\u003e
                \u003ctable\u003e
                    \u003cthead\u003e
                        \u003ctr\u003e
                            \u003cth\u003eRevision\u003c/th\u003e
                            \u003cth\u003eDate\u003c/th\u003e
                            \u003cth\u003eChange Description\u003c/th\u003e
                            \u003cth\u003eChanged By\u003c/th\u003e
                        \u003c/tr\u003e
                    \u003c/thead\u003e
                    \u003ctbody\u003e
                        ${history.map(h => `
                            \u003ctr\u003e
                                \u003ctd\u003e\u003cstrong\u003e${h.revision}\u003c/strong\u003e\u003c/td\u003e
                                \u003ctd\u003e${h.date}\u003c/td\u003e
                                \u003ctd\u003e${h.description}\u003c/td\u003e
                                \u003ctd\u003e${h.changedBy || 'N/A'}\u003c/td\u003e
                            \u003c/tr\u003e
                        `).join('')}
                    \u003c/tbody\u003e
                \u003c/table\u003e
            \u003c/div\u003e
        ` : `
            \u003cdiv style="text-align: center; padding: 2rem; color: var(--text-secondary);"\u003e
                \u003ci class="fa-solid fa-info-circle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"\u003e\u003c/i\u003e
                \u003cp\u003eNo revision history recorded yet.\u003c/p\u003e
                \u003cp style="font-size: 0.85rem;"\u003eRevisions are automatically tracked when scope changes are saved.\u003c/p\u003e
            \u003c/div\u003e
        `}
        
        \u003cdiv style="margin-top: 1.5rem; padding: 1rem; background: #eff6ff; border-radius: 6px;"\u003e
            \u003ch4 style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: #1d4ed8;"\u003eAdd New Revision\u003c/h4\u003e
            \u003cdiv class="form-group"\u003e
                \u003clabel\u003eRevision Number\u003c/label\u003e
                \u003cinput type="text" id="new-revision-number" class="form-control" placeholder="e.g., 01, 02" value="${String(parseInt(cert.revision || '00', 10) + 1).padStart(2, '0')}"\u003e
            \u003c/div\u003e
            \u003cdiv class="form-group"\u003e
                \u003clabel\u003eChange Description\u003c/label\u003e
                \u003ctextarea id="new-revision-description" class="form-control" rows="2" placeholder="Describe what changed in this revision..."\u003e\u003c/textarea\u003e
            \u003c/div\u003e
            \u003cbutton class="btn btn-primary btn-sm" data-action="addCertRevision" data-arg1="${clientId}" data-arg2="${certIndex}"\u003e
                \u003ci class="fa-solid fa-plus" style="margin-right: 0.5rem;"\u003e\u003c/i\u003eAdd Revision
            \u003c/button\u003e
        \u003c/div\u003e
    `;

        document.getElementById('modal-save').style.display = 'none';
        window.openModal();
    };

    window.addCertRevision = function (clientId, certIndex) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.certificates || !client.certificates[certIndex]) return;

        const cert = client.certificates[certIndex];
        const revisionNumber = document.getElementById('new-revision-number').value.trim();
        const description = document.getElementById('new-revision-description').value.trim();

        if (!revisionNumber || !description) {
            window.showNotification('Please enter revision number and description', 'error');
            return;
        }

        if (!cert.revisionHistory) cert.revisionHistory = [];

        cert.revisionHistory.push({
            revision: revisionNumber,
            date: new Date().toISOString().split('T')[0],
            description: description,
            changedBy: window.state.currentUser?.name || 'Admin'
        });

        cert.revision = revisionNumber;

        window.saveData();
        window.closeModal();
        window.showNotification('Revision added successfully', 'success');
        renderClientDetail(clientId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="scopes"]')?.click();
        }, 100);
    };

    window.deleteCertificationScope = function (clientId, certIndex) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.certificates || !client.certificates[certIndex]) return;

        const cert = client.certificates[certIndex];

        if (confirm(`Are you sure you want to remove the certification scope for ${cert.standard}?\n\nThis will delete all associated scope data and revision history.`)) {
            client.certificates.splice(certIndex, 1);
            window.saveData();
            window.showNotification('Certification scope removed', 'success');
            renderClientDetail(clientId);
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="scopes"]')?.click();
            }, 100);
        }
    };


    // Sub-Tab Switching for Org Setup
    window.switchClientOrgSubTab = function (btn, subTabId, clientId) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        // UI Feedback
        const container = btn.parentElement;
        container.querySelectorAll('.sub-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.color = 'var(--text-secondary)';
            b.style.borderBottom = 'none';
            b.style.fontWeight = 'normal';
        });
        btn.classList.add('active');
        btn.style.color = 'var(--primary-color)';
        btn.style.borderBottom = '2px solid var(--primary-color)';
        btn.style.fontWeight = '500';

        // Content Switching
        const contentArea = document.getElementById('org-setup-content');
        if (!contentArea) return;

        if (subTabId === 'certificates') {
            contentArea.innerHTML = getClientCertificatesHTML(client);
        } else if (subTabId === 'sites') {
            contentArea.innerHTML = getClientSitesHTML(client);
        } else if (subTabId === 'departments') {
            contentArea.innerHTML = getClientDepartmentsHTML(client);
        } else if (subTabId === 'contacts') {
            contentArea.innerHTML = getClientContactsHTML(client);
        }
    };


    // Update Template Download for Simplified Bulk Clients
    window.downloadImportTemplate = function () {
        // Simplified template with only 6 essential fields
        const headers = ["Name", "Industry", "Standard", "Contact Person", "Email", "Phone"];
        const row1 = ["Tech Solutions Ltd", "Information Technology", "ISO 9001", "John Doe", "john@techsolutions.com", "+1234567890"];
        const row2 = ["Global Manufacturing Inc", "Manufacturing", "ISO 9001:2015", "Jane Smith", "jane@globalmanuf.com", "+1987654321"];

        const csvContent = [headers, row1, row2]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const filename = 'AuditCB_Client_Import_Template.csv';

        // Add BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        // Try multiple download methods for maximum compatibility

        // Method 1: IE/Edge msSaveBlob
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(blob, filename);
            window.showNotification('Template downloaded as CSV', 'success');
            return;
        }

        // Method 2: Modern browsers with download attribute
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        // Set multiple attributes for maximum compatibility
        link.href = url;
        link.download = filename;
        link.setAttribute('download', filename);
        link.type = 'text/csv';
        link.rel = 'noopener';

        // Make link invisible but keep in DOM
        link.style.position = 'fixed';
        link.style.top = '-9999px';
        link.style.left = '-9999px';

        document.body.appendChild(link);

        // Force click with multiple methods
        if (link.click) {
            link.click();
        } else if (document.createEvent) {
            const event = document.createEvent('MouseEvents');
            event.initEvent('click', true, true);
            link.dispatchEvent(event);
        }

        // Cleanup after a delay
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 250);

        window.showNotification('Template downloaded as CSV (opens in Excel)', 'success');
    };

    // Fallback: Download template as CSV
    // eslint-disable-next-line no-unused-vars
    function downloadTemplateAsCSV() {
        const headers = ["Client Name", "Status", "Industry", "Employee Count", "Website", "Next Audit Date", "Applicable Standards", "Contact Name", "Contact Email", "Address", "City", "Country"];
        const row1 = ["Sample Corp", "Active", "Manufacturing", "100", "https://sample.com", "2025-01-01", "ISO 9001:2015", "John Doe", "john@sample.com", "123 Main St", "New York", "USA"];
        const row2 = ["Tech Solutions Inc", "Active", "IT Services", "50", "https://techsol.com", "2025-03-15", "ISO 27001:2022", "Alice Tech", "alice@techsol.com", "789 Tech Blvd", "San Francisco", "USA"];

        const csvContent = [headers, row1, row2]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        // Add BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'AuditCB_Client_Import_Template.csv');
        link.style.visibility = 'hidden';

        document.body.appendChild(link);

        // Trigger download with a small delay to ensure DOM is ready
        setTimeout(() => {
            link.click();
            document.body.removeChild(link);

            // Clean up blob URL after a delay
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 100);
        }, 10);

        window.showNotification('Template downloaded as CSV (open in Excel)', 'success');
    }

    // Update Import Logic for Simplified Bulk Clients (supports CSV and Excel)
    window.importClientsFromExcel = function (file) {
        window.showNotification('Reading file...', 'info');
        const reader = new FileReader();

        // Check if it's a CSV file
        const isCSV = file.name.toLowerCase().endsWith('.csv');

        reader.onload = function (e) {
            try {
                let clientsRaw = [];

                if (isCSV) {
                    // Parse CSV file properly from ArrayBuffer
                    const decoder = new TextDecoder('utf-8');
                    const text = decoder.decode(new Uint8Array(e.target.result));

                    // Simple CSV Parser handling quotes
                    const parseCSVLine = (line) => {
                        const result = [];
                        let start = 0;
                        let inQuotes = false;
                        for (let i = 0; i < line.length; i++) {
                            if (line[i] === '"') {
                                inQuotes = !inQuotes;
                            } else if (line[i] === ',' && !inQuotes) {
                                let field = line.substring(start, i).trim();
                                // Remove surrounding quotes and handle escaped quotes
                                if (field.startsWith('"') && field.endsWith('"')) {
                                    field = field.slice(1, -1).replace(/""/g, '"');
                                }
                                result.push(field);
                                start = i + 1;
                            }
                        }
                        // Last field
                        let field = line.substring(start).trim();
                        if (field.startsWith('"') && field.endsWith('"')) {
                            field = field.slice(1, -1).replace(/""/g, '"');
                        }
                        result.push(field);
                        return result;
                    };

                    const lines = text.split(/\r?\n/).filter(line => line.trim());

                    if (lines.length < 2) {
                        throw new Error('CSV file is empty or has no data rows');
                    }

                    // Parse header
                    const headers = parseCSVLine(lines[0]);

                    // Parse data rows
                    for (let i = 1; i < lines.length; i++) {
                        const values = parseCSVLine(lines[i]);
                        const row = {};
                        headers.forEach((header, index) => {
                            // Clean header name (remove BOM if present)
                            const cleanHeader = header.replace(/^\ufeff/, '').trim();
                            row[cleanHeader] = values[index] || '';
                        });
                        clientsRaw.push(row);
                    }
                } else {
                    // Parse Excel file
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Validate Sheets
                    if (!workbook.Sheets['Clients']) throw new Error("Missing 'Clients' sheet");

                    clientsRaw = XLSX.utils.sheet_to_json(workbook.Sheets['Clients']);
                }

                let importedCount = 0;
                let updatedCount = 0;

                clientsRaw.forEach(row => {
                    // Support both old and new template formats
                    const name = row['Name'] || row['Client Name'];
                    if (!name) return;

                    // Check existing
                    let client = window.state.clients.find(c => c.name.toLowerCase() === name.toLowerCase());

                    if (client) {
                        updatedCount++;
                    } else {
                        client = {
                            id: crypto.randomUUID(),
                            name: window.Sanitizer.sanitizeText(name),
                            status: 'Active', // Default status
                            contacts: [],
                            sites: [],
                            certificates: []
                        };
                        window.state.clients.push(client);
                        importedCount++;
                    }

                    // Update fields from simplified template (6 fields)
                    client.industry = window.Sanitizer.sanitizeText(row['Industry'] || client.industry || '');
                    client.standard = window.Sanitizer.sanitizeText(row['Standard'] || row['Applicable Standards'] || client.standard || '');

                    // Handle contact information
                    const contactPerson = row['Contact Person'] || row['Contact Name'];
                    const contactEmail = row['Email'] || row['Contact Email'];
                    const contactPhone = row['Phone'];

                    if (contactPerson || contactEmail || contactPhone) {
                        // Update or create primary contact
                        if (!client.contacts || client.contacts.length === 0) {
                            client.contacts = [{
                                name: window.Sanitizer.sanitizeText(contactPerson || ''),
                                email: window.Sanitizer.sanitizeEmail(contactEmail || ''),
                                phone: window.Sanitizer.sanitizeText(contactPhone || ''),
                                role: 'Primary Contact'
                            }];
                        } else {
                            // Update existing primary contact
                            client.contacts[0].name = window.Sanitizer.sanitizeText(contactPerson || client.contacts[0].name);
                            client.contacts[0].email = window.Sanitizer.sanitizeEmail(contactEmail || client.contacts[0].email);
                            client.contacts[0].phone = window.Sanitizer.sanitizeText(contactPhone || client.contacts[0].phone);
                        }
                    }

                    // Backward compatibility with old template fields
                    if (row['Status']) client.status = window.Sanitizer.sanitizeText(row['Status']);
                    if (row['Employee Count']) client.employees = parseInt(row['Employee Count'], 10) || 0;
                    if (row['Website']) client.website = window.Sanitizer.sanitizeURL(row['Website']);
                    if (row['Next Audit Date']) client.nextAudit = row['Next Audit Date'];

                    // Update Contact
                    if (row['Contact Name']) {
                        const contact = {
                            name: window.Sanitizer.sanitizeText(row['Contact Name']),
                            email: window.Sanitizer.sanitizeText(row['Contact Email'] || ''),
                            designation: 'Primary Contact'
                        };
                        // Simplified: Replace first contact if it exists, otherwise add
                        if (client.contacts && client.contacts.length > 0) {
                            client.contacts[0] = { ...client.contacts[0], ...contact };
                        } else {
                            client.contacts = [contact];
                        }
                    }

                    // Update Site (Head Office)
                    if (row['Address'] || row['City'] || row['Country']) {
                        const site = {
                            name: 'Head Office',
                            address: window.Sanitizer.sanitizeText(row['Address'] || ''),
                            city: window.Sanitizer.sanitizeText(row['City'] || ''),
                            country: window.Sanitizer.sanitizeText(row['Country'] || ''),
                            standards: client.standard
                        };
                        // Simplified: Replace first site if it exists, otherwise add
                        if (client.sites && client.sites.length > 0) {
                            client.sites[0] = { ...client.sites[0], ...site };
                        } else {
                            client.sites = [site];
                        }
                    }
                });

                window.saveData();
                window.showNotification(`Import Successful: ${importedCount} created, ${updatedCount} updated`, 'success');
                if (typeof window.renderClientsEnhanced === 'function') window.renderClientsEnhanced();

            } catch (err) {
                console.error(err);
                window.showNotification('Import Failed: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // ============================================
    // ACCOUNT SETUP BULK IMPORT (MASTER UPLOAD)
    // ============================================

    window.openImportAccountSetupModal = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.openModal(
            'Bulk Import Account Setup',
            `
        <div style="text-align: center; margin-bottom: 2rem;">
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Upload a single Excel file containing multiple sheets to populate Sites, Departments, Designations, Personnel, Goods/Services, and Key Processes.
            </p>
            
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 2rem;">
                <!-- Step 1: Download Template -->
                <div class="card" style="flex: 1; padding: 1.5rem; text-align: center; border: 1px dashed var(--primary-color);">
                    <i class="fa-solid fa-file-excel" style="font-size: 2rem; color: #10b981; margin-bottom: 1rem;"></i>
                    <h4 style="margin-bottom: 0.5rem;">Step 1: Get Template</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Download valid Excel structure</p>
                    <button class="btn btn-outline-primary btn-sm" data-action="downloadAccountSetupTemplate" data-id="${window.UTILS.escapeHtml(client.name)}" aria-label="Download">
                        <i class="fa-solid fa-download"></i> Download Template
                    </button>
                </div>

                <!-- Step 2: Upload Data -->
                <div class="card" style="flex: 1; padding: 1.5rem; text-align: center; border: 1px dashed var(--primary-color);">
                    <i class="fa-solid fa-upload" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                    <h4 style="margin-bottom: 0.5rem;">Step 2: Upload File</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Select filled Excel file</p>
                    <label class="btn btn-primary btn-sm">
                        <input type="file" accept=".xlsx, .xls" style="display: none;" data-action-change="processAccountSetupImport" data-arg1="${clientId}" data-arg2="this">
                        <i class="fa-solid fa-folder-open"></i> Select File
                    </label>
                </div>
            </div>

            <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; text-align: left; font-size: 0.9rem;">
                <strong>Included Sheets:</strong>
                <ul style="margin: 0.5rem 0 0 1.5rem; color: var(--text-secondary);">
                    <li>Sites</li>
                    <li>Departments</li>
                    <li>Designations</li>
                    <li>Personnel</li>
                    <li>GoodsServices</li>
                    <li>KeyProcesses</li>
                </ul>
            </div>
        </div>
        `
        );
        // Hide default Save button
        document.getElementById('modal-save').style.display = 'none';
    };

    window.downloadAccountSetupTemplate = function (clientName) {
        const wb = XLSX.utils.book_new();

        // 1. Sites Sheet
        const sitesData = [
            ["Site Name", "Address", "City", "Country", "Employees", "Shift (Yes/No)", "Standards"],
            ["Head Office", "123 Main St", "New York", "USA", "50", "No", "ISO 9001:2015"],
            ["Factory 1", "456 Industrial Rd", "Chicago", "USA", "200", "Yes", "ISO 9001:2015, ISO 14001:2015"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sitesData), "Sites");

        // 2. Departments Sheet
        const deptsData = [
            ["Department Name", "Risk Level"],
            ["HR", "Low"],
            ["Production", "High"],
            ["Quality", "Medium"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deptsData), "Departments");

        // 3. Designations Sheet
        const desigData = [
            ["Designation"],
            ["Manager"],
            ["Supervisor"],
            ["Operator"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(desigData), "Designations");

        // 4. Personnel Sheet
        const personnelData = [
            ["Name", "Designation", "Email", "Phone", "Role"],
            ["John Doe", "Manager", "john@example.com", "555-0101", "Management Rep"],
            ["Jane Smith", "Supervisor", "jane@example.com", "555-0102", "Audit Contact"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(personnelData), "Personnel");

        // 5. Goods/Services Sheet
        const goodsData = [
            ["Name", "Category", "Description"],
            ["Widget A", "Product", "Main product line"],
            ["Consulting", "Service", "Technical consultancy"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(goodsData), "GoodsServices");

        // 6. Key Processes Sheet
        const processData = [
            ["Process Name", "Category", "Owner"],
            ["Procurement", "Support", "Purchasing Manager"],
            ["Manufacturing", "Core", "Production Manager"],
            ["Sales", "Core", "Sales Director"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(processData), "KeyProcesses");

        const fileName = `${clientName.replace(/[^a-z0-9]/gi, '_')}_Setup_Template.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    window.processAccountSetupImport = function (clientId, input) {
        // RBAC Check
        if (!window.AuthManager || !window.AuthManager.canPerform('create', 'client')) {
            window.showNotification('Access Denied: Only Certification Managers or Admins can perform this action.', 'error');
            return;
        }

        const file = input.files[0];
        if (!file) return;

        window.closeModal(); // Close modal immediately to show notification
        window.showNotification(`Reading ${file.name}...`, 'info');

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const client = window.DataService.findClient(clientId);

                if (!client) throw new Error("Client not found");

                let log = { sites: 0, depts: 0, desig: 0, people: 0, goods: 0, procs: 0 };

                // Helper to clean string
                const clean = (val) => val ? String(val).trim() : '';

                // 1. Process Sites
                if (workbook.Sheets['Sites']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Sites']);
                    if (!client.sites) client.sites = [];
                    rows.forEach(r => {
                        client.sites.push({
                            name: clean(r['Site Name']),
                            address: clean(r['Address']),
                            city: clean(r['City']),
                            country: clean(r['Country']),
                            employees: parseInt(r['Employees'], 10) || 0,
                            shift: clean(r['Shift (Yes/No)']),
                            standards: clean(r['Standards'])
                        });
                    });
                    log.sites = rows.length;
                }

                // 2. Process Departments
                if (workbook.Sheets['Departments']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Departments']);
                    if (!client.departments) client.departments = [];
                    rows.forEach(r => {
                        const name = clean(r['Department Name']);
                        if (name && !client.departments.some(d => d.name === name)) {
                            client.departments.push({
                                name: name,
                                risk: clean(r['Risk Level']) || 'Medium',
                                head: '' // Not in template
                            });
                        }
                    });
                    log.depts = rows.length;
                }

                // 3. Process Designations
                if (workbook.Sheets['Designations']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Designations']);
                    if (!client.designations) client.designations = [];
                    rows.forEach(r => {
                        const desig = clean(r['Designation']);
                        if (desig && !client.designations.includes(desig)) {
                            client.designations.push(desig);
                        }
                    });
                    log.desig = rows.length;
                }

                // 4. Process Personnel
                if (workbook.Sheets['Personnel']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Personnel']);
                    if (!client.contacts) client.contacts = [];
                    rows.forEach(r => {
                        client.contacts.push({
                            name: clean(r['Name']),
                            designation: clean(r['Designation']),
                            email: clean(r['Email']),
                            phone: clean(r['Phone']),
                            role: clean(r['Role'])
                        });
                    });
                    log.people = rows.length;
                }

                // 5. Process Goods/Services
                if (workbook.Sheets['GoodsServices']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['GoodsServices']);
                    if (!client.goodsServices) client.goodsServices = [];
                    rows.forEach(r => {
                        client.goodsServices.push({
                            name: clean(r['Name']),
                            category: clean(r['Category']) || 'Product',
                            description: clean(r['Description'])
                        });
                    });
                    log.goods = rows.length;
                }

                // 6. Process Key Processes
                if (workbook.Sheets['KeyProcesses']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['KeyProcesses']);
                    if (!client.keyProcesses) client.keyProcesses = [];
                    rows.forEach(r => {
                        client.keyProcesses.push({
                            name: clean(r['Process Name']),
                            category: clean(r['Category']) || 'Core',
                            owner: clean(r['Owner'])
                        });
                    });
                    log.procs = rows.length;
                }

                window.saveData();
                renderClientDetail(clientId);
                window.showNotification(
                    `Import Complete: ${log.sites} Sites, ${log.depts} Depts, ${log.desig} Roles, ${log.people} Staff, ${log.goods} Goods, ${log.procs} Processes`,
                    'success'
                );

            } catch (err) {
                console.error('Import Error:', err);
                window.showNotification('Import Failed: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Exports
    window.renderClientsModule = window.renderClientsEnhanced;
    // Ensure other helpers are exposed if defined locally but used in HTML
    if (typeof openNewClientModal !== 'undefined') window.openNewClientModal = openNewClientModal;

    if (typeof initiateAuditPlanFromClient !== 'undefined') window.initiateAuditPlanFromClient = initiateAuditPlanFromClient;
    if (typeof renderClientDetail !== 'undefined') window.renderClientDetail = renderClientDetail;

    // Client Logo Upload Functions
    window._tempClientLogo = '';

    window.previewClientLogo = function (input) {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            window.showNotification('Logo too large. Max 1MB', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            window._tempClientLogo = e.target.result;
            const preview = document.getElementById('client-logo-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;">`;
            }
        };
        reader.readAsDataURL(file);
    };

    window.handleClientLogoUpload = function (input, clientId) {
        if (!clientId) clientId = window.state.activeClientId;
        const file = input.files[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            window.showNotification('Logo too large. Max 1MB', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const client = window.DataService.findClient(clientId);
            if (client) {
                client.logoUrl = e.target.result;
                window.DataService.syncClient(client);
                const preview = document.getElementById('edit-client-logo-preview');
                if (preview) {
                    preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;">`;
                }
                window.showNotification('Logo uploaded', 'success');
                // Update header if in client workspace
                updateClientWorkspaceHeader(clientId);
            }
        };
        reader.readAsDataURL(file);
    };

    function updateClientWorkspaceHeader(clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        const logoContainer = document.getElementById('cb-logo-display');
        if (logoContainer) {
            if (client.logoUrl) {
                logoContainer.innerHTML = `<img src="${window.UTILS.escapeHtml(client.logoUrl)}" style="max-height: 40px; max-width: 180px; object-fit: contain;" alt="${window.UTILS.escapeHtml(client.name)}">`;
            } else {
                const eName = window.UTILS.escapeHtml(client.name);
                const truncated = eName.length > 20 ? eName.substring(0, 20) + '...' : eName;
                logoContainer.innerHTML = `<i class="fa-solid fa-building" style="color: var(--primary-color);"></i><h1 style="font-size: 1rem;">${truncated}</h1>`;
            }
        }
    }
    window.updateClientWorkspaceHeader = updateClientWorkspaceHeader;

    // ============================================
    // CLIENT-LEVEL AUDITOR ASSIGNMENT FUNCTIONS
    // ============================================

    // Open modal to assign an auditor to this client
    window.openClientAuditorAssignmentModal = function (clientId, clientName) {
        const _client = window.DataService.findClient(clientId);
        const auditors = window.state.auditors || [];
        const assignments = window.state.auditorAssignments || [];
        // Check if there are any auditors in the system
        if (auditors.length === 0) {
            window.showNotification('No auditors found in the system. Please add auditors first from the Auditors module.', 'warning');
            return;
        }

        // Get auditors not yet assigned to this client
        const assignedAuditorIds = assignments
            .filter(a => String(a.clientId) === String(clientId))
            .map(a => String(a.auditorId));
        const availableAuditors = auditors.filter(a => !assignedAuditorIds.includes(String(a.id)));
        if (availableAuditors.length === 0) {
            window.showNotification('All auditors are already assigned to this client.', 'info');
            return;
        }

        document.getElementById('modal-title').textContent = `Assign Auditor to ${clientName}`;
        document.getElementById('modal-body').innerHTML = `
        <div class="form-group">
            <label>Select Auditor to Assign</label>
            <select id="client-assign-auditor" class="form-control" required>
                <option value="">-- Select Auditor --</option>
                ${availableAuditors.map(a => `<option value="${a.id}">${window.UTILS.escapeHtml(a.name)} (${a.role || 'Auditor'})</option>`).join('')}
            </select>
        </div>
        <div class="alert alert-info" style="margin-top: 1rem; padding: 0.75rem; background: #eff6ff; color: #1e40af; border-radius: 6px; border: 1px solid #bfdbfe;">
            <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
            The selected auditor will be able to access this client's data, view audit plans, and submit reports.
        </div>
    `;

        document.getElementById('modal-save').style.display = '';
        document.getElementById('modal-save').onclick = function () {
            const auditorId = document.getElementById('client-assign-auditor').value;

            if (!auditorId) {
                window.showNotification('Please select an auditor.', 'error');
                return;
            }

            // Initialize if not exists
            if (!window.state.auditorAssignments) {
                window.state.auditorAssignments = [];
            }

            const auditor = window.state.auditors.find(a => String(a.id) === String(auditorId));

            const assignment = {
                id: Date.now(),
                auditorId: String(auditorId),
                userId: auditor?.userId || auditor?.user_id || null, // Include UUID if available
                clientId: String(clientId),
                role: auditor?.role || 'Auditor',
                assignedBy: window.state.currentUser?.name || 'System',
                assignedAt: new Date().toISOString()
            };

            // Add new assignment
            window.state.auditorAssignments.push(assignment);

            window.DataService.syncAuditorAssignments();

            window.closeModal();

            // Direct UI Refresh
            const container = document.getElementById('client-audit-team-container');
            if (container) {
                const updatedClient = window.DataService.findClient(clientId);
                // parse the string returned by getClientAuditTeamHTML or just replace outerHTML
                // getClientAuditTeamHTML returns a template string starting with <div class="card" id="...">
                container.outerHTML = getClientAuditTeamHTML(updatedClient);
            } else {
                // Fallback if not currently on the tab
                renderClientDetail(clientId);
                setTimeout(() => {
                    document.querySelector('.tab-btn[data-tab="audit_team"]')?.click();
                }, 100);
            }

            // auditor variable already exists from line 5155, reuse it
            window.showNotification(`${auditor?.name || 'Auditor'} assigned to ${clientName}`, 'success');
        };

        window.openModal();
    };

    // Remove auditor assignment from a client
    window.removeClientAuditorAssignment = function (clientId, auditorId) {
        const client = window.DataService.findClient(clientId);
        const auditor = window.state.auditors.find(a => String(a.id) === String(auditorId));

        if (!client || !auditor) {
            console.error('[removeClientAuditorAssignment] Client or Auditor not found');
            window.showNotification('Error: Client or Auditor not found', 'error');
            return;
        }

        const confirmMsg = `Remove ${auditor.name} from ${client.name}?

Note: All audit history and records will be RETAINED. The auditor will still have access to past audits they participated in.`;

        if (confirm(confirmMsg)) {
            const cid = String(clientId);
            const aid = String(auditorId);

            const initialLength = (window.state.auditorAssignments || []).length;

            window.state.auditorAssignments = (window.state.auditorAssignments || []).filter(a => {
                const match = (String(a.clientId) === cid && String(a.auditorId) === aid);
                return !match;
            });

            const removedCount = initialLength - window.state.auditorAssignments.length;

            if (removedCount === 0) {
                console.warn('[removeClientAuditorAssignment] No assignment found to remove locally');
                // We still attempt to delete from Supabase just in case
            }

            window.saveData();
            window.DataService.deleteAuditorAssignment(aid, cid);

            // Direct UI Refresh
            const container = document.getElementById('client-audit-team-container');
            if (container) {
                const updatedClient = window.DataService.findClient(clientId);
                container.outerHTML = getClientAuditTeamHTML(updatedClient);
            } else {
                // Fallback
                renderClientDetail(clientId);
                setTimeout(() => {
                    document.querySelector('.tab-btn[data-tab="audit_team"]')?.click();
                }, 100);
            }

            window.showNotification(`${auditor.name} removed from ${client.name}. Historical records retained.`, 'success');
        }
    };

    // ============================================
    // CLIENT DELETION & ARCHIVING
    // ============================================
    // Note: deleteClient and archiveClient functions are defined in clients-list-v16.js
    // which provides the enhanced implementation including Supabase cloud sync.

    // ============================================
    // CLIENT SETTINGS TAB HTML
    // ============================================

    function getClientSettingsHTML(client) {
        return `
        <div class="fade-in">
             <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-cog" style="margin-right: 0.5rem;"></i> Client Settings
            </h3>
            
            <div class="card" style="border-left: 4px solid var(--danger-color);">
                <h4 class="text-danger" style="margin-top: 0;">Danger Zone</h4>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fff1f2; border-radius: 8px;">
                        <div>
                            <strong style="color: #991b1b;">Archive Client</strong>
                            <p style="margin: 0; font-size: 0.85rem; color: #7f1d1d;">Move this client to archives. Data is preserved but hidden from active lists.</p>
                        </div>
                        <button class="btn btn-sm btn-outline-secondary" data-action="archiveClient" data-id="${client.id}">
                            <i class="fa-solid fa-box-archive"></i> Archive
                        </button>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fee2e2; border-radius: 8px;">
                        <div>
                            <strong style="color: #dc2626;">Delete Client</strong>
                            <p style="margin: 0; font-size: 0.85rem; color: #7f1d1d;">Permanently remove this client and ALL associated data. This cannot be undone.</p>
                        </div>
                        <button class="btn btn-sm btn-danger" data-action="deleteClient" data-id="${client.id}" aria-label="Delete">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top: 1.5rem;">
                <h4>Information</h4>
                 <div style="padding: 1rem; background: #f8fafc; border-radius: 6px;">
                    <p style="margin-bottom: 0.5rem; font-size: 0.9rem;"><strong>Unique Client ID:</strong> <code>${client.id}</code></p>
                    <p style="margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-secondary);">This ID is used for linking data in the database.</p>
                    <button class="btn btn-sm btn-secondary" data-action="copyToClipboard" data-id="${client.id}" data-arg1="ID Copied" aria-label="Copy">
                        <i class="fa-solid fa-copy"></i> Copy ID
                    </button>
                </div>
            </div>
        </div>
    `;
    }

    // Export inner-scope functions to window for global access
    window.getClientOrgSetupHTML = getClientOrgSetupHTML;
    window.getClientCertificatesHTML = getClientCertificatesHTML;
    window.getClientSettingsHTML = getClientSettingsHTML;

if (window.Logger) Logger.debug('Modules', 'clients-import.js loaded successfully.');

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { setSetupWizardStep, generateCertificatesFromStandards, updateCertField, autoFillExpiry, updateSiteScope, saveCertificateDetails, viewCertRevisionHistory, addCertRevision, deleteCertificationScope, switchClientOrgSubTab, downloadImportTemplate, importClientsFromExcel, openImportAccountSetupModal, downloadAccountSetupTemplate, processAccountSetupImport, openNewClientModal, initiateAuditPlanFromClient, renderClientDetail, previewClientLogo, handleClientLogoUpload, updateClientWorkspaceHeader, openClientAuditorAssignmentModal, removeClientAuditorAssignment, getClientOrgSetupHTML, getClientCertificatesHTML, getClientSettingsHTML };
}
