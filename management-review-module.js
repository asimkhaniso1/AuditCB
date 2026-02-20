// ============================================
// MANAGEMENT REVIEW MODULE
// ISO 17021-1 Clause 8.5
// ============================================

// --------------------------------------------
// DATA FETCHING (Supabase)
// --------------------------------------------

window.fetchManagementReviews = async function () {
    if (!window.SupabaseClient) return;

    try {
        const { data, error } = await window.SupabaseClient
            .from('audit_management_reviews')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        window.state.managementReviews = (data || []).map(row => ({
            id: row.id,
            date: row.date,
            reviewedBy: row.reviewed_by,
            attendees: row.attendees || [],
            inputs: row.inputs || {},
            outputs: row.outputs || {},
            actionItems: row.action_items || [],
            nextReviewDate: row.next_review_date,
            minutesApprovedBy: row.minutes_approved_by,
            minutesApprovedDate: row.minutes_approved_date
        }));

        if (document.getElementById('ai-generate-btn')) {
            renderManagementReviewModule();
        }

    } catch (err) {
        console.error('Error fetching Management Reviews:', err);
    }
};

// --------------------------------------------
// PERSISTENCE
// --------------------------------------------

async function persistManagementReview(review) {
    if (!window.SupabaseClient) return;
    try {
        const payload = {
            date: review.date,
            reviewed_by: review.reviewedBy,
            attendees: review.attendees,
            inputs: review.inputs,
            outputs: review.outputs,
            action_items: review.actionItems,
            next_review_date: review.nextReviewDate || null,
            minutes_approved_by: review.minutesApprovedBy || null,
            minutes_approved_date: review.minutesApprovedDate || null
        };

        if (review.id && !String(review.id).startsWith('demo-')) {
            // Update
            const { error } = await window.SupabaseClient
                .from('audit_management_reviews')
                .update(payload)
                .eq('id', review.id);
            if (error) throw error;
        } else {
            // Insert
            const { data, error } = await window.SupabaseClient
                .from('audit_management_reviews')
                .insert(payload)
                .select();
            if (error) throw error;
            if (data && data[0]) review.id = data[0].id;
        }
        await window.fetchManagementReviews();
        window.showNotification('Management review saved successfully', 'success');
    } catch (e) {
        console.error('Failed to sync management review:', e);
        window.showNotification('Failed to sync management review to DB', 'error');
    }
}

// Initialize state
if (!window.state.managementReviews) {
    window.state.managementReviews = [
        {
            id: 'demo-1',
            date: '2024-01-15',
            reviewedBy: 'Top Management',
            attendees: ['CEO', 'Quality Manager', 'Operations Manager', 'Certification Manager'],
            inputs: {
                internalAuditResults: 'All internal audits completed on schedule. 2 minor findings resolved.',
                customerFeedback: '95% satisfaction rate. 3 complaints received and resolved.',
                processPerformance: 'Certification cycle time reduced by 15%. Audit completion rate: 98%.',
                nonconformities: '5 NCRs raised in client audits. All closed within target timeframe.',
                followUpActions: 'Previous action items: 8 completed, 2 in progress.',
                changes: 'New ISO 27001:2022 standard adopted. Staff training completed.',
                recommendations: 'Expand auditor pool for ISO 45001. Implement digital audit tools.',
                resourceNeeds: 'Request for 2 additional auditors and audit management software.'
            },
            outputs: {
                improvementOpportunities: [
                    'Implement automated scheduling system',
                    'Develop online client portal',
                    'Enhance auditor competence tracking'
                ],
                resourceDecisions: [
                    'Approved: Hire 2 Lead Auditors for ISO 45001',
                    'Approved: Purchase audit management software (Budget: $15,000)',
                    'Deferred: Office expansion (review in Q3)'
                ],
                systemChanges: [
                    'Update certification decision process to include risk assessment',
                    'Revise auditor evaluation criteria',
                    'Implement quarterly impartiality committee meetings'
                ]
            },
            actionItems: [
                {
                    id: 1,
                    action: 'Procure and implement audit management software',
                    responsible: 'IT Manager',
                    dueDate: '2024-06-30',
                    status: 'In Progress'
                },
                {
                    id: 2,
                    action: 'Recruit 2 Lead Auditors for ISO 45001',
                    responsible: 'HR Manager',
                    dueDate: '2024-04-30',
                    status: 'Completed'
                }
            ],
            nextReviewDate: '2024-07-15',
            minutesApprovedBy: 'CEO',
            minutesApprovedDate: '2024-01-20'
        }
    ];
}

function renderManagementReviewModule() {
    // Auto-fetch if empty or demo only
    if (window.state.managementReviews.length <= 1 && window.SupabaseClient) {
        window.fetchManagementReviews();
    }

    const contentArea = document.getElementById('content-area');
    const reviews = window.state.managementReviews || [];

    contentArea.innerHTML = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-clipboard-check" style="margin-right: 0.5rem; color: #0284c7;"></i>
                        Management Review
                    </h2>
                    <p style="color: var(--text-secondary); margin: 0;">ISO 17021-1 Clause 8.5 - Management System Review</p>
                </div>
                <button class="btn btn-primary" data-action="openNewManagementReviewModal" aria-label="Add">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>New Review
                </button>
            </div>

            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #0284c7; margin: 0;">${reviews.length}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Reviews</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #059669; margin: 0;">
                        ${reviews.reduce((sum, r) => sum + (r.actionItems?.filter(a => a.status === 'Completed').length || 0), 0)}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Actions Completed</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #f59e0b; margin: 0;">
                        ${reviews.reduce((sum, r) => sum + (r.actionItems?.filter(a => a.status === 'In Progress').length || 0), 0)}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Actions In Progress</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #7c3aed; margin: 0;">
                        ${reviews[0]?.nextReviewDate ? new Date(reviews[0].nextReviewDate).toLocaleDateString() : 'TBD'}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Next Review</p>
                </div>
            </div>

            <!-- Reviews List -->
            <div class="card">
                <h3 style="margin-bottom: 1rem;">Review History</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Review Date</th>
                                <th>Reviewed By</th>
                                <th>Attendees</th>
                                <th>Action Items</th>
                                <th>Next Review</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reviews.map(review => {
        const completedActions = review.actionItems?.filter(a => a.status === 'Completed').length || 0;
        const totalActions = review.actionItems?.length || 0;
        const allComplete = totalActions > 0 && completedActions === totalActions;

        return `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(review.date)}</strong></td>
                                        <td>${window.UTILS.escapeHtml(review.reviewedBy)}</td>
                                        <td>${review.attendees.length} attendees</td>
                                        <td>
                                            <span style="color: ${allComplete ? 'green' : 'orange'};">
                                                ${completedActions}/${totalActions} completed
                                            </span>
                                        </td>
                                        <td>${window.UTILS.escapeHtml(review.nextReviewDate || 'TBD')}</td>
                                        <td>
                                            <span class="badge ${review.minutesApprovedDate ? 'bg-green' : 'bg-orange'}">
                                                ${review.minutesApprovedDate ? 'Approved' : 'Draft'}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn btn-sm btn-icon" data-action="viewManagementReview" data-id="${review.id}" title="View Details" aria-label="View">
                                                <i class="fa-solid fa-eye" style="color: var(--primary-color);"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon" data-action="editManagementReview" data-id="${review.id}" title="Edit Review" aria-label="Edit">
                                                <i class="fa-solid fa-edit" style="color: #f59e0b;"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon" data-action="deleteManagementReview" data-id="${review.id}" title="Delete Review" aria-label="Delete">
                                                <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon" data-action="printManagementReview" data-id="${review.id}" title="Print Minutes" aria-label="Print">
                                                <i class="fa-solid fa-print"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `;
    }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ISO 17021 Requirements Reference -->
            <div style="margin-top: 1.5rem; padding: 1rem; background: #eff6ff; border-left: 4px solid #0284c7; border-radius: 4px;">
                <h4 style="margin: 0 0 0.5rem 0; color: #0369a1;">
                    <i class="fa-solid fa-book" style="margin-right: 0.5rem;"></i>ISO 17021-1 Clause 8.5 Requirements
                </h4>
                <p style="margin: 0; font-size: 0.85rem; color: #0369a1;">
                    Management reviews must include: internal audit results, customer feedback, process performance, 
                    nonconformities, follow-up actions, changes affecting the MS, recommendations for improvement, 
                    and resource needs. Outputs must include decisions on improvement opportunities, resource needs, 
                    and changes to the management system.
                </p>
            </div>
        </div>
    `;
}

window.viewManagementReview = function (reviewId) {
    const review = window.state.managementReviews.find(r => String(r.id) === String(reviewId));
    if (!review) return;

    document.getElementById('modal-title').textContent = `Management Review - ${review.date}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="max-height: 600px; overflow-y: auto;">
            <!-- Header Info -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
                <div>
                    <strong>Review Date:</strong> ${window.UTILS.escapeHtml(review.date)}<br>
                    <strong>Reviewed By:</strong> ${window.UTILS.escapeHtml(review.reviewedBy)}<br>
                    <strong>Next Review:</strong> ${window.UTILS.escapeHtml(review.nextReviewDate || 'TBD')}
                </div>
                <div>
                    <strong>Attendees:</strong><br>
                    ${review.attendees.map(a => `• ${window.UTILS.escapeHtml(a)}`).join('<br>')}
                </div>
            </div>

            <!-- Inputs -->
            <h4 style="color: var(--primary-color); margin-bottom: 0.75rem;">
                <i class="fa-solid fa-arrow-right" style="margin-right: 0.5rem;"></i>Review Inputs
            </h4>
            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <div style="margin-bottom: 0.75rem;">
                    <strong>Internal Audit Results:</strong><br>
                    <span style="color: var(--text-secondary);">${window.UTILS.escapeHtml(review.inputs.internalAuditResults)}</span>
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <strong>Customer Feedback:</strong><br>
                    <span style="color: var(--text-secondary);">${window.UTILS.escapeHtml(review.inputs.customerFeedback)}</span>
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <strong>Process Performance:</strong><br>
                    <span style="color: var(--text-secondary);">${window.UTILS.escapeHtml(review.inputs.processPerformance)}</span>
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <strong>Nonconformities & Corrective Actions:</strong><br>
                    <span style="color: var(--text-secondary);">${window.UTILS.escapeHtml(review.inputs.nonconformities)}</span>
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <strong>Changes Affecting MS:</strong><br>
                    <span style="color: var(--text-secondary);">${window.UTILS.escapeHtml(review.inputs.changes)}</span>
                </div>
                <div>
                    <strong>Resource Needs:</strong><br>
                    <span style="color: var(--text-secondary);">${window.UTILS.escapeHtml(review.inputs.resourceNeeds)}</span>
                </div>
            </div>

            <!-- Outputs -->
            <h4 style="color: var(--primary-color); margin-bottom: 0.75rem;">
                <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>Review Outputs & Decisions
            </h4>
            <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <div style="margin-bottom: 0.75rem;">
                    <strong>Improvement Opportunities:</strong><br>
                    ${review.outputs.improvementOpportunities.map(i => `• ${window.UTILS.escapeHtml(i)}`).join('<br>')}
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <strong>Resource Decisions:</strong><br>
                    ${review.outputs.resourceDecisions.map(d => `• ${window.UTILS.escapeHtml(d)}`).join('<br>')}
                </div>
                <div>
                    <strong>Management System Changes:</strong><br>
                    ${review.outputs.systemChanges.map(c => `• ${window.UTILS.escapeHtml(c)}`).join('<br>')}
                </div>
            </div>

            <!-- Action Items -->
            <h4 style="color: var(--primary-color); margin-bottom: 0.75rem;">
                <i class="fa-solid fa-tasks" style="margin-right: 0.5rem;"></i>Action Items
            </h4>
            <table style="width: 100%; margin-bottom: 1.5rem;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 0.5rem; text-align: left;">Action</th>
                        <th style="padding: 0.5rem; text-align: left;">Responsible</th>
                        <th style="padding: 0.5rem; text-align: left;">Due Date</th>
                        <th style="padding: 0.5rem; text-align: left;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${review.actionItems.map(item => `
                        <tr>
                            <td style="padding: 0.5rem;">${window.UTILS.escapeHtml(item.action)}</td>
                            <td style="padding: 0.5rem;">${window.UTILS.escapeHtml(item.responsible)}</td>
                            <td style="padding: 0.5rem;">${window.UTILS.escapeHtml(item.dueDate)}</td>
                            <td style="padding: 0.5rem;">
                                <span class="badge ${item.status === 'Completed' ? 'bg-green' : 'bg-orange'}">
                                    ${window.UTILS.escapeHtml(item.status)}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- Approval -->
            ${review.minutesApprovedDate ? `
                <div style="background: #d1fae5; padding: 1rem; border-radius: 8px; border-left: 4px solid #059669;">
                    <strong style="color: #047857;">Minutes Approved</strong><br>
                    <span style="color: #065f46;">By: ${window.UTILS.escapeHtml(review.minutesApprovedBy)} on ${window.UTILS.escapeHtml(review.minutesApprovedDate)}</span>
                </div>
            ` : `
                <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <strong style="color: #d97706;">Draft - Awaiting Approval</strong>
                </div>
            `}
        </div>
    `;

    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
};

window.openNewManagementReviewModal = function (editData = null) {
    const isEdit = !!editData;
    document.getElementById('modal-title').textContent = isEdit ? 'Edit Management Review' : 'New Management Review';
    document.getElementById('modal-body').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0.75rem; background: #eff6ff; border-radius: 8px;">
            <div style="flex: 1;">
                <strong style="color: #0369a1;">AI-Powered Review Generation</strong>
                <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #0284c7;">Automatically analyze clients, auditors, appeals, and complaints data</p>
            </div>
            <button class="btn btn-primary btn-sm" data-action="generateManagementReviewInputs" id="ai-generate-btn" aria-label="Auto-generate">
                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i>AI Generate
            </button>
        </div>
        <form id="review-form" style="max-height: 500px; overflow-y: auto;">
            <div class="form-group">
                <label>Review Date <span style="color: var(--danger-color);">*</span></label>
                <input type="date" class="form-control" id="review-date" value="${new Date().toISOString().split('T')[0]}" required>
            </div>

            <div class="form-group">
                <label>Reviewed By <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="reviewed-by" value="Top Management" required>
            </div>

            <div class="form-group">
                <label>Attendees (comma-separated)</label>
                <input type="text" class="form-control" id="attendees" placeholder="CEO, Quality Manager, Operations Manager">
            </div>

            <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--primary-color);">Review Inputs</h4>
            
            <div class="form-group">
                <label>Internal Audit Results</label>
                <textarea class="form-control" id="input-audits" rows="2"></textarea>
            </div>

            <div class="form-group">
                <label>Customer Feedback</label>
                <textarea class="form-control" id="input-feedback" rows="2"></textarea>
            </div>

            <div class="form-group">
                <label>Process Performance</label>
                <textarea class="form-control" id="input-performance" rows="2"></textarea>
            </div>

            <div class="form-group">
                <label>Nonconformities & Corrective Actions</label>
                <textarea class="form-control" id="input-ncrs" rows="2"></textarea>
            </div>

            <div class="form-group">
                <label>Changes Affecting Management System</label>
                <textarea class="form-control" id="input-changes" rows="2"></textarea>
            </div>

            <div class="form-group">
                <label>Resource Needs</label>
                <textarea class="form-control" id="input-resources" rows="2"></textarea>
            </div>

            <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--primary-color);">Review Outputs</h4>

            <div class="form-group">
                <label>Improvement Opportunities (one per line)</label>
                <textarea class="form-control" id="output-improvements" rows="3"></textarea>
            </div>

            <div class="form-group">
                <label>Resource Decisions (one per line)</label>
                <textarea class="form-control" id="output-resources" rows="3"></textarea>
            </div>

            <div class="form-group">
                <label>Management System Changes (one per line)</label>
                <textarea class="form-control" id="output-changes" rows="3"></textarea>
            </div>

            <div class="form-group">
                <label>Next Review Date</label>
                <input type="date" class="form-control" id="next-review-date" value="${isEdit ? editData.nextReviewDate || '' : ''}">
            </div>
        </form>
    `;

    // Fill data if editing
    if (isEdit) {
        document.getElementById('review-date').value = editData.date || '';
        document.getElementById('reviewed-by').value = editData.reviewedBy || '';
        document.getElementById('attendees').value = (editData.attendees || []).join(', ');
        document.getElementById('input-audits').value = editData.inputs?.internalAuditResults || '';
        document.getElementById('input-feedback').value = editData.inputs?.customerFeedback || '';
        document.getElementById('input-performance').value = editData.inputs?.processPerformance || '';
        document.getElementById('input-ncrs').value = editData.inputs?.nonconformities || '';
        document.getElementById('input-changes').value = editData.inputs?.changes || '';
        document.getElementById('input-resources').value = editData.inputs?.resourceNeeds || '';
        document.getElementById('output-improvements').value = (editData.outputs?.improvementOpportunities || []).join('\n');
        document.getElementById('output-resources').value = (editData.outputs?.resourceDecisions || []).join('\n');
        document.getElementById('output-changes').value = (editData.outputs?.systemChanges || []).join('\n');
    }

    document.getElementById('modal-save').onclick = async () => {
        const date = document.getElementById('review-date').value;
        const reviewedBy = document.getElementById('reviewed-by').value.trim();

        if (!date || !reviewedBy) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        const attendees = document.getElementById('attendees').value
            .split(',')
            .map(a => a.trim())
            .filter(a => a);

        const improvements = document.getElementById('output-improvements').value
            .split('\n')
            .map(i => i.trim())
            .filter(i => i);

        const resourceDecisions = document.getElementById('output-resources').value
            .split('\n')
            .map(r => r.trim())
            .filter(r => r);

        const systemChanges = document.getElementById('output-changes').value
            .split('\n')
            .map(c => c.trim())
            .filter(c => c);

        const newReview = {
            id: isEdit ? editData.id : null,
            date,
            reviewedBy,
            attendees,
            inputs: {
                internalAuditResults: document.getElementById('input-audits').value,
                customerFeedback: document.getElementById('input-feedback').value,
                processPerformance: document.getElementById('input-performance').value,
                nonconformities: document.getElementById('input-ncrs').value,
                followUpActions: isEdit ? editData.inputs?.followUpActions || '' : '',
                changes: document.getElementById('input-changes').value,
                recommendations: isEdit ? editData.inputs?.recommendations || '' : '',
                resourceNeeds: document.getElementById('input-resources').value
            },
            outputs: {
                improvementOpportunities: improvements,
                resourceDecisions: resourceDecisions,
                systemChanges: systemChanges
            },
            actionItems: isEdit ? editData.actionItems || [] : [],
            nextReviewDate: document.getElementById('next-review-date').value,
            minutesApprovedBy: isEdit ? editData.minutesApprovedBy : null,
            minutesApprovedDate: isEdit ? editData.minutesApprovedDate : null
        };

        document.getElementById('modal-save').disabled = true;
        document.getElementById('modal-save').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        await persistManagementReview(newReview);

        window.closeModal();
        renderManagementReviewModule();
    };

    window.openModal();
};

window.printManagementReview = function (reviewId) {
    const review = window.state.managementReviews.find(r => String(r.id) === String(reviewId));
    if (!review) return;

    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Management Review Minutes - ${review.date}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; line-height: 1.6; }
                h1 { color: #0284c7; border-bottom: 3px solid #0284c7; padding-bottom: 0.5rem; }
                h2 { color: #334155; margin-top: 1.5rem; }
                table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                th, td { border: 1px solid #cbd5e1; padding: 0.5rem; text-align: left; }
                th { background: #f1f5f9; }
                .section { margin-bottom: 1.5rem; }
                .approval { background: #d1fae5; padding: 1rem; border-left: 4px solid #059669; margin-top: 2rem; }
            </style>
        </head>
        <body>
            <h1>Management Review Minutes</h1>
            <p><strong>Date:</strong> ${window.UTILS.escapeHtml(review.date)}</p>
            <p><strong>Reviewed By:</strong> ${window.UTILS.escapeHtml(review.reviewedBy)}</p>
            <p><strong>Attendees:</strong> ${review.attendees.map(a => window.UTILS.escapeHtml(a)).join(', ')}</p>

            <h2>Review Inputs</h2>
            <div class="section">
                <p><strong>Internal Audit Results:</strong><br>${window.UTILS.escapeHtml(review.inputs.internalAuditResults)}</p>
                <p><strong>Customer Feedback:</strong><br>${window.UTILS.escapeHtml(review.inputs.customerFeedback)}</p>
                <p><strong>Process Performance:</strong><br>${window.UTILS.escapeHtml(review.inputs.processPerformance)}</p>
                <p><strong>Nonconformities:</strong><br>${window.UTILS.escapeHtml(review.inputs.nonconformities)}</p>
                <p><strong>Changes:</strong><br>${window.UTILS.escapeHtml(review.inputs.changes)}</p>
                <p><strong>Resource Needs:</strong><br>${window.UTILS.escapeHtml(review.inputs.resourceNeeds)}</p>
            </div>

            <h2>Review Outputs & Decisions</h2>
            <div class="section">
                <p><strong>Improvement Opportunities:</strong></p>
                <ul>${review.outputs.improvementOpportunities.map(i => `<li>${window.UTILS.escapeHtml(i)}</li>`).join('')}</ul>
                
                <p><strong>Resource Decisions:</strong></p>
                <ul>${review.outputs.resourceDecisions.map(d => `<li>${window.UTILS.escapeHtml(d)}</li>`).join('')}</ul>
                
                <p><strong>Management System Changes:</strong></p>
                <ul>${review.outputs.systemChanges.map(c => `<li>${window.UTILS.escapeHtml(c)}</li>`).join('')}</ul>
            </div>

            <h2>Action Items</h2>
            <table>
                <thead>
                    <tr>
                        <th>Action</th>
                        <th>Responsible</th>
                        <th>Due Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${review.actionItems.map(item => `
                        <tr>
                            <td>${window.UTILS.escapeHtml(item.action)}</td>
                            <td>${window.UTILS.escapeHtml(item.responsible)}</td>
                            <td>${window.UTILS.escapeHtml(item.dueDate)}</td>
                            <td>${window.UTILS.escapeHtml(item.status)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            ${review.minutesApprovedDate ? `
                <div class="approval">
                    <strong>Minutes Approved</strong><br>
                    By: ${window.UTILS.escapeHtml(review.minutesApprovedBy)} on ${window.UTILS.escapeHtml(review.minutesApprovedDate)}
                </div>
            ` : ''}

            <p style="margin-top: 2rem;"><strong>Next Review Date:</strong> ${window.UTILS.escapeHtml(review.nextReviewDate || 'TBD')}</p>

            <script>setTimeout(() => window.print(), 500);</script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

window.editManagementReview = function (reviewId) {
    const review = window.state.managementReviews.find(r => String(r.id) === String(reviewId));
    if (!review) return;
    window.openNewManagementReviewModal(review);
};

window.deleteManagementReview = async function (reviewId) {
    if (!confirm('Are you sure you want to delete this Management Review record? This action cannot be undone.')) return;

    try {
        if (window.SupabaseClient && !String(reviewId).startsWith('demo-')) {
            const { error } = await window.SupabaseClient
                .from('audit_management_reviews')
                .delete()
                .eq('id', reviewId);
            if (error) throw error;
        }

        window.state.managementReviews = window.state.managementReviews.filter(r => String(r.id) !== String(reviewId));
        window.saveData();
        renderManagementReviewModule();
        window.showNotification('Management Review deleted', 'success');
    } catch (err) {
        console.error('Error deleting Management Review:', err);
        window.showNotification('Failed to delete record', 'error');
    }
};

// ============================================
// AI-POWERED MANAGEMENT REVIEW GENERATION
// ============================================

window.generateManagementReviewInputs = async function () {
    const btn = document.getElementById('ai-generate-btn');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

    try {
        const clients = window.state.clients || [];
        const auditors = window.state.auditors || [];
        const appeals = window.state.appeals || [];
        const complaints = window.state.complaints || [];
        const certifications = window.state.certifications || [];
        const internalAudits = window.state.internalAudits || {};

        const stats = {
            totalClients: clients.length,
            activeClients: clients.filter(c => c.status === 'Active').length,
            totalAuditors: auditors.length,
            totalAppeals: appeals.length,
            openAppeals: appeals.filter(a => a.status === 'Open' || a.status === 'Under Review').length,
            totalComplaints: complaints.length,
            openComplaints: complaints.filter(c => c.status === 'Open' || c.status === 'Investigating').length,
            totalCertifications: certifications.length,
            activeCertifications: certifications.filter(c => c.status === 'Valid').length,
            internalAuditFindings: internalAudits.findings?.length || 0,
            openFindings: internalAudits.findings?.filter(f => f.status !== 'Closed').length || 0
        };

        const prompt = `You are an ISO 17021-1 expert. Generate Management Review inputs based on this data:
- Clients: ${stats.totalClients} (Active: ${stats.activeClients})
- Auditors: ${stats.totalAuditors}
- Certifications: ${stats.totalCertifications} (Active: ${stats.activeCertifications})
- Appeals: ${stats.totalAppeals} (Open: ${stats.openAppeals})
- Complaints: ${stats.totalComplaints} (Open: ${stats.openComplaints})
- Internal Findings: ${stats.internalAuditFindings} (Open: ${stats.openFindings})

Return JSON: {"internalAuditResults":"","customerFeedback":"","processPerformance":"","nonconformities":"","changes":"","resourceNeeds":"","improvementOpportunities":[],"resourceDecisions":[],"systemChanges":[]}`;

        const response = await window.AI_SERVICE.callProxyAPI(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const reviewData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

        document.getElementById('input-audits').value = reviewData.internalAuditResults || '';
        document.getElementById('input-feedback').value = reviewData.customerFeedback || '';
        document.getElementById('input-performance').value = reviewData.processPerformance || '';
        document.getElementById('input-ncrs').value = reviewData.nonconformities || '';
        document.getElementById('input-changes').value = reviewData.changes || '';
        document.getElementById('input-resources').value = reviewData.resourceNeeds || '';
        document.getElementById('output-improvements').value = (reviewData.improvementOpportunities || []).join('\n');
        document.getElementById('output-resources').value = (reviewData.resourceDecisions || []).join('\n');
        document.getElementById('output-changes').value = (reviewData.systemChanges || []).join('\n');

        const nextReview = new Date();
        nextReview.setMonth(nextReview.getMonth() + 6);
        document.getElementById('next-review-date').value = nextReview.toISOString().split('T')[0];

        window.showNotification('Management review generated!', 'success');
    } catch (error) {
        window.showNotification('Failed: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
};
