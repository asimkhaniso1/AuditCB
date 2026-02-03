
// ============================================
// SMART AUDIT WORKFLOW HELPERS
// ============================================

// 1. Finalize & Publish (One-Click Workflow)
window.finalizeAndPublish = function (reportId) {
    const report = state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) return;

    if (!confirm('Are you sure you want to finalize and publish this report? This will lock the audit.')) return;

    // Save current state first
    window.saveChecklist(reportId);

    // Update status to FINALIZED directly
    report.status = window.CONSTANTS.STATUS.FINALIZED;
    report.finalizedAt = new Date().toISOString();
    report.finalizedBy = window.state.currentUser?.name || 'Lead Auditor';

    // Persist to Database
    (async () => {
        try {
            await window.SupabaseClient.db.update('audit_reports', String(reportId), {
                status: report.status,
                data: report
            });
            window.showNotification('Audit Report successfully finalized and published!', 'success');

            // Redirect to list after short delay
            setTimeout(() => {
                renderAuditExecutionEnhanced();
            }, 2000);

        } catch (err) {
            console.error('Finalization failed:', err);
            window.showNotification('Finalization saved locally. Cloud sync pending.', 'warning');
        }
    })();
};

// 2. AI Auto-Analysis for Findings
window.runFollowUpAIAnalysis = async function (reportId) {
    const report = state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) return;

    const btn = document.querySelector(`button[onclick="window.runFollowUpAIAnalysis('${reportId}')"]`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
    btn.disabled = true;

    try {
        // Gather findings
        const findings = [];
        const { assignedChecklists = [] } = window.state.auditPlans.find(p => p.id == report.planId) || {};

        // Helper to get finding text
        // (Similar logic to render view, potentially refactorable)
        (report.checklistProgress || []).filter(p => p.status === 'nc').forEach((item, idx) => {
            findings.push({
                id: idx, // Array index in checklistProgress
                type: 'checklist',
                description: item.ncrDescription || item.comment || 'Checklist finding',
                remarks: item.comment || ''
            });
        });

        // Call AI Service
        const suggestions = await window.AI_SERVICE.analyzeFindings(findings);

        // Apply suggestions
        let updateCount = 0;
        suggestions.forEach(s => {
            if (s.type && ['major', 'minor', 'observation'].includes(s.type.toLowerCase())) {
                const finding = findings.find(f => f.id === s.id);
                if (finding) {
                    // Update the report object directly
                    if (report.checklistProgress[finding.id]) {
                        report.checklistProgress[finding.id].ncrType = s.type.toLowerCase();
                        updateCount++;
                    }
                }
            }
        });

        if (updateCount > 0) {
            window.saveChecklist(reportId); // Persist changes
            window.renderExecutionDetail(reportId); // Re-render view
            // Switch back to finalization tab
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="review"]').click(); // Using 'review' data-tab but content is 'finalization'
                window.showNotification(`AI classified ${updateCount} findings automatically.`, 'success');
            }, 300);
        } else {
            window.showNotification('AI analysis complete. No classification changes suggested.', 'info');
        }

    } catch (error) {
        console.error("AI Analysis Failed:", error);
        window.showNotification("AI Analysis failed. Please try again.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// 3. AI Auto-Summary Generation
window.runAutoSummary = async function (reportId) {
    const report = state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) return;

    const btn = document.querySelector(`button[onclick="window.runAutoSummary('${reportId}')"]`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Drafting...';
    btn.disabled = true;

    try {
        // Gather compliant items for Positive Observations
        const compliantItems = [];
        const { assignedChecklists = [] } = window.state.auditPlans.find(p => p.id == report.planId) || {};

        if (report.checklistProgress) {
            report.checklistProgress.filter(p => p.status === 'compliant').forEach(item => {
                let clauseTitle = '';
                // Resolve clause title from checklist definition
                const cl = assignedChecklists.find(c => c.id == item.checklistId);
                if (cl) {
                    if (cl.clauses) {
                        const parts = String(item.itemIdx).split('-');
                        if (parts.length === 2) {
                            const main = cl.clauses.find(c => c.mainClause == parts[0]);
                            if (main) clauseTitle = `${main.mainClause} ${main.title}`;
                        }
                    } else if (cl.items && cl.items[item.itemIdx]) {
                        clauseTitle = cl.items[item.itemIdx].category || 'General';
                    }
                }
                if (clauseTitle) compliantItems.push(clauseTitle);
            });
        }

        // Deduplicate clauses
        const uniqueCompliantAreas = [...new Set(compliantItems)];

        const result = await window.AI_SERVICE.draftExecutiveSummary(report, uniqueCompliantAreas);

        if (result.executiveSummary) {
            report.executiveSummary = result.executiveSummary;
            const execInput = document.getElementById('exec-summary-' + reportId);
            if (execInput) execInput.value = result.executiveSummary;
        }

        if (result.positiveObservations) {
            report.positiveObservations = Array.isArray(result.positiveObservations) ? result.positiveObservations.join('\n') : result.positiveObservations;
            const posInput = document.getElementById('positive-observations');
            if (posInput) posInput.value = report.positiveObservations;
        }

        if (result.ofi && Array.isArray(result.ofi)) {
            report.ofi = result.ofi.join('\n');
            const ofiInput = document.getElementById('ofi');
            if (ofiInput) ofiInput.value = report.ofi;
        }

        window.saveChecklist(reportId);
        window.showNotification("Executive Summary & Observations drafted by AI.", "success");

    } catch (error) {
        console.error("AI Summary Failed:", error);
        window.showNotification("Failed to generate summary.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};
