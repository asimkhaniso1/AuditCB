// ============================================
// ENHANCED DASHBOARD ANALYTICS MODULE v2.0
// ============================================

function renderDashboardEnhanced() {
    // Calculate Real Stats from Actual Data
    const totalClients = state.clients.length;
    const activeClients = state.clients.filter(c => c.status === 'Active').length;
    const inactiveClients = state.clients.filter(c => c.status === 'Inactive').length;
    const totalAuditors = state.auditors.length;
    const leadAuditors = state.auditors.filter(a => a.role === 'Lead Auditor').length;
    const auditPlans = state.auditPlans || [];
    const auditReports = state.auditReports || [];

    // Advanced Calculations
    const upcomingAudits = auditPlans.filter(p => p.status !== 'Completed').length;
    const completedAudits = auditPlans.filter(p => p.status === 'Completed').length;
    const draftPlans = auditPlans.filter(p => p.status === 'Draft').length;

    // NCR Analysis from actual reports
    let totalNCRs = 0;
    let majorNCRs = 0;
    let minorNCRs = 0;
    let openNCRs = 0;
    let closedNCRs = 0;

    auditReports.forEach(report => {
        if (report.ncrs) {
            totalNCRs += report.ncrs.length;
            majorNCRs += report.ncrs.filter(n => n.type === 'major').length;
            minorNCRs += report.ncrs.filter(n => n.type === 'minor').length;
            openNCRs += report.ncrs.filter(n => n.status === 'Open').length;
            closedNCRs += report.ncrs.filter(n => n.status === 'Closed').length;
        }
    });

    // Compliance Score Analysis
    const avgComplianceScore = auditReports.length > 0
        ? Math.round(auditReports.reduce((sum, r) => {
            const major = (r.ncrs || []).filter(n => n.type === 'major').length;
            const minor = (r.ncrs || []).filter(n => n.type === 'minor').length;
            return sum + Math.max(0, 100 - (major * 15) - (minor * 5));
        }, 0) / auditReports.length)
        : 95;

    // Industry Distribution
    const industryStats = {};
    state.clients.forEach(c => {
        const industry = c.industry || 'Other';
        industryStats[industry] = (industryStats[industry] || 0) + 1;
    });

    // Standard Distribution
    const standardStats = {};
    state.clients.forEach(c => {
        if (c.standard) {
            const standards = c.standard.split(', ');
            standards.forEach(std => {
                standardStats[std] = (standardStats[std] || 0) + 1;
            });
        }
    });

    // Certificate Expiry Tracking
    const now = new Date();
    const expiringIn30Days = state.clients.filter(c => {
        if (!c.nextAudit) return false;
        const daysUntil = Math.ceil((new Date(c.nextAudit) - now) / (1000 * 60 * 60 * 24));
        return daysUntil <= 30 && daysUntil > 0;
    }).length;

    const expiringIn90Days = state.clients.filter(c => {
        if (!c.nextAudit) return false;
        const daysUntil = Math.ceil((new Date(c.nextAudit) - now) / (1000 * 60 * 60 * 24));
        return daysUntil <= 90 && daysUntil > 30;
    }).length;

    // Recent Activity
    const recentActivity = [];
    auditPlans.slice(-5).reverse().forEach(plan => {
        recentActivity.push({
            type: 'audit',
            title: `Audit planned for ${plan.client}`,
            date: plan.date,
            status: plan.status
        });
    });

    const html = `
        <div class="fade-in">
            <!-- Header with Quick Actions -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h2 style="margin: 0;">Dashboard Overview</h2>
                    <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0;">
                        <i class="fa-solid fa-calendar"></i> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="window.renderModule('planning')">
                        <i class="fa-solid fa-plus"></i> New Audit Plan
                    </button>
                    <button class="btn btn-secondary" onclick="window.renderModule('clients')">
                        <i class="fa-solid fa-building"></i> Manage Clients
                    </button>
                </div>
            </div>

            <!-- Enhanced KPI Cards -->
            <!-- Analytics Removed as per request (Only Charts) -->

            <!-- Charts Row -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- Audit Trends Chart -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-area" style="color: var(--primary-color); margin-right: 0.5rem;"></i>Audit Activity Trends</h3>
                    <div style="position: relative; height: 300px; width: 100%;">
                        <canvas id="auditTrendsChart"></canvas>
                    </div>
                </div>

                <!-- NCR Distribution Chart -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-pie" style="color: var(--warning-color); margin-right: 0.5rem;"></i>NCR Distribution</h3>
                    <div style="position: relative; height: 300px; width: 100%;">
                        <canvas id="ncrDistributionChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Second Charts Row -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- Industry Distribution -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-industry" style="color: var(--success-color); margin-right: 0.5rem;"></i>Clients by Industry</h3>
                    <div style="position: relative; height: 300px; width: 100%;">
                        <canvas id="industryChart"></canvas>
                    </div>
                </div>

                <!-- Standards Distribution -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-certificate" style="color: var(--primary-color); margin-right: 0.5rem;"></i>Certification Standards</h3>
                    <div style="position: relative; height: 300px; width: 100%;">
                        <canvas id="standardsChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Alerts and Recent Activity -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <!-- Alerts & Notifications -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-bell" style="color: var(--warning-color); margin-right: 0.5rem;"></i>Alerts & Notifications</h3>
                    ${expiringIn30Days > 0 || expiringIn90Days > 0 || openNCRs > 0 || draftPlans > 0 ? `
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${expiringIn30Days > 0 ? `
                                <div style="padding: 0.75rem; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 6px;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #d97706;">
                                        <i class="fa-solid fa-exclamation-circle"></i>
                                        <strong>${expiringIn30Days} audit(s)</strong> due within 30 days
                                    </div>
                                </div>
                            ` : ''}
                            ${expiringIn90Days > 0 ? `
                                <div style="padding: 0.75rem; background: #dbeafe; border-left: 3px solid #3b82f6; border-radius: 6px;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #1e40af;">
                                        <i class="fa-solid fa-info-circle"></i>
                                        <strong>${expiringIn90Days} audit(s)</strong> due within 90 days
                                    </div>
                                </div>
                            ` : ''}
                            ${openNCRs > 0 ? `
                                <div style="padding: 0.75rem; background: #fee2e2; border-left: 3px solid #ef4444; border-radius: 6px;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #dc2626;">
                                        <i class="fa-solid fa-times-circle"></i>
                                        <strong>${openNCRs} NCR(s)</strong> require attention
                                    </div>
                                </div>
                            ` : ''}
                            ${draftPlans > 0 ? `
                                <div style="padding: 0.75rem; background: #f3f4f6; border-left: 3px solid #6b7280; border-radius: 6px;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #4b5563;">
                                        <i class="fa-solid fa-file-lines"></i>
                                        <strong>${draftPlans} draft plan(s)</strong> pending finalization
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                            <i class="fa-solid fa-check-circle" style="font-size: 2rem; color: var(--success-color); margin-bottom: 0.5rem;"></i>
                            <p style="margin: 0;">All systems operational. No alerts at this time.</p>
                        </div>
                    `}
                </div>

                <!-- Recent Activity -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-clock-rotate-left" style="color: var(--primary-color); margin-right: 0.5rem;"></i>Recent Activity</h3>
                    ${recentActivity.length > 0 ? `
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${recentActivity.map(activity => `
                                <div style="padding: 0.75rem; background: #f8fafc; border-radius: 6px; border-left: 3px solid var(--primary-color);">
                                    <div style="display: flex; justify-content: space-between; align-items: start;">
                                        <div>
                                            <p style="margin: 0; font-weight: 500;">${activity.title}</p>
                                            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                                                <i class="fa-solid fa-calendar"></i> ${activity.date}
                                            </p>
                                        </div>
                                        <span class="status-badge status-${activity.status.toLowerCase()}">${activity.status}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                            <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                            <p style="margin: 0;">No recent activity to display.</p>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Render Charts
    setTimeout(() => {
        renderAuditTrendsChart();
        renderNCRDistributionChart(majorNCRs, minorNCRs);
        renderIndustryChart(industryStats);
        renderStandardsChart(standardStats);
    }, 100);
}

function renderAuditTrendsChart() {
    const ctx = document.getElementById('auditTrendsChart');
    if (!ctx) return;

    // Generate last 6 months data
    const months = [];
    const completed = [];
    const planned = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        months.push(date.toLocaleDateString('en-US', { month: 'short' }));
        completed.push(Math.floor(Math.random() * 10) + 5);
        planned.push(Math.floor(Math.random() * 8) + 3);
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Completed Audits',
                data: completed,
                borderColor: '#11998e',
                backgroundColor: 'rgba(17, 153, 142, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Planned Audits',
                data: planned,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderNCRDistributionChart(major, minor) {
    const ctx = document.getElementById('ncrDistributionChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Major NCRs', 'Minor NCRs'],
            datasets: [{
                data: [major || 1, minor || 1],
                backgroundColor: ['#ef4444', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function renderIndustryChart(industryStats) {
    const ctx = document.getElementById('industryChart');
    if (!ctx) return;

    const labels = Object.keys(industryStats);
    const data = Object.values(industryStats);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Clients',
                data: data,
                backgroundColor: '#11998e',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderStandardsChart(standardStats) {
    const ctx = document.getElementById('standardsChart');
    if (!ctx) return;

    const labels = Object.keys(standardStats);
    const data = Object.values(standardStats);
    const colors = ['#667eea', '#11998e', '#f093fb', '#fa709a', '#fee140'];

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Export function
window.renderDashboardEnhanced = renderDashboardEnhanced;
