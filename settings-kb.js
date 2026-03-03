// ============================================
// SETTINGS - KNOWLEDGE BASE MODULE (ESM-ready)
// Extracted from settings-module.js for maintainability
// ============================================

// ============================================
// KNOWLEDGE BASE MODULE
// ============================================

// Initialize Knowledge Base state
if (!window.state.knowledgeBase) {
    window.state.knowledgeBase = {
        standards: [],  // { id, name, fileName, uploadDate, status }
        sops: [],
        policies: []
    };
}

function getKnowledgeBaseHTML() {
    const kb = window.state.knowledgeBase;
    kb.standards = kb.standards || [];
    kb.sops = kb.sops || [];
    kb.policies = kb.policies || [];
    kb.marketing = kb.marketing || [];

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; color: var(--primary-color);">
                    <i class="fa-solid fa-brain" style="margin-right: 0.5rem;"></i>
                    Knowledge Base
                </h3>
                <button class="btn btn-sm" data-action="reSyncKnowledgeBase" title="Pull latest documents from cloud" aria-label="Sync">
                    <i class="fa-solid fa-sync"></i> Re-sync Cloud Data
                </button>
            </div>
            
            <!-- AI Diagnostics (Added for debugging) -->
            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h5 style="margin: 0; color: #475569;"><i class="fa-solid fa-stethoscope"></i> AI Connection Diagnostics</h5>
                    <button class="btn btn-sm btn-outline-primary" data-action="testAIConnection">
                        Test API Connection
                    </button>
                </div>
                <div id="ai-diagnostic-result" style="margin-top: 10px; font-family: monospace; font-size: 0.85rem; display: none; padding: 10px; background: #e2e8f0; border-radius: 4px;"></div>
            </div>

            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fa-solid fa-lightbulb" style="font-size: 1.5rem;"></i>
                    <div>
                        <strong>AI-Powered Standards Reference</strong>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; opacity: 0.9;">
                            Upload ISO Standards, SOPs, and Policies. AI will reference them when generating NCR findings and audit reports.
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Standards Section -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: #0369a1;">
                        <i class="fa-solid fa-book" style="margin-right: 0.5rem;"></i>
                        ISO Standards
                    </h4>
                    <button class="btn btn-primary btn-sm" data-action="uploadKnowledgeDoc" data-id="standard" aria-label="Upload">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i>Upload Standard
                    </button>
                </div>
                
                ${kb.standards.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>File</th>
                                    <th>Uploaded</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${kb.standards.map(doc => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(doc.name)}</strong></td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(doc.fileName)}</td>
                                        <td>${window.UTILS.escapeHtml(doc.uploadDate)}</td>
                                        <td>
                                            ${doc.status === 'ready' ? `
                                                <span class="badge" style="background: #10b981; color: white;">
                                                    <i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i>Ready
                                                </span>
                                                ${doc.clauses && doc.clauses.length > 0 ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${doc.clauses.length} clauses indexed</div>` : ''}
                                            ` : doc.status === 'processing' ? `
                                                <span class="badge" style="background: #3b82f6; color: white;">
                                                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i>Analyzing...
                                                </span>
                                            ` : `
                                                <div>
                                                    <span class="badge" style="background: #f59e0b; color: white;">
                                                        <i class="fa-solid fa-clock" style="margin-right: 4px;"></i>Waiting
                                                    </span>
                                                    <button class="btn btn-sm" style="margin-left: 8px; font-size: 0.75rem;" data-action="analyzeStandard" data-id="${doc.id}" aria-label="Auto-generate">
                                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze Now
                                                    </button>
                                                </div>
                                            `}
                                        </td>
                                        <td>
                                            ${doc.status === 'ready' && doc.clauses && doc.clauses.length > 0 ? `
                                                <button class="btn btn-sm btn-icon" data-action="viewKBAnalysis" data-id="${doc.id}" title="View Analysis" aria-label="View">
                                                    <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-icon" data-action="deleteKnowledgeDoc" data-arg1="standard" data-arg2="${doc.id}" title="Delete" aria-label="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">
                        <i class="fa-solid fa-book" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No ISO standards uploaded. Click "Upload Standard" to add.</p>
                    </div>
                `}
            </div>
            
            <!-- SOPs Section -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: #059669;">
                        <i class="fa-solid fa-file-lines" style="margin-right: 0.5rem;"></i>
                        Standard Operating Procedures
                    </h4>
                    <button class="btn btn-primary btn-sm" style="background: #059669; border-color: #059669;" data-action="uploadKnowledgeDoc" data-id="sop" aria-label="Upload">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i>Upload SOP
                    </button>
                </div>
                
                ${kb.sops.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>File</th>
                                    <th>Uploaded</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${kb.sops.map(doc => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(doc.name)}</strong></td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(doc.fileName || '-')}</td>
                                        <td>${window.UTILS.escapeHtml(doc.uploadDate)}</td>
                                        <td>
                                            ${doc.status === 'ready' ? `
                                                <span class="badge" style="background: #10b981; color: white;">
                                                    <i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i>Ready
                                                </span>
                                                ${doc.clauses && doc.clauses.length > 0 ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${doc.clauses.length} sections indexed</div>` : ''}
                                            ` : doc.status === 'processing' ? `
                                                <span class="badge" style="background: #3b82f6; color: white;">
                                                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i>Analyzing...
                                                </span>
                                            ` : `
                                                <div>
                                                    <span class="badge" style="background: #f59e0b; color: white;">
                                                        <i class="fa-solid fa-clock" style="margin-right: 4px;"></i>Waiting
                                                    </span>
                                                    <button class="btn btn-sm" style="margin-left: 8px; font-size: 0.75rem;" data-action="analyzeDocument" data-arg1="sop" data-arg2="${doc.id}" aria-label="Auto-generate">
                                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze
                                                    </button>
                                                </div>
                                            `}
                                        </td>
                                        <td>
                                            ${doc.status === 'ready' && doc.clauses && doc.clauses.length > 0 ? `
                                                <button class="btn btn-sm btn-icon" data-action="viewKBAnalysis" data-id="${doc.id}" title="View Analysis" aria-label="View">
                                                    <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-icon" data-action="deleteKnowledgeDoc" data-arg1="sop" data-arg2="${doc.id}" title="Delete" aria-label="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">
                        <i class="fa-solid fa-file-lines" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No SOPs uploaded. Click "Upload SOP" to add.</p>
                    </div>
                `}
            </div>
            
            <!-- Policies Section -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: #7c3aed;">
                        <i class="fa-solid fa-shield" style="margin-right: 0.5rem;"></i>
                        CB Policies
                    </h4>
                    <button class="btn btn-primary btn-sm" style="background: #7c3aed; border-color: #7c3aed;" data-action="uploadKnowledgeDoc" data-id="policy" aria-label="Upload">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i>Upload Policy
                    </button>
                </div>
                
                ${kb.policies.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>File</th>
                                    <th>Uploaded</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${kb.policies.map(doc => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(doc.name)}</strong></td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(doc.fileName || '-')}</td>
                                        <td>${window.UTILS.escapeHtml(doc.uploadDate)}</td>
                                        <td>
                                            ${doc.status === 'ready' ? `
                                                <span class="badge" style="background: #10b981; color: white;">
                                                    <i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i>Ready
                                                </span>
                                                ${doc.clauses && doc.clauses.length > 0 ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${doc.clauses.length} sections indexed</div>` : ''}
                                            ` : doc.status === 'processing' ? `
                                                <span class="badge" style="background: #3b82f6; color: white;">
                                                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i>Analyzing...
                                                </span>
                                            ` : `
                                                <div>
                                                    <span class="badge" style="background: #f59e0b; color: white;">
                                                        <i class="fa-solid fa-clock" style="margin-right: 4px;"></i>Waiting
                                                    </span>
                                                    <button class="btn btn-sm" style="margin-left: 8px; font-size: 0.75rem;" data-action="analyzeDocument" data-arg1="policy" data-arg2="${doc.id}" aria-label="Auto-generate">
                                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze
                                                    </button>
                                                </div>
                                            `}
                                        </td>
                                        <td>
                                            ${doc.status === 'ready' && doc.clauses && doc.clauses.length > 0 ? `
                                                <button class="btn btn-sm btn-icon" data-action="viewKBAnalysis" data-id="${doc.id}" title="View Analysis" aria-label="View">
                                                    <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-icon" data-action="deleteKnowledgeDoc" data-arg1="policy" data-arg2="${doc.id}" title="Delete" aria-label="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">
                        <i class="fa-solid fa-shield" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No policies uploaded. Click "Upload Policy" to add.</p>
                    </div>
                `}
            </div>

            <!-- Marketing Section -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: #db2777;">
                        <i class="fa-solid fa-bullhorn" style="margin-right: 0.5rem;"></i>
                        Company Brochure & Marketing
                    </h4>
                    <button class="btn btn-primary btn-sm" style="background: #db2777; border-color: #db2777;" data-action="uploadKnowledgeDoc" data-id="marketing" aria-label="Upload">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i>Upload
                    </button>
                </div>
                
                ${kb.marketing.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>File</th>
                                    <th>Uploaded</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${kb.marketing.map(doc => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(doc.name)}</strong></td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(doc.fileName || '-')}</td>
                                        <td>${window.UTILS.escapeHtml(doc.uploadDate)}</td>
                                        <td>
                                            ${doc.status === 'ready' ? `
                                                <span class="badge" style="background: #10b981; color: white;">
                                                    <i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i>Ready
                                                </span>
                                                ${doc.clauses && doc.clauses.length > 0 ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${doc.clauses.length} sections indexed</div>` : ''}
                                            ` : doc.status === 'processing' ? `
                                                <span class="badge" style="background: #3b82f6; color: white;">
                                                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i>Analyzing...
                                                </span>
                                            ` : `
                                                <div>
                                                    <span class="badge" style="background: #f59e0b; color: white;">
                                                        <i class="fa-solid fa-clock" style="margin-right: 4px;"></i>Waiting
                                                    </span>
                                                    <button class="btn btn-sm" style="margin-left: 8px; font-size: 0.75rem;" data-action="analyzeDocument" data-arg1="marketing" data-arg2="${doc.id}" aria-label="Auto-generate">
                                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze
                                                    </button>
                                                </div>
                                            `}
                                        </td>
                                        <td>
                                            ${doc.status === 'ready' && doc.clauses && doc.clauses.length > 0 ? `
                                                <button class="btn btn-sm btn-icon" data-action="viewKBAnalysis" data-id="${doc.id}" title="View Analysis" aria-label="View">
                                                    <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-icon" data-action="deleteKnowledgeDoc" data-arg1="marketing" data-arg2="${doc.id}" title="Delete" aria-label="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">
                        <i class="fa-solid fa-bullhorn" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No marketing materials uploaded. Click "Upload" to add.</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

// Upload Knowledge Document Modal
window.uploadKnowledgeDoc = function (type) {
    const typeLabel = type === 'standard' ? 'ISO Standard' : type === 'sop' ? 'SOP' : type === 'policy' ? 'Policy' : 'Marketing Material';

    document.getElementById('modal-title').textContent = `Upload ${typeLabel}`;
    document.getElementById('modal-body').innerHTML = `
        <form id="upload-kb-form">
            <div class="form-group">
                <label>Document Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="kb-doc-name" placeholder="e.g., ISO 9001:2015" required>
            </div>
            <div class="form-group">
                <label>Select PDF File <span style="color: var(--danger-color);">*</span></label>
                <input type="file" class="form-control" id="kb-doc-file" accept=".pdf,.docx,.doc" required>
                <small style="color: var(--text-secondary);">Supported: PDF, DOCX (Max 10MB)</small>
            </div>
            <div style="background: #e0f2fe; padding: 1rem; border-radius: 6px; margin-top: 1rem;">
                <i class="fa-solid fa-info-circle" style="color: #0284c7; margin-right: 0.5rem;"></i>
                <span style="color: #0284c7; font-size: 0.9rem;">
                    Document will be processed and indexed for AI reference. This may take a few seconds.
                </span>
            </div>
        </form>
    `;


    const saveBtn = document.getElementById('modal-save');
    saveBtn.textContent = 'Upload';
    saveBtn.style.display = 'inline-block';

    saveBtn.onclick = async () => {
        const name = document.getElementById('kb-doc-name').value.trim();
        const fileInput = document.getElementById('kb-doc-file');

        if (!name || !fileInput.files[0]) {
            window.showNotification('Please fill all required fields', 'error');
            return;
        }

        // Show processing state
        const originalBtnText = saveBtn.textContent;
        saveBtn.textContent = 'Processing File...';
        saveBtn.disabled = true;

        const file = fileInput.files[0];
        let extractedText = null;
        let docId = null;
        let cloudUrl = null;
        let cloudPath = null;

        // Extract text for analysis
        try {
            extractedText = await window.extractTextFromFile(file);
        } catch (err) {
            console.warn('Could not extract text:', err);
        }

        // Upload Document via standard client (Handles Storage + DB Metadata)
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            try {
                const uploadResult = await window.SupabaseClient.uploadDocument(file, {
                    name: name,
                    folder: type,
                    uploadedBy: window.state.currentUser?.email
                });

                cloudUrl = uploadResult.url;
                cloudPath = uploadResult.storage_path; // Correct property name from DB
                docId = uploadResult.id;
            } catch (uploadErr) {
                console.error('Failed to upload document to cloud:', uploadErr);
                window.showNotification('File saved locally (cloud upload failed)', 'warning');
                docId = Date.now();
            }
        } else {
            docId = Date.now();
        }

        const kb = window.state.knowledgeBase;
        const collection = type === 'standard' ? kb.standards : type === 'sop' ? kb.sops : type === 'policy' ? kb.policies : kb.marketing;

        // Create document entry with pending status
        const newDoc = {
            id: docId,
            name: name,
            fileName: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            status: 'pending',
            fileSize: file.size,
            extractedText: extractedText, // Save content for AI
            cloudUrl,  // Store cloud URL
            cloudPath, // Store cloud path
            clauses: []
        };

        collection.push(newDoc);
        window.saveData();
        window.closeModal();

        // Show upload notification
        const statusMsg = cloudUrl ? '(uploaded to cloud)' : '(saved locally)';
        window.showNotification(`${typeLabel} uploaded ${statusMsg}. Click "Analyze" to index sections.`, 'info');

        // Re-render the tab
        if (typeof switchSettingsSubTab === 'function') {
            switchSettingsSubTab('knowledge', 'kb');
        } else {
            renderSettings();
        }

        // Sync metadata to settings table
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            try {
                await window.SupabaseClient.syncSettingsToSupabase(window.state.settings);
            } catch (e) {
                console.warn('Metadata sync failed:', e);
            }
        }
    };

    window.openModal();
};
// --- KB Analysis Mode Picker ---
window.showAnalysisModeModal = function (docId, isReanalyze = false) {
    const modalContent = document.getElementById('modal-body');
    if (!modalContent) return;

    // Build client options for context selector — only clients with matching standards
    const clients = window.state.clients || [];
    const kb = window.state.knowledgeBase;
    const kbDoc = kb?.standards?.find(d => d.id === docId);
    const docISONumbers = (kbDoc?.name || '').match(/\d{4,5}/g) || [];
    const matchingClients = clients.filter(c => {
        if (!c.standard || docISONumbers.length === 0) return true;
        const clientISO = (c.standard || '').match(/\d{4,5}/g) || [];
        return clientISO.some(n => docISONumbers.includes(n));
    });
    const clientOptions = matchingClients.map(c =>
        `<option value="${c.id}">${window.UTILS.escapeHtml(c.name)}${c.industry ? ' (' + c.industry + ')' : ''}</option>`
    ).join('');

    modalContent.innerHTML = `
        <div style="text-align:center;margin-bottom:1.25rem;">
            <div style="font-size:1.5rem;margin-bottom:0.25rem;">🔍</div>
            <h3 style="margin:0;font-size:1.2rem;color:#1e293b;">Configure Analysis</h3>
            <p style="margin:0.25rem 0 0;font-size:0.85rem;color:#64748b;">Choose audit type, depth, and optional client context</p>
        </div>

        <!-- Audit Type Toggle -->
        <div style="margin-bottom:1rem;">
            <label style="font-size:0.8rem;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;display:block;">Audit Type</label>
            <div id="audit-type-toggle" style="display:flex;gap:0;border:2px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <div id="at-initial" data-action="_setAuditType" data-id="initial" 
                     style="flex:1;padding:0.6rem;text-align:center;cursor:pointer;background:#3b82f6;color:white;font-weight:600;font-size:0.85rem;transition:all 0.2s;">
                    🏁 Initial / Recertification
                </div>
                <div id="at-surveillance" data-action="_setAuditType" data-id="surveillance"
                     style="flex:1;padding:0.6rem;text-align:center;cursor:pointer;background:#fff;color:#64748b;font-weight:600;font-size:0.85rem;transition:all 0.2s;">
                    🔄 Surveillance
                </div>
            </div>
            <div id="audit-type-hint" style="font-size:0.75rem;color:#64748b;margin-top:0.35rem;padding:0 0.25rem;">
                Full scope audit — covers all clauses comprehensively
            </div>
        </div>

        <!-- Client Context (Optional) -->
        <div style="margin-bottom:1rem;">
            <label style="font-size:0.8rem;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;display:block;">
                Client Context <span style="font-weight:400;text-transform:none;color:#94a3b8;">(optional — tailors questions)</span>
            </label>
            <select id="analysis-client-select" style="width:100%;padding:0.5rem 0.75rem;border:2px solid #e2e8f0;border-radius:8px;font-size:0.85rem;color:#334155;background:#fff;">
                <option value="">— Generic (no client context) —</option>
                ${clientOptions}
            </select>
        </div>

        <!-- Analysis Depth Cards -->
        <label style="font-size:0.8rem;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;display:block;">Analysis Depth</label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:1rem;">
            <div data-action="_startAnalysis" data-arg1="${docId}" data-arg2="short" data-arg3="${isReanalyze}" 
                 style="cursor:pointer;border:2px solid #e2e8f0;border-radius:12px;padding:1.25rem 0.75rem;text-align:center;transition:all 0.2s;background:#fff;">
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">⚡</div>
                <div style="font-weight:700;font-size:0.95rem;color:#1e293b;margin-bottom:0.5rem;">Short</div>
                <div style="font-size:0.75rem;color:#64748b;line-height:1.5;">
                    <div>~30 questions</div>
                    <div>1 API call</div>
                    <div style="color:#f59e0b;font-weight:600;">~10 seconds</div>
                </div>
            </div>
            <div data-action="_startAnalysis" data-arg1="${docId}" data-arg2="standard" data-arg3="${isReanalyze}" 
                 style="cursor:pointer;border:2px solid #3b82f6;border-radius:12px;padding:1.25rem 0.75rem;text-align:center;transition:all 0.2s;background:#eff6ff;position:relative;">
                <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#3b82f6;color:white;font-size:0.65rem;padding:2px 8px;border-radius:4px;font-weight:600;">RECOMMENDED</div>
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">📋</div>
                <div style="font-weight:700;font-size:0.95rem;color:#1e293b;margin-bottom:0.5rem;">Standard</div>
                <div style="font-size:0.75rem;color:#64748b;line-height:1.5;">
                    <div>~80 questions</div>
                    <div>3 API calls</div>
                    <div style="color:#3b82f6;font-weight:600;">~35 seconds</div>
                </div>
            </div>
            <div data-action="_startAnalysis" data-arg1="${docId}" data-arg2="comprehensive" data-arg3="${isReanalyze}" 
                 style="cursor:pointer;border:2px solid #e2e8f0;border-radius:12px;padding:1.25rem 0.75rem;text-align:center;transition:all 0.2s;background:#fff;">
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">🔬</div>
                <div style="font-weight:700;font-size:0.95rem;color:#1e293b;margin-bottom:0.5rem;">Comprehensive</div>
                <div style="font-size:0.75rem;color:#64748b;line-height:1.5;">
                    <div>200+ questions</div>
                    <div>3-5 API calls</div>
                    <div style="color:#8b5cf6;font-weight:600;">~60 seconds</div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modal-title').textContent = isReanalyze ? 'Re-analyze Standard' : 'Analyze Standard';

    // Hide default footer buttons since we have custom actions
    const saveBtn = document.getElementById('modal-save');
    if (saveBtn) saveBtn.style.display = 'none';

    // Store audit type state
    window._analysisAuditType = 'initial';

    window.openModal();
};

// Toggle audit type in the modal
window._setAuditType = function (type) {
    window._analysisAuditType = type;
    const initEl = document.getElementById('at-initial');
    const survEl = document.getElementById('at-surveillance');
    const hintEl = document.getElementById('audit-type-hint');
    if (!initEl || !survEl) return;

    if (type === 'surveillance') {
        survEl.style.background = '#f59e0b';
        survEl.style.color = 'white';
        initEl.style.background = '#fff';
        initEl.style.color = '#64748b';
        if (hintEl) hintEl.textContent = 'Focused audit — fewer questions on continued conformity, changes, and correction effectiveness';
    } else {
        initEl.style.background = '#3b82f6';
        initEl.style.color = 'white';
        survEl.style.background = '#fff';
        survEl.style.color = '#64748b';
        if (hintEl) hintEl.textContent = 'Full scope audit — covers all clauses comprehensively';
    }
};

// Internal: Start analysis with selected mode, audit type, and client context
window._startAnalysis = async function (docId, mode, isReanalyze) {
    const auditType = window._analysisAuditType || 'initial';
    const clientSelect = document.getElementById('analysis-client-select');
    const clientId = clientSelect ? clientSelect.value : '';

    window.closeModal();

    if (isReanalyze) {
        window.reanalyzeStandard(docId, mode, auditType, clientId);
    } else {
        window.analyzeStandard(docId, mode, auditType, clientId);
    }
};

// Analyze standard function (triggered by "Analyze Now" button)
// --- KB Analysis Progress Overlay ---
window._kbProgress = {
    el: null,
    startTime: null,
    timer: null,
    show(label, pct) {
        if (!this.el) {
            this.el = document.createElement('div');
            this.el.id = 'kb-analysis-progress';
            this.el.innerHTML = `
                <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.35);z-index:9998;display:flex;align-items:center;justify-content:center;">
                    <div style="background:white;border-radius:12px;padding:2rem 2.5rem;min-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;">
                        <div style="font-size:1.5rem;margin-bottom:0.5rem;">🔍</div>
                        <div id="kb-prog-title" style="font-weight:600;font-size:1.05rem;color:#1e293b;margin-bottom:0.25rem;">Analyzing Standard...</div>
                        <div id="kb-prog-step" style="font-size:0.85rem;color:#64748b;margin-bottom:1rem;">Initializing...</div>
                        <div style="background:#e2e8f0;border-radius:8px;height:10px;overflow:hidden;margin-bottom:0.75rem;">
                            <div id="kb-prog-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#3b82f6,#8b5cf6);border-radius:8px;transition:width 0.5s ease;"></div>
                        </div>
                        <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#94a3b8;">
                            <span id="kb-prog-pct">0%</span>
                            <span id="kb-prog-time">Elapsed: 0s</span>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(this.el);
            this.startTime = Date.now();
            this.timer = setInterval(() => {
                const el = document.getElementById('kb-prog-time');
                if (el) el.textContent = `Elapsed: ${Math.round((Date.now() - this.startTime) / 1000)}s`;
            }, 1000);
        }
        const bar = document.getElementById('kb-prog-bar');
        const pctEl = document.getElementById('kb-prog-pct');
        const stepEl = document.getElementById('kb-prog-step');
        if (bar) bar.style.width = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%';
        if (stepEl) stepEl.textContent = label;
    },
    hide() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.el) { this.el.remove(); this.el = null; }
    }
};

window.analyzeStandard = async function (docId, mode, auditType, clientId) {
    const kb = window.state.knowledgeBase;
    const doc = kb.standards.find(d => d.id === docId);
    if (!doc) {
        window.showNotification('Standard not found', 'error');
        return;
    }

    // If no mode specified, show the mode picker
    if (!mode) {
        window.showAnalysisModeModal(docId, false);
        return;
    }

    // Update status to processing
    doc.status = 'processing';
    window.saveData();
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }

    // Show progress overlay
    const typeLabel = auditType === 'surveillance' ? 'surveillance ' : '';
    window._kbProgress.show(`Preparing ${typeLabel}${mode} analysis...`, 5);

    // Extract clauses with selected mode, audit type, and client context
    await extractStandardClauses(doc, doc.name, mode, auditType || 'initial', clientId || '');

    // Complete
    window._kbProgress.show('✅ Analysis complete!', 100);
    setTimeout(() => window._kbProgress.hide(), 1500);

    // Re-render
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }

    if (doc.status === 'ready') {
        window.showNotification(`${doc.name} analysis complete! ${doc.clauses ? doc.clauses.length : 0} clauses, ${doc.checklistCount || 0} questions.`, 'success');
    } else {
        window.showNotification(`Analysis complete. Using fallback clause data.`, 'info');
    }

    // Sync metadata
    if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
        try {
            await window.SupabaseClient.syncSettingsToSupabase(window.state.settings);
        } catch (e) {
            console.warn('Metadata sync failed:', e);
        }
    }
};

// Re-analyze a standard (for deeper extraction)
// reanalyzeStandard is defined later in the file (line ~4709) with full implementation

window.analyzeDocument = async function (type, docId) {
    const kb = window.state.knowledgeBase;
    const collection = type === 'sop' ? kb.sops : type === 'policy' ? kb.policies : kb.marketing;
    const doc = collection.find(d => d.id === docId);
    if (!doc) {
        window.showNotification('Document not found', 'error');
        return;
    }

    // Update status to processing
    doc.status = 'processing';
    window.saveData();
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }

    window.showNotification(`Analyzing ${doc.name}...`, 'info');

    // Try AI Analysis if text is available
    if (doc.extractedText) {
        try {
            await window.analyzeCustomDocWithAI(doc, type);
            return; // Success
        } catch (e) {
            console.error('AI Analysis failed, using template fallback', e);
            window.showNotification('AI Analysis failed, using template.', 'warning');
        }
    }

    // Use instant template-based sections (Fallback)
    const fallbackSections = type === 'sop' ? [
        { clause: "1", title: "Purpose", requirement: "States the purpose and objectives of the SOP." },
        { clause: "2", title: "Scope", requirement: "Defines the scope and applicability of the procedure." },
        { clause: "3", title: "Responsibilities", requirement: "Identifies roles and responsibilities of personnel." },
        { clause: "4", title: "Procedure", requirement: "Step-by-step instructions for carrying out the process." },
        { clause: "5", title: "Records", requirement: "Documents and records to be maintained." },
        { clause: "6", title: "References", requirement: "Related documents and standards referenced." },
        { clause: "7", title: "Revision History", requirement: "Version control and change history." }
    ] : type === 'policy' ? [
        { clause: "1", title: "Purpose", requirement: "States why this policy exists and its objectives." },
        { clause: "2", title: "Scope", requirement: "Defines who and what the policy applies to." },
        { clause: "3", title: "Policy Statement", requirement: "The main policy declarations and commitments." },
        { clause: "4", title: "Definitions", requirement: "Key terms and their meanings." },
        { clause: "5", title: "Responsibilities", requirement: "Roles responsible for implementing the policy." },
        { clause: "6", title: "Compliance", requirement: "Requirements for compliance and enforcement." },
        { clause: "7", title: "Related Documents", requirement: "Associated policies, procedures, and references." }
    ] : [
        // Marketing/Brochure Default Sections
        { clause: "1", title: "Company Overview", requirement: "Mission, vision, core values, and history." },
        { clause: "2", title: "Services & Products", requirement: "Detailed description of offerings and capabilities." },
        { clause: "3", title: "Key Differentiators", requirement: "Unique selling points and competitive advantages." },
        { clause: "4", title: "Market Presence", requirement: "Target audience, geography, and industries served." },
        { clause: "5", title: "Certifications", requirement: "ISO certifications and other accreditations held." },
        { clause: "6", title: "Team & Expertise", requirement: "Key personnel and technical expertise." },
        { clause: "7", title: "Contact Information", requirement: "Office locations and support channels." },
        { clause: "8", title: "Case Studies & Safety Record", requirement: "Relevant past projects and safety performance statistics." }
    ];

    doc.clauses = fallbackSections;
    doc.status = 'ready';
    window.saveData();

    // Small delay for visual feedback
    setTimeout(async () => {
        switchSettingsTab('knowledgebase', document.querySelector('.tab-btn:last-child'));
        window.showNotification(`${doc.name} analyzed! ${doc.clauses.length} sections indexed.`, 'success');

        // Sync metadata
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            try {
                await window.SupabaseClient.syncSettingsToSupabase(window.state.settings);
            } catch (e) {
                console.warn('Metadata sync failed:', e);
            }
        }
    }, 300);
};


// One-time clause extraction from standard
async function extractStandardClauses(doc, standardName, mode = 'standard', auditType = 'initial', clientId = '') {
    // Detect standard type based on the name
    const stdLower = standardName.toLowerCase();
    let systemTerm, abbr;

    if (stdLower.includes('9001')) {
        systemTerm = 'Quality Management System (QMS)';
        abbr = 'QMS';
    } else if (stdLower.includes('14001')) {
        systemTerm = 'Environmental Management System (EMS)';
        abbr = 'EMS';
    } else if (stdLower.includes('45001')) {
        systemTerm = 'Occupational Health and Safety Management System';
        abbr = 'OH&S MS';
    } else if (stdLower.includes('27001')) {
        systemTerm = 'Information Security Management System (ISMS)';
        abbr = 'ISMS';
    } else if (stdLower.includes('22000')) {
        systemTerm = 'Food Safety Management System (FSMS)';
        abbr = 'FSMS';
    } else if (stdLower.includes('50001')) {
        systemTerm = 'Energy Management System (EnMS)';
        abbr = 'EnMS';
    } else if (stdLower.includes('13485')) {
        systemTerm = 'Medical Devices Quality Management System';
        abbr = 'MD-QMS';
    } else {
        systemTerm = 'Management System';
        abbr = 'MS';
    }


    // Fix: Define docContent from the document object
    let docContent = doc.extractedText || '';

    // If no extracted text, try to re-extract from cloud URL
    if ((!docContent || docContent.length < 100) && doc.cloudUrl) {
        try {
            const response = await fetch(doc.cloudUrl);
            if (response.ok) {
                const blob = await response.blob();
                const file = new File([blob], doc.fileName || 'document.pdf', { type: blob.type });
                const reExtracted = await window.extractTextFromFile(file);
                if (reExtracted && reExtracted.length > 100) {
                    docContent = reExtracted;
                    doc.extractedText = reExtracted; // Cache it for next time
                    window.saveData();
                }
            }
        } catch (reExtractErr) {
            console.warn('[KB Analysis] Re-extraction from cloud failed:', reExtractErr);
        }
    }

    if (!docContent || docContent.length < 100) {
        console.warn(`[KB Analysis] Document text is empty or too short (${docContent.length} chars). Will proceed with AI general knowledge.`);
        window._kbProgress?.show('No PDF text found — using AI knowledge...', 15);
    } else {
        window._kbProgress?.show(`Text extracted: ${Math.round(docContent.length / 1000)}K chars`, 15);
    }

    // ---- BUILD CLIENT CONTEXT STRING ----
    let clientContext = '';
    if (clientId) {
        const client = (window.state.clients || []).find(c => String(c.id) === String(clientId));
        if (client) {
            const parts = [];
            parts.push(`\nCLIENT CONTEXT (tailor questions to this organization):`);
            parts.push(`Organization: ${client.name}`);
            if (client.industry) parts.push(`Industry: ${client.industry}`);
            if (client.employees) parts.push(`Total Employees: ${client.employees}`);
            if (client.scope) parts.push(`Scope of Certification: ${client.scope}`);
            if (client.standard) parts.push(`Applicable Standards: ${client.standard}`);
            if (client.sites && client.sites.length > 0) {
                const siteDetails = client.sites.map(s => {
                    let info = s.name;
                    if (s.city) info += ' (' + s.city + ')';
                    if (s.employees) info += ' — ' + s.employees + ' employees';
                    if (s.shiftWork) info += ', shift work';
                    const stdList = Array.isArray(s.standards) ? s.standards : (s.standards ? [s.standards] : []);
                    if (stdList.length > 0) info += ' [' + stdList.join(', ') + ']';
                    return info;
                });
                parts.push(`Sites: ${siteDetails.join('; ')}`);
            }
            if (client.goodsServices && client.goodsServices.length > 0) {
                parts.push(`Products/Services: ${client.goodsServices.map(g => g.name).join(', ')}`);
            }
            if (client.keyProcesses && client.keyProcesses.length > 0) {
                parts.push(`Key Processes: ${client.keyProcesses.map(p => p.name + ' (' + p.category + ')').join(', ')}`);
            }
            if (client.departments && client.departments.length > 0) {
                parts.push(`Departments: ${client.departments.map(d => d.name).join(', ')}`);
            }
            if (client.contacts && client.contacts.length > 0) {
                const personnel = client.contacts.map(c => c.name + (c.designation ? ' (' + c.designation + ')' : '') + (c.department ? ' — ' + c.department : ''));
                parts.push(`Key Personnel: ${personnel.join('; ')}`);
            }
            if (client.profile) parts.push(`Profile: ${client.profile.substring(0, 500)}`);
            parts.push(`\nIMPORTANT: Make checklist questions SPECIFIC to this organization's industry, processes, products, and scope. Reference their actual processes/products where relevant.`);
            clientContext = parts.join('\n');
        }
    }

    // ---- SURVEILLANCE AUDIT INSTRUCTION ----
    let auditTypeInstruction = '';
    let survRequirements = '';
    if (auditType === 'surveillance') {
        auditTypeInstruction = `
AUDIT TYPE: SURVEILLANCE AUDIT (NOT initial/recertification)
This is a SURVEILLANCE audit. The organization is ALREADY certified. Your questions must focus on:
- CONTINUED CONFORMITY: Has the system been maintained since last audit?
- CHANGES: Any changes to processes, personnel, facilities, or scope?
- CORRECTIVE ACTIONS: Status and effectiveness of previous NCRs/CAPAs
- INTERNAL AUDITS: Were they conducted? What were the findings?
- MANAGEMENT REVIEW: Was it held? Were decisions implemented?
- COMPLAINTS: How were customer complaints and feedback handled?
- OBJECTIVES: Progress on quality/environmental/safety objectives and targets
- CERTIFICATION MARK: Proper use of certification logo and references
- RISK AREAS: Focus on high-risk processes and areas with previous findings

DO NOT ask basic implementation questions like "Has the organization established..." or "Does the organization have..."
INSTEAD ask verification questions like "What changes have been made to..." or "Show evidence of continued..." or "How were previous findings on X addressed?"
`;
        survRequirements = `
SURVEILLANCE-SPECIFIC REQUIREMENTS:
1. Questions must verify ONGOING EFFECTIVENESS, not initial implementation
2. Frame questions as "What evidence shows continued..." or "What changes since last audit..."
3. Include follow-up questions on corrective actions and previous findings
4. Focus on performance data, trends, and KPIs rather than documented procedures
5. Ask about management of change and how the system adapted
`;
    }

    // ---- MODE-DEPENDENT CONFIGURATION ----
    const modeConfig = {
        short: {
            sourceLimit: 100000,
            maxTokens: 12288,
            questionsPerClause: '1',
            questionsInstruction: '1 practical audit checklist question',
            batchDelay: 1500,
            batches: [
                { label: 'Clauses 4-7', range: 'Clauses 4, 5, 6, and 7 — include ALL sub-clauses at the X.Y level. Do NOT skip any sub-clause.', useSource: true },
                { label: 'Clauses 8-10', range: 'Clauses 8, 9, and 10 — include ALL sub-clauses at the X.Y level. Do NOT skip any sub-clause.', useSource: true }
            ]
        },
        standard: {
            sourceLimit: 200000,
            maxTokens: 24576, // Increased from 16k to prevent output truncation
            questionsPerClause: '1-2',
            questionsInstruction: '1-2 practical audit checklist questions',
            batchDelay: 2000,
            batches: [
                { label: 'Clauses 4-6', range: 'Clauses 4, 5, and 6 — include ALL sub-clauses down to the deepest level present in the document', useSource: true },
                { label: 'Clauses 7-8', range: 'Clauses 7 and 8 — include ALL sub-clauses down to the deepest level present in the document', useSource: true },
                { label: 'Clauses 9-10', range: 'Clauses 9 and 10 — include ALL sub-clauses down to the deepest level present in the document. Do NOT skip any.', useSource: true }
            ]
        },
        comprehensive: {
            sourceLimit: 500000, // Increased from 50k to cover largest documents
            maxTokens: 32768,
            questionsPerClause: '3-5',
            questionsInstruction: '3-5 specific audit questions per sub-clause covering evidence, implementation, effectiveness, compliance, and records',
            batchDelay: 3000,
            batches: [
                { label: 'Clauses 4-6', range: 'Clauses 4, 5, and 6 — include ALL sub-clauses at EVERY level (X.Y, X.Y.Z). Must include: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3 and all deeper levels.', useSource: true },
                { label: 'Clauses 7-8', range: 'Clauses 7 and 8 — include ALL sub-clauses at EVERY level. Must include: 7.1 (AND 7.1.1, 7.1.2, 7.1.3, 7.1.4, 7.1.5, 7.1.6), 7.2, 7.3, 7.4, 7.5 (7.5.1, 7.5.2, 7.5.3), 8.1, 8.2, 8.3, 8.4 (8.4.1, 8.4.2, 8.4.3), 8.5 (8.5.1, 8.5.2, 8.5.3, 8.5.4, 8.5.5, 8.5.6), 8.6, 8.7. Do NOT skip 8.4-8.7.', useSource: true },
                { label: 'Clauses 9-10', range: 'Clauses 9 and 10 — include ALL sub-clauses. Must include: 9.1 (9.1.1, 9.1.2, 9.1.3), 9.2 (9.2.1, 9.2.2), 9.3 (9.3.1, 9.3.2, 9.3.3), 10.1, 10.2, 10.3 (continual improvement). Do NOT skip 10.3.', useSource: true }
            ]
        }
    };

    const config = modeConfig[mode] || modeConfig.standard;

    try {
        // Source text limited by mode
        const sourceText = docContent.length > 100 ? docContent.substring(0, config.sourceLimit) : '';
        const sourceSection = sourceText
            ? `\nSOURCE TEXT:\n${sourceText}\n`
            : `\nNo source text available. Use your comprehensive expert knowledge of ${standardName}.\n`;

        // Build batch list from mode config
        const batches = [...config.batches];

        // ISO 27001 Annex A — only in comprehensive mode
        if (abbr === 'ISMS' && mode === 'comprehensive') {
            batches.push(
                { label: 'Annex A.5-A.6', range: 'ISO 27001:2022 Annex A controls: A.5 Organizational Controls (ALL 37 controls: A.5.1 Policies for information security, A.5.2 Information security roles, A.5.3 Segregation of duties, A.5.4 Management responsibilities, A.5.5 Contact with authorities, A.5.6 Contact with special interest groups, A.5.7 Threat intelligence, A.5.8 Information security in project management, A.5.9-A.5.37 and all remaining) AND A.6 People Controls (ALL 8 controls: A.6.1-A.6.8)', useSource: false },
                { label: 'Annex A.7-A.8', range: 'ISO 27001:2022 Annex A controls: A.7 Physical Controls (ALL 14 controls: A.7.1-A.7.14) AND A.8 Technological Controls (ALL 34 controls: A.8.1-A.8.34 including A.8.1 User endpoint devices, A.8.2 Privileged access rights, A.8.3 Information access restriction, A.8.4 Access to source code, A.8.5-A.8.34)', useSource: false }
            );
        }


        let allClauses = [];
        let allChecklist = [];

        for (let bi = 0; bi < batches.length; bi++) {
            const batch = batches[bi];
            const batchStartPct = Math.round(15 + (bi / batches.length) * 80);
            const batchEndPct = Math.round(15 + ((bi + 1) / batches.length) * 80);

            // Delay between batches to avoid API rate limiting (429)
            if (bi > 0 && config.batchDelay > 0) {
                window._kbProgress?.show(`Waiting before next batch...`, batchStartPct - 2);
                await new Promise(resolve => setTimeout(resolve, config.batchDelay));
            }

            window._kbProgress?.show(`AI extracting ${batch.label}... (${bi + 1}/${batches.length})`, batchStartPct);

            const batchSource = batch.useSource ? sourceSection : `\nUse your expert knowledge of ${standardName}. Be comprehensive — list EVERY control.\n`;

            const prompt = `You are an expert ISO Lead Auditor with 20+ years experience in ${systemTerm} certification audits.
${auditTypeInstruction}
TASK: Extract ${auditType === 'surveillance' ? 'key auditable requirements for surveillance review' : 'EVERY auditable requirement'} from ${batch.range} of "${standardName}".

REQUIREMENTS:
1. ${auditType === 'surveillance' ? 'Cover the main sub-clauses but focus on areas prone to drift or change. Skip purely informational clauses.' : 'Include EVERY sub-clause at the deepest level. Do NOT summarize or skip any.'}
2. "requirement" = ${auditType === 'surveillance' ? 'Key requirement text relevant to ongoing conformity verification' : 'FULL requirement text verbatim from the standard'}
3. "subRequirements" = ${auditType === 'surveillance' ? 'Only HIGH-PRIORITY lettered items that need surveillance verification' : 'ALL lettered items (a, b, c...) exactly as stated'}
4. "checklistQuestions" = Generate ${config.questionsInstruction}${auditType === 'surveillance' ? ' — frame as verification/evidence questions, NOT implementation questions' : ''}
5. Use "${abbr}" terminology throughout
6. IMPORTANT: Skip clauses 1, 2, 3 (non-auditable informative sections)
${survRequirements}
${clientContext}
${batchSource}
Return valid JSON only. No markdown formatting. No code blocks. No introductory text.
[{"clause":"X.Y","title":"...","requirement":"${auditType === 'surveillance' ? 'Key requirement for surveillance...' : 'Full text...'}","subRequirements":["a) ..."],"checklistQuestions":["${auditType === 'surveillance' ? 'What evidence shows continued...?' : 'Q1?'}"]}]`;

            const text = await window.AI_SERVICE.callProxyAPI(prompt, { maxTokens: config.maxTokens });
            window._kbProgress?.show(`Parsing ${batch.label} response...`, batchEndPct - 5);

            let jsonMatch = text.match(/\[[\s\S]*\]/);
            let batchClauses = null;

            if (jsonMatch) {
                try {
                    batchClauses = JSON.parse(jsonMatch[0]);
                } catch (parseErr) {
                    console.warn(`[KB Analysis] ${batch.label} JSON repair needed...`);
                    let jsonStr = jsonMatch[0];
                    const lastObj = jsonStr.lastIndexOf('}');
                    if (lastObj > 0) {
                        jsonStr = jsonStr.substring(0, lastObj + 1) + ']';
                        try { batchClauses = JSON.parse(jsonStr); } catch (e2) { /* skip */ }
                    }
                }
            }

            if (batchClauses && batchClauses.length > 0) {
                // Filter out clauses 1-3 (non-requirement sections in ISO standards)
                batchClauses = batchClauses.filter(c => {
                    const clauseNum = parseFloat(c.clause);
                    return isNaN(clauseNum) || clauseNum >= 4;
                });
                allClauses = allClauses.concat(batchClauses);
                batchClauses.forEach(c => {
                    (c.checklistQuestions || []).forEach(q => {
                        allChecklist.push({ clause: c.clause, requirement: q });
                    });
                });
                window._kbProgress?.show(`${batch.label}: ${batchClauses.length} clauses extracted ✓`, batchEndPct);
                const batchQs = batchClauses.reduce((sum, c) => sum + (c.checklistQuestions?.length || 0), 0);
            } else {
                window._kbProgress?.show(`${batch.label}: extraction failed ✗`, batchEndPct);
                console.warn(`[KB Analysis] ${batch.label}: extraction failed`);
            }
        }

        if (allClauses.length > 0) {
            // ── Gap-fill: inject missing key clauses from built-in database ──
            if (mode === 'comprehensive') {
                const existingNums = new Set(allClauses.map(c => String(c.clause).trim()));
                const builtIn = getBuiltInClauses(standardName);
                if (builtIn.length > 0) {
                    // Key clauses that frequently get skipped by AI
                    const keyClauses = [
                        '7.1', '7.1.1', '7.1.2', '7.1.3', '7.1.4', '7.1.5', '7.1.5.1', '7.1.5.2', '7.1.6',
                        '8.4', '8.4.1', '8.4.2', '8.4.3',
                        '8.5', '8.5.1', '8.5.2', '8.5.3', '8.5.4', '8.5.5', '8.5.6',
                        '8.6', '8.7',
                        '10.1', '10.2', '10.3'
                    ];
                    let gapCount = 0;
                    keyClauses.forEach(num => {
                        if (!existingNums.has(num)) {
                            const fallback = builtIn.find(b => String(b.clause).trim() === num);
                            if (fallback) {
                                allClauses.push(fallback);
                                // Also generate a default checklist question
                                allChecklist.push({
                                    clause: fallback.clause,
                                    requirement: `How does the organization demonstrate conformity with ${fallback.clause} — ${fallback.title}?`
                                });
                                gapCount++;
                            }
                        }
                    });
                    if (gapCount > 0) {
                        // Re-sort by clause number
                        allClauses.sort((a, b) => {
                            const na = String(a.clause).split('.').map(Number);
                            const nb = String(b.clause).split('.').map(Number);
                            for (let k = 0; k < Math.max(na.length, nb.length); k++) {
                                if ((na[k] || 0) !== (nb[k] || 0)) return (na[k] || 0) - (nb[k] || 0);
                            }
                            return 0;
                        });
                        allChecklist.sort((a, b) => {
                            const na = String(a.clause).split('.').map(Number);
                            const nb = String(b.clause).split('.').map(Number);
                            for (let k = 0; k < Math.max(na.length, nb.length); k++) {
                                if ((na[k] || 0) !== (nb[k] || 0)) return (na[k] || 0) - (nb[k] || 0);
                            }
                            return 0;
                        });
                    }
                }
            }

            window._kbProgress?.show(`Saving ${allClauses.length} clauses + ${allChecklist.length} questions...`, 95);
            doc.clauses = allClauses;
            doc.generatedChecklist = allChecklist;
            doc.checklistCount = allChecklist.length;
            doc.status = 'ready';
            doc.lastAnalyzed = new Date().toISOString().split('T')[0];
            doc.lastAuditType = auditType || 'initial';
            doc.lastAnalysisMode = mode;
            if (clientId) {
                const ctxClient = (window.state.clients || []).find(c => String(c.id) === String(clientId));
                doc.lastClientName = ctxClient ? ctxClient.name : '';
                doc.lastClientId = clientId;
            } else {
                doc.lastClientName = '';
                doc.lastClientId = '';
            }
            window.saveData();
            return;
        } else {
            console.warn(`[KB Analysis] Both batches failed`);
        }
    } catch (error) {
        console.error('[KB Analysis] Exception:', error);
        window.showNotification(`AI Error: ${error.message}`, 'error');
    }

    // Fallback: Use built-in clauses if API fails
    window.showNotification('Switching to offline fallback mode...', 'warning');
    console.warn(`⚠️ [KB Analysis] Falling back to built-in database for ${standardName}`);
    doc.clauses = getBuiltInClauses(standardName);
    doc.status = 'ready';
    doc.lastAnalyzed = new Date().toISOString().split('T')[0];
    window.saveData();
}

// Built-in clause database for common standards (fallback) - COMPREHENSIVE with sub-clauses and bullet points
function getBuiltInClauses(standardName) {
    const iso9001Clauses = [
        // Clause 4 - Context of the organization
        { clause: "4.1", title: "Understanding the organization and its context", requirement: "The organization shall determine external and internal issues that are relevant to its purpose and strategic direction and that affect its ability to achieve the intended results of its QMS." },
        {
            clause: "4.2",
            title: "Understanding the needs and expectations of interested parties",
            requirement: "The organization shall determine the interested parties and their relevant requirements.",
            subRequirements: [
                "a) the interested parties that are relevant to the QMS",
                "b) the requirements of these interested parties that are relevant to the QMS",
                "c) which of these requirements will be addressed through the QMS"
            ]
        },
        {
            clause: "4.3",
            title: "Determining the scope of the quality management system",
            requirement: "The organization shall determine the boundaries and applicability of the QMS to establish its scope, considering:",
            subRequirements: [
                "a) the external and internal issues referred to in 4.1",
                "b) the requirements of relevant interested parties referred to in 4.2",
                "c) the products and services of the organization"
            ]
        },
        { clause: "4.4", title: "Quality management system and its processes", requirement: "The organization shall establish, implement, maintain and continually improve a QMS, including the processes needed and their interactions." },
        {
            clause: "4.4.1",
            title: "QMS processes - Requirements",
            requirement: "The organization shall determine the processes needed for the QMS and shall:",
            subRequirements: [
                "a) determine the inputs required and the outputs expected from these processes",
                "b) determine the sequence and interaction of these processes",
                "c) determine and apply the criteria and methods needed to ensure effective operation and control",
                "d) determine the resources needed for these processes and ensure their availability",
                "e) assign the responsibilities and authorities for these processes",
                "f) address the risks and opportunities as determined in accordance with 6.1",
                "g) evaluate these processes and implement any changes needed to ensure they achieve intended results",
                "h) improve the processes and the QMS"
            ]
        },
        {
            clause: "4.4.2",
            title: "QMS processes - Documentation",
            requirement: "To the extent necessary, the organization shall:",
            subRequirements: [
                "a) maintain documented information to support the operation of its processes",
                "b) retain documented information to have confidence that the processes are being carried out as planned"
            ]
        },

        // Clause 5 - Leadership
        { clause: "5.1", title: "Leadership and commitment", requirement: "Top management shall demonstrate leadership and commitment with respect to the quality management system." },
        {
            clause: "5.1.1",
            title: "Leadership and commitment - General",
            requirement: "Top management shall demonstrate leadership and commitment with respect to the QMS by:",
            subRequirements: [
                "a) taking accountability for the effectiveness of the QMS",
                "b) ensuring that the quality policy and quality objectives are established and compatible with strategic direction",
                "c) ensuring the integration of the QMS requirements into the organization's business processes",
                "d) promoting the use of the process approach and risk-based thinking",
                "e) ensuring that the resources needed for the QMS are available",
                "f) communicating the importance of effective quality management and conforming to the QMS requirements",
                "g) ensuring that the QMS achieves its intended results",
                "h) engaging, directing and supporting persons to contribute to the effectiveness of the QMS",
                "i) promoting improvement",
                "j) supporting other relevant management roles to demonstrate their leadership"
            ]
        },
        {
            clause: "5.1.2",
            title: "Customer focus",
            requirement: "Top management shall demonstrate leadership and commitment with respect to customer focus by ensuring that:",
            subRequirements: [
                "a) customer and applicable statutory and regulatory requirements are determined, understood and consistently met",
                "b) the risks and opportunities that can affect conformity of products and services and ability to enhance customer satisfaction are determined and addressed",
                "c) the focus on enhancing customer satisfaction is maintained"
            ]
        },
        { clause: "5.2", title: "Policy", requirement: "Top management shall establish, implement and maintain a quality policy." },
        {
            clause: "5.2.1",
            title: "Establishing the quality policy",
            requirement: "The quality policy shall:",
            subRequirements: [
                "a) be appropriate to the purpose and context of the organization and supports its strategic direction",
                "b) provide a framework for setting quality objectives",
                "c) include a commitment to satisfy applicable requirements",
                "d) include a commitment to continual improvement of the QMS"
            ]
        },
        {
            clause: "5.2.2",
            title: "Communicating the quality policy",
            requirement: "The quality policy shall:",
            subRequirements: [
                "a) be available and be maintained as documented information",
                "b) be communicated, understood and applied within the organization",
                "c) be available to relevant interested parties, as appropriate"
            ]
        },
        {
            clause: "5.3",
            title: "Organizational roles, responsibilities and authorities",
            requirement: "Top management shall ensure that the responsibilities and authorities for relevant roles are assigned, communicated and understood. Top management shall assign responsibility and authority for:",
            subRequirements: [
                "a) ensuring that the QMS conforms to the requirements of ISO 9001",
                "b) ensuring that the processes are delivering their intended outputs",
                "c) reporting on the performance of the QMS and on opportunities for improvement, in particular to top management",
                "d) ensuring the promotion of customer focus throughout the organization",
                "e) ensuring that the integrity of the QMS is maintained when changes to the QMS are planned and implemented"
            ]
        },

        // Clause 6 - Planning
        {
            clause: "6.1",
            title: "Actions to address risks and opportunities",
            requirement: "When planning for the QMS, the organization shall consider the issues referred to in 4.1 and the requirements referred to in 4.2 and determine the risks and opportunities that need to be addressed to:",
            subRequirements: [
                "a) give assurance that the QMS can achieve its intended results",
                "b) enhance desirable effects",
                "c) prevent, or reduce, undesired effects",
                "d) achieve improvement"
            ]
        },
        {
            clause: "6.1.1",
            title: "Planning - Risks and opportunities",
            requirement: "The organization shall plan:",
            subRequirements: [
                "a) actions to address these risks and opportunities",
                "b) how to integrate and implement the actions into its QMS processes",
                "c) evaluate the effectiveness of these actions"
            ]
        },
        { clause: "6.1.2", title: "Planning - Objectives of actions", requirement: "Actions taken to address risks and opportunities shall be proportionate to the potential impact on the conformity of products and services." },
        { clause: "6.2", title: "Quality objectives and planning to achieve them", requirement: "The organization shall establish quality objectives at relevant functions, levels and processes needed for the QMS." },
        {
            clause: "6.2.1",
            title: "Quality objectives - Requirements",
            requirement: "The quality objectives shall:",
            subRequirements: [
                "a) be consistent with the quality policy",
                "b) be measurable",
                "c) take into account applicable requirements",
                "d) be relevant to conformity of products and services and to enhancement of customer satisfaction",
                "e) be monitored",
                "f) be communicated",
                "g) be updated as appropriate"
            ]
        },
        { clause: "6.2.2", title: "Planning to achieve objectives", requirement: "When planning how to achieve quality objectives, the organization shall determine what will be done, what resources will be required, who will be responsible, when it will be completed, and how results will be evaluated." },
        { clause: "6.3", title: "Planning of changes", requirement: "When the organization determines the need for changes to the QMS, changes shall be carried out in a planned manner considering the purpose, consequences, integrity and availability of resources." },

        // Clause 7 - Support
        { clause: "7.1", title: "Resources", requirement: "The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the QMS." },
        { clause: "7.1.1", title: "General - Resources", requirement: "The organization shall consider the capabilities of and constraints on existing internal resources and what needs to be obtained from external providers." },
        { clause: "7.1.2", title: "People", requirement: "The organization shall determine and provide the persons necessary for the effective implementation of its QMS and for the operation and control of its processes." },
        { clause: "7.1.3", title: "Infrastructure", requirement: "The organization shall determine, provide and maintain the infrastructure necessary for the operation of its processes and to achieve conformity of products and services." },
        { clause: "7.1.4", title: "Environment for the operation of processes", requirement: "The organization shall determine, provide and maintain the environment necessary for the operation of its processes and to achieve conformity of products and services." },
        { clause: "7.1.5", title: "Monitoring and measuring resources", requirement: "The organization shall determine and provide the resources needed to ensure valid and reliable results when monitoring or measuring is used to verify the conformity of products and services." },
        { clause: "7.1.5.1", title: "Monitoring and measuring resources - General", requirement: "Resources shall be suitable for the specific type of monitoring and measurement activities, and maintained to ensure continued fitness for purpose." },
        { clause: "7.1.5.2", title: "Measurement traceability", requirement: "When measurement traceability is a requirement, measuring equipment shall be calibrated or verified at specified intervals against standards traceable to international or national measurement standards." },
        { clause: "7.1.6", title: "Organizational knowledge", requirement: "The organization shall determine the knowledge necessary for the operation of its processes and to achieve conformity of products and services. This knowledge shall be maintained and made available." },
        { clause: "7.2", title: "Competence", requirement: "The organization shall determine necessary competence of persons doing work under its control that affects QMS performance and effectiveness, ensure these persons are competent on the basis of appropriate education, training, or experience, take actions to acquire the necessary competence, and retain appropriate documented information." },
        { clause: "7.3", title: "Awareness", requirement: "The organization shall ensure that persons doing work under its control are aware of the quality policy, relevant quality objectives, their contribution to the effectiveness of the QMS, and implications of not conforming with QMS requirements." },
        { clause: "7.4", title: "Communication", requirement: "The organization shall determine the internal and external communications relevant to the QMS, including what it will communicate, when to communicate, with whom to communicate, how to communicate, and who communicates." },
        { clause: "7.5", title: "Documented information", requirement: "The organization's QMS shall include documented information required by ISO 9001 and documented information determined necessary for the effectiveness of the QMS." },
        { clause: "7.5.1", title: "Documented information - General", requirement: "The extent of documented information can differ due to the size of organization, type of activities, processes, products and services, complexity of processes, and competence of persons." },
        { clause: "7.5.2", title: "Creating and updating", requirement: "When creating and updating documented information, the organization shall ensure appropriate identification and description, format, media, and review and approval for suitability and adequacy." },
        { clause: "7.5.3", title: "Control of documented information", requirement: "Documented information shall be controlled to ensure it is available and suitable for use where and when needed, and adequately protected from loss of confidentiality, improper use, or loss of integrity." },
        { clause: "7.5.3.1", title: "Control of documented information - Actions", requirement: "Activities shall include distribution, access, retrieval and use, storage and preservation, control of changes, retention and disposition." },
        { clause: "7.5.3.2", title: "External origin documented information", requirement: "Documented information of external origin necessary for QMS planning and operation shall be identified and controlled." },

        // Clause 8 - Operation
        { clause: "8.1", title: "Operational planning and control", requirement: "The organization shall plan, implement and control the processes needed to meet requirements for provision of products and services and to implement the actions determined in Clause 6." },
        { clause: "8.2", title: "Requirements for products and services", requirement: "The organization shall implement a process for communicating with customers and determining requirements for products and services." },
        { clause: "8.2.1", title: "Customer communication", requirement: "Communication with customers shall include providing information relating to products and services, handling enquiries, contracts or orders including changes, obtaining customer feedback including complaints, and handling or controlling customer property." },
        { clause: "8.2.2", title: "Determining the requirements for products and services", requirement: "When determining requirements for products and services to be offered, the organization shall ensure requirements are defined including applicable statutory and regulatory requirements, and it can meet the claims for products and services it offers." },
        { clause: "8.2.3", title: "Review of requirements for products and services", requirement: "The organization shall ensure it has ability to meet requirements for products and services to be offered to customers, including requirements specified by the customer, requirements not stated by the customer but necessary for intended use, statutory and regulatory requirements, and contract or order requirements differing from those previously expressed." },
        { clause: "8.2.3.1", title: "Review of requirements - Conduct", requirement: "The review shall be conducted before the organization commits to supplying products and services to a customer." },
        { clause: "8.2.3.2", title: "Review of requirements - Documented information", requirement: "The organization shall retain documented information on the results of the review and any new requirements for products and services." },
        { clause: "8.2.4", title: "Changes to requirements for products and services", requirement: "The organization shall ensure relevant documented information is amended and relevant persons are made aware of the changed requirements when requirements change." },
        { clause: "8.3", title: "Design and development of products and services", requirement: "The organization shall establish, implement and maintain a design and development process that is appropriate to ensure the subsequent provision of products and services." },
        { clause: "8.3.1", title: "Design and development - General", requirement: "When requirements are not already established or not defined by the customer, the organization shall establish a process for design and development." },
        { clause: "8.3.2", title: "Design and development planning", requirement: "In determining the stages and controls for design and development, the organization shall consider the nature, duration and complexity, required process stages, required verification and validation activities, responsibilities and authorities, internal and external resource needs, control of interfaces, involvement of customers and users, requirements for subsequent provision, and level of control expected by customers and other relevant interested parties." },
        { clause: "8.3.3", title: "Design and development inputs", requirement: "The organization shall determine the requirements essential for the specific types of products and services to be designed and developed, including functional and performance requirements, information derived from previous similar design and development activities, statutory and regulatory requirements, and standards or codes of practice the organization has committed to implement." },
        { clause: "8.3.4", title: "Design and development controls", requirement: "The organization shall apply controls to the design and development process to ensure results to be achieved are defined, reviews are conducted as planned, verification is conducted to ensure outputs meet input requirements, and validation is conducted to ensure products and services meet requirements for specified application or intended use." },
        { clause: "8.3.5", title: "Design and development outputs", requirement: "The organization shall ensure design and development outputs meet the input requirements, are adequate for the subsequent processes for provision of products and services, include or reference monitoring and measuring requirements and acceptance criteria, and specify characteristics essential for intended purpose and safe and proper provision." },
        { clause: "8.3.6", title: "Design and development changes", requirement: "The organization shall identify, review and control changes made during or after the design and development of products and services to the extent necessary to ensure there is no adverse impact on conformity to requirements." },
        { clause: "8.4", title: "Control of externally provided processes, products and services", requirement: "The organization shall ensure that externally provided processes, products and services conform to requirements." },
        { clause: "8.4.1", title: "External provision - General", requirement: "The organization shall determine the controls to be applied to externally provided processes, products and services when products and services from external providers are intended for incorporation, are provided directly to customers, or a process or part of a process is provided by an external provider." },
        { clause: "8.4.2", title: "Type and extent of control", requirement: "The organization shall ensure externally provided processes remain within the control of its QMS, define controls it intends to apply to an external provider and those it intends to apply to the resulting output, and take into consideration the potential impact on the organization's ability to consistently meet customer and applicable statutory and regulatory requirements." },
        { clause: "8.4.3", title: "Information for external providers", requirement: "The organization shall communicate to external providers its requirements for the processes, products and services to be provided, approval methods, competence and qualification requirements, interactions with the organization's QMS, control and monitoring of performance, and verification or validation activities." },
        { clause: "8.5", title: "Production and service provision", requirement: "The organization shall implement production and service provision under controlled conditions." },
        { clause: "8.5.1", title: "Control of production and service provision", requirement: "Controlled conditions shall include: availability of documented information, availability of suitable monitoring and measuring resources, implementation of monitoring and measurement activities, use of suitable infrastructure, appointment of competent persons, validation of ability to achieve planned results for special processes, implementation of actions to prevent human error, and implementation of release, delivery and post-delivery activities." },
        { clause: "8.5.2", title: "Identification and traceability", requirement: "The organization shall use suitable means to identify outputs when necessary to ensure conformity of products and services. The organization shall identify the status of outputs with respect to monitoring and measurement requirements. The organization shall control the unique identification of the outputs when traceability is a requirement and shall retain documented information necessary to enable traceability." },
        { clause: "8.5.3", title: "Property belonging to customers or external providers", requirement: "The organization shall exercise care with property belonging to customers or external providers while it is under the organization's control or being used. It shall identify, verify, protect and safeguard property, and report to the owner if property is lost, damaged or otherwise found to be unsuitable for use." },
        { clause: "8.5.4", title: "Preservation", requirement: "The organization shall preserve the outputs during production and service provision, to the extent necessary to ensure conformity to requirements. Preservation can include identification, handling, contamination control, packaging, storage, transmission or transportation, and protection." },
        { clause: "8.5.5", title: "Post-delivery activities", requirement: "The organization shall meet requirements for post-delivery activities associated with the products and services. The organization shall consider statutory and regulatory requirements, potential undesired consequences, nature, use and intended lifetime, customer requirements, and customer feedback." },
        { clause: "8.5.6", title: "Control of changes", requirement: "The organization shall review and control changes for production or service provision, to the extent necessary to ensure continuing conformity with requirements. The organization shall retain documented information describing the results of the review of changes, the person(s) authorizing the change, and any necessary actions arising from the review." },
        { clause: "8.6", title: "Release of products and services", requirement: "The organization shall implement planned arrangements at appropriate stages to verify that product and service requirements have been met. Release of products and services shall not proceed until planned arrangements have been satisfactorily completed, unless otherwise approved by a relevant authority and, as applicable, by the customer. The organization shall retain documented information on the release of products and services, including evidence of conformity with acceptance criteria and traceability to the person(s) authorizing the release." },
        { clause: "8.7", title: "Control of nonconforming outputs", requirement: "The organization shall ensure that outputs that do not conform to their requirements are identified and controlled to prevent their unintended use or delivery." },
        { clause: "8.7.1", title: "Nonconforming outputs - Actions", requirement: "The organization shall take appropriate action based on the nature of the nonconformity and its effect on the conformity of products and services. This shall also apply to nonconforming products and services detected after delivery of products, during or after the provision of services." },
        { clause: "8.7.2", title: "Nonconforming outputs - Documented information", requirement: "The organization shall retain documented information that describes the nonconformity, describes the actions taken, describes any concessions obtained, and identifies the authority deciding the action in respect of the nonconformity." },

        // Clause 9 - Performance evaluation
        { clause: "9.1", title: "Monitoring, measurement, analysis and evaluation", requirement: "The organization shall determine what needs to be monitored and measured, the methods for monitoring, measurement, analysis and evaluation, when to monitor and measure, when to analyse and evaluate results." },
        { clause: "9.1.1", title: "Monitoring, measurement - General", requirement: "The organization shall evaluate the performance and the effectiveness of the QMS. The organization shall retain appropriate documented information as evidence of the results." },
        { clause: "9.1.2", title: "Customer satisfaction", requirement: "The organization shall monitor customers' perceptions of the degree to which their needs and expectations have been fulfilled. The organization shall determine the methods for obtaining, monitoring and reviewing this information." },
        { clause: "9.1.3", title: "Analysis and evaluation", requirement: "The organization shall analyse and evaluate appropriate data and information arising from monitoring and measurement. The results of analysis shall be used to evaluate conformity of products and services, degree of customer satisfaction, performance and effectiveness of the QMS, if planning has been implemented effectively, effectiveness of actions taken to address risks and opportunities, performance of external providers, and need for improvements to the QMS." },
        { clause: "9.2", title: "Internal audit", requirement: "The organization shall conduct internal audits at planned intervals to provide information on whether the QMS conforms to the organization's own requirements and ISO 9001, and is effectively implemented and maintained." },
        { clause: "9.2.1", title: "Internal audit - Requirements", requirement: "The organization shall plan, establish, implement and maintain an audit programme including the frequency, methods, responsibilities, planning requirements and reporting. The audit programme shall take into consideration the importance of the processes concerned, changes affecting the organization, and the results of previous audits." },
        { clause: "9.2.2", title: "Internal audit - Conduct", requirement: "The organization shall define the audit criteria and scope for each audit, select auditors and conduct audits to ensure objectivity and impartiality of the audit process, ensure results are reported to relevant management, take appropriate correction and corrective actions without undue delay, and retain documented information as evidence of the implementation of the audit programme and the audit results." },
        { clause: "9.3", title: "Management review", requirement: "Top management shall review the organization's QMS, at planned intervals, to ensure its continuing suitability, adequacy, effectiveness and alignment with the strategic direction of the organization." },
        { clause: "9.3.1", title: "Management review - General", requirement: "The management review shall be planned and carried out taking into consideration the status of actions from previous management reviews, changes in external and internal issues, information on the performance and effectiveness of the QMS." },
        { clause: "9.3.2", title: "Management review inputs", requirement: "The management review shall be planned and carried out taking into consideration customer satisfaction and feedback, the extent to which quality objectives have been met, process performance and conformity of products and services, nonconformities and corrective actions, monitoring and measurement results, audit results, performance of external providers, adequacy of resources, effectiveness of actions taken to address risks and opportunities, and opportunities for improvement." },
        { clause: "9.3.3", title: "Management review outputs", requirement: "The outputs of the management review shall include decisions and actions related to opportunities for improvement, any need for changes to the QMS, and resource needs. The organization shall retain documented information as evidence of the results of management reviews." },

        // Clause 10 - Improvement
        { clause: "10.1", title: "General - Improvement", requirement: "The organization shall determine and select opportunities for improvement and implement any necessary actions to meet customer requirements and enhance customer satisfaction." },
        { clause: "10.2", title: "Nonconformity and corrective action", requirement: "When a nonconformity occurs, including any arising from complaints, the organization shall react to the nonconformity and take action to control and correct it and deal with the consequences." },
        { clause: "10.2.1", title: "Nonconformity and corrective action - Requirements", requirement: "The organization shall evaluate the need for action to eliminate the cause(s) of the nonconformity to prevent recurrence or occurrence elsewhere, by reviewing and analysing the nonconformity, determining the causes, determining if similar nonconformities exist or could potentially occur, implementing any action needed, reviewing the effectiveness of any corrective action taken, updating risks and opportunities determined during planning if necessary, and making changes to the QMS if necessary." },
        { clause: "10.2.2", title: "Nonconformity and corrective action - Documented information", requirement: "The organization shall retain documented information as evidence of the nature of the nonconformities and any subsequent actions taken, and the results of any corrective action." },
        { clause: "10.3", title: "Continual improvement", requirement: "The organization shall continually improve the suitability, adequacy and effectiveness of the quality management system. The organization shall consider the results of analysis and evaluation, and the outputs from management review, to determine if there are needs or opportunities that shall be addressed as part of continual improvement." }
    ];

    // ISO 14001 Environmental Management System clauses (Unique sections)
    if (standardName.includes('14001')) {
        const iso14001Specific = [
            { clause: "6.1.2", title: "Environmental aspects", requirement: "The organization shall determine the environmental aspects of its activities, products and services that it can control and those that it can influence, and their associated environmental impacts, considering a life cycle perspective." },
            { clause: "6.1.3", title: "Compliance obligations", requirement: "The organization shall determine and have access to the compliance obligations related to its environmental aspects." },
            { clause: "8.2", title: "Emergency preparedness and response", requirement: "The organization shall establish, implement and maintain the processes needed to prepare for and respond to potential emergency situations." }
        ];

        return iso9001Clauses.map(c => {
            const specific = iso14001Specific.find(s => s.clause === c.clause);
            if (specific) return specific;

            const mapped = {
                ...c,
                title: c.title.replace(/quality/gi, 'environmental').replace(/QMS/g, 'EMS').replace('customer', 'interested party'),
                requirement: c.requirement.replace(/quality/gi, 'environmental').replace(/QMS/g, 'EMS').replace(/customer(?!s)/gi, 'interested party')
            };

            if (mapped.subRequirements) {
                mapped.subRequirements = mapped.subRequirements.map(s =>
                    s.replace(/quality/gi, 'environmental').replace(/QMS/g, 'EMS').replace(/customer(?!s)/gi, 'interested party')
                );
            }

            return mapped;
        });
    }

    // ISO 45001 Occupational Health and Safety clauses (Unique sections)
    if (standardName.includes('45001')) {
        const iso45001Specific = [
            { clause: "5.4", title: "Consultation and participation of workers", requirement: "The organization shall establish, implement and maintain a process for consultation and participation of workers at all applicable levels and functions." },
            { clause: "6.1.2", title: "Hazard identification and assessment of risks and opportunities", requirement: "The organization shall establish, implement and maintain a process for hazard identification that is ongoing and proactive." },
            { clause: "8.1.2", title: "Eliminating hazards and reducing OH&S risks", requirement: "The organization shall establish, implement and maintain a process for the elimination of hazards and reduction of OH&S risks using the hierarchy of controls." }
        ];

        return iso9001Clauses.map(c => {
            const specific = iso45001Specific.find(s => s.clause === c.clause);
            if (specific) return specific;

            const mapped = {
                ...c,
                title: c.title.replace(/quality/gi, 'OH&S').replace(/QMS/g, 'OH&S MS').replace('customer', 'worker'),
                requirement: c.requirement.replace(/quality/gi, 'OH&S').replace(/QMS/g, 'OH&S management system').replace(/customer(?!s)/gi, 'worker')
            };

            if (mapped.subRequirements) {
                mapped.subRequirements = mapped.subRequirements.map(s =>
                    s.replace(/quality/gi, 'OH&S').replace(/QMS/g, 'OH&S management system').replace(/customer(?!s)/gi, 'worker')
                );
            }

            return mapped;
        });
    }

    if (standardName.includes('9001')) return iso9001Clauses;

    return iso9001Clauses; // Default fallback
}

// Lookup clause text from Knowledge Base (for NCR generation)
window.lookupClauseText = function (standardName, clauseNumber) {
    const kb = window.state.knowledgeBase || { standards: [] };
    const standard = kb.standards.find(s =>
        s.name.toLowerCase().includes(standardName.toLowerCase().replace('iso ', ''))
    );

    if (!standard || !standard.clauses) return null;

    const clause = standard.clauses.find(c =>
        c.clause === clauseNumber || c.clause.startsWith(clauseNumber)
    );

    return clause ? `${clause.title}: ${clause.requirement} ` : null;
};

// Update Knowledge Base Section Content (Manual Edit)
window.updateKBSection = function (docId, clauseId, newContent) {
    const kb = window.state.knowledgeBase;
    let doc = kb.standards.find(d => d.id === docId) ||
        kb.sops.find(d => d.id === docId) ||
        kb.policies.find(d => d.id === docId) ||
        kb.marketing.find(d => d.id === docId);

    if (doc && doc.clauses) {
        const clause = doc.clauses.find(c => c.clause === clauseId);
        if (clause) {
            clause.requirement = newContent;
            window.saveData();
            // Optional: Notification? unique notification might be annoying on every blur.
            // Maybe show a small toast or just save silently.
        }
    }
};

// Helper: Extract text from DOCX (ZIP containing XML) without external library
async function extractDocxText(uint8Array) {
    try {
        // DOCX is a ZIP file. We need to find "word/document.xml" entry
        // ZIP format: local file headers start with PK\x03\x04
        const data = uint8Array;
        const files = [];
        let offset = 0;

        // Parse ZIP local file headers
        while (offset < data.length - 4) {
            // Look for local file header signature PK\x03\x04
            if (data[offset] === 0x50 && data[offset + 1] === 0x4B &&
                data[offset + 2] === 0x03 && data[offset + 3] === 0x04) {

                const fnameLen = data[offset + 26] | (data[offset + 27] << 8);
                const extraLen = data[offset + 28] | (data[offset + 29] << 8);
                const compMethod = data[offset + 8] | (data[offset + 9] << 8);
                const compSize = data[offset + 18] | (data[offset + 19] << 8) | (data[offset + 20] << 16) | (data[offset + 21] << 24);
                const uncompSize = data[offset + 22] | (data[offset + 23] << 8) | (data[offset + 24] << 16) | (data[offset + 25] << 24);

                const fnameStart = offset + 30;
                const fname = new TextDecoder().decode(data.slice(fnameStart, fnameStart + fnameLen));
                const dataStart = fnameStart + fnameLen + extraLen;
                const fileData = data.slice(dataStart, dataStart + compSize);

                files.push({ name: fname, data: fileData, compressed: compMethod !== 0, uncompSize });
                offset = dataStart + compSize;
            } else {
                offset++;
            }
        }

        // Find word/document.xml
        const docEntry = files.find(f => f.name === 'word/document.xml');
        if (!docEntry) {
            console.warn('[DOCX] word/document.xml not found in ZIP');
            return null;
        }

        let xmlText;
        if (docEntry.compressed) {
            // Deflate compressed - use DecompressionStream API (modern browsers)
            if (typeof DecompressionStream !== 'undefined') {
                const ds = new DecompressionStream('raw');
                const writer = ds.writable.getWriter();
                const reader = ds.readable.getReader();
                writer.write(docEntry.data);
                writer.close();

                const chunks = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
                const totalLen = chunks.reduce((a, c) => a + c.length, 0);
                const combined = new Uint8Array(totalLen);
                let pos = 0;
                for (const chunk of chunks) {
                    combined.set(chunk, pos);
                    pos += chunk.length;
                }
                xmlText = new TextDecoder().decode(combined);
            } else {
                console.warn('[DOCX] DecompressionStream not available');
                return null;
            }
        } else {
            xmlText = new TextDecoder().decode(docEntry.data);
        }

        // Parse XML to extract text (strip tags, keep paragraph breaks)
        const text = xmlText
            .replace(/<w:p[^>]*>/g, '\n')  // Paragraph breaks
            .replace(/<w:tab\/>/g, '\t')    // Tabs
            .replace(/<w:br[^>]*\/>/g, '\n') // Line breaks
            .replace(/<[^>]+>/g, '')         // Strip all XML tags
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/\n{3,}/g, '\n\n')     // Collapse multiple blank lines
            .trim();

        return text;
    } catch (err) {
        console.error('[DOCX] Extraction error:', err);
        return null;
    }
}

// Helper: Extract text from file (PDF/DOCX/Text)
window.extractTextFromFile = async function (file) {
    // Check if PDF.js is loaded
    if (file.type === 'application/pdf' && (typeof pdfjsLib === 'undefined')) {
        console.warn('PDF.js library not loaded. Skipping text extraction.');
        return null; // Graceful degradation
    }

    // Disable PDF.js worker globally to bypass CSP blob: restrictions
    if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }

    const extractionPromise = async () => {
        try {
            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                // Use isEvalSupported:false + disableWorker for max CSP compatibility
                const loadingTask = pdfjsLib.getDocument({
                    data: arrayBuffer,
                    disableWorker: true,
                    isEvalSupported: false
                });
                const pdf = await loadingTask.promise;
                let fullText = '';
                const maxPages = pdf.numPages; // Extract ALL pages for complete analysis
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                return fullText;
            } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                // DOCX extraction: DOCX is a ZIP containing word/document.xml

                // Use mammoth.js if available (better formatting)
                if (typeof mammoth !== 'undefined') {
                    const arrayBuffer = await file.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    return result.value;
                }

                // Fallback: Manual ZIP parsing (no library needed)
                const arrayBuffer = await file.arrayBuffer();
                const uint8 = new Uint8Array(arrayBuffer);

                // Find word/document.xml in the ZIP
                const docXml = await extractDocxText(uint8);
                if (docXml) {
                    return docXml;
                }

                console.warn('[DOCX Extraction] Could not extract text from DOCX');
                return null;
            } else if (file.name.endsWith('.doc')) {
                // .doc (legacy binary format) - cannot parse in browser
                console.warn('[DOC Extraction] Legacy .doc format not supported. Please convert to .docx or .pdf');
                window.showNotification('Legacy .doc format not supported. Please save as .docx or .pdf', 'warning');
                return null;
            } else if (file.type.startsWith('text/')) {
                return await file.text();
            }
        } catch (e) {
            console.error('Text extraction error:', e);
            throw e;
        }
        return null;
    };

    // Race against 120-second timeout to prevent UI freeze on very large files
    const timeoutPromise = new Promise((resolve) => setTimeout(() => {
        console.warn('Text extraction timed out after 120s - file may be too large');
        resolve(null);
    }, 120000));

    try {
        return await Promise.race([extractionPromise(), timeoutPromise]);
    } catch (e) {
        return null;
    }
};

// Analyze Custom Document with AI
window.analyzeCustomDocWithAI = async function (doc, type) {
    const typeLabel = type === 'sop' ? 'Standard Operating Procedure' : type === 'policy' ? 'Policy' : 'Company Profile/Marketing';
    const context = doc.extractedText.substring(0, 15000); // Limit context size

    const prompt = `You are a QA Auditor.Analyze this ${typeLabel} text and extract key sections.
    Return a JSON array: [{ "clause": "1", "title": "Section Title", "requirement": "Summary of content..." }].
        Extract 6 - 10 key sections like Purpose, Scope, Responsibilities, or Company Overview, Products, etc.
    Keep summaries concise.

        Text:
    ${context}
    
    Return ONLY JSON.`;

    try {
        const response = await AI_SERVICE.callProxyAPI(prompt);
        let validJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const tabs = JSON.parse(validJson);

        doc.clauses = tabs;
        doc.status = 'ready';
        window.saveData();

        // Refresh UI
        if (typeof switchSettingsSubTab === 'function') {
            switchSettingsSubTab('knowledge', 'kb');
        } else {
            renderSettings();
        }
        window.showNotification(`${doc.name} analyzed with AI!`, 'success');
        return true;
    } catch (e) {
        console.error('AI Parse Error', e);
        throw e;
    }
};

// Handle Re-analyze / Reset Action
window.handleReanalyze = function (docId, docType) {
    if (docType === 'standard') {
        window.showAnalysisModeModal(docId, true);
    } else {
        // Reset analysis (uses template)
        window.analyzeDocument(docType, docId);
        window.closeModal();
    }
};

// Build descriptive checklist title from doc metadata
function _buildChecklistTitle(doc) {
    const parts = [doc.name];
    if (doc.lastClientName) parts.push(doc.lastClientName);
    const typeLabel = doc.lastAuditType === 'surveillance' ? 'Surveillance' : 'Initial';
    parts.push(`${typeLabel} Audit Checklist`);
    return parts.join(' - ');
}

// Create a checklist from KB extracted questions
window.createChecklistFromKB = async function (docId) {
    const kb = window.state.knowledgeBase;
    const doc = kb.standards.find(d => d.id === docId);
    if (!doc || !doc.generatedChecklist || doc.generatedChecklist.length === 0) {
        window.showNotification('No checklist questions found. Re-analyze the standard first.', 'error');
        return;
    }

    // Build hierarchical checklist structure: mainClause -> subClause -> items
    // Supports 2-4 level hierarchy (e.g., 4 -> 4.1 -> 4.1.1 -> items)
    const mainClauseTitles = {
        '4': 'Context of the Organization', '5': 'Leadership', '6': 'Planning',
        '7': 'Support', '8': 'Operation', '9': 'Performance Evaluation', '10': 'Improvement',
        'A.5': 'Organizational Controls', 'A.6': 'People Controls',
        'A.7': 'Physical Controls', 'A.8': 'Technological Controls',
        'A': 'Annex A Controls', 'General': 'General Requirements'
    };

    const clauseGroups = {};
    // Filter out clauses 1-3 (non-requirement sections in ISO standards)
    const auditableItems = doc.generatedChecklist.filter(item => {
        const clauseNum = parseFloat(item.clause);
        return isNaN(clauseNum) || clauseNum >= 4;
    });
    auditableItems.forEach(item => {
        const parts = item.clause.split('.');
        let mainNum, subNum;

        if (parts[0] === 'A' && parts.length >= 2) {
            // Annex A: group by A.5, A.6, A.7, A.8
            mainNum = `A.${parts[1]}`;
            subNum = parts.length >= 3 ? `A.${parts[1]}.${parts[2]}` : mainNum;
        } else {
            mainNum = parts[0] || 'General';
            subNum = parts.length >= 2 ? parts.slice(0, 2).join('.') : mainNum;
        }

        if (!clauseGroups[mainNum]) {
            clauseGroups[mainNum] = {
                mainClause: mainNum,
                title: mainClauseTitles[mainNum] || `Clause ${mainNum}`,
                subClauses: {}
            };
        }

        if (!clauseGroups[mainNum].subClauses[subNum]) {
            clauseGroups[mainNum].subClauses[subNum] = {
                clause: subNum,
                title: '',
                items: []
            };
        }

        clauseGroups[mainNum].subClauses[subNum].items.push({
            clause: item.clause,
            requirement: item.requirement
        });
    });

    // Convert subClauses from object to sorted array, preserve items as nested
    const clauseArray = Object.values(clauseGroups).map(group => ({
        mainClause: group.mainClause,
        title: group.title,
        subClauses: Object.values(group.subClauses).sort((a, b) => {
            const aParts = a.clause.split('.').map(Number);
            const bParts = b.clause.split('.').map(Number);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                if ((aParts[i] || 0) !== (bParts[i] || 0)) return (aParts[i] || 0) - (bParts[i] || 0);
            }
            return 0;
        }).map(sub => ({
            clause: sub.clause,
            title: sub.title,
            items: sub.items,
            // Keep backward compat: if only 1 item and clause matches subClause, flatten
            requirement: sub.items.length === 1 && sub.items[0].clause === sub.clause ? sub.items[0].requirement : undefined
        }))
    })).sort((a, b) => {
        const aNum = parseInt(a.mainClause, 10) || 999;
        const bNum = parseInt(b.mainClause, 10) || 999;
        return aNum - bNum;
    });

    const newChecklist = {
        id: Date.now(),
        name: _buildChecklistTitle(doc),
        standard: doc.name,
        type: doc.lastClientName ? 'custom' : 'global',
        auditType: doc.lastAuditType || 'initial',
        clientName: doc.lastClientName || '',
        clauses: clauseArray,
        createdBy: window.state.currentUser?.name || 'Admin',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        source: 'kb-generated'
    };

    if (!window.state.checklists) window.state.checklists = [];
    window.state.checklists.push(newChecklist);
    window.saveData();

    // Sync to Supabase checklists table
    if (window.SupabaseClient?.isInitialized) {
        try {
            await window.SupabaseClient.client
                .from('checklists')
                .upsert({
                    id: String(newChecklist.id),
                    name: newChecklist.name,
                    standard: newChecklist.standard,
                    type: newChecklist.type,
                    clauses: newChecklist.clauses,
                    created_by: newChecklist.createdBy,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });
        } catch (dbErr) {
            console.error('[KB] Failed to sync checklist to Supabase:', dbErr);
        }
    }

    window.closeModal();
    window.showNotification(`Created checklist "${newChecklist.name}" with ${auditableItems.length} questions (clauses 4-10)!`, 'success');
};

// Delete Knowledge Document
window.deleteKnowledgeDoc = async function (type, id) {
    if (!confirm('Are you sure you want to delete this document from the Knowledge Base?')) return;

    const kb = window.state.knowledgeBase;
    let doc = null;

    // Find the document
    if (type === 'standard') {
        doc = kb.standards.find(d => d.id === id);
        kb.standards = kb.standards.filter(d => d.id != id);
    } else if (type === 'sop') {
        doc = kb.sops.find(d => d.id === id);
        kb.sops = kb.sops.filter(d => d.id != id);
    } else if (type === 'policy') {
        doc = kb.policies.find(d => d.id === id);
        kb.policies = kb.policies.filter(d => d.id != id);
    } else {
        doc = kb.marketing.find(d => d.id === id);
        kb.marketing = kb.marketing.filter(d => d.id != id);
    }

    window.saveData();
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }
    window.showNotification('Document removed from Knowledge Base', 'success');

    // Delete from Supabase (storage + database)
    if (window.SupabaseClient && window.SupabaseClient.isInitialized && doc) {
        try {
            // Delete from storage if cloudPath exists
            if (doc.cloudPath) {
                const { data, error } = await window.SupabaseClient.client.storage
                    .from('documents')
                    .remove([doc.cloudPath]);
                if (error) {
                    console.error('[Delete] Storage deletion error:', error);
                } else {
                }
            } else {
                console.warn('[Delete] No cloudPath found for document:', doc);
            }

            // Delete from documents table
            await window.SupabaseClient.client
                .from('documents')
                .delete()
                .eq('id', id);

            // Sync settings (KB metadata)
            await window.SupabaseClient.syncSettingsToSupabase(window.state.settings);
        } catch (e) {
            console.error('Cloud deletion failed:', e);
            window.showNotification('Document deleted locally, but cloud sync failed', 'warning');
        }
    }
};

// ============================================
// VIEW KNOWLEDGE BASE ANALYSIS
// Shows extracted clauses and NCR references
// ============================================
window.viewKBAnalysis = function (docId) {
    const kb = window.state.knowledgeBase;

    // Search across all collections
    let doc = kb.standards.find(d => d.id === docId);
    let docType = 'standard';
    if (!doc) {
        doc = kb.sops.find(d => d.id === docId);
        docType = 'sop';
    }
    if (!doc) {
        doc = kb.policies.find(d => d.id === docId);
        docType = 'policy';
    }
    if (!doc) {
        doc = kb.marketing.find(d => d.id === docId);
        docType = 'marketing';
    }
    if (!doc) {
        window.showNotification('Document not found', 'error');
        return;
    }

    const clauses = doc.clauses || [];

    // Find NCRs that reference this standard
    const auditReports = window.state.auditReports || [];
    const referencedNCRs = [];

    auditReports.forEach(report => {
        const ncrs = report.ncrs || [];
        ncrs.forEach(ncr => {
            // Normalize standard names for reliable matching
            // Extract core number: "ISO 9001:2015" → "9001", "ISO/IEC 27001" → "27001"
            const extractStdNum = (s) => s ? (s.match(/\b(\d{4,5})\b/) || [])[1] || '' : '';
            const docStdNum = extractStdNum(doc.name);
            const ncrStdNum = extractStdNum(ncr.standard || ncr.clause || '');

            if (docStdNum && ncrStdNum && docStdNum === ncrStdNum) {
                referencedNCRs.push({
                    reportId: report.id,
                    clientName: report.clientName,
                    ncrId: ncr.id,
                    clause: ncr.clause,
                    finding: ncr.finding,
                    severity: ncr.type || ncr.severity
                });
            }
        });
    });

    document.getElementById('modal-title').textContent = `Analysis: ${doc.name}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom: 1rem;">
            <!-- Analysis Status -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #f0fdf4; border-radius: 8px; margin-bottom: 1rem;">
                <div>
                    <strong style="color: #166534;"><i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i>Analysis Complete</strong>
                    <div style="font-size: 0.85rem; color: #166534; margin-top: 0.25rem;">
                        ${clauses.length} ${docType === 'standard' ? 'clauses' : 'sections'} extracted${doc.checklistCount ? ` • ${doc.checklistCount} checklist questions` : ''} • Uploaded ${doc.uploadDate}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    ${docType === 'standard' && doc.generatedChecklist && doc.generatedChecklist.length > 0 ? `
                        <button class="btn btn-sm btn-primary" data-action="createChecklistFromKB" data-id="${doc.id}" title="Create audit checklist from extracted questions" aria-label="Checklist">
                            <i class="fa-solid fa-list-check" style="margin-right: 0.25rem;"></i>Create Checklist
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-secondary" data-action="handleReanalyze" data-arg1="${doc.id}" data-arg2="${docType}" title="${docType === 'standard' ? 'Re-analyze with AI' : 'Reset Analysis Template'}" aria-label="Refresh">
                        <i class="fa-solid fa-rotate" style="margin-right: 0.25rem;"></i>${docType === 'standard' ? 'Re-analyze' : 'Reset'}
                    </button>
                    ${docType === 'standard' ? `<span class="badge" style="background: #dcfce7; color: #166534;">Ready for NCR</span>` : ''}
                </div>
            </div>
            
            <!-- NCR References (Standards Only) -->
            ${docType === 'standard' ? (referencedNCRs.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h4 style="margin: 0 0 0.75rem 0; color: #7c3aed;">
                        <i class="fa-solid fa-link" style="margin-right: 0.5rem;"></i>NCR References (${referencedNCRs.length})
                    </h4>
                    <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
                        <table style="width: 100%; font-size: 0.85rem;">
                            <thead style="position: sticky; top: 0; background: #f8fafc;">
                                <tr>
                                    <th style="padding: 0.5rem;">Client</th>
                                    <th style="padding: 0.5rem;">Clause</th>
                                    <th style="padding: 0.5rem;">Finding</th>
                                    <th style="padding: 0.5rem;">Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${referencedNCRs.map(ncr => `
                                    <tr>
                                        <td style="padding: 0.5rem;">${window.UTILS.escapeHtml(ncr.clientName || '-')}</td>
                                        <td style="padding: 0.5rem;"><span class="badge bg-blue">${window.UTILS.escapeHtml(ncr.clause || '-')}</span></td>
                                        <td style="padding: 0.5rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.UTILS.escapeHtml(ncr.finding || '-')}">${window.UTILS.escapeHtml(ncr.finding || '-')}</td>
                                        <td style="padding: 0.5rem;"><span class="badge" style="background: ${ncr.severity === 'Major' ? '#fee2e2' : '#fef3c7'}; color: ${ncr.severity === 'Major' ? '#991b1b' : '#92400e'};">${window.UTILS.escapeHtml(ncr.severity || 'NC')}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : `
                <div style="padding: 0.75rem; background: #f8fafc; border-radius: 6px; margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                    No NCRs have referenced this standard yet. Clauses will be used when generating new NCR findings.
                </div>
            `) : ''}
            
            <!-- Extracted Sections -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <h4 style="margin: 0; color: #0369a1;">
                    <i class="fa-solid fa-list-check" style="margin-right: 0.5rem;"></i>${docType === 'standard' ? 'Extracted Clauses' : 'Document Sections'} (${clauses.length})
                </h4>
                <div style="display: flex; gap: 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">
                    ${docType === 'standard' ? `
                        <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 10px;">
                            ${clauses.filter(c => c.subRequirements && c.subRequirements.length > 0).length} with sub-items
                        </span>
                        <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 10px;">
                            ${clauses.reduce((a, c) => a + (c.checklistQuestions?.length || 0), 0)} checklist Qs
                        </span>
                    ` : ''}
                </div>
            </div>

            <!-- Group clauses by main section -->
            <div style="max-height: 450px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                ${(() => {
            // Group by main clause number (4, 5, 6...)
            const sectionTitles = { '4': 'Context of the Organization', '5': 'Leadership', '6': 'Planning', '7': 'Support', '8': 'Operation', '9': 'Performance Evaluation', '10': 'Improvement' };
            const groups = {};
            clauses.forEach(c => {
                const main = c.clause.split('.')[0];
                if (!groups[main]) groups[main] = [];
                groups[main].push(c);
            });

            return Object.keys(groups).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map(mainNum => {
                const items = groups[mainNum];
                const sTitle = sectionTitles[mainNum] || 'Other';
                return `
                            <div style="border-bottom: 1px solid var(--border-color);">
                                <div style="background: linear-gradient(135deg, #0369a1, #0284c7); color: white; padding: 0.6rem 1rem; font-weight: 600; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
                                    <span>Clause ${mainNum} — ${sTitle}</span>
                                    <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">${items.length} items</span>
                                </div>
                                ${items.map(c => `
                                    <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9;">
                                        <div style="display: flex; gap: 0.5rem; align-items: flex-start; margin-bottom: 0.4rem;">
                                            <span style="background: #dbeafe; color: #1e40af; padding: 1px 8px; border-radius: 10px; font-size: 0.78rem; font-weight: 600; white-space: nowrap;">${window.UTILS.escapeHtml(c.clause)}</span>
                                            <strong style="font-size: 0.85rem; color: #1e293b;">${window.UTILS.escapeHtml(c.title)}</strong>
                                        </div>
                                        <div style="color: #475569; font-size: 0.82rem; line-height: 1.5; padding-left: 0.5rem; border-left: 3px solid #e2e8f0; margin-left: 0.25rem;"
                                             contenteditable="true" 
                                             onblur="window.updateKBSection('${doc.id}', '${c.clause}', this.innerText)" 
                                             title="Click to edit"
                                             style="cursor: text;">
                                            ${window.UTILS.escapeHtml(c.requirement)}
                                        </div>
                                        ${c.subRequirements && c.subRequirements.length > 0 ? `
                                            <ul style="margin: 0.4rem 0 0 1.5rem; padding: 0; font-size: 0.8rem; color: #374151; line-height: 1.6;">
                                                ${c.subRequirements.map(sub => `
                                                    <li style="margin-bottom: 0.15rem;">${window.UTILS.escapeHtml(sub)}</li>
                                                `).join('')}
                                            </ul>
                                        ` : ''}
                                        ${c.checklistQuestions && c.checklistQuestions.length > 0 ? `
                                            <div style="margin-top: 0.5rem; padding: 0.5rem; background: #fffbeb; border-radius: 6px; border-left: 3px solid #f59e0b;">
                                                <div style="font-size: 0.72rem; font-weight: 600; color: #92400e; margin-bottom: 0.3rem;">
                                                    <i class="fa-solid fa-clipboard-question" style="margin-right: 0.3rem;"></i>CHECKLIST QUESTIONS
                                                </div>
                                                ${c.checklistQuestions.map(q => `
                                                    <div style="font-size: 0.78rem; color: #78350f; padding: 0.15rem 0; padding-left: 0.75rem; position: relative;">
                                                        <span style="position: absolute; left: 0; color: #d97706;">▸</span>${window.UTILS.escapeHtml(q)}
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        `;
            }).join('');
        })()}
            </div>
            
            <!-- How it's used -->
            <div style="margin-top: 1rem; padding: 0.75rem; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <strong style="color: #1e40af;">How this is used:</strong>
                <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; font-size: 0.85rem; color: #1e40af;">
                    ${docType === 'standard' ? `
                        <li>When creating NCRs, AI references these clauses to suggest findings</li>
                        <li>Clause requirements are included in NCR descriptions</li>
                        <li>Checklist questions can be exported as an audit checklist</li>
                        <li>Helps ensure audit findings align with standard requirements</li>
                    ` : docType === 'marketing' ? `
                        <li>Provides organizational context for Audit Planning</li>
                        <li>Used to brief auditors on company products, services, and market</li>
                        <li>Helps tailor audit questions to the organization's context</li>
                    ` : `
                        <li>References for confirming process compliance</li>
                        <li>Used to cross-check specific procedure steps</li>
                        <li>Ensures audit evidence aligns with internal controls</li>
                    `}
                </ul>
            </div>
        </div>
    `;

    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
};

// Re-analyze standard with AI for more detailed extraction
window.reanalyzeStandard = async function (docId, mode = 'standard', auditType = 'initial', clientId = '') {
    const kb = window.state.knowledgeBase;
    const doc = kb.standards.find(d => d.id === docId);
    if (!doc) {
        console.warn('Document not found for re-analysis:', docId);
        return;
    }

    // Close the current modal
    window.closeModal();

    // Show processing notification
    const typeLabel = auditType === 'surveillance' ? ' surveillance' : '';
    window.showNotification(`Re-analyzing ${doc.name} (${mode}${typeLabel} mode)...`, 'info');

    // Update status to processing
    doc.status = 'processing';
    window.saveData();
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    }

    try {
        // Show progress overlay
        window._kbProgress?.show(`Starting ${mode}${typeLabel} re-analysis...`, 5);

        // Reuse the main KB analysis function with selected mode
        await extractStandardClauses(doc, doc.name, mode, auditType, clientId);

        // Complete progress
        window._kbProgress?.show('✅ Re-analysis complete!', 100);
        setTimeout(() => window._kbProgress?.hide(), 1500);

        // After analysis, show result
        if (doc.status === 'ready') {
            window.showNotification(`Re-analysis complete! ${doc.clauses?.length || 0} clauses, ${doc.checklistCount || 0} questions extracted.`, 'success');
            if (typeof switchSettingsSubTab === 'function') {
                switchSettingsSubTab('knowledge', 'kb');
            }
            setTimeout(() => window.viewKBAnalysis(docId), 500);
            return;
        }
    } catch (error) {
        console.error('Re-analysis error:', error);
        window._kbProgress?.hide();
    }

    // Fallback if AI fails - use built-in detailed clauses
    doc.clauses = getBuiltInClauses(doc.name);
    doc.status = 'ready';
    doc.lastAnalyzed = new Date().toISOString().split('T')[0];
    window.saveData();

    window.showNotification(`Re-analysis complete using built-in clause database (${doc.clauses.length} clauses).`, 'info');
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }
    setTimeout(() => window.viewKBAnalysis(docId), 500);
};

if (window.Logger) Logger.debug('Modules', 'settings-kb.js loaded successfully.');

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { uploadKnowledgeDoc, showAnalysisModeModal, _setAuditType, _kbProgress, lookupClauseText, updateKBSection, handleReanalyze, viewKBAnalysis };
}
