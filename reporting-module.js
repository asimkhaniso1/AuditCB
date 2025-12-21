// ============================================
// REPORTING MODULE - Report QA, Review, Publish
// ============================================
// Separated from execution-module.js for better maintainability

// Render the Summary/Report Drafting Tab
function renderReportSummaryTab(report, tabContent) {
    const h = window.UTILS.escapeHtml; // Alias for sanitization

    // Role-based access: Only Lead Auditor and Cert Manager can access drafting
    const userRole = window.state.currentUser?.role;
    const canAccessDrafting = userRole === window.CONSTANTS.ROLES.LEAD_AUDITOR ||
        userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER;

    if (!canAccessDrafting) {
        tabContent.innerHTML = `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-lock" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <h3 style="margin-bottom: 0.5rem; color: var(--text-secondary);">Access Restricted</h3>
                <p style="color: #94a3b8; margin-bottom: 1rem;">Audit Report Drafting is available to Lead Auditors and Certification Managers only.</p>
                <p style="font-size: 0.85rem; color: #64748b;">Current Role: <strong>${userRole || 'Unknown'}</strong></p>
            </div>
        `;
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
            <button class="btn btn-secondary" style="flex: 1;" onclick="window.generateAuditReport(${report.id})">
                <i class="fa-solid fa-download" style="margin-right: 0.5rem;"></i> Download Report
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

    tabContent.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="margin: 0;">Audit Report Drafting</h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">Review findings and finalize report content.</p>
                </div>
                ${window.state.currentUser?.role === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER ? `
                <button class="btn btn-sm btn-info" style="color: white; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);" onclick="window.generateAIConclusion('${report.id}')">
                    <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> Auto-Draft with AI
                </button>
                ` : `
                <span style="font-size: 0.8rem; color: var(--text-secondary); padding: 0.5rem 1rem; background: #f1f5f9; border-radius: 6px;">
                    <i class="fa-solid fa-lock" style="margin-right: 0.5rem;"></i> AI Draft (Cert Manager Only)
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
        `;
}

// Submit report for QA Review
function submitForReview(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    report.conclusion = document.getElementById('conclusion')?.value || '';
    report.recommendation = document.getElementById('recommendation')?.value || '';
    if (document.getElementById('exec-summary')) report.execSummary = document.getElementById('exec-summary').value;
    if (document.getElementById('strengths')) report.strengths = document.getElementById('strengths').value;
    if (document.getElementById('improvements')) report.improvements = document.getElementById('improvements').value;

    report.status = window.CONSTANTS.STATUS.IN_REVIEW;
    window.saveData();
    window.renderExecutionDetail(reportId);
    window.showNotification('Report submitted for QA review');
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
    window.saveData();
    window.renderExecutionDetail(reportId);
    window.showNotification('Report Approved by Certification Manager. Ready to Publish.', 'success');
};

window.revertToDraft = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (report) {
        report.status = window.CONSTANTS.STATUS.DRAFT;
        window.saveData();
        window.renderExecutionDetail(reportId);
        window.showNotification('Report reverted to Draft for editing.');
    }
}

window.revertToReview = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (report) {
        report.status = window.CONSTANTS.STATUS.IN_REVIEW;
        window.saveData();
        window.renderExecutionDetail(reportId);
        window.showNotification('Report re-opened for Review.');
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
    window.saveData();
    window.renderExecutionDetail(reportId);
    window.showNotification('Report Finalized & Ready for Certification!', 'success');
    setTimeout(() => window.generateAuditReport(reportId), 500);
}

// Revert to Draft status
function revertToDraft(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;
    report.status = window.CONSTANTS.STATUS.DRAFT;
    window.saveData();
    window.renderExecutionDetail(reportId);
    window.showNotification('Report reverted to Draft');
}

// Save report draft
window.saveReportDraft = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    report.execSummary = document.getElementById('exec-summary')?.value || '';
    report.conclusion = document.getElementById('conclusion')?.value || '';
    report.strengths = document.getElementById('strengths')?.value || '';
    report.improvements = document.getElementById('improvements')?.value || '';
    report.recommendation = document.getElementById('recommendation')?.value || '';

    window.saveData();
    window.showNotification('Report draft saved to local storage', 'success');
};

// AI-powered draft generation
window.generateAIConclusion = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    window.showNotification('AI Agent analyzing audit findings...', 'info');

    const ncrCount = (report.ncrs || []).length;
    const majorCount = (report.ncrs || []).filter(n => n.type === 'major').length;
    const minorCount = (report.ncrs || []).filter(n => n.type === 'minor').length;
    const plan = state.auditPlans.find(p => p.client === report.client) || {};

    setTimeout(() => {
        const execSummary = `The audit of ${report.client} was conducted on ${report.date} against the requirements of ${plan.standard || 'the standard'}. The primary objective was to verify compliance and effectiveness of the management system.

During the audit, a total of ${ncrCount} non - conformities were identified(${majorCount} Major, ${minorCount} Minor).The audit team reviewed objective evidence including documentation, records, and interviewed key personnel.

        Overall, the management system demonstrates a ${majorCount > 0 ? 'partial' : 'high level of'} compliance.Key processes are generally well - defined, though specific lapses were noted in operational controls as detailed in the findings.`;

        const strengths = `- Strong commitment from top management towards quality objectives.
- Documentation structure is comprehensive and easily accessible.
- Employee awareness regarding policy and objectives is commendable.
- Infrastructure and resources are well - maintained.`;

        const improvements = `- Need to strengthen the internal audit mechanism to capture process deviations earlier.
- Document control for external origin documents needs review.
- Training records for temporary staff could be better organized.`;

        const conclusion = ncrCount === 0
            ? `Based on the audit results, the management system is found to be properly maintained and compliant with ${plan.standard}. No non - conformities were raised.It is recommended to continue certification.`
            : `The management system is generally effective, with the exception of the identified non - conformities.The organization is requested to provide a root cause analysis and a corrective action plan for the ${ncrCount} findings within 30 days.Subject to the acceptance of the corrective actions, certification is recommended.`;

        if (document.getElementById('exec-summary')) document.getElementById('exec-summary').value = execSummary;
        if (document.getElementById('strengths')) document.getElementById('strengths').value = strengths;
        if (document.getElementById('improvements')) document.getElementById('improvements').value = improvements;
        if (document.getElementById('conclusion')) document.getElementById('conclusion').value = conclusion;

        if (document.getElementById('recommendation')) {
            if (majorCount > 0) document.getElementById('recommendation').value = window.CONSTANTS.RECOMMENDATIONS.CONDITIONAL;
            else document.getElementById('recommendation').value = window.CONSTANTS.RECOMMENDATIONS.RECOMMEND;
        }

        window.showNotification('AI Draft generated successfully!', 'success');
    }, 1500);
};

// Generate Printable PDF Report
// Generate Printable PDF Report
window.generateAuditReport = function (reportId) {
    const h = window.UTILS.escapeHtml; // Alias for sanitization
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) {
        window.showNotification('Report not found', 'error');
        return;
    }

    try {
        const plan = state.auditPlans.find(p => p.client === report.client) || {};
        const client = state.clients.find(c => c.name === report.client) || {};

        // Combine Manual NCRs and Checklist Progress NCs
        const manualNCRs = report.ncrs || [];
        const checklistNCRs = (report.checklistProgress || [])
            .filter(item => item.status === 'nc')
            .map(item => {
                let clause = 'Checklist Item';
                if (item.checklistId) {
                    const cl = state.checklists.find(c => c.id == item.checklistId);
                    if (cl) {
                        if (cl.clauses && (String(item.itemIdx).includes('-'))) {
                            // Hierarchical: mainClause-subIdx
                            const [mainClauseVal, subIdxVal] = String(item.itemIdx).split('-');
                            // find clause where mainClause matches
                            const mainObj = cl.clauses.find(m => m.mainClause == mainClauseVal);
                            if (mainObj && mainObj.subClauses && mainObj.subClauses[subIdxVal]) {
                                clause = mainObj.subClauses[subIdxVal].clause;
                            }
                        } else {
                            // Flat: numeric index
                            const clItem = cl.items?.[item.itemIdx];
                            if (clItem) clause = clItem.clause;
                        }
                    }
                } else if (item.isCustom) {
                    const customItem = (report.customItems || [])[item.itemIdx];
                    if (customItem) clause = customItem.clause;
                }

                return {
                    type: item.ncrType || 'minor',
                    clause: clause,
                    description: item.ncrDescription || item.comment || 'Non-conformity identified in checklist.',
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

        // Calculate true total items (supporting hierarchy)
        const totalItems = assignedChecklists.reduce((sum, c) => {
            if (c.clauses) {
                return sum + c.clauses.reduce((s, clause) => s + (clause.subClauses?.length || 0), 0);
            }
            return sum + (c.items?.length || 0);
        }, 0) + (report.customItems?.length || 0);

        const answeredCount = totalProgress.length;
        const progressPercent = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0;

        // QR Code URL
        // Safe to not escape here as we encodeURIComponent the whole data string next
        const qrData = `REP - ${report.id} | ${report.client} | ${report.date} | Score: ${Math.max(0, 100 - (majorCount * 15) - (minorCount * 5))}% `;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;

        // Compliance Score Logic
        const complianceScore = Math.max(0, 100 - (majorCount * 15) - (minorCount * 5));
        const conformHeight = complianceScore;
        const majorHeight = Math.min(100, majorCount * 15 + 10);
        const minorHeight = Math.min(100, minorCount * 10 + 10);

        // Get audit team
        const leadAuditor = state.auditors.find(a => plan.auditors?.includes(a.id));
        const auditTeam = (plan.auditors || []).map(id => state.auditors.find(a => a.id === id)).filter(a => a);

        const printWindow = window.open('', '_blank');

        if (!printWindow || printWindow.closed || typeof printWindow.closed == 'undefined') {
            window.showNotification('Popup blocked! Please allow popups for this site and try again.', 'error');
            return;
        }

        printWindow.document.write(`
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
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 20px; right: 20px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000;">
                <button onclick="window.print()" style="padding: 12px 24px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 1rem;"><i class="fa-solid fa-print"></i> Print PDF</button>
            </div>

            <div class="report-container">
                <div class="qr-header">
                    <img src="${qrCodeUrl}" alt="Report QR">
                    <div class="qr-label">Scan to Verify</div>
                </div>

                <div class="cover-page">
                    <div class="logo"><i class="fa-solid fa-shield-halved" style="color: #2563eb;"></i> AuditCB360</div>
                    <div class="report-title">Audit Certification Report</div>
                    <div class="report-meta">
                        <p style="text-align: center; font-weight: 500; font-size: 1.3rem;">${h(report.client)}</p>
                        <p style="text-align: center; font-size: 1.1rem;">${h(plan.standard || 'ISO Standard Audit')}</p>
                        <p style="text-align: center;">Audit Date: ${h(report.date)}</p>
                        <p style="text-align: center; color: #64748b;">Report Generated: ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <div style="margin-top: 2rem;">
                        <div style="font-size: 4.5rem; font-weight: 800; color: ${complianceScore > 80 ? '#10b981' : complianceScore > 60 ? '#f59e0b' : '#ef4444'}; line-height: 1;">
                            ${complianceScore}%
                        </div>
                        <div style="font-size: 1.2rem; color: #64748b; margin-top: 0.5rem;">Audit Compliance Score</div>
                    </div>
                </div>

                <h1>1. Audit Details</h1>
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

                <h1>2. Executive Summary</h1>
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

                <h1>3. Strengths and Opportunities</h1>
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

                <h1>4. Detailed Findings and Evidence</h1>
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
                                    <img src="${h(ncr.evidenceImage)}" alt="Captured Evidence" style="width: 150px; height: 150px; object-fit: cover; border: 2px solid #cbd5e1; border-radius: 6px; padding: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;" onclick="window.open(this.src)">
                                </div>
                            ` : ''}
                            
                            <div style="font-weight: 600; color: #555;">Current Status:</div>
                            <div><span class="badge ${ncr.status === 'Closed' ? 'bg-green' : 'bg-yellow'}" style="font-size: 0.75rem;">${h(ncr.status)}</span></div>
                        </div>
                    </div>
                `).join('')}

                ${capaCount > 0 ? `
                <h1>5. Corrective & Preventive Actions (CAPA)</h1>
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

                <h1>${capaCount > 0 ? '6' : '5'}. Observations</h1>
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

                <h1>${capaCount > 0 ? '7' : '6'}. Conclusion and Recommendation</h1>
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
    `);
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
// NEW: Reporting Dashboard (Top-Level View)
// ============================================

function renderReportingModule() {
    const h = window.UTILS.escapeHtml; // Sanitization alias
    const reports = window.state.auditReports || [];

    // Helper for status color
    const getStatusColor = (status) => {
        const S = window.CONSTANTS.STATUS;
        if (status === S.FINALIZED || status === S.PUBLISHED) return 'var(--success-color)'; // Green
        if (status === S.IN_REVIEW) return 'var(--warning-color)'; // Orange
        if (status === S.DRAFT) return 'var(--info-color)'; // Blue
        if (status === S.IN_PROGRESS) return '#64748b'; // Grey
        return '#94a3b8';
    };

    const html = `
        <div class="fade-in">
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h2 style="margin: 0;">Audit Reporting Dashboard</h2>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary);">Manage, review, and publish audit reports.</p>
                </div>
            </div>

            <!-- Summary Metric Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-file-lines"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Reports</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${reports.length}</div>
                    </div>
                </div>

                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fff7ed; color: #ea580c; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-glasses"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Pending Review</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${reports.filter(r => r.status === window.CONSTANTS.STATUS.IN_REVIEW).length}</div>
                    </div>
                </div>

                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f5f3ff; color: #7c3aed; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-check-double"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Approved</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${reports.filter(r => r.status === 'Approved').length}</div>
                    </div>
                </div>

                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #15803d; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-file-contract"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Finalized</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${reports.filter(r => r.status === window.CONSTANTS.STATUS.FINALIZED || r.status === window.CONSTANTS.STATUS.PUBLISHED).length}</div>
                    </div>
                </div>
            </div>

            <!-- Workflow Help Cards -->
            <div style="margin-bottom: 2rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                <div style="background: #eff6ff; padding: 1rem; border-radius: 8px; border: 1px solid #bfdbfe;">
                    <div style="font-weight: 600; color: #1d4ed8; margin-bottom: 0.5rem;"><i class="fa-solid fa-pen-ruler"></i> Draft</div>
                    <div style="font-size: 0.85rem;">Auditors consolidate findings and draft the initial report content.</div>
                </div>
                 <div style="background: #fff7ed; padding: 1rem; border-radius: 8px; border: 1px solid #fed7aa;">
                    <div style="font-weight: 600; color: #c2410c; margin-bottom: 0.5rem;"><i class="fa-solid fa-glasses"></i> Review (Manual)</div>
                    <div style="font-size: 0.85rem;">Lead Auditor performs <strong>manual classification</strong> of findings and validates technical content.</div>
                </div>
                <div style="background: #f5f3ff; padding: 1rem; border-radius: 8px; border: 1px solid #ddd6fe;">
                    <div style="font-weight: 600; color: #7c3aed; margin-bottom: 0.5rem;"><i class="fa-solid fa-check-double"></i> Approved</div>
                    <div style="font-size: 0.85rem;">Cert Manager validates report against historical context and approves for final issuance.</div>
                </div>
                 <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; border: 1px solid #bbf7d0;">
                    <div style="font-weight: 600; color: #15803d; margin-bottom: 0.5rem;"><i class="fa-solid fa-file-contract"></i> Finalized</div>
                    <div style="font-size: 0.85rem;">Report is published, locked, and ready for the formal Certification Decision.</div>
                </div>
            </div>

            <div class="card">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Audit Date</th>
                                <th>Report Status</th>
                                <th>Findings (Total)</th>
                                <th>Last Action</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reports.length > 0 ? reports.map(r => `
                                <tr>
                                    <td><strong>${h(r.client)}</strong></td>
                                    <td>${h(r.date)}</td>
                                    <td><span class="badge" style="background: ${getStatusColor(r.status)}">${h(r.status)}</span></td>
                                    <td>
                                        <span style="font-weight: 600;">${(r.ncrs || []).length}</span> 
                                        <span style="font-size: 0.8rem; color: #64748b;">(${(r.ncrs || []).filter(n => n.type === 'major').length} Major)</span>
                                    </td>
                                    <td style="font-size: 0.85rem; color: #64748b;">${r.finalizedAt ? 'Finalized on ' + new Date(r.finalizedAt).toLocaleDateString() : 'Drafting'}</td>
                                    <td style="text-align: right;">
                                        <button class="btn btn-sm btn-outline-primary" onclick="window.openReportingDetail(${r.id})">
                                            <i class="fa-solid fa-file-pen" style="margin-right: 0.5rem;"></i> Manage Report
                                        </button>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">No audit reports found. Start an audit in "Audit Execution" first.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            
        </div>
    `;
    window.contentArea.innerHTML = html;
}

// Wrapper to open detail view from the list
window.openReportingDetail = function (reportId) {
    const report = window.state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    // Structure for Detail View
    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="window.renderReportingModule()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Reporting Dashboard
                </button>
            </div>
            <div id="reporting-detail-container"></div>
        </div>
    `;
    window.contentArea.innerHTML = html;

    // Render the existing summary tab into the container
    const container = document.getElementById('reporting-detail-container');
    window.renderReportSummaryTab(report, container);
};

// Export
window.renderReportingModule = renderReportingModule;

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
    // 1. Calculate Metrics
    const reports = window.state.auditReports || [];
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
                <button class="btn btn-sm btn-outline-primary" onclick="window.renderExecutionDetail(${r.id})">
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

// Export
window.renderReportingModule = renderReportingModule;
