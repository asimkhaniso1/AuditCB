// ============================================
// EXECUTION MODULE - Reporting, AI & PDF Export
// ============================================
// Extracted from execution-module-v2.js for maintainability.
// Contains: generateAuditReport, showReportPreviewModal, charts,
//   AI analysis/polish, PDF export.

(function () {
    'use strict';

    window.generateAuditReport = async function (reportId) {
        const report = window.DataService.findAuditReport(reportId);
        if (!report) {
            window.showNotification('Report not found', 'error');
            return;
        }

        // 1. Hydrate Checklist Data (Clause & Requirements) - using shared helper
        const hydratedProgress = (report.checklistProgress || []).map(item => {
            let clause = item.clause;
            let requirement = item.requirement;

            // Use shared helper for clause/requirement resolution if data is missing
            if ((!requirement || !clause) && item.checklistId) {
                const resolved = window.KB_HELPERS.resolveChecklistClause(item, window.state.checklists || []);
                if (resolved.clauseText) clause = resolved.clauseText;
                if (resolved.reqText) requirement = resolved.reqText;
            }

            // ALWAYS look up KB standard requirement (not just as fallback)
            const kbMatch = window.KB_HELPERS.lookupKBRequirement(clause, report.standard);

            return {
                ...item,
                clause: clause || item.clause || item.sectionName || 'General Requirement',
                requirement: requirement || item.text || item.requirement || item.description || 'Requirement details not available',
                kbMatch: kbMatch,
                comment: item.comment || ''
            };
        });

        // Resolve all idb:// evidence URLs to data URLs (screen captures stored in IndexedDB)
        const resolveUrl = async (url) => {
            if (!url || typeof url !== 'string' || !url.startsWith('idb://')) return url;
            try {
                const dataUrl = await EvidenceDB.get(url);
                return dataUrl || '';
            } catch (e) { return ''; }
        };
        for (const item of hydratedProgress) {
            if (item.evidenceImage) item.evidenceImage = await resolveUrl(item.evidenceImage);
            if (Array.isArray(item.evidenceImages)) {
                item.evidenceImages = await Promise.all(item.evidenceImages.map(resolveUrl));
                item.evidenceImages = item.evidenceImages.filter(u => !!u);
            }
        }
        // Also resolve NCR evidence images
        if (report.ncrs) {
            for (const ncr of report.ncrs) {
                if (ncr.evidenceImage) ncr.evidenceImage = await resolveUrl(ncr.evidenceImage);
            }
        }

        // Attempt to get client details for address/logo if available
        const client = window.state.clients.find(c => c.name === report.client) || {};
        const clientLogo = client.logoUrl || 'https://via.placeholder.com/150?text=Client+Logo';

        // Get audit plan reference
        const auditPlan = report.planId ? window.DataService.findAuditPlan(report.planId) : null;

        // Enrich report with plan/client data if missing
        if (auditPlan) {
            if (!report.leadAuditor) {
                // Try plan.lead first, then first team member
                if (auditPlan.lead) {
                    const leadAuditor = window.state.auditors?.find(a => String(a.id) === String(auditPlan.lead));
                    report.leadAuditor = leadAuditor ? leadAuditor.name : auditPlan.lead;
                } else if (auditPlan.teamIds?.length) {
                    const leadAuditor = window.state.auditors?.find(a => String(a.id) === String(auditPlan.teamIds[0]));
                    report.leadAuditor = leadAuditor ? leadAuditor.name : '';
                } else if (auditPlan.team?.length) {
                    report.leadAuditor = typeof auditPlan.team[0] === 'object' ? auditPlan.team[0].name : auditPlan.team[0];
                }
            }
            if (!report.auditType) report.auditType = auditPlan.type || auditPlan.auditType || '';
        }
        if (!client.certificationScope) {
            // Pull scope from client certificates siteScopes (Scopes & Certs tab)
            const matchingCert = (client.certificates || []).find(c => (c.standard || '').toLowerCase() === (report.standard || '').toLowerCase());
            if (matchingCert && matchingCert.siteScopes) {
                // Combine all site scopes into one string
                const scopeValues = Object.entries(matchingCert.siteScopes).filter(([k, v]) => v).map(([siteName, scopeText]) => siteName + ': ' + scopeText);
                client.certificationScope = scopeValues.length === 1 ? Object.values(matchingCert.siteScopes)[0] : scopeValues.join('; ') || '';
            }
            if (!client.certificationScope) {
                client.certificationScope = matchingCert?.scope || auditPlan?.scope || client.scope || '';
            }
            // Final fallback: build scope from goodsServices
            if (!client.certificationScope && client.goodsServices && client.goodsServices.length > 0) {
                client.certificationScope = client.goodsServices.map(g => g.name + (g.description ? ': ' + g.description : '')).join(', ');
            }
        }

        // QR Code for Report Verification
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent('https://audit.companycertification.com/#/verify/' + report.id)}`;

        // CB Settings (real data, no fake info)
        const cbSettings = window.state.cbSettings || {};
        const cbSite = (cbSettings.cbSites || [])[0] || {};

        // Calculate stats
        const totalItems = hydratedProgress.length;
        const ncItems = hydratedProgress.filter(i => i.status === 'nc');
        const conformityItems = hydratedProgress.filter(i => i.status === 'conform');
        const naItems = hydratedProgress.filter(i => i.status === 'na');
        const majorNC = ncItems.filter(i => (i.ncrType || '').toLowerCase() === 'major').length;
        const minorNC = ncItems.filter(i => (i.ncrType || '').toLowerCase() === 'minor').length;
        const observationCount = ncItems.filter(i => (i.ncrType || '').toLowerCase() === 'observation').length;
        const ofiCount = ncItems.filter(i => (i.ncrType || '').toLowerCase() === 'ofi').length;
        // Actual NC count = only major + minor (excludes observations & OFIs)
        const actualNCCount = majorNC + minorNC;
        // OBS/OFI combined count
        const obsOfiCount = observationCount + ofiCount;

        // NC breakdown by clause group (for bar chart)
        const ncByClause = {};
        ncItems.forEach(item => {
            const g = (item.clause || '').split('.')[0] || '?';
            ncByClause[g] = (ncByClause[g] || 0) + 1;
        });

        // Store data for preview & export
        window._reportPreviewData = {
            report, hydratedProgress, client, auditPlan, cbSettings, cbSite,
            clientLogo: client.logoUrl || '',
            cbLogo: cbSettings.logoUrl || '',
            qrCodeUrl,
            stats: { totalItems, ncCount: ncItems.length, actualNCCount, conformCount: conformityItems.length, naCount: naItems.length, majorNC, minorNC, observationCount, ofiCount, obsOfiCount, ncByClause },
            today: new Date().toLocaleDateString()
        };

        // Show Report Preview & Edit modal
        window.showReportPreviewModal();

    };

    // ============================================
    // REPORT PREVIEW & EDIT MODAL
    // ============================================
    window.showReportPreviewModal = function () {
        const d = window._reportPreviewData;
        if (!d) return;

        // Remove existing overlay
        const existing = document.getElementById('report-preview-overlay');
        if (existing) existing.remove();

        const sections = [
            { id: 'audit-info', label: 'Audit Info', icon: 'fa-clipboard-list', color: '#2563eb' },
            { id: 'objectives', label: 'Objectives & Methodology', icon: 'fa-bullseye', color: '#0891b2' },
            { id: 'summary', label: 'Summary', icon: 'fa-file-lines', color: '#059669' },
            { id: 'charts', label: 'Charts', icon: 'fa-chart-pie', color: '#7c3aed' },
            { id: 'conformance', label: 'Conformance', icon: 'fa-circle-check', color: '#059669' },
            { id: 'prev-findings', label: 'Prev Findings', icon: 'fa-history', color: '#6366f1' },
            { id: 'obs', label: 'Observations', icon: 'fa-eye', color: '#8b5cf6' },
            { id: 'ofi', label: 'OFI', icon: 'fa-lightbulb', color: '#06b6d4' },
            { id: 'findings', label: 'Findings', icon: 'fa-triangle-exclamation', color: '#dc2626' },
            { id: 'ncrs', label: 'NCRs', icon: 'fa-clipboard-check', color: '#ea580c' },
            { id: 'corrective', label: 'Corrective Actions', icon: 'fa-wrench', color: '#be185d' },
            { id: 'meetings', label: 'Meetings', icon: 'fa-handshake', color: '#0891b2' },
            { id: 'changes', label: 'Changes', icon: 'fa-clock-rotate-left', color: '#78716c' },
            { id: 'conclusion', label: 'Conclusion', icon: 'fa-gavel', color: '#4338ca' },
            { id: 'signature', label: 'Signature', icon: 'fa-signature', color: '#1e293b' },
            { id: 'distribution', label: 'Distribution', icon: 'fa-share-nodes', color: '#0d9488' },
            { id: 'annexures', label: 'Annexures', icon: 'fa-paperclip', color: '#9333ea' }
        ];

        window._reportSectionState = {};
        sections.forEach(s => { window._reportSectionState[s.id] = !s.hide; });

        const pill = (s) => `<label class="rp-pill ${s.hide ? '' : 'active'}" id="pill-${s.id}" style="${s.hide ? 'background:white;color:#94a3b8;border-color:#cbd5e1;' : 'background:' + s.color + ';border-color:' + s.color + ';color:white;'}" data-action="toggleReportSection" data-arg1="${s.id}" data-arg2="${s.color}"><i class="fa-solid ${s.icon}"></i> ${s.label}</label>`;

        // Helper: render all evidence images for a checklist item (preview mode)
        const renderEvThumbs = (item) => {
            const imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
            if (!imgs.length) return '';
            return `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${imgs.map(url => `<img src="${url}" style="height:50px;border-radius:4px;border:1px solid #e2e8f0;cursor:pointer;" data-action="open" data-arg1="${url}" data-arg2="_blank">`).join('')}</div>`;
        };

        const ncRows = d.hydratedProgress.filter(i => i.status === 'nc' && i.ncrType && i.ncrType.toLowerCase() !== 'observation' && i.ncrType.toLowerCase() !== 'ofi').map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            const sev = item.ncrType || 'NC';
            const sevStyle = sev === 'Major' ? 'background:#fee2e2;color:#991b1b' : 'background:#fef3c7;color:#92400e';
            return `<tr style="background:${idx % 2 ? '#f8fafc' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;${sevStyle};">${sev}</span></td><td style="padding:10px 14px;color:#334155;">${item.comment || '<span style="color:#94a3b8;">No remarks</span>'}${renderEvThumbs(item)}</td></tr>`;
        }).join('');

        // OBS rows (Observations only)
        const obsOnlyRows = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() === 'observation').map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return `<tr style="background:${idx % 2 ? '#f5f3ff' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#ede9fe;color:#6d28d9;">OBS</span></td><td style="padding:10px 14px;color:#334155;">${item.comment || '<span style="color:#94a3b8;">No remarks</span>'}${renderEvThumbs(item)}</td></tr>`;
        }).join('');

        // OFI rows (Opportunities for Improvement only)
        const ofiOnlyRows = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() === 'ofi').map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return `<tr style="background:${idx % 2 ? '#f0fbff' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#e0f7fa;color:#0891b2;">OFI</span></td><td style="padding:10px 14px;color:#334155;">${item.comment || '<span style="color:#94a3b8;">No remarks</span>'}${renderEvThumbs(item)}</td></tr>`;
        }).join('');

        // Conformance rows (items with comments or evidence)
        const conformRows = d.hydratedProgress.filter(i => i.status === 'conform').map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return `<tr style="background:${idx % 2 ? '#f0fdf4' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#dcfce7;color:#166534;"><i class="fa-solid fa-check" style="margin-right:4px;"></i>Conform</span></td><td style="padding:10px 14px;color:#334155;">${item.comment || '<span style="color:#94a3b8;">No remarks</span>'}${renderEvThumbs(item)}</td></tr>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.id = 'report-preview-overlay';
        overlay.innerHTML = `
        <style>
            #report-preview-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:rgba(15,23,42,0.7);display:flex;justify-content:center;padding:16px;backdrop-filter:blur(4px);}
            .rp-modal{background:#f8fafc;border-radius:16px;width:100%;max-width:1100px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.3);}
            .rp-header{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:20px 28px;}
            .rp-pills{padding:12px 28px;background:white;border-bottom:1px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
            .rp-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 14px;border-radius:20px;font-size:0.8rem;font-weight:600;cursor:pointer;border:2px solid;transition:all 0.2s;user-select:none;}
            .rp-content{flex:1;overflow-y:auto;padding:16px 28px;}
            .rp-sec{background:white;border-radius:10px;margin-bottom:14px;border:1px solid #e2e8f0;overflow:hidden;}
            .rp-sec-hdr{display:flex;align-items:center;padding:11px 16px;cursor:pointer;gap:10px;font-weight:600;color:white;font-size:0.92rem;}
            .rp-sec-body{padding:14px 16px;border-top:1px solid #e2e8f0;}
            .rp-sec-body.collapsed{display:none;}
            .rp-footer{padding:14px 28px;background:white;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;}
            .rp-edit{min-height:60px;line-height:1.7;color:#334155;outline:none;padding:8px;border:1px dashed transparent;border-radius:6px;cursor:text;}
            .rp-edit:hover{border-color:#cbd5e1;background:#f8fafc;}
            .rp-edit:focus{border-color:#2563eb;background:#f8fafc;}
        </style>
        <div class="rp-modal">
            <div class="rp-header">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h2 style="margin:0 0 4px;font-size:1.25rem;"><i class="fa-solid fa-file-pdf" style="margin-right:8px;"></i>Report Preview & Edit</h2>
                        <div style="opacity:0.8;font-size:0.88rem;">${d.report.client} — ${d.report.standard || 'ISO Standard'}</div>
                    </div>
                    <button data-action="removeElement" data-id="report-preview-overlay" style="background:rgba(255,255,255,0.15);border:none;color:white;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1rem;" aria-label="Close"><i class="fa-solid fa-times"></i></button>
                </div>
            </div>
            <div class="rp-pills">
                <span style="font-size:0.78rem;color:#64748b;font-weight:600;margin-right:4px;">INCLUDE:</span>
                ${sections.map(s => pill(s)).join('')}
                <div style="flex:1;"></div>
                <button data-action="expandAllSections" style="padding:4px 10px;font-size:0.75rem;border:1px solid #cbd5e1;background:white;border-radius:6px;cursor:pointer;">Expand All</button>
                <button data-action="collapseAllSections" style="padding:4px 10px;font-size:0.75rem;border:1px solid #cbd5e1;background:white;border-radius:6px;cursor:pointer;">Collapse All</button>
            </div>
            <div class="rp-content">
                <!-- COVER PAGE -->
                <div style="background:white;border-radius:12px;padding:3rem 2.5rem;margin-bottom:2rem;position:relative;min-height:600px;border:2px solid #e2e8f0;">
                    <!-- CB Branding Header -->
                    <div style="text-align:center;margin-bottom:3rem;">
                        ${d.cbLogo ? `
                        <img src="${d.cbLogo}" alt="CB Logo" style="height:80px;object-fit:contain;margin-bottom:1rem;">
                        ` : `
                        <div style="width:80px;height:80px;margin:0 auto 1rem;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(37,99,235,0.3);">
                            <i class="fa-solid fa-certificate" style="color:white;font-size:2.5rem;"></i>
                        </div>
                        `}
                        <h1 style="margin:0 0 0.5rem;font-size:1.8rem;color:#1e293b;font-weight:700;">${d.cbName || 'Audit360 Suite'}</h1>
                        <div style="font-size:0.95rem;color:#64748b;font-weight:500;">ISO Certification Body</div>
                        <div style="width:60px;height:3px;background:linear-gradient(90deg,#2563eb,#7c3aed);margin:1.5rem auto;border-radius:2px;"></div>
                    </div>
                    
                    <!-- Report Title -->
                    <div style="text-align:center;margin-bottom:3rem;">
                        <div style="font-size:0.85rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:0.75rem;">Audit Report</div>
                        <h2 style="margin:0 0 1rem;font-size:2rem;color:#0f172a;font-weight:800;line-height:1.3;">${d.report.client}</h2>
                        <div style="display:inline-block;padding:8px 20px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:2px solid #3b82f6;border-radius:25px;color:#1e40af;font-weight:700;font-size:1rem;">
                            ${d.report.standard || 'ISO Standard'}
                        </div>
                    </div>
                    
                    <!-- Client Logo -->
                    <div style="text-align:center;margin:2rem 0;">
                        ${d.clientLogo ? `
                        <img src="${d.clientLogo}" alt="Client Logo" style="height:100px;object-fit:contain;">
                        ` : `
                        <div style="width:120px;height:120px;margin:0 auto;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.5rem;">
                            <i class="fa-solid fa-building" style="font-size:2rem;color:#94a3b8;"></i>
                            <div style="font-size:0.7rem;color:#94a3b8;font-weight:600;">Client Logo</div>
                        </div>
                        `}
                    </div>
                    
                    <!-- Audit Details Grid -->
                    <div style="margin:3rem 0;background:#f8fafc;padding:2rem;border-radius:12px;border-left:4px solid #2563eb;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Type</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;">${d.auditPlan?.type || 'Certification Audit'}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Date</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;">${d.report.date || 'N/A'}${d.report.endDate ? ' — ' + d.report.endDate : ''}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Lead Auditor</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;">${d.report.leadAuditor || 'N/A'}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Report ID</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;font-family:monospace;">#${d.report.id.substring(0, 10)}</div>
                            </div>
                            ${d.auditPlan?.team && d.auditPlan.team.length > 1 ? `
                            <div style="grid-column:span 2;">
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Team</div>
                                <div style="font-size:0.95rem;color:#1e293b;font-weight:600;">${d.auditPlan.team.join(', ')}</div>
                            </div>` : ''}
                            ${d.auditPlan?.scope ? `
                            <div style="grid-column:span 2;">
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Scope</div>
                                <div style="font-size:0.9rem;color:#334155;line-height:1.5;">${typeof d.auditPlan.scope === 'string' ? d.auditPlan.scope : (d.client?.goodsServices || []).map(g => g.name).join(', ') || 'As per certification scope'}</div>
                            </div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Document Control Footer -->
                    <div style="position:absolute;bottom:2rem;left:2.5rem;right:2.5rem;border-top:2px solid #e2e8f0;padding-top:1.5rem;">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;font-size:0.8rem;color:#64748b;">
                            <div>
                                <strong style="color:#1e293b;">Document ID:</strong> RPT-${d.report.id.substring(0, 8)}
                            </div>
                            <div style="text-align:center;">
                                <strong style="color:#1e293b;">Status:</strong> ${d.report.recommendation || 'Draft'}
                            </div>
                            <div style="text-align:right;">
                                <strong style="color:#1e293b;">Classification:</strong> Confidential
                            </div>
                        </div>
                        <div style="margin-top:1rem;">
                            <div style="font-size:0.75rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;">Document Revision History</div>
                            <table style="width:100%;font-size:0.75rem;border-collapse:collapse;">
                                <thead><tr style="background:#f1f5f9;"><th style="padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Ver</th><th style="padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Date</th><th style="padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Author</th><th style="padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Description</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;" contenteditable="true">1.0</td><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;" contenteditable="true">${d.report.date || new Date().toLocaleDateString('en-GB')}</td><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;" contenteditable="true">${d.report.leadAuditor || 'Lead Auditor'}</td><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;" contenteditable="true">Initial issue — Draft for review</td></tr>
                                    <tr><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;" contenteditable="true"></td><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;" contenteditable="true"></td><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;" contenteditable="true"></td><td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;" contenteditable="true"></td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div style="margin-top:0.75rem;padding:0.75rem;background:#fef3c7;border-radius:6px;text-align:center;font-size:0.75rem;color:#92400e;">
                            <i class="fa-solid fa-lock" style="margin-right:0.25rem;"></i>
                            <strong>Confidential Document</strong> — For authorized use only. This report is the property of ${d.cbName || 'the Certification Body'}.
                        </div>
                    </div>
                </div>
                
                <!-- Report Sections -->
                <!-- 1: Audit Info -->
                <div class="rp-sec" id="sec-audit-info">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">1</span>AUDIT INFORMATION<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <table style="width:100%;font-size:0.86rem;border-collapse:collapse;">
                            <tr><td style="padding:7px 12px;width:35%;color:#64748b;font-weight:600;">Client</td><td style="padding:7px 12px;">${d.report.client}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Industry</td><td style="padding:7px 12px;">${d.client.industry || 'N/A'}</td></tr>
                            <tr><td style="padding:7px 12px;color:#64748b;font-weight:600;">Certification Scope</td><td style="padding:7px 12px;">${d.client.certificationScope || 'N/A'}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Standard</td><td style="padding:7px 12px;">${d.report.standard || d.auditPlan?.standard || 'N/A'}</td></tr>
                            <tr><td style="padding:7px 12px;color:#64748b;font-weight:600;">Audit Type</td><td style="padding:7px 12px;">${d.auditPlan?.auditType || 'Initial'}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Dates</td><td style="padding:7px 12px;">${d.report.date || 'N/A'} ${d.report.endDate ? '→ ' + d.report.endDate : ''}</td></tr>
                            <tr><td style="padding:7px 12px;color:#64748b;font-weight:600;">Lead Auditor</td><td style="padding:7px 12px;">${d.report.leadAuditor || 'N/A'}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Location</td><td style="padding:7px 12px;">${[d.client.address, d.client.city, d.client.province, d.client.country].filter(Boolean).join(', ') || 'N/A'}</td></tr>
                ${(() => {
                const locAddr = [d.client.address, d.client.city, d.client.province, d.client.country].filter(Boolean).join(', ');
                const addrFallback = locAddr ? `<div style="padding:16px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;text-align:center;"><i class="fa-solid fa-map-location-dot" style="font-size:1.5rem;color:#64748b;margin-bottom:6px;display:block;"></i><div style="color:#334155;font-size:0.9rem;font-weight:600;">${locAddr}</div></div>` : '';
                if (d.client.latitude && d.client.longitude) {
                    return `<tr><td colspan="2" style="padding:8px 12px;"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${(parseFloat(d.client.longitude) - 0.015).toFixed(4)},${(parseFloat(d.client.latitude) - 0.008).toFixed(4)},${(parseFloat(d.client.longitude) + 0.015).toFixed(4)},${(parseFloat(d.client.latitude) + 0.008).toFixed(4)}&layer=mapnik&marker=${d.client.latitude},${d.client.longitude}" style="width:100%;height:140px;border:none;border-radius:8px;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"></iframe><div style="display:none;">${addrFallback}</div></td></tr>`;
                }
                if (locAddr) {
                    return `<tr><td colspan="2" style="padding:8px 12px;">${addrFallback}</td></tr>`;
                }
                return '';
            })()}
                        </table>
                    </div>
                </div>
                <!-- Objectives, Criteria & Methodology (from Plan) -->
                <div class="rp-sec" id="sec-objectives">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#0891b2,#0e7490);" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">2</span>AUDIT OBJECTIVES, CRITERIA & METHODOLOGY<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;" title="Click to edit"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5rem;">
                            <div>
                                <h4 style="margin:0 0 0.75rem;font-size:0.9rem;color:#0891b2;"><i class="fa-solid fa-bullseye" style="margin-right:0.4rem;"></i>Audit Objectives</h4>
                                <div id="rp-objectives" class="rp-edit" contenteditable="true" style="white-space:pre-line;line-height:1.7;font-size:0.88rem;">${d.auditPlan?.auditObjectives || '• Determine conformity of the management system with audit criteria\n• Evaluate the ability of the management system to ensure compliance with statutory, regulatory and contractual requirements\n• Evaluate the effectiveness of the management system in meeting its specified objectives\n• Identify areas for potential improvement of the management system'}</div>
                            </div>
                            <div>
                                <h4 style="margin:0 0 0.75rem;font-size:0.9rem;color:#6366f1;"><i class="fa-solid fa-scale-balanced" style="margin-right:0.4rem;"></i>Audit Criteria</h4>
                                <div id="rp-criteria" class="rp-edit" contenteditable="true" style="white-space:pre-line;line-height:1.7;font-size:0.88rem;">${d.auditPlan?.auditCriteria || '• ' + (d.report.standard || 'Applicable ISO standard(s)') + '\n• Organization management system documentation\n• Applicable legal and regulatory requirements\n• Previous audit findings and corrective action records'}</div>
                            </div>
                            <div>
                                <h4 style="margin:0 0 0.75rem;font-size:0.9rem;color:#0d9488;"><i class="fa-solid fa-microscope" style="margin-right:0.4rem;"></i>Audit Methodology</h4>
                                <div id="rp-methodology" class="rp-edit" contenteditable="true" style="white-space:pre-line;line-height:1.7;font-size:0.88rem;">${d.auditPlan?.auditMethodology || '• Risk-based sampling of processes, records, and documentation\n• Interviews with management and operational personnel at all levels\n• Observation of activities and work environment on-site\n• Review of documented information and objective evidence\n• Verification of corrective actions from previous audits'}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- 2: Exec Summary -->
                <div class="rp-sec" id="sec-summary">
                    <div class="rp-sec-hdr" style="border-left-color:#059669;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">2</span>EXECUTIVE SUMMARY<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;" title="Click to edit"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div id="rp-exec-summary" class="rp-edit" contenteditable="true">${d.report.executiveSummary || '<em style="color:#94a3b8;">Click to add executive summary...</em>'}</div>
                        
                        <!-- AI-Visual Insights Section -->
                        ${(d.report.positiveObservations || d.report.ofi) ? `
                        <div style="margin-top:2rem;padding:1.5rem;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:12px;border:2px solid #0ea5e9;">
                            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
                                <div style="width:48px;height:48px;background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:12px;display:flex;align-items:center;justify-content:center;">
                                    <i class="fa-solid fa-brain" style="color:white;font-size:1.5rem;"></i>
                                </div>
                                <div>
                                    <h3 style="margin:0;color:#075985;font-size:1.1rem;">AI-Powered Audit Insights</h3>
                                    <div style="color:#0c4a6e;font-size:0.85rem;opacity:0.8;">Analysis for ${d.report.client} — ${d.report.standard || 'ISO Audit'}</div>
                                </div>
                            </div>
                            
                            <!-- Risk & Compliance Dashboard -->
                            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;">
                                <!-- Overall Risk Score -->
                                <div style="text-align:center;padding:1rem;background:white;border-radius:10px;border-left:4px solid ${d.stats.ncCount === 0 ? '#10b981' : d.stats.ncCount <= 2 ? '#f59e0b' : '#ef4444'};">
                                    <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Risk Level</div>
                                    <div style="font-size:1.8rem;font-weight:800;color:${d.stats.ncCount === 0 ? '#10b981' : d.stats.ncCount <= 2 ? '#f59e0b' : '#ef4444'};">
                                        ${d.stats.ncCount === 0 ? 'LOW' : d.stats.ncCount <= 2 ? 'MEDIUM' : 'HIGH'}
                                    </div>
                                    <div style="font-size:0.7rem;color:#94a3b8;margin-top:0.25rem;">${d.stats.ncCount} NC Found</div>
                                </div>
                                
                                <!-- Compliance Score -->
                                <div style="text-align:center;padding:1rem;background:white;border-radius:10px;border-left:4px solid #3b82f6;">
                                    <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Compliance</div>
                                    <div style="font-size:1.8rem;font-weight:800;color:#3b82f6;">
                                        ${Math.round((d.stats.conformCount / ((d.stats.totalItems - d.stats.naCount) || 1)) * 100)}%
                                    </div>
                                    <div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;margin-top:0.5rem;overflow:hidden;">
                                        <div style="width:${Math.round((d.stats.conformCount / ((d.stats.totalItems - d.stats.naCount) || 1)) * 100)}%;height:100%;background:linear-gradient(90deg,#3b82f6,#2563eb);border-radius:3px;"></div>
                                    </div>
                                </div>
                                
                                <!-- Client Maturity -->
                                <div style="text-align:center;padding:1rem;background:white;border-radius:10px;border-left:4px solid #8b5cf6;">
                                    <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Maturity</div>
                                    <div style="font-size:1.8rem;font-weight:800;color:#8b5cf6;">
                                        ${d.stats.ncCount === 0 ? '⭐⭐⭐⭐⭐' : d.stats.ncCount <= 2 ? '⭐⭐⭐⭐' : d.stats.ncCount <= 5 ? '⭐⭐⭐' : '⭐⭐'}
                                    </div>
                                    <div style="font-size:0.7rem;color:#94a3b8;margin-top:0.25rem;">${d.stats.ncCount === 0 ? 'Excellent' : d.stats.ncCount <= 2 ? 'Good' : d.stats.ncCount <= 5 ? 'Developing' : 'Early Stage'}</div>
                                </div>
                            </div>
                            
                            <!-- Positive Observations (Icon Cards) -->
                            ${d.report.positiveObservations ? `
                            <div style="background:white;padding:1.25rem;border-radius:10px;margin-bottom:1rem;border-left:4px solid #10b981;">
                                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                                    <i class="fa-solid fa-circle-check" style="color:#10b981;font-size:1.25rem;"></i>
                                    <h4 style="margin:0;color:#166534;font-size:1rem;">Strengths Identified</h4>
                                </div>
                                <div id="rp-positive-obs" class="rp-edit" contenteditable="true" style="color:#15803d;font-size:0.9rem;line-height:1.7;">
                                    ${(function () {
                        let t = d.report.positiveObservations;
                        let items = [];
                        if (t.includes('\n')) {
                            items = t.split(/\n+/).map(s => s.replace(/^\s*\d+[\.)\-]\s*/, '').trim()).filter(Boolean);
                        } else {
                            // Flat text: split on sequential "N. " at sentence boundaries
                            let parts = t.match(/(?:^|(?<=\.\s))\d+\.\s[\s\S]*?(?=(?:\.\s)\d+\.\s|$)/g);
                            if (parts && parts.length > 1) {
                                items = parts.map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
                            } else {
                                items = [t.replace(/^\s*\d+\.\s*/, '').trim()];
                            }
                        }
                        return items.map((obs, idx) => `
                                        <div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;align-items:start;">
                                            <div style="min-width:32px;height:32px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem;">${idx + 1}</div>
                                            <div style="flex:1;padding-top:0.25rem;">${obs}</div>
                                        </div>
                                        `).join('');
                    })()}
                                </div>
                            </div>
                            ` : ''}
                            
                            <!-- Opportunities for Improvement (Icon Cards) -->
                            ${d.report.ofi ? `
                            <div style="background:white;padding:1.25rem;border-radius:10px;border-left:4px solid #f59e0b;">
                                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                                    <i class="fa-solid fa-lightbulb" style="color:#f59e0b;font-size:1.25rem;"></i>
                                    <h4 style="margin:0;color:#854d0e;font-size:1rem;">Improvement Opportunities</h4>
                                </div>
                                <div id="rp-ofi" class="rp-edit" contenteditable="true" style="color:#92400e;font-size:0.9rem;line-height:1.7;">
                                    ${(function () {
                        let t = d.report.ofi;
                        let items = [];
                        if (Array.isArray(t)) {
                            items = t;
                        } else if (t.includes('\n')) {
                            items = t.split(/\n+/).map(s => s.replace(/^\s*\d+[\.)\-]\s*/, '').trim()).filter(Boolean);
                        } else {
                            let parts = t.match(/(?:^|(?<=\.\s))\d+\.\s[\s\S]*?(?=(?:\.\s)\d+\.\s|$)/g);
                            if (parts && parts.length > 1) {
                                items = parts.map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
                            } else {
                                items = [t.replace(/^\s*\d+\.\s*/, '').trim()];
                            }
                        }
                        return items.map((ofi, idx) => `
                                        <div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;align-items:start;">
                                            <div style="min-width:32px;height:32px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem;">
                                                <i class="fa-solid fa-arrow-up" style="font-size:0.75rem;"></i>
                                            </div>
                                            <div style="flex:1;padding-top:0.25rem;">${typeof ofi === 'string' ? ofi : ofi}</div>
                                        </div>
                                        `).join('');
                    })()}
                                </div>
                            </div>
                            ` : ''}
                            
                            <!-- AI Confidence Footer -->
                            <div style="margin-top:1rem;padding:0.75rem;background:rgba(255,255,255,0.6);border-radius:8px;text-align:center;">
                                <div style="font-size:0.75rem;color:#64748b;">
                                    <i class="fa-solid fa-robot" style="margin-right:0.25rem;"></i>
                                    AI-Powered Analysis • Client Context: ${d.report.client} • Standard: ${d.report.standard || 'ISO'}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <!-- 3: Analytics & Insights -->
                <div class="rp-sec" id="sec-charts">
                    <div class="rp-sec-hdr" style="border-left-color:#7c3aed;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">3</span>ANALYTICS & INSIGHTS<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <!-- KPI Metrics Dashboard -->
                        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:2rem;">
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${Math.round((d.stats.conformCount / ((d.stats.totalItems - d.stats.naCount) || 1)) * 100)}%</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">COMPLIANCE RATE</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.majorNC}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">MAJOR NC</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.minorNC}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">MINOR NC</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.observationCount}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">OBSERVATIONS</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#06b6d4,#0891b2);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.ofiCount}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">OFI</div>
                            </div>
                            <div style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,#64748b,#475569);border-radius:10px;color:white;">
                                <div style="font-size:2rem;font-weight:800;">${d.stats.totalItems}</div>
                                <div style="font-size:0.72rem;font-weight:600;opacity:0.9;">TOTAL CHECKS</div>
                            </div>
                        </div>
                        
                        <!-- Charts Grid -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;">Compliance Distribution</h4>
                                <canvas id="compliance-pie-chart" style="max-height:250px;"></canvas>
                            </div>
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;">Severity Breakdown</h4>
                                <canvas id="severity-bar-chart" style="max-height:250px;"></canvas>
                            </div>
                        </div>
                        
                        <!-- Findings by Main Clause Chart -->
                        <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                            <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;">Findings by ISO Clause (Main Clauses)</h4>
                            <canvas id="clause-findings-chart" style="max-height:300px;"></canvas>
                        </div>
                        
                        <!-- Department-based Analysis Chart -->
                        <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;margin-top:1.5rem;">
                            <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;"><i class="fa-solid fa-building" style="margin-right:0.5rem;color:#6366f1;"></i>Findings by Department</h4>
                            <canvas id="dept-findings-chart" style="max-height:300px;"></canvas>
                        </div>
                        
                        <!-- Personnel Workload & Department Compliance Charts -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.5rem;">
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;"><i class="fa-solid fa-user-tie" style="margin-right:0.5rem;color:#ea580c;"></i>Personnel Workload</h4>
                                <canvas id="personnel-workload-chart" style="max-height:250px;"></canvas>
                            </div>
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;"><i class="fa-solid fa-chart-radar" style="margin-right:0.5rem;color:#0891b2;"></i>Compliance by Department</h4>
                                <canvas id="dept-compliance-radar" style="max-height:250px;"></canvas>
                            </div>
                        </div>
                        
                        <!-- Department Summary Table -->
                        <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;margin-top:1.5rem;">
                            <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;"><i class="fa-solid fa-table-cells" style="margin-right:0.5rem;color:#7c3aed;"></i>Department Summary</h4>
                            <table style="width:100%;font-size:0.82rem;border-collapse:collapse;">
                                <thead><tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Department</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Personnel</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Items</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Conform</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">NC</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Compliance %</th></tr></thead>
                                <tbody>${(() => {
                const deptMap = {};
                d.hydratedProgress.forEach(i => {
                    const dept = i.department || 'Unassigned';
                    if (!deptMap[dept]) deptMap[dept] = { personnel: new Set(), items: 0, conform: 0, nc: 0 };
                    if (i.personnel) deptMap[dept].personnel.add(i.personnel);
                    deptMap[dept].items++;
                    if (i.status === 'conform') deptMap[dept].conform++;
                    else if (i.status === 'nc') deptMap[dept].nc++;
                });
                return Object.entries(deptMap).sort((a, b) => a[0].localeCompare(b[0])).map(([dept, data]) => {
                    const compPct = data.items > 0 ? Math.round((data.conform / data.items) * 100) : 0;
                    const pctColor = compPct >= 80 ? '#16a34a' : compPct >= 50 ? '#d97706' : '#dc2626';
                    return '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 12px;font-weight:500;">' + dept + '</td><td style="padding:8px 12px;text-align:center;">' + data.personnel.size + '</td><td style="padding:8px 12px;text-align:center;">' + data.items + '</td><td style="padding:8px 12px;text-align:center;color:#16a34a;font-weight:600;">' + data.conform + '</td><td style="padding:8px 12px;text-align:center;color:#dc2626;font-weight:600;">' + data.nc + '</td><td style="padding:8px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:20px;font-weight:700;font-size:0.78rem;background:' + pctColor + '15;color:' + pctColor + ';">' + compPct + '%</span></td></tr>';
                }).join('');
            })()}</tbody>
                            </table>
                        </div>
                        
                        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
                        <script>
                        (function() {
                            // Wait for Chart.js to load
                            setTimeout(() => {
                                if (typeof Chart === 'undefined') {
                                    console.error('Chart.js failed to load');
                                    return;
                                }
                                
                                // 1. Compliance Pie Chart — 5 slices
                                const pieCtx = document.getElementById('compliance-pie-chart');
                                if (pieCtx) {
                                    new Chart(pieCtx.getContext('2d'), {
                                        type: 'doughnut',
                                        data: {
                                            labels: ['Conforming', 'Major NC', 'Minor NC', 'OBS / OFI', 'N/A'],
                                            datasets: [{
                                                data: [${d.stats.conformCount}, ${d.stats.majorNC}, ${d.stats.minorNC}, ${d.stats.observationCount + d.stats.ofiCount}, ${d.stats.naCount}],
                                                backgroundColor: ['#10b981', '#dc2626', '#f59e0b', '#8b5cf6', '#94a3b8'],
                                                borderWidth: 2,
                                                borderColor: '#ffffff'
                                            }]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            cutout: '55%',
                                            plugins: {
                                                legend: { 
                                                    position: 'bottom',
                                                    labels: { font: { size: 11 }, padding: 10, usePointStyle: true, pointStyle: 'circle' }
                                                },
                                                tooltip: {
                                                    callbacks: {
                                                        label: (context) => {
                                                            const total = ${d.stats.totalItems};
                                                            const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
                                                            return context.label + ': ' + context.parsed + ' (' + pct + '%)';
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    });
                                }
                                
                                // 2. Severity Bar Chart — 4 categories
                                const sevCtx = document.getElementById('severity-bar-chart');
                                if (sevCtx) {
                                    new Chart(sevCtx.getContext('2d'), {
                                        type: 'bar',
                                        data: {
                                            labels: ['Major NC', 'Minor NC', 'Observations', 'OFI'],
                                            datasets: [{
                                                label: 'Count',
                                                data: [${d.stats.majorNC}, ${d.stats.minorNC}, ${d.stats.observationCount}, ${d.stats.ofiCount}],
                                                backgroundColor: ['#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4'],
                                                borderWidth: 0,
                                                borderRadius: 6
                                            }]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                                legend: { display: false }
                                            },
                                            scales: {
                                                y: { 
                                                    beginAtZero: true,
                                                    ticks: { stepSize: 1 }
                                                }
                                            }
                                        }
                                    });
                                }
                                
                                // 3. Findings by Main Clause Chart
                                const clauseCtx = document.getElementById('clause-findings-chart');
                                if (clauseCtx) {
                                    // Group findings by main clause (e.g., 4.x -> 4, 5.x -> 5)
                                    const clauseData = {};
                                    const allItems = ${JSON.stringify(d.hydratedProgress.map(i => ({
                clause: i.kbMatch?.clause || i.clause || 'N/A',
                status: i.status,
                ncrType: (i.ncrType || '').toLowerCase()
            })))};
                                    
                                    allItems.forEach(item => {
                                        const mainClause = item.clause.split('.')[0]; // Extract main clause (e.g., "4" from "4.1.2")
                                        if (!clauseData[mainClause]) {
                                            clauseData[mainClause] = { major: 0, minor: 0, obs: 0, ofi: 0, ok: 0 };
                                        }
                                        
                                        if (item.status === 'nc') {
                                            if (item.ncrType === 'major') clauseData[mainClause].major++;
                                            else if (item.ncrType === 'minor') clauseData[mainClause].minor++;
                                            else if (item.ncrType === 'ofi') clauseData[mainClause].ofi++;
                                            else clauseData[mainClause].obs++;
                                        } else if (item.status === 'conform') {
                                            clauseData[mainClause].ok++;
                                        }
                                    });
                                    
                                    // Sort clauses numerically
                                    const sortedClauses = Object.keys(clauseData).sort((a, b) => {
                                        const numA = parseInt(a, 10) || 999;
                                        const numB = parseInt(b, 10) || 999;
                                        return numA - numB;
                                    });
                                    
                                    new Chart(clauseCtx.getContext('2d'), {
                                        type: 'bar',
                                        data: {
                                            labels: sortedClauses.map(c => 'Clause ' + c),
                                            datasets: [
                                                {
                                                    label: 'Major NC',
                                                    data: sortedClauses.map(c => clauseData[c].major),
                                                    backgroundColor: '#dc2626',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'Minor NC',
                                                    data: sortedClauses.map(c => clauseData[c].minor),
                                                    backgroundColor: '#f59e0b',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'Observations',
                                                    data: sortedClauses.map(c => clauseData[c].obs),
                                                    backgroundColor: '#8b5cf6',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'OFI',
                                                    data: sortedClauses.map(c => clauseData[c].ofi),
                                                    backgroundColor: '#06b6d4',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'Conforming',
                                                    data: sortedClauses.map(c => clauseData[c].ok),
                                                    backgroundColor: '#10b981',
                                                    stack: 'findings'
                                                }
                                            ]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                                legend: { 
                                                    position: 'bottom',
                                                    labels: { font: { size: 11 }, padding: 10, usePointStyle: true, pointStyle: 'circle' }
                                                },
                                                tooltip: {
                                                    mode: 'index',
                                                    intersect: false
                                                }
                                            },
                                            scales: {
                                                x: { stacked: true },
                                                y: { 
                                                    stacked: true,
                                                    beginAtZero: true,
                                                    ticks: { stepSize: 1 }
                                                }
                                            }
                                        }
                                    });
                                }

                                // 4. Department-based Chart
                                const deptCtx = document.getElementById('dept-findings-chart');
                                if (deptCtx) {
                                    const deptData = {};
                                    const deptItems = ${JSON.stringify(d.hydratedProgress.map(i => ({
                department: i.department || 'Unassigned',
                status: i.status,
                ncrType: (i.ncrType || '').toLowerCase()
            })))};
                                    deptItems.forEach(item => {
                                        const dept = item.department || 'Unassigned';
                                        if (!deptData[dept]) deptData[dept] = { ok: 0, major: 0, minor: 0, obs: 0, ofi: 0, na: 0 };
                                        if (item.status === 'conform') deptData[dept].ok++;
                                        else if (item.status === 'na') deptData[dept].na++;
                                        else if (item.status === 'nc') {
                                            if (item.ncrType === 'major') deptData[dept].major++;
                                            else if (item.ncrType === 'observation') deptData[dept].obs++;
                                            else if (item.ncrType === 'ofi') deptData[dept].ofi++;
                                            else deptData[dept].minor++;
                                        }
                                    });
                                    const deptLabels = Object.keys(deptData).filter(d => d !== 'Unassigned').sort();
                                    if (deptData['Unassigned'] && (deptData['Unassigned'].ok + deptData['Unassigned'].major + deptData['Unassigned'].minor + deptData['Unassigned'].obs + deptData['Unassigned'].ofi) > 0) {
                                        deptLabels.push('Unassigned');
                                    }
                                    if (deptLabels.length > 0) {
                                        new Chart(deptCtx.getContext('2d'), {
                                            type: 'bar',
                                            data: {
                                                labels: deptLabels,
                                                datasets: [
                                                    { label: 'Conforming', data: deptLabels.map(d => deptData[d].ok), backgroundColor: '#10b981', stack: 'dept' },
                                                    { label: 'Major NC', data: deptLabels.map(d => deptData[d].major), backgroundColor: '#dc2626', stack: 'dept' },
                                                    { label: 'Minor NC', data: deptLabels.map(d => deptData[d].minor), backgroundColor: '#f59e0b', stack: 'dept' },
                                                    { label: 'Observations', data: deptLabels.map(d => deptData[d].obs), backgroundColor: '#8b5cf6', stack: 'dept' },
                                                    { label: 'OFI', data: deptLabels.map(d => deptData[d].ofi), backgroundColor: '#06b6d4', stack: 'dept' }
                                                ]
                                            },
                                            options: {
                                                indexAxis: 'y',
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: {
                                                    legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, usePointStyle: true, pointStyle: 'circle' } }
                                                },
                                                scales: {
                                                    x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
                                                    y: { stacked: true }
                                                }
                                            }
                                        });
                                    } else {
                                        deptCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-building" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>No department data yet. Use AI Auto Map to assign departments.</div>';
                                    }
                                }

                                // 5. Personnel Workload Chart
                                const persCtx = document.getElementById('personnel-workload-chart');
                                if (persCtx) {
                                    const persData = {};
                                    const persItems = ${JSON.stringify(d.hydratedProgress.map(i => ({
                personnel: i.personnel || '',
                status: i.status
            })))};
                                    persItems.forEach(item => {
                                        if (!item.personnel) return;
                                        if (!persData[item.personnel]) persData[item.personnel] = { conform: 0, nc: 0, na: 0 };
                                        if (item.status === 'conform') persData[item.personnel].conform++;
                                        else if (item.status === 'nc') persData[item.personnel].nc++;
                                        else if (item.status === 'na') persData[item.personnel].na++;
                                    });
                                    const persLabels = Object.keys(persData).sort((a, b) => {
                                        const ta = persData[a].conform + persData[a].nc + persData[a].na;
                                        const tb = persData[b].conform + persData[b].nc + persData[b].na;
                                        return tb - ta;
                                    }).slice(0, 10);
                                    if (persLabels.length > 0) {
                                        new Chart(persCtx.getContext('2d'), {
                                            type: 'bar',
                                            data: {
                                                labels: persLabels,
                                                datasets: [
                                                    { label: 'Conform', data: persLabels.map(p => persData[p].conform), backgroundColor: '#10b981', stack: 'pers' },
                                                    { label: 'NC', data: persLabels.map(p => persData[p].nc), backgroundColor: '#ef4444', stack: 'pers' },
                                                    { label: 'N/A', data: persLabels.map(p => persData[p].na), backgroundColor: '#94a3b8', stack: 'pers' }
                                                ]
                                            },
                                            options: {
                                                indexAxis: 'y',
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8, usePointStyle: true, pointStyle: 'circle' } } },
                                                scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, y: { stacked: true, ticks: { font: { size: 10 } } } }
                                            }
                                        });
                                    } else {
                                        persCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-user-tie" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>No personnel data yet. Use AI Auto Map to assign personnel.</div>';
                                    }
                                }

                                // 6. Compliance by Department Radar
                                const radarCtx = document.getElementById('dept-compliance-radar');
                                if (radarCtx) {
                                    const rDeptData = {};
                                    const rItems = ${JSON.stringify(d.hydratedProgress.map(i => ({
                department: i.department || '',
                status: i.status
            })))};
                                    rItems.forEach(item => {
                                        if (!item.department) return;
                                        if (!rDeptData[item.department]) rDeptData[item.department] = { total: 0, conform: 0 };
                                        rDeptData[item.department].total++;
                                        if (item.status === 'conform') rDeptData[item.department].conform++;
                                    });
                                    const rLabels = Object.keys(rDeptData).sort();
                                    if (rLabels.length >= 3) {
                                        new Chart(radarCtx.getContext('2d'), {
                                            type: 'radar',
                                            data: {
                                                labels: rLabels,
                                                datasets: [{
                                                    label: 'Compliance %',
                                                    data: rLabels.map(d => rDeptData[d].total > 0 ? Math.round((rDeptData[d].conform / rDeptData[d].total) * 100) : 0),
                                                    borderColor: '#6366f1',
                                                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                                    borderWidth: 2,
                                                    pointBackgroundColor: '#6366f1',
                                                    pointRadius: 4
                                                }]
                                            },
                                            options: {
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: { legend: { display: false } },
                                                scales: {
                                                    r: {
                                                        beginAtZero: true,
                                                        max: 100,
                                                        ticks: { stepSize: 25, font: { size: 10 }, backdropColor: 'transparent' },
                                                        pointLabels: { font: { size: 10 } },
                                                        grid: { color: '#e2e8f0' },
                                                        angleLines: { color: '#e2e8f0' }
                                                    }
                                                }
                                            }
                                        });
                                    } else {
                                        radarCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-chart-radar" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>Need at least 3 departments for radar chart.</div>';
                                    }
                                }
                            }, 300);
                        })();
                        </script>
                    </div>
                </div>
                <!-- 4: Conformance Verification -->
                <div class="rp-sec" id="sec-conformance">
                    <div class="rp-sec-hdr" style="border-left-color:#10b981;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">4</span>CONFORMANCE VERIFICATION (${d.stats.conformCount})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f0fdf4;"><th style="padding:10px 14px;text-align:left;width:12%;">Clause</th><th style="padding:10px 14px;text-align:left;width:40%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:12%;">Status</th><th style="padding:10px 14px;text-align:left;width:40%;">Evidence & Remarks</th></tr></thead>
                            <tbody>${conformRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No conformance evidence recorded</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
                <!-- Previous Findings Status -->
                <div class="rp-sec" id="sec-prev-findings">
                    <div class="rp-sec-hdr" style="border-left-color:#6366f1;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;"><i class="fa-solid fa-history"></i></span>PREVIOUS FINDINGS STATUS<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        ${(function () {
                            // Look for previous reports for the same client
                            const allReports = window.state?.auditReports || [];
                            const prevReports = allReports
                                .filter(r => r.clientId === d.report.clientId && String(r.id) !== String(d.report.id))
                                .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
                            const prevReport = prevReports[0];
                            if (!prevReport) {
                                return '<div style="text-align:center;padding:20px;color:#94a3b8;"><i class="fa-solid fa-info-circle" style="margin-right:6px;"></i>No previous audit reports found for this client. This section will auto-populate when prior audit data is available.</div>';
                            }
                            // Extract NCs from previous report
                            const prevNCs = (prevReport.checklistProgress || [])
                                .filter(p => p.status === 'nc' && p.ncrType && p.ncrType.toLowerCase() !== 'observation' && p.ncrType.toLowerCase() !== 'ofi');
                            const prevNCRs = prevReport.ncrs || [];
                            if (prevNCs.length === 0 && prevNCRs.length === 0) {
                                return '<div style="padding:12px;background:#f0fdf4;border-radius:8px;color:#166534;"><i class="fa-solid fa-circle-check" style="margin-right:6px;"></i><strong>Previous Audit (' + (prevReport.date || 'N/A') + '):</strong> No non-conformities were raised. Certification was recommended.</div>';
                            }
                            let rows = '';
                            prevNCs.forEach(function (nc, i) {
                                rows += '<tr><td style="font-family:monospace;font-weight:600;color:#6366f1;">PREV-' + (i + 1) + '</td><td>' + (nc.clauseRef || nc.clause || '') + '</td><td><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;' + (nc.ncrType === 'Major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + (nc.ncrType || 'Minor') + '</span></td><td contenteditable="true" style="cursor:text;min-width:150px;">Verified closed — corrective action implemented</td></tr>';
                            });
                            prevNCRs.forEach(function (ncr, i) {
                                rows += '<tr><td style="font-family:monospace;font-weight:600;color:#6366f1;">PREV-' + (prevNCs.length + i + 1) + '</td><td>' + (ncr.clause || '') + '</td><td><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;' + (ncr.type === 'Major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + (ncr.type || 'Minor') + '</span></td><td contenteditable="true" style="cursor:text;min-width:150px;">Verified closed — corrective action implemented</td></tr>';
                            });
                            return '<div style="margin-bottom:12px;padding:10px 14px;background:#eef2ff;border-radius:8px;font-size:0.88rem;color:#3730a3;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:6px;"></i><strong>Previous Audit:</strong> ' + (prevReport.date || 'N/A') + ' | ' + (prevReport.standard || d.report.standard || '') + ' | ' + (prevNCs.length + prevNCRs.length) + ' NC(s) raised</div>'
                                + '<table style="width:100%;font-size:0.84rem;border-collapse:collapse;"><thead><tr style="background:#eef2ff;"><th style="padding:10px 14px;text-align:left;width:12%;">Ref</th><th style="padding:10px 14px;text-align:left;width:20%;">Clause</th><th style="padding:10px 14px;text-align:left;width:12%;">Type</th><th style="padding:10px 14px;text-align:left;width:56%;">Follow-up Status (click to edit)</th></tr></thead><tbody>' + rows + '</tbody></table>';
                        })()}
                    </div>
                </div>
                <!-- 5: Observations -->
                ${obsOnlyRows ? `
                <div class="rp-sec" id="sec-obs">
                    <div class="rp-sec-hdr" style="border-left-color:#7c3aed;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">5</span>OBSERVATIONS (${d.stats.observationCount})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f5f3ff;"><th style="padding:10px 14px;text-align:left;width:12%;">Clause</th><th style="padding:10px 14px;text-align:left;width:40%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:12%;">Type</th><th style="padding:10px 14px;text-align:left;width:40%;">Details</th></tr></thead>
                            <tbody>${obsOnlyRows}</tbody>
                        </table>
                    </div>
                </div>` : ''}
                <!-- 6: OFI -->
                ${ofiOnlyRows ? `
                <div class="rp-sec" id="sec-ofi">
                    <div class="rp-sec-hdr" style="border-left-color:#06b6d4;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">6</span>OPPORTUNITIES FOR IMPROVEMENT (${d.stats.ofiCount})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#ecfeff;"><th style="padding:10px 14px;text-align:left;width:12%;">Clause</th><th style="padding:10px 14px;text-align:left;width:40%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:12%;">Type</th><th style="padding:10px 14px;text-align:left;width:40%;">Recommendation</th></tr></thead>
                            <tbody>${ofiOnlyRows}</tbody>
                        </table>
                    </div>
                </div>` : ''}
                <!-- 7: Findings -->
                <div class="rp-sec" id="sec-findings">
                    <div class="rp-sec-hdr" style="border-left-color:#dc2626;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">7</span>FINDING DETAILS (${d.stats.majorNC + d.stats.minorNC})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f1f5f9;"><th style="padding:10px 14px;text-align:left;width:12%;">Clause</th><th style="padding:10px 14px;text-align:left;width:40%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:12%;">Severity</th><th style="padding:10px 14px;text-align:left;width:40%;">Evidence & Remarks</th></tr></thead>
                            <tbody>${ncRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No non-conformities found</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
                ${(d.report.ncrs || []).length > 0 ? `
                <!-- 7: NCRs -->
                <div class="rp-sec" id="sec-ncrs">
                    <div class="rp-sec-hdr" style="border-left-color:#ea580c;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">8</span>NCR REGISTER (${d.report.ncrs.length})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">${d.report.ncrs.map(ncr => '<div style="padding:10px;border-left:4px solid ' + (ncr.type === 'Major' ? '#dc2626' : '#f59e0b') + ';background:' + (ncr.type === 'Major' ? '#fef2f2' : '#fffbeb') + ';border-radius:0 6px 6px 0;margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:0.85rem;"><strong>' + ncr.type + ' — Clause ' + ncr.clause + '</strong><span style="color:#64748b;font-size:0.8rem;">' + (ncr.createdAt ? new Date(ncr.createdAt).toLocaleDateString() : '') + '</span></div><div style="color:#334155;font-size:0.85rem;margin-top:4px;">' + (ncr.description || '') + '</div></div>').join('')}</div>
                </div>` : ''}
                <!-- Corrective Action Requirements -->
                ${(d.stats.majorNC + d.stats.minorNC) > 0 ? `
                <div class="rp-sec" id="sec-corrective">
                    <div class="rp-sec-hdr" style="border-left-color:#be185d;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">9</span>CORRECTIVE ACTION REQUIREMENTS<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#fdf2f8;"><th style="padding:10px 14px;text-align:left;width:10%;">NC Ref</th><th style="padding:10px 14px;text-align:left;width:10%;">Clause</th><th style="padding:10px 14px;text-align:left;width:10%;">Type</th><th style="padding:10px 14px;text-align:left;width:35%;">Corrective Action Required</th><th style="padding:10px 14px;text-align:left;width:15%;">Due Date</th><th style="padding:10px 14px;text-align:left;width:20%;">Verification Method</th></tr></thead>
                            <tbody>${(() => {
                    const ncItems = (d.report.checklistProgress || []).filter(p => p.status === 'nc' && p.ncrType && p.ncrType.toLowerCase() !== 'observation' && p.ncrType.toLowerCase() !== 'ofi');
                    const ncrItems = d.report.ncrs || [];
                    const allNCs = [...ncItems.map((item, i) => ({
                        ref: 'NCR-' + String(d.report.id).substring(0, 6) + '-' + (i + 1),
                        clause: item.clauseRef || item.clause || item.id,
                        type: item.ncrType || item.severity || 'Minor',
                        desc: item.ncrDescription || item.comment || item.requirement || '',
                        dueDate: item.ncrType === 'Major' ? (() => { const dt = new Date(); dt.setDate(dt.getDate() + 30); return dt.toISOString().split('T')[0]; })() : (() => { const dt = new Date(); dt.setDate(dt.getDate() + 90); return dt.toISOString().split('T')[0]; })()
                    })), ...ncrItems.map((ncr, i) => ({
                        ref: 'NCR-' + String(d.report.id).substring(0, 6) + '-' + (ncItems.length + i + 1),
                        clause: ncr.clause || '',
                        type: ncr.type || 'Minor',
                        desc: ncr.description || '',
                        dueDate: ncr.type === 'Major' ? (() => { const dt = new Date(); dt.setDate(dt.getDate() + 30); return dt.toISOString().split('T')[0]; })() : (() => { const dt = new Date(); dt.setDate(dt.getDate() + 90); return dt.toISOString().split('T')[0]; })()
                    }))];
                    if (allNCs.length === 0) return '<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8;">No corrective actions required</td></tr>';
                    return allNCs.map(nc => '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 14px;font-weight:600;font-family:monospace;color:#be185d;">' + nc.ref + '</td><td style="padding:10px 14px;">' + nc.clause + '</td><td style="padding:10px 14px;"><span style="padding:2px 10px;border-radius:20px;font-size:0.78rem;font-weight:600;' + (nc.type === 'Major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + nc.type + '</span></td><td style="padding:10px 14px;" contenteditable="true" class="rp-edit">Root cause analysis and corrective action required for: ' + (nc.desc || '').substring(0, 120) + '</td><td style="padding:10px 14px;font-weight:600;color:#be185d;">' + nc.dueDate + '</td><td style="padding:10px 14px;" contenteditable="true" class="rp-edit">Document review & follow-up audit</td></tr>').join('');
                })()}</tbody>
                        </table>
                        <div style="margin-top:1rem;padding:0.75rem;background:#fef2f8;border-radius:8px;font-size:0.82rem;color:#9d174d;"><i class="fa-solid fa-clock" style="margin-right:0.4rem;"></i><strong>Timeframes:</strong> Major NC — 30 days | Minor NC — 90 days from report issuance</div>
                    </div>
                </div>` : ''}
                <!-- 8: Meetings -->
                <div class="rp-sec" id="sec-meetings">
                    <div class="rp-sec-hdr" style="border-left-color:#0891b2;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">9</span>CLOSING MEETING<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="padding:12px;background:#eff6ff;border-radius:8px;"><strong style="color:#1e40af;"><i class="fa-solid fa-pen" style="font-size:0.6rem;margin-right:4px;opacity:0.5;"></i>Closing Meeting</strong><div style="font-size:0.85rem;color:#334155;margin-top:6px;">Date: ${d.report.closingMeeting?.date || 'N/A'}</div><div style="font-size:0.85rem;color:#334155;">Attendees: ${(() => { const att = d.report.closingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(a => typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a).filter(Boolean).join(', ') || 'N/A'; return String(att); })()}</div><div id="rp-closing-summary" class="rp-edit" contenteditable="true" style="margin-top:6px;font-size:0.85rem;min-height:30px;">${d.report.closingMeeting?.summary || '<em style="color:#94a3b8;">Click to add closing meeting summary...</em>'}</div></div>
                    </div>
                </div>
                <!-- Changes Since Last Audit -->
                <div class="rp-sec" id="sec-changes">
                    <div class="rp-sec-hdr" style="border-left-color:#78716c;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">11</span>CHANGES SINCE LAST AUDIT<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div id="rp-changes" class="rp-edit" contenteditable="true" style="min-height:40px;line-height:1.7;">${d.report.changesSinceLastAudit || 'No significant changes to the management system scope, documentation, or organizational structure have been reported since the last audit. Click to edit if changes occurred.'}</div>
                    </div>
                </div>
                <!-- 7: Conclusion -->
                <div class="rp-sec" id="sec-conclusion">
                    <div class="rp-sec-hdr" style="border-left-color:#4338ca;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">10</span>AUDIT CONCLUSION<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="margin-bottom:10px;"><strong style="color:#334155;">Recommendation:</strong> <span style="margin-left:6px;padding:4px 14px;border-radius:20px;font-weight:700;font-size:0.82rem;${d.report.recommendation === 'Recommended' ? 'background:#dcfce7;color:#166534;' : d.report.recommendation === 'Not Recommended' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;'}">${d.report.recommendation || 'Pending'}</span></div>
                        ${(function () {
                            // Risk Assessment auto-callout
                            const ncClauses = (d.report.checklistProgress || [])
                                .filter(p => p.status === 'nc' && p.ncrType && p.ncrType.toLowerCase() !== 'observation' && p.ncrType.toLowerCase() !== 'ofi')
                                .map(p => p.clauseRef || p.clause || '').filter(Boolean);
                            const ncrClauses = (d.report.ncrs || []).map(n => n.clause || '').filter(Boolean);
                            const allRiskClauses = [...new Set([...ncClauses, ...ncrClauses])];
                            if (allRiskClauses.length === 0) return '';
                            return '<div style="margin-bottom:14px;padding:14px;background:#fef2f2;border-radius:10px;border-left:4px solid #dc2626;"><div style="font-size:0.82rem;font-weight:700;color:#991b1b;margin-bottom:6px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>RISK AREAS IDENTIFIED</div><div style="font-size:0.85rem;color:#7f1d1d;line-height:1.6;">The following clause areas have been identified as requiring management attention due to non-conformity findings: <strong>' + allRiskClauses.join(', ') + '</strong>. These areas should be prioritized for corrective action and root cause analysis to prevent recurrence.</div></div>';
                        })()}
                        <div id="rp-conclusion" class="rp-edit" contenteditable="true">${d.report.conclusion || 'Based on the audit findings, the audit team concludes that the organization\'s management system has been assessed against the applicable standard requirements. Click to edit this conclusion.'}</div>
                    </div>
                </div>
                <!-- Signature Block -->
                <div class="rp-sec" id="sec-signature">
                    <div class="rp-sec-hdr" style="border-left-color:#1e293b;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">14</span>SIGNATURE & ATTESTATION<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;">
                            <div style="padding:1.5rem;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                                <div style="font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem;font-weight:600;">Lead Auditor</div>
                                <div style="font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:0.5rem;">${d.auditPlan?.team?.[0] || d.report.leadAuditor || 'Lead Auditor Name'}</div>
                                <div style="border-bottom:2px solid #1e293b;width:100%;margin:1.5rem 0 0.5rem;"></div>
                                <div style="font-size:0.8rem;color:#64748b;">Signature</div>
                                <div style="margin-top:1rem;font-size:0.85rem;color:#475569;">Date: <span id="rp-sig-date" contenteditable="true" class="rp-edit" style="font-weight:600;">${new Date().toLocaleDateString('en-GB')}</span></div>
                            </div>
                            <div style="padding:1.5rem;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                                <div style="font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem;font-weight:600;">Technical Reviewer / Certification Manager</div>
                                <div id="rp-reviewer-name" class="rp-edit" contenteditable="true" style="font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:0.5rem;min-height:22px;">${d.report.technicalReviewer || 'Click to enter reviewer name'}</div>
                                <div style="border-bottom:2px solid #1e293b;width:100%;margin:1.5rem 0 0.5rem;"></div>
                                <div style="font-size:0.8rem;color:#64748b;">Signature</div>
                                <div style="margin-top:1rem;font-size:0.85rem;color:#475569;">Date: <span id="rp-reviewer-date" contenteditable="true" class="rp-edit" style="font-weight:600;">${new Date().toLocaleDateString('en-GB')}</span></div>
                            </div>
                        </div>
                        <div style="margin-top:1.5rem;padding:1rem;background:#f0f9ff;border-radius:8px;font-size:0.82rem;color:#0c4a6e;text-align:center;"><i class="fa-solid fa-shield-halved" style="margin-right:0.5rem;"></i>This report is confidential and intended solely for the audited organization, the certification body, and the accreditation body.</div>
                    </div>
                </div>
                <!-- Distribution List -->
                <div class="rp-sec" id="sec-distribution">
                    <div class="rp-sec-hdr" style="border-left-color:#0d9488;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;"><i class="fa-solid fa-share-nodes"></i></span>DISTRIBUTION LIST<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="margin-bottom:12px;font-size:0.85rem;color:#64748b;">This report is distributed to the following parties. Unauthorized distribution is prohibited.</div>
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f0fdfa;"><th style="padding:10px 14px;text-align:left;width:5%;">#</th><th style="padding:10px 14px;text-align:left;width:30%;">Recipient</th><th style="padding:10px 14px;text-align:left;width:25%;">Role</th><th style="padding:10px 14px;text-align:left;width:25%;">Organization</th><th style="padding:10px 14px;text-align:left;width:15%;">Format</th></tr></thead>
                            <tbody>
                                <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">1</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">${d.report.leadAuditor || 'Lead Auditor'}</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Lead Auditor</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">${d.cbName || 'Certification Body'}</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Original</td></tr>
                                <tr style="background:#f8fafc;"><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">2</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;" contenteditable="true" id="rp-dist-reviewer">${d.report.technicalReviewer || 'Technical Reviewer'}</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Technical Reviewer</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">${d.cbName || 'Certification Body'}</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Copy</td></tr>
                                <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">3</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;" contenteditable="true" id="rp-dist-client">${d.report.client}</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Client Representative</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">${d.report.client}</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Copy</td></tr>
                                <tr style="background:#f8fafc;"><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">4</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;" contenteditable="true">Certification Records</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">File / Archive</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">${d.cbName || 'Certification Body'}</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">Archive</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- Annexures -->
                <div class="rp-sec" id="sec-annexures">
                    <div class="rp-sec-hdr" style="border-left-color:#9333ea;" data-action="toggleNextCollapsed"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;"><i class="fa-solid fa-paperclip"></i></span>ANNEXURES / APPENDICES<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div id="rp-annexures" class="rp-edit" contenteditable="true" style="min-height:80px;line-height:1.8;color:#334155;">
                            <div style="font-weight:600;margin-bottom:8px;">Annexure A — Audit Plan Reference</div>
                            <div style="margin-bottom:6px;">• Plan Reference: ${d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : 'N/A'}</div>
                            <div style="margin-bottom:12px;">• Standard: ${d.report.standard || 'ISO Standard'}</div>
                            <div style="font-weight:600;margin-bottom:8px;">Annexure B — Checklist Summary</div>
                            <div style="margin-bottom:6px;">• Total Items Audited: ${d.stats.totalItems}</div>
                            <div style="margin-bottom:6px;">• Conforming: ${d.stats.conformCount} | NC: ${d.stats.majorNC + d.stats.minorNC} | Observations: ${d.stats.observationCount} | OFI: ${d.stats.ofiCount}</div>
                            <div style="margin-bottom:12px;">• N/A Items: ${d.stats.naCount}</div>
                            <div style="font-weight:600;margin-bottom:8px;">Annexure C — Additional Documents</div>
                            <div style="color:#94a3b8;font-style:italic;">Click to add any additional supporting documents, certificates, or reference materials</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="rp-footer">
                <div style="font-size:0.82rem;color:#64748b;"><i class="fa-solid fa-info-circle" style="margin-right:4px;"></i>${sections.filter(s => !s.hide).length} sections • Click any section to edit • Changes reflect in PDF</div>
                <div style="display:flex;gap:10px;">
                    <button data-action="removeElement" data-id="report-preview-overlay" style="padding:10px 20px;border-radius:8px;border:1px solid #cbd5e1;background:white;font-weight:600;cursor:pointer;color:#475569;">Cancel</button>
                    <button id="ai-polish-btn" data-action="polishNotesWithAI" style="padding:10px 20px;border-radius:8px;border:2px solid #0ea5e9;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);font-weight:600;cursor:pointer;color:#0369a1;" aria-label="Auto-generate"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px;"></i>Polish Notes with AI</button>
                    <button data-action="exportReportPDF" style="padding:10px 24px;border-radius:8px;border:none;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.3);" aria-label="Export PDF"><i class="fa-solid fa-file-pdf" style="margin-right:6px;"></i>Export PDF</button>
                </div>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Charts: <script> inside innerHTML doesn't execute — init programmatically
        window._initPreviewCharts = function () {
            const d = window._reportPreviewData;
            if (!d) return;

            function renderCharts() {
                // 1. Compliance Pie
                const pieCtx = document.getElementById('compliance-pie-chart');
                if (pieCtx) {
                    new Chart(pieCtx.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: ['Conforming', 'Non-Conformity', 'Observation'],
                            datasets: [{ data: [d.stats.conformCount, d.stats.ncCount, d.stats.observationCount], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], borderWidth: 0 }]
                        },
                        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } } }
                    });
                }
                // 2. Severity Bar
                const sevCtx = document.getElementById('severity-bar-chart');
                if (sevCtx) {
                    new Chart(sevCtx.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: ['Major NC', 'Minor NC', 'Observations'],
                            datasets: [{ label: 'Count', data: [d.stats.majorNC, d.stats.minorNC, d.stats.observationCount], backgroundColor: ['#dc2626', '#f59e0b', '#fbbf24'], borderWidth: 0 }]
                        },
                        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
                    });
                }
                // 3. Findings by Clause
                const clauseCtx = document.getElementById('clause-findings-chart');
                if (clauseCtx) {
                    const clauseData = {};
                    d.hydratedProgress.forEach(item => {
                        const clause = item.kbMatch?.clause || item.clause || 'N/A';
                        const mainClause = clause.split('.')[0];
                        if (!clauseData[mainClause]) clauseData[mainClause] = { major: 0, minor: 0, obs: 0, ok: 0 };
                        if (item.status === 'nc') {
                            if (item.ncrType === 'Major') clauseData[mainClause].major++;
                            else if (item.ncrType === 'Minor') clauseData[mainClause].minor++;
                            else clauseData[mainClause].obs++;
                        } else if (item.status === 'conform') {
                            clauseData[mainClause].ok++;
                        }
                    });
                    const sorted = Object.keys(clauseData).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                    if (sorted.length) {
                        new Chart(clauseCtx.getContext('2d'), {
                            type: 'bar',
                            data: {
                                labels: sorted.map(c => 'Clause ' + c),
                                datasets: [
                                    { label: 'Major NC', data: sorted.map(c => clauseData[c].major), backgroundColor: '#dc2626', stack: 'f' },
                                    { label: 'Minor NC', data: sorted.map(c => clauseData[c].minor), backgroundColor: '#f59e0b', stack: 'f' },
                                    { label: 'Observations', data: sorted.map(c => clauseData[c].obs), backgroundColor: '#fbbf24', stack: 'f' },
                                    { label: 'Conforming', data: sorted.map(c => clauseData[c].ok), backgroundColor: '#10b981', stack: 'f' }
                                ]
                            },
                            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } } }
                        });
                    }
                }

                // 4. Department Findings Chart
                const deptCtx = document.getElementById('dept-findings-chart');
                if (deptCtx) {
                    const deptData = {};
                    d.hydratedProgress.forEach(item => {
                        const dept = item.department || '';
                        if (!dept) return;
                        if (!deptData[dept]) deptData[dept] = { major: 0, minor: 0, obs: 0, conform: 0 };
                        if (item.status === 'nc') {
                            if ((item.ncrType || '').toLowerCase() === 'major') deptData[dept].major++;
                            else if ((item.ncrType || '').toLowerCase() === 'minor') deptData[dept].minor++;
                            else deptData[dept].obs++;
                        } else if (item.status === 'conform') {
                            deptData[dept].conform++;
                        }
                    });
                    const deptLabels = Object.keys(deptData).sort();
                    if (deptLabels.length > 0) {
                        new Chart(deptCtx.getContext('2d'), {
                            type: 'bar',
                            data: {
                                labels: deptLabels,
                                datasets: [
                                    { label: 'Major NC', data: deptLabels.map(dl => deptData[dl].major), backgroundColor: '#dc2626', stack: 'd' },
                                    { label: 'Minor NC', data: deptLabels.map(dl => deptData[dl].minor), backgroundColor: '#f59e0b', stack: 'd' },
                                    { label: 'Observations', data: deptLabels.map(dl => deptData[dl].obs), backgroundColor: '#fbbf24', stack: 'd' },
                                    { label: 'Conforming', data: deptLabels.map(dl => deptData[dl].conform), backgroundColor: '#10b981', stack: 'd' }
                                ]
                            },
                            options: { responsive: true, indexAxis: 'y', plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8, usePointStyle: true, pointStyle: 'circle' } } }, scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, y: { stacked: true } } }
                        });
                    } else {
                        deptCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-building" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>No department data. Use AI Auto Map to assign departments.</div>';
                    }
                }

                // 5. Personnel Workload Chart
                const persCtx = document.getElementById('personnel-workload-chart');
                if (persCtx) {
                    const persData = {};
                    d.hydratedProgress.forEach(item => {
                        if (!item.personnel) return;
                        if (!persData[item.personnel]) persData[item.personnel] = { conform: 0, nc: 0, na: 0 };
                        if (item.status === 'conform') persData[item.personnel].conform++;
                        else if (item.status === 'nc') persData[item.personnel].nc++;
                        else if (item.status === 'na') persData[item.personnel].na++;
                    });
                    const persLabels = Object.keys(persData).sort((a, b) => {
                        return (persData[b].conform + persData[b].nc + persData[b].na) - (persData[a].conform + persData[a].nc + persData[a].na);
                    }).slice(0, 10);
                    if (persLabels.length > 0) {
                        new Chart(persCtx.getContext('2d'), {
                            type: 'bar',
                            data: {
                                labels: persLabels,
                                datasets: [
                                    { label: 'Conform', data: persLabels.map(p => persData[p].conform), backgroundColor: '#10b981', stack: 'p' },
                                    { label: 'NC', data: persLabels.map(p => persData[p].nc), backgroundColor: '#ef4444', stack: 'p' },
                                    { label: 'N/A', data: persLabels.map(p => persData[p].na), backgroundColor: '#94a3b8', stack: 'p' }
                                ]
                            },
                            options: { indexAxis: 'y', responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8, usePointStyle: true, pointStyle: 'circle' } } }, scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, y: { stacked: true, ticks: { font: { size: 10 } } } } }
                        });
                    } else {
                        persCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-user-tie" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>No personnel data. Use AI Auto Map to assign personnel.</div>';
                    }
                }

                // 6. Compliance by Department Radar
                const radarCtx = document.getElementById('dept-compliance-radar');
                if (radarCtx) {
                    const rDeptData = {};
                    d.hydratedProgress.forEach(item => {
                        if (!item.department) return;
                        if (!rDeptData[item.department]) rDeptData[item.department] = { total: 0, conform: 0 };
                        rDeptData[item.department].total++;
                        if (item.status === 'conform') rDeptData[item.department].conform++;
                    });
                    const rLabels = Object.keys(rDeptData).sort();
                    if (rLabels.length >= 3) {
                        new Chart(radarCtx.getContext('2d'), {
                            type: 'radar',
                            data: {
                                labels: rLabels,
                                datasets: [{
                                    label: 'Compliance %',
                                    data: rLabels.map(rl => rDeptData[rl].total > 0 ? Math.round((rDeptData[rl].conform / rDeptData[rl].total) * 100) : 0),
                                    borderColor: '#6366f1',
                                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                    borderWidth: 2,
                                    pointBackgroundColor: '#6366f1'
                                }]
                            },
                            options: { responsive: true, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { stepSize: 25, font: { size: 9 } }, pointLabels: { font: { size: 10 } } } } }
                        });
                    } else {
                        radarCtx.parentElement.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem;"><i class="fa-solid fa-chart-radar" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>Need 3+ departments for radar chart. Use AI Auto Map.</div>';
                    }
                }
            }

            // Load Chart.js if not already loaded
            if (typeof Chart !== 'undefined') {
                renderCharts();
            } else {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
                s.onload = renderCharts;
                document.head.appendChild(s);
            }
        };

        // Init charts after DOM settles
        setTimeout(() => window._initPreviewCharts(), 300);
    };

    window.toggleReportSection = function (id, color) {
        const pill = document.getElementById('pill-' + id);
        const sec = document.getElementById('sec-' + id);
        if (!pill) return;
        const wasActive = pill.classList.contains('active');
        window._reportSectionState[id] = !wasActive;
        if (wasActive) {
            pill.classList.remove('active');
            pill.style.background = 'white'; pill.style.color = '#94a3b8'; pill.style.borderColor = '#cbd5e1';
            if (sec) sec.style.display = 'none';
        } else {
            pill.classList.add('active');
            pill.style.background = color; pill.style.color = 'white'; pill.style.borderColor = color;
            if (sec) sec.style.display = '';
        }
    };

    // ============================================
    // AI AUTO-CLASSIFY & POLISH (Combined: classify severity + refine notes)
    // ============================================
    window.runFollowUpAIAnalysis = async function (reportId) {
        const btn = document.getElementById('btn-ai-classify');
        if (!btn) return;

        // Get the report and standard
        const reports = window.state?.auditReports || JSON.parse(localStorage.getItem('audit_reports') || '[]');
        const report = reports.find(r => String(r.id) === String(reportId));
        if (!report) { window.showNotification('Report not found.', 'error'); return; }

        const standardName = report.standard || '';
        const checklistProgress = report.checklistProgress || [];

        // Check AI service availability
        if (!window.AI_SERVICE) {
            window.showNotification('AI Service not available.', 'warning');
            return;
        }

        // Show loading state
        const originalBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Classifying & Polishing...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            // STEP 1: Collect all findings from the DOM
            const findingCards = document.querySelectorAll('.review-severity');
            const findings = [];
            findingCards.forEach(select => {
                const fid = select.dataset.findingId;
                const textarea = document.querySelector('.review-remarks[data-finding-id="' + fid + '"]');
                const remarkText = textarea?.value || '';
                const card = select.closest('.card');
                const clauseEl = card?.querySelector('[style*="font-weight: 700"]');
                const clause = clauseEl?.textContent?.match(/[\d.]+/)?.[0] || '';

                const descEl = card?.querySelector('[style*="color: #334155"]') || card?.querySelector('[style*="color:#334155"]');
                const reqEl = card?.querySelector('[style*="color: var(--primary-color)"]');
                const descText = descEl?.textContent?.trim() || '';
                const reqText = reqEl?.parentElement?.textContent?.trim() || '';
                findings.push({
                    id: fid,
                    clause: clause,
                    status: select.value,
                    comment: remarkText,
                    remarks: remarkText,
                    type: select.value,
                    description: descText || reqText,
                    requirement: reqText
                });
            });

            if (findings.length === 0) {
                window.showNotification('No findings to process.', 'info');
                btn.innerHTML = originalBtnHtml;
                btn.disabled = false;
                btn.style.opacity = '1';
                return;
            }

            let classifyCount = 0;
            let polishCount = 0;
            let generateCount = 0;

            // STEP 2: Severity classification is PRESERVED as-is (set by auditor/senior reviewer)
            // AI does NOT change severity — it only polishes text below

            // STEP 2.5: AI Generate Conformance Text (for findings with empty remarks)
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Generating conformance text...';
            if (window.AI_SERVICE.generateConformanceText) {
                try {
                    const emptyFindings = findings.filter(f => !f.comment || f.comment.trim().length < 5);
                    if (emptyFindings.length > 0) {
                        const generated = await window.AI_SERVICE.generateConformanceText(emptyFindings, standardName);
                        if (generated && Array.isArray(generated)) {
                            generated.forEach((result, i) => {
                                if (result.comment && result._aiGenerated) {
                                    const textarea = document.querySelector('.review-remarks[data-finding-id="' + emptyFindings[i].id + '"]');
                                    if (textarea) {
                                        textarea.value = result.comment;
                                        // Also update the finding object for later save
                                        const origIdx = findings.findIndex(f => f.id === emptyFindings[i].id);
                                        if (origIdx >= 0) findings[origIdx].comment = result.comment;
                                        generateCount++;
                                        // Flash blue for generated items
                                        textarea.style.transition = 'background 0.3s';
                                        textarea.style.background = '#eff6ff';
                                        setTimeout(() => { textarea.style.background = ''; }, 3000);
                                    }
                                }
                            });
                        }
                    }
                } catch (genErr) {
                    console.warn('Conformance text generation error (continuing with polish):', genErr);
                }
            }

            // STEP 3: AI Polish Notes (refine raw text to professional language)
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Polishing notes...';
            if (window.AI_SERVICE.refineAuditNotes) {
                try {
                    const toPolish = findings.filter(f => f.comment && f.comment.trim());
                    if (toPolish.length > 0) {
                        const refined = await window.AI_SERVICE.refineAuditNotes(toPolish, standardName);
                        if (refined && Array.isArray(refined)) {
                            refined.forEach((result, i) => {
                                if (result.comment && result.comment !== toPolish[i].comment) {
                                    const textarea = document.querySelector('.review-remarks[data-finding-id="' + toPolish[i].id + '"]');
                                    if (textarea) {
                                        textarea.value = result.comment;
                                        polishCount++;
                                        // Flash green for polished items
                                        textarea.style.transition = 'background 0.3s';
                                        textarea.style.background = '#f0fdf4';
                                        setTimeout(() => { textarea.style.background = ''; }, 2500);
                                    }
                                }
                            });
                        }
                    }
                } catch (polishErr) {
                    console.warn('Polish error:', polishErr);
                }
            }

            // STEP 4: Auto-save to DB by updating the report object and persisting
            findingCards.forEach(select => {
                const fid = select.dataset.findingId;
                const newType = select.value;
                const textarea = document.querySelector('.review-remarks[data-finding-id="' + fid + '"]');
                const remarks = textarea?.value || '';

                if (fid.startsWith('checklist-')) {
                    const idx = parseInt(fid.replace('checklist-', ''), 10);
                    if (report.checklistProgress && report.checklistProgress[idx]) {
                        report.checklistProgress[idx].ncrType = newType;
                        if (remarks) report.checklistProgress[idx].comment = remarks;
                    }
                } else if (fid.startsWith('ncr-')) {
                    const idx = parseInt(fid.replace('ncr-', ''), 10);
                    if (report.ncrs && report.ncrs[idx]) {
                        report.ncrs[idx].type = newType;
                        if (remarks) report.ncrs[idx].description = remarks;
                    }
                }
            });

            // Persist to localStorage
            const existingReports = JSON.parse(localStorage.getItem('audit_reports') || '[]');
            const rIdx = existingReports.findIndex(r => r.id === reportId);
            if (rIdx !== -1) {
                existingReports[rIdx] = report;
                localStorage.setItem('audit_reports', JSON.stringify(existingReports));
            }

            // Persist to Supabase
            if (window.SupabaseClient?.db?.upsert) {
                try {
                    await window.SupabaseClient.db.upsert('audit_reports', {
                        id: String(reportId),
                        checklist_progress: report.checklistProgress || [],
                        ncrs: report.ncrs || [],
                        data: report || {}
                    });
                } catch (dbErr) {
                    console.warn('DB save after AI classify:', dbErr);
                }
            }

            // Success UI
            const parts = [];
            if (classifyCount) parts.push(classifyCount + ' classified');
            if (generateCount) parts.push(generateCount + ' generated');
            if (polishCount) parts.push(polishCount + ' polished');
            btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 0.5rem;"></i> Done! ' + (parts.join(', ') || 'No changes');
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            window.showNotification('AI: ' + (parts.join(', ') || 'No changes needed') + '. All saved.', 'success');

        } catch (error) {
            console.error('AI Classify & Polish error:', error);
            btn.innerHTML = originalBtnHtml;
            window.showNotification('AI processing failed: ' + error.message, 'error');
        }

        // Reset button after 4s
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> AI Auto-Classify & Polish';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.background = 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)';
        }, 4000);
    };

    // ============================================
    // POLISH NOTES WITH AI (Refine raw notes into professional audit language)
    // ============================================
    window.polishNotesWithAI = async function () {
        const d = window._reportPreviewData;
        if (!d) return;
        const btn = document.getElementById('ai-polish-btn');
        if (!btn) return;

        // Check if AI service is available
        if (!window.AI_SERVICE?.refineAuditNotes) {
            window.showNotification('AI Service not available. Please check your API configuration.', 'warning');
            return;
        }

        // Show loading state
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Polishing Notes...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            const standardName = d.report.standard || d.auditPlan?.standard || '';
            // Step 1: Generate AI text for conformance items with empty comments
            if (d.hydratedProgress && d.hydratedProgress.length > 0 && window.AI_SERVICE.generateConformanceText) {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Generating conformance text...';
                try {
                    const emptyConformItems = d.hydratedProgress
                        .map((item, idx) => ({ ...item, _hpIdx: idx }))
                        .filter(item => item.status === 'conform' && (!item.comment || item.comment.trim().length < 5));

                    if (emptyConformItems.length > 0) {
                        const conformFindings = emptyConformItems.map(item => ({
                            id: `conform-${item._hpIdx}`,
                            clause: item.kbMatch ? item.kbMatch.clause : item.clause,
                            status: 'conform',
                            type: 'conform',
                            description: (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || ''),
                            comment: item.comment || '',
                            requirement: (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || '')
                        }));

                        const generated = await window.AI_SERVICE.generateConformanceText(conformFindings, standardName);
                        if (generated && Array.isArray(generated)) {
                            generated.forEach((result, i) => {
                                if (result.comment && result._aiGenerated) {
                                    const hpIdx = emptyConformItems[i]._hpIdx;
                                    d.hydratedProgress[hpIdx].comment = result.comment;
                                    d.hydratedProgress[hpIdx]._aiGenerated = true;
                                }
                            });
                        }
                    }
                } catch (conformErr) {
                    console.warn('Conformance text generation error (continuing with polish):', conformErr);
                }
            }

            // Step 2: Refine/polish all checklist progress notes
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Polishing Notes...';
            if (d.hydratedProgress && d.hydratedProgress.length > 0) {
                const refined = await window.AI_SERVICE.refineAuditNotes(d.hydratedProgress, standardName);
                d.hydratedProgress = refined;
            }

            // Refine NCR descriptions
            if (d.report.ncrs && d.report.ncrs.length > 0) {
                const ncrFindings = d.report.ncrs.map(n => ({
                    clause: n.clause,
                    status: 'nc',
                    type: n.type,
                    comment: n.description || '',
                    remarks: n.description || ''
                }));
                const refinedNCRs = await window.AI_SERVICE.refineAuditNotes(ncrFindings, standardName);
                d.report.ncrs = d.report.ncrs.map((ncr, i) => ({
                    ...ncr,
                    description: refinedNCRs[i]?.comment || ncr.description,
                    _originalDescription: ncr.description
                }));
            }

            // Step 3: Generate AI-powered conclusion
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Generating conclusion...';
            try {
                const ncTotal = d.stats.majorNC + d.stats.minorNC;
                const obsTotal = d.stats.observationCount + d.stats.ofiCount;
                const conformRate = d.stats.totalItems > 0 ? Math.round((d.stats.conformCount / d.stats.totalItems) * 100) : 0;
                const conclusionPrompt = `You are a Senior Lead Auditor at a top-tier Certification Body. Write a formal audit conclusion (150-200 words) for the following audit:

Client: ${d.report.client}
Standard: ${standardName}
Audit Type: ${d.auditPlan?.auditType || d.auditPlan?.type || 'Certification Audit'}
Items Audited: ${d.stats.totalItems} | Conforming: ${d.stats.conformCount} | NC: ${ncTotal} (${d.stats.majorNC} Major, ${d.stats.minorNC} Minor) | Observations: ${obsTotal}
Recommendation: ${d.report.recommendation || 'Pending'}

CRITICAL RULES — CCI Gold Standard:
- Do NOT use percentage scoring or compliance percentages
- Use legally defensible, accreditation-ready language
- Follow ISO 17021 certification body reporting requirements

Instructions:
1. State whether the management system has demonstrated conformity with the standard
2. Reference the number of non-conformities and observations raised
3. ${ncTotal > 0 ? 'State that corrective actions must be submitted within the specified timeframes' : 'Note that no non-conformities were identified'}
4. Conclude with the audit team's recommendation regarding ${d.report.recommendation === 'Recommended' ? 'continuation/granting of certification' : d.report.recommendation === 'Not Recommended' ? 'withholding certification pending corrective action' : 'the certification decision'}
5. Use measured, authoritative language befitting 30+ years of audit experience

Return ONLY the conclusion text, no JSON, no formatting.`;

                const response = await window.AI_SERVICE.callProxyAPI(conclusionPrompt);
                const conclusionText = window.AI_SERVICE.extractTextFromResponse ? window.AI_SERVICE.extractTextFromResponse(response) : (typeof response === 'string' ? response : '');
                if (conclusionText && conclusionText.trim().length > 50) {
                    const conclusionEl = document.getElementById('rp-conclusion');
                    if (conclusionEl) {
                        conclusionEl.innerHTML = conclusionText.trim();
                        conclusionEl.style.background = '#f0fdf4';
                        conclusionEl.style.borderColor = '#22c55e';
                        setTimeout(() => { conclusionEl.style.background = ''; conclusionEl.style.borderColor = ''; }, 3000);
                    }
                }
            } catch (conclusionErr) {
                console.warn('AI conclusion generation error (continuing):', conclusionErr);
            }

            // Update the findings table in the preview if visible
            const findingsBody = document.getElementById('findings-table-body');
            if (findingsBody && d.hydratedProgress) {
                const items = d.hydratedProgress.filter(i => i.status !== 'pending');
                findingsBody.innerHTML = items.map((item, idx) => {
                    const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
                    const sev = item.status === 'nc' ? (item.ncrType || 'NC') : item.status === 'observation' ? 'OBS' : 'OK';
                    const sevColor = sev === 'Major' ? '#dc2626' : sev === 'Minor' ? '#f59e0b' : sev === 'OBS' ? '#3b82f6' : '#10b981';
                    return '<tr style="background:' + (idx % 2 ? '#f8fafc' : 'white') + ';"><td style="padding:8px 12px;font-weight:600;">' + clause + '</td><td style="padding:8px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:10px;font-size:0.75rem;font-weight:700;color:' + sevColor + ';">' + sev + '</span></td><td style="padding:8px 12px;color:#334155;font-size:0.88rem;line-height:1.6;">' + (item.comment || '-') + '</td></tr>';
                }).join('');
            }

            // Also refresh the conformance table to show AI-generated remarks
            const conformSec = document.querySelector('#sec-conformance .rp-sec-body tbody');
            if (conformSec && d.hydratedProgress) {
                const renderEvThumbs = (item) => {
                    const imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
                    if (!imgs.length) return '';
                    return '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">' + imgs.map(src => '<img src="' + src + '" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0;cursor:pointer;" data-action="openImageInNewTab">').join('') + '</div>';
                };
                const conformItems = d.hydratedProgress.filter(i => i.status === 'conform');
                conformSec.innerHTML = conformItems.map((item, idx) => {
                    const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
                    const title = item.kbMatch ? item.kbMatch.title : '';
                    const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
                    return '<tr style="background:' + (idx % 2 ? '#f0fdf4' : 'white') + ';"><td style="padding:10px 14px;font-weight:700;">' + clause + '</td><td style="padding:10px 14px;">' + (title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req) + '</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#dcfce7;color:#166534;"><i class="fa-solid fa-check" style="margin-right:4px;"></i>Conform</span></td><td style="padding:10px 14px;color:#334155;">' + (item.comment || '<span style="color:#94a3b8;">No remarks</span>') + renderEvThumbs(item) + '</td></tr>';
                }).join('') || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No conformance evidence recorded</td></tr>';
            }

            // Success state
            btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right:6px;"></i>Notes Polished!';
            btn.style.background = 'linear-gradient(135deg,#f0fdf4,#dcfce7)';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#166534';
            btn.style.opacity = '1';

            const totalRefined = (d.hydratedProgress?.filter(i => i._originalComment || i._aiGenerated)?.length || 0) + (d.report.ncrs?.filter(n => n._originalDescription)?.length || 0);
            window.showNotification(`AI polished ${totalRefined} auditor notes into professional language!`, 'success');

            // Allow re-polish after 3 seconds
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.background = 'linear-gradient(135deg,#f0f9ff,#e0f2fe)';
                btn.style.borderColor = '#0ea5e9';
                btn.style.color = '#0369a1';
            }, 3000);

        } catch (error) {
            console.error('AI Polish Error:', error);
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            btn.style.opacity = '1';
            window.showNotification('AI polish failed: ' + error.message, 'error');
        }
    };

    // ============================================
    // POLISH SINGLE FINDING NOTE (Per-finding AI refinement)
    // ============================================
    window.polishSingleNote = async function (btn) {
        if (!btn || btn.disabled) return;
        const findingId = btn.getAttribute('data-finding-id');
        if (!findingId) return;

        // Find the textarea in the same parent
        const textarea = btn.parentElement.querySelector('textarea.review-remarks');
        if (!textarea || !textarea.value.trim()) {
            window.showNotification('No remarks to polish. Write some notes first.', 'info');
            return;
        }

        if (!window.AI_SERVICE?.refineAuditNotes) {
            window.showNotification('AI Service not available.', 'warning');
            return;
        }

        // Save original and show loading
        const originalText = textarea.value;
        const originalBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:0.7rem;"></i> Polishing...';
        btn.disabled = true;
        btn.style.opacity = '0.6';

        try {
            // Get clause context from the finding card
            const card = btn.closest('.review-finding-card, [data-finding-id]') || btn.parentElement.parentElement;
            const clauseEl = card?.querySelector('[style*="font-weight: 700"], [style*="font-weight:700"]');
            const clause = clauseEl?.textContent?.trim() || '';

            // Get standard name
            const d = window._reportPreviewData || {};
            const standardName = d?.report?.standard || d?.auditPlan?.standard || '';

            // Build single finding for AI
            const finding = [{
                clause: clause,
                status: 'finding',
                comment: originalText,
                remarks: originalText
            }];

            const refined = await window.AI_SERVICE.refineAuditNotes(finding, standardName);

            if (refined[0]?.comment && refined[0].comment !== originalText) {
                textarea.value = refined[0].comment;
                textarea.style.transition = 'background 0.3s';
                textarea.style.background = '#f0fdf4';
                setTimeout(() => { textarea.style.background = ''; }, 2000);

                // Success state
                btn.innerHTML = '<i class="fa-solid fa-check" style="font-size:0.7rem;"></i> Polished!';
                btn.style.background = '#dcfce7';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#166534';
            } else {
                btn.innerHTML = originalBtnHtml;
                window.showNotification('Notes already look professional!', 'info');
            }
        } catch (error) {
            console.error('Single note polish error:', error);
            textarea.value = originalText;
            btn.innerHTML = originalBtnHtml;
            window.showNotification('AI polish failed. Try again.', 'error');
        }

        // Reset button after 3s
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" style="font-size:0.7rem;"></i>Polish with AI';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.background = '#f0f9ff';
            btn.style.borderColor = '#0ea5e9';
            btn.style.color = '#0369a1';
        }, 3000);
    };

    // ============================================
    // EXPORT REPORT PDF (Premium ISO-Compliant)
    // ============================================
    window.exportReportPDF = function () {
        const d = window._reportPreviewData;
        if (!d) return;
        const en = window._reportSectionState || {};
        let editedSummary = document.getElementById('rp-exec-summary')?.innerHTML || d.report.executiveSummary || '';
        editedSummary = editedSummary.replace(/<em[^>]*>Click to add executive summary[^<]*<\/em>/gi, '').trim();
        let editedConclusion = document.getElementById('rp-conclusion')?.innerHTML || d.report.conclusion || '';
        // Strip placeholder text that leaks from contenteditable
        editedConclusion = editedConclusion.replace(/Click to edit this conclusion\.?/gi, '').trim();
        const editedPositiveObs = document.getElementById('rp-positive-obs')?.innerHTML || d.report.positiveObservations || '';
        const editedOpeningNotes = document.getElementById('rp-opening-notes')?.innerText || d.report.openingMeeting?.notes || '';
        let editedClosingSummary = document.getElementById('rp-closing-summary')?.innerText || d.report.closingMeeting?.summary || '';
        editedClosingSummary = editedClosingSummary.replace(/Click to add closing meeting summary[.]*/gi, '').trim();
        // Capture new editable fields
        const editedObjectives = document.getElementById('rp-objectives')?.innerText || d.auditPlan?.auditObjectives || '';
        const editedCriteria = document.getElementById('rp-criteria')?.innerText || d.auditPlan?.auditCriteria || '';
        const editedMethodology = document.getElementById('rp-methodology')?.innerText || d.auditPlan?.auditMethodology || '';
        const editedChanges = document.getElementById('rp-changes')?.innerText || d.report.changesSinceLastAudit || '';
        const editedReviewerName = document.getElementById('rp-reviewer-name')?.innerText || d.report.technicalReviewer || '';
        const editedSigDate = document.getElementById('rp-sig-date')?.innerText || new Date().toLocaleDateString('en-GB');
        const editedReviewerDate = document.getElementById('rp-reviewer-date')?.innerText || '';
        const formatText = (text) => { if (!text) return ''; return text.replace(/\\n/g, '<br>').replace(/\n/g, '<br>').replace(/\*\*\*([^*]+)\*\*\*/g, '<strong>$1</strong>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\(Clause ([^)]+)\)/g, '<em style="font-size:0.9em;color:#059669;">(Clause $1)</em>'); };
        // Rich text formatter for PDF: handles numbered lists, bullets, paragraphing, markdown
        const formatRichText = (text, color) => {
            if (!text) return '';
            const clr = color || '#334155';
            // Normalize HTML from contenteditable
            let t = text.replace(/&nbsp;/g, ' ')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?(div|p|li|ul|ol)[^>]*>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\(Clause ([^)]+)\)/g, '<em style="font-size:0.9em;color:#059669;">(Clause $1)</em>')
                .trim();
            // Detect numbered items: "1. ...", "2) ...", "3- ..."
            let numbered = t.split(/(?:^|\n)\s*(\d+)[.):\-]\s*/);
            if (numbered.length > 2) {
                let items = [];
                for (let i = 1; i < numbered.length; i += 2) {
                    let txt = (numbered[i + 1] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    if (txt) items.push(txt);
                }
                if (items.length > 0) {
                    return items.map((obs, idx) =>
                        '<div style="display:flex;gap:10px;margin-bottom:12px;align-items:flex-start;">'
                        + '<div style="min-width:26px;height:26px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.78rem;flex-shrink:0;">' + (idx + 1) + '</div>'
                        + '<div style="flex:1;padding-top:2px;color:' + clr + ';">' + obs + '</div></div>'
                    ).join('');
                }
            }
            // Detect bullet items: "- ...", "• ...", "▸ ..."
            let lines = t.split(/\n+/).filter(s => s.trim().length > 0);
            let bulletLines = lines.filter(s => /^\s*[\-\u2022\u2023\u25B8\u25E6\u2013\u2014•]\s/.test(s));
            if (bulletLines.length > 1 && bulletLines.length >= lines.length * 0.5) {
                return lines.map(line => {
                    let isBullet = /^\s*[\-\u2022\u2023\u25B8\u25E6\u2013\u2014•]\s*/.test(line);
                    let txt = line.replace(/^\s*[\-\u2022\u2023\u25B8\u25E6\u2013\u2014•]\s*/, '').trim();
                    if (isBullet) {
                        return '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">'
                            + '<div style="min-width:8px;height:8px;background:' + clr + ';border-radius:50%;margin-top:7px;flex-shrink:0;opacity:0.6;"></div>'
                            + '<div style="flex:1;color:' + clr + ';">' + txt + '</div></div>';
                    }
                    return '<div style="margin-bottom:10px;color:' + clr + ';font-weight:600;">' + txt + '</div>';
                }).join('');
            }
            // Default: paragraph mode — split on double newlines or treat single newlines as line breaks
            if (lines.length > 1) {
                return lines.map(para => '<p style="margin:0 0 10px 0;color:' + clr + ';">' + para.trim() + '</p>').join('');
            }
            // Single block of text — split into paragraphs every 2-3 sentences for readability
            if (t.length > 200) {
                let sentences = t.split(/(?<=[.!?])\s+/);
                if (sentences.length > 3) {
                    let paras = [];
                    let current = [];
                    for (let i = 0; i < sentences.length; i++) {
                        current.push(sentences[i]);
                        // Break every 2-3 sentences, preferring breaks at topic transitions
                        if (current.length >= 2 && (current.length >= 3 || (i < sentences.length - 1 && /^(The |While |Overall|In |During |Furthermore|Additionally|Moreover|However|Based |Addressing|This )/.test(sentences[i + 1])))) {
                            paras.push(current.join(' '));
                            current = [];
                        }
                    }
                    if (current.length > 0) paras.push(current.join(' '));
                    if (paras.length > 1) {
                        return paras.map(p => '<p style="margin:0 0 12px 0;text-align:justify;color:' + clr + ';">' + p.trim() + '</p>').join('');
                    }
                }
            }
            return '<span style="color:' + clr + ';">' + t + '</span>';
        };
        const fmtRemark = (t) => { if (!t) return ''; let s = t.trim(); if (!s) return ''; s = s.charAt(0).toUpperCase() + s.slice(1); if (!/[.!?]$/.test(s)) s += '.'; return s; };
        const formatPositiveObs = (text) => {
            if (!text) return '';
            // Normalize HTML: convert block-level tags and <br> to newlines, strip remaining tags
            let t = text.replace(/&nbsp;/g, ' ')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?(div|p|li|ul|ol)[^>]*>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .trim();
            let items = [];
            // Try numbered splitting: "1. ...", "2) ...", "3- ..."
            let numbered = t.split(/(?:^|\n)\s*(\d+)[.):\-]\s*/);
            if (numbered.length > 2) {
                for (let i = 1; i < numbered.length; i += 2) {
                    let txt = (numbered[i + 1] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    if (txt) items.push(txt);
                }
            } else {
                // Fall back to splitting on newlines
                items = t.split(/\n+/).map(s => s.replace(/^\s*[\-\u2022\u2023\u25E6]\s*/, '').trim()).filter(s => s.length > 3);
            }
            if (items.length === 0) items = [t.replace(/\n/g, ' ').trim()];
            return items.map((obs, idx) => '<div style="display:flex;gap:10px;margin-bottom:14px;align-items:flex-start;">'
                + '<div style="min-width:28px;height:28px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.8rem;flex-shrink:0;">' + (idx + 1) + '</div>'
                + '<div style="flex:1;padding-top:3px;">' + obs + '</div></div>').join('');
        };
        const printWindow = window.open('', '_blank');
        if (!printWindow) { window.showNotification('Pop-up blocked. Please allow pop-ups.', 'warning'); return; }
        const clauseLabels = Object.keys(d.stats.ncByClause).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        const clauseValues = clauseLabels.map(k => d.stats.ncByClause[k]);
        const standard = d.report.standard || d.auditPlan?.standard || 'ISO Standard';
        const cbName = d.cbSettings.cbName || '';
        const cbEmail = d.cbSettings.cbEmail || '';
        const cbSiteAddr = d.cbSite.address ? (d.cbSite.address + ', ' + (d.cbSite.city || '') + ' ' + (d.cbSite.country || '')).trim() : '';
        // Helper: render all evidence images for PDF (string concat)
        let renderEvThumbsPdf = function (item) {
            let imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
            if (!imgs.length) return '';
            let limited = imgs.slice(0, 2);
            let extra = imgs.length > 2 ? ' <span style="font-size:0.75rem;color:#64748b;">(+' + (imgs.length - 2) + ' more)</span>' : '';
            return '<div class="ev-inline">' + limited.map(function (url) { return '<a href="' + url + '" target="_blank"><img src="' + url + '" style="height:80px;max-width:140px;border-radius:4px;border:1px solid #e2e8f0;object-fit:cover;"></a>'; }).join('') + extra + '</div>';
        };
        const ncRowsHtml = d.hydratedProgress.filter(i => i.status === 'nc' && i.ncrType && i.ncrType.toLowerCase() !== 'observation' && i.ncrType.toLowerCase() !== 'ofi').map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            const sev = item.ncrType || 'NC';
            const sevBg = sev === 'Major' ? '#fee2e2' : '#fef3c7';
            const sevFg = sev === 'Major' ? '#991b1b' : '#92400e';
            return '<tr style="background:' + (idx % 2 ? '#f8fafc' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;white-space:nowrap;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:' + sevBg + ';color:' + sevFg + ';">' + sev + '</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + '</td></tr>';
        }).join('');

        // OBS rows for PDF (Observations only)
        const obsOnlyRowsHtml = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() === 'observation').map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return '<tr style="background:' + (idx % 2 ? '#f5f3ff' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;white-space:nowrap;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#ede9fe;color:#6d28d9;">OBS</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + '</td></tr>';
        }).join('');

        // OFI rows for PDF (Opportunities for Improvement only)
        const ofiOnlyRowsHtml = d.hydratedProgress.filter(i => i.status === 'nc' && (i.ncrType || '').toLowerCase() === 'ofi').map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return '<tr style="background:' + (idx % 2 ? '#f0fbff' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;white-space:nowrap;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#e0f7fa;color:#0891b2;">OFI</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + '</td></tr>';
        }).join('');

        // Conformance rows for PDF (items with comments or evidence)
        const conformRowsHtml = d.hydratedProgress.filter(i => i.status === 'conform' && (i.comment || i.evidenceImage || (i.evidenceImages && i.evidenceImages.length))).map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return '<tr style="background:' + (idx % 2 ? '#f0fdf4' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;white-space:nowrap;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#dcfce7;color:#166534;">Conform</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + '</td></tr>';
        }).join('');

        // Build clause/area performance analysis
        const clauseAreaNames = { '4': 'Context of the Organization', '5': 'Leadership', '6': 'Planning', '7': 'Support', '8': 'Operation', '9': 'Performance Evaluation', '10': 'Improvement' };
        const areaStats = {};
        (d.hydratedProgress || []).forEach(function (item) {
            let clause = (item.kbMatch ? item.kbMatch.clause : item.clause) || '';
            let mainC = clause.split('.')[0];
            if (!mainC || !clauseAreaNames[mainC]) return;
            if (!areaStats[mainC]) areaStats[mainC] = { conform: 0, minor: 0, major: 0, obs: 0, ofi: 0 };
            if (item.status === 'conform') areaStats[mainC].conform++;
            else if (item.status === 'nc') {
                let t = (item.ncrType || '').toLowerCase();
                if (t === 'major') areaStats[mainC].major++;
                else if (t === 'minor') areaStats[mainC].minor++;
                else if (t === 'observation') areaStats[mainC].obs++;
                else if (t === 'ofi') areaStats[mainC].ofi++;
                else areaStats[mainC].minor++;
            }
        });
        let areaSortedKeys = Object.keys(areaStats).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
        let areaTableRows = areaSortedKeys.map(function (k) {
            let s = areaStats[k]; var total = s.conform + s.minor + s.major + s.obs + s.ofi;
            let hasIssue = s.major > 0 || s.minor > 0;
            let statusBg = hasIssue ? (s.major > 0 ? '#fee2e2' : '#fef3c7') : '#dcfce7';
            let statusFg = hasIssue ? (s.major > 0 ? '#991b1b' : '#92400e') : '#166534';
            let statusTxt = hasIssue ? (s.major > 0 ? 'Needs Action' : 'Minor Issues') : 'Satisfactory';
            return '<tr><td style="padding:8px 12px;font-weight:600;">Clause ' + k + '</td><td style="padding:8px 12px;">' + clauseAreaNames[k] + '</td><td style="padding:8px 12px;text-align:center;">' + total + '</td><td style="padding:8px 12px;text-align:center;color:#166534;">' + s.conform + '</td><td style="padding:8px 12px;text-align:center;color:#dc2626;">' + (s.major + s.minor) + '</td><td style="padding:8px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:' + statusBg + ';color:' + statusFg + ';">' + statusTxt + '</span></td></tr>';
        }).join('');
        let areaTableHtml = areaSortedKeys.length > 0 ? '<div style="margin-top:16px;page-break-before:always;"><div style="font-size:0.88rem;font-weight:700;color:#1e293b;margin-bottom:8px;">Clause Area Performance Overview</div><table class="info-tbl" style="width:100%;font-size:0.82rem;"><thead><tr style="background:#f1f5f9;"><th style="padding:8px 12px;text-align:left;">Clause</th><th style="padding:8px 12px;text-align:left;">Area</th><th style="padding:8px 12px;text-align:center;">Checked</th><th style="padding:8px 12px;text-align:center;">Conform</th><th style="padding:8px 12px;text-align:center;">NC</th><th style="padding:8px 12px;text-align:center;">Status</th></tr></thead><tbody>' + areaTableRows + '</tbody></table></div>' : '';
        // Serialize area stats for chart script
        let areaChartData = JSON.stringify({ keys: areaSortedKeys, names: areaSortedKeys.map(function (k) { return clauseAreaNames[k]; }), conform: areaSortedKeys.map(function (k) { return areaStats[k].conform; }), nc: areaSortedKeys.map(function (k) { return areaStats[k].major + areaStats[k].minor; }), obs: areaSortedKeys.map(function (k) { return areaStats[k].obs; }), ofi: areaSortedKeys.map(function (k) { return areaStats[k].ofi; }) });

        const reportHtml = '<!DOCTYPE html><html><head>'
            + '<title>Audit Report — ' + d.report.client + '</title>'
            + '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">'
            + '<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>'
            + '<style>'
            + "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');"
            + '*{margin:0;padding:0;box-sizing:border-box;}'
            + "body{font-family:'Outfit',sans-serif;color:#1e293b;background:white;max-width:1050px;margin:0 auto;font-size:11pt;line-height:1.6;}"
            + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding-top:20mm;padding-bottom:14mm;font-size:10pt;}.page-break{page-break-before:always;}.no-print{display:none !important;}.section-card,tr{break-inside:avoid;}.sh{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;break-after:avoid;margin-top:12px;}.sb{break-before:avoid;}.watermark{display:flex !important;}}'
            + '@media print{@page{size:A4;margin:14mm 12mm 22mm 12mm;@bottom-center{content:"Page " counter(page) " of " counter(pages);font-family:Outfit,sans-serif;font-size:8pt;color:#64748b;}}.rpt-hdr{display:flex !important;}.rpt-ftr{display:flex !important;}.cover .rpt-hdr{display:none !important;}.cover .rpt-ftr{display:none !important;}}'
            + 'body{counter-reset:page;}'
            + '.page-break{counter-increment:page;}'
            + '.rpt-hdr{display:none;position:fixed;top:0;left:0;right:0;height:18mm;background:white;color:#1e293b;padding:3mm 12mm;align-items:center;justify-content:space-between;font-size:0.72rem;z-index:100;border-bottom:1px solid #e2e8f0;}'
            + '.rpt-hdr-left{display:flex;align-items:center;gap:8px;font-weight:700;font-size:0.82rem;color:#1e3a5f;max-width:30%;overflow:hidden;}'
            + '.rpt-hdr-logo{height:36px;max-width:160px;object-fit:contain;border-radius:3px;}'
            + '.rpt-hdr-logo-fallback{width:24px;height:24px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:#2563eb;}'
            + '.rpt-hdr-center{text-align:center;flex:1;font-size:0.68rem;color:#475569;letter-spacing:0.3px;text-transform:uppercase;}'
            + '.rpt-hdr-right{text-align:right;font-size:0.68rem;color:#64748b;}'
            + '.rpt-ftr{display:none;position:fixed;bottom:0;left:0;right:0;height:14mm;border-top:2px solid #2563eb;padding:2mm 12mm;align-items:center;justify-content:space-between;font-size:0.65rem;color:#64748b;background:white;z-index:100;}'
            + '.rpt-ftr-left{font-weight:600;color:#1e3a5f;font-size:0.65rem;max-width:35%;}'
            + '.rpt-ftr-center{flex:1;text-align:center;font-size:0.58rem;color:#94a3b8;font-style:italic;padding:0 6px;}'
            + '.rpt-ftr-right{text-align:right;font-weight:700;color:#1e3a5f;font-size:0.68rem;white-space:nowrap;}'
            + '.cover{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(180deg,#f8fafc 0%,#e0e7ff 50%,#f8fafc 100%);padding:80px 50px;position:relative;}'
            + '.cover-line{width:80px;height:4px;background:linear-gradient(90deg,#2563eb,#7c3aed);border-radius:2px;margin:0 auto 30px;}'
            + '.sh{background:#f8fafc;color:#1e293b;padding:14px 20px;font-weight:700;font-size:0.95rem;letter-spacing:0.5px;display:flex;align-items:center;gap:10px;border-radius:6px 6px 0 0;margin-top:28px;border-left:5px solid #2563eb;border-bottom:2px solid #e2e8f0;}'
            + '.sn{background:#2563eb;color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0;}'
            + '.sb{padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;}'
            + '.info-tbl{width:100%;border-collapse:collapse;}.info-tbl td{padding:8px 14px;border-bottom:1px solid #f1f5f9;font-size:0.88rem;}.info-tbl td:first-child{width:28%;color:#64748b;font-weight:600;}.info-tbl tr:nth-child(even){background:#f8fafc;}'
            + '.f-tbl{width:100%;border-collapse:collapse;font-size:0.85rem;table-layout:fixed;}.f-tbl th{background:#f1f5f9;color:#475569;font-weight:700;text-align:left;padding:8px 10px;border-bottom:2px solid #e2e8f0;}.f-tbl td{padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;overflow:hidden;}.f-tbl tbody tr:nth-child(even){background:#f8fafc;}.f-tbl tbody tr{break-inside:avoid;}'
            + '.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}'
            + '.stat-box{text-align:center;padding:16px 10px;border-radius:10px;border-bottom:3px solid transparent;}'
            + '.stat-val{font-size:1.8rem;font-weight:800;line-height:1;margin-bottom:4px;}'
            + '.stat-lbl{font-size:0.72rem;color:#64748b;font-weight:600;text-transform:uppercase;}'
            + '.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;}'
            + '.chart-box{background:white;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;}'
            + '.chart-box canvas{max-height:200px;max-width:100%;}'
            + '.chart-title{font-size:0.8rem;font-weight:700;color:#1e293b;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.3px;}'
            + '.ev-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}.ev-card{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;break-inside:avoid;}.ev-card img{width:100%;height:160px;object-fit:cover;}.ev-cap{padding:8px 12px;font-size:0.78rem;}.ev-cap strong{display:block;color:#1e293b;margin-bottom:2px;}.ev-cap span{color:#64748b;}'
            + '.toc{padding:30px 40px;}.toc-title{font-size:1.6rem;font-weight:800;color:#0f172a;margin-bottom:4px;}.toc-sub{font-size:0.88rem;color:#64748b;margin-bottom:20px;}.toc-line{width:60px;height:3px;background:linear-gradient(90deg,#2563eb,#7c3aed);border-radius:2px;margin-bottom:25px;}'
            + '.toc-item{display:flex;align-items:flex-start;gap:16px;padding:12px 0;border-bottom:1px solid #f1f5f9;text-decoration:none;color:inherit;}.toc-num{min-width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.82rem;color:white;flex-shrink:0;}.toc-item-body{flex:1;}.toc-item-title{font-weight:700;font-size:0.95rem;color:#1e293b;}.toc-item-desc{font-size:0.78rem;color:#94a3b8;margin-top:3px;}.toc-pg{min-width:40px;text-align:right;font-weight:700;font-size:0.88rem;color:#2563eb;align-self:center;white-space:nowrap;}'
            + 'footer{display:none;}'
            + '.content{padding:0 32px;}'
            + '.callout{padding:12px 16px;border-radius:8px;margin-top:14px;font-size:0.88rem;line-height:1.7;}'
            + '.ev-inline{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}.ev-inline img{height:80px;max-width:140px;border-radius:4px;border:1px solid #e2e8f0;object-fit:cover;}'
            + '.watermark{display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;justify-content:center;align-items:center;}.watermark span{transform:rotate(-35deg);font-size:72pt;font-weight:900;color:rgba(148,163,184,0.06);letter-spacing:8px;white-space:nowrap;font-family:Outfit,sans-serif;text-align:center;}'
            + '</style></head><body>'
            + '<div class="watermark"><span>CONFIDENTIAL</span></div>'
            + '<div class="rpt-hdr"><div class="rpt-hdr-left">' + (d.cbLogo ? '<img src="' + d.cbLogo + '" class="rpt-hdr-logo" alt="Logo">' : '<div class="rpt-hdr-logo-fallback"><i class="fa-solid fa-certificate"></i></div><span>' + (cbName || 'Certification Body') + '</span>') + '</div><div class="rpt-hdr-center"><div style="font-size:0.62rem;line-height:1.3;margin-bottom:2px;">' + standard + '</div><div style="font-size:0.72rem;font-weight:700;letter-spacing:0.5px;">AUDIT REPORT</div></div><div class="rpt-hdr-right">' + d.report.client + '<br>Ref: ' + d.report.id + '</div></div>'
            + '<div class="rpt-ftr"><div class="rpt-ftr-left">Doc Ref: ' + (d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : d.report.id) + '<br>' + (cbName || 'Certification Body') + '</div><div class="rpt-ftr-center">This document is confidential and intended solely for the audited organization.<br>Unauthorized copying or distribution is prohibited.</div><div class="rpt-ftr-right">' + d.today + '</div></div>'
            + '<div class="no-print" style="position:fixed;top:20px;right:20px;z-index:1000;display:flex;gap:8px;">'
            + '<button data-action="print" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.3);" aria-label="Download"><i class="fa fa-download" style="margin-right:6px;"></i>Download PDF</button>'
            + '<button data-action="close" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600;">Close</button></div>'
            // COVER PAGE
            + '<div class="cover">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;position:absolute;top:40px;left:0;right:0;padding:0 50px;">'
            + (d.cbLogo ? '<img src="' + d.cbLogo + '" style="height:60px;object-fit:contain;" alt="CB Logo">' : '<div></div>')
            + '<img src="' + d.qrCodeUrl + '" style="height:70px;" alt="QR"></div>'
            + '<div style="margin-top:40px;"></div>'
            + '<div class="cover-line"></div>'
            + '<h1 style="font-size:2.8rem;font-weight:800;color:#0f172a;letter-spacing:1px;">AUDIT REPORT</h1>'
            + '<p style="font-size:1.15rem;color:#64748b;margin-top:8px;">' + standard + '</p>'
            + '<div style="margin-top:50px;">'
            + (d.clientLogo ? '<img src="' + d.clientLogo + '" style="height:60px;object-fit:contain;margin-bottom:16px;" alt="Client">' : '')
            + '<div style="font-size:2rem;font-weight:700;color:#2563eb;">' + d.report.client + '</div>'
            + (d.client.industry ? '<div style="font-size:1rem;color:#64748b;margin-top:6px;">' + d.client.industry + '</div>' : '') + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 40px;max-width:480px;text-align:left;margin-top:50px;">'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Report Date</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.report.date || 'N/A') + (d.report.endDate ? ' — ' + d.report.endDate : '') + '</div></div>'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Report ID</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">#' + d.report.id.substring(0, 8) + '</div></div>'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Lead Auditor</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.report.leadAuditor || 'N/A') + '</div></div>'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Audit Type</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.auditPlan?.auditType || 'Initial') + '</div></div>'
            + (d.auditPlan?.team && d.auditPlan.team.length > 1 ? '<div style="grid-column:span 2;"><div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Audit Team</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + d.auditPlan.team.join(', ') + '</div></div>' : '')
            + '</div>'
            + '<div style="position:absolute;bottom:50px;left:50px;right:50px;border-top:2px solid #cbd5e1;padding-top:16px;">'
            + '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:#64748b;margin-bottom:10px;"><span><strong>Doc ID:</strong> RPT-' + d.report.id.substring(0, 8) + '</span><span><strong>Status:</strong> ' + (d.report.recommendation || 'Draft') + '</span><span><strong>Classification:</strong> Confidential</span></div>'
            + '<div style="font-size:0.68rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Document Revision History</div>'
            + '<table style="width:100%;font-size:0.68rem;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th style="padding:4px 8px;text-align:left;">Ver</th><th style="padding:4px 8px;text-align:left;">Date</th><th style="padding:4px 8px;text-align:left;">Author</th><th style="padding:4px 8px;text-align:left;">Description</th></tr></thead><tbody>'
            + '<tr><td style="padding:3px 8px;border-bottom:1px solid #e2e8f0;">1.0</td><td style="padding:3px 8px;border-bottom:1px solid #e2e8f0;">' + (d.report.date || d.today) + '</td><td style="padding:3px 8px;border-bottom:1px solid #e2e8f0;">' + (d.report.leadAuditor || 'Lead Auditor') + '</td><td style="padding:3px 8px;border-bottom:1px solid #e2e8f0;">Initial issue</td></tr>'
            + '</tbody></table></div>'
            + '</div>'
            // TABLE OF CONTENTS
            + (function () {
                let tocSections = [];
                let colors = ['#2563eb', '#0891b2', '#059669', '#7c3aed', '#059669', '#6366f1', '#8b5cf6', '#06b6d4', '#dc2626', '#ea580c', '#be185d', '#78716c', '#4338ca', '#1e293b', '#0d9488', '#9333ea', '#c2410c'];
                let descs = ['Organization details, scope, audit team and dates', 'Audit objectives, criteria and methodology', 'Key findings, opening meeting, positive observations & OFIs', 'Compliance charts, KPIs and clause-based breakdown', 'Verified conforming items with supporting evidence', 'Follow-up status of findings from previous audit', 'Audit observations noted during assessment', 'Opportunities for improvement identified', 'Detailed non-conformity findings with evidence', 'Formal NCR register with severity classifications', 'Required corrective actions with due dates', 'Changes to management system since last audit', 'Closing meeting, certification recommendation', 'Signatures and attestation', 'Controlled distribution of this report', 'Supporting documents and appendices', 'Photographic evidence from the audit'];
                let names = ['AUDIT INFORMATION', 'OBJECTIVES, CRITERIA & METHODOLOGY', 'EXECUTIVE SUMMARY', 'ANALYTICS DASHBOARD', 'CONFORMANCE VERIFICATION', 'PREVIOUS FINDINGS STATUS', 'OBSERVATIONS', 'OPPORTUNITIES FOR IMPROVEMENT', 'FINDING DETAILS', 'NCR REGISTER', 'CORRECTIVE ACTION REQUIREMENTS', 'CHANGES SINCE LAST AUDIT', 'AUDIT CONCLUSION & RECOMMENDATION', 'SIGNATURE & ATTESTATION', 'DISTRIBUTION LIST', 'ANNEXURES', 'EVIDENCE GALLERY'];
                let keys = ['audit-info', 'objectives', 'summary', 'charts', 'conformance', 'prev-findings', 'obs', 'ofi', 'findings', 'ncrs', 'corrective', 'changes', 'conclusion', 'signature', 'distribution', 'annexures', 'evidence'];
                let num = 1;
                for (var i = 0; i < keys.length; i++) {
                    let k = keys[i];
                    if (k === 'ncrs' && (!(d.report.ncrs || []).length)) continue;
                    if (k === 'corrective' && !(d.stats.majorNC + d.stats.minorNC)) continue;
                    if (k === 'obs' && !obsOnlyRowsHtml) continue;
                    if (k === 'ofi' && !ofiOnlyRowsHtml) continue;
                    if (k === 'evidence') {
                        let hasEvidence = (d.hydratedProgress || []).some(function (it) { return it.evidenceImage; }) || (d.report.ncrs || []).some(function (n) { return n.evidenceImage; });
                        if (!hasEvidence) continue;
                    }
                    if (en[k] !== false) {
                        tocSections.push('<a href="#sec-' + k + '" class="toc-item" data-toc-target="sec-' + k + '"><div class="toc-num" style="background:' + colors[i] + ';">' + num + '</div><div class="toc-item-body"><div class="toc-item-title">' + names[i] + '</div><div class="toc-item-desc">' + descs[i] + '</div></div><div class="toc-pg" data-pg-for="sec-' + k + '"></div></a>');
                        num++;
                    }
                }
                if (tocSections.length === 0) return '';
                return '<div class="toc page-break"><div class="toc-title">Table of Contents</div><div class="toc-sub">' + d.report.client + ' — ' + standard + '</div><div class="toc-line"></div>' + tocSections.join('') + '<div style="margin-top:30px;text-align:center;font-size:0.78rem;color:#94a3b8;"><i class="fa-solid fa-file-lines" style="margin-right:4px;"></i>' + tocSections.length + ' sections in this report</div></div>';
            })()
            + '<div class="content">'
            // SECTION 1
            + (en['audit-info'] !== false ? '<div id="sec-audit-info" class="sh page-break" style="background:#eff6ff;border-left-color:#2563eb;"><span class="sn" style="background:#2563eb;">1</span>AUDIT INFORMATION</div><div class="sb"><table class="info-tbl">'
                + '<tr><td>Client Name</td><td><strong>' + d.report.client + '</strong></td></tr>'
                + '<tr><td>Industry</td><td>' + (d.client.industry || 'N/A') + '</td></tr>'
                + '<tr><td>Certification Scope</td><td>' + (d.client.certificationScope || 'N/A') + '</td></tr>'
                + '<tr><td>Number of Employees</td><td>' + (d.client.employees || d.client.numberOfEmployees || 'N/A') + '</td></tr>'
                + '<tr><td>Audit Standard</td><td>' + standard + '</td></tr>'
                + '<tr><td>Audit Type</td><td>' + (d.auditPlan?.auditType || 'Initial') + '</td></tr>'
                + '<tr><td>Audit Dates</td><td>' + (d.report.date || 'N/A') + (d.report.endDate ? ' → ' + d.report.endDate : '') + '</td></tr>'
                + '<tr><td>Lead Auditor</td><td>' + (d.report.leadAuditor || 'N/A') + '</td></tr>'
                + '<tr><td>Audit Method</td><td>' + (d.auditPlan?.auditMethod || 'On-site') + '</td></tr>'
                + (function () { var s = (d.client.sites && d.client.sites[0]) || {}; var addr = [d.client.address || s.address, d.client.city || s.city, d.client.province, d.client.country || s.country].filter(Boolean).join(', ') || 'N/A'; return '<tr><td>Audit Location</td><td>' + addr + '</td></tr>'; })()
                + '<tr><td>Plan Reference</td><td>' + (d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : 'Not Linked') + '</td></tr>'
                + '</table>'
                + (d.client.goodsServices && d.client.goodsServices.length > 0 ? '<div style="margin-top:10px;font-size:0.85rem;color:#334155;"><strong>Goods & Services:</strong> ' + d.client.goodsServices.map(g => g.name + (g.category ? ' (' + g.category + ')' : '')).join(', ') + '</div>' : '')
                + (d.client.keyProcesses && d.client.keyProcesses.length > 0 ? '<div style="margin-top:6px;font-size:0.85rem;color:#334155;"><strong>Key Processes:</strong> ' + d.client.keyProcesses.map(p => (p.name || p)).join(', ') + '</div>' : '')
                + '</div>' : '')
            // SECTION: OBJECTIVES, CRITERIA & METHODOLOGY
            + (en['objectives'] !== false ? '<div id="sec-objectives" class="sh page-break" style="background:#ecfeff;border-left-color:#0891b2;"><span class="sn" style="background:#0891b2;">2</span>AUDIT OBJECTIVES, CRITERIA & METHODOLOGY</div><div class="sb">'
                + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">'
                + '<div><h4 style="margin:0 0 8px;font-size:0.9rem;color:#0891b2;"><i class="fa-solid fa-bullseye" style="margin-right:4px;"></i>Audit Objectives</h4><div style="white-space:pre-line;line-height:1.7;font-size:0.88rem;color:#334155;">' + (editedObjectives || '• Determine conformity of the management system with audit criteria\n• Evaluate the ability of the management system to ensure compliance with statutory, regulatory and contractual requirements\n• Evaluate the effectiveness of the management system in meeting its specified objectives\n• Identify areas for potential improvement of the management system') + '</div></div>'
                + '<div><h4 style="margin:0 0 8px;font-size:0.9rem;color:#6366f1;"><i class="fa-solid fa-scale-balanced" style="margin-right:4px;"></i>Audit Criteria</h4><div style="white-space:pre-line;line-height:1.7;font-size:0.88rem;color:#334155;">' + (editedCriteria || '• ' + standard + '\n• Organization management system documentation\n• Applicable legal and regulatory requirements\n• Previous audit findings and corrective action records') + '</div></div>'
                + '<div><h4 style="margin:0 0 8px;font-size:0.9rem;color:#0d9488;"><i class="fa-solid fa-microscope" style="margin-right:4px;"></i>Audit Methodology</h4><div style="white-space:pre-line;line-height:1.7;font-size:0.88rem;color:#334155;">' + (editedMethodology || '• Risk-based sampling of processes, records, and documentation\n• Interviews with management and operational personnel\n• Observation of activities and work environment on-site\n• Review of documented information and objective evidence') + '</div></div>'
                + '</div></div>' : '')
            // SECTION 2
            + (en['summary'] !== false ? '<div id="sec-summary" class="sh page-break" style="background:#ecfdf5;border-left-color:#059669;"><span class="sn" style="background:#059669;">3</span>EXECUTIVE SUMMARY</div><div class="sb">'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">'
                + '<div style="padding:10px 14px;background:#f0f9ff;border-radius:8px;border-left:3px solid #2563eb;"><div style="font-size:0.72rem;color:#64748b;font-weight:600;text-transform:uppercase;">Audit Type</div><div style="font-size:0.9rem;color:#1e293b;font-weight:600;margin-top:2px;">' + (d.auditPlan?.auditType || 'Initial') + '</div></div>'
                + '<div style="padding:10px 14px;background:#f0fdf4;border-radius:8px;border-left:3px solid #059669;"><div style="font-size:0.72rem;color:#64748b;font-weight:600;text-transform:uppercase;">Audit Dates</div><div style="font-size:0.9rem;color:#1e293b;font-weight:600;margin-top:2px;">' + (d.report.date || 'N/A') + (d.report.endDate ? ' — ' + d.report.endDate : '') + '</div></div>'
                + '<div style="padding:10px 14px;background:#faf5ff;border-radius:8px;border-left:3px solid #7c3aed;"><div style="font-size:0.72rem;color:#64748b;font-weight:600;text-transform:uppercase;">Duration</div><div style="font-size:0.9rem;color:#1e293b;font-weight:600;margin-top:2px;">' + (d.auditPlan?.manDays || d.auditPlan?.man_days || 'N/A') + ' Man-Days' + (d.auditPlan?.onsiteDays ? ' (' + d.auditPlan.onsiteDays + ' On-site)' : '') + '</div></div>'
                + '<div style="padding:10px 14px;background:#fff7ed;border-radius:8px;border-left:3px solid #ea580c;"><div style="font-size:0.72rem;color:#64748b;font-weight:600;text-transform:uppercase;">Method</div><div style="font-size:0.9rem;color:#1e293b;font-weight:600;margin-top:2px;">' + (d.auditPlan?.auditMethod || 'On-site') + '</div></div></div>'
                + '<div style="color:#334155;font-size:0.95rem;line-height:1.8;">' + (formatRichText(editedSummary) || '<em>No executive summary recorded.</em>') + '</div>'
                + areaTableHtml
                + '<div style="padding:16px;background:#f0fdf4;border-radius:10px;margin-top:14px;border-left:4px solid #0891b2;"><strong style="color:#0e7490;font-size:0.9rem;">Opening Meeting</strong><table class="info-tbl" style="margin-top:8px;"><tr><td style="width:20%;">Date</td><td>' + (d.report.openingMeeting?.date || 'N/A') + '</td></tr><tr><td>Attendees</td><td>' + (function () { var att = d.report.openingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(function (a) { return typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a; }).filter(Boolean).join(', ') || 'N/A'; return String(att); })() + '</td></tr>' + (editedOpeningNotes ? '<tr><td>Notes</td><td>' + editedOpeningNotes + '</td></tr>' : '') + '</table></div>'
                + (editedPositiveObs ? '<div class="sh page-break" style="background:#f0fdf4;border-left-color:#22c55e;"><span class="sn" style="background:#16a34a;"><i class="fa-solid fa-thumbs-up"></i></span>POSITIVE OBSERVATIONS</div><div class="sb"><div style="color:#15803d;font-size:0.95rem;line-height:1.8;">' + formatPositiveObs(editedPositiveObs) + '</div></div>' : '')
                + '</div>' : '')
            // SECTION 3
            + (en['charts'] !== false ? '<div id="sec-charts" class="sh page-break" style="background:#f5f3ff;border-left-color:#7c3aed;"><span class="sn" style="background:#7c3aed;">3</span>COMPLIANCE OVERVIEW</div><div class="sb">'
                + '<div class="stat-grid">'
                + '<div class="stat-box" style="background:#f0fdf4;border-color:#22c55e;"><div class="stat-val" style="color:#16a34a;">' + Math.round((d.stats.conformCount / ((d.stats.totalItems - d.stats.naCount) || 1)) * 100) + '%</div><div class="stat-lbl">Compliance Score</div></div>'
                + '<div class="stat-box" style="background:#fef2f2;border-color:#ef4444;"><div class="stat-val" style="color:#dc2626;">' + d.stats.actualNCCount + '</div><div class="stat-lbl">Non-Conformities</div></div>'
                + '<div class="stat-box" style="background:#fffbeb;border-color:#f59e0b;"><div class="stat-val" style="color:#d97706;">' + d.stats.obsOfiCount + '</div><div class="stat-lbl">Observations / OFI</div></div>'
                + '<div class="stat-box" style="background:#eff6ff;border-color:#2563eb;"><div class="stat-val" style="color:#2563eb;">' + d.stats.totalItems + '</div><div class="stat-lbl">Total Checks</div></div></div>'
                + '<div class="chart-grid"><div class="chart-box"><div class="chart-title">Compliance Breakdown</div><canvas id="chart-doughnut"></canvas></div>'
                + '<div class="chart-box"><div class="chart-title">NC by Clause Section</div><canvas id="chart-clause"></canvas></div>'
                + '<div class="chart-box"><div class="chart-title">Findings Distribution</div><canvas id="chart-findings"></canvas></div>'
                + '<div class="chart-box"><div class="chart-title">Area Performance</div><canvas id="chart-area"></canvas></div></div>'
                + '<div class="chart-grid" style="margin-top:16px;"><div class="chart-box"><div class="chart-title">Department Findings</div><canvas id="chart-dept"></canvas></div>'
                + '<div class="chart-box"><div class="chart-title">Personnel Workload</div><canvas id="chart-workload"></canvas></div></div>'
                + '<div class="chart-grid" style="margin-top:16px;"><div class="chart-box"><div class="chart-title">Compliance by Department</div><canvas id="chart-radar"></canvas></div>'
                + '<div class="chart-box"></div></div>'
                + '<div style="margin-top:18px;"><div style="font-weight:700;font-size:0.9rem;color:#1e293b;margin-bottom:10px;"><i class="fa-solid fa-building" style="margin-right:6px;color:#6366f1;"></i>Department Summary</div><table class="f-tbl"><thead><tr style="background:#f8fafc;"><th style="width:25%;">Department</th><th style="width:15%;text-align:center;">Personnel</th><th style="width:15%;text-align:center;">Items</th><th style="width:15%;text-align:center;">Conform</th><th style="width:15%;text-align:center;">NC</th><th style="width:15%;text-align:center;">Compliance</th></tr></thead><tbody>'
                + (function () { var deptMap = {}; (d.hydratedProgress || []).forEach(function (i) { var dept = i.department || 'Unassigned'; if (!deptMap[dept]) deptMap[dept] = { pers: {}, items: 0, conform: 0, nc: 0 }; if (i.personnel) deptMap[dept].pers[i.personnel] = 1; deptMap[dept].items++; if (i.status === 'conform') deptMap[dept].conform++; else if (i.status === 'nc') deptMap[dept].nc++; }); return Object.keys(deptMap).sort().map(function (dept) { var d2 = deptMap[dept]; var pct = d2.items > 0 ? Math.round((d2.conform / d2.items) * 100) : 0; var clr = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'; return '<tr><td style="padding:8px 10px;font-weight:500;">' + dept + '</td><td style="padding:8px 10px;text-align:center;">' + Object.keys(d2.pers).length + '</td><td style="padding:8px 10px;text-align:center;">' + d2.items + '</td><td style="padding:8px 10px;text-align:center;color:#16a34a;font-weight:600;">' + d2.conform + '</td><td style="padding:8px 10px;text-align:center;color:#dc2626;font-weight:600;">' + d2.nc + '</td><td style="padding:8px 10px;text-align:center;"><span style="padding:2px 8px;border-radius:12px;font-weight:700;font-size:0.78rem;background:' + clr + '15;color:' + clr + ';">' + pct + '%</span></td></tr>'; }).join(''); })()
                + '</tbody></table></div></div>' : '')
            // SECTION 4 - CONFORMANCE VERIFICATION
            + (en['conformance'] !== false && conformRowsHtml ? '<div id="sec-conformance" class="sh page-break" style="background:#ecfdf5;border-left-color:#10b981;"><span class="sn" style="background:#10b981;">4</span>CONFORMANCE VERIFICATION</div><div class="sb" style="padding:0;"><table class="f-tbl"><thead><tr style="background:#f0fdf4;"><th style="width:12%;">Clause</th><th style="width:28%;">ISO Requirement</th><th style="width:12%;text-align:center;">Status</th><th style="width:48%;">Evidence & Remarks</th></tr></thead><tbody>' + conformRowsHtml + '</tbody></table></div>' : '')
            // SECTION 5 - OBSERVATIONS
            + (obsOnlyRowsHtml ? '<div id="sec-obs" class="sh page-break" style="background:#f5f3ff;border-left-color:#7c3aed;"><span class="sn" style="background:#7c3aed;">5</span>OBSERVATIONS</div><div class="sb" style="padding:0;"><table class="f-tbl"><thead><tr style="background:#f5f3ff;"><th style="width:12%;">Clause</th><th style="width:28%;">ISO Requirement</th><th style="width:12%;text-align:center;">Type</th><th style="width:48%;">Details</th></tr></thead><tbody>' + obsOnlyRowsHtml + '</tbody></table></div>' : '')
            // SECTION 6 - OPPORTUNITIES FOR IMPROVEMENT
            + (ofiOnlyRowsHtml ? '<div id="sec-ofi" class="sh page-break" style="background:#ecfeff;border-left-color:#06b6d4;"><span class="sn" style="background:#06b6d4;">6</span>OPPORTUNITIES FOR IMPROVEMENT</div><div class="sb" style="padding:0;"><table class="f-tbl"><thead><tr style="background:#ecfeff;"><th style="width:12%;">Clause</th><th style="width:28%;">ISO Requirement</th><th style="width:12%;text-align:center;">Type</th><th style="width:48%;">Recommendation</th></tr></thead><tbody>' + ofiOnlyRowsHtml + '</tbody></table></div>' : '')
            + (en['findings'] !== false ? '<div id="sec-findings" class="sh page-break" style="background:#fef2f2;border-left-color:#dc2626;"><span class="sn" style="background:#dc2626;">7</span>FINDING DETAILS</div><div class="sb" style="padding:0;"><table class="f-tbl"><thead><tr><th style="width:12%;">Clause</th><th style="width:28%;">ISO Requirement</th><th style="width:12%;text-align:center;">Severity</th><th style="width:48%;">Evidence & Remarks</th></tr></thead><tbody>' + (ncRowsHtml || '<tr><td colspan="4" style="padding:24px;text-align:center;color:#94a3b8;">No findings recorded.</td></tr>') + '</tbody></table></div>' : '')
            // SECTION 8 - NCR REGISTER
            + (en['ncrs'] !== false && (d.report.ncrs || []).length > 0 ? '<div id="sec-ncrs" class="sh page-break" style="background:#fff7ed;border-left-color:#ea580c;"><span class="sn" style="background:#ea580c;">8</span>NCR REGISTER</div><div class="sb">' + d.report.ncrs.map(ncr => '<div style="padding:14px 18px;border-left:4px solid ' + (ncr.type === 'Major' ? '#dc2626' : '#f59e0b') + ';background:' + (ncr.type === 'Major' ? '#fef2f2' : '#fffbeb') + ';border-radius:0 8px 8px 0;margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;"><strong style="font-size:0.95rem;">' + ncr.type + ' — Clause ' + ncr.clause + '</strong><span style="color:#64748b;font-size:0.82rem;">' + (ncr.createdAt ? new Date(ncr.createdAt).toLocaleDateString() : '') + '</span></div><div style="color:#334155;font-size:0.9rem;margin-top:8px;line-height:1.7;">' + fmtRemark(ncr.description) + '</div>' + (ncr.evidenceImage ? '<div style="margin-top:8px;"><img src="' + ncr.evidenceImage + '" style="max-height:120px;border-radius:6px;border:1px solid #e2e8f0;"></div>' : '') + '</div>').join('') + '</div>' : '')

            // EVIDENCE GALLERY
            + (function () {
                let evidenceItems = [];
                (d.hydratedProgress || []).forEach(function (item) {
                    let imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
                    imgs.forEach(function (img) {
                        evidenceItems.push({ clause: item.kbMatch ? item.kbMatch.clause : item.clause, title: item.kbMatch ? item.kbMatch.title : (item.requirement || ''), img: img, status: item.status });
                    });
                });
                (d.report.ncrs || []).forEach(function (ncr) {
                    if (ncr.evidenceImage) {
                        evidenceItems.push({ clause: ncr.clause, title: ncr.type + ' Non-Conformity', img: ncr.evidenceImage, status: 'nc' });
                    }
                });
                if (evidenceItems.length === 0) return '';
                let cards = evidenceItems.map(function (ev) {
                    let borderColor = ev.status === 'nc' ? '#ef4444' : ev.status === 'observation' ? '#3b82f6' : '#22c55e';
                    return '<div class="ev-card" style="border-top:3px solid ' + borderColor + ';"><img src="' + ev.img + '" alt="Evidence"><div class="ev-cap"><strong>Clause ' + ev.clause + '</strong><span>' + (ev.title || 'Audit Evidence') + '</span></div></div>';
                }).join('');
                return '<div id="sec-evidence" class="sh page-break" style="background:#fff7ed;border-left-color:#c2410c;"><span class="sn" style="background:#c2410c;"><i class="fa-solid fa-camera"></i></span>EVIDENCE GALLERY</div><div class="sb"><div class="ev-grid">' + cards + '</div><div style="margin-top:16px;font-size:0.82rem;color:#64748b;text-align:center;"><i class="fa-solid fa-info-circle" style="margin-right:4px;"></i>' + evidenceItems.length + ' evidence photo(s) collected during audit</div></div>';
            })()
            // SECTION: CORRECTIVE ACTION REQUIREMENTS
            + ((d.stats.majorNC + d.stats.minorNC) > 0 && en['corrective'] !== false ? '<div id="sec-corrective" class="sh page-break" style="background:#fdf2f8;border-left-color:#be185d;"><span class="sn" style="background:#be185d;">10</span>CORRECTIVE ACTION REQUIREMENTS</div><div class="sb">'
                + '<table class="info-tbl"><thead><tr style="background:#fdf2f8;"><th style="width:12%;">NC Ref</th><th style="width:10%;">Clause</th><th style="width:10%;">Type</th><th style="width:35%;">Corrective Action Required</th><th style="width:13%;">Due Date</th><th style="width:20%;">Verification</th></tr></thead><tbody>'
                + (function () { var ncItems = (d.report.checklistProgress || []).filter(function (p) { return p.status === 'nc' && p.ncrType && p.ncrType.toLowerCase() !== 'observation' && p.ncrType.toLowerCase() !== 'ofi'; }); var ncrItems = d.report.ncrs || []; var rows = ''; ncItems.forEach(function (item, i) { var typ = item.ncrType || 'Minor'; var due = new Date(); due.setDate(due.getDate() + (typ === 'Major' ? 30 : 90)); rows += '<tr><td style="font-family:monospace;font-weight:600;color:#be185d;">NCR-' + String(d.report.id).substring(0, 6) + '-' + (i + 1) + '</td><td>' + (item.clauseRef || item.clause || '') + '</td><td><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;' + (typ === 'Major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + typ + '</span></td><td>Root cause analysis and corrective action required</td><td style="font-weight:600;color:#be185d;">' + due.toISOString().split('T')[0] + '</td><td>Document review & follow-up</td></tr>'; }); ncrItems.forEach(function (ncr, i) { var typ = ncr.type || 'Minor'; var due = new Date(); due.setDate(due.getDate() + (typ === 'Major' ? 30 : 90)); rows += '<tr><td style="font-family:monospace;font-weight:600;color:#be185d;">NCR-' + String(d.report.id).substring(0, 6) + '-' + (ncItems.length + i + 1) + '</td><td>' + (ncr.clause || '') + '</td><td><span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;' + (typ === 'Major' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + typ + '</span></td><td>Root cause analysis and corrective action required</td><td style="font-weight:600;color:#be185d;">' + due.toISOString().split('T')[0] + '</td><td>Document review & follow-up</td></tr>'; }); return rows; })()
                + '</tbody></table>'
                + '<div style="margin-top:12px;padding:10px;background:#fef2f8;border-radius:8px;font-size:0.82rem;color:#9d174d;"><strong>Timeframes:</strong> Major NC — 30 days | Minor NC — 90 days from report issuance</div>'
                + '</div>' : '')
            // SECTION: CHANGES SINCE LAST AUDIT
            + (en['changes'] !== false ? '<div id="sec-changes" class="sh page-break" style="background:#f5f5f4;border-left-color:#78716c;"><span class="sn" style="background:#78716c;">11</span>CHANGES SINCE LAST AUDIT</div><div class="sb">'
                + '<div style="color:#334155;font-size:0.95rem;line-height:1.8;">' + (editedChanges || 'No significant changes to the management system scope, documentation, or organizational structure have been reported since the last audit.') + '</div>'
                + '</div>' : '')
            // SECTION 7
            + (en['conclusion'] !== false ? '<div id="sec-conclusion" class="sh page-break" style="background:#eef2ff;border-left-color:#4338ca;"><span class="sn" style="background:#4338ca;">12</span>AUDIT CONCLUSION & RECOMMENDATION</div><div class="sb">'
                + '<div style="margin-bottom:16px;"><strong style="color:#334155;">Certification Recommendation:</strong> <span style="margin-left:8px;padding:5px 18px;border-radius:20px;font-weight:700;font-size:0.88rem;' + (d.report.recommendation === 'Recommended' ? 'background:#dcfce7;color:#166534;' : d.report.recommendation === 'Not Recommended' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + (d.report.recommendation || 'Pending') + '</span></div>'
                + '<div style="color:#334155;font-size:0.95rem;line-height:1.8;">' + formatRichText(editedConclusion) + '</div>'
                + '<div style="padding:16px;background:#eff6ff;border-radius:10px;margin-top:16px;border-left:4px solid #1e40af;"><strong style="color:#1e40af;font-size:0.9rem;">Closing Meeting</strong><table class="info-tbl" style="margin-top:8px;"><tr><td style="width:20%;">Date</td><td>' + (d.report.closingMeeting?.date || 'N/A') + '</td></tr><tr><td>Attendees</td><td>' + (function () { var att = d.report.closingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(function (a) { return typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a; }).filter(Boolean).join(', ') || 'N/A'; return String(att); })() + '</td></tr><tr><td>Summary</td><td>' + (editedClosingSummary || 'N/A') + '</td></tr></table></div>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;">'
                + '<div style="text-align:center;"><div style="border-bottom:1px solid #94a3b8;padding-bottom:8px;margin-bottom:6px;">&nbsp;</div><div style="font-size:0.85rem;color:#64748b;">Lead Auditor Signature</div><div style="font-size:0.88rem;color:#1e293b;font-weight:600;margin-top:4px;">' + (d.report.leadAuditor || '') + '</div></div>'
                + '<div style="text-align:center;"><div style="border-bottom:1px solid #94a3b8;padding-bottom:8px;margin-bottom:6px;">&nbsp;</div><div style="font-size:0.85rem;color:#64748b;">Client Representative</div></div></div></div>' : '')
            // SECTION: SIGNATURE & ATTESTATION
            + (en['signature'] !== false ? '<div id="sec-signature" class="sh page-break" style="background:#f8fafc;border-left-color:#1e293b;"><span class="sn" style="background:#1e293b;">13</span>SIGNATURE & ATTESTATION</div><div class="sb">'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;">'
                + '<div style="padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;font-weight:600;">Lead Auditor</div><div style="font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:6px;">' + (d.auditPlan?.team?.[0] || d.report.leadAuditor || '') + '</div><div style="border-bottom:2px solid #1e293b;width:100%;margin:24px 0 6px;"></div><div style="font-size:0.8rem;color:#64748b;">Signature</div><div style="margin-top:12px;font-size:0.85rem;color:#475569;">Date: ' + (editedSigDate || d.today) + '</div></div>'
                + '<div style="padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;font-weight:600;">Technical Reviewer / Certification Manager</div><div style="font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:6px;">' + (editedReviewerName || '____________________') + '</div><div style="border-bottom:2px solid #1e293b;width:100%;margin:24px 0 6px;"></div><div style="font-size:0.8rem;color:#64748b;">Signature</div><div style="margin-top:12px;font-size:0.85rem;color:#475569;">Date: ' + (editedReviewerDate || '____________________') + '</div></div>'
                + '</div>'
                + '<div style="margin-top:20px;padding:12px;background:#f0f9ff;border-radius:8px;font-size:0.82rem;color:#0c4a6e;text-align:center;"><i class="fa-solid fa-shield-halved" style="margin-right:4px;"></i>This report is confidential and intended solely for the audited organization, the certification body, and the accreditation body. Unauthorized copying or distribution is prohibited.</div>'
                + '</div>' : '')
            // SECTION: DISTRIBUTION LIST
            + (en['distribution'] !== false ? '<div id="sec-distribution" class="sh page-break" style="background:#f0fdfa;border-left-color:#0d9488;"><span class="sn" style="background:#0d9488;">14</span>DISTRIBUTION LIST</div><div class="sb">'
                + '<div style="margin-bottom:10px;font-size:0.85rem;color:#64748b;">This report is distributed to the following parties. Unauthorized distribution is prohibited.</div>'
                + '<table class="info-tbl"><thead><tr style="background:#f0fdfa;"><th style="width:5%;">#</th><th style="width:30%;">Recipient</th><th style="width:25%;">Role</th><th style="width:25%;">Organization</th><th style="width:15%;">Format</th></tr></thead><tbody>'
                + '<tr><td>1</td><td style="font-weight:600;">' + (d.report.leadAuditor || 'Lead Auditor') + '</td><td>Lead Auditor</td><td>' + (cbName || 'Certification Body') + '</td><td>Original</td></tr>'
                + '<tr><td>2</td><td style="font-weight:600;">' + (editedReviewerName || 'Technical Reviewer') + '</td><td>Technical Reviewer</td><td>' + (cbName || 'Certification Body') + '</td><td>Copy</td></tr>'
                + '<tr><td>3</td><td style="font-weight:600;">' + d.report.client + '</td><td>Client Representative</td><td>' + d.report.client + '</td><td>Copy</td></tr>'
                + '<tr><td>4</td><td>Certification Records</td><td>File / Archive</td><td>' + (cbName || 'Certification Body') + '</td><td>Archive</td></tr>'
                + '</tbody></table></div>' : '')
            // SECTION: ANNEXURES
            + (en['annexures'] !== false ? '<div id="sec-annexures" class="sh page-break" style="background:#faf5ff;border-left-color:#9333ea;"><span class="sn" style="background:#9333ea;">15</span>ANNEXURES / APPENDICES</div><div class="sb">'
                + '<div style="line-height:1.8;color:#334155;">'
                + '<div style="font-weight:700;margin-bottom:6px;">Annexure A — Audit Plan Reference</div>'
                + '<div style="margin-bottom:4px;">• Plan Reference: ' + (d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : 'N/A') + '</div>'
                + '<div style="margin-bottom:12px;">• Standard: ' + standard + '</div>'
                + '<div style="font-weight:700;margin-bottom:6px;">Annexure B — Checklist Summary</div>'
                + '<div style="margin-bottom:4px;">• Total Items Audited: ' + d.stats.totalItems + '</div>'
                + '<div style="margin-bottom:4px;">• Conforming: ' + d.stats.conformCount + ' | NC: ' + (d.stats.majorNC + d.stats.minorNC) + ' | Observations: ' + d.stats.observationCount + ' | OFI: ' + d.stats.ofiCount + '</div>'
                + '<div style="margin-bottom:12px;">• N/A Items: ' + d.stats.naCount + '</div>'
                + '</div></div>' : '')
            + '</div>'
            // FOOTER
            + '<footer><div>' + (cbName ? '<strong>' + cbName + '</strong>' : '') + (cbEmail ? '<br>' + cbEmail : '') + '</div>'
            + '<div style="text-align:center;font-size:0.75rem;color:#94a3b8;font-style:italic;max-width:340px;">This report has been prepared in accordance with ' + standard + ' requirements. Distribution is limited to authorized personnel only.</div>'
            + '<div style="text-align:right;">Doc Ref: ' + (d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : d.report.id) + '<br>Issue Date: ' + d.today + '</div></footer>'
            // CHARTS SCRIPT
            + '<script>'
            + 'function rc(){'
            + 'var c1=document.getElementById("chart-doughnut");'
            + 'if(c1)new Chart(c1,{type:"doughnut",data:{labels:["Conformity","Minor NC","Major NC","Observations"],datasets:[{data:[' + d.stats.conformCount + ',' + d.stats.minorNC + ',' + d.stats.majorNC + ',' + d.stats.observationCount + '],backgroundColor:["#22c55e","#f59e0b","#ef4444","#3b82f6"],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:"bottom",labels:{font:{size:11}}}}}});'
            + 'var c2=document.getElementById("chart-clause");'
            + 'if(c2)new Chart(c2,{type:"bar",data:{labels:' + JSON.stringify(clauseLabels.map(l => 'Clause ' + l)) + ',datasets:[{label:"NCs",data:' + JSON.stringify(clauseValues) + ',backgroundColor:"#2563eb",borderRadius:4}]},options:{responsive:true,indexAxis:"y",plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{stepSize:1}}}}});'
            + 'var c3=document.getElementById("chart-findings");'
            + 'if(c3)new Chart(c3,{type:"pie",data:{labels:["Conform","Non-Conformity","N/A"],datasets:[{data:[' + d.stats.conformCount + ',' + d.stats.ncCount + ',' + d.stats.naCount + '],backgroundColor:["#22c55e","#ef4444","#94a3b8"],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:"bottom",labels:{font:{size:11}}}}}});'
            + 'var c4=document.getElementById("chart-area");'
            + 'if(c4){var ad=' + areaChartData + ';new Chart(c4,{type:"bar",data:{labels:ad.names,datasets:[{label:"Conform",data:ad.conform,backgroundColor:"#22c55e",borderRadius:3},{label:"NC",data:ad.nc,backgroundColor:"#ef4444",borderRadius:3},{label:"OBS",data:ad.obs,backgroundColor:"#3b82f6",borderRadius:3},{label:"OFI",data:ad.ofi,backgroundColor:"#f59e0b",borderRadius:3}]},options:{responsive:true,indexAxis:"y",plugins:{legend:{position:"bottom",labels:{font:{size:10}}}},scales:{x:{stacked:true,beginAtZero:true,ticks:{stepSize:1}},y:{stacked:true,ticks:{font:{size:9}}}}}});}'
            // Chart 5: Department Findings
            + 'var c5=document.getElementById("chart-dept");'
            + 'if(c5){var dd=' + JSON.stringify((function () { var deptData = {}; (d.hydratedProgress || []).forEach(function (item) { var dept = item.department || ''; if (!dept) return; if (!deptData[dept]) deptData[dept] = { major: 0, minor: 0, obs: 0, conform: 0 }; if (item.status === 'nc') { var t = (item.ncrType || '').toLowerCase(); if (t === 'major') deptData[dept].major++; else if (t === 'minor') deptData[dept].minor++; else deptData[dept].obs++; } else if (item.status === 'conform') deptData[dept].conform++; }); var labels = Object.keys(deptData).sort(); return { labels: labels, major: labels.map(function (l) { return deptData[l].major; }), minor: labels.map(function (l) { return deptData[l].minor; }), obs: labels.map(function (l) { return deptData[l].obs; }), conform: labels.map(function (l) { return deptData[l].conform; }) }; })()) + ';'
            + 'if(dd.labels.length>0)new Chart(c5,{type:"bar",data:{labels:dd.labels,datasets:[{label:"Major NC",data:dd.major,backgroundColor:"#dc2626",stack:"d"},{label:"Minor NC",data:dd.minor,backgroundColor:"#f59e0b",stack:"d"},{label:"OBS",data:dd.obs,backgroundColor:"#fbbf24",stack:"d"},{label:"Conform",data:dd.conform,backgroundColor:"#22c55e",stack:"d"}]},options:{responsive:true,indexAxis:"y",plugins:{legend:{position:"bottom",labels:{font:{size:10}}}},scales:{x:{stacked:true,beginAtZero:true,ticks:{stepSize:1}},y:{stacked:true,ticks:{font:{size:9}}}}}});else c5.parentElement.innerHTML="<div style=\\"text-align:center;padding:20px;color:#94a3b8;font-size:0.82rem;\\">No department data</div>";}'
            // Chart 6: Personnel Workload
            + 'var c6=document.getElementById("chart-workload");'
            + 'if(c6){var pd=' + JSON.stringify((function () { var persData = {}; (d.hydratedProgress || []).forEach(function (item) { if (!item.personnel) return; if (!persData[item.personnel]) persData[item.personnel] = { conform: 0, nc: 0, na: 0 }; if (item.status === 'conform') persData[item.personnel].conform++; else if (item.status === 'nc') persData[item.personnel].nc++; else if (item.status === 'na') persData[item.personnel].na++; }); var labels = Object.keys(persData).sort(function (a, b) { return (persData[b].conform + persData[b].nc + persData[b].na) - (persData[a].conform + persData[a].nc + persData[a].na); }).slice(0, 10); return { labels: labels, conform: labels.map(function (p) { return persData[p].conform; }), nc: labels.map(function (p) { return persData[p].nc; }), na: labels.map(function (p) { return persData[p].na; }) }; })()) + ';'
            + 'if(pd.labels.length>0)new Chart(c6,{type:"bar",data:{labels:pd.labels,datasets:[{label:"Conform",data:pd.conform,backgroundColor:"#22c55e",stack:"p"},{label:"NC",data:pd.nc,backgroundColor:"#ef4444",stack:"p"},{label:"N/A",data:pd.na,backgroundColor:"#94a3b8",stack:"p"}]},options:{responsive:true,indexAxis:"y",plugins:{legend:{position:"bottom",labels:{font:{size:10}}}},scales:{x:{stacked:true,beginAtZero:true,ticks:{stepSize:1}},y:{stacked:true,ticks:{font:{size:9}}}}}});else c6.parentElement.innerHTML="<div style=\\"text-align:center;padding:20px;color:#94a3b8;font-size:0.82rem;\\">No personnel data</div>";}'
            // Chart 7: Compliance Radar
            + 'var c7=document.getElementById("chart-radar");'
            + 'if(c7){var rd=' + JSON.stringify((function () { var rData = {}; (d.hydratedProgress || []).forEach(function (item) { if (!item.department) return; if (!rData[item.department]) rData[item.department] = { total: 0, conform: 0 }; rData[item.department].total++; if (item.status === 'conform') rData[item.department].conform++; }); var labels = Object.keys(rData).sort(); return { labels: labels, data: labels.map(function (l) { return rData[l].total > 0 ? Math.round((rData[l].conform / rData[l].total) * 100) : 0; }) }; })()) + ';'
            + 'if(rd.labels.length>=3)new Chart(c7,{type:"radar",data:{labels:rd.labels,datasets:[{label:"Compliance %",data:rd.data,borderColor:"#6366f1",backgroundColor:"rgba(99,102,241,0.15)",borderWidth:2,pointBackgroundColor:"#6366f1"}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{r:{beginAtZero:true,max:100,ticks:{stepSize:25,font:{size:9}},pointLabels:{font:{size:10}}}}}});else c7.parentElement.innerHTML="<div style=\\"text-align:center;padding:20px;color:#94a3b8;font-size:0.82rem;\\">Need 3+ departments</div>";}'
            + 'setTimeout(function(){document.querySelectorAll("canvas").forEach(function(cv){try{var im=document.createElement("img");im.src=cv.toDataURL("image/png");im.style.maxWidth="100%";im.style.maxHeight=cv.style.maxHeight||"200px";im.style.objectFit="contain";cv.parentNode.replaceChild(im,cv);}catch(e){}});},2000);'
            + '}rc();'
            + 'setTimeout(function(){try{'
            + 'var pageH=1123;'
            + 'var tocItems=document.querySelectorAll(".toc-item[data-toc-target]");'
            + 'tocItems.forEach(function(item){'
            + 'var targetId=item.getAttribute("data-toc-target");'
            + 'var el=document.getElementById(targetId);'
            + 'if(!el)return;'
            + 'var top=el.getBoundingClientRect().top+window.scrollY;'
            + 'var pg=Math.ceil(top/pageH)+1;'
            + 'var pgEl=item.querySelector(".toc-pg");'
            + 'if(pgEl)pgEl.textContent=pg;'
            + '});'
            + '}catch(e){console.warn("TOC page calc:",e);}'
            + '},1200);'
            + '<\/script></body></html>';

        printWindow.document.write(reportHtml);
        printWindow.document.close();
        setTimeout(function () { printWindow.print(); }, 1800);
        let overlay = document.getElementById('report-preview-overlay');
        if (overlay) overlay.remove();
    };

    window.openCreateReportModal = openCreateReportModal;
    window.openEditReportModal = openEditReportModal;


})();

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateAuditReport: window.generateAuditReport, showReportPreviewModal: window.showReportPreviewModal, toggleReportSection: window.toggleReportSection, exportReportPDF: window.exportReportPDF, runFollowUpAIAnalysis: window.runFollowUpAIAnalysis, polishNotesWithAI: window.polishNotesWithAI, polishSingleNote: window.polishSingleNote };
}
