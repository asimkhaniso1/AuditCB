// ============================================
// CLIENTS MODULE - CRUD Operations (ESM-ready)
// Extracted from clients-module.js for maintainability
// Contains: editCompanyProfile, uploadCompanyProfileDoc, removeProfileDocument,
//   initiateAuditPlanFromClient
// Site, contact, department, goods/services, key-process and designation CRUD
// and generateCompanyProfile live in clients-org-setup.js (it loads after this
// file, so its copies were the ones running; the copies here were dead).
// ============================================

    // Helper function to initiate audit planning from client detail page
    window.initiateAuditPlanFromClient = function (clientId) {
        // Navigate to Audit Planning module
        window.renderModule('planning');

        const client = window.state.clients.find(c => c.id === clientId);
        const clientName = client ? client.name : '';

        if (!clientName) return;

        // Use a short timeout to ensure the planning module scripts/DOM are ready if needed,
        // though typically renderModule is synchronous for the shell.
        // We then render the create form directly.
        setTimeout(() => {
            if (typeof window.renderCreateAuditPlanForm === 'function') {
                window.renderCreateAuditPlanForm(clientName);
            } else {
                console.error('renderCreateAuditPlanForm function not found');
            }
        }, 100);
    };

    // Company Profile Functions
    function editCompanyProfile(clientId) {
        // RBAC Check
        if (!window.AuthManager || !window.AuthManager.canPerform('create', 'client')) {
            window.showNotification('Access Denied', 'error');
            return;
        }

        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        const currentProfile = client.profile || '';

        window.openModal(
            'Edit Company Profile',
            `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
                <i class="fa-solid fa-info-circle"></i> Write a comprehensive overview of the organization. This will be included in audit reports.
            </p>
        </div>
        <form id="profile-form">
            <div class="form-group">
                <label>Company Profile / Organization Overview</label>
                <textarea id="profile-text" rows="15" placeholder="Enter company profile, including:
- Company background and history
- Industry and market position
- Products/services offered
- Organizational structure
- Key operational locations
- Management system certifications
- Quality objectives and commitments">${currentProfile}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                <div><i class="fa-solid fa-lightbulb"></i> Be concise but comprehensive</div>
                <div><i class="fa-solid fa-check"></i> Focus on audit-relevant information</div>
            </div>
        </form>
        `,
            () => {
                const profileText = document.getElementById('profile-text').value.trim();

                client.profile = profileText;
                client.profileUpdated = new Date().toISOString();

                window.saveData();
                window.closeModal();
                renderClientDetail(clientId);
                renderClientTab(client, 'profile');
                window.showNotification('Company profile updated successfully');
            }
        );
    }

    // Export profile functions
    window.editCompanyProfile = editCompanyProfile;

    // Upload Company Profile Document
    window.uploadCompanyProfileDoc = async function (clientId, file) {
        // RBAC Check
        if (!window.AuthManager || !window.AuthManager.canPerform('create', 'client')) {
            window.showNotification('Access Denied', 'error');
            return;
        }

        if (!file) return;

        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
            window.showNotification('Please upload a PDF, Word document, or text file', 'error');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            window.showNotification('File size must be less than 10MB', 'error');
            return;
        }

        window.showNotification('Processing document...', 'info');

        try {
            // Read file content
            const reader = new FileReader();
            reader.onload = async function (e) {
                const fileContent = e.target.result;

                // Store document metadata
                client.profileDocument = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    uploadedAt: new Date().toISOString()
                };

                // For text files, extract content directly
                if (file.type === 'text/plain') {
                    client.profileDocumentText = fileContent;
                } else {
                    // For PDF/DOC, store base64 and note that text extraction may be limited
                    client.profileDocumentBase64 = fileContent.split(',')[1]; // Remove data URL prefix
                    client.profileDocumentText = `[Content from uploaded document: ${file.name}]\n\nNote: For best results, please use the "Edit Manually" option to paste the key information from your company profile document, or use "AI Generate" if you have a website configured.`;
                }

                window.saveData();

                // Refresh the view
                if (window.setSetupWizardStep) {
                    window.setSetupWizardStep(clientId, 1);
                } else {
                    renderClientDetail(clientId);
                }

                window.showNotification(`Document "${file.name}" uploaded successfully! You can now use AI Generate to create a profile summary.`, 'success');
            };

            if (file.type === 'text/plain') {
                reader.readAsText(file);
            } else {
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            window.showNotification('Error uploading document. Please try again.', 'error');
        }
    };

    // Remove Profile Document
    window.removeProfileDocument = function (clientId) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        if (confirm('Are you sure you want to remove the uploaded document?')) {
            delete client.profileDocument;
            delete client.profileDocumentText;
            delete client.profileDocumentBase64;

            window.saveData();

            // Refresh the view
            if (window.setSetupWizardStep) {
                window.setSetupWizardStep(clientId, 1);
            } else {
                renderClientDetail(clientId);
            }

            window.showNotification('Document removed', 'success');
        }
    };

if (window.Logger) Logger.debug('Modules', 'clients-crud.js loaded successfully.');

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initiateAuditPlanFromClient, editCompanyProfile, removeProfileDocument };
}
