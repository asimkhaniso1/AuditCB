// ============================================
// DASHBOARD ANALYTICS MODULE
// ============================================

function renderDashboardEnhanced() {
    // Calculate Stats
    const totalClients = state.clients.length;
    const activeClients = state.clients.filter(c => c.status === 'Active').length;
    const totalAuditors = state.auditors.length;
    const upcomingAudits = state.auditPlans ? state.auditPlans.filter(p => p.status !== 'Completed').length : 0;

    // Mock Data for Charts if real data is sparse
    const ncrData = {
        major: [2, 5, 3, 6, 4, 7],
        minor: [8, 12, 10, 15, 11, 14],
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    };

    const html = `
        <div class="fade-in">
            <!-- KPI Cards -->
            <div class="dashboard-grid">
                <div class="card stat-card" style="border-left: 4px solid var(--primary-color);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h3 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Total Clients</h3>
                            <p class="stat-value" style="font-size: 2rem; margin: 0;">${totalClients}</p>
                        </div>
                        <div style="background: #eef2ff; padding: 0.5rem; border-radius: 8px;">
                            <i class="fa-solid fa-building" style="color: var(--primary-color); font-size: 1.2rem;"></i>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--success-color);">
                        <i class="fa-solid fa-arrow-up"></i> 12% vs last month
                    </div>
                </div>

                <div class="card stat-card" style="border-left: 4px solid var(--success-color);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h3 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Active Auditors</h3>
                            <p class="stat-value" style="font-size: 2rem; margin: 0;">${totalAuditors}</p>
                        </div>
                        <div style="background: #ecfdf5; padding: 0.5rem; border-radius: 8px;">
                            <i class="fa-solid fa-user-tie" style="color: var(--success-color); font-size: 1.2rem;"></i>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
                        All qualifications valid
                    </div>
                </div>

                <div class="card stat-card" style="border-left: 4px solid var(--warning-color);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h3 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Upcoming Audits</h3>
                            <p class="stat-value" style="font-size: 2rem; margin: 0;">${upcomingAudits}</p>
                        </div>
                        <div style="background: #fffbeb; padding: 0.5rem; border-radius: 8px;">
                            <i class="fa-solid fa-calendar-alt" style="color: var(--warning-color); font-size: 1.2rem;"></i>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--warning-color);">
                        Next 30 days
                    </div>
                </div>

                <div class="card stat-card" style="border-left: 4px solid var(--danger-color);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h3 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Open NCRs</h3>
                            <p class="stat-value" style="font-size: 2rem; margin: 0;">8</p>
                        </div>
                        <div style="background: #fef2f2; padding: 0.5rem; border-radius: 8px;">
                            <i class="fa-solid fa-exclamation-circle" style="color: var(--danger-color); font-size: 1.2rem;"></i>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--danger-color);">
                        2 Major, 6 Minor
                    </div>
                </div>
            </div>

            <!-- Export Button -->
            <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="exportDashboardToPDF()">
                    <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i>Export Dashboard Summary
                </button>
            </div>

            <!-- Charts Section -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-top: 2rem;">
                <!-- NCR Trends Chart -->
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">NCR Trends (Last 6 Months)</h3>
                    <div style="height: 300px;">
                        <canvas id="ncrChart"></canvas>
                    </div>
                </div>

                <!-- Client Distribution Chart -->
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Client Status</h3>
                    <div style="height: 250px; display: flex; justify-content: center;">
                        <canvas id="clientChart"></canvas>
                    </div>
                    <div style="margin-top: 1rem; text-align: center; font-size: 0.9rem; color: var(--text-secondary);">
                        Total Active: ${activeClients}
                    </div>
                </div>
            </div>

            <!-- Recent Activity & Upcoming Audits -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2rem;">
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Upcoming Audits</h3>
                    <div class="table-container">
                        <table style="font-size: 0.9rem;">
                            <thead>
                                <tr>
                                    <th>Client</th>
                                    <th>Date</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${state.auditPlans ? state.auditPlans.slice(0, 5).map(plan => `
                                    <tr>
                                        <td>${plan.client}</td>
                                        <td>${plan.date}</td>
                                        <td><span class="status-badge status-draft">${plan.type}</span></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="3">No upcoming audits</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Recent Activity</h3>
                    <ul style="list-style: none; padding: 0;">
                        <li style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: start;">
                            <div style="width: 32px; height: 32px; background: #eef2ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fa-solid fa-file-contract" style="color: var(--primary-color); font-size: 0.8rem;"></i>
                            </div>
                            <div>
                                <div style="font-weight: 500; font-size: 0.9rem;">New Audit Plan Created</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">For Acme Corp - Stage 2 Audit</div>
                                <div style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.2rem;">2 hours ago</div>
                            </div>
                        </li>
                        <li style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: start;">
                            <div style="width: 32px; height: 32px; background: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fa-solid fa-check" style="color: var(--success-color); font-size: 0.8rem;"></i>
                            </div>
                            <div>
                                <div style="font-weight: 500; font-size: 0.9rem;">NCR #452 Closed</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">TechStart Inc provided sufficient evidence</div>
                                <div style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.2rem;">5 hours ago</div>
                            </div>
                        </li>
                        <li style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: start;">
                            <div style="width: 32px; height: 32px; background: #fffbeb; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fa-solid fa-user-plus" style="color: var(--warning-color); font-size: 0.8rem;"></i>
                            </div>
                            <div>
                                <div style="font-weight: 500; font-size: 0.9rem;">New Auditor Added</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Sarah Jenkins - Lead Auditor</div>
                                <div style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.2rem;">1 day ago</div>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    contentArea.innerHTML = html;

    // Initialize Charts
    initCharts(ncrData, activeClients, totalClients);
}

function initCharts(ncrData, activeClients, totalClients) {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return;
    }

    // NCR Trends Chart
    const ncrCtx = document.getElementById('ncrChart').getContext('2d');
    new Chart(ncrCtx, {
        type: 'bar',
        data: {
            labels: ncrData.months,
            datasets: [
                {
                    label: 'Minor NCRs',
                    data: ncrData.minor,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                },
                {
                    label: 'Major NCRs',
                    data: ncrData.major,
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Client Status Chart
    const clientCtx = document.getElementById('clientChart').getContext('2d');
    new Chart(clientCtx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Suspended', 'Withdrawn'],
            datasets: [{
                data: [activeClients, totalClients - activeClients, 0],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            cutout: '70%'
        }
    });
}

// Export function
window.renderDashboardEnhanced = renderDashboardEnhanced;
