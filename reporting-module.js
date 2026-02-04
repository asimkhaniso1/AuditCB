// ============================================
// REPORTING MODULE - Report QA, Review, Publish
// ============================================
// Separated from execution-module.js for better maintainability

// Render the Summary/Report Drafting Tab
function renderReportSummaryTab(report, tabContent) {
    const h = window.UTILS.escapeHtml; // Alias for sanitization

    // Role-based access: Only Lead Auditor, Cert Manager, and Admin can access drafting
    const userRole = window.state.currentUser?.role;
    const canAccessDrafting = userRole === window.CONSTANTS.ROLES.LEAD_AUDITOR ||
        userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER ||
        userRole === 'Admin' || userRole === window.CONSTANTS.ROLES.ADMIN;

    if (!canAccessDrafting) {
        window.SafeDOM.setHTML(tabContent, `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-lock" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <h3 style="margin-bottom: 0.5rem; color: var(--text-secondary);">Access Restricted</h3>
                <p style="color: #94a3b8; margin-bottom: 1rem;">Audit Report Drafting is available to Admin, Lead Auditors and Certification Managers only.</p>
                <p style="font-size: 0.85rem; color: #64748b;">Current Role: <strong>${userRole || 'Unknown'}</strong></p>
            </div>
        `);
        return;
    }

    const ncrCount = (report.ncrs || []).length;
    const majorCount = (report.ncrs || []).filter(n => n.type === 'major').length;
    const minorCount = (report.ncrs || []).filter(n => n.type === 'minor').length;

    let actionButtons = '';

    // Workflow: Draft -> Review -> Approved -> Finalized
    if (report.status === window.CONSTANTS.STATUS.IN_REVIEW) {
        const isCertManager = window.state.currentUser?.role === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER;

        actionButtons = `
            <button class="btn btn-warning" onclick="window.revertToDraft(${report.id})">
                <i class="fa-solid fa-rotate-left" style="margin-right: 0.5rem;"></i> Revert to Draft
            </button>
            ${isCertManager ? `
            <div style="display: flex; gap: 0.5rem; flex-direction: column; width: 100%;">
                <button class="btn btn-info" style="color: white; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border: none;" onclick="window.runContextAnalysis(${report.id})">
                    <i class="fa-solid fa-robot" style="margin-right: 0.5rem;"></i> AI Context Analysis
                </button>
                <div id="ai-context-result-${report.id}" style="display: none; background: #eef2ff; padding: 10px; border-radius: 6px; font-size: 0.85rem; border: 1px solid #c7d2fe; margin-bottom: 5px;"></div>
                <button class="btn btn-primary" style="background-color: #8b5cf6; border-color: #7c3aed;" onclick="window.approveReport(${report.id})">
                    <i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Approve (Cert Manager)
                </button>
            </div>
            ` : `
            <button class="btn btn-secondary" style="flex: 1; opacity: 0.7; cursor: not-allowed;" disabled>
                <i class="fa-solid fa-hourglass-half" style="margin-right: 0.5rem;"></i> Pending Approval
            </button>
            `}
        `;
    } else if (report.status === window.CONSTANTS.STATUS.APPROVED) {
        actionButtons = `
             <button class="btn btn-warning" onclick="window.revertToReview(${report.id})">
                 <i class="fa-solid fa-pen-to-square" style="margin-right: 0.5rem;"></i> Re-open Review
            </button>
            <button class="btn btn-success" style="flex: 1;" onclick="publishReport(${report.id})">
                <i class="fa-solid fa-file-signature" style="margin-right: 0.5rem;"></i> Publish Final Report
            </button>
        `;
    } else if (report.status === window.CONSTANTS.STATUS.PUBLISHED || report.status === window.CONSTANTS.STATUS.FINALIZED) {
        actionButtons = `
            <button class="btn btn-outline-primary" onclick="window.generateAuditReport(${report.id})" title="Open print window">
                <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Print Report
            </button>
            <button class="btn btn-secondary" onclick="window.downloadAuditReportPDF(${report.id})" title="Download as PDF file">
                <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Download PDF
            </button>
            <button class="btn btn-primary" style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border: none;" onclick="window.uploadReportToCloud(${report.id})">
                <i class="fa-solid fa-cloud-arrow-up" style="margin-right: 0.5rem;"></i> Save to Cloud
            </button>
        `;
    } else {
        actionButtons = `
            <button class="btn btn-secondary" onclick="window.saveReportDraft(${report.id})">
                <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Draft
            </button>
            <button class="btn btn-primary" style="flex: 1;" onclick="submitForReview(${report.id})">
                <i class="fa-solid fa-paper-plane" style="margin-right: 0.5rem;"></i> Submit for Review
            </button>
        `;
    }

    // Combine findings for Review
    const allFindings = [];
    (report.checklistProgress || []).forEach((item, idx) => {
        if (item.status === window.CONSTANTS.STATUS.NC) {
            allFindings.push({ ...item, source: 'checklist', idxInArr: idx, type: item.ncrType || 'minor', description: item.ncrDescription || item.comment || 'Checklist Finding', clause: 'Checklist' });
        }
    });
    (report.ncrs || []).forEach((item, idx) => {
        allFindings.push({ ...item, source: 'manual', idxInArr: idx, type: item.type || 'minor', description: item.description, clause: item.clause });
    });

    const pendingCount = allFindings.filter(f => f.type === window.CONSTANTS.NCR_TYPES.PENDING).length;

    const ncrReviewHTML = allFindings.map(n => {
        const isPending = n.type === window.CONSTANTS.NCR_TYPES.PENDING;
        const color = isPending ? '#8b5cf6' : (n.type === 'major' ? 'var(--danger-color)' : 'var(--warning-color)');

        return `
        <div style="background: #f8fafc; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; border-left: 4px solid ${color}; ${isPending ? 'border: 2px solid #8b5cf6; background: #f5f3ff;' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                 <div style="flex: 1;">
                    <strong style="font-size: 0.8rem; color: ${color}; text-transform: uppercase;">${isPending ? '<i class="fa-solid fa-flag"></i> Flagged (Pending Review)' : n.type}</strong>
                    <div style="font-weight: 600; margin-bottom: 2px;">${h(n.clause || '-')}</div>
                    <div style="font-size: 0.9rem;">${h(n.description)}</div>
                 </div>
                 
                 ${isPending ? `
                    <div style="display: flex; gap: 5px; flex-direction: column; align-items: flex-end;">
                        <!-- AI Classify Removed for Lead Auditor Review Stage -->
                        <div style="display: flex; gap: 2px;">
                            <button class="btn btn-sm btn-warning" style="font-size: 0.7rem; padding: 2px 5px;" onclick="window.classifyFinding(${report.id}, '${n.source}', ${n.idxInArr}, '${window.CONSTANTS.NCR_TYPES.MINOR}')">Minor</button>
                            <button class="btn btn-sm btn-danger" style="font-size: 0.7rem; padding: 2px 5px;" onclick="window.classifyFinding(${report.id}, '${n.source}', ${n.idxInArr}, '${window.CONSTANTS.NCR_TYPES.MAJOR}')">Major</button>
                        </div>
                    </div>
                 ` : `<span class="badge" style="background: #e2e8f0; color: #64748b; font-size: 0.7rem;">${n.source}</span>`}
            </div>
        </div>
        `;
    }).join('') || '<div style="padding: 1rem; text-align: center; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">No findings to review. Seamless audit!</div>';

    if (pendingCount > 0) {
        window.showNotification(`${pendingCount} findings are pending classification.`, 'warning');
    }

    window.SafeDOM.setHTML(tabContent, `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="margin: 0;">Audit Report Drafting</h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">Review findings and finalize report content.</p>
                </div>
                ${(function () {
            const role = (window.state.currentUser?.role || '').toLowerCase().trim();
            // Check against CONSTANTS first, then fallback to string matching
            const isAdmin = role === 'admin' || role === 'administrator' ||
                userRole === window.CONSTANTS.ROLES.ADMIN;
            const isCertManager = role === 'certification manager' || role === 'cert manager' ||
                userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER;
            const isLeadAuditor = role === 'lead auditor' || role === 'lead' ||
                userRole === window.CONSTANTS.ROLES.LEAD_AUDITOR;

            return isAdmin || isCertManager || isLeadAuditor;
        })() ? `
                <button id="btn-ai-draft-${report.id}" class="btn btn-sm btn-info" style="color: white; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);" onclick="window.generateAIConclusion('${report.id}')">
                    <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> Auto-Draft with AI
                </button>
                ` : `
                <span style="font-size: 0.8rem; color: var(--text-secondary); padding: 0.5rem 1rem; background: #f1f5f9; border-radius: 6px;">
                    <i class="fa-solid fa-lock" style="margin-right: 0.5rem;"></i> AI Draft (Manager/Admin Only) - Current: ${userRole || 'Unknown'}
                </span>
                `}
            </div>

            <!--Role - Based Workflow Cards-- >
            <div style="margin-bottom: 2rem; background: ${userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER ? '#f0fdf4' : '#eff6ff'}; border: 1px solid ${userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER ? '#bbf7d0' : '#bfdbfe'}; border-radius: 8px; padding: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 1.5rem;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: white; color: ${userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER ? '#16a34a' : '#2563eb'}; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <i class="fa-solid ${userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER ? 'fa-signature' : 'fa-pencil-ruler'}"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Active Role: ${userRole}</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">
                            ${userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER ? 'Approval Required' : 'Drafting & Review'}
                        </div>
                        <div style="color: #64748b; margin-top: 0.25rem;">
                            ${userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER
            ? 'Verify technical correctness, ensure all NCs are addressed, and issue the final decision.'
            : 'Consolidate findings, draft the executive summary, and submit for Certification Manager review.'}
                        </div>
                    </div>
                </div>
                
                <div style="text-align: right; border-left: 1px solid rgba(0,0,0,0.1); padding-left: 2rem;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Current Status</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: ${userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER ? '#16a34a' : '#2563eb'};">
                        ${h(report.status)}
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
                
                <!-- Left Column: Stats & Review -->
                <div>
                    <h4 style="font-size: 1rem; margin-bottom: 1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;">
                        <i class="fa-solid fa-clipboard-check" style="color: var(--primary-color); margin-right: 0.5rem;"></i> Findings Summary
                    </h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1.5rem;">
                        <div style="background: #eff6ff; padding: 10px; border-radius: 6px; text-align: center;">
                            <div style="font-weight: 700; color: var(--primary-color); font-size: 1.25rem;">${majorCount}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">Major NCs</div>
                        </div>
                        <div style="background: #fff7ed; padding: 10px; border-radius: 6px; text-align: center;">
                            <div style="font-weight: 700; color: var(--warning-color); font-size: 1.25rem;">${minorCount}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">Minor NCs</div>
                        </div>
                    </div>

                    <div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
                        ${ncrReviewHTML}
                    </div>
                </div>

                <!-- Right Column: Editorial -->
                <div>
                    <h4 style="font-size: 1rem; margin-bottom: 1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;">
                        <i class="fa-solid fa-pen-nib" style="color: var(--primary-color); margin-right: 0.5rem;"></i> Report Content
                    </h4>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Executive Summary</label>
                        <textarea id="exec-summary" rows="5" class="form-control" placeholder="High-level overview of the audit scope and execution...">${h(report.execSummary)}</textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                        <div>
                            <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Key Strengths</label>
                            <textarea id="strengths" rows="4" class="form-control" placeholder="Positive observations...">${h(report.strengths)}</textarea>
                        </div>
                        <div>
                            <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Areas for Improvement</label>
                            <textarea id="improvements" rows="4" class="form-control" placeholder="OFI and weaknesses...">${h(report.improvements)}</textarea>
                        </div>
                    </div>

                    <!-- Meeting Records Section -->
                     <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Meeting Records</h4>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; border: 1px solid #e2e8f0;">
                         <!-- Meeting Records (Existing) -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <!-- Opening Meeting -->
                            <div>
                                <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #2563eb;">Opening Meeting</label>
                                <input type="datetime-local" id="opening-date" class="form-control" style="margin-bottom: 0.5rem;" value="${report.openingMeeting?.dateTime || ''}">
                                <textarea id="opening-attendees" rows="2" class="form-control" style="font-size: 0.85rem;" placeholder="Attendees (comma separated)...">${h((report.openingMeeting?.attendees || []).join(', '))}</textarea>
                            </div>
                            <!-- Closing Meeting -->
                            <div>
                                <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #dc2626;">Closing Meeting</label>
                                <input type="datetime-local" id="closing-date" class="form-control" style="margin-bottom: 0.5rem;" value="${report.closingMeeting?.dateTime || ''}">
                                <textarea id="closing-attendees" rows="2" class="form-control" style="font-size: 0.85rem;" placeholder="Attendees (comma separated)...">${h((report.closingMeeting?.attendees || []).join(', '))}</textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Additional Audit Evidence -->
                    <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Audit Evidence</h4>
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Audit Agenda / Schedule</label>
                        <textarea id="audit-agenda" rows="3" class="form-control" placeholder="Summary of audit activities and timeline...">${h(report.auditAgenda || '')}</textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                        <div>
                            <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Interviewees</label>
                            <textarea id="interviewees" rows="3" class="form-control" placeholder="List of personnel interviewed...">${h(report.interviewees || '')}</textarea>
                        </div>
                        <div>
                            <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Documents Reviewed</label>
                            <textarea id="documents-reviewed" rows="3" class="form-control" placeholder="List of key documents reviewed...">${h(report.documentsReviewed || '')}</textarea>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Final Conclusion</label>
                        <textarea id="conclusion" rows="4" class="form-control" placeholder="Final verdict and compliance statement...">${h(report.conclusion)}</textarea>
                    </div>

                    <div style="margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 6px;">
                        <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Certification Recommendation</label>
                        <select id="recommendation" class="form-control" style="background: white;">
                            <option ${report.recommendation === 'Recommend Certification' ? 'selected' : ''}>Recommend Certification</option>
                            <option ${report.recommendation === 'Conditional Certification' ? 'selected' : ''}>Conditional Certification (pending closure of NCs)</option>
                            <option ${report.recommendation === 'Do Not Recommend' ? 'selected' : ''}>Do Not Recommend</option>
                        </select>
                    </div>

                    <div style="display: flex; gap: 1rem;">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        </div >
        `);
}

// Helper for Persistent Update
async function updateReportInDB(report, message) {
    try {
        await window.SupabaseClient.db.update('audit_reports', String(report.id), {
            plan_id: String(report.planId),
            client_name: report.client,
            date: report.date,
            status: report.status,
            findings: report.findings || 0,
            checklist_progress: report.checklistProgress || [],
            data: report // Store full JSON blob
        });
        if (message) window.showNotification(message, 'success');
    } catch (dbError) {
        console.error('Database Update Failed:', dbError);
        window.showNotification('Saved locally, but DB failed: ' + dbError.message, 'warning');
    }
}

// Submit report for QA Review
window.submitForReview = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    report.conclusion = Sanitizer.sanitizeText(document.getElementById('conclusion')?.value || '');
    report.recommendation = document.getElementById('recommendation')?.value || ''; // Select box, safe
    if (document.getElementById('exec-summary')) report.execSummary = Sanitizer.sanitizeText(document.getElementById('exec-summary').value);
    if (document.getElementById('strengths')) report.strengths = Sanitizer.sanitizeText(document.getElementById('strengths').value);
    if (document.getElementById('improvements')) report.improvements = Sanitizer.sanitizeText(document.getElementById('improvements').value);

    // Save Meeting Records
    report.openingMeeting = {
        dateTime: document.getElementById('opening-date')?.value || '',
        attendees: (document.getElementById('opening-attendees')?.value || '').split(',').map(s => s.trim()).filter(s => s)
    };
    report.closingMeeting = {
        dateTime: document.getElementById('closing-date')?.value || '',
        attendees: (document.getElementById('closing-attendees')?.value || '').split(',').map(s => s.trim()).filter(s => s)
    };

    report.auditAgenda = Sanitizer.sanitizeText(document.getElementById('audit-agenda')?.value || '');
    report.interviewees = Sanitizer.sanitizeText(document.getElementById('interviewees')?.value || '');
    report.documentsReviewed = Sanitizer.sanitizeText(document.getElementById('documents-reviewed')?.value || '');

    report.status = window.CONSTANTS.STATUS.IN_REVIEW;

    // Save to DB and Local
    window.saveData();
    updateReportInDB(report, 'Report submitted for QA review (Saved to DB)');

    window.renderExecutionDetail(reportId);
}

// Approve Report (Certification Manager Step)
window.approveReport = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    // VALIDATION: Classification Check
    const hasPending = (report.ncrs || []).some(n => n.type === window.CONSTANTS.NCR_TYPES.PENDING) ||
        (report.checklistProgress || []).some(n => n.status === 'nc' && n.ncrType === window.CONSTANTS.NCR_TYPES.PENDING);

    if (hasPending) {
        window.showNotification('Cannot Approve: Findings are Flagged/Pending. Please classify all findings first.', 'error');
        return;
    }

    report.status = window.CONSTANTS.STATUS.APPROVED;

    // Save to DB and Local
    window.saveData();
    updateReportInDB(report, 'Report Approved by Certification Manager (Saved to DB)');

    window.renderExecutionDetail(reportId);
};

window.revertToDraft = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (report) {
        report.status = window.CONSTANTS.STATUS.DRAFT;

        // Save to DB and Local
        window.saveData();
        updateReportInDB(report, 'Report reverted to Draft for editing');

        window.renderExecutionDetail(reportId);
    }
}

window.revertToReview = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (report) {
        report.status = window.CONSTANTS.STATUS.IN_REVIEW;

        // Save to DB and Local
        window.saveData();
        updateReportInDB(report, 'Report re-opened for Review');

        window.renderExecutionDetail(reportId);
    }
}

// Publish the final report
function publishReport(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    // VALIDATION: Check for Pending Findings
    const hasPending = (report.ncrs || []).some(n => n.type === window.CONSTANTS.NCR_TYPES.PENDING) ||
        (report.checklistProgress || []).some(n => n.status === 'nc' && n.ncrType === window.CONSTANTS.NCR_TYPES.PENDING);

    if (hasPending) {
        window.showNotification('Cannot Publish: You have Flagged items pending classification. Please classify them as Major or Minor first.', 'error');
        return;
    }

    report.status = window.CONSTANTS.STATUS.FINALIZED;
    report.finalizedAt = new Date().toISOString();

    // Save to DB and Local
    window.saveData();
    updateReportInDB(report, 'Report Finalized & Ready for Certification!');

    window.renderExecutionDetail(reportId);
    setTimeout(() => window.generateAuditReport(reportId), 500);
}

// Note: revertToDraft is already defined above as window.revertToDraft

// Save report draft
window.saveReportDraft = function (reportId, silent = false) {
    const report = state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) return;

    report.execSummary = Sanitizer.sanitizeText(document.getElementById('exec-summary')?.value || '');
    report.conclusion = Sanitizer.sanitizeText(document.getElementById('conclusion')?.value || '');
    report.strengths = Sanitizer.sanitizeText(document.getElementById('strengths')?.value || '');
    report.improvements = Sanitizer.sanitizeText(document.getElementById('improvements')?.value || '');

    // Save Meeting Records
    report.openingMeeting = {
        dateTime: document.getElementById('opening-date')?.value || '',
        attendees: (document.getElementById('opening-attendees')?.value || '').split(',').map(s => s.trim()).filter(s => s)
    };
    report.closingMeeting = {
        dateTime: document.getElementById('closing-date')?.value || '',
        attendees: (document.getElementById('closing-attendees')?.value || '').split(',').map(s => s.trim()).filter(s => s)
    };

    report.auditAgenda = Sanitizer.sanitizeText(document.getElementById('audit-agenda')?.value || '');
    report.interviewees = Sanitizer.sanitizeText(document.getElementById('interviewees')?.value || '');
    report.documentsReviewed = Sanitizer.sanitizeText(document.getElementById('documents-reviewed')?.value || '');

    report.recommendation = document.getElementById('recommendation')?.value || '';

    // Save to DB and Local
    window.saveData();
    updateReportInDB(report, silent ? null : 'Report draft saved to database');
};

// NOTE: AI-powered draft generation is defined at the end of this file (line ~1897)
// to avoid duplicate function definitions. See window.generateAIConclusion below.

/**
 * Generate and Download Audit Report as PDF
 * Uses html2pdf.js for direct PDF download (no popup required)
 * @param {number} reportId - The report ID to generate
 */
window.downloadAuditReportPDF = async function (reportId) {
    // Save current state first
    window.saveData();

    if (!report) {
        window.showNotification('Report not found', 'error');
        return;
    }

    // CRITICAL FIX: Sync data from DOM before generating
    // This ensures that latest edits are captured even if "Save" wasn't clicked
    if (document.getElementById('exec-summary')) report.execSummary = document.getElementById('exec-summary').value;
    if (document.getElementById('conclusion')) report.conclusion = document.getElementById('conclusion').value;
    if (document.getElementById('strengths')) report.strengths = document.getElementById('strengths').value;
    if (document.getElementById('improvements')) report.improvements = document.getElementById('improvements').value;
    if (document.getElementById('recommendation')) report.recommendation = document.getElementById('recommendation').value;

    // Sync Evidence & Agenda
    if (document.getElementById('audit-agenda')) report.auditAgenda = document.getElementById('audit-agenda').value;
    if (document.getElementById('interviewees')) report.interviewees = document.getElementById('interviewees').value;
    if (document.getElementById('documents-reviewed')) report.documentsReviewed = document.getElementById('documents-reviewed').value;

    // Sync Meetings matches existing logic
    const od = document.getElementById('opening-date');
    const oa = document.getElementById('opening-attendees');
    if (od || oa) {
        report.openingMeeting = {
            dateTime: od?.value || report.openingMeeting?.dateTime || '',
            attendees: oa?.value ? oa.value.split(',').map(s => s.trim()).filter(s => s) : (report.openingMeeting?.attendees || [])
        };
    }
    const cd = document.getElementById('closing-date');
    const ca = document.getElementById('closing-attendees');
    if (cd || ca) {
        report.closingMeeting = {
            dateTime: cd?.value || report.closingMeeting?.dateTime || '',
            attendees: ca?.value ? ca.value.split(',').map(s => s.trim()).filter(s => s) : (report.closingMeeting?.attendees || [])
        };
    }

    // Persist these changes
    window.saveData();

    // Check if html2pdf is available
    if (typeof html2pdf === 'undefined') {
        window.showNotification('PDF library not loaded. Using print window instead...', 'warning');
        window.generateAuditReport(reportId);
        return;
    }

    try {
        const plan = state.auditPlans.find(p => p.client === report.client) || {};
        const client = state.clients.find(c => c.name === report.client) || {};

        // Validate report data
        const validation = validateReportData(report, plan, client);

        // Check for critical errors
        if (validation.errors.length > 0) {
            const errorMsg = 'Cannot generate report. Please fix the following issues:\n\n' +
                validation.errors.join('\n');
            alert(errorMsg);
            window.showNotification('Report generation failed - missing required data', 'error');
            return;
        }

        // Show warnings if any
        if (validation.warnings.length > 0) {
            const warningMsg = 'The following issues were found:\n\n' +
                validation.warnings.join('\n') +
                '\n\nDo you want to continue anyway?';
            if (!confirm(warningMsg)) {
                return;
            }
        }

        window.showNotification('Generating PDF report... This may take a moment.', 'info');

        // Create a hidden container for the report HTML
        const container = document.createElement('div');
        container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px;';
        document.body.appendChild(container);

        // Generate the report HTML (reuse the same HTML generation logic)
        window.SafeDOM.setHTML(container, generateReportHTML(report, plan, client));

        // Configure PDF options
        const opt = {
            margin: [15, 10, 15, 10],
            filename: `Audit_Report_${report.client.replace(/[^a-z0-9]/gi, '_')}_${report.id}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            enableLinks: true, // Enable clickable links for TOC
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                letterRendering: true
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                compress: true
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Generate and download PDF
        await html2pdf().set(opt).from(container).save();

        // Cleanup
        document.body.removeChild(container);

        window.showNotification('PDF report downloaded successfully!', 'success');

        // Log the action
        if (window.AuditLogger) {
            window.AuditLogger.logAction('REPORT_DOWNLOAD', 'Report', report.id, {
                client: report.client,
                format: 'PDF'
            });
        }
    } catch (error) {
        console.error('PDF generation error:', error);
        window.showNotification('Failed to generate PDF: ' + error.message + '. Try using the print option instead.', 'error');
    }
};

/**
 * Generate Report HTML Content
 * Extracted as a separate function for reuse in both print and PDF download
 * @param {Object} report - The audit report
 * @param {Object} plan - The audit plan
 * @param {Object} client - The client data
 * @returns {string} HTML content for the report
 */
function generateReportHTML(report, plan, client) {
    const h = window.UTILS.escapeHtml;

    // Combine Manual NCRs and Checklist Progress NCs
    const manualNCRs = report.ncrs || [];
    const checklistNCRs = (report.checklistProgress || [])
        .filter(item => item.status === 'nc')
        .map(item => {
            let clause = 'Checklist Item';
            let requirement = 'Non-conformity identified in checklist.';

            if (item.checklistId) {
                const cl = state.checklists.find(c => c.id == item.checklistId);
                if (cl) {
                    // Extract requirement text with overrides
                    const plan = state.auditPlans.find(p => String(p.id) === String(report.planId));
                    const overrides = plan?.selectedChecklistOverrides?.[item.checklistId] || {};

                    if (cl.clauses && (String(item.itemIdx).includes('-'))) {
                        const [mainClauseVal, subIdxVal] = String(item.itemIdx).split('-');
                        const mainObj = cl.clauses.find(m => m.mainClause == mainClauseVal);
                        if (mainObj && mainObj.subClauses && mainObj.subClauses[subIdxVal]) {
                            clause = mainObj.subClauses[subIdxVal].clause;
                            requirement = overrides[item.itemIdx] || mainObj.subClauses[subIdxVal].requirement;
                        }
                    } else {
                        const clItem = cl.items?.[item.itemIdx];
                        if (clItem) {
                            clause = clItem.clause;
                            requirement = overrides[item.itemIdx] || clItem.requirement;
                        }
                    }
                }
            } else if (item.isCustom) {
                const customItem = (report.customItems || [])[item.itemIdx];
                if (customItem) {
                    clause = customItem.clause;
                    requirement = customItem.requirement;
                }
            }

            return {
                type: item.ncrType || 'minor',
                clause: clause,
                description: item.ncrDescription || item.comment || requirement,
                requirement: requirement,
                evidence: 'Checklist Finding',
                transcript: item.transcript,
                evidenceImage: item.evidenceImage,
                status: 'Open'
            };
        });

    const combinedNCRs = [...manualNCRs, ...checklistNCRs];
    const ncrCount = combinedNCRs.length;
    const majorCount = combinedNCRs.filter(n => n.type === 'major').length;
    const minorCount = combinedNCRs.filter(n => n.type === 'minor').length;
    const capaCount = (report.capas || []).length;

    // Calculate checklist progress
    const assignedChecklists = (state.checklists || []).filter(c => plan.checklistIds?.includes(c.id));
    const totalProgress = report.checklistProgress || [];
    const conformCount = totalProgress.filter(p => p.status === 'conform').length;
    const ncCount = totalProgress.filter(p => p.status === 'nc').length;
    const naCount = totalProgress.filter(p => p.status === 'na').length;

    const answeredCount = totalProgress.length;

    // CALCULATE CORRECT TOTAL ITEMS (RESPECTING SELECTIONS)
    const selectionMap = plan.selectedChecklistItems || {};
    let totalItems = 0;

    assignedChecklists.forEach(c => {
        const allowedIds = selectionMap[c.id];
        if (Array.isArray(allowedIds)) {
            totalItems += allowedIds.length;
        } else {
            // Fallback for legacy audits
            if (c.clauses) {
                totalItems += c.clauses.reduce((s, clause) => s + (clause.subClauses?.length || 0), 0);
            } else {
                totalItems += (c.items?.length || 0);
            }
        }
    });
    totalItems += (report.customItems?.length || 0);

    const progressPercent = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0;

    // QR Code URL
    const qrData = `REP-${report.id} | ${report.client} | ${report.date} | Score: ${Math.max(0, 100 - (majorCount * 15) - (minorCount * 5))}%`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;

    // Compliance Score Logic
    const complianceScore = Math.max(0, 100 - (majorCount * 15) - (minorCount * 5));
    const conformHeight = complianceScore;
    const majorHeight = Math.min(100, majorCount * 15 + 10);
    const minorHeight = Math.min(100, minorCount * 10 + 10);

    // Get audit team
    const leadAuditor = state.auditors.find(a => plan.auditors?.includes(a.id));
    const auditTeam = (plan.auditors || []).map(id => state.auditors.find(a => a.id === id)).filter(a => a);

    // Get logos for PDF header
    const cbSettings = state.cbSettings || {};
    const cbLogo = cbSettings.logoUrl || '';
    const cbName = cbSettings.cbName || 'AuditCB360';
    const clientLogo = client.logoUrl || '';

    // Return the complete HTML (same as in the print window version)
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Audit Report - ${h(report.client)}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; color: #333; max-width: 900px; margin: 0 auto; background: #fff; }
                .report-container { padding: 40px; position: relative; }
                .cover-page { text-align: center; page-break-after: always; display: flex; flex-direction: column; justify-content: center; height: 90vh; }
                .logo { font-size: 3rem; font-weight: bold; color: #2c3e50; margin-bottom: 2rem; }
                .report-title { font-size: 2.5rem; margin-bottom: 1rem; color: #2c3e50; }
                
                h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-top: 40px; page-break-after: avoid; }
                h2 { color: #34495e; margin-top: 30px; font-size: 1.3rem; }
                p { line-height: 1.6; text-align: justify; margin-bottom: 1rem; }
                
                .chart-section { margin: 40px 0; page-break-inside: avoid; }
                .chart-container { display: flex; justify-content: space-around; align-items: flex-end; height: 220px; margin: 20px auto; width: 75%; background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%); padding: 25px 20px 0 20px; border-bottom: 3px solid #cbd5e1; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                .bar-group { display: flex; flex-direction: column; align-items: center; width: 70px; }
                .bar { width: 100%; position: relative; border-top-left-radius: 6px; border-top-right-radius: 6px; box-shadow: 0 -2px 4px rgba(0,0,0,0.1); }
                .bar-val { font-weight: bold; margin-bottom: 8px; color: #1e293b; font-size: 1.1rem; }
                .bar-label { margin-top: 12px; font-size: 0.9rem; font-weight: 600; color: #475569; }

                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .meta-table td { padding: 14px; border: 1px solid #e2e8f0; }
                .meta-table td:first-child { background: #f1f5f9; font-weight: 600; width: 220px; color: #334155; }
                
                .finding-box { border: 1px solid #ddd; padding: 20px; margin-bottom: 15px; border-radius: 8px; page-break-inside: avoid; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .finding-major { border-left: 5px solid #ef4444; background-color: #fef2f2; }
                .finding-minor { border-left: 5px solid #f59e0b; background-color: #fffbeb; }
                
                .capa-box { border: 1px solid #cbd5e1; padding: 18px; margin-bottom: 12px; border-radius: 8px; page-break-inside: avoid; background: #f8fafc; border-left: 4px solid #3b82f6; }
                
                .badge { padding: 5px 12px; border-radius: 12px; color: white; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
                .bg-red { background: #ef4444; }
                .bg-yellow { background: #f59e0b; color: #fff; }
                .bg-blue { background: #3b82f6; }
                .bg-green { background: #10b981; }
                
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
                .progress-bar { width: 100%; height: 24px; background: #e2e8f0; border-radius: 12px; overflow: hidden; margin: 10px 0; }
                .progress-fill { height: 100%; background: linear-gradient(90deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.85rem; }

                .qr-header { position: absolute; top: 40px; right: 40px; text-align: center; }
                .qr-header img { width: 100px; height: 100px; border: 2px solid #e2e8f0; border-radius: 8px; }
                .qr-label { font-size: 10px; color: #666; margin-top: 5px; }
                
                .signature-section { margin-top: 60px; page-break-inside: avoid; }
                .signature-box { border: 2px solid #cbd5e1; padding: 20px; border-radius: 8px; background: #f8fafc; }
                .signature-line { border-top: 2px solid #334155; margin-top: 50px; padding-top: 8px; }

                @media print {
                    @page { margin: 2cm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                
                .watermark {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 8rem;
                    color: #ef4444;
                    opacity: 0.15;
                    font-weight: bold;
                    pointer-events: none;
                    z-index: 9999;
                    border: 10px solid #ef4444;
                    padding: 20px 60px;
                    border-radius: 20px;
                }

                /* Running Page Header */
                .page-header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 35px;
                    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0 30px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    z-index: 1000;
                }
                .page-header-left { display: flex; align-items: center; gap: 8px; }
                .page-header-right { color: rgba(255,255,255,0.9); }

                /* Running Page Footer */
                .page-footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 30px;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0 30px;
                    font-size: 0.7rem;
                    color: #64748b;
                    z-index: 1000;
                }
                .page-footer-center { 
                    position: absolute; 
                    left: 50%; 
                    transform: translateX(-50%);
                    font-weight: 500;
                }

                @media print {
                    .page-header, .page-footer { display: flex; }
                    body { padding-top: 45px; padding-bottom: 40px; }
                }
                @media screen {
                    .page-header, .page-footer { display: none; }
                }
            </style>
        </head>
        <body>
            ${!report.finalizedAt ? '<div class="watermark">DRAFT</div>' : ''}
            
            <!-- Running Page Header (visible in print) -->
            <div class="page-header">
                <div class="page-header-left">
                    <i class="fa-solid fa-shield-halved"></i>
                    <span>${h(cbName)} | Audit Report</span>
                </div>
                <div class="page-header-right">REP-${report.id}</div>
            </div>

            <!-- Running Page Footer (visible in print) -->
            <div class="page-footer">
                <div>${h(report.client)}</div>
                <div class="page-footer-center">CONFIDENTIAL</div>
                <div>${h(report.date)}</div>
            </div>

            <div class="report-container">
                <div class="qr-header">
                    <img src="${qrCodeUrl}" alt="Report QR">
                    <div class="qr-label">Scan to Verify</div>
                </div>

                <div class="cover-page">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 2rem;">
                        <div style="text-align: left;">
                            ${cbLogo ? `<img src="${cbLogo}" style="max-height: 60px; max-width: 200px; object-fit: contain;" alt="${h(cbName)}">` : `<div style="font-size: 1.5rem; font-weight: bold; color: #2c3e50;"><i class="fa-solid fa-shield-halved" style="color: #2563eb;"></i> ${h(cbName)}</div>`}
                        </div>
                        <div style="text-align: right;">
                            ${clientLogo ? `<img src="${clientLogo}" style="max-height: 60px; max-width: 200px; object-fit: contain;" alt="${h(report.client)}">` : ''}
                        </div>
                    </div>
                    <div class="report-title">Audit Certification Report</div>
                    <div class="report-meta">
                        <p style="text-align: center; font-weight: 500; font-size: 1.3rem;">${h(report.client)}</p>
                        <p style="text-align: center; font-size: 1.1rem;">${h(plan.standard || 'ISO Standard Audit')}</p>
                        <p style="text-align: center;">Audit Date: ${h(report.date)}</p>
                        <p style="text-align: center; color: #64748b;">Report Generated: ${window.UTILS.formatDate(new Date())}</p>
                    </div>
                    
                    <div style="margin-top: 2rem;">
                        <div style="font-size: 4.5rem; font-weight: 800; color: ${complianceScore > 80 ? '#10b981' : complianceScore > 60 ? '#f59e0b' : '#ef4444'}; line-height: 1;">
                            ${complianceScore}%
                        </div>
                        <div style="font-size: 1.2rem; color: #64748b; margin-top: 0.5rem;">Audit Compliance Score</div>
                    </div>
                </div>

                <!-- Table of Contents -->
                <div class="toc-page" style="page-break-after: always; padding-top: 60px;">
                    <h1 style="border: none; text-align: center; margin-bottom: 40px;">Table of Contents</h1>
                    <ul style="list-style: none; padding: 0; font-size: 1.2rem;">
                        <li style="margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <a href="#audit-details" style="text-decoration: none; color: #333; font-weight: 500;">1. Audit Details</a>
                        </li>
                        <li style="margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <a href="#exec-summary" style="text-decoration: none; color: #333; font-weight: 500;">2. Executive Summary</a>
                        </li>
                         <li style="margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <a href="#strengths" style="text-decoration: none; color: #333; font-weight: 500;">3. Strengths and Opportunities</a>
                        </li>
                        <li style="margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <a href="#findings" style="text-decoration: none; color: #333; font-weight: 500;">4. Detailed Findings and Evidence</a>
                        </li>
                        ${capaCount > 0 ? `
                        <li style="margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <a href="#capa" style="text-decoration: none; color: #333; font-weight: 500;">5. Corrective & Preventive Actions</a>
                        </li>` : ''}
                        <li style="margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <a href="#meeting-records" style="text-decoration: none; color: #333; font-weight: 500;">${capaCount > 0 ? '6' : '5'}. Meeting Records</a>
                        </li>
                         <li style="margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <a href="#evidence" style="text-decoration: none; color: #333; font-weight: 500;">${capaCount > 0 ? '7' : '6'}. Audit Evidence</a>
                        </li>
                         <li style="margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <a href="#observations" style="text-decoration: none; color: #333; font-weight: 500;">${capaCount > 0 ? '8' : '7'}. Observations</a>
                        </li>
                        <li style="margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <a href="#conclusion" style="text-decoration: none; color: #333; font-weight: 500;">${capaCount > 0 ? '9' : '8'}. Conclusion and Recommendation</a>
                        </li>
                    </ul>
                </div>

                <h1 id="audit-details">1. Audit Details</h1>
                <table class="meta-table">
                    <tr><td>Client Name</td><td>${h(report.client)}</td></tr>
                    <tr><td>Audit Standard</td><td>${h(plan.standard || 'N/A')}</td></tr>
                    <tr><td>Audit Type</td><td>${h(plan.objectives || 'Certification Audit')}</td></tr>
                    <tr><td>Audit Scope</td><td>${h(plan.scope || 'Full organization')}</td></tr>
                    <tr><td>Audit Date</td><td>${h(report.date)}</td></tr>
                    <tr><td>Report ID</td><td>REP-${h(report.id)}</td></tr>
                    <tr><td>Lead Auditor</td><td>${h(leadAuditor?.name || 'Unknown')}</td></tr>
                    <tr><td>Audit Team</td><td>${h(auditTeam.map(a => a.name).join(', ') || 'N/A')}</td></tr>
                    <tr><td>Man-Days</td><td>${h(plan.manDays || 'N/A')}</td></tr>
                    <tr><td>Total Findings</td><td>${ncrCount} (Major: ${majorCount}, Minor: ${minorCount})</td></tr>
                    <tr><td>Report Status</td><td><strong>${h(report.status)}</strong></td></tr>
                </table>

                <h2>Organization Context</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                    <div style="background: #fffbeb; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <h3 style="margin: 0 0 10px 0; font-size: 1rem; color: #92400e;">Goods & Services</h3>
                        ${(client.goodsServices && client.goodsServices.length > 0) ?
            `<ul style="margin: 0; padding-left: 20px;">${client.goodsServices.map(g => `<li>${h(g.name)}${g.category ? ` (${g.category})` : ''}</li>`).join('')}</ul>` :
            '<p style="color: #92400e; margin: 0; font-style: italic;">Not defined in Account Setup</p>'}
                    </div>
                    <div style="background: #ecfeff; padding: 15px; border-radius: 8px; border-left: 4px solid #06b6d4;">
                        <h3 style="margin: 0 0 10px 0; font-size: 1rem; color: #0891b2;">Key Processes</h3>
                        ${(client.keyProcesses && client.keyProcesses.length > 0) ?
            `<ul style="margin: 0; padding-left: 20px;">${client.keyProcesses.map(p => `<li>${h(p.name)}${p.category === 'Core' ? ' <strong>(Core)</strong>' : ''}</li>`).join('')}</ul>` :
            '<p style="color: #0891b2; margin: 0; font-style: italic;">Not defined in Account Setup</p>'}
                    </div>
                </div>

                <h1 id="exec-summary">2. Executive Summary</h1>
                <p><strong>Overview:</strong></p>
                <div style="margin-bottom: 2rem; background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    ${h(report.execSummary || 'Executive summary pending...').replace(/\n/g, '<br>')}
                </div>
                
                <h2>Checklist Completion Progress</h2>
                <div style="background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-weight: 600;">Overall Progress</span>
                        <span style="font-weight: 700; color: #3b82f6;">${progressPercent}% Complete</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%;">${totalItems > 0 ? `${answeredCount}/${totalItems}` : '0/0'}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 20px;">
                        <div style="text-align: center; padding: 12px; background: #f0f9ff; border-radius: 6px;">
                            <div style="font-size: 1.8rem; font-weight: 700; color: #0284c7;">${totalItems}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Total Items</div>
                        </div>
                        <div style="text-align: center; padding: 12px; background: #ecfdf5; border-radius: 6px;">
                            <div style="font-size: 1.8rem; font-weight: 700; color: #10b981;">${conformCount}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Conformities</div>
                        </div>
                        <div style="text-align: center; padding: 12px; background: #fef2f2; border-radius: 6px;">
                            <div style="font-size: 1.8rem; font-weight: 700; color: #ef4444;">${ncCount}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Non-Conformities</div>
                        </div>
                        <div style="text-align: center; padding: 12px; background: #f1f5f9; border-radius: 6px;">
                            <div style="font-size: 1.8rem; font-weight: 700; color: #64748b;">${naCount}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Not Applicable</div>
                        </div>
                    </div>
                </div>
                
                <h2>Audit Performance Analysis</h2>
                <div class="chart-section">
                    <p>The following chart illustrates the distribution of findings and the overall compliance level observed during the audit.</p>
                    <div class="chart-container">
                        <div class="bar-group">
                            <span class="bar-val">${complianceScore}%</span>
                            <div class="bar" style="height: ${conformHeight}%; background: linear-gradient(to top, #059669, #10b981);"></div>
                            <span class="bar-label">Compliance</span>
                        </div>
                        <div class="bar-group">
                            <span class="bar-val">${majorCount}</span>
                            <div class="bar" style="height: ${majorHeight}px; background: linear-gradient(to top, #dc2626, #ef4444);"></div>
                            <span class="bar-label">Major NCs</span>
                        </div>
                        <div class="bar-group">
                            <span class="bar-val">${minorCount}</span>
                            <div class="bar" style="height: ${minorHeight}px; background: linear-gradient(to top, #d97706, #f59e0b);"></div>
                            <span class="bar-label">Minor NCs</span>
                        </div>
                        <div class="bar-group">
                            <span class="bar-val">${capaCount}</span>
                            <div class="bar" style="height: ${Math.min(100, capaCount * 20 + 10)}px; background: linear-gradient(to top, #2563eb, #3b82f6);"></div>
                            <span class="bar-label">CAPAs</span>
                        </div>
                    </div>
                </div>

                <h1 id="strengths">3. Strengths and Opportunities</h1>
                <div class="grid-2">
                    <div>
                        <h3><i class="fa-solid fa-thumbs-up" style="color: #10b981; margin-right: 8px;"></i> Key Strengths</h3>
                        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border: 1px solid #a7f3d0;">
                            ${h(report.strengths || report.positiveObservations || 'None recorded').replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    <div>
                        <h3><i class="fa-solid fa-lightbulb" style="color: #f59e0b; margin-right: 8px;"></i> Areas for Improvement</h3>
                        <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border: 1px solid #fde68a;">
                            ${h(report.improvements || report.ofi || 'None recorded').replace(/\n/g, '<br>')}
                        </div>
                    </div>
                </div>

                <h1 id="findings">4. Detailed Findings and Evidence</h1>
                ${ncrCount === 0 ? '<p style="background: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;"><i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 8px;"></i><strong>No non-conformities were raised during this audit.</strong> The management system was found to be in full compliance with the standard requirements.</p>' : ''}

                ${combinedNCRs.map((ncr, i) => `
                    <div class="finding-box ${ncr.type === 'major' ? 'finding-major' : 'finding-minor'}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,0.05);">
                            <div style="font-weight: 700; font-size: 1.1rem;"><i class="fa-solid fa-exclamation-triangle" style="margin-right: 8px;"></i>Finding #${String(i + 1).padStart(3, '0')}</div>
                            <span class="badge ${ncr.type === 'major' ? 'bg-red' : 'bg-yellow'}">${ncr.type.toUpperCase()}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px; margin-bottom: 8px;">
                            <div style="font-weight: 600; color: #555;">Clause Reference:</div>
                            <div><strong>${h(ncr.clause)}</strong></div>
                            
                            <div style="font-weight: 600; color: #555;">Description:</div>
                            <div>${h(ncr.description)}</div>
                            
                            <div style="font-weight: 600; color: #555;">Objective Evidence:</div>
                            <div style="font-style: italic; color: #4b5563;">${h(ncr.evidence || 'Evidence reviewed on-site during audit.')}</div>

                            ${ncr.transcript ? `
                                <div style="font-weight: 600; color: #555;">Audio Transcript:</div>
                                <div style="background: #f1f5f9; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 0.9rem; border-left: 3px solid #64748b;">
                                    <i class="fa-solid fa-microphone-lines" style="color: #64748b; margin-right: 5px;"></i> "${h(ncr.transcript)}"
                                </div>
                            ` : ''}

                            ${ncr.evidenceImage ? `
                                <div style="font-weight: 600; color: #555;">Visual Evidence:</div>
                                <div>
                                    <img src="${h(ncr.evidenceImage)}" alt="Captured Evidence" style="width: 150px; height: 150px; object-fit: cover; border: 2px solid #cbd5e1; border-radius: 6px; padding: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                </div>
                            ` : ''}
                            
                            <div style="font-weight: 600; color: #555;">Current Status:</div>
                            <div><span class="badge ${ncr.status === 'Closed' ? 'bg-green' : 'bg-yellow'}" style="font-size: 0.75rem;">${h(ncr.status)}</span></div>
                        </div>
                    </div>
                `).join('')}

                ${capaCount > 0 ? `
                <h1 id="capa">5. Corrective & Preventive Actions (CAPA)</h1>
                <p>The following corrective and preventive actions have been identified to address the non-conformities raised during the audit:</p>
                ${(report.capas || []).map((capa, i) => `
                    <div class="capa-box">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #cbd5e1;">
                            <div style="font-weight: 700; font-size: 1rem;"><i class="fa-solid fa-clipboard-check" style="color: #3b82f6; margin-right: 8px;"></i>CAPA #${String(i + 1).padStart(3, '0')}</div>
                            <span class="badge ${capa.status === 'Completed' ? 'bg-green' : 'bg-blue'}">${h(capa.status || 'In Progress')}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 10px;">
                            ${capa.linkedNCR ? `
                                <div style="font-weight: 600; color: #555;">Linked to:</div>
                                <div><strong>${h(capa.linkedNCR)}</strong></div>
                            ` : ''}
                            
                            <div style="font-weight: 600; color: #555;">Root Cause:</div>
                            <div>${h(capa.rootCause || 'Not specified')}</div>
                            
                            <div style="font-weight: 600; color: #555;">Action Plan:</div>
                            <div>${h(capa.actionPlan || 'Not specified')}</div>
                            
                            ${capa.dueDate ? `
                                <div style="font-weight: 600; color: #555;">Due Date:</div>
                                <div>${h(capa.dueDate)}</div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
                ` : ''}

                <h1 id="meeting-records">${capaCount > 0 ? '6' : '5'}. Meeting Records</h1>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-top:0;">Opening Meeting</h3>
                    <p><strong>Date/Time:</strong> ${h(report.openingMeeting?.dateTime?.replace('T', ' ') || 'Not recorded')}</p>
                    <p><strong>Attendees:</strong> ${h((report.openingMeeting?.attendees || []).join(', ') || 'Not recorded')}</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-top:0;">Closing Meeting</h3>
                    <p><strong>Date/Time:</strong> ${h(report.closingMeeting?.dateTime?.replace('T', ' ') || 'Not recorded')}</p>
                    <p><strong>Attendees:</strong> ${h((report.closingMeeting?.attendees || []).join(', ') || 'Not recorded')}</p>
                </div>

                <h1 id="evidence">${capaCount > 0 ? '7' : '6'}. Audit Evidence</h1>
                
                <h2>Audit Agenda / Schedule</h2>
                <div style="background: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 2rem;">
                    ${h(report.auditAgenda || 'Agenda details pending...').replace(/\n/g, '<br>')}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 20px;">
                    <div>
                        <h2>Interviewees</h2>
                        <div style="background: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                            ${h(report.interviewees || 'None recorded').replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    <div>
                        <h2>Documents Reviewed</h2>
                         <div style="background: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                            ${h(report.documentsReviewed || 'None recorded').replace(/\n/g, '<br>')}
                         </div>
                    </div>
                </div>

                <h1 id="observations">${capaCount > 0 ? '8' : '7'}. Observations</h1>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                    <h3 style="color: #10b981; margin-top: 0;"><i class="fa-solid fa-star" style="margin-right: 8px;"></i>Positive Observations</h3>
                    <div style="background: white; padding: 15px; border-radius: 6px;">
                        ${h(report.positiveObservations || 'No specific positive observations recorded.').replace(/\n/g, '<br>')}
                    </div>
                </div>
                <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border: 1px solid #fde68a;">
                    <h3 style="color: #f59e0b; margin-top: 0;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i>Opportunities for Improvement (OFI)</h3>
                    <div style="background: white; padding: 15px; border-radius: 6px;">
                        ${h(report.ofi || 'No opportunities for improvement identified.').replace(/\n/g, '<br>')}
                    </div>
                </div>

                <h1 id="conclusion">${capaCount > 0 ? '9' : '8'}. Conclusion and Recommendation</h1>
                <p><strong>Auditor Conclusion:</strong></p>
                <div style="margin-bottom: 30px; background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px;">
                    ${h(report.conclusion || 'Conclusion pending finalization.').replace(/\n/g, '<br>')}
                </div>
                
                <div style="margin-top: 30px; padding: 25px; border: 3px solid ${report.recommendation === 'Recommend Certification' ? '#10b981' : report.recommendation === 'Do Not Recommend' ? '#ef4444' : '#f59e0b'}; background: ${report.recommendation === 'Recommend Certification' ? '#ecfdf5' : report.recommendation === 'Do Not Recommend' ? '#fef2f2' : '#fffbeb'}; text-align: center; border-radius: 8px;">
                    <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">CERTIFICATION RECOMMENDATION</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: ${report.recommendation === 'Recommend Certification' ? '#10b981' : report.recommendation === 'Do Not Recommend' ? '#ef4444' : '#f59e0b'};">
                        ${report.recommendation || 'Recommendation Pending'}
                    </div>
                </div>

                <div class="signature-section">
                    <div class="signature-box">
                        <h2 style="margin-top: 0; color: #334155;"><i class="fa-solid fa-pen-fancy" style="margin-right: 8px;"></i>Audit Team Signatures</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px;">
                            <div>
                                <div style="font-weight: 600; margin-bottom: 5px;">Lead Auditor</div>
                                <div style="font-size: 1.1rem; color: #3b82f6; margin-bottom: 5px;">${h(leadAuditor?.name || 'Unknown')}</div>
                                <div class="signature-line">Signature & Date</div>
                            </div>
                            ${auditTeam.length > 1 ? `
                            <div>
                                <div style="font-weight: 600; margin-bottom: 5px;">Team Member</div>
                                <div style="font-size: 1.1rem; color: #3b82f6; margin-bottom: 5px;">${h(auditTeam[1]?.name || 'N/A')}</div>
                                <div class="signature-line">Signature & Date</div>
                            </div>
                            ` : ''}
                        </div>
                        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1;">
                            <div style="font-weight: 600; margin-bottom: 5px;">Client Representative</div>
                            <div style="font-size: 1.1rem; color: #3b82f6; margin-bottom: 5px;">${h(client.contacts?.[0]?.name || 'To be signed')}</div>
                            <div class="signature-line">Signature & Date</div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 80px; text-align: center; color: #94a3b8; font-size: 0.8rem; border-top: 2px solid #e2e8f0; padding-top: 20px;">
                    <p><strong>AuditCB360 Certification Platform</strong></p>
                    <p>Report ID: REP-${h(report.id)} | Generated: ${new Date().toLocaleString()} | Version: ${report.finalizedAt ? '1.0 (Final)' : '0.1 (Draft)'}</p>
                    <p style="font-style: italic;">This is a computer-generated report. Signatures are required for official certification purposes.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

// Generate Printable PDF Report
/**
 * Validate Report Data Before Generation
 * @param {Object} report - The audit report
 * @param {Object} plan - The audit plan
 * @param {Object} client - The client data
 * @returns {Array} Array of validation error messages
 */
function validateReportData(report, plan, client) {
    const errors = [];
    const warnings = [];

    // Critical validations
    if (!report.execSummary || report.execSummary.trim() === '') {
        errors.push('❌ Executive Summary is missing');
    }

    if (!report.conclusion || report.conclusion.trim() === '') {
        errors.push('❌ Conclusion is missing');
    }

    if (!report.recommendation) {
        errors.push('❌ Certification Recommendation is missing');
    }

    // Warning validations
    if (!plan || Object.keys(plan).length === 0) {
        warnings.push('⚠️ Audit Plan data not found - some details may be incomplete');
    } else {
        if (!plan.auditors || plan.auditors.length === 0) {
            warnings.push('⚠️ No auditors assigned to this audit');
        }
    }

    if (!client || Object.keys(client).length === 0) {
        warnings.push('⚠️ Client data not found - organization context will be incomplete');
    } else {
        if (!client.contacts || client.contacts.length === 0) {
            warnings.push('⚠️ Client contact information is missing');
        }
    }

    if (!report.strengths && !report.positiveObservations) {
        warnings.push('⚠️ No positive observations recorded');
    }

    if (!report.improvements && !report.ofi) {
        warnings.push('⚠️ No opportunities for improvement recorded');
    }

    if (!report.auditAgenda) warnings.push('⚠️ Audit Agenda is missing');
    if (!report.interviewees) warnings.push('⚠️ List of Interviewees is missing');
    if (!report.documentsReviewed) warnings.push('⚠️ Documents Reviewed list is missing');
    if (!report.openingMeeting?.dateTime) warnings.push('⚠️ Opening Meeting details missing');
    if (!report.closingMeeting?.dateTime) warnings.push('⚠️ Closing Meeting details missing');

    return { errors, warnings };
}

// Generate Printable PDF Report
window.generateAuditReport = function (reportId) {
    const h = window.UTILS.escapeHtml; // Alias for sanitization

    // Save current state first to ensure all changes are captured
    window.saveData();

    if (!report) {
        window.showNotification('Report not found', 'error');
        return;
    }

    // CRITICAL FIX: Sync data from DOM before generating
    // This ensures that latest edits are captured even if "Save" wasn't clicked
    if (document.getElementById('exec-summary')) report.execSummary = document.getElementById('exec-summary').value;
    if (document.getElementById('conclusion')) report.conclusion = document.getElementById('conclusion').value;
    if (document.getElementById('strengths')) report.strengths = document.getElementById('strengths').value;
    if (document.getElementById('improvements')) report.improvements = document.getElementById('improvements').value;
    if (document.getElementById('recommendation')) report.recommendation = document.getElementById('recommendation').value;

    // Sync Evidence & Agenda
    if (document.getElementById('audit-agenda')) report.auditAgenda = document.getElementById('audit-agenda').value;
    if (document.getElementById('interviewees')) report.interviewees = document.getElementById('interviewees').value;
    if (document.getElementById('documents-reviewed')) report.documentsReviewed = document.getElementById('documents-reviewed').value;

    // Sync Meetings matches existing logic
    const od = document.getElementById('opening-date');
    const oa = document.getElementById('opening-attendees');
    if (od || oa) {
        report.openingMeeting = {
            dateTime: od?.value || report.openingMeeting?.dateTime || '',
            attendees: oa?.value ? oa.value.split(',').map(s => s.trim()).filter(s => s) : (report.openingMeeting?.attendees || [])
        };
    }
    const cd = document.getElementById('closing-date');
    const ca = document.getElementById('closing-attendees');
    if (cd || ca) {
        report.closingMeeting = {
            dateTime: cd?.value || report.closingMeeting?.dateTime || '',
            attendees: ca?.value ? ca.value.split(',').map(s => s.trim()).filter(s => s) : (report.closingMeeting?.attendees || [])
        };
    }

    // Persist these changes
    window.saveData();

    try {
        const plan = state.auditPlans.find(p => p.client === report.client) || {};
        const client = state.clients.find(c => c.name === report.client) || {};

        // Validate report data
        const validation = validateReportData(report, plan, client);

        // Check for critical errors
        if (validation.errors.length > 0) {
            const errorMsg = 'Cannot generate report. Please fix the following issues:\n\n' +
                validation.errors.join('\n');
            alert(errorMsg);
            window.showNotification('Report generation failed - missing required data', 'error');
            return;
        }

        // Show warnings if any
        if (validation.warnings.length > 0) {
            const warningMsg = 'The following issues were found:\n\n' +
                validation.warnings.join('\n') +
                '\n\nDo you want to continue anyway?';
            if (!confirm(warningMsg)) {
                return;
            }
        }

        const printWindow = window.open('', '_blank');

        if (!printWindow || printWindow.closed || typeof printWindow.closed == 'undefined') {
            window.showNotification('Popup blocked! Please allow popups for this site and try again.', 'error');
            return;
        }

        // Use reusable HTML generator
        // Inject Print Button and Styles for Print Window view
        let htmlContent = generateReportHTML(report, plan, client);

        // 1. Inject Print Button
        const printBtnHTML = `
            <div class="no-print" style="position: fixed; top: 20px; right: 20px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000;">
                <button onclick="window.print()" style="padding: 12px 24px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 1rem;"><i class="fa-solid fa-print"></i> Print PDF</button>
            </div>`;
        htmlContent = htmlContent.replace('<body>', '<body>' + printBtnHTML);

        // 2. Inject .no-print styles
        const noPrintStyles = `
            .no-print { display: none; }
            @media print {
                .no-print { display: none; }
            }
        </style>`;
        htmlContent = htmlContent.replace('</style>', noPrintStyles);

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        window.showNotification('Enhanced audit report generated successfully!', 'success');
    } catch (error) {
        console.error('Error generating audit report:', error);
        window.showNotification('Failed to generate report: ' + error.message, 'error');
    }
};

// Export functions
window.renderReportSummaryTab = renderReportSummaryTab;
window.submitForReview = submitForReview;
window.publishReport = publishReport;
window.revertToDraft = revertToDraft;

// ============================================
// NOTE: The main renderReportingModule function with full Reporting Process Flow
// visualization is defined below (around line 960). The duplicate here was removed.
// ============================================

// Wrapper to open detail view from the list
window.openReportingDetail = function (reportId) {
    const report = window.state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    // Structure for Detail View
    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="window.handleBackToReporting()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Reporting Dashboard
                </button>
            </div>
            <div id="reporting-detail-container"></div>
        </div>
    `;
    window.SafeDOM.setHTML(window.contentArea, html);

    // Render the existing summary tab into the container
    const container = document.getElementById('reporting-detail-container');
    window.renderReportSummaryTab(report, container);
};

// Robust Back Navigation Helper
window.handleBackToReporting = function () {
    console.log('Navigating back to Reporting Dashboard...');
    try {
        if (window.state.activeClientId) {
            window.location.hash = 'client/' + window.state.activeClientId + '/reporting';
        } else {
            window.location.hash = 'audit-reporting';
        }
    } catch (e) {
        console.error('Navigation error:', e);
        window.location.reload();
    }
};

// Export
window.renderReportingModule = renderReportingModule;

/**
 * Upload Report to Cloud Storage
 * Uses html2pdf.js to generate PDF and uploads to Supabase
 */
window.uploadReportToCloud = async function (reportId) {
    if (!report) {
        window.showNotification('Report not found', 'error');
        return;
    }

    // CRITICAL FIX: Sync data from DOM before generating
    // This ensures that latest edits are captured even if "Save" wasn't clicked
    if (document.getElementById('exec-summary')) report.execSummary = document.getElementById('exec-summary').value;
    if (document.getElementById('conclusion')) report.conclusion = document.getElementById('conclusion').value;
    if (document.getElementById('strengths')) report.strengths = document.getElementById('strengths').value;
    if (document.getElementById('improvements')) report.improvements = document.getElementById('improvements').value;
    if (document.getElementById('recommendation')) report.recommendation = document.getElementById('recommendation').value;

    // Sync Evidence & Agenda
    if (document.getElementById('audit-agenda')) report.auditAgenda = document.getElementById('audit-agenda').value;
    if (document.getElementById('interviewees')) report.interviewees = document.getElementById('interviewees').value;
    if (document.getElementById('documents-reviewed')) report.documentsReviewed = document.getElementById('documents-reviewed').value;

    // Sync Meetings matches existing logic
    const od = document.getElementById('opening-date');
    const oa = document.getElementById('opening-attendees');
    if (od || oa) {
        report.openingMeeting = {
            dateTime: od?.value || report.openingMeeting?.dateTime || '',
            attendees: oa?.value ? oa.value.split(',').map(s => s.trim()).filter(s => s) : (report.openingMeeting?.attendees || [])
        };
    }
    const cd = document.getElementById('closing-date');
    const ca = document.getElementById('closing-attendees');
    if (cd || ca) {
        report.closingMeeting = {
            dateTime: cd?.value || report.closingMeeting?.dateTime || '',
            attendees: ca?.value ? ca.value.split(',').map(s => s.trim()).filter(s => s) : (report.closingMeeting?.attendees || [])
        };
    }

    // Persist these changes
    window.saveData();

    // Check if html2pdf is available
    if (typeof html2pdf === 'undefined') {
        window.showNotification('PDF library not loaded. Please refresh the page.', 'error');
        return;
    }

    // Check if Supabase is configured
    if (!window.SupabaseClient?.isInitialized) {
        window.showNotification('Supabase not configured. Configure credentials first.', 'warning');
        return;
    }

    window.showNotification('Generating PDF...', 'info');

    try {
        // Create a hidden container for the report HTML
        const container = document.createElement('div');
        container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px;';
        document.body.appendChild(container);

        // Get report data
        const plan = state.auditPlans.find(p => p.client === report.client) || {};
        const client = state.clients.find(c => c.name === report.client) || {};

        // Use the centralized HTML generator for consistency
        container.innerHTML = generateReportHTML(report, plan, client);

        // Generate PDF blob
        const pdfBlob = await html2pdf()
            .set({
                margin: [15, 10, 15, 10],
                filename: `Report_${report.id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                enableLinks: true,
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            })
            .from(container)
            .outputPdf('blob');

        // Clean up container
        document.body.removeChild(container);

        window.showNotification('Uploading to cloud...', 'info');

        // Upload to Supabase
        const result = await window.SupabaseClient.storage.uploadAuditReport(
            pdfBlob,
            'audit-report',
            report.client,
            report.id.toString()
        );

        if (result && result.url) {
            // Update report with cloud URL
            report.cloudPdfUrl = result.url;
            report.cloudPdfPath = result.path;
            report.cloudUploadedAt = new Date().toISOString();
            window.saveData();

            window.showNotification('Report uploaded to cloud successfully!', 'success');
            Logger.info('Report uploaded:', result.path);
        } else {
            throw new Error('Upload failed - no URL returned');
        }
    } catch (error) {
        Logger.error('Failed to upload report:', error);
        window.showNotification('Failed to upload: ' + error.message, 'error');
    }
};

// ============================================
// AI & Classification Helpers
// ============================================

window.runContextAnalysis = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    const resultDiv = document.getElementById(`ai-context-result-${reportId}`);
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing historical context...';

        // Mock AI Analysis
        setTimeout(() => {
            // Mock fetching previous report
            const prevReport = state.auditReports.find(r => r.client === report.client && r.id !== reportId && r.status === 'Finalized');
            const historyText = prevReport
                ? `Compared to previous report (${prevReport.date}): Improvement shown in Clause 9. Performance evaluation is consistent.`
                : 'No historical data available for direct comparison.';

            const findingCount = (report.ncrs || []).length;
            const contextMsg = findingCount > 5
                ? 'High number of findings detected relative to industry average.'
                : 'Finding count within normal parameters for this standard.';

            resultDiv.innerHTML = `
                <div style="font-weight: 600; color: #4338ca; margin-bottom: 4px;">AI Context Validation:</div>
                <div style="margin-bottom: 4px;">${historyText}</div>
                <div>${contextMsg}</div>
                <div style="margin-top: 5px; font-style: italic; color: #6366f1; font-size: 0.75rem;">Confidence Score: 92%</div>
            `;
        }, 1500);
    }
};

window.classifyFinding = function (reportId, source, index, newType) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    if (source === 'manual') {
        if (report.ncrs && report.ncrs[index]) {
            report.ncrs[index].type = newType;
        }
    } else if (source === 'checklist') {
        if (report.checklistProgress && report.checklistProgress[index]) {
            report.checklistProgress[index].ncrType = newType;
        }
    }

    window.saveData();
    // Re-render the summary tab. Since renderReportSummaryTab is called by execution-module's renderExecutionTab('summary'),
    // we ideally call renderExecutionDetail(reportId) and switch to summary tab, or just re-render content if we can.
    // Easiest is to reload the view.
    window.renderExecutionDetail(reportId);
    // Since renderExecutionDetail defaults to 'checklist', we might need to select 'summary'.
    // A quick hack: Trigger click on summary tab after render.
    setTimeout(() => {
        const btn = document.querySelector('button[data-tab="summary"]');
        if (btn) btn.click();
    }, 100);

    window.showNotification(`Finding classified as ${newType.toUpperCase()}`);
};

window.autoClassifyFinding = function (reportId, source, index, description) {
    const btnId = `ai-btn-${source}-${index}`;
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI Analyzing...';
        btn.disabled = true;
    }

    // Mock AI Analysis based on ISO 17021-1 triggers
    setTimeout(() => {
        const desc = description.toLowerCase();
        let suggestedType = window.CONSTANTS.NCR_TYPES.MINOR;
        let reasoning = "Single occurrence";

        if (desc.includes('critical') || desc.includes('breakdown') || desc.includes('systemic') || desc.includes('regulatory') || desc.includes('absence')) {
            suggestedType = window.CONSTANTS.NCR_TYPES.MAJOR;
            reasoning = "Potential systemic failure or regulatory issue";
        }

        if (confirm(`AI Analysis Result:\nSuggested: ${suggestedType.toUpperCase()}\nReason: ${reasoning}\n\nApply this classification?`)) {
            window.classifyFinding(reportId, source, index, suggestedType);
        } else {
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Classify';
                btn.disabled = false;
            }
        }
    }, 1200);
};

// ============================================
// MAIN REPORTING DASHBOARD
// ============================================

function renderReportingModule() {
    // 1. Calculate Metrics (Filtered by User Role)
    const reports = window.getVisibleReports() || [];
    const totalReports = reports.length;
    const pendingReview = reports.filter(r => r.status === window.CONSTANTS.STATUS.IN_REVIEW).length;
    const approved = reports.filter(r => r.status === window.CONSTANTS.STATUS.APPROVED).length;
    const published = reports.filter(r => r.status === window.CONSTANTS.STATUS.PUBLISHED || r.status === window.CONSTANTS.STATUS.FINALIZED).length;
    const drafting = reports.filter(r => r.status === window.CONSTANTS.STATUS.DRAFT).length;

    // 2. Render Dashboard HTML
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="fade-in">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin: 0;">Audit Reporting Dashboard</h2>
                    <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0;">Manage audit reports, QA reviews, and certification decisions.</p>
                </div>
                <button class="btn btn-primary" onclick="window.renderModule('audit-execution')">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create New Report
                </button>
            </div>

            <!-- Reporting Process Flow Block -->
            <div class="card" style="margin-bottom: 2rem; background: linear-gradient(to right, #f8fafc, #fff);">
                <h3 style="margin: 0 0 1.5rem 0; font-size: 1.1rem; color: var(--primary-color); border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">Reporting Process Flow</h3>
                <div style="display: flex; justify-content: space-between; align-items: center; text-align: center; overflow-x: auto; padding-bottom: 0.5rem;">
                    <div style="flex: 1; min-width: 100px; position: relative;">
                        <div style="width: 48px; height: 48px; background: #e0f2fe; color: #0284c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; font-size: 1.1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">1</div>
                        <div style="font-weight: 600; color: #334155;">Drafting</div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">Auditor compiles findings</div>
                    </div>
                    <div style="flex: 0 0 40px; color: #cbd5e1;"><i class="fa-solid fa-chevron-right"></i></div>
                    
                    <div style="flex: 1; min-width: 100px; position: relative;">
                        <div style="width: 48px; height: 48px; background: #ffedd5; color: #ea580c; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; font-size: 1.1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">2</div>
                        <div style="font-weight: 600; color: #334155;">QA Review</div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">Compliance check</div>
                    </div>
                    <div style="flex: 0 0 40px; color: #cbd5e1;"><i class="fa-solid fa-chevron-right"></i></div>

                    <div style="flex: 1; min-width: 100px; position: relative;">
                        <div style="width: 48px; height: 48px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; font-size: 1.1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">3</div>
                        <div style="font-weight: 600; color: #334155;">Approval</div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">Cert. Manager Decision</div>
                    </div>
                    <div style="flex: 0 0 40px; color: #cbd5e1;"><i class="fa-solid fa-chevron-right"></i></div>

                    <div style="flex: 1; min-width: 100px; position: relative;">
                        <div style="width: 48px; height: 48px; background: #f3e8ff; color: #9333ea; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; font-size: 1.1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">4</div>
                        <div style="font-weight: 600; color: #334155;">Publish</div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">Final report issued</div>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="dashboard-grid" style="margin-bottom: 2rem;">
                <div class="card stat-card" style="border-left: 4px solid var(--primary-color);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div>
                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Total Reports</p>
                            <h3 style="margin: 0.5rem 0 0 0; font-size: 2rem;">${totalReports}</h3>
                        </div>
                        <div style="background: #eff6ff; padding: 0.75rem; border-radius: 8px; color: var(--primary-color);">
                            <i class="fa-solid fa-file-contract" style="font-size: 1.25rem;"></i>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        <span style="color: var(--primary-color); font-weight: 500;">${drafting}</span> currently drafting
                    </div>
                </div>

                <div class="card stat-card" style="border-left: 4px solid var(--warning-color);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div>
                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Pending Review</p>
                            <h3 style="margin: 0.5rem 0 0 0; font-size: 2rem;">${pendingReview}</h3>
                        </div>
                        <div style="background: #fff7ed; padding: 0.75rem; border-radius: 8px; color: var(--warning-color);">
                            <i class="fa-solid fa-hourglass-half" style="font-size: 1.25rem;"></i>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        Requires QA / Cert Manager attention
                    </div>
                </div>

                <div class="card stat-card" style="border-left: 4px solid #16a34a;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div>
                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Approved</p>
                            <h3 style="margin: 0.5rem 0 0 0; font-size: 2rem;">${approved}</h3>
                        </div>
                        <div style="background: #f0fdf4; padding: 0.75rem; border-radius: 8px; color: #16a34a;">
                            <i class="fa-solid fa-check-circle" style="font-size: 1.25rem;"></i>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        Ready for publishing
                    </div>
                </div>

                <div class="card stat-card" style="border-left: 4px solid #d946ef;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div>
                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Published</p>
                            <h3 style="margin: 0.5rem 0 0 0; font-size: 2rem;">${published}</h3>
                        </div>
                        <div style="background: #fdf4ff; padding: 0.75rem; border-radius: 8px; color: #d946ef;">
                            <i class="fa-solid fa-file-signature" style="font-size: 1.25rem;"></i>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        Finalized reports
                    </div>
                </div>
            </div>

            <!-- Reports Table -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>All Reports</h3>
                    <div class="search-box" style="width: 300px;">
                        <i class="fa-solid fa-search"></i>
                        <input type="text" placeholder="Search reports..." onkeyup="window.filterReports(this.value)">
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Report ID</th>
                                <th>Client</th>
                                <th>Standard</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Lead Auditor</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="reports-table-body">
                            ${renderReportsTableRows(reports)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderReportsTableRows(reports) {
    if (reports.length === 0) {
        return `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No reports found.</td></tr>`;
    }

    return reports.map(r => {
        const statusClass = r.status.toLowerCase().replace(' ', '-');

        // Custom status badge style
        let badgeStyle = 'background: #f1f5f9; color: #64748b;';
        if (r.status === window.CONSTANTS.STATUS.IN_REVIEW) badgeStyle = 'background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5;';
        if (r.status === window.CONSTANTS.STATUS.APPROVED) badgeStyle = 'background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;';
        if (r.status === window.CONSTANTS.STATUS.PUBLISHED) badgeStyle = 'background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd;';
        if (r.status === window.CONSTANTS.STATUS.DRAFT) badgeStyle = 'background: #f8fafc; color: #475569; border: 1px solid #e2e8f0;';

        return `
        <tr>
            <td style="font-family: monospace; font-weight: 600;">#${r.id}</td>
            <td style="font-weight: 500;">${r.clientName || 'Unknown Client'}</td>
            <td>${r.standard || '-'}</td>
            <td>${r.type || '-'}</td>
            <td><span class="badge" style="${badgeStyle}">${r.status}</span></td>
            <td><div style="display: flex; align-items: center; gap: 0.5rem;"><div style="width: 24px; height: 24px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: #64748b;"><i class="fa-solid fa-user"></i></div> ${r.leadAuditor || 'System'}</div></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="window.openReportingDetail(${r.id})">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

window.filterReports = function (query) {
    const term = query.toLowerCase();
    const rows = document.querySelectorAll('#reports-table-body tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
};

// Export - Ensure it's available globally
if (typeof window !== 'undefined') {
    window.renderReportingModule = renderReportingModule;
}

// ============================================
// AI REPORT GENERATION
// ============================================
window.generateAIConclusion = async function (reportId) {
    console.log('[AI Draft] Triggered for Report ID:', reportId);

    if (!window.AI_SERVICE) {
        console.error('[AI Draft] AI_SERVICE not found on window');
        window.showNotification('AI Service not initialized.', 'error');
        return;
    }

    // Use loose comparison or string conversion to handle Number vs String ID
    const report = window.state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) {
        console.error('[AI Draft] Report not found for ID:', reportId);
        window.showNotification('Report not found.', 'error');
        return;
    }

    const client = window.state.clients.find(c => c.name === report.client);

    // Gather Findings
    const findings = [];
    // 1. Checklist Findings (status is stored as 'nc' lowercase)
    (report.checklistProgress || []).forEach(item => {
        if (item.status === 'nc') {
            findings.push(`[${item.ncrType || 'Minor'}] ${item.comment || item.ncrDescription || 'Checklist Finding'}`);
        }
    });
    // 2. Manual NCRs
    (report.ncrs || []).forEach(ncr => {
        findings.push(`[${ncr.type || 'Minor'}] ${ncr.description} (Clause: ${ncr.clause})`);
    });

    const findingsText = findings.length > 0 ? findings.join('; ') : 'No Non-Conformities found. The audit was seamless.';

    // Show Loading
    const btn = document.getElementById(`btn-ai-draft-${reportId}`);
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        btn.disabled = true;
    }

    window.showNotification('AI is drafting the report summary... please wait.', 'info');

    const prompt = `
    You are an expert ISO Lead Auditor. Write a professional Audit Report Summary (JSON format) for:
    
    Client: ${report.client}
    Industry: ${client ? client.industry : 'N/A'}
    Standard: ${report.standard || 'ISO 9001:2015'}
    Audit Type: Stage 2 / Surveillance
    
    Findings: ${findingsText}
    
    Please generate:
    1. Executive Summary (Professional overview of the audit outcome).
    2. Key Strengths (Positive observations, at least 2-3).
    3. Areas for Improvement (Constructive feedback or OFIs).
    4. Final Conclusion (Certification recommendation statement).
    
    Format: JSON Object with keys: "executiveSummary", "strengths", "improvements", "conclusion".
    Do NOT use Markdown.
    `;

    try {
        const responseText = await window.AI_SERVICE.callProxyAPI(prompt);

        // Parse JSON
        let data;
        let useTemplate = false;
        try {
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            data = JSON.parse(cleanText);
        } catch (e) {
            console.error('JSON Parse Error', e);
            console.log('[AI Draft] Falling back to template-based generation...');
            useTemplate = true;
        }

        // Populate Fields helper
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                // Update report object for persistence
                report[id === 'exec-summary' ? 'execSummary' : id] = val;
            }
        };

        if (!useTemplate && data) {
            // AI response parsed successfully
            if (data.executiveSummary) setVal('exec-summary', data.executiveSummary);
            if (data.strengths) setVal('strengths', data.strengths);
            if (data.improvements) setVal('improvements', data.improvements);
            if (data.conclusion) setVal('conclusion', data.conclusion);
            window.showNotification('Audit Report drafted successfully!', 'success');
        } else {
            // Fallback: Template-based generation
            const plan = window.state.auditPlans.find(p => p.client === report.client) || {};
            const ncrCount = findings.length;
            const majorCount = findings.filter(f => f.toLowerCase().includes('[major]')).length;
            const minorCount = ncrCount - majorCount;

            const execSummary = `The audit of ${report.client} was conducted on ${report.date} against the requirements of ${report.standard || plan.standard || 'the applicable standard'}. The primary objective was to verify compliance and effectiveness of the management system.

During the audit, a total of ${ncrCount} non-conformities were identified (${majorCount} Major, ${minorCount} Minor). The audit team reviewed objective evidence including documentation, records, and interviewed key personnel.

Overall, the management system demonstrates a ${majorCount > 0 ? 'partial' : 'high level of'} compliance.`;

            const strengths = `• Strong commitment from top management towards quality objectives.
• Documentation structure is comprehensive and easily accessible.
• Employee awareness regarding policy and objectives is commendable.
• Infrastructure and resources are well-maintained.`;

            const improvements = `• Need to strengthen the internal audit mechanism to capture process deviations earlier.
• Document control for external origin documents needs review.
• Training records for temporary staff could be better organized.`;

            const conclusion = ncrCount === 0
                ? `Based on the audit results, the management system is found to be properly maintained and compliant. No non-conformities were raised. It is recommended to continue certification.`
                : `The management system is generally effective, with the exception of the identified non-conformities. The organization is requested to provide a root cause analysis and a corrective action plan for the ${ncrCount} findings within 30 days. Subject to the acceptance of the corrective actions, certification is recommended.`;

            setVal('exec-summary', execSummary);
            setVal('strengths', strengths);
            setVal('improvements', improvements);
            setVal('conclusion', conclusion);

            window.showNotification('Audit Report drafted (using template fallback)!', 'success');
        }

        // Auto-save the draft
        if (window.saveReportDraft) {
            window.saveReportDraft(reportId, true); // true = silent save
        }

    } catch (err) {
        console.error('AI Draft Error:', err);
        window.showNotification('AI service error. Using template...', 'warning');

        // Ultimate fallback - generate basic template even if AI call fails completely
        const plan = window.state.auditPlans.find(p => p.client === report.client) || {};
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('exec-summary', `The audit of ${report.client} was conducted to assess compliance with ${report.standard || 'the applicable management system standard'}.`);
        setVal('strengths', '• Management commitment evident\n• Documented procedures in place');
        setVal('improvements', '• Continuous improvement opportunities identified');
        setVal('conclusion', 'Further review of findings is recommended before certification decision.');

    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};
