// ============================================
// ENHANCED DASHBOARD ANALYTICS MODULE v2.0
// ============================================

function renderDashboardEnhanced() {
    // Calculate Real Stats from Actual Data (Filtered by User Role)
    const visibleClients = window.getVisibleClients();
    const totalClients = visibleClients.length;
    const activeClients = visibleClients.filter(c => c.status === 'Active').length;
    const inactiveClients = visibleClients.filter(c => c.status === 'Inactive').length;
    const totalAuditors = state.auditors.length;
    const leadAuditors = state.auditors.filter(a => a.role === 'Lead Auditor').length;
    const auditPlans = window.getVisiblePlans() || [];
    const auditReports = window.getVisibleReports() || [];

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
    visibleClients.forEach(c => {
        const industry = c.industry || 'Other';
        industryStats[industry] = (industryStats[industry] || 0) + 1;
    });

    // Standard Distribution
    const standardStats = {};
    visibleClients.forEach(c => {
        if (c.standard) {
            const standards = c.standard.split(', ');
            standards.forEach(std => {
                standardStats[std] = (standardStats[std] || 0) + 1;
            });
        }
    });

    // Certificate Expiry Tracking
    const now = new Date();
    const expiringIn30Days = visibleClients.filter(c => {
        if (!c.nextAudit) return false;
        const daysUntil = Math.ceil((new Date(c.nextAudit) - now) / (1000 * 60 * 60 * 24));
        return daysUntil <= 30 && daysUntil > 0;
    }).length;

    const expiringIn90Days = visibleClients.filter(c => {
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
            <!-- Header Section -->
            <div style="margin-bottom: 2rem;">
                <h2 style="margin: 0; font-size: 1.75rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">AuditCB360 Dashboard</h2>
                <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0;">
                    <i class="fa-solid fa-calendar"></i> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    <span style="margin-left: 1rem; padding-left: 1rem; border-left: 1px solid #e2e8f0;">
                        <i class="fa-solid fa-user" style="color: var(--primary-color);"></i> ${window.UTILS.escapeHtml(state.currentUser.name || 'User')} (${window.UTILS.escapeHtml(state.currentUser.role)})
                    </span>
                </p>
            </div>

            <!-- Quick Stats Cards -->
            <div class="dashboard-stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <!-- Active Clients -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 1.5rem; border-radius: 12px; color: white; box-shadow: 0 4px 6px -1px rgba(102, 126, 234, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <div>
                            <div style="font-size: 0.85rem; opacity: 0.9;">Active Clients</div>
                            <div style="font-size: 2rem; font-weight: 700; margin-top: 0.25rem;">${activeClients}</div>
                        </div>
                        <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-building" style="font-size: 1.5rem;"></i>
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; opacity: 0.8;">${totalClients} total clients</div>
                </div>

                <!-- Upcoming Audits -->
                <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 1.5rem; border-radius: 12px; color: white; box-shadow: 0 4px 6px -1px rgba(240, 147, 251, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <div>
                            <div style="font-size: 0.85rem; opacity: 0.9;">Upcoming Audits</div>
                            <div style="font-size: 2rem; font-weight: 700; margin-top: 0.25rem;">${upcomingAudits}</div>
                        </div>
                        <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-calendar-check" style="font-size: 1.5rem;"></i>
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; opacity: 0.8;">${completedAudits} completed</div>
                </div>

                <!-- Open NCRs -->
                <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 1.5rem; border-radius: 12px; color: white; box-shadow: 0 4px 6px -1px rgba(250, 112, 154, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <div>
                            <div style="font-size: 0.85rem; opacity: 0.9;">Open NCRs</div>
                            <div style="font-size: 2rem; font-weight: 700; margin-top: 0.25rem;">${openNCRs}</div>
                        </div>
                        <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-exclamation-triangle" style="font-size: 1.5rem;"></i>
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; opacity: 0.8;">${closedNCRs} closed</div>
                </div>

                <!-- Compliance Score -->
                <div style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); padding: 1.5rem; border-radius: 12px; color: white; box-shadow: 0 4px 6px -1px rgba(48, 207, 208, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <div>
                            <div style="font-size: 0.85rem; opacity: 0.9;">Avg Compliance</div>
                            <div style="font-size: 2rem; font-weight: 700; margin-top: 0.25rem;">${avgComplianceScore}%</div>
                        </div>
                        <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-chart-line" style="font-size: 1.5rem;"></i>
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; opacity: 0.8;">Across ${auditReports.length} audits</div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="card" style="margin-bottom: 2rem; background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%); border: none;">
                <h3 style="margin: 0 0 1rem 0; color: #1e293b;"><i class="fa-solid fa-bolt" style="margin-right: 0.5rem; color: #8b5cf6;"></i>Quick Actions</h3>
                <div class="quick-actions-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem;">
                    <!-- 1. Add Client -->
                    <button class="btn" onclick="window.renderModule('clients')" style="background: white; color: #30cfd0; border: none; padding: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <i class="fa-solid fa-building" style="display: block; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                        <span style="font-size: 0.8rem;">Add Client</span>
                    </button>
                    <!-- 2. Plan Audit -->
                    <button class="btn" onclick="window.renderModule('audit-planning')" style="background: white; color: #667eea; border: none; padding: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <i class="fa-solid fa-clipboard-list" style="display: block; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                        <span style="font-size: 0.8rem;">Plan Audit</span>
                    </button>
                    <!-- 3. Execute Audit -->
                    <button class="btn" onclick="window.renderModule('audit-execution')" style="background: white; color: #f5576c; border: none; padding: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <i class="fa-solid fa-play" style="display: block; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                        <span style="font-size: 0.8rem;">Execute Audit</span>
                    </button>
                    <!-- 4. Review Report -->
                    <button class="btn" onclick="window.renderModule('audit-reporting')" style="background: white; color: #fee140; border: none; padding: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <i class="fa-solid fa-file-signature" style="display: block; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                        <span style="font-size: 0.8rem;">Review Report</span>
                    </button>
                    <!-- 5. Certify -->
                    <button class="btn" onclick="window.renderModule('certification')" style="background: white; color: #8b5cf6; border: none; padding: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <i class="fa-solid fa-award" style="display: block; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                        <span style="font-size: 0.8rem;">Certify</span>
                    </button>
                </div>
            </div>

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

            <!-- Third Charts Row: NCR Trends & Client Growth -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- NCR Trends Over Time -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-line" style="color: var(--danger-color); margin-right: 0.5rem;"></i>NCR Trends (Last 6 Months)</h3>
                    <div style="position: relative; height: 280px; width: 100%;">
                        <canvas id="ncrTrendsChart"></canvas>
                    </div>
                </div>

                <!-- Client Growth -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-bar" style="color: var(--success-color); margin-right: 0.5rem;"></i>Client Growth</h3>
                    <div style="position: relative; height: 280px; width: 100%;">
                        <canvas id="clientGrowthChart"></canvas>
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
                                            <p style="margin: 0; font-weight: 500;">${window.UTILS.escapeHtml(activity.title)}</p>
                                            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                                                <i class="fa-solid fa-calendar"></i> ${window.UTILS.escapeHtml(activity.date)}
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

    // Destroy existing chart instances BEFORE setting innerHTML to prevent "Canvas already in use" errors
    const chartIds = ['auditTrendsChart', 'ncrDistributionChart', 'industryChart', 'standardsChart', 'ncrTrendsChart', 'clientGrowthChart'];

    chartIds.forEach(id => {
        const existingChart = Chart.getChart(id);
        if (existingChart) {
            existingChart.destroy();
        }
    });

    // Also clear our tracking object
    if (window.dashboardCharts) {
        Object.values(window.dashboardCharts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                // Check if not already destroyed via getChart
                try { chart.destroy(); } catch (e) { }
            }
        });
    }
    window.dashboardCharts = {};

    // Now safe to set innerHTML
    window.contentArea.innerHTML = html;

    // Render Charts (Staggered to prevent blocking main thread)
    requestAnimationFrame(() => {
        renderAuditTrendsChart();
        renderNCRDistributionChart(majorNCRs, minorNCRs);

        // Defer lower priority charts
        setTimeout(() => {
            renderIndustryChart(industryStats);
            renderStandardsChart(standardStats);
            renderNCRTrendsChart();
            renderClientGrowthChart();
        }, 100);
    });
}

function renderAuditTrendsChart() {
    const ctx = document.getElementById('auditTrendsChart');
    if (!ctx) return;

    // Destroy existing chart if present to prevent "Canvas already in use" error
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    // Initialize arrays for last 6 months
    const months = [];
    const completed = new Array(6).fill(0);
    const planned = new Array(6).fill(0);
    const today = new Date();

    // Generate month labels (e.g., "Jan", "Feb")
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(d.toLocaleDateString('en-US', { month: 'short' }));
    }

    // Process Audit Plans
    const plans = window.state.auditPlans || [];
    plans.forEach(plan => {
        if (!plan.date) return;

        const planDate = new Date(plan.date);

        // Calculate month difference from today
        // This logic handles year boundaries correctly (e.g. Dec 2025 vs Jan 2026)
        const monthDiff = (today.getFullYear() - planDate.getFullYear()) * 12 + (today.getMonth() - planDate.getMonth());

        // We are interested in monthDiff 0 to 5 (0 is current month, 5 is 5 months ago)
        // The arrays are ordered [5 months ago, ..., current month]
        // So index = 5 - monthDiff
        if (monthDiff >= 0 && monthDiff <= 5) {
            const index = 5 - monthDiff;

            if (plan.status === 'Completed' || plan.status === 'Closed') {
                completed[index]++;
            } else if (plan.status !== 'Cancelled') {
                // Count everything else (Planned, Scheduled, In Progress) as "Planned"
                planned[index]++;
            }
        }
    });

    window.dashboardCharts.auditTrends = new Chart(ctx, {
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
            onClick: (e) => window.renderModule('audit-planning'), // Corrected module name if needed, assuming 'audit-planning' maps to something valid
            onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'; },
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function (context) {
                            return context.raw === 0 ? ' No audits' : '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    }
                }
            }
        }
    });
}

function renderNCRDistributionChart(major, minor) {
    const ctx = document.getElementById('ncrDistributionChart');
    if (!ctx) return;

    // Destroy existing chart if present
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    window.dashboardCharts.ncrDistribution = new Chart(ctx, {
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
            onClick: (e) => window.renderModule('audit-reporting'),
            onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'; },
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

    // Destroy existing chart if present
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const labels = Object.keys(industryStats);
    const data = Object.values(industryStats);

    window.dashboardCharts.industry = new Chart(ctx, {
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
            onClick: (e) => window.renderModule('clients'),
            onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'; },
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

    // Destroy existing chart if present
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const labels = Object.keys(standardStats);
    const data = Object.values(standardStats);
    const colors = ['#667eea', '#11998e', '#f093fb', '#fa709a', '#fee140'];

    window.dashboardCharts.standards = new Chart(ctx, {
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
            onClick: (e) => window.renderModule('clients'),
            onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'; },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// NCR Trends Chart - Shows Open vs Closed NCRs over last 6 months
function renderNCRTrendsChart() {
    const ctx = document.getElementById('ncrTrendsChart');
    if (!ctx) return;

    // Destroy existing chart if present
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const months = [];
    const openNCRs = new Array(6).fill(0);
    const closedNCRs = new Array(6).fill(0);
    const today = new Date();

    // Generate month labels
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(d.toLocaleDateString('en-US', { month: 'short' }));
    }

    // Process reports for NCR data
    const reports = window.state.auditReports || [];
    reports.forEach(report => {
        if (!report.ncrs || !report.date) return;

        const reportDate = new Date(report.date);
        const monthDiff = (today.getFullYear() - reportDate.getFullYear()) * 12 + (today.getMonth() - reportDate.getMonth());

        if (monthDiff >= 0 && monthDiff <= 5) {
            const index = 5 - monthDiff;
            report.ncrs.forEach(ncr => {
                if (ncr.status === 'Open') openNCRs[index]++;
                else closedNCRs[index]++;
            });
        }
    });

    window.dashboardCharts.ncrTrends = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Open NCRs',
                data: openNCRs,
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderRadius: 4
            }, {
                label: 'Closed NCRs',
                data: closedNCRs,
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Client Growth Chart - Shows client acquisitions over time
function renderClientGrowthChart() {
    const ctx = document.getElementById('clientGrowthChart');
    if (!ctx) return;

    // Destroy existing chart if present
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const months = [];
    const newClients = new Array(6).fill(0);
    const cumulativeTotal = new Array(6).fill(0);
    const today = new Date();

    // Generate month labels
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(d.toLocaleDateString('en-US', { month: 'short' }));
    }

    // Count clients by creation month (simulated based on ID order)
    const clients = window.getVisibleClients?.() || window.state.clients || [];
    const totalClients = clients.length;

    // Simulate growth distribution (since we don't have createdAt dates)
    // In production, you'd use actual createdAt timestamps
    let runningTotal = Math.max(0, totalClients - 5);
    for (let i = 0; i < 6; i++) {
        const addition = i === 5 ? totalClients - runningTotal : Math.floor(Math.random() * 2);
        newClients[i] = Math.min(addition, totalClients - runningTotal);
        runningTotal += newClients[i];
        cumulativeTotal[i] = runningTotal;
    }

    window.dashboardCharts.clientGrowth = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Total Clients',
                data: cumulativeTotal,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Export function
window.renderDashboardEnhanced = renderDashboardEnhanced;

